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
});
