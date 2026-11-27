// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../types/env';
import { createOrderMobile } from '../routes/orders-mobile';
import { registerSendHandler } from '../routes/broadcast-handlers/send-handler';
import { registerPasswordHandlers, registerForgotPasswordHandler } from '../routes/openapi-auth-handlers/password-handlers';
import { registerStaffDevice } from '../../../packages/domain/staff/commands/staff-auth';
import { validateStaffSession, isStaffIdentity } from '../lib/staff-session';
import { birthdayRouter } from '../routes/birthday';
import { registerAdminHandlers as registerLoyaltyAdminHandlers } from '../routes/openapi-loyalty-handlers/admin-handlers';
import { createSaasCommercialRoutes } from '../routes/saas-commercial';
import { handleCancelOrder } from '../routes/openapi-orders-handlers/order-cancel-handlers';
import { transitionOrderStatus } from '../../../packages/domain/order/policies/order-status-transition';
import { promotionsRouter } from '../routes/promotions';
import { registerUsageHandlers } from '../routes/openapi-promotions-handlers/usage-handlers';
import { changePassword } from '../tree/auth/change-password';
import { handleSpendCashback } from '../tree/loyalty/spend-cashback-handler';
import { requireVendor } from '../tree/subscriptions/middleware';
import { registerStaffHandlers } from '../routes/openapi-staff-handlers/staff-handlers';
import { generateJWT, hashPassword, verifyPassword } from '../lib/jwt';

const JWT_SECRET = 'test-jwt-secret-for-regressions-32bytes!';

function createSqliteD1(sqlite: DatabaseSync) {
  const makeStmt = (sql: string, boundArgs: unknown[] = []) => ({
    bind: (...args: unknown[]) => makeStmt(sql, args),
    first: async <T = Record<string, unknown>>(): Promise<T | null> => {
      const row = sqlite.prepare(sql).get(...(boundArgs as never[])) as T | undefined;
      return row ?? null;
    },
    all: async <T = Record<string, unknown>>(): Promise<{ results: T[] }> => {
      const rows = sqlite.prepare(sql).all(...(boundArgs as never[])) as T[];
      return { results: rows };
    },
    run: async () => {
      const info = sqlite.prepare(sql).run(...(boundArgs as never[]));
      return {
        success: true,
        meta: {
          changes: Number(info.changes ?? 0),
          last_row_id: Number(info.lastInsertRowid ?? 0),
        },
      };
    },
  });

  return {
    prepare: (sql: string) => makeStmt(sql),
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const out: unknown[] = [];
      for (const s of stmts) {
        out.push(await s.run());
      }
      return out;
    },
  };
}

function createMockKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  };
}

