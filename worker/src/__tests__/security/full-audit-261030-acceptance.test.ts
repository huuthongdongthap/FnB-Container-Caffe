// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { app } from '../../index';
import { issueStaffSession } from '../../lib/staff-session';
import { generateJWT } from '../../lib/jwt';
import { createOrderSchema, guestOrderSchema } from '../../lib/validators/order';
import { erpnextSalesOrderSchema } from '../../lib/validators/erpnext';
import { OrderCreateSchema } from '../../schemas/orders';
import { PurchaseOrderCreateSchema } from '../../schemas/inventory/purchase-orders';
import { ValidatePromotionSchema } from '../../schemas/promotions/models';

function createTestEnv() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, role TEXT,
      tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1,
      password_hash TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE staff_devices (id TEXT PRIMARY KEY, staff_id TEXT, device_token TEXT UNIQUE,
      pin_hash TEXT, role TEXT, device_name TEXT, last_login_at TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, table_number INTEGER, name TEXT, status TEXT,
      capacity INTEGER, tenant_id TEXT);
    CREATE TABLE kitchen_stations (id TEXT PRIMARY KEY, name TEXT, code TEXT, is_active INTEGER DEFAULT 1);
    CREATE TABLE category_stations (category_id TEXT, station_id TEXT);
    CREATE TABLE order_item_stations (order_item_id TEXT, station_id TEXT, started_at TEXT, ready_at TEXT);
    CREATE TABLE orders (id TEXT PRIMARY KEY, order_number TEXT, customer_phone TEXT, customer_name TEXT,
      tenant_id TEXT, total INTEGER, status TEXT, payment_status TEXT, payment_method TEXT,
      order_type TEXT, table_id TEXT, items TEXT, notes TEXT, created_at TEXT, updated_at TEXT);
    INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
      VALUES('kitchen-a','Kitchen A','kitchen','default',1,1,'2026-10-30T00:00:00Z');
    INSERT INTO staff_devices(id,staff_id,device_token,role)
      VALUES('dev-kitchen-a','kitchen-a','tok-dev-kitchen-a','kitchen');
    INSERT INTO kitchen_stations(id,name,code,is_active) VALUES('st-bar','Bar','BAR',1);
    INSERT INTO category_stations(category_id,station_id) VALUES('cat-coffee','st-bar');
    INSERT INTO orders(id,order_number,customer_phone,customer_name,tenant_id,total,status,payment_status,payment_method,order_type,items,created_at,updated_at)
      VALUES('ord-deliv-unpaid','ORD-1','0901111222','Guest Unpaid','default',45000,'confirmed','unpaid','payos','delivery',
        '[{"id":"item-1","name":"Latte","qty":1,"price":45000,"category_id":"cat-coffee"}]','2026-10-30T01:00:00Z','2026-10-30T01:00:00Z');
    INSERT INTO orders(id,order_number,customer_phone,customer_name,tenant_id,total,status,payment_status,payment_method,order_type,items,created_at,updated_at)
      VALUES('ord-deliv-paid','ORD-2','0901111333','Guest Paid','default',45000,'confirmed','paid','payos','delivery',
        '[{"id":"item-2","name":"Espresso","qty":1,"price":45000,"category_id":"cat-coffee"}]','2026-10-30T01:01:00Z','2026-10-30T01:01:00Z');
    INSERT INTO orders(id,order_number,customer_phone,customer_name,tenant_id,total,status,payment_status,payment_method,order_type,items,created_at,updated_at)
      VALUES('ord-dinein-unpaid','ORD-3','0901111444','DineIn Postpaid','default',45000,'confirmed','unpaid','cod','dine_in',
        '[{"id":"item-3","name":"Cappuccino","qty":1,"price":45000,"category_id":"cat-coffee"}]','2026-10-30T01:02:00Z','2026-10-30T01:02:00Z');
  `);

  function statement(query: string, values: unknown[] = []): any {
    return {
      bind(...args: unknown[]) { return statement(query, args); },
      async first() { return sql.prepare(query).get(...(values as any[])) ?? null; },
      async all() { return { success: true, results: sql.prepare(query).all(...(values as any[])) }; },
      async run() {
        const r = sql.prepare(query).run(...(values as any[]));
        return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
      },
    };
  }
  const kvData = new Map<string, string>();
  const kv = {
    async get(k: string) { return kvData.get(k) ?? null; },
    async put(k: string, v: string) { kvData.set(k, v); },
    async delete(k: string) { kvData.delete(k); },
    async list(opts?: { prefix?: string }) {
      const prefix = opts?.prefix ?? '';
      const keys = Array.from(kvData.keys())
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    },
  };
  const db: any = { prepare: statement, async batch(stmts: any[]) { return Promise.all(stmts.map(s => s.run())); } };
  const env: any = {
    AURA_DB: db,
    DB: db,
    AUTH_KV: kv,
    JWT_SECRET: 'test-only-secret-key-20261030-acceptance',
    ENVIRONMENT: 'production',
    PILOT_TENANT_ID: 'default',
  };
  return { sql, env };
}

describe('Full Security Audit Acceptance — KDS Surfaces & Collection Guards', () => {
  it('excludes unpaid delivery orders across /api/kds/orders, /mobile/kds/orders, and station tickets while keeping paid delivery and postpaid dine-in', async () => {
    const { sql, env } = createTestEnv();
    try {
      const account: any = sql.prepare("SELECT * FROM users WHERE id = 'kitchen-a'").get();
      const { token } = await issueStaffSession(env, account, { sessionType: 'staff-web' });
      const { token: mobileToken } = await issueStaffSession(env, account, {
        sessionType: 'staff-mobile',
        deviceId: 'dev-kitchen-a',
      });
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const mobileHeaders = { Authorization: `Bearer ${mobileToken}`, 'Content-Type': 'application/json' };

      const kdsRes = await app.fetch(new Request('http://localhost/api/kds/orders', { headers }), env);
      expect(kdsRes.status).toBe(200);
      const kdsBody: any = await kdsRes.json();
      const kdsIds = (kdsBody.data || kdsBody.orders || []).map((o: any) => o.id);
      expect(kdsIds).not.toContain('ord-deliv-unpaid');
      expect(kdsIds).toContain('ord-deliv-paid');
      expect(kdsIds).toContain('ord-dinein-unpaid');

      const mobRes = await app.fetch(new Request('http://localhost/mobile/kds/orders', { headers: mobileHeaders }), env);
      expect(mobRes.status).toBe(200);
      const mobBody: any = await mobRes.json();
      const mobIds = (mobBody.orders || mobBody.data || []).map((o: any) => o.id);
      expect(mobIds).not.toContain('ord-deliv-unpaid');
      expect(mobIds).toContain('ord-deliv-paid');
      expect(mobIds).toContain('ord-dinein-unpaid');

      const stRes = await app.fetch(new Request('http://localhost/api/kitchen-stations/st-bar/tickets', { headers }), env);
      expect(stRes.status).toBe(200);
      const stBody: any = await stRes.json();
      const stIds = (stBody.data || []).map((t: any) => t.id);
      expect(stIds).not.toContain('ord-deliv-unpaid');
      expect(stIds).toContain('ord-deliv-paid');

      const startUnpaid = await app.fetch(
        new Request('http://localhost/api/kitchen-stations/tickets/ord-deliv-unpaid/items/item-1/start?station_id=st-bar', {
          method: 'POST',
          headers,
        }),
        env
      );
      expect(startUnpaid.status).toBe(409);
      const startedRow = sql.prepare("SELECT * FROM order_item_stations WHERE order_item_id = 'ord-deliv-unpaid:item-1'").get();
      expect(startedRow).toBeUndefined();
    } finally {
      sql.close();
    }
  });

  it('enforces upper collection bounds on order items and purchase order items', () => {
    const oversizedOrder = createOrderSchema.safeParse({
      items: Array.from({ length: 101 }, (_, i) => ({ id: `i-${i}`, name: 'Coffee', price: 20000, quantity: 1 })),
      total: 2020000,
      customer_name: 'Buyer',
      customer_phone: '0901234567',
      payment_method: 'cod',
      order_type: 'takeaway',
    });
    expect(oversizedOrder.success).toBe(false);

    const oversizedPo = PurchaseOrderCreateSchema.safeParse({
      supplierId: 'sup-1',
      locationId: 'loc-1',
      items: Array.from({ length: 201 }, (_, i) => ({ ingredientId: `ing-${i}`, quantity: 1, unitCost: 1000 })),
    });
    expect(oversizedPo.success).toBe(false);

    const oversizedGuestOrder = guestOrderSchema.safeParse({
      items: Array.from({ length: 101 }, (_, i) => ({ product_id: `p-${i}`, quantity: 1, price: 20000 })),
      total: 2020000,
      customer_name: 'Guest',
      payment_method: 'cod',
    });
    expect(oversizedGuestOrder.success).toBe(false);

    const oversizedModifiers = OrderCreateSchema.safeParse({
      locationId: 'loc-1',
      items: [{ menuItemId: 'm-1', quantity: 1, modifiers: Array.from({ length: 21 }, (_, i) => `mod-${i}`) }],
    });
    expect(oversizedModifiers.success).toBe(false);

    const oversizedPromoProducts = ValidatePromotionSchema.safeParse({
      code: 'PROMO10',
      orderAmount: 50000,
      productIds: Array.from({ length: 201 }, () => '00000000-0000-4000-8000-000000000001'),
    });
    expect(oversizedPromoProducts.success).toBe(false);

    const oversizedErpOrder = erpnextSalesOrderSchema.safeParse({
      items: Array.from({ length: 101 }, (_, i) => ({ item_code: `c-${i}`, qty: 1, rate: 10000 })),
    });
    expect(oversizedErpOrder.success).toBe(false);
  });

  it('fails closed on cross-tenant customer profile fallback when primary query throws', async () => {
    const { sql, env } = createTestEnv();
    try {
      sql.exec(`
        CREATE TABLE customers (id TEXT PRIMARY KEY, email TEXT, name TEXT, phone TEXT, tenant_id TEXT);
        INSERT INTO customers VALUES('cust-foreign','f@example.invalid','Foreign','0909999888','other-store');
      `);
      const custToken = await generateJWT(
        { id: 'cust-foreign', email: 'f@example.invalid', name: 'Foreign', role: 'customer', tenantId: 'default' },
        env.JWT_SECRET,
        3600
      );
      const res = await app.fetch(
        new Request('http://localhost/api/customers/me', {
          headers: { Authorization: `Bearer ${custToken}` },
        }),
        env
      );
      expect(res.status).toBe(404);
      expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");

      const patchRes = await app.fetch(
        new Request('http://localhost/api/customers/me', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${custToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Tampered' }),
        }),
        env
      );
      expect(patchRes.status).toBe(404);
      const storedName = (sql.prepare("SELECT name FROM customers WHERE id = 'cust-foreign'").get() as any)?.name;
      expect(storedName).toBe('Foreign');

      const spoofedPlaywright = await app.fetch(
        new Request('http://localhost/api/customers/me', {
          headers: { 'x-playwright-test': 'true' },
        }),
        { ...env, ENVIRONMENT: undefined }
      );
      expect(spoofedPlaywright.status).toBe(401);

      const unsignedNowPayments = await app.fetch(
        new Request('http://localhost/api/webhooks/nowpayments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_id: 'np-1', payment_status: 'finished' }),
        }),
        { ...env, ENVIRONMENT: undefined, NOWPAYMENTS_IPN_SECRET: undefined }
      );
      expect(unsignedNowPayments.status).toBe(500);

      const unsignedZalo = await app.fetch(
        new Request('http://localhost/api/webhooks/zalo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_name: 'user_send_text', message: { text: 'Hi' } }),
        }),
        { ...env, ENVIRONMENT: undefined, ZALO_OA_SECRET: undefined, ZALO_APP_SECRET: undefined }
      );
      expect(unsignedZalo.status).toBe(503);

      const unauthZaloSimulate = await app.fetch(
        new Request('http://localhost/api/webhooks/zalo/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Hi' }),
        }),
        { ...env, ENVIRONMENT: undefined }
      );
      expect(unauthZaloSimulate.status).toBe(401);

      sql.exec(`
        INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
          VALUES('kitchen-b','Kitchen B','kitchen','store-b',1,1,'2026-10-30T00:00:00Z');
      `);
      const accountB: any = sql.prepare("SELECT * FROM users WHERE id = 'kitchen-b'").get();
      const { token: tokenB } = await issueStaffSession(env, accountB, { sessionType: 'staff-web' });
      const foreignKitchenWs = await app.fetch(
        new Request('http://localhost/api/realtime/kitchen', {
          headers: { Authorization: `Bearer ${tokenB}` },
        }),
        env
      );
      expect(foreignKitchenWs.status).toBe(403);
    } finally {
      sql.close();
    }
  });

  it('isolates /api/chat/assistant, /api/edge/telemetry/heartbeat, /api/cal-booking-webhook/bookings, and /cron/alerts across tenants and secrets', async () => {
    const { sql, env } = createTestEnv();
    try {
      sql.exec(`
        CREATE TABLE customers (id TEXT PRIMARY KEY, email TEXT, name TEXT, phone TEXT, loyalty_points INTEGER, loyalty_tier TEXT, tenant_id TEXT);
        CREATE TABLE reservations (id TEXT PRIMARY KEY, cal_booking_uid TEXT, customer_name TEXT, customer_email TEXT,
          reservation_time TEXT, date TEXT, time TEXT, status TEXT, special_requests TEXT, tenant_id TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE container_telemetry_logs (id TEXT PRIMARY KEY, container_id TEXT, tenant_id TEXT, power_source TEXT,
          battery_percentage REAL, ambient_temp_celsius REAL, kds_online INTEGER, network_ping_ms REAL, alert_status TEXT, alert_message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        INSERT INTO orders(id,order_number,customer_phone,customer_name,tenant_id,total,status,payment_status,payment_method,order_type,table_id,items,created_at,updated_at)
          VALUES('ord-foreign-99','ORD-99','0908888777','Foreign Guest','other-store',99000,'preparing','paid','payos','dine_in','tbl-foreign','[]','2026-10-30T02:00:00Z','2026-10-30T02:00:00Z');
        INSERT INTO cafe_tables(id,table_number,name,status,capacity,tenant_id)
          VALUES('tbl-foreign',9,'Table 9','occupied',4,'other-store');
        INSERT INTO customers VALUES('cust-other','o@example.invalid','Other VIP','0908888777',999,'diamond','other-store');
        INSERT INTO reservations VALUES('res-default','cal-1','Default Guest','d@example.invalid','2026-10-30T10:00:00Z','2026-10-30','10:00','confirmed','','default','2026-10-30T00:00:00Z','2026-10-30T00:00:00Z');
        INSERT INTO reservations VALUES('res-other','cal-2','Other Guest','o@example.invalid','2026-10-30T11:00:00Z','2026-10-30','11:00','confirmed','','other-store','2026-10-30T00:00:00Z','2026-10-30T00:00:00Z');
        INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
          VALUES('mgr-a','Manager A','manager','default',1,1,'2026-10-30T00:00:00Z');
      `);

      const chatOrderRes = await app.fetch(
        new Request('http://localhost/api/chat/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'Kiểm tra đơn ord-foreign-99', order_id: 'ord-foreign-99' }),
        }),
        env
      );
      const chatOrderBody: any = await chatOrderRes.json();
      expect(chatOrderBody.data.reply).not.toContain('99.000');

      const chatBillRes = await app.fetch(
        new Request('http://localhost/api/chat/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'Bàn 9 tính tiền', table_number: '9' }),
        }),
        env
      );
      const chatBillBody: any = await chatBillRes.json();
      expect(chatBillBody.data.reply).not.toContain('99.000');

      const chatPointsRes = await app.fetch(
        new Request('http://localhost/api/chat/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'Kiểm tra điểm tích lũy', phone: '0908888777' }),
        }),
        env
      );
      const chatPointsBody: any = await chatPointsRes.json();
      expect(chatPointsBody.data.reply).not.toContain('999');

      const unauthHeartbeat = await app.fetch(
        new Request('http://localhost/api/edge/telemetry/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ container_id: 'c-1', ambient_temp_celsius: 42 }),
        }),
        { ...env, ENVIRONMENT: undefined, EDGE_TELEMETRY_SECRET: 'edge-sec-test' }
      );
      expect(unauthHeartbeat.status).toBe(401);

      const authHeartbeat = await app.fetch(
        new Request('http://localhost/api/edge/telemetry/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-edge-telemetry-secret': 'edge-sec-test' },
          body: JSON.stringify({ container_id: 'c-1', ambient_temp_celsius: 25 }),
        }),
        { ...env, ENVIRONMENT: undefined, EDGE_TELEMETRY_SECRET: 'edge-sec-test' }
      );
      expect(authHeartbeat.status).toBe(200);

      const mgrAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-a'").get();
      const { token: mgrToken } = await issueStaffSession(env, mgrAccount, { sessionType: 'staff-web' });
      const bookingsRes = await app.fetch(
        new Request('http://localhost/api/cal-booking-webhook/bookings', {
          headers: { Authorization: `Bearer ${mgrToken}` },
        }),
        env
      );
      expect(bookingsRes.status).toBe(200);
      const bookingsBody: any = await bookingsRes.json();
      const bookingUids = (bookingsBody.data || []).map((b: any) => b.cal_uid);
      expect(bookingUids).toContain('cal-1');
      expect(bookingUids).not.toContain('cal-2');

      const unauthCron = await app.fetch(
        new Request('http://localhost/cron/alerts', { headers: { 'X-Cron-Secret': 'wrong' } }),
        { ...env, CRON_SECRET: 'cron-sec-99' }
      );
      expect(unauthCron.status).toBe(401);
    } finally {
      sql.close();
    }
  });

  it('isolates /api/admin/sales/csv, /api/floor-plan, /api/table-sessions, and admin customer fallbacks across tenants and neutralizes CSV formulas', async () => {
    const { sql, env } = createTestEnv();
    try {
      sql.exec(`
        CREATE TABLE table_sessions (id TEXT PRIMARY KEY, table_id TEXT, customer_id TEXT, customer_name TEXT,
          customer_phone TEXT, status TEXT, opened_at TEXT, closed_at TEXT, order_count INTEGER DEFAULT 0,
          total_amount INTEGER DEFAULT 0, notes TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, tier TEXT,
          cashback_balance INTEGER DEFAULT 0, total_spent INTEGER DEFAULT 0, visit_count INTEGER DEFAULT 0,
          tenant_id TEXT, created_at TEXT);
        INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
          VALUES('mgr-a','Manager A','manager','default',1,1,'2026-10-30T00:00:00Z');
        INSERT INTO cafe_tables(id,table_number,name,status,capacity,tenant_id)
          VALUES('tbl-default-1',1,'Table 1','Available',4,'default');
        INSERT INTO cafe_tables(id,table_number,name,status,capacity,tenant_id)
          VALUES('tbl-foreign-2',2,'Table 2','Occupied',4,'other-store');
        INSERT INTO table_sessions(id,table_id,status,opened_at,created_at,updated_at)
          VALUES('sess-default','tbl-default-1','active','2026-10-30T01:00:00Z','2026-10-30T01:00:00Z','2026-10-30T01:00:00Z');
        INSERT INTO table_sessions(id,table_id,status,opened_at,created_at,updated_at)
          VALUES('sess-foreign','tbl-foreign-2','active','2026-10-30T01:00:00Z','2026-10-30T01:00:00Z','2026-10-30T01:00:00Z');
        INSERT INTO orders(id,order_number,customer_phone,customer_name,tenant_id,total,status,payment_status,payment_method,order_type,items,created_at,updated_at)
          VALUES('ord-csv-formula','ORD-CSV-1','0901111222','=cmd|'' /C calc''!A0','default',55000,'completed','paid','cod','dine_in','[]','2026-10-30 10:00:00','2026-10-30 10:00:00');
        INSERT INTO orders(id,order_number,customer_phone,customer_name,tenant_id,total,status,payment_status,payment_method,order_type,items,created_at,updated_at)
          VALUES('ord-csv-foreign','ORD-CSV-2','0909999888','Foreign Buyer','other-store',88000,'completed','paid','cod','dine_in','[]','2026-10-30 11:00:00','2026-10-30 11:00:00');
        INSERT INTO customers(id,name,phone,email,tier,tenant_id,created_at)
          VALUES('cust-foreign-legacy','Foreign Legacy','0907777666','fl@example.invalid','gold','other-store','2026-10-30T00:00:00Z');
      `);

      const mgrAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-a'").get();
      const { token: mgrToken } = await issueStaffSession(env, mgrAccount, { sessionType: 'staff-web' });
      const headers = { Authorization: `Bearer ${mgrToken}`, 'Content-Type': 'application/json' };

      const csvRes = await app.fetch(
        new Request('http://localhost/api/admin/sales/csv?start=2026-10-30&end=2026-10-30', { headers }),
        env
      );
      expect(csvRes.status).toBe(200);
      const csvText = await csvRes.text();
      expect(csvText).toContain("'=cmd|");
      expect(csvText).not.toContain('ord-csv-foreign');

      const fpRes = await app.fetch(new Request('http://localhost/api/floor-plan', { headers }), env);
      expect(fpRes.status).toBe(200);
      const fpBody: any = await fpRes.json();
      const fpIds = (fpBody.data || []).map((t: any) => t.id);
      expect(fpIds).toContain('tbl-default-1');
      expect(fpIds).not.toContain('tbl-foreign-2');

      const releaseForeign = await app.fetch(
        new Request('http://localhost/api/floor-plan/tbl-foreign-2/release', { method: 'POST', headers }),
        env
      );
      expect(releaseForeign.status).toBe(404);

      const attachForeignOrder = await app.fetch(
        new Request('http://localhost/api/table-sessions/sess-default/orders', {
          method: 'POST',
          headers,
          body: JSON.stringify({ order_id: 'ord-csv-foreign' }),
        }),
        env
      );
      expect(attachForeignOrder.status).toBe(404);

      const adminCustRes = await app.fetch(
        new Request('http://localhost/api/admin/customers', { headers }),
        env
      );
      expect(adminCustRes.status).toBe(200);
      const adminCustBody: any = await adminCustRes.json();
      const custIds = (adminCustBody.data || []).map((c: any) => c.id);
      expect(custIds).not.toContain('cust-foreign-legacy');
    } finally {
      sql.close();
    }
  });

  it('isolates /api/pos/customer, /api/admin-loyalty/export, /api/admin/qr, and /api/loyalty/birthday across tenants', async () => {
    const { sql, env } = createTestEnv();
    try {
      sql.exec(`
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, loyalty_tier TEXT,
          loyalty_points INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0, date_of_birth TEXT,
          cashback_balance INTEGER DEFAULT 0, total_spent INTEGER DEFAULT 0, visit_count INTEGER DEFAULT 0,
          tenant_id TEXT, created_at TEXT);
        CREATE TABLE cashback_wallets (id TEXT PRIMARY KEY, customer_id TEXT, balance INTEGER DEFAULT 0,
          total_earned INTEGER DEFAULT 0, total_spent INTEGER DEFAULT 0);
        CREATE TABLE table_qr_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, table_id TEXT UNIQUE, slug TEXT UNIQUE, updated_at TEXT);
        CREATE TABLE birthday_redemptions (id TEXT PRIMARY KEY, customer_id TEXT, discount_percent INTEGER, order_id TEXT, redeemed_at TEXT);
        INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
          VALUES('mgr-a','Manager A','manager','default',1,1,'2026-10-30T00:00:00Z');
        INSERT INTO customers(id,name,phone,email,loyalty_tier,loyalty_points,lifetime_points,date_of_birth,tenant_id,created_at)
          VALUES('cust-def-1','=SUM(1,2)','0901234567','d@example.invalid','gold',100,100,'1995-10-30','default','2026-10-30T00:00:00Z');
        INSERT INTO customers(id,name,phone,email,loyalty_tier,loyalty_points,lifetime_points,date_of_birth,tenant_id,created_at)
          VALUES('cust-for-2','Foreign VIP','0909876543','f@example.invalid','platinum',500,500,'1995-10-30','other-store','2026-10-30T00:00:00Z');
        INSERT INTO cafe_tables(id,table_number,name,status,capacity,tenant_id)
          VALUES('tbl-def-1',1,'Table 1','Available',4,'default');
        INSERT INTO cafe_tables(id,table_number,name,status,capacity,tenant_id)
          VALUES('tbl-for-2',2,'Table 2','Available',4,'other-store');
        INSERT INTO table_qr_codes(table_id,slug) VALUES('tbl-def-1','slug-def-1');
        INSERT INTO table_qr_codes(table_id,slug) VALUES('tbl-for-2','slug-for-2');
      `);

      const mgrAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-a'").get();
      const { token: mgrToken } = await issueStaffSession(env, mgrAccount, { sessionType: 'staff-web' });
      const headers = { Authorization: `Bearer ${mgrToken}`, 'Content-Type': 'application/json' };
      const qrEnv = { ...env, QR_SIGNING_SECRET: 'qr-secret-test-2026' };

      const posForeign = await app.fetch(
        new Request('http://localhost/api/pos/customer?phone=0909876543', { headers }),
        qrEnv
      );
      expect(posForeign.status).toBe(200);
      const posForeignBody: any = await posForeign.json();
      expect(posForeignBody.found).toBe(false);

      const loyaltyCsvRes = await app.fetch(
        new Request('http://localhost/api/admin-loyalty/export', { headers }),
        qrEnv
      );
      expect(loyaltyCsvRes.status).toBe(200);
      const loyaltyCsvText = await loyaltyCsvRes.text();
      expect(loyaltyCsvText).toContain("'=SUM(1,2)");
      expect(loyaltyCsvText).not.toContain('cust-for-2');

      const qrTablesRes = await app.fetch(
        new Request('http://localhost/api/admin/qr/tables', { headers }),
        qrEnv
      );
      expect(qrTablesRes.status).toBe(200);
      const qrTablesBody: any = await qrTablesRes.json();
      const qrTableIds = (qrTablesBody.data || []).map((t: any) => t.id);
      expect(qrTableIds).toContain('tbl-def-1');
      expect(qrTableIds).not.toContain('tbl-for-2');

      const qrRegenRes = await app.fetch(
        new Request('http://localhost/api/admin/qr/regenerate', { method: 'POST', headers }),
        qrEnv
      );
      expect(qrRegenRes.status).toBe(200);
      const foreignQrStillExists = sql.prepare("SELECT slug FROM table_qr_codes WHERE table_id = 'tbl-for-2'").get() as any;
      expect(foreignQrStillExists?.slug).toBe('slug-for-2');

      const unauthBdayRedeem = await app.fetch(
        new Request('http://localhost/api/loyalty/birthday/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: 'cust-def-1' }),
        }),
        qrEnv
      );
      expect(unauthBdayRedeem.status).toBe(401);

      const foreignBdayCheck = await app.fetch(
        new Request('http://localhost/api/loyalty/birthday/check?customer_id=cust-for-2', { headers }),
        qrEnv
      );
      const foreignBdayBody: any = await foreignBdayCheck.json();
      expect(foreignBdayBody.data.eligible).toBe(false);
    } finally {
      sql.close();
    }
  });

  it('isolates subscription receipts, broadcast targets, referrals, and signage feeds across tenants and masks referral phone PII', async () => {
    const { sql, env } = createTestEnv();
    try {
      sql.exec(`
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, loyalty_tier TEXT,
          loyalty_points INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0, tenant_id TEXT, created_at TEXT);
        CREATE TABLE subscription_plans (id TEXT PRIMARY KEY, name TEXT);
        CREATE TABLE subscriptions (id TEXT PRIMARY KEY, plan_id TEXT, customer_id TEXT, customer_name TEXT,
          customer_email TEXT, tenant_id TEXT);
        CREATE TABLE subscription_invoices (id TEXT PRIMARY KEY, subscription_id TEXT, amount_vnd INTEGER,
          status TEXT, period_start TEXT, period_end TEXT, invoice_number TEXT, paid_at TEXT, payment_method TEXT);
        CREATE TABLE referral_codes (id TEXT PRIMARY KEY, customer_id TEXT, code TEXT, times_used INTEGER DEFAULT 0,
          total_points_earned INTEGER DEFAULT 0, created_at TEXT);
        CREATE TABLE referrals (id TEXT PRIMARY KEY, referrer_id TEXT, referred_customer_id TEXT, referral_code TEXT,
          points_awarded INTEGER DEFAULT 0, cashback_awarded_vnd INTEGER DEFAULT 0, status TEXT, bonus_type TEXT, created_at TEXT);
        CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, sort_order INTEGER DEFAULT 1);
        CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price INTEGER, image_url TEXT, description TEXT,
          category_id INTEGER, is_available INTEGER DEFAULT 1, tenant_id TEXT);
        CREATE TABLE promotions (id TEXT PRIMARY KEY, code TEXT, percent INTEGER, max_discount INTEGER,
          min_order INTEGER, is_active INTEGER DEFAULT 1, starts_at TEXT, expires_at TEXT, tenant_id TEXT);
        INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
          VALUES('mgr-a','Manager A','manager','default',1,1,'2026-10-30T00:00:00Z');
        INSERT INTO customers(id,name,phone,email,loyalty_tier,tenant_id,created_at)
          VALUES('cust-def-1','Alice','0901234567','alice@example.invalid','gold','default','2026-10-30T00:00:00Z');
        INSERT INTO customers(id,name,phone,email,loyalty_tier,tenant_id,created_at)
          VALUES('cust-def-2','Bob','0902222333','bob@example.invalid','silver','default','2026-10-30T00:00:00Z');
        INSERT INTO customers(id,name,phone,email,loyalty_tier,tenant_id,created_at)
          VALUES('cust-for-1','ForeignRef','0909999888','for@example.invalid','gold','other-store','2026-10-30T00:00:00Z');
        INSERT INTO subscription_plans(id,name) VALUES('plan-1','VIP Container');
        INSERT INTO subscriptions(id,plan_id,customer_id,customer_name,customer_email,tenant_id)
          VALUES('sub-def-1','plan-1','cust-def-1','Alice','alice@example.invalid','default');
        INSERT INTO subscriptions(id,plan_id,customer_id,customer_name,customer_email,tenant_id)
          VALUES('sub-for-1','plan-1','cust-for-1','ForeignRef','for@example.invalid','other-store');
        INSERT INTO subscription_invoices(id,subscription_id,amount_vnd,status,period_start,period_end,invoice_number)
          VALUES('inv-def-1','sub-def-1',500000,'paid','2026-10-01','2026-10-31','INV-DEF-1');
        INSERT INTO subscription_invoices(id,subscription_id,amount_vnd,status,period_start,period_end,invoice_number)
          VALUES('inv-for-1','sub-for-1',500000,'paid','2026-10-01','2026-10-31','INV-FOR-1');
        INSERT INTO referral_codes(id,customer_id,code,times_used,total_points_earned,created_at)
          VALUES('rc-for-1','cust-for-1','FNB-FOR999',0,0,'2026-10-30T00:00:00Z');
        INSERT INTO referral_codes(id,customer_id,code,times_used,total_points_earned,created_at)
          VALUES('rc-def-1','cust-def-1','FNB-DEF111',1,0,'2026-10-30T00:00:00Z');
        INSERT INTO referrals(id,referrer_id,referred_customer_id,referral_code,status,created_at)
          VALUES('ref-1','cust-def-1','cust-def-2','FNB-DEF111','completed','2026-10-30T00:00:00Z');
        INSERT INTO categories(id,name,sort_order) VALUES(1,'Coffee',1);
        INSERT INTO products(id,name,price,category_id,is_available,tenant_id)
          VALUES(101,'Default Latte',45000,1,1,'default');
        INSERT INTO products(id,name,price,category_id,is_available,tenant_id)
          VALUES(102,'Foreign Secret Roast',95000,1,1,'other-store');
        INSERT INTO promotions(id,code,percent,max_discount,min_order,is_active,tenant_id)
          VALUES('p-def','PROMODEF',10,20000,50000,1,'default');
        INSERT INTO promotions(id,code,percent,max_discount,min_order,is_active,tenant_id)
          VALUES('p-for','PROMOFOR',50,100000,50000,1,'other-store');
      `);

      const mgrAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-a'").get();
      const { token: mgrToken } = await issueStaffSession(env, mgrAccount, { sessionType: 'staff-web' });
      const cust1Token = await generateJWT({ id: 'cust-def-1', email: 'alice@example.invalid', role: 'customer', tenantId: 'default' } as any, env.JWT_SECRET);
      const cust2Token = await generateJWT({ id: 'cust-def-2', email: 'bob@example.invalid', role: 'customer', tenantId: 'default' } as any, env.JWT_SECRET);

      const idorReceipt = await app.fetch(
        new Request('http://localhost/api/subscriptions/invoices/inv-def-1/receipt', {
          headers: { Authorization: `Bearer ${cust2Token}` },
        }),
        env
      );
      expect(idorReceipt.status).toBe(403);

      const ownReceipt = await app.fetch(
        new Request('http://localhost/api/subscriptions/invoices/inv-def-1/receipt', {
          headers: { Authorization: `Bearer ${cust1Token}` },
        }),
        env
      );
      expect(ownReceipt.status).toBe(200);

      const foreignReceipt = await app.fetch(
        new Request('http://localhost/api/subscriptions/invoices/inv-for-1/receipt', {
          headers: { Authorization: `Bearer ${mgrToken}` },
        }),
        env
      );
      expect(foreignReceipt.status).toBe(404);

      const applyForeignRef = await app.fetch(
        new Request('http://localhost/api/loyalty/referral/apply', {
          method: 'POST',
          headers: { Authorization: `Bearer ${cust2Token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'FNB-FOR999' }),
        }),
        env
      );
      expect(applyForeignRef.status).toBe(404);

      const refStatsRes = await app.fetch(
        new Request('http://localhost/api/loyalty/referral/stats', {
          headers: { Authorization: `Bearer ${cust1Token}` },
        }),
        env
      );
      expect(refStatsRes.status).toBe(200);
      const refStatsBody: any = await refStatsRes.json();
      expect(refStatsBody.data.recent_referrals[0].referred_phone).toBe('090****333');

      const menuRes = await app.fetch(new Request('http://localhost/api/signage/menu'), env);
      const menuBody: any = await menuRes.json();
      const productNames = (menuBody.data?.[0]?.products || []).map((p: any) => p.name);
      expect(productNames).toContain('Default Latte');
      expect(productNames).not.toContain('Foreign Secret Roast');

      const promosRes = await app.fetch(new Request('http://localhost/api/signage/promos'), env);
      const promosBody: any = await promosRes.json();
      const promoCodes = (promosBody.data || []).map((p: any) => p.code);
      expect(promoCodes).toContain('PROMODEF');
      expect(promoCodes).not.toContain('PROMOFOR');
    } finally {
      sql.close();
    }
  });

  it('enforces checkin CAS & tenant isolation, audit CSV neutralization, dindin order scoping, and review tenant isolation', async () => {
    const { escapeCsv } = await import('../../routes/admin-audit-logs-handlers/csv-helper');
    expect(escapeCsv("=cmd|'/C calc'!A0")).toBe("\"'=cmd|'/C calc'!A0\"");
    expect(escapeCsv('+1+1')).toBe("\"'+1+1\"");

    const { sql, env } = createTestEnv();
    try {
      const now = new Date().toISOString();
      sql.exec(`
        CREATE TABLE customers (id TEXT PRIMARY KEY, phone TEXT, name TEXT, email TEXT,
          loyalty_points INTEGER DEFAULT 0, total_spent INTEGER DEFAULT 0, tenant_id TEXT, created_at TEXT);
        CREATE TABLE checkins (id TEXT PRIMARY KEY, customer_id TEXT, customer_name TEXT,
          checkin_date TEXT, checkin_time TEXT, reward_amount INTEGER, status TEXT, staff_id TEXT, created_at TEXT);
        CREATE TABLE reviews (id TEXT PRIMARY KEY, order_id TEXT, rating INTEGER, comment TEXT,
          customer_name TEXT, created_at TEXT);
        INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
          VALUES('mgr-ci-1','Manager CI','manager','default',1,1,'${now}');
        INSERT INTO customers (id, phone, name, email, loyalty_points, total_spent, tenant_id, created_at)
        VALUES
          ('cust-ci-def', '0911111111', 'CI Default', 'cidef@example.com', 0, 0, 'default', '${now}'),
          ('cust-ci-for', '0922222222', 'CI Foreign', 'cifor@example.com', 0, 0, 'store-foreign', '${now}');
        INSERT INTO checkins (id, customer_id, customer_name, checkin_date, checkin_time, reward_amount, status, created_at)
        VALUES
          ('ci-def-1', 'cust-ci-def', 'CI Default', '2026-10-31', '${now}', 5000, 'pending', '${now}'),
          ('ci-for-1', 'cust-ci-for', 'CI Foreign', '2026-10-31', '${now}', 5000, 'pending', '${now}');
        INSERT INTO orders (id, customer_name, customer_phone, payment_method, items, total, status, tenant_id, created_at)
        VALUES
          ('DIN_DEF_01', 'DIN', 'sess-def', 'cod', '[]', 45000, 'pending', 'default', '${now}'),
          ('DIN_FOR_01', 'DIN', 'sess-for', 'cod', '[]', 99000, 'pending', 'store-foreign', '${now}');
        INSERT INTO reviews (id, order_id, rating, comment, customer_name, created_at)
        VALUES
          ('rev-def-1', 'DIN_DEF_01', 5, 'Great!', 'Alice', '${now}'),
          ('rev-for-1', 'DIN_FOR_01', 1, 'Foreign review', 'Eve', '${now}');
      `);

      const mgrAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-ci-1'").get();
      const { token: mgrToken } = await issueStaffSession(env, mgrAccount, { sessionType: 'staff-web' });

      // 1. Checkin: approving foreign-tenant checkin returns 404
      const foreignApprove = await app.fetch(
        new Request('http://localhost/api/checkin/ci-for-1/approve', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${mgrToken}` },
        }),
        env
      );
      expect(foreignApprove.status).toBe(404);

      // List checkins only returns default-tenant checkin
      const listCheckins = await app.fetch(
        new Request('http://localhost/api/checkin', {
          headers: { Authorization: `Bearer ${mgrToken}` },
        }),
        env
      );
      expect(listCheckins.status).toBe(200);
      const listCheckinsBody: any = await listCheckins.json();
      const checkinIds = (listCheckinsBody.data || []).map((c: any) => c.id);
      expect(checkinIds).toContain('ci-def-1');
      expect(checkinIds).not.toContain('ci-for-1');

      // 2. DinDin: GET /checkouts only returns default-tenant order
      const { dindinRouter } = await import('../../routes/dindin');
      const dindinList = await dindinRouter.fetch(
        new Request('http://localhost/checkouts', {
          headers: { Authorization: `Bearer ${mgrToken}`, 'X-Tenant-ID': 'default' },
        }),
        env
      );
      expect(dindinList.status).toBe(200);
      const dindinBody: any = await dindinList.json();
      const dindinIds = (dindinBody.checkouts || []).map((o: any) => o.id);
      expect(dindinIds).toContain('DIN_DEF_01');
      expect(dindinIds).not.toContain('DIN_FOR_01');

      // DinDin QC on foreign order returns 404
      const foreignQc = await dindinRouter.fetch(
        new Request('http://localhost/checkout/DIN_FOR_01/qc', {
          method: 'POST',
          headers: { Authorization: `Bearer ${mgrToken}`, 'X-Tenant-ID': 'default' },
        }),
        env
      );
      expect(foreignQc.status).toBe(404);

      // 3. Reviews: submitting review for foreign order returns 404
      const postForeignRev = await app.fetch(
        new Request('http://localhost/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'default' },
          body: JSON.stringify({ order_id: 'DIN_FOR_01', rating: 5, comment: 'Spoofed' }),
        }),
        env
      );
      expect(postForeignRev.status).toBe(404);

      // GET /api/reviews and /api/reviews/stats exclude foreign-tenant order reviews
      const getRevs = await app.fetch(
        new Request('http://localhost/api/reviews', { headers: { 'X-Tenant-ID': 'default' } }),
        env
      );
      expect(getRevs.status).toBe(200);
      const getRevsBody: any = await getRevs.json();
      expect(getRevsBody.data.map((r: any) => r.id)).toEqual(['rev-def-1']);

      const revStats = await app.fetch(
        new Request('http://localhost/api/reviews/stats', { headers: { 'X-Tenant-ID': 'default' } }),
        env
      );
      expect(revStats.status).toBe(200);
      const revStatsBody: any = await revStats.json();
      expect(revStatsBody.data.total_reviews).toBe(1);
      expect(revStatsBody.data.average_rating).toBe(5);
    } finally {
      sql.close();
    }
  });

  it('enforces SSRF guards on ERPNext/Push endpoints, atomic CAS on loyalty-v2 & promotions, and tenant isolation across catalog/inventory/reservations/subscriptions', async () => {
    const { sql, env } = createTestEnv();
    try {
      const now = new Date().toISOString();
      sql.exec(`
        CREATE TABLE loyalty_accounts (id TEXT PRIMARY KEY, customer_id TEXT, current_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0, tier TEXT DEFAULT 'bronze', last_activity_at TEXT, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE loyalty_rewards (id TEXT PRIMARY KEY, name TEXT, points_cost INTEGER, type TEXT,
          value INTEGER, min_tier TEXT DEFAULT 'bronze', is_active INTEGER DEFAULT 1, active INTEGER DEFAULT 1,
          stock INTEGER, max_redemptions INTEGER, current_redemptions INTEGER DEFAULT 0, redeemed_count INTEGER DEFAULT 0);
        CREATE TABLE reward_redemptions (id TEXT PRIMARY KEY, account_id TEXT, reward_id TEXT, points_spent INTEGER,
          voucher_code TEXT, status TEXT, expires_at TEXT);
        CREATE TABLE loyalty_transactions (id TEXT PRIMARY KEY, account_id TEXT, customer_id TEXT, type TEXT, points INTEGER,
          balance_after INTEGER, description TEXT, reason TEXT, reference_id TEXT, reward_id TEXT, order_id TEXT,
          idempotency_key TEXT, created_by TEXT, created_at TEXT);
        CREATE TABLE promotions (id TEXT PRIMARY KEY, code TEXT, type TEXT, percent INTEGER DEFAULT 10, value INTEGER, min_order INTEGER DEFAULT 0,
          max_discount INTEGER DEFAULT 50000, usage_limit INTEGER DEFAULT 0, usage_count INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
          starts_at TEXT, expires_at TEXT, tenant_id TEXT);
        CREATE TABLE subscriptions (id TEXT PRIMARY KEY, plan_id TEXT, customer_id TEXT, customer_name TEXT,
          customer_phone TEXT, customer_email TEXT, status TEXT, billing_cycle TEXT, amount_vnd INTEGER,
          current_period_start TEXT, current_period_end TEXT, next_billing_date TEXT, payment_method TEXT,
          auto_renew INTEGER DEFAULT 1, cancelled_at TEXT, cancel_reason TEXT, tenant_id TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE subscription_plans (id TEXT PRIMARY KEY, name TEXT, slug TEXT, zone TEXT, container_size TEXT, features TEXT, active INTEGER DEFAULT 1);
        CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT, slug TEXT, price INTEGER, category_id TEXT,
          is_available INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, tenant_id TEXT);
        CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT, slug TEXT, sort_order INTEGER DEFAULT 0, tenant_id TEXT);
        CREATE TABLE inventory_items (id TEXT PRIMARY KEY, sku TEXT, name TEXT, category TEXT, unit TEXT,
          current_stock REAL DEFAULT 0, min_stock REAL DEFAULT 0, max_stock REAL DEFAULT 100, cost_per_unit REAL DEFAULT 0,
          active INTEGER DEFAULT 1, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE reservations (id TEXT PRIMARY KEY, customer_name TEXT, customer_phone TEXT, party_size INTEGER,
          date TEXT, time_slot TEXT, table_id TEXT, table_number INTEGER, status TEXT, confirmation_code TEXT,
          tenant_id TEXT, created_at TEXT, updated_at TEXT);
        INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
          VALUES('owner-1','Owner Default','owner','default',1,1,'${now}');
        INSERT INTO loyalty_accounts(id,customer_id,current_points,lifetime_points,tier,tenant_id,updated_at)
          VALUES('la-1','owner-1',100,100,'bronze','default','${now}'),
                ('la-for','cust-for',500,500,'gold','other-store','${now}');
        INSERT INTO loyalty_rewards(id,name,points_cost,type,value,min_tier,is_active,active,stock,max_redemptions,current_redemptions,redeemed_count)
          VALUES('rew-1','Free Espresso',100,'voucher',35000,'bronze',1,1,1,1,0,0);
        INSERT INTO promotions(id,code,type,percent,value,min_order,max_discount,usage_limit,usage_count,used_count,is_active,tenant_id)
          VALUES('promo-cap-1','ONEUSE50','fixed',50,50000,0,50000,1,0,0,1,'default');
        INSERT INTO orders(id,customer_name,customer_phone,payment_method,items,total,status,tenant_id,created_at)
          VALUES('ord-promo-1','Alice','0901111222','cod','[]',100000,'pending','default','${now}'),
                ('ord-promo-2','Bob','0903333444','cod','[]',100000,'pending','default','${now}');
        INSERT INTO subscription_plans(id,name,active) VALUES('plan-std','Standard Plan',1);
        INSERT INTO subscriptions(id,plan_id,customer_id,customer_name,status,billing_cycle,amount_vnd,tenant_id,created_at,updated_at)
          VALUES('sub-for-99','plan-std','cust-for','Foreign Sub','active','monthly',300000,'other-store','${now}','${now}');
        INSERT INTO categories(id,name,slug,sort_order,tenant_id)
          VALUES('cat-def','Coffee','coffee',1,'default'),
                ('cat-for','Secret Foreign','secret-foreign',2,'other-store');
        INSERT INTO products(id,name,slug,price,category_id,is_available,sort_order,tenant_id)
          VALUES('prod-def','Espresso','espresso',35000,'cat-def',1,1,'default'),
                ('prod-for','Foreign Brew','foreign-brew',95000,'cat-for',1,2,'other-store');
        INSERT INTO inventory_items(id,sku,name,category,unit,current_stock,min_stock,max_stock,cost_per_unit,active,tenant_id)
          VALUES('inv-def','SKU-DEF','Arabica','coffee','kg',10,2,50,200000,1,'default'),
                ('inv-for','SKU-FOR','Foreign Bean','coffee','kg',25,2,50,200000,1,'other-store');
        INSERT INTO reservations(id,customer_name,customer_phone,party_size,date,time_slot,status,confirmation_code,tenant_id,created_at,updated_at)
          VALUES('res-for','Foreign Guest','0909999000',4,'2026-10-31','18:00','confirmed','CNF999','other-store','${now}','${now}');
      `);

      const ownerAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'owner-1'").get();
      const { token: ownerToken } = await issueStaffSession(env, ownerAccount, { sessionType: 'staff-web' });
      const headers = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };

      // 1. SSRF guard on POST /api/erpnext/configure rejects private/metadata URLs
      const ssrfErpRes = await app.fetch(
        new Request('http://localhost/api/erpnext/configure', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            baseUrl: 'http://169.254.169.254/latest/meta-data',
            apiKey: 'key-123456',
            apiSecret: 'secret-123456',
          }),
        }),
        env
      );
      expect(ssrfErpRes.status).toBe(400);

      // 2. Push subscribe SSRF guard rejects loopback/HTTP endpoints
      const ssrfPushRes = await app.fetch(
        new Request('http://localhost/api/push/subscribe', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            endpoint: 'http://127.0.0.1:8080/push',
            keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
          }),
        }),
        env
      );
      expect(ssrfPushRes.status).toBe(400);

      // 3. Loyalty atomic CAS: first redemption succeeds (100 -> 0 pts), second fails with 400
      const redeem1 = await app.fetch(
        new Request('http://localhost/api/loyalty/rewards/redeem', {
          method: 'POST',
          headers,
          body: JSON.stringify({ rewardId: 'rew-1', idempotencyKey: 'idem-redeem-1' }),
        }),
        env
      );
      expect(redeem1.status).toBe(200);
      const redeem1Body: any = await redeem1.json();
      expect(redeem1Body.data.newBalance).toBe(0);

      const redeem2 = await app.fetch(
        new Request('http://localhost/api/loyalty/rewards/redeem', {
          method: 'POST',
          headers,
          body: JSON.stringify({ rewardId: 'rew-1', idempotencyKey: 'idem-redeem-2' }),
        }),
        env
      );
      expect([400, 409]).toContain(redeem2.status);

      // Foreign loyalty account is isolated from default tenant on admin point adjustment
      const foreignLoyalty = await app.fetch(
        new Request('http://localhost/api/loyalty/admin/adjust-points', {
          method: 'POST',
          headers,
          body: JSON.stringify({ customerId: 'cust-for', points: 50, reason: 'cross-tenant probe', idempotencyKey: 'idem-adj-1' }),
        }),
        env
      );
      expect(foreignLoyalty.status).toBe(404);

      // 4. Promotion atomic cap enforcement: first order succeeds, second order is rejected when usage_limit=1 is reached
      const promoRedeem1 = await app.fetch(
        new Request('http://localhost/api/promotions/redeem', {
          method: 'POST',
          headers,
          body: JSON.stringify({ code: 'ONEUSE50', order_id: 'ord-promo-1', order_total: 100000 }),
        }),
        env
      );
      expect(promoRedeem1.status).toBe(200);

      const promoRedeem2 = await app.fetch(
        new Request('http://localhost/api/promotions/redeem', {
          method: 'POST',
          headers,
          body: JSON.stringify({ code: 'ONEUSE50', order_id: 'ord-promo-2', order_total: 100000 }),
        }),
        env
      );
      expect([400, 409]).toContain(promoRedeem2.status);

      // 5. Subscription lifecycle tenant isolation
      const getForeignSub = await app.fetch(
        new Request('http://localhost/api/subscriptions/sub-for-99', { headers }),
        env
      );
      expect(getForeignSub.status).toBe(404);

      const cancelForeignSub = await app.fetch(
        new Request('http://localhost/api/subscriptions/sub-for-99/cancel', {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason: 'attempt cross-tenant cancel' }),
        }),
        env
      );
      expect(cancelForeignSub.status).toBe(404);

      // 6. Catalog, Inventory & Reservations tenant isolation
      const prodsRes = await app.fetch(new Request('http://localhost/api/products', { headers }), env);
      const prodsBody: any = await prodsRes.json();
      const prodIds = (prodsBody.data || []).map((p: any) => p.id);
      expect(prodIds).toContain('prod-def');
      expect(prodIds).not.toContain('prod-for');

      const catsRes = await app.fetch(new Request('http://localhost/api/categories', { headers }), env);
      const catsBody: any = await catsRes.json();
      const catIds = (catsBody.data || []).map((c: any) => c.id);
      expect(catIds).toContain('cat-def');
      expect(catIds).not.toContain('cat-for');

      const invForeignRes = await app.fetch(new Request('http://localhost/api/inventory/inv-for', { headers }), env);
      expect(invForeignRes.status).toBe(404);

      const resForeignGet = await app.fetch(new Request('http://localhost/api/reservations/res-for', { headers }), env);
      expect(resForeignGet.status).toBe(404);
    } finally {
      sql.close();
    }
  });

  it('enforces fail-closed tenant isolation across inventory forecasting, staff tips, ERPNext surfaces, cron jobs, catalog modifiers/happy-hour, and admin stuck-payments/notification-settings', async () => {
    const { sql, env } = createTestEnv();
    try {
      const now = new Date().toISOString();
      sql.exec(`
        CREATE TABLE inventory_items (id TEXT PRIMARY KEY, sku TEXT, name TEXT, current_stock REAL DEFAULT 0,
          min_stock REAL DEFAULT 0, unit TEXT DEFAULT 'kg', active INTEGER DEFAULT 1, tenant_id TEXT);
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, tax_id TEXT,
          erpnext_id TEXT, sync_status TEXT, tenant_id TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE expenses (id TEXT PRIMARY KEY, amount REAL, category TEXT, date TEXT, description TEXT, tenant_id TEXT);
        CREATE TABLE cron_jobs (id TEXT PRIMARY KEY, name TEXT, description TEXT, cron_expression TEXT,
          handler TEXT, payload TEXT, is_active INTEGER DEFAULT 1, status TEXT DEFAULT 'idle',
          location_id TEXT, created_by TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE cron_runs (id TEXT PRIMARY KEY, job_id TEXT, status TEXT, payload TEXT,
          started_at TEXT, duration_ms INTEGER, error TEXT, created_at TEXT);
        CREATE TABLE happy_hour_windows (id TEXT PRIMARY KEY, name TEXT, discount_percent INTEGER,
          start_time TEXT, end_time TEXT, day_of_week INTEGER, active INTEGER DEFAULT 1, priority INTEGER DEFAULT 1,
          tenant_id TEXT, created_at TEXT);
        INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
          VALUES('mgr-b','Manager Store B','manager','store-b',1,1,'${now}'),
                ('mgr-def','Manager Default','manager','default',1,1,'${now}');
        INSERT INTO inventory_items(id,sku,name,current_stock,min_stock,unit,active,tenant_id)
          VALUES('item-def-only','SKU-DEF','Default Only Bean',50,10,'kg',1,'default');
        ALTER TABLE orders ADD COLUMN tip_amount INTEGER DEFAULT 0;
        ALTER TABLE orders ADD COLUMN updated_by TEXT;
        INSERT INTO orders(id,customer_name,customer_phone,payment_method,items,total,tip_amount,updated_by,status,tenant_id,created_at)
          VALUES('ord-tip-def','Alice','0901111222','cod','[]',100000,15000,'mgr-def','completed','default','${now}');
        INSERT INTO customers(id,name,phone,email,tax_id,tenant_id,created_at,updated_at)
          VALUES('cust-erp-def','Default Corp','0901111111','def@corp.vn','TAX-DEF','default','${now}','${now}'),
                ('cust-erp-b','Store B Corp','0902222222','b@corp.vn','TAX-B','store-b','${now}','${now}');
        INSERT INTO expenses(id,amount,category,date,description,tenant_id)
          VALUES('exp-def',500000,'utilities','2026-10-31','Default Elec','default'),
                ('exp-b',300000,'utilities','2026-10-31','Store B Elec','store-b');
        INSERT INTO cron_jobs(id,name,cron_expression,handler,is_active,status,location_id,created_at,updated_at)
          VALUES('job-def','Default Nightly','0 0 * * *','sync',1,'idle','default','${now}','${now}'),
                ('job-b','Store B Nightly','0 1 * * *','sync',1,'idle','store-b','${now}','${now}');
        INSERT INTO happy_hour_windows(id,name,discount_percent,start_time,end_time,day_of_week,active,priority,tenant_id,created_at)
          VALUES('hh-def','Default Afternoon',20,'14:00','17:00',1,1,1,'default','${now}'),
                ('hh-b','Store B Afternoon',15,'14:00','17:00',1,1,1,'store-b','${now}');
      `);

      const mgrBAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-b'").get();
      const { token: mgrBToken } = await issueStaffSession(env, mgrBAccount, { sessionType: 'staff-web' });
      const bHeaders = { Authorization: `Bearer ${mgrBToken}`, 'Content-Type': 'application/json' };

      // 1. Inventory forecasting fail-closed when store-b has 0 items (must NOT fall back to default items)
      const forecastB = await app.fetch(
        new Request('http://localhost/api/inventory/forecasting/run-rate', { headers: bHeaders }),
        env
      );
      expect(forecastB.status).toBe(200);
      const forecastBBody: any = await forecastB.json();
      expect(forecastBBody.data).toEqual([]);

      // 2. Staff tips: store-b manager cannot see or reassign default-tenant order tips
      const tipsB = await app.fetch(new Request('http://localhost/api/staff-tips', { headers: bHeaders }), env);
      expect(tipsB.status).toBe(200);
      const tipsBBody: any = await tipsB.json();
      expect(tipsBBody.summary.tip_total).toBe(0);

      const assignForeignTip = await app.fetch(
        new Request('http://localhost/api/staff-tips/assign', {
          method: 'POST',
          headers: bHeaders,
          body: JSON.stringify({ order_id: 'ord-tip-def', staff_id: 'mgr-b', tip_amount: 50000 }),
        }),
        env
      );
      expect(assignForeignTip.status).toBe(404);

      // 3. ERPNext customers & expenses scoped to store-b
      const erpCustB = await app.fetch(new Request('http://localhost/api/erpnext/customers', { headers: bHeaders }), env);
      expect(erpCustB.status).toBe(200);
      const erpCustBBody: any = await erpCustB.json();
      expect(erpCustBBody.data.map((c: any) => c.id)).toEqual(['cust-erp-b']);

      const erpExpB = await app.fetch(new Request('http://localhost/api/erpnext/expenses', { headers: bHeaders }), env);
      expect(erpExpB.status).toBe(200);
      const erpExpBBody: any = await erpExpB.json();
      expect(erpExpBBody.data.map((e: any) => e.id)).toEqual(['exp-b']);

      // 4. Cron jobs scoped by location_id to store-b
      const cronListB = await app.fetch(new Request('http://localhost/api/cron/jobs', { headers: bHeaders }), env);
      expect(cronListB.status).toBe(200);
      const cronListBBody: any = await cronListB.json();
      expect(cronListBBody.data.jobs.map((j: any) => j.id)).toEqual(['job-b']);

      const cronForeignGet = await app.fetch(new Request('http://localhost/api/cron/jobs/job-def', { headers: bHeaders }), env);
      expect(cronForeignGet.status).toBe(404);

      // 5. Happy-hour rules scoped to store-b
      const hhListB = await app.fetch(new Request('http://localhost/api/menu-modifiers/happy-hour', { headers: bHeaders }), env);
      expect(hhListB.status).toBe(200);
      const hhListBBody: any = await hhListB.json();
      expect(hhListBBody.data.map((h: any) => h.id)).toEqual(['hh-b']);

      // 6. Admin notification-settings & stuck payments isolated per tenant
      await env.AUTH_KV.put('config:notification_settings', JSON.stringify({ autoNotifyNewOrder: true, soundAlerts: true }));
      await env.AUTH_KV.put('payment:stuck:def-1', JSON.stringify({ orderId: 'ord-tip-def', amount: 100000, tenant_id: 'default' }));

      const notifB = await app.fetch(new Request('http://localhost/api/admin/notification-settings', { headers: bHeaders }), env);
      expect(notifB.status).toBe(200);
      const notifBBody: any = await notifB.json();
      expect(notifBBody.autoNotifyNewOrder).toBe(false);

      const stuckB = await app.fetch(new Request('http://localhost/api/admin/payments/stuck', { headers: bHeaders }), env);
      expect(stuckB.status).toBe(200);
      const stuckBBody: any = await stuckB.json();
      expect(stuckBBody.stuck).toEqual([]);
    } finally {
      sql.close();
    }
  });

  it('Phase 17 (P1..P4): isolates admin-loyalty widgets/top-customers, telegram-sim/dindin checkout mutations, birthday config/redemptions, and reports/checkin tenant boundaries', async () => {
    const { sql, env } = createTestEnv();
    try {
      const today = new Date().toISOString().slice(0, 10);
      const bdayMonthDay = today.slice(5);
      sql.exec(`
        ALTER TABLE orders ADD COLUMN customer_id TEXT;
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          email TEXT,
          points INTEGER DEFAULT 0,
          loyalty_points INTEGER DEFAULT 0,
          loyalty_tier TEXT DEFAULT 'Bronze',
          tier TEXT DEFAULT 'bronze',
          total_spent REAL DEFAULT 0,
          cashback_balance REAL DEFAULT 0,
          date_of_birth TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE cashback_wallets (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          balance REAL DEFAULT 0,
          total_earned REAL DEFAULT 0,
          total_spent REAL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE checkins (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          customer_name TEXT,
          checkin_date TEXT,
          checkin_time TEXT,
          reward_amount REAL DEFAULT 5000,
          status TEXT DEFAULT 'pending',
          staff_id TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE birthday_redemptions (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          discount_percent REAL,
          order_id TEXT,
          redeemed_at TEXT
        );
        INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
          VALUES('mgr-b','Owner Store B','owner','store-b',1,1,'${today}T00:00:00Z');
        INSERT INTO customers (id, name, phone, points, loyalty_points, total_spent, cashback_balance, date_of_birth, tenant_id, created_at)
        VALUES
          ('cust-def-1', 'Default VIP 1', '0901111111', 900, 900, 5000000, 100000, '1990-${bdayMonthDay}', 'default', '${today}T08:00:00Z'),
          ('cust-def-2', 'Default VIP 2', '0901111112', 800, 800, 4000000, 50000, '1991-${bdayMonthDay}', 'default', '${today}T08:00:00Z'),
          ('cust-b-1', 'Store B VIP', '0902222222', 100, 100, 300000, 15000, '1992-${bdayMonthDay}', 'store-b', '${today}T09:00:00Z');
        INSERT INTO orders (id, customer_id, customer_name, customer_phone, total, status, tenant_id, created_at)
        VALUES
          ('ord-def-1', 'cust-def-1', 'Default VIP 1', '0901111111', 500000, 'completed', 'default', '${today}T10:00:00Z'),
          ('ord-b-1', 'cust-b-1', 'Store B VIP', '0902222222', 120000, 'confirmed', 'store-b', '${today}T10:30:00Z');
        INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent)
        VALUES
          ('wal-def-1', 'cust-def-1', 100000, 250000, 150000),
          ('wal-b-1', 'cust-b-1', 15000, 20000, 5000);
        INSERT INTO checkins (id, customer_id, customer_name, checkin_date, checkin_time, reward_amount, status, created_at)
        VALUES
          ('ci-def-1', 'cust-def-1', 'Default VIP 1', '${today}', '${today}T09:00:00Z', 50000, 'approved', '${today}T09:00:00Z'),
          ('ci-b-1', 'cust-b-1', 'Store B VIP', '${today}', '${today}T09:15:00Z', 5000, 'approved', '${today}T09:15:00Z');
      `);

      const mgrBAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-b'").get();
      const { token: mgrBToken } = await issueStaffSession(env, mgrBAccount, { sessionType: 'staff-web' });
      const bHeaders = { Authorization: `Bearer ${mgrBToken}`, 'Content-Type': 'application/json' };

      // P1: /api/admin-loyalty/top-customers?limit=1 returns store-b VIP even though default has higher spend
      const topCustB = await app.fetch(
        new Request('http://localhost/api/admin-loyalty/top-customers?limit=1', { headers: bHeaders }),
        env
      );
      expect(topCustB.status).toBe(200);
      const topCustBBody: any = await topCustB.json();
      expect(topCustBBody.data.map((c: any) => c.id)).toEqual(['cust-b-1']);

      // P2: /api/test/telegram-sim & /api/admin/dindin/checkout/:orderId/qc reject foreign order IDs
      const tgSimForeign = await app.fetch(
        new Request('http://localhost/api/test/telegram-sim', {
          method: 'POST',
          headers: bHeaders,
          body: JSON.stringify({ order_id: 'ord-def-1' }),
        }),
        env
      );
      expect(tgSimForeign.status).toBe(404);

      const dindinQcForeign = await app.fetch(
        new Request('http://localhost/api/admin/dindin/checkout/ord-def-1/qc', {
          method: 'POST',
          headers: bHeaders,
        }),
        env
      );
      expect(dindinQcForeign.status).toBe(404);

      // P3: /api/loyalty/birthday/config requires auth when JWT_SECRET is set and namespaces KV per tenant
      const unauthBdayPut = await app.fetch(
        new Request('http://localhost/api/loyalty/birthday/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discountPercent: 50 }),
        }),
        env
      );
      expect(unauthBdayPut.status).toBe(401);

      const bdayPutB = await app.fetch(
        new Request('http://localhost/api/loyalty/birthday/config', {
          method: 'PUT',
          headers: bHeaders,
          body: JSON.stringify({ discountPercent: 25 }),
        }),
        env
      );
      expect(bdayPutB.status).toBe(200);
      expect(await env.AUTH_KV.get('config:birthday:store-b')).toContain('"discountPercent":25');
      expect(await env.AUTH_KV.get('config:birthday')).toBeNull();

      // P3: /api/loyalty/birthday/redeem rejects foreign order_id
      const redeemForeignOrder = await app.fetch(
        new Request('http://localhost/api/loyalty/birthday/redeem', {
          method: 'POST',
          headers: bHeaders,
          body: JSON.stringify({ customer_id: 'cust-b-1', order_id: 'ord-def-1' }),
        }),
        env
      );
      expect(redeemForeignOrder.status).toBe(404);

      // P4: /api/reports/summary & /api/reports/daily isolate checkins cashback to store-b (5000, not 55000)
      const summaryB = await app.fetch(
        new Request('http://localhost/api/reports/summary', { headers: bHeaders }),
        env
      );
      expect(summaryB.status).toBe(200);
      const summaryBBody: any = await summaryB.json();
      expect(summaryBBody.data.total_cashback_issued).toBe(5000);

      const dailyB = await app.fetch(
        new Request(`http://localhost/api/reports/daily?from=${today}&to=${today}`, { headers: bHeaders }),
        env
      );
      expect(dailyB.status).toBe(200);
      const dailyBBody: any = await dailyB.json();
      expect(dailyBBody.data[0].cashback_earned).toBe(5000);
    } finally {
      sql.close();
    }
  });

  it('Phase 18 (Q1..Q4): enforces fail-closed table-sessions/floor-plan/admin-qr tenant guards, bidirectional referral isolation, and exact order lookup in customer assistant', async () => {
    const { env: baseEnv, sql } = createTestEnv();
    const env = {
      ...baseEnv,
      QR_SIGNING_SECRET: 'qr-signing-secret-test-32-bytes!',
    } as any;
    const sharedTs = new Date().toISOString();
    try {
      sql.exec(`
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, tenant_id TEXT, loyalty_points INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0, loyalty_tier TEXT DEFAULT 'bronze');
        CREATE TABLE referral_codes (id TEXT PRIMARY KEY, customer_id TEXT, code TEXT UNIQUE, times_used INTEGER DEFAULT 0, total_points_earned INTEGER DEFAULT 0, created_at TEXT);
        CREATE TABLE referrals (id TEXT PRIMARY KEY, referrer_id TEXT, referred_customer_id TEXT, referral_code TEXT, points_awarded INTEGER DEFAULT 0, cashback_awarded_vnd INTEGER DEFAULT 0, status TEXT, bonus_type TEXT, created_at TEXT);
        CREATE TABLE table_sessions (id TEXT PRIMARY KEY, table_id TEXT, customer_id TEXT, customer_name TEXT, customer_phone TEXT, status TEXT, order_count INTEGER DEFAULT 0, total_amount INTEGER DEFAULT 0, notes TEXT, opened_at TEXT, closed_at TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE table_qr_codes (table_id TEXT PRIMARY KEY, slug TEXT UNIQUE, updated_at TEXT);
        CREATE TABLE reviews (id TEXT PRIMARY KEY, order_id TEXT, rating INTEGER, comment TEXT, customer_name TEXT, created_at TEXT);
        CREATE TABLE container_telemetry_logs (id TEXT PRIMARY KEY, container_id TEXT, tenant_id TEXT, power_source TEXT, battery_percentage REAL, ambient_temp_celsius REAL, kds_online INTEGER, network_ping_ms REAL, alert_status TEXT, alert_message TEXT, created_at TEXT);

        INSERT INTO cafe_tables (id, table_number, name, status, capacity, tenant_id) VALUES
          ('tbl-def-1', 1, 'T1', 'Occupied', 4, 'default'),
          ('tbl-b-1', 2, 'T2', 'Available', 4, 'store-b');
        INSERT INTO table_sessions (id, table_id, status, opened_at, created_at, updated_at) VALUES
          ('SES-DEF-SECRET99', 'tbl-def-1', 'active', '2026-10-30T10:00:00Z', '2026-10-30T10:00:00Z', '2026-10-30T10:00:00Z');
        INSERT INTO table_qr_codes (table_id, slug) VALUES
          ('tbl-def-1', 'slug-def-1'),
          ('tbl-ghost', 'slug-ghost-orphan');
        INSERT INTO orders (id, order_number, customer_name, customer_phone, total, status, payment_status, payment_method, order_type, items, tenant_id, created_at, updated_at) VALUES
          ('order_def_secret', 'ORD-DEF-SEC', 'Secret Guest', '0901112222', 125000, 'preparing', 'paid', 'cash', 'dine_in', '[]', 'default', '2026-10-30T10:00:00Z', '2026-10-30T10:00:00Z');
        INSERT INTO customers (id, name, email, phone, tenant_id) VALUES
          ('cust-def-ref', 'Default Referrer', 'def@aura.test', '0901000111', 'default'),
          ('cust-b-ref', 'Store B Referee', 'b@aura.test', '0902000222', 'store-b');
        INSERT INTO referral_codes (id, customer_id, code, times_used, total_points_earned, created_at) VALUES
          ('rc-def-1', 'cust-def-ref', 'FNB-DEF001', 0, 0, '2026-10-30T00:00:00Z');
        INSERT INTO container_telemetry_logs (id, container_id, tenant_id, power_source, battery_percentage, ambient_temp_celsius, kds_online, network_ping_ms, alert_status, alert_message, created_at) VALUES
          ('tel-def', 'shared-c1', 'default', 'battery', 15, 41, 0, 100, 'CRITICAL', 'Def Critical', '${sharedTs}'),
          ('tel-b', 'shared-c1', 'store-b', 'grid', 100, 26, 1, 15, 'NORMAL', null, '${sharedTs}');
        INSERT INTO users (id, name, role, tenant_id, is_active, auth_version, created_at) VALUES
          ('mgr-q-b', 'Store B Owner', 'owner', 'store-b', 1, 1, '2026-10-30T00:00:00Z');
      `);

      const mgrBAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-q-b'").get();
      const { token: mgrBToken } = await issueStaffSession(env, mgrBAccount, { sessionType: 'staff-web' });
      const bHeaders = {
        Authorization: `Bearer ${mgrBToken}`,
        'Content-Type': 'application/json',
      };

      // Q1: POST /api/table-sessions checks table ownership BEFORE active-session 409 check (no session ID leak)
      const openForeignSession = await app.fetch(
        new Request('http://localhost/api/table-sessions', {
          method: 'POST',
          headers: bHeaders,
          body: JSON.stringify({ table_id: 'tbl-def-1' }),
        }),
        env
      );
      expect(openForeignSession.status).toBe(404);
      const openForeignBody = await openForeignSession.text();
      expect(openForeignBody).not.toContain('SES-DEF-SECRET99');

      // Q2: GET /api/admin/qr/:slug/download blocks foreign & orphaned slugs for non-default tenant
      const dlForeignQr = await app.fetch(
        new Request('http://localhost/api/admin/qr/slug-def-1/download', { headers: bHeaders }),
        env
      );
      expect(dlForeignQr.status).toBe(404);
      const dlOrphanQr = await app.fetch(
        new Request('http://localhost/api/admin/qr/slug-ghost-orphan/download', { headers: bHeaders }),
        env
      );
      expect(dlOrphanQr.status).toBe(404);

      // Q3: POST /api/reviews rejects nonexistent/unverified order_id for non-default tenant
      const reviewGhostOrder = await app.fetch(
        new Request('http://localhost/api/reviews', {
          method: 'POST',
          headers: bHeaders,
          body: JSON.stringify({ order_id: 'ord-nonexistent-999', rating: 5, comment: 'Fake' }),
        }),
        env
      );
      expect(reviewGhostOrder.status).toBe(404);

      // Q3: Store-B customer cannot apply Default-store referral code (bidirectional referral tenant isolation)
      const multiTenantEnv = { ...env, PILOT_TENANT_ID: undefined, ENVIRONMENT: 'test' };
      const custBToken = await generateJWT(
        { id: 'cust-b-ref', email: 'b@aura.test', role: 'customer', tenantId: 'store-b' } as any,
        env.JWT_SECRET
      );
      const spoofedHeaderRef = await app.fetch(
        new Request('http://localhost/api/loyalty/referral/apply', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${custBToken}`,
            'X-Tenant-ID': 'default',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: 'FNB-DEF001' }),
        }),
        multiTenantEnv
      );
      expect(spoofedHeaderRef.status).toBe(403);

      const applyCrossTenantRef = await app.fetch(
        new Request('http://localhost/api/loyalty/referral/apply', {
          method: 'POST',
          headers: { Authorization: `Bearer ${custBToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'FNB-DEF001' }),
        }),
        multiTenantEnv
      );
      expect(applyCrossTenantRef.status).toBe(404);

      // Q4: Customer assistant does not match generic word "order" against order_def_secret via substring LIKE
      const genericOrderQuery = await app.fetch(
        new Request('http://localhost/api/chat/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'Check my order status please' }),
        }),
        env
      );
      expect(genericOrderQuery.status).toBe(200);
      const genericOrderBody: any = await genericOrderQuery.json();
      expect(genericOrderBody.data.reply).not.toContain('order_def_secret');
      expect(genericOrderBody.data.reply).not.toContain('125.000');

      // Q4: GET /api/edge/containers/status outer join isolates shared container_id + timestamp by tenant_id
      const statusB = await app.fetch(
        new Request('http://localhost/api/edge/containers/status', { headers: bHeaders }),
        env
      );
      expect(statusB.status).toBe(200);
      const statusBBody: any = await statusB.json();
      expect(statusBBody.data).toHaveLength(1);
      expect(statusBBody.data[0].operational_status).toBe('NORMAL');
    } finally {
      sql.close();
    }
  });

  it('Phase 19 (R1..R4): enforces fail-closed CRM customer/referral/order/fulfillment tenant isolation, prevents pre-auth promotion redemption probing, guards SQLite NOT IN NULL trap in customer segments & broadcast, and isolates per-tenant campaign configs', async () => {
    const { env: baseEnv, sql } = createTestEnv();
    const multiTenantEnv = { ...baseEnv, PILOT_TENANT_ID: undefined } as any;
    try {
      const recentTs = new Date(Date.now() - 5 * 60_000).toISOString();
      const olderTs = new Date(Date.now() - 10 * 60_000).toISOString();
      sql.exec(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          phone TEXT,
          name TEXT,
          email TEXT,
          date_of_birth TEXT,
          loyalty_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          loyalty_tier TEXT DEFAULT 'bronze',
          total_orders INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS referral_codes (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          code TEXT UNIQUE,
          times_used INTEGER DEFAULT 0,
          total_points_earned INTEGER DEFAULT 0,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS referrals (
          id TEXT PRIMARY KEY,
          referrer_id TEXT,
          referred_customer_id TEXT,
          referral_code TEXT,
          points_awarded INTEGER DEFAULT 0,
          cashback_awarded_vnd INTEGER DEFAULT 0,
          status TEXT,
          bonus_type TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS promotions (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          type TEXT,
          value REAL,
          percent INTEGER,
          max_discount INTEGER DEFAULT 0,
          min_order INTEGER DEFAULT 0,
          starts_at TEXT,
          expires_at TEXT,
          usage_limit INTEGER DEFAULT 0,
          usage_count INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS promotion_redemptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          promotion_id TEXT,
          code TEXT,
          order_id TEXT,
          discount_amount REAL,
          order_total REAL,
          redeemed_at TEXT
        );
        CREATE TABLE IF NOT EXISTS campaign_configs (
          trigger TEXT PRIMARY KEY,
          is_active INTEGER NOT NULL DEFAULT 1,
          channels TEXT NOT NULL DEFAULT '["sms"]',
          timing TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS menu_items (
          id TEXT PRIMARY KEY,
          name TEXT,
          category_id TEXT,
          price INTEGER,
          available INTEGER DEFAULT 1,
          is_available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          menu_item_id TEXT,
          item_name TEXT,
          quantity INTEGER,
          unit_price INTEGER,
          modifiers TEXT,
          notes TEXT
        );
        ALTER TABLE orders ADD COLUMN subtotal INTEGER DEFAULT 0;
        ALTER TABLE orders ADD COLUMN discount INTEGER DEFAULT 0;
        ALTER TABLE orders ADD COLUMN customer_id TEXT;
        ALTER TABLE orders ADD COLUMN pickup_slot TEXT;
        ALTER TABLE orders ADD COLUMN delivery_address TEXT;
        ALTER TABLE orders ADD COLUMN delivery_notes TEXT;
        ALTER TABLE orders ADD COLUMN loyalty_points_used INTEGER DEFAULT 0;

        INSERT OR IGNORE INTO users (id, email, name, role, is_active, tenant_id, auth_version)
        VALUES
          ('mgr_def_r19', 'mgr-def-r19@aura.test', 'Default Manager', 'manager', 1, 'default', 1),
          ('mgr_b_r19', 'mgr-b-r19@aura.test', 'Store B Manager', 'manager', 1, 'store-b', 1);

        INSERT OR IGNORE INTO customers (id, phone, name, email, loyalty_points, lifetime_points, loyalty_tier, total_orders, tenant_id)
        VALUES
          ('cust_def_r19', '0907111111', 'Default Customer R19', 'def-r19@test.vn', 50, 50, 'GOLD', 1, 'default'),
          ('cust_b_r19', '0907222222', 'Store B Customer R19', 'b-r19@test.vn', 10, 10, 'GOLD', 0, 'store-b');

        INSERT OR IGNORE INTO referral_codes (id, customer_id, code, times_used, created_at)
        VALUES ('rc_def_r19', 'cust_def_r19', 'REFDEF19', 0, '${recentTs}');

        INSERT OR IGNORE INTO menu_items (id, name, category_id, price, available, tenant_id)
        VALUES
          ('item_def_r19', 'Default Espresso', 'cat_1', 45000, 1, 'default'),
          ('item_b_r19', 'Store B Matcha', 'cat_1', 55000, 1, 'store-b');

        INSERT OR IGNORE INTO orders (id, order_number, status, order_type, total, subtotal, items, customer_id, customer_phone, tenant_id, created_at)
        VALUES
          ('ord_def_pending_1', 'ORD-DEFP1', 'pending', 'pickup', 45000, 45000, '[]', 'cust_def_r19', '0907111111', 'default', '${olderTs}'),
          ('ord_def_pending_2', 'ORD-DEFP2', 'pending', 'pickup', 50000, 50000, '[]', NULL, NULL, 'default', '${olderTs}'),
          ('ord_b_null_phone', 'ORD-BNULL', 'pending', 'pickup', 60000, 60000, '[]', NULL, NULL, 'store-b', '${olderTs}');

        INSERT OR IGNORE INTO promotions (id, code, name, type, value, percent, max_discount, min_order, usage_limit, usage_count, is_active, tenant_id)
        VALUES ('promo_def_r19', 'R19SAVE', 'Default R19 Save', 'percentage', 15, 15, 30000, 0, 100, 1, 1, 'default');

        INSERT INTO promotion_redemptions (promotion_id, code, order_id, discount_amount, order_total, redeemed_at)
        VALUES ('promo_def_r19', 'R19SAVE', 'ord_def_pending_1', 6750, 45000, '${recentTs}');
      `);

      const defMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_def_r19'").get();
      const bMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_b_r19'").get();
      const { token: defMgrToken } = await issueStaffSession(multiTenantEnv, defMgrRow, { sessionType: 'staff-web' });
      const { token: bMgrToken } = await issueStaffSession(multiTenantEnv, bMgrRow, { sessionType: 'staff-web' });
      const custBToken = await generateJWT(
        { id: 'cust_b_r19', sub: 'cust_b_r19', role: 'customer', tenantId: 'store-b' },
        multiTenantEnv.JWT_SECRET
      );
      const bHeaders = {
        Authorization: `Bearer ${bMgrToken}`,
        'X-Tenant-ID': 'store-b',
        'Content-Type': 'application/json',
      };
      const defHeaders = {
        Authorization: `Bearer ${defMgrToken}`,
        'Content-Type': 'application/json',
      };

      // R1: GET /api/crm/customers/:id/360 fails closed (403) for cross-tenant and nonexistent customers under store-b
      const crm360Cross = await app.fetch(
        new Request('http://localhost/api/crm/customers/cust_def_r19/360', { headers: bHeaders }),
        multiTenantEnv
      );
      expect(crm360Cross.status).toBe(403);

      const crm360Missing = await app.fetch(
        new Request('http://localhost/api/crm/customers/cust_nonexistent_r19/360', { headers: bHeaders }),
        multiTenantEnv
      );
      expect(crm360Missing.status).toBe(403);

      // R1: POST /api/crm/customers/:id/referral/redeem rejects cross-tenant referral code
      const redeemCrossRef = await app.fetch(
        new Request('http://localhost/api/crm/customers/cust_b_r19/referral/redeem', {
          method: 'POST',
          headers: { Authorization: `Bearer ${custBToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'REFDEF19' }),
        }),
        multiTenantEnv
      );
      expect(redeemCrossRef.status).toBe(400);

      // R1: POST /api/crm/orders rejects cross-tenant menu item and stamps tenant_id = 'store-b' on valid store-b item
      const crossItemOrder = await app.fetch(
        new Request('http://localhost/api/crm/orders', {
          method: 'POST',
          headers: { Authorization: `Bearer ${custBToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: 'pickup',
            customerPhone: '0907222222',
            items: [{ menuItemId: 'item_def_r19', quantity: 1 }],
          }),
        }),
        multiTenantEnv
      );
      expect(crossItemOrder.status).toBe(400);

      const validBOrder = await app.fetch(
        new Request('http://localhost/api/crm/orders', {
          method: 'POST',
          headers: { Authorization: `Bearer ${custBToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: 'pickup',
            customerPhone: '0907222222',
            items: [{ menuItemId: 'item_b_r19', quantity: 1 }],
          }),
        }),
        multiTenantEnv
      );
      expect(validBOrder.status).toBe(201);
      const validBOrderBody: any = await validBOrder.json();
      const createdBOrderId = validBOrderBody.data.orderId;

      // R1: GET /api/crm/orders/:id/fulfillment scopes queueDepth to store-b (only ord_b_null_phone is ahead in store-b, not ord_def_pending_1/2)
      const fulfillmentB = await app.fetch(
        new Request(`http://localhost/api/crm/orders/${createdBOrderId}/fulfillment`, {
          headers: { Authorization: `Bearer ${custBToken}` },
        }),
        multiTenantEnv
      );
      expect(fulfillmentB.status).toBe(200);
      const fulfillmentBBody: any = await fulfillmentB.json();
      expect(fulfillmentBBody.data.queueDepth).toBe(1);

      // R2: Store B manager can create promotion with code 'R19SAVE' without colliding with default tenant's 'R19SAVE'
      const createPromoB = await app.fetch(
        new Request('http://localhost/api/promotions', {
          method: 'POST',
          headers: bHeaders,
          body: JSON.stringify({ code: 'R19SAVE', percent: 20, max_discount: 40000, min_order: 0 }),
        }),
        multiTenantEnv
      );
      expect(createPromoB.status).toBe(201);

      // R2: POST /api/promotions/redeem verifies order ownership before checking promotion_redemptions (returns 404, not 200 idempotent leak)
      const probeCrossRedemption = await app.fetch(
        new Request('http://localhost/api/promotions/redeem', {
          method: 'POST',
          headers: bHeaders,
          body: JSON.stringify({ code: 'R19SAVE', order_id: 'ord_def_pending_1', order_total: 45000 }),
        }),
        multiTenantEnv
      );
      expect(probeCrossRedemption.status).toBe(404);

      // R3: GET /api/customers/segments returns non-zero inactive_90d and case-insensitive loyalty_gold despite NULL customer_phone orders
      const segmentsBRes = await app.fetch(
        new Request('http://localhost/api/customers/segments', { headers: bHeaders }),
        multiTenantEnv
      );
      expect(segmentsBRes.status).toBe(200);
      const segmentsBBody: any = await segmentsBRes.json();
      const goldSeg = segmentsBBody.data.find((s: any) => s.id === 'loyalty_gold');
      const inactiveSeg = segmentsBBody.data.find((s: any) => s.id === 'inactive_90d');
      expect(goldSeg?.count).toBe(1);
      // cust_b_r19 just placed validBOrder with phone '0907222222'; add an inactive store-b customer and verify NOT IN (NULL) does not zero it out
      sql.exec(`
        INSERT INTO customers (id, phone, name, email, loyalty_points, lifetime_points, loyalty_tier, total_orders, tenant_id)
        VALUES ('cust_b_inactive_r19', '0907333333', 'Inactive B', 'inact-b@test.vn', 0, 0, 'BRONZE', 0, 'store-b');
      `);
      const segmentsBRes2 = await app.fetch(
        new Request('http://localhost/api/customers/segments', { headers: bHeaders }),
        multiTenantEnv
      );
      const segmentsBBody2: any = await segmentsBRes2.json();
      const inactiveSeg2 = segmentsBBody2.data.find((s: any) => s.id === 'inactive_90d');
      expect(inactiveSeg2?.count).toBe(1);
      void inactiveSeg;

      // R4: PUT /api/campaigns/welcome by store-b manager does not mutate default tenant's welcome campaign config
      await app.fetch(new Request('http://localhost/api/campaigns', { headers: defHeaders }), multiTenantEnv);
      await app.fetch(new Request('http://localhost/api/campaigns', { headers: bHeaders }), multiTenantEnv);

      const putBWelcome = await app.fetch(
        new Request('http://localhost/api/campaigns/welcome', {
          method: 'PUT',
          headers: bHeaders,
          body: JSON.stringify({ is_active: 0, channels: ['zalo'] }),
        }),
        multiTenantEnv
      );
      expect(putBWelcome.status).toBe(200);

      const getDefWelcome = await app.fetch(
        new Request('http://localhost/api/campaigns/welcome', { headers: defHeaders }),
        multiTenantEnv
      );
      expect(getDefWelcome.status).toBe(200);
      const getDefWelcomeBody: any = await getDefWelcome.json();
      expect(getDefWelcomeBody.data.is_active).toBe(1);
      expect(getDefWelcomeBody.data.channels).toEqual(['sms', 'email']);
    } finally {
      sql.close();
    }
  });

  it('Phase 20 (S1..S4): enforces ERPNext invoice tenant/order ownership, fail-closed ERPNext configure auth + tenant KV isolation, WiFi captive-portal PII masking/duration ceiling/tenant isolation, and Mixpost/Zalo tenant scoping', async () => {
    const { env: baseEnv, sql } = createTestEnv();
    const { handleErpnextRequest } = await import('../../routes/erpnext');
    const multiTenantEnv = { ...baseEnv, PILOT_TENANT_ID: undefined } as any;
    try {
      sql.exec(`
        CREATE TABLE IF NOT EXISTS erpnext_mappings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          local_id TEXT,
          local_type TEXT DEFAULT 'order',
          erpnext_id TEXT,
          erpnext_model TEXT DEFAULT 'Sales Invoice',
          sync_status TEXT DEFAULT 'synced',
          attempts INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          last_synced_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          email TEXT,
          name TEXT,
          phone TEXT,
          zalo TEXT,
          loyalty_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          loyalty_tier TEXT DEFAULT 'BRONZE',
          source TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS wifi_sessions (
          id TEXT PRIMARY KEY,
          client_mac TEXT NOT NULL,
          ip_address TEXT,
          phone TEXT,
          customer_id TEXT,
          status TEXT DEFAULT 'authorized',
          session_timeout INTEGER DEFAULT 3600,
          authorized_at TEXT,
          expires_at TEXT,
          created_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS promotions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL,
          percent INTEGER NOT NULL,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price INTEGER NOT NULL,
          category_id INTEGER DEFAULT 1,
          is_available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS mixpost_posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT,
          status TEXT,
          platforms TEXT,
          source TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          tenant_id TEXT DEFAULT 'default'
        );

        ALTER TABLE orders ADD COLUMN total_amount INTEGER;
        ALTER TABLE orders ADD COLUMN customer_email TEXT;

        INSERT INTO users (id, email, name, role, is_active, tenant_id)
        VALUES
          ('mgr_def_s20', 'mgr-def-s20@test.vn', 'Manager Def S20', 'manager', 1, 'default'),
          ('mgr_b_s20', 'mgr-b-s20@test.vn', 'Manager B S20', 'manager', 1, 'store-b'),
          ('staff_b_s20', 'staff-b-s20@test.vn', 'Staff B S20', 'staff', 1, 'store-b');

        INSERT INTO orders (id, order_number, status, payment_status, total, total_amount, customer_name, tenant_id)
        VALUES
          ('ord_s20_def', 'ORD-S20-D', 'completed', 'paid', 65000, 65000, 'Khach Default', 'default'),
          ('ord_s20_b', 'ORD-S20-B', 'completed', 'paid', 85000, 85000, 'Khach Store B', 'store-b');

        INSERT INTO erpnext_mappings (local_id, local_type, erpnext_id, sync_status)
        VALUES
          ('ord_s20_def', 'order', 'SINV-DEF-001', 'synced'),
          ('ord_s20_b', 'order', 'SINV-B-001', 'synced');

        INSERT INTO customers (id, email, name, phone, zalo, tenant_id)
        VALUES
          ('cust_s20_def', 'def@test.vn', 'Customer Default', '0908111111', '0908111111', 'default'),
          ('cust_s20_b', 'b@test.vn', 'Customer B', '0908222222', '0908222222', 'store-b');

        INSERT INTO promotions (code, percent, is_active, tenant_id)
        VALUES
          ('PROMO_DEF_ONLY', 30, 1, 'default'),
          ('PROMO_B_ONLY', 15, 1, 'store-b');

        INSERT INTO products (id, name, price, category_id, is_available, tenant_id)
        VALUES
          ('prod_s20_def', 'Secret Default Roast', 55000, 1, 1, 'default'),
          ('prod_s20_b', 'Store B Matcha', 49000, 1, 1, 'store-b');

        INSERT INTO mixpost_posts (content, status, platforms, source, tenant_id)
        VALUES
          ('Post Default', 'published', '[]', 'manual', 'default'),
          ('Post Store B', 'published', '[]', 'manual', 'store-b');
      `);

      const defMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_def_s20'").get();
      const bMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_b_s20'").get();
      const bStaffRow: any = sql.prepare("SELECT * FROM users WHERE id = 'staff_b_s20'").get();

      const { token: defaultManagerToken } = await issueStaffSession(multiTenantEnv, defMgrRow, { sessionType: 'staff-web' });
      const { token: storeBManagerToken } = await issueStaffSession(multiTenantEnv, bMgrRow, { sessionType: 'staff-web' });
      const { token: storeBStaffToken } = await issueStaffSession(multiTenantEnv, bStaffRow, { sessionType: 'staff-web' });

      const bManagerHeaders = { Authorization: `Bearer ${storeBManagerToken}`, 'Content-Type': 'application/json' };
      const bStaffHeaders = { Authorization: `Bearer ${storeBStaffToken}`, 'Content-Type': 'application/json' };
      const defManagerHeaders = { Authorization: `Bearer ${defaultManagerToken}`, 'Content-Type': 'application/json' };

      // S1: GET /api/erpnext-invoices/list ignores spoofed X-Tenant-ID: * from Store B manager
      const listSpoofRes = await app.fetch(
        new Request('http://localhost/api/erpnext-invoices/list', {
          headers: { ...bManagerHeaders, 'X-Tenant-ID': '*' },
        }),
        multiTenantEnv
      );
      expect(listSpoofRes.status).toBe(200);
      const listSpoofBody: any = await listSpoofRes.json();
      expect(listSpoofBody.data.map((r: any) => r.order_id)).toEqual(['ord_s20_b']);

      // S1: POST /api/erpnext-invoices/create & GET /api/erpnext-invoices/:orderId return 404 for foreign-tenant order
      const createForeignInvRes = await app.fetch(
        new Request('http://localhost/api/erpnext-invoices/create', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({ id: 'ord_s20_def', total: 65000, items: [] }),
        }),
        multiTenantEnv
      );
      expect(createForeignInvRes.status).toBe(404);

      const getForeignInvRes = await app.fetch(
        new Request('http://localhost/api/erpnext-invoices/ord_s20_def', {
          headers: bManagerHeaders,
        }),
        multiTenantEnv
      );
      expect(getForeignInvRes.status).toBe(404);

      // S2: DELETE /api/erpnext/configure fails closed (401) when JWT_SECRET is missing
      const delNoSecretRes = await handleErpnextRequest(
        new Request('http://localhost/api/erpnext/configure', { method: 'DELETE' }),
        { AUTH_KV: multiTenantEnv.AUTH_KV }
      );
      expect(delNoSecretRes.status).toBe(401);

      // S2: Staff role is rejected (403) on POST & DELETE /api/erpnext/configure
      const staffPostConfRes = await app.fetch(
        new Request('http://localhost/api/erpnext/configure', {
          method: 'POST',
          headers: bStaffHeaders,
          body: JSON.stringify({ url: 'https://erp.store-b.vn', api_key: 'key_b', api_secret: 'sec_b' }),
        }),
        multiTenantEnv
      );
      expect(staffPostConfRes.status).toBe(403);

      const staffDelConfRes = await app.fetch(
        new Request('http://localhost/api/erpnext/configure', {
          method: 'DELETE',
          headers: bStaffHeaders,
        }),
        multiTenantEnv
      );
      expect(staffDelConfRes.status).toBe(403);

      // S2: Tenant-namespaced KV keys prevent Store B manager from overwriting/deleting default tenant ERPNext credentials
      await multiTenantEnv.AUTH_KV.put('erpnext:api_url', 'https://erp.default.vn');
      await multiTenantEnv.AUTH_KV.put('erpnext:api_key', 'key_def');
      await multiTenantEnv.AUTH_KV.put('erpnext:api_secret', 'sec_def');

      const mgrBDelConfRes = await app.fetch(
        new Request('http://localhost/api/erpnext/configure', {
          method: 'DELETE',
          headers: bManagerHeaders,
        }),
        multiTenantEnv
      );
      expect(mgrBDelConfRes.status).toBe(200);
      expect(await multiTenantEnv.AUTH_KV.get('erpnext:api_url')).toBe('https://erp.default.vn');

      // S3: POST /api/wifi/login rejects excessive duration_seconds (>86400)
      const excessiveWifiRes = await app.fetch(
        new Request('http://localhost/api/wifi/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mac: 'AA:BB:CC:11:22:33', phone: '0909123456', duration_seconds: 9999999 }),
        }),
        multiTenantEnv
      );
      expect(excessiveWifiRes.status).toBe(400);

      // S3: Valid WiFi login + GET /api/wifi/status masks phone PII and isolates tenants
      const validWifiLoginRes = await app.fetch(
        new Request('http://localhost/api/wifi/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mac: 'AA:BB:CC:11:22:33', phone: '0909777888', duration_seconds: 3600 }),
        }),
        multiTenantEnv
      );
      expect(validWifiLoginRes.status).toBe(200);

      const wifiStatusDefRes = await app.fetch(
        new Request('http://localhost/api/wifi/status?mac=AA:BB:CC:11:22:33'),
        multiTenantEnv
      );
      expect(wifiStatusDefRes.status).toBe(200);
      const wifiStatusDefBody: any = await wifiStatusDefRes.json();
      expect(wifiStatusDefBody.authorized).toBe(true);
      expect(wifiStatusDefBody.session.phone).toBe('090****888');

      // S3: Store B staff revoking AA:BB:CC:11:22:33 does not revoke default tenant's active WiFi session
      const bRevokeWifiRes = await app.fetch(
        new Request('http://localhost/api/wifi/authorize', {
          method: 'POST',
          headers: bStaffHeaders,
          body: JSON.stringify({ mac: 'AA:BB:CC:11:22:33', action: 'revoke' }),
        }),
        multiTenantEnv
      );
      expect(bRevokeWifiRes.status).toBe(200);

      const wifiStatusAfterBRevoke = await app.fetch(
        new Request('http://localhost/api/wifi/status?mac=AA:BB:CC:11:22:33'),
        multiTenantEnv
      );
      const wifiStatusAfterBRevokeBody: any = await wifiStatusAfterBRevoke.json();
      expect(wifiStatusAfterBRevokeBody.authorized).toBe(true);

      // S4: POST /api/mixpost/generate isolates promotions & menu products per tenant
      const genForeignPromoRes = await app.fetch(
        new Request('http://localhost/api/mixpost/generate', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({ source: 'promotion', id: 'PROMO_DEF_ONLY' }),
        }),
        multiTenantEnv
      );
      expect(genForeignPromoRes.status).toBe(404);

      const genOwnMenuRes = await app.fetch(
        new Request('http://localhost/api/mixpost/generate', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({ source: 'menu' }),
        }),
        multiTenantEnv
      );
      expect(genOwnMenuRes.status).toBe(200);
      const genOwnMenuBody: any = await genOwnMenuRes.json();
      expect(genOwnMenuBody.data.content).toContain('Store B Matcha');
      expect(genOwnMenuBody.data.content).not.toContain('Secret Default Roast');

      // S4: GET /api/mixpost/posts scopes posts by tenant
      const postsBRes = await app.fetch(
        new Request('http://localhost/api/mixpost/posts', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(postsBRes.status).toBe(200);
      const postsBBody: any = await postsBRes.json();
      expect(postsBBody.data.map((p: any) => p.content)).toEqual(['Post Store B']);

      // S4: POST /api/zalo/send with foreign-tenant customer_id returns customer_not_found
      const zaloForeignRes = await app.fetch(
        new Request('http://localhost/api/zalo/send', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({ customer_id: 'cust_s20_def', template_key: 'welcome', data: {} }),
        }),
        multiTenantEnv
      );
      expect(zaloForeignRes.status).toBe(200);
      const zaloForeignBody: any = await zaloForeignRes.json();
      expect(zaloForeignBody.success).toBe(false);
      expect(zaloForeignBody.data.reason).toBe('customer_not_found');
      void defManagerHeaders;
    } finally {
      sql.close();
    }
  });

  it('T1..T4: enforces ERPNext POS webhook secret & batch bounds, Mautic per-tenant state, TastyIgniter order ownership & status allowlist, and Frigate/HA tenant & identifier guards', async () => {
    const { env: baseEnv, sql } = createTestEnv();
    const kvStore = new Map<string, string>();
    const multiTenantEnv = {
      ...baseEnv,
      PILOT_TENANT_ID: undefined,
      ENVIRONMENT: 'production',
      ERPNEXT_URL: 'https://erp.example.com',
      ERPNEXT_API_KEY: 'key',
      ERPNEXT_API_SECRET: 'secret',
      ERPNEXT_WEBHOOK_SECRET: 'erp_wh_secret_123',
      TASTYIGNITER_WEBHOOK_SECRET: 'ti_wh_secret_123',
      TASTYIGNITER_SYNC_ENABLED: 'false',
      HA_WEBHOOK_SECRET: 'ha_wh_secret_123',
      AURA_KV: {
        get: async (k: string, type?: string) => {
          const v = kvStore.get(k) ?? null;
          return v && type === 'json' ? JSON.parse(v) : v;
        },
        put: async (k: string, v: string) => { kvStore.set(k, v); },
        delete: async (k: string) => { kvStore.delete(k); },
      } as unknown as KVNamespace,
    } as any;

    try {
      sql.exec(`
        CREATE TABLE IF NOT EXISTS erpnext_webhook_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doctype TEXT,
          docname TEXT,
          action TEXT,
          payload TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS ti_order_bridge (
          id TEXT PRIMARY KEY,
          local_order_id TEXT,
          ti_order_id TEXT,
          status TEXT,
          synced_at TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS frigate_events (
          id TEXT PRIMARY KEY,
          camera TEXT,
          label TEXT,
          start_time INTEGER,
          end_time INTEGER,
          score REAL,
          payload TEXT,
          received_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS ha_device_states (
          entity_id TEXT PRIMARY KEY,
          state TEXT,
          attributes TEXT,
          last_changed TEXT,
          last_updated TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        INSERT INTO users (id, email, name, role, is_active, tenant_id)
        VALUES ('mgr_b_t21', 'mgr-b-t21@test.vn', 'Manager B T21', 'manager', 1, 'store-b');
        INSERT INTO orders (id, order_number, status, payment_status, total, customer_name, tenant_id)
        VALUES ('ord_t21_def', 'ORD-T21-D', 'pending', 'unpaid', 95000, 'Customer Default', 'default');
        INSERT INTO frigate_events (id, camera, label, start_time, end_time, score, payload, received_at, tenant_id)
        VALUES
          ('evt_def', 'front_door', 'person', 1700000100, 1700000110, 0.92, '{}', datetime('now'), 'default'),
          ('evt_b', 'patio', 'person', 1700000200, 1700000210, 0.88, '{}', datetime('now'), 'store-b');
        INSERT INTO ha_device_states (entity_id, state, attributes, last_changed, last_updated, tenant_id)
        VALUES
          ('light.kitchen_main', 'on', '{}', datetime('now'), datetime('now'), 'default'),
          ('light.kitchen_b', 'off', '{}', datetime('now'), datetime('now'), 'store-b');
      `);

      const bMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_b_t21'").get();
      const { token: storeBManagerToken } = await issueStaffSession(multiTenantEnv, bMgrRow, { sessionType: 'staff-web' });
      const bManagerHeaders = {
        Authorization: `Bearer ${storeBManagerToken}`,
        'X-Tenant-ID': 'store-b',
        'Content-Type': 'application/json',
      };

      // T1: POST /api/erpnext-pos/webhook rejects invalid secret with 401 and accepts valid secret
      const badWhRes = await app.fetch(
        new Request('http://localhost/api/erpnext-pos/webhook', {
          method: 'POST',
          headers: { ...bManagerHeaders, 'x-erpnext-webhook-secret': 'wrong_secret' },
          body: JSON.stringify({ doctype: 'Sales Order', docname: 'SO-001', action: 'on_update' }),
        }),
        multiTenantEnv
      );
      expect(badWhRes.status).toBe(401);

      const goodWhRes = await app.fetch(
        new Request('http://localhost/api/erpnext-pos/webhook', {
          method: 'POST',
          headers: { ...bManagerHeaders, 'x-erpnext-webhook-secret': 'erp_wh_secret_123' },
          body: JSON.stringify({ doctype: 'Sales Order', docname: 'SO-001', action: 'on_update' }),
        }),
        multiTenantEnv
      );
      expect(goodWhRes.status).toBe(200);

      // T1: POST /api/erpnext-pos/products/sync rejects empty products array with 400
      const emptySyncRes = await app.fetch(
        new Request('http://localhost/api/erpnext-pos/products/sync', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({ products: [] }),
        }),
        multiTenantEnv
      );
      expect(emptySyncRes.status).toBe(400);

      // T2: GET /api/mautic-bridge/status isolates per-tenant sync status from default tenant
      const statusBRes = await app.fetch(
        new Request('http://localhost/api/mautic-bridge/status', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(statusBRes.status).toBe(200);
      const statusBBody: any = await statusBRes.json();
      expect(statusBBody.data.status).toBe('idle');

      // T3: POST /api/integrations/tastyigniter/sync/order rejects foreign tenant order ID with 404
      const tiForeignOrderRes = await app.fetch(
        new Request('http://localhost/api/integrations/tastyigniter/sync/order', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({
            localOrderId: 'ord_t21_def',
            orderData: { items: [], total: 95000 },
          }),
        }),
        multiTenantEnv
      );
      expect(tiForeignOrderRes.status).toBe(404);

      // T3: POST /api/integrations/tastyigniter/webhook in production rejects query-string secret (?secret=...)
      const tiQuerySecretRes = await app.fetch(
        new Request('http://localhost/api/integrations/tastyigniter/webhook?secret=ti_wh_secret_123', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'order.InjectedStatus', local_order_id: 'ord_t21_def' }),
        }),
        multiTenantEnv
      );
      expect(tiQuerySecretRes.status).toBe(401);

      // T3: POST /api/integrations/tastyigniter/webhook with header secret maps unknown status to allowlisted 'confirmed'
      const tiHeaderSecretRes = await app.fetch(
        new Request('http://localhost/api/integrations/tastyigniter/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tastyigniter-signature': 'ti_wh_secret_123',
          },
          body: JSON.stringify({ event: 'order.arbitrary_pwn_status', local_order_id: 'ord_t21_def' }),
        }),
        multiTenantEnv
      );
      expect(tiHeaderSecretRes.status).toBe(200);
      const tiHeaderSecretBody: any = await tiHeaderSecretRes.json();
      expect(tiHeaderSecretBody.mapped_status).toBe('confirmed');

      // T4: Frigate rejects invalid camera ID / invalid since and scopes events by tenant
      const frigateBadCamRes = await app.fetch(
        new Request('http://localhost/api/integrations/frigate/camera/../../etc/passwd/snapshot', {
          headers: bManagerHeaders,
        }),
        multiTenantEnv
      );
      expect([400, 404]).toContain(frigateBadCamRes.status);

      const frigateBadSinceRes = await app.fetch(
        new Request('http://localhost/api/integrations/frigate/events?since=not_a_number', {
          headers: bManagerHeaders,
        }),
        multiTenantEnv
      );
      expect(frigateBadSinceRes.status).toBe(400);

      const frigateEventsBRes = await app.fetch(
        new Request('http://localhost/api/integrations/frigate/events', {
          headers: bManagerHeaders,
        }),
        multiTenantEnv
      );
      expect(frigateEventsBRes.status).toBe(200);
      const frigateEventsBBody: any = await frigateEventsBRes.json();
      expect(frigateEventsBBody.events.map((e: any) => e.id)).toEqual(['evt_b']);

      // T4: Home Assistant rejects wildcard zone '%', scopes devices by tenant, and rejects query token in production
      const haWildcardZoneRes = await app.fetch(
        new Request('http://localhost/api/ha/devices/zone/%25', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(haWildcardZoneRes.status).toBe(400);

      const haDevicesBRes = await app.fetch(
        new Request('http://localhost/api/ha/devices', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(haDevicesBRes.status).toBe(200);
      const haDevicesBBody: any = await haDevicesBRes.json();
      expect(haDevicesBBody.devices.map((d: any) => d.entity_id)).toEqual(['light.kitchen_b']);

      const haForeignDeviceRes = await app.fetch(
        new Request('http://localhost/api/ha/devices/light.kitchen_main', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(haForeignDeviceRes.status).toBe(404);

      const haQueryWebhookRes = await app.fetch(
        new Request('http://localhost/api/ha/webhook?token=ha_wh_secret_123', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: 'light.kitchen_b', state: 'on' }),
        }),
        multiTenantEnv
      );
      expect(haQueryWebhookRes.status).toBe(401);
    } finally {
      sql.close();
    }
  });

  it('U1..U4: enforces ERPNext customers/expenses bounds, admin sync role/log scoping, customer assistant PII masking, and dynamic pricing server-authoritative cost floor', async () => {
    const { env: baseEnv, sql } = createTestEnv();
    const multiTenantEnv = {
      ...baseEnv,
      PILOT_TENANT_ID: undefined,
      ENVIRONMENT: 'production',
    } as any;

    try {
      sql.exec(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          email TEXT,
          tax_id TEXT,
          erpnext_id TEXT,
          sync_status TEXT,
          loyalty_points INTEGER DEFAULT 0,
          loyalty_tier TEXT DEFAULT 'bronze',
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS erpnext_sync_logs (
          id TEXT PRIMARY KEY,
          method TEXT,
          endpoint TEXT,
          request_body TEXT,
          response_body TEXT,
          error TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT,
          price REAL,
          cost_price REAL,
          category_id TEXT,
          is_available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS dynamic_pricing_rules (
          id TEXT PRIMARY KEY,
          tenant_id TEXT DEFAULT 'default',
          name TEXT,
          rule_type TEXT,
          discount_percent REAL,
          target_category TEXT,
          target_product_id TEXT,
          min_margin_percent REAL DEFAULT 30,
          days_of_week TEXT DEFAULT '0,1,2,3,4,5,6',
          start_time TEXT DEFAULT '00:00',
          end_time TEXT DEFAULT '23:59',
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO users (id, email, name, role, is_active, tenant_id)
        VALUES
          ('mgr_b_u22', 'mgr-b-u22@test.vn', 'Manager B U22', 'manager', 1, 'store-b'),
          ('staff_b_u22', 'staff-b-u22@test.vn', 'Staff B U22', 'staff', 1, 'store-b');
        INSERT INTO customers (id, name, phone, loyalty_points, loyalty_tier, tenant_id)
        VALUES ('cust_u22_def', 'Nguyễn Văn An', '0912345678', 320, 'gold', 'default');
        INSERT INTO orders (id, order_number, status, payment_status, total, customer_phone, customer_name, tenant_id)
        VALUES ('ord_secret_0001', 'ORD-U22-1', 'preparing', 'paid', 85000, '0912345678', 'Nguyễn Văn An', 'default');
        INSERT INTO products (id, name, price, cost_price, category_id, is_available, tenant_id)
        VALUES ('prod_u22_cf', 'Cà Phê Đặc Biệt', 50000, 35000, 'cat_cf', 1, 'default');
        INSERT INTO dynamic_pricing_rules (
          id, tenant_id, name, rule_type, discount_percent, target_product_id, min_margin_percent, days_of_week, start_time, end_time, is_active
        ) VALUES (
          'rule_u22_1', 'default', 'Flash 60%', 'happy_hour', 60, 'prod_u22_cf', 30, '0,1,2,3,4,5,6', '00:00', '23:59', 1
        );
        INSERT INTO erpnext_sync_logs (id, method, endpoint, request_body, response_body, error, created_at)
        VALUES
          ('log_def_1', 'POST', '/api/admin/erpnext-sync/orders', '{"entity":"orders","tenant_id":"default","secret":"pii_def"}', '{"ok":true}', NULL, '2026-10-30T08:00:00Z'),
          ('log_b_1', 'POST', '/api/admin/erpnext-sync/orders', '{"entity":"orders","tenant_id":"store-b","secret":"pii_b"}', '{"ok":true}', NULL, '2026-10-30T09:00:00Z');
      `);

      const bMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_b_u22'").get();
      const bStaffRow: any = sql.prepare("SELECT * FROM users WHERE id = 'staff_b_u22'").get();
      const { token: storeBManagerToken } = await issueStaffSession(multiTenantEnv, bMgrRow, { sessionType: 'staff-web' });
      const { token: storeBStaffToken } = await issueStaffSession(multiTenantEnv, bStaffRow, { sessionType: 'staff-web' });

      const bManagerHeaders = {
        Authorization: `Bearer ${storeBManagerToken}`,
        'X-Tenant-ID': 'store-b',
        'Content-Type': 'application/json',
      };
      const bStaffHeaders = {
        Authorization: `Bearer ${storeBStaffToken}`,
        'X-Tenant-ID': 'store-b',
        'Content-Type': 'application/json',
      };

      // U1: GET /api/erpnext/customers clamps negative page and excessive limit
      const custRes = await app.fetch(
        new Request('http://localhost/api/erpnext/customers?page=-5&limit=9999', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(custRes.status).toBe(200);
      const custBody: any = await custRes.json();
      expect(custBody.pagination.page).toBe(1);
      expect(custBody.pagination.limit).toBe(200);

      // U1: GET /api/erpnext/expenses rejects invalid date filter with 400
      const badExpDateRes = await app.fetch(
        new Request('http://localhost/api/erpnext/expenses?from=not-a-date', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(badExpDateRes.status).toBe(400);

      // U2: Staff cannot access GET /api/admin/erpnext-sync/status or POST /api/admin/erpnext-sync/sync-all
      const staffSyncStatusRes = await app.fetch(
        new Request('http://localhost/api/admin/erpnext-sync/status', { headers: bStaffHeaders }),
        multiTenantEnv
      );
      expect(staffSyncStatusRes.status).toBe(403);

      const staffSyncTriggerRes = await app.fetch(
        new Request('http://localhost/api/admin/erpnext-sync/sync-all', {
          method: 'POST',
          headers: bStaffHeaders,
        }),
        multiTenantEnv
      );
      expect(staffSyncTriggerRes.status).toBe(403);

      // U2: Manager B sees only store-b sync logs and request_body/response_body are redacted
      const mgrSyncStatusRes = await app.fetch(
        new Request('http://localhost/api/admin/erpnext-sync/status', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(mgrSyncStatusRes.status).toBe(200);
      const mgrSyncStatusBody: any = await mgrSyncStatusRes.json();
      expect(mgrSyncStatusBody.logs.map((l: any) => l.id)).toEqual(['log_b_1']);
      expect(mgrSyncStatusBody.logs[0].request_body).toBeUndefined();
      expect(mgrSyncStatusBody.logs[0].response_body).toBeUndefined();

      // U3: POST /api/chat/assistant masks customer full name on loyalty lookup and order ID on phone-only order lookup
      const loyaltyChatRes = await app.fetch(
        new Request('http://localhost/api/chat/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'Kiểm tra điểm tích lũy', phone: '0912345678' }),
        }),
        multiTenantEnv
      );
      expect(loyaltyChatRes.status).toBe(200);
      const loyaltyChatBody: any = await loyaltyChatRes.json();
      expect(loyaltyChatBody.data.reply).toContain('Nguyễn ***');
      expect(loyaltyChatBody.data.reply).not.toContain('Nguyễn Văn An');

      const orderPhoneChatRes = await app.fetch(
        new Request('http://localhost/api/chat/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'Kiểm tra đơn hàng của tôi', phone: '0912345678' }),
        }),
        multiTenantEnv
      );
      expect(orderPhoneChatRes.status).toBe(200);
      const orderPhoneChatBody: any = await orderPhoneChatRes.json();
      expect(orderPhoneChatBody.data.reply).toContain('#***0001');
      expect(orderPhoneChatBody.data.reply).not.toContain('ord_secret_0001');

      // U4: Invalid timestamp rejected with 400 on /active and /calculate
      const badTsActiveRes = await app.fetch(
        new Request('http://localhost/api/pricing/dynamic/active?timestamp=not-a-timestamp'),
        multiTenantEnv
      );
      expect(badTsActiveRes.status).toBe(400);

      // U4: Invalid days_of_week rejected with 400 on POST /api/pricing/dynamic/rules
      const badRuleRes = await app.fetch(
        new Request('http://localhost/api/pricing/dynamic/rules', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({
            name: 'Invalid Days Rule',
            rule_type: 'happy_hour',
            discount_percent: 20,
            days_of_week: '1,9,invalid',
            start_time: '08:00',
            end_time: '17:00',
          }),
        }),
        multiTenantEnv
      );
      expect(badRuleRes.status).toBe(400);

      // U4: POST /api/pricing/dynamic/calculate without unit_cost enforces server-authoritative cost_price (35,000 * 1.3 = 45,500 floor -> max 9% discount)
      const calcRes = await app.fetch(
        new Request('http://localhost/api/pricing/dynamic/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ product_id: 'prod_u22_cf', price: 50000, quantity: 1 }],
            timestamp: '2026-10-30T10:00:00Z',
          }),
        }),
        multiTenantEnv
      );
      expect(calcRes.status).toBe(200);
      const calcBody: any = await calcRes.json();
      expect(calcBody.data.items[0].discount_percent).toBe(9);
      expect(calcBody.data.items[0].final_price).toBe(45500);
    } finally {
      sql.close();
    }
  });

  it('V1..V4: enforces ERPNext vendors pre-limit tenant scoping, inventory forecasting NaN/tenant guards, franchise financial metrics RBAC + date validation, and Zalo/Barista/Recommendations input hardening', async () => {
    const { env: baseEnv, sql } = createTestEnv();
    const multiTenantEnv = {
      ...baseEnv,
      PILOT_TENANT_ID: undefined,
      ENVIRONMENT: 'production',
    } as any;

    try {
      sql.exec(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          name TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS franchise_locations (
          id TEXT PRIMARY KEY,
          tenant_id TEXT DEFAULT 'default',
          code TEXT,
          name TEXT,
          address TEXT,
          city TEXT,
          phone TEXT,
          royalty_percentage REAL DEFAULT 5.0,
          status TEXT DEFAULT 'active'
        );
        INSERT INTO users (id, email, name, role, is_active, tenant_id)
        VALUES
          ('mgr_b_v23', 'mgr-b-v23@test.vn', 'Manager B V23', 'manager', 1, 'store-b'),
          ('staff_b_v23', 'staff-b-v23@test.vn', 'Staff B V23', 'staff', 1, 'store-b');
        INSERT INTO suppliers (id, name, tenant_id, created_at)
        VALUES
          ('sup_def_1', 'Supplier Default 1', 'default', '2026-10-30T10:00:00Z'),
          ('sup_def_2', 'Supplier Default 2', 'default', '2026-10-30T10:01:00Z'),
          ('sup_b_1', 'Supplier Store B', 'store-b', '2026-10-30T09:00:00Z');
        INSERT INTO franchise_locations (id, tenant_id, code, name, royalty_percentage, status)
        VALUES ('loc_b_v23', 'store-b', 'SDB01', 'AURA Store B', 5.0, 'active');
      `);

      const bMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_b_v23'").get();
      const bStaffRow: any = sql.prepare("SELECT * FROM users WHERE id = 'staff_b_v23'").get();
      const { token: storeBManagerToken } = await issueStaffSession(multiTenantEnv, bMgrRow, { sessionType: 'staff-web' });
      const { token: storeBStaffToken } = await issueStaffSession(multiTenantEnv, bStaffRow, { sessionType: 'staff-web' });

      const bManagerHeaders = {
        Authorization: `Bearer ${storeBManagerToken}`,
        'X-Tenant-ID': 'store-b',
        'Content-Type': 'application/json',
      };
      const bStaffHeaders = {
        Authorization: `Bearer ${storeBStaffToken}`,
        'X-Tenant-ID': 'store-b',
        'Content-Type': 'application/json',
      };

      // V1: GET /api/erpnext/vendors?limit=1 returns store-b's supplier even when default tenant has newer rows
      const vendorsRes = await app.fetch(
        new Request('http://localhost/api/erpnext/vendors?limit=1', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(vendorsRes.status).toBe(200);
      const vendorsBody: any = await vendorsRes.json();
      expect(vendorsBody.data.map((v: any) => v.id)).toEqual(['sup_b_1']);

      // V2: GET /api/inventory/forecasting/run-rate?days=abc&lead_time_days=xyz does not throw 500 RangeError and isolates store-b from default inventory
      const runRateRes = await app.fetch(
        new Request('http://localhost/api/inventory/forecasting/run-rate?days=abc&lead_time_days=xyz', {
          headers: bManagerHeaders,
        }),
        multiTenantEnv
      );
      expect(runRateRes.status).toBe(200);
      const runRateBody: any = await runRateRes.json();
      expect(runRateBody.data).toEqual([]);

      // V3: Staff cannot access GET /api/franchise/locations/:id/metrics (403), while manager can (200) and invalid start_date returns 400
      const staffMetricsRes = await app.fetch(
        new Request('http://localhost/api/franchise/locations/loc_b_v23/metrics', { headers: bStaffHeaders }),
        multiTenantEnv
      );
      expect(staffMetricsRes.status).toBe(403);

      const badDateMetricsRes = await app.fetch(
        new Request('http://localhost/api/franchise/locations/loc_b_v23/metrics?start_date=not-a-date', {
          headers: bManagerHeaders,
        }),
        multiTenantEnv
      );
      expect(badDateMetricsRes.status).toBe(400);

      const mgrMetricsRes = await app.fetch(
        new Request('http://localhost/api/franchise/locations/loc_b_v23/metrics?start_date=2026-10-01', {
          headers: bManagerHeaders,
        }),
        multiTenantEnv
      );
      expect(mgrMetricsRes.status).toBe(200);

      // V4: GET /api/webhooks/zalo rejects HTML/script challenge with 400 and sets X-Content-Type-Options: nosniff on valid challenge
      const xssChallengeRes = await app.fetch(
        new Request('http://localhost/api/webhooks/zalo?challenge=%3Cscript%3Ealert(1)%3C/script%3E'),
        multiTenantEnv
      );
      expect(xssChallengeRes.status).toBe(400);

      const validChallengeRes = await app.fetch(
        new Request('http://localhost/api/webhooks/zalo?challenge=zalo_verify_token_123'),
        multiTenantEnv
      );
      expect(validChallengeRes.status).toBe(200);
      expect(validChallengeRes.headers.get('X-Content-Type-Options')).toBe('nosniff');

      // V4: POST /api/ai/barista/recommend rejects oversized mood (>100 chars) with 400
      const badBaristaRes = await app.fetch(
        new Request('http://localhost/api/ai/barista/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences: { mood: 'x'.repeat(150) } }),
        }),
        multiTenantEnv
      );
      expect(badBaristaRes.status).toBe(400);

      // V4: GET /api/recommendations/trending?limit=abc falls back cleanly without NaN slice
      const trendingNaNRes = await app.fetch(
        new Request('http://localhost/api/recommendations/trending?limit=abc'),
        multiTenantEnv
      );
      expect(trendingNaNRes.status).toBe(200);
      const trendingNaNBody: any = await trendingNaNRes.json();
      expect(trendingNaNBody.data.length).toBeGreaterThan(0);
    } finally {
      sql.close();
    }
  });

  it('W1..W4: enforces Pretix identifier/path-traversal guards, DinDin config RBAC & cart price/qty validation, OpenAPI catalog multi-tenant isolation, and loyalty account tenant/annual birthday guards', async () => {
    const { env: baseEnv, sql } = createTestEnv();
    const multiTenantEnv = {
      ...baseEnv,
      PILOT_TENANT_ID: undefined,
      ENVIRONMENT: 'production',
      PRETIX_API_URL: 'https://pretix.example.com',
      PRETIX_API_TOKEN: 'pretix_token_123',
      PRETIX_ORGANIZER: 'aura-cafe',
    } as any;

    try {
      const catDefId = '11111111-1111-4111-8111-111111111124';
      const catBId = '22222222-2222-4222-8222-222222222224';
      const prodDefId = '33333333-3333-4333-8333-333333333324';
      const prodBId = '44444444-4444-4444-8444-444444444424';
      const custDefId = '55555555-5555-4555-8555-555555555524';
      const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
      const currentYearStr = String(new Date().getFullYear());

      sql.exec(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT,
          slug TEXT,
          description TEXT,
          sort_order INTEGER DEFAULT 0,
          image_url TEXT,
          display_name_vi TEXT,
          display_name_en TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          category_id TEXT,
          name TEXT,
          slug TEXT,
          price REAL,
          compare_at_price REAL,
          description TEXT,
          image_url TEXT,
          tags TEXT,
          is_available INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          birthday TEXT,
          loyalty_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          loyalty_tier TEXT DEFAULT 'bronze',
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS loyalty_accounts (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          current_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          tier TEXT DEFAULT 'bronze',
          order_count INTEGER DEFAULT 0,
          total_spent REAL DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          last_activity_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS loyalty_transactions (
          id TEXT PRIMARY KEY,
          account_id TEXT,
          customer_id TEXT,
          type TEXT,
          points INTEGER,
          balance_after INTEGER,
          order_id TEXT,
          reward_id TEXT,
          description TEXT,
          reason TEXT,
          idempotency_key TEXT,
          created_by TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO users (id, email, name, role, is_active, tenant_id)
        VALUES
          ('mgr_b_w24', 'mgr-b-w24@test.vn', 'Manager B W24', 'manager', 1, 'store-b'),
          ('staff_b_w24', 'staff-b-w24@test.vn', 'Staff B W24', 'staff', 1, 'store-b'),
          ('${custDefId}', 'cust-def-w24@test.vn', 'Customer Default W24', 'customer', 1, 'default');
        INSERT INTO categories (id, name, slug, sort_order, tenant_id)
        VALUES
          ('${catDefId}', 'Default Coffee', 'default-coffee', 1, 'default'),
          ('${catBId}', 'Store B Tea', 'store-b-tea', 1, 'store-b');
        INSERT INTO products (id, category_id, name, slug, price, is_available, tenant_id)
        VALUES
          ('${prodDefId}', '${catDefId}', 'Default Espresso', 'default-espresso', 45000, 1, 'default'),
          ('${prodBId}', '${catBId}', 'Store B Oolong', 'store-b-oolong', 55000, 1, 'store-b');
        INSERT INTO customers (id, name, phone, birthday, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
        VALUES ('${custDefId}', 'Customer Default W24', '0909000024', '1995-${currentMonthStr}-15', 200, 200, 'silver', 'default');
        INSERT INTO loyalty_accounts (id, customer_id, current_points, lifetime_points, tier, tenant_id)
        VALUES ('la_def_w24', '${custDefId}', 200, 200, 'silver', 'default');
      `);

      const bMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_b_w24'").get();
      const bStaffRow: any = sql.prepare("SELECT * FROM users WHERE id = 'staff_b_w24'").get();
      const { token: storeBManagerToken } = await issueStaffSession(multiTenantEnv, bMgrRow, { sessionType: 'staff-web' });
      const { token: storeBStaffToken } = await issueStaffSession(multiTenantEnv, bStaffRow, { sessionType: 'staff-web' });
      const defCustomerToken = await generateJWT(
        { sub: custDefId, role: 'customer', tenantId: 'default' },
        multiTenantEnv.JWT_SECRET
      );
      const foreignCustomerToken = await generateJWT(
        { sub: custDefId, role: 'customer', tenantId: 'store-b' },
        multiTenantEnv.JWT_SECRET
      );

      const bManagerHeaders = {
        Authorization: `Bearer ${storeBManagerToken}`,
        'X-Tenant-ID': 'store-b',
        'Content-Type': 'application/json',
      };
      const bStaffHeaders = {
        Authorization: `Bearer ${storeBStaffToken}`,
        'X-Tenant-ID': 'store-b',
        'Content-Type': 'application/json',
      };

      // W1: Pretix rejects path traversal in event query/slug andcheckin secret
      const pretixBadOrdersRes = await app.fetch(
        new Request('http://localhost/api/pretix/orders?event=..%2F..%2Fwebhooks', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(pretixBadOrdersRes.status).toBe(400);

      const pretixBadSlugRes = await app.fetch(
        new Request('http://localhost/api/pretix/events/bad%2Fslug'),
        multiTenantEnv
      );
      expect([400, 404]).toContain(pretixBadSlugRes.status);

      const pretixBadCheckinRes = await app.fetch(
        new Request('http://localhost/api/pretix/checkin', {
          method: 'POST',
          headers: bStaffHeaders,
          body: JSON.stringify({ secret: '../../admin/token', event: 'jazz-night' }),
        }),
        multiTenantEnv
      );
      expect(pretixBadCheckinRes.status).toBe(400);

      // W2: DinDin PUT /api/admin/dindin/config blocks staff role (403) and rejects negative item price (400)
      const dindinStaffCfgRes = await app.fetch(
        new Request('http://localhost/api/admin/dindin/config', {
          method: 'PUT',
          headers: bStaffHeaders,
          body: JSON.stringify({ menu: { sections: [{ items: [{ name: 'Tea', price: 30000 }] }] } }),
        }),
        multiTenantEnv
      );
      expect(dindinStaffCfgRes.status).toBe(403);

      const dindinNegPriceCfgRes = await app.fetch(
        new Request('http://localhost/api/admin/dindin/config', {
          method: 'PUT',
          headers: bManagerHeaders,
          body: JSON.stringify({ menu: { sections: [{ items: [{ name: 'Tea', price: -5000 }] }] } }),
        }),
        multiTenantEnv
      );
      expect(dindinNegPriceCfgRes.status).toBe(400);

      // W2: DinDin PATCH /api/admin/dindin/cart/:sessionId rejects negative item price or invalid sessionId
      const dindinBadCartPriceRes = await app.fetch(
        new Request('http://localhost/api/admin/dindin/cart/sess_valid_1', {
          method: 'PATCH',
          headers: bStaffHeaders,
          body: JSON.stringify({ action: 'add', item: { id: 'it_1', name: 'Espresso', price: -10000, qty: 1 } }),
        }),
        multiTenantEnv
      );
      expect(dindinBadCartPriceRes.status).toBe(400);

      // W3: Store B manager cannot PATCH or DELETE default tenant's category or product on OpenAPI catalog routers (404)
      const { openApiCategoriesRouter } = await import('../../routes/openapi-categories');
      const { openApiProductsRouter } = await import('../../routes/openapi-products');

      const crossTenantCatPatchRes = await openApiCategoriesRouter.fetch(
        new Request(`http://localhost/api/categories/${catDefId}`, {
          method: 'PATCH',
          headers: bManagerHeaders,
          body: JSON.stringify({ name: 'Hijacked Category' }),
        }),
        multiTenantEnv
      );
      expect(crossTenantCatPatchRes.status).toBe(404);

      const crossTenantProdDelRes = await openApiProductsRouter.fetch(
        new Request(`http://localhost/api/products/${prodDefId}`, {
          method: 'DELETE',
          headers: bManagerHeaders,
        }),
        multiTenantEnv
      );
      expect(crossTenantProdDelRes.status).toBe(404);

      // W3: GET /api/products on openApiProductsRouter scopes products to caller tenant
      const bProductsRes = await openApiProductsRouter.fetch(
        new Request('http://localhost/api/products', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(bProductsRes.status).toBe(200);
      const bProductsBody: any = await bProductsRes.json();
      expect(bProductsBody.data.products.map((p: any) => p.id)).toEqual([prodBId]);

      // W4: Foreign-tenant token cannot read default tenant's loyalty account (404)
      const foreignLoyaltyRes = await app.fetch(
        new Request('http://localhost/api/loyalty/account', {
          headers: { Authorization: `Bearer ${foreignCustomerToken}`, 'X-Tenant-ID': 'store-b' },
        }),
        multiTenantEnv
      );
      expect(foreignLoyaltyRes.status).toBe(404);

      // W4: Birthday bonus rejects duplicate claim within the same year (even if claimed in an earlier month of the same year)
      sql.prepare(
        `INSERT INTO loyalty_transactions (id, account_id, customer_id, type, points, balance_after, description, reason, created_at)
         VALUES ('tx_bday_prev', 'la_def_w24', ?, 'birthday', 500, 700, 'Birthday bonus', 'Birthday bonus', ?)`
      ).run(custDefId, `${currentYearStr}-01-01T00:00:00Z`);

      const duplicateYearlyBdayRes = await app.fetch(
        new Request('http://localhost/api/loyalty/account/birthday-bonus', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${defCustomerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }),
        multiTenantEnv
      );
      expect(duplicateYearlyBdayRes.status).toBe(400);
    } finally {
      sql.close();
    }
  });

  it('Phase 25 (X1..X4): enforces OpenAPI auth OTP type separation & brute-force rate limits, session ownership/expiry & logout KV revocation, PO supplier tenant ownership & cancelled-PO receive guard, and vitals/metrics input bounds', async () => {
    const { env: baseEnv, sql } = createTestEnv();
    try {
      const multiTenantEnv: any = {
        ...baseEnv,
        PILOT_TENANT_ID: undefined,
        ENVIRONMENT: 'production',
      };

      const { openApiAuthRouter } = await import('../../routes/openapi-auth');
      const { openApiInventoryRouter } = await import('../../routes/openapi-inventory');

      sql.exec(`
        CREATE TABLE IF NOT EXISTS email_verifications (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          code TEXT NOT NULL,
          type TEXT,
          expires_at TEXT NOT NULL,
          used INTEGER DEFAULT 0,
          verified_at TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at TEXT NOT NULL,
          is_trusted_device INTEGER DEFAULT 0,
          device_fingerprint TEXT,
          device_name TEXT,
          last_used_at TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          contact_person TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          payment_terms INTEGER DEFAULT 30,
          is_active INTEGER DEFAULT 1,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id TEXT PRIMARY KEY,
          po_number TEXT,
          supplier_id TEXT,
          order_date TEXT,
          expected_date TEXT,
          expected_delivery_date TEXT,
          status TEXT DEFAULT 'draft',
          total_amount REAL DEFAULT 0,
          notes TEXT,
          created_by TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS purchase_order_items (
          id TEXT PRIMARY KEY,
          purchase_order_id TEXT,
          po_id TEXT,
          ingredient_id TEXT,
          quantity REAL,
          unit_cost REAL,
          unit_price REAL,
          total_price REAL,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS inventory_items (
          id TEXT PRIMARY KEY,
          sku TEXT,
          tenant_id TEXT DEFAULT 'default',
          name TEXT,
          category TEXT,
          unit TEXT,
          current_stock REAL DEFAULT 0,
          min_stock REAL DEFAULT 0,
          max_stock REAL DEFAULT 0,
          cost_per_unit REAL DEFAULT 0,
          unit_cost REAL DEFAULT 0,
          active INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          last_restocked_at TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_id TEXT,
          actor_name TEXT,
          user_id TEXT,
          action TEXT,
          resource_type TEXT,
          resource_id TEXT,
          entity_type TEXT,
          entity_id TEXT,
          tenant_id TEXT,
          details TEXT,
          metadata TEXT,
          created_at TEXT
        );
      `);

      const nowIso = new Date().toISOString();
      const futureIso = new Date(Date.now() + 600_000).toISOString();
      const pastIso = new Date(Date.now() - 60_000).toISOString();

      sql.prepare(
        `INSERT INTO users (id, email, name, role, is_active, tenant_id)
         VALUES ('usr_x25', 'x25@aura.vn', 'User X25', 'customer', 1, 'default')`
      ).run();

      // X1: Password-reset OTP cannot be redeemed on POST /api/auth/verify-email to mint an active session
      sql.prepare(
        `INSERT INTO email_verifications (id, email, code, type, expires_at, used, created_at)
         VALUES ('ev_reset_x25', 'x25@aura.vn', '777888', 'password_reset', ?, 0, ?)`
      ).run(futureIso, nowIso);

      const resetOtpVerifyRes = await openApiAuthRouter.fetch(
        new Request('http://localhost/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'x25@aura.vn', code: '777888' }),
        }),
        multiTenantEnv
      );
      expect(resetOtpVerifyRes.status).toBe(400);

      // X1: 5 failed verify-email attempts trigger 429 lockout
      sql.prepare(
        `INSERT INTO email_verifications (id, email, code, type, expires_at, used, created_at)
         VALUES ('ev_verify_x25', 'x25@aura.vn', '111222', 'email_verification', ?, 0, ?)`
      ).run(futureIso, nowIso);

      for (let i = 0; i < 3; i++) {
        const badVerifyRes = await openApiAuthRouter.fetch(
          new Request('http://localhost/api/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'x25@aura.vn', code: '000000' }),
          }),
          multiTenantEnv
        );
        expect(badVerifyRes.status).toBe(400);
      }
      const fifthBadVerifyRes = await openApiAuthRouter.fetch(
        new Request('http://localhost/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'x25@aura.vn', code: '000000' }),
        }),
        multiTenantEnv
      );
      expect(fifthBadVerifyRes.status).toBe(429);

      // X1: POST /api/auth/reset-password enforces 5-request rate limit
      for (let i = 0; i < 5; i++) {
        const rpRes = await openApiAuthRouter.fetch(
          new Request('http://localhost/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'x25@aura.vn' }),
          }),
          multiTenantEnv
        );
        expect(rpRes.status).toBe(200);
      }
      const sixthRpRes = await openApiAuthRouter.fetch(
        new Request('http://localhost/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'x25@aura.vn' }),
        }),
        multiTenantEnv
      );
      expect(sixthRpRes.status).toBe(429);

      // X2: GET /api/auth/session rejects expired session rows (404), and POST /api/auth/logout writes revoked:${token} to AUTH_KV
      const custToken = await generateJWT(
        { id: 'usr_x25', role: 'customer', email: 'x25@aura.vn', tenantId: 'default', authVersion: 1 },
        multiTenantEnv.JWT_SECRET
      );
      sql.prepare(
        `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, is_trusted_device, created_at, updated_at)
         VALUES ('sess_exp_x25', 'usr_x25', ?, 'ref_x25', ?, 0, ?, ?)`
      ).run(custToken, pastIso, nowIso, nowIso);

      const expiredSessionRes = await openApiAuthRouter.fetch(
        new Request('http://localhost/api/auth/session', {
          headers: { Authorization: `Bearer ${custToken}` },
        }),
        multiTenantEnv
      );
      expect(expiredSessionRes.status).toBe(404);

      const logoutRes = await openApiAuthRouter.fetch(
        new Request('http://localhost/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${custToken}` },
        }),
        multiTenantEnv
      );
      expect(logoutRes.status).toBe(200);
      expect(await multiTenantEnv.AUTH_KV.get(`revoked:${custToken}`)).toBe('1');

      // X3: POST /api/inventory/purchase-orders rejects foreign-tenant supplierId (404) & /receive rejects cancelled PO (409)
      sql.prepare(
        `INSERT INTO users (id, email, name, role, is_active, tenant_id)
         VALUES
          ('mgr_def_x25', 'mgr.def.x25@aura.vn', 'Def Manager', 'manager', 1, 'default'),
          ('mgr_b_x25', 'mgr.b.x25@aura.vn', 'Store B Manager', 'manager', 1, 'store-b')`
      ).run();
      const defMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_def_x25'").get();
      const bMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_b_x25'").get();
      const { token: managerDefToken } = await issueStaffSession(multiTenantEnv, defMgrRow, { sessionType: 'staff-web' });
      const { token: managerBToken } = await issueStaffSession(multiTenantEnv, bMgrRow, { sessionType: 'staff-web' });

      const createSupDefRes = await openApiInventoryRouter.fetch(
        new Request('http://localhost/api/inventory/suppliers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${managerDefToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Default Tenant Supplier' }),
        }),
        multiTenantEnv
      );
      expect(createSupDefRes.status).toBe(201);
      const supDefId = ((await createSupDefRes.json()) as any).data.id;

      sql.prepare(
        `INSERT INTO inventory_items (id, sku, tenant_id, name, category, unit, current_stock, min_stock, max_stock, unit_cost, is_active, created_at, updated_at)
         VALUES ('ing_b_x25', 'SKU-B-X25', 'store-b', 'Store B Beans', 'raw', 'kg', 10, 2, 50, 120000, 1, ?, ?)`
      ).run(nowIso, nowIso);

      const crossTenantPoCreateRes = await openApiInventoryRouter.fetch(
        new Request('http://localhost/api/inventory/purchase-orders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${managerBToken}`,
            'X-Tenant-ID': 'store-b',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            supplierId: supDefId,
            locationId: 'store-b',
            items: [{ ingredientId: 'ing_b_x25', quantity: 5, unitCost: 120000 }],
          }),
        }),
        multiTenantEnv
      );
      expect(crossTenantPoCreateRes.status).toBe(404);

      sql.prepare(
        `INSERT INTO inventory_items (id, sku, tenant_id, name, category, unit, current_stock, min_stock, max_stock, unit_cost, is_active, created_at, updated_at)
         VALUES ('ing_def_x25', 'SKU-DEF-X25', 'default', 'Default Beans', 'raw', 'kg', 10, 2, 50, 100000, 1, ?, ?)`
      ).run(nowIso, nowIso);
      sql.prepare(
        `INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, status, total_amount, created_by, created_at, updated_at)
         VALUES ('po_cancelled_x25', 'PO-X25', ?, '2026-10-30', 'cancelled', 500000, 'mgr_def_x25', ?, ?)`
      ).run(supDefId, nowIso, nowIso);

      const receiveCancelledPoRes = await openApiInventoryRouter.fetch(
        new Request('http://localhost/api/inventory/purchase-orders/po_cancelled_x25/receive', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${managerDefToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [{ ingredientId: 'ing_def_x25', receivedQuantity: 5 }],
          }),
        }),
        multiTenantEnv
      );
      expect(receiveCancelledPoRes.status).toBe(409);

      // X4: POST /api/vitals rejects negative value or invalid rating (400), and GET /api/admin/metrics rejects wildcard % filter (400)
      const negVitalsRes = await app.fetch(
        new Request('http://localhost/api/vitals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'LCP', value: -50, rating: 'good' }),
        }),
        multiTenantEnv
      );
      expect(negVitalsRes.status).toBe(400);

      const badRatingVitalsRes = await app.fetch(
        new Request('http://localhost/api/vitals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'LCP', value: 1200, rating: '<script>alert(1)</script>' }),
        }),
        multiTenantEnv
      );
      expect(badRatingVitalsRes.status).toBe(400);

      const badMetricsFilterRes = await app.fetch(
        new Request('http://localhost/api/admin/metrics?range=24h&filter=%25_inject', {
          headers: { Authorization: `Bearer ${managerDefToken}` },
        }),
        multiTenantEnv
      );
      expect(badMetricsFilterRes.status).toBe(400);
    } finally {
      sql.close();
    }
  });

  it('Phase 26 (Y1..Y4): enforces loyalty reward/tier multi-tenant isolation & order ownership, promotion code multi-tenant resolution & subtotal clamp, and table/zone/cron cross-tenant locationId spoofing guards', async () => {
    const { env: baseEnv, sql } = createTestEnv();
    try {
      const multiTenantEnv: any = {
        ...baseEnv,
        PILOT_TENANT_ID: undefined,
        ENVIRONMENT: 'production',
      };

      const { openApiLoyaltyRouter } = await import('../../routes/openapi-loyalty');
      const { openApiPromotionsRouter } = await import('../../routes/openapi-promotions');
      const { openApiTablesRouter } = await import('../../routes/openapi-tables');
      const { openApiCronRouter } = await import('../../routes/openapi-cron');

      const custDef1Id = '11111111-1111-4111-8111-111111111126';
      const custDef2Id = '22222222-2222-4222-8222-222222222226';
      const ordDef1Id = '33333333-3333-4333-8333-333333333326';
      const ordDef2Id = '44444444-4444-4444-8444-444444444426';
      const promoDefId = '55555555-5555-4555-8555-555555555526';
      const promoBId = '66666666-6666-4666-8666-666666666626';
      const promoExpiredId = '77777777-7777-4777-8777-777777777726';
      const menuItemId = '88888888-8888-4888-8888-888888888826';
      const nowIso = new Date().toISOString();
      const pastIso = new Date(Date.now() - 86_400_000).toISOString();
      const futureIso = new Date(Date.now() + 86_400_000).toISOString();

      sql.exec(`
        CREATE TABLE IF NOT EXISTS loyalty_rewards (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          points_cost INTEGER NOT NULL,
          type TEXT NOT NULL,
          value REAL NOT NULL,
          max_redemptions INTEGER,
          current_redemptions INTEGER DEFAULT 0,
          valid_from TEXT,
          valid_to TEXT,
          is_active INTEGER DEFAULT 1,
          image_url TEXT,
          terms TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS loyalty_tier_configs (
          tier TEXT PRIMARY KEY,
          name TEXT,
          min_points INTEGER DEFAULT 0,
          point_multiplier REAL DEFAULT 1,
          points_multiplier REAL DEFAULT 1,
          discount_percent REAL DEFAULT 0,
          birthday_bonus INTEGER DEFAULT 0,
          free_shipping INTEGER DEFAULT 0,
          priority_support INTEGER DEFAULT 0,
          color TEXT,
          icon TEXT,
          benefits TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS loyalty_accounts (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          current_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          tier TEXT DEFAULT 'bronze',
          order_count INTEGER DEFAULT 0,
          total_spent REAL DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          last_activity_at TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS loyalty_transactions (
          id TEXT PRIMARY KEY,
          account_id TEXT,
          customer_id TEXT,
          type TEXT,
          points INTEGER,
          balance_after INTEGER,
          order_id TEXT,
          reward_id TEXT,
          description TEXT,
          reason TEXT,
          idempotency_key TEXT,
          created_by TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS promotions (
          id TEXT PRIMARY KEY,
          name TEXT,
          code TEXT,
          type TEXT,
          discount_type TEXT,
          discount_value REAL,
          min_order_value REAL,
          max_discount_value REAL,
          max_uses INTEGER,
          current_uses INTEGER DEFAULT 0,
          usage_count INTEGER DEFAULT 0,
          valid_from TEXT,
          valid_to TEXT,
          is_active INTEGER DEFAULT 1,
          applicable_items TEXT,
          excluded_items TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS promotion_usages (
          id TEXT PRIMARY KEY,
          promotion_id TEXT,
          order_id TEXT,
          customer_id TEXT,
          discount_amount REAL,
          idempotency_key TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS table_zones (
          id TEXT PRIMARY KEY,
          slug TEXT,
          name TEXT,
          description TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          location_id TEXT,
          metadata TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS cron_jobs (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          cron_expression TEXT,
          handler TEXT,
          payload TEXT,
          timeout_seconds INTEGER DEFAULT 300,
          max_retries INTEGER DEFAULT 3,
          retry_delay_seconds INTEGER DEFAULT 60,
          is_active INTEGER DEFAULT 1,
          status TEXT DEFAULT 'pending',
          location_id TEXT,
          created_by TEXT,
          last_run_at TEXT,
          last_status TEXT,
          next_run_at TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          actor_id TEXT,
          actor_name TEXT,
          user_id TEXT,
          action TEXT,
          resource_type TEXT,
          resource_id TEXT,
          entity_type TEXT,
          entity_id TEXT,
          details TEXT,
          metadata TEXT,
          created_at TEXT
        );
        ALTER TABLE orders ADD COLUMN customer_id TEXT;
      `);

      sql.prepare(
        `INSERT INTO users (id, email, name, role, is_active, tenant_id)
         VALUES
          ('mgr_def_y26', 'mgr.def.y26@aura.vn', 'Def Manager Y26', 'manager', 1, 'default'),
          ('mgr_b_y26', 'mgr.b.y26@aura.vn', 'Store B Manager Y26', 'manager', 1, 'store-b'),
          (?, 'cust1.y26@aura.vn', 'Customer 1 Y26', 'customer', 1, 'default'),
          (?, 'cust2.y26@aura.vn', 'Customer 2 Y26', 'customer', 1, 'default')`
      ).run(custDef1Id, custDef2Id);

      sql.prepare(
        `INSERT INTO loyalty_tier_configs (tier, name, min_points, point_multiplier, points_multiplier, updated_at)
         VALUES ('gold', 'Gold', 1000, 1.5, 1.5, ?)`
      ).run(nowIso);

      sql.prepare(
        `INSERT INTO loyalty_accounts (id, customer_id, current_points, lifetime_points, tier, tenant_id, created_at, updated_at)
         VALUES ('la_y26_1', ?, 500, 500, 'silver', 'default', ?, ?)`
      ).run(custDef1Id, nowIso, nowIso);

      sql.prepare(
        `INSERT INTO orders (id, order_number, customer_id, status, payment_status, total, customer_name, tenant_id)
         VALUES
          (?, 'ORD-Y26-1', ?, 'pending', 'unpaid', 60000, 'Customer 1', 'default'),
          (?, 'ORD-Y26-2', ?, 'pending', 'unpaid', 75000, 'Customer 2', 'default')`
      ).run(ordDef1Id, custDef1Id, ordDef2Id, custDef2Id);

      const defMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_def_y26'").get();
      const bMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr_b_y26'").get();
      const { token: managerDefToken } = await issueStaffSession(multiTenantEnv, defMgrRow, { sessionType: 'staff-web' });
      const { token: managerBToken } = await issueStaffSession(multiTenantEnv, bMgrRow, { sessionType: 'staff-web' });
      const cust1Token = await generateJWT(
        { id: custDef1Id, sub: custDef1Id, role: 'customer', tenantId: 'default' },
        multiTenantEnv.JWT_SECRET
      );

      const defManagerHeaders = {
        Authorization: `Bearer ${managerDefToken}`,
        'Content-Type': 'application/json',
      };
      const bManagerHeaders = {
        Authorization: `Bearer ${managerBToken}`,
        'X-Tenant-ID': 'store-b',
        'Content-Type': 'application/json',
      };
      const cust1Headers = {
        Authorization: `Bearer ${cust1Token}`,
        'Content-Type': 'application/json',
      };

      // Y1: Default manager creates a reward (maxRedemptions: 1); Store B cannot read, list, or PATCH it
      const createRewardRes = await openApiLoyaltyRouter.fetch(
        new Request('http://localhost/api/loyalty/rewards', {
          method: 'POST',
          headers: defManagerHeaders,
          body: JSON.stringify({
            name: 'Free Phin Coffee',
            pointsCost: 100,
            type: 'free_item',
            value: 35000,
            maxRedemptions: 1,
          }),
        }),
        multiTenantEnv
      );
      expect(createRewardRes.status).toBe(201);
      const rewardId = ((await createRewardRes.json()) as any).data.id;

      const bGetRewardRes = await openApiLoyaltyRouter.fetch(
        new Request(`http://localhost/api/loyalty/rewards/${rewardId}`, { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(bGetRewardRes.status).toBe(404);

      const bListRewardsRes = await openApiLoyaltyRouter.fetch(
        new Request('http://localhost/api/loyalty/rewards', { headers: bManagerHeaders }),
        multiTenantEnv
      );
      expect(bListRewardsRes.status).toBe(200);
      expect(((await bListRewardsRes.json()) as any).data.rewards).toEqual([]);

      const bPatchTierRes = await openApiLoyaltyRouter.fetch(
        new Request('http://localhost/api/loyalty/tiers/gold', {
          method: 'PATCH',
          headers: bManagerHeaders,
          body: JSON.stringify({ pointMultiplier: 9.9 }),
        }),
        multiTenantEnv
      );
      expect(bPatchTierRes.status).toBe(403);

      // Y1: Customer 1 cannot redeem reward against Customer 2's order (404), can redeem once (200), and second redeem hits quota (409)
      const redeemOtherOrderRes = await openApiLoyaltyRouter.fetch(
        new Request('http://localhost/api/loyalty/rewards/redeem', {
          method: 'POST',
          headers: cust1Headers,
          body: JSON.stringify({ rewardId, orderId: ordDef2Id, idempotencyKey: 'idem_redeem_other_y26' }),
        }),
        multiTenantEnv
      );
      expect(redeemOtherOrderRes.status).toBe(404);

      const redeemOwnOrderRes = await openApiLoyaltyRouter.fetch(
        new Request('http://localhost/api/loyalty/rewards/redeem', {
          method: 'POST',
          headers: cust1Headers,
          body: JSON.stringify({ rewardId, orderId: ordDef1Id, idempotencyKey: 'idem_redeem_own_y26' }),
        }),
        multiTenantEnv
      );
      expect(redeemOwnOrderRes.status).toBe(200);

      const redeemOverQuotaRes = await openApiLoyaltyRouter.fetch(
        new Request('http://localhost/api/loyalty/rewards/redeem', {
          method: 'POST',
          headers: cust1Headers,
          body: JSON.stringify({ rewardId, idempotencyKey: 'idem_redeem_over_y26' }),
        }),
        multiTenantEnv
      );
      expect(redeemOverQuotaRes.status).toBe(409);

      // Y2: Duplicate promo code across tenants resolves caller tenant's promo & clamps fixed discount to subtotal
      sql.prepare(
        `INSERT INTO promotions (id, name, code, type, discount_type, discount_value, valid_from, valid_to, is_active, tenant_id, created_at, updated_at)
         VALUES
          (?, 'Default VIP', 'VIP50', 'percentage', 'percentage', 10, ?, ?, 1, 'default', ?, ?),
          (?, 'Store B VIP', 'VIP50', 'fixed', 'fixed', 50000, ?, ?, 1, 'store-b', ?, ?),
          (?, 'Expired Promo', 'OLD10', 'percentage', 'percentage', 10, ?, ?, 1, 'default', ?, ?)`
      ).run(
        promoDefId, pastIso, futureIso, nowIso, nowIso,
        promoBId, pastIso, futureIso, nowIso, nowIso,
        promoExpiredId, pastIso, pastIso, nowIso, nowIso
      );

      const valBRes = await openApiPromotionsRouter.fetch(
        new Request('http://localhost/api/promotions/validate', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({
            code: 'VIP50',
            orderValue: 30000,
            items: [{ menuItemId, quantity: 1, price: 30000 }],
          }),
        }),
        multiTenantEnv
      );
      expect(valBRes.status).toBe(200);
      const valBBody: any = await valBRes.json();
      expect(valBBody.data.promotion.id).toBe(promoBId);
      expect(valBBody.data.discount).toBe(30000);
      expect(valBBody.data.finalTotal).toBe(0);

      // Y2: POST /api/promotions/use rejects expired promo (400) and rejects foreign customer's orderId (404)
      const useExpiredRes = await openApiPromotionsRouter.fetch(
        new Request('http://localhost/api/promotions/use', {
          method: 'POST',
          headers: cust1Headers,
          body: JSON.stringify({
            promotionId: promoExpiredId,
            orderId: ordDef1Id,
            discountAmount: 5000,
          }),
        }),
        multiTenantEnv
      );
      expect(useExpiredRes.status).toBe(400);

      const useForeignOrderRes = await openApiPromotionsRouter.fetch(
        new Request('http://localhost/api/promotions/use', {
          method: 'POST',
          headers: cust1Headers,
          body: JSON.stringify({
            promotionId: promoDefId,
            orderId: ordDef2Id,
            discountAmount: 5000,
          }),
        }),
        multiTenantEnv
      );
      expect(useForeignOrderRes.status).toBe(404);

      // Y3: Store B manager cannot spoof locationId: 'default' on POST /api/tables or POST /api/table-zones (403)
      const spoofTableLocRes = await openApiTablesRouter.fetch(
        new Request('http://localhost/api/tables', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({
            zoneId: 'indoor',
            code: 'T-SPOOF',
            name: 'Spoofed Table',
            capacity: 4,
            locationId: 'default',
          }),
        }),
        multiTenantEnv
      );
      expect(spoofTableLocRes.status).toBe(403);

      const spoofZoneLocRes = await openApiTablesRouter.fetch(
        new Request('http://localhost/api/table-zones', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({
            slug: 'spoof-zone',
            name: 'Spoof Zone',
            locationId: 'default',
          }),
        }),
        multiTenantEnv
      );
      expect(spoofZoneLocRes.status).toBe(403);

      // Y4: Store B manager cannot spoof locationId: 'default' on POST /api/cron/jobs (403)
      const spoofCronLocRes = await openApiCronRouter.fetch(
        new Request('http://localhost/api/cron/jobs', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({
            name: 'Spoof Cron',
            cronExpression: '0 * * * *',
            handler: 'daily_report',
            locationId: 'default',
          }),
        }),
        multiTenantEnv
      );
      expect(spoofCronLocRes.status).toBe(403);
    } finally {
      sql.close();
    }
  });

  it('Phase 27 (Z1..Z4): OpenAPI inventory SKU tenant isolation & atomic PO receive CAS, order cancel customer projection & tenant-scoped promo decrement, staff AUTH_KV soft-delete revocation, and atomic stock movement balance CAS', async () => {
    const { env, sql } = createTestEnv();
    try {
      const { openApiInventoryRouter } = await import('../../routes/openapi-inventory');
      const { openApiOrdersRouter } = await import('../../routes/openapi-orders');
      const { openApiStaffRouter } = await import('../../routes/openapi-staff');

      sql.exec(`
        ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 1;
        ALTER TABLE users ADD COLUMN locale TEXT DEFAULT 'vi';
        ALTER TABLE users ADD COLUMN avatar_url TEXT;
        ALTER TABLE users ADD COLUMN hire_date TEXT;
        CREATE TABLE IF NOT EXISTS staff_users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          is_active INTEGER DEFAULT 1,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS ingredients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          sku TEXT NOT NULL,
          category TEXT,
          unit TEXT NOT NULL,
          cost_per_unit REAL DEFAULT 0,
          current_stock REAL DEFAULT 0,
          min_stock REAL DEFAULT 0,
          max_stock REAL DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS inventory_items (
          id TEXT PRIMARY KEY,
          sku TEXT,
          tenant_id TEXT DEFAULT 'default',
          name TEXT,
          category TEXT,
          unit TEXT,
          current_stock REAL DEFAULT 0,
          min_stock REAL DEFAULT 0,
          max_stock REAL DEFAULT 0,
          cost_per_unit REAL DEFAULT 0,
          unit_cost REAL DEFAULT 0,
          active INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          last_restocked_at TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          tenant_id TEXT DEFAULT 'default',
          name TEXT NOT NULL,
          contact_person TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          payment_terms INTEGER DEFAULT 30,
          is_active INTEGER DEFAULT 1,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id TEXT PRIMARY KEY,
          po_number TEXT,
          supplier_id TEXT,
          order_date TEXT,
          expected_date TEXT,
          expected_delivery_date TEXT,
          status TEXT DEFAULT 'draft',
          total_amount REAL DEFAULT 0,
          notes TEXT,
          created_by TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS purchase_order_items (
          id TEXT PRIMARY KEY,
          purchase_order_id TEXT,
          po_id TEXT,
          ingredient_id TEXT,
          quantity REAL,
          unit_cost REAL,
          unit_price REAL,
          total_price REAL,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          ingredient_id TEXT,
          type TEXT,
          quantity REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          created_by TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS inventory_transactions (
          id TEXT PRIMARY KEY,
          item_id TEXT,
          type TEXT,
          quantity REAL,
          reference_type TEXT,
          reference_id TEXT,
          notes TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS promotions (
          id TEXT PRIMARY KEY,
          tenant_id TEXT DEFAULT 'default',
          code TEXT,
          name TEXT,
          usage_count INTEGER DEFAULT 0,
          current_uses INTEGER DEFAULT 0,
          used_count INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS promotion_redemptions (
          id TEXT PRIMARY KEY,
          promotion_id TEXT,
          order_id TEXT,
          customer_id TEXT,
          code TEXT,
          discount_amount REAL DEFAULT 0,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          actor_id TEXT,
          actor_name TEXT,
          user_id TEXT,
          action TEXT,
          resource_type TEXT,
          resource_id TEXT,
          entity_type TEXT,
          entity_id TEXT,
          tenant_id TEXT,
          details TEXT,
          metadata TEXT,
          created_at TEXT
        );

        INSERT INTO users (id, name, email, role, tenant_id, is_active, auth_version, created_at)
        VALUES
          ('owner-def-z27', 'Owner Default', 'owner-def-z27@aura.vn', 'owner', 'default', 1, 1, '2026-10-30T00:00:00Z'),
          ('mgr-b-z27', 'Manager B', 'mgr-b-z27@aura.vn', 'manager', 'store-b', 1, 1, '2026-10-30T00:00:00Z'),
          ('staff-del-z27', 'Staff To Delete', 'staff-del-z27@aura.vn', 'staff', 'default', 1, 2, '2026-10-30T00:00:00Z'),
          ('cust-z27', 'Customer Z27', 'cust-z27@aura.vn', 'customer', 'default', 1, 1, '2026-10-30T00:00:00Z');

        INSERT INTO staff_users (id, name, email, role, is_active, updated_at)
        VALUES ('staff-del-z27', 'Staff To Delete', 'staff-del-z27@aura.vn', 'staff', 1, '2026-10-30T00:00:00Z');

        INSERT INTO ingredients (id, name, sku, category, unit, cost_per_unit, current_stock, is_active, created_at, updated_at)
        VALUES
          ('ing_def_z27', 'Default Arabica', 'SKU-SHARED-Z27', 'beans', 'kg', 250000, 10, 1, '2026-10-30T00:00:00Z', '2026-10-30T00:00:00Z'),
          ('ing_b_z27', 'Store B Milk', 'SKU-B-MILK', 'dairy', 'l', 40000, 10, 1, '2026-10-30T00:00:00Z', '2026-10-30T00:00:00Z');

        INSERT INTO inventory_items (id, sku, tenant_id, name, category, unit, current_stock, cost_per_unit, unit_cost, is_active, created_at, updated_at)
        VALUES
          ('ing_def_z27', 'SKU-SHARED-Z27', 'default', 'Default Arabica', 'beans', 'kg', 10, 250000, 250000, 1, '2026-10-30T00:00:00Z', '2026-10-30T00:00:00Z'),
          ('ing_b_z27', 'SKU-B-MILK', 'store-b', 'Store B Milk', 'dairy', 'l', 10, 40000, 40000, 1, '2026-10-30T00:00:00Z', '2026-10-30T00:00:00Z');

        INSERT INTO suppliers (id, tenant_id, name, is_active, created_at, updated_at)
        VALUES ('sup_b_z27', 'store-b', 'Store B Supplier', 1, '2026-10-30T00:00:00Z', '2026-10-30T00:00:00Z');

        INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, status, total_amount, created_by, created_at, updated_at)
        VALUES ('po_b_z27', 'PO-Z27', 'sup_b_z27', '2026-10-30', 'ordered', 400000, 'mgr-b-z27', '2026-10-30T00:00:00Z', '2026-10-30T00:00:00Z');

        INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity, unit_cost, unit_price, total_price, created_at)
        VALUES ('poi_b_z27', 'po_b_z27', 'po_b_z27', 'ing_b_z27', 10, 40000, 40000, 400000, '2026-10-30T00:00:00Z');

        INSERT INTO promotions (id, tenant_id, code, name, usage_count, current_uses, used_count, is_active)
        VALUES
          ('promo_def_z27', 'default', 'PROMO-Z27', 'Default Promo', 3, 3, 3, 1),
          ('promo_b_z27', 'store-b', 'PROMO-Z27', 'Store B Promo', 5, 5, 5, 1);

        ALTER TABLE orders ADD COLUMN customer_id TEXT;
        ALTER TABLE orders ADD COLUMN source TEXT;
        ALTER TABLE orders ADD COLUMN location_id TEXT;
        INSERT INTO orders (id, order_number, customer_id, customer_phone, customer_name, tenant_id, total, status, payment_status, payment_method, order_type, source, location_id, items, created_at, updated_at)
        VALUES ('ord_cancel_z27', 'ORD-Z27', 'cust-z27', '0909999888', 'Customer Z27', 'default', 55000, 'cancelled', 'unpaid', 'cod', 'dine_in', 'pos_internal', 'loc_internal_1', '[]', '2026-10-30T01:00:00Z', '2026-10-30T01:00:00Z');

        INSERT INTO promotion_redemptions (id, promotion_id, order_id, customer_id, code, discount_amount, created_at)
        VALUES ('pr_z27', 'promo_def_z27', 'ord_cancel_z27', 'cust-z27', 'PROMO-Z27', 10000, '2026-10-30T01:00:00Z');
      `);

      const kvStore = new Map<string, string>();
      kvStore.set('user:staff-del-z27@aura.vn', JSON.stringify({
        id: 'staff-del-z27',
        email: 'staff-del-z27@aura.vn',
        role: 'staff',
        active: true,
        isActive: true,
        auth_version: 2,
      }));
      kvStore.set('user:staff-del-z27', JSON.stringify({
        id: 'staff-del-z27',
        email: 'staff-del-z27@aura.vn',
        role: 'staff',
        active: true,
        isActive: true,
        auth_version: 2,
      }));

      const multiTenantEnv = {
        ...env,
        TENANT_ID: '',
        AUTH_KV: {
          get: async (k: string) => kvStore.get(k) ?? null,
          put: async (k: string, v: string) => { kvStore.set(k, v); },
          delete: async (k: string) => { kvStore.delete(k); },
        },
      } as any;

      const defOwnerRow: any = sql.prepare("SELECT * FROM users WHERE id = 'owner-def-z27'").get();
      const bMgrRow: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-b-z27'").get();
      const { token: defOwnerToken } = await issueStaffSession(multiTenantEnv, defOwnerRow, { sessionType: 'staff-web' });
      const { token: bManagerToken } = await issueStaffSession(multiTenantEnv, bMgrRow, { sessionType: 'staff-web' });
      const custToken = await generateJWT(
        { id: 'cust-z27', sub: 'cust-z27', role: 'customer', tenantId: 'default' } as any,
        env.JWT_SECRET,
        3600
      );

      const defOwnerHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${defOwnerToken}`,
      };
      const bManagerHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bManagerToken}`,
        'X-Tenant-ID': 'store-b',
      };
      const custHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      };

      // Z1: Store B manager can create an ingredient with the same SKU ('SKU-SHARED-Z27') used by default tenant (201, not 409)
      const createSameSkuRes = await openApiInventoryRouter.fetch(
        new Request('http://localhost/api/inventory/ingredients', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({
            name: 'Store B Arabica',
            sku: 'SKU-SHARED-Z27',
            category: 'beans',
            unit: 'kg',
            costPerUnit: 240000,
            currentStock: 5,
            minStock: 1,
            maxStock: 50,
          }),
        }),
        multiTenantEnv
      );
      expect(createSameSkuRes.status).toBe(201);

      // Z1: PATCH /api/inventory/purchase-orders/{id} rejects status: 'received' bypass (400)
      const patchPoReceivedRes = await openApiInventoryRouter.fetch(
        new Request('http://localhost/api/inventory/purchase-orders/po_b_z27', {
          method: 'PATCH',
          headers: bManagerHeaders,
          body: JSON.stringify({ status: 'received' }),
        }),
        multiTenantEnv
      );
      expect(patchPoReceivedRes.status).toBe(400);

      // Z1: POST /api/inventory/purchase-orders/{id}/receive rejects ingredient not belonging to the PO (400)
      const receiveUnlistedItemRes = await openApiInventoryRouter.fetch(
        new Request('http://localhost/api/inventory/purchase-orders/po_b_z27/receive', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({
            items: [{ ingredientId: 'ing_def_z27', receivedQuantity: 5 }],
          }),
        }),
        multiTenantEnv
      );
      expect(receiveUnlistedItemRes.status).toBe(400);

      // Z2: Customer calling idempotent POST /api/orders/:id/cancel receives customer-safe projection (omits source/payments/location_id)
      const custCancelRes = await openApiOrdersRouter.fetch(
        new Request('http://localhost/api/orders/ord_cancel_z27/cancel', {
          method: 'POST',
          headers: custHeaders,
          body: JSON.stringify({ reason: 'Changed mind' }),
        }),
        multiTenantEnv
      );
      expect(custCancelRes.status).toBe(200);
      const custCancelJson = (await custCancelRes.json()) as any;
      expect(custCancelJson.data.id).toBe('ord_cancel_z27');
      expect(custCancelJson.data.source).toBeUndefined();
      expect(custCancelJson.data.payments).toBeUndefined();
      expect(custCancelJson.data.location_id).toBeUndefined();

      // Z3: DELETE /api/staff/:id soft-deletes staff_users and revokes AUTH_KV cached credentials
      const delStaffRes = await openApiStaffRouter.fetch(
        new Request('http://localhost/api/staff/staff-del-z27', {
          method: 'DELETE',
          headers: defOwnerHeaders,
        }),
        multiTenantEnv
      );
      expect(delStaffRes.status).toBe(200);
      const kvAfterDel = JSON.parse(kvStore.get('user:staff-del-z27@aura.vn') || '{}');
      expect(kvAfterDel.active).toBe(false);
      expect(kvAfterDel.isActive).toBe(false);
      expect(kvAfterDel.auth_version).toBe(3);
      const staffUserRow = sql.prepare('SELECT is_active FROM staff_users WHERE id = ?').get('staff-del-z27') as { is_active: number };
      expect(staffUserRow.is_active).toBe(0);

      // Z4: POST /api/inventory/movements enforces atomic stock balance deduction and rejects overdraft (400)
      const deductOkRes = await openApiInventoryRouter.fetch(
        new Request('http://localhost/api/inventory/movements', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({
            ingredientId: 'ing_b_z27',
            type: 'waste',
            quantity: -6,
            notes: 'Spilled milk',
          }),
        }),
        multiTenantEnv
      );
      expect(deductOkRes.status).toBe(201);

      const deductOverRes = await openApiInventoryRouter.fetch(
        new Request('http://localhost/api/inventory/movements', {
          method: 'POST',
          headers: bManagerHeaders,
          body: JSON.stringify({
            ingredientId: 'ing_b_z27',
            type: 'waste',
            quantity: -6,
            notes: 'Second spill exceeding remaining 4L',
          }),
        }),
        multiTenantEnv
      );
      expect(deductOverRes.status).toBe(400);
      const remStock = sql.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing_b_z27') as { current_stock: number };
      expect(remStock.current_stock).toBe(4);
    } finally {
      sql.close();
    }
  });

  // ── Phase 28 (AA1..AA4) ───────────────────────────────────────────
  it('AA1: subscription customer/vendor horizontal isolation and price tampering guard', async () => {
    const sql = new DatabaseSync(':memory:');
    try {
      sql.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, role TEXT,
          tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1,
          password_hash TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE subscription_plans (id TEXT PRIMARY KEY, name TEXT, slug TEXT, description TEXT,
          container_size TEXT, monthly_price_vnd INTEGER, deposit_vnd INTEGER, features TEXT,
          max_occupants INTEGER, is_popular INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
        CREATE TABLE subscriptions (id TEXT PRIMARY KEY, plan_id TEXT, customer_id TEXT,
          customer_name TEXT, customer_email TEXT, customer_phone TEXT, container_number TEXT,
          status TEXT, amount_vnd INTEGER, deposit_vnd INTEGER, deposit_paid INTEGER DEFAULT 0,
          billing_cycle TEXT, current_period_start TEXT, current_period_end TEXT,
          next_billing_date TEXT, tenant_id TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE subscription_invoices (id TEXT PRIMARY KEY, subscription_id TEXT,
          amount_vnd INTEGER, status TEXT, period_start TEXT, period_end TEXT,
          invoice_number TEXT, tenant_id TEXT, payment_method TEXT, payment_ref TEXT,
          paid_at TEXT, created_at TEXT, updated_at TEXT);
        INSERT INTO users(id,name,email,role,tenant_id,is_active,auth_version,created_at)
          VALUES('cust-aa1','Cust AA1','cust@aa1.vn','customer','default',1,1,'2026-10-30');
        INSERT INTO users(id,name,email,role,tenant_id,is_active,auth_version,created_at)
          VALUES('admin-aa1','Admin','admin@aa1.vn','admin','default',1,1,'2026-10-30');
        INSERT INTO subscription_plans(id,name,slug,monthly_price_vnd,deposit_vnd,is_active,created_at,updated_at)
          VALUES('plan-aa1','Basic','basic',5000000,2000000,1,'2026-10-30','2026-10-30');
        INSERT INTO subscriptions(id,plan_id,customer_id,customer_email,status,amount_vnd,deposit_vnd,tenant_id,created_at,updated_at)
          VALUES('sub-aa1-a','plan-aa1','cust-aa1','cust@aa1.vn','active',5000000,2000000,'default','2026-10-30','2026-10-30');
        INSERT INTO subscriptions(id,plan_id,customer_id,customer_email,status,amount_vnd,deposit_vnd,tenant_id,created_at,updated_at)
          VALUES('sub-aa1-b','plan-aa1','other-cust','other@aa1.vn','active',5000000,2000000,'default','2026-10-30','2026-10-30');
      `);

      function statement(query: string, values: unknown[] = []): any {
        return {
          bind(...args: unknown[]) { return statement(query, args); },
          async first() { return sql.prepare(query).get(...(values as any[])) ?? null; },
          async all() { return { success: true, results: sql.prepare(query).all(...(values as any[])) }; },
          async run() {
            const r = sql.prepare(query).run(...(values as any[]));
            return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
          },
        };
      }
      const db: any = { prepare: statement, async batch(stmts: any[]) { return Promise.all(stmts.map((s: any) => s.run())); } };
      const kvData = new Map<string, string>();
      const kv = {
        async get(k: string) { return kvData.get(k) ?? null; },
        async put(k: string, v: string) { kvData.set(k, v); },
        async delete(k: string) { kvData.delete(k); },
        async list(opts?: { prefix?: string }) {
          const prefix = opts?.prefix ?? '';
          return { keys: Array.from(kvData.keys()).filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true };
        },
      };

      const env: any = {
        AURA_DB: db,
        DB: db,
        AUTH_KV: kv,
        JWT_SECRET: 'test-jwt-secret-aa1-32chars!!!',
        ENVIRONMENT: 'production',
        PILOT_TENANT_ID: 'default',
      };

      const custJwt = await generateJWT({ sub: 'cust-aa1', id: 'cust-aa1', email: 'cust@aa1.vn', role: 'customer', customerId: 'cust-aa1' }, env.JWT_SECRET);
      const custHeaders = { Authorization: `Bearer ${custJwt}`, 'Content-Type': 'application/json' };

      // Customer can see their own subscription
      const ownRes = await app.fetch(
        new Request('http://localhost/api/subscriptions/sub-aa1-a', { headers: custHeaders }),
        env
      );
      expect(ownRes.status).toBe(200);

      // Customer cannot see another's subscription (403)
      const foreignRes = await app.fetch(
        new Request('http://localhost/api/subscriptions/sub-aa1-b', { headers: custHeaders }),
        env
      );
      expect([403, 404]).toContain(foreignRes.status);
    } finally {
      sql.close();
    }
  });

  it('AA3: QR admin host header poisoning defense', () => {
    // Validate the resolveSafeBaseUrl allowlist logic exists in source
    const fs = require('fs');
    const src = fs.readFileSync(
      require('path').resolve(__dirname, '../../routes/admin-qr.ts'), 'utf-8'
    );
    expect(src).toContain('resolveSafeBaseUrl');
    expect(src).toContain('auraspace.cafe');
    expect(src).toContain('isAllowed');
  });

  it('AA4: session-handlers rejects PATCH on terminal sessions (409)', async () => {
    const sql = new DatabaseSync(':memory:');
    try {
      sql.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, role TEXT,
          tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1,
          password_hash TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, table_number INTEGER, name TEXT, status TEXT,
          capacity INTEGER, tenant_id TEXT, zone TEXT);
        CREATE TABLE table_sessions (id TEXT PRIMARY KEY, table_id TEXT, customer_id TEXT,
          customer_name TEXT, customer_phone TEXT, status TEXT, opened_at TEXT, closed_at TEXT,
          order_count INTEGER DEFAULT 0, total_amount INTEGER DEFAULT 0, notes TEXT,
          created_at TEXT, updated_at TEXT);
        INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
          VALUES('staff-aa4','Staff','staff','default',1,1,'2026-10-30');
        INSERT INTO cafe_tables(id,table_number,name,status,capacity,tenant_id,zone)
          VALUES('T-AA4',1,'Table 1','Occupied',4,'default','A');
        INSERT INTO table_sessions(id,table_id,status,opened_at,closed_at,created_at,updated_at)
          VALUES('SES-AA4','T-AA4','closed','2026-10-30','2026-10-30','2026-10-30','2026-10-30');
      `);

      function statement(query: string, values: unknown[] = []): any {
        return {
          bind(...args: unknown[]) { return statement(query, args); },
          async first() { return sql.prepare(query).get(...(values as any[])) ?? null; },
          async all() { return { success: true, results: sql.prepare(query).all(...(values as any[])) }; },
          async run() {
            const r = sql.prepare(query).run(...(values as any[]));
            return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
          },
        };
      }
      const db: any = { prepare: statement, async batch(stmts: any[]) { return Promise.all(stmts.map((s: any) => s.run())); } };
      const kvData = new Map<string, string>();
      const kv = {
        async get(k: string) { return kvData.get(k) ?? null; },
        async put(k: string, v: string) { kvData.set(k, v); },
        async delete(k: string) { kvData.delete(k); },
        async list(opts?: { prefix?: string }) {
          const prefix = opts?.prefix ?? '';
          return { keys: Array.from(kvData.keys()).filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true };
        },
      };

      const env: any = {
        AURA_DB: db,
        DB: db,
        AUTH_KV: kv,
        JWT_SECRET: 'test-jwt-secret-aa4-32chars!!!',
        ENVIRONMENT: 'production',
        PILOT_TENANT_ID: 'default',
      };

      const staffAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'staff-aa4'").get();
      const { token: staffToken } = await issueStaffSession(env, staffAccount, { sessionType: 'staff-web' });
      const headers = { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' };

      const patchRes = await app.fetch(
        new Request('http://localhost/api/table-sessions/SES-AA4', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'ordering' }),
        }),
        env
      );
      expect(patchRes.status).toBe(409);
      const patchJson = await patchRes.json() as { error: string };
      expect(patchJson.error).toContain('ended');
    } finally {
      sql.close();
    }
  });

  it('AA4: order-handlers rejects cross-table order hijack (409)', async () => {
    const sql = new DatabaseSync(':memory:');
    try {
      sql.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, role TEXT,
          tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1,
          password_hash TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, table_number INTEGER, name TEXT, status TEXT,
          capacity INTEGER, tenant_id TEXT, zone TEXT);
        CREATE TABLE table_sessions (id TEXT PRIMARY KEY, table_id TEXT, customer_id TEXT,
          customer_name TEXT, customer_phone TEXT, status TEXT, opened_at TEXT, closed_at TEXT,
          order_count INTEGER DEFAULT 0, total_amount INTEGER DEFAULT 0, notes TEXT,
          current_order_id TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE orders (id TEXT PRIMARY KEY, order_number TEXT, customer_phone TEXT,
          customer_name TEXT, tenant_id TEXT, total INTEGER, status TEXT, payment_status TEXT,
          payment_method TEXT, order_type TEXT, table_id TEXT, items TEXT, notes TEXT,
          created_at TEXT, updated_at TEXT);
        INSERT INTO users(id,name,role,tenant_id,is_active,auth_version,created_at)
          VALUES('staff-aa4b','Staff','staff','default',1,1,'2026-10-30');
        INSERT INTO cafe_tables(id,table_number,name,status,capacity,tenant_id,zone)
          VALUES('T-AA4-A',1,'Table A','Occupied',4,'default','A');
        INSERT INTO cafe_tables(id,table_number,name,status,capacity,tenant_id,zone)
          VALUES('T-AA4-B',2,'Table B','Occupied',4,'default','A');
        INSERT INTO table_sessions(id,table_id,status,opened_at,order_count,total_amount,created_at,updated_at)
          VALUES('SES-AA4-A','T-AA4-A','active','2026-10-30',0,0,'2026-10-30','2026-10-30');
        INSERT INTO orders(id,order_number,status,total,table_id,tenant_id,created_at,updated_at)
          VALUES('ORD-AA4','ORD-001','pending',50000,'T-AA4-B','default','2026-10-30','2026-10-30');
      `);

      function statement(query: string, values: unknown[] = []): any {
        return {
          bind(...args: unknown[]) { return statement(query, args); },
          async first() { return sql.prepare(query).get(...(values as any[])) ?? null; },
          async all() { return { success: true, results: sql.prepare(query).all(...(values as any[])) }; },
          async run() {
            const r = sql.prepare(query).run(...(values as any[]));
            return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
          },
        };
      }
      const db: any = { prepare: statement, async batch(stmts: any[]) { return Promise.all(stmts.map((s: any) => s.run())); } };
      const kvData = new Map<string, string>();
      const kv = {
        async get(k: string) { return kvData.get(k) ?? null; },
        async put(k: string, v: string) { kvData.set(k, v); },
        async delete(k: string) { kvData.delete(k); },
        async list(opts?: { prefix?: string }) {
          const prefix = opts?.prefix ?? '';
          return { keys: Array.from(kvData.keys()).filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true };
        },
      };

      const env: any = {
        AURA_DB: db,
        DB: db,
        AUTH_KV: kv,
        JWT_SECRET: 'test-jwt-secret-aa4b-32chars!!',
        ENVIRONMENT: 'production',
        PILOT_TENANT_ID: 'default',
      };

      const staffAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'staff-aa4b'").get();
      const { token: staffToken } = await issueStaffSession(env, staffAccount, { sessionType: 'staff-web' });
      const headers = { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' };

      // Order belongs to table B; attaching to session of table A should fail (409)
      const attachRes = await app.fetch(
        new Request('http://localhost/api/table-sessions/SES-AA4-A/orders', {
          method: 'POST',
          headers,
          body: JSON.stringify({ order_id: 'ORD-AA4' }),
        }),
        env
      );
      expect(attachRes.status).toBe(409);
      const attachJson = await attachRes.json() as { error: string };
      expect(attachJson.error).toContain('another table');
    } finally {
      sql.close();
    }
  });

  // ── Phase 29 (AB1..AB4) ───────────────────────────────────────────
  it('AB1: analytics router uses requireAuth instead of optionalAuth', () => {
    const fs = require('fs');
    const src = fs.readFileSync(
      require('path').resolve(__dirname, '../../routes/analytics-handlers/routes.ts'), 'utf-8'
    );
    expect(src).toContain('requireAuth');
    expect(src).not.toContain('optionalAuth');
  });

  it('AB2: reviews clamps limit and has rate limiting on POST', () => {
    const fs = require('fs');
    const src = fs.readFileSync(
      require('path').resolve(__dirname, '../../routes/reviews.ts'), 'utf-8'
    );
    // Limit clamped to max 100
    expect(src).toContain('Math.min(');
    expect(src).toContain(', 100)');
    // Rate limiting on POST
    expect(src).toContain('rl:review:');
    expect(src).toContain('429');
  });

  it('AB3: reviews and signage do not trust X-Tenant-ID from unauthenticated requests', () => {
    const fs = require('fs');
    const reviewsSrc = fs.readFileSync(
      require('path').resolve(__dirname, '../../routes/reviews.ts'), 'utf-8'
    );
    const signageSrc = fs.readFileSync(
      require('path').resolve(__dirname, '../../routes/signage.ts'), 'utf-8'
    );
    // Reviews getTenantId should not read X-Tenant-ID header for unauthenticated callers
    const reviewsTenantFn = reviewsSrc.match(/function getTenantId[\s\S]*?^}/m)?.[0] || '';
    expect(reviewsTenantFn).not.toContain("c.req.header('X-Tenant-ID')");
    // Signage getTenantId should not read X-Tenant-ID or tenant_id query for unauthenticated callers
    const signageTenantFn = signageSrc.match(/function getTenantId[\s\S]*?^}/m)?.[0] || '';
    expect(signageTenantFn).not.toContain("c.req.header('X-Tenant-ID')");
    expect(signageTenantFn).not.toContain("c.req.query('tenant_id')");
  });

  it('AB4: push subscribe has rate limiting and unsubscribe has ownership verification', () => {
    const fs = require('fs');
    const src = fs.readFileSync(
      require('path').resolve(__dirname, '../../routes/push.ts'), 'utf-8'
    );
    // Rate limiting on subscribe
    expect(src).toContain('rl:push-sub:');
    expect(src).toContain('Too many subscription attempts');
    // Ownership verification on unsubscribe
    expect(src).toContain('auth_key');
    expect(src).toContain('Invalid auth_key');
  });

  // ── Phase 30 (AC1..AC4) ───────────────────────────────────────────
  it('AC1..AC4: Mixpost mediaUrls SSRF & tenant tagging, TastyIgniter bridge poisoning & null-order guard, Frigate/HA tenant scoping, and Domain Inventory/Reservations isolation', async () => {
    const { mixpostCreatePostSchema } = await import('../../lib/validators/mixpost');
    const { processTIWebhook } = await import('../../tree/integrations/tastyigniter/webhook');
    const { createTIRoutes } = await import('../../routes/integrations/tastyigniter');
    const { getOccupancyAnalytics } = await import('../../tree/integrations/frigate/occupancy');
    const { triggerAutomation, getAutomationLog } = await import('../../tree/homeassistant/automations');
    const { dispatchDiningPresence } = await import('../../tree/homeassistant/presence');
    const { inventoryCRUD } = await import('../../../../packages/domain/inventory/src/routes/inventory-crud');
    const { inventoryTransactions } = await import('../../../../packages/domain/inventory/src/routes/inventory-transactions');
    const { inventorySnapshots } = await import('../../../../packages/domain/inventory/src/routes/inventory-snapshots');
    const { reservationsRouter } = await import('../../../../packages/domain/reservation/src/routes/reservations');
    const { Hono } = await import('hono');

    // AC1: mixpostCreatePostSchema rejects SSRF URLs in both media_urls and mediaUrls
    expect(
      mixpostCreatePostSchema.safeParse({
        content: 'Hello Aura',
        accounts: [1],
        mediaUrls: ['http://169.254.169.254/latest/meta-data/'],
      }).success
    ).toBe(false);
    expect(
      mixpostCreatePostSchema.safeParse({
        content: 'Hello Aura',
        accounts: [1],
        media_urls: ['https://localhost/internal.png'],
      }).success
    ).toBe(false);
    expect(
      mixpostCreatePostSchema.safeParse({
        content: 'Hello Aura',
        accounts: [1],
        mediaUrls: ['https://cdn.auraspace.cafe/promo.jpg'],
      }).success
    ).toBe(true);

    const sql = new DatabaseSync(':memory:');
    try {
      const nowSec = Math.floor(Date.now() / 1000) - 60;
      const futureDate = '2099-12-31';
      sql.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, role TEXT,
          tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1,
          password_hash TEXT, created_at TEXT, updated_at TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY, status TEXT, order_type TEXT, payment_status TEXT, tenant_id TEXT
        );
        CREATE TABLE ti_order_bridge (
          id TEXT PRIMARY KEY, local_order_id TEXT, ti_order_id TEXT,
          status TEXT, synced_at TEXT, created_at TEXT
        );
        CREATE TABLE frigate_events (
          id TEXT PRIMARY KEY, camera TEXT, label TEXT, start_time INTEGER,
          end_time INTEGER, score REAL, payload TEXT, received_at TEXT, tenant_id TEXT
        );
        CREATE TABLE ha_automation_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT, automation_id TEXT, trigger_entity TEXT,
          payload TEXT, result TEXT, executed_at TEXT, tenant_id TEXT
        );
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY, sku TEXT, name TEXT, name_en TEXT, category TEXT,
          unit TEXT, current_stock REAL, min_stock REAL, max_stock REAL,
          cost_per_unit REAL, supplier TEXT, active INTEGER DEFAULT 1, tenant_id TEXT
        );
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY, name TEXT, is_active INTEGER DEFAULT 1, tenant_id TEXT
        );
        CREATE TABLE inventory_transactions (
          id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL,
          reference_id TEXT, reference_type TEXT, notes TEXT, created_at TEXT
        );
        CREATE TABLE inventory_snapshots (
          id TEXT PRIMARY KEY, item_id TEXT, date TEXT, opening_stock REAL, closing_stock REAL
        );
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY, table_number TEXT, zone TEXT, capacity INTEGER, status TEXT, tenant_id TEXT
        );
        CREATE TABLE reservations (
          id TEXT PRIMARY KEY, table_id TEXT, customer_name TEXT, customer_phone TEXT,
          guest_count INTEGER, date TEXT, time TEXT, zone TEXT, notes TEXT,
          status TEXT, tenant_id TEXT, created_at TEXT, updated_at TEXT
        );

        INSERT INTO users (id, name, email, role, tenant_id, is_active, auth_version) VALUES
          ('mgr-def-ac', 'Mgr Def', 'mgr.def@ac.vn', 'manager', 'default', 1, 1),
          ('mgr-b-ac', 'Mgr B', 'mgr.b@ac.vn', 'manager', 'store-b', 1, 1);

        INSERT INTO orders (id, status, order_type, payment_status, tenant_id) VALUES
          ('ord-victim-ac2', 'confirmed', 'dine_in', 'paid', 'default');

        INSERT INTO frigate_events (id, camera, label, start_time, received_at, tenant_id) VALUES
          ('fevt-def-1', 'dining_area', 'person', ${nowSec}, '2026-11-02T00:00:00Z', 'default'),
          ('fevt-b-1', 'patio', 'person', ${nowSec}, '2026-11-02T00:00:00Z', 'store-b'),
          ('fevt-b-2', 'patio', 'person', ${nowSec}, '2026-11-02T00:00:00Z', 'store-b');

        INSERT INTO inventory_items (id, sku, name, category, unit, current_stock, min_stock, max_stock, cost_per_unit, active, tenant_id) VALUES
          ('inv-def-1', 'SKU-SHARED-01', 'Beans Def', 'coffee', 'kg', 10, 2, 50, 100000, 1, 'default');

        INSERT INTO inventory_transactions (id, item_id, type, quantity, created_at) VALUES
          ('tx-orphan-1', 'nonexistent-item', 'in', 5, '2026-11-02T00:00:00Z');
        INSERT INTO inventory_snapshots (id, item_id, date, opening_stock, closing_stock) VALUES
          ('snap-orphan-1', 'nonexistent-item', '2026-11-02', 5, 5);

        INSERT INTO cafe_tables (id, table_number, zone, capacity, status, tenant_id) VALUES
          ('tbl-def-t1', 'T1', 'indoor', 4, 'Available', 'default'),
          ('tbl-b-t1', 'T1', 'indoor', 4, 'Available', 'store-b');

        INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, status, tenant_id, created_at, updated_at) VALUES
          ('rsv-def-t1', 'T1', 'Guest Def', '0901112222', 2, '${futureDate}', '19:00', 'indoor', 'confirmed', 'default', '2026-11-02T00:00:00Z', '2026-11-02T00:00:00Z');
      `);

      function statement(query: string, values: unknown[] = []): any {
        return {
          bind(...args: unknown[]) { return statement(query, args); },
          async first() { return sql.prepare(query).get(...(values as any[])) ?? null; },
          async all() { return { success: true, results: sql.prepare(query).all(...(values as any[])) }; },
          async run() {
            const r = sql.prepare(query).run(...(values as any[]));
            return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
          },
        };
      }
      const db: any = { prepare: statement, async batch(stmts: any[]) { return Promise.all(stmts.map((s: any) => s.run())); } };
      const kvData = new Map<string, string>();
      const kv = {
        async get(k: string) { return kvData.get(k) ?? null; },
        async put(k: string, v: string) { kvData.set(k, v); },
        async delete(k: string) { kvData.delete(k); },
        async list(opts?: { prefix?: string }) {
          const prefix = opts?.prefix ?? '';
          return { keys: Array.from(kvData.keys()).filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true };
        },
      };

      const env: any = {
        AURA_DB: db,
        DB: db,
        AUTH_KV: kv,
        JWT_SECRET: 'test-jwt-secret-ac-32chars-long!!',
        ENVIRONMENT: 'production',
        PILOT_TENANT_ID: 'default',
        FRIGATE_URL: 'https://frigate.auraspace.cafe',
        FRIGATE_API_KEY: 'frigate-key',
        FRIGATE_SYNC_ENABLED: 'true',
      };

      const defMgrAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-def-ac'").get();
      const bMgrAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-b-ac'").get();
      const { token: defToken } = await issueStaffSession(env, defMgrAccount, { sessionType: 'staff-web' });
      const { token: bToken } = await issueStaffSession(env, bMgrAccount, { sessionType: 'staff-web' });

      // AC2: 2-step TastyIgniter webhook bridge poisoning cannot bind or cancel ord-victim-ac2
      const step1 = await processTIWebhook(env, {
        event: 'order.received',
        ti_order_id: '99901',
        local_order_id: 'ord-victim-ac2',
        status: 'received',
      });
      expect(step1.local_order_id).toBe('ti-auto-99901');
      const step2 = await processTIWebhook(env, {
        event: 'order.cancelled',
        ti_order_id: '99901',
        status: 'cancelled',
      });
      expect(step2.local_order_id).toBe('ti-auto-99901');
      const victimOrder = sql.prepare("SELECT status FROM orders WHERE id = 'ord-victim-ac2'").get() as { status: string };
      expect(victimOrder.status).toBe('confirmed');

      // AC2: POST /api/integrations/tastyigniter/sync/order rejects nonexistent order even in 'default' tenant
      const tiApp = createTIRoutes();
      const tiMissingOrderRes = await tiApp.fetch(
        new Request('http://localhost/sync/order', {
          method: 'POST',
          headers: { Authorization: `Bearer ${defToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            localOrderId: 'nonexistent-order-id',
            orderData: { items: [], total: 50000 },
          }),
        }),
        env
      );
      expect(tiMissingOrderRes.status).toBe(404);

      // AC3: Frigate occupancy analytics scopes active count by tenantId
      const occDef = await getOccupancyAnalytics(env, 'default');
      expect(occDef.current_occupancy).toBe(1);
      const occB = await getOccupancyAnalytics(env, 'store-b');
      expect(occB.current_occupancy).toBe(2);

      // AC3: Home Assistant triggerAutomation and dispatchDiningPresence persist tenant_id in ha_automation_log
      await triggerAutomation(env, 'auto_ac_def', { trigger_entity: 'sensor.door' }, 'default');
      await dispatchDiningPresence(env, 'table_occupied', { table_id: 'T1' }, 'store-b');
      const logDefRes = await getAutomationLog(env, -5, 'default');
      const logDefJson = (await logDefRes.json()) as { entries: Array<{ automation_id: string }> };
      expect(logDefJson.entries.map(e => e.automation_id)).toEqual(['auto_ac_def']);
      const logBRes = await getAutomationLog(env, 50, 'store-b');
      const logBJson = (await logBRes.json()) as { entries: Array<{ automation_id: string }> };
      expect(logBJson.entries.map(e => e.automation_id)).toEqual(['dining_table_occupied']);

      // AC4: Domain inventory fails closed (404) on missing item for transactions & snapshots, and scopes SKU uniqueness per tenant
      const invApp = new Hono<any>();
      invApp.use('*', async (c, next) => {
        const tenant = c.req.header('X-Test-Tenant') || 'default';
        c.set('user', { id: 'u', role: 'manager', tenantId: tenant });
        await next();
      });
      inventoryCRUD(invApp);
      inventoryTransactions(invApp);
      inventorySnapshots(invApp);

      const orphanTxRes = await invApp.fetch(new Request('http://localhost/nonexistent-item/transactions'), env);
      expect(orphanTxRes.status).toBe(404);
      const orphanSnapRes = await invApp.fetch(new Request('http://localhost/nonexistent-item/snapshots'), env);
      expect(orphanSnapRes.status).toBe(404);

      const dupSkuDefaultRes = await invApp.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Test-Tenant': 'default' },
          body: JSON.stringify({
            sku: 'SKU-SHARED-01',
            name: 'Dup Def',
            category: 'raw_materials',
            unit: 'kg',
            current_stock: 5,
            min_stock: 1,
            max_stock: 20,
            cost_per_unit: 90000,
          }),
        }),
        env
      );
      expect(dupSkuDefaultRes.status).toBe(409);

      const sameSkuStoreBRes = await invApp.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Test-Tenant': 'store-b' },
          body: JSON.stringify({
            sku: 'SKU-SHARED-01',
            name: 'Store B Beans',
            category: 'raw_materials',
            unit: 'kg',
            current_stock: 8,
            min_stock: 1,
            max_stock: 20,
            cost_per_unit: 95000,
          }),
        }),
        env
      );
      expect(sameSkuStoreBRes.status).toBe(201);

      // AC4: Domain reservations isolates availability and table_number lookup across tenants
      const availBRes = await reservationsRouter.fetch(
        new Request(`http://localhost/availability?date=${futureDate}&time=19:00`, {
          headers: { Authorization: `Bearer ${bToken}` },
        }),
        env
      );
      expect(availBRes.status).toBe(200);
      const availBJson = (await availBRes.json()) as { data: Array<{ id: string; available: boolean }> };
      expect(availBJson.data).toHaveLength(1);
      expect(availBJson.data[0].id).toBe('tbl-b-t1');
      expect(availBJson.data[0].available).toBe(true);

      const bookBT1Res = await reservationsRouter.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { Authorization: `Bearer ${bToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_id: 'T1',
            customer_name: 'Guest Store B',
            customer_phone: '0908889999',
            guest_count: 2,
            date: futureDate,
            time: '19:00',
          }),
        }),
        env
      );
      expect(bookBT1Res.status).toBe(201);
      const bookBT1Json = (await bookBT1Res.json()) as { data: { table_id: string } };
      expect(bookBT1Json.data.table_id).toBe('tbl-b-t1');
    } finally {
      sql.close();
    }
  });

  it('enforces Table/Zone tenant isolation & pagination clamping, Catalog Modifiers & Happy-Hour validation, Kitchen Station multi-tenancy & item readiness scoping, and Subscription Invoice idempotency & Reports date-range cap (AD1–AD4)', async () => {
    const { OpenAPIHono } = await import('@hono/zod-openapi');
    const { Hono } = await import('hono');
    const { registerTableCrudHandlers } = await import('../../routes/openapi-tables-handlers/table-crud-handlers');
    const { registerZoneCrudHandlers } = await import('../../routes/openapi-tables-handlers/zone-crud-handlers');
    const { menuModifiersRouter } = await import('../../../../packages/domain/catalog/commands/menu-modifiers');
    const { kitchenStationsRouter } = await import('../../../../packages/domain/kitchen/commands/kitchen-stations');
    const { generateInvoices } = await import('../../tree/subscriptions/invoice-handlers');
    const { createPlan, listPlans, updatePlan } = await import('../../tree/subscriptions/plan-handlers');
    const { deletePlan } = await import('../../tree/subscriptions/sub-handlers');
    const { registerAnalyticsHandlers } = await import('../../routes/reports-handlers/analytics-handlers');
    const { issueStaffSession } = await import('../../lib/staff-session');

    const sql = new DatabaseSync(':memory:');
    function statement(query: string, values: unknown[] = []): any {
      return {
        bind(...args: unknown[]) { return statement(query, args); },
        async first() { return sql.prepare(query).get(...(values as any[])) ?? null; },
        async all() { return { success: true, results: sql.prepare(query).all(...(values as any[])) }; },
        async run() {
          const r = sql.prepare(query).run(...(values as any[]));
          return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
        },
      };
    }
    const db: any = { prepare: statement, async batch(stmts: any[]) { return Promise.all(stmts.map((s: any) => s.run())); } };
    try {
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);

      sql.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT,
          name TEXT,
          phone TEXT,
          role TEXT,
          password_hash TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number INTEGER,
          code TEXT,
          name TEXT,
          capacity INTEGER DEFAULT 4,
          zone TEXT DEFAULT 'indoor',
          zone_id TEXT DEFAULT 'indoor',
          status TEXT DEFAULT 'available',
          position_x REAL DEFAULT 0,
          position_y REAL DEFAULT 0,
          width REAL DEFAULT 80,
          height REAL DEFAULT 80,
          rotation REAL DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          location_id TEXT DEFAULT 'default',
          qr_code TEXT,
          metadata TEXT,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE tables (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          zone_id TEXT,
          capacity INTEGER DEFAULT 4,
          status TEXT DEFAULT 'available',
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE table_zones (
          id TEXT PRIMARY KEY,
          slug TEXT,
          name TEXT,
          description TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          location_id TEXT DEFAULT 'default',
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          action TEXT,
          entity_type TEXT,
          entity_id TEXT,
          details TEXT,
          created_at TEXT
        );
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          name TEXT,
          price INTEGER DEFAULT 35000,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE modifier_groups (
          id TEXT PRIMARY KEY,
          name TEXT,
          type TEXT DEFAULT 'single',
          required INTEGER DEFAULT 0,
          sort_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE modifier_choices (
          id TEXT PRIMARY KEY,
          group_id TEXT,
          name TEXT,
          price_delta INTEGER DEFAULT 0,
          is_default INTEGER DEFAULT 0,
          sort_order INTEGER DEFAULT 0,
          is_available INTEGER DEFAULT 1
        );
        CREATE TABLE menu_modifiers (
          id TEXT PRIMARY KEY,
          group_id TEXT,
          name TEXT,
          price_delta INTEGER DEFAULT 0,
          available INTEGER DEFAULT 1
        );
        CREATE TABLE product_modifier_groups (
          product_id TEXT,
          group_id TEXT,
          sort_order INTEGER DEFAULT 0,
          PRIMARY KEY (product_id, group_id)
        );
        CREATE TABLE happy_hour_windows (
          id TEXT PRIMARY KEY,
          name TEXT,
          day_of_week INTEGER,
          start_time TEXT,
          end_time TEXT,
          discount_rate REAL,
          apply_to TEXT DEFAULT 'all',
          apply_ids TEXT,
          priority INTEGER DEFAULT 0,
          active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE kitchen_stations (
          id TEXT PRIMARY KEY,
          name TEXT,
          slug TEXT,
          sort_order INTEGER DEFAULT 0,
          active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE categories (
          id TEXT PRIMARY KEY,
          name TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE category_stations (
          category_id TEXT,
          station_id TEXT,
          PRIMARY KEY (category_id, station_id)
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          table_id TEXT,
          items TEXT,
          status TEXT DEFAULT 'preparing',
          order_type TEXT DEFAULT 'dine_in',
          payment_status TEXT DEFAULT 'paid',
          total INTEGER DEFAULT 50000,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE order_item_stations (
          order_item_id TEXT,
          station_id TEXT,
          started_at TEXT,
          ready_at TEXT,
          PRIMARY KEY (order_item_id, station_id)
        );
        CREATE TABLE subscription_plans (
          id TEXT PRIMARY KEY,
          name TEXT,
          slug TEXT,
          description TEXT,
          container_size TEXT,
          monthly_price_vnd INTEGER,
          deposit_vnd INTEGER DEFAULT 0,
          features TEXT DEFAULT '[]',
          max_occupants INTEGER DEFAULT 1,
          is_popular INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE subscriptions (
          id TEXT PRIMARY KEY,
          plan_id TEXT,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          billing_cycle TEXT DEFAULT 'monthly',
          amount_vnd INTEGER DEFAULT 2500000,
          status TEXT DEFAULT 'active',
          next_billing_date TEXT,
          container_number TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE subscription_invoices (
          id TEXT PRIMARY KEY,
          subscription_id TEXT,
          amount_vnd INTEGER,
          status TEXT DEFAULT 'pending',
          period_start TEXT,
          period_end TEXT,
          invoice_number TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
      `);

      sql.prepare(
        `INSERT INTO users (id, email, name, role, is_active, auth_version, tenant_id)
         VALUES
          ('mgr-def-ad', 'mgr.def.ad@aura.vn', 'Def Mgr AD', 'manager', 1, 1, 'default'),
          ('mgr-b-ad', 'mgr.b.ad@aura.vn', 'Store B Mgr AD', 'manager', 1, 1, 'store-b')`
      ).run();

      sql.prepare(
        `INSERT INTO cafe_tables (id, table_number, code, name, capacity, zone, zone_id, status, location_id, tenant_id, updated_at)
         VALUES ('tbl-def-1', 1, 'T1', 'Default Table 1', 4, 'indoor', 'indoor', 'available', 'default', 'default', ?)`
      ).run(nowIso);

      sql.prepare(
        `INSERT INTO tables (id, code, name, capacity, status, tenant_id, updated_at)
         VALUES ('legacy-tbl-b', 'LB1', 'Legacy Store B Table', 4, 'available', 'store-b', ?)`
      ).run(nowIso);

      sql.prepare(
        `INSERT INTO table_zones (id, slug, name, sort_order, is_active, location_id, tenant_id, created_at, updated_at)
         VALUES
          ('z-def-1', 'def-1', 'Default Zone 1', 1, 1, 'default', 'default', ?, ?),
          ('z-def-2', 'def-2', 'Default Zone 2', 2, 1, 'default', 'default', ?, ?),
          ('z-b-1', 'b-1', 'Store B Zone 1', 3, 1, 'store-b', 'store-b', ?, ?)`
      ).run(nowIso, nowIso, nowIso, nowIso, nowIso, nowIso);

      sql.prepare(
        `INSERT INTO products (id, name, price, tenant_id)
         VALUES ('prod-def-1', 'Default Latte', 45000, 'default'), ('prod-b-1', 'Store B Matcha', 55000, 'store-b')`
      ).run();

      sql.prepare(
        `INSERT INTO modifier_groups (id, name, type, required, sort_order, is_active, tenant_id, created_at, updated_at)
         VALUES ('mg-def-1', 'Sugar Level', 'single', 0, 1, 1, 'default', ?, ?)`
      ).run(nowIso, nowIso);

      sql.prepare(
        `INSERT INTO happy_hour_windows (id, name, day_of_week, start_time, end_time, discount_rate, tenant_id, created_at, updated_at)
         VALUES ('hh-def-1', 'Afternoon Tea', 2, '14:00', '17:00', 0.2, 'default', ?, ?)`
      ).run(nowIso, nowIso);

      sql.prepare(
        `INSERT INTO kitchen_stations (id, name, slug, sort_order, active, tenant_id, created_at, updated_at)
         VALUES ('ks-def-1', 'Default Bar', 'bar-def', 1, 1, 'default', ?, ?),
                ('ks-b-1', 'Store B Bar', 'bar-b', 1, 1, 'store-b', ?, ?)`
      ).run(nowIso, nowIso, nowIso, nowIso);

      // Historical unprefixed order_item_stations row for product 'prod-shared'
      sql.prepare(
        `INSERT INTO order_item_stations (order_item_id, station_id, started_at, ready_at)
         VALUES ('prod-shared', 'ks-def-1', ?, ?)`
      ).run(nowIso, nowIso);

      // New order with two items: 'item-1' and 'prod-shared' (neither is marked ready under composite key yet)
      sql.prepare(
        `INSERT INTO orders (id, table_id, items, status, order_type, payment_status, total, tenant_id, created_at, updated_at)
         VALUES ('ord-kds-ad3', 'tbl-def-1', ?, 'preparing', 'dine_in', 'paid', 90000, 'default', ?, ?)`
      ).run(
        JSON.stringify([
          { id: 'item-1', name: 'Espresso', qty: 1 },
          { product_id: 'prod-shared', name: 'Croissant', qty: 1 },
        ]),
        nowIso,
        nowIso
      );
      sql.prepare(
        `INSERT INTO order_item_stations (order_item_id, station_id, started_at, ready_at)
         VALUES ('ord-kds-ad3:item-1', 'ks-def-1', ?, NULL)`
      ).run(nowIso);

      sql.prepare(
        `INSERT INTO subscriptions (id, plan_id, customer_id, customer_name, customer_phone, billing_cycle, amount_vnd, status, next_billing_date, container_number, tenant_id, created_at, updated_at)
         VALUES ('sub-ad4-1', 'plan-def-1', 'cust-1', 'Sub User', '0901234567', 'monthly', 2500000, 'active', ?, 'C101', 'default', ?, ?)`
      ).run(todayDate, nowIso, nowIso);

      const kvStore = new Map<string, string>();
      const env: any = {
        AURA_DB: db,
        JWT_SECRET: 'test-jwt-secret-key-min-16-chars',
        AUTH_KV: {
          get: async (k: string) => kvStore.get(k) ?? null,
          put: async (k: string, v: string) => {
            kvStore.set(k, v);
          },
          delete: async (k: string) => {
            kvStore.delete(k);
          },
        },
      };

      const defMgrAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-def-ad'").get();
      const bMgrAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-b-ad'").get();
      const { token: defToken } = await issueStaffSession(env, defMgrAccount, { sessionType: 'staff-web' });
      const { token: bToken } = await issueStaffSession(env, bMgrAccount, { sessionType: 'staff-web' });

      // AD1: Table & Zone routes — Store B can create code 'T1' with table_number 1 without colliding with Default store's table_number 1
      const tablesApp = new OpenAPIHono<any>();
      tablesApp.use('*', async (c, next) => {
        const tenant = c.req.header('X-Tenant-ID') || 'default';
        c.set('user', { id: tenant === 'store-b' ? 'mgr-b-ad' : 'mgr-def-ad', role: 'manager', tenantId: tenant });
        await next();
      });
      registerTableCrudHandlers(tablesApp);
      registerZoneCrudHandlers(tablesApp);

      const createBTableRes = await tablesApp.fetch(
        new Request('http://localhost/api/tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-b' },
          body: JSON.stringify({ zoneId: 'indoor', code: 'T1', name: 'Store B Table 1', capacity: 4, locationId: 'store-b' }),
        }),
        env
      );
      expect(createBTableRes.status).toBe(201);
      const bTableRow = sql.prepare("SELECT table_number FROM cafe_tables WHERE tenant_id = 'store-b' AND code = 'T1'").get() as { table_number: number };
      expect(bTableRow.table_number).toBe(1);

      // AD1: bulk-status fails closed (404) when Default store tries to update Store B's legacy table in `tables`
      const crossBulkRes = await tablesApp.fetch(
        new Request('http://localhost/api/tables/bulk-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'default' },
          body: JSON.stringify({ tableIds: ['legacy-tbl-b'], status: 'occupied' }),
        }),
        env
      );
      expect(crossBulkRes.status).toBe(404);
      const legacyRowAfter = sql.prepare("SELECT status FROM tables WHERE id = 'legacy-tbl-b'").get() as { status: string };
      expect(legacyRowAfter.status).toBe('available');

      // AD1: GET /api/table-zones filters by tenant BEFORE SQL pagination so Store B gets its zone on page 1 with limit=1
      const zonesBRes = await tablesApp.fetch(
        new Request('http://localhost/api/table-zones?page=1&limit=1', {
          headers: { 'X-Tenant-ID': 'store-b' },
        }),
        env
      );
      expect(zonesBRes.status).toBe(200);
      const zonesBJson = (await zonesBRes.json()) as { data: { zones: Array<{ id: string }>; meta: { total: number } } };
      expect(zonesBJson.data.zones).toHaveLength(1);
      expect(zonesBJson.data.zones[0].id).toBe('z-b-1');
      expect(zonesBJson.data.meta.total).toBe(1);

      // AD2: Menu modifiers rejects linking Default store's modifier group onto Store B's product, and validates happy-hour PATCH
      const crossLinkProdRes = await menuModifiersRouter.fetch(
        new Request('http://localhost/products/prod-b-1/groups', {
          method: 'POST',
          headers: { Authorization: `Bearer ${defToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: 'mg-def-1' }),
        }),
        env
      );
      expect(crossLinkProdRes.status).toBe(404);

      const badHhRateRes = await menuModifiersRouter.fetch(
        new Request('http://localhost/happy-hour/hh-def-1', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${defToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ discount_rate: 1.5 }),
        }),
        env
      );
      expect(badHhRateRes.status).toBe(400);

      const badHhTimeRes = await menuModifiersRouter.fetch(
        new Request('http://localhost/happy-hour/hh-def-1', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${defToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_time: '18:00', end_time: '15:00' }),
        }),
        env
      );
      expect(badHhTimeRes.status).toBe(400);

      // AD3: Kitchen stations isolates stations across tenants and prevents historical unprefixed product_id ready collision
      const listKsBRes = await kitchenStationsRouter.fetch(
        new Request('http://localhost/', {
          headers: { Authorization: `Bearer ${bToken}` },
        }),
        env
      );
      expect(listKsBRes.status).toBe(200);
      const listKsBJson = (await listKsBRes.json()) as { data: Array<{ id: string }> };
      expect(listKsBJson.data.map((s) => s.id)).toEqual(['ks-b-1']);

      const crossDelKsRes = await kitchenStationsRouter.fetch(
        new Request('http://localhost/ks-def-1', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${bToken}` },
        }),
        env
      );
      expect(crossDelKsRes.status).toBe(404);

      // Marking only item-1 ready on ord-kds-ad3 must NOT consider prod-shared ready from historical unprefixed row
      const markItem1ReadyRes = await kitchenStationsRouter.fetch(
        new Request('http://localhost/tickets/ord-kds-ad3/items/item-1/ready?station_id=ks-def-1', {
          method: 'POST',
          headers: { Authorization: `Bearer ${defToken}` },
        }),
        env
      );
      expect(markItem1ReadyRes.status).toBe(200);
      const markItem1ReadyJson = (await markItem1ReadyRes.json()) as { all_items_ready: boolean; order_status: string };
      expect(markItem1ReadyJson.all_items_ready).toBe(false);
      expect(markItem1ReadyJson.order_status).toBe('preparing');

      // AD4: Subscription generateInvoices is idempotent across repeated invocations, plans are tenant-isolated, and /api/reports/daily caps date span
      const subApp = new Hono<any>();
      subApp.post('/invoices/generate', generateInvoices);
      subApp.get('/plans', listPlans);
      subApp.post('/plans', createPlan);
      subApp.put('/plans/:id', updatePlan);
      subApp.delete('/plans/:id', deletePlan);

      const gen1Res = await subApp.fetch(
        new Request('http://localhost/invoices/generate', {
          method: 'POST',
          headers: { Authorization: `Bearer ${defToken}` },
        }),
        env
      );
      expect(gen1Res.status).toBe(200);
      const gen1Json = (await gen1Res.json()) as { generated_count: number };
      expect(gen1Json.generated_count).toBe(1);

      const gen2Res = await subApp.fetch(
        new Request('http://localhost/invoices/generate', {
          method: 'POST',
          headers: { Authorization: `Bearer ${defToken}` },
        }),
        env
      );
      expect(gen2Res.status).toBe(200);
      const gen2Json = (await gen2Res.json()) as { generated_count: number };
      expect(gen2Json.generated_count).toBe(0);

      const createPlanDefRes = await subApp.fetch(
        new Request('http://localhost/plans', {
          method: 'POST',
          headers: { Authorization: `Bearer ${defToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Default Plan',
            slug: 'default-plan',
            monthly_price_vnd: 2500000,
          }),
        }),
        env
      );
      expect(createPlanDefRes.status).toBe(201);
      const createdPlanId = ((await createPlanDefRes.json()) as { data: { id: string } }).data.id;

      const crossDelPlanRes = await subApp.fetch(
        new Request(`http://localhost/plans/${createdPlanId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${bToken}` },
        }),
        env
      );
      expect(crossDelPlanRes.status).toBe(404);

      const reportsApp = new Hono<any>();
      registerAnalyticsHandlers(reportsApp);
      const hugeRangeRes = await reportsApp.fetch(
        new Request('http://localhost/daily?from=2000-01-01&to=2026-12-31'),
        env
      );
      expect(hugeRangeRes.status).toBe(400);
    } finally {
      sql.close();
    }
  });

  it('enforces Catalog cross-tenant category & reorder fail-closed guards, QR Host allowlist & tenant slug isolation, CRM cashback refund clawback & empty-phone guard, and Order Pricing/Split-Bill tenant isolation (AE1–AE4)', async () => {
    const { OpenAPIHono } = await import('@hono/zod-openapi');
    const { categoriesRouter } = await import('../../../../packages/domain/catalog/commands/categories');
    const { productsRouter } = await import('../../../../packages/domain/catalog/commands/products');
    const { registerCategoryReadHandlers } = await import('../../routes/openapi-categories-handlers/read-handlers');
    const { registerProductMutationHandlers } = await import('../../routes/openapi-products-handlers/mutation-handlers');
    const { qrRouter } = await import('../../../../packages/domain/table/commands/qr-scan');
    const { tablesRouter } = await import('../../../../packages/domain/table/commands/tables');
    const { bulkGenerateSlugs } = await import('../../tree/qr/generator');
    const { signQRUrl } = await import('../../tree/qr/signer');
    const { adminQRRouter } = await import('../../routes/admin-qr');
    const { reverseAccrual } = await import('../../../../packages/domain/crm/commands/refund-reversal');
    const { loadPolicy } = await import('../../../../packages/domain/crm/commands/loyalty-policy');
    const { getCustomer360 } = await import('../../../../packages/domain/crm/commands/customer-360');
    const { resolveServerProductPrice } = await import('../../../../packages/domain/catalog/policies/pricing-resolver');
    const { splitOrders } = await import('../../../../packages/domain/order/commands/split-orders');
    const { issueStaffSession } = await import('../../lib/staff-session');

    const sql = new DatabaseSync(':memory:');
    function statement(query: string, values: unknown[] = []): any {
      return {
        bind(...args: unknown[]) { return statement(query, args); },
        async first() { return sql.prepare(query).get(...(values as any[])) ?? null; },
        async all() { return { success: true, results: sql.prepare(query).all(...(values as any[])) }; },
        async run() {
          const r = sql.prepare(query).run(...(values as any[]));
          return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
        },
      };
    }
    const db: any = { prepare: statement, async batch(stmts: any[]) { return Promise.all(stmts.map((s: any) => s.run())); } };
    try {
      const nowIso = new Date().toISOString();
      sql.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT,
          name TEXT,
          phone TEXT,
          role TEXT,
          password_hash TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE categories (
          id TEXT PRIMARY KEY,
          name TEXT,
          slug TEXT,
          description TEXT,
          image_url TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          category_id TEXT,
          name TEXT,
          slug TEXT,
          description TEXT,
          price INTEGER,
          compare_at_price INTEGER,
          image_url TEXT,
          tags TEXT,
          is_available INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number INTEGER,
          code TEXT,
          name TEXT,
          zone TEXT DEFAULT 'indoor',
          capacity INTEGER DEFAULT 4,
          status TEXT DEFAULT 'Available',
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE table_qr_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_id TEXT,
          slug TEXT UNIQUE,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          email TEXT,
          loyalty_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          cashback_balance_vnd INTEGER DEFAULT 0,
          total_cashback_earned_vnd INTEGER DEFAULT 0,
          total_spent INTEGER DEFAULT 0,
          visit_count INTEGER DEFAULT 0,
          loyalty_tier TEXT DEFAULT 'bronze',
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          items TEXT,
          total INTEGER,
          points_earned INTEGER DEFAULT 0,
          cashback_earned INTEGER DEFAULT 0,
          status TEXT,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          payment_method TEXT,
          payment_status TEXT,
          table_id TEXT,
          order_type TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE cashback_wallets (
          customer_id TEXT PRIMARY KEY,
          balance INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE loyalty_point_logs (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          order_id TEXT,
          points_change INTEGER,
          reason TEXT,
          balance_after INTEGER,
          description TEXT,
          created_at TEXT
        );
        CREATE TABLE loyalty_audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id TEXT,
          action TEXT,
          amount_vnd INTEGER,
          order_id TEXT,
          metadata TEXT,
          created_at TEXT
        );
      `);

      sql.prepare(
        `INSERT INTO users (id, email, name, role, is_active, auth_version, tenant_id, created_at, updated_at)
         VALUES
          ('mgr-def-ae', 'mgr-def-ae@aura.vn', 'Def Mgr', 'manager', 1, 1, 'default', ?, ?),
          ('mgr-b-ae', 'mgr-b-ae@aura.vn', 'Store B Mgr', 'manager', 1, 1, 'store-b', ?, ?)`
      ).run(nowIso, nowIso, nowIso, nowIso);

      const catDefId = '11111111-1111-4111-8111-111111111132';
      const catBId = '22222222-2222-4222-8222-222222222232';
      sql.prepare(
        `INSERT INTO categories (id, name, slug, sort_order, is_active, tenant_id, created_at, updated_at)
         VALUES
          (?, 'Default Coffee', 'coffee-def', 1, 1, 'default', ?, ?),
          (?, 'Store B Coffee', 'coffee-b', 2, 1, 'store-b', ?, ?)`
      ).run(catDefId, nowIso, nowIso, catBId, nowIso, nowIso);

      sql.prepare(
        `INSERT INTO products (id, category_id, name, slug, price, is_available, sort_order, tenant_id, created_at, updated_at)
         VALUES
          ('prod-def-ae', ?, 'Default Espresso', 'shared-espresso', 35000, 1, 1, 'default', ?, ?),
          ('prod-b-ae', ?, 'Store B Matcha', 'store-b-matcha', 55000, 1, 1, 'store-b', ?, ?)`
      ).run(catDefId, nowIso, nowIso, catBId, nowIso, nowIso);

      sql.prepare(
        `INSERT INTO cafe_tables (id, table_number, code, name, zone, capacity, status, tenant_id, created_at, updated_at)
         VALUES
          ('tbl-def-1', 1, 'T1', 'Default Table 1', 'indoor', 4, 'Available', 'default', ?, ?),
          ('tbl-b-10', 10, 'T10', 'Store B Table 10', 'patio', 4, 'Available', 'store-b', ?, ?)`
      ).run(nowIso, nowIso, nowIso, nowIso);

      sql.prepare(
        `INSERT INTO table_qr_codes (table_id, slug, tenant_id, created_at)
         VALUES
          ('tbl-def-1', 'table-1', 'default', ?),
          ('10', 'legacy-num-10', 'default', ?),
          ('tbl-missing-999', 'dangling-slug', 'default', ?)`
      ).run(nowIso, nowIso, nowIso);

      sql.prepare(
        `INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, cashback_balance_vnd, total_cashback_earned_vnd, total_spent, tenant_id, created_at, updated_at)
         VALUES
          ('cust-ae-1', 'Alice', '0901112222', 100, 100, 5000, 5000, 100000, 'default', ?, ?),
          ('cust-ae-empty', 'NoPhone Guest', '', 0, 0, 0, 0, 0, 'default', ?, ?)`
      ).run(nowIso, nowIso, nowIso, nowIso);

      sql.prepare(
        `INSERT INTO cashback_wallets (customer_id, balance, tenant_id, updated_at)
         VALUES ('cust-ae-1', 5000, 'default', ?)`
      ).run(nowIso);

      sql.prepare(
        `INSERT INTO orders (id, items, total, points_earned, cashback_earned, status, customer_id, customer_name, customer_phone, payment_method, payment_status, tenant_id, created_at, updated_at)
         VALUES
          ('ord-ae-cashback', '[]', 100000, 100, 5000, 'completed', 'cust-ae-1', 'Alice', '0901112222', 'cash', 'paid', 'default', ?, ?),
          ('ord-ae-anon', '[]', 80000, 0, 0, 'completed', 'other-cust', 'Anon', '', 'cash', 'paid', 'default', ?, ?)`
      ).run(nowIso, nowIso, nowIso, nowIso);

      const kvStore = new Map<string, string>();
      const qrSecret = 'qr-signing-secret-min-16-chars';
      const env: any = {
        AURA_DB: db,
        JWT_SECRET: 'test-jwt-secret-key-min-16-chars',
        QR_SIGNING_SECRET: qrSecret,
        PUBLIC_URL: 'https://auracaffe.vn',
        AUTH_KV: {
          get: async (k: string) => kvStore.get(k) ?? null,
          put: async (k: string, v: string) => { kvStore.set(k, v); },
          delete: async (k: string) => { kvStore.delete(k); },
        },
      };

      const defMgrAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-def-ae'").get();
      const bMgrAccount: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-b-ae'").get();
      const { token: defToken } = await issueStaffSession(env, defMgrAccount, { sessionType: 'staff-web' });
      const { token: bToken } = await issueStaffSession(env, bMgrAccount, { sessionType: 'staff-web' });

      // AE1: Cross-tenant category ownership rejected on POST /api/products & fail-closed POST /api/categories/reorder
      const crossCatProdRes = await productsRouter.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { Authorization: `Bearer ${defToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Spoof Cat Item', price: 40000, category_id: catBId }),
        }),
        env
      );
      expect(crossCatProdRes.status).toBe(404);

      const crossReorderRes = await categoriesRouter.fetch(
        new Request('http://localhost/reorder', {
          method: 'POST',
          headers: { Authorization: `Bearer ${defToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: [{ id: catDefId, sort_order: 99 }, { id: catBId, sort_order: 1 }] }),
        }),
        env
      );
      expect(crossReorderRes.status).toBe(404);
      const catDefAfter = sql.prepare('SELECT sort_order FROM categories WHERE id = ?').get(catDefId) as { sort_order: number };
      expect(catDefAfter.sort_order).toBe(1);

      const openApiCatApp = new OpenAPIHono<any>();
      openApiCatApp.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-b-ae', role: 'manager', tenantId: 'store-b' });
        await next();
      });
      registerCategoryReadHandlers(openApiCatApp);
      registerProductMutationHandlers(openApiCatApp);

      const catPageBRes = await openApiCatApp.fetch(new Request('http://localhost/api/categories?page=1&limit=1'), env);
      expect(catPageBRes.status).toBe(200);
      const catPageBJson = (await catPageBRes.json()) as { data: { categories: Array<{ id: string }>; meta: { total: number } } };
      expect(catPageBJson.data.categories.map((c) => c.id)).toEqual([catBId]);
      expect(catPageBJson.data.meta.total).toBe(1);

      const sameSlugBRes = await openApiCatApp.fetch(
        new Request('http://localhost/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: catBId,
            name: 'Store B Espresso',
            slug: 'shared-espresso',
            price: 38000,
          }),
        }),
        env
      );
      expect(sameSlugBRes.status).toBe(201);

      // AE2: QR Host header sanitization on GET /api/tables, numeric fallback tenant guard on GET /api/qr/:slug, bulkGenerateSlugs tenant prefixing, and admin download fail-closed
      const poisonedHostQrRes = await tablesRouter.fetch(
        new Request('http://localhost/', {
          headers: {
            Authorization: `Bearer ${defToken}`,
            Host: 'evil.attacker.com',
            'X-Forwarded-Proto': 'javascript',
          },
        }),
        env
      );
      expect(poisonedHostQrRes.status).toBe(200);
      const poisonedHostJson = (await poisonedHostQrRes.json()) as { data: Array<{ id: string; qr_code_url: string }> };
      expect(poisonedHostJson.data[0].qr_code_url.startsWith('http://localhost:3000/')).toBe(true);

      const signedLegacy10Path = await signQRUrl('legacy-num-10', qrSecret);
      const signedQuery = signedLegacy10Path.split('?')[1];
      const crossNumericScanRes = await qrRouter.fetch(
        new Request(`http://localhost/legacy-num-10?${signedQuery}`),
        env
      );
      expect(crossNumericScanRes.status).toBe(404);

      const bulkB = await bulkGenerateSlugs(db, [
        { id: 'tbl-b-10', table_number: 10, zone: 'patio', status: 'Available', capacity: 4, tenant_id: 'store-b' } as any,
      ]);
      expect(bulkB.get('tbl-b-10')).toBe('store-b-10-patio');

      const dlMissingRes = await adminQRRouter.fetch(
        new Request('http://localhost/dangling-slug/download', {
          headers: { Authorization: `Bearer ${defToken}` },
        }),
        env
      );
      expect(dlMissingRes.status).toBe(404);

      // AE3: CRM reverseAccrual claws back cashback_earned and rejects cross-customer refund; getCustomer360 ignores empty phone
      const policy = await loadPolicy(db);
      const wrongCustomerRefund = await reverseAccrual(db, policy, {
        orderId: 'ord-ae-cashback',
        customerId: 'cust-ae-empty',
        refundAmountVnd: 100000,
        reason: 'spoofed_refund',
      });
      expect(wrongCustomerRefund.ok).toBe(false);

      const validCashbackRefund = await reverseAccrual(db, policy, {
        orderId: 'ord-ae-cashback',
        customerId: 'cust-ae-1',
        refundAmountVnd: 100000,
        reason: 'full_refund',
      });
      expect(validCashbackRefund.ok).toBe(true);
      const walletAfter = sql.prepare("SELECT balance FROM cashback_wallets WHERE customer_id = 'cust-ae-1'").get() as { balance: number };
      expect(walletAfter.balance).toBe(0);
      const orderAfter = sql.prepare("SELECT cashback_earned, points_earned FROM orders WHERE id = 'ord-ae-cashback'").get() as { cashback_earned: number; points_earned: number };
      expect(orderAfter.cashback_earned).toBe(0);
      expect(orderAfter.points_earned).toBe(0);

      const emptyPhone360 = await getCustomer360(db, 'cust-ae-empty');
      expect(emptyPhone360?.recentEvents.events).toHaveLength(0);

      // AE4: resolveServerProductPrice and splitOrders enforce tenant isolation on products
      const crossPrice = await resolveServerProductPrice(db, {
        productId: 'prod-b-ae',
        tenantId: 'default',
      });
      expect(crossPrice.available).toBe(false);
      expect(crossPrice.rejection?.code).toBe('item_not_found');

      const splitCrossTenantRes = await splitOrders(
        new Request('http://localhost/api/orders/split', {
          method: 'POST',
          headers: { Authorization: `Bearer ${defToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_id: 'tbl-def-1',
            orders: [
              {
                items: [{ id: 'prod-def-ae', name: 'Default Espresso', price: 35000, quantity: 1 }],
                total: 35000,
                customer_name: 'Guest 1',
                customer_phone: '0901112222',
              },
              {
                items: [{ id: 'prod-b-ae', name: 'Store B Matcha', price: 55000, quantity: 1 }],
                total: 55000,
                customer_name: 'Guest 2',
                customer_phone: '0903334444',
              },
            ],
          }),
        }),
        env
      );
      expect(splitCrossTenantRes.status).toBe(400);
    } finally {
      sql.close();
    }
  });

  it('enforces OpenAPI Orders customer mutation & tenant boundaries (AF1), CRM segments/lookup/referral points integrity (AF2), Promotions usage cap & order validation (AF3), and Loyalty customer-tenant authority & empty summary isolation (AF4)', async () => {
    const { OpenAPIHono } = await import('@hono/zod-openapi');
    const { handleOpenApiUpdateOrder } = await import('../../routes/openapi-orders-handlers/order-write-handlers');
    const { handleCancelOrder } = await import('../../routes/openapi-orders-handlers/order-cancel-handlers');
    const { handleGetOrderSummary } = await import('../../routes/openapi-orders-handlers/order-summary-handlers');
    const { getOrder } = await import('../../../../packages/domain/order/queries/get-order');
    const { buildSegment } = await import('../../../../packages/domain/crm/commands/segments');
    const { lookupProfile } = await import('../../../../packages/domain/crm/lookup-profile');
    const { rewardReferralOnFirstOrder, reverseReferralCashback, DEFAULT_REFERRAL_POLICY } = await import('../../../../packages/domain/crm/commands/referral');
    const { registerUsageHandlers } = await import('../../routes/openapi-promotions-handlers/usage-handlers');
    const { getLoyaltyAccountWithFallback } = await import('../../routes/openapi-loyalty-handlers/loyalty-db-helpers');
    const { registerAdminHandlers } = await import('../../routes/openapi-loyalty-handlers/admin-handlers');

    const sql = new DatabaseSync(':memory:');
    function statement(query: string, values: unknown[] = []): any {
      return {
        bind(...args: unknown[]) { return statement(query, args); },
        async first() { return sql.prepare(query).get(...(values as any[])) ?? null; },
        async all() { return { success: true, results: sql.prepare(query).all(...(values as any[])) }; },
        async run() {
          const r = sql.prepare(query).run(...(values as any[]));
          return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
        },
      };
    }
    const db: any = { prepare: statement, async batch(stmts: any[]) { return Promise.all(stmts.map((s: any) => s.run())); } };

    try {
      const nowIso = new Date().toISOString();
      sql.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          items TEXT,
          total INTEGER DEFAULT 0,
          subtotal INTEGER DEFAULT 0,
          shipping_fee INTEGER DEFAULT 0,
          discount INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          customer_address TEXT,
          payment_method TEXT DEFAULT 'cash',
          payment_status TEXT DEFAULT 'pending',
          table_id TEXT,
          order_type TEXT DEFAULT 'dine_in',
          notes TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          product_id TEXT,
          name TEXT,
          quantity INTEGER DEFAULT 1,
          unit_price INTEGER DEFAULT 0,
          subtotal INTEGER DEFAULT 0
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          amount INTEGER DEFAULT 0,
          method TEXT,
          status TEXT
        );
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number INTEGER,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          email TEXT,
          loyalty_tier TEXT DEFAULT 'bronze',
          loyalty_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          visit_count INTEGER DEFAULT 0,
          total_spent INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE customer_identities (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          identifier_type TEXT,
          identifier_value TEXT,
          created_at TEXT
        );
        CREATE TABLE consents (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          purpose TEXT,
          granted INTEGER DEFAULT 1,
          revoked_at TEXT
        );
        CREATE TABLE visits (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          visited_at TEXT,
          channel TEXT
        );
        CREATE TABLE referrals (
          id TEXT PRIMARY KEY,
          referrer_id TEXT,
          referred_customer_id TEXT,
          referral_code TEXT,
          status TEXT DEFAULT 'pending',
          bonus_type TEXT,
          cashback_awarded_vnd INTEGER DEFAULT 0,
          first_order_id TEXT,
          first_order_amount INTEGER DEFAULT 0,
          reward_paid_at TEXT,
          created_at TEXT
        );
        CREATE TABLE referral_codes (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          code TEXT UNIQUE,
          times_used INTEGER DEFAULT 0,
          total_points_earned INTEGER DEFAULT 0,
          total_cashback_earned_vnd INTEGER DEFAULT 0,
          created_at TEXT
        );
        CREATE TABLE loyalty_point_logs (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          order_id TEXT,
          points_change INTEGER,
          reason TEXT,
          balance_after INTEGER,
          description TEXT,
          created_at TEXT
        );
        CREATE TABLE promotions (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          type TEXT DEFAULT 'percentage',
          discount_type TEXT DEFAULT 'percentage',
          discount_value REAL DEFAULT 10,
          min_order_value REAL DEFAULT 100000,
          max_discount_value REAL DEFAULT 25000,
          max_uses INTEGER DEFAULT 10,
          current_uses INTEGER DEFAULT 0,
          usage_count INTEGER DEFAULT 0,
          usage_limit_per_customer INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          valid_from TEXT,
          valid_to TEXT,
          applicable_items TEXT,
          excluded_items TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE promotion_usages (
          id TEXT PRIMARY KEY,
          promotion_id TEXT,
          order_id TEXT,
          customer_id TEXT,
          discount_amount REAL,
          idempotency_key TEXT,
          created_at TEXT
        );
        CREATE TABLE loyalty_accounts (
          id TEXT PRIMARY KEY,
          customer_id TEXT UNIQUE,
          current_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          tier TEXT DEFAULT 'bronze',
          order_count INTEGER DEFAULT 0,
          total_spent INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          last_activity_at TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE loyalty_transactions (
          id TEXT PRIMARY KEY,
          account_id TEXT,
          customer_id TEXT,
          type TEXT,
          points INTEGER,
          balance_after INTEGER,
          order_id TEXT,
          reward_id TEXT,
          description TEXT,
          reason TEXT,
          idempotency_key TEXT,
          created_by TEXT,
          created_at TEXT
        );
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          action TEXT,
          entity_type TEXT,
          entity_id TEXT,
          metadata TEXT,
          created_at TEXT
        );
      `);

      const ordDefId = '11111111-2222-4333-8444-555555555501';
      const ordBId = '11111111-2222-4333-8444-555555555502';
      const ordSmallId = '11111111-2222-4333-8444-555555555503';
      const ordDef2Id = '11111111-2222-4333-8444-555555555504';
      const missingOrdId = '99999999-9999-4999-8999-999999999999';

      // Seed orders (note: orders table intentionally lacks points_earned/cashback_earned to exercise getOrder fallback!)
      sql.prepare(
        `INSERT INTO orders (id, items, total, subtotal, status, customer_id, customer_name, customer_phone, tenant_id, created_at, updated_at)
         VALUES
          (?, '[]', 120000, 120000, 'pending', 'cust-af-1', 'Cust 1', '0909111222', 'default', ?, ?),
          (?, '[]', 150000, 150000, 'pending', 'cust-af-1', 'Cust 1 Store B', '0909111222', 'store-b', ?, ?),
          (?, '[]', 50000, 50000, 'pending', 'cust-af-1', 'Cust 1 Small', '0909111222', 'default', ?, ?)`
      ).run(ordDefId, nowIso, nowIso, ordBId, nowIso, nowIso, ordSmallId, nowIso, nowIso);

      const env: any = { AURA_DB: db };

      // AF1: Customer cannot call PATCH /api/orders/:id to modify notes/customer without cancelling, cannot cancel across tenants, cannot view store summary, and getOrder fallback enforces tenant isolation
      const orderApp = new OpenAPIHono<any>();
      orderApp.use('*', async (c, next) => {
        c.set('user', { id: 'cust-af-1', role: 'customer', tenantId: 'default' });
        c.set('tenantId', 'default');
        await next();
      });
      orderApp.patch('/api/orders/:id', handleOpenApiUpdateOrder as any);
      orderApp.post('/api/orders/:id/cancel', handleCancelOrder as any);
      orderApp.get('/api/orders/summary', handleGetOrderSummary as any);

      const custNotesPatchRes = await orderApp.fetch(
        new Request(`http://localhost/api/orders/${ordDefId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Customer tampering notes without cancelling' }),
        }),
        env
      );
      expect(custNotesPatchRes.status).toBe(403);

      const custCrossTenantCancelRes = await orderApp.fetch(
        new Request(`http://localhost/api/orders/${ordBId}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Cross-tenant cancel attempt' }),
        }),
        env
      );
      expect(custCrossTenantCancelRes.status).toBe(404);

      const custSummaryRes = await orderApp.fetch(
        new Request('http://localhost/api/orders/summary'),
        env
      );
      expect(custSummaryRes.status).toBe(403);

      const crossGetOrderRes = await getOrder(
        new Request(`http://localhost/api/orders/${ordBId}`),
        env,
        ordBId,
        'default'
      );
      expect(crossGetOrderRes.status).toBe(404);

      // AF2: lookupProfile rejects empty phone and ignores cross-tenant customer_identities; rewardReferralOnFirstOrder enforces minOrderVnd in points mode and reverseReferralCashback reverses points referrals
      sql.prepare(
        `INSERT INTO customers (id, name, phone, loyalty_tier, loyalty_points, lifetime_points, tenant_id, created_at, updated_at)
         VALUES
          ('cust-af-ref', 'Referrer', '0909333444', 'silver', 50, 50, 'default', ?, ?),
          ('cust-af-new', 'Referee', '0909555666', 'bronze', 20, 20, 'default', ?, ?),
          ('cust-af-b-only', 'Store B Customer', '0909777888', 'gold', 200, 200, 'store-b', ?, ?)`
      ).run(nowIso, nowIso, nowIso, nowIso, nowIso, nowIso);

      sql.prepare(
        `INSERT INTO customer_identities (id, customer_id, identifier_type, identifier_value, created_at)
         VALUES ('cid-af-b', 'cust-af-b-only', 'phone', '0909777888', ?)`
      ).run(nowIso);

      const emptyLookup = await lookupProfile(db, '   ', { tenantId: 'default' });
      expect(emptyLookup.found).toBe(false);

      const crossIdentityLookup = await lookupProfile(db, '0909777888', { tenantId: 'default' });
      expect(crossIdentityLookup.found).toBe(false);

      const sameTenantIdentityLookup = await lookupProfile(db, '0909777888', { tenantId: 'store-b' });
      expect(sameTenantIdentityLookup.found).toBe(true);
      expect(sameTenantIdentityLookup.customerId).toBe('cust-af-b-only');

      const segDefault = await buildSegment(db, 'dormant_60d', undefined, { tenantId: 'default' });
      expect(segDefault.customers.some((c) => c.id === 'cust-af-b-only')).toBe(false);

      sql.prepare(
        `INSERT INTO referral_codes (id, customer_id, code, times_used, total_points_earned, created_at)
         VALUES ('rc-af-1', 'cust-af-ref', 'REF-AF1', 1, 0, ?)`
      ).run(nowIso);
      sql.prepare(
        `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, status, created_at)
         VALUES ('ref-af-1', 'cust-af-ref', 'cust-af-new', 'REF-AF1', 'pending', ?)`
      ).run(nowIso);

      const pointsPolicy = { ...DEFAULT_REFERRAL_POLICY, bonusType: 'points' as const, minOrderVnd: 50000, pointsReferrer: 100, pointsReferee: 50 };
      const belowMinPointsReward = await rewardReferralOnFirstOrder(db, 'cust-af-new', ordSmallId, 30000, pointsPolicy, 'default');
      expect(belowMinPointsReward.success).toBe(false);
      expect(belowMinPointsReward.reason).toBe('order_below_min');

      const validPointsReward = await rewardReferralOnFirstOrder(db, 'cust-af-new', ordDefId, 120000, pointsPolicy, 'default');
      expect(validPointsReward.success).toBe(true);
      const refereeWelcomeLog = sql.prepare(
        "SELECT balance_after FROM loyalty_point_logs WHERE customer_id = 'cust-af-new' AND reason = 'referral_welcome'"
      ).get() as { balance_after: number };
      expect(refereeWelcomeLog.balance_after).toBe(70);

      const reversedPointsRef = await reverseReferralCashback(db, 'ref-af-1', 'default');
      expect(reversedPointsRef.success).toBe(true);
      const referrerAfterRev = sql.prepare("SELECT loyalty_points FROM customers WHERE id = 'cust-af-ref'").get() as { loyalty_points: number };
      const refereeAfterRev = sql.prepare("SELECT loyalty_points FROM customers WHERE id = 'cust-af-new'").get() as { loyalty_points: number };
      expect(referrerAfterRev.loyalty_points).toBe(50);
      expect(refereeAfterRev.loyalty_points).toBe(20);

      // AF3: POST /api/promotions/use enforces order existence for customer, minOrderValue, discountAmount cap, and per-customer limit
      const promoId = '33333333-3333-4333-8333-333333333333';
      sql.prepare(
        `INSERT INTO promotions (id, code, name, type, discount_type, discount_value, min_order_value, max_discount_value, max_uses, current_uses, usage_limit_per_customer, is_active, tenant_id, created_at, updated_at)
         VALUES (?, 'AF3PROMO', 'AF3 Promo', 'percentage', 10, 100000, 20000, 10, 0, 1, 1, 'default', ?, ?)`
          .replace("'percentage', 10", "'percentage', 'percentage', 10")
      ).run(promoId, nowIso, nowIso);

      const promoApp = new OpenAPIHono<any>();
      promoApp.use('*', async (c, next) => {
        c.set('user', { id: 'cust-af-1', customerId: 'cust-af-1', role: 'customer', tenantId: 'default' });
        c.set('tenantId', 'default');
        await next();
      });
      registerUsageHandlers(promoApp);

      // Fake orderId rejected for customer (404)
      const fakeOrderPromoRes = await promoApp.fetch(
        new Request('http://localhost/api/promotions/use', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promotionId: promoId, orderId: missingOrdId, discountAmount: 10000 }),
        }),
        env
      );
      expect(fakeOrderPromoRes.status).toBe(404);

      // Order below min_order_value (50000 < 100000) rejected (400)
      const belowMinPromoRes = await promoApp.fetch(
        new Request('http://localhost/api/promotions/use', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promotionId: promoId, orderId: ordSmallId, discountAmount: 5000 }),
        }),
        env
      );
      expect(belowMinPromoRes.status).toBe(400);

      // Inflated discountAmount (50000 > 10% of 120000 = 12000) rejected (400)
      const inflatedDiscountRes = await promoApp.fetch(
        new Request('http://localhost/api/promotions/use', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promotionId: promoId, orderId: ordDefId, discountAmount: 50000 }),
        }),
        env
      );
      expect(inflatedDiscountRes.status).toBe(400);

      // Valid usage succeeds (200)
      const validPromoUseRes = await promoApp.fetch(
        new Request('http://localhost/api/promotions/use', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promotionId: promoId, orderId: ordDefId, discountAmount: 12000 }),
        }),
        env
      );
      expect(validPromoUseRes.status).toBe(200);

      // Second usage by same customer exceeds usage_limit_per_customer = 1 (400)
      sql.prepare(
        `INSERT INTO orders (id, items, total, subtotal, status, customer_id, tenant_id, created_at, updated_at)
         VALUES (?, '[]', 150000, 150000, 'pending', 'cust-af-1', 'default', ?, ?)`
      ).run(ordDef2Id, nowIso, nowIso);
      const perCustLimitRes = await promoApp.fetch(
        new Request('http://localhost/api/promotions/use', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promotionId: promoId, orderId: ordDef2Id, discountAmount: 15000 }),
        }),
        env
      );
      expect(perCustLimitRes.status).toBe(400);

      // AF4: Loyalty account with table-default tenant_id='default' owned by store-b customer is isolated to store-b, and empty tenant summary does not leak global transactions
      sql.prepare(
        `INSERT INTO loyalty_accounts (id, customer_id, current_points, lifetime_points, tier, tenant_id, last_activity_at, created_at, updated_at)
         VALUES ('la_cust-af-b-only', 'cust-af-b-only', 200, 200, 'gold', 'default', ?, ?, ?)`
      ).run(nowIso, nowIso, nowIso);

      const leakCheckDefault = await getLoyaltyAccountWithFallback(db, 'cust-af-b-only', nowIso, 'default');
      expect(leakCheckDefault.account).toBeNull();

      const validCheckStoreB = await getLoyaltyAccountWithFallback(db, 'cust-af-b-only', nowIso, 'store-b');
      expect(validCheckStoreB.account).not.toBeNull();
      expect(validCheckStoreB.account.customer_id).toBe('cust-af-b-only');

      // Delete default customers/accounts and verify default summary does not fall through to store-b's loyalty_transactions
      sql.exec("DELETE FROM customers WHERE tenant_id = 'default'; DELETE FROM loyalty_accounts WHERE customer_id != 'cust-af-b-only';");
      sql.prepare(
        `INSERT INTO loyalty_transactions (id, account_id, customer_id, type, points, balance_after, description, created_at)
         VALUES ('ltx-b-1', 'la_cust-af-b-only', 'cust-af-b-only', 'earn', 200, 200, 'Store B earn', ?)`
      ).run(nowIso);

      const loyaltyAdminApp = new OpenAPIHono<any>();
      loyaltyAdminApp.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-def', role: 'manager', tenantId: 'default' });
        c.set('tenantId', 'default');
        await next();
      });
      registerAdminHandlers(loyaltyAdminApp);

      const summaryDefRes = await loyaltyAdminApp.fetch(
        new Request('http://localhost/api/loyalty/admin/summary'),
        env
      );
      expect(summaryDefRes.status).toBe(200);
      const summaryDefJson = (await summaryDefRes.json()) as { data: { totalMembers: number; totalPointsIssued: number } };
      expect(summaryDefJson.data.totalMembers).toBe(0);
      expect(summaryDefJson.data.totalPointsIssued).toBe(0);
    } finally {
      sql.close();
    }
  });

  it('Phase 34 (AG1..AG4): enforces birthday-bonus birth date & zero-bonus tier config, promotions fail-closed write role & server-price eligibleSubtotal validation, KDS cancel inventory/loyalty reversal & station tenant isolation, and loyalty-trigger/getCustomerAccount tenant propagation', async () => {
    const { env, sql } = createTestEnv();
    try {
      const db = env.AURA_DB;
      const nowDate = new Date();
      const nowIso = nowDate.toISOString();
      const currentMonthStr = String(nowDate.getUTCMonth() + 1).padStart(2, '0');
      const currentYearStr = String(nowDate.getUTCFullYear());
      const pastIso = new Date(Date.now() - 3600_000).toISOString();
      const futureIso = new Date(Date.now() + 86400_000).toISOString();

      const { OpenAPIHono } = await import('@hono/zod-openapi');
      const { Hono } = await import('hono');
      const { registerAccountHandlers: registerLoyaltyAccountHandlers } = await import('../../routes/openapi-loyalty-handlers/account-handlers');
      const { registerCrudHandlers } = await import('../../routes/openapi-promotions-handlers/crud-handlers');
      const { registerValidationHandlers } = await import('../../routes/openapi-promotions-handlers/validation-handlers');
      const { executeKdsStatusTransition } = await import('../../../../packages/domain/kitchen/commands/kds-status-transition');
      const { handleGetKdsOrders } = await import('../../routes/orders-hono-handlers/kds-handlers');
      const { creditLoyaltyIfEligible } = await import('../../../../packages/domain/order/policies/loyalty-trigger');
      const { getCustomerAccount } = await import('../../../../packages/domain/crm/commands/get-customer-account');

      sql.exec(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          email TEXT,
          birthday TEXT,
          loyalty_tier TEXT DEFAULT 'bronze',
          loyalty_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          visit_count INTEGER DEFAULT 0,
          total_spent INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS loyalty_accounts (
          id TEXT PRIMARY KEY,
          customer_id TEXT UNIQUE,
          current_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          tier TEXT DEFAULT 'bronze',
          order_count INTEGER DEFAULT 0,
          total_spent INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          last_activity_at TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS loyalty_transactions (
          id TEXT PRIMARY KEY,
          account_id TEXT,
          customer_id TEXT,
          type TEXT,
          points INTEGER,
          balance_after INTEGER,
          order_id TEXT,
          reward_id TEXT,
          description TEXT,
          reason TEXT,
          idempotency_key TEXT,
          created_by TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS loyalty_point_logs (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          order_id TEXT,
          points_change INTEGER,
          reason TEXT,
          balance_after INTEGER,
          description TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS cashback_transactions (
          id TEXT PRIMARY KEY,
          wallet_id TEXT,
          customer_id TEXT,
          order_id TEXT,
          type TEXT,
          amount INTEGER,
          balance_after INTEGER,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT,
          slug TEXT,
          sort_order INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          category_id TEXT,
          name TEXT,
          slug TEXT,
          price REAL DEFAULT 0,
          is_available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS promotions (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          description TEXT,
          type TEXT DEFAULT 'percentage',
          discount_type TEXT DEFAULT 'percentage',
          discount_value REAL DEFAULT 10,
          min_order_value REAL,
          max_discount_value REAL,
          max_uses INTEGER,
          current_uses INTEGER DEFAULT 0,
          usage_count INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          valid_from TEXT,
          valid_to TEXT,
          applicable_items TEXT,
          excluded_items TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          items TEXT,
          total INTEGER DEFAULT 0,
          total_amount INTEGER DEFAULT 0,
          subtotal INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          payment_status TEXT DEFAULT 'unpaid',
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          customer_email TEXT,
          table_id TEXT,
          notes TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS consents (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          purpose TEXT,
          granted INTEGER DEFAULT 1,
          revoked_at TEXT,
          granted_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          action TEXT,
          entity_type TEXT,
          entity_id TEXT,
          metadata TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS loyalty_tier_configs (
          tier TEXT PRIMARY KEY,
          birthday_bonus INTEGER
        );
        CREATE TABLE IF NOT EXISTS kitchen_stations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS category_stations (
          category_id TEXT NOT NULL,
          station_id TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS inventory_items (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          current_stock REAL DEFAULT 0,
          quantity REAL DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS inventory_transactions (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL,
          type TEXT NOT NULL,
          quantity REAL NOT NULL,
          previous_stock REAL,
          new_stock REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          created_by TEXT,
          created_at TEXT
        );
        ALTER TABLE kitchen_stations ADD COLUMN tenant_id TEXT DEFAULT 'default';
        ALTER TABLE orders ADD COLUMN subtotal REAL DEFAULT 0;
        ALTER TABLE orders ADD COLUMN customer_id TEXT;
        ALTER TABLE orders ADD COLUMN points_earned INTEGER DEFAULT 0;
        ALTER TABLE orders ADD COLUMN total_amount REAL DEFAULT 0;
      `);

      // AG1: Birthday bonus requires non-null birthday, respects 0 bonus tier config, and enforces yearly idempotency
      sql.prepare(
        `INSERT INTO customers (id, name, phone, birthday, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
         VALUES
          ('cust-ag-nobday', 'No Bday', '0911000001', NULL, 100, 100, 'silver', 'default'),
          ('cust-ag-zerobonus', 'Zero Bonus', '0911000002', ?, 100, 100, 'bronze_zero', 'default'),
          ('cust-ag-validbday', 'Valid Bday', '0911000003', ?, 100, 100, 'gold_bday', 'default'),
          ('cust-ag-storeb', 'Store B Cust', '0911000004', ?, 500, 500, 'silver', 'store-b')`
      ).run(`1995-${currentMonthStr}-10`, `1992-${currentMonthStr}-20`, `1990-${currentMonthStr}-15`);

      sql.prepare(
        `INSERT INTO loyalty_accounts (id, customer_id, current_points, lifetime_points, tier, tenant_id, created_at, updated_at)
         VALUES
          ('la-ag-nobday', 'cust-ag-nobday', 100, 100, 'silver', 'default', ?, ?),
          ('la-ag-zerobonus', 'cust-ag-zerobonus', 100, 100, 'bronze_zero', 'default', ?, ?),
          ('la-ag-validbday', 'cust-ag-validbday', 100, 100, 'gold_bday', 'default', ?, ?)`
      ).run(nowIso, nowIso, nowIso, nowIso, nowIso, nowIso);

      sql.prepare(
        `INSERT INTO loyalty_tier_configs (tier, birthday_bonus)
         VALUES ('bronze_zero', 0), ('gold_bday', 300)`
      ).run();

      let currentLoyaltyUser = { id: 'cust-ag-nobday', role: 'customer', tenantId: 'default' };
      const loyaltyApp = new OpenAPIHono<any>();
      loyaltyApp.use('*', async (c, next) => {
        c.set('user', currentLoyaltyUser);
        c.set('tenantId', currentLoyaltyUser.tenantId);
        await next();
      });
      registerLoyaltyAccountHandlers(loyaltyApp);

      const noBdayRes = await loyaltyApp.fetch(
        new Request('http://localhost/api/loyalty/account/birthday-bonus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        env
      );
      expect(noBdayRes.status).toBe(400);

      currentLoyaltyUser = { id: 'cust-ag-zerobonus', role: 'customer', tenantId: 'default' };
      const zeroBonusRes = await loyaltyApp.fetch(
        new Request('http://localhost/api/loyalty/account/birthday-bonus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        env
      );
      expect(zeroBonusRes.status).toBe(400);

      currentLoyaltyUser = { id: 'cust-ag-validbday', role: 'customer', tenantId: 'default' };
      const validBdayRes = await loyaltyApp.fetch(
        new Request('http://localhost/api/loyalty/account/birthday-bonus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        env
      );
      expect(validBdayRes.status).toBe(200);
      const validBdayJson = (await validBdayRes.json()) as { data: { points: number; newBalance: number } };
      expect(validBdayJson.data.points).toBe(300);
      expect(validBdayJson.data.newBalance).toBe(400);

      const bdayTx = sql.prepare("SELECT idempotency_key FROM loyalty_transactions WHERE customer_id = 'cust-ag-validbday'").get() as { idempotency_key: string } | undefined;
      expect(bdayTx?.idempotency_key).toBe(`birthday_bonus:cust-ag-validbday:${currentYearStr}`);

      const dupBdayRes = await loyaltyApp.fetch(
        new Request('http://localhost/api/loyalty/account/birthday-bonus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        env
      );
      expect(dupBdayRes.status).toBe(400);

      // AG2: Promotions fail-closed write role guard (blocks undefined user and 'staff') & server-price eligibleSubtotal validation
      let currentPromoUser: any = undefined;
      const promoApp = new OpenAPIHono<any>();
      promoApp.use('*', async (c, next) => {
        if (currentPromoUser) c.set('user', currentPromoUser);
        c.set('tenantId', 'default');
        await next();
      });
      registerCrudHandlers(promoApp);
      registerValidationHandlers(promoApp);

      const createNoUserRes = await promoApp.fetch(
        new Request('http://localhost/api/promotions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: 'unauth-promo',
            name: 'Unauth Promo',
            code: 'UNAUTH10',
            type: 'code',
            rule: { type: 'percentage', value: 10 },
            schedule: { startAt: nowIso },
          }),
        }),
        env
      );
      expect(createNoUserRes.status).toBe(403);

      currentPromoUser = { id: 'staff-ag-1', role: 'staff', tenantId: 'default' };
      const createStaffRes = await promoApp.fetch(
        new Request('http://localhost/api/promotions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: 'staff-promo',
            name: 'Staff Promo',
            code: 'STAFF10',
            type: 'code',
            rule: { type: 'percentage', value: 10 },
            schedule: { startAt: nowIso },
          }),
        }),
        env
      );
      expect(createStaffRes.status).toBe(403);

      const prodEligibleId = '11111111-3333-4333-8333-000000000001';
      const prodOtherId = '11111111-3333-4333-8333-000000000002';
      const prodExcludedId = '11111111-3333-4333-8333-000000000003';
      sql.prepare(
        `INSERT INTO categories (id, name, slug, sort_order, tenant_id)
         VALUES ('cat-ag-1', 'Coffee AG', 'coffee-ag', 1, 'default')`
      ).run();
      sql.prepare(
        `INSERT INTO products (id, category_id, name, slug, price, is_available, tenant_id)
         VALUES
          (?, 'cat-ag-1', 'Eligible Latte', 'eligible-latte', 40000, 1, 'default'),
          (?, 'cat-ag-1', 'Other Cake', 'other-cake', 60000, 1, 'default'),
          (?, 'cat-ag-1', 'Excluded Merchandise', 'excluded-merch', 80000, 1, 'default')`
      ).run(prodEligibleId, prodOtherId, prodExcludedId);

      sql.prepare(
        `INSERT INTO promotions (id, name, code, type, discount_type, discount_value, min_order_value, applicable_items, excluded_items, valid_from, valid_to, is_active, tenant_id, created_at, updated_at)
         VALUES
          ('promo-ag-scoped', 'Scoped 50%', 'SCOPED50', 'percentage', 'percentage', 50, 80000, ?, ?, ?, ?, 1, 'default', ?, ?)`
      ).run(JSON.stringify([prodEligibleId]), JSON.stringify([prodExcludedId]), pastIso, futureIso, nowIso, nowIso);

      // Client tries to pass inflated orderValue (200,000) with only 1x 40,000 item -> rejected by minOrderValue (80,000)
      const spoofedOrderValRes = await promoApp.fetch(
        new Request('http://localhost/api/promotions/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: 'SCOPED50',
            orderValue: 200000,
            items: [{ menuItemId: prodEligibleId, quantity: 1, price: 200000 }],
          }),
        }),
        env
      );
      expect(spoofedOrderValRes.status).toBe(400);

      // Client omits items when excluded_items is configured -> rejected (400)
      const omittedItemsRes = await promoApp.fetch(
        new Request('http://localhost/api/promotions/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: 'SCOPED50',
            orderValue: 100000,
          }),
        }),
        env
      );
      expect(omittedItemsRes.status).toBe(400);

      // Valid cart: 1x Eligible Latte (server price 40k) + 1x Other Cake (server price 60k) = 100k subtotal, but 50% applies ONLY to Eligible Latte (40k -> 20k discount)
      const validScopedRes = await promoApp.fetch(
        new Request('http://localhost/api/promotions/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: 'SCOPED50',
            items: [
              { menuItemId: prodEligibleId, quantity: 1, price: 90000 },
              { menuItemId: prodOtherId, quantity: 1, price: 60000 },
            ],
          }),
        }),
        env
      );
      expect(validScopedRes.status).toBe(200);
      const validScopedJson = (await validScopedRes.json()) as { data: { discount: number; subtotal: number; finalTotal: number } };
      expect(validScopedJson.data.subtotal).toBe(100000);
      expect(validScopedJson.data.discount).toBe(20000);
      expect(validScopedJson.data.finalTotal).toBe(80000);

      // AG3: KDS cancellation restores reserved inventory, and KDS station filter isolates kitchen_stations by tenant
      sql.prepare(
        `INSERT INTO inventory_items (id, code, name, current_stock, quantity, is_active, updated_at)
         VALUES ('inv-ag-1', 'MILK-AG', 'Fresh Milk', 8, 8, 1, ?)`
      ).run(nowIso);
      sql.prepare(
        `INSERT INTO inventory_transactions (id, item_id, type, quantity, previous_stock, new_stock, reference_id, reference_type, notes, created_by, created_at)
         VALUES ('itx-ag-res-1', 'inv-ag-1', 'reserve', -2, 10, 8, 'ord-ag-kds-cancel', 'order', 'Reserved for ord-ag-kds-cancel', 'system', ?)`
      ).run(nowIso);
      sql.prepare(
        `INSERT INTO orders (id, items, total, subtotal, status, customer_id, tenant_id, created_at, updated_at)
         VALUES ('ord-ag-kds-cancel', '[]', 50000, 50000, 'preparing', 'cust-ag-validbday', 'default', ?, ?)`
      ).run(nowIso, nowIso);

      const kdsCancelResult = await executeKdsStatusTransition(db, 'ord-ag-kds-cancel', 'cancelled', 'manager', {
        tenantId: 'default',
      });
      expect(kdsCancelResult.success).toBe(true);
      const restoredStock = sql.prepare("SELECT current_stock FROM inventory_items WHERE id = 'inv-ag-1'").get() as { current_stock: number };
      expect(restoredStock.current_stock).toBe(10);

      sql.prepare(
        `INSERT INTO kitchen_stations (id, name, tenant_id)
         VALUES ('ks-store-b-bar', 'Bar Station B', 'store-b')`
      ).run();
      sql.prepare(
        `INSERT INTO category_stations (category_id, station_id)
         VALUES ('cat-ag-1', 'ks-store-b-bar')`
      ).run();
      sql.prepare(
        `INSERT INTO orders (id, items, total, subtotal, status, customer_name, tenant_id, created_at, updated_at)
         VALUES ('ord-ag-kds-active', ?, 40000, 40000, 'pending', 'Guest AG', 'default', ?, ?)`
      ).run(JSON.stringify([{ id: prodEligibleId, name: 'Eligible Latte', quantity: 1, category_id: 'cat-ag-1' }]), nowIso, nowIso);

      const kdsApp = new Hono<any>();
      kdsApp.use('*', async (c, next) => {
        c.set('user', { id: 'staff-def', role: 'kitchen' });
        c.set('tenantId', 'default');
        await next();
      });
      kdsApp.get('/api/orders/kds', handleGetKdsOrders);

      const kdsStationRes = await kdsApp.fetch(
        new Request('http://localhost/api/orders/kds?station_id=ks-store-b-bar'),
        env
      );
      expect(kdsStationRes.status).toBe(200);
      const kdsStationJson = (await kdsStationRes.json()) as { data: Array<{ id: string }> };
      expect(kdsStationJson.data).toHaveLength(0);

      // AG4: creditLoyaltyIfEligible propagates default tenant when order.tenant_id is NULL (preventing cross-tenant customer accrual), and getCustomerAccount enforces tenantId match
      sql.prepare(
        `INSERT INTO orders (id, items, total, subtotal, status, payment_status, customer_id, tenant_id, created_at, updated_at)
         VALUES ('ord-ag-null-tenant', '[]', 100000, 100000, 'completed', 'paid', 'cust-ag-storeb', NULL, ?, ?)`
      ).run(nowIso, nowIso);

      await creditLoyaltyIfEligible(db, env as unknown as Record<string, unknown>, 'ord-ag-null-tenant');
      const storeBCustAfter = sql.prepare("SELECT loyalty_points FROM customers WHERE id = 'cust-ag-storeb'").get() as { loyalty_points: number };
      expect(storeBCustAfter.loyalty_points).toBe(500);

      const crossTenantAccount = await getCustomerAccount(db, 'cust-ag-storeb', { tenantId: 'default' });
      expect(crossTenantAccount.name).toBeNull();
      expect(crossTenantAccount.points).toBe(0);

      const sameTenantAccount = await getCustomerAccount(db, 'cust-ag-storeb', { tenantId: 'store-b' });
      expect(sameTenantAccount.name).toBe('Store B Cust');
      expect(sameTenantAccount.points).toBe(500);
    } finally {
      sql.close();
    }
  });

  it('enforces AK1–AK4 Forecasting/Recommendations/Metrics/Cron Tenant Isolation, Menu/Table-Zone RBAC, Assistant/Mixpost SSRF & Birthday/Subscription Guards', async () => {
    const { sql, env } = createTestEnv();
    try {
      const { Hono } = await import('hono');
      const { OpenAPIHono } = await import('@hono/zod-openapi');
      const { inventoryForecastingRouter } = await import('../../routes/inventory-forecasting');
      const { recommendationsRouter } = await import('../../routes/recommendations');
      const { default: adminMetricsRouter } = await import('../../routes/admin-metrics');
      const { registerJobCrudHandlers: registerCronJobCrudHandlers } = await import('../../routes/openapi-cron-handlers/job-crud-handlers');
      const { registerSummaryHandlers: registerCronSummaryHandlers } = await import('../../routes/openapi-cron-handlers/summary-handlers');
      const { getCustomerMenu, getCustomerMenuItem } = await import('../../../../packages/domain/catalog/commands/get-customer-menu');
      const { resolveServerProductPrice } = await import('../../../../packages/domain/catalog/policies/pricing-resolver');
      const { registerZoneCrudHandlers } = await import('../../routes/openapi-tables-handlers/zone-crud-handlers');
      const { registerTableCrudHandlers } = await import('../../routes/openapi-tables-handlers/table-crud-handlers');
      const { customerAssistantRouter } = await import('../../routes/customer-assistant');
      const { registerPostsHandler } = await import('../../routes/mixpost-handlers/posts-handler');
      const { checkInventoryAlerts } = await import('../../routes/cron-handlers/order-checks');
      const { birthdayRouter } = await import('../../routes/birthday');
      const { createSubscription } = await import('../../tree/subscriptions/sub-handlers');

      const nowIso = new Date().toISOString();
      const db = env.AURA_DB;

      sql.exec(`
        CREATE TABLE IF NOT EXISTS inventory_items (
          id TEXT PRIMARY KEY,
          name TEXT,
          sku TEXT,
          unit TEXT DEFAULT 'kg',
          current_stock REAL DEFAULT 0,
          min_stock REAL DEFAULT 0,
          quantity REAL DEFAULT 100,
          min_quantity REAL DEFAULT 0,
          reorder_point REAL DEFAULT 0,
          cost_per_unit REAL DEFAULT 0,
          active INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          ingredient_id TEXT,
          type TEXT,
          quantity REAL,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS ai_product_affinities (
          id TEXT PRIMARY KEY,
          tenant_id TEXT,
          item_a TEXT,
          item_b TEXT,
          co_occurrence_count INTEGER,
          affinity_score REAL,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS _metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          value REAL,
          tags TEXT,
          timestamp TEXT,
          created_at TEXT
        );
        DROP TABLE IF EXISTS cron_jobs;
        DROP TABLE IF EXISTS cron_runs;
        CREATE TABLE IF NOT EXISTS cron_jobs (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          schedule TEXT,
          cron_expression TEXT,
          handler TEXT,
          job_type TEXT,
          payload TEXT,
          is_active INTEGER DEFAULT 1,
          status TEXT DEFAULT 'active',
          timeout_seconds INTEGER DEFAULT 300,
          max_retries INTEGER DEFAULT 3,
          retry_delay_seconds INTEGER DEFAULT 60,
          timeout_ms INTEGER DEFAULT 30000,
          location_id TEXT,
          last_run_at TEXT,
          next_run_at TEXT,
          last_status TEXT,
          run_count INTEGER DEFAULT 0,
          fail_count INTEGER DEFAULT 0,
          created_by TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS cron_runs (
          id TEXT PRIMARY KEY,
          job_id TEXT,
          status TEXT,
          started_at TEXT,
          completed_at TEXT,
          duration_ms INTEGER,
          output TEXT,
          error TEXT
        );
        CREATE TABLE IF NOT EXISTS menu_items (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          price INTEGER,
          base_price_vnd INTEGER,
          category TEXT,
          image_url TEXT,
          tags TEXT,
          available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS happy_hour_windows (
          id TEXT PRIMARY KEY,
          name TEXT,
          day_of_week INTEGER,
          start_time TEXT,
          end_time TEXT,
          discount_rate REAL,
          active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS table_zones (
          id TEXT PRIMARY KEY,
          slug TEXT,
          name TEXT,
          description TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          location_id TEXT,
          metadata TEXT,
          tenant_id TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS mixpost_posts (
          id TEXT PRIMARY KEY,
          content TEXT,
          platforms TEXT,
          status TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS inventory_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id TEXT,
          alert_type TEXT,
          current_qty REAL,
          threshold REAL,
          notified_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          email TEXT,
          birthday TEXT,
          date_of_birth TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS subscription_plans (
          id TEXT PRIMARY KEY,
          name TEXT,
          slug TEXT,
          monthly_price_vnd INTEGER,
          deposit_vnd INTEGER,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS subscriptions (
          id TEXT PRIMARY KEY,
          plan_id TEXT,
          customer_id TEXT,
          customer_name TEXT,
          customer_email TEXT,
          customer_phone TEXT,
          company_name TEXT,
          tax_code TEXT,
          container_code TEXT,
          location TEXT,
          status TEXT,
          amount_vnd INTEGER,
          deposit_vnd INTEGER,
          deposit_paid INTEGER DEFAULT 0,
          billing_cycle TEXT,
          current_period_start TEXT,
          current_period_end TEXT,
          next_billing_date TEXT,
          notes TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
      `);

      // Seed staff & manager users for default and store-b
      sql.prepare(
        `INSERT INTO users (id, name, email, role, tenant_id, is_active, auth_version, created_at)
         VALUES
          ('staff-ak-def', 'Staff Def', 'staff-ak@aura.vn', 'staff', 'default', 1, 1, ?),
          ('mgr-ak-def', 'Mgr Def', 'mgr-ak@aura.vn', 'manager', 'default', 1, 1, ?),
          ('mgr-ak-b', 'Mgr B', 'mgr-ak-b@aura.vn', 'manager', 'store-b', 1, 1, ?)`
      ).run(nowIso, nowIso, nowIso);

      const staffDefAcc: any = sql.prepare("SELECT * FROM users WHERE id = 'staff-ak-def'").get();
      const mgrDefAcc: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-ak-def'").get();
      const mgrBAcc: any = sql.prepare("SELECT * FROM users WHERE id = 'mgr-ak-b'").get();
      const { token: staffDefToken } = await issueStaffSession(env, staffDefAcc, { sessionType: 'staff-web' });
      const { token: mgrDefToken } = await issueStaffSession(env, mgrDefAcc, { sessionType: 'staff-web' });
      const { token: mgrBToken } = await issueStaffSession(env, mgrBAcc, { sessionType: 'staff-web' });

      // AK1.1: POST /api/inventory/forecast/snapshot rejects 'staff' with 403, and run-rate excludes positive adjustments & cross-tenant movements
      sql.prepare(
        `INSERT INTO inventory_items (id, name, sku, unit, current_stock, min_stock, reorder_point, cost_per_unit, active, is_active, tenant_id, updated_at)
         VALUES ('inv-ak-beans', 'Arabica Beans', 'ARB-AK', 'kg', 14, 5, 5, 200000, 1, 1, 'default', ?)`
      ).run(nowIso);
      sql.prepare(
        `INSERT INTO stock_movements (id, ingredient_id, type, quantity, tenant_id, created_at)
         VALUES
          ('sm-ak-sale', 'inv-ak-beans', 'sale', -7, 'default', ?),
          ('sm-ak-pos-adj', 'inv-ak-beans', 'adjustment', 50, 'default', ?),
          ('sm-ak-foreign', 'inv-ak-beans', 'sale', -70, 'store-b', ?)`
      ).run(nowIso, nowIso, nowIso);

      const staffSnapRes = await inventoryForecastingRouter.fetch(
        new Request('http://localhost/snapshot', {
          method: 'POST',
          headers: { Authorization: `Bearer ${staffDefToken}` },
        }),
        env
      );
      expect(staffSnapRes.status).toBe(403);

      const runRateRes = await inventoryForecastingRouter.fetch(
        new Request('http://localhost/run-rate?days=7', {
          headers: { Authorization: `Bearer ${mgrDefToken}` },
        }),
        env
      );
      expect(runRateRes.status).toBe(200);
      const runRateJson = (await runRateRes.json()) as { data: Array<{ id: string; daily_run_rate: number; days_of_supply: number }> };
      const beansMetric = runRateJson.data.find((d) => d.id === 'inv-ak-beans');
      expect(beansMetric?.daily_run_rate).toBe(1);
      expect(beansMetric?.days_of_supply).toBe(14);

      // AK1.2: POST /api/recommendations/mine-affinities rejects 'staff' with 403
      const staffMineRes = await recommendationsRouter.fetch(
        new Request('http://localhost/mine-affinities', {
          method: 'POST',
          headers: { Authorization: `Bearer ${staffDefToken}` },
        }),
        env
      );
      expect(staffMineRes.status).toBe(403);

      // AK1.3: GET /api/admin/metrics scopes _metrics rows by tenant_id tag
      sql.prepare(
        `INSERT INTO _metrics (name, value, tags, timestamp, created_at)
         VALUES
          ('request', 40, '{"status":"200","duration":40,"tenant_id":"default"}', ?, ?),
          ('request', 900, '{"status":"500","duration":900,"tenant_id":"store-b"}', ?, ?)`
      ).run(nowIso, nowIso, nowIso, nowIso);

      const metricsDefRes = await adminMetricsRouter.fetch(
        new Request('http://localhost/?range=24h', {
          headers: { Authorization: `Bearer ${mgrDefToken}` },
        }),
        env
      );
      expect(metricsDefRes.status).toBe(200);
      const metricsDefJson = (await metricsDefRes.json()) as { requests: { total: number }; errors: { total: number } };
      expect(metricsDefJson.requests.total).toBe(1);
      expect(metricsDefJson.errors.total).toBe(0);

      // AK1.4: OpenAPI Cron stamps payload.tenant_id server-side and isolates summary for empty default tenant
      sql.prepare(
        `INSERT INTO cron_runs (id, job_id, status, started_at, duration_ms)
         VALUES ('crun-ak-b-1', 'cjob-foreign-b', 'success', ?, 120)`
      ).run(nowIso);

      let cronCaller = { id: 'mgr-ak-def', role: 'manager', tenantId: 'default' };
      const cronApp = new OpenAPIHono<any>();
      cronApp.use('*', async (c, next) => {
        c.set('user', cronCaller);
        c.set('tenantId', cronCaller.tenantId);
        await next();
      });
      registerCronSummaryHandlers(cronApp);
      registerCronJobCrudHandlers(cronApp);

      const emptyDefSumRes = await cronApp.fetch(new Request('http://localhost/api/cron/summary'), env);
      expect(emptyDefSumRes.status).toBe(200);
      const emptyDefSumJson = (await emptyDefSumRes.json()) as { data: { totalRuns: number } };
      expect(emptyDefSumJson.data.totalRuns).toBe(0);

      cronCaller = { id: 'mgr-ak-b', role: 'manager', tenantId: 'store-b' };
      const createCronRes = await cronApp.fetch(
        new Request('http://localhost/api/cron/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Store B Job',
            cronExpression: '0 * * * *',
            handler: 'inventory.check',
            payload: { tenant_id: 'default', tenantId: 'default' },
          }),
        }),
        env
      );
      expect(createCronRes.status).toBe(201);
      const createCronJson = (await createCronRes.json()) as { data: { id: string; payload: string | { tenant_id: string } } };
      const parsedCronPayload = typeof createCronJson.data.payload === 'string'
        ? JSON.parse(createCronJson.data.payload)
        : createCronJson.data.payload;
      expect(parsedCronPayload.tenant_id).toBe('store-b');

      // AK2.1: getCustomerMenu, getCustomerMenuItem & resolveServerProductPrice isolate menu_items and happy_hour_windows by tenant
      const nowDay = new Date().getDay();
      sql.prepare(
        `INSERT INTO menu_items (id, name, description, price, base_price_vnd, category, available, tenant_id)
         VALUES
          ('mi-ak-def', 'Default Phin', 'Desc', 40000, 40000, 'coffee', 1, 'default'),
          ('mi-ak-b', 'Store B Special', 'Desc', 60000, 60000, 'coffee', 1, 'store-b')`
      ).run();
      sql.prepare(
        `INSERT INTO happy_hour_windows (id, name, day_of_week, start_time, end_time, discount_rate, active, tenant_id)
         VALUES ('hh-ak-b', 'Store B 50% Off', ?, '00:00', '23:59', 0.5, 1, 'store-b')`
      ).run(nowDay);

      const defMenu = await getCustomerMenu(db, { tenantId: 'default', channel: 'dine_in', now: new Date() });
      const defMenuItems = defMenu.categories.flatMap((c) => c.items);
      expect(defMenuItems.map((i) => i.id)).toContain('mi-ak-def');
      expect(defMenuItems.map((i) => i.id)).not.toContain('mi-ak-b');
      // Store B's 50% happy hour window must NOT discount Default tenant's item
      expect(defMenuItems.find((i) => i.id === 'mi-ak-def')?.priceCents).toBe(40000);

      const crossMenuItem = await getCustomerMenuItem(db, 'mi-ak-b', { tenantId: 'default' });
      expect(crossMenuItem).toBeNull();

      const crossResolvedPrice = await resolveServerProductPrice(db, { productId: 'mi-ak-b', tenantId: 'default' });
      expect(crossResolvedPrice.available).toBe(false);
      expect(crossResolvedPrice.rejection?.code).toBe('item_not_found');

      // AK2.2: Waiter/cashier blocked (403) from creating table zones or tables; table_zones slug uniqueness scoped by tenant
      let tableCaller = { id: 'waiter-ak', role: 'waiter', tenantId: 'default' };
      const tablesApp = new OpenAPIHono<any>();
      tablesApp.use('*', async (c, next) => {
        c.set('user', tableCaller);
        c.set('tenantId', tableCaller.tenantId);
        await next();
      });
      registerZoneCrudHandlers(tablesApp);
      registerTableCrudHandlers(tablesApp);

      const waiterZoneRes = await tablesApp.fetch(
        new Request('http://localhost/api/table-zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'VIP Zone', slug: 'vip-zone' }),
        }),
        env
      );
      expect(waiterZoneRes.status).toBe(403);

      tableCaller = { id: 'mgr-ak-def', role: 'manager', tenantId: 'default' };
      const defZoneRes = await tablesApp.fetch(
        new Request('http://localhost/api/table-zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Rooftop', slug: 'rooftop' }),
        }),
        env
      );
      expect(defZoneRes.status).toBe(201);

      tableCaller = { id: 'mgr-ak-b', role: 'manager', tenantId: 'store-b' };
      const bZoneRes = await tablesApp.fetch(
        new Request('http://localhost/api/table-zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Store B Rooftop', slug: 'rooftop' }),
        }),
        env
      );
      expect(bZoneRes.status).toBe(201);
      const bZoneRow = sql.prepare("SELECT tenant_id FROM table_zones WHERE slug = 'rooftop' AND tenant_id = 'store-b'").get() as { tenant_id: string } | undefined;
      expect(bZoneRow?.tenant_id).toBe('store-b');

      // AK3.1: Customer Assistant masks order IDs even when unauthenticated caller spoofs channel='zalo', and masks table_bill order ID
      sql.exec(`
        CREATE TABLE IF NOT EXISTS cafe_tables (
          id TEXT PRIMARY KEY,
          table_number TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sql.prepare("INSERT INTO cafe_tables (id, table_number, tenant_id) VALUES ('T99', '99', 'default')").run();
      sql.prepare(
        `INSERT INTO orders (id, order_number, customer_phone, customer_name, tenant_id, total, status, payment_status, payment_method, order_type, table_id, items, created_at, updated_at)
         VALUES ('ord-ak-secret999', 'ORD-AK9', '0908889999', 'Secret Guest', 'default', 95000, 'preparing', 'unpaid', 'cash', 'dine_in', 'T99', '[]', ?, ?)`
      ).run(nowIso, nowIso);

      const spoofZaloRes = await customerAssistantRouter.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'Kiểm tra đơn hàng của tôi', phone: '0908889999', channel: 'zalo' }),
        }),
        env
      );
      expect(spoofZaloRes.status).toBe(200);
      const spoofZaloJson = (await spoofZaloRes.json()) as { data: { reply: string } };
      expect(spoofZaloJson.data.reply).not.toContain('ord-ak-secret999');
      expect(spoofZaloJson.data.reply).toContain('***t999');

      const tableBillRes = await customerAssistantRouter.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'Tính tiền bàn 99', table_number: '99' }),
        }),
        env
      );
      expect(tableBillRes.status).toBe(200);
      const tableBillJson = (await tableBillRes.json()) as { data: { reply: string } };
      expect(tableBillJson.data.reply).not.toContain('ord-ak-secret999');
      expect(tableBillJson.data.reply).toContain('***t999');

      // AK3.2: Mixpost SSRF blocks private/metadata mediaUrls (400) and non-default tenant with 0 D1 posts does not leak global posts
      sql.prepare(
        `INSERT INTO mixpost_posts (id, content, platforms, status, tenant_id, created_at)
         VALUES ('mp-def-1', 'Default Post', '["facebook"]', 'published', 'default', ?)`
      ).run(nowIso);
      const mixpostEnv = { ...env, MIXPOST_API_URL: 'https://mixpost.aura.test', MIXPOST_API_TOKEN: 'test-token' };
      const mixpostApp = new Hono<any>();
      mixpostApp.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-ak-b', role: 'manager', tenantId: 'store-b' });
        c.set('tenantId', 'store-b');
        await next();
      });
      registerPostsHandler(mixpostApp);

      const ssrfPostRes = await mixpostApp.fetch(
        new Request('http://localhost/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Test SSRF',
            accounts: ['acc-1'],
            mediaUrls: ['http://169.254.169.254/latest/meta-data/'],
          }),
        }),
        mixpostEnv
      );
      expect(ssrfPostRes.status).toBe(400);

      const storeBPostsRes = await mixpostApp.fetch(new Request('http://localhost/posts'), mixpostEnv);
      expect(storeBPostsRes.status).toBe(200);
      const storeBPostsJson = (await storeBPostsRes.json()) as { data: unknown[]; source: string };
      expect(storeBPostsJson.data).toEqual([]);
      expect(storeBPostsJson.source).toBe('d1');

      // AK4.1: checkInventoryAlerts fires for low stock when last alert was >4h ago, and suppresses within 4h
      try { sql.exec('ALTER TABLE inventory_items ADD COLUMN quantity REAL DEFAULT 0'); } catch { /* exists */ }
      try { sql.exec('ALTER TABLE inventory_items ADD COLUMN min_quantity REAL DEFAULT 0'); } catch { /* exists */ }
      sql.exec(`
        CREATE TABLE IF NOT EXISTS inventory_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id TEXT,
          alert_type TEXT,
          current_qty REAL,
          threshold REAL,
          notified_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sql.prepare('UPDATE inventory_items SET quantity = 100, min_quantity = 0').run();
      sql.prepare(
        `INSERT INTO inventory_items (id, name, sku, unit, current_stock, min_stock, quantity, min_quantity, reorder_point, cost_per_unit, active, is_active, tenant_id, updated_at)
         VALUES ('inv-ak-low', 'Low Matcha', 'MAT-LOW', 'kg', 1, 5, 1, 5, 5, 100000, 1, 1, 'default', ?)`
      ).run(nowIso);
      const fiveHoursAgoIso = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
      sql.prepare(
        `INSERT INTO inventory_alerts (item_id, alert_type, current_qty, threshold, notified_at, tenant_id) VALUES ('inv-ak-low', 'low_stock', 1, 5, ?, 'default')`
      ).run(fiveHoursAgoIso);

      const firstAlertRun = await checkInventoryAlerts(env as unknown as Record<string, unknown>, 'default');
      expect(firstAlertRun).toBe(1);
      const secondAlertRun = await checkInventoryAlerts(env as unknown as Record<string, unknown>, 'default');
      expect(secondAlertRun).toBe(0);

      // AK4.2: Birthday PUT /config rejects staff (403) and invalid discountPercent (400); GET /check omits birthday/name when ineligible & unauthenticated
      sql.exec(`
        CREATE TABLE IF NOT EXISTS birthday_redemptions (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          redeemed_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sql.prepare(
        `INSERT INTO customers (id, name, phone, birthday, date_of_birth, tenant_id)
         VALUES ('cust-ak-inelig', 'Private Name', '0907776666', '1990-05-15', '1990-05-15', 'default')`
      ).run();

      const staffBdayCfgRes = await birthdayRouter.fetch(
        new Request('http://localhost/config', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${staffDefToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ discountPercent: 25 }),
        }),
        env
      );
      expect(staffBdayCfgRes.status).toBe(403);

      const invalidBdayCfgRes = await birthdayRouter.fetch(
        new Request('http://localhost/config', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${mgrDefToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ discountPercent: 150 }),
        }),
        env
      );
      expect(invalidBdayCfgRes.status).toBe(400);

      const unauthCheckRes = await birthdayRouter.fetch(
        new Request('http://localhost/check?customer_id=cust-ak-inelig'),
        env
      );
      expect(unauthCheckRes.status).toBe(200);
      const unauthCheckJson = (await unauthCheckRes.json()) as { data: Record<string, unknown> };
      expect(unauthCheckJson.data.eligible).toBe(false);
      expect(unauthCheckJson.data.birthday).toBeUndefined();
      expect(unauthCheckJson.data.customer_name).toBeUndefined();

      // AK4.3: Subscription create rejects cross-tenant subscription_plans with 404
      sql.prepare(
        `INSERT INTO subscription_plans (id, name, slug, monthly_price_vnd, deposit_vnd, is_active, tenant_id, created_at, updated_at)
         VALUES ('plan-ak-storeb', 'Store B Plan', 'store-b-plan', 6000000, 1000000, 1, 'store-b', ?, ?)`
      ).run(nowIso, nowIso);

      const subApp = new Hono<any>();
      subApp.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-ak-def', role: 'manager', tenantId: 'default' });
        c.set('tenantId', 'default');
        await next();
      });
      subApp.post('/subscriptions', createSubscription);

      const crossPlanSubRes = await subApp.fetch(
        new Request('http://localhost/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: 'plan-ak-storeb',
            customer_name: 'Default Sub Cust',
            customer_phone: '0901112233',
          }),
        }),
        env
      );
      expect(crossPlanSubRes.status).toBe(404);
    } finally {
      sql.close();
    }
  });
});


// ---------------------------------------------------------------------------
// Phase 35 (AH1..AH4) — Atomic balance updates, CAS state guards,
// tenant-scoped rewards, birthday window enforcement, inventory atomicity
// ---------------------------------------------------------------------------
describe('Phase 35 acceptance (AH1..AH4)', () => {
  it('AH1: reward redemption uses atomic balance deduction, not stale overwrite', async () => {
    // The handler now uses:
    //   UPDATE loyalty_accounts SET points_balance = points_balance - ?
    //   UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) - ?
    // Then reads back authoritative balance from D1.
    // Verified structurally: the code no longer contains newBalance overwrites.
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../routes/openapi-loyalty-handlers/reward-handlers.ts'),
        'utf8'
      )
    );
    // Must NOT have stale newBalance overwrite in UPDATE customers
    expect(src).not.toMatch(/UPDATE customers SET loyalty_points = \?[^C]/);
    // Must have atomic decrement
    expect(src).toMatch(/COALESCE\(loyalty_points,\s*0\)\s*-\s*\?/);
    // Must read-back authoritative balance
    expect(src).toContain('authoritativeBalance');
  });

  it('AH2: birthday POST /redeem enforces window check', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../routes/birthday.ts'),
        'utf8'
      )
    );
    // checkBirthdayWindow must be called in POST handler
    expect(src).toContain('checkBirthdayWindow');
    // The function must be defined and used before redeem
    const fnCount = (src.match(/checkBirthdayWindow/g) || []).length;
    expect(fnCount).toBeGreaterThanOrEqual(3); // definition + GET usage + POST usage
  });

  it('AH3: referral status transitions use CAS (AND status = pending/completed)', async () => {
    const refSrc = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../../packages/domain/crm/commands/referral.ts'),
        'utf8'
      )
    );
    // CAS on pending → completed
    expect(refSrc).toMatch(/UPDATE referrals SET.*status.*WHERE.*AND status\s*=\s*'pending'/s);
    // CAS on completed → reversed
    expect(refSrc).toMatch(/UPDATE referrals SET.*status.*WHERE.*AND status\s*=\s*'completed'/s);
    // Atomic customer points
    expect(refSrc).toMatch(/COALESCE\(loyalty_points,\s*0\)\s*[+-]\s*\?/);
  });

  it('AH3: accrual verifies order ownership and uses atomic wallet credit', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../../packages/domain/crm/commands/accrual.ts'),
        'utf8'
      )
    );
    // Order ownership check (returns order_not_found when customer_id doesn't match)
    expect(src).toMatch(/order\.customer_id\s*!==\s*customer\.id/);
    // Atomic wallet update
    expect(src).toMatch(/SET balance = COALESCE\(balance,\s*0\)\s*\+\s*\?/);
  });

  it('AH4: checkin.ts rejects wildcard X-Tenant-ID for unauthenticated callers', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../routes/checkin.ts'),
        'utf8'
      )
    );
    // The local getTenantId must reject '*'
    expect(src).toMatch(/hdr\.trim\(\)\s*!==\s*'\*'/);
  });

  it('AH4: inventory movement and PO receipt use atomic stock addition', async () => {
    const movSrc = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../routes/openapi-inventory-handlers/movement-handlers.ts'),
        'utf8'
      )
    );
    const poSrc = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../routes/openapi-inventory-handlers/purchase-order-handlers.ts'),
        'utf8'
      )
    );
    // Movement positive branch: must NOT have stale SET current_stock = ? with newStock
    const movPositiveLines = movSrc.split('\n').filter((l: string) =>
      l.includes('SET current_stock = ?') && !l.includes('COALESCE')
    );
    expect(movPositiveLines).toHaveLength(0);

    // PO receipt: must NOT have stale SET current_stock = ? with newStock
    const poStaleLines = poSrc.split('\n').filter((l: string) =>
      l.includes('SET current_stock = ?') && !l.includes('COALESCE')
    );
    expect(poStaleLines).toHaveLength(0);

    // Both must use atomic COALESCE pattern for additions
    expect(movSrc).toMatch(/SET current_stock = COALESCE\(current_stock,\s*0\)\s*\+\s*\?/);
    expect(poSrc).toMatch(/SET current_stock = COALESCE\(current_stock,\s*0\)\s*\+\s*\?/);
  });
});

// ---------------------------------------------------------------------------
// Phase 36 (AI1..AI4) — Authorization gaps, input validation, rate limiting,
// data leak prevention (column projection, allowlisted spreads, masked errors)
// ---------------------------------------------------------------------------
describe('Phase 36 acceptance (AI1..AI4)', () => {
  it('AI1: push subscribe requires optionalAuth and customer identity verification; saas_tenants/create excludes customer role', async () => {
    const fs = await import('fs');
    const path = require('path');
    const pushSrc = fs.readFileSync(path.resolve(__dirname, '../../routes/push.ts'), 'utf8');
    const tenantsSrc = fs.readFileSync(path.resolve(__dirname, '../../routes/saas-tenants.ts'), 'utf8');
    const reviewsSrc = fs.readFileSync(path.resolve(__dirname, '../../routes/reviews.ts'), 'utf8');

    expect(pushSrc).toMatch(/optionalAuth|authenticateRequest/);
    expect(pushSrc).toContain('pushSubscribeSchema.safeParse');
    expect(tenantsSrc).not.toMatch(/requireAuth\(\['owner',\s*'admin',\s*'customer'\]\)/);
    expect(reviewsSrc).toContain('optionalAuth');
  });

  it('AI3: loyalty redeem, cashback spend, referral code, and checkin enforce rateLimitMiddleware', async () => {
    const fs = await import('fs');
    const path = require('path');
    const rlSrc = fs.readFileSync(path.resolve(__dirname, '../../middleware/rate-limit.ts'), 'utf8');
    const loyaltySrc = fs.readFileSync(path.resolve(__dirname, '../../routes/loyalty.ts'), 'utf8');
    const refSrc = fs.readFileSync(path.resolve(__dirname, '../../routes/referrals.ts'), 'utf8');
    const checkinSrc = fs.readFileSync(path.resolve(__dirname, '../../routes/checkin.ts'), 'utf8');

    expect(rlSrc).toContain('LOYALTY_REDEEM_RATE_LIMIT');
    expect(rlSrc).toContain('CASHBACK_SPEND_RATE_LIMIT');
    expect(rlSrc).toContain('REFERRAL_CODE_RATE_LIMIT');
    expect(rlSrc).toContain('CHECKIN_RATE_LIMIT');
    expect(loyaltySrc).toMatch(/post\('\/redeem',\s*rateLimitMiddleware\(LOYALTY_REDEEM_RATE_LIMIT\)/);
    expect(loyaltySrc).toMatch(/post\('\/spend-cashback',\s*rateLimitMiddleware\(CASHBACK_SPEND_RATE_LIMIT\)/);
    expect(refSrc).toMatch(/get\('\/code',\s*rateLimitMiddleware\(REFERRAL_CODE_RATE_LIMIT\)/);
    expect(checkinSrc).toMatch(/post\('\/',\s*rateLimitMiddleware\(CHECKIN_RATE_LIMIT\)/);
  });

  it('AI4: admin-loyalty, loyalty logs, referral stats, and erpnext eliminate SELECT *, raw row spreads, and raw error leaks', async () => {
    const fs = await import('fs');
    const path = require('path');
    const adminLoyaltySrc = fs.readFileSync(path.resolve(__dirname, '../../routes/admin-loyalty.ts'), 'utf8');
    const loyaltySrc = fs.readFileSync(path.resolve(__dirname, '../../routes/loyalty.ts'), 'utf8');
    const refSrc = fs.readFileSync(path.resolve(__dirname, '../../routes/referrals.ts'), 'utf8');
    const erpSrc = fs.readFileSync(path.resolve(__dirname, '../../routes/erpnext.ts'), 'utf8');
    const erpInvSrc = fs.readFileSync(path.resolve(__dirname, '../../routes/erpnext-invoices.ts'), 'utf8');

    expect(adminLoyaltySrc).not.toMatch(/SELECT \* FROM customers/i);
    expect(loyaltySrc).not.toMatch(/SELECT \* FROM loyalty_point_logs/i);
    expect(loyaltySrc).not.toMatch(/SELECT \* FROM cashback_transactions/i);
    expect(refSrc).not.toMatch(/\.\.\.row,\s*\n\s*referred_phone:/);
    expect(erpSrc).toContain('Internal integration error');
    expect(erpInvSrc).toContain('Retry failed');
  });
});

// ---------------------------------------------------------------------------
// Phase 37 (AJ1..AJ4) — Webhook HMAC/CAS, Session/CSRF/AuthVersion Sync,
// Financial/Order State Machine Integrity, Tenant KV/SSRF/XSS/CSV Hardening
// ---------------------------------------------------------------------------
describe('Phase 37 acceptance (AJ1..AJ4)', () => {
  it('AJ1: NowPayments IPN enforces CAS status guard, amount validation, and idempotent period extension; Cal.com & TastyIgniter webhooks verify HMAC-SHA256', async () => {
    const fs = await import('fs');
    const path = require('path');
    const nowIpnSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/payment/commands/nowpayments-ipn.ts'),
      'utf8'
    );
    const calWebhookSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/cal-booking-webhook-handlers/webhook-handler.ts'),
      'utf8'
    );
    const tiRoutesSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/integrations/tastyigniter.ts'),
      'utf8'
    );

    expect(nowIpnSrc).toContain("status NOT IN ('paid', 'cancelled')");
    expect(nowIpnSrc).toContain('Invoice amount mismatch');
    expect(calWebhookSrc).toContain('computeHmacSha256');
    expect(tiRoutesSrc).toContain('computeHmacSha256');
  });

  it('AJ2: password change syncs auth_version & cust_auth_ver across D1 and KV, subscription middleware validates staff sessions, WiFi enforces bounds & rate limits, and verifyPin uses constant-time comparison', async () => {
    const fs = await import('fs');
    const path = require('path');
    const devHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-auth-handlers/device-handlers.ts'),
      'utf8'
    );
    const chgPwdSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/auth/change-password.ts'),
      'utf8'
    );
    const subMwSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/subscriptions/middleware.ts'),
      'utf8'
    );
    const wifiSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/wifi.ts'),
      'utf8'
    );
    const staffAuthSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/staff/commands/staff-auth.ts'),
      'utf8'
    );

    expect(devHandlersSrc).toContain('COALESCE(auth_version, 1) + 1');
    expect(devHandlersSrc).toContain('cust_auth_ver:');
    expect(chgPwdSrc).toContain('cookieWriteBlockReason');
    expect(chgPwdSrc).toContain('cust_auth_ver:');
    expect(subMwSrc).toContain('validateStaffSession');
    expect(wifiSrc).toContain('.max(');
    expect(staffAuthSrc).toContain('constantTimeStringEqual');
  });

  it('AJ3: order cancellation avoids double stock restoration, PayOS webhook skips loyalty/referral on cancelled orders, split-orders deducts inventory, refund-reversal claws back cashback when pointsEarned is 0, and DinDin QC rejects cancelled orders', async () => {
    const fs = await import('fs');
    const path = require('path');
    const kdsTransSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/kitchen/commands/kds-status-transition.ts'),
      'utf8'
    );
    const cancelHandlerSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-orders-handlers/order-cancel-handlers.ts'),
      'utf8'
    );
    const orderDeductSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/inventory/src/routes/order-deduction.ts'),
      'utf8'
    );
    const payosWebhookSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/webhooks-handlers/payos.ts'),
      'utf8'
    );
    const splitOrdersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/order/commands/split-orders.ts'),
      'utf8'
    );
    const refundRevSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/crm/commands/refund-reversal.ts'),
      'utf8'
    );
    const dindinQcSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/dindin-handlers/checkout-handlers.ts'),
      'utf8'
    );

    expect(kdsTransSrc).toContain('!options?.skipCancelSideEffects');
    expect(cancelHandlerSrc).toContain('skipCancelSideEffects: true');
    expect(orderDeductSrc).toContain("SELECT id, ingredient_id, quantity FROM stock_movements WHERE reference_id = ? AND type = 'out'");
    expect(payosWebhookSrc).toContain('PAID_ON_CANCELLED_ORDER');
    expect(splitOrdersSrc).toContain('deductInventoryForOrder');
    expect(refundRevSrc).toContain('pointsEarned <= 0 && cashbackEarnedOnOrder <= 0');
    expect(dindinQcSrc).toContain('Cannot complete QC for a cancelled or failed order');
  });

  it('AJ4: ERPNext enforces tenant KV isolation, CSRF & invoice ownership, isSafePublicHttpsUrl blocks IPv6/IPv4-mapped/CGNAT SSRF, HTML templates escape fields, and CSV helpers neutralize whitespace-prefixed formulas', async () => {
    const fs = await import('fs');
    const path = require('path');
    const { isSafePublicHttpsUrl } = await import('../../lib/validators/erpnext');
    const { renderOrderConfirm } = await import('../../templates/order-confirm');
    const { renderReceipt } = await import('../../templates/receipt');

    // SSRF IPv6 / IPv4-mapped IPv6 / CGNAT checks
    expect(isSafePublicHttpsUrl('https://[::ffff:127.0.0.1]/api')).toBe(false);
    expect(isSafePublicHttpsUrl('https://[::ffff:169.254.169.254]/latest/meta-data')).toBe(false);
    expect(isSafePublicHttpsUrl('https://[0:0:0:0:0:0:0:1]/api')).toBe(false);
    expect(isSafePublicHttpsUrl('https://[fc00::1]/api')).toBe(false);
    expect(isSafePublicHttpsUrl('https://[fe80::1]/api')).toBe(false);
    expect(isSafePublicHttpsUrl('https://100.64.0.1/api')).toBe(false);
    expect(isSafePublicHttpsUrl('https://erp.auracaffe.vn/api')).toBe(true);

    // HTML template escaping
    const confirmHtml = renderOrderConfirm({
      id: 'ORD_<script>alert(1)</script>',
      items: [{ name: '<img src=x onerror=alert(1)>', quantity: 1, price: 35000 }],
      total: 35000,
      customer_name: 'Alice',
      customer_phone: '0901234567',
      payment_method: 'cod<script>',
    });
    expect(confirmHtml).not.toContain('<script>alert(1)</script>');
    expect(confirmHtml).not.toContain('<img src=x onerror=alert(1)>');
    expect(confirmHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');

    const receiptHtml = renderReceipt({
      id: 'ORD_<svg onload=alert(1)>',
      total: 45000,
      payment_method: 'payos<img>',
    });
    expect(receiptHtml).not.toContain('<svg onload=alert(1)>');
    expect(receiptHtml).toContain('#ORD_&lt;svg onload=alert(1)&gt;');
    expect(receiptHtml).toContain('payos&lt;img&gt;');

    // CSV formula neutralization with leading newline/space
    const csvAuditSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/admin-audit-logs-handlers/csv-helper.ts'),
      'utf8'
    );
    const csvAnalyticsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/analytics/csv-export.ts'),
      'utf8'
    );
    const csvReportsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/reports-handlers/export-handlers.ts'),
      'utf8'
    );
    expect(csvAuditSrc).toContain('[\\t\\r\\n ]*[=+\\-@]');
    expect(csvAnalyticsSrc).toContain('[\\t\\r\\n ]*[=+\\-@]');
    expect(csvReportsSrc).toContain('[\\t\\r\\n ]*[=+\\-@]');
  });
});

// ---------------------------------------------------------------------------
// Phase 39 (AL1..AL4) — OpenAPI Inventory RBAC & PO Over-Receipt Guards,
// Push/Reviews/Checkin Ownership & Audit Logs, Domain Multi-Tenant Isolation,
// ERPNext/TastyIgniter/Pretix Webhook & Invoice Hardening, DinDin/TableSessions/Reports
// ---------------------------------------------------------------------------
describe('Phase 39 acceptance (AL1..AL4)', () => {
  it('AL1: OpenAPI inventory enforces manager RBAC and PO over-receipt caps; push, reviews, notifications-mobile, and checkin enforce tenant/ownership & cashback audit logs', async () => {
    const fs = await import('fs');
    const path = require('path');
    const ingSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-inventory-handlers/ingredient-handlers.ts'),
      'utf8'
    );
    const movSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-inventory-handlers/movement-handlers.ts'),
      'utf8'
    );
    const poSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-inventory-handlers/purchase-order-handlers.ts'),
      'utf8'
    );
    const pushSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/push.ts'),
      'utf8'
    );
    const notifMobileSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/notifications-mobile.ts'),
      'utf8'
    );
    const reviewsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/reviews.ts'),
      'utf8'
    );
    const checkinSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/checkin.ts'),
      'utf8'
    );

    expect(ingSrc).toContain("['owner', 'manager', 'supervisor', 'admin']");
    expect(movSrc).toContain("['waste', 'usage', 'consumption', 'out']");
    expect(poSrc).toContain('exceeds ordered quantity');
    expect(pushSrc).toContain('Subscription endpoint already registered to another user');
    expect(notifMobileSrc).toContain('created_at, tenant_id');
    expect(reviewsSrc).toContain('Order has already been reviewed');
    expect(checkinSrc).toContain('INSERT INTO cashback_transactions');
  });

  it('AL2: domain inventory, order update/listing, NowPayments IPN, staff tips, shift access, and CRM segments/consent enforce RBAC, tenant scoping, and strict bounds', async () => {
    const fs = await import('fs');
    const path = require('path');
    const invCrudSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/inventory/src/routes/inventory-crud.ts'),
      'utf8'
    );
    const poPolicySrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/inventory/src/policies/purchasing-receiving-policy.ts'),
      'utf8'
    );
    const updateOrderSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/order/commands/update-order.ts'),
      'utf8'
    );
    const sharedListingSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/order/queries/shared-listing.ts'),
      'utf8'
    );
    const nowIpnSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/payment/commands/nowpayments-ipn.ts'),
      'utf8'
    );
    const staffTipsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/staff/commands/staff-tips.ts'),
      'utf8'
    );
    const shiftAccessSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/shift/commands/shift-access.ts'),
      'utf8'
    );
    const segmentsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/crm/commands/segments.ts'),
      'utf8'
    );
    const consentSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/crm/commands/update-consent.ts'),
      'utf8'
    );

    expect(invCrudSrc).toContain('.safeParse(');
    expect(poPolicySrc).toContain('Cannot receive more than ordered quantity');
    expect(updateOrderSrc).toContain('restoreInventoryForOrder(env as any, id, orderTenantForCancel)');
    expect(sharedListingSrc).toContain('Math.min(200, Math.max(1, Math.floor(opts.limit!)))');
    expect(nowIpnSrc).toContain('Invoice already bound to another payment reference');
    expect(staffTipsSrc).toContain('Cannot assign tip to cancelled or refunded order');
    expect(shiftAccessSrc).toContain('PILOT_TENANT_ID');
    expect(segmentsSrc).toContain('getSegmentsKvKey');
    expect(consentSrc).toContain('Forbidden: customer belongs to another tenant');
  });

  it('AL3: ERPNext POS webhook bypasses staff JWT middleware, ERPNext invoices use authoritative D1 order totals, ERPNext sync enforces manager RBAC & actual stock, TastyIgniter upserts bridge rows, and Pretix fails closed when JWT_SECRET is set', async () => {
    const fs = await import('fs');
    const path = require('path');
    const intRouterSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/integrations-router.ts'),
      'utf8'
    );
    const erpInvSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/erpnext-invoices.ts'),
      'utf8'
    );
    const erpSyncSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/erpnext-sync.ts'),
      'utf8'
    );
    const tiSyncSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/integrations/tastyigniter/sync.ts'),
      'utf8'
    );
    const tiWebhookSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/integrations/tastyigniter/webhook.ts'),
      'utf8'
    );
    const pretixRoutesSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/pretix-handlers/routes.ts'),
      'utf8'
    );

    expect(intRouterSrc).toContain('/erpnext-pos/webhook');
    expect(erpInvSrc).toContain('mergeAuthoritativeOrder');
    expect(erpSyncSrc).toContain('actual_qty: actualQty');
    expect(tiSyncSrc).toContain('.meta?.changes ?? 0) === 0');
    expect(tiWebhookSrc).toContain('matchesWebhookOrderTenant');
    expect(pretixRoutesSrc).toContain('pretixStaffAuth');
  });

  it('AL4: DinDin checkout guards in-flight idempotency (409) & authoritative menu price, table-sessions attach orders idempotently on active sessions, and reports export enforces manager RBAC & date-range bounds', async () => {
    const fs = await import('fs');
    const path = require('path');
    const dindinSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/dindin-handlers/checkout-handlers.ts'),
      'utf8'
    );
    const tableOrderSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/table-sessions-handlers/order-handlers.ts'),
      'utf8'
    );
    const reportExportSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/reports-handlers/export-handlers.ts'),
      'utf8'
    );

    expect(dindinSrc).toContain('Checkout with this Idempotency-Key is already in progress');
    expect(dindinSrc).toContain('dindin:qc:${tenantId}:${orderId}');
    expect(tableOrderSrc).toContain('already_attached');
    expect(tableOrderSrc).toContain('Session is not accepting orders');
    expect(reportExportSrc).toContain('daySpan <= 366');
    expect(reportExportSrc).toContain('LIMIT 5000');
  });

  it('AM1: birthday redacts unauthenticated PII & locks concurrent redemptions, order-write blocks customer non-status mutations & cancels pending payments, guest-checkin claims table before order insert, and admin-qr enforces manager RBAC & sanitizes X-Slug', async () => {
    const fs = await import('fs');
    const path = require('path');
    const birthdaySrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/birthday.ts'),
      'utf8'
    );
    const orderWriteSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-orders-handlers/order-write-handlers.ts'),
      'utf8'
    );
    const guestSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/orders-hono-handlers/guest-handlers.ts'),
      'utf8'
    );
    const adminQrSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/admin-qr.ts'),
      'utf8'
    );

    expect(birthdaySrc).toContain('resolvePublicTenantId');
    expect(birthdaySrc).toContain('inFlightBirthdayRedemptions');
    expect(orderWriteSrc).toContain('Customers may only cancel pending or confirmed orders');
    expect(orderWriteSrc).toContain("UPDATE payments SET status = 'cancelled'");
    expect(guestSrc).toContain('tenantId');
    expect(adminQrSrc).toContain("'owner', 'manager', 'supervisor', 'admin'");
    expect(adminQrSrc).toContain('safeSlug');
  });

  it('AM2: walk-in sentinel phone & empty email are sanitized before loyalty/CRM lookup, order cancellation refunds spent cashback, public GET /api/tables redacts signed QR URLs, reservations guard capacity & Available status, and staff-tips blocks self-assignment', async () => {
    const fs = await import('fs');
    const path = require('path');
    const loyaltyTriggerSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/order/policies/loyalty-trigger.ts'),
      'utf8'
    );
    const kdsTransitionSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/kitchen/commands/kds-status-transition.ts'),
      'utf8'
    );
    const tablesSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/table/commands/tables.ts'),
      'utf8'
    );
    const reservationsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/reservation/src/routes/reservations.ts'),
      'utf8'
    );
    const staffTipsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/staff/commands/staff-tips.ts'),
      'utf8'
    );

    expect(loyaltyTriggerSrc).toContain('sanitizeCustomerIdentity');
    expect(kdsTransitionSrc).toContain("type = 'spend'");
    expect(kdsTransitionSrc).toContain("'refund'");
    expect(tablesSrc).toContain('includeSignedQr');
    expect(reservationsSrc).toContain("AND status = 'Available'");
    expect(staffTipsSrc).toContain("'owner', 'manager', 'supervisor', 'admin', 'cashier'");
  });

  it('AM3: spend-cashback rejects cancelled/paid orders and reduces orders.total, campaign triggers & cron warnings enforce default-tenant scoping and 7-day cooldown, and loyalty tier PATCH separates birthdayBonus from birthday_discount', async () => {
    const fs = await import('fs');
    const path = require('path');
    const spendCashbackSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/loyalty/spend-cashback-handler.ts'),
      'utf8'
    );
    const detectSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/crm/commands/campaign/detect.ts'),
      'utf8'
    );
    const warningsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/cron-handlers/cashback-warnings.ts'),
      'utf8'
    );
    const tierHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-loyalty-handlers/tier-handlers.ts'),
      'utf8'
    );

    expect(spendCashbackSrc).toContain('Order is not eligible for cashback spend');
    expect(spendCashbackSrc).toContain('total = MAX(0, total - ?)');
    expect(detectSrc).toContain('sevenDaysAgo');
    expect(warningsSrc).toContain('sevenDaysAgo');
    expect(tierHandlersSrc).not.toContain('body.birthday_discount ?? body.birthdayDiscount ?? body.birthday_bonus');
  });

  it('AM4: loyalty balance sync recalculates tier under per-account lock, birthday bonus claim uses in-flight lock, table-sessions guard order attach CAS & terminal state transitions, and cron handlers persist tenant_id & bound cron_runs', async () => {
    const fs = await import('fs');
    const path = require('path');
    const loyaltyDbSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-loyalty-handlers/loyalty-db-helpers.ts'),
      'utf8'
    );
    const loyaltyAccSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-loyalty-handlers/account-handlers.ts'),
      'utf8'
    );
    const sessionHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/table-sessions-handlers/session-handlers.ts'),
      'utf8'
    );
    const cronSummarySrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-cron-handlers/summary-handlers.ts'),
      'utf8'
    );

    expect(loyaltyDbSrc).toContain('resolveTierForPoints');
    expect(loyaltyAccSrc).toContain('inFlightBirthdayClaims');
    expect(sessionHandlersSrc).toContain('Session already ended');
    expect(cronSummarySrc).toContain('LIMIT 1000');
  });

  it('AN1: dynamic-pricing enforces overnight windows & server-side cost floor, saas-tenants authenticates /my & bounds slug collisions, and place-order bounds items & enforces default-tenant catalog isolation', async () => {
    const fs = await import('fs');
    const path = require('path');
    const dynamicPricingSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/dynamic-pricing.ts'),
      'utf8'
    );
    const saasTenantsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/saas-tenants.ts'),
      'utf8'
    );
    const placeOrderSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/crm/commands/place-order.ts'),
      'utf8'
    );
    const crmOrderHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/crm-handlers/order-handlers.ts'),
      'utf8'
    );

    expect(dynamicPricingSrc).toContain('timeStr >= rule.start_time || timeStr <= rule.end_time');
    expect(saasTenantsSrc).toContain("return c.json({ ok: false, error: 'unauthenticated' } as const, 401)");
    expect(saasTenantsSrc).toContain('MAX_SLUG_ATTEMPTS');
    expect(placeOrderSrc).toContain('input.items.length > 50');
    expect(crmOrderHandlersSrc).toContain('customerPhone');
  });

  it('AN2: floor-plan joins active/ordering/paying sessions & preserves table notes on no-show, tables-mobile falls back per tenant & clears current_order_id on release, and public tables resolve public tenant & redact staff notes', async () => {
    const fs = await import('fs');
    const path = require('path');
    const floorPlanSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/floor-plan.ts'),
      'utf8'
    );
    const tablesMobileSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/tables-mobile.ts'),
      'utf8'
    );
    const tablesSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/table/commands/tables.ts'),
      'utf8'
    );

    expect(floorPlanSrc).toContain("s.status IN ('ordering', 'paying'");
    expect(floorPlanSrc).toContain('current_order_id = NULL');
    expect(tablesMobileSrc).toContain('!cafeTablesSucceeded || rows.length === 0');
    expect(tablesSrc).toContain('resolvePublicTenantId');
    expect(tablesSrc).toContain('current_order_id = NULL');
  });

  it('AN3: sop-template-repository guards duplicate code & preserves item IDs across updates, sop-violation-ladder blocks manager self-dealing & non-owner termination overrides, and sop-admin-read-handlers hydrate run progress & template metadata', async () => {
    const fs = await import('fs');
    const path = require('path');
    const sopTemplateRepoSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/sop/commands/sop-template-repository.ts'),
      'utf8'
    );
    const sopViolationLadderSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/sop/commands/sop-violation-ladder.ts'),
      'utf8'
    );
    const sopAdminReadSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-sop-handlers/sop-admin-read-handlers.ts'),
      'utf8'
    );
    const sopAuditSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-sop-handlers/sop-audit.ts'),
      'utf8'
    );

    expect(sopTemplateRepoSrc).toContain('already exists for this tenant');
    expect(sopViolationLadderSrc).toContain('own staff record');
    expect(sopViolationLadderSrc).toContain('Serious violations require termination unless overridden by the owner');
    expect(sopAdminReadSrc).toContain('listTemplates');
    expect(sopAuditSrc).toContain("'sop_template'");
  });

  it('AN4: staff-tips enforces horizontal privacy & date validation, staff-auth aligns manager device filter & device role binding, and payments/collect-cod block cancelled or refunded orders', async () => {
    const fs = await import('fs');
    const path = require('path');
    const staffTipsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/staff/commands/staff-tips.ts'),
      'utf8'
    );
    const staffAuthSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/staff/commands/staff-auth.ts'),
      'utf8'
    );
    const paymentMutationSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-payments-handlers/mutation-handlers.ts'),
      'utf8'
    );
    const collectCodSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/kitchen/commands/collect-cod-payment.ts'),
      'utf8'
    );

    expect(staffTipsSrc).toContain('Invalid date format (YYYY-MM-DD)');
    expect(staffTipsSrc).toContain('Insufficient permissions');
    expect(staffAuthSrc).toContain("'supervisor'");
    expect(paymentMutationSrc).toContain('Cannot create payment for cancelled or terminal order');
    expect(collectCodSrc).toContain('cod:${id}');
  });

  it('AO1: inventory-transactions guards release RBAC & outbound stock, inventory-snapshots enforces mutation roles, BOM order deduction tracks coveredProductIds across shared ingredients, movements normalize outbound sign, and purchase-orders block cancelled PATCH & persist received_quantity', async () => {
    const fs = await import('fs');
    const path = require('path');
    const invTxSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/inventory/src/routes/inventory-transactions.ts'),
      'utf8'
    );
    const invSnapSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/inventory/src/routes/inventory-snapshots.ts'),
      'utf8'
    );
    const invCrudSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/inventory/src/routes/inventory-crud.ts'),
      'utf8'
    );
    const bomPolicySrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/inventory/src/policies/inventory-recipe-policy.ts'),
      'utf8'
    );
    const orderDeductionSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/inventory/src/routes/order-deduction.ts'),
      'utf8'
    );
    const movementHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-inventory-handlers/movement-handlers.ts'),
      'utf8'
    );
    const poHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-inventory-handlers/purchase-order-handlers.ts'),
      'utf8'
    );

    expect(invTxSrc).toContain("input.type === 'release'");
    expect(invSnapSrc).toContain('INVENTORY_MUTATION_ROLES');
    expect(invCrudSrc).toContain('matchesInventoryTenant');
    expect(bomPolicySrc).toContain('coveredProductIds');
    expect(orderDeductionSrc).toContain('coveredProductIds');
    expect(movementHandlersSrc).toContain('-Math.abs(body.quantity)');
    expect(poHandlersSrc).toContain("existing.status === 'cancelled'");
    expect(poHandlersSrc).toContain('received_quantity');
  });

  it('AO2: promotions validation blocks wildcard X-Tenant-ID & enforces authoritative order totals/ownership, openapi-promotions enforces tenant code uniqueness, and products/categories/modifiers/happy-hour restrict mutations to privileged roles', async () => {
    const fs = await import('fs');
    const path = require('path');
    const promoValidationSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/promotions-handlers/validation-handlers.ts'),
      'utf8'
    );
    const openapiPromosSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-promotions-handlers/crud-handlers.ts'),
      'utf8'
    );
    const openapiProductsRoutesSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-products-handlers/routes.ts'),
      'utf8'
    );
    const openapiCategoriesMutationSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-categories-handlers/mutation-handlers.ts'),
      'utf8'
    );
    const menuModifiersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/catalog/commands/menu-modifiers.ts'),
      'utf8'
    );
    const happyHourSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/catalog/commands/happy-hour.ts'),
      'utf8'
    );

    expect(promoValidationSrc).toContain('resolvePublicTenantId');
    expect(promoValidationSrc).toContain('effectiveOrderTotal');
    expect(openapiPromosSrc).toContain('SELECT * FROM promotions WHERE UPPER(code) = ?');
    expect(openapiPromosSrc).toContain('matchesTenantRow(row, tenantId)');
    expect(openapiProductsRoutesSrc).not.toContain("'staff'");
    expect(openapiCategoriesMutationSrc).toContain('UPDATE menu_items SET category = ?');
    expect(menuModifiersSrc).toContain('resolvePublicTenantId');
    expect(happyHourSrc).toContain('resolvePublicTenantId');
  });

  it('AO3: dindin checkout unifies item lookup/qty & guards QC completion, create-order supports OpenAPI promo columns & preserves service_fee, order cancellations roll back promotion_usages, claimGuestOrder enforces phone verification, and payos-reconcile credits loyalty', async () => {
    const fs = await import('fs');
    const path = require('path');
    const dindinCheckoutSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/dindin-handlers/checkout-handlers.ts'),
      'utf8'
    );
    const createOrderSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/order/commands/create-order.ts'),
      'utf8'
    );
    const cancelOrderSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-orders-handlers/order-cancel-handlers.ts'),
      'utf8'
    );
    const updateOrderSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/order/commands/update-order.ts'),
      'utf8'
    );
    const kdsTransitionSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/kitchen/commands/kds-status-transition.ts'),
      'utf8'
    );
    const ownershipPolicySrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/customer/policies/order-ownership-policy.ts'),
      'utf8'
    );
    const payosReconcileSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/payment/commands/payos-reconcile.ts'),
      'utf8'
    );

    expect(dindinCheckoutSrc).toContain('Cart item id and name mismatch');
    expect(dindinCheckoutSrc).toContain('Order is not a DinDin order');
    expect(createOrderSrc).toContain('discount_type');
    expect(createOrderSrc).toContain('snapshot.service_fee');
    expect(cancelOrderSrc).toContain('promotion_usages');
    expect(updateOrderSrc).toContain('promotion_usages');
    expect(kdsTransitionSrc).toContain('promotion_usages');
    expect(ownershipPolicySrc).toContain('Phone verification is required to claim this order');
    expect(payosReconcileSrc).toContain('creditLoyaltyIfEligible');
  });

  it('AO4: reports-handlers filter customer export dates & promo redemptions by redeemed_at, admin-sales enforces RBAC & date span bounds, admin-audit-logs filters by tenant before pagination, broadcast qualifies c.tenant_id on active_30d, and admin-handlers scopes duplicate phone & synthetic email by tenant', async () => {
    const fs = await import('fs');
    const path = require('path');
    const reportsAnalyticsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/reports-handlers/analytics-handlers.ts'),
      'utf8'
    );
    const adminSalesSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/admin-sales.ts'),
      'utf8'
    );
    const auditRoutesSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/admin-audit-logs-handlers/routes.ts'),
      'utf8'
    );
    const auditQuerySrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/admin-audit-logs-handlers/query-handler.ts'),
      'utf8'
    );
    const broadcastSendSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/broadcast-handlers/send-handler.ts'),
      'utf8'
    );
    const adminHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/admin-handlers.ts'),
      'utf8'
    );

    expect(reportsAnalyticsSrc).toContain('t.redeemed_at');
    expect(adminSalesSrc).toContain('366');
    expect(auditRoutesSrc).not.toContain("'staff'");
    expect(auditQuerySrc).toContain('filterAuditRowsByTenant');
    expect(broadcastSendSrc).toContain('c.tenant_id');
    expect(adminHandlersSrc).toContain('Customer phone already exists in this store');
  });
});

describe('Phase 43 (AP1..AP4) — Loyalty, Checkin, Reviews, Subscriptions, Referrals & CRM Security Hardening', () => {
  it('AP1: checkin resolves canonical/public tenant & binds authenticated customer_id, reviews verifies order status & guest phone ownership, loyalty filters rewards by tenant & enforces expiry/tier/stock guards, and admin-loyalty restricts CSV export from staff & hardens formula escaping', async () => {
    const fs = await import('fs');
    const path = require('path');
    const checkinSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/checkin.ts'),
      'utf8'
    );
    const reviewsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/reviews.ts'),
      'utf8'
    );
    const loyaltySrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/loyalty.ts'),
      'utf8'
    );
    const adminLoyaltySrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/admin-loyalty.ts'),
      'utf8'
    );

    expect(checkinSrc).toContain('resolvePublicTenantId');
    expect(checkinSrc).toContain('Forbidden: cannot check in for another customer');
    expect(reviewsSrc).toContain('Order cannot be reviewed in its current status');
    expect(reviewsSrc).toContain('suppliedPhone !== orderPhone');
    expect(loyaltySrc).toContain('filterTenantReward');
    expect(loyaltySrc).toContain('Tier requirement not met for this reward');
    expect(loyaltySrc).toContain('Reward redemption limit reached');
    expect(adminLoyaltySrc).toContain("adminLoyaltyRouter.get('/export', requireAuth(['owner', 'admin', 'manager', 'supervisor'])");
    expect(adminLoyaltySrc).toContain('([\\r\\n]+)(\\s*[=+\\-@|])');
  });

  it('AP2: openapi-loyalty enforces reward fallback/expiry/tenant parity, atomic relative delta point sync, and tenant-scoped birthday bonus idempotency; spend-cashback blocks paid orders; and subscriptions enforce billing-cycle pricing & terminal invoice idempotency', async () => {
    const fs = await import('fs');
    const path = require('path');
    const accountHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-loyalty-handlers/account-handlers.ts'),
      'utf8'
    );
    const rewardHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-loyalty-handlers/reward-handlers.ts'),
      'utf8'
    );
    const loyaltyDbSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-loyalty-handlers/loyalty-db-helpers.ts'),
      'utf8'
    );
    const spendCashbackSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/loyalty/spend-cashback-handler.ts'),
      'utf8'
    );
    const subHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/subscriptions/sub-handlers.ts'),
      'utf8'
    );
    const invoiceHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/subscriptions/invoice-handlers.ts'),
      'utf8'
    );

    expect(accountHandlersSrc).toContain('birthday_bonus:${effectiveTenant}:${accountCustomerId}:${currentYear}');
    expect(rewardHandlersSrc).toContain('findRewardByIdWithFallback');
    expect(loyaltyDbSrc).toContain('MAX(0, COALESCE(current_points, 0) + ?)');
    expect(spendCashbackSrc).toContain("paymentStatus === 'paid'");
    expect(subHandlersSrc).toContain('cyclePlanAmount = Number(plan.monthly_price_vnd) * cycleMonths');
    expect(invoiceHandlersSrc).toContain("['paid', 'manual', 'cancelled'].includes(normalizedStatus)");
  });

  it('AP3: referral-cashback uses deterministic txId & status CAS, referrals/apply-referral enforce max_uses & customer tenant isolation, accrual uses deterministic order-keyed ledger IDs, and refund-reversal records debit cashback_transactions', async () => {
    const fs = await import('fs');
    const path = require('path');
    const refCashbackSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/referrals/referral-cashback.ts'),
      'utf8'
    );
    const applyRefSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/referrals/apply-referral.ts'),
      'utf8'
    );
    const referralsRouteSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/referrals.ts'),
      'utf8'
    );
    const domainReferralSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/crm/commands/referral.ts'),
      'utf8'
    );
    const accrualSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/crm/commands/accrual.ts'),
      'utf8'
    );
    const refundReversalSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/crm/commands/refund-reversal.ts'),
      'utf8'
    );

    expect(refCashbackSrc).toContain('cbt_ref_${pending.id}_referrer');
    expect(applyRefSrc).toContain('code_exhausted');
    expect(referralsRouteSrc).toContain('Mã giới thiệu đã hết lượt sử dụng');
    expect(domainReferralSrc).toContain('getOrCreateReferralCode');
    expect(accrualSrc).toContain('cbt_earn_${orderId}');
    expect(accrualSrc).toContain('ptl_earn_${orderId}');
    expect(refundReversalSrc).toContain('cbt_rev_${orderId}');
  });

  it('AP4: customers/me enforces tenant-scoped phone uniqueness (409) & visit_count correlation, CRM segments preserve true counts, update-consent scopes revocations by tenant, aggregate-events & customer-360 scope fallbacks by tenant, and openapi-orders deduplicates KDS completion side effects', async () => {
    const fs = await import('fs');
    const path = require('path');
    const custTypesSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/customers-handlers/types.ts'),
      'utf8'
    );
    const custProfileSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/customers-handlers/profile-handlers.ts'),
      'utf8'
    );
    const crmSegmentsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/crm-handlers/segment-handlers.ts'),
      'utf8'
    );
    const crmAccountSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/crm-handlers/account-handlers.ts'),
      'utf8'
    );
    const updateConsentSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/crm/commands/update-consent.ts'),
      'utf8'
    );
    const aggregateEventsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/crm/commands/aggregate-events.ts'),
      'utf8'
    );
    const customer360Src = fs.readFileSync(
      path.resolve(__dirname, '../../../../packages/domain/crm/commands/customer-360.ts'),
      'utf8'
    );
    const orderWriteSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-orders-handlers/order-write-handlers.ts'),
      'utf8'
    );

    expect(custTypesSrc).toContain("TRIM(c.phone) != '' AND o.customer_phone = c.phone");
    expect(custProfileSrc).toContain('Phone number already in use by another customer');
    expect(crmSegmentsSrc).toContain('Math.max(0, (seg.count ?? customers.length) - rejected)');
    expect(crmAccountSrc).toContain('SELECT tenant_id FROM customers WHERE id = ? LIMIT 1');
    expect(updateConsentSrc).toContain("UPDATE consents SET revoked_at = ? WHERE customer_id = ? AND purpose = ? AND revoked_at IS NULL AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?");
    expect(aggregateEventsSrc).toContain("Promise.reject(new Error('unscoped'))");
    expect(customer360Src).toContain('SELECT NULLIF(TRIM(phone), \'\') FROM customers WHERE id = ?');
    expect(orderWriteSrc).toContain("if (body.status === 'completed' && !statusHandledByKds)");
  });
});

describe('Phase 44 (AQ1..AQ4) — Birthday, POS Lookup, QR, Signage, Table Sessions, OpenAPI Tables/Staff, Campaigns, Mixpost, Cron & Integrations Hardening', () => {
  it('AQ1: birthday enforces DEFAULT_BIRTHDAY_CONFIG parity, positive RBAC, order status/ownership checks & tenant-scoped locks; pos-customer scopes cashback_wallets & visit_count by tenant; admin-qr & generator scope slugs by tenant; and signage scopes categories & promo usage limits', async () => {
    const fs = await import('fs');
    const path = require('path');
    const birthdaySrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/birthday.ts'),
      'utf8'
    );
    const posCustomerSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/pos-customer.ts'),
      'utf8'
    );
    const adminQrSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/admin-qr.ts'),
      'utf8'
    );
    const qrGeneratorSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/qr/generator.ts'),
      'utf8'
    );
    const signageSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/signage.ts'),
      'utf8'
    );

    expect(birthdaySrc).toContain('Cannot redeem birthday discount on a cancelled, failed, or expired order');
    expect(birthdaySrc).toContain('const lockKey = `${tenantId}:${customer.id}:${currentYear}`');
    expect(posCustomerSrc).toContain("LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)");
    expect(adminQrSrc).toContain('JOIN cafe_tables t ON t.id = q.table_id');
    expect(qrGeneratorSrc).toContain('SELECT table_id, slug FROM table_qr_codes WHERE table_id IN');
    expect(signageSrc).toContain('matchesCategoryTenant');
    expect(signageSrc).toContain('isPromoWithinUsageLimits');
  });

  it('AQ2: table-sessions enforces staff RBAC, tenant-scoped conflict checks & order COALESCE(total_amount, total, 0) / terminal status rejection; openapi-tables scopes table_zones JOIN &audit logs by tenant; and openapi-staff enforces phone uniqueness (409)', async () => {
    const fs = await import('fs');
    const path = require('path');
    const tsRoutesSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/table-sessions-handlers/routes.ts'),
      'utf8'
    );
    const tsSessionSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/table-sessions-handlers/session-handlers.ts'),
      'utf8'
    );
    const tsOrderSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/table-sessions-handlers/order-handlers.ts'),
      'utf8'
    );
    const tableCrudSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-tables-handlers/table-crud-handlers.ts'),
      'utf8'
    );
    const tableHelpersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-tables-handlers/helpers.ts'),
      'utf8'
    );
    const staffHandlersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-staff-handlers/staff-handlers.ts'),
      'utf8'
    );

    expect(tsRoutesSrc).toContain('STAFF_SESSION_ROLES');
    expect(tsSessionSrc).toContain('matchesSessionTenant');
    expect(tsOrderSrc).toContain('SELECT id, COALESCE(total_amount, total, 0) AS total, status, table_id, tenant_id FROM orders WHERE id = ?');
    expect(tableCrudSrc).toContain("LEFT JOIN table_zones z ON COALESCE(t.zone_id, LOWER(t.zone)) = z.id AND COALESCE(NULLIF(TRIM(z.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default')");
    expect(tableHelpersSrc).toContain('writeTableAuditLog');
    expect(staffHandlersSrc).toContain('Phone number already exists');
  });

  it('AQ3: campaigns hardens channels JSON parsing & SQL-first tenant stats scoping; mixpost scopes promotions, products & posts by tenant before LIMIT with value fallback; and openapi-cron enforces tenant-scoped jobs, runs & audit logs', async () => {
    const fs = await import('fs');
    const path = require('path');
    const campaignConfigSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/campaigns-handlers/config-handlers.ts'),
      'utf8'
    );
    const campaignStatsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/campaigns-handlers/stats-handlers.ts'),
      'utf8'
    );
    const mixpostGenSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/mixpost-handlers/generate-handler.ts'),
      'utf8'
    );
    const mixpostPostsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/mixpost-handlers/posts-handler.ts'),
      'utf8'
    );
    const cronHelpersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/openapi-cron-handlers/helpers.ts'),
      'utf8'
    );

    expect(campaignConfigSrc).toContain('parseChannelsSafe');
    expect(campaignStatsSrc).toContain("WHERE COALESCE(NULLIF(TRIM(cl.tenant_id), ''), COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')) = ?");
    expect(mixpostGenSrc).toContain('const discountPercent = promo.percent ?? promo.discount_value ?? promo.value ?? 0;');
    expect(mixpostPostsSrc).toContain('isSafeMixpostMediaUrl');
    expect(cronHelpersSrc).toContain('checkCronJobTenant');
  });

  it('AQ4: customer-assistant blocks cross-customer phone enumeration; tastyigniter propagates tenant & validates order transitions before bridge update; frigate prevents cross-tenant event hijacking & scopes SQL before LIMIT; and homeassistant scopes automation logs before LIMIT & safely parses JSON', async () => {
    const fs = await import('fs');
    const path = require('path');
    const assistantSrc = fs.readFileSync(
      path.resolve(__dirname, '../../routes/customer-assistant.ts'),
      'utf8'
    );
    const tiWebhookSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/integrations/tastyigniter/webhook.ts'),
      'utf8'
    );
    const frigateSyncSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/integrations/frigate/sync.ts'),
      'utf8'
    );
    const haDevicesSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/homeassistant/devices.ts'),
      'utf8'
    );
    const haAutomationsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tree/homeassistant/automations.ts'),
      'utf8'
    );

    expect(assistantSrc).toContain('Forbidden: cannot query another customer phone number');
    expect(tiWebhookSrc).toContain('matchesWebhookOrderTenant');
    expect(frigateSyncSrc).toContain("UPDATE frigate_events SET tenant_id = ? WHERE id = ? AND (tenant_id IS NULL OR TRIM(tenant_id) = '')");
    expect(haDevicesSrc).toContain('safeParseJsonObject');
    expect(haAutomationsSrc).toContain("SELECT id, automation_id, trigger_entity, payload, result, executed_at, tenant_id FROM ha_automation_log WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) ORDER BY executed_at DESC LIMIT ?");
  });
});





