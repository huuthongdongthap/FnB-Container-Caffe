// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { createMockEnv } from '../test-utils';
import { generateJWT } from '../../lib/jwt';
import { reportsRouter } from '../../routes/reports-handlers/routes';
import { registerAnalyticsHandlers } from '../../routes/reports-handlers/analytics-handlers';
import { registerExportHandlers } from '../../routes/reports-handlers/export-handlers';
import { registerGroupedSalesHandlers } from '../../routes/reports-handlers/grouped-sales-handlers';
import { registerAdminHandlers } from '../../routes/customers-handlers/admin-handlers';
import { registerProfileHandlers } from '../../routes/customers-handlers/profile-handlers';
import { PROFILE_SQL, LEGACY_PROFILE_SQL } from '../../routes/customers-handlers/types';
import { orderStreamRouter } from '../../routes/order-stream';
import {
  appendEventToLog,
  replayEventsSince,
  type OrderStreamEvent,
} from '../../routes/order-stream-log';

const TEST_JWT_SECRET = 'phase52-ay4-test-secret-minimum-32-chars!!';

type TestUser = {
  id: string;
  sub?: string;
  customerId?: string;
  role: string;
  tenantId?: string;
  tenant_id?: string;
} | null;

function createSqliteD1(): {
  db: import('@cloudflare/workers-types').D1Database;
  sqlite: DatabaseSync;
  executedSqls: string[];
} {
  const sqlite = new DatabaseSync(':memory:');
  const executedSqls: string[] = [];

  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      role TEXT,
      tenant_id TEXT DEFAULT 'default',
      is_active INTEGER DEFAULT 1,
      auth_version INTEGER DEFAULT 1
    );
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      loyalty_tier TEXT DEFAULT 'bronze',
      loyalty_points INTEGER DEFAULT 0,
      lifetime_points INTEGER DEFAULT 0,
      date_of_birth TEXT,
      birthday TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE cashback_wallets (
      customer_id TEXT,
      balance REAL DEFAULT 0,
      total_earned REAL DEFAULT 0,
      total_spent REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_id TEXT,
      price REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'cash',
      subtotal REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      table_id TEXT,
      items TEXT DEFAULT '[]',
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE checkins (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      reward_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'approved',
      created_at TEXT
    );
    CREATE TABLE cashback_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      type TEXT DEFAULT 'earn',
      amount REAL DEFAULT 0,
      created_at TEXT
    );
  `);

  const prepare = (sql: string) => {
    executedSqls.push(sql);
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
        const row = stmt.get(...(boundArgs as Array<string | number | null>)) as
          | Record<string, unknown>
          | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return ({ ...row } as unknown) as T;
      },
      async all<T = unknown>() {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...(boundArgs as Array<string | number | null>)) as Array<
          Record<string, unknown>
        >;
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

  const db = {
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

  return { db, sqlite, executedSqls };
}

function buildReportsTestApp(user: TestUser, ctxTenantId?: string) {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', async (c, next) => {
    if (user) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('user', user);
    }
    if (ctxTenantId) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', ctxTenantId);
    }
    await next();
  });
  const sub = new Hono<{ Bindings: Env }>();
  registerAnalyticsHandlers(sub);
  registerExportHandlers(sub);
  registerGroupedSalesHandlers(sub);
  app.route('/api/reports', sub);
  return app;
}

describe('Phase 52 Slice AY4: Reports Analytics/Exports/Grouped-Sales, Customers Admin/Profile & Order Stream Security', () => {
  let db: import('@cloudflare/workers-types').D1Database;
  let sqlite: DatabaseSync;
  let executedSqls: string[];
  let env: Env;

  beforeEach(() => {
    const d1 = createSqliteD1();
    db = d1.db;
    sqlite = d1.sqlite;
    executedSqls = d1.executedSqls;
    env = createMockEnv({ AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET }) as unknown as Env;
  });

  describe('1. Reports Grouped-Sales, Analytics & Export Date Bounds, Strict HQ Check & Export Phone Guards', () => {
    it('rejects impossible calendar dates (e.g. 2026-02-30, 2026-02-31), inverted ranges, and >366-day windows with 400 instead of 500 across grouped-sales, analytics, and export routes', async () => {
      const app = buildReportsTestApp({ id: 'owner-hq', role: 'owner', tenantId: 'hq' });

      const dateEndpoints = [
        '/api/reports/overview',
        '/api/reports/sales-by-hour',
        '/api/reports/sales-by-day',
        '/api/reports/sales-by-category',
        '/api/reports/sales-by-payment',
        '/api/reports/daily',
        '/api/reports/orders',
        '/api/reports/top-products',
        '/api/reports/peak-hours',
        '/api/reports/export?type=orders',
      ];

      const invalidRanges = [
        { from: '2026-02-30', to: '2026-02-30' },
        { from: '2026-02-28', to: '2026-02-31' },
        { from: '2026-11-10', to: '2026-11-01' },
        { from: '2024-01-01', to: '2026-11-03' },
      ];

      for (const baseEp of dateEndpoints) {
        const sep = baseEp.includes('?') ? '&' : '?';
        for (const range of invalidRanges) {
          const res = await app.request(`${baseEp}${sep}from=${range.from}&to=${range.to}`, {}, env);
          expect(res.status).toBe(400);
        }
      }
    });

    it('denies default-store owner/admin cross-tenant overrides with 403 while permitting explicit HQ super-admin (tenantId: "*" or "hq") across analytics, grouped-sales, and exports', async () => {
      sqlite
        .prepare(
          `INSERT INTO orders (id, customer_id, customer_name, customer_phone, status, payment_status, total, items, tenant_id, created_at)
           VALUES
             ('ord-def', 'cust-d', 'Default Cust', '0901111111', 'completed', 'paid', 40000, '[]', 'default', '2026-11-03T03:00:00.000Z'),
             ('ord-b', 'cust-b', 'Store B Cust', '0902222222', 'completed', 'paid', 95000, '[]', 'store-b', '2026-11-03T03:00:00.000Z')`
        )
        .run();

      const defaultOwnerApp = buildReportsTestApp({ id: 'owner-def', role: 'owner', tenantId: 'default' });
      const unboundAdminApp = buildReportsTestApp({ id: 'admin-unbound', role: 'admin', tenantId: '' });
      const hqOwnerApp = buildReportsTestApp({ id: 'owner-hq', role: 'owner', tenantId: 'hq' });
      const wildcardAdminApp = buildReportsTestApp({ id: 'admin-star', role: 'admin', tenantId: '*' });

      const protectedRoutes = [
        '/api/reports/overview?from=2026-11-03&to=2026-11-03',
        '/api/reports/sales-by-hour?from=2026-11-03&to=2026-11-03',
        '/api/reports/sales-by-day?from=2026-11-03&to=2026-11-03',
        '/api/reports/sales-by-category?from=2026-11-03&to=2026-11-03',
        '/api/reports/sales-by-payment?from=2026-11-03&to=2026-11-03',
        '/api/reports/daily?from=2026-11-03&to=2026-11-03',
        '/api/reports/summary',
        '/api/reports/orders?from=2026-11-03&to=2026-11-03',
        '/api/reports/top-products?from=2026-11-03&to=2026-11-03',
        '/api/reports/peak-hours?from=2026-11-03&to=2026-11-03',
        '/api/reports/customer-metrics',
        '/api/reports/export?type=orders&from=2026-11-03&to=2026-11-03',
      ];

      for (const route of protectedRoutes) {
        const sep = route.includes('?') ? '&' : '?';

        // Default-store owner cannot query store-b or wildcard '*'
        const resDefQuery = await defaultOwnerApp.request(`${route}${sep}tenant_id=store-b`, {}, env);
        expect(resDefQuery.status).toBe(403);

        const resDefHeader = await defaultOwnerApp.request(route, { headers: { 'X-Tenant-ID': 'store-b' } }, env);
        expect(resDefHeader.status).toBe(403);

        const resDefWildcard = await defaultOwnerApp.request(`${route}${sep}tenant_id=*`, {}, env);
        expect(resDefWildcard.status).toBe(403);

        // Unbound admin (defaulting to 'default') cannot query store-b
        const resUnbound = await unboundAdminApp.request(`${route}${sep}tenant_id=store-b`, {}, env);
        expect(resUnbound.status).toBe(403);

        // Default-store owner CAN query their own 'default' store
        const resDefOwn = await defaultOwnerApp.request(route, {}, env);
        expect(resDefOwn.status).toBe(200);

        // HQ owner ('hq') and wildcard admin ('*') CAN query store-b
        const resHq = await hqOwnerApp.request(`${route}${sep}tenant_id=store-b`, {}, env);
        expect(resHq.status).toBe(200);

        const resStar = await wildcardAdminApp.request(`${route}${sep}tenant_id=store-b`, {}, env);
        expect(resStar.status).toBe(200);
      }

      // Verify HQ query to store-b returns store-b's 95,000 revenue, while default owner sees 40,000
      const defSummaryRes = await defaultOwnerApp.request('/api/reports/summary', {}, env);
      const defSummary = (await defSummaryRes.json()) as { data: { total_revenue: number } };
      expect(defSummary.data.total_revenue).toBe(40000);

      const hqSummaryRes = await wildcardAdminApp.request('/api/reports/summary?tenant_id=store-b', {}, env);
      const hqSummary = (await hqSummaryRes.json()) as { data: { total_revenue: number } };
      expect(hqSummary.data.total_revenue).toBe(95000);
    });

    it('excludes refunded status and refunded/failed payment_status from grouped-sales revenue and rejects unauthenticated cross-tenant requests with 401', async () => {
      sqlite
        .prepare(
          `INSERT INTO orders (id, customer_id, status, payment_status, payment_method, total, items, tenant_id, created_at)
           VALUES
             ('ord-valid', 'c1', 'completed', 'paid', 'cash', 60000, '[{"name":"Latte","category":"Coffee","price":60000,"qty":1}]', 'default', '2026-11-03T03:00:00.000Z'),
             ('ord-refunded-status', 'c2', 'refunded', 'paid', 'cash', 120000, '[{"name":"Mocha","category":"Coffee","price":120000,"qty":1}]', 'default', '2026-11-03T03:10:00.000Z'),
             ('ord-refunded-payment', 'c3', 'completed', 'refunded', 'payos', 90000, '[{"name":"Tea","category":"Tea","price":90000,"qty":1}]', 'default', '2026-11-03T03:20:00.000Z'),
             ('ord-failed-payment', 'c4', 'completed', 'failed', 'payos', 75000, '[{"name":"Cake","category":"Bakery","price":75000,"qty":1}]', 'default', '2026-11-03T03:30:00.000Z')`
        )
        .run();

      const ownerApp = buildReportsTestApp({ id: 'owner-def', role: 'owner', tenantId: 'default' });
      const ovRes = await ownerApp.request('/api/reports/overview?from=2026-11-03&to=2026-11-03', {}, env);
      expect(ovRes.status).toBe(200);
      const ovJson = (await ovRes.json()) as { data: { todayRevenue: number; todayOrders: number } };
      expect(ovJson.data.todayRevenue).toBe(60000);
      expect(ovJson.data.todayOrders).toBe(1);

      const unauthApp = buildReportsTestApp(null);
      const unauthCrossTenant = await unauthApp.request(
        '/api/reports/overview?from=2026-11-03&to=2026-11-03&tenant_id=store-b',
        {},
        env
      );
      expect(unauthCrossTenant.status).toBe(401);
    });

    it('excludes placeholder guest phones from o.customer_phone = c.phone join in customer CSV export', async () => {
      sqlite
        .prepare(
          `INSERT INTO customers (id, name, email, phone, loyalty_tier, tenant_id, created_at)
           VALUES
             ('cust-blank-phone', 'WalkIn Profile', 'walkin@example.com', '0000000000', 'bronze', 'store-a', '2026-11-03T01:00:00.000Z'),
             ('cust-guest-phone', 'Guest Profile', 'guest@example.com', 'guest', 'bronze', 'store-a', '2026-11-03T01:05:00.000Z'),
             ('cust-real-phone', 'Real Customer', 'real@example.com', '0912345678', 'silver', 'store-a', '2026-11-03T01:10:00.000Z')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO orders (id, customer_id, customer_name, customer_phone, status, payment_status, total, tenant_id, created_at)
           VALUES
             ('ord-anon-1', NULL, 'Anon 1', '0000000000', 'completed', 'paid', 500000, 'store-a', '2026-11-03T02:00:00.000Z'),
             ('ord-anon-2', NULL, 'Anon 2', 'guest', 'completed', 'paid', 300000, 'store-a', '2026-11-03T02:30:00.000Z'),
             ('ord-direct-link', 'cust-blank-phone', 'WalkIn Profile', '0000000000', 'completed', 'paid', 45000, 'store-a', '2026-11-03T03:00:00.000Z'),
             ('ord-real-phone', NULL, 'Real By Phone', '0912345678', 'completed', 'paid', 85000, 'store-a', '2026-11-03T03:30:00.000Z')`
        )
        .run();

      const app = buildReportsTestApp({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' }, 'store-a');
      const res = await app.request(
        '/api/reports/export?type=customers&from=2026-11-03&to=2026-11-03',
        { headers: { 'X-Tenant-ID': 'store-a' } },
        env
      );
      expect(res.status).toBe(200);
      const csvText = await res.text();

      // cust-blank-phone only gets the 45,000 order linked by customer_id, NOT the 500,000 anonymous '0000000000' order
      expect(csvText).toContain('cust-blank-phone,WalkIn Profile,walkin@example.com,0000000000,45000,1,bronze,2026-11-03');
      // cust-guest-phone gets 0 spent and 0 orders, NOT the 300,000 anonymous 'guest' order
      expect(csvText).toContain('cust-guest-phone,Guest Profile,guest@example.com,guest,0,0,bronze,2026-11-03');
      // cust-real-phone still matches its legitimate phone order (85,000)
      expect(csvText).toContain('cust-real-phone,Real Customer,real@example.com,0912345678,85000,1,silver,2026-11-03');
    });

    it('rejects lowercase authorization header without valid session on reportsRouter', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/reports', reportsRouter);
      const res = await app.request(
        '/api/reports/summary',
        { headers: { authorization: 'Bearer invalid.token.here' } },
        env
      );
      expect(res.status).toBe(401);
    });
  });

  describe('2. Customers Admin, Segments & Self-Profile Tenant Isolation', () => {
    beforeEach(() => {
      sqlite
        .prepare(
          `INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version)
           VALUES
             ('staff-a', 'Manager A', '0900000001', 'manager', 'store-a', 1, 1),
             ('owner-def', 'Owner Default', '0900000002', 'owner', 'default', 1, 1),
             ('owner-hq', 'Owner HQ', '0900000003', 'owner', 'hq', 1, 1)`
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO customers (id, name, email, phone, loyalty_tier, loyalty_points, lifetime_points, tenant_id, created_at)
           VALUES
             ('cust-a1', 'Alice Store A', 'alice@a.com', '0901110001', 'gold', 100, 200, 'store-a', '2026-11-01T10:00:00Z'),
             ('cust-b1', 'Bob Store B', 'bob@b.com', '0902220002', 'platinum', 300, 500, 'store-b', '2026-11-02T10:00:00Z')`
        )
        .run();
    });

    it('includes c.tenant_id in PROFILE_SQL and LEGACY_PROFILE_SQL and enforces caller-tenant confinement in GET /api/customers and GET /api/customers/segments', async () => {
      expect(PROFILE_SQL).toContain('c.tenant_id');
      expect(LEGACY_PROFILE_SQL).toContain('c.tenant_id');

      const app = new Hono<{ Bindings: Env }>();
      registerAdminHandlers(app);

      const now = Math.floor(Date.now() / 1000);
      const staffAToken = await generateJWT(
        {
          sub: 'staff-a',
          id: 'staff-a',
          role: 'manager',
          tenantId: 'store-a',
          authVersion: 1,
          authTime: now,
          sessionType: 'staff-web',
        },
        TEST_JWT_SECRET,
        3600,
        now
      );
      const defaultOwnerToken = await generateJWT(
        {
          sub: 'owner-def',
          id: 'owner-def',
          role: 'owner',
          tenantId: 'default',
          authVersion: 1,
          authTime: now,
          sessionType: 'staff-web',
        },
        TEST_JWT_SECRET,
        3600,
        now
      );
      const hqOwnerToken = await generateJWT(
        {
          sub: 'owner-hq',
          id: 'owner-hq',
          role: 'owner',
          tenantId: 'hq',
          authVersion: 1,
          authTime: now,
          sessionType: 'staff-web',
        },
        TEST_JWT_SECRET,
        3600,
        now
      );

      // Manager of store-a cannot override tenant to store-b via header or query
      const crossListRes = await app.request(
        '/?tenant_id=store-b',
        { headers: { Authorization: `Bearer ${staffAToken}` } },
        env
      );
      expect(crossListRes.status).toBe(403);

      const crossSegRes = await app.request(
        '/segments',
        { headers: { Authorization: `Bearer ${staffAToken}`, 'X-Tenant-ID': 'store-b' } },
        env
      );
      expect(crossSegRes.status).toBe(403);

      // Default-store owner cannot override tenant to store-b
      const defOwnerCrossRes = await app.request(
        '/?tenant_id=store-b',
        { headers: { Authorization: `Bearer ${defaultOwnerToken}` } },
        env
      );
      expect(defOwnerCrossRes.status).toBe(403);

      // Manager of store-a listing own tenant only sees cust-a1 (with tenant_id populated)
      const ownListRes = await app.request(
        '/',
        { headers: { Authorization: `Bearer ${staffAToken}` } },
        env
      );
      expect(ownListRes.status).toBe(200);
      const ownListJson = (await ownListRes.json()) as {
        data: Array<{ id: string; tenant_id?: string }>;
      };
      expect(ownListJson.data).toHaveLength(1);
      expect(ownListJson.data[0].id).toBe('cust-a1');
      expect(ownListJson.data[0].tenant_id).toBe('store-a');

      // HQ owner can query store-b explicitly
      const hqListRes = await app.request(
        '/?tenant_id=store-b',
        { headers: { Authorization: `Bearer ${hqOwnerToken}` } },
        env
      );
      expect(hqListRes.status).toBe(200);
      const hqListJson = (await hqListRes.json()) as {
        data: Array<{ id: string; tenant_id?: string }>;
      };
      expect(hqListJson.data).toHaveLength(1);
      expect(hqListJson.data[0].id).toBe('cust-b1');
      expect(hqListJson.data[0].tenant_id).toBe('store-b');
    });

    it('rejects cross-tenant X-Tenant-ID / ?tenant_id mismatches on GET /me and PATCH /me with 403 and prevents unscoped SQL fallbacks when tenantId !== "default"', async () => {
      const app = new Hono<{ Bindings: Env }>();
      registerProfileHandlers(app);

      const custAToken = await generateJWT(
        { sub: 'cust-a1', id: 'cust-a1', role: 'customer', tenantId: 'store-a' },
        TEST_JWT_SECRET
      );
      const custBTokenForVictimA = await generateJWT(
        { sub: 'cust-a1', id: 'cust-a1', role: 'customer', tenantId: 'store-b' },
        TEST_JWT_SECRET
      );

      // 1. Customer bound to store-a passing X-Tenant-ID: store-b or ?tenant_id=store-b gets 403
      const getCrossHeader = await app.request(
        '/me',
        { headers: { Authorization: `Bearer ${custAToken}`, 'X-Tenant-ID': 'store-b' } },
        env
      );
      expect(getCrossHeader.status).toBe(403);

      const patchCrossQuery = await app.request(
        '/me?tenant_id=store-b',
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${custAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Spoofed Name' }),
        },
        env
      );
      expect(patchCrossQuery.status).toBe(403);

      // 2. Token scoped to store-b attempting to read or mutate cust-a1 (in store-a) gets 404, even if cashback_wallets is dropped to trigger SQL fallback
      sqlite.exec('DROP TABLE cashback_wallets;');
      executedSqls.length = 0;

      const getWrongTenant = await app.request(
        '/me',
        { headers: { Authorization: `Bearer ${custBTokenForVictimA}` } },
        env
      );
      expect(getWrongTenant.status).toBe(404);
      expect(
        executedSqls.some(
          (s) => s.includes('FROM customers c WHERE c.id = ?') && !s.includes('tenant_id')
        )
      ).toBe(false);

      const patchWrongTenant = await app.request(
        '/me',
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${custBTokenForVictimA}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Hijacked Alice' }),
        },
        env
      );
      expect(patchWrongTenant.status).toBe(404);

      const aliceRow = sqlite
        .prepare('SELECT name FROM customers WHERE id = ?')
        .get('cust-a1') as { name: string };
      expect(aliceRow.name).toBe('Alice Store A');
    });
  });

  describe('3. SSE Order Stream Staff Tenant Confinement & Tenant-Scoped Event Replay', () => {
    it('blocks default-store owner and cross-tenant staff from subscribing to another tenant order stream with 403', async () => {
      sqlite
        .prepare(
          `INSERT INTO orders (id, customer_id, status, payment_status, total_amount, items, tenant_id, created_at)
           VALUES ('ORD-STORE-B', 'cust-b1', 'completed', 'paid', 65000, '[]', 'store-b', '2026-11-03T04:00:00Z')`
        )
        .run();

      const kvStore = new Map<string, string>();
      const streamEnv = {
        ...env,
        AUTH_KV: {
          get: async (k: string) => kvStore.get(k) ?? null,
          put: async (k: string, v: string) => {
            kvStore.set(k, v);
          },
        } as unknown as KVNamespace,
      };

      const defaultOwnerApp = new Hono<{ Bindings: Env }>();
      defaultOwnerApp.use('*', async (c, next) => {
        (c as unknown as { set: (k: string, v: unknown) => void }).set('user', {
          id: 'owner-def',
          role: 'owner',
          tenantId: 'default',
        });
        await next();
      });
      defaultOwnerApp.route('/api/orders', orderStreamRouter);

      const resDefOwner = await defaultOwnerApp.request(
        '/api/orders/ORD-STORE-B/events?tenant_id=store-b',
        {},
        streamEnv
      );
      expect(resDefOwner.status).toBe(403);

      const staffAApp = new Hono<{ Bindings: Env }>();
      staffAApp.use('*', async (c, next) => {
        (c as unknown as { set: (k: string, v: unknown) => void }).set('user', {
          id: 'staff-a',
          role: 'staff',
          tenantId: 'store-a',
        });
        await next();
      });
      staffAApp.route('/api/orders', orderStreamRouter);

      const resStaffCross = await staffAApp.request(
        '/api/orders/ORD-STORE-B/events',
        { headers: { 'X-Tenant-ID': 'store-b' } },
        streamEnv
      );
      expect(resStaffCross.status).toBe(403);

      const customerAApp = new Hono<{ Bindings: Env }>();
      customerAApp.use('*', async (c, next) => {
        (c as unknown as { set: (k: string, v: unknown) => void }).set('user', {
          id: 'cust-b1',
          role: 'customer',
          tenantId: 'store-a',
        });
        await next();
      });
      customerAApp.route('/api/orders', orderStreamRouter);

      const resCustCross = await customerAApp.request(
        '/api/orders/ORD-STORE-B/events?tenant_id=store-b',
        {},
        streamEnv
      );
      expect(resCustCross.status).toBe(403);
    });

    it('stamps tenantId on OrderStreamEvent and filters out cross-tenant events during Last-Event-ID replay', async () => {
      const kvStore = new Map<string, string>();
      const kv = {
        get: async (k: string) => kvStore.get(k) ?? null,
        put: async (k: string, v: string) => {
          kvStore.set(k, v);
        },
      };

      // Seed shared fallback log key with mixed tenant events for colliding orderId
      const mixedEvents: OrderStreamEvent[] = [
        {
          eventId: '1000',
          orderId: 'ORD-COLLIDE',
          type: 'update_order',
          data: { id: 'ORD-COLLIDE', status: 'confirmed' },
          timestamp: '2026-11-03T01:00:00.000Z',
          tenantId: 'store-a',
        },
        {
          eventId: '2000',
          orderId: 'ORD-COLLIDE',
          type: 'update_order',
          data: { id: 'ORD-COLLIDE', status: 'preparing', secretNote: 'store-b-only' },
          timestamp: '2026-11-03T01:01:00.000Z',
          tenantId: 'store-b',
        },
        {
          eventId: '3000',
          orderId: 'ORD-COLLIDE',
          type: 'update_order',
          data: { id: 'ORD-COLLIDE', status: 'ready' },
          timestamp: '2026-11-03T01:02:00.000Z',
          tenantId: 'store-a',
        },
      ];
      kvStore.set('order_events_log:ORD-COLLIDE', JSON.stringify(mixedEvents));

      const replayedForA = await replayEventsSince(kv, 'ORD-COLLIDE', '1000', 'store-a');
      expect(replayedForA).toHaveLength(1);
      expect(replayedForA[0].eventId).toBe('3000');
      expect(replayedForA[0].tenantId).toBe('store-a');

      const replayedForB = await replayEventsSince(kv, 'ORD-COLLIDE', '1000', 'store-b');
      expect(replayedForB).toHaveLength(1);
      expect(replayedForB[0].eventId).toBe('2000');
      expect(replayedForB[0].tenantId).toBe('store-b');

      // appendEventToLog stores under tenant-scoped key and stamps tenantId
      await appendEventToLog(
        kv,
        'ORD-NEW',
        {
          eventId: '5000',
          orderId: 'ORD-NEW',
          type: 'update_order',
          data: { id: 'ORD-NEW', status: 'completed' },
          timestamp: '2026-11-03T02:00:00.000Z',
        },
        'store-a'
      );
      expect(kvStore.has('order_events_log:store-a:ORD-NEW')).toBe(true);
      const storedForA = JSON.parse(kvStore.get('order_events_log:store-a:ORD-NEW')!) as OrderStreamEvent[];
      expect(storedForA[0].tenantId).toBe('store-a');
    });
  });
});
