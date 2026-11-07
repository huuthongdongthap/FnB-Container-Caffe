// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { staffTipsRouter } from '../../../../packages/domain/staff/commands/staff-tips';
import { registerStaffHandlers } from '../../routes/openapi-staff-handlers/staff-handlers';
import { getTablesMobile, updateTableStatus } from '../../routes/tables-mobile';
import { getOrdersMobile, getOrderDetail } from '../../routes/orders-mobile';
import { demandForecastRouter } from '../../routes/demand-forecast';
import { inventoryForecastingRouter } from '../../routes/inventory-forecasting';
import { inventoryTransactions } from '../../../../packages/domain/inventory/src/routes/inventory-transactions';
import { deductInventoryForOrder, restoreInventoryForOrder } from '../../../../packages/domain/inventory/src/routes/order-deduction';
import { purchasing } from '../../../../packages/domain/inventory/src/routes/purchasing';
import {
  createCanonicalPurchaseOrder,
  receivePurchaseOrder,
} from '../../../../packages/domain/inventory/src/policies/purchasing-receiving-policy';
import {
  getCanonicalRecipe,
  deductOrderStock,
} from '../../../../packages/domain/inventory/src/policies/inventory-recipe-policy';
import { generateJWT, hashPassword } from '../../lib/jwt';
import { createMockEnv, mockStaffToken, TEST_JWT_SECRET } from '../test-utils';

function createSqliteD1(sqlite: DatabaseSync, failPredicates: Array<(sql: string) => boolean> = []) {
  const executedSql: string[] = [];
  const normalizeParams = (vals: unknown[]) =>
    vals.map((v) => (v === undefined ? null : (v as string | number | bigint | null)));
  const makeStmt = (sql: string, boundValues: unknown[] = []) => ({
    bind(...values: unknown[]) {
      return makeStmt(sql, values);
    },
    async first<T = Record<string, unknown>>(): Promise<T | null> {
      executedSql.push(sql);
      if (failPredicates.some((fn) => fn(sql))) {
        throw new Error('Simulated D1 statement failure');
      }
      const row = sqlite.prepare(sql).get(...normalizeParams(boundValues)) as T | undefined;
      return row ? ({ ...(row as Record<string, unknown>) } as T) : null;
    },
    async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
      executedSql.push(sql);
      if (failPredicates.some((fn) => fn(sql))) {
        throw new Error('Simulated D1 statement failure');
      }
      const raw = sqlite.prepare(sql).all(...normalizeParams(boundValues)) as Array<Record<string, unknown>>;
      const results = raw.map((r) => ({ ...r }) as T);
      return { results, success: true };
    },
    async run(): Promise<{ success: boolean; meta: { changes: number } }> {
      executedSql.push(sql);
      if (failPredicates.some((fn) => fn(sql))) {
        throw new Error('Simulated D1 statement failure');
      }
      const info = sqlite.prepare(sql).run(...normalizeParams(boundValues));
      return { success: true, meta: { changes: Number(info.changes) } };
    },
  });

  return {
    executedSql,
    db: {
      prepare(sql: string) {
        return makeStmt(sql);
      },
      async batch(statements: Array<{ run: () => Promise<unknown> }>) {
        const results = [];
        for (const stmt of statements) {
          results.push(await stmt.run());
        }
        return results;
      },
    },
  };
}

