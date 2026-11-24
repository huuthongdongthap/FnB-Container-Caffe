// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { OpenAPIHono } from '@hono/zod-openapi';
import { loginUser } from '../../tree/auth/login';
import { logoutUser } from '../../tree/auth/logout';
import { registerUser } from '../../tree/auth/register';
import { bootstrapOwner } from '../../tree/auth/bootstrap';
import { hashPassword, verifyJWT } from '../../lib/jwt';
import { findLoginUser, loadStaffAccountForLogin } from '../../lib/staff-login-identity';
import { SessionUnavailableError } from '../../lib/staff-session';
import { authEndpointsRouter } from '../../routes/auth-endpoints';
import { registerWithVerification } from '../../routes/auth-register';
import { verifyEmail } from '../../routes/auth-verify';
import { registerAuthHandlers } from '../../routes/openapi-auth-handlers/auth-handlers';
import { registerStaffHandlers } from '../../routes/openapi-staff-handlers/staff-handlers';
import { registerTierHandlers } from '../../routes/openapi-loyalty-handlers/tier-handlers';
import { createOrder } from '../../../../packages/domain/order/commands/create-order';

function createMemoryKv(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, val: string) => {
      store.set(key, val);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async ({ prefix = '' }: { prefix?: string } = {}) => ({
      keys: [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name })),
      list_complete: true,
    })),
  };
}

describe('P0 Regression: Auth & RBAC (#194)', () => {
  it('syncs bumped auth_version on re-login after customer logout and normalizes email case', async () => {
    const jwtSecret = 'test-secret-key-for-jwt-signing-12345';
    const passwordHash = await hashPassword('Secret123!');
    const kv = createMemoryKv({
      'user:alice@example.com': JSON.stringify({
        id: 'cust_alice',
        email: 'alice@example.com',
        name: 'Alice',
        phone: '0901234567',
        role: 'customer',
        password: passwordHash,
        auth_version: 1,
        tenant_id: 'default',
      }),
    });

    let customerAuthVersion = 1;
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes('SELECT auth_version FROM customers')) {
              return { auth_version: customerAuthVersion };
            }
            if (sql.includes('SELECT id, email, tenant_id FROM customers')) {
              return { id: 'cust_alice', email: 'alice@example.com', tenant_id: 'default' };
            }
            return null;
          },
          run: async () => {
            if (sql.includes('UPDATE customers SET auth_version')) {
              customerAuthVersion += 1;
            }
            return { success: true, meta: { changes: 1 } };
          },
          all: async () => ({ results: [] }),
        }),
      })),
    };

    const env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET: jwtSecret, JWT_EXPIRY_SECONDS: '3600' };

    // 1. Initial login with uppercase email
    const loginRes1 = await loginUser(
      new Request('https://api.test/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'Alice@Example.COM', password: 'Secret123!' }),
      }),
      env
    );
    expect(loginRes1.status).toBe(200);
    const loginData1 = (await loginRes1.json()) as { token: string };
    const payload1 = await verifyJWT(loginData1.token, jwtSecret);
    expect(payload1?.authVersion).toBe(1);

    // 2. Logout bumps D1 customers.auth_version and KV cust_auth_ver:cust_alice
    const logoutRes = await logoutUser(
      new Request('https://api.test/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${loginData1.token}` },
      }),
      env
    );
    expect(logoutRes.status).toBe(200);
    expect(customerAuthVersion).toBe(2);
    expect(kv.store.get('cust_auth_ver:cust_alice')).toBe('2');

    // 3. Re-login must mint JWT with authVersion === 2 (not stale 1)
    const loginRes2 = await loginUser(
      new Request('https://api.test/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '  ALICE@EXAMPLE.COM ', password: 'Secret123!' }),
      }),
      env
    );
    expect(loginRes2.status).toBe(200);
    const loginData2 = (await loginRes2.json()) as { token: string };
    const payload2 = await verifyJWT(loginData2.token, jwtSecret);
    expect(payload2?.authVersion).toBe(2);
  });

  it('blocks admin from creating an owner account and preserves email on staff list & create', async () => {
    const app = new OpenAPIHono();
    let currentRole = 'admin';

    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'actor_1', role: currentRole, tenantId: 'default' } as never);
      c.set('tenantId' as never, 'default' as never);
      await next();
    });

    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (sql.includes('COUNT(*)')) return { total: 1 };
            return null;
          },
          all: async () => {
            if (sql.includes('FROM staff_login_identities')) {
              return { results: [{ staff_id: 'staff_1', email: 'barista@store.test' }] };
            }
            if (sql.includes('FROM users')) {
              return {
                results: [
                  {
                    id: 'staff_1',
                    name: 'Barista A',
                    email: null,
                    phone: '0901111222',
                    role: 'barista',
                    is_active: 1,
                    created_at: '2026-01-01T00:00:00Z',
                    updated_at: '2026-01-01T00:00:00Z',
                  },
                ],
              };
            }
            return { results: [] };
          },
          run: async () => ({ success: true, meta: { changes: 1 } }),
        }),
      })),
    };

    registerStaffHandlers(app as never);

    // Admin attempting to create owner -> 403
    const resEscalation = await app.fetch(
      new Request('https://api.test/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Rogue Owner',
          email: 'rogue@store.test',
          password: 'Password123!',
          role: 'owner',
        }),
      }),
      { AURA_DB: db } as never
    );
    expect(resEscalation.status).toBe(403);

    // GET /api/staff returns email from staff_login_identities join
    currentRole = 'owner';
    const resList = await app.fetch(
      new Request('https://api.test/api/staff', { method: 'GET' }),
      { AURA_DB: db } as never
    );
    expect(resList.status).toBe(200);
    const listBody = (await resList.json()) as {
      data?: { staff?: Array<{ email: string | null }> } | Array<{ email: string | null }>;
      staff?: Array<{ email: string | null }>;
    };
    const staffRows = Array.isArray(listBody.data)
      ? listBody.data
      : listBody.data?.staff ?? listBody.staff ?? [];
    expect(staffRows[0]?.email).toBe('barista@store.test');
  });

  it('does not shadow /forgot-password or /reset-password on authEndpointsRouter', () => {
    const routes = authEndpointsRouter.routes.map((r) => `${r.method} ${r.path}`);
    expect(routes).not.toContain('POST /forgot-password');
    expect(routes).not.toContain('POST /reset-password');
    expect(routes).toContain('POST /operator-reset-password');
  });
});

