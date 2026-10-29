// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { runPaymentReconciliation } from '../../routes/cron-handlers/payment-reconcile';
import { refundRouter } from '../../routes/refunds';
import { getOrCreateReferralCode, redeemReferral, rewardReferralOnFirstOrder } from '../../../../packages/domain/crm/commands/referral';
import { detectCashbackExpiry, markExpiryNotified } from '../../../../packages/domain/crm/commands/campaign/detect';
import { birthdayRouter } from '../../routes/birthday';
import { reviewsRouter } from '../../routes/reviews';
import { franchiseRouter } from '../../routes/franchise-locations';
import { getPricing } from '../../routes/saas-pricing';
import { adminLoyaltyRouter } from '../../routes/admin-loyalty';
import { authorizeWifiOverride } from '../../tree/wifi/session';
import { issueStaffSession } from '../../lib/staff-session';
import type { Env } from '../../types/env';

function createSqliteMasterReplica() {
  const sqlite = new DatabaseSync(':memory:');
  const runStatement = new WeakMap<object, () => unknown>();

  // Exact DDL copied from remote fnb-caffe-db sqlite_master prior to 20261029_03..07
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
    INSERT INTO users (id, name, role, phone, is_active, tenant_id) VALUES
      ('USR_owner01', 'AURA Owner', 'owner', '0901234567', 1, 'default'),
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

describe('Payments, CRM, Reviews, Franchise & Cron Cutover (20261029_03..07)', () => {
  it('applies 20261029_03..07 cleanly on fnb-caffe-db replica and verifies payments reconciliation, CRM referrals, birthday, reviews, franchise, pricing, loyalty export, and WiFi revoke', async () => {
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

    expect(() => sqlite.exec(mig03)).not.toThrow();
    expect(() => sqlite.exec(mig04)).not.toThrow();
    expect(() => sqlite.exec(mig05)).not.toThrow();
    expect(() => sqlite.exec(mig06)).not.toThrow();
    expect(() => sqlite.exec(mig07)).not.toThrow();

    const jwtSecret = 'pilot-production-secret-32chars-minimum!';
    const env = {
      AURA_DB: db,
      DB: db,
      AUTH_KV: kv,
      STAFF_SESSION_SECRET: jwtSecret,
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

    // 1. Verify PayOS reconciliation cron & refund status read route against payments.refund_status
    sqlite.exec(`
      INSERT INTO orders (id, items, total, status, customer_name, customer_phone, payment_method, payment_status, tenant_id)
      VALUES ('ORD_PAY_01', '[]', 45000, 'confirmed', 'Nguyen Van A', '0901112222', 'payos', 'paid', 'default');
      INSERT INTO payments (id, order_id, method, amount, status, transaction_id)
      VALUES ('PAY_01', 'ORD_PAY_01', 'payos', 45000, 'completed', '123456789');
    `);

    const reconResult = await runPaymentReconciliation(env);
    expect(reconResult.processed).toBe(0);

    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/payments', refundRouter);
    app.route('/api/birthday', birthdayRouter);
    app.route('/api/reviews', reviewsRouter);
    app.route('/api/franchise', franchiseRouter);
    app.route('/api/admin-loyalty', adminLoyaltyRouter);
    app.get('/api/pricing', getPricing);

    const refundStatusRes = await app.request(
      'http://localhost/api/payments/refunds/PAY_01',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(refundStatusRes.status).toBe(200);
    const refundStatusBody = (await refundStatusRes.json()) as {
      success: boolean;
      data: { id: string; refundStatus: string | null; refundAmount: number };
    };
    expect(refundStatusBody.success).toBe(true);
    expect(refundStatusBody.data.id).toBe('PAY_01');
    expect(refundStatusBody.data.refundStatus).toBeNull();
    expect(refundStatusBody.data.refundAmount).toBe(0);

    // 2. Verify CRM Referral code creation & reward processing (referral_codes.total_cashback_earned_vnd & referrals.bonus_type)
    const todayMmDd = new Date().toISOString().slice(5, 10);
    sqlite.exec(`
      INSERT INTO customers (id, email, name, phone, date_of_birth, loyalty_tier)
      VALUES
        ('CUS_REF_01', 'ref1@aura.vn', 'Nguyen Van A', '0901112222', '1995-${todayMmDd}', 'gold'),
        ('CUS_REF_02', 'ref2@aura.vn', 'Tran Thi B', '0903334444', '1998-01-01', 'bronze');
    `);

    const refCodeRes = await getOrCreateReferralCode(db, 'CUS_REF_01');
    expect(refCodeRes.isNew).toBe(true);
    expect(refCodeRes.code).toMatch(/^[A-Z0-9]{6}$/);
    const redeemRes = await redeemReferral(db, refCodeRes.code, 'CUS_REF_02');
    expect(redeemRes.success).toBe(true);
    const rewardRes = await rewardReferralOnFirstOrder(db, 'CUS_REF_02', 'ORD_PAY_01', 60000);
    expect(rewardRes.success).toBe(true);

    // 3. Verify Birthday check & redeem (/api/birthday/check, /api/birthday/redeem)
    const bdayCheckRes = await app.request(
      'http://localhost/api/birthday/check?customer_id=CUS_REF_01',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(bdayCheckRes.status).toBe(200);
    const bdayCheckBody = (await bdayCheckRes.json()) as {
      success: boolean;
      data: { eligible: boolean; discount_percent: number };
    };
    expect(bdayCheckBody.success).toBe(true);
    expect(bdayCheckBody.data.eligible).toBe(true);

    const bdayRedeemRes = await app.request(
      'http://localhost/api/birthday/redeem',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ customer_id: 'CUS_REF_01', order_id: 'ORD_PAY_01' }),
      },
      env,
    );
    expect(bdayRedeemRes.status).toBe(201);

    // 4. Verify Customer Reviews (/api/reviews & /api/reviews/stats)
    const createReviewRes = await app.request(
      'http://localhost/api/reviews',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: 'ORD_PAY_01',
          rating: 5,
          comment: 'Trà sữa nướng rất thơm!',
          customer_name: 'Nguyen Van A',
        }),
      },
      env,
    );
    expect(createReviewRes.status).toBe(201);

    const reviewStatsRes = await app.request('http://localhost/api/reviews/stats', {}, env);
    expect(reviewStatsRes.status).toBe(200);
    const reviewStatsBody = (await reviewStatsRes.json()) as {
      success: boolean;
      data: { total_reviews: number; average_rating: number };
    };
    expect(reviewStatsBody.data.total_reviews).toBe(1);
    expect(reviewStatsBody.data.average_rating).toBe(5);

    // 5. Verify Franchise Locations (/api/franchise/locations)
    const franchiseRes = await app.request(
      'http://localhost/api/franchise/locations',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(franchiseRes.status).toBe(200);
    const franchiseBody = (await franchiseRes.json()) as {
      success: boolean;
      data: Array<{ id: string; code: string }>;
    };
    expect(franchiseBody.success).toBe(true);
    expect(franchiseBody.data.some((l) => l.code === 'SD-01')).toBe(true);

    // 6. Verify SaaS Pricing (/api/pricing) & Admin Loyalty CSV Export (/api/admin-loyalty/export)
    const pricingRes = await app.request('http://localhost/api/pricing', {}, env);
    expect(pricingRes.status).toBe(200);

    const exportRes = await app.request(
      'http://localhost/api/admin-loyalty/export',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env,
    );
    expect(exportRes.status).toBe(200);
    const csvText = await exportRes.text();
    expect(csvText).toContain('Nguyen Van A');

    // 7. Verify Cashback Expiry detection & markExpiryNotified (customers.last_expiry_warning_at)
    const expiring = await detectCashbackExpiry(db);
    expect(Array.isArray(expiring)).toBe(true);
    const marked = await markExpiryNotified(db, ['CUS_REF_01']);
    expect(marked).toBe(1);

    // 8. Verify WiFi override revoke uses strict single-quoted SQL literal
    const wifiRevoke = await authorizeWifiOverride(env as unknown as Record<string, unknown>, {
      mac: 'AA:BB:CC:DD:EE:FF',
      action: 'revoke',
    });
    expect(wifiRevoke.success).toBe(true);
    expect(wifiRevoke.action).toBe('revoked');
  });
});