describe('Phase 50 Slice AW2 — Staff, Tips, Mobile Tables/Orders, Inventory, Purchasing & Forecasting Security', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. staff-tips.ts hardening', () => {
    it('excludes cancelled and refunded orders in fallback queries and uses Vietnam business date (UTC+7)', async () => {
      vi.useFakeTimers();
      // 2026-11-02T18:30:00Z is 2026-11-03 01:30:00 in Asia/Ho_Chi_Minh (UTC+7)
      vi.setSystemTime(new Date('2026-11-02T18:30:00Z'));

      const sqlite = new DatabaseSync(':memory:');
      // Deliberately omit table_sessions so primary query fails and fallback query executes
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          full_name TEXT,
          username TEXT,
          phone TEXT,
          role TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          table_id TEXT,
          total REAL,
          tip_amount INTEGER,
          status TEXT,
          payment_status TEXT,
          updated_by TEXT,
          created_at TEXT,
          updated_at TEXT,
          tenant_id TEXT
        );
      `);

      sqlite.prepare(`INSERT INTO users (id, name, role, tenant_id) VALUES (?, ?, ?, ?)`).run('mgr-1', 'Manager A', 'manager', 'store-a');
      sqlite.prepare(`INSERT INTO users (id, name, role, tenant_id) VALUES (?, ?, ?, ?)`).run('stf-1', 'Waiter A', 'waiter', 'store-a');
      sqlite.prepare(`INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'ord-valid', 'T1', 120000, 15000, 'completed', 'paid', 'stf-1', '2026-11-03T01:00:00Z', '2026-11-03T01:00:00Z', 'store-a'
      );
      sqlite.prepare(`INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'ord-cancelled', 'T1', 120000, 50000, 'cancelled', 'unpaid', 'stf-1', '2026-11-03T01:10:00Z', '2026-11-03T01:10:00Z', 'store-a'
      );
      sqlite.prepare(`INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'ord-refunded', 'T1', 120000, 40000, 'completed', 'refunded', 'stf-1', '2026-11-03T01:20:00Z', '2026-11-03T01:20:00Z', 'store-a'
      );

      const { db } = createSqliteD1(sqlite);
      const token = await mockStaffToken(
        { id: 'mgr-1', sub: 'mgr-1', email: 'mgr@store-a.vn', name: 'Manager A', role: 'manager', tenantId: 'store-a', authVersion: 1 },
        TEST_JWT_SECRET
      );
      const env = { ...createMockEnv(), AURA_DB: db as unknown as Env['AURA_DB'] };

      const res = await staffTipsRouter.fetch(
        new Request('https://test.aura/', {
          headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'store-a' },
        }),
        env
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { summary: { date: string; tip_total: number }; data: Array<{ tip_total: number }> };
      expect(body.summary.date).toBe('2026-11-03');
      expect(body.summary.tip_total).toBe(15000);
    });

    it('rejects positive tip_amount on zero/non-positive order totals and blocks unscoped fallback for non-default tenants', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          role TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          total REAL,
          tip_amount INTEGER DEFAULT 0,
          status TEXT,
          payment_status TEXT,
          updated_by TEXT,
          updated_at TEXT,
          tenant_id TEXT
        );
      `);
      sqlite.prepare(`INSERT INTO users (id, name, role, tenant_id) VALUES (?, ?, ?, ?)`).run('cash-1', 'Cashier A', 'cashier', 'store-a');
      sqlite.prepare(`INSERT INTO users (id, name, role, tenant_id) VALUES (?, ?, ?, ?)`).run('waiter-1', 'Waiter A', 'waiter', 'store-a');
      sqlite.prepare(`INSERT INTO orders (id, total, status, payment_status, tenant_id) VALUES (?, ?, ?, ?, ?)`).run(
        'ord-zero', 0, 'completed', 'paid', 'store-a'
      );
      sqlite.prepare(`INSERT INTO orders (id, total, status, payment_status, tenant_id) VALUES (?, ?, ?, ?, ?)`).run(
        'ord-pos', 100000, 'completed', 'paid', 'store-a'
      );

      const { db } = createSqliteD1(sqlite);
      const token = await mockStaffToken(
        { id: 'cash-1', sub: 'cash-1', email: 'cashier@store-a.vn', name: 'Cashier A', role: 'cashier', tenantId: 'store-a', authVersion: 1 },
        TEST_JWT_SECRET
      );
      const env = { ...createMockEnv(), AURA_DB: db as unknown as Env['AURA_DB'] };

      const zeroOrderTipRes = await staffTipsRouter.fetch(
        new Request('https://test.aura/assign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Tenant-ID': 'store-a',
          },
          body: JSON.stringify({ order_id: 'ord-zero', staff_id: 'waiter-1', tip_amount: 50000 }),
        }),
        env
      );
      expect(zeroOrderTipRes.status).toBe(400);

      const validTipRes = await staffTipsRouter.fetch(
        new Request('https://test.aura/assign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Tenant-ID': 'store-a',
          },
          body: JSON.stringify({ order_id: 'ord-pos', staff_id: 'waiter-1', tip_amount: 20000 }),
        }),
        env
      );
      expect(validTipRes.status).toBe(200);
    });
  });

  describe('2. staff-handlers.ts hardening', () => {
    it('masks email and phone of other staff members for supervisor on GET /staff and GET /staff/:id while preserving supervisor own PII and manager access', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          locale TEXT DEFAULT 'vi',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          avatar_url TEXT,
          hire_date TEXT,
          created_at TEXT,
          updated_at TEXT,
          tenant_id TEXT DEFAULT 'store-a'
        );
        CREATE TABLE staff_shifts (
          id TEXT PRIMARY KEY,
          staff_id TEXT,
          date TEXT,
          start_time TEXT,
          end_time TEXT,
          clock_in TEXT,
          clock_out TEXT,
          attendance_state TEXT,
          status TEXT,
          tenant_id TEXT DEFAULT 'store-a'
        );
      `);
      sqlite.prepare(
        `INSERT INTO users (id, name, email, phone, role, is_active, auth_version, created_at, updated_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, 1, 1, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', 'store-a')`
      ).run('mgr-1', 'Manager One', 'mgr1@store-a.vn', '0900000001', 'manager');
      sqlite.prepare(
        `INSERT INTO users (id, name, email, phone, role, is_active, auth_version, created_at, updated_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, 1, 1, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', 'store-a')`
      ).run('sup-1', 'Supervisor One', 'sup1@store-a.vn', '0901111111', 'supervisor');
      sqlite.prepare(
        `INSERT INTO users (id, name, email, phone, role, is_active, auth_version, created_at, updated_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, 1, 1, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', 'store-a')`
      ).run('waiter-2', 'Waiter Two', 'waiter2@store-a.vn', '0902222222', 'waiter');

      const { db } = createSqliteD1(sqlite);
      const env = { ...createMockEnv(), AURA_DB: db as unknown as Env['AURA_DB'] };

      const supApp = new OpenAPIHono<{ Bindings: Env }>();
      supApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'sup-1', role: 'supervisor', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerStaffHandlers(supApp);

      const listRes = await supApp.fetch(new Request('https://test.aura/api/staff?page=1&limit=20'), env);
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as { data: { staff: Array<Record<string, unknown>> } };
      const ownEntry = listBody.data.staff.find((s) => s.id === 'sup-1')!;
      const otherEntry = listBody.data.staff.find((s) => s.id === 'waiter-2')!;
      expect(ownEntry.email).toBe('sup1@store-a.vn');
      expect(ownEntry.phone).toBe('0901111111');
      expect(otherEntry.email).toBeNull();
      expect(otherEntry.phone).toBeNull();

      const detailRes = await supApp.fetch(new Request('https://test.aura/api/staff/waiter-2'), env);
      expect(detailRes.status).toBe(200);
      const detailBody = (await detailRes.json()) as { data: Record<string, unknown> };
      expect(detailBody.data.email).toBeNull();
      expect(detailBody.data.phone).toBeNull();

      // Manager still sees full PII
      const mgrApp = new OpenAPIHono<{ Bindings: Env }>();
      mgrApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-1', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerStaffHandlers(mgrApp);
      const mgrDetailRes = await mgrApp.fetch(new Request('https://test.aura/api/staff/waiter-2'), env);
      expect(mgrDetailRes.status).toBe(200);
      const mgrDetailBody = (await mgrDetailRes.json()) as { data: Record<string, unknown> };
      expect(mgrDetailBody.data.email).toBe('waiter2@store-a.vn');
      expect(mgrDetailBody.data.phone).toBe('0902222222');
    });

    it('gates unscoped staff_users fallback updates on default tenant', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          locale TEXT DEFAULT 'vi',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          avatar_url TEXT,
          hire_date TEXT,
          created_at TEXT,
          updated_at TEXT,
          tenant_id TEXT DEFAULT 'store-a'
        );
        CREATE TABLE staff_users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          is_active INTEGER DEFAULT 1,
          updated_at TEXT,
          tenant_id TEXT DEFAULT 'store-b'
        );
      `);
      const pw = await hashPassword('Secret123!');
      void pw;
      sqlite.prepare(
        `INSERT INTO users (id, name, email, phone, role, is_active, auth_version, created_at, updated_at, tenant_id)
         VALUES ('owner-a', 'Owner A', 'owner@store-a.vn', '0900000000', 'owner', 1, 1, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', 'store-a')`
      ).run();
      sqlite.prepare(
        `INSERT INTO users (id, name, email, phone, role, is_active, auth_version, created_at, updated_at, tenant_id)
         VALUES ('stf-shared', 'Staff A', 'a@store-a.vn', '0903333333', 'waiter', 1, 1, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', 'store-a')`
      ).run();
      sqlite.prepare(
        `INSERT INTO staff_users (id, name, email, phone, role, is_active, updated_at, tenant_id)
         VALUES ('stf-shared', 'Staff B Untouched', 'b@store-b.vn', '0904444444', 'waiter', 1, '2026-10-01T00:00:00Z', 'store-b')`
      ).run();

      // Simulate scoped UPDATE staff_users failing so the catch block is exercised
      const { db } = createSqliteD1(sqlite, [
        (sql) => sql.includes('UPDATE staff_users') && sql.includes('COALESCE(NULLIF(TRIM(tenant_id)'),
      ]);
      const env = { ...createMockEnv(), AURA_DB: db as unknown as Env['AURA_DB'] };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'owner-a', role: 'owner', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerStaffHandlers(app);

      const patchRes = await app.fetch(
        new Request('https://test.aura/api/staff/stf-shared', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Renamed In Store A' }),
        }),
        env
      );
      expect(patchRes.status).toBe(200);

      const storeBStaffUser = sqlite.prepare('SELECT name, is_active FROM staff_users WHERE id = ?').get('stf-shared') as {
        name: string;
        is_active: number;
      };
      expect(storeBStaffUser.name).toBe('Staff B Untouched');
    });
  });

  describe('3. tables-mobile.ts hardening', () => {
    it('blocks releasing a table to free/available with 409 when an active unpaid order exists and allows once paid', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number INTEGER,
          name TEXT,
          capacity INTEGER DEFAULT 4,
          status TEXT DEFAULT 'Occupied',
          current_order_id TEXT,
          tenant_id TEXT DEFAULT 'store-a'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          table_id TEXT,
          status TEXT,
          payment_status TEXT,
          tenant_id TEXT DEFAULT 'store-a'
        );
      `);
      sqlite.prepare(`INSERT INTO cafe_tables VALUES ('tbl-1', 1, 'Bàn 1', 4, 'Occupied', 'ord-active', 'store-a')`).run();
      sqlite.prepare(`INSERT INTO orders VALUES ('ord-active', 'tbl-1', 'preparing', 'unpaid', 'store-a')`).run();

      const { db } = createSqliteD1(sqlite);
      const env = { ...createMockEnv(), AURA_DB: db as unknown as Env['AURA_DB'] };
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'w-1', role: 'waiter', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      app.get('/mobile/tables', getTablesMobile);
      app.patch('/mobile/tables/:id', updateTableStatus);

      const conflictRes = await app.fetch(
        new Request('https://test.aura/mobile/tables/tbl-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'available' }),
        }),
        env
      );
      expect(conflictRes.status).toBe(409);

      // Mark order paid -> table release via 'available' succeeds and normalizes to 'free'
      sqlite.prepare(`UPDATE orders SET payment_status = 'paid', status = 'completed' WHERE id = 'ord-active'`).run();
      const okRes = await app.fetch(
        new Request('https://test.aura/mobile/tables/tbl-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'available' }),
        }),
        env
      );
      expect(okRes.status).toBe(200);
      const okBody = (await okRes.json()) as { table: { status: string; current_order_id: string | null } };
      expect(okBody.table.status).toBe('free');
      expect(okBody.table.current_order_id).toBeNull();
    });
  });

  describe('4. orders-mobile.ts hardening', () => {
    it('masks customer PII for waiter, staff, and cashier while preserving PII for manager and shipper, and normalizes whitespace tenant_id', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          table_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          customer_email TEXT,
          delivery_address TEXT,
          items TEXT,
          status TEXT,
          created_at TEXT,
          updated_at TEXT,
          tenant_id TEXT
        );
      `);
      sqlite.prepare(`INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'ord-mob-1',
        'tbl-1',
        'Nguyen Van Khach',
        '0987654321',
        'khach@example.com',
        '456 Le Loi, Q1',
        JSON.stringify([{ name: 'Cà phê đen', qty: 1, price: 30000 }]),
        'pending',
        '2026-11-03T02:00:00Z',
        '2026-11-03T02:00:00Z',
        '  store-a  '
      );

      const { db } = createSqliteD1(sqlite);
      const env = { ...createMockEnv(), AURA_DB: db as unknown as Env['AURA_DB'] };

      for (const maskedRole of ['waiter', 'staff', 'cashier', 'kitchen', 'barista', 'chef']) {
        const app = new Hono<{ Bindings: Env }>();
        app.use('*', async (c, next) => {
          c.set('user' as never, { id: `u-${maskedRole}`, role: maskedRole, tenantId: 'store-a' } as never);
          c.set('tenantId' as never, 'store-a' as never);
          await next();
        });
        app.get('/mobile/orders', getOrdersMobile);
        app.get('/mobile/orders/:id', getOrderDetail);

        const listRes = await app.fetch(new Request('https://test.aura/mobile/orders'), env);
        expect(listRes.status).toBe(200);
        const listBody = (await listRes.json()) as { orders: Array<Record<string, unknown>> };
        expect(listBody.orders).toHaveLength(1);
        expect(listBody.orders[0].customer_phone).toBeNull();
        expect(listBody.orders[0].customer_email).toBeNull();
        expect(listBody.orders[0].delivery_address).toBeNull();

        const detailRes = await app.fetch(new Request('https://test.aura/mobile/orders/ord-mob-1'), env);
        expect(detailRes.status).toBe(200);
        const detailBody = (await detailRes.json()) as { order: Record<string, unknown> };
        expect(detailBody.order.customer_phone).toBeNull();
        expect(detailBody.order.customer_email).toBeNull();
        expect(detailBody.order.delivery_address).toBeNull();
      }

      for (const unmaskedRole of ['manager', 'shipper', 'owner', 'supervisor', 'admin']) {
        const app = new Hono<{ Bindings: Env }>();
        app.use('*', async (c, next) => {
          c.set('user' as never, { id: `u-${unmaskedRole}`, role: unmaskedRole, tenantId: 'store-a' } as never);
          c.set('tenantId' as never, 'store-a' as never);
          await next();
        });
        app.get('/mobile/orders/:id', getOrderDetail);

        const detailRes = await app.fetch(new Request('https://test.aura/mobile/orders/ord-mob-1'), env);
        expect(detailRes.status).toBe(200);
        const detailBody = (await detailRes.json()) as { order: Record<string, unknown> };
        expect(detailBody.order.customer_phone).toBe('0987654321');
        expect(detailBody.order.customer_email).toBe('khach@example.com');
        expect(detailBody.order.delivery_address).toBe('456 Le Loi, Q1');
      }
    });
  });

  describe('5. demand-forecast.ts & inventory-forecasting.ts hardening', () => {
    it('excludes refunded orders and buckets morning rush in Vietnam local time (UTC+7)', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          role TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'store-a'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          total REAL,
          status TEXT,
          payment_status TEXT,
          created_at TEXT,
          tenant_id TEXT DEFAULT 'store-a'
        );
      `);
      sqlite.prepare(`INSERT INTO users VALUES ('mgr-1', 'Manager', '0901111111', 'manager', 1, 1, 'store-a')`).run();
      // 01:15 UTC = 08:15 UTC+7 (Vietnam morning rush 07:00-09:59)
      const recentMorningUtc = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 11) + '01:15:00Z';
      sqlite.prepare(`INSERT INTO orders VALUES ('ord-paid-1', 100000, 'completed', 'paid', ?, 'store-a')`).run(recentMorningUtc);
      sqlite.prepare(`INSERT INTO orders VALUES ('ord-ref-1', 500000, 'refunded', 'refunded', ?, 'store-a')`).run(recentMorningUtc);
      sqlite.prepare(`INSERT INTO orders VALUES ('ord-ref-2', 500000, 'completed', 'refunded', ?, 'store-a')`).run(recentMorningUtc);

      const { db } = createSqliteD1(sqlite);
      const token = await mockStaffToken(
        { id: 'mgr-1', sub: 'mgr-1', email: 'mgr@store-a.vn', name: 'Manager', role: 'manager', tenantId: 'store-a', authVersion: 1 },
        TEST_JWT_SECRET
      );
      const env = { ...createMockEnv(), AURA_DB: db as unknown as Env['AURA_DB'] };

      const forecastRes = await demandForecastRouter.fetch(
        new Request('https://test.aura/forecast?days=3', {
          headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'store-a' },
        }),
        env
      );
      expect(forecastRes.status).toBe(200);
      const forecastBody = (await forecastRes.json()) as {
        data: {
          historical_sample_orders: number;
          peak_windows: { morning_rush: { share_percentage: number } };
        };
      };
      expect(forecastBody.data.historical_sample_orders).toBe(1);
      expect(forecastBody.data.peak_windows.morning_rush.share_percentage).toBe(100);

      const hourlyRes = await demandForecastRouter.fetch(
        new Request('https://test.aura/forecast/hourly', {
          headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'store-a' },
        }),
        env
      );
      expect(hourlyRes.status).toBe(200);
      const hourlyBody = (await hourlyRes.json()) as { data: { hourly_distribution: Record<string, number> } };
      expect(hourlyBody.data.hourly_distribution['08']).toBe(1);
      expect(hourlyBody.data.hourly_distribution['01']).toBe(0);
    });

    it('gates unscoped depletion fallback on default tenant and enforces fail-closed tenant check on POST /snapshot', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          role TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT
        );
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY,
          sku TEXT,
          name TEXT,
          current_stock REAL,
          min_stock REAL,
          max_stock REAL,
          unit TEXT,
          active INTEGER DEFAULT 1,
          tenant_id TEXT
        );
        CREATE TABLE stock_movements (
          id TEXT PRIMARY KEY,
          ingredient_id TEXT,
          type TEXT,
          quantity REAL,
          created_at TEXT,
          tenant_id TEXT
        );
      `);
      sqlite.prepare(`INSERT INTO users VALUES ('mgr-a', 'Manager A', '0901111111', 'manager', 1, 1, 'store-a')`).run();
      sqlite.prepare(`INSERT INTO inventory_items VALUES ('ing-shared', 'SKU-1', 'Coffee Beans', 20, 5, 50, 'kg', 1, 'store-a')`).run();
      sqlite.prepare(`INSERT INTO stock_movements VALUES ('mov-b', 'ing-shared', 'consumption', -14, ?, 'store-b')`).run(
        new Date(Date.now() - 86400000).toISOString()
      );

      // Force tenant-scoped stock_movements query to fail so catch block is tested
      const { db } = createSqliteD1(sqlite, [
        (sql) => sql.includes('FROM stock_movements') && sql.includes('COALESCE(NULLIF(TRIM(tenant_id)'),
      ]);
      const token = await mockStaffToken(
        { id: 'mgr-a', sub: 'mgr-a', email: 'mgr@store-a.vn', name: 'Manager A', role: 'manager', tenantId: 'store-a', authVersion: 1 },
        TEST_JWT_SECRET
      );
      const env = { ...createMockEnv(), AURA_DB: db as unknown as Env['AURA_DB'] };

      const runRateRes = await inventoryForecastingRouter.fetch(
        new Request('https://test.aura/run-rate?days=7', {
          headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'store-a' },
        }),
        env
      );
      expect(runRateRes.status).toBe(200);
      const runRateBody = (await runRateRes.json()) as { data: Array<{ daily_run_rate: number }> };
      expect(runRateBody.data[0].daily_run_rate).toBe(0);

      // Cross-tenant query override on POST /snapshot is rejected with 403
      const crossTenantSnapRes = await inventoryForecastingRouter.fetch(
        new Request('https://test.aura/snapshot?tenant_id=store-b', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'store-a' },
        }),
        env
      );
      expect(crossTenantSnapRes.status).toBe(403);
    });
  });

  describe('6. inventory-transactions.ts, order-deduction.ts, purchasing & recipe policy hardening', () => {
    it('enforces fail-closed RBAC and cross-tenant confinement on POST /:id/transactions', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY,
          sku TEXT,
          name TEXT,
          current_stock REAL,
          unit TEXT,
          min_stock REAL,
          active INTEGER DEFAULT 1,
          updated_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE inventory_transactions (
          id TEXT PRIMARY KEY,
          item_id TEXT,
          type TEXT,
          quantity REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          tenant_id TEXT
        );
      `);
      sqlite.prepare(`INSERT INTO inventory_items VALUES ('item-a', 'SKU-A', 'Milk', 10, 'L', 2, 1, '', 'store-a')`).run();

      const { db } = createSqliteD1(sqlite);
      const env = { AURA_DB: db as never };

      // 1. Missing user role -> 403
      const unauthApp = new Hono<{ Bindings: typeof env }>();
      inventoryTransactions(unauthApp as never);
      const unauthRes = await unauthApp.fetch(
        new Request('https://test.aura/item-a/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'in', quantity: 5 }),
        }),
        env
      );
      expect(unauthRes.status).toBe(403);

      // 2. Cross-tenant user -> 403
      const crossApp = new Hono<{ Bindings: typeof env }>();
      crossApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-b', role: 'manager', tenantId: 'store-b' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      inventoryTransactions(crossApp as never);
      const crossRes = await crossApp.fetch(
        new Request('https://test.aura/item-a/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'in', quantity: 5 }),
        }),
        env
      );
      expect(crossRes.status).toBe(403);
    });

    it('prevents duplicate stock deduction across repeated deductInventoryForOrder calls and gates unscoped restore/recipe fallbacks', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          tenant_id TEXT
        );
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY,
          name TEXT,
          current_stock REAL,
          unit TEXT,
          cost_per_unit REAL DEFAULT 100,
          updated_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE stock_movements (
          id TEXT PRIMARY KEY,
          ingredient_id TEXT,
          type TEXT,
          quantity REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          created_at TEXT,
          tenant_id TEXT
        );
      `);
      sqlite.prepare(`INSERT INTO orders VALUES ('ord-deduct-1', 'store-a')`).run();
      sqlite.prepare(`INSERT INTO ingredients VALUES ('ing-match', 'latte', 50, 'ml', 100, '', 'store-a')`).run();

      const { db } = createSqliteD1(sqlite);
      const env = { AURA_DB: db as never };

      await deductInventoryForOrder(env, 'ord-deduct-1', [{ product_id: 'ing-match', quantity: 5, name: 'latte' }], 'store-a');
      await deductInventoryForOrder(env, 'ord-deduct-1', [{ product_id: 'ing-match', quantity: 5, name: 'latte' }], 'store-a');

      const afterDeduct = sqlite.prepare(`SELECT current_stock FROM ingredients WHERE id = 'ing-match'`).get() as {
        current_stock: number;
      };
      expect(afterDeduct.current_stock).toBe(45);

      await restoreInventoryForOrder(env, 'ord-deduct-1', 'store-a');
      const afterRestore = sqlite.prepare(`SELECT current_stock FROM ingredients WHERE id = 'ing-match'`).get() as {
        current_stock: number;
      };
      expect(afterRestore.current_stock).toBe(50);
    });

    it('preserves positive ingredient cost_per_unit when receiving a zero-price PO item and gates unscoped purchasing/recipe fallbacks', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE suppliers (
          id TEXT PRIMARY KEY,
          name TEXT,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT
        );
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY,
          name TEXT,
          current_stock REAL,
          cost_per_unit REAL,
          updated_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE purchase_orders (
          id TEXT PRIMARY KEY,
          po_number TEXT,
          supplier_id TEXT,
          order_date TEXT,
          expected_delivery_date TEXT,
          status TEXT,
          subtotal REAL,
          total REAL,
          notes TEXT,
          created_by TEXT,
          created_at TEXT,
          updated_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE purchase_order_items (
          id TEXT PRIMARY KEY,
          purchase_order_id TEXT,
          ingredient_id TEXT,
          quantity REAL,
          unit_price REAL,
          total_price REAL,
          received_quantity REAL DEFAULT 0,
          tenant_id TEXT
        );
        CREATE TABLE stock_movements (
          id TEXT PRIMARY KEY,
          ingredient_id TEXT,
          type TEXT,
          quantity REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          created_by TEXT,
          created_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE recipes (
          id TEXT PRIMARY KEY,
          product_id TEXT,
          name TEXT,
          instructions TEXT,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT
        );
        CREATE TABLE recipe_items (
          id TEXT PRIMARY KEY,
          recipe_id TEXT,
          ingredient_id TEXT,
          quantity REAL,
          unit TEXT
        );
      `);
      sqlite.prepare(`INSERT INTO suppliers VALUES ('sup-a', 'Supplier A', 1, 'store-a')`).run();
      sqlite.prepare(`INSERT INTO ingredients VALUES ('ing-a', 'Matcha Powder', 10, 2500, '', 'store-a')`).run();
      sqlite.prepare(`INSERT INTO recipes VALUES ('rec-b', 'prod-shared', 'Store B Recipe', '', 1, 'store-b')`).run();
      sqlite.prepare(`INSERT INTO recipe_items VALUES ('ri-b', 'rec-b', 'ing-a', 10, 'g')`).run();

      const { db } = createSqliteD1(sqlite);

      // Create PO with unitPrice = 0 (bonus/free sample delivery)
      const po = await createCanonicalPurchaseOrder(
        db as never,
        {
          supplierId: 'sup-a',
          items: [{ ingredientId: 'ing-a', quantity: 5, unitPrice: 0 }],
          tenantId: 'store-a',
        },
        'store-a'
      );

      const receiveRes = await receivePurchaseOrder(
        db as never,
        po.id,
        [{ ingredientId: 'ing-a', receivedQuantity: 5 }],
        { receiptId: 'rcpt-zero-1', tenantId: 'store-a' }
      );
      expect(receiveRes.ok).toBe(true);

      const ingAfterZeroPo = sqlite.prepare(`SELECT current_stock, cost_per_unit FROM ingredients WHERE id = 'ing-a'`).get() as {
        current_stock: number;
        cost_per_unit: number;
      };
      expect(ingAfterZeroPo.current_stock).toBe(15);
      // Positive cost_per_unit (2500) must be preserved when PO unit_price is 0
      expect(ingAfterZeroPo.cost_per_unit).toBe(2500);

      // Non-default tenant recipe lookup must not leak store-b recipe
      const leakedRecipe = await getCanonicalRecipe(db as never, 'prod-shared', 'store-a');
      expect(leakedRecipe).toBeNull();

      // Purchasing router gates unscoped fallback for non-default tenant
      const { db: failingPurchasingDb } = createSqliteD1(sqlite, [
        (sql) => sql.includes('FROM purchase_orders') && sql.includes('COALESCE(NULLIF(TRIM(tenant_id)'),
      ]);
      const purchApp = new Hono<{ Bindings: { AURA_DB: never } }>();
      purchApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      purchasing(purchApp as never);
      const listPoRes = await purchApp.fetch(
        new Request('https://test.aura/purchase-orders'),
        { AURA_DB: failingPurchasingDb as never }
      );
      expect(listPoRes.status).toBe(200);
      const listPoBody = (await listPoRes.json()) as { data: unknown[] };
      expect(listPoBody.data).toEqual([]);

      // deductOrderStock gates unscoped stock_movements idempotency fallback for non-default tenant
      const deductRes = await deductOrderStock(
        db as never,
        'ord-no-recipe',
        [{ productId: 'prod-shared', quantity: 1 }],
        { tenantId: 'store-a' }
      );
      expect(deductRes.ok).toBe(true);
      expect(deductRes.depletions).toEqual([]);
    });
  });
});