describe('Security, RBAC, Auth, Promotion, Loyalty, Broadcast, and Mobile Regressions', () => {
  it('1. delegates POST /mobile/orders to createOrderFromAlias with server-side product pricing instead of 25000 fallback', async () => {
    const schemaSql = readFileSync(resolve(__dirname, '../../schema.sql'), 'utf-8');
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = OFF;');
    sqlite.exec(schemaSql);

    sqlite
      .prepare(
        "INSERT INTO products (id, name, price, category_id, available, is_available, tenant_id) VALUES ('prod_espresso_a', 'Espresso Double', 55000, 'cat_coffee', 1, 1, 'store-a')"
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO cafe_tables (id, table_number, capacity, zone, is_active, tenant_id) VALUES ('T-05', 'T-05', 4, 'indoor', 1, 'store-a')"
      )
      .run();

    const db = createSqliteD1(sqlite);
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'waiter_a1', role: 'waiter', tenantId: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    app.post('/mobile/orders', (c) => createOrderMobile(c));

    const res = await app.fetch(
      new Request('https://api.test/mobile/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          table_id: 'T-05',
          items: [{ product_id: 'prod_espresso_a', name: 'Espresso Double', qty: 2, price: 1000 }],
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      order_id: string;
      total: number;
    };
    expect(body.success).toBe(true);
    expect(body.total).toBe(110000);

    const savedOrder = sqlite
      .prepare('SELECT total, subtotal, tenant_id FROM orders WHERE id = ?')
      .get(body.order_id) as { total: number; subtotal: number; tenant_id: string };
    expect(savedOrder.total).toBe(110000);
    expect(savedOrder.tenant_id).toBe('store-a');

    const crossRes = await app.fetch(
      new Request('https://api.test/mobile/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-b' },
        body: JSON.stringify({
          table_id: 'T-05',
          items: [{ product_id: 'prod_espresso_a', qty: 1 }],
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(crossRes.status).toBe(403);
    sqlite.close();
  });

  it('2. fails closed with 400 in POST /api/broadcast/send when consents table is active and zero customers opted into marketing', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = OFF;');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        zalo_id TEXT,
        tier TEXT DEFAULT 'bronze',
        loyalty_tier TEXT DEFAULT 'bronze',
        points INTEGER DEFAULT 0,
        total_spent REAL DEFAULT 0,
        last_visit TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE consents (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        channel TEXT,
        granted INTEGER NOT NULL DEFAULT 1,
        source TEXT DEFAULT 'signup',
        policy_version TEXT DEFAULT 'v1',
        granted_at TEXT DEFAULT (datetime('now')),
        revoked_at TEXT,
        tenant_id TEXT DEFAULT 'default',
        updated_at TEXT
      );
      CREATE TABLE broadcast_logs (
        id TEXT PRIMARY KEY,
        segment TEXT,
        channel TEXT,
        title TEXT,
        message TEXT,
        total_sent INTEGER,
        total_failed INTEGER,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
    `);

    sqlite
      .prepare(
        "INSERT INTO customers (id, name, phone, tier, loyalty_tier, tenant_id) VALUES ('c_no_consent', 'Khach Chua OptIn', '0901112233', 'gold', 'gold', 'store-a')"
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO consents (id, customer_id, purpose, granted, tenant_id) VALUES ('cr_1', 'c_no_consent', 'analytics', 1, 'store-a')"
      )
      .run();

    const db = createSqliteD1(sqlite);
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'owner_a', role: 'owner', tenantId: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    registerSendHandler(app);

    const res = await app.fetch(
      new Request('https://api.test/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          segment: 'all',
          channel: 'zns',
          title: 'Gold Campaign',
          message: 'Xin chao quy khach',
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('tiếp thị');
    sqlite.close();
  });

  it('3a. scopes forgot/reset/change-password by tenant and replaces existing email_verifications code via ON CONFLICT(email)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = OFF;');
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        role TEXT DEFAULT 'customer',
        password_hash TEXT,
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default',
        updated_at TEXT
      );
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        password_hash TEXT,
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default',
        updated_at TEXT
      );
      CREATE TABLE email_verifications (
        id TEXT,
        user_id TEXT,
        email TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        token TEXT,
        type TEXT DEFAULT 'verify',
        expires_at TEXT NOT NULL,
        verified INTEGER DEFAULT 0,
        used INTEGER DEFAULT 0,
        verified_at TEXT,
        attempts INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE otp_codes (
        id TEXT PRIMARY KEY,
        email TEXT,
        code TEXT,
        purpose TEXT,
        expires_at TEXT,
        used INTEGER DEFAULT 0,
        created_at TEXT
      );
      CREATE TABLE password_resets (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        email TEXT UNIQUE,
        code TEXT,
        expires_at TEXT,
        used INTEGER DEFAULT 0,
        created_at TEXT
      );
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        expires_at TEXT
      );
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT,
        entity_type TEXT,
        entity_id TEXT,
        metadata TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
    `);

    const initialHashA = await hashPassword('OldPassStoreA1!');
    const initialHashB = await hashPassword('OldPassStoreB1!');

    sqlite
      .prepare(
        "INSERT INTO customers (id, name, email, phone, password_hash, auth_version, tenant_id) VALUES ('cust_a', 'Alice Store A', 'shared@customer.vn', '0901000001', ?, 1, 'store-a')"
      )
      .run(initialHashA);
    sqlite
      .prepare(
        "INSERT INTO users (id, name, email, phone, role, password_hash, auth_version, tenant_id) VALUES ('cust_a', 'Alice Store A', 'shared@customer.vn', '0901000001', 'customer', ?, 1, 'store-a')"
      )
      .run(initialHashA);

    sqlite
      .prepare(
        "INSERT INTO customers (id, name, email, phone, password_hash, auth_version, tenant_id) VALUES ('cust_b', 'Alice Store B', 'shared@customer.vn', '0902000002', ?, 1, 'store-b')"
      )
      .run(initialHashB);
    sqlite
      .prepare(
        "INSERT INTO users (id, name, email, phone, role, password_hash, auth_version, tenant_id) VALUES ('cust_b', 'Alice Store B', 'shared@customer.vn', '0902000002', 'customer', ?, 1, 'store-b')"
      )
      .run(initialHashB);

    const db = createSqliteD1(sqlite);
    const kv = createMockKv();
    const app = new OpenAPIHono<{ Bindings: Env }>();
    registerForgotPasswordHandler(app);
    registerPasswordHandlers(app);

    const codeReq1 = await app.fetch(
      new Request('https://api.test/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({ email: 'shared@customer.vn' }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(codeReq1.status).toBe(200);

    const codeReq2 = await app.fetch(
      new Request('https://api.test/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({ email: 'shared@customer.vn' }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(codeReq2.status).toBe(200);

    const evRow = sqlite
      .prepare('SELECT code FROM email_verifications WHERE email = ?')
      .get('shared@customer.vn') as { code: string };
    expect(evRow.code).toMatch(/^\d{6}$/);

    const unknownTenantReset = await app.fetch(
      new Request('https://api.test/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-c' },
        body: JSON.stringify({
          email: 'shared@customer.vn',
          code: evRow.code,
          newPassword: 'NewStoreAPassword1!',
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(unknownTenantReset.status).toBe(400);

    const validReset = await app.fetch(
      new Request('https://api.test/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          email: 'shared@customer.vn',
          code: evRow.code,
          newPassword: 'NewStoreAPassword1!',
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(validReset.status).toBe(200);

    const custARow = sqlite
      .prepare('SELECT password_hash, auth_version FROM customers WHERE id = ?')
      .get('cust_a') as { password_hash: string; auth_version: number };
    const custBRow = sqlite
      .prepare('SELECT password_hash, auth_version FROM customers WHERE id = ?')
      .get('cust_b') as { password_hash: string; auth_version: number };

    expect(await verifyPassword('NewStoreAPassword1!', custARow.password_hash)).toBe(true);
    expect(custARow.auth_version).toBe(2);
    expect(await verifyPassword('OldPassStoreB1!', custBRow.password_hash)).toBe(true);
    expect(custBRow.auth_version).toBe(1);
    sqlite.close();
  });

  it('3b. updates staff_devices.id on ON CONFLICT(device_token) in registerStaffDevice so staff-mobile session validation succeeds', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = OFF;');
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        role TEXT,
        tenant_id TEXT DEFAULT 'default',
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1
      );
      CREATE TABLE staff_devices (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL,
        device_name TEXT,
        device_token TEXT UNIQUE NOT NULL,
        pin_hash TEXT NOT NULL DEFAULT '',
        role TEXT DEFAULT 'staff',
        is_active INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default',
        last_login_at TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    sqlite
      .prepare(
        "INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version) VALUES ('staff_mob_1', 'Mobile Waiter', '0909111222', 'waiter', 'store-a', 1, 1)"
      )
      .run();

    const db = createSqliteD1(sqlite) as unknown as Env['AURA_DB'];
    const kv = createMockKv();
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'owner_a', role: 'owner', tenantId: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    app.post('/mobile/devices/register', (c) => registerStaffDevice(c));

    const reg1 = await app.fetch(
      new Request('https://api.test/mobile/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          staff_id: 'staff_mob_1',
          device_token: 'fcm_shared_token_001',
          device_name: 'iPad POS 1',
          pin: '1234',
        }),
      }),
      { AURA_DB: db, AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(reg1.status).toBe(201);
    const firstDevice = sqlite
      .prepare('SELECT id, staff_id FROM staff_devices WHERE device_token = ?')
      .get('fcm_shared_token_001') as { id: string; staff_id: string };

    const reg2 = await app.fetch(
      new Request('https://api.test/mobile/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          staff_id: 'staff_mob_1',
          device_token: 'fcm_shared_token_001',
          device_name: 'iPad POS 1 Re-registered',
          pin: '5678',
        }),
      }),
      { AURA_DB: db, AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(reg2.status).toBe(201);
    const secondDevice = sqlite
      .prepare('SELECT id, staff_id FROM staff_devices WHERE device_token = ?')
      .get('fcm_shared_token_001') as { id: string; staff_id: string };

    expect(secondDevice.id).not.toBe(firstDevice.id);

    const now = Math.floor(Date.now() / 1000);
    const account = await validateStaffSession(db, {
      id: 'staff_mob_1',
      role: 'waiter',
      tenantId: 'store-a',
      authVersion: 1,
      authTime: now,
      sessionType: 'staff-mobile',
      deviceId: secondDevice.id,
      exp: now + 3600,
    });
    expect(account.id).toBe('staff_mob_1');
    sqlite.close();
  });

  it('4. blocks cross-customer birthday check IDOR (403) even when target lacks birthday and prevents duplicate birthday redemption via atomic INSERT', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = OFF;');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        birthday TEXT,
        date_of_birth TEXT,
        tier TEXT DEFAULT 'gold',
        points INTEGER DEFAULT 0,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE birthday_redemptions (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        discount_percent INTEGER NOT NULL DEFAULT 15,
        order_id TEXT,
        redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
        tenant_id TEXT NOT NULL DEFAULT 'default'
      );
    `);

    const todayMd = new Date().toISOString().slice(5, 10);
    sqlite
      .prepare(
        "INSERT INTO customers (id, name, phone, birthday, date_of_birth, tier, points, tenant_id) VALUES ('cust_bday_1', 'Birthday User', '0901111111', ?, ?, 'gold', 100, 'default')"
      )
      .run(`1995-${todayMd}`, `1995-${todayMd}`);
    sqlite
      .prepare(
        "INSERT INTO customers (id, name, phone, birthday, date_of_birth, tier, points, tenant_id) VALUES ('cust_no_bday_2', 'No Birthday User', '0902222222', NULL, NULL, 'bronze', 0, 'default')"
      )
      .run();

    const db = createSqliteD1(sqlite);
    const tokenCust1 = await generateJWT(
      { id: 'cust_bday_1', customerId: 'cust_bday_1', phone: '0901111111', role: 'customer', tenantId: 'default' },
      JWT_SECRET
    );

    const probeOtherRes = await birthdayRouter.fetch(
      new Request('https://api.test/check?customer_id=cust_no_bday_2', {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenCust1}` },
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(probeOtherRes.status).toBe(403);

    const probePhoneRes = await birthdayRouter.fetch(
      new Request('https://api.test/check?phone=0909999999', {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenCust1}` },
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(probePhoneRes.status).toBe(403);

    const redeem1 = await birthdayRouter.fetch(
      new Request('https://api.test/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCust1}` },
        body: JSON.stringify({ customer_id: 'cust_bday_1' }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(redeem1.status).toBe(201);

    const redeem2 = await birthdayRouter.fetch(
      new Request('https://api.test/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCust1}` },
        body: JSON.stringify({ customer_id: 'cust_bday_1' }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect([400, 409]).toContain(redeem2.status);
    sqlite.close();
  });

  it('5. scopes GET /api/loyalty/admin/accounts search subquery by tenant_id and restricts saas-commercial mutations/export to owner or admin', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = OFF;');
    sqlite.exec(`
      CREATE TABLE loyalty_accounts (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        current_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        tier TEXT DEFAULT 'bronze',
        referral_code TEXT,
        order_count INTEGER DEFAULT 0,
        total_spent REAL DEFAULT 0,
        last_activity_at TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE customers (
        id TEXT,
        name TEXT,
        phone TEXT,
        email TEXT,
        loyalty_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze',
        visit_count INTEGER DEFAULT 0,
        total_spent REAL DEFAULT 0,
        referral_code TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT,
        updated_at TEXT,
        PRIMARY KEY (id, tenant_id)
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        role TEXT,
        tenant_id TEXT DEFAULT 'default',
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1
      );
    `);

    sqlite
      .prepare(
        "INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version) VALUES ('mgr_a', 'Manager A', '0900000009', 'manager', 'store-a', 1, 1)"
      )
      .run();

    sqlite
      .prepare(
        "INSERT INTO loyalty_accounts (id, customer_id, current_points, lifetime_points, tier, tenant_id, created_at, updated_at) VALUES ('la_shared_uid_1', 'shared_uid_1', 500, 500, 'silver', 'store-a', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')"
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO customers (id, name, phone, email, tenant_id) VALUES ('shared_uid_1', 'Alice Store A', '0911000111', 'alice@store-a.vn', 'store-a')"
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO customers (id, name, phone, email, tenant_id) VALUES ('shared_uid_1', 'Bob Store B Secret', '0988777666', 'bob@store-b.vn', 'store-b')"
      )
      .run();

    const db = createSqliteD1(sqlite);
    const loyaltyApp = new OpenAPIHono<{ Bindings: Env }>();
    loyaltyApp.use('*', async (c, next) => {
      c.set('user' as never, { id: 'mgr_a', role: 'manager', tenantId: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    registerLoyaltyAdminHandlers(loyaltyApp);

    const searchCrossPhone = await loyaltyApp.fetch(
      new Request('https://api.test/api/loyalty/admin/accounts?search=0988777666'),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(searchCrossPhone.status).toBe(200);
    const crossBody = (await searchCrossPhone.json()) as { data: unknown[] };
    expect(crossBody.data).toHaveLength(0);

    const searchOwnPhone = await loyaltyApp.fetch(
      new Request('https://api.test/api/loyalty/admin/accounts?search=0911000111'),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(searchOwnPhone.status).toBe(200);
    const ownBody = (await searchOwnPhone.json()) as { data: unknown[] };
    expect(ownBody.data).toHaveLength(1);

    const kv = createMockKv();
    const nowSec = Math.floor(Date.now() / 1000);
    const managerToken = await generateJWT(
      {
        id: 'mgr_a',
        role: 'manager',
        tenantId: 'store-a',
        authVersion: 1,
        authTime: nowSec,
        sessionType: 'staff-web',
        iat: nowSec,
        exp: nowSec + 3600,
      },
      JWT_SECRET,
      3600,
      nowSec
    );
    const saasApp = new Hono<{ Bindings: Env }>();
    saasApp.route('/api/saas-commercial', createSaasCommercialRoutes());

    for (const req of [
      new Request('https://api.test/api/saas-commercial/payment-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${managerToken}` },
        body: JSON.stringify({ provider: 'payos' }),
      }),
      new Request('https://api.test/api/saas-commercial/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${managerToken}` },
        body: JSON.stringify({ domain: 'cafe.example.com' }),
      }),
      new Request('https://api.test/api/saas-commercial/domains/dom_1/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${managerToken}` },
      }),
      new Request('https://api.test/api/saas-commercial/domains/dom_1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${managerToken}` },
      }),
      new Request('https://api.test/api/saas-commercial/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${managerToken}` },
        body: JSON.stringify({ plan_id: 'pro' }),
      }),
      new Request('https://api.test/api/saas-commercial/export', {
        method: 'GET',
        headers: { Authorization: `Bearer ${managerToken}` },
      }),
    ]) {
      const resp = await saasApp.fetch(req, {
        AURA_DB: db as unknown as Env['AURA_DB'],
        AUTH_KV: kv as unknown as Env['AUTH_KV'],
        JWT_SECRET,
      } as Env);
      expect(resp.status).toBe(403);
    }
    sqlite.close();
  });

  it('6. allows cancelling a zero-total pending order (100% discount) while blocking paid orders with positive totals', async () => {
    const schemaSql = readFileSync(resolve(__dirname, '../../schema.sql'), 'utf-8');
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = OFF;');
    sqlite.exec(schemaSql);

    sqlite
      .prepare(
        "INSERT INTO customers (id, name, phone, email, tenant_id) VALUES ('cust_z1', 'Zero Customer', '0901112233', 'z1@store-a.vn', 'store-a')"
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO orders (id, order_number, customer_id, customer_name, customer_phone, payment_method, status, payment_status, subtotal, discount, total, total_amount, items, tenant_id) VALUES ('ord_zero_1', 'AURA-ZERO1', 'cust_z1', 'Zero Customer', '0901112233', 'cod', 'pending', 'paid', 45000, 45000, 0, 0, '[]', 'store-a')"
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO orders (id, order_number, customer_id, customer_name, customer_phone, payment_method, status, payment_status, subtotal, discount, total, total_amount, items, tenant_id) VALUES ('ord_paid_1', 'AURA-PAID1', 'cust_z1', 'Zero Customer', '0901112233', 'payos', 'pending', 'paid', 45000, 0, 45000, 45000, '[]', 'store-a')"
      )
      .run();

    const db = createSqliteD1(sqlite);

    const blockedPaidTransition = await transitionOrderStatus(
      db as unknown as Parameters<typeof transitionOrderStatus>[0],
      'ord_paid_1',
      'cancelled',
      'customer',
      { tenantId: 'store-a', paymentStatus: 'paid', allowZeroTotalCancel: false }
    );
    expect(blockedPaidTransition.success).toBe(false);

    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'cust_z1', customerId: 'cust_z1', role: 'customer', tenantId: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    app.post('/api/orders/:id/cancel', (c) => handleCancelOrder(c));

    const zeroCancelRes = await app.fetch(
      new Request('https://api.test/api/orders/ord_zero_1/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({ reason: 'Changed my mind on free voucher order' }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(zeroCancelRes.status).toBe(200);

    const paidCancelRes = await app.fetch(
      new Request('https://api.test/api/orders/ord_paid_1/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({ reason: 'Try cancelling paid order' }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect([400, 409]).toContain(paidCancelRes.status);
    sqlite.close();
  });

  it('7. enforces per-customer promo limits across guest phone and promotion_usages/promotion_redemptions, enforces max_uses when usage_limit=0, resets counters on revival, and updates usage_limit_per_customer on PATCH', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = OFF;');
    sqlite.exec(`
      CREATE TABLE promotions (
        id TEXT,
        code TEXT NOT NULL,
        name TEXT,
        type TEXT DEFAULT 'percent',
        discount_type TEXT DEFAULT 'percentage',
        value REAL DEFAULT 0,
        discount_value REAL DEFAULT 0,
        percent INTEGER NOT NULL DEFAULT 0,
        max_discount INTEGER DEFAULT 0,
        min_order INTEGER DEFAULT 0,
        usage_limit INTEGER DEFAULT 0,
        max_uses INTEGER DEFAULT 0,
        usage_limit_per_customer INTEGER DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        current_uses INTEGER DEFAULT 0,
        used_count INTEGER DEFAULT 0,
        starts_at TEXT,
        expires_at TEXT,
        is_active INTEGER DEFAULT 1,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT
      );
      CREATE TABLE promotion_redemptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        promotion_id TEXT,
        code TEXT NOT NULL,
        order_id TEXT UNIQUE NOT NULL,
        customer_id TEXT,
        tenant_id TEXT DEFAULT 'default',
        discount_amount INTEGER NOT NULL DEFAULT 0,
        order_total INTEGER NOT NULL DEFAULT 0,
        redeemed_at TEXT
      );
      CREATE TABLE promotion_usages (
        id TEXT PRIMARY KEY,
        promotion_id TEXT NOT NULL,
        customer_id TEXT,
        order_id TEXT UNIQUE,
        discount_amount REAL NOT NULL DEFAULT 0,
        idempotency_key TEXT,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        customer_phone TEXT,
        customer_name TEXT,
        order_token TEXT,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'unpaid',
        subtotal INTEGER DEFAULT 100000,
        total INTEGER DEFAULT 100000,
        total_amount INTEGER DEFAULT 100000,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT,
        entity_type TEXT,
        entity_id TEXT,
        metadata TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        role TEXT,
        tenant_id TEXT DEFAULT 'default',
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1
      );
    `);

    sqlite
      .prepare(
        "INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version) VALUES ('owner_a', 'Owner A', '0900000001', 'owner', 'store-a', 1, 1)"
      )
      .run();

    const promoUuid = '11111111-1111-4111-8111-111111111111';
    const orderC2Uuid = '22222222-2222-4222-8222-222222222222';
    sqlite
      .prepare(
        `INSERT INTO promotions (id, code, name, type, discount_type, value, discount_value, percent, max_discount, min_order, usage_limit, max_uses, usage_limit_per_customer, usage_count, current_uses, is_active, tenant_id)
         VALUES (?, 'ONCEGUEST', 'Once Per Guest', 'percent', 'percentage', 20, 20, 20, 50000, 50000, 0, 2, 1, 0, 0, 1, 'store-a')`
      )
      .run(promoUuid);

    sqlite
      .prepare(
        "INSERT INTO orders (id, customer_id, customer_phone, order_token, subtotal, total, tenant_id) VALUES ('ord_g1', NULL, '0901234567', 'tok_g1', 100000, 100000, 'store-a')"
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO orders (id, customer_id, customer_phone, order_token, subtotal, total, tenant_id) VALUES ('ord_g2', NULL, '+84 90 123 4567', 'tok_g2', 100000, 100000, 'store-a')"
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO orders (id, customer_id, customer_phone, order_token, subtotal, total, tenant_id) VALUES (?, 'cust_2', '0907777777', 'tok_c2', 100000, 100000, 'store-a')"
      )
      .run(orderC2Uuid);
    sqlite
      .prepare(
        "INSERT INTO orders (id, customer_id, customer_phone, order_token, subtotal, total, tenant_id) VALUES ('ord_c3', 'cust_3', '0908888888', 'tok_c3', 100000, 100000, 'store-a')"
      )
      .run();

    const db = createSqliteD1(sqlite);
    const kv = createMockKv();
    const nowSec = Math.floor(Date.now() / 1000);
    const ownerToken = await generateJWT(
      {
        id: 'owner_a',
        role: 'owner',
        tenantId: 'store-a',
        authVersion: 1,
        authTime: nowSec,
        sessionType: 'staff-web',
        iat: nowSec,
        exp: nowSec + 3600,
      },
      JWT_SECRET,
      3600,
      nowSec
    );

    const redeemG1 = await promotionsRouter.fetch(
      new Request('https://api.test/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a', 'X-Order-Token': 'tok_g1' },
        body: JSON.stringify({
          code: 'ONCEGUEST',
          order_id: 'ord_g1',
          order_total: 100000,
          customer_phone: '0901234567',
          order_token: 'tok_g1',
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(redeemG1.status).toBe(200);

    const validateG2 = await promotionsRouter.fetch(
      new Request('https://api.test/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          code: 'ONCEGUEST',
          order_total: 100000,
          customer_phone: '+84 90 123 4567',
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(validateG2.status).toBe(200);
    const validateG2Body = (await validateG2.json()) as { data: { valid: boolean } };
    expect(validateG2Body.data.valid).toBe(false);

    const redeemG2 = await promotionsRouter.fetch(
      new Request('https://api.test/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a', 'X-Order-Token': 'tok_g2' },
        body: JSON.stringify({
          code: 'ONCEGUEST',
          order_id: 'ord_g2',
          order_total: 100000,
          customer_phone: '+84 90 123 4567',
          order_token: 'tok_g2',
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(redeemG2.status).toBe(400);

    const openApiPromoApp = new OpenAPIHono<{ Bindings: Env }>();
    openApiPromoApp.use('*', async (c, next) => {
      c.set('user' as never, { id: 'cust_2', customerId: 'cust_2', role: 'customer', tenantId: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    registerUsageHandlers(openApiPromoApp);

    const useC2 = await openApiPromoApp.fetch(
      new Request('https://api.test/api/promotions/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          promotionId: promoUuid,
          orderId: orderC2Uuid,
          discountAmount: 20000,
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(useC2.status).toBe(200);

    const redeemC3 = await promotionsRouter.fetch(
      new Request('https://api.test/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a', 'X-Order-Token': 'tok_c3' },
        body: JSON.stringify({
          code: 'ONCEGUEST',
          order_id: 'ord_c3',
          order_total: 100000,
          customer_id: 'cust_3',
          customer_phone: '0908888888',
          order_token: 'tok_c3',
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect([400, 409]).toContain(redeemC3.status);

    const patchRes = await promotionsRouter.fetch(
      new Request('https://api.test/ONCEGUEST', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'X-Tenant-ID': 'store-a',
        },
        body: JSON.stringify({ usage_limit_per_customer: 5, is_active: 0 }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(patchRes.status).toBe(200);
    const afterPatch = sqlite
      .prepare('SELECT usage_limit_per_customer, is_active FROM promotions WHERE id = ?')
      .get(promoUuid) as { usage_limit_per_customer: number; is_active: number };
    expect(afterPatch.usage_limit_per_customer).toBe(5);
    expect(afterPatch.is_active).toBe(0);

    const reviveRes = await promotionsRouter.fetch(
      new Request('https://api.test/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'X-Tenant-ID': 'store-a',
        },
        body: JSON.stringify({
          code: 'ONCEGUEST',
          percent: 15,
          max_discount: 30000,
          min_order: 40000,
          usage_limit: 10,
          usage_limit_per_customer: 2,
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(reviveRes.status).toBe(201);
    const afterRevive = sqlite
      .prepare('SELECT usage_count, current_uses, is_active, usage_limit_per_customer FROM promotions WHERE id = ?')
      .get(promoUuid) as {
      usage_count: number;
      current_uses: number;
      is_active: number;
      usage_limit_per_customer: number;
    };
    expect(afterRevive.usage_count).toBe(0);
    expect(afterRevive.current_uses).toBe(0);
    expect(afterRevive.is_active).toBe(1);
    expect(afterRevive.usage_limit_per_customer).toBe(2);
    sqlite.close();
  });

  it('8. scopes tree/auth/change-password by tenant and rolls back wallet + order cashback_used when ledger insert fails in handleSpendCashback', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = OFF;');
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT,
        role TEXT,
        password_hash TEXT,
        auth_version INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default',
        updated_at TEXT
      );
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        email TEXT,
        phone TEXT,
        password_hash TEXT,
        auth_version INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default',
        updated_at TEXT
      );
      CREATE TABLE cashback_wallets (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL UNIQUE,
        balance INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        updated_at TEXT
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'unpaid',
        discount INTEGER DEFAULT 0,
        total INTEGER DEFAULT 100000,
        total_amount INTEGER DEFAULT 100000,
        cashback_used INTEGER DEFAULT 0,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE cashback_transactions (
        id TEXT PRIMARY KEY,
        wallet_id TEXT,
        customer_id TEXT NOT NULL,
        order_id TEXT,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('ONLY_EARN_ALLOWED_FOR_TEST')),
        balance_after INTEGER NOT NULL,
        description TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
    `);

    const oldHash = await hashPassword('CustomerOldPass1!');
    sqlite
      .prepare(
        "INSERT INTO customers (id, email, phone, password_hash, auth_version, tenant_id) VALUES ('cust_cb_a', 'cb@store-a.vn', '0901234567', ?, 3, 'store-a')"
      )
      .run(oldHash);
    sqlite
      .prepare(
        "INSERT INTO users (id, email, role, password_hash, auth_version, tenant_id) VALUES ('cust_cb_a', 'cb@store-a.vn', 'customer', ?, 3, 'store-a')"
      )
      .run(oldHash);
    sqlite
      .prepare(
        "INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id) VALUES ('wal_cb_a', 'cust_cb_a', 50000, 50000, 0, 'store-a')"
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO orders (id, customer_id, status, payment_status, discount, total, total_amount, cashback_used, tenant_id) VALUES ('ord_cb_a1', 'cust_cb_a', 'pending', 'unpaid', 0, 100000, 100000, 0, 'store-a')"
      )
      .run();

    const db = createSqliteD1(sqlite);
    const kv = createMockKv();
    await kv.put(
      'user:cb@store-a.vn',
      JSON.stringify({
        id: 'cust_cb_a',
        email: 'cb@store-a.vn',
        password: oldHash,
        role: 'customer',
        tenant_id: 'store-a',
        auth_version: 3,
      })
    );

    const custToken = await generateJWT(
      {
        id: 'cust_cb_a',
        sub: 'cust_cb_a',
        email: 'cb@store-a.vn',
        role: 'customer',
        tenantId: 'store-a',
        authVersion: 3,
      },
      JWT_SECRET
    );

    const pwRes = await changePassword(
      new Request('https://api.test/api/customer/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custToken}`,
        },
        body: JSON.stringify({
          currentPassword: 'CustomerOldPass1!',
          newPassword: 'CustomerNewPass2!',
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET }
    );
    expect(pwRes.status).toBe(200);
    const updatedCustVer = sqlite
      .prepare('SELECT auth_version FROM customers WHERE id = ? AND tenant_id = ?')
      .get('cust_cb_a', 'store-a') as { auth_version: number };
    expect(updatedCustVer.auth_version).toBe(4);

    const cbApp = new Hono<{ Bindings: Env }>();
    cbApp.use('*', async (c, next) => {
      c.set('customer' as never, { id: 'cust_cb_a', phone: '0901234567', tenant_id: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    cbApp.post('/spend-cashback', (c) => handleSpendCashback(c));

    const spendRes = await cbApp.fetch(
      new Request('https://api.test/spend-cashback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          order_id: 'ord_cb_a1',
          amount: 20000,
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], JWT_SECRET } as Env
    );
    expect(spendRes.status).toBe(500);

    const walletAfterFail = sqlite
      .prepare('SELECT balance, total_spent FROM cashback_wallets WHERE customer_id = ?')
      .get('cust_cb_a') as { balance: number; total_spent: number };
    const orderAfterFail = sqlite
      .prepare('SELECT total, cashback_used FROM orders WHERE id = ?')
      .get('ord_cb_a1') as { total: number; cashback_used: number };

    expect(walletAfterFail.balance).toBe(50000);
    expect(walletAfterFail.total_spent).toBe(0);
    expect(orderAfterFail.total).toBe(100000);
    expect(orderAfterFail.cashback_used).toBe(0);
    sqlite.close();
  });

  it('9. classifies vendor without sessionType as non-staff, enforces customer/vendor revocation in subscription requireVendor, restricts staff search PII enumeration, and persists/returns hourlyRate', async () => {
    expect(isStaffIdentity({ role: 'vendor' })).toBe(false);
    expect(isStaffIdentity({ role: 'customer' })).toBe(false);
    expect(isStaffIdentity({ role: 'waiter' })).toBe(true);
    expect(isStaffIdentity({ role: 'vendor', sessionType: 'staff-web' })).toBe(true);

    const schemaSql = readFileSync(resolve(__dirname, '../../schema.sql'), 'utf-8');
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = OFF;');
    sqlite.exec(schemaSql);
    for (const ddl of [
      'ALTER TABLE customers ADD COLUMN is_active INTEGER DEFAULT 1;',
      'ALTER TABLE customers ADD COLUMN auth_version INTEGER DEFAULT 1;',
      'ALTER TABLE users ADD COLUMN email TEXT;',
      'ALTER TABLE users ADD COLUMN hourly_rate INTEGER;',
    ]) {
      try {
        sqlite.exec(ddl);
      } catch {
        // Column already present in schema.sql
      }
    }

    sqlite
      .prepare(
        "INSERT INTO customers (id, name, email, phone, is_active, auth_version, tenant_id) VALUES ('cust_sub_revoked', 'Revoked Sub Customer', 'revoked@sub.vn', '0905556666', 1, 3, 'store-a')"
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO users (id, name, email, phone, role, is_active, auth_version, hourly_rate, tenant_id) VALUES ('owner_a', 'Owner A', 'owner@store-a.vn', '0901000000', 'owner', 1, 1, 120000, 'store-a')"
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO users (id, name, email, phone, role, is_active, auth_version, hourly_rate, tenant_id) VALUES ('waiter_a', 'Waiter Alpha', 'secret.alpha@store-a.vn', '0909888777', 'waiter', 1, 1, 45000, 'store-a')"
      )
      .run();

    const db = createSqliteD1(sqlite);
    const kv = createMockKv();

    const staleCustomerJwt = await generateJWT(
      { id: 'cust_sub_revoked', role: 'customer', tenantId: 'store-a', authVersion: 1 },
      JWT_SECRET
    );
    const subApp = new Hono<{ Bindings: Env }>();
    subApp.get('/sub-check', async (c) => {
      const err = await requireVendor(c);
      if (err) return err;
      return c.json({ success: true });
    });

    const staleRes = await subApp.fetch(
      new Request('https://api.test/sub-check', {
        headers: { Authorization: `Bearer ${staleCustomerJwt}`, 'X-Tenant-ID': 'store-a' },
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(staleRes.status).toBe(401);

    let caller: { id: string; role: string; tenantId: string } = {
      id: 'owner_a',
      role: 'owner',
      tenantId: 'store-a',
    };
    const staffApp = new OpenAPIHono<{ Bindings: Env }>();
    staffApp.use('*', async (c, next) => {
      c.set('user' as never, caller as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    registerStaffHandlers(staffApp);

    const createRes = await staffApp.fetch(
      new Request('https://api.test/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          name: 'Barista Beta',
          email: 'barista.beta@store-a.vn',
          phone: '0903334444',
          password: 'Password123!',
          role: 'barista',
          hourlyRate: 50000,
        }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(createRes.status).toBe(201);
    const createdStaff = (await createRes.json()) as { data: { id: string; hourlyRate: number | null } };
    expect(createdStaff.data.hourlyRate).toBe(50000);

    const patchRes = await staffApp.fetch(
      new Request(`https://api.test/api/staff/${createdStaff.data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({ hourlyRate: 62000 }),
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(patchRes.status).toBe(200);
    const patchedStaff = (await patchRes.json()) as { data: { hourlyRate: number | null } };
    expect(patchedStaff.data.hourlyRate).toBe(62000);

    caller = { id: 'sup_a', role: 'supervisor', tenantId: 'store-a' };
    const enumByPhoneRes = await staffApp.fetch(
      new Request('https://api.test/api/staff?search=0909888777', {
        headers: { 'X-Tenant-ID': 'store-a' },
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(enumByPhoneRes.status).toBe(200);
    const enumByPhoneBody = (await enumByPhoneRes.json()) as { data: { staff: unknown[] } };
    expect(enumByPhoneBody.data.staff).toHaveLength(0);

    const enumByEmailRes = await staffApp.fetch(
      new Request('https://api.test/api/staff?search=secret.alpha', {
        headers: { 'X-Tenant-ID': 'store-a' },
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(enumByEmailRes.status).toBe(200);
    const enumByEmailBody = (await enumByEmailRes.json()) as { data: { staff: unknown[] } };
    expect(enumByEmailBody.data.staff).toHaveLength(0);

    const searchByNameRes = await staffApp.fetch(
      new Request('https://api.test/api/staff?search=Waiter%20Alpha', {
        headers: { 'X-Tenant-ID': 'store-a' },
      }),
      { AURA_DB: db as unknown as Env['AURA_DB'], AUTH_KV: kv as unknown as Env['AUTH_KV'], JWT_SECRET } as Env
    );
    expect(searchByNameRes.status).toBe(200);
    const searchByNameBody = (await searchByNameRes.json()) as {
      data: { staff: Array<{ id: string; email: string | null; phone: string | null; hourlyRate: number | null }> };
    };
    expect(searchByNameBody.data.staff).toHaveLength(1);
    expect(searchByNameBody.data.staff[0].email).toBeNull();
    expect(searchByNameBody.data.staff[0].phone).toBeNull();
    expect(searchByNameBody.data.staff[0].hourlyRate).toBeNull();
    sqlite.close();
  });
});
