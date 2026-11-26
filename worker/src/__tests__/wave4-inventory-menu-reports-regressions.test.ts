// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import type { D1Database, ExecutionContext, KVNamespace } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import { generateJWT } from '../lib/jwt';
import { inventoryForecastingRouter } from '../routes/inventory-forecasting';
import { handleScheduled } from '../scheduled';
import { purchasing } from '../../../packages/domain/inventory/src/routes/purchasing';
import { inventorySnapshots } from '../../../packages/domain/inventory/src/routes/inventory-snapshots';
import { createProductSchema, updateProductSchema } from '../lib/validators/products';
import { happyHourDiscountFor, resolveItemPrice } from '../../../packages/domain/catalog/policies/pricing';
import { happyHourRouter } from '../../../packages/domain/catalog/commands/happy-hour';
import { getCustomerMenu, getCustomerMenuItem } from '../../../packages/domain/catalog/commands/get-customer-menu';
import { registerCheckoutHandlers } from '../routes/dindin-handlers/checkout-handlers';
import { demandForecastRouter } from '../routes/demand-forecast';
import { handleErpnextRequest } from '../routes/erpnext';
import { expenseRoutes } from '../routes/erpnext/expenses';
import { vendorRoutes } from '../routes/erpnext/vendors';
import { customerRoutes } from '../routes/erpnext/customers';
import { handleErpnextPosRequest, processErpnextWebhookLog } from '../routes/erpnext-pos';
import { processErpnextProductSync } from '../routes/cron-handlers/erpnext-sync';
import { reportsRouter } from '../routes/reports-handlers/routes';
import { adminSalesRouter } from '../routes/admin-sales';
import { registerMetricsHandlers } from '../routes/analytics-handlers/metrics-handlers';
import { getSummary, getGrouped } from '../tree/analytics/summary';
import { getStats } from '../../../packages/domain/order/queries/stats';

const JWT_SECRET = 'wave4-regression-jwt-secret-minimum-32-chars!!';
const openDbs: DatabaseSync[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  while (openDbs.length > 0) {
    openDbs.pop()?.close();
  }
});

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const buildStmt = (sql: string, bound: unknown[] = []) => ({
    bind(...args: unknown[]) {
      return buildStmt(sql, args);
    },
    async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
      const stmt = sqlite.prepare(sql);
      const row = stmt.get(...(bound as Array<string | number | null>)) as Record<string, unknown> | undefined;
      if (!row) return null;
      if (colName) return (row[colName] as T) ?? null;
      return row as unknown as T;
    },
    async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }> {
      const stmt = sqlite.prepare(sql);
      const rows = stmt.all(...(bound as Array<string | number | null>)) as T[];
      return { results: rows, success: true, meta: {} };
    },
    async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
      const stmt = sqlite.prepare(sql);
      const info = stmt.run(...(bound as Array<string | number | null>));
      return {
        success: true,
        meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
      };
    },
    async raw<T = unknown[]>(): Promise<T[]> {
      return [];
    },
  });

  const db = {
    prepare(sql: string) {
      return buildStmt(sql);
    },
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const s of stmts) {
        out.push(await s.run());
      }
      return out;
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
    withSession() {
      return db;
    },
  };

  return db as unknown as D1Database;
}

function createMemoryKv(initial: Record<string, string> = {}): { kv: KVNamespace; store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(initial));
  const kv = {
    async get(key: string, type?: string) {
      const val = store.get(key) ?? null;
      if (val !== null && type === 'json') {
        return JSON.parse(val) as unknown;
      }
      return val;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list(opts?: { prefix?: string }) {
      const prefix = opts?.prefix ?? '';
      return {
        keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
        list_complete: true,
        cacheStatus: null,
      };
    },
  } as unknown as KVNamespace;
  return { kv, store };
}

