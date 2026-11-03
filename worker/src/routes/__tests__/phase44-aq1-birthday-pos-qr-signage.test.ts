// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { birthdayRouter } from '../birthday';
import { posCustomerRouter } from '../pos-customer';
import { adminQRRouter } from '../admin-qr';
import { signageRouter } from '../signage';
import { bulkGenerateSlugs } from '../../tree/qr/generator';
import { generateJWT } from '../../lib/jwt';
import { issueStaffSession } from '../../lib/staff-session';
import { createMockEnv } from '../../__tests__/test-utils';
import type { Env } from '../../types/env';

const TEST_JWT_SECRET = 'phase44-aq1-jwt-secret-key-minimum-32-chars!!';
const TEST_QR_SECRET = 'phase44-aq1-qr-signing-secret-key-2026';

function createSqliteD1Adapter(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    const runFirst = async (bound: unknown[]) => {
      const stmt = sqlite.prepare(sql);
      if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql)) {
        const rows = stmt.all(...(bound as any[])) as Record<string, unknown>[];
        return rows[0] ?? null;
      }
      stmt.run(...(bound as any[]));
      return null;
    };
    const runAll = async (bound: unknown[]) => {
      const stmt = sqlite.prepare(sql);
      if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql)) {
        const rows = stmt.all(...(bound as any[])) as Record<string, unknown>[];
        return { results: rows, success: true, meta: {} };
      }
      const info = stmt.run(...(bound as any[]));
      return { results: [], success: true, meta: { changes: Number(info.changes ?? 0) } };
    };
    const runExec = async (bound: unknown[]) => {
      const stmt = sqlite.prepare(sql);
      if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql)) {
        stmt.all(...(bound as any[]));
        return { success: true, meta: { changes: 0 } };
      }
      const info = stmt.run(...(bound as any[]));
      return { success: true, meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) } };
    };

    return {
      _sql: sql,
      _bound: [] as unknown[],
      bind(...args: unknown[]) {
        return {
          _sql: sql,
          _bound: args,
          first: <T = Record<string, unknown>>() => runFirst(args) as Promise<T | null>,
          all: <T = Record<string, unknown>>() => runAll(args) as Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }>,
          run: () => runExec(args),
          raw: async () => [],
        };
      },
      first: <T = Record<string, unknown>>() => runFirst([]) as Promise<T | null>,
      all: <T = Record<string, unknown>>() => runAll([]) as Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }>,
      run: () => runExec([]),
      raw: async () => [],
    };
  };

  return {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const out = [];
      for (const s of stmts) {
        out.push(await s.run());
      }
      return out;
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

function formatMonthDayOffset(daysOffset: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysOffset);
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `1992-${m}-${d}`;
}

