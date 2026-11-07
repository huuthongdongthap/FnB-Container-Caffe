// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { isHQSuperAdmin } from '../../middleware/tenant';
import { createTenantRoutes } from '../../routes/saas-tenants';
import promotionsRouter from '../../routes/promotions';
import { registerCrudHandlers } from '../../routes/openapi-promotions-handlers/crud-handlers';
import { registerValidationHandlers } from '../../routes/openapi-promotions-handlers/validation-handlers';
import { registerUsageHandlers } from '../../routes/openapi-promotions-handlers/usage-handlers';
import { validatePromotionNumericAndDateBounds, isPlaceholderPhone, normalizePromoPhone } from '../../routes/promotions-handlers/helpers';
import { issueStaffSession } from '../../lib/staff-session';

const TEST_SECRET = 'test-secret-at-least-32-characters-long';

function createMockD1(sqlite: DatabaseSync): import('@cloudflare/workers-types').D1Database {
  const prepare = (sql: string) => {
    let boundArgs: unknown[] = [];
    const normalizeArg = (v: unknown): string | number | null => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'number' || typeof v === 'string') return v;
      return JSON.stringify(v);
    };

    const stmtObj = {
      bind(...args: unknown[]) {
        boundArgs = args.map(normalizeArg);
        return stmtObj;
      },
      async run() {
        const stmt = sqlite.prepare(sql);
        const res = stmt.run(...(boundArgs as Array<string | number | null>));
        const changes = Number(res.changes ?? 0);
        return {
          success: true,
          changes,
          meta: { changes, last_row_id: Number(res.lastInsertRowid ?? 0) },
        };
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(boundArgs as Array<string | number | null>)) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return { ...row } as unknown as T;
      },
      async all<T = unknown>() {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...(boundArgs as Array<string | number | null>)) as Array<Record<string, unknown>>;
        return {
          results: rows.map((r) => ({ ...r })) as T[],
          success: true,
          meta: {},
        };
      },
      async raw() {
        return [];
      },
    };
    return stmtObj as unknown as import('@cloudflare/workers-types').D1PreparedStatement;
  };

  return {
    prepare,
    batch: async (stmts: import('@cloudflare/workers-types').D1PreparedStatement[]) => {
      const out = [];
      for (const s of stmts) {
        out.push(await (s as unknown as { run: () => Promise<unknown> }).run());
      }
      return out as import('@cloudflare/workers-types').D1Result[];
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new Uint8Array(),
  } as unknown as import('@cloudflare/workers-types').D1Database;
}