describe('P0 Regression: Promotions & Pricing (#195)', () => {
  function buildOrderEnv(promoRow: Record<string, unknown>, priorCustomerRedemptions = 0) {
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (sql.includes('FROM promotions')) return promoRow;
            if (sql.includes('FROM promotion_redemptions')) return { cnt: priorCustomerRedemptions };
            if (sql.includes('FROM menu_items')) return { id: 'item_1', name: 'Latte', price: 50000, available: 1, stock: 100 };
            return null;
          },
          all: async () => {
            if (sql.includes('FROM menu_items')) {
              return { results: [{ id: 'item_1', name: 'Latte', price: 50000, available: 1, stock: 100 }] };
            }
            return { results: [] };
          },
          run: async () => ({ success: true, meta: { changes: 1 } }),
        }),
      })),
      batch: vi.fn(async () => [{ success: true }]),
    };
    return { AURA_DB: db };
  }

  it('treats fixed_amount promotion as fixed VND discount instead of percentage', async () => {
    const env = buildOrderEnv({
      id: 'promo_fixed',
      code: 'SAVE15K',
      discount_type: 'fixed_amount',
      discount_value: 15000,
      is_active: 1,
      usage_limit: 100,
      usage_count: 0,
    });

    const res = await createOrder(
      new Request('https://api.test/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: 'item_1', menu_item_id: 'item_1', name: 'Latte', price: 50000, quantity: 2 }],
          total: 100000,
          promo_code: 'SAVE15K',
          payment_method: 'cod',
          order_type: 'takeaway',
          customer_name: 'Bob',
          customer_phone: '0901234567',
        }),
      }),
      env as never
    );

    const body = (await res.json()) as {
      error?: string;
      data?: { discount?: number; total?: number };
      order?: { discount?: number; total?: number };
    };
    expect(res.status, body.error).toBe(201);
    const order = body.data ?? body.order;
    expect(order?.discount).toBe(15000);
    expect(order?.total).toBe(85000);
  });

  it('rejects unknown promotion discount_type fail-closed with 400', async () => {
    const env = buildOrderEnv({
      id: 'promo_bad',
      code: 'BADTYPE',
      discount_type: 'bogus_type',
      discount_value: 10,
      is_active: 1,
    });

    const res = await createOrder(
      new Request('https://api.test/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: 'item_1', name: 'Latte', price: 50000, quantity: 1 }],
          promo_code: 'BADTYPE',
          payment_method: 'cod',
          customer_name: 'Bob',
          customer_phone: '0901234567',
        }),
      }),
      env as never
    );
    expect(res.status).toBe(400);
  });

  it('enforces usage_limit_per_customer against promotion_redemptions', async () => {
    const env = buildOrderEnv(
      {
        id: 'promo_once',
        code: 'ONCEONLY',
        discount_type: 'fixed_amount',
        discount_value: 10000,
        usage_limit_per_customer: 1,
        is_active: 1,
      },
      1 // customer already redeemed once
    );

    const res = await createOrder(
      new Request('https://api.test/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: 'item_1', name: 'Latte', price: 50000, quantity: 1 }],
          promo_code: 'ONCEONLY',
          payment_method: 'cod',
          customer_name: 'Bob',
          customer_phone: '0901234567',
        }),
      }),
      env as never
    );
    expect(res.status).toBe(400);
  });

  it('falls back past default-0 columns for percentage and fixed_amount promos', async () => {
    const pctEnv = buildOrderEnv({
      id: 'promo_pct_fallback',
      code: 'PCT20',
      discount_type: 'percentage',
      percent: 0,
      discount_value: 20,
      is_active: 1,
    });
    const pctRes = await createOrder(
      new Request('https://api.test/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: 'item_1', menu_item_id: 'item_1', name: 'Latte', price: 50000, quantity: 2 }],
          total: 100000,
          promo_code: 'PCT20',
          payment_method: 'cod',
          order_type: 'takeaway',
          customer_name: 'Bob',
          customer_phone: '0901234567',
        }),
      }),
      pctEnv as never
    );
    expect(pctRes.status).toBe(201);
    const pctBody = (await pctRes.json()) as { data?: { discount?: number; total?: number }; order?: { discount?: number; total?: number } };
    expect((pctBody.data ?? pctBody.order)?.discount).toBe(20000);

    const fixedEnv = buildOrderEnv({
      id: 'promo_fixed_fallback',
      code: 'FIX15K',
      discount_type: 'fixed_amount',
      discount_value: 0,
      value: 15000,
      is_active: 1,
    });
    const fixedRes = await createOrder(
      new Request('https://api.test/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: 'item_1', menu_item_id: 'item_1', name: 'Latte', price: 50000, quantity: 2 }],
          total: 100000,
          promo_code: 'FIX15K',
          payment_method: 'cod',
          order_type: 'takeaway',
          customer_name: 'Bob',
          customer_phone: '0901234567',
        }),
      }),
      fixedEnv as never
    );
    expect(fixedRes.status).toBe(201);
    const fixedBody = (await fixedRes.json()) as { data?: { discount?: number; total?: number }; order?: { discount?: number; total?: number } };
    expect((fixedBody.data ?? fixedBody.order)?.discount).toBe(15000);
  });

  it('rolls back concurrent race when post-commit per-customer redemption count exceeds limit', async () => {
    let redemptionReads = 0;
    const deletedSqls: string[] = [];
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (sql.includes('FROM promotions')) {
              return {
                id: 'promo_race',
                code: 'RACE1',
                discount_type: 'fixed_amount',
                discount_value: 10000,
                usage_limit_per_customer: 1,
                is_active: 1,
              };
            }
            if (sql.includes('FROM promotion_redemptions')) {
              redemptionReads += 1;
              // Pre-check sees 0 (concurrent race), post-commit check sees 2 (> 1)
              return { cnt: redemptionReads === 1 ? 0 : 2 };
            }
            if (sql.includes('FROM menu_items')) return { id: 'item_1', name: 'Latte', price: 50000, available: 1, stock: 100 };
            return null;
          },
          all: async () => ({ results: [{ id: 'item_1', name: 'Latte', price: 50000, available: 1, stock: 100 }] }),
          run: async () => {
            if (sql.startsWith('DELETE FROM')) deletedSqls.push(sql);
            return { success: true, meta: { changes: 1 } };
          },
        }),
      })),
      batch: vi.fn(async () => [{ success: true }]),
    };

    const res = await createOrder(
      new Request('https://api.test/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: 'item_1', menu_item_id: 'item_1', name: 'Latte', price: 50000, quantity: 1 }],
          total: 50000,
          promo_code: 'RACE1',
          payment_method: 'cod',
          order_type: 'takeaway',
          customer_name: 'Bob',
          customer_phone: '0901234567',
        }),
      }),
      { AURA_DB: db } as never
    );

    expect(res.status).toBe(400);
    expect(deletedSqls.some((s) => s.includes('promotion_redemptions'))).toBe(true);
    expect(deletedSqls.some((s) => s.includes('orders'))).toBe(true);
  });
});