describe('Phase 44 Slice AQ1 — Birthday Loyalty, POS Customer Lookup, Admin QR & Signage Hardening', () => {
  describe('Birthday loyalty routes (/api/loyalty/birthday)', () => {
    function setupBirthdayDb() {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'default',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          birthday TEXT,
          loyalty_tier TEXT DEFAULT 'bronze',
          loyalty_points INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          customer_phone TEXT,
          status TEXT DEFAULT 'pending',
          total INTEGER DEFAULT 100000,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE birthday_redemptions (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          discount_percent INTEGER NOT NULL,
          order_id TEXT,
          redeemed_at TEXT NOT NULL,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      return sqlite;
    }

    it('uses consistent 3-day default window across /config, /check, and /redeem when KV config is absent', async () => {
      const sqlite = setupBirthdayDb();
      const db = createSqliteD1Adapter(sqlite);
      const bday5DaysOut = formatMonthDayOffset(5);
      const bday2DaysOut = formatMonthDayOffset(2);

      sqlite
        .prepare('INSERT INTO customers (id, name, phone, birthday, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('cust-5d', 'Five Days Out', '0901111222', bday5DaysOut, 'default');
      sqlite
        .prepare('INSERT INTO customers (id, name, phone, birthday, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('cust-2d', 'Two Days Out', '0901111333', bday2DaysOut, 'default');

      const env = createMockEnv({ AURA_DB: db, AUTH_KV: undefined as unknown as KVNamespace });

      const check5Res = await birthdayRouter.request('http://localhost/check?customer_id=cust-5d', {}, env);
      expect(check5Res.status).toBe(200);
      const check5Json = (await check5Res.json()) as { data: { eligible: boolean } };
      expect(check5Json.data.eligible).toBe(false);

      const redeem5Res = await birthdayRouter.request(
        'http://localhost/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: 'cust-5d' }),
        },
        env
      );
      expect(redeem5Res.status).toBe(400);

      const check2Res = await birthdayRouter.request('http://localhost/check?customer_id=cust-2d', {}, env);
      expect(check2Res.status).toBe(200);
      const check2Json = (await check2Res.json()) as { data: { eligible: boolean; discount_percent: number } };
      expect(check2Json.data.eligible).toBe(true);
      expect(check2Json.data.discount_percent).toBe(15);

      const redeem2Res = await birthdayRouter.request(
        'http://localhost/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: 'cust-2d' }),
        },
        env
      );
      expect(redeem2Res.status).toBe(201);
    });

    it('rejects cancelled, failed, or expired orders on POST /redeem and blocks customer claims on anonymous orders', async () => {
      const sqlite = setupBirthdayDb();
      const db = createSqliteD1Adapter(sqlite);
      const todayBday = formatMonthDayOffset(0);

      sqlite
        .prepare('INSERT INTO customers (id, name, phone, email, birthday, tenant_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run('cust-1', 'Customer One', '0902222333', 'c1@example.com', todayBday, 'store-a');
      sqlite
        .prepare('INSERT INTO orders (id, customer_id, customer_phone, status, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('ord-cancelled', 'cust-1', '0902222333', 'cancelled', 'store-a');
      sqlite
        .prepare('INSERT INTO orders (id, customer_id, customer_phone, status, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('ord-anon-walkin', null, null, 'completed', 'store-a');
      sqlite
        .prepare('INSERT INTO orders (id, customer_id, customer_phone, status, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('ord-owned', 'cust-1', '0902222333', 'completed', 'store-a');

      const custToken = await generateJWT(
        { id: 'cust-1', name: 'Customer One', role: 'customer', email: 'c1@example.com', tenantId: 'store-a' },
        TEST_JWT_SECRET,
        3600
      );
      const env = createMockEnv({ AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET });

      // 1. Cancelled order is rejected with 400
      const cancelledRes = await birthdayRouter.request(
        'http://localhost/redeem',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${custToken}`,
          },
          body: JSON.stringify({ customer_id: 'cust-1', order_id: 'ord-cancelled' }),
        },
        env
      );
      expect(cancelledRes.status).toBe(400);

      // 2. Customer role cannot claim an anonymous walk-in order (customer_id=null, customer_phone=null)
      const anonRes = await birthdayRouter.request(
        'http://localhost/redeem',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${custToken}`,
          },
          body: JSON.stringify({ customer_id: 'cust-1', order_id: 'ord-anon-walkin' }),
        },
        env
      );
      expect(anonRes.status).toBe(403);

      // 3. Customer role can redeem against their own valid order and persists tenant_id atomically
      const validRes = await birthdayRouter.request(
        'http://localhost/redeem',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${custToken}`,
          },
          body: JSON.stringify({ customer_id: 'cust-1', order_id: 'ord-owned' }),
        },
        env
      );
      expect(validRes.status).toBe(201);

      const row = sqlite
        .prepare('SELECT customer_id, order_id, tenant_id FROM birthday_redemptions WHERE customer_id = ?')
        .get('cust-1') as { customer_id: string; order_id: string; tenant_id: string } | undefined;
      expect(row).toEqual({
        customer_id: 'cust-1',
        order_id: 'ord-owned',
        tenant_id: 'store-a',
      });
    });

    it('enforces positive RBAC allowlist on PUT /config and POST /redeem', async () => {
      const sqlite = setupBirthdayDb();
      const db = createSqliteD1Adapter(sqlite);
      const env = createMockEnv({ AURA_DB: db, JWT_SECRET: '' });

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'u-driver', role: 'driver', tenantId: 'default' } as never);
        await next();
      });
      app.route('/birthday', birthdayRouter);

      const configRes = await app.request(
        'http://localhost/birthday/config',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discountPercent: 20 }),
        },
        env
      );
      expect(configRes.status).toBe(403);

      const redeemRes = await app.request(
        'http://localhost/birthday/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: 'cust-any' }),
        },
        env
      );
      expect(redeemRes.status).toBe(403);
    });
  });

  describe('POS Customer Lookup (/api/pos/customer)', () => {
    it('scopes cashback_wallets JOIN by tenant_id and filters visit_count by order status and customer_id/phone', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'default',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT,
          loyalty_tier TEXT DEFAULT 'gold',
          loyalty_points INTEGER DEFAULT 250,
          lifetime_points INTEGER DEFAULT 600,
          created_at TEXT DEFAULT '2026-01-01T00:00:00Z',
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE cashback_wallets (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          balance INTEGER DEFAULT 0,
          total_earned INTEGER DEFAULT 0,
          total_spent INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          customer_phone TEXT,
          status TEXT DEFAULT 'completed',
          tenant_id TEXT DEFAULT 'default'
        );
      `);

      sqlite.prepare('INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES (?, ?, ?, ?, 1, 1)')
        .run('staff-a', 'Cashier A', 'cashier', 'store-a');

      sqlite.prepare('INSERT INTO customers (id, name, phone, email, loyalty_tier, loyalty_points, lifetime_points, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run('cust-pos-1', 'Tran Thi B', '0912345678', 'b@example.com', 'gold', 250, 600, 'store-a');

      // Foreign tenant wallet with large balance must NOT leak into store-a lookup
      sqlite.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run('wal-foreign', 'cust-pos-1', 999000, 999000, 0, 'store-b');
      sqlite.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run('wal-own', 'cust-pos-1', 45000, 80000, 35000, 'store-a');

      // Orders:
      // 1. Valid order by phone in store-a
      sqlite.prepare('INSERT INTO orders (id, customer_id, customer_phone, status, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('o-1', null, '0912345678', 'completed', 'store-a');
      // 2. Valid order by customer_id only (no phone) in store-a
      sqlite.prepare('INSERT INTO orders (id, customer_id, customer_phone, status, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('o-2', 'cust-pos-1', null, 'confirmed', 'store-a');
      // 3. Cancelled order in store-a (must be excluded)
      sqlite.prepare('INSERT INTO orders (id, customer_id, customer_phone, status, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('o-3', 'cust-pos-1', '0912345678', 'cancelled', 'store-a');
      // 4. Failed order in store-a (must be excluded)
      sqlite.prepare('INSERT INTO orders (id, customer_id, customer_phone, status, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('o-4', 'cust-pos-1', '0912345678', 'failed', 'store-a');
      // 5. Completed order in foreign tenant store-b (must be excluded)
      sqlite.prepare('INSERT INTO orders (id, customer_id, customer_phone, status, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('o-5', 'cust-pos-1', '0912345678', 'completed', 'store-b');

      const db = createSqliteD1Adapter(sqlite);
      const env = createMockEnv({ AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET });
      const staffAccount = sqlite.prepare("SELECT * FROM users WHERE id = 'staff-a'").get() as any;
      const { token } = await issueStaffSession(env, staffAccount, { sessionType: 'staff-web' });

      const res = await posCustomerRouter.request(
        'http://localhost/?phone=0912345678',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        found: boolean;
        customer: {
          cashback_balance: number;
          total_earned: number;
          total_spent: number;
          visit_count: number;
        };
      };
      expect(body.found).toBe(true);
      expect(body.customer.cashback_balance).toBe(45000);
      expect(body.customer.total_earned).toBe(80000);
      expect(body.customer.total_spent).toBe(35000);
      expect(body.customer.visit_count).toBe(2);
    });
  });

  describe('Admin QR & QR Generator (/api/admin/qr)', () => {
    it('scopes table_qr_codes prefetch in bulkGenerateSlugs and resolves colliding tenant slugs via joined lookup', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'default',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1
        );
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number TEXT NOT NULL,
          zone TEXT DEFAULT 'indoor',
          capacity INTEGER DEFAULT 4,
          status TEXT DEFAULT 'Available',
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE table_qr_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_id TEXT UNIQUE,
          slug TEXT,
          updated_at TEXT
        );
      `);

      sqlite.prepare('INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES (?, ?, ?, ?, 1, 1)')
        .run('mgr-b', 'Manager B', 'manager', 'store-b');
      sqlite.prepare('INSERT INTO cafe_tables (id, table_number, zone, status, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('tbl-a-1', 'T01', 'indoor', 'Available', 'store-a');
      sqlite.prepare('INSERT INTO cafe_tables (id, table_number, zone, status, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .run('tbl-b-1', 'T01', 'indoor', 'Available', 'store-b');

      // Both tenants have colliding slug 'shared-t01' in table_qr_codes
      sqlite.prepare('INSERT INTO table_qr_codes (table_id, slug) VALUES (?, ?)').run('tbl-a-1', 'shared-t01');
      sqlite.prepare('INSERT INTO table_qr_codes (table_id, slug) VALUES (?, ?)').run('tbl-b-1', 'shared-t01');
      sqlite.prepare('INSERT INTO table_qr_codes (table_id, slug) VALUES (?, ?)').run('tbl-a-only', 'only-store-a');

      const db = createSqliteD1Adapter(sqlite);
      const env = createMockEnv({
        AURA_DB: db,
        JWT_SECRET: TEST_JWT_SECRET,
        QR_SIGNING_SECRET: TEST_QR_SECRET,
      });
      const mgrAccount = sqlite.prepare("SELECT * FROM users WHERE id = 'mgr-b'").get() as any;
      const { token: tokenB } = await issueStaffSession(env, mgrAccount, { sessionType: 'staff-web' });

      // 1. Store B downloading colliding slug 'shared-t01' resolves tbl-b-1 (200) instead of failing on tbl-a-1
      const dlRes = await adminQRRouter.request(
        'http://localhost/shared-t01/download',
        { headers: { Authorization: `Bearer ${tokenB}` } },
        env
      );
      expect(dlRes.status).toBe(200);
      expect(dlRes.headers.get('X-Table-ID')).toBe('tbl-b-1');

      const pngRes = await adminQRRouter.request(
        'http://localhost/shared-t01/png',
        { headers: { Authorization: `Bearer ${tokenB}` } },
        env
      );
      expect(pngRes.status).toBe(200);
      expect(pngRes.headers.get('X-Table-ID')).toBe('tbl-b-1');

      // 2. Store B requesting foreign slug 'only-store-a' gets 404
      const foreignRes = await adminQRRouter.request(
        'http://localhost/only-store-a/download',
        { headers: { Authorization: `Bearer ${tokenB}` } },
        env
      );
      expect(foreignRes.status).toBe(404);

      // 3. bulkGenerateSlugs scopes its prefetch query with WHERE table_id IN (...)
      const capturedSql: string[] = [];
      const spyDb = {
        ...db,
        prepare: (sql: string) => {
          capturedSql.push(sql);
          return db.prepare(sql);
        },
      } as unknown as D1Database;

      await bulkGenerateSlugs(spyDb, [
        { id: 'tbl-b-1', table_number: 'T01', zone: 'indoor', capacity: 4, status: 'Available' } as any,
      ]);
      expect(capturedSql.some((s) => /SELECT table_id, slug FROM table_qr_codes WHERE table_id IN/i.test(s))).toBe(true);
    });
  });

  describe('Signage Routes (/api/signage/menu & /api/signage/promos)', () => {
    it('filters out products linked to foreign-tenant categories and supports middle fallback when c.tenant_id is absent', async () => {
      // Case 1: categories has tenant_id — foreign category product is excluded
      const sqliteWithCatTenant = new DatabaseSync(':memory:');
      sqliteWithCatTenant.exec(`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          sort_order INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          price INTEGER NOT NULL,
          image_url TEXT,
          description TEXT,
          category_id INTEGER NOT NULL,
          is_available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqliteWithCatTenant.prepare('INSERT INTO categories (id, name, sort_order, tenant_id) VALUES (?, ?, ?, ?)')
        .run(1, 'Own Category', 1, 'store-a');
      sqliteWithCatTenant.prepare('INSERT INTO categories (id, name, sort_order, tenant_id) VALUES (?, ?, ?, ?)')
        .run(2, 'Foreign Category', 2, 'store-b');
      sqliteWithCatTenant.prepare('INSERT INTO products (id, name, price, category_id, is_available, tenant_id) VALUES (?, ?, ?, ?, 1, ?)')
        .run(10, 'Espresso Store A', 45000, 1, 'store-a');
      sqliteWithCatTenant.prepare('INSERT INTO products (id, name, price, category_id, is_available, tenant_id) VALUES (?, ?, ?, ?, 1, ?)')
        .run(11, 'Mismatched Cat Product', 55000, 2, 'store-a');

      const envWithCatTenant = createMockEnv({
        AURA_DB: createSqliteD1Adapter(sqliteWithCatTenant),
        PILOT_TENANT_ID: 'store-a',
      } as Partial<Env>);

      const menuRes1 = await signageRouter.request('http://localhost/menu', {}, envWithCatTenant);
      expect(menuRes1.status).toBe(200);
      const menuJson1 = (await menuRes1.json()) as { data: Array<{ name: string; products: Array<{ name: string }> }> };
      expect(menuJson1.data).toHaveLength(1);
      expect(menuJson1.data[0].name).toBe('Own Category');
      expect(menuJson1.data[0].products.map((p) => p.name)).toEqual(['Espresso Store A']);

      // Case 2: categories table lacks tenant_id, but named tenant 'store-a' still receives its products via middle fallback
      const sqliteNoCatTenant = new DatabaseSync(':memory:');
      sqliteNoCatTenant.exec(`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          sort_order INTEGER DEFAULT 1
        );
        CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          price INTEGER NOT NULL,
          image_url TEXT,
          description TEXT,
          category_id INTEGER NOT NULL,
          is_available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqliteNoCatTenant.prepare('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)').run(1, 'Shared Category', 1);
      sqliteNoCatTenant.prepare('INSERT INTO products (id, name, price, category_id, is_available, tenant_id) VALUES (?, ?, ?, ?, 1, ?)')
        .run(20, 'Latte Store A', 50000, 1, 'store-a');
      sqliteNoCatTenant.prepare('INSERT INTO products (id, name, price, category_id, is_available, tenant_id) VALUES (?, ?, ?, ?, 1, ?)')
        .run(21, 'Latte Store B', 50000, 1, 'store-b');

      const envNoCatTenant = createMockEnv({
        AURA_DB: createSqliteD1Adapter(sqliteNoCatTenant),
        PILOT_TENANT_ID: 'store-a',
      } as Partial<Env>);

      const menuRes2 = await signageRouter.request('http://localhost/menu', {}, envNoCatTenant);
      expect(menuRes2.status).toBe(200);
      const menuJson2 = (await menuRes2.json()) as { data: Array<{ name: string; products: Array<{ name: string }> }> };
      expect(menuJson2.data).toHaveLength(1);
      expect(menuJson2.data[0].products.map((p) => p.name)).toEqual(['Latte Store A']);
    });

    it('excludes exhausted promotions and normalizes OpenAPI promotion columns on GET /api/signage/promos', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE promotions (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          percent INTEGER,
          discount_value INTEGER,
          value INTEGER,
          max_discount INTEGER,
          max_discount_value INTEGER,
          min_order INTEGER,
          min_order_value INTEGER,
          max_uses INTEGER,
          usage_limit INTEGER,
          used_count INTEGER DEFAULT 0,
          starts_at TEXT,
          expires_at TEXT,
          valid_from TEXT,
          valid_to TEXT,
          end_date TEXT,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
      `);

      // 1. OpenAPI-created active promotion (uses discount_value, max_discount_value, min_order_value, valid_to, max_uses)
      sqlite.prepare(`
        INSERT INTO promotions (id, code, discount_value, max_discount_value, min_order_value, max_uses, used_count, valid_to, is_active, tenant_id)
        VALUES ('p1', 'OPENAPI25', 25, 40000, 120000, 10, 3, '2099-12-31T23:59:59Z', 1, 'store-a')
      `).run();

      // 2. Exhausted via max_uses (used_count = 5 >= max_uses = 5)
      sqlite.prepare(`
        INSERT INTO promotions (id, code, discount_value, max_discount_value, min_order_value, max_uses, used_count, valid_to, is_active, tenant_id)
        VALUES ('p2', 'EXHAUSTED_MAX', 30, 50000, 100000, 5, 5, '2099-12-31T23:59:59Z', 1, 'store-a')
      `).run();

      // 3. Exhausted via usage_limit (used_count = 10 >= usage_limit = 10)
      sqlite.prepare(`
        INSERT INTO promotions (id, code, percent, max_discount, min_order, usage_limit, used_count, expires_at, is_active, tenant_id)
        VALUES ('p3', 'EXHAUSTED_LIMIT', 15, 20000, 50000, 10, 10, '2099-12-31T23:59:59Z', 1, 'store-a')
      `).run();

      const env = createMockEnv({
        AURA_DB: createSqliteD1Adapter(sqlite),
        PILOT_TENANT_ID: 'store-a',
      } as Partial<Env>);

      const res = await signageRouter.request('http://localhost/promos', {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: Array<{ code: string; percent: number; max_discount: number; min_order: number; expires_at: string }>;
      };
      expect(body.success).toBe(true);
      expect(body.data).toEqual([
        {
          code: 'OPENAPI25',
          percent: 25,
          max_discount: 40000,
          min_order: 120000,
          expires_at: '2099-12-31T23:59:59Z',
        },
      ]);
    });
  });
});
