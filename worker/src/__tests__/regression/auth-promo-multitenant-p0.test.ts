// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { OpenAPIHono } from '@hono/zod-openapi';
import { loginUser } from '../../tree/auth/login';
import { logoutUser } from '../../tree/auth/logout';
import { hashPassword, verifyJWT } from '../../lib/jwt';
import { authEndpointsRouter } from '../../routes/auth-endpoints';
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

  it('defines tenant-scoped composite keys in worker/schema.sql and migration 015', () => {
    const schemaPath = resolve(__dirname, '../../../schema.sql');
    const migrationPath = resolve(__dirname, '../../../migrations/015_tenant_scoped_unique_keys.sql');
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

  it('applies worker/schema.sql + migration 015 in real SQLite preserving columns, data, indexes, triggers, and tenant isolation', () => {
    const schemaSql = readFileSync(resolve(__dirname, '../../../schema.sql'), 'utf-8');
    const migrationSql = readFileSync(
      resolve(__dirname, '../../../migrations/015_tenant_scoped_unique_keys.sql'),
      'utf-8'
    );
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(schemaSql);

    // Seed data before migration
    sqlite
      .prepare("INSERT INTO customers (id, tenant_id, email, phone, name, auth_version) VALUES (?, ?, ?, ?, ?, ?)")
      .run('c1', 'tenant-a', 'shared@example.com', '0909000111', 'Alice A', 3);
    sqlite
      .prepare("INSERT INTO promotions (id, code, percent, tenant_id, discount_type, discount_value) VALUES (?, ?, ?, ?, ?, ?)")
      .run('p1', 'WELCOME10', 10, 'tenant-a', 'percentage', 10);
    sqlite
      .prepare("INSERT INTO loyalty_tier_configs (tenant_id, tier, name, min_points) VALUES (?, ?, ?, ?)")
      .run('tenant-a', 'gold', 'Gold A', 1000);

    // Apply migration 015
    sqlite.exec(migrationSql);

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
});
