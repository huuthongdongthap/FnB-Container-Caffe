// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { KVNamespace } from '@cloudflare/workers-types';
import app from '../../index';
import { generateJWT } from '../../lib/jwt';
import { issueStaffSession } from '../../lib/staff-session';
import { redact } from '../../middleware/logger';
import { paymentSqliteDB } from '../helpers/payment-sqlite-db';

const ROOT = resolve(__dirname, '../../../..');
const JWT_SECRET = 'test-jwt-secret-key-minimum-32-chars-long';

function createSharedStoreKV(backing = new Map<string, string>()): KVNamespace {
  return {
    get: async (k: string, t?: string) => {
      const v = backing.get(k) ?? null;
      return v && t === 'json' ? JSON.parse(v) : v;
    },
    put: async (k: string, v: string) => { backing.set(k, v); },
    delete: async (k: string) => { backing.delete(k); },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace & { data: Map<string, string> };
}

function makeEnv() {
  const { db, sqlite } = paymentSqliteDB();
  sqlite.exec(`
    ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in';
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, phone TEXT, name TEXT, email TEXT,
      loyalty_points INTEGER DEFAULT 0, loyalty_tier TEXT DEFAULT 'bronze',
      cashback_balance INTEGER DEFAULT 0, total_spent INTEGER DEFAULT 0,
      total_orders INTEGER DEFAULT 0, tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cafe_tables (
      id TEXT PRIMARY KEY, number INTEGER, name TEXT, capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'Available', current_order_id TEXT,
      tenant_id TEXT DEFAULT 'default', created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS promotions (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, percent INTEGER NOT NULL,
      max_discount INTEGER NOT NULL DEFAULT 0, min_order INTEGER NOT NULL DEFAULT 0,
      usage_limit INTEGER NOT NULL DEFAULT 0, usage_count INTEGER NOT NULL DEFAULT 0,
      starts_at TEXT, expires_at TEXT, is_active INTEGER NOT NULL DEFAULT 1,
      tenant_id TEXT DEFAULT 'default', created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS promotion_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, promotion_id TEXT, code TEXT NOT NULL,
      order_id TEXT NOT NULL, discount_amount INTEGER NOT NULL DEFAULT 0,
      order_total INTEGER NOT NULL DEFAULT 0, redeemed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY, customer_id TEXT, endpoint TEXT UNIQUE, auth_key TEXT,
      p256dh_key TEXT, user_agent TEXT, role TEXT DEFAULT 'customer',
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS client_errors (
      id TEXT PRIMARY KEY, route TEXT, message TEXT, stack TEXT, href TEXT, user_agent TEXT, ts TEXT
    );
  `);
  const kvStore = new Map<string, string>();
  const kv = Object.assign(createSharedStoreKV(kvStore), { data: kvStore });
  return {
    sqlite,
    kvStore,
    env: {
      AURA_DB: db,
      AUTH_KV: kv,
      JWT_SECRET,
      QR_SIGNING_SECRET: 'qr-secret-minimum-32-chars-for-tests',
      PILOT_TENANT_ID: 'default',
      ENVIRONMENT: 'production',
    },
  };
}

describe('Runtime Access Control, Financial Integrity, and SAST Hardening', () => {
  it('blocks unverified email JWTs from claiming an existing phone account and revokes JWTs on password change', async () => {
    const { sqlite, kvStore, env } = makeEnv();
    sqlite.prepare(`INSERT INTO customers (id, phone, name, email, tenant_id) VALUES ('CUST_VIC', '0901234567', 'Victim', 'victim@example.com', 'default')`).run();
    const attackerJwt = await generateJWT({ id: 'USR_ATT', email: 'victim@example.com', role: 'customer', emailVerified: false }, JWT_SECRET, 3600);
    const claimRes = await app.fetch(new Request('https://test.local/api/loyalty/phone-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${attackerJwt}` },
      body: JSON.stringify({ phone: '0901234567' }),
    }), env as never);
    expect([401, 403]).toContain(claimRes.status);

    kvStore.set('user:cust@example.com', JSON.stringify({ id: 'CUST_1', email: 'cust@example.com', role: 'customer', auth_version: 2 }));
    const staleJwt = await generateJWT({ id: 'CUST_1', email: 'cust@example.com', role: 'customer', authVersion: 1 }, JWT_SECRET, 3600);
    const meRes = await app.fetch(new Request('https://test.local/api/orders', {
      headers: { Authorization: `Bearer ${staleJwt}` },
    }), env as never);
    expect([401, 403]).toContain(meRes.status);
  });

  it('serializes OTP single-use claims across distinct KV wrappers sharing backing state', async () => {
    const { sqlite, kvStore, env } = makeEnv();
    sqlite.prepare(`INSERT INTO customers (id, phone, name, tenant_id) VALUES ('CUST_OTP', '0912345678', 'OTP User', 'default')`).run();
    kvStore.set('phone_otp:0912345678', '654321');
    const envA = { ...env, AUTH_KV: Object.assign(createSharedStoreKV(kvStore), { data: kvStore }) };
    const envB = { ...env, AUTH_KV: Object.assign(createSharedStoreKV(kvStore), { data: kvStore }) };
    const req = () => new Request('https://test.local/api/loyalty/phone-auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0912345678', otp: '654321' }),
    });
    const [r1, r2] = await Promise.all([app.fetch(req(), envA as never), app.fetch(req(), envB as never)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 403]);
  });

  it('enforces tenant isolation across mobile tables, sales reports, CSV exports, promotions, and guest order claiming', async () => {
    const { sqlite, env } = makeEnv();
    sqlite.prepare(`INSERT INTO users (id, email, name, role, is_active, tenant_id, auth_version) VALUES ('STF_A', 'a@cafe.vn', 'Owner A', 'owner', 1, 'tenant-a', 1)`).run();
    const { token: tokenA } = await issueStaffSession({ JWT_SECRET }, { id: 'STF_A', name: 'Owner A', phone: null, role: 'owner', tenant_id: 'tenant-a', is_active: 1, auth_version: 1 }, { email: 'a@cafe.vn', sessionType: 'staff-web' });

    sqlite.prepare(`INSERT INTO cafe_tables (id, number, name, capacity, status, tenant_id) VALUES ('TBL_B', 9, 'Table B', 4, 'Available', 'tenant-b')`).run();
    sqlite.prepare(`INSERT INTO orders (id, items, total, status, payment_method, payment_status, customer_name, customer_phone, tenant_id, created_at) VALUES ('ORD_B', '[]', 90000, 'completed', 'cod', 'paid', '=CMD|calc', '0909000111', 'tenant-b', '2026-10-30T08:00:00.000Z')`).run();
    sqlite.prepare(`INSERT INTO orders (id, items, total, status, payment_method, payment_status, customer_name, customer_phone, tenant_id, created_at) VALUES ('ORD_A', '[]', 40000, 'completed', 'cod', 'paid', '=CMD|calc', '0909000222', 'tenant-a', '2026-10-30T08:00:00.000Z')`).run();
    sqlite.prepare(`INSERT INTO promotions (id, code, percent, max_discount, min_order, usage_limit, usage_count, is_active, tenant_id) VALUES ('P_B', 'TENANTB50', 50, 50000, 0, 10, 0, 1, 'tenant-b')`).run();

    const tblRes = await app.fetch(new Request('https://test.local/mobile/tables', { headers: { Authorization: `Bearer ${tokenA}` } }), env as never);
    const tblBody = await tblRes.json() as { data: Array<{ id: string }> };
    expect((tblBody.data || []).some((t) => t.id === 'TBL_B')).toBe(false);

    const repRes = await app.fetch(new Request('https://test.local/api/reports/overview?from=2026-10-01&to=2026-10-31', { headers: { Authorization: `Bearer ${tokenA}` } }), env as never);
    const repBody = await repRes.json() as { data: { todayRevenue: number } };
    expect(repBody.data.todayRevenue).toBe(40000);

    const csvRes = await app.fetch(new Request('https://test.local/api/reports/export?type=orders&from=2026-10-01&to=2026-10-31', { headers: { Authorization: `Bearer ${tokenA}` } }), env as never);
    const csvText = await csvRes.text();
    expect(csvText).not.toContain('ORD_B');
    expect(csvText).not.toMatch(/(?:^|,|\n)=CMD/);

    const promoDel = await app.fetch(new Request('https://test.local/api/promotions/TENANTB50', { method: 'DELETE', headers: { Authorization: `Bearer ${tokenA}` } }), env as never);
    expect(promoDel.status).toBe(404);
  });

  it('enforces prepaid delivery orders, disabled WELCOME promo, atomic promo quota, and order check on redeem', async () => {
    const { sqlite, env } = makeEnv();
    sqlite.prepare(`INSERT INTO users (id, email, name, role, is_active, tenant_id, auth_version) VALUES ('STF_K', 'k@cafe.vn', 'Kitchen', 'kitchen', 1, 'default', 1)`).run();
    const { token: kitchenJwt } = await issueStaffSession({ JWT_SECRET }, { id: 'STF_K', name: 'Kitchen', phone: null, role: 'kitchen', tenant_id: 'default', is_active: 1, auth_version: 1 }, { email: 'k@cafe.vn', sessionType: 'staff-web' });

    const codDeliv = await app.fetch(new Request('https://test.local/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_type: 'delivery', payment_method: 'cod', customer_name: 'A', customer_phone: '0901112223', customer_address: '123 St', items: [{ id: '1', name: 'Espresso', price: 39000, quantity: 1 }] }),
    }), env as never);
    expect(codDeliv.status).toBe(400);

    sqlite.prepare(`INSERT INTO orders (id, items, total, status, order_type, payment_method, payment_status, customer_name, customer_phone, tenant_id, created_at) VALUES ('ORD_UNPAID_DELIV', '[{"id":"1","name":"Espresso","quantity":1}]', 39000, 'pending', 'delivery', 'payos', 'unpaid', 'A', '0901112223', 'default', '2026-10-30T08:00:00.000Z')`).run();
    const prepRes = await app.fetch(new Request('https://test.local/api/orders/ORD_UNPAID_DELIV/status', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kitchenJwt}` },
      body: JSON.stringify({ status: 'preparing' }),
    }), env as never);
    expect(prepRes.status).toBe(409);

    sqlite.prepare(`INSERT INTO promotions (id, code, percent, max_discount, min_order, usage_limit, usage_count, is_active, tenant_id) VALUES ('P_W', 'WELCOME', 10, 30000, 0, 0, 0, 0, 'default')`).run();
    const welRes = await app.fetch(new Request('https://test.local/api/promotions/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'WELCOME', order_total: 100000, customer_name: 'New', customer_phone: '0988777666', is_new_customer: true }),
    }), env as never);
    expect(((await welRes.json()) as { data: { valid: boolean } }).data.valid).toBe(false);

    sqlite.prepare(`INSERT INTO promotions (id, code, percent, max_discount, min_order, usage_limit, usage_count, is_active, tenant_id) VALUES ('P_ONE', 'ONCE50', 50, 50000, 0, 1, 0, 1, 'default')`).run();
    const redeemGhost = await app.fetch(new Request('https://test.local/api/promotions/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'ONCE50', order_id: 'ORD_NONEXISTENT', order_total: 100000 }),
    }), env as never);
    expect(redeemGhost.status).toBe(404);
  });

  it('enforces WebPush endpoint safety, Zalo prod secret fail-closed, rate-limit serialization, and config hardening', async () => {
    const { env } = makeEnv();
    const ssrfRes = await app.fetch(new Request('https://test.local/api/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'http://169.254.169.254/latest/meta-data', auth_key: 'a', p256dh_key: 'p' }),
    }), env as never);
    expect(ssrfRes.status).toBe(400);

    const zaloRes = await app.fetch(new Request('https://test.local/api/webhooks/zalo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: 'user_send_text', message: { text: 'hi' } }),
    }), env as never);
    expect(zaloRes.status).toBe(503);

    const bigErr = await app.fetch(new Request('https://test.local/api/client-error', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.77' },
      body: JSON.stringify({ message: 'X'.repeat(80000) }),
    }), env as never);
    expect(bigErr.status).toBe(413);

    expect(redact({ to: '0901234567', recipient: 'a@b.com' })).toEqual({ to: '[REDACTED]', recipient: '[REDACTED]' });
    const deployYml = readFileSync(resolve(ROOT, '.github/workflows/deploy.yml'), 'utf8');
    expect(deployYml).not.toMatch(/run:\s*\|[\s\S]*?\$\{\{\s*inputs\.(worker_version_id|baseline_version_id|rollback_reason)/);
    expect(deployYml).toContain('npx --no-install');
  });
});
