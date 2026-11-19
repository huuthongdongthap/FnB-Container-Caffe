// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateJWT } from '../worker/src/lib/jwt';
import { staffSessionFixture } from '../worker/src/__tests__/helpers/staff-session-fixture';
import { logoutUser } from '../worker/src/tree/auth/logout';
import {
  persistOtpChallenge,
  consumeOtpChallenge,
  recordOtpFailedAttempt,
} from '../worker/src/tree/loyalty/helpers';
import {
  hashOrderToken,
  verifyGuestOrderToken,
  canAccessOrder,
  claimGuestOrder,
} from '../packages/domain/customer/policies/order-ownership-policy';

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(here, '../worker/schema.sql'), 'utf8');
const databases: DatabaseSync[] = [];

function makeSqliteD1() {
  const sqlite = new DatabaseSync(':memory:');
  databases.push(sqlite);
  sqlite.exec(schema);
  const db = {
    prepare(sql: string) {
      let binds: (string | number | null)[] = [];
      const stmt = {
        bind(...values: (string | number | null | undefined)[]) {
          binds = values.map((v) => (v === undefined ? null : v));
          return stmt;
        },
        async first<T = Record<string, unknown>>() {
          const row = sqlite.prepare(sql).get(...binds);
          return (row || null) as T | null;
        },
        async all<T = Record<string, unknown>>() {
          const rows = sqlite.prepare(sql).all(...binds);
          return { results: rows as T[], success: true };
        },
        async run() {
          const before = Number((sqlite.prepare('SELECT total_changes() as c').get() as { c: number })?.c ?? 0);
          const res = sqlite.prepare(sql).run(...binds);
          const totalAfter = Number((sqlite.prepare('SELECT total_changes() as c').get() as { c: number })?.c ?? 0);
          const triggerChanges = totalAfter - before;
          const directChanges = Number(res.changes);
          return {
            success: true,
            changes: directChanges,
            meta: { changes: Math.max(directChanges, triggerChanges) },
          };
        },
      };
      return stmt;
    },
  };
  return { sqlite, db };
}

afterEach(() => {
  for (const db of databases.splice(0)) {
    try {
      db.close();
    } catch {
      // Ignored
    }
  }
});

describe('Staff device token masking and tenant scoping', () => {
  it('masks stored tokens and hides the raw token from responses', async () => {
    const f = staffSessionFixture();
    databases.push(f.sqlite as unknown as DatabaseSync);
    f.sqlite.exec("ALTER TABLE staff_devices ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'");
    f.sqlite.prepare(`INSERT INTO staff_devices (id, staff_id, device_token, device_name, role, tenant_id)
      VALUES ('dev-alpha', 'staff', 'SUPER_SECRET_PLAINTEXT_TOKEN_1234', 'Tablet POS', 'staff', 'cafe-a')`).run();
    const token = await f.token('staff', true);

    const res = await f.request('/api/auth/devices', token, 'GET', undefined, { 'x-tenant-id': 'cafe-a' });
    expect(res.status).toBe(200);
    const bodyText = await res.text();
    expect(bodyText).not.toContain('SUPER_SECRET_PLAINTEXT_TOKEN_1234');
    expect(bodyText).not.toContain('local-device-token');
    expect(bodyText).toContain('***1234');
  });
});

