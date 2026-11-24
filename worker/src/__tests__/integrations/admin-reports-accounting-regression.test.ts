// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { reportsRouter } from '../../routes/reports-handlers/routes';
import { registerPnlHandlers } from '../../routes/reports-handlers/pnl-handlers';
import { registerExportHandlers } from '../../routes/reports-handlers/export-handlers';
import { franchiseRouter } from '../../routes/franchise-locations';
import { issueStaffSession } from '../../lib/staff-session';
import { getZoneStats } from '../../tree/analytics/zone-analytics';
import { transitionOrderStatus } from '../../../../packages/domain/order/policies/order-status-transition';
import { periodDates, previousPeriodDates } from '../../../../src/pages/admin/date-helpers';
import { computeChartMetrics } from '../../../../src/components/admin/PeriodComparisonChart-constants';
import type { Env } from '../../types/env';

function createSqliteD1(): { db: D1Database; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      items TEXT DEFAULT '[]',
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      shipping_fee REAL DEFAULT 0,
      service_fee REAL DEFAULT 0,
      tip_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'cash',
      order_type TEXT DEFAULT 'dine_in',
      table_id TEXT,
      table_number TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
    CREATE TABLE cafe_tables (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      name TEXT,
      zone TEXT
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'default',
      amount REAL DEFAULT 0,
      refund_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'paid',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      refunded_at TEXT
    );
    CREATE TABLE refunds (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'default',
      amount REAL DEFAULT 0,
      status TEXT DEFAULT 'approved',
      created_at TEXT NOT NULL
    );
    CREATE TABLE ingredients (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      name TEXT NOT NULL,
      cost_per_unit REAL DEFAULT 0
    );
    CREATE TABLE inventory_items (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      name TEXT NOT NULL,
      cost_per_unit REAL DEFAULT 0
    );
    CREATE TABLE inventory_transactions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      item_id TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE stock_movements (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      ingredient_id TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE franchise_locations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      name TEXT NOT NULL,
      code TEXT,
      royalty_percentage REAL DEFAULT 5.0,
      status TEXT DEFAULT 'active'
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT,
      actor_id TEXT,
      action TEXT,
      resource_type TEXT,
      resource_id TEXT,
      details TEXT,
      tenant_id TEXT,
      status TEXT,
      created_at TEXT
    );
    CREATE TABLE tables (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      table_number TEXT,
      zone_id TEXT
    );
    CREATE TABLE zones (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      name TEXT
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      phone TEXT,
      role TEXT,
      tenant_id TEXT DEFAULT 'default',
      auth_version INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1
    );
    INSERT INTO users (id, email, name, role, tenant_id, auth_version, is_active)
    VALUES ('owner-1', 'owner@test.local', 'Owner', 'owner', 'default', 0, 1);
  `);

  const db = {
    prepare(sql: string) {
      const bind = (...params: unknown[]) => ({
        async first<T>() {
          const row = raw.prepare(sql).get(...(params as never[])) as T | undefined;
          return row ?? null;
        },
        async all<T>() {
          const rows = raw.prepare(sql).all(...(params as never[])) as T[];
          return { results: rows };
        },
        async run() {
          const res = raw.prepare(sql).run(...(params as never[]));
          return { meta: { changes: Number(res.changes ?? 0) } };
        },
      });
      return {
        bind,
        async first<T>() {
          const row = raw.prepare(sql).get() as T | undefined;
          return row ?? null;
        },
        async all<T>() {
          const rows = raw.prepare(sql).all() as T[];
          return { results: rows };
        },
        async run() {
          const res = raw.prepare(sql).run();
          return { meta: { changes: Number(res.changes ?? 0) } };
        },
      };
    },
  } as unknown as D1Database;

  return { db, raw };
}

describe('Accounting, COGS & Reports Regression Suite (Real SQLite)', () => {
  it('computes P&L with ingredients.cost_per_unit, deduplicates dual-written BOM/inventory COGS, and uses net_revenue for gross_margin_pct', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      INSERT INTO orders (id, tenant_id, subtotal, discount, shipping_fee, service_fee, tip_amount, total, status, payment_status, created_at)
      VALUES
        ('ord-paid', 'default', 1000000, 100000, 20000, 10000, 5000, 935000, 'completed', 'paid', '2026-11-01 05:00:00'),
        ('ord-unpaid', 'default', 500000, 0, 0, 0, 0, 500000, 'completed', 'pending', '2026-11-01 06:00:00');
      INSERT INTO refunds (id, order_id, tenant_id, amount, status, created_at)
      VALUES ('ref-1', 'ord-paid', 'default', 50000, 'approved', '2026-11-01 07:00:00');
      INSERT INTO ingredients (id, tenant_id, name, cost_per_unit) VALUES ('ing-1', 'default', 'Coffee Bean', 1000);
      INSERT INTO inventory_items (id, tenant_id, name, cost_per_unit) VALUES ('ing-1', 'default', 'Coffee Bean', 1000), ('item-cup', 'default', 'Cup', 2000);
      -- Dual-written by bom-policy for ord-paid (must NOT double-count):
      INSERT INTO inventory_transactions (id, tenant_id, item_id, type, quantity, reference_type, reference_id, created_at)
      VALUES
        ('it-dual', 'default', 'ing-1', 'out', 100, 'order', 'ord-paid', '2026-11-01 05:00:00'),
        ('it-manual', 'default', 'item-cup', 'out', 60, 'manual', 'man-1', '2026-11-01 05:00:00'),
        ('it-waste', 'default', 'item-cup', 'waste', 5, 'manual', 'man-2', '2026-11-01 05:00:00');
      INSERT INTO stock_movements (id, tenant_id, ingredient_id, type, quantity, reference_type, reference_id, created_at)
      VALUES
        ('sm-ded', 'default', 'ing-1', 'deduction', 100, 'order', 'ord-paid', '2026-11-01 05:00:00'),
        ('sm-adj', 'default', 'ing-1', 'adjustment', 20, 'order', 'ord-paid', '2026-11-01 05:10:00'),
        ('sm-waste', 'default', 'ing-1', 'waste', 5, 'manual', 'w-1', '2026-11-01 05:20:00');
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user: { role: string } } }>();
    app.use('*', async (c, next) => {
      c.set('user', { role: 'admin' });
      await next();
    });
    registerPnlHandlers(app as unknown as Hono<{ Bindings: Env }>);

    const res = await app.request('/pnl?from=2026-11-01&to=2026-11-07', {}, { AURA_DB: db } as unknown as Env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: {
        daily: Array<{
          orders: number;
          net_revenue: number;
          cogs: number;
          waste_cost: number;
          gross_profit: number;
          gross_margin_pct: number;
        }>;
      };
    };

    expect(body.success).toBe(true);
    const day = body.data.daily[0];
    expect(day.orders).toBe(1); // unpaid order excluded
    // net_revenue = (935,000 - 20,000 - 10,000 - 5,000) - 50,000 = 850,000
    expect(day.net_revenue).toBe(850000);
    // invCogs = 60*2000 = 120,000 (it-dual excluded); bomCogs = (100-20)*1000 = 80,000 => total 200,000
    expect(day.cogs).toBe(200000);
    // waste = 5*2000 + 5*1000 = 15,000
    expect(day.waste_cost).toBe(15000);
    // gross_profit = 850,000 - 200,000 - 15,000 = 635,000
    expect(day.gross_profit).toBe(635000);
    expect(day.gross_margin_pct).toBe(Math.round((635000 / 850000) * 10000) / 100);
  });

  it('computes franchise royalty on Net Sales using payments.refund_amount (no orders.refund_amount column)', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      INSERT OR REPLACE INTO users (id, email, name, phone, role, tenant_id, auth_version, is_active)
      VALUES ('owner-1', 'owner@test.local', 'Owner', '0901234567', 'owner', 'default', 1, 1);
      INSERT INTO franchise_locations (id, tenant_id, name, code, royalty_percentage, status)
      VALUES ('loc-1', 'default', 'Store Q1', 'Q1', 10.0, 'active');
      INSERT INTO orders (id, tenant_id, total, shipping_fee, service_fee, tip_amount, status, payment_status, created_at)
      VALUES
        ('ord-1', 'default', 250000, 20000, 10000, 5000, 'completed', 'paid', '2026-11-01 05:00:00'),
        ('ord-unpaid', 'default', 500000, 0, 0, 0, 'completed', 'pending', '2026-11-01 06:00:00');
      INSERT INTO payments (id, order_id, tenant_id, amount, refund_amount, status, created_at)
      VALUES ('pay-1', 'ord-1', 'default', 250000, 15000, 'paid', '2026-11-01 05:00:00');
    `);

    const jwtSecret = 'test-secret-key-for-regression-suite-only';
    const env = {
      AURA_DB: db,
      JWT_SECRET: jwtSecret,
      AUTH_KV: { get: async () => null, put: async () => undefined, delete: async () => undefined },
    } as unknown as Env;
    const { token } = await issueStaffSession(
      env,
      { id: 'owner-1', name: 'Owner', phone: '0901234567', role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 },
      { sessionType: 'staff-web' },
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', franchiseRouter);

    const res = await app.request(
      '/locations/loc-1/metrics?start_date=2026-11-01&end_date=2026-11-01',
      { headers: { Authorization: `Bearer ${token}` } },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { order_count: number; gross_sales: number; royalty_amount: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.order_count).toBe(1);
    // Net sales = 250,000 - 20,000 - 10,000 - 5,000 - 15,000 = 200,000
    expect(body.data.gross_sales).toBe(200000);
    expect(body.data.royalty_amount).toBe(20000);

    const invertedRange = await app.request(
      '/locations/loc-1/metrics?start_date=2026-11-10&end_date=2026-11-01',
      { headers: { Authorization: `Bearer ${token}` } },
      env,
    );
    expect(invertedRange.status).toBe(400);

    const oversizedRange = await app.request(
      '/locations/loc-1/metrics?start_date=2024-01-01&end_date=2026-11-01',
      { headers: { Authorization: `Bearer ${token}` } },
      env,
    );
    expect(oversizedRange.status).toBe(400);
  });

  it('exports orders CSV with payments.refund_amount, fee columns, forced supervisor PII masking, 403 on supervisor customers export, and enforces daySpan <= 366', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        loyalty_tier TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
      INSERT INTO customers (id, name, email, phone, loyalty_tier, tenant_id, created_at)
      VALUES ('cust-1', 'An Nguyen', 'an@example.com', '0901234567', 'gold', 'default', '2026-11-01 05:00:00');
      INSERT INTO orders (id, tenant_id, customer_name, customer_phone, shipping_fee, service_fee, tip_amount, total, status, payment_status, payment_method, created_at)
      VALUES ('ord-1', 'default', 'An', '0901234567', 15000, 5000, 2000, 122000, 'completed', 'paid', 'cash', '2026-11-01 05:00:00');
      INSERT INTO payments (id, order_id, tenant_id, amount, refund_amount, status, created_at)
      VALUES ('pay-1', 'ord-1', 'default', 122000, 10000, 'paid', '2026-11-01 05:00:00');
    `);

    let currentRole = 'supervisor';
    const app = new Hono<{ Bindings: Env; Variables: { user: { id: string; role: string; tenantId: string } } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'actor-1', role: currentRole, tenantId: 'default' });
      await next();
    });
    registerExportHandlers(app as unknown as Hono<{ Bindings: Env }>);

    const res = await app.request('/export?type=orders&from=2026-11-01&to=2026-11-07&mask_pii=0', {}, { AURA_DB: db } as unknown as Env);
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain('shipping_fee,service_fee,tip,total,refund_amount');
    expect(csv).toContain('15000,5000,2000,122000,10000');
    expect(csv).toContain('A***,090****567');
    expect(csv).not.toContain('0901234567');

    const supCustRes = await app.request('/export?type=customers&from=2026-11-01&to=2026-11-07', {}, { AURA_DB: db } as unknown as Env);
    expect(supCustRes.status).toBe(403);

    currentRole = 'manager';
    const mgrOrdersRes = await app.request('/export?type=orders&from=2026-11-01&to=2026-11-07', {}, { AURA_DB: db } as unknown as Env);
    expect(mgrOrdersRes.status).toBe(200);
    expect(await mgrOrdersRes.text()).toContain('An,0901234567,15000,5000,2000,122000,10000');

    const mgrCustRes = await app.request('/export?type=customers&from=2026-11-01&to=2026-11-07', {}, { AURA_DB: db } as unknown as Env);
    expect(mgrCustRes.status).toBe(200);
    expect(await mgrCustRes.text()).toContain('An Nguyen,an@example.com,0901234567');

    const badRange = await app.request('/export?type=orders&from=2024-01-01&to=2026-11-01', {}, { AURA_DB: db } as unknown as Env);
    expect(badRange.status).toBe(400);
  });

  it('isolates payments fallback refunds by tenant on P&L when refunds table is absent', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      DROP TABLE refunds;
      INSERT INTO orders (id, tenant_id, subtotal, total, status, payment_status, created_at)
      VALUES
        ('ord-shared', 'default', 200000, 200000, 'completed', 'paid', '2026-11-01 05:00:00'),
        ('ord-other', 'tenant_b', 200000, 200000, 'completed', 'paid', '2026-11-01 05:00:00');
      INSERT INTO payments (id, order_id, tenant_id, amount, refund_amount, status, created_at, refunded_at)
      VALUES
        ('pay-def', 'ord-shared', 'default', 200000, 10000, 'paid', '2026-11-01 05:00:00', '2026-11-01 06:00:00'),
        ('pay-b-collide', 'ord-shared', 'tenant_b', 200000, 90000, 'paid', '2026-11-01 05:00:00', '2026-11-01 06:00:00');
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user: { role: string; tenantId: string } } }>();
    app.use('*', async (c, next) => {
      c.set('user', { role: 'manager', tenantId: 'default' });
      await next();
    });
    registerPnlHandlers(app as unknown as Hono<{ Bindings: Env }>);

    const res = await app.request('/pnl?from=2026-11-01&to=2026-11-01', {}, { AURA_DB: db } as unknown as Env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { totals: { refunds: number; net_revenue: number } };
    };
    expect(body.data.totals.refunds).toBe(10000);
    expect(body.data.totals.net_revenue).toBe(190000);
  });

  it('blocks completing unpaid orders and separates Delivery/Dine-in/Takeaway in getZoneStats', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      INSERT INTO orders (id, tenant_id, total, status, payment_status, order_type, created_at)
      VALUES
        ('ord-unpaid', 'default', 50000, 'preparing', 'pending', 'dine_in', datetime('now')),
        ('ord-del', 'default', 100000, 'completed', 'paid', 'delivery', datetime('now')),
        ('ord-dine', 'default', 80000, 'completed', 'paid', 'dine_in', datetime('now')),
        ('ord-take', 'default', 60000, 'completed', 'paid', 'takeaway', datetime('now'));
    `);

    const blocked = await transitionOrderStatus(db as unknown as Parameters<typeof transitionOrderStatus>[0], 'ord-unpaid', 'default', { status: 'completed' });
    expect(blocked.success).toBe(false);

    const zones = await getZoneStats(db, 30, 'default');
    const names = zones.map((z) => z.label).sort();
    expect(names).toEqual(['Giao hàng', 'Mang đi', 'Tại quán']);
  });

  it('returns orderCount and itemsCount in sales-by-category and handles ICT date helpers & 0-to-positive chart growth', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      INSERT INTO orders (id, tenant_id, items, total, status, payment_status, created_at)
      VALUES ('ord-1', 'default', '[{"id":"p1","name":"Latte","category":"Cà phê","price":45000,"quantity":2}]', 90000, 'completed', 'paid', '2026-11-01 05:00:00');
    `);

    const catRes = await reportsRouter.request('/sales-by-category?from=2026-11-01&to=2026-11-07', {}, { AURA_DB: db } as unknown as Env);
    expect(catRes.status).toBe(200);
    const catJson = (await catRes.json()) as {
      data: { unit: string; groups: Array<{ label: string; value: number; count: number; orderCount: number; itemsCount: number }> };
    };
    expect(catJson.data.unit).toBe('items');
    expect(catJson.data.groups).toEqual([{ label: 'Cà phê', value: 90000, count: 2, orderCount: 1, itemsCount: 2 }]);

    expect(periodDates('custom', '2026-11-20', '2026-11-10')).toEqual({ from: '2026-11-10', to: '2026-11-20' });
    expect(previousPeriodDates('2026-11-10', '2026-11-12')).toEqual({ from: '2026-11-07', to: '2026-11-09' });
    expect(
      computeChartMetrics(
        [{ date: '2026-11-10', revenue: 500000, orders: 5 }],
        [{ date: '2026-11-09', revenue: 0, orders: 0 }],
      ).changePercent,
    ).toBe(100);
  });

  it('returns orderCount and itemsCount in sales-by-category on primary order_items SQL path', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        tenant_id TEXT DEFAULT 'default',
        name TEXT NOT NULL
      );
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        tenant_id TEXT DEFAULT 'default',
        category_id TEXT,
        name TEXT NOT NULL
      );
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity REAL NOT NULL,
        subtotal REAL NOT NULL
      );
      INSERT INTO categories (id, tenant_id, name) VALUES ('cat-1', 'default', 'Cà phê');
      INSERT INTO products (id, tenant_id, category_id, name) VALUES
        ('p-1', 'default', 'cat-1', 'Latte'),
        ('p-2', 'default', 'cat-1', 'Americano');
      INSERT INTO orders (id, tenant_id, total, status, payment_status, created_at) VALUES
        ('ord-1', 'default', 135000, 'completed', 'paid', '2026-11-01 05:00:00'),
        ('ord-2', 'default', 45000, 'completed', 'paid', '2026-11-02 05:00:00');
      INSERT INTO order_items (id, order_id, product_id, quantity, subtotal) VALUES
        ('oi-1', 'ord-1', 'p-1', 2, 90000),
        ('oi-2', 'ord-1', 'p-2', 1, 45000),
        ('oi-3', 'ord-2', 'p-1', 1, 45000);
    `);

    const catRes = await reportsRouter.request('/sales-by-category?from=2026-11-01&to=2026-11-07', {}, { AURA_DB: db } as unknown as Env);
    expect(catRes.status).toBe(200);
    const catJson = (await catRes.json()) as {
      data: { unit: string; groups: Array<{ label: string; value: number; count: number; orderCount: number; itemsCount: number }> };
    };
    expect(catJson.data.unit).toBe('items');
    expect(catJson.data.groups).toEqual([{ label: 'Cà phê', value: 180000, count: 4, orderCount: 2, itemsCount: 4 }]);
  });
});
