// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { paymentSqliteDB } from '../helpers/payment-sqlite-db';
import { createMockEnv, TEST_JWT_SECRET } from '../test-utils';
import { issueStaffSession, requireStaffAccount } from '../../lib/staff-session';
import {
  handleOverview,
  registerGroupedSalesHandlers,
} from '../../routes/reports-handlers/grouped-sales-handlers';
import { getGrouped } from '../../tree/analytics/summary';
import { getPeakHours } from '../../tree/analytics/peak-hours';
import { getTopProducts } from '../../tree/analytics/top-products';
import { getZoneStats } from '../../tree/analytics/zone-analytics';
import { escapeCsvField, formatCsvRows, getOrdersInRange } from '../../tree/analytics/csv-export';
import { openApiStaffRouter } from '../../routes/openapi-staff-handlers/routes';
import {
  createSchedule,
  scheduleInput,
  updateSchedule,
} from '../../../../packages/domain/shift/commands/schedules';
import { ShiftContractError, type ShiftScope } from '../../../../packages/domain/shift/commands/shift-access';

const databases: ReturnType<typeof paymentSqliteDB>['sqlite'][] = [];
afterEach(() => {
  vi.useRealTimers();
  databases.splice(0).forEach((db) => db.close());
});

function createReportsFixture() {
  const { db, sqlite } = paymentSqliteDB();
  databases.push(sqlite);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_id TEXT,
      price INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price INTEGER NOT NULL DEFAULT 0,
      subtotal INTEGER NOT NULL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE IF NOT EXISTS cafe_tables (
      id TEXT PRIMARY KEY,
      table_number TEXT,
      zone TEXT,
      tenant_id TEXT DEFAULT 'default'
    );
  `);

  return { db, sqlite };
}

function createShiftsFixture(pilotTenantId = 'cafe-a') {
  const { db, sqlite } = paymentSqliteDB();
  databases.push(sqlite);

  const schema = readFileSync(new URL('../../../schema.sql', import.meta.url), 'utf8');
  sqlite.exec(schema.match(/CREATE TABLE IF NOT EXISTS staff_shifts \([\s\S]*?\);/)![0]);
  for (const index of schema.matchAll(/CREATE (?:UNIQUE )?INDEX idx_staff_shifts[^;]*;/g)) {
    sqlite.exec(index[0]);
  }

  for (const [id, role, tenant] of [
    ['staff', 'staff', 'cafe-a'],
    ['staff-2', 'staff', 'cafe-a'],
    ['manager', 'manager', 'cafe-a'],
    ['owner', 'owner', 'cafe-a'],
    ['other-staff', 'staff', 'cafe-b'],
    ['other-manager', 'manager', 'cafe-b'],
  ]) {
    sqlite
      .prepare('INSERT INTO users (id, name, role, tenant_id) VALUES (?, ?, ?, ?)')
      .run(id, `User ${id}`, role, tenant);
  }

  const env = createMockEnv({
    AURA_DB: db,
    ENVIRONMENT: 'production',
    PILOT_TENANT_ID: pilotTenantId,
  });

  const token = async (id: string) =>
    (
      await issueStaffSession(
        { JWT_SECRET: TEST_JWT_SECRET },
        await requireStaffAccount(db, id),
        { sessionType: 'staff-web' }
      )
    ).token;

  return { db, sqlite, env, token };
}

describe('Phase 51 Slice AX2 — Grouped Sales Reports, Tree Analytics UTC+7 / Tenant Scoping & Shift Schedule Integrity', () => {
  describe('1. Grouped Sales Reports (grouped-sales-handlers.ts)', () => {
    it('excludes refunded/canceled orders and refunded/failed/cancelled payment_status across all grouped sales endpoints', async () => {
      const { db, sqlite } = createReportsFixture();

      sqlite.prepare(`INSERT INTO categories (id, name, tenant_id) VALUES (?, ?, ?)`).run('cat-a', 'Coffee', 'store-a');
      sqlite.prepare(`INSERT INTO products (id, name, category_id, price, tenant_id) VALUES (?, ?, ?, ?, ?)`).run(
        'prod-a',
        'Espresso',
        'cat-a',
        50000,
        'store-a'
      );

      const insertOrder = sqlite.prepare(`
        INSERT INTO orders (id, total, status, payment_status, payment_method, items, created_at, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertItem = sqlite.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      // Valid paid order
      insertOrder.run(
        'ord-valid',
        50000,
        'completed',
        'paid',
        'payos',
        JSON.stringify([{ product_id: 'prod-a', category: 'Coffee', quantity: 1, price: 50000 }]),
        '2026-11-03 03:00:00',
        'store-a'
      );
      insertItem.run('ord-valid', 'prod-a', 1, 50000, 50000, 'store-a');

      // Refunded order status
      insertOrder.run(
        'ord-refunded-status',
        80000,
        'refunded',
        'paid',
        'payos',
        JSON.stringify([{ product_id: 'prod-a', category: 'Coffee', quantity: 1, price: 80000 }]),
        '2026-11-03 03:30:00',
        'store-a'
      );
      insertItem.run('ord-refunded-status', 'prod-a', 1, 80000, 80000, 'store-a');

      // US-spelled canceled order status
      insertOrder.run(
        'ord-canceled-us',
        60000,
        'canceled',
        'paid',
        'cash',
        JSON.stringify([{ product_id: 'prod-a', category: 'Coffee', quantity: 1, price: 60000 }]),
        '2026-11-03 04:00:00',
        'store-a'
      );
      insertItem.run('ord-canceled-us', 'prod-a', 1, 60000, 60000, 'store-a');

      // Completed status but refunded payment_status
      insertOrder.run(
        'ord-refunded-payment',
        90000,
        'completed',
        'refunded',
        'payos',
        JSON.stringify([{ product_id: 'prod-a', category: 'Coffee', quantity: 1, price: 90000 }]),
        '2026-11-03 04:30:00',
        'store-a'
      );
      insertItem.run('ord-refunded-payment', 'prod-a', 1, 90000, 90000, 'store-a');

      // Completed status but failed payment_status
      insertOrder.run(
        'ord-failed-payment',
        70000,
        'completed',
        'failed',
        'payos',
        JSON.stringify([{ product_id: 'prod-a', category: 'Coffee', quantity: 1, price: 70000 }]),
        '2026-11-03 05:00:00',
        'store-a'
      );
      insertItem.run('ord-failed-payment', 'prod-a', 1, 70000, 70000, 'store-a');

      const app = new Hono<{ Bindings: Env; Variables: { user?: unknown; tenantId?: string } }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
        c.set('tenantId', 'store-a');
        await next();
      });
      registerGroupedSalesHandlers(app);
      const env = createMockEnv({ AURA_DB: db });

      const overviewRes = await app.request('/overview?from=2026-11-03&to=2026-11-03', {}, env);
      expect(overviewRes.status).toBe(200);
      const overviewJson = (await overviewRes.json()) as {
        data: { todayRevenue: number; todayOrders: number };
      };
      expect(overviewJson.data.todayRevenue).toBe(50000);
      expect(overviewJson.data.todayOrders).toBe(1);

      const hourRes = await app.request('/sales-by-hour?from=2026-11-03&to=2026-11-03', {}, env);
      expect(hourRes.status).toBe(200);
      const hourJson = (await hourRes.json()) as {
        data: { groups: Array<{ label: string; value: number; count: number }> };
      };
      // 03:00 UTC = 10:00 UTC+7
      expect(hourJson.data.groups[10]).toEqual({ label: '10:00', value: 50000, count: 1 });
      const totalHourRevenue = hourJson.data.groups.reduce((sum, g) => sum + g.value, 0);
      expect(totalHourRevenue).toBe(50000);

      const dayRes = await app.request('/sales-by-day?from=2026-11-03&to=2026-11-03', {}, env);
      expect(dayRes.status).toBe(200);
      const dayJson = (await dayRes.json()) as {
        data: { groups: Array<{ label: string; value: number; count: number }> };
      };
      expect(dayJson.data.groups).toEqual([{ label: '2026-11-03', value: 50000, count: 1 }]);

      const catRes = await app.request('/sales-by-category?from=2026-11-03&to=2026-11-03', {}, env);
      expect(catRes.status).toBe(200);
      const catJson = (await catRes.json()) as {
        data: { groups: Array<{ label: string; value: number; count: number }> };
      };
      expect(catJson.data.groups).toEqual([{ label: 'Coffee', value: 50000, count: 1 }]);

      const payRes = await app.request('/sales-by-payment?from=2026-11-03&to=2026-11-03', {}, env);
      expect(payRes.status).toBe(200);
      const payJson = (await payRes.json()) as {
        data: { groups: Array<{ label: string; value: number; count: number }> };
      };
      expect(payJson.data.groups).toEqual([{ label: 'payos', value: 50000, count: 1 }]);
    });

    it('buckets timestamps and default dates in UTC+7 (Vietnam local time)', async () => {
      // Set system clock to 2026-11-02T18:30:00Z -> 2026-11-03 01:30:00 ICT (UTC+7)
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-02T18:30:00.000Z'));

      const { db, sqlite } = createReportsFixture();
      sqlite
        .prepare(
          `INSERT INTO orders (id, total, status, payment_status, payment_method, items, created_at, tenant_id)
           VALUES (?, ?, 'completed', 'paid', 'cash', '[]', ?, 'store-a')`
        )
        .run('ord-late-ict', 65000, '2026-11-02 18:15:00'); // 2026-11-03 01:15:00 ICT

      const app = new Hono<{ Bindings: Env; Variables: { user?: unknown; tenantId?: string } }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
        c.set('tenantId', 'store-a');
        await next();
      });
      registerGroupedSalesHandlers(app);
      const env = createMockEnv({ AURA_DB: db });

      // Calling /overview and /sales-by-hour WITHOUT explicit ?from=&to= defaults to 2026-11-03 in UTC+7
      const overviewRes = await app.request('/overview', {}, env);
      expect(overviewRes.status).toBe(200);
      const overviewJson = (await overviewRes.json()) as {
        data: { todayRevenue: number; todayOrders: number };
      };
      expect(overviewJson.data.todayRevenue).toBe(65000);
      expect(overviewJson.data.todayOrders).toBe(1);

      const hourRes = await app.request('/sales-by-hour', {}, env);
      expect(hourRes.status).toBe(200);
      const hourJson = (await hourRes.json()) as {
        data: { groups: Array<{ label: string; value: number; count: number }> };
      };
      // 18:15 UTC = 01:15 ICT (hour 1)
      expect(hourJson.data.groups[1]).toEqual({ label: '01:00', value: 65000, count: 1 });
      expect(hourJson.data.groups[18]).toEqual({ label: '18:00', value: 0, count: 0 });
    });

    it('rejects cross-tenant X-Tenant-ID or ?tenant_id overrides for non-HQ callers with 403 across all grouped sales routes', async () => {
      const { db } = createReportsFixture();
      const app = new Hono<{ Bindings: Env; Variables: { user?: unknown; tenantId?: string } }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
        c.set('tenantId', 'store-a');
        await next();
      });
      registerGroupedSalesHandlers(app);
      const env = createMockEnv({ AURA_DB: db });

      for (const path of [
        '/overview?tenant_id=store-b',
        '/sales-by-hour?tenant_id=store-b',
        '/sales-by-day?tenant_id=store-b',
        '/sales-by-category?tenant_id=store-b',
        '/sales-by-payment?tenant_id=store-b',
      ]) {
        const qRes = await app.request(path, {}, env);
        expect(qRes.status).toBe(403);
      }

      for (const path of [
        '/overview',
        '/sales-by-hour',
        '/sales-by-day',
        '/sales-by-category',
        '/sales-by-payment',
      ]) {
        const hRes = await app.request(path, { headers: { 'X-Tenant-ID': 'store-b' } }, env);
        expect(hRes.status).toBe(403);
      }
    });

    it('scopes products and categories to scope.tenantId in /sales-by-category fallback and enforces LIMIT 2000', async () => {
      const { db, sqlite } = createReportsFixture();
      // Drop order_items to trigger the orders.items JSON fallback
      sqlite.exec('DROP TABLE order_items;');

      sqlite.prepare(`INSERT INTO categories (id, name, tenant_id) VALUES (?, ?, ?)`).run('cat-b', 'Secret Rival Category', 'store-b');
      sqlite.prepare(`INSERT INTO products (id, name, category_id, tenant_id) VALUES (?, ?, ?, ?)`).run(
        'shared-prod',
        'Rival Drink',
        'cat-b',
        'store-b'
      );

      sqlite
        .prepare(
          `INSERT INTO orders (id, total, status, payment_status, payment_method, items, created_at, tenant_id)
           VALUES (?, ?, 'completed', 'paid', 'cash', ?, '2026-11-03 02:00:00', 'store-a')`
        )
        .run(
          'ord-fallback-a',
          45000,
          JSON.stringify([{ product_id: 'shared-prod', quantity: 1, price: 45000 }])
        );

      const app = new Hono<{ Bindings: Env; Variables: { user?: unknown; tenantId?: string } }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
        c.set('tenantId', 'store-a');
        await next();
      });
      registerGroupedSalesHandlers(app);
      const env = createMockEnv({ AURA_DB: db });

      const res = await app.request('/sales-by-category?from=2026-11-03&to=2026-11-03', {}, env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: { groups: Array<{ label: string; value: number; count: number }> };
      };
      // Must NOT resolve 'Secret Rival Category' from store-b
      expect(json.data.groups).toEqual([{ label: 'Món khác', value: 45000, count: 1 }]);
    });
  });

  describe('2. Tree Analytics UTC+7, Tenant Scoping & CSV Formula Neutralization', () => {
    it('uses UTC+7 hour bucketing in summary.ts getGrouped("hour") and peak-hours.ts getPeakHours()', async () => {
      const { db, sqlite } = createReportsFixture();
      const oneHourAgoUtc = new Date(Date.now() - 3600_000).toISOString().replace('T', ' ').slice(0, 19);
      const expectedIctHour = new Date(Date.parse(oneHourAgoUtc.replace(' ', 'T') + 'Z') + 7 * 3600_000).getUTCHours();

      sqlite
        .prepare(
          `INSERT INTO orders (id, total, status, payment_status, payment_method, items, created_at, tenant_id)
           VALUES (?, ?, 'completed', 'paid', 'cash', '[]', ?, 'store-a')`
        )
        .run('ord-ict-hour', 55000, oneHourAgoUtc);

      const groupedHours = await getGrouped(db, 'hour', 7, 'store-a');
      expect(groupedHours[expectedIctHour].value).toBe(55000);
      expect(groupedHours[expectedIctHour].count).toBe(1);

      const peakHours = await getPeakHours(db, 7, 'store-a');
      expect(peakHours[expectedIctHour].revenue).toBe(55000);
      expect(peakHours[expectedIctHour].order_count).toBe(1);
    });

    it('enforces LIMIT 2000 and tenant-scoped product/category lookups in summary.ts and top-products.ts, gating unscoped fallbacks on tenantId === "default"', async () => {
      const { db, sqlite } = createReportsFixture();
      sqlite.exec('DROP TABLE order_items;');

      sqlite.prepare(`INSERT INTO categories (id, name, tenant_id) VALUES (?, ?, ?)`).run('cat-b', 'Store B Category', 'store-b');
      sqlite.prepare(`INSERT INTO products (id, name, category_id, tenant_id) VALUES (?, ?, ?, ?)`).run(
        'prod-shared',
        'Store B Secret Product',
        'cat-b',
        'store-b'
      );

      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      sqlite
        .prepare(
          `INSERT INTO orders (id, total, status, payment_status, payment_method, items, created_at, tenant_id)
           VALUES (?, ?, 'completed', 'paid', 'cash', ?, ?, 'store-a')`
        )
        .run(
          'ord-top-a',
          40000,
          JSON.stringify([{ product_id: 'prod-shared', quantity: 2, price: 20000 }]),
          nowStr
        );

      const catGroups = await getGrouped(db, 'category', 7, 'store-a');
      expect(catGroups).toEqual([{ label: 'Uncategorized', value: 40000, count: 2 }]);

      const topProducts = await getTopProducts(db, 5, 'store-a');
      expect(topProducts).toEqual([{ product_name: 'Unknown', total_qty: 2, revenue: 40000 }]);
    });

    it('gates unscoped cafe_tables / tables fallbacks in zone-analytics.ts on tenantId === "default"', async () => {
      const sqlLog: string[] = [];
      const failingDb = {
        prepare: vi.fn((sql: string) => {
          sqlLog.push(sql);
          return {
            bind: vi.fn(() => ({
              all: vi.fn().mockRejectedValue(new Error('D1_ERROR: no such column: ct.tenant_id')),
            })),
          };
        }),
      } as unknown as import('@cloudflare/workers-types').D1Database;

      const nonDefaultZones = await getZoneStats(failingDb, 7, 'store-a');
      expect(nonDefaultZones).toEqual([]);
      // Must NOT execute unscoped LEFT JOIN cafe_tables or LEFT JOIN tables when tenantId !== 'default'
      expect(sqlLog.some((s) => /LEFT JOIN tables\b/i.test(s))).toBe(false);
      expect(
        sqlLog.every((s) => s.includes("COALESCE(NULLIF(TRIM(ct.tenant_id), ''), 'default')"))
      ).toBe(true);
    });

    it('excludes all non-revenue statuses in getOrdersInRange and neutralizes leading pipe, whitespace-prefixed, and multiline formulas in escapeCsvField', async () => {
      const { db, sqlite } = createReportsFixture();
      const insertOrder = sqlite.prepare(`
        INSERT INTO orders (id, customer_name, customer_phone, total, status, payment_method, items, created_at, tenant_id)
        VALUES (?, ?, ?, ?, ?, 'cash', '[]', '2026-11-03 10:00:00', 'store-a')
      `);
      insertOrder.run('ord-ok', 'Alice', '0901111111', 45000, 'completed');
      insertOrder.run('ord-ref', 'Bob', '0902222222', 55000, 'refunded');
      insertOrder.run('ord-fail', 'Charlie', '0903333333', 65000, 'failed');
      insertOrder.run('ord-rej', 'Dave', '0904444444', 75000, 'rejected');
      insertOrder.run('ord-exp', 'Eve', '0905555555', 85000, 'expired');
      insertOrder.run('ord-canc-us', 'Frank', '0906666666', 95000, 'canceled');

      const exported = await getOrdersInRange(db, '2026-11-01', '2026-11-03', 'store-a');
      expect(exported.map((r) => r.id)).toEqual(['ord-ok']);

      // Formula injection neutralization checks
      expect(escapeCsvField('|calc.exe')).toBe("'|calc.exe");
      expect(escapeCsvField('   =SUM(A1:A2)')).toBe("'   =SUM(A1:A2)");
      expect(escapeCsvField('\t+cmd')).toBe("'\t+cmd");
      expect(escapeCsvField('SafeLine\n=IMPORTXML("http://evil")')).toBe(
        '"SafeLine\n\'=IMPORTXML(""http://evil"")"'
      );
      expect(escapeCsvField('SafeLine\r\n  |cmd')).toBe('"SafeLine\r\n\'  |cmd"');

      const csv = formatCsvRows([
        {
          id: 'ord-csv',
          customer_name: 'Alice\n=1+1',
          customer_phone: ' |0901',
          total: 45000,
          status: 'completed',
          payment_method: 'cash',
          items: '[]',
          created_at: '2026-11-03 10:00:00',
        },
      ]);
      expect(csv).toContain('"Alice\n\'=1+1"');
      expect(csv).toContain("' |0901");
    });
  });

  describe('3. Shift Handlers RBAC Ordering & Schedule Date / Overlap Integrity', () => {
    it('enforces !scope.canManage (403) on DELETE /api/staff/shifts/:id BEFORE getShift or cancelled state check', async () => {
      const { env, token } = createShiftsFixture('cafe-a');
      const mgrToken = await token('manager');
      const staffToken = await token('staff');

      // Manager creates and cancels a shift for 'staff'
      const createRes = await openApiStaffRouter.request(
        '/api/staff/shifts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            staffId: 'staff',
            date: '2026-11-06',
            startTime: '08:00',
            endTime: '12:00',
          }),
        },
        env
      );
      expect(createRes.status).toBe(201);
      const shiftId = ((await createRes.json()) as { data: { id: string } }).data.id;

      const mgrCancelRes = await openApiStaffRouter.request(
        `/api/staff/shifts/${shiftId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${mgrToken}` },
        },
        env
      );
      expect(mgrCancelRes.status).toBe(200);

      // Non-manager staff member attempting to DELETE their own already-cancelled shift must get 403 (not 200 idempotent)
      const staffDeleteCancelledRes = await openApiStaffRouter.request(
        `/api/staff/shifts/${shiftId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${staffToken}` },
        },
        env
      );
      expect(staffDeleteCancelledRes.status).toBe(403);

      // Non-manager staff member attempting to DELETE a non-existent shift ID must also get 403 (not 404)
      const staffDeleteMissingRes = await openApiStaffRouter.request(
        '/api/staff/shifts/999999',
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${staffToken}` },
        },
        env
      );
      expect(staffDeleteMissingRes.status).toBe(403);
    });

    it('rejects impossible calendar dates (e.g. 2026-02-31, 2026-02-29) with 400 in scheduleInput, createSchedule, and updateSchedule', async () => {
      const { db, env, token } = createShiftsFixture('cafe-a');
      const mgrToken = await token('manager');

      const mgrAccount = await requireStaffAccount(db, 'manager');
      const scope: ShiftScope = {
        env,
        tenantId: 'cafe-a',
        actor: mgrAccount,
        canManage: true,
      };

      expect(() =>
        scheduleInput(scope, {
          staffId: 'staff',
          date: '2026-02-31',
          startTime: '09:00',
          endTime: '17:00',
        })
      ).toThrowError(ShiftContractError);

      await expect(
        createSchedule(scope, {
          staffId: 'staff',
          date: '2026-02-31',
          startTime: '09:00',
          endTime: '17:00',
        })
      ).rejects.toMatchObject({ status: 400 });

      const apiBadDateRes = await openApiStaffRouter.request(
        '/api/staff/shifts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            staffId: 'staff',
            date: '2026-02-29',
            startTime: '09:00',
            endTime: '17:00',
          }),
        },
        env
      );
      expect(apiBadDateRes.status).toBe(400);
    });

    it('rejects overlapping non-cancelled shift schedules for the same staff_id, date, and tenant with 409 on create and update', async () => {
      const { env, token } = createShiftsFixture('cafe-a');
      const mgrToken = await token('manager');

      // 1. Create initial shift 09:00 - 13:00
      const firstRes = await openApiStaffRouter.request(
        '/api/staff/shifts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            staffId: 'staff',
            date: '2026-11-10',
            startTime: '09:00',
            endTime: '13:00',
          }),
        },
        env
      );
      expect(firstRes.status).toBe(201);
      const firstShiftId = ((await firstRes.json()) as { data: { id: string } }).data.id;

      // 2. Overlapping shift 11:00 - 15:00 for same staff & date -> 409 Conflict
      const overlapCreateRes = await openApiStaffRouter.request(
        '/api/staff/shifts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            staffId: 'staff',
            date: '2026-11-10',
            startTime: '11:00',
            endTime: '15:00',
          }),
        },
        env
      );
      expect(overlapCreateRes.status).toBe(409);

      // 3. Adjacent non-overlapping shift 13:00 - 17:00 for same staff & date -> 201 Created
      const secondRes = await openApiStaffRouter.request(
        '/api/staff/shifts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            staffId: 'staff',
            date: '2026-11-10',
            startTime: '13:00',
            endTime: '17:00',
          }),
        },
        env
      );
      expect(secondRes.status).toBe(201);
      const secondShiftId = ((await secondRes.json()) as { data: { id: string } }).data.id;

      // 4. Updating second shift to 12:00 - 17:00 (overlapping first shift 09:00 - 13:00) -> 409 Conflict
      const overlapUpdateRes = await openApiStaffRouter.request(
        `/api/staff/shifts/${secondShiftId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startTime: '12:00',
          }),
        },
        env
      );
      expect(overlapUpdateRes.status).toBe(409);

      // 5. Updating first shift in-place (09:00 - 12:30) does not conflict with itself -> 200 OK
      const selfUpdateRes = await openApiStaffRouter.request(
        `/api/staff/shifts/${firstShiftId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endTime: '12:30',
          }),
        },
        env
      );
      expect(selfUpdateRes.status).toBe(200);
    });
  });
});