function initTestDatabase(): { sqlite: DatabaseSync; db: import('@cloudflare/workers-types').D1Database } {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'staff',
      tenant_id TEXT,
      is_active INTEGER DEFAULT 1,
      auth_version INTEGER DEFAULT 1
    );
    CREATE TABLE saas_tenants (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT,
      tier TEXT DEFAULT 'BASIC',
      status TEXT DEFAULT 'trial',
      owner_user_id TEXT,
      trial_ends_at TEXT,
      current_period_end TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE tenant_subscriptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      tier TEXT DEFAULT 'BASIC',
      status TEXT DEFAULT 'trial',
      trial_ends_at TEXT,
      current_period_end TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE promotions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT,
      description TEXT,
      type TEXT,
      discount_type TEXT,
      discount_value REAL,
      percent REAL,
      min_order INTEGER DEFAULT 0,
      min_order_value INTEGER DEFAULT 0,
      max_discount INTEGER,
      max_discount_value INTEGER,
      usage_limit INTEGER DEFAULT 0,
      max_uses INTEGER,
      usage_count INTEGER DEFAULT 0,
      current_uses INTEGER DEFAULT 0,
      per_customer_limit INTEGER DEFAULT 0,
      usage_limit_per_customer INTEGER DEFAULT 0,
      starts_at TEXT,
      valid_from TEXT,
      expires_at TEXT,
      valid_to TEXT,
      is_active INTEGER DEFAULT 1,
      applicable_items TEXT,
      excluded_items TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE promotion_usages (
      id TEXT PRIMARY KEY,
      promotion_id TEXT NOT NULL,
      order_id TEXT,
      customer_id TEXT,
      discount_amount REAL NOT NULL,
      idempotency_key TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      used_at TEXT
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      order_token TEXT,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      subtotal REAL DEFAULT 0,
      total REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT,
      price REAL DEFAULT 0,
      is_available INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT,
      entity_type TEXT,
      entity_id TEXT,
      metadata TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT
    );
  `);

  return { sqlite, db: createMockD1(sqlite) };
}

describe('Phase 53 Slice AZ1: Tenant Boundary Core, SaaS Provisioning & Promotions Engine Security', () => {
  let sqlite: DatabaseSync;
  let db: import('@cloudflare/workers-types').D1Database;
  let env: Env;

  beforeEach(() => {
    const init = initTestDatabase();
    sqlite = init.sqlite;
    db = init.db;
    env = { AURA_DB: db, JWT_SECRET: TEST_SECRET } as unknown as Env;
  });

  describe('AZ1-F1: isHQSuperAdmin Boundary Checks', () => {
    it('recognizes owner and admin bound to hq or * as HQ super admins', () => {
      expect(isHQSuperAdmin({ role: 'owner', tenantId: 'hq' })).toBe(true);
      expect(isHQSuperAdmin({ role: 'admin', tenantId: '*' })).toBe(true);
      expect(isHQSuperAdmin({ role: 'owner', tenant_id: 'hq' })).toBe(true);
      expect(isHQSuperAdmin({ role: 'admin', tenant_id: '*' })).toBe(true);
    });

    it('rejects store-bound owners or admins from acting as HQ super admins', () => {
      expect(isHQSuperAdmin({ role: 'owner', tenantId: 'default' })).toBe(false);
      expect(isHQSuperAdmin({ role: 'admin', tenantId: 'store-1' })).toBe(false);
      expect(isHQSuperAdmin({ role: 'owner', tenantId: 'store-sa-dec' })).toBe(false);
      expect(isHQSuperAdmin({ role: 'admin', tenantId: '' })).toBe(false);
    });

    it('rejects non-owner and non-admin roles even if assigned to hq or *', () => {
      expect(isHQSuperAdmin({ role: 'manager', tenantId: 'hq' })).toBe(false);
      expect(isHQSuperAdmin({ role: 'supervisor', tenantId: '*' })).toBe(false);
      expect(isHQSuperAdmin({ role: 'staff', tenantId: 'hq' })).toBe(false);
      expect(isHQSuperAdmin({ role: 'cashier', tenantId: '*' })).toBe(false);
    });

    it('handles context wrapper with c.get("user") safely', () => {
      const mockCtx = {
        get: (key: string) => (key === 'user' ? { role: 'owner', tenantId: 'hq' } : undefined),
      };
      expect(isHQSuperAdmin(mockCtx as never)).toBe(true);

      const nonHqCtx = {
        get: (key: string) => (key === 'user' ? { role: 'owner', tenantId: 'store-2' } : undefined),
      };
      expect(isHQSuperAdmin(nonHqCtx as never)).toBe(false);
    });

    it('returns false for null, undefined, or missing role', () => {
      expect(isHQSuperAdmin(null)).toBe(false);
      expect(isHQSuperAdmin(undefined)).toBe(false);
      expect(isHQSuperAdmin({})).toBe(false);
      expect(isHQSuperAdmin({ tenantId: 'hq' })).toBe(false);
    });
  });

  describe('AZ1-F2: SaaS Tenants Provisioning & Access Control', () => {
    it('allows HQ super-admin to read any tenant in GET /my by id or slug', async () => {
      sqlite.exec(`
        INSERT INTO saas_tenants (id, slug, name, tier, status, owner_user_id, created_at, updated_at)
        VALUES ('t_sadec_01', 'sadec-store', 'Sa Dec Coffee', 'BASIC', 'active', 'user_owner_sadec', datetime('now'), datetime('now'))
      `);

      const router = createTenantRoutes();
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'user_hq', role: 'owner', tenantId: 'hq' } as never);
        await next();
      });
      app.route('/tenants', router);

      const resById = await app.request('/tenants/my?tenant_id=t_sadec_01', { method: 'GET' }, env);
      expect(resById.status).toBe(200);
      const dataById = (await resById.json()) as { ok: boolean; data: { id: string; slug: string } };
      expect(dataById.ok).toBe(true);
      expect(dataById.data.id).toBe('t_sadec_01');

      const resBySlug = await app.request('/tenants/my?tenant_id=sadec-store', { method: 'GET' }, env);
      expect(resBySlug.status).toBe(200);
      const dataBySlug = (await resBySlug.json()) as { ok: boolean; data: { slug: string } };
      expect(dataBySlug.ok).toBe(true);
      expect(dataBySlug.data.slug).toBe('sadec-store');
    });

    it('rejects store-bound user from accessing other tenants in GET /my', async () => {
      sqlite.exec(`
        INSERT INTO saas_tenants (id, slug, name, tier, status, owner_user_id, created_at, updated_at)
        VALUES ('t_other_02', 'other-store', 'Other Store', 'BASIC', 'active', 'user_other', datetime('now'), datetime('now'))
      `);

      const router = createTenantRoutes();
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'user_store1', role: 'admin', tenantId: 't_store_01' } as never);
        await next();
      });
      app.route('/tenants', router);

      const res = await app.request('/tenants/my?tenant_id=t_other_02', { method: 'GET' }, env);
      expect(res.status).toBe(403);
      const json = (await res.json()) as { ok: boolean; error: string };
      expect(json.ok).toBe(false);
      expect(json.error).toBe('forbidden');
    });

    it('rejects store-bound non-HQ admins from creating tenants in POST /create', async () => {
      sqlite.exec(`
        INSERT INTO users (id, name, role, tenant_id, is_active, auth_version)
        VALUES ('user_store_admin', 'Store Admin', 'admin', 'store_danang', 1, 1)
      `);
      const { token: storeAdminToken } = await issueStaffSession(
        { JWT_SECRET: TEST_SECRET },
        { id: 'user_store_admin', name: 'Store Admin', phone: '0901234568', role: 'admin', tenant_id: 'store_danang', is_active: 1, auth_version: 1 },
        { sessionType: 'staff-web' }
      );

      const router = createTenantRoutes();
      const app = new Hono<{ Bindings: Env }>();
      app.route('/tenants', router);

      const res = await app.request(
        '/tenants/create',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${storeAdminToken}`,
          },
          body: JSON.stringify({ name: 'Danang Branch 2', slug: 'danang-2' }),
        },
        env
      );
      expect(res.status).toBe(403);
      const json = (await res.json()) as { ok: boolean; error: string };
      expect(json.ok).toBe(false);
      expect(json.error).toBe('forbidden');
    });

    it('allows HQ super-admin to create tenant and trial subscription atomically in POST /create', async () => {
      sqlite.exec(`
        INSERT INTO users (id, name, role, tenant_id, is_active, auth_version)
        VALUES ('hq_super_admin', 'HQ Owner', 'owner', 'hq', 1, 1)
      `);
      const { token: hqAdminToken } = await issueStaffSession(
        { JWT_SECRET: TEST_SECRET },
        { id: 'hq_super_admin', name: 'HQ Owner', phone: '0901234567', role: 'owner', tenant_id: 'hq', is_active: 1, auth_version: 1 },
        { sessionType: 'staff-web' }
      );

      const router = createTenantRoutes();
      const app = new Hono<{ Bindings: Env }>();
      app.route('/tenants', router);

      const res = await app.request(
        '/tenants/create',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${hqAdminToken}`,
          },
          body: JSON.stringify({ name: 'Pilot Store 2', slug: 'pilot-store-2' }),
        },
        env
      );
      expect(res.status).toBe(201);
      const json = (await res.json()) as { ok: boolean; data: { id: string; slug: string; name: string } };
      expect(json.ok).toBe(true);
      expect(json.data.slug).toBe('pilot-store-2');

      const createdTenant = sqlite.prepare('SELECT * FROM saas_tenants WHERE slug = ?').get('pilot-store-2') as Record<string, unknown>;
      expect(createdTenant).toBeDefined();
      expect(createdTenant.name).toBe('Pilot Store 2');

      const createdSub = sqlite.prepare('SELECT * FROM tenant_subscriptions WHERE tenant_id = ?').get(createdTenant.id) as Record<string, unknown>;
      expect(createdSub).toBeDefined();
      expect(createdSub.tier).toBe('BASIC');
      expect(createdSub.status).toBe('trial');
    });
  });

  describe('AZ1-F3: Promotion Phone Normalization & Order Ownership Validation', () => {
    it('correctly identifies placeholder phones', () => {
      expect(isPlaceholderPhone(null)).toBe(true);
      expect(isPlaceholderPhone(undefined)).toBe(true);
      expect(isPlaceholderPhone('')).toBe(true);
      expect(isPlaceholderPhone('0000000000')).toBe(true);
      expect(isPlaceholderPhone('0000')).toBe(true);
      expect(isPlaceholderPhone('12345')).toBe(true);
      expect(isPlaceholderPhone('0901234567')).toBe(false);
      expect(isPlaceholderPhone('84901234567')).toBe(false);
    });

    it('normalizes Vietnamese phone prefixes', () => {
      expect(normalizePromoPhone('84901234567')).toBe('0901234567');
      expect(normalizePromoPhone('+84901234567')).toBe('0901234567');
      expect(normalizePromoPhone('0901234567')).toBe('0901234567');
    });

    it('rejects guest order redemption with placeholder phone and missing order_token in POST /redeem', async () => {
      sqlite.exec(`
        INSERT INTO promotions (id, code, percent, is_active, tenant_id)
        VALUES ('p_redeem_1', 'REDEEM10', 10, 1, 'tenant_a')
      `);
      sqlite.exec(`
        INSERT INTO orders (id, customer_id, customer_phone, order_token, status, payment_status, subtotal, total, tenant_id)
        VALUES ('ord_guest_anon', NULL, '0000000000', NULL, 'pending', 'pending', 100000, 100000, 'tenant_a')
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'tenant_a' as never);
        await next();
      });
      app.route('/promotions', promotionsRouter);

      const res = await app.request(
        '/promotions/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({ code: 'REDEEM10', order_id: 'ord_guest_anon', order_total: 100000 }),
        },
        env
      );
      expect(res.status).toBe(403);
    });

    it('allows guest order redemption when valid order_token is supplied in POST /redeem', async () => {
      sqlite.exec(`
        INSERT INTO promotions (id, code, percent, is_active, tenant_id)
        VALUES ('p_redeem_2', 'TOKEN10', 10, 1, 'tenant_a')
      `);
      sqlite.exec(`
        INSERT INTO orders (id, customer_id, customer_phone, order_token, status, payment_status, subtotal, total, tenant_id)
        VALUES ('ord_token_guest', NULL, '0000000000', 'secret-guest-token-123', 'pending', 'pending', 100000, 100000, 'tenant_a')
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'tenant_a' as never);
        await next();
      });
      app.route('/promotions', promotionsRouter);

      const res = await app.request(
        '/promotions/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({
            code: 'TOKEN10',
            order_id: 'ord_token_guest',
            order_total: 100000,
            order_token: 'secret-guest-token-123',
          }),
        },
        env
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: { discount_amount: number } };
      expect(json.success).toBe(true);
      expect(json.data.discount_amount).toBe(10000);
    });
  });

  describe('AZ1-F4: Promotions Admin Numerical & Date Bounds and Isolation', () => {
    it('validates promotion numeric bounds and date sequence', () => {
      expect(validatePromotionNumericAndDateBounds({ percent: -5 }, null, true)).toBe('Phần trăm giảm phải từ 1-100');
      expect(validatePromotionNumericAndDateBounds({ percent: 105 }, null, true)).toBe('Phần trăm giảm phải từ 1-100');
      expect(validatePromotionNumericAndDateBounds({ percent: 50, min_order: -1 }, null, true)).toBe('Giá trị đơn hàng tối thiểu phải >= 0');
      expect(validatePromotionNumericAndDateBounds({ percent: 50, max_discount: -10 }, null, true)).toBe('Mức giảm tối đa phải >= 0');
      expect(validatePromotionNumericAndDateBounds({ percent: 50, usage_limit: -1 }, null, true)).toBe('Giới hạn lượt dùng phải >= 0');
      expect(
        validatePromotionNumericAndDateBounds(
          { percent: 50, starts_at: '2026-12-01T00:00:00Z', expires_at: '2026-11-01T00:00:00Z' },
          null,
          true
        )
      ).toBe('Thời gian bắt đầu phải trước hoặc bằng thời gian hết hạn');
      expect(
        validatePromotionNumericAndDateBounds(
          { percent: 20, min_order: 50000, max_discount: 30000, starts_at: '2026-01-01T00:00:00Z', expires_at: '2026-12-31T00:00:00Z' },
          null,
          true
        )
      ).toBeNull();
    });

    it('rejects cross-tenant promotion creation or modification by non-HQ admin', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'store_a_mgr', role: 'manager', tenantId: 'store_a' } as never);
        await next();
      });
      app.route('/promotions', promotionsRouter);

      const crossCreateRes = await app.request(
        '/promotions?tenant_id=store_b',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store_b' },
          body: JSON.stringify({ code: 'STOREB20', percent: 20 }),
        },
        env
      );
      expect(crossCreateRes.status).toBe(403);
    });

    it('scopes promotions update and delete to the caller tenant', async () => {
      sqlite.exec(`
        INSERT INTO promotions (id, code, percent, max_discount, is_active, tenant_id)
        VALUES
          ('p_store_a', 'AUTOPROMO', 15, 20000, 1, 'store_a'),
          ('p_store_b', 'AUTOPROMO', 25, 50000, 1, 'store_b')
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr_store_a', role: 'manager', tenantId: 'store_a' } as never);
        c.set('tenantId' as never, 'store_a' as never);
        await next();
      });
      app.route('/promotions', promotionsRouter);

      const patchRes = await app.request(
        '/promotions/AUTOPROMO',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ percent: 18 }),
        },
        env
      );
      expect(patchRes.status).toBe(200);

      const promoA = sqlite.prepare("SELECT * FROM promotions WHERE id = 'p_store_a'").get() as Record<string, unknown>;
      const promoB = sqlite.prepare("SELECT * FROM promotions WHERE id = 'p_store_b'").get() as Record<string, unknown>;
      expect(promoA.percent).toBe(18);
      expect(promoB.percent).toBe(25);

      const delRes = await app.request('/promotions/AUTOPROMO', { method: 'DELETE' }, env);
      expect(delRes.status).toBe(200);

      const promoADeleted = sqlite.prepare("SELECT * FROM promotions WHERE id = 'p_store_a'").get();
      const promoBRemaining = sqlite.prepare("SELECT * FROM promotions WHERE id = 'p_store_b'").get();
      expect(promoADeleted).toBeUndefined();
      expect(promoBRemaining).toBeDefined();
    });
  });

  describe('AZ1-F5 & F6: OpenAPI Promotions CRUD, Validation & Usage Isolation', () => {
    it('isolates OpenAPI promotion listing and lookup by tenant', async () => {
      sqlite.exec(`
        INSERT INTO promotions (id, code, name, type, discount_type, discount_value, is_active, tenant_id)
        VALUES
          ('p_oa_1', 'OPENAPI_A', 'Promo Store A', 'percentage', 'percentage', 10, 1, 'tenant_x'),
          ('p_oa_2', 'OPENAPI_B', 'Promo Store B', 'percentage', 'percentage', 20, 1, 'tenant_y')
      `);

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'staff_x', role: 'staff', tenantId: 'tenant_x' } as never);
        c.set('tenantId' as never, 'tenant_x' as never);
        await next();
      });
      registerCrudHandlers(app);

      const listRes = await app.request('/api/promotions', { method: 'GET' }, env);
      expect(listRes.status).toBe(200);
      const listJson = (await listRes.json()) as { data: { promotions: Array<{ code: string }> } };
      expect(listJson.data.promotions.map((p) => p.code)).toContain('OPENAPI_A');
      expect(listJson.data.promotions.map((p) => p.code)).not.toContain('OPENAPI_B');

      const getCrossRes = await app.request('/api/promotions/p_oa_2', { method: 'GET' }, env);
      expect(getCrossRes.status).toBe(404);
    });

    it('rejects cross-tenant order validation and usage in OpenAPI endpoints', async () => {
      const promoId = '11111111-1111-4111-8111-111111111111';
      const orderTenantM = '22222222-2222-4222-8222-222222222222';
      const orderTenantN = '33333333-3333-4333-8333-333333333333';

      sqlite.exec(`
        INSERT INTO promotions (id, code, name, type, discount_type, discount_value, min_order_value, is_active, tenant_id)
        VALUES ('${promoId}', 'OPENUSE', 'Open Use Promo', 'percentage', 'percentage', 10, 50000, 1, 'tenant_m')
      `);
      sqlite.exec(`
        INSERT INTO orders (id, customer_id, status, subtotal, total, tenant_id)
        VALUES
          ('${orderTenantM}', 'cust_m', 'pending', 60000, 60000, 'tenant_m'),
          ('${orderTenantN}', 'cust_n', 'pending', 60000, 60000, 'tenant_n')
      `);

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'cust_m', customerId: 'cust_m', role: 'customer', tenantId: 'tenant_m' } as never);
        c.set('tenantId' as never, 'tenant_m' as never);
        await next();
      });
      registerValidationHandlers(app);
      registerUsageHandlers(app);

      const crossUseRes = await app.request(
        '/api/promotions/use',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promotionId: promoId, orderId: orderTenantN, discountAmount: 6000 }),
        },
        env
      );
      expect(crossUseRes.status).toBe(404);

      const validUseRes = await app.request(
        '/api/promotions/use',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promotionId: promoId, orderId: orderTenantM, discountAmount: 6000 }),
        },
        env
      );
      expect(validUseRes.status).toBe(200);

      const usageRecord = sqlite.prepare(`SELECT * FROM promotion_usages WHERE promotion_id = '${promoId}'`).get() as Record<string, unknown>;
      expect(usageRecord).toBeDefined();
      expect(usageRecord.tenant_id).toBe('tenant_m');
    });
  });
});
