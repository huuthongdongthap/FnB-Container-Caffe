// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { createOrder } from '../../../../packages/domain/order/commands/create-order';
import { shiftsRouter } from '../../../../packages/domain/shift/commands/shifts';
import { createSchedule } from '../../../../packages/domain/shift/commands/schedules';
import { shiftScope } from '../../../../packages/domain/shift/commands/shift-access';
import { stationTicketsRouter } from '../../../../packages/domain/kitchen/commands/kitchen-station-tickets';
import { inventoryCRUD } from '../../../../packages/domain/inventory/src/routes/inventory-crud';
import { inventoryForecastingRouter } from '../../routes/inventory-forecasting';
import { registerCampaignConfigHandlers } from '../../routes/campaigns-handlers/config-handlers';
import { issueStaffSession } from '../../lib/staff-session';
import type { Env } from '../../types/env';

function createSqliteMasterReplica() {
  const sqlite = new DatabaseSync(':memory:');
  const runStatement = new WeakMap<object, () => unknown>();

  // Exact DDL copied from remote fnb-caffe-db sqlite_master prior to 20261029_03..06
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT,
      email TEXT,
      auth_version INTEGER NOT NULL DEFAULT 1,
      password_hash TEXT
    );
    INSERT INTO users (id, name, role, phone, is_active, tenant_id) VALUES
      ('USR_OWNER_001', 'AURA Owner', 'owner', '0901234567', 1, 'default'),
      ('USR_morztzcs6p52k', 'Phan Hữu Thông', 'staff', '0915997989', 1, 'tenant_sadec_01');

    CREATE TABLE staff_login_identities (
      email TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL UNIQUE REFERENCES users(id)
    );

    CREATE TABLE staff_shifts (
      id           TEXT PRIMARY KEY,
      staff_email  TEXT NOT NULL,
      clock_in     TEXT NOT NULL,
      clock_out    TEXT,
      shift_type   TEXT,
      notes        TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO staff_shifts (id, staff_email, clock_in, shift_type) VALUES
      ('SHF_LEGACY_1', 'legacy@auraspace.vn', '2026-08-03T08:00:00Z', 'morning');

    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      phone TEXT,
      loyalty_points INTEGER DEFAULT 0,
      loyalty_tier TEXT DEFAULT 'bronze',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_of_birth TEXT,
      zalo TEXT,
      source TEXT DEFAULT 'unknown',
      lifetime_points INTEGER DEFAULT 0
    );

    CREATE TABLE cashback_wallets (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      balance REAL DEFAULT 0,
      total_earned REAL DEFAULT 0,
      total_spent REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE promotions (
      code TEXT PRIMARY KEY,
      percent INTEGER NOT NULL,
      max_discount INTEGER DEFAULT 0,
      min_order INTEGER DEFAULT 0,
      usage_limit INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      starts_at TEXT,
      expires_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE bonus_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      cashback_multiplier REAL DEFAULT 1.0,
      signup_bonus_vnd INTEGER DEFAULT 0,
      signup_bonus_cap INTEGER,
      refer_bonus_vnd INTEGER DEFAULT 20000,
      max_cap_per_customer_vnd INTEGER DEFAULT 50000,
      auto_upgrade_tier TEXT,
      auto_upgrade_min_spend INTEGER,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE signup_bonus_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT NOT NULL,
      campaign_id INTEGER NOT NULL,
      bonus_vnd INTEGER NOT NULL,
      granted_at TEXT DEFAULT (datetime('now')),
      UNIQUE(customer_id, campaign_id)
    );

    CREATE TABLE loyalty_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT,
      staff_id TEXT,
      action TEXT NOT NULL,
      amount_vnd REAL,
      order_id TEXT,
      metadata TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referred_customer_id TEXT NOT NULL,
      referral_code TEXT NOT NULL,
      points_awarded INTEGER DEFAULT 200,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      cashback_awarded_vnd INTEGER DEFAULT 0,
      first_order_id TEXT,
      first_order_amount REAL,
      reward_paid_at TEXT
    );

    CREATE TABLE contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      category TEXT,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE recruitment_applications (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      birth_year TEXT,
      position TEXT NOT NULL DEFAULT 'barista',
      shifts TEXT NOT NULL DEFAULT '[]',
      experience TEXT DEFAULT 'none',
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE sop_violations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      staff_id TEXT NOT NULL,
      staff_name TEXT,
      category TEXT NOT NULL,
      is_serious INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      occurred_at TEXT,
      recorded_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'recorded',
      discipline_step TEXT,
      confirmed_by TEXT,
      confirmed_at TEXT,
      applied_by TEXT,
      applied_at TEXT,
      appeal_explanation TEXT,
      audit_log_id TEXT,
      closed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO categories (id, name, slug, sort_order) VALUES
      ('cat_trad_coffee', 'Cà phê truyền thống', 'traditional-coffee', 1),
      ('cat_hot_coffee',  'Cà phê máy',          'hot-coffee',         2),
      ('cat_tea',         'Trà trái cây',        'tea',                3),
      ('cat_other',       'Thức uống khác',      'other-drinks',       4),
      ('cat_yogurt',      'Sữa chua',            'yogurt',             5);

    CREATE TABLE menu_items (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      tags TEXT,
      badge TEXT,
      available BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_local_specialty INTEGER DEFAULT 0,
      ingredient_source TEXT,
      image_url TEXT
    );
    INSERT INTO menu_items (id, category, name, price, available) VALUES
      ('tc002', 'traditional-coffee', 'Cà phê Sữa',      29000, 1),
      ('te001', 'tea',                'Trà Đào Cam Sả',  39000, 1),
      ('ot001', 'other-drinks',       'Matcha Latte',    42000, 1);

    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      image_url TEXT,
      tags TEXT,
      badge TEXT,
      is_available BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      slug TEXT DEFAULT '',
      compare_at_price INTEGER,
      sort_order INTEGER DEFAULT 0
    );
    INSERT INTO products (id, category_id, name, price, is_available, sort_order) VALUES
      ('tc002', 'cat_trad_coffee', 'Cà phê Sữa',      29000, 1, 1),
      ('te001', 'cat_tea',         'Trà Đào Cam Sả',  39000, 1, 2),
      ('ot001', 'cat_other',       'Matcha Latte',    42000, 1, 3);

    CREATE TABLE modifier_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'single',
      required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE modifier_choices (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price_delta INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      is_available INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
    );

    CREATE TABLE product_modifier_groups (
      product_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (product_id, group_id)
    );

    CREATE TABLE menu_modifiers (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      option_name TEXT NOT NULL,
      price_delta INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE kitchen_stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE category_stations (
      category_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      PRIMARY KEY (category_id, station_id)
    );

    CREATE TABLE order_item_stations (
      order_item_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      started_at TEXT,
      ready_at TEXT,
      PRIMARY KEY (order_item_id, station_id)
    );

    CREATE TABLE cafe_tables (
      id TEXT PRIMARY KEY,
      table_number INTEGER NOT NULL,
      zone TEXT NOT NULL,
      seats INTEGER DEFAULT 2,
      status TEXT DEFAULT 'Available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      updated_at DATETIME,
      notes TEXT
    );
    INSERT INTO cafe_tables (id, table_number, zone, seats, status, tenant_id) VALUES
      ('t01', 1, 'Indoor', 4, 'Occupied', 'default'),
      ('t02', 2, 'Indoor', 4, 'Available', 'default');

    CREATE TABLE table_sessions (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE table_qr_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER NOT NULL UNIQUE REFERENCES cafe_tables(id),
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      items TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      customer_address TEXT,
      payment_method TEXT NOT NULL,
      payment_status TEXT DEFAULT 'unpaid',
      shipping_fee INTEGER DEFAULT 0,
      discount INTEGER DEFAULT 0,
      notes TEXT,
      delivery_time TEXT,
      table_id TEXT,
      subtotal INTEGER,
      tax INTEGER DEFAULT 0,
      total_amount INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      cashback_used REAL DEFAULT 0,
      cashback_earned REAL DEFAULT 0,
      points_earned INTEGER DEFAULT 0,
      reward_code_used TEXT,
      customer_id TEXT,
      staff_id TEXT,
      table_number TEXT,
      is_cod INTEGER DEFAULT 0,
      cod_paid_at TEXT,
      fulfillment_type TEXT DEFAULT 'DINE_IN',
      delivery_address TEXT,
      locale TEXT DEFAULT 'vi-VN',
      location_id TEXT DEFAULT 'sa-dec-main',
      order_type TEXT DEFAULT 'dine_in',
      tip_amount INTEGER DEFAULT 0,
      service_fee INTEGER DEFAULT 0,
      updated_by TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      subtotal INTEGER NOT NULL,
      modifiers TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      method TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      transaction_id TEXT,
      payment_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE happy_hour_windows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      discount_rate REAL NOT NULL DEFAULT 0,
      apply_to TEXT NOT NULL DEFAULT 'all',
      apply_ids TEXT,
      priority INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL DEFAULT 'raw_materials',
      unit TEXT NOT NULL DEFAULT 'pcs',
      cost_per_unit REAL DEFAULT 0,
      current_stock REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      max_stock REAL NOT NULL DEFAULT 1000,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE inventory_items (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT,
      category TEXT NOT NULL DEFAULT 'raw_materials',
      unit TEXT NOT NULL DEFAULT 'pcs',
      current_stock REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      max_stock REAL NOT NULL DEFAULT 1000,
      cost_per_unit REAL DEFAULT 0,
      supplier TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE inventory_transactions (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjust', 'waste', 'reserve', 'release')),
      quantity REAL NOT NULL,
      reference_id TEXT,
      reference_type TEXT CHECK(reference_type IN ('order', 'purchase', 'adjustment', 'waste_report', 'sync')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    );

    CREATE TABLE recipes (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT,
      instructions TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE recipe_items (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'g',
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
    );

    CREATE TABLE stock_movements (
      id TEXT PRIMARY KEY,
      ingredient_id TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_id TEXT,
      reference_type TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
    );

    CREATE TABLE campaign_configs (
      trigger TEXT PRIMARY KEY CHECK (trigger IN ('welcome', 'birthday', 'winback', 'post_visit', 'cashback_expiry')),
      is_active INTEGER NOT NULL DEFAULT 1,
      channels TEXT NOT NULL DEFAULT '["sms"]',
      timing TEXT,
      updated_at TEXT
    );
  `);

  function prepare(sql: string, bound: unknown[] = []): D1PreparedStatement {
    const stmt = {
      bind(...values: unknown[]) {
        return prepare(sql, values);
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const row = sqlite.prepare(sql).get(...(bound as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async all<T = unknown>() {
        const results = sqlite.prepare(sql).all(...(bound as never[])) as T[];
        return { success: true, meta: {} as never, results };
      },
      async run() {
        const info = sqlite.prepare(sql).run(...(bound as never[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          } as never,
          results: [],
        };
      },
      async raw<T = unknown[]>() {
        return [] as T[];
      },
    };
    runStatement.set(stmt, () => sqlite.prepare(sql).run(...(bound as never[])));
    return stmt as unknown as D1PreparedStatement;
  }

  const db = {
    prepare: (sql: string) => prepare(sql),
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        for (const s of statements) {
          const fn = runStatement.get(s);
          if (!fn) throw new Error('Unregistered statement');
          fn();
        }
        sqlite.exec('COMMIT');
        return statements.map(() => ({ success: true, meta: {} as never, results: [] }));
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;

  const kvStore = new Map<string, string>();
  const kv = {
    get: async (key: string, type?: string) => {
      const raw = kvStore.get(key) ?? null;
      if (raw !== null && type === 'json') return JSON.parse(raw);
      return raw;
    },
    put: async (key: string, value: string) => {
      kvStore.set(key, value);
    },
    delete: async (key: string) => {
      kvStore.delete(key);
    },
  } as unknown as KVNamespace;

  return { sqlite, db, kv };
}

describe('Exact fnb-caffe-db sqlite_master Replica — Shifts, Inventory, BOM & Campaigns Cutover (20261029_03..06)', () => {
  const mig03 = readFileSync(
    resolve(__dirname, '../../../db/migrations/20261029_03_production_d1_schema_reconciliation.sql'),
    'utf8',
  );
  const mig04 = readFileSync(
    resolve(__dirname, '../../../db/migrations/20261029_04_pilot_staff_and_campaign_cutover.sql'),
    'utf8',
  );
  const mig05 = readFileSync(
    resolve(__dirname, '../../../db/migrations/20261029_05_catalog_modifiers_kds_stations_and_table_cutover.sql'),
    'utf8',
  );
  const mig06 = readFileSync(
    resolve(__dirname, '../../../db/migrations/20261029_06_pilot_shifts_inventory_bom_and_campaigns_seed.sql'),
    'utf8',
  );

  it('applies 20261029_03..06 cleanly and supports staff shifts, BOM order stock deduction, inventory forecasting, KDS station tickets, and CRM campaigns', async () => {
    const { sqlite, db, kv } = createSqliteMasterReplica();
    sqlite.exec(mig03);
    sqlite.exec(mig04);
    sqlite.exec(mig05);
    sqlite.exec(mig06);

    const jwtSecret = 'pilot-production-secret-32chars-minimum!';
    const env = {
      AURA_DB: db,
      AUTH_KV: kv,
      JWT_SECRET: jwtSecret,
    } as unknown as Env;

    const { token: ownerToken } = await issueStaffSession(
      { JWT_SECRET: jwtSecret },
      {
        id: 'USR_OWNER_001',
        name: 'AURA Owner',
        phone: '0901234567',
        role: 'owner',
        tenant_id: 'default',
        is_active: 1,
        auth_version: 1,
      },
      { email: 'admin@auraspace.vn', sessionType: 'staff-web' },
    );
    const { token: staffToken } = await issueStaffSession(
      { JWT_SECRET: jwtSecret },
      {
        id: 'USR_morztzcs6p52k',
        name: 'Phan Hữu Thông',
        phone: '0915997989',
        role: 'staff',
        tenant_id: 'default',
        is_active: 1,
        auth_version: 1,
      },
      { email: 'huuthong.dongthap@gmail.com', sessionType: 'staff-web' },
    );

    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/shifts', shiftsRouter);
    app.route('/api/kitchen-stations', stationTicketsRouter);
    app.route('/api/inventory/forecasting', inventoryForecastingRouter);
    const invRouter = new Hono<{ Bindings: Env }>();
    inventoryCRUD(invRouter as never);
    app.route('/api/inventory', invRouter);
    const campaignsRouter = new Hono<{ Bindings: Env }>();
    registerCampaignConfigHandlers(campaignsRouter);
    app.route('/api/campaigns', campaignsRouter);

    // 1. Staff shift schedule creation (clock_in IS NULL) + clock-in + clock-out on rebuilt staff_shifts
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const ownerScope = await shiftScope(env, {
      id: 'USR_OWNER_001',
      email: 'admin@auraspace.vn',
      name: 'AURA Owner',
      role: 'owner',
      tenantId: 'default',
    });
    const scheduledRow = await createSchedule(ownerScope, {
      staffId: 'USR_morztzcs6p52k',
      date: today,
      startTime: '06:00',
      endTime: '14:00',
      notes: 'Ca sáng mở quán',
    });
    expect(scheduledRow.attendance_state).toBe('scheduled');
    expect(scheduledRow.clock_in).toBeNull();

    const clockInRes = await app.fetch(
      new Request('http://localhost/api/shifts/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ staff_id: 'USR_morztzcs6p52k', notes: 'Ca sáng khai trương' }),
      }),
      env,
    );
    expect(clockInRes.status).toBe(201);
    const clockInBody = (await clockInRes.json()) as { success: boolean; data: { id: string; attendance_state: string } };
    expect(clockInBody.data.attendance_state).toBe('active');

    const todayShiftsRes = await app.fetch(
      new Request('http://localhost/api/shifts/today', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
      env,
    );
    expect(todayShiftsRes.status).toBe(200);
    const todayShiftsBody = (await todayShiftsRes.json()) as { data: Array<{ attendance_state: string }> };
    expect(todayShiftsBody.data.some((s) => s.attendance_state === 'active')).toBe(true);

    const clockOutRes = await app.fetch(
      new Request('http://localhost/api/shifts/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ staff_id: 'USR_morztzcs6p52k' }),
      }),
      env,
    );
    expect(clockOutRes.status).toBe(200);

    // 2. Inventory list returns 12 seeded items
    const invListRes = await app.fetch(new Request('http://localhost/api/inventory'), env);
    expect(invListRes.status).toBe(200);
    const invListBody = (await invListRes.json()) as { data: { items: Array<{ id: string; current_stock: number }> } };
    expect(invListBody.data.items).toHaveLength(12);

    // 3. Create order with customized tc002 (2x Cà phê Sữa) and te001 (1x Trà Đào Cam Sả)
    const orderRes = await createOrder(
      new Request('https://api.auraspace.vn/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-bom-test-01' },
        body: JSON.stringify({
          customer_name: 'Khách Pilot BOM',
          customer_phone: '0912345678',
          payment_method: 'cod',
          order_type: 'dine_in',
          table_id: '1-indoor',
          total: 97000,
          items: [
            { id: 'tc002', name: 'Cà phê Sữa', price: 29000, quantity: 2, modifiers: ['70% ít ngọt', 'Ít đá'] },
            { id: 'te001', name: 'Trà Đào Cam Sả', price: 39000, quantity: 1, modifiers: ['50% ngọt thanh', 'Đá riêng'] },
          ],
        }),
      }),
      env,
    );
    expect(orderRes.status).toBe(201);
    const orderJson = (await orderRes.json()) as { data: { id: string } };
    const orderId = orderJson.data.id;

    // Verify BOM stock deduction in both ingredients and inventory_items
    // tc002 x2 uses 50g ing_coffee_bean, 60ml ing_condensed_milk, 2pcs ing_cup_lid_straw
    // te001 x1 uses 150ml ing_black_tea, 30ml ing_peach_syrup, 15ml ing_sugar_syrup, 1pcs ing_cup_lid_straw
    const coffeeBeanIng = sqlite.prepare("SELECT current_stock FROM ingredients WHERE id = 'ing_coffee_bean'").get() as { current_stock: number };
    const coffeeBeanInv = sqlite.prepare("SELECT current_stock FROM inventory_items WHERE id = 'ing_coffee_bean'").get() as { current_stock: number };
    expect(coffeeBeanIng.current_stock).toBe(14950);
    expect(coffeeBeanInv.current_stock).toBe(14950);

    const cupInv = sqlite.prepare("SELECT current_stock FROM inventory_items WHERE id = 'ing_cup_lid_straw'").get() as { current_stock: number };
    expect(cupInv.current_stock).toBe(997);

    // 4. Verify Predictive Inventory Forecasting computes positive daily_run_rate from stock_movements consumption
    const forecastRes = await app.fetch(
      new Request('http://localhost/api/inventory/forecasting/run-rate?days=7', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
      env,
    );
    expect(forecastRes.status).toBe(200);
    const forecastBody = (await forecastRes.json()) as {
      success: boolean;
      data: Array<{ item_sku: string; daily_run_rate: number; current_stock: number }>;
    };
    const coffeeForecast = forecastBody.data.find((i) => i.item_sku === 'SKU-CF-ROBUSTA');
    expect(coffeeForecast).toBeDefined();
    expect(coffeeForecast!.current_stock).toBe(14950);
    expect(coffeeForecast!.daily_run_rate).toBeGreaterThan(0);

    // 5. Verify KDS Station Tickets routing (ks_espresso_bar gets tc002, ks_tea_cold_bar gets te001)
    const espressoTicketsRes = await app.fetch(
      new Request('http://localhost/api/kitchen-stations/ks_espresso_bar/tickets', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
      env,
    );
    expect(espressoTicketsRes.status).toBe(200);
    const espressoTickets = (await espressoTicketsRes.json()) as {
      data: Array<{ id: string; items: Array<{ id: string; name: string }> }>;
    };
    expect(espressoTickets.data).toHaveLength(1);
    expect(espressoTickets.data[0].id).toBe(orderId);
    expect(espressoTickets.data[0].items.map((i) => i.id)).toEqual(['tc002']);

    const teaTicketsRes = await app.fetch(
      new Request('http://localhost/api/kitchen-stations/ks_tea_cold_bar/tickets', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
      env,
    );
    expect(teaTicketsRes.status).toBe(200);
    const teaTickets = (await teaTicketsRes.json()) as {
      data: Array<{ id: string; items: Array<{ id: string; name: string }> }>;
    };
    expect(teaTickets.data).toHaveLength(1);
    expect(teaTickets.data[0].items.map((i) => i.id)).toEqual(['te001']);

    // 6. Verify CRM Campaign Configs seeded all 5 triggers
    const campaignsRes = await app.fetch(new Request('http://localhost/api/campaigns'), env);
    expect(campaignsRes.status).toBe(200);
    const campaignsBody = (await campaignsRes.json()) as { data: Array<{ trigger: string; is_active: number }> };
    expect(campaignsBody.data).toHaveLength(5);
    expect(campaignsBody.data.map((c) => c.trigger).sort()).toEqual([
      'birthday',
      'cashback_expiry',
      'post_visit',
      'welcome',
      'winback',
    ]);
  });
});
