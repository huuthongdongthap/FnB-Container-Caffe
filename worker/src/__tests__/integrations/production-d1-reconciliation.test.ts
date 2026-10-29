// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { createOrder } from '../../../../packages/domain/order/commands/create-order';
import { loginUser } from '../../tree/auth/login';
import { hashPassword, generateJWT } from '../../lib/jwt';
import { loyaltyRouter } from '../../routes/loyalty';

function createLegacyProductionReplica() {
  const sqlite = new DatabaseSync(':memory:');
  const runStatement = new WeakMap<object, () => any>();

  // Exact pre-reconciliation schema mirroring remote fnb-caffe-db
  sqlite.exec(`
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
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

    CREATE TABLE promotions (
      code TEXT PRIMARY KEY,
      percent INTEGER NOT NULL DEFAULT 0,
      max_discount INTEGER DEFAULT 0,
      min_order INTEGER DEFAULT 0,
      usage_limit INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      starts_at TEXT,
      expires_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO promotions (code, percent, max_discount, min_order, usage_limit, usage_count, is_active)
    VALUES ('WELCOME', 10, 30000, 0, 0, 0, 1), ('SUMMER20', 20, 40000, 50000, 100, 0, 1);

    CREATE TABLE bonus_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      cashback_multiplier REAL DEFAULT 1,
      signup_bonus_vnd INTEGER DEFAULT 0,
      signup_bonus_cap INTEGER DEFAULT 0,
      refer_bonus_vnd INTEGER DEFAULT 0,
      max_cap_per_customer_vnd INTEGER DEFAULT 50000,
      auto_upgrade_tier TEXT,
      auto_upgrade_min_spend INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO bonus_campaigns (code, name, start_date, end_date, signup_bonus_vnd, active)
    VALUES ('GRAND_OPENING_6_6_2026', 'Expired June Campaign', '2026-06-06 00:00:00', '2026-06-30 23:59:59', 0, 0);

    CREATE TABLE cashback_wallets (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      balance REAL NOT NULL DEFAULT 0,
      total_earned REAL NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE cashback_transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      order_id TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      expires_at TEXT,
      campaign_id TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE signup_bonus_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT NOT NULL,
      campaign_id INTEGER NOT NULL,
      bonus_vnd INTEGER NOT NULL,
      granted_at TEXT DEFAULT (datetime('now'))
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

    CREATE TABLE promotion_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promotion_id TEXT,
      code TEXT NOT NULL,
      order_id TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      customer_phone TEXT,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      order_total INTEGER NOT NULL DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referred_customer_id TEXT NOT NULL,
      referral_code TEXT NOT NULL,
      points_awarded INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      cashback_awarded_vnd INTEGER DEFAULT 0,
      first_order_id TEXT,
      first_order_amount INTEGER DEFAULT 0,
      reward_paid_at TEXT
    );

    CREATE TABLE staff_shifts (
      id TEXT PRIMARY KEY,
      staff_email TEXT NOT NULL,
      clock_in TEXT NOT NULL,
      clock_out TEXT,
      shift_type TEXT,
      notes TEXT,
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

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT,
      role TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      tenant_id TEXT,
      email TEXT,
      auth_version INTEGER NOT NULL DEFAULT 1,
      password_hash TEXT
    );
    INSERT INTO users (id, name, role, phone, is_active, tenant_id, email, auth_version, password_hash)
    VALUES ('USR_owner_001', 'Nguyễn Văn Chủ', 'owner', '0901234001', 1, NULL, NULL, 1, NULL);

    CREATE TABLE staff_login_identities (
      email TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL UNIQUE REFERENCES users(id)
    );

    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      is_available INTEGER DEFAULT 1,
      available INTEGER DEFAULT 1,
      category_id TEXT DEFAULT 'coffee',
      category TEXT DEFAULT 'coffee'
    );
    INSERT INTO products (id, name, price, is_available, available, category_id, category)
    VALUES ('prod_cf_01', 'Cà Phê Sữa Đá', 45000, 1, 1, 'coffee', 'coffee');

    CREATE TABLE cafe_tables (
      id TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      zone TEXT NOT NULL DEFAULT 'indoor',
      status TEXT NOT NULL DEFAULT 'Available',
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );
    INSERT INTO cafe_tables (id, number, zone, status, tenant_id)
    VALUES ('T01', 1, 'indoor', 'Available', 'default');

    CREATE TABLE _metrics (name TEXT, value REAL, tags TEXT, created_at TEXT);
  `);

  function prepare(sql: string) {
    let args: any[] = [];
    const run = () => {
      const before = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      const result = sqlite.prepare(sql).run(...args);
      const after = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      return { success: true, meta: { changes: after - before, last_row_id: Number(result.lastInsertRowid) } };
    };
    const statement = {
      bind(...values: any[]) {
        args = values;
        return statement;
      },
      async first() {
        return sqlite.prepare(sql).get(...args) ?? null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...args), success: true, meta: {} };
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

  return { sqlite, db, authKV, kvMap };
}

describe('Production D1 Reconciliation & Cutover Migrations (20261029_03 & 20261029_04)', () => {
  const migration03 = readFileSync(
    resolve(__dirname, '../../../db/migrations/20261029_03_production_d1_schema_reconciliation.sql'),
    'utf-8'
  );
  const migration04 = readFileSync(
    resolve(__dirname, '../../../db/migrations/20261029_04_pilot_staff_and_campaign_cutover.sql'),
    'utf-8'
  );

  it('applies 20261029_03 and 20261029_04 cleanly onto legacy fnb-caffe-db replica and enables idempotent checkout + promo lookup', async () => {
    const { sqlite, db, authKV } = createLegacyProductionReplica();

    sqlite.exec(migration03);
    sqlite.exec(migration04);

    // Verify promotions.id was backfilled for pre-existing promo codes
    const summerPromo = sqlite.prepare("SELECT id, code, tenant_id FROM promotions WHERE code = 'SUMMER20'").get() as Record<string, unknown>;
    expect(summerPromo).toMatchObject({
      id: 'promo_summer20',
      code: 'SUMMER20',
      tenant_id: 'default',
    });

    // Verify createOrder with Idempotency-Key and SUMMER20 promo succeeds (201 Created) and replays (200 OK)
    const env = {
      AURA_DB: db,
      AUTH_KV: authKV,
      JWT_SECRET: 'prod-reconciliation-jwt-secret-key-32chars',
      PILOT_TENANT_ID: 'default',
    };

    const orderPayload = {
      customer_name: 'Khách Thử Nghiệm',
      customer_phone: '0908889991',
      order_type: 'takeaway',
      payment_method: 'cod',
      promo_code: 'SUMMER20',
      total: 90000,
      items: [{ id: 'prod_cf_01', name: 'Cà Phê Sữa Đá', price: 45000, quantity: 2 }],
    };

    const req1 = new Request('https://auraspace.cafe/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-prod-reconcile-001',
      },
      body: JSON.stringify(orderPayload),
    });

    const res1 = await createOrder(req1, env);
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as { success: boolean; data: { id: string; discount: number; total: number } };
    expect(body1.success).toBe(true);
    expect(body1.data.discount).toBe(18000); // 20% of 90.000 = 18.000
    expect(body1.data.total).toBe(72000);

    // Replay with same Idempotency-Key hits order_creation_requests
    const req2 = new Request('https://auraspace.cafe/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-prod-reconcile-001',
      },
      body: JSON.stringify(orderPayload),
    });
    const res2 = await createOrder(req2, env);
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-Cache')).toBe('HIT');
  });

  it('reconciles real AUTH_KV Owner and Staff accounts (USR_OWNER_001, USR_morztzcs6p52k, USR_morzvfpc50ree) so loginUser succeeds and imports password_hash into D1', async () => {
    const { sqlite, db, authKV, kvMap } = createLegacyProductionReplica();
    sqlite.exec(migration03);
    sqlite.exec(migration04);

    const ownerPassHash = await hashPassword('OwnerSecret#2026');
    const staffPassHash = await hashPassword('StaffSecret#2026');

    kvMap.set(
      'user:admin@auraspace.vn',
      JSON.stringify({
        id: 'USR_OWNER_001',
        email: 'admin@auraspace.vn',
        name: 'AURA Owner',
        role: 'owner',
        phone: '0901234567',
        password: ownerPassHash,
      })
    );
    kvMap.set(
      'user:huuthong.dongthap@gmail.com',
      JSON.stringify({
        id: 'USR_morztzcs6p52k',
        email: 'huuthong.dongthap@gmail.com',
        name: 'Phan Hữu Thông',
        role: 'staff',
        phone: '0915997989',
        active: true,
        password: staffPassHash,
      })
    );

    const env = {
      AURA_DB: db,
      AUTH_KV: authKV,
      JWT_SECRET: 'prod-reconciliation-jwt-secret-key-32chars',
      PILOT_STORE_ID: 'default',
    };

    const ownerLoginRes = await loginUser(
      new Request('https://auraspace.cafe/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@auraspace.vn', password: 'OwnerSecret#2026' }),
      }),
      env
    );
    expect(ownerLoginRes.status).toBe(200);
    const ownerBody = (await ownerLoginRes.json()) as { success: boolean; user: { id: string; role: string; tenantId: string } };
    expect(ownerBody.success).toBe(true);
    expect(ownerBody.user).toMatchObject({
      id: 'USR_OWNER_001',
      role: 'owner',
      tenantId: 'default',
    });

    // Verify D1 users.password_hash was imported on first login
    const ownerRow = sqlite.prepare("SELECT password_hash FROM users WHERE id = 'USR_OWNER_001'").get() as { password_hash: string };
    expect(ownerRow.password_hash).toBe(ownerPassHash);

    const staffLoginRes = await loginUser(
      new Request('https://auraspace.cafe/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'huuthong.dongthap@gmail.com', password: 'StaffSecret#2026' }),
      }),
      env
    );
    expect(staffLoginRes.status).toBe(200);
  });

  it('activates PILOT_LAUNCH_2026 bonus campaign (50.000 VND) and supports OTP re-authentication for returning customers in production', async () => {
    const { sqlite, db, authKV, kvMap } = createLegacyProductionReplica();
    sqlite.exec(migration03);
    sqlite.exec(migration04);

    const jwtSecret = 'prod-reconciliation-jwt-secret-key-32chars';
    const env = {
      AURA_DB: db,
      AUTH_KV: authKV,
      JWT_SECRET: jwtSecret,
      PILOT_TENANT_ID: 'default',
      ENVIRONMENT: 'production',
    };

    // 1. Check GET /active-campaign returns PILOT_LAUNCH_2026 with 50.000 VND
    const campRes = await loyaltyRouter.request('/active-campaign', { method: 'GET' }, env as never);
    expect(campRes.status).toBe(200);
    const campJson = (await campRes.json()) as { success: boolean; campaign: { code: string; signup_bonus_vnd: number; signup_slots_left: number } };
    expect(campJson.campaign).toMatchObject({
      code: 'PILOT_LAUNCH_2026',
      signup_bonus_vnd: 50000,
      signup_slots_left: 100,
    });

    // 2. New customer signup receives 50.000 VND bonus
    const signupRes = await loyaltyRouter.request(
      '/phone-auth',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0912345678', name: 'Khách Mới Pilot' }),
      },
      env as never
    );
    expect(signupRes.status).toBe(200);
    const signupJson = (await signupRes.json()) as {
      is_new: boolean;
      bonus_granted: number;
      customer: { id: string };
    };
    expect(signupJson.is_new).toBe(true);
    expect(signupJson.bonus_granted).toBe(50000);
    const walletRow = sqlite
      .prepare('SELECT balance FROM cashback_wallets WHERE customer_id = ?')
      .get(signupJson.customer.id) as { balance: number };
    expect(walletRow.balance).toBe(50000);

    // 3. Returning customer on new device without OTP gets 403 PHONE_VERIFICATION_REQUIRED in production
    const reloginBlocked = await loyaltyRouter.request(
      '/phone-auth',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0912345678' }),
      },
      env as never
    );
    expect(reloginBlocked.status).toBe(403);

    // 4. Anonymous /phone-otp/request generates OTP in AUTH_KV without leaking it in JSON response
    const anonOtpRes = await loyaltyRouter.request(
      '/phone-otp/request',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0912345678' }),
      },
      env as never
    );
    expect(anonOtpRes.status).toBe(200);
    const anonOtpJson = (await anonOtpRes.json()) as Record<string, unknown>;
    expect(anonOtpJson.requiresOtp).toBe(true);
    expect(anonOtpJson.otp).toBeUndefined();
    const storedOtp = kvMap.get('phone_otp:0912345678');
    expect(storedOtp).toMatch(/^\d{6}$/);

    // 5. Staff-authenticated /phone-otp/request returns the 6-digit OTP for POS verification
    sqlite.exec(
      "INSERT OR IGNORE INTO users (id, email, name, role, is_active, auth_version, tenant_id) VALUES ('USR_OWNER_001', 'admin@auraspace.vn', 'Owner', 'owner', 1, 1, 'default')"
    );
    const staffToken = await generateJWT(
      {
        id: 'USR_OWNER_001',
        email: 'admin@auraspace.vn',
        role: 'owner',
        sessionType: 'staff-web',
        authVersion: 1,
        authTime: Math.floor(Date.now() / 1000),
        tenantId: 'default',
      },
      jwtSecret,
      3600
    );
    const staffOtpRes = await loyaltyRouter.request(
      '/phone-otp/request',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ phone: '0912345678' }),
      },
      env as never
    );
    expect(staffOtpRes.status).toBe(200);
    const staffOtpJson = (await staffOtpRes.json()) as { otp?: string };
    expect(staffOtpJson.otp).toMatch(/^\d{6}$/);

    // 6. Returning customer submits valid OTP to /phone-auth -> 200 OK + one-time OTP deleted
    const reloginOk = await loyaltyRouter.request(
      '/phone-auth',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0912345678', otp: staffOtpJson.otp }),
      },
      env as never
    );
    expect(reloginOk.status).toBe(200);
    const reloginOkJson = (await reloginOk.json()) as { success: boolean; token: string };
    expect(reloginOkJson.success).toBe(true);
    expect(reloginOkJson.token).toBeTruthy();
    expect(kvMap.get('phone_otp:0912345678')).toBeUndefined();
  });
});
