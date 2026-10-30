// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { loadPolicy, tierByName } from '../../../../packages/domain/crm/commands/loyalty-policy';
import { claimGuestOrder } from '../../../../packages/domain/customer/policies/order-ownership-policy';
import { writeCanonicalAuditLog } from '../../../../packages/domain/audit/src/policies/audit-writer-policy';
import { createNotificationIntent, processNotificationIntent } from '../../../../packages/domain/notification/src/policies/notification-orchestration-policy';
import { openCanonicalShift, recordShiftSale, closeCanonicalShift } from '../../../../packages/domain/shift/src/policies/shift-lifecycle-policy';
import { reconcileShiftCash } from '../../../../packages/domain/shift/src/policies/cash-reconciliation-policy';
import { ErpnextProductClient } from '../../clients/erpnext-product-client';
import { openApiLoyaltyRouter } from '../../routes/openapi-loyalty';
import { openApiPromotionsRouter } from '../../routes/openapi-promotions';
import { openApiInventoryRouter } from '../../routes/openapi-inventory';
import { openApiCronRouter } from '../../routes/openapi-cron';
import { inventoryForecastingRouter } from '../../routes/inventory-forecasting';
import { referralRouter } from '../../routes/referrals';
import { checkinRouter } from '../../routes/checkin';
import { issueStaffSession } from '../../lib/staff-session';
import { generateJWT } from '../../lib/jwt';
import type { Env } from '../../types/env';