async function signStaffToken(user: { id: string; role: string; tenantId: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return generateJWT(
    {
      id: user.id,
      sub: user.id,
      email: `${user.id}@aura.test`,
      name: user.id,
      role: user.role as never,
      tenantId: user.tenantId,
      tenant_id: user.tenantId,
      authVersion: 1,
      authTime: now,
      sessionType: 'staff-web',
      exp: now + 3600,
    } as never,
    JWT_SECRET,
    3600
  );
}

describe('Wave 4 Regressions (#228, #229, #230, #231)', () => {
  describe('#228: Inventory Forecasting, Snapshots, Purchasing RBAC/PO Entropy & Multi-Tenant Crons', () => {
    it('isolates ingredients across default & non-default tenants, merges inventory_transactions + stock_movements depletions, and allows kitchen/cashier read RBAC', async () => {
      const sqlite = new DatabaseSync(':memory:');
      openDbs.push(sqlite);
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1
        );
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY, sku TEXT, name TEXT, unit TEXT, current_stock REAL, min_stock REAL, max_stock REAL, active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY, sku TEXT, name TEXT, unit TEXT, current_stock REAL, min_stock REAL, max_stock REAL, is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE inventory_transactions (
          id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL, reference_type TEXT, reference_id TEXT, created_at TEXT, tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE stock_movements (
          id TEXT PRIMARY KEY, ingredient_id TEXT, type TEXT, quantity REAL, reference_type TEXT, reference_id TEXT, created_at TEXT, tenant_id TEXT DEFAULT 'default'
        );
        INSERT INTO users (id, name, role, tenant_id) VALUES
          ('kitchen-def', 'Kitchen Default', 'kitchen', 'default'),
          ('cashier-b', 'Cashier B', 'cashier', 'store-b');
        INSERT INTO ingredients (id, sku, name, unit, current_stock, min_stock, max_stock, is_active, tenant_id) VALUES
          ('ing-def-milk', 'MILK-DEF', 'Fresh Milk Default', 'L', 20, 5, 50, 1, 'default'),
          ('ing-b-matcha', 'MAT-B', 'Matcha Store B', 'kg', 12, 2, 30, 1, 'store-b');
      `);

      // Space-separated SQLite timestamps within 7-day window
      const recentSpaceTs = new Date(Date.now() - 2 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
      sqlite.prepare(
        `INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_type, reference_id, created_at, tenant_id)
         VALUES
           ('it-manual-waste', 'ing-def-milk', 'waste', 7, 'waste_report', 'wr-1', ?, 'default'),
           ('it-dual-ord', 'ing-def-milk', 'sale', 7, 'order', 'ord-dual-1', ?, 'default')`
      ).run(recentSpaceTs, recentSpaceTs);
      sqlite.prepare(
        `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_type, reference_id, created_at, tenant_id)
         VALUES
           ('sm-bom-1', 'ing-def-milk', 'consumption', -14, 'order', 'ord-bom-only', ?, 'default'),
           ('sm-dual-ord', 'ing-def-milk', 'consumption', -7, 'order', 'ord-dual-1', ?, 'default'),
           ('sm-b-1', 'ing-b-matcha', 'consumption', -7, 'order', 'ord-b-1', ?, 'store-b')`
      ).run(recentSpaceTs, recentSpaceTs, recentSpaceTs);

      const db = createSqliteD1(sqlite);
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;

      // Kitchen role on 'default' sees ONLY 'ing-def-milk' (never 'ing-b-matcha'), with combined depletion = 7 (waste) + 7 (dual order once) + 14 (BOM only) = 28 -> 4/day
      const kitchenToken = await signStaffToken({ id: 'kitchen-def', role: 'kitchen', tenantId: 'default' });
      const defRes = await inventoryForecastingRouter.request(
        'http://localhost/run-rate?days=7',
        { headers: { Authorization: `Bearer ${kitchenToken}` } },
        env
      );
      expect(defRes.status).toBe(200);
      const defBody = (await defRes.json()) as { data: Array<{ id: string; daily_run_rate: number }> };
      expect(defBody.data.map((r) => r.id)).toEqual(['ing-def-milk']);
      expect(defBody.data[0].daily_run_rate).toBe(4);

      // Cashier role on 'store-b' sees 'ing-b-matcha' (not empty array!)
      const cashierBToken = await signStaffToken({ id: 'cashier-b', role: 'cashier', tenantId: 'store-b' });
      const bRes = await inventoryForecastingRouter.request(
        'http://localhost/run-rate?days=7',
        { headers: { Authorization: `Bearer ${cashierBToken}`, 'X-Tenant-ID': 'store-b' } },
        env
      );
      expect(bRes.status).toBe(200);
      const bBody = (await bRes.json()) as { data: Array<{ id: string; daily_run_rate: number }> };
      expect(bBody.data.map((r) => r.id)).toEqual(['ing-b-matcha']);
      expect(bBody.data[0].daily_run_rate).toBe(1);
    });

    it('persists inventory_snapshots on POST /snapshots/generate, allows cashier read on purchasing with high-entropy PO numbers, and runs checkInventoryAlerts for non-pilot SaaS tenants in handleScheduled', async () => {
      const sqlite = new DatabaseSync(':memory:');
      openDbs.push(sqlite);
      sqlite.exec(`
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY, sku TEXT, name TEXT, current_stock REAL, quantity REAL, min_quantity REAL, active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE inventory_snapshots (
          id TEXT PRIMARY KEY, item_id TEXT NOT NULL, date TEXT NOT NULL, opening_stock REAL NOT NULL, closing_stock REAL NOT NULL, tenant_id TEXT NOT NULL DEFAULT 'default'
        );
        CREATE TABLE inventory_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT, alert_type TEXT, current_qty REAL, threshold REAL, notified_at TEXT, tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE suppliers (
          id TEXT PRIMARY KEY, name TEXT, is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY, sku TEXT, name TEXT, cost_per_unit REAL DEFAULT 1000, current_stock REAL DEFAULT 10, is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE purchase_orders (
          id TEXT PRIMARY KEY, po_number TEXT, supplier_id TEXT, order_date TEXT, expected_delivery_date TEXT, status TEXT, subtotal REAL, tax REAL, total REAL, notes TEXT, created_by TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT, UNIQUE(tenant_id, po_number)
        );
        CREATE TABLE purchase_order_items (
          id TEXT PRIMARY KEY, purchase_order_id TEXT, ingredient_id TEXT, quantity REAL, unit_price REAL, total_price REAL, received_quantity REAL DEFAULT 0, tenant_id TEXT DEFAULT 'default'
        );
        INSERT INTO inventory_items (id, sku, name, current_stock, quantity, min_quantity, active, tenant_id) VALUES
          ('inv-b-low', 'SKU-LOW', 'Oat Milk B', 2, 2, 5, 1, 'store-b');
        INSERT INTO suppliers (id, name, is_active, tenant_id) VALUES ('sup-b', 'Supplier B', 1, 'store-b');
        INSERT INTO ingredients (id, sku, name, cost_per_unit, tenant_id) VALUES ('ing-b', 'ING-B', 'Syrup B', 50000, 'store-b');
      `);

      const db = createSqliteD1(sqlite);
      const snapApp = new Hono();
      snapApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-b', role: 'manager', tenantId: 'store-b' } as never);
        c.set('tenantId' as never, 'store-b' as never);
        await next();
      });
      inventorySnapshots(snapApp as never);

      const genRes = await snapApp.request(
        'http://localhost/snapshots/generate',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: '2026-11-25' }) },
        { AURA_DB: db }
      );
      expect(genRes.status).toBe(201);
      const savedSnap = sqlite
        .prepare('SELECT item_id, opening_stock, closing_stock, tenant_id FROM inventory_snapshots WHERE item_id = ?')
        .get('inv-b-low') as { item_id: string; opening_stock: number; closing_stock: number; tenant_id: string };
      expect(savedSnap).toEqual({
        item_id: 'inv-b-low',
        opening_stock: 2,
        closing_stock: 2,
        tenant_id: 'store-b',
      });

      // Purchasing: cashier can GET /suppliers & /purchase-orders; manager creates PO with PO-YYYYMMDD-XXXXXXXX
      let role = 'cashier';
      const purApp = new Hono();
      purApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'u-b', role, tenantId: 'store-b' } as never);
        c.set('tenantId' as never, 'store-b' as never);
        await next();
      });
      purchasing(purApp as never);

      const cashierSupRes = await purApp.request('http://localhost/suppliers', { method: 'GET' }, { AURA_DB: db });
      expect(cashierSupRes.status).toBe(200);

      role = 'manager';
      const createPoRes = await purApp.request(
        'http://localhost/purchase-orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplier_id: 'sup-b', items: [{ ingredient_id: 'ing-b', quantity: 4 }] }),
        },
        { AURA_DB: db }
      );
      expect(createPoRes.status).toBe(201);
      const poBody = (await createPoRes.json()) as { data: { po_number: string } };
      expect(poBody.data.po_number).toMatch(/^PO-\d{8}-[0-9A-F]{8}$/);

      // Scheduled cron scans non-pilot 'store-b' even when PILOT_TENANT_ID='default'
      const tasks: Promise<unknown>[] = [];
      await handleScheduled(
        { scheduledTime: Date.now(), cron: '*/5 * * * *', noRetry: () => {} } as unknown as ScheduledController,
        { AURA_DB: db, PILOT_TENANT_ID: 'default' } as unknown as Env,
        {
          waitUntil: (p: Promise<unknown>) => {
            tasks.push(p);
          },
          passThroughOnException: () => {},
        } as ExecutionContext
      );
      await Promise.allSettled(tasks);

      const alertRow = sqlite
        .prepare('SELECT item_id, alert_type, tenant_id FROM inventory_alerts WHERE item_id = ?')
        .get('inv-b-low') as { item_id: string; alert_type: string; tenant_id: string } | undefined;
      expect(alertRow).toEqual({
        item_id: 'inv-b-low',
        alert_type: 'low_stock',
        tenant_id: 'store-b',
      });
    });
  });

  describe('#229: Catalog Product Validators, Happy Hour ICT (UTC+7) & Customer Menu Slug Matching', () => {
    it('accepts boolean and 0|1 is_available, null description, and relative /photos/... image_url in product schemas', () => {
      const created = createProductSchema.safeParse({
        name: 'Bạc xỉu đá',
        price: 39000,
        category_id: 'cat-coffee',
        description: null,
        image_url: '/photos/bac-xiu.jpg',
        is_available: 1,
      });
      expect(created.success).toBe(true);
      if (created.success) {
        expect(created.data.is_available).toBe(true);
        expect(created.data.image_url).toBe('/photos/bac-xiu.jpg');
      }

      const toggled = updateProductSchema.safeParse({
        description: null,
        image_url: null,
        is_available: false,
      });
      expect(toggled.success).toBe(true);
      if (toggled.success) {
        expect(toggled.data.is_available).toBe(false);
      }

      // Protocol-relative '//evil.com' must still be rejected
      const badImg = createProductSchema.safeParse({
        name: 'Bad',
        price: 10000,
        image_url: '//evil.example.com/x.png',
      });
      expect(badImg.success).toBe(false);
    });

    it('evaluates Happy Hour in Asia/Ho_Chi_Minh (UTC+7), handles overnight windows, and applies categorySlug on getCustomerMenu/getCustomerMenuItem', async () => {
      // 2026-11-25T08:00:00Z = Wednesday 15:00 ICT (inside 14:00-17:00 ICT, outside 14:00-17:00 UTC!)
      const wednesday1500Ict = new Date('2026-11-25T08:00:00Z');
      const winAfternoon = {
        id: 'hh-ict',
        name: 'Afternoon ICT',
        day_of_week: 3, // Wednesday
        start_time: '14:00',
        end_time: '17:00',
        discount_rate: 0.2,
        apply_to: 'category' as const,
        apply_ids: '["coffee"]',
        priority: 1,
        active: 1,
      };
      expect(
        happyHourDiscountFor([winAfternoon], wednesday1500Ict, {
          productId: 'p1',
          categoryId: 'uuid-cat-1',
          categorySlug: 'coffee',
        })?.id
      ).toBe('hh-ict');

      // 2026-11-25T15:00:00Z = Wednesday 22:00 ICT (outside 14:00-17:00 ICT even though 15:00 UTC!)
      expect(
        happyHourDiscountFor([winAfternoon], new Date('2026-11-25T15:00:00Z'), {
          productId: 'p1',
          categorySlug: 'coffee',
        })
      ).toBeNull();

      // Overnight window: Wednesday 22:00 -> 02:00 ICT matches Thursday 01:00 ICT (2026-11-25T18:00:00Z)
      const overnightWin = {
        ...winAfternoon,
        id: 'hh-overnight',
        start_time: '22:00',
        end_time: '02:00',
        apply_to: 'all' as const,
        apply_ids: null,
      };
      expect(
        resolveItemPrice({
          basePriceCents: 50000,
          channel: 'dine_in',
          modifierChoices: [],
          happyHourWindows: [overnightWin],
          now: new Date('2026-11-25T18:00:00Z'),
        })
      ).toBe(40000);

      // getCustomerMenu & getCustomerMenuItem apply categorySlug Happy Hour
      const sqlite = new DatabaseSync(':memory:');
      openDbs.push(sqlite);
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1
        );
        CREATE TABLE menu_items (
          id TEXT PRIMARY KEY, name TEXT, description TEXT, price INTEGER, category TEXT, image_url TEXT, tags TEXT, available INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE happy_hour_windows (
          id TEXT PRIMARY KEY, name TEXT, day_of_week INTEGER, start_time TEXT, end_time TEXT, discount_rate REAL, apply_to TEXT, apply_ids TEXT, priority INTEGER DEFAULT 0, active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
        );
        INSERT INTO users (id, name, role, tenant_id) VALUES ('mgr-a', 'Manager A', 'manager', 'store-a');
      `);
      const nowIctDow = new Date(Date.now() + 7 * 3600_000).getUTCDay();
      sqlite.prepare(
        `INSERT INTO menu_items (id, name, description, price, category, available, tenant_id)
         VALUES ('mi-cf-1', 'Phin Đen', 'Đậm vị', 30000, 'coffee', 1, 'store-a')`
      ).run();
      sqlite.prepare(
        `INSERT INTO happy_hour_windows (id, name, day_of_week, start_time, end_time, discount_rate, apply_to, apply_ids, priority, active, tenant_id)
         VALUES ('hh-a', 'Coffee 20%', ?, '00:00', '23:59', 0.2, 'category', '["coffee"]', 5, 1, 'store-a')`
      ).run(nowIctDow);

      const db = createSqliteD1(sqlite);
      // Even without passing channel or now, getCustomerMenu & getCustomerMenuItem evaluate active Happy Hour
      const menu = await getCustomerMenu(db, { tenantId: 'store-a' });
      expect(menu.categories[0]?.items[0]?.priceCents).toBe(24000);

      const single = await getCustomerMenuItem(db, 'mi-cf-1', { tenantId: 'store-a' });
      expect(single?.priceCents).toBe(24000);

      // happyHourRouter allows creating an overnight window (start_time > end_time)
      const mgrToken = await signStaffToken({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const postOvernight = await happyHourRouter.fetch(
        new Request('http://localhost/happy-hour', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'store-a',
          },
          body: JSON.stringify({
            name: 'Night Owl',
            day_of_week: nowIctDow,
            start_time: '22:00',
            end_time: '02:00',
            allow_overnight: true,
            discount_rate: 0.15,
            apply_to: 'all',
          }),
        }),
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(postOvernight.status).toBe(201);

      // Verify frontend source contracts for ManageMenu & Inventory error banners + cache invalidation
      const modMgrSrc = readFileSync(resolve(__dirname, '../../../src/pages/admin/use-modifier-manager.ts'), 'utf8');
      expect(modMgrSrc).toContain("queryClient.invalidateQueries({ queryKey: ['menu'] })");
      const manageMenuSrc = readFileSync(resolve(__dirname, '../../../src/pages/admin/ManageMenu.tsx'), 'utf8');
      expect(manageMenuSrc).toContain("activeTab === 'happy-hour'");
      expect(manageMenuSrc).toContain('activeBannerError');
    });
  });

  describe('#230: DinDin BOM + PayOS QC, Reports Cashback/Churn, Honest Demand Forecast & ERPNext Persistence', () => {
    it('deducts BOM stock on DinDin checkout, creates PayOS payment record, and unblocks QC after payment confirmation', async () => {
      const sqlite = new DatabaseSync(':memory:');
      openDbs.push(sqlite);
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY, customer_name TEXT, customer_phone TEXT, customer_email TEXT, payment_method TEXT, payment_status TEXT, items TEXT, total INTEGER, status TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount INTEGER, status TEXT, transaction_id TEXT, payment_url TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
        );
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY, sku TEXT, name TEXT, unit TEXT, current_stock REAL, min_stock REAL, cost_per_unit REAL DEFAULT 0, is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default', updated_at TEXT
        );
        CREATE TABLE recipes (
          id TEXT PRIMARY KEY, product_id TEXT, name TEXT, instructions TEXT, is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE recipe_items (
          id TEXT PRIMARY KEY, recipe_id TEXT, ingredient_id TEXT, quantity REAL, unit TEXT, tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE stock_movements (
          id TEXT PRIMARY KEY, ingredient_id TEXT, type TEXT, quantity REAL, reference_id TEXT, reference_type TEXT, notes TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT
        );
        INSERT INTO ingredients (id, sku, name, unit, current_stock, min_stock, tenant_id)
        VALUES ('ing-beans', 'BEANS-1', 'Arabica Beans', 'g', 500, 50, 'store-a');
        INSERT INTO recipes (id, product_id, name, is_active, tenant_id)
        VALUES ('rcp-1', 'prod-latte', 'Latte Recipe', 1, 'store-a');
        INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity, unit, tenant_id)
        VALUES ('ri-1', 'rcp-1', 'ing-beans', 18, 'g', 'store-a');
      `);

      const db = createSqliteD1(sqlite);
      const { kv } = createMemoryKv({
        'dindin:store-a:config': JSON.stringify({
          menu: { sections: [{ items: [{ id: 'prod-latte', name: 'Latte', price: 45000, sold_out: false }] }] },
        }),
        'dindin:store-a:cart:sess-99': JSON.stringify({
          sessionId: 'sess-99',
          items: [{ id: 'prod-latte', name: 'Latte', price: 45000, qty: 2 }],
          total: 90000,
        }),
      });

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerCheckoutHandlers(app);
      const env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env;

      const checkoutRes = await app.request(
        'http://localhost/checkout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
          body: JSON.stringify({ sessionId: 'sess-99', payment_method: 'payos' }),
        },
        env
      );
      expect(checkoutRes.status).toBe(200);
      const checkoutBody = (await checkoutRes.json()) as { orderId: string; paymentId: string; orderCode: number };
      expect(checkoutBody.orderId).toMatch(/^DIN/);
      expect(checkoutBody.orderCode).toBeGreaterThan(0);

      // BOM deducted: 500 - (18 * 2) = 464
      const stockAfter = sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing-beans') as {
        current_stock: number;
      };
      expect(stockAfter.current_stock).toBe(464);

      // Payment row recorded in D1
      const payRow = sqlite.prepare('SELECT method, amount, status FROM payments WHERE order_id = ?').get(checkoutBody.orderId) as {
        method: string;
        amount: number;
        status: string;
      };
      expect(payRow).toEqual({ method: 'payos', amount: 90000, status: 'pending' });

      // Before payment confirmation, QC returns 409
      const qcBefore = await app.request(
        `http://localhost/checkout/${checkoutBody.orderId}/qc`,
        { method: 'POST', headers: { 'X-Tenant-ID': 'store-a' } },
        env
      );
      expect(qcBefore.status).toBe(409);

      // Confirm payment -> QC succeeds with 200
      const confirmRes = await app.request(
        `http://localhost/checkout/${checkoutBody.orderId}/confirm-payment`,
        { method: 'POST', headers: { 'X-Tenant-ID': 'store-a' } },
        env
      );
      expect(confirmRes.status).toBe(200);

      const qcAfter = await app.request(
        `http://localhost/checkout/${checkoutBody.orderId}/qc`,
        { method: 'POST', headers: { 'X-Tenant-ID': 'store-a' } },
        env
      );
      expect(qcAfter.status).toBe(200);
    });

    it('reads cashback earned/redeemed from cashback_transactions, returns churn_rate_30d = 0 for empty store, and returns honest empty demand forecast', async () => {
      const sqlite = new DatabaseSync(':memory:');
      openDbs.push(sqlite);
      sqlite.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1);
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT);
        CREATE TABLE orders (id TEXT PRIMARY KEY, customer_name TEXT, items TEXT, total REAL, status TEXT, payment_status TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT);
        CREATE TABLE checkins (id TEXT PRIMARY KEY, customer_id TEXT, reward_amount REAL, status TEXT, created_at TEXT);
        CREATE TABLE promotion_redemptions (id TEXT PRIMARY KEY, order_id TEXT, customer_id TEXT, discount_amount REAL, redeemed_at TEXT, created_at TEXT, tenant_id TEXT);
        CREATE TABLE cashback_wallets (id TEXT PRIMARY KEY, customer_id TEXT, balance REAL, tenant_id TEXT DEFAULT 'default');
        CREATE TABLE cashback_transactions (id TEXT PRIMARY KEY, wallet_id TEXT, customer_id TEXT, amount REAL, type TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT);
        INSERT INTO users (id, name, role, tenant_id) VALUES
          ('mgr-a', 'Mgr A', 'manager', 'store-a'),
          ('mgr-empty', 'Mgr Empty', 'manager', 'store-empty');
        INSERT INTO customers (id, name, phone, tenant_id, created_at, updated_at)
        VALUES ('cust-a', 'Alice', '0901112222', 'store-a', '2026-11-25 02:00:00', '2026-11-25 02:00:00');
        INSERT INTO cashback_wallets (id, customer_id, balance, tenant_id)
        VALUES ('wal-a', 'cust-a', 12000, 'store-a');
        INSERT INTO cashback_transactions (id, wallet_id, customer_id, amount, type, tenant_id, created_at) VALUES
          ('ctx-earn', 'wal-a', 'cust-a', 15000, 'earn', 'store-a', '2026-11-25 03:00:00'),
          ('ctx-spend', 'wal-a', 'cust-a', -3000, 'spend', 'store-a', '2026-11-25 04:00:00');
        -- Promo discount must NOT pollute cashback_redeemed
        INSERT INTO promotion_redemptions (id, order_id, customer_id, discount_amount, redeemed_at, created_at, tenant_id)
        VALUES ('pr-1', 'ord-a', 'cust-a', 50000, '2026-11-25 04:00:00', '2026-11-25 04:00:00', 'store-a');
        -- Unpaid order in store-empty must NOT inflate demand forecast
        INSERT INTO orders (id, customer_name, items, total, status, payment_status, tenant_id, created_at)
        VALUES ('ord-unpaid-empty', 'Guest', '[{"name":"Latte"}]', 95000, 'pending', 'unpaid', 'store-empty', '2026-11-25 02:00:00');
      `);

      const db = createSqliteD1(sqlite);
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;

      const repApp = new Hono<{ Bindings: Env }>();
      let caller = { id: 'mgr-a', role: 'manager', tenantId: 'store-a' };
      repApp.use('*', async (c, next) => {
        c.set('user' as never, caller as never);
        c.set('tenantId' as never, caller.tenantId as never);
        await next();
      });
      repApp.route('/api/reports', reportsRouter);

      const dailyRes = await repApp.request(
        'http://localhost/api/reports/daily?from=2026-11-25&to=2026-11-25',
        { headers: { 'X-Tenant-ID': 'store-a' } },
        env
      );
      expect(dailyRes.status).toBe(200);
      const dailyBody = (await dailyRes.json()) as {
        data: Array<{ cashback_earned: number; cashback_redeemed: number }>;
      };
      expect(dailyBody.data[0].cashback_earned).toBe(15000);
      expect(dailyBody.data[0].cashback_redeemed).toBe(3000);

      // Empty store summary -> churn_rate_30d = 0 (not 100!)
      caller = { id: 'mgr-empty', role: 'manager', tenantId: 'store-empty' };
      const emptySumRes = await repApp.request(
        'http://localhost/api/reports/summary',
        { headers: { 'X-Tenant-ID': 'store-empty' } },
        env
      );
      expect(emptySumRes.status).toBe(200);
      const emptySumBody = (await emptySumRes.json()) as {
        data: { total_customers: number; churn_rate_30d: number };
      };
      expect(emptySumBody.data.total_customers).toBe(0);
      expect(emptySumBody.data.churn_rate_30d).toBe(0);

      // Empty store demand forecast -> hasData: false, 0 projected orders/revenue, no Sa Đéc fabricated numbers
      const emptyMgrToken = await signStaffToken({ id: 'mgr-empty', role: 'manager', tenantId: 'store-empty' });
      const fcRes = await demandForecastRouter.request(
        'http://localhost/forecast?days=5',
        { headers: { Authorization: `Bearer ${emptyMgrToken}`, 'X-Tenant-ID': 'store-empty' } },
        env
      );
      expect(fcRes.status).toBe(200);
      const fcBody = (await fcRes.json()) as {
        data: {
          hasData: boolean;
          projected_total_orders: number;
          projected_total_revenue: number;
          staffing_advice: string;
        };
      };
      expect(fcBody.data.hasData).toBe(false);
      expect(fcBody.data.projected_total_orders).toBe(0);
      expect(fcBody.data.projected_total_revenue).toBe(0);
      expect(fcBody.data.staffing_advice).not.toContain('Sa Đéc');
    });

    it('checks ERPNEXT_API_SECRET for secret_set, upserts expenses/vendors/customers into D1, consumes webhook logs, and runs processErpnextProductSync', async () => {
      const sqlite = new DatabaseSync(':memory:');
      openDbs.push(sqlite);
      sqlite.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1);
        CREATE TABLE expenses (id TEXT PRIMARY KEY, amount REAL, category TEXT, date TEXT, description TEXT, erpnext_id TEXT, sync_status TEXT DEFAULT 'pending', tenant_id TEXT DEFAULT 'default', created_at TEXT DEFAULT (datetime('now')));
        CREATE TABLE suppliers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, address TEXT, tax_id TEXT, erpnext_id TEXT, sync_status TEXT, is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT);
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, erpnext_id TEXT, sync_status TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT);
        CREATE TABLE erpnext_mappings (id TEXT PRIMARY KEY, local_type TEXT, local_id TEXT, erpnext_id TEXT, erpnext_model TEXT, sync_status TEXT, last_synced_at TEXT, tenant_id TEXT DEFAULT 'default');
        CREATE TABLE erpnext_product_sync (product_id TEXT PRIMARY KEY, erpnext_product_id INTEGER NOT NULL DEFAULT 0, erpnext_item_code TEXT, cached_stock INTEGER, cached_price REAL, last_synced_at TEXT, erpnext_modified TEXT, erpnext_write_date TEXT, tenant_id TEXT DEFAULT 'default');
        CREATE TABLE erpnext_webhook_log (id INTEGER PRIMARY KEY AUTOINCREMENT, doctype TEXT, docname TEXT, action TEXT, payload TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT);
        INSERT INTO users (id, name, role, tenant_id) VALUES ('owner-a', 'Owner A', 'owner', 'store-a');
        INSERT INTO expenses (id, amount, category, date, description, tenant_id) VALUES ('exp-1', 120000, 'Ice', '2026-11-25', 'Mua đá', 'store-a');
        INSERT INTO suppliers (id, name, phone, tenant_id) VALUES ('sup-1', 'Fresh Dairy', '0909000111', 'store-a');
        INSERT INTO customers (id, name, phone, erpnext_id, tenant_id) VALUES ('cust-1', 'Bob', '0909222333', 'CUST-EXISTING-1', 'store-a');
      `);

      const db = createSqliteD1(sqlite);
      const { kv } = createMemoryKv({
        'erpnext:store-a:api_url': 'https://erp.store-a.test',
        'erpnext:store-a:api_key': 'key-only',
      });
      const ownerToken = await signStaffToken({ id: 'owner-a', role: 'owner', tenantId: 'store-a' });

      // 1. secret_set is false when api_secret is not set!
      const cfgRes = await handleErpnextRequest(
        new Request('http://localhost/api/erpnext/configure', {
          method: 'GET',
          headers: { Authorization: `Bearer ${ownerToken}`, 'X-Tenant-ID': 'store-a' },
        }),
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET },
        'store-a'
      );
      const cfgBody = (await cfgRes.json()) as { key_set: boolean; secret_set: boolean; configured: boolean };
      expect(cfgBody.key_set).toBe(true);
      expect(cfgBody.secret_set).toBe(false);
      expect(cfgBody.configured).toBe(false);

      // Add secret for real sync calls
      await kv.put('erpnext:store-a:api_secret', 'sec-123');

      const erpRequests: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
          const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
          const method = init?.method || 'GET';
          const parsedBody = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
          erpRequests.push({ url: urlStr, method, body: parsedBody });
          if (urlStr.includes('/api/resource/Employee')) {
            return new Response(JSON.stringify({ data: [{ name: 'HR-EMP-00099' }] }), { status: 200 });
          }
          if (urlStr.includes('/api/resource/Item') && method === 'GET') {
            return new Response(
              JSON.stringify({
                data: [{ name: 'ITEM-CF-01', item_code: 'CF-01', item_name: 'Phin Sữa', modified: '2026-11-25 10:00:00' }],
              }),
              { status: 200 }
            );
          }
          if (urlStr.includes('/api/resource/Expense%20Claim')) {
            return new Response(JSON.stringify({ data: { name: 'EXP-CLM-001' } }), { status: 200 });
          }
          if (urlStr.includes('/api/resource/Supplier')) {
            return new Response(JSON.stringify({ data: { name: 'SUP-ERP-001' } }), { status: 200 });
          }
          if (urlStr.includes('/api/resource/Customer/CUST-EXISTING-1')) {
            return new Response(JSON.stringify({ data: { name: 'CUST-EXISTING-1' } }), { status: 200 });
          }
          return new Response(JSON.stringify({ data: [] }), { status: 200 });
        })
      );

      const erpApp = new Hono<{ Bindings: Env }>();
      expenseRoutes(erpApp);
      vendorRoutes(erpApp);
      customerRoutes(erpApp);
      const env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env;

      // Expense sync resolves employee 'HR-EMP-00099' (never '') and updates expenses.erpnext_id
      const expRes = await erpApp.request(
        'http://localhost/api/erpnext/expenses/sync',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
          body: JSON.stringify({ id: 'exp-1', amount: 120000, category: 'Ice', date: '2026-11-25' }),
        },
        env
      );
      expect(expRes.status).toBe(200);
      const expCreateCall = erpRequests.find((r) => r.url.includes('Expense%20Claim') && r.method === 'POST');
      expect(expCreateCall?.body?.employee).toBe('HR-EMP-00099');
      const expRow = sqlite.prepare('SELECT erpnext_id, sync_status FROM expenses WHERE id = ?').get('exp-1') as {
        erpnext_id: string;
        sync_status: string;
      };
      expect(expRow).toEqual({ erpnext_id: 'EXP-CLM-001', sync_status: 'synced' });

      // Vendor sync persists erpnext_id + sync_status + erpnext_mappings
      const venRes = await erpApp.request(
        'http://localhost/api/erpnext/vendors/sync',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
          body: JSON.stringify({ id: 'sup-1', name: 'Fresh Dairy', phone: '0909000111' }),
        },
        env
      );
      expect(venRes.status).toBe(200);
      const supRow = sqlite.prepare('SELECT erpnext_id, sync_status FROM suppliers WHERE id = ?').get('sup-1') as {
        erpnext_id: string;
        sync_status: string;
      };
      expect(supRow).toEqual({ erpnext_id: 'SUP-ERP-001', sync_status: 'synced' });

      // Customer sync with existing erpnext_id uses PUT update instead of duplicate POST create
      const custRes = await erpApp.request(
        'http://localhost/api/erpnext/customers/sync',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
          body: JSON.stringify({ id: 'cust-1', name: 'Bob', phone: '0909222333' }),
        },
        env
      );
      expect(custRes.status).toBe(200);
      expect(erpRequests.some((r) => r.url.includes('/Customer/CUST-EXISTING-1') && r.method === 'PUT')).toBe(true);

      // Webhook consumer & processErpnextProductSync persist into erpnext_product_sync
      const whPayload = JSON.stringify({
        doctype: 'Item',
        docname: 'WH-ITEM-01',
        action: 'on_update',
        data: { item_code: 'WH-ITEM-01', actual_qty: 42, standard_rate: 35000 },
      });
      const whRes = await handleErpnextPosRequest(
        new Request('http://localhost/api/erpnext-pos/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-ERPNext-Webhook-Secret': 'wh-sec' },
          body: whPayload,
        }),
        { AURA_DB: db, AUTH_KV: kv, ERPNEXT_WEBHOOK_SECRET: 'wh-sec', ERPNEXT_WEBHOOK_TENANT: 'store-a' },
        'store-a'
      );
      expect(whRes.status).toBe(200);

      const whSynced = sqlite
        .prepare('SELECT cached_stock, tenant_id FROM erpnext_product_sync WHERE product_id = ?')
        .get('store-a::WH-ITEM-01') as { cached_stock: number; tenant_id: string };
      expect(whSynced).toEqual({ cached_stock: 42, tenant_id: 'store-a' });

      const cronProdRes = await processErpnextProductSync({ AURA_DB: db, AUTH_KV: kv }, 'store-a');
      expect(cronProdRes.synced).toBe(1);
      expect(cronProdRes.errors).toBe(0);

      const replayCount = await processErpnextWebhookLog(db, kv, 'store-a');
      expect(replayCount).toBe(1);
    });
  });

  describe('#231: Daily Reconciliation Multi-Shift Float, Sales CSV ICT/Settled, Payout, Net Partial Refunds & P&L', () => {
    it('prevents multi-shift opening_float multiplication, returns handover fields, aligns overnight shift & cod_paid_at business dates, and flags shipper COD shifts', async () => {
      const sqlite = new DatabaseSync(':memory:');
      openDbs.push(sqlite);
      sqlite.exec(`
        CREATE TABLE settings (key TEXT, value TEXT, tenant_id TEXT DEFAULT 'default');
        CREATE TABLE staff_shifts (
          id TEXT PRIMARY KEY, staff_id TEXT, staff_name TEXT, role TEXT, date TEXT, clock_in TEXT, clock_out TEXT, opening_cash REAL DEFAULT 0, tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE shift_reconciliations (
          id TEXT PRIMARY KEY, shift_id TEXT, staff_id TEXT DEFAULT '', opening_float REAL DEFAULT 0, cash_payment_total REAL DEFAULT 0, cash_payout_total REAL DEFAULT 0, expected_cash REAL DEFAULT 0, actual_cash REAL DEFAULT 0, variance REAL DEFAULT 0, variance_status TEXT DEFAULT 'balanced', denominations TEXT DEFAULT '{}', remitted_cash REAL DEFAULT 0, closing_float REAL DEFAULT 0, handover_to_staff_id TEXT, online_sales_total REAL DEFAULT 0, reconciled_by TEXT DEFAULT '', tenant_id TEXT DEFAULT 'default', created_at TEXT
        );
        CREATE TABLE cash_payment_attributions (
          payment_id TEXT PRIMARY KEY, tenant_id TEXT, shift_id TEXT, collected_by TEXT, settled_at TEXT
        );
        CREATE TABLE cash_payouts (
          id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', shift_id TEXT, amount REAL, reason TEXT, status TEXT DEFAULT 'completed', created_at TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY, customer_name TEXT, items TEXT, total REAL, status TEXT, payment_status TEXT, payment_method TEXT, cod_paid_at TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, refund_amount REAL DEFAULT 0, status TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT
        );

        -- 3 sequential shifts on 2026-11-18 carrying forward a 2,000,000 float (3rd shift reconciled at 02:00 ICT on 2026-11-19 = 19:00Z on 2026-11-18!)
        INSERT INTO staff_shifts (id, staff_id, staff_name, role, date, clock_in, clock_out, opening_cash, tenant_id) VALUES
          ('sh-1', 'c1', 'Cashier Morning', 'cashier', '2026-11-18', '2026-11-18T00:00:00Z', '2026-11-18T07:00:00Z', 2000000, 'default'),
          ('sh-2', 'c2', 'Cashier Afternoon', 'cashier', '2026-11-18', '2026-11-18T07:00:00Z', '2026-11-18T14:00:00Z', 2000000, 'default'),
          ('sh-3', 'c3', 'Cashier Night', 'cashier', '2026-11-18', '2026-11-18T15:00:00Z', '2026-11-18T19:00:00Z', 2000000, 'default'),
          ('sh-ship-unrec', 'ship1', 'Shipper Minh', 'shipper', '2026-11-18', '2026-11-18T09:00:00Z', '2026-11-18T16:00:00Z', 0, 'default');

        INSERT INTO cash_payment_attributions (payment_id, tenant_id, shift_id, collected_by, settled_at)
        VALUES ('pay-ship-1', 'default', 'sh-ship-unrec', 'ship1', '2026-11-18T10:00:00Z');

        INSERT INTO shift_reconciliations (
          id, shift_id, staff_id, opening_float, cash_payment_total, cash_payout_total, expected_cash, actual_cash, variance, variance_status, denominations, reconciled_by, tenant_id, created_at
        ) VALUES
          ('r-1', 'sh-1', 'c1', 2000000, 500000, 50000, 2450000, 2450000, 0, 'balanced', '{"denominations":[{"denomination":500000,"count":4}],"remitted_cash":450000,"closing_float":2000000,"handover_to_staff_id":"c2","online_sales_total":120000}', 'c1', 'default', '2026-11-18T07:05:00Z'),
          ('r-2', 'sh-2', 'c2', 2000000, 600000, 0, 2600000, 2590000, -10000, 'short', '{"denominations":[{"denomination":500000,"count":5}],"remitted_cash":590000,"closing_float":2000000,"handover_to_staff_id":"c3","online_sales_total":80000}', 'c2', 'default', '2026-11-18T14:05:00Z'),
          ('r-3', 'sh-3', 'c3', 2000000, 400000, 0, 2400000, 2400000, 0, 'balanced', '{"denominations":[{"denomination":500000,"count":4}],"remitted_cash":400000,"closing_float":2000000,"online_sales_total":50000}', 'mgr-1', 'default', '2026-11-18T19:05:00Z');

        -- COD placed on 2026-11-17, collected on 2026-11-18; plus partially_refunded PayOS order (200k gross - 50k refund = 150k net)
        INSERT INTO orders (id, customer_name, items, total, status, payment_status, payment_method, cod_paid_at, tenant_id, created_at) VALUES
          ('ord-cod-collected', 'COD Buyer', '[]', 100000, 'completed', 'paid', 'cod', '2026-11-18T03:00:00Z', 'default', '2026-11-17T14:00:00Z'),
          ('ord-payos-partial', 'Online Buyer', '[]', 200000, 'completed', 'partially_refunded', 'payos', NULL, 'default', '2026-11-18T04:00:00Z');
        INSERT INTO payments (id, order_id, method, amount, refund_amount, status, tenant_id, created_at)
        VALUES ('pay-part-1', 'ord-payos-partial', 'payos', 200000, 50000, 'completed', 'default', '2026-11-18T04:00:00Z');
      `);

      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'owner-1', role: 'owner', tenantId: 'default' } as never);
        c.set('tenantId' as never, 'default' as never);
        await next();
      });
      app.route('/api/reports', reportsRouter);

      const res = await app.request(
        'http://localhost/api/reports/reconciliation?from=2026-11-18&to=2026-11-18',
        {},
        { AURA_DB: db, CASH_RECONCILIATION_ENABLED: 'true', JWT_SECRET } as unknown as Env
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          shifts: Array<{
            shift_id: string;
            remitted_cash: number;
            closing_float: number;
            handover_to_staff_id: string | null;
            online_sales_total: number;
            staff_id: string;
            reconciled_by: string;
          }>;
          unreconciled_shifts: Array<{ shift_id: string; staff_name: string }>;
          totals: {
            opening_float: number;
            remitted_cash: number;
            closing_float: number;
            cash_expected: number;
            cash_actual: number;
            cash_variance: number;
            revenue: number;
            digital_payments: number;
          };
        };
      };

      // All 3 shifts (including sh-3 closed at 02:05 ICT next morning) belong to business date 2026-11-18
      expect(body.data.shifts).toHaveLength(3);
      const sh1 = body.data.shifts.find((s) => s.shift_id === 'sh-1')!;
      expect(sh1.remitted_cash).toBe(450000);
      expect(sh1.closing_float).toBe(2000000);
      expect(sh1.handover_to_staff_id).toBe('c2');
      expect(sh1.online_sales_total).toBe(120000);
      expect(sh1.staff_id).toBe('c1');

      // Opening float 2,000,000 counted ONCE: 2,000,000 + (500k + 600k + 400k) - 50k = 3,450,000 (NOT 7,450,000!)
      expect(body.data.totals.opening_float).toBe(2000000);
      expect(body.data.totals.cash_expected).toBe(3450000);
      expect(body.data.totals.cash_actual).toBe(3440000);
      expect(body.data.totals.cash_variance).toBe(-10000);
      expect(body.data.totals.remitted_cash).toBe(1440000);
      expect(body.data.totals.closing_float).toBe(2000000);

      // Revenue = 100k (COD settled on 2026-11-18) + 150k (200k - 50k partial refund) = 250k; digital_payments = 150k
      expect(body.data.totals.revenue).toBe(250000);
      expect(body.data.totals.digital_payments).toBe(150000);

      // Shipper shift with cash_payment_attributions (even though opening_cash = 0) is flagged as unreconciled!
      expect(body.data.unreconciled_shifts.map((u) => u.shift_id)).toEqual(['sh-ship-unrec']);
    });

    it('enforces settled ICT accounting & net partial refunds across sales CSV, /payout, reports, analytics summary, order stats, and multi-day P&L with cash_payouts', async () => {
      const sqlite = new DatabaseSync(':memory:');
      openDbs.push(sqlite);
      const nowIctDate = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
      // 00:30 ICT on nowIctDate = 17:30Z on the previous UTC day!
      const earlyMorningIctAsUtc = new Date(`${nowIctDate}T00:30:00+07:00`).toISOString();

      sqlite.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1);
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, loyalty_tier TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT);
        CREATE TABLE orders (
          id TEXT PRIMARY KEY, customer_id TEXT, customer_name TEXT, customer_phone TEXT, items TEXT,
          subtotal REAL DEFAULT 0, discount REAL DEFAULT 0, shipping_fee REAL DEFAULT 0, service_fee REAL DEFAULT 0, tip_amount REAL DEFAULT 0,
          total REAL DEFAULT 0, is_cod INTEGER DEFAULT 0, status TEXT, payment_status TEXT, payment_method TEXT, notes TEXT,
          tenant_id TEXT DEFAULT 'default', created_at TEXT
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, refund_amount REAL DEFAULT 0, status TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT, refunded_at TEXT
        );
        CREATE TABLE refunds (
          id TEXT PRIMARY KEY, order_id TEXT, amount REAL, status TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT
        );
        CREATE TABLE cash_payouts (
          id TEXT PRIMARY KEY, shift_id TEXT, amount REAL, reason TEXT, status TEXT DEFAULT 'completed', tenant_id TEXT DEFAULT 'default', created_at TEXT
        );
        INSERT INTO users (id, name, role, tenant_id) VALUES ('owner-1', 'Owner', 'owner', 'default');
        INSERT INTO customers (id, name, email, phone, loyalty_tier, tenant_id, created_at)
        VALUES ('cust-1', 'Lan', 'lan@aura.vn', '0908887777', 'silver', 'default', '${earlyMorningIctAsUtc}');
      `);

      sqlite.prepare(
        `INSERT INTO orders (id, customer_id, customer_name, customer_phone, items, subtotal, total, is_cod, status, payment_status, payment_method, tenant_id, created_at)
         VALUES
           ('ord-cod-prep', 'cust-1', 'Lan', '0908887777', '[{"name":"Cà phê sữa","quantity":1,"price":80000}]', 80000, 80000, 1, 'delivering', 'paid', 'cod', 'default', ?),
           ('ord-payos-conf', 'cust-1', 'Lan', '0908887777', '[{"name":"Trà đào","quantity":2,"price":100000}]', 200000, 200000, 0, 'confirmed', 'partially_refunded', 'payos', 'default', ?),
           ('ord-cod-unpaid', NULL, 'Unpaid COD', '0900000001', '[{"name":"Bánh","quantity":1,"price":90000}]', 90000, 90000, 1, 'delivering', 'cod_pending', 'cod', 'default', ?),
           ('ord-qr-placeholder', NULL, 'Khách QR - cho don mon', '', '[]', 0, 0, 0, 'pending', 'paid', 'payos', 'default', ?)`
      ).run(earlyMorningIctAsUtc, earlyMorningIctAsUtc, earlyMorningIctAsUtc, earlyMorningIctAsUtc);

      sqlite.prepare(
        `INSERT INTO payments (id, order_id, method, amount, refund_amount, status, tenant_id, created_at)
         VALUES ('pay-conf-1', 'ord-payos-conf', 'payos', 200000, 50000, 'completed', 'default', ?)`
      ).run(earlyMorningIctAsUtc);

      const db = createSqliteD1(sqlite);
      const ownerToken = await signStaffToken({ id: 'owner-1', role: 'owner', tenantId: 'default' });
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;

      // 1. /api/admin/sales/csv includes 00:30 ICT order under nowIctDate, subtracts 50k partial refund (200k -> 150k), and excludes unpaid COD & QR placeholder
      const salesApp = new Hono<{ Bindings: Env }>();
      salesApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'owner-1', role: 'owner', tenantId: 'default' } as never);
        c.set('tenantId' as never, 'default' as never);
        await next();
      });
      salesApp.route('/api/admin/sales', adminSalesRouter);

      const csvRes = await salesApp.request(
        `http://localhost/api/admin/sales/csv?start=${nowIctDate}&end=${nowIctDate}`,
        {},
        env
      );
      expect(csvRes.status).toBe(200);
      const csvText = await csvRes.text();
      expect(csvText).toContain(`ord-cod-prep,${nowIctDate},Lan,1: Cà phê sữa,80000`);
      expect(csvText).toContain(`ord-payos-conf,${nowIctDate},Lan,1: Trà đào,150000`);
      expect(csvText).not.toContain('ord-cod-unpaid');
      expect(csvText).not.toContain('ord-qr-placeholder');

      // 2. /api/analytics/payout counts 'delivering' paid COD (80k) + 'confirmed' partially_refunded PayOS (150k net), refunded=50k, total_orders=2 (excluding unpaid COD!)
      const analyticsApp = new Hono<{ Bindings: Env }>();
      registerMetricsHandlers(analyticsApp);
      const payoutRes = await analyticsApp.request(
        'http://localhost/payout',
        { headers: { Authorization: `Bearer ${ownerToken}` } },
        env
      );
      expect(payoutRes.status).toBe(200);
      const payoutBody = (await payoutRes.json()) as {
        data: { cod: number; payos: number; refunded: number; net: number; total_orders: number };
      };
      expect(payoutBody.data).toEqual({
        cod: 80000,
        payos: 150000,
        refunded: 50000,
        net: 230000,
        total_orders: 2,
      });

      // 3. tree/analytics/summary & domain/order/queries/stats net partial refunds (80k + 150k = 230k)
      const summaryMetrics = await getSummary(db, 7, 'default');
      expect(summaryMetrics.total_orders).toBe(2);
      expect(summaryMetrics.total_revenue).toBe(230000);

      const paymentGroups = await getGrouped(db, 'payment', 7, 'default');
      expect(paymentGroups.find((g) => g.label === 'payos')?.value).toBe(150000);

      const statsResp = await getStats(new Request('http://localhost/api/orders/stats'), { AURA_DB: db }, 'default');
      const statsJson = (await statsResp.json()) as { stats: { orders_today: number; revenue_today: number } };
      expect(statsJson.stats.orders_today).toBe(2);
      expect(statsJson.stats.revenue_today).toBe(230000);

      // 4. Reports /orders, /overview, /export?type=revenue, and multi-day /pnl (with cash_payouts + unclamped negative refund day!)
      const repApp = new Hono<{ Bindings: Env }>();
      repApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'owner-1', role: 'owner', tenantId: 'default' } as never);
        c.set('tenantId' as never, 'default' as never);
        await next();
      });
      repApp.route('/api/reports', reportsRouter);

      const repOrdersRes = await repApp.request(
        `http://localhost/api/reports/orders?from=${nowIctDate}&to=${nowIctDate}`,
        {},
        env
      );
      const repOrdersBody = (await repOrdersRes.json()) as {
        data: Array<{ status: string; count: number; revenue: number }>;
      };
      // 'delivering' has 1 paid (80k) and 1 unpaid (0 revenue, NOT 90k!); 'confirmed' has 150k net
      expect(repOrdersBody.data.find((r) => r.status === 'delivering')?.revenue).toBe(80000);
      expect(repOrdersBody.data.find((r) => r.status === 'confirmed')?.revenue).toBe(150000);

      // Seed multi-day P&L: Day 1 (2026-11-01) sales 300k; Day 2 (2026-11-02) 0 new sales + 100k partial refund on Day 1's order + 25k ice cash payout + 10k refund payout (ignored to avoid double-counting)
      sqlite.exec(`
        INSERT INTO orders (id, customer_name, items, subtotal, total, status, payment_status, payment_method, tenant_id, created_at)
        VALUES ('ord-pnl-d1', 'VIP', '[]', 300000, 300000, 'completed', 'partially_refunded', 'cash', 'default', '2026-11-01 03:00:00');
        INSERT INTO refunds (id, order_id, amount, status, tenant_id, created_at)
        VALUES ('ref-pnl-d2', 'ord-pnl-d1', 100000, 'completed', 'default', '2026-11-02 04:00:00');
        INSERT INTO cash_payouts (id, shift_id, amount, reason, status, tenant_id, created_at) VALUES
          ('cp-ice', 'sh-pnl', 25000, 'Mua đá viên khẩn', 'completed', 'default', '2026-11-02 05:00:00'),
          ('cp-ref-dup', 'sh-pnl', 10000, 'Hoàn tiền khách tại quầy', 'completed', 'default', '2026-11-02 05:30:00');
      `);

      const pnlRes = await repApp.request(
        'http://localhost/api/reports/pnl?from=2026-11-01&to=2026-11-02',
        {},
        env
      );
      expect(pnlRes.status).toBe(200);
      const pnlBody = (await pnlRes.json()) as {
        data: {
          daily: Array<{ date: string; net_revenue: number; cash_payouts: number; operating_profit: number }>;
          totals: { net_revenue: number; refunds: number; cash_payouts: number; gross_profit: number; operating_profit: number };
        };
      };
      const d2 = pnlBody.data.daily.find((d) => d.date === '2026-11-02')!;
      // Day 2 net_revenue is -100,000 (not clamped to 0!), so 2-day totals.net_revenue = 300,000 - 100,000 = 200,000!
      expect(d2.net_revenue).toBe(-100000);
      expect(d2.cash_payouts).toBe(25000);
      expect(pnlBody.data.totals.net_revenue).toBe(200000);
      expect(pnlBody.data.totals.refunds).toBe(100000);
      expect(pnlBody.data.totals.cash_payouts).toBe(25000);
      expect(pnlBody.data.totals.gross_profit).toBe(200000);
      expect(pnlBody.data.totals.operating_profit).toBe(175000);
    });
  });
});
