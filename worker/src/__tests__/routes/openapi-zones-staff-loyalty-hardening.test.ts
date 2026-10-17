/**
 * OpenAPI Table Zones Auth, ORDER BY Allowlisting, Staff Security & Loyalty Redemption Tests
 * Verifies Phase 15 remediations:
 * - /api/table-zones requires authentication (401 when unauthenticated).
 * - ORDER BY clauses in table-zones, staff, shifts, attendance, and cron jobs sanitize sort columns.
 * - Staff creation uses PBKDF2 hashPassword, redacts plaintext password from audit_logs,
 *   and prevents manager role from creating/modifying/deleting owner accounts.
 * - Loyalty reward redemption reads rewardId from JSON body, enforces points check unconditionally,
 *   and restricts reward/tier mutations to owner/manager.
 */

import { describe, it, expect } from 'vitest';
import { app } from '../../index';
import { openApiOrdersRouter } from '../../routes/openapi-orders-handlers/routes';
import { generateJWT, verifyPassword } from '../../lib/jwt';
import { createMockEnv, createMockDB } from '../test-utils';

const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';
const REWARD_ID = 'd1111111-1111-4111-8111-111111111111';
const IDEM_KEY = 'e1111111-1111-4111-8111-111111111111';
const OWNER_ID = 'f1111111-1111-4111-8111-111111111111';

