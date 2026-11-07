// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { issueStaffSession } from '../../lib/staff-session';
import { processTIWebhook } from '../../tree/integrations/tastyigniter/webhook';
import { toggleDevice, cacheDeviceState } from '../../tree/homeassistant/devices';
import { resolveServerProductPrice } from '@aura/domain-catalog';
import { deductOrderStock, deductInventoryForOrder } from '@aura/domain-inventory';

function createAuditEnv() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, role TEXT, tenant_id TEXT DEFAULT 'default', is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1, password_hash TEXT, email_verified INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT);
    CREATE TABLE customers (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, phone TEXT, loyalty_points INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0, loyalty_tier TEXT DEFAULT 'bronze', tier TEXT DEFAULT 'BRONZE', total_spent REAL DEFAULT 0, visit_count INTEGER DEFAULT 0, cashback_balance REAL DEFAULT 0, source TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT);
    CREATE TABLE cashback_wallets (id TEXT PRIMARY KEY, customer_id TEXT, balance REAL DEFAULT 0, total_earned REAL DEFAULT 0, total_spent REAL DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE email_verifications (id TEXT PRIMARY KEY, email TEXT, code TEXT, type TEXT, expires_at TEXT, used INTEGER DEFAULT 0, verified_at TEXT, created_at TEXT);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, access_token TEXT, refresh_token TEXT, expires_at TEXT, is_trusted_device INTEGER DEFAULT 0, device_fingerprint TEXT, device_name TEXT, last_used_at TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT, order_type TEXT, payment_status TEXT, tenant_id TEXT DEFAULT 'default', updated_at TEXT);
    CREATE TABLE ti_order_bridge (id TEXT PRIMARY KEY, local_order_id TEXT, ti_order_id TEXT, status TEXT, synced_at TEXT, created_at TEXT, tenant_id TEXT DEFAULT 'default');
    CREATE TABLE ha_device_states (entity_id TEXT PRIMARY KEY, state TEXT, attributes TEXT, last_changed TEXT, last_updated TEXT, tenant_id TEXT DEFAULT 'default');
    CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT, price INTEGER, category_id TEXT, is_available INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default');
    CREATE TABLE happy_hour_windows (id TEXT PRIMARY KEY, name TEXT, day_of_week TEXT, start_time TEXT, end_time TEXT, discount_rate REAL, apply_to TEXT, apply_ids TEXT, priority INTEGER DEFAULT 1, active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default');
    CREATE TABLE recipes (id TEXT PRIMARY KEY, product_id TEXT, name TEXT, instructions TEXT, is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default');
    CREATE TABLE recipe_items (id TEXT PRIMARY KEY, recipe_id TEXT, ingredient_id TEXT, quantity REAL, unit TEXT);
    CREATE TABLE ingredients (id TEXT PRIMARY KEY, name TEXT, current_stock REAL, unit TEXT, cost_per_unit REAL DEFAULT 0, tenant_id TEXT DEFAULT 'default', updated_at TEXT);
    CREATE TABLE stock_movements (id TEXT PRIMARY KEY, ingredient_id TEXT, type TEXT, quantity REAL, reference_id TEXT, reference_type TEXT, notes TEXT, created_at TEXT);
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
  const db: any = { prepare: statement, async batch(stmts: any[]) { return Promise.all(stmts.map((s) => s.run())); } };
  const env: any = { AURA_DB: db, DB: db, AUTH_KV: kv, JWT_SECRET: 'audit-261101-secret-key-minimum-32-chars', ENVIRONMENT: 'production', PILOT_TENANT_ID: undefined };
  return { sql, env, kvData };
}

describe('Audit 261101-1115 Remediation (F01..F15 / BA-01..BA-06)', () => {
  it('enforces customer & staff authVersion revocation, fail-closed mobile device check, atomic OTP across cloned envs, and email-loyalty linkage', async () => {
    const { sql, env, kvData } = createAuditEnv();
    try {
      // F01/BA-01: Customer token with authVersion=1 is rejected when AUTH_KV user authVersion=2
      const custId = '11111111-1111-4111-8111-111111111101';
      await env.AUTH_KV.put('user:alice@aura.vn', JSON.stringify({
        id: custId, email: 'alice@aura.vn', name: 'Alice', role: 'customer', authVersion: 2,
      }));
      await env.AUTH_KV.put(`cust_auth_ver:${custId}`, '2');
      const staleCustJwt = await generateJWT(
        { id: custId, sub: custId, email: 'alice@aura.vn', name: 'Alice', role: 'customer', authVersion: 1 },
        env.JWT_SECRET, 3600
      );
      const meRes = await app.fetch(
        new Request('http://localhost/api/auth/me', { headers: { Authorization: `Bearer ${staleCustJwt}` } }),
        env
      );
      expect(meRes.status).toBe(401);

      // F06/BA-05 & F07/BA-06: Staff auth_version bump in D1 invalidates web token & missing staff_devices table fails closed for mobile token
      sql.prepare(
        `INSERT INTO users (id, email, name, role, tenant_id, is_active, auth_version)
         VALUES ('stf-1', 'stf@aura.vn', 'Staff 1', 'manager', 'default', 1, 1)`
      ).run();
      const staffRow: any = sql.prepare("SELECT * FROM users WHERE id = 'stf-1'").get();
      const { token: staffWebTok } = await issueStaffSession(env, staffRow, { sessionType: 'staff-web' });
      const { token: staffMobTok } = await issueStaffSession(env, staffRow, { sessionType: 'staff-mobile', deviceId: 'dev-1' });
      sql.prepare("UPDATE users SET auth_version = 2 WHERE id = 'stf-1'").run();

      const webAfterBump = await app.fetch(
        new Request('http://localhost/api/admin/customers', { headers: { Authorization: `Bearer ${staffWebTok}` } }),
        env
      );
      expect(webAfterBump.status).toBe(401);

      sql.prepare("UPDATE users SET auth_version = 1 WHERE id = 'stf-1'").run();
      const mobMissingDeviceTable = await app.fetch(
        new Request('http://localhost/api/admin/customers', { headers: { Authorization: `Bearer ${staffMobTok}` } }),
        env
      );
      expect([401, 503]).toContain(mobMissingDeviceTable.status);

      // F02/BA-02: Concurrent phone-auth OTP across two distinct env clones sharing AUTH_KV allows only 1 winner
      sql.prepare(
        `INSERT INTO customers (id, email, name, phone, tenant_id)
         VALUES ('cust-otp-1', 'otp1@aura.vn', 'OTP User', '0901234567', 'default')`
      ).run();
      kvData.set('phone_otp:0901234567', '654321');
      const envCloneA = { ...env, PILOT_TENANT_ID: 'default' };
      const envCloneB = { ...env, PILOT_TENANT_ID: 'default' };
      const [otpA, otpB] = await Promise.all([
        app.fetch(new Request('http://localhost/api/loyalty/phone-auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '0901234567', otp: '654321' }),
        }), envCloneA),
        app.fetch(new Request('http://localhost/api/loyalty/phone-auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '0901234567', otp: '654321' }),
        }), envCloneB),
      ]);
      expect([otpA.status, otpB.status].sort()).toEqual([200, 403]);

      // BA-03 (customer revoke-all invalidates sibling JWT), BA-04 (staff revoke-all fails closed), BA-05 (register seeds D1 customer)
      const staffRevokeAllFail = await app.fetch(
        new Request('http://localhost/api/auth/devices', { method: 'DELETE', headers: { Authorization: `Bearer ${staffWebTok}` } }), env
      );
      expect(staffRevokeAllFail.status).toBe(500);
      await env.AUTH_KV.put('user:bob@aura.vn', JSON.stringify({ id: 'cust-bob', email: 'bob@aura.vn', name: 'Bob', role: 'customer', auth_version: 1 }));
      const bobTokA = await generateJWT({ id: 'cust-bob', sub: 'cust-bob', email: 'bob@aura.vn', name: 'Bob', role: 'customer', authVersion: 1 }, env.JWT_SECRET, 3600);
      const bobTokB = await generateJWT({ id: 'cust-bob', sub: 'cust-bob', email: 'bob@aura.vn', name: 'Bob', role: 'customer', authVersion: 1, jti: 'b2' }, env.JWT_SECRET, 3600);
      const custRevokeRes = await app.fetch(new Request('http://localhost/api/auth/devices', { method: 'DELETE', headers: { Authorization: `Bearer ${bobTokB}` } }), env);
      expect(custRevokeRes.status).toBe(200);
      const bobSiblingCheck = await app.fetch(new Request('http://localhost/api/auth/me', { headers: { Authorization: `Bearer ${bobTokA}` } }), env);
      expect(bobSiblingCheck.status).toBe(401);
      const regRes = await app.fetch(new Request('http://localhost/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'newmember@aura.vn', password: 'Password123!', name: 'New Member', phone: '0908887776' }),
      }), { ...env, PILOT_TENANT_ID: 'default' });
      expect([200, 201]).toContain(regRes.status);
      expect(sql.prepare("SELECT id FROM customers WHERE email = 'newmember@aura.vn'").get()).toBeTruthy();
    } finally {
      sql.close();
    }
  });

  it('enforces tenant isolation in Happy Hour pricing (F09), TI webhook state guards (F12), BOM stock deduction (F13), and HA device writes (F14)', async () => {
    const { sql, env } = createAuditEnv();
    try {
      // F09: Store B happy hour discount does not apply to default tenant product pricing
      sql.exec(`
        INSERT INTO products (id, name, price, category_id, is_available, tenant_id)
          VALUES ('p-cf', 'Cold Brew', 50000, 'coffee', 1, 'default');
        INSERT INTO happy_hour_windows (id, name, day_of_week, start_time, end_time, discount_rate, apply_to, priority, active, tenant_id)
          VALUES ('hh-b', 'Store B 50% Off', '*', '00:00', '23:59', 0.5, 'all', 10, 1, 'store-b');
      `);
      const priceDef = await resolveServerProductPrice(env.AURA_DB, {
        productId: 'p-cf', now: new Date('2026-11-01T10:00:00Z'), tenantId: 'default',
      });
      expect(priceDef?.unitPriceCents).toBe(50000);

      // F12: TastyIgniter webhook ignores unbridged order, terminal order, and unpaid delivery preparing transition
      sql.exec(`
        INSERT INTO orders (id, status, order_type, payment_status, tenant_id) VALUES
          ('ord-unbridged', 'pending', 'dine_in', 'paid', 'default'),
          ('ord-completed', 'completed', 'dine_in', 'paid', 'default'),
          ('ord-unpaid-deliv', 'confirmed', 'delivery', 'unpaid', 'default');
        INSERT INTO ti_order_bridge (id, local_order_id, ti_order_id, status) VALUES
          ('br-1', 'ord-completed', 'ti-1', 'completed'),
          ('br-2', 'ord-unpaid-deliv', 'ti-2', 'confirmed');
      `);
      await processTIWebhook(env, { event: 'order.cancelled', local_order_id: 'ord-unbridged', ti_order_id: 'ti-999' });
      await processTIWebhook(env, { event: 'order.cancelled', ti_order_id: 'ti-1' });
      await processTIWebhook(env, { event: 'order.preparing', ti_order_id: 'ti-2' });
      expect((sql.prepare("SELECT status FROM orders WHERE id = 'ord-unbridged'").get() as any).status).toBe('pending');
      expect((sql.prepare("SELECT status FROM orders WHERE id = 'ord-completed'").get() as any).status).toBe('completed');
      expect((sql.prepare("SELECT status FROM orders WHERE id = 'ord-unpaid-deliv'").get() as any).status).toBe('confirmed');

      // F13: deductOrderStock & deductInventoryForOrder for store-b do not deduct default-store stock
      sql.exec(`
        CREATE TABLE inventory_items (id TEXT PRIMARY KEY, sku TEXT, name TEXT, current_stock REAL, unit TEXT, active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default', updated_at TEXT);
        INSERT INTO recipes (id, product_id, name, is_active, tenant_id) VALUES ('r-def', 'p-cf', 'Def Recipe', 1, 'default');
        INSERT INTO ingredients (id, name, current_stock, unit, cost_per_unit, tenant_id) VALUES ('ing-def', 'Beans', 100, 'g', 500, 'default');
        INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity, unit) VALUES ('ri-1', 'r-def', 'ing-def', 20, 'g');
        INSERT INTO inventory_items (id, sku, name, current_stock, unit, active, tenant_id) VALUES ('inv-def', 'sku-shared', 'Shared Coffee', 10, 'pcs', 1, 'default');
        INSERT INTO orders (id, status, order_type, payment_status, tenant_id) VALUES ('ord-b-1', 'confirmed', 'dine_in', 'paid', 'store-b');
      `);
      await deductOrderStock(env.AURA_DB, 'ord-b-1', [{ productId: 'p-cf', quantity: 2 }], { allowNegative: true, tenantId: 'store-b' });
      await deductInventoryForOrder(env, 'ord-b-1', [{ product_id: 'no-bom-prod', quantity: 1, name: 'Shared Coffee' }]);
      expect((sql.prepare("SELECT current_stock FROM ingredients WHERE id = 'ing-def'").get() as any).current_stock).toBe(100);
      expect((sql.prepare("SELECT current_stock FROM inventory_items WHERE id = 'inv-def'").get() as any).current_stock).toBe(10);

      // F14: HA cacheDeviceState and toggleDevice preserve and scope tenant_id
      await cacheDeviceState(env, { entity_id: 'switch.roaster_b', state: 'off', attributes: null, last_changed: '', last_updated: '' }, 'store-b');
      const crossToggle = await toggleDevice(env, 'switch.roaster_b', true, 'default');
      expect(crossToggle.status).toBe(404);
      const ownToggle = await toggleDevice(env, 'switch.roaster_b', true, 'store-b');
      expect(ownToggle.status).toBe(200);
    } finally {
      sql.close();
    }
  });
});
