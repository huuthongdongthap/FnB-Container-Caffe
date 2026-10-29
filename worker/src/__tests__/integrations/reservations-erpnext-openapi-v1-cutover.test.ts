// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { floorPlanRouter } from '../../routes/floor-plan';
import { calBookingWebhookRouter } from '../../routes/cal-booking-webhook';
import { customerRoutes } from '../../routes/erpnext/customers';
import { vendorRoutes } from '../../routes/erpnext/vendors';
import { handleErpnextPosRequest } from '../../routes/erpnext-pos';
import { openApiTablesRouter } from '../../routes/openapi-tables';
import { openApiLoyaltyRouter } from '../../routes/openapi-loyalty';
import { openApiCronRouter } from '../../routes/openapi-cron';
import { openApiStaffRouter } from '../../routes/openapi-staff';
import { openApiPromotionsRouter } from '../../routes/openapi-promotions';
import { issueStaffSession } from '../../lib/staff-session';
import type { Env } from '../../types/env';

function createSqliteMasterReplica() {
  const sqlite = new DatabaseSync(':memory:');
  const runStatement = new WeakMap<object, () => unknown>();

  // Exact DDL copied from remote fnb-caffe-db sqlite_master prior to 20261029_03..08
  sqlite.exec(`
    CREATE TABLE _alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_key TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      dispatched INTEGER NOT NULL DEFAULT 0,
      dispatched_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE _metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 1,
      tags TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
    INSERT INTO users (id, name, role, phone, is_active, tenant_id, email) VALUES
      ('USR_owner01', 'AURA Owner', 'owner', '0901234567', 1, 'default', 'admin@auraspace.vn'),
      ('USR_morztzcs6p52k', 'Phan Hữu Thông', 'staff', '0915997989', 1, 'tenant_sadec_01', 'thong@auraspace.vn');

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

    CREATE TABLE email_verifications (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

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

    CREATE TABLE cashback_transactions (
      id              TEXT PRIMARY KEY,
      wallet_id       TEXT NOT NULL,
      order_id        TEXT,
      type             TEXT NOT NULL,
      amount           REAL NOT NULL,
      balance_after    REAL,
      description     TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      multiplier_applied REAL DEFAULT 1.0,
      campaign_id INTEGER,
      customer_id TEXT,
      staff_id TEXT
    );

    CREATE TABLE referral_codes (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      times_used INTEGER DEFAULT 0,
      total_points_earned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
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
      reward_paid_at TEXT,
      FOREIGN KEY (referrer_id) REFERENCES customers(id),
      FOREIGN KEY (referred_customer_id) REFERENCES customers(id)
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

    CREATE TABLE promotion_usages (
      id TEXT PRIMARY KEY,
      promotion_id TEXT NOT NULL,
      customer_id TEXT,
      order_id TEXT UNIQUE,
      discount_amount REAL NOT NULL DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      ('t02', 2, 'Indoor', 6, 'Available', 'default');

    CREATE TABLE table_sessions (
      id            TEXT PRIMARY KEY,
      table_id      TEXT NOT NULL,
      customer_id   TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      status        TEXT NOT NULL DEFAULT 'active',
      opened_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at     DATETIME,
      order_count   INTEGER NOT NULL DEFAULT 0,
      total_amount  INTEGER NOT NULL DEFAULT 0,
      notes         TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (table_id) REFERENCES cafe_tables(id) ON DELETE CASCADE
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
      unit_cost INTEGER DEFAULT 0,
      reference_type TEXT,
      reference_id TEXT,
      note TEXT,
      staff_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE campaign_configs (
      trigger TEXT PRIMARY KEY CHECK (trigger IN ('welcome', 'birthday', 'winback', 'post_visit', 'cashback_expiry')),
      is_active INTEGER NOT NULL DEFAULT 1,
      channels TEXT NOT NULL DEFAULT '["sms"]',
      timing TEXT,
      updated_at TEXT
    );

    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT NOT NULL,
      actor_name TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE notification_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      customer_id TEXT,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      template TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE push_subscriptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      role TEXT DEFAULT 'customer',
      endpoint TEXT NOT NULL UNIQUE,
      auth_key TEXT NOT NULL,
      p256dh_key TEXT NOT NULL,
      user_agent TEXT,
      last_used_at TEXT,
      device_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE erpnext_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_type TEXT NOT NULL CHECK (local_type IN ('order', 'customer', 'product')),
      local_id TEXT NOT NULL,
      erpnext_id INTEGER NOT NULL,
      erpnext_model TEXT NOT NULL,
      sync_status TEXT DEFAULT 'synced',
      error_message TEXT,
      attempts INTEGER DEFAULT 0,
      last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(local_type, local_id)
    );

    CREATE TABLE erpnext_product_sync (
      product_id TEXT PRIMARY KEY,
      erpnext_product_id INTEGER NOT NULL,
      last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      erpnext_write_date TEXT,
      cached_stock INTEGER,
      cached_price REAL
    );

    CREATE TABLE erpnext_sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mapping_id INTEGER,
      attempt INTEGER,
      status TEXT NOT NULL,
      error_message TEXT,
      latency_ms INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE wifi_sessions (
      id TEXT PRIMARY KEY,
      client_mac TEXT NOT NULL,
      ip_address TEXT,
      phone TEXT,
      customer_id TEXT,
      status TEXT NOT NULL DEFAULT 'authorized',
      session_timeout INTEGER NOT NULL DEFAULT 3600,
      authorized_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE reservations (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      guest_count INTEGER NOT NULL DEFAULT 2,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      zone TEXT NOT NULL,
      status TEXT DEFAULT 'confirmed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      FOREIGN KEY (table_id) REFERENCES cafe_tables(id)
    );

    CREATE TABLE suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      tax_id TEXT,
      payment_terms TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT UNIQUE NOT NULL,
      supplier_id TEXT NOT NULL,
      order_date TEXT NOT NULL,
      expected_delivery_date TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      shipping REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
    );

    CREATE TABLE purchase_order_items (
      id TEXT PRIMARY KEY,
      purchase_order_id TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      received_quantity REAL DEFAULT 0,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
    );
  `);

  const normalizeParam = (p: unknown) => (p === undefined ? null : p);
  const createStmt = (sql: string, bound: unknown[] = []): D1PreparedStatement => {
    const executeRun = () => {
      const stmt = sqlite.prepare(sql);
      const info = stmt.run(...(bound.map(normalizeParam) as never[]));
      return {
        success: true,
        meta: {
          changes: Number(info.changes ?? 0),
          last_row_id: Number(info.lastInsertRowid ?? 0),
        },
      };
    };
    const stmtObj = {
      bind: (...params: unknown[]) => createStmt(sql, params),
      first: async <T = unknown>(colName?: string): Promise<T | null> => {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(bound.map(normalizeParam) as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      all: async <T = unknown>() => {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...(bound.map(normalizeParam) as never[])) as T[];
        return { success: true, results: rows, meta: {} };
      },
      run: async () => executeRun(),
      raw: async () => [],
    };
    runStatement.set(stmtObj, executeRun);
    return stmtObj as unknown as D1PreparedStatement;
  };

  const db = {
    prepare: (sql: string) => createStmt(sql),
    batch: async (stmts: D1PreparedStatement[]) => stmts.map((s) => runStatement.get(s)?.() ?? { success: true }),
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;

  return { sqlite, db };
}

function createMemoryKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  } as unknown as KVNamespace;
}

