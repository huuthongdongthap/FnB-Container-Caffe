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
});