function createProductionReplica() {
  const sqlite = new DatabaseSync(':memory:');
  const runStatement = new WeakMap<object, () => unknown>();

  sqlite.exec(`
    CREATE TABLE _alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, alert_key TEXT NOT NULL, message TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'warning', dispatched INTEGER NOT NULL DEFAULT 0, dispatched_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE _metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, value REAL NOT NULL DEFAULT 1, tags TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff', phone TEXT, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id TEXT, email TEXT, auth_version INTEGER NOT NULL DEFAULT 1, password_hash TEXT);
    INSERT INTO users (id, name, role, phone, is_active, tenant_id, email) VALUES ('USR_owner01', 'AURA Owner', 'owner', '0901234567', 1, 'default', 'admin@auraspace.vn');
    CREATE TABLE staff_login_identities (email TEXT PRIMARY KEY, staff_id TEXT NOT NULL UNIQUE REFERENCES users(id));
    CREATE TABLE staff_shifts (id TEXT PRIMARY KEY, staff_email TEXT NOT NULL, clock_in TEXT NOT NULL, clock_out TEXT, shift_type TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT, sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, display_name_vi TEXT, display_name_en TEXT, image_url TEXT);
    INSERT INTO categories (id, name, slug, sort_order, display_name_vi) VALUES ('cat_coffee', 'Cà Phê', 'ca-phe', 1, 'Cà Phê');
    CREATE TABLE products (id TEXT PRIMARY KEY, category_id TEXT NOT NULL, name TEXT NOT NULL, price INTEGER NOT NULL, description TEXT, image_url TEXT, tags TEXT DEFAULT '[]', badge TEXT, is_available INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, slug TEXT, compare_at_price INTEGER, sort_order INTEGER DEFAULT 0);
    INSERT INTO products (id, category_id, name, price, is_available, sort_order) VALUES ('prod_cf_01', 'cat_coffee', 'Cà Phê Sữa Đá', 45000, 1, 1);
    CREATE TABLE menu_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL, description TEXT, image_url TEXT, available INTEGER DEFAULT 1, tags TEXT DEFAULT '[]', badge TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE menu_modifiers (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, option_name TEXT NOT NULL, price_delta INTEGER NOT NULL DEFAULT 0, available INTEGER NOT NULL DEFAULT 1, updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE modifier_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'single', required INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE modifier_choices (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, price_delta INTEGER NOT NULL DEFAULT 0, is_default INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), is_available INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE product_modifier_groups (product_id TEXT NOT NULL, group_id TEXT NOT NULL, sort_order INTEGER DEFAULT 0, PRIMARY KEY (product_id, group_id));
    CREATE TABLE happy_hour_windows (id TEXT PRIMARY KEY, name TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, discount_rate REAL NOT NULL DEFAULT 0, apply_to TEXT NOT NULL DEFAULT 'all', apply_ids TEXT, priority INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE kitchen_stations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE category_stations (category_id TEXT NOT NULL, station_id TEXT NOT NULL, PRIMARY KEY (category_id, station_id));
    CREATE TABLE order_item_stations (order_item_id TEXT NOT NULL, station_id TEXT NOT NULL, started_at TEXT, ready_at TEXT, PRIMARY KEY (order_item_id, station_id));
    CREATE TABLE kds_stations (id TEXT PRIMARY KEY, name TEXT NOT NULL, categories TEXT NOT NULL DEFAULT '[]', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, table_number INTEGER UNIQUE NOT NULL, zone TEXT NOT NULL, seats INTEGER NOT NULL DEFAULT 4, status TEXT DEFAULT 'Available', notes TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id TEXT NOT NULL DEFAULT 'default');
    INSERT INTO cafe_tables (id, table_number, zone, seats, status, tenant_id) VALUES ('T01', 1, 'indoor', 4, 'Available', 'default');
    CREATE TABLE table_sessions (id TEXT PRIMARY KEY, table_id TEXT NOT NULL, customer_id TEXT, customer_name TEXT, customer_phone TEXT, status TEXT NOT NULL DEFAULT 'active', opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at DATETIME, order_count INTEGER NOT NULL DEFAULT 0, total_amount INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE table_qr_codes (id TEXT PRIMARY KEY, table_id TEXT NOT NULL, code TEXT NOT NULL UNIQUE, scans INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE customers (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, phone TEXT, loyalty_points INTEGER DEFAULT 0, loyalty_tier TEXT DEFAULT 'bronze', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, date_of_birth TEXT, zalo TEXT, source TEXT DEFAULT 'unknown', lifetime_points INTEGER DEFAULT 0);
    INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, lifetime_points) VALUES ('cust_01', 'c1@aura.vn', 'Khách 1', '0911111111', 500, 'silver', 500), ('cust_02', 'c2@aura.vn', 'Khách 2', '0922222222', 0, 'bronze', 0);
    CREATE TABLE orders (id TEXT PRIMARY KEY, items TEXT NOT NULL, total INTEGER NOT NULL, status TEXT DEFAULT 'pending', customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_email TEXT, customer_address TEXT, payment_method TEXT DEFAULT 'cod', payment_status TEXT DEFAULT 'unpaid', shipping_fee INTEGER DEFAULT 0, discount INTEGER DEFAULT 0, notes TEXT, delivery_time TEXT DEFAULT 'now', table_id TEXT, subtotal INTEGER DEFAULT 0, tax INTEGER DEFAULT 0, total_amount INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, cashback_used REAL DEFAULT 0, cashback_earned REAL DEFAULT 0, points_earned INTEGER DEFAULT 0, reward_code_used TEXT, customer_id TEXT, staff_id TEXT, table_number INTEGER, is_cod INTEGER DEFAULT 0, cod_paid_at TEXT, fulfillment_type TEXT DEFAULT 'dine_in', delivery_address TEXT, locale TEXT DEFAULT 'vi', location_id TEXT, order_type TEXT DEFAULT 'dine_in', tip_amount INTEGER DEFAULT 0, service_fee INTEGER DEFAULT 0, updated_by TEXT, tenant_id TEXT DEFAULT 'default');
    INSERT INTO orders (id, items, total, customer_name, customer_phone, subtotal, total_amount, order_type) VALUES ('ord_guest_01', '[]', 85000, 'Guest', '0911111111', 85000, 85000, 'dine_in');
    CREATE TABLE order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, subtotal INTEGER NOT NULL, modifiers TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, method TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', transaction_id TEXT, payment_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE promotions (code TEXT PRIMARY KEY, percent INTEGER NOT NULL DEFAULT 0, max_discount INTEGER DEFAULT 0, min_order INTEGER DEFAULT 0, usage_limit INTEGER DEFAULT 0, usage_count INTEGER DEFAULT 0, starts_at TEXT, expires_at TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE promotion_redemptions (id INTEGER PRIMARY KEY AUTOINCREMENT, promotion_id TEXT, code TEXT NOT NULL, order_id TEXT UNIQUE NOT NULL, customer_id TEXT, customer_phone TEXT, discount_amount INTEGER NOT NULL DEFAULT 0, order_total INTEGER NOT NULL DEFAULT 0, tenant_id TEXT NOT NULL DEFAULT 'default', redeemed_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE promotion_usages (id TEXT PRIMARY KEY, promotion_id TEXT NOT NULL, customer_id TEXT, order_id TEXT, discount_amount REAL NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE bonus_campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, start_date TEXT NOT NULL, end_date TEXT NOT NULL, cashback_multiplier REAL DEFAULT 1, signup_bonus_vnd INTEGER DEFAULT 0, signup_bonus_cap INTEGER DEFAULT 0, refer_bonus_vnd INTEGER DEFAULT 0, max_cap_per_customer_vnd INTEGER DEFAULT 50000, auto_upgrade_tier TEXT, auto_upgrade_min_spend INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE cashback_wallets (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL UNIQUE, balance REAL NOT NULL DEFAULT 0, total_earned REAL NOT NULL DEFAULT 0, total_spent REAL NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE cashback_transactions (id TEXT PRIMARY KEY, wallet_id TEXT NOT NULL, customer_id TEXT NOT NULL, order_id TEXT, type TEXT NOT NULL, amount REAL NOT NULL, balance_after REAL NOT NULL, multiplier_applied REAL DEFAULT 1, expires_at TEXT, campaign_id TEXT, description TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE signup_bonus_log (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT NOT NULL, campaign_id INTEGER NOT NULL, bonus_vnd INTEGER NOT NULL, granted_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE loyalty_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT, staff_id TEXT, action TEXT NOT NULL, amount_vnd REAL, order_id TEXT, metadata TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE referral_codes (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE, times_used INTEGER DEFAULT 0, total_points_earned INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE referrals (id TEXT PRIMARY KEY, referrer_id TEXT NOT NULL, referred_customer_id TEXT NOT NULL, referral_code TEXT NOT NULL, points_awarded INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, cashback_awarded_vnd INTEGER DEFAULT 0, first_order_id TEXT, first_order_amount INTEGER DEFAULT 0, reward_paid_at TEXT);
    CREATE TABLE ingredients (id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'g', current_stock REAL NOT NULL DEFAULT 0, min_stock REAL NOT NULL DEFAULT 0, max_stock REAL, cost_per_unit REAL NOT NULL DEFAULT 0, supplier_id TEXT, sku TEXT, category TEXT DEFAULT 'raw', is_active INTEGER DEFAULT 1, last_restocked_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE inventory_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_en TEXT, unit TEXT NOT NULL, current_stock REAL NOT NULL DEFAULT 0, min_stock REAL NOT NULL DEFAULT 0, cost_per_unit INTEGER NOT NULL DEFAULT 0, supplier TEXT, active INTEGER NOT NULL DEFAULT 1, updated_at TEXT DEFAULT (datetime('now')), sku TEXT, category TEXT DEFAULT 'general', max_stock REAL DEFAULT 1000, reorder_point REAL DEFAULT 10, location TEXT DEFAULT 'main', expiry_date TEXT, created_at TEXT DEFAULT (datetime('now')), supplier_id TEXT, tenant_id TEXT NOT NULL DEFAULT 'default');
    CREATE TABLE inventory_transactions (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL, reference_id TEXT, reference_type TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE recipes (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, name TEXT, instructions TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE recipe_items (id TEXT PRIMARY KEY, recipe_id TEXT NOT NULL, ingredient_id TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL DEFAULT 'g');
    CREATE TABLE stock_movements (id TEXT PRIMARY KEY, ingredient_id TEXT NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL, reference_id TEXT, reference_type TEXT, notes TEXT, created_by TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE campaign_configs (trigger TEXT PRIMARY KEY CHECK (trigger IN ('welcome', 'birthday', 'winback', 'post_visit', 'cashback_expiry')), is_active INTEGER NOT NULL DEFAULT 1, channels TEXT NOT NULL DEFAULT '["sms"]', timing TEXT, updated_at TEXT);
    CREATE TABLE campaign_logs (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, trigger TEXT NOT NULL, channel TEXT NOT NULL, sent_at TEXT NOT NULL DEFAULT (datetime('now')), status TEXT NOT NULL DEFAULT 'sent', error TEXT);
    CREATE TABLE consents (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, purpose TEXT NOT NULL, granted INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL, policy_version TEXT NOT NULL DEFAULT 'v1', granted_at TEXT NOT NULL, revoked_at TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE customer_identities (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, identifier_type TEXT NOT NULL, identifier_value TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0, verified_at TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE loyalty_point_logs (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, order_id TEXT, points_change INTEGER NOT NULL, reason TEXT, balance_after INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, description TEXT);
    CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, actor_id TEXT NOT NULL, actor_name TEXT, action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, resource_type TEXT NOT NULL, resource_id TEXT, details TEXT, metadata TEXT, ip_address TEXT, operating_unit_id TEXT, tenant_id TEXT, status TEXT, correlation_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE notification_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, phone TEXT, customer_id INTEGER, template_key TEXT, data TEXT, status TEXT NOT NULL, response TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, event_id TEXT, idempotency_key TEXT, correlation_id TEXT, provider TEXT);
    CREATE TABLE push_subscriptions (id TEXT PRIMARY KEY, customer_id TEXT, role TEXT DEFAULT 'customer', endpoint TEXT NOT NULL UNIQUE, auth_key TEXT NOT NULL, p256dh_key TEXT NOT NULL, user_agent TEXT, last_used_at TEXT, device_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE erpnext_mappings (id INTEGER PRIMARY KEY AUTOINCREMENT, local_type TEXT NOT NULL, local_id TEXT NOT NULL, erpnext_id INTEGER NOT NULL, erpnext_model TEXT NOT NULL, sync_status TEXT DEFAULT 'synced', error_message TEXT, attempts INTEGER DEFAULT 0, last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(local_type, local_id));
    CREATE TABLE erpnext_product_sync (product_id TEXT PRIMARY KEY, erpnext_product_id INTEGER NOT NULL, last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, erpnext_write_date TEXT, cached_stock INTEGER, cached_price REAL);
    CREATE TABLE erpnext_sync_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, mapping_id INTEGER, attempt INTEGER, status TEXT NOT NULL, error_message TEXT, latency_ms INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE reservations (id TEXT PRIMARY KEY, table_id TEXT NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, guest_count INTEGER NOT NULL DEFAULT 2, date TEXT NOT NULL, time TEXT NOT NULL, zone TEXT NOT NULL, status TEXT DEFAULT 'confirmed', notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id TEXT NOT NULL DEFAULT 'default');
    CREATE TABLE suppliers (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact_person TEXT, phone TEXT, email TEXT, address TEXT, payment_terms TEXT DEFAULT 'COD', tax_id TEXT, notes TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE purchase_orders (id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL, po_number TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'draft', order_date TEXT, expected_delivery_date TEXT, subtotal REAL DEFAULT 0, tax REAL DEFAULT 0, shipping REAL DEFAULT 0, total REAL DEFAULT 0, notes TEXT, created_by TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE purchase_order_items (id TEXT PRIMARY KEY, purchase_order_id TEXT NOT NULL, ingredient_id TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL DEFAULT 'g', unit_price REAL NOT NULL DEFAULT 0, total_price REAL NOT NULL DEFAULT 0, received_quantity REAL DEFAULT 0);
    CREATE TABLE email_verifications (id TEXT PRIMARY KEY, email TEXT NOT NULL, code TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE contact_messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT, category TEXT, content TEXT NOT NULL, status TEXT DEFAULT 'unread', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE recruitment_applications (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, phone TEXT NOT NULL, birth_year TEXT, position TEXT NOT NULL DEFAULT 'barista', shifts TEXT NOT NULL DEFAULT '[]', experience TEXT DEFAULT 'none', note TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE sop_violations (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', staff_id TEXT NOT NULL, staff_name TEXT, category TEXT NOT NULL, is_serious INTEGER NOT NULL DEFAULT 0, description TEXT, occurred_at TEXT, recorded_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'recorded', discipline_step TEXT, confirmed_by TEXT, confirmed_at TEXT, applied_by TEXT, applied_at TEXT, appeal_explanation TEXT, audit_log_id TEXT, closed_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  `);

  function prepare(sql: string) {
    let args: unknown[] = [];
    const run = () => {
      const before = Number((sqlite.prepare('SELECT total_changes() AS count').get() as { count?: number })?.count ?? 0);
      const result = sqlite.prepare(sql).run(...(args as never[]));
      const after = Number((sqlite.prepare('SELECT total_changes() AS count').get() as { count?: number })?.count ?? 0);
      return { success: true, meta: { changes: after - before, last_row_id: Number(result.lastInsertRowid) } };
    };
    const statement = {
      bind(...values: unknown[]) { args = values; return statement; },
      async first() { return sqlite.prepare(sql).get(...(args as never[])) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...(args as never[])), success: true, meta: {} }; },
      async run() { return run(); },
      async raw() { return []; },
    };
    runStatement.set(statement, run);
    return statement as unknown as D1PreparedStatement;
  }

  const db = {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((st) => {
          const fn = runStatement.get(st);
          if (!fn) throw new Error('Unknown statement in D1 batch');
          return fn();
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as D1Database;

  const kvMap = new Map<string, string>();
  const authKV = {
    get: async (k: string) => kvMap.get(k) ?? null,
    put: async (k: string, v: string) => { kvMap.set(k, v); },
    delete: async (k: string) => { kvMap.delete(k); },
    list: async () => ({ keys: [], list_complete: true, cursor: '' }),
  } as unknown as KVNamespace;

  return { sqlite, db, authKV };
}

describe('Loyalty, Referrals, Inventory PO, Customer Events & Audit Cutover (20261029_11)', () => {
  const migrations = [
    '20261029_03_production_d1_schema_reconciliation.sql',
    '20261029_04_pilot_staff_and_campaign_cutover.sql',
    '20261029_05_catalog_modifiers_kds_stations_and_table_cutover.sql',
    '20261029_06_pilot_shifts_inventory_bom_and_campaigns_seed.sql',
    '20261029_07_payments_crm_reviews_franchise_and_cron_schema_cutover.sql',
    '20261029_08_reservations_erpnext_and_openapi_v1_schema_cutover.sql',
    '20261029_09_dindin_mautic_shift_reconciliation_and_column_cutover.sql',
    '20261029_10_crm_campaigns_table_zones_and_audit_column_cutover.sql',
    '20261029_11_loyalty_referrals_inventory_po_customer_events_and_audit_cutover.sql',
  ].map((file) => readFileSync(resolve(__dirname, `../../../db/migrations/${file}`), 'utf-8'));

  const down11 = readFileSync(
    resolve(__dirname, '../../../db/migrations/20261029_11_loyalty_referrals_inventory_po_customer_events_and_audit_cutover.down.sql'),
    'utf-8'
  );

  it('applies 20261029_03..11 cleanly, verifies .down.sql rollback + re-apply, and executes Loyalty, Referrals, Promotions, Purchase Orders, Forecasting, Customer Events & Canonical Audit', async () => {
    const { sqlite, db, authKV } = createProductionReplica();
    for (const sql of migrations) sqlite.exec(sql);

    sqlite.exec(down11);
    sqlite.exec(migrations[8]);

    // 1. Domain CRM loyalty_tiers policy & OpenAPI Loyalty
    const policy = await loadPolicy(db);
    expect(policy.tiers).toHaveLength(4);
    expect(tierByName(policy, 'silver').minPoints).toBe(500);
    expect(tierByName(policy, 'gold').minPoints).toBe(1000);

    const secret = 'test-secret-key-at-least-32-characters-long';
    const env = { AURA_DB: db, DB: db, AUTH_KV: authKV, STAFF_SESSION_SECRET: secret, JWT_SECRET: secret, PILOT_TENANT_ID: 'default' } as unknown as Env;
    const { token: ownerToken } = await issueStaffSession(
      { JWT_SECRET: secret },
      { id: 'USR_owner01', name: 'AURA Owner', phone: '0901234567', role: 'owner', active: 1, is_active: 1, tenant_id: 'default', auth_version: 1 },
      { email: 'admin@auraspace.vn', sessionType: 'staff-web' }
    );
    const ownerAuth = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
    const cust1Token = await generateJWT({ sub: 'cust_01', id: 'cust_01', role: 'customer', tenant_id: 'default' } as never, secret);
    const cust2Token = await generateJWT({ sub: 'cust_02', id: 'cust_02', role: 'customer', tenant_id: 'default' } as never, secret);

    const app = new Hono<{ Bindings: Env }>();
    app.route('/', openApiLoyaltyRouter);
    app.route('/', openApiPromotionsRouter);
    app.route('/', openApiInventoryRouter);
    app.route('/', openApiCronRouter);
    app.route('/api/inventory/forecasting', inventoryForecastingRouter);
    app.route('/api/referrals', referralRouter);
    app.route('/api/checkin', checkinRouter);

    const tiersRes = await app.request('/api/loyalty/tiers', { headers: ownerAuth }, env);
    expect(tiersRes.status).toBe(200);
    const tiersBody = (await tiersRes.json()) as { data: Array<{ name: string }> };
    expect(tiersBody.data.length).toBeGreaterThanOrEqual(4);

    // 2. Referrals generate & apply
    const codeRes = await app.request('/api/referrals/code', { headers: { Authorization: `Bearer ${cust1Token}` } }, env);
    expect(codeRes.status).toBe(200);
    const { data: refData } = (await codeRes.json()) as { data: { code: string } };
    expect(refData.code).toMatch(/^FNB-/);

    const applyRes = await app.request('/api/referrals/apply', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: refData.code }),
    }, env);
    expect(applyRes.status).toBe(200);

    // 3. Check-in create & staff approve
    const ciRes = await app.request('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: 'cust_01', customer_name: 'Khách 1', phone: '0911111111' }),
    }, env);
    expect(ciRes.status).toBe(201);

    // 4. Promotions use & summary
    const promoUuid = '11111111-1111-4111-8111-111111111111';
    const orderUuid = '22222222-2222-4222-8222-222222222222';
    sqlite.exec(`INSERT INTO promotions (id, code, name, type, discount_type, discount_value, is_active, max_uses, current_uses) VALUES ('${promoUuid}', 'WELCOME11', 'Welcome 11', 'code', 'fixed_amount', 15000, 1, 100, 0)`);
    const usePromoRes = await app.request('/api/promotions/use', {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({ promotionId: promoUuid, orderId: orderUuid, discountAmount: 15000, idempotencyKey: 'idem_promo_11' }),
    }, env);
    expect(usePromoRes.status).toBe(200);

    // 5. Purchase Orders & Inventory Forecasting Snapshot
    sqlite.exec(`INSERT OR IGNORE INTO suppliers (id, name, phone, is_active) VALUES ('sup_pilot_01', 'Cầu Đất Farm', '0909000111', 1)`);
    sqlite.exec(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_stock, cost_per_unit) VALUES ('ing_cf_beans', 'Hạt Arabica', 'g', 1000, 100, 350)`);
    const poRes = await app.request('/api/inventory/purchase-orders', {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({ supplierId: 'sup_pilot_01', locationId: 'default', items: [{ ingredientId: 'ing_cf_beans', quantity: 500, unitCost: 350 }] }),
    }, env);
    expect(poRes.status).toBe(201);

    const snapRes = await app.request('/api/inventory/forecasting/snapshot', { method: 'POST', headers: ownerAuth }, env);
    expect(snapRes.status).toBe(200);

    // 6. Customer 360 claimGuestOrder & Canonical Audit Log on INTEGER PRIMARY KEY AUTOINCREMENT
    const claimRes = await claimGuestOrder({ db: db as never, orderId: 'ord_guest_01', actor: { id: 'cust_01', role: 'customer' } });
    expect(claimRes.success).toBe(true);
    const auditWrite = await writeCanonicalAuditLog(
      db as never,
      { actor: { id: 'USR_owner01', name: 'AURA Owner' }, action: 'loyalty_cutover_verified', resourceType: 'migration', resourceId: '20261029_11' },
      'strict_fail_closed'
    );
    expect(auditWrite.ok).toBe(true);

    // Verify OpenAPI purchase-order audit_logs row wrote user_id, entity_type, entity_id, metadata despite INTEGER PRIMARY KEY AUTOINCREMENT id
    const poAuditRow = sqlite.prepare(`SELECT user_id, entity_type, action FROM audit_logs WHERE action = 'purchase_order_create'`).get() as {
      user_id: string;
      entity_type: string;
      action: string;
    } | undefined;
    expect(poAuditRow?.user_id).toBe('USR_owner01');
    expect(poAuditRow?.entity_type).toBe('purchase_order');

    // 7. Notification Orchestration on notification_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT)
    const notifIntent = createNotificationIntent(
      {
        id: 'evt_order_ready_01',
        type: 'order.ready',
        payload: { orderNumber: '101' },
        correlationId: 'corr_notif_01',
        occurredAt: new Date().toISOString(),
      },
      'zalo_zns',
      'zalo_zns',
      { customerId: 'cust_01', phone: '0911111111' },
      'tpl_order_ready'
    );
    const notifResult = await processNotificationIntent(
      db as never,
      notifIntent,
      async () => ({ ok: true, providerMessageId: 'zns_msg_01' })
    );
    expect(notifResult.ok).toBe(true);
    expect(notifResult.status).toBe('delivered');
    const notifAuditRow = sqlite.prepare(`SELECT channel, recipient, status, idempotency_key FROM notification_audit_log WHERE event_id = 'evt_order_ready_01'`).get() as {
      channel: string;
      recipient: string;
      status: string;
      idempotency_key: string;
    } | undefined;
    expect(notifAuditRow?.status).toBe('delivered');
    expect(notifAuditRow?.recipient).toBe('0911111111');

    // 8. Canonical Shift Lifecycle on staff_shifts (staff_email NOT NULL, clock_in NOT NULL)
    const openedShift = await openCanonicalShift(db as never, {
      staffId: 'USR_owner01',
      staffName: 'AURA Owner',
      role: 'owner',
      openingCash: 500000,
      notes: 'Morning shift',
    });
    expect(openedShift.ok).toBe(true);
    expect(openedShift.shift?.status).toBe('open');
    await recordShiftSale(db as never, {
      shiftId: openedShift.shift!.id,
      orderId: 'ord_kds_01',
      amount: 90000,
      paymentMethod: 'cash',
    });
    const closedShift = await closeCanonicalShift(db as never, {
      shiftId: openedShift.shift!.id,
      closedByStaffId: 'USR_owner01',
      closedByRole: 'owner',
      actualCash: 590000,
    });
    expect(closedShift.ok).toBe(true);
    expect(closedShift.shift?.status).toBe('closed');
    expect(closedShift.variance).toBe(0);

    // 9. ERPNext Product Sync on erpnext_product_sync (erpnext_product_id INTEGER NOT NULL)
    const erpClient = new ErpnextProductClient('https://erp.example.com', 'key', 'secret');
    const erpSyncRes = await erpClient.syncProductsToLocal(env as never, [
      {
        name: 'ITEM-CF-01',
        item_code: 'ITEM-CF-01',
        item_name: 'Cà Phê Sữa Đá ERP',
        item_group: 'Cà Phê',
        standard_rate: 45000,
        disabled: 0,
        modified: '2026-10-29 10:00:00',
      } as never,
    ]);
    expect(erpSyncRes.updated).toBe(1);
    expect(erpSyncRes.errors).toEqual([]);
    const erpSyncRow = sqlite.prepare(`SELECT erpnext_item_code, erpnext_product_id FROM erpnext_product_sync WHERE erpnext_item_code = 'ITEM-CF-01'`).get() as {
      erpnext_item_code: string;
      erpnext_product_id: number;
    } | undefined;
    expect(erpSyncRow?.erpnext_item_code).toBe('ITEM-CF-01');
    expect(erpSyncRow?.erpnext_product_id).toBe(0);

    // 10. Catalog Images, BOM recipe_ingredients & Cron Seed Cutover (20261030_01)
    sqlite.exec(`
      INSERT OR IGNORE INTO products (id, category_id, name, price, is_available, sort_order)
      VALUES ('tc001', 'cat_coffee', 'Cà Phê Đen', 25000, 1, 2);
      INSERT OR IGNORE INTO menu_items (id, name, category, price, available)
      VALUES ('tc001', 'Cà Phê Đen', 'Cà Phê', 25000, 1);
    `);
    const migration30Up = readFileSync(
      resolve(__dirname, '../../../db/migrations/20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql'),
      'utf8'
    );
    const migration30Down = readFileSync(
      resolve(__dirname, '../../../db/migrations/20261030_01_catalog_images_bom_ingredients_and_cron_seed.down.sql'),
      'utf8'
    );
    sqlite.exec(migration30Up);

    const tc001Product = sqlite.prepare(`SELECT image_url FROM products WHERE id = 'tc001'`).get() as { image_url: string };
    expect(tc001Product.image_url).toBe('/menu/aura-drinks/ca-phe-den.webp');
    const tc001Menu = sqlite.prepare(`SELECT image_url FROM menu_items WHERE id = 'tc001'`).get() as { image_url: string };
    expect(tc001Menu.image_url).toBe('/menu/aura-drinks/ca-phe-den.webp');
    const bomCount = sqlite.prepare(`SELECT COUNT(*) AS cnt FROM recipe_ingredients`).get() as { cnt: number };
    expect(bomCount.cnt).toBeGreaterThanOrEqual(46);
    const cronCount = sqlite.prepare(`SELECT COUNT(*) AS cnt FROM cron_jobs`).get() as { cnt: number };
    expect(cronCount.cnt).toBe(5);

    sqlite.exec(migration30Down);
    sqlite.exec(migration30Up);
    const cronCountAfterReapply = sqlite.prepare(`SELECT COUNT(*) AS cnt FROM cron_jobs`).get() as { cnt: number };
    expect(cronCountAfterReapply.cnt).toBe(5);

    const delInUseRes = await app.request('/api/inventory/ingredients/ing_coffee_bean', {
      method: 'DELETE',
      headers: ownerAuth,
    }, env);
    expect(delInUseRes.status).toBe(409);
    const delInUseBody = (await delInUseRes.json()) as { error: string };
    expect(delInUseBody.error).toContain('used in recipes');

    const cronJobsRes = await app.request('/api/cron/jobs', { headers: ownerAuth }, env);
    expect(cronJobsRes.status).toBe(200);
    const cronJobsBody = (await cronJobsRes.json()) as { data: { jobs: Array<{ id: string }> } };
    expect(cronJobsBody.data.jobs).toHaveLength(5);

    const reconRes = await reconcileShiftCash(
      { AURA_DB: db as never },
      {
        shift_id: openedShift.shift!.id,
        opening_float: 500000,
        denominations: {
          denominations: [{ denomination: 500000, count: 1 }],
          total_amount: 500000,
        },
        notes: 'Balanced shift',
      },
      'USR_owner01'
    );
    expect(reconRes.shift_id).toBe(openedShift.shift!.id);
    expect(reconRes.variance_status).toBe('balanced');
  });
});