function makeHardeningTestEnv() {
  const store = new Map<string, string>();
  const db = createMockDB();
  const executedSqls: string[] = [];
  const auditInserts: Array<{ action: string; metadata: string }> = [];
  const createdUsers: Record<string, any> = {
    [OWNER_ID]: {
      id: OWNER_ID,
      name: 'Store Owner',
      email: 'owner@auraspace.cafe',
      role: 'owner',
      locale: 'vi',
      is_active: 1,
      hire_date: '2026-01-01',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  db.prepare = ((sql: string) => {
    executedSqls.push(sql);
    let boundArgs: unknown[] = [];
    const stmt = {
      _sql: sql,
      bind: (...args: unknown[]) => {
        boundArgs = args;
        return stmt;
      },
      first: async () => {
        if (sql.includes('SELECT COUNT(*) as total')) {
          return { total: 1 };
        }
        if (sql.includes('FROM users WHERE email = ?')) {
          return null;
        }
        if (sql.includes('FROM users WHERE id = ?')) {
          const id = boundArgs[0] as string;
          return createdUsers[id] || null;
        }
        if (sql.includes('FROM loyalty_rewards WHERE id = ?')) {
          const id = boundArgs[0] as string;
          if (id === REWARD_ID) {
            return {
              id: REWARD_ID,
              name: 'Free Espresso',
              points_cost: 500,
              type: 'free_item',
              value: 35000,
              is_active: 1,
              max_redemptions: 100,
              current_redemptions: 0,
            };
          }
          return null;
        }
        if (sql.includes('FROM loyalty_accounts WHERE customer_id = ?')) {
          return {
            id: 'acc-1',
            customer_id: boundArgs[0],
            tier: 'unconfigured_tier',
            current_points: 100, // Less than 500 points_cost!
            lifetime_points: 100,
          };
        }
        if (sql.includes('FROM loyalty_tier_configs WHERE tier = ?')) {
          return null; // Simulate missing tier config row
        }
        return null;
      },
      all: async () => ({ results: [], success: true }),
      run: async () => {
        if (sql.includes('INSERT INTO users')) {
          const [id, name, email, phone, password_hash, role, locale, is_active, avatar_url, hire_date, created_at, updated_at] = boundArgs;
          createdUsers[String(id)] = {
            id,
            name,
            email,
            phone,
            password_hash,
            role,
            locale,
            is_active,
            avatar_url,
            hire_date,
            created_at,
            updated_at,
          };
        }
        if (sql.includes('INSERT INTO audit_logs')) {
          auditInserts.push({
            action: String(boundArgs[2]),
            metadata: String(boundArgs[5]),
          });
        }
        return { success: true, changes: 1, lastRowId: 1 };
      },
    };
    return stmt as any;
  }) as any;

  return {
    env: {
      ...createMockEnv(),
      AURA_DB: db,
      AUTH_KV: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => { store.set(k, v); },
        delete: async (k: string) => { store.delete(k); },
      } as any,
      JWT_SECRET: TEST_SECRET,
    } as any,
    executedSqls,
    auditInserts,
    createdUsers,
    store,
  };
}

describe('Phase 15: OpenAPI Table Zones Auth, ORDER BY Allowlisting, Staff & Loyalty Hardening', () => {
  it('enforces authentication on GET and POST /api/table-zones', async () => {
    const { env } = makeHardeningTestEnv();

    const getRes = await app.fetch(new Request('https://test.aura/api/table-zones'), env);
    expect(getRes.status).toBe(401);

    const postRes = await app.fetch(
      new Request('https://test.aura/api/table-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'VIP Zone',
          slug: 'vip-zone',
          locationId: OWNER_ID,
        }),
      }),
      env
    );
    expect(postRes.status).toBe(401);
  });

  it('sanitizes ORDER BY sort parameter against SQL injection in /api/table-zones and /api/staff', async () => {
    const { env, executedSqls } = makeHardeningTestEnv();
    const token = await generateJWT({ sub: 'mgr-1', role: 'manager', name: 'Manager' }, TEST_SECRET);

    const zoneRes = await app.fetch(
      new Request('https://test.aura/api/table-zones?sort=1;DROP%20TABLE%20users--&order=desc', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(zoneRes.status).toBe(200);
    const zoneSelectSql = executedSqls.find((s) => s.includes('SELECT * FROM table_zones'));
    expect(zoneSelectSql).toBeDefined();
    expect(zoneSelectSql).toContain('ORDER BY sort_order DESC');
    expect(zoneSelectSql).not.toContain('DROP TABLE');

    const staffRes = await app.fetch(
      new Request('https://test.aura/api/staff?sort=password_hash&order=asc', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(staffRes.status).toBe(200);
    const staffSelectSql = executedSqls.find((s) => s.includes('SELECT id, name, email, phone, role') && s.includes('ORDER BY'));
    expect(staffSelectSql).toBeDefined();
    expect(staffSelectSql).toContain('ORDER BY name ASC');
    expect(staffSelectSql).not.toContain('ORDER BY password_hash');
  });

  it('hashes staff password with PBKDF2 and redacts plaintext password from audit_logs', async () => {
    const { env, auditInserts, createdUsers } = makeHardeningTestEnv();
    const token = await generateJWT({ sub: OWNER_ID, role: 'owner', name: 'Owner' }, TEST_SECRET);

    const res = await app.fetch(
      new Request('https://test.aura/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Barista Bob',
          email: 'bob@auraspace.cafe',
          password: 'SuperSecretPassword123!',
          role: 'staff',
        }),
      }),
      env
    );

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    const createdId = body.data.id;
    const storedUser = createdUsers[createdId];
    expect(storedUser.password_hash).toMatch(/^pbkdf2\$100000\$/);
    expect(await verifyPassword('SuperSecretPassword123!', storedUser.password_hash)).toBe(true);

    const createAudit = auditInserts.find((a) => a.action === 'staff_create');
    expect(createAudit).toBeDefined();
    expect(createAudit!.metadata).not.toContain('SuperSecretPassword123!');
  });

  it('blocks manager from creating, updating, or deleting an owner account (privilege escalation guard)', async () => {
    const { env } = makeHardeningTestEnv();
    const mgrToken = await generateJWT({ sub: 'mgr-1', role: 'manager', name: 'Manager' }, TEST_SECRET);

    // 1. Manager attempting to create an owner account
    const createRes = await app.fetch(
      new Request('https://test.aura/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mgrToken}`,
        },
        body: JSON.stringify({
          name: 'Rogue Owner',
          email: 'rogue@auraspace.cafe',
          password: 'Password123!',
          role: 'owner',
        }),
      }),
      env
    );
    expect(createRes.status).toBe(403);

    // 2. Manager attempting to update an existing owner account
    const updateRes = await app.fetch(
      new Request(`https://test.aura/api/staff/${OWNER_ID}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mgrToken}`,
        },
        body: JSON.stringify({ name: 'Hijacked Owner' }),
      }),
      env
    );
    expect(updateRes.status).toBe(403);

    // 3. Manager attempting to delete an existing owner account
    const deleteRes = await app.fetch(
      new Request(`https://test.aura/api/staff/${OWNER_ID}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${mgrToken}` },
      }),
      env
    );
    expect(deleteRes.status).toBe(403);
  });

  it('enforces unconditional points check on POST /api/loyalty/rewards/redeem and blocks customer from creating rewards', async () => {
    const { env } = makeHardeningTestEnv();
    const custToken = await generateJWT({ sub: 'cust-1', role: 'customer', name: 'Customer' }, TEST_SECRET);

    // Customer attempting to redeem 500-point reward with 100 points (even when tierConfig is null)
    const redeemRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/rewards/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custToken}`,
        },
        body: JSON.stringify({
          rewardId: REWARD_ID,
          idempotencyKey: IDEM_KEY,
        }),
      }),
      env
    );
    expect(redeemRes.status).toBe(400);
    const redeemBody = await redeemRes.json() as any;
    expect(redeemBody.error).toBe('Insufficient points');

    // Customer attempting to create a reward (admin-only mutation)
    const createRewardRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/rewards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custToken}`,
        },
        body: JSON.stringify({
          name: 'Free Everything',
          pointsCost: 1,
          type: 'free_item',
          value: 100000,
        }),
      }),
      env
    );
    expect(createRewardRes.status).toBe(403);
  });

  it('authorizes admin role across OpenAPI loyalty admin summary, staff, table-zones, and cron routers', async () => {
    const { env } = makeHardeningTestEnv();
    const adminToken = await generateJWT({ sub: 'admin-1', role: 'admin', name: 'Admin' }, TEST_SECRET);

    const summaryRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/admin/summary', {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      env
    );
    expect(summaryRes.status).toBe(200);

    const zonesRes = await app.fetch(
      new Request('https://test.aura/api/table-zones', {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      env
    );
    expect(zonesRes.status).toBe(200);

    const staffRes = await app.fetch(
      new Request('https://test.aura/api/staff', {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      env
    );
    expect(staffRes.status).toBe(200);

    const cronRes = await app.fetch(
      new Request('https://test.aura/api/cron/summary', {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      env
    );
    expect(cronRes.status).toBe(200);
  });

  it('publishes order_event, latest_order_ts, and orders:latest_updated_at to AUTH_KV on OpenAPI order creation', async () => {
    const { env, store } = makeHardeningTestEnv();
    const origPrepare = env.AURA_DB.prepare;
    env.AURA_DB.prepare = ((sql: string) => {
      const stmt = origPrepare(sql);
      const origAll = stmt.all;
      const origFirst = stmt.first;
      stmt.all = async () => {
        if (sql.includes('FROM menu_items')) {
          return {
            results: [
              { id: OWNER_ID, name: 'Cà Phê Sữa Đá', price: 35000, available: 1 },
            ],
            success: true,
          };
        }
        return origAll();
      };
      stmt.first = async () => {
        if (sql.includes('FROM products') || sql.includes('FROM menu_items')) {
          return {
            id: OWNER_ID,
            name: 'Cà Phê Sữa Đá',
            price: 35000,
            is_available: 1,
            available: 1,
            category_id: 'cat_coffee',
          };
        }
        if (sql.includes('FROM orders')) {
          return {
            id: OWNER_ID,
            order_number: 'ORD-20261017-ABC',
            location_id: OWNER_ID,
            items: JSON.stringify([{ menuItemId: OWNER_ID, name: 'Cà Phê Sữa Đá', quantity: 1, unitPriceCents: 35000, subtotalCents: 35000 }]),
            subtotal: 35000,
            discount_amount: 0,
            tax_amount: 0,
            total_amount: 35000,
            status: 'pending',
            payment_status: 'unpaid',
            source: 'pos',
            channel: 'dine_in',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
        return origFirst();
      };
      return stmt;
    }) as any;

    const createRes = await openApiOrdersRouter.fetch(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: OWNER_ID,
          items: [{ menuItemId: OWNER_ID, quantity: 1 }],
          source: 'pos',
          channel: 'dine_in',
        }),
      }),
      env
    );
    expect(createRes.status).toBe(201);
    expect(store.get('latest_order_ts')).toBeTruthy();
    expect(store.get('orders:latest_updated_at')).toBeTruthy();
    const orderEventKeys = Array.from(store.keys()).filter((k) => k.startsWith('order_event:'));
    expect(orderEventKeys.length).toBe(1);
  });
});