describe('Floor Plan, Cal.com Bookings, ERPNext & OpenAPI v1 Cutover (20261029_03..08)', () => {
  it('applies 20261029_03..08 cleanly on fnb-caffe-db replica and verifies Floor Plan, Cal.com Bookings, ERPNext Customers/Vendors/POS Webhook, and OpenAPI v1 routes', async () => {
    const { sqlite, db } = createSqliteMasterReplica();
    const kv = createMemoryKV();

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
    const mig07 = readFileSync(
      resolve(__dirname, '../../../db/migrations/20261029_07_payments_crm_reviews_franchise_and_cron_schema_cutover.sql'),
      'utf8',
    );
    const mig08 = readFileSync(
      resolve(__dirname, '../../../db/migrations/20261029_08_reservations_erpnext_and_openapi_v1_schema_cutover.sql'),
      'utf8',
    );
    const mig08Down = readFileSync(
      resolve(__dirname, '../../../db/migrations/20261029_08_reservations_erpnext_and_openapi_v1_schema_cutover.down.sql'),
      'utf8',
    );

    expect(() => sqlite.exec(mig03)).not.toThrow();
    expect(() => sqlite.exec(mig04)).not.toThrow();
    expect(() => sqlite.exec(mig05)).not.toThrow();
    expect(() => sqlite.exec(mig06)).not.toThrow();
    expect(() => sqlite.exec(mig07)).not.toThrow();
    expect(() => sqlite.exec(mig08)).not.toThrow();
    expect(() => sqlite.exec(mig08Down)).not.toThrow();
    // Re-apply table/index creation statements after down migration
    for (const stmt of mig08.split(';')) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        sqlite.exec(trimmed);
      } catch (err) {
        if (!String(err).includes('duplicate column name')) throw err;
      }
    }

    const jwtSecret = 'pilot-production-secret-32chars-minimum!';
    const calSecret = 'cal-webhook-secret-test-32chars!!';
    const env = {
      AURA_DB: db,
      DB: db,
      AUTH_KV: kv,
      STAFF_SESSION_SECRET: jwtSecret,
      JWT_SECRET: jwtSecret,
      CAL_WEBHOOK_SECRET: calSecret,
      ERPNEXT_MOCK: 'true',
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

    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/floor-plan', floorPlanRouter);
    app.route('/api/cal-booking-webhook', calBookingWebhookRouter);
    customerRoutes(app);
    vendorRoutes(app);
    app.all('/api/erpnext-pos/*', (c) =>
      handleErpnextPosRequest(c.req.raw, c.env as unknown as Record<string, unknown>),
    );
    app.route('/', openApiTablesRouter);
    app.route('/', openApiLoyaltyRouter);
    app.route('/', openApiCronRouter);
    app.route('/', openApiStaffRouter);
    app.route('/', openApiPromotionsRouter);

    // 1. Verify Floor Plan reads cafe_tables with backfilled capacity & name and active table_sessions
    sqlite.exec(`
      INSERT INTO orders (id, items, total, status, customer_name, customer_phone, payment_method, payment_status, table_id, table_number, tenant_id)
      VALUES ('ORD_FP_01', '[{"name":"Cà phê Sữa","quantity":2}]', 58000, 'preparing', 'Khách Bàn 1', '0901112233', 'payos', 'paid', 't01', '1', 'default');
      INSERT INTO table_sessions (id, table_id, status, opened_at, order_count, total_amount, customer_name)
      VALUES ('SES_FP_01', 't01', 'active', '2026-10-29T10:00:00Z', 1, 58000, 'Khách Bàn 1');
    `);

    const fpRes = await app.request(
      'http://localhost/api/floor-plan',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(fpRes.status).toBe(200);
    const fpBody = (await fpRes.json()) as {
      success: boolean;
      data: Array<{ id: string; table_number: number; capacity: number; status: string; active_session: { id: string; total_amount: number } | null }>;
      summary: { total: number; occupied: number; available: number };
    };
    expect(fpBody.success).toBe(true);
    expect(fpBody.summary.total).toBeGreaterThanOrEqual(2);
    const table1 = fpBody.data.find((t) => t.id === 't01');
    const table2 = fpBody.data.find((t) => t.id === 't02');
    expect(table1?.capacity).toBe(4);
    expect(table1?.active_session?.id).toBe('SES_FP_01');
    expect(table1?.active_session?.total_amount).toBe(58000);
    expect(table2?.capacity).toBe(6);

    // 2. Verify Cal.com Booking Webhook (BOOKING_CREATED -> BOOKING_RESCHEDULED -> BOOKING_CANCELLED) & Bookings list on unified reservations
    const calCreateRes = await app.request(
      'http://localhost/api/cal-booking-webhook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cal-webhook-secret': calSecret,
        },
        body: JSON.stringify({
          triggerEvent: 'BOOKING_CREATED',
          createdAt: '2026-10-29T10:00:00Z',
          payload: {
            uid: 'cal_uid_sadec_01',
            title: 'Đặt bàn VIP Container',
            startTime: '2026-10-30T19:00:00+07:00',
            endTime: '2026-10-30T20:30:00+07:00',
            attendees: [{ name: 'Lê Minh Tuấn', email: 'tuan@example.com', timeZone: 'Asia/Ho_Chi_Minh' }],
            organizer: { name: 'AURA Space', email: 'booking@auraspace.vn' },
            location: 'Sa Đéc Flagship',
            metadata: { guest_count: 5, zone: 'Indoor' },
          },
        }),
      },
      env,
    );
    expect(calCreateRes.status).toBe(200);

    const calListRes = await app.request(
      'http://localhost/api/cal-booking-webhook/bookings',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(calListRes.status).toBe(200);
    const calListBody = (await calListRes.json()) as {
      success: boolean;
      data: Array<{ cal_uid: string; attendee_name: string; attendee_email: string; status: string }>;
    };
    expect(calListBody.success).toBe(true);
    expect(calListBody.data.some((b) => b.cal_uid === 'cal_uid_sadec_01' && b.attendee_email === 'tuan@example.com')).toBe(true);

    const calRescheduleRes = await app.request(
      'http://localhost/api/cal-booking-webhook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cal-webhook-secret': calSecret,
        },
        body: JSON.stringify({
          triggerEvent: 'BOOKING_RESCHEDULED',
          createdAt: '2026-10-29T10:05:00Z',
          payload: {
            uid: 'cal_uid_sadec_01',
            title: 'Đặt bàn VIP Container',
            startTime: '2026-10-30T20:00:00+07:00',
            endTime: '2026-10-30T21:30:00+07:00',
            organizer: { name: 'AURA Space', email: 'booking@auraspace.vn' },
            location: 'Sa Đéc Flagship',
          },
        }),
      },
      env,
    );
    expect(calRescheduleRes.status).toBe(200);

    const calCancelRes = await app.request(
      'http://localhost/api/cal-booking-webhook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cal-webhook-secret': calSecret,
        },
        body: JSON.stringify({
          triggerEvent: 'BOOKING_CANCELLED',
          createdAt: '2026-10-29T10:10:00Z',
          payload: {
            uid: 'cal_uid_sadec_01',
            title: 'Đặt bàn VIP Container',
            startTime: '2026-10-30T20:00:00+07:00',
            endTime: '2026-10-30T21:30:00+07:00',
            organizer: { name: 'AURA Space', email: 'booking@auraspace.vn' },
            location: 'Sa Đéc Flagship',
            cancellationReason: 'Customer requested change',
          },
        }),
      },
      env,
    );
    expect(calCancelRes.status).toBe(200);

    // 3. Verify ERPNext Customers, Vendors (backed by suppliers), and ERPNext POS Webhook
    const custUuid = '550e8400-e29b-41d4-a716-446655440001';
    sqlite.exec(`
      INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, tax_id, sync_status)
      VALUES ('${custUuid}', 'erp_cust@example.com', 'Công ty TNHH Hoa Sa Đéc', '0912345678', 350, 'silver', '1401234567', 'pending');
    `);

    const erpCustRes = await app.request(
      'http://localhost/api/erpnext/customers',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(erpCustRes.status).toBe(200);
    const erpCustBody = (await erpCustRes.json()) as {
      success: boolean;
      data: Array<{ id: string; tax_id: string; sync_status: string }>;
    };
    expect(erpCustBody.success).toBe(true);
    expect(erpCustBody.data.some((c) => c.id === custUuid && c.tax_id === '1401234567')).toBe(true);

    const erpVendorRes = await app.request(
      'http://localhost/api/erpnext/vendors',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(erpVendorRes.status).toBe(200);
    const erpVendorBody = (await erpVendorRes.json()) as {
      success: boolean;
      data: Array<{ id: string; name: string }>;
    };
    expect(erpVendorBody.success).toBe(true);
    expect(erpVendorBody.data.length).toBeGreaterThanOrEqual(2);

    const erpWebhookRes = await app.request(
      'http://localhost/api/erpnext-pos/webhook',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctype: 'POS Invoice',
          docname: 'ACC-PSINV-2026-00001',
          action: 'on_submit',
        }),
      },
      env,
    );
    expect(erpWebhookRes.status).toBe(200);
    const webhookLogRow = sqlite
      .prepare('SELECT doctype, docname, action FROM erpnext_webhook_log WHERE docname = ?')
      .get('ACC-PSINV-2026-00001') as { doctype: string; docname: string; action: string } | undefined;
    expect(webhookLogRow?.doctype).toBe('POS Invoice');

    // 4. Verify OpenAPI Tables (/api/tables & /api/tables/zones) reading cafe_tables without split-brain
    const oaTablesRes = await app.request(
      'http://localhost/api/tables',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(oaTablesRes.status).toBe(200);
    const oaTablesBody = (await oaTablesRes.json()) as {
      success: boolean;
      data: { tables: Array<{ id: string; name: string; capacity: number }> };
    };
    expect(oaTablesBody.success).toBe(true);
    expect(oaTablesBody.data.tables.some((t) => t.id === 't01' && t.name === 'Bàn 1' && t.capacity === 4)).toBe(true);

    const oaZonesRes = await app.request(
      'http://localhost/api/table-zones',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(oaZonesRes.status).toBe(200);
    const oaZonesBody = (await oaZonesRes.json()) as {
      success: boolean;
      data: { zones: Array<{ name: string; isActive: boolean }> };
    };
    expect(oaZonesBody.success).toBe(true);
    expect(oaZonesBody.data.zones.some((z) => z.name === 'Indoor' && z.isActive === true)).toBe(true);

    // 5. Verify OpenAPI Loyalty (/api/loyalty/admin/accounts, /api/loyalty/admin/adjust-points, /api/loyalty/tiers)
    const oaLoyaltyAccRes = await app.request(
      'http://localhost/api/loyalty/admin/accounts',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(oaLoyaltyAccRes.status).toBe(200);
    const oaLoyaltyAccBody = (await oaLoyaltyAccRes.json()) as {
      success: boolean;
      data: Array<{ id: string; currentPoints: number; tier: string }>;
    };
    expect(oaLoyaltyAccBody.success).toBe(true);
    expect(oaLoyaltyAccBody.data.some((a) => a.id === custUuid && a.currentPoints === 350)).toBe(true);

    const oaAdjustRes = await app.request(
      'http://localhost/api/loyalty/admin/adjust-points',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          customerId: custUuid,
          points: 200,
          reason: 'Thưởng khách hàng thân thiết Sa Đéc',
          idempotencyKey: '550e8400-e29b-41d4-a716-446655440099',
        }),
      },
      env,
    );
    expect(oaAdjustRes.status).toBe(200);
    const oaAdjustBody = (await oaAdjustRes.json()) as {
      success: boolean;
      data: { points: number; balance_after: number };
    };
    expect(oaAdjustBody.success).toBe(true);
    expect(oaAdjustBody.data.points).toBe(200);
    expect(oaAdjustBody.data.balance_after).toBe(550);

    const oaTiersRes = await app.request(
      'http://localhost/api/loyalty/tiers',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(oaTiersRes.status).toBe(200);
    const oaTiersBody = (await oaTiersRes.json()) as {
      success: boolean;
      data: Array<{ tier: string }>;
    };
    expect(oaTiersBody.success).toBe(true);
    expect(oaTiersBody.data.map((t) => t.tier)).toEqual(['bronze', 'silver', 'gold', 'diamond']);

    // 6. Verify OpenAPI Cron (/api/cron/jobs, /api/cron/summary)
    const oaCronCreateRes = await app.request(
      'http://localhost/api/cron/jobs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          name: 'Nightly Cashback Reconciliation',
          description: 'Reconcile wallet balances',
          cronExpression: '0 2 * * *',
          handler: 'payment-reconcile',
          timeoutSeconds: 120,
          maxRetries: 2,
          retryDelaySeconds: 30,
          isActive: true,
        }),
      },
      env,
    );
    expect(oaCronCreateRes.status).toBe(201);

    const oaCronSummaryRes = await app.request(
      'http://localhost/api/cron/summary',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(oaCronSummaryRes.status).toBe(200);
    const oaCronSummaryBody = (await oaCronSummaryRes.json()) as {
      success: boolean;
      data: { totalJobs: number; activeJobs: number };
    };
    expect(oaCronSummaryBody.success).toBe(true);
    expect(oaCronSummaryBody.data.totalJobs).toBe(1);
    expect(oaCronSummaryBody.data.activeJobs).toBe(1);

    // 7. Verify OpenAPI Staff (/api/staff) & Promotions (/api/promotions)
    const oaStaffRes = await app.request(
      'http://localhost/api/staff',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(oaStaffRes.status).toBe(200);
    const oaStaffBody = (await oaStaffRes.json()) as {
      success: boolean;
      data: { staff: Array<{ id: string; name: string }> };
    };
    expect(oaStaffBody.success).toBe(true);
    expect(oaStaffBody.data.staff.length).toBeGreaterThanOrEqual(2);

    const oaPromosRes = await app.request(
      'http://localhost/api/promotions',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(oaPromosRes.status).toBe(200);
  });
});