describe('P0 Regression: Multi-Tenant CRM & Loyalty (#197)', () => {
  it('returns 500 and skips audit log when non-default tenant loyalty tier insert fails', async () => {
    const app = new OpenAPIHono();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'owner_t2', role: 'owner', tenantId: 'tenant_2' } as never);
      c.set('tenantId' as never, 'tenant_2' as never);
      await next();
    });

    let auditWritten = false;
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (sql.includes('FROM loyalty_tier_configs')) {
              if (!_args.includes('tenant_2')) {
                return { tier: 'gold', name: 'Gold', min_points: 1000, tenant_id: 'default' };
              }
              return null;
            }
            return null;
          },
          run: async () => {
            if (sql.includes('INSERT INTO loyalty_tier_configs')) {
              throw new Error('UNIQUE constraint failed: loyalty_tier_configs.tier');
            }
            if (sql.includes('audit_logs')) {
              auditWritten = true;
            }
            return { success: true, meta: { changes: 1 } };
          },
        }),
      })),
    };

    registerTierHandlers(app as never);

    const res = await app.fetch(
      new Request('https://api.test/api/loyalty/tiers/gold', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Gold T2', min_points: 1500 }),
      }),
      { AURA_DB: db } as never
    );

    expect(res.status).toBe(500);
    expect(auditWritten).toBe(false);
  });

  it('defines tenant-scoped composite keys in worker/schema.sql and tenant migration', () => {
    const schemaPath = resolve(__dirname, '../../../schema.sql');
    const migrationPath = resolve(__dirname, '../../../db/migrations/20261124_02_tenant_scoped_unique_keys.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    const migration = readFileSync(migrationPath, 'utf-8');

    expect(schema).toContain('UNIQUE(tenant_id, email)');
    expect(schema).toContain('UNIQUE(tenant_id, phone)');
    expect(schema).toContain('PRIMARY KEY (tenant_id, code)');
    expect(schema).toContain('PRIMARY KEY (tenant_id, tier)');

    expect(migration).toContain('PRIMARY KEY (tenant_id, tier)');
    expect(migration).toContain('PRIMARY KEY (tenant_id, code)');
    expect(migration).toContain('UNIQUE(tenant_id, phone)');
    expect(migration).toContain('UNIQUE(tenant_id, email)');
  });

  it('applies worker/schema.sql + tenant migration in real SQLite preserving columns, FKs, duplicate cleanup, indexes, triggers, and tenant isolation', () => {
    const schemaSql = readFileSync(resolve(__dirname, '../../../schema.sql'), 'utf-8');
    const migrationSql = readFileSync(
      resolve(__dirname, '../../../db/migrations/20261124_02_tenant_scoped_unique_keys.sql'),
      'utf-8'
    );
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    // Simulate pre-migration schema before composite UNIQUE(tenant_id, email) / UNIQUE(tenant_id, phone)
    const preMigrationSchemaSql = schemaSql
      .replace('UNIQUE(tenant_id, email),\n    UNIQUE(tenant_id, phone)', 'id_ check_noop TEXT')
      .replace(',\n    id_ check_noop TEXT', '');
    sqlite.exec(preMigrationSchemaSql);

    // Simulate pre-migration legacy duplicates and FK children before rebuild
    sqlite
      .prepare("INSERT INTO customers (id, tenant_id, email, phone, name, auth_version) VALUES (?, ?, ?, ?, ?, ?)")
      .run('c1', 'tenant-a', 'shared@example.com', '0909000111', 'Alice A', 3);
    sqlite
      .prepare("INSERT INTO customers (id, tenant_id, email, phone, name, auth_version) VALUES (?, ?, ?, ?, ?, ?)")
      .run('c1_blank1', 'tenant-a', '', '', 'Blank 1', 1);
    sqlite
      .prepare("INSERT INTO customers (id, tenant_id, email, phone, name, auth_version) VALUES (?, ?, ?, ?, ?, ?)")
      .run('c1_blank2', 'tenant-a', '   ', '', 'Blank 2', 1);
    sqlite
      .prepare("INSERT INTO cashback_wallets (id, customer_id, tenant_id, balance) VALUES (?, ?, ?, ?)")
      .run('wal_fk_1', 'c1', 'tenant-a', 5000);
    sqlite
      .prepare("INSERT INTO promotions (id, code, percent, tenant_id, discount_type, discount_value) VALUES (?, ?, ?, ?, ?, ?)")
      .run('p1', 'WELCOME10', 10, 'tenant-a', 'percentage', 10);
    sqlite
      .prepare("INSERT INTO loyalty_tier_configs (tenant_id, tier, name, min_points) VALUES (?, ?, ?, ?)")
      .run('tenant-a', 'gold', 'Gold A', 1000);
    sqlite
      .prepare("INSERT INTO tier_configs (tenant_id, tier, tier_name, min_points) VALUES (?, ?, ?, ?)")
      .run('tenant-a', 'gold', 'Gold A', 1000);

    // Apply migration
    sqlite.exec(migrationSql);

    // Verify blank customer identifiers normalized to NULL and FK child preserved
    const blanks = sqlite
      .prepare("SELECT id, email, phone FROM customers WHERE id IN ('c1_blank1', 'c1_blank2') ORDER BY id")
      .all() as Array<{ id: string; email: string | null; phone: string | null }>;
    expect(blanks).toEqual([
      { id: 'c1_blank1', email: null, phone: null },
      { id: 'c1_blank2', email: null, phone: null },
    ]);
    const fkWallet = sqlite.prepare('SELECT customer_id, balance FROM cashback_wallets WHERE id = ?').get('wal_fk_1') as { customer_id: string; balance: number };
    expect(fkWallet).toEqual({ customer_id: 'c1', balance: 5000 });

    // Verify cross-tenant inserts with same phone/email, promo code, and tier now succeed
    sqlite
      .prepare("INSERT INTO customers (id, tenant_id, email, phone, name, auth_version) VALUES (?, ?, ?, ?, ?, ?)")
      .run('c2', 'tenant-b', 'shared@example.com', '0909000111', 'Alice B', 1);
    sqlite
      .prepare("INSERT INTO promotions (id, code, percent, tenant_id, discount_type, discount_value) VALUES (?, ?, ?, ?, ?, ?)")
      .run('p2', 'WELCOME10', 15, 'tenant-b', 'fixed_amount', 15000);
    sqlite
      .prepare("INSERT INTO loyalty_tier_configs (tenant_id, tier, name, min_points) VALUES (?, ?, ?, ?)")
      .run('tenant-b', 'gold', 'Gold B', 2000);
    sqlite
      .prepare("INSERT INTO tier_configs (tenant_id, tier, tier_name, min_points) VALUES (?, ?, ?, ?)")
      .run('tenant-b', 'gold', 'Gold B', 2000);

    // Verify existing data & post-ALTER columns preserved
    const c1 = sqlite.prepare('SELECT auth_version, name FROM customers WHERE id = ?').get('c1') as { auth_version: number; name: string };
    expect(c1).toEqual({ auth_version: 3, name: 'Alice A' });

    // Verify indexes and trigger preserved
    const indexes = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>).map((r) => r.name);
    expect(indexes).toContain('idx_customers_tenant');
    expect(indexes).toContain('idx_promo_tenant');
    expect(indexes).toContain('idx_loyalty_tier_configs_tenant_id');
    const triggers = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all() as Array<{ name: string }>).map((r) => r.name);
    expect(triggers).toContain('update_customers_timestamp');

    sqlite.close();
  });

  it('fails closed on D1 error with X-Tenant-ID and permits HQ super-admin login across tenants', async () => {
    const kv = createMemoryKv();
    const brokenDb = {
      prepare: vi.fn(() => ({
        bind: () => ({
          first: async () => {
            throw new Error('D1 outage');
          },
        }),
      })),
    };

    await expect(
      findLoginUser({ AURA_DB: brokenDb, AUTH_KV: kv } as never, 'staff@aura.vn', 'store-a')
    ).rejects.toBeInstanceOf(SessionUnavailableError);
    await expect(
      loadStaffAccountForLogin(brokenDb as never, 'staff@aura.vn', 'store-a')
    ).rejects.toBeInstanceOf(SessionUnavailableError);

    const hqDb = {
      prepare: vi.fn(() => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            expect(args[0]).toBe('hq-owner@aura.vn');
            expect(args[1]).toBe('store-a');
            return { staff_id: 'hq_owner_1', tenant_id: 'hq', role: 'owner' };
          },
        }),
      })),
    };
    const found = await findLoginUser({ AURA_DB: hqDb, AUTH_KV: kv } as never, 'HQ-Owner@aura.vn', 'store-a');
    expect(found).toMatchObject({ id: 'hq_owner_1', email: 'hq-owner@aura.vn', tenant_id: 'hq' });
  });

  it('allows HQ admin to create, update, and soft-delete store owners while blocking store-bound admins and normalizing emails', async () => {
    const schemaSql = readFileSync(resolve(__dirname, '../../../schema.sql'), 'utf-8');
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(schemaSql);
    sqlite.exec("INSERT INTO saas_tenants (id, slug, name, tier, status) VALUES ('store-a', 'store-a', 'Store A', 'PRO', 'active')");

    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => sqlite.prepare(sql).get(...(args as never[])) ?? null,
          all: async () => ({ results: sqlite.prepare(sql).all(...(args as never[])) }),
          run: async () => {
            const info = sqlite.prepare(sql).run(...(args as never[]));
            return { success: true, meta: { changes: Number(info.changes ?? 0) } };
          },
        }),
      }),
      batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
        const out: unknown[] = [];
        for (const s of stmts) out.push(await s.run());
        return out;
      },
    };

    const kv = createMemoryKv();
    let actor = { id: 'store_admin_1', role: 'admin', tenantId: 'store-a' };
    const app = new OpenAPIHono();
    app.use('*', async (c, next) => {
      c.set('user' as never, actor as never);
      c.set('tenantId' as never, actor.tenantId as never);
      await next();
    });
    registerStaffHandlers(app as never);

    // Store-bound admin cannot create owner
    const deniedCreate = await app.fetch(
      new Request('https://api.test/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          name: 'Store Owner',
          email: 'Owner.Mixed@StoreA.vn',
          password: 'Password123!',
          role: 'owner',
        }),
      }),
      { AURA_DB: db, AUTH_KV: kv } as never
    );
    expect(deniedCreate.status).toBe(403);

    // HQ super-admin (admin bound to hq) creates store owner with mixed-case email
    actor = { id: 'hq_admin_1', role: 'admin', tenantId: 'hq' };
    const hqCreate = await app.fetch(
      new Request('https://api.test/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          name: 'Store Owner',
          email: 'Owner.Mixed@StoreA.vn',
          password: 'Password123!',
          role: 'owner',
        }),
      }),
      { AURA_DB: db, AUTH_KV: kv } as never
    );
    expect(hqCreate.status).toBe(201);
    const createdBody = (await hqCreate.json()) as { data: { id: string; email: string } };
    expect(createdBody.data.email).toBe('owner.mixed@storea.vn');
    expect(kv.store.has('user:owner.mixed@storea.vn')).toBe(true);

    // Case-insensitive duplicate blocked
    const dupRes = await app.fetch(
      new Request('https://api.test/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          name: 'Dup Staff',
          email: 'owner.mixed@storea.vn',
          password: 'Password123!',
          role: 'staff',
        }),
      }),
      { AURA_DB: db, AUTH_KV: kv } as never
    );
    expect(dupRes.status).toBe(409);

    // HQ admin can PATCH and DELETE store owner while store-bound admin cannot
    actor = { id: 'store_admin_1', role: 'admin', tenantId: 'store-a' };
    const deniedPatch = await app.fetch(
      new Request(`https://api.test/api/staff/${createdBody.data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({ email: 'NewOwner@StoreA.vn' }),
      }),
      { AURA_DB: db, AUTH_KV: kv } as never
    );
    expect(deniedPatch.status).toBe(403);

    actor = { id: 'hq_admin_1', role: 'admin', tenantId: 'hq' };
    const hqPatch = await app.fetch(
      new Request(`https://api.test/api/staff/${createdBody.data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({ email: 'NewOwner@StoreA.vn' }),
      }),
      { AURA_DB: db, AUTH_KV: kv } as never
    );
    expect(hqPatch.status).toBe(200);
    expect(kv.store.has('user:owner.mixed@storea.vn')).toBe(false);
    expect(kv.store.has('user:newowner@storea.vn')).toBe(true);

    // Add a second active owner so last-owner protection allows deactivating the first
    sqlite.prepare("INSERT INTO users (id, name, role, tenant_id, is_active, password_hash) VALUES ('owner_backup', 'Backup', 'owner', 'store-a', 1, 'hash')").run();
    const hqDelete = await app.fetch(
      new Request(`https://api.test/api/staff/${createdBody.data.id}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-ID': 'store-a' },
      }),
      { AURA_DB: db, AUTH_KV: kv } as never
    );
    expect(hqDelete.status).toBe(200);
    sqlite.close();
  });

  it('normalizes blank customer phone to NULL on registration and verification without colliding under UNIQUE(tenant_id, phone)', async () => {
    const schemaSql = readFileSync(resolve(__dirname, '../../../schema.sql'), 'utf-8');
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(schemaSql);

    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => sqlite.prepare(sql).get(...(args as never[])) ?? null,
          all: async () => ({ results: sqlite.prepare(sql).all(...(args as never[])) }),
          run: async () => {
            const info = sqlite.prepare(sql).run(...(args as never[]));
            return { success: true, meta: { changes: Number(info.changes ?? 0) } };
          },
        }),
      }),
    };

    const kv = createMemoryKv();
    const app = new OpenAPIHono();
    registerAuthHandlers(app as never);

    for (const email of ['blank1@example.com', 'blank2@example.com']) {
      const regRes = await app.fetch(
        new Request('https://api.test/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
          body: JSON.stringify({ name: 'Guest', email, password: 'Password123!', phone: '' }),
        }),
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET: 'test-secret-1234567890' } as never
      );
      expect(regRes.status).toBe(201);
    }

    // Legacy registerUser and registerWithVerification + verifyEmail also store NULL for omitted phone
    const legacyRes = await registerUser(
      new Request('https://api.test/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({ name: 'Legacy', email: 'blank3@example.com', password: 'Password123!' }),
      }),
      { AURA_DB: db, AUTH_KV: kv, JWT_SECRET: 'test-secret-1234567890', JWT_EXPIRY_SECONDS: '3600' }
    );
    expect(legacyRes.status).toBe(201);

    const verifyRegRes = await registerWithVerification(
      new Request('https://api.test/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({ name: 'Verify', email: 'blank4@example.com', password: 'Password123!' }),
      }),
      { AURA_DB: db, AUTH_KV: kv }
    );
    expect(verifyRegRes.status).toBe(201);

    const codeRow = sqlite.prepare("SELECT code FROM email_verifications WHERE email = 'blank4@example.com'").get() as { code: string };
    const verifyRes = await verifyEmail(
      new Request('https://api.test/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'blank4@example.com', code: codeRow.code }),
      }),
      { AURA_DB: db, AUTH_KV: kv, JWT_SECRET: 'test-secret-1234567890', JWT_EXPIRY_SECONDS: '3600' }
    );
    expect(verifyRes.status).toBe(200);

    const phones = sqlite
      .prepare("SELECT email, phone FROM customers WHERE tenant_id = 'store-a' ORDER BY email")
      .all() as Array<{ email: string; phone: string | null }>;
    expect(phones.length).toBe(4);
    expect(phones.every((row) => row.phone === null)).toBe(true);
    sqlite.close();
  });

  it('rejects fixed_amount promo without valid value/discount_value, enforces normalized phone limits, and preserves winner in concurrent race', async () => {
    const schemaSql = readFileSync(resolve(__dirname, '../../../schema.sql'), 'utf-8');
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(schemaSql);
    sqlite.prepare("INSERT INTO categories (id, name, slug, tenant_id) VALUES ('cat_coffee', 'Coffee', 'coffee', 'default')").run();
    sqlite.prepare("INSERT INTO products (id, category_id, name, price, available, is_available, tenant_id) VALUES ('item_1', 'cat_coffee', 'Latte', 50000, 1, 1, 'default')").run();
    sqlite.prepare("INSERT INTO menu_items (id, category, name, price, available, tenant_id) VALUES ('item_1', 'coffee', 'Latte', 50000, 1, 'default')").run();
    sqlite.prepare("INSERT INTO promotions (id, code, percent, discount_type, discount_value, value, is_active, usage_limit_per_customer, tenant_id) VALUES ('p_bad_fixed', 'BADFIXED', 25, 'fixed_amount', 0, 0, 1, NULL, 'default')").run();
    sqlite.prepare("INSERT INTO promotions (id, code, percent, discount_type, discount_value, value, is_active, usage_limit_per_customer, tenant_id) VALUES ('p_once_norm', 'ONCENORM', 0, 'fixed_amount', 10000, 10000, 1, 1, 'default')").run();
    sqlite.prepare("INSERT INTO promotions (id, code, percent, discount_type, discount_value, value, is_active, usage_limit_per_customer, tenant_id) VALUES ('p_race', 'RACEONCE', 0, 'fixed_amount', 10000, 10000, 1, 1, 'default')").run();

    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => sqlite.prepare(sql).get(...(args as never[])) ?? null,
          all: async () => ({ results: sqlite.prepare(sql).all(...(args as never[])) }),
          run: async () => {
            const info = sqlite.prepare(sql).run(...(args as never[]));
            return { success: true, meta: { changes: Number(info.changes ?? 0) } };
          },
        }),
      }),
      batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
        const out: unknown[] = [];
        for (const s of stmts) out.push(await s.run());
        return out;
      },
    };

    // 1. fixed_amount with discount_value=0 and value=0 must NOT use percent=25
    const badFixedRes = await createOrder(
      new Request('https://api.test/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: 'item_1', name: 'Latte', price: 50000, quantity: 1 }],
          total: 50000,
          promo_code: 'BADFIXED',
          payment_method: 'cod',
          customer_name: 'Bob',
          customer_phone: '0901234567',
        }),
      }),
      { AURA_DB: db } as never
    );
    expect(badFixedRes.status).toBe(400);
    const badFixedBody = (await badFixedRes.json()) as { error?: string };
    expect(badFixedBody.error).toContain('Giá trị giảm giá không hợp lệ');

    // 2. First redemption with +84901234567 succeeds; second with 0901234567 is blocked
    const firstRedeem = await createOrder(
      new Request('https://api.test/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: 'item_1', name: 'Latte', price: 50000, quantity: 1 }],
          total: 50000,
          promo_code: 'ONCENORM',
          payment_method: 'cod',
          customer_name: 'Bob',
          customer_phone: '+84901234567',
        }),
      }),
      { AURA_DB: db } as never
    );
    expect(firstRedeem.status).toBe(201);

    const secondRedeem = await createOrder(
      new Request('https://api.test/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: 'item_1', name: 'Latte', price: 50000, quantity: 1 }],
          total: 50000,
          promo_code: 'ONCENORM',
          payment_method: 'cod',
          customer_name: 'Bob',
          customer_phone: '0901234567',
        }),
      }),
      { AURA_DB: db } as never
    );
    expect(secondRedeem.status).toBe(400);
    const secondRedeemBody = (await secondRedeem.json()) as { error?: string };
    expect(secondRedeemBody.error).toContain('Bạn đã sử dụng hết lượt');
    const activeRedemptions = sqlite.prepare("SELECT COUNT(*) AS cnt FROM promotion_redemptions WHERE promotion_id = 'p_once_norm'").get() as { cnt: number };
    expect(activeRedemptions.cnt).toBe(1);

    // 3. Concurrent race preserves exactly 1 winner and rolls back the loser
    const raceResults = await Promise.all([
      createOrder(
        new Request('https://api.test/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ id: 'item_1', name: 'Latte', price: 50000, quantity: 1 }],
            total: 50000,
            promo_code: 'RACEONCE',
            payment_method: 'cod',
            customer_name: 'Race',
            customer_phone: '0908887777',
          }),
        }),
        { AURA_DB: db } as never
      ),
      createOrder(
        new Request('https://api.test/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ id: 'item_1', name: 'Latte', price: 50000, quantity: 1 }],
            total: 50000,
            promo_code: 'RACEONCE',
            payment_method: 'cod',
            customer_name: 'Race',
            customer_phone: '+84908887777',
          }),
        }),
        { AURA_DB: db } as never
      ),
    ]);
    const raceStatuses = raceResults.map((r) => r.status).sort((a, b) => a - b);
    expect(raceStatuses).toEqual([201, 400]);
    const raceRedemptions = sqlite.prepare("SELECT COUNT(*) AS cnt FROM promotion_redemptions WHERE promotion_id = 'p_race'").get() as { cnt: number };
    expect(raceRedemptions.cnt).toBe(1);
    sqlite.close();
  });

  it('inserts tenant-scoped loyalty_tier_configs and tier_configs cleanly against real schema', async () => {
    const schemaSql = readFileSync(resolve(__dirname, '../../../schema.sql'), 'utf-8');
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(schemaSql);
    sqlite.prepare("INSERT INTO loyalty_tier_configs (tenant_id, tier, name, min_points) VALUES ('default', 'gold', 'Gold', 1000)").run();

    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => sqlite.prepare(sql).get(...(args as never[])) ?? null,
          all: async () => ({ results: sqlite.prepare(sql).all(...(args as never[])) }),
          run: async () => {
            const info = sqlite.prepare(sql).run(...(args as never[]));
            return { success: true, meta: { changes: Number(info.changes ?? 0) } };
          },
        }),
      }),
    };

    const app = new OpenAPIHono();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'owner_t2', role: 'owner', tenantId: 'tenant_2' } as never);
      c.set('tenantId' as never, 'tenant_2' as never);
      await next();
    });
    registerTierHandlers(app as never);

    const patchRes = await app.fetch(
      new Request('https://api.test/api/loyalty/tiers/gold', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Gold T2', minPoints: 1500 }),
      }),
      { AURA_DB: db } as never
    );
    expect(patchRes.status).toBe(200);
    const row = sqlite.prepare("SELECT name, min_points FROM loyalty_tier_configs WHERE tenant_id = 'tenant_2' AND tier = 'gold'").get() as { name: string; min_points: number };
    expect(row).toEqual({ name: 'Gold T2', min_points: 1500 });

    // Exercise tier_configs canonical insert path as well
    sqlite.exec('DROP TABLE loyalty_tier_configs');
    sqlite.prepare("INSERT INTO tier_configs (tenant_id, tier, tier_name, min_points) VALUES ('default', 'silver', 'Silver', 500)").run();
    const patchCanonical = await app.fetch(
      new Request('https://api.test/api/loyalty/tiers/silver', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Silver T2', minPoints: 700 }),
      }),
      { AURA_DB: db } as never
    );
    expect(patchCanonical.status).toBe(200);
    const canonicalRow = sqlite.prepare("SELECT tier_name, min_points FROM tier_configs WHERE tenant_id = 'tenant_2' AND tier = 'silver'").get() as { tier_name: string; min_points: number };
    expect(canonicalRow).toEqual({ tier_name: 'Silver T2', min_points: 700 });
    sqlite.close();
  });

  it('partitions auth rate-limit buckets per endpoint, skips charging successful logins, and uses canonical reset-password hint', async () => {
    const kv = createMemoryKv();
    const passwordHash = await hashPassword('Secret123!');
    await kv.put(
      'user:owner@aura.vn',
      JSON.stringify({
        id: 'owner_1',
        email: 'owner@aura.vn',
        name: 'Owner',
        role: 'owner',
        tenant_id: 'default',
        password: passwordHash,
        auth_version: 1,
      })
    );

    const env = {
      AUTH_KV: kv,
      JWT_SECRET: 'test-secret-1234567890',
      JWT_EXPIRY_SECONDS: '3600',
    };

    // Bootstrap hint points to /api/auth/operator-reset-password
    const bootstrapRes = await bootstrapOwner(
      new Request('https://api.test/api/auth/bootstrap-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'newowner@aura.vn', password: 'Password123!' }),
      }),
      env
    );
    expect(bootstrapRes.status).toBe(409);
    const bootstrapBody = (await bootstrapRes.json()) as { hint?: string };
    expect(bootstrapBody.hint).toContain('/api/auth/operator-reset-password');

    // Over 20 successful logins from the same IP must not trigger 429
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: () => ({
          first: async () => {
            if (sql.includes('FROM staff_login_identities')) return null;
            if (sql.includes('FROM users WHERE id =')) {
              return { id: 'owner_1', name: 'Owner', role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 };
            }
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => ({ success: true, meta: { changes: 1 } }),
        }),
      })),
    };
    const app = new OpenAPIHono();
    app.route('/api/auth', authEndpointsRouter);
    for (let i = 0; i < 22; i++) {
      const loginRes = await app.fetch(
        new Request('https://api.test/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.113.10.1' },
          body: JSON.stringify({ email: 'owner@aura.vn', password: 'Secret123!' }),
        }),
        { ...env, AURA_DB: db } as never
      );
      expect(loginRes.status).toBe(200);
    }
    expect(kv.store.get('rate:auth:login:203.113.10.1')).toBeUndefined();
  });
});