describe('Fail-closed D1 OTP persistence, atomic CAS, and lockout', () => {
  it('fails closed when D1 persistence cannot be established', async () => {
    const success = await persistOtpChallenge(undefined, 'otp:test', 'default', '0901234567', '123456', 300);
    expect(success).toBe(false);

    const brokenDb = {
      prepare() {
        throw new Error('D1 connection failed');
      },
    } as any;
    const brokenSuccess = await persistOtpChallenge(brokenDb, 'otp:test', 'default', '0901234567', '123456', 300);
    expect(brokenSuccess).toBe(false);
  });

  it('guarantees single-use consumption across simulated concurrent instances', async () => {
    const { db } = makeSqliteD1();
    const persisted = await persistOtpChallenge(
      db as any,
      'otp:0901234567',
      'cafe-a',
      '0901234567',
      '849201',
      300
    );
    expect(persisted).toBe(true);

    const [firstResult, secondResult] = await Promise.all([
      consumeOtpChallenge(db as any, 'otp:0901234567', '849201'),
      consumeOtpChallenge(db as any, 'otp:0901234567', '849201'),
    ]);

    const statuses = [firstResult, secondResult].sort();
    expect(statuses).toEqual(['already_consumed', 'consumed']);
  });

  it('locks out after five failed attempts', async () => {
    const { db } = makeSqliteD1();
    await persistOtpChallenge(db as any, 'otp:lockout', 'default', '0909999999', '111222', 300);

    for (let i = 1; i <= 5; i += 1) {
      const status = await consumeOtpChallenge(db as any, 'otp:lockout', '000000');
      expect(status).toBe('invalid_code');
    }

    const sixthStatus = await consumeOtpChallenge(db as any, 'otp:lockout', '000000');
    expect(sixthStatus).toBe('locked');

    const validCodeAfterLockout = await consumeOtpChallenge(db as any, 'otp:lockout', '111222');
    expect(validCodeAfterLockout).toBe('locked');
  });

  it('returns unavailable on D1 disruption rather than failing open', async () => {
    const brokenDb = {
      prepare() {
        return {
          bind() {
            return {
              async run() {
                throw new Error('D1 query timeout');
              },
            };
          },
        };
      },
    } as any;

    const status = await consumeOtpChallenge(brokenDb, 'otp:any', '123456');
    expect(status).toBe('unavailable');
  });
});

