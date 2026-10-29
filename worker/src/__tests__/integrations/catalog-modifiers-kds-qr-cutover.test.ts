// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { createOrder } from '../../../../packages/domain/order/commands/create-order';
import { getCustomerMenu } from '../../../../packages/domain/catalog/commands/get-customer-menu';
import { qrRouter } from '../../../../packages/domain/table/commands/qr-scan';
import { signQRUrl } from '../../tree/qr/signer';

function createCatalogKdsTableReplica() {
  const sqlite = new DatabaseSync(':memory:');
  const runStatement = new WeakMap<object, () => unknown>();

  sqlite.exec(`
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      sort_order INTEGER DEFAULT 0
    );
    INSERT INTO categories (id, name, sort_order) VALUES
      ('cat_trad_coffee', 'Cà Phê Truyền Thống', 1),
      ('cat_hot_coffee',  'Cà Phê Nóng',         2),
      ('cat_tea',         'Trà',                 3),
      ('cat_yogurt',      'Sữa Chua',            4),
      ('cat_bottled',     'Nước Đóng Chai',      5);

    CREATE TABLE menu_items (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      tags TEXT DEFAULT '[]',
      badge TEXT,
      available BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_local_specialty INTEGER DEFAULT 0,
      ingredient_source TEXT,
      image_url TEXT
    );
    INSERT INTO menu_items (id, category, name, price, available) VALUES
      ('tc001', 'traditional-coffee', 'Cà phê sữa đá', 25000, 1),
      ('hc001', 'hot-coffee',         'Cà phê đen nóng', 20000, 1),
      ('yg001', 'yogurt',             'Sữa chua đá', 30000, 1),
      ('yg004', 'yogurt',             'Yaourt hủ', 15000, 1),
      ('bt001', 'bottled',            'Nước suối', 12000, 1);

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
      ('tc001', 'cat_trad_coffee', 'Cà phê sữa đá', 25000, 1, 1),
      ('hc001', 'cat_hot_coffee',  'Cà phê đen nóng', 20000, 1, 2),
      ('yg001', 'cat_yogurt',      'Sữa chua đá', 30000, 1, 3),
      ('yg004', 'cat_yogurt',      'Yaourt hủ', 15000, 1, 4),
      ('bt001', 'cat_bottled',     'Nước suối', 12000, 1, 5);

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
      ('t05', 5, 'Outdoor', 4, 'Reserved', 'default'),
      ('t12', 12, 'VIP', 8, 'Occupied', 'default');

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
      status TEXT DEFAULT 'pending',
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      customer_address TEXT,
      payment_method TEXT DEFAULT 'cod',
      payment_status TEXT DEFAULT 'unpaid',
      shipping_fee INTEGER DEFAULT 0,
      discount INTEGER DEFAULT 0,
      notes TEXT,
      delivery_time TEXT DEFAULT 'now',
      table_id TEXT,
      subtotal INTEGER DEFAULT 0,
      tax INTEGER DEFAULT 0,
      total_amount INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      cashback_used REAL DEFAULT 0,
      cashback_earned REAL DEFAULT 0,
      points_earned INTEGER DEFAULT 0,
      reward_code_used TEXT,
      customer_id TEXT,
      staff_id TEXT,
      table_number INTEGER,
      is_cod INTEGER DEFAULT 0,
      cod_paid_at TEXT,
      fulfillment_type TEXT DEFAULT 'dine_in',
      delivery_address TEXT,
      locale TEXT DEFAULT 'vi',
      location_id TEXT,
      order_type TEXT DEFAULT 'dine_in',
      tip_amount INTEGER DEFAULT 0,
      service_fee INTEGER DEFAULT 0,
      updated_by TEXT,
      tenant_id TEXT DEFAULT 'default'
    );
    INSERT INTO orders (id, items, total, status, customer_name, customer_phone, tenant_id, created_at) VALUES
      ('ord_stale_apr', '[]', 25000, 'pending', 'Stale April Guest', '0900000001', 'default', '2026-04-18 10:00:00'),
      ('ord_stale_oct', '[]', 30000, 'preparing', 'Stale Oct Guest', '0900000002', 'default', '2026-10-21 15:00:00'),
      ('ord_live_today', '[]', 25000, 'pending', 'Live Today Guest', '0900000003', 'default', '2026-10-29 09:00:00');

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
    CREATE TABLE _metrics (name TEXT, value REAL, tags TEXT, created_at TEXT);
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
      bind(...values: unknown[]) {
        args = values;
        return statement;
      },
      async first() {
        return sqlite.prepare(sql).get(...(args as never[])) ?? null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...(args as never[])), success: true, meta: {} };
      },
      async run() {
        return run();
      },
      async raw() {
        return [];
      },
    };
    runStatement.set(statement, run);
    return statement as unknown as D1PreparedStatement;
  }

  const db = {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement) => {
          const run = runStatement.get(statement);
          if (!run) throw new Error('Unknown statement in local D1 batch');
          return run();
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as D1Database;

  const kvMap = new Map<string, string>();
  const authKV = {
    get: async (key: string) => kvMap.get(key) ?? null,
    put: async (key: string, value: string) => {
      kvMap.set(key, value);
    },
    delete: async (key: string) => {
      kvMap.delete(key);
    },
  } as unknown as KVNamespace;

  return { sqlite, db, authKV };
}

describe('Catalog Modifiers, Kitchen Stations & KDS/Table Cutover (20261029_05)', () => {
  const migration03 = readFileSync(
    resolve(__dirname, '../../../db/migrations/20261029_03_production_d1_schema_reconciliation.sql'),
    'utf-8'
  );
  const migration05 = readFileSync(
    resolve(__dirname, '../../../db/migrations/20261029_05_catalog_modifiers_kds_stations_and_table_cutover.sql'),
    'utf-8'
  );

  it('seeds beverage modifiers & kitchen stations, clears stale KDS orders, and resolves QR/table orders end-to-end', async () => {
    const { sqlite, db, authKV } = createCatalogKdsTableReplica();
    sqlite.exec(migration05);

    // 1. Verify pre-launch orders before 2026-10-28 were cancelled while today's live order remains pending
    const activeKdsOrders = sqlite
      .prepare("SELECT id FROM orders WHERE status IN ('pending', 'confirmed', 'preparing', 'ready') ORDER BY created_at ASC")
      .all() as Array<{ id: string }>;
    expect(activeKdsOrders.map((r) => r.id)).toEqual(['ord_live_today']);

    // 2. Verify GET /api/menu returns modifierChoices for craft drinks and empty for packaged items
    const menuData = await getCustomerMenu(db, {});
    const allItems = menuData.categories.flatMap((c) => c.items);
    const tradCoffee = allItems.find((i) => i.id === 'tc001');
    const packagedYogurt = allItems.find((i) => i.id === 'yg004');
    expect(tradCoffee?.modifierChoices?.length).toBe(10);
    expect(packagedYogurt?.modifierChoices).toEqual([]);

    // 3. Verify kitchen stations and category routing were seeded
    const stationCount = sqlite.prepare('SELECT COUNT(*) AS cnt FROM kitchen_stations').get() as { cnt: number };
    const routingCount = sqlite.prepare('SELECT COUNT(*) AS cnt FROM category_stations').get() as { cnt: number };
    expect(stationCount.cnt).toBe(4);
    expect(routingCount.cnt).toBe(20);

    // 4. Verify stale cafe_tables locks were reset to Available and QR scan resolves 1-indoor -> t01
    const tablesAvailable = sqlite
      .prepare("SELECT COUNT(*) AS cnt FROM cafe_tables WHERE status = 'Available'")
      .get() as { cnt: number };
    expect(tablesAvailable.cnt).toBe(3);

    const qrSecret = 'test-qr-secret-key-2026';
    const signedUrl = await signQRUrl('1-indoor', qrSecret, 'https://auraspace.cafe');
    const parsedUrl = new URL(signedUrl);
    const qrRes = await qrRouter.fetch(
      new Request(`https://auraspace.cafe/1-indoor${parsedUrl.search}`),
      { AURA_DB: db, QR_SIGNING_SECRET: qrSecret } as never
    );
    expect(qrRes.status).toBe(200);
    expect(qrRes.headers.get('X-Table-ID')).toBe('t01');

    // 5. Verify POST /api/orders accepts canonical modifiers and resolves QR slug '1-indoor' & zero-padded '05'
    const env = { AURA_DB: db, AUTH_KV: authKV, PILOT_TENANT_ID: 'default' };
    for (const tableInput of ['1-indoor', '05', 't12']) {
      const res = await createOrder(
        new Request('https://auraspace.cafe/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Khách Tại Bàn',
            customer_phone: '0901112223',
            order_type: 'dine_in',
            table_id: tableInput,
            payment_method: 'cod',
            total: 25000,
            items: [
              {
                id: 'tc001',
                name: 'Cà phê sữa đá',
                price: 25000,
                quantity: 1,
                modifiers: ['70% ít ngọt', 'Ít đá'],
              },
            ],
          }),
        }),
        env
      );
      expect(res.status).toBe(201);
    }
  });
});
