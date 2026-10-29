// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { openApiTablesRouter } from '../../routes/openapi-tables';
import { openApiOrdersRouter } from '../../routes/openapi-orders';
import { getKdsMobile } from '../../../../packages/domain/kitchen/commands/kds-mobile';
import { deduplicate, logSend } from '../../tree/campaigns/campaign-engine';
import { issueStaffSession } from '../../lib/staff-session';
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
    CREATE TABLE menu_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_en TEXT, category TEXT NOT NULL, price INTEGER NOT NULL, description TEXT, image_url TEXT, available INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE menu_modifiers (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, option_name TEXT NOT NULL, price_delta INTEGER NOT NULL DEFAULT 0, available INTEGER NOT NULL DEFAULT 1, updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE modifier_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'single', required INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE modifier_choices (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, price_delta INTEGER NOT NULL DEFAULT 0, is_default INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), is_available INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE product_modifier_groups (product_id TEXT NOT NULL, group_id TEXT NOT NULL, sort_order INTEGER DEFAULT 0, PRIMARY KEY (product_id, group_id));
    CREATE TABLE happy_hour_windows (id TEXT PRIMARY KEY, name TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, discount_rate REAL NOT NULL DEFAULT 0, apply_to TEXT NOT NULL DEFAULT 'all', apply_ids TEXT, priority INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE kitchen_stations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE category_stations (category_id TEXT NOT NULL, station_id TEXT NOT NULL, PRIMARY KEY (category_id, station_id));
    CREATE TABLE order_item_stations (order_item_id TEXT NOT NULL, station_id TEXT NOT NULL, started_at TEXT, ready_at TEXT, PRIMARY KEY (order_item_id, station_id));
    CREATE TABLE kds_stations (id TEXT PRIMARY KEY, name TEXT NOT NULL, categories TEXT NOT NULL DEFAULT '[]', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, table_number INTEGER UNIQUE NOT NULL, zone TEXT NOT NULL, seats INTEGER NOT NULL DEFAULT 4, status TEXT DEFAULT 'Available', current_order_id TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id TEXT NOT NULL DEFAULT 'default');
    INSERT INTO cafe_tables (id, table_number, zone, seats, status, tenant_id) VALUES ('t01', 1, 'Indoor', 4, 'Available', 'default');
    CREATE TABLE table_sessions (id TEXT PRIMARY KEY, table_id TEXT NOT NULL, customer_id TEXT, customer_name TEXT, customer_phone TEXT, status TEXT NOT NULL DEFAULT 'active', opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at DATETIME, order_count INTEGER NOT NULL DEFAULT 0, total_amount INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE table_qr_codes (id TEXT PRIMARY KEY, table_id TEXT NOT NULL, code TEXT NOT NULL UNIQUE, scans INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE customers (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, phone TEXT, loyalty_points INTEGER DEFAULT 0, loyalty_tier TEXT DEFAULT 'gold', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, date_of_birth TEXT, zalo TEXT, source TEXT DEFAULT 'unknown', lifetime_points INTEGER DEFAULT 0);
    INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, date_of_birth) VALUES ('cust_01', 'vip@auraspace.vn', 'Nguyễn Văn A', '0909123456', 1200, 'gold', '1992-05-15');
    CREATE TABLE orders (id TEXT PRIMARY KEY, items TEXT NOT NULL, total INTEGER NOT NULL, status TEXT DEFAULT 'pending', customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_email TEXT, customer_address TEXT, payment_method TEXT DEFAULT 'cod', payment_status TEXT DEFAULT 'unpaid', shipping_fee INTEGER DEFAULT 0, discount INTEGER DEFAULT 0, notes TEXT, delivery_time TEXT DEFAULT 'now', table_id TEXT, subtotal INTEGER DEFAULT 0, tax INTEGER DEFAULT 0, total_amount INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, cashback_used REAL DEFAULT 0, cashback_earned REAL DEFAULT 0, points_earned INTEGER DEFAULT 0, reward_code_used TEXT, customer_id TEXT, staff_id TEXT, table_number INTEGER, is_cod INTEGER DEFAULT 0, cod_paid_at TEXT, fulfillment_type TEXT DEFAULT 'dine_in', delivery_address TEXT, locale TEXT DEFAULT 'vi', location_id TEXT, order_type TEXT DEFAULT 'dine_in', tip_amount INTEGER DEFAULT 0, service_fee INTEGER DEFAULT 0, updated_by TEXT, tenant_id TEXT DEFAULT 'default');
    INSERT INTO orders (id, items, total, total_amount, subtotal, tax, status, customer_name, customer_phone, customer_id, table_id, table_number, notes, order_type, payment_method, payment_status, created_at)
    VALUES ('ord_kds_01', '[{"id":"prod_cf_01","name":"Cà Phê Sữa Đá","quantity":2,"price":45000}]', 90000, 90000, 90000, 0, 'preparing', 'Nguyễn Văn A', '0909123456', 'cust_01', 't01', 1, 'Ít đá, nhiều sữa', 'dine_in', 'payos', 'paid', datetime('now'));
    CREATE TABLE order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, subtotal INTEGER NOT NULL, modifiers TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO order_items (id, order_id, product_id, quantity, subtotal) VALUES ('oi_kds_01', 'ord_kds_01', 'prod_cf_01', 2, 90000);
    CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, method TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', transaction_id TEXT, payment_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE promotions (code TEXT PRIMARY KEY, percent INTEGER NOT NULL DEFAULT 0, max_discount INTEGER DEFAULT 0, min_order INTEGER DEFAULT 0, usage_limit INTEGER DEFAULT 0, usage_count INTEGER DEFAULT 0, starts_at TEXT, expires_at TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE promotion_redemptions (id INTEGER PRIMARY KEY AUTOINCREMENT, promotion_id TEXT, code TEXT NOT NULL, order_id TEXT UNIQUE NOT NULL, customer_id TEXT, customer_phone TEXT, discount_amount INTEGER NOT NULL DEFAULT 0, order_total INTEGER NOT NULL DEFAULT 0, tenant_id TEXT NOT NULL DEFAULT 'default', redeemed_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE promotion_usages (id TEXT PRIMARY KEY, promotion_id TEXT NOT NULL, customer_id TEXT, order_id TEXT, discount_amount REAL NOT NULL DEFAULT 0, used_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE bonus_campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, start_date TEXT NOT NULL, end_date TEXT NOT NULL, cashback_multiplier REAL DEFAULT 1, signup_bonus_vnd INTEGER DEFAULT 0, signup_bonus_cap INTEGER DEFAULT 0, refer_bonus_vnd INTEGER DEFAULT 0, max_cap_per_customer_vnd INTEGER DEFAULT 50000, auto_upgrade_tier TEXT, auto_upgrade_min_spend INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE cashback_wallets (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL UNIQUE, balance REAL NOT NULL DEFAULT 0, total_earned REAL NOT NULL DEFAULT 0, total_spent REAL NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE cashback_transactions (id TEXT PRIMARY KEY, wallet_id TEXT NOT NULL, customer_id TEXT NOT NULL, order_id TEXT, type TEXT NOT NULL, amount REAL NOT NULL, balance_after REAL NOT NULL, expires_at TEXT, campaign_id TEXT, description TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE signup_bonus_log (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT NOT NULL, campaign_id INTEGER NOT NULL, bonus_vnd INTEGER NOT NULL, granted_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE loyalty_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT, staff_id TEXT, action TEXT NOT NULL, amount_vnd REAL, order_id TEXT, metadata TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE referral_codes (code TEXT PRIMARY KEY, customer_id TEXT NOT NULL UNIQUE, uses_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE referrals (id TEXT PRIMARY KEY, referrer_id TEXT NOT NULL, referred_customer_id TEXT NOT NULL, referral_code TEXT NOT NULL, points_awarded INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, cashback_awarded_vnd INTEGER DEFAULT 0, first_order_id TEXT, first_order_amount INTEGER DEFAULT 0, reward_paid_at TEXT);
    CREATE TABLE ingredients (id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'g', current_stock REAL NOT NULL DEFAULT 0, min_stock REAL NOT NULL DEFAULT 0, max_stock REAL, cost_per_unit REAL NOT NULL DEFAULT 0, supplier_id TEXT, sku TEXT, category TEXT DEFAULT 'raw', is_active INTEGER DEFAULT 1, last_restocked_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE inventory_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_en TEXT, unit TEXT NOT NULL, current_stock REAL NOT NULL DEFAULT 0, min_stock REAL NOT NULL DEFAULT 0, cost_per_unit INTEGER NOT NULL DEFAULT 0, supplier TEXT, active INTEGER NOT NULL DEFAULT 1, updated_at TEXT DEFAULT (datetime('now')), sku TEXT, category TEXT DEFAULT 'general', max_stock REAL DEFAULT 1000, reorder_point REAL DEFAULT 10, location TEXT DEFAULT 'main', expiry_date TEXT, created_at TEXT DEFAULT (datetime('now')), supplier_id TEXT, tenant_id TEXT NOT NULL DEFAULT 'default');
    CREATE TABLE inventory_transactions (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL, reference_id TEXT, notes TEXT, staff_id TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE recipes (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, name TEXT, instructions TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE recipe_items (id TEXT PRIMARY KEY, recipe_id TEXT NOT NULL, ingredient_id TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL DEFAULT 'g');
    CREATE TABLE stock_movements (id TEXT PRIMARY KEY, ingredient_id TEXT NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL, reference_id TEXT, reference_type TEXT, notes TEXT, created_by TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE campaign_configs (trigger TEXT PRIMARY KEY CHECK (trigger IN ('welcome', 'birthday', 'winback', 'post_visit', 'cashback_expiry')), is_active INTEGER NOT NULL DEFAULT 1, channels TEXT NOT NULL DEFAULT '["sms"]', timing TEXT, updated_at TEXT);
    CREATE TABLE campaign_logs (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, trigger TEXT NOT NULL, channel TEXT NOT NULL, sent_at TEXT NOT NULL DEFAULT (datetime('now')), status TEXT NOT NULL DEFAULT 'sent', error TEXT);
    CREATE TABLE consents (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, purpose TEXT NOT NULL, granted INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL, policy_version TEXT NOT NULL DEFAULT 'v1', granted_at TEXT NOT NULL, revoked_at TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE customer_identities (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, identifier_type TEXT NOT NULL, identifier_value TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0, verified_at TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE loyalty_point_logs (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, order_id TEXT, points_change INTEGER NOT NULL, reason TEXT, balance_after INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, description TEXT);
    CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL, actor_name TEXT, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, details TEXT, ip_address TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE notification_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, phone TEXT, customer_id INTEGER, template_key TEXT, data TEXT, status TEXT NOT NULL, response TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, event_id TEXT, idempotency_key TEXT, correlation_id TEXT, provider TEXT);
    CREATE TABLE push_subscriptions (id TEXT PRIMARY KEY, customer_id TEXT, role TEXT DEFAULT 'customer', endpoint TEXT NOT NULL UNIQUE, auth_key TEXT NOT NULL, p256dh_key TEXT NOT NULL, user_agent TEXT, last_used_at TEXT, device_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE erpnext_mappings (id INTEGER PRIMARY KEY AUTOINCREMENT, local_type TEXT NOT NULL, local_id TEXT NOT NULL, erpnext_id INTEGER NOT NULL, erpnext_model TEXT NOT NULL, sync_status TEXT DEFAULT 'synced', error_message TEXT, attempts INTEGER DEFAULT 0, last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(local_type, local_id));
    CREATE TABLE erpnext_product_sync (product_id TEXT PRIMARY KEY, erpnext_product_id INTEGER NOT NULL, last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, erpnext_write_date TEXT, cached_stock INTEGER, cached_price REAL);
    CREATE TABLE erpnext_sync_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, mapping_id INTEGER, attempt INTEGER, status TEXT NOT NULL, error_message TEXT, latency_ms INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE reservations (id TEXT PRIMARY KEY, table_id TEXT NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, guest_count INTEGER NOT NULL DEFAULT 2, date TEXT NOT NULL, time TEXT NOT NULL, zone TEXT NOT NULL, status TEXT DEFAULT 'confirmed', notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id TEXT NOT NULL DEFAULT 'default');
    CREATE TABLE suppliers (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact_person TEXT, phone TEXT, email TEXT, address TEXT, payment_terms TEXT DEFAULT 'COD', tax_id TEXT, notes TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE purchase_orders (id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL, po_number TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'draft', total_cost REAL NOT NULL DEFAULT 0, expected_delivery TEXT, received_at TEXT, notes TEXT, created_by TEXT, approved_by TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE purchase_order_items (id TEXT PRIMARY KEY, purchase_order_id TEXT NOT NULL, ingredient_id TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL DEFAULT 'g', unit_price REAL NOT NULL DEFAULT 0, total_price REAL NOT NULL DEFAULT 0, received_quantity REAL DEFAULT 0);
    CREATE TABLE email_verifications (email TEXT PRIMARY KEY, code TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER DEFAULT 0, verified INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
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

describe('CRM 360, Campaign Engine, OpenAPI Table Zones, Order Lifecycle & Audit Column Cutover (20261029_10)', () => {
  const migrations = [
    '20261029_03_production_d1_schema_reconciliation.sql',
    '20261029_04_pilot_staff_and_campaign_cutover.sql',
    '20261029_05_catalog_modifiers_kds_stations_and_table_cutover.sql',
    '20261029_06_pilot_shifts_inventory_bom_and_campaigns_seed.sql',
    '20261029_07_payments_crm_reviews_franchise_and_cron_schema_cutover.sql',
    '20261029_08_reservations_erpnext_and_openapi_v1_schema_cutover.sql',
    '20261029_09_dindin_mautic_shift_reconciliation_and_column_cutover.sql',
    '20261029_10_crm_campaigns_table_zones_and_audit_column_cutover.sql',
  ].map((file) => readFileSync(resolve(__dirname, `../../../db/migrations/${file}`), 'utf-8'));

  const down10 = readFileSync(
    resolve(__dirname, '../../../db/migrations/20261029_10_crm_campaigns_table_zones_and_audit_column_cutover.down.sql'),
    'utf-8'
  );

  it('applies 20261029_03..10 cleanly, verifies .down.sql rollback + re-apply, and executes Table Zones CRUD, KDS Mobile, OpenAPI Orders, Campaign Engine & CRM columns', async () => {
    const { sqlite, db, authKV } = createProductionReplica();
    for (const sql of migrations) sqlite.exec(sql);

    // Test rollback and re-apply of 20261029_10 new tables/indexes
    sqlite.exec(down10);
    for (const stmt of migrations[7].split(';').map((s) => s.trim()).filter(Boolean)) {
      try { sqlite.exec(stmt); } catch (e) {
        if (!String((e as Error).message).includes('duplicate column name')) throw e;
      }
    }

    const jwtSecret = 'cutover-10-jwt-secret-key-minimum-32chars!';
    const env = { AURA_DB: db, DB: db, AUTH_KV: authKV, STAFF_SESSION_SECRET: jwtSecret, JWT_SECRET: jwtSecret, PILOT_TENANT_ID: 'default' } as unknown as Env;
    const { token: ownerToken } = await issueStaffSession(
      { JWT_SECRET: jwtSecret },
      { id: 'USR_OWNER_001', name: 'AURA Owner', phone: '0901234567', role: 'owner', active: 1, is_active: 1, tenant_id: 'default', auth_version: 1 },
      { email: 'admin@auraspace.vn', sessionType: 'staff-web' }
    );
    const authHeaders = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };

    // 1. OpenAPI Table Zones CRUD (create -> get -> patch -> delete) & Canonical cafe_tables layout persistence
    const createZoneRes = await openApiTablesRouter.request(
      '/api/table-zones',
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ slug: 'mezzanine', name: 'Tầng Lửng', description: 'Khu tầng lửng view sông', sortOrder: 5, isActive: true, locationId: 'default' }),
      },
      env
    );
    expect(createZoneRes.status).toBe(201);
    const createdZone = ((await createZoneRes.json()) as { data: { id: string; slug: string; name: string } }).data;
    expect(createdZone.slug).toBe('mezzanine');

    const createTableRes = await openApiTablesRouter.request(
      '/api/tables',
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          code: 'T25',
          name: 'Bàn Tầng Lửng 25',
          zoneId: createdZone.id,
          capacity: 6,
          status: 'available',
          position: { x: 120, y: 240 },
          dimensions: { width: 100, height: 90, rotation: 45 },
          isActive: true,
          locationId: 'default',
        }),
      },
      env
    );
    expect(createTableRes.status).toBe(201);
    const createdTable = ((await createTableRes.json()) as { data: { id: string; code: string; position: { x: number; y: number }; dimensions: { width: number; height: number; rotation: number } } }).data;
    expect(createdTable.code).toBe('T25');
    expect(createdTable.position).toEqual({ x: 120, y: 240 });
    expect(createdTable.dimensions).toEqual({ width: 100, height: 90, rotation: 45 });

    // Deleting zone with active table in cafe_tables returns 409
    const blockedDeleteZone = await openApiTablesRouter.request(
      `/api/table-zones/${createdZone.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${ownerToken}` } },
      env
    );
    expect(blockedDeleteZone.status).toBe(409);

    // Patch table position and delete table, then delete zone succeeds
    const patchTableRes = await openApiTablesRouter.request(
      `/api/tables/${createdTable.id}`,
      {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ position: { x: 160, y: 300 }, capacity: 8 }),
      },
      env
    );
    expect(patchTableRes.status).toBe(200);
    const patchedTable = ((await patchTableRes.json()) as { data: { capacity: number; position: { x: number; y: number } } }).data;
    expect(patchedTable.capacity).toBe(8);
    expect(patchedTable.position).toEqual({ x: 160, y: 300 });

    const delTableRes = await openApiTablesRouter.request(
      `/api/tables/${createdTable.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${ownerToken}` } },
      env
    );
    expect(delTableRes.status).toBe(200);

    const delZoneRes = await openApiTablesRouter.request(
      `/api/table-zones/${createdZone.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${ownerToken}` } },
      env
    );
    expect(delZoneRes.status).toBe(200);

    // 2. KDS Mobile primary query preserves notes & order_number
    const kdsResp = await getKdsMobile({
      env,
      get: (key: string) => {
        if (key === 'user') return { id: 'USR_owner01', role: 'owner' };
        if (key === 'tenantId') return 'default';
        return undefined;
      },
      req: { header: () => undefined },
    } as any);
    expect(kdsResp.status).toBe(200);
    const kdsRes = (await kdsResp.json()) as { success: boolean; orders: Array<{ id: string; notes: string | null; order_number?: string }> };
    expect(kdsRes.orders.length).toBeGreaterThanOrEqual(1);
    const kdsOrd = kdsRes.orders.find((o) => o.id === 'ord_kds_01');
    expect(kdsOrd).toBeDefined();
    expect(kdsOrd?.notes).toBe('Ít đá, nhiều sữa');
    expect(kdsOrd?.order_number).toBe('ord_kds_01');

    // 3. OpenAPI Orders list (sort=order_number), summary (bySource), and status lifecycle update
    const listOrdersRes = await openApiOrdersRouter.request(
      '/api/orders?sort=order_number&order=desc',
      { method: 'GET', headers: { Authorization: `Bearer ${ownerToken}` } },
      env
    );
    expect(listOrdersRes.status).toBe(200);

    const summaryRes = await openApiOrdersRouter.request(
      '/api/orders/summary',
      { method: 'GET', headers: { Authorization: `Bearer ${ownerToken}` } },
      env
    );
    expect(summaryRes.status).toBe(200);
    const summaryBody = (await summaryRes.json()) as { success: boolean; data: { totalOrders: number; bySource: Record<string, number> } };
    expect(summaryBody.success).toBe(true);
    expect(summaryBody.data.totalOrders).toBeGreaterThanOrEqual(1);

    for (const nextStatus of ['ready', 'served', 'completed'] as const) {
      const updateOrdRes = await openApiOrdersRouter.request(
        '/api/orders/ord_kds_01',
        {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ status: nextStatus }),
        },
        env
      );
      expect(updateOrdRes.status).toBe(200);
    }
    const completedOrderRow = sqlite.prepare('SELECT status, served_at, completed_at FROM orders WHERE id = ?').get('ord_kds_01') as { status: string; served_at: string | null; completed_at: string | null };
    expect(completedOrderRow.status).toBe('completed');
    expect(completedOrderRow.served_at).toBeTruthy();
    expect(completedOrderRow.completed_at).toBeTruthy();

    // 4. Campaign Engine dual-column logging & deduplication
    await logSend(db, {
      customer_id: 'cust_01',
      trigger: 'birthday',
      channel: 'zalo',
      sent: true,
    });
    const isDup = await deduplicate(db, 'cust_01', 'birthday', 7);
    expect(isDup).toBe(true);
    const campLogRow = sqlite.prepare('SELECT trigger, trigger_type, sent_at, created_at FROM campaign_logs WHERE customer_id = ?').get('cust_01') as { trigger: string; trigger_type: string; sent_at: string; created_at: string };
    expect(campLogRow.trigger).toBe('birthday');
    expect(campLogRow.trigger_type).toBe('birthday');
    expect(campLogRow.created_at).toBeTruthy();

    // 5. Customer tier & birthday backfill verification
    const custRow = sqlite.prepare('SELECT tier, loyalty_tier, birthday, date_of_birth FROM customers WHERE id = ?').get('cust_01') as { tier: string; loyalty_tier: string; birthday: string; date_of_birth: string };
    expect(custRow.tier).toBe('gold');
    expect(custRow.birthday).toBe('1992-05-15');
  });
});