describe('Logout revokes sessions and bumps auth_version in D1', () => {
  it('updates session row and increments users auth_version on logout', async () => {
    const { sqlite, db } = makeSqliteD1();
    sqlite.prepare(`INSERT INTO users (id, name, email, role, tenant_id, auth_version, is_active)
      VALUES ('user-logout', 'Logout Tester', 'logout@aura.vn', 'staff', 'cafe-a', 2, 1)`).run();
    sqlite.prepare(`INSERT INTO sessions (id, user_id, expires_at)
      VALUES ('sess-1', 'user-logout', '2030-01-01T00:00:00Z')`).run();

    const secret = 'test-jwt-secret-at-least-16-chars';
    const token = await generateJWT(
      { id: 'user-logout', role: 'staff', tenantId: 'cafe-a', authVersion: 2 },
      secret,
      3600
    );

    const kvStore = new Map<string, string>();
    const env = {
      AURA_DB: db,
      JWT_SECRET: secret,
      AUTH_KV: {
        put: async (key: string, val: string) => {
          kvStore.set(key, val);
        },
        get: async (key: string) => kvStore.get(key) ?? null,
      },
    };

    const req = new Request('https://test.aura/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await logoutUser(req, env as any);
    expect(res.status).toBe(200);

    const userRow = sqlite.prepare('SELECT auth_version FROM users WHERE id = ?').get('user-logout') as { auth_version: number };
    expect(userRow.auth_version).toBe(3);

    const sessRow = sqlite.prepare('SELECT revoked_at FROM sessions WHERE id = ?').get('sess-1') as { revoked_at: string | null };
    expect(sessRow.revoked_at).toBeTruthy();
  });

  it('increments customers auth_version in D1 on customer logout', async () => {
    const { sqlite, db } = makeSqliteD1();
    sqlite.prepare(`INSERT INTO customers (id, name, phone, tenant_id, auth_version)
      VALUES ('cust-logout', 'Customer Log', '0908887777', 'cafe-a', 1)`).run();

    const secret = 'test-jwt-secret-at-least-16-chars';
    const token = await generateJWT(
      { id: 'cust-logout', role: 'customer', tenantId: 'cafe-a', authVersion: 1 },
      secret,
      3600
    );

    const env = {
      AURA_DB: db,
      JWT_SECRET: secret,
      AUTH_KV: {
        put: async () => {},
        get: async () => null,
      },
    };

    const req = new Request('https://test.aura/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await logoutUser(req, env as any);
    expect(res.status).toBe(200);

    const custRow = sqlite.prepare('SELECT auth_version FROM customers WHERE id = ?').get('cust-logout') as { auth_version: number };
    expect(custRow.auth_version).toBe(2);
  });
});

describe('Guest order capability tokens and claim policy', () => {
  it('hashes order capability tokens with SHA-256 and verifies constant-time', async () => {
    const token = 'guest-token-high-entropy-random-string-1234';
    const hash = await hashOrderToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    const matches = await verifyGuestOrderToken(hash, token);
    expect(matches).toBe(true);

    const wrong = await verifyGuestOrderToken(hash, 'wrong-token');
    expect(wrong).toBe(false);
  });

  it('restricts access to guest orders when token hash is set unless verified', async () => {
    const token = 'capability-token-abc';
    const hash = await hashOrderToken(token);

    const orderWithToken = { id: 'ord-guest-secure', customer_id: null, guest_token_hash: hash };

    const denied = canAccessOrder(null, orderWithToken);
    expect(denied.allowed).toBe(false);

    const verifiedAccess = canAccessOrder(null, orderWithToken, { orderTokenVerified: true });
    expect(verifiedAccess.allowed).toBe(true);

    const staffAccess = canAccessOrder({ role: 'manager' }, orderWithToken);
    expect(staffAccess.allowed).toBe(true);
  });

  it('rejects guest order claim by an unverified customer profile without token', async () => {
    const { sqlite, db } = makeSqliteD1();
    sqlite.prepare(`INSERT INTO customers (id, name, phone, tenant_id, auth_version, verified_at)
      VALUES ('cust-unverified', 'Attacker', '0901234567', 'cafe-a', 1, NULL)`).run();
    sqlite.prepare(`INSERT INTO orders (id, items, customer_name, customer_phone, total, status, payment_method, tenant_id)
      VALUES ('ord-target', '[]', 'Guest', '0901234567', 50000, 'pending', 'cod', 'cafe-a')`).run();

    const claimResult = await claimGuestOrder({
      db: db as any,
      orderId: 'ord-target',
      actor: { id: 'cust-unverified', role: 'customer' },
      tenantId: 'cafe-a',
      requireVerification: true,
      requireVerifiedPhone: true,
    });

    expect(claimResult.success).toBe(false);
    expect(claimResult.statusCode).toBe(403);
  });

  it('permits guest order claim when customer profile has verified phone', async () => {
    const { sqlite, db } = makeSqliteD1();
    sqlite.prepare(`INSERT INTO customers (id, name, phone, tenant_id, auth_version, verified_at)
      VALUES ('cust-legit', 'Verified Customer', '0901234567', 'cafe-a', 1, '2026-11-01T10:00:00Z')`).run();
    sqlite.prepare(`INSERT INTO orders (id, items, customer_name, customer_phone, total, status, payment_method, tenant_id)
      VALUES ('ord-target-2', '[]', 'Guest', '0901234567', 50000, 'pending', 'cod', 'cafe-a')`).run();

    const claimResult = await claimGuestOrder({
      db: db as any,
      orderId: 'ord-target-2',
      actor: { id: 'cust-legit', role: 'customer' },
      tenantId: 'cafe-a',
      requireVerification: true,
      requireVerifiedPhone: true,
    });

    expect(claimResult.success).toBe(true);
    expect(claimResult.customerId).toBe('cust-legit');
  });

  it('permits guest order claim when possessing the valid order token', async () => {
    const { sqlite, db } = makeSqliteD1();
    const rawToken = 'secret-order-token-xyz';
    const hash = await hashOrderToken(rawToken);
    sqlite.prepare(`INSERT INTO customers (id, name, phone, tenant_id, auth_version, verified_at)
      VALUES ('cust-unverified-with-token', 'Token Holder', '0999999999', 'cafe-a', 1, NULL)`).run();
    sqlite.prepare(`INSERT INTO orders (id, items, customer_name, customer_phone, guest_token_hash, total, status, payment_method, tenant_id)
      VALUES ('ord-target-3', '[]', 'Guest', '0901234567', ?, 50000, 'pending', 'cod', 'cafe-a')`).run(hash);

    const claimResult = await claimGuestOrder({
      db: db as any,
      orderId: 'ord-target-3',
      actor: { id: 'cust-unverified-with-token', role: 'customer' },
      tenantId: 'cafe-a',
      orderToken: rawToken,
      requireVerification: true,
      requireVerifiedPhone: true,
    });

    expect(claimResult.success).toBe(true);
    expect(claimResult.customerId).toBe('cust-unverified-with-token');
  });
});
