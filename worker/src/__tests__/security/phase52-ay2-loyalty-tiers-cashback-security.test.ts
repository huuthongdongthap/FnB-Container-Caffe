// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { openApiLoyaltyRouter } from '../../routes/openapi-loyalty';
import { adminLoyaltyRouter } from '../../routes/admin-loyalty';
import { syncLoyaltyAccountAndCustomerBalance } from '../../routes/openapi-loyalty-handlers/loyalty-db-helpers';
import { handlePhoneAuth } from '../../tree/loyalty/phone-auth-handler';
import { handleLookup } from '../../tree/loyalty/lookup-handler';
import { handleSummary } from '../../tree/loyalty/summary-handler';
import { handleSpendCashback } from '../../tree/loyalty/spend-cashback-handler';
import { generateJWT } from '../../lib/jwt';
import type { Env } from '../../types/env';

const JWT_SECRET = 'phase52-ay2-loyalty-tiers-cashback-secret-key-32chars!';

async function makeStaffToken(params: { id: string; email: string; name: string; role: string; tenantId: string }) {
  const nowSec = Math.floor(Date.now() / 1000);
  return generateJWT(
    {
      ...params,
      authVersion: 1,
      authTime: nowSec,
      sessionType: 'staff-web',
    },
    JWT_SECRET,
    3600
  );
}

function createSqliteD1(sqlite: DatabaseSync) {
  const prepare = (sql: string) => {
    const createBound = (args: unknown[]) => ({
      all: async <T = unknown>() => {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...(args as Array<string | number | null>)) as T[];
        return { results: rows, success: true, meta: { changes: 0 } };
      },
      first: async <T = unknown>(colName?: string) => {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(args as Array<string | number | null>)) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as unknown as T;
      },
      run: async () => {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...(args as Array<string | number | null>));
        return {
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
      raw: async () => [],
      _sql: sql,
      _args: args,
    });

    const unbound = createBound([]);
    return {
      ...unbound,
      bind: (...args: unknown[]) => createBound(args),
    };
  };

  return {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const out = [];
      for (const s of stmts) {
        out.push(await s.run());
      }
      return out;
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

function createLoyaltyApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route('/', openApiLoyaltyRouter);
  app.route('/api/admin-loyalty', adminLoyaltyRouter);
  return app;
}

describe('Phase 52 Slice AY2 — OpenAPI Loyalty, Admin Loyalty & Legacy Loyalty Tree Security', () => {
  it('AY2-F1: enforces min_tier on legacy rewards schema, blocks non-default unscoped reward PATCH fallback, and scopes loyalty_rewards counter increment by tenant', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        phone TEXT,
        role TEXT,
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        loyalty_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze',
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE loyalty_accounts (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        tier TEXT DEFAULT 'bronze',
        current_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT,
        updated_at TEXT
      );
      -- Legacy rewards table (no loyalty_rewards table initially) with min_tier column
      CREATE TABLE rewards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        points_cost INTEGER NOT NULL,
        reward_type TEXT DEFAULT 'voucher',
        reward_value REAL DEFAULT 0,
        min_tier TEXT DEFAULT 'bronze',
        is_active INTEGER DEFAULT 1,
        stock INTEGER,
        redeemed_count INTEGER DEFAULT 0,
        image_url TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
      CREATE TABLE loyalty_redemptions (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        customer_id TEXT,
        reward_id TEXT,
        points_spent INTEGER,
        voucher_code TEXT,
        status TEXT DEFAULT 'active',
        tenant_id TEXT DEFAULT 'default',
        redeemed_at TEXT,
        expires_at TEXT
      );
      CREATE TABLE point_transactions (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        customer_id TEXT,
        points INTEGER,
        type TEXT,
        reason TEXT,
        order_id TEXT,
        balance_after INTEGER,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
    `);

    sqlite.exec(`
      INSERT INTO users (id, email, name, role, is_active, tenant_id)
      VALUES ('mgr_b', 'mgr@storeb.vn', 'Mgr B', 'manager', 1, 'store-b');
      INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
      VALUES ('cust_bronze_1', 'Bronze User', '0901111222', 500, 500, 'bronze', 'default');
      INSERT INTO loyalty_accounts (id, customer_id, tier, current_points, lifetime_points, tenant_id)
      VALUES ('la_bronze_1', 'cust_bronze_1', 'bronze', 500, 500, 'default');
      INSERT INTO rewards (id, name, points_cost, min_tier, is_active, stock, redeemed_count, tenant_id)
      VALUES ('rew_gold_only', 'Gold VIP Drink', 100, 'gold', 1, 10, 0, 'default');
    `);

    const env = {
      AURA_DB: createSqliteD1(sqlite),
      JWT_SECRET,
      ENVIRONMENT: 'development',
    } as unknown as Env;
    const app = createLoyaltyApp();

    const bronzeToken = await generateJWT(
      { id: 'cust_bronze_1', email: '', name: 'Bronze User', role: 'customer', tenantId: 'default' },
      JWT_SECRET
    );

    // 1. Bronze customer attempting to redeem a gold-only reward from legacy rewards table is blocked with 403
    const redeemRes = await app.request(
      '/api/loyalty/rewards/redeem',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bronzeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rewardId: 'rew_gold_only', idempotencyKey: 'idem-ay2-1' }),
      },
      env
    );
    expect(redeemRes.status).toBe(403);
    const redeemBody = (await redeemRes.json()) as { error?: string };
    expect(redeemBody.error).toMatch(/Hạng thành viên chưa đủ|minimum tier/i);

    // 2. Non-default store manager cannot PATCH a default-tenant reward via unscoped fallback
    const storeBManagerToken = await makeStaffToken(
      { id: 'mgr_b', email: 'mgr@storeb.vn', name: 'Mgr B', role: 'manager', tenantId: 'store-b' }
    );
    const patchCrossTenantRes = await app.request(
      '/api/loyalty/rewards/rew_gold_only',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${storeBManagerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pointsCost: 1 }),
      },
      env
    );
    expect(patchCrossTenantRes.status).toBe(404);
  });

  it('AY2-F2: validates merged minPoints < maxPoints on PATCH /api/loyalty/tiers/{tier} and isolates tenant tier customizations', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        phone TEXT,
        role TEXT,
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE loyalty_tier_configs (
        tier TEXT NOT NULL,
        name TEXT NOT NULL,
        min_points INTEGER NOT NULL,
        max_points INTEGER,
        points_multiplier REAL DEFAULT 1,
        cashback_rate REAL DEFAULT 0.02,
        perks TEXT DEFAULT '[]',
        birthday_bonus INTEGER DEFAULT 0,
        free_shipping INTEGER DEFAULT 0,
        priority_support INTEGER DEFAULT 0,
        discount_percent REAL DEFAULT 0,
        color TEXT DEFAULT '#CD7F32',
        icon TEXT DEFAULT 'award',
        tenant_id TEXT DEFAULT 'default',
        updated_at TEXT
      );
      INSERT INTO users (id, email, name, role, is_active, tenant_id)
      VALUES ('owner_def', 'owner@default.vn', 'Default Owner', 'owner', 1, 'default'),
             ('owner_b', 'owner@storeb.vn', 'Store B Owner', 'owner', 1, 'store-b');
      INSERT INTO loyalty_tier_configs (tier, name, min_points, max_points, points_multiplier, cashback_rate, perks, birthday_bonus, tenant_id)
      VALUES ('silver', 'Silver', 200, 500, 1.2, 0.03, '["perk1"]', 50, 'default');
    `);

    const env = {
      AURA_DB: createSqliteD1(sqlite),
      JWT_SECRET,
      ENVIRONMENT: 'development',
    } as unknown as Env;
    const app = createLoyaltyApp();

    const defaultOwnerToken = await makeStaffToken(
      { id: 'owner_def', email: 'owner@default.vn', name: 'Default Owner', role: 'owner', tenantId: 'default' }
    );

    // 1. Partial PATCH with only minPoints >= existing.max_points (600 >= 500) is rejected with 400
    const badMinRes = await app.request(
      '/api/loyalty/tiers/silver',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${defaultOwnerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ minPoints: 600 }),
      },
      env
    );
    expect(badMinRes.status).toBe(400);

    // 2. Partial PATCH with only maxPoints <= existing.min_points (150 <= 200) is rejected with 400
    const badMaxRes = await app.request(
      '/api/loyalty/tiers/silver',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${defaultOwnerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxPoints: 150 }),
      },
      env
    );
    expect(badMaxRes.status).toBe(400);

    // 3. Default-store owner attempting to mutate store-b via X-Tenant-Id is rejected with 403
    const crossTenantTierRes = await app.request(
      '/api/loyalty/tiers/silver',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${defaultOwnerToken}`,
          'X-Tenant-Id': 'store-b',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ minPoints: 250, maxPoints: 700 }),
      },
      env
    );
    expect(crossTenantTierRes.status).toBe(403);

    // 4. Store-B owner customizing 'silver' creates a store-b row without overwriting 'default'
    const storeBOwnerToken = await makeStaffToken(
      { id: 'owner_b', email: 'owner@storeb.vn', name: 'Store B Owner', role: 'owner', tenantId: 'store-b' }
    );
    const storeBPatchRes = await app.request(
      '/api/loyalty/tiers/silver',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${storeBOwnerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ minPoints: 300, maxPoints: 800, birthdayBonus: 120 }),
      },
      env
    );
    expect(storeBPatchRes.status).toBe(200);

    const defaultRow = sqlite
      .prepare("SELECT min_points, max_points, birthday_bonus FROM loyalty_tier_configs WHERE tier = 'silver' AND tenant_id = 'default'")
      .get() as { min_points: number; max_points: number; birthday_bonus: number };
    const storeBRow = sqlite
      .prepare("SELECT min_points, max_points, birthday_bonus FROM loyalty_tier_configs WHERE tier = 'silver' AND tenant_id = 'store-b'")
      .get() as { min_points: number; max_points: number; birthday_bonus: number };

    expect(defaultRow).toEqual({ min_points: 200, max_points: 500, birthday_bonus: 50 });
    expect(storeBRow).toEqual({ min_points: 300, max_points: 800, birthday_bonus: 120 });
  });

  it('AY2-F3: prevents cross-tenant birthday claim and blocks empty-result cross-tenant table scans on OpenAPI loyalty admin routes', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const todayMmDd = new Date().toISOString().slice(5, 10);
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        phone TEXT,
        role TEXT,
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE customers (
        id TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        email TEXT,
        date_of_birth TEXT,
        birthday TEXT,
        loyalty_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze',
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE loyalty_accounts (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        tier TEXT DEFAULT 'bronze',
        current_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        birthday TEXT,
        birthday_claimed_year INTEGER,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE loyalty_tier_configs (
        tier TEXT NOT NULL,
        name TEXT NOT NULL,
        min_points INTEGER NOT NULL,
        max_points INTEGER,
        points_multiplier REAL DEFAULT 1,
        cashback_rate REAL DEFAULT 0.02,
        perks TEXT DEFAULT '[]',
        birthday_bonus INTEGER DEFAULT 100,
        tenant_id TEXT DEFAULT 'default'
      );
      INSERT INTO users (id, email, name, role, is_active, tenant_id)
      VALUES ('mgr_empty', 'mgr@empty.vn', 'Empty Mgr', 'manager', 1, 'store-empty');
      INSERT INTO loyalty_tier_configs (tier, name, min_points, max_points, birthday_bonus, tenant_id)
      VALUES ('bronze', 'Bronze', 0, 500, 100, 'default');
      -- Default tenant customer has birthday today and 500 points
      INSERT INTO customers (id, name, phone, date_of_birth, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
      VALUES ('cust_shared_id', 'Default Customer', '0909000111', '1995-${todayMmDd}', 500, 500, 'bronze', 'default');
      INSERT INTO loyalty_accounts (id, customer_id, tier, current_points, lifetime_points, birthday, tenant_id)
      VALUES ('la_def_1', 'cust_shared_id', 'bronze', 500, 500, '1995-${todayMmDd}', 'default');
      -- Store-B customer and loyalty account have NO birthday set
      INSERT INTO customers (id, name, phone, date_of_birth, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
      VALUES ('cust_shared_id', 'Store B Customer', '0909000111', NULL, 10, 10, 'bronze', 'store-b');
      INSERT INTO loyalty_accounts (id, customer_id, tier, current_points, lifetime_points, birthday, tenant_id)
      VALUES ('la_store_b_1', 'cust_shared_id', 'bronze', 10, 10, NULL, 'store-b');
    `);

    const env = {
      AURA_DB: createSqliteD1(sqlite),
      JWT_SECRET,
      ENVIRONMENT: 'development',
    } as unknown as Env;
    const app = createLoyaltyApp();

    // 1. Store-B customer with same customerId cannot use default tenant's customers.date_of_birth fallback
    const storeBCustToken = await generateJWT(
      { id: 'cust_shared_id', email: '', name: 'Store B Customer', role: 'customer', tenantId: 'store-b' },
      JWT_SECRET
    );
    const bdayRes = await app.request(
      '/api/loyalty/account/birthday-bonus',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${storeBCustToken}` },
      },
      env
    );
    expect(bdayRes.status).toBe(400);
    const bdayJson = (await bdayRes.json()) as { error?: string };
    expect(bdayJson.error).toMatch(/Customer birthday is not configured/i);

    // 2. Empty tenant (store-empty) manager querying /api/loyalty/admin/accounts and /api/loyalty/admin/summary gets 0 rows, not default tenant rows
    const emptyMgrToken = await makeStaffToken(
      { id: 'mgr_empty', email: 'mgr@empty.vn', name: 'Empty Mgr', role: 'manager', tenantId: 'store-empty' }
    );
    const listRes = await app.request(
      '/api/loyalty/admin/accounts',
      { headers: { Authorization: `Bearer ${emptyMgrToken}` } },
      env
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { data: unknown[]; meta: { total: number } };
    expect(listJson.data).toHaveLength(0);

    const summaryRes = await app.request(
      '/api/loyalty/admin/summary',
      { headers: { Authorization: `Bearer ${emptyMgrToken}` } },
      env
    );
    expect(summaryRes.status).toBe(200);
    const summaryJson = (await summaryRes.json()) as { data: { totalMembers: number; totalPointsIssued: number } };
    expect(summaryJson.data.totalMembers).toBe(0);
    expect(summaryJson.data.totalPointsIssued).toBe(0);
  });

  it('AY2-F4: enforces atomic current_points >= abs(pointsDelta) guard on negative adjustments in syncLoyaltyAccountAndCustomerBalance', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        loyalty_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze',
        tenant_id TEXT DEFAULT 'default',
        updated_at TEXT
      );
      CREATE TABLE loyalty_accounts (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        tier TEXT DEFAULT 'bronze',
        current_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        last_activity_at TEXT,
        tenant_id TEXT DEFAULT 'default',
        updated_at TEXT
      );
      INSERT INTO customers (id, name, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
      VALUES ('cust_bal_1', 'Balance User', 50, 100, 'bronze', 'default');
      INSERT INTO loyalty_accounts (id, customer_id, tier, current_points, lifetime_points, tenant_id)
      VALUES ('la_bal_1', 'cust_bal_1', 'bronze', 50, 100, 'default');
    `);

    const db = createSqliteD1(sqlite);

    const syncRes = await syncLoyaltyAccountAndCustomerBalance(db, {
      accountId: 'la_bal_1',
      customerId: 'cust_bal_1',
      newBalance: 0,
      pointsDelta: -80,
      lifetimeDelta: 0,
      tenantId: 'default',
      now: new Date().toISOString(),
    });
    expect(syncRes).toBeNull();

    // Verify neither loyalty_accounts nor customers was mutated or clamped to 0
    const accRow = sqlite.prepare("SELECT current_points FROM loyalty_accounts WHERE id = 'la_bal_1'").get() as { current_points: number };
    const custRow = sqlite.prepare("SELECT loyalty_points FROM customers WHERE id = 'cust_bal_1'").get() as { loyalty_points: number };
    expect(accRow.current_points).toBe(50);
    expect(custRow.loyalty_points).toBe(50);
  });

  it('AY2-F5: confines default-tenant owner/admin on /api/admin-loyalty/* and prevents cross-tenant 5000-row fallback scans', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        phone TEXT,
        role TEXT,
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        loyalty_tier TEXT DEFAULT 'gold',
        tier TEXT DEFAULT 'gold',
        loyalty_points INTEGER DEFAULT 200,
        cashback_balance INTEGER DEFAULT 15000,
        total_spent INTEGER DEFAULT 500000,
        visit_count INTEGER DEFAULT 5,
        tenant_id TEXT DEFAULT 'default',
        date_of_birth TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE cashback_wallets (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        balance INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        customer_phone TEXT,
        total REAL DEFAULT 0,
        status TEXT DEFAULT 'completed',
        payment_status TEXT DEFAULT 'paid',
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE checkins (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        status TEXT DEFAULT 'approved',
        tenant_id TEXT DEFAULT 'default'
      );
      INSERT INTO users (id, email, name, role, is_active, tenant_id)
      VALUES ('own_def', 'owner@def.vn', 'Def Owner', 'owner', 1, 'default'),
             ('own_hq', 'hq@aura.vn', 'HQ Owner', 'owner', 1, '*'),
             ('own_c', 'owner@storec.vn', 'Store C Owner', 'owner', 1, 'store-c'),
             ('sup_def', 'sup@def.vn', 'Supervisor', 'supervisor', 1, 'default');
      INSERT INTO customers (id, name, phone, email, loyalty_tier, tier, loyalty_points, cashback_balance, total_spent, visit_count, tenant_id, created_at, updated_at)
      VALUES ('c_def', 'Default VIP', '0901234567', 'vip@def.vn', 'gold', 'gold', 200, 15000, 500000, 5, 'default', '2026-01-01T00:00:00Z', '2026-11-01T00:00:00Z');
      INSERT INTO customers (id, name, phone, email, loyalty_tier, tier, loyalty_points, cashback_balance, total_spent, visit_count, tenant_id, created_at, updated_at)
      VALUES ('c_b', 'Store B Member', '0907654321', 'b@storeb.vn', 'silver', 'silver', 80, 5000, 150000, 2, 'store-b', '2026-02-01T00:00:00Z', '2026-11-01T00:00:00Z');
    `);

    const env = {
      AURA_DB: createSqliteD1(sqlite),
      JWT_SECRET,
      ENVIRONMENT: 'development',
    } as unknown as Env;
    const app = createLoyaltyApp();

    // 1. Default-store owner is NOT HQ and cannot query ?tenant_id=store-b
    const defaultOwnerToken = await makeStaffToken(
      { id: 'own_def', email: 'owner@def.vn', name: 'Def Owner', role: 'owner', tenantId: 'default' }
    );
    const forbiddenRes = await app.request(
      '/api/admin-loyalty/widgets?tenant_id=store-b',
      { headers: { Authorization: `Bearer ${defaultOwnerToken}` } },
      env
    );
    expect(forbiddenRes.status).toBe(403);

    // 2. HQ super-admin (tenantId: '*') CAN query ?tenant_id=store-b and sees only store-b data
    const hqOwnerToken = await makeStaffToken(
      { id: 'own_hq', email: 'hq@aura.vn', name: 'HQ Owner', role: 'owner', tenantId: '*' }
    );
    const hqScopedRes = await app.request(
      '/api/admin-loyalty/tiers?tenant_id=store-b',
      { headers: { Authorization: `Bearer ${hqOwnerToken}` } },
      env
    );
    expect(hqScopedRes.status).toBe(200);
    const hqScopedJson = (await hqScopedRes.json()) as { data: { total: number; distribution: Array<{ tier: string; count: number }> } };
    expect(hqScopedJson.data.total).toBe(1);
    expect(hqScopedJson.data.distribution[0].tier).toBe('silver');

    // 3. Empty non-default store (store-c) gets 0 customers on /widgets, /tiers, /top-customers, /export
    const storeCOwnerToken = await makeStaffToken(
      { id: 'own_c', email: 'owner@storec.vn', name: 'Store C Owner', role: 'owner', tenantId: 'store-c' }
    );
    const emptyTiersRes = await app.request(
      '/api/admin-loyalty/tiers',
      { headers: { Authorization: `Bearer ${storeCOwnerToken}` } },
      env
    );
    expect(emptyTiersRes.status).toBe(200);
    const emptyTiersJson = (await emptyTiersRes.json()) as { data: { total: number } };
    expect(emptyTiersJson.data.total).toBe(0);

    const emptyTopRes = await app.request(
      '/api/admin-loyalty/top-customers',
      { headers: { Authorization: `Bearer ${storeCOwnerToken}` } },
      env
    );
    expect(emptyTopRes.status).toBe(200);
    const emptyTopJson = (await emptyTopRes.json()) as { data: unknown[] };
    expect(emptyTopJson.data).toHaveLength(0);

    // 4. Supervisor is blocked from /api/admin-loyalty/export (403)
    const supervisorToken = await makeStaffToken(
      { id: 'sup_def', email: 'sup@def.vn', name: 'Supervisor', role: 'supervisor', tenantId: 'default' }
    );
    const supExportRes = await app.request(
      '/api/admin-loyalty/export',
      { headers: { Authorization: `Bearer ${supervisorToken}` } },
      env
    );
    expect(supExportRes.status).toBe(403);
  });

  it('AY2-F6: blocks production Khách Mới Pilot OTP bypass, scopes signup_bonus_log cap by tenant_id, and requires verified OTP for referral redemption on signup', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        phone TEXT,
        loyalty_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze',
        date_of_birth TEXT,
        zalo TEXT,
        source TEXT,
        verified_at TEXT,
        referral_code TEXT,
        referred_by TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE cashback_wallets (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        balance INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE cashback_transactions (
        id TEXT PRIMARY KEY,
        wallet_id TEXT,
        customer_id TEXT,
        order_id TEXT,
        type TEXT,
        amount INTEGER,
        balance_after INTEGER,
        expires_at TEXT,
        campaign_id TEXT,
        description TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
      CREATE TABLE bonus_campaigns (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        active INTEGER DEFAULT 1,
        start_date TEXT,
        end_date TEXT,
        signup_bonus_vnd INTEGER DEFAULT 10000,
        signup_bonus_cap INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
      CREATE TABLE signup_bonus_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id TEXT,
        campaign_id TEXT,
        bonus_vnd INTEGER,
        tenant_id TEXT DEFAULT 'default',
        granted_at TEXT
      );
      CREATE TABLE loyalty_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id TEXT,
        action TEXT,
        amount_vnd INTEGER,
        metadata TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
      CREATE TABLE referral_redemptions (
        id TEXT PRIMARY KEY,
        referrer_id TEXT,
        referee_id TEXT,
        referral_code TEXT,
        referrer_reward_points INTEGER,
        referee_reward_points INTEGER,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
      INSERT INTO bonus_campaigns (id, code, name, active, start_date, end_date, signup_bonus_vnd, signup_bonus_cap, tenant_id, created_at)
      VALUES ('camp_shared', 'OPEN', 'Opening Bonus', 1, '2020-01-01 00:00:00', '2030-01-01 00:00:00', 10000, 1, 'store-b', '2026-01-01T00:00:00Z');
      -- Store A already used 1 bonus on campaign ID camp_shared
      INSERT INTO signup_bonus_log (customer_id, campaign_id, bonus_vnd, tenant_id, granted_at)
      VALUES ('cust_a_prev', 'camp_shared', 10000, 'store-a', '2026-01-02T00:00:00Z');
      -- Referrer in store-b
      INSERT INTO customers (id, email, name, phone, referral_code, tenant_id, created_at)
      VALUES ('ref_owner_b', 'ref@b.vn', 'Referrer B', '0911000111', 'REFB123', 'store-b', '2026-01-01T00:00:00Z');
    `);

    const db = createSqliteD1(sqlite);

    // 1. Production '/phone-auth' with 'Khách Mới Pilot' without OTP does NOT grant signup bonus or mark phone_verified: true
    const prodApp = new Hono<{ Bindings: Env }>();
    prodApp.post('/phone-auth', handlePhoneAuth);
    const prodRes = await prodApp.request(
      '/phone-auth',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0988777666', name: 'Khách Mới Pilot' }),
      },
      {
        AURA_DB: db,
        JWT_SECRET,
        ENVIRONMENT: 'production',
        PILOT_TENANT_ID: 'store-b',
      } as unknown as Env
    );
    expect(prodRes.status).toBe(200);
    const prodJson = (await prodRes.json()) as { bonus_granted: number; customer: { phone_verified: boolean } };
    expect(prodJson.bonus_granted).toBe(0);
    expect(prodJson.customer.phone_verified).toBe(false);

    // 2. Non-production unverified signup in store-b receives store-b's signup bonus (not blocked by store-a's signup_bonus_log row),
    //    AND does NOT redeem referral_code because newCustomerVerified is false
    const waitUntilPromises: Promise<unknown>[] = [];
    const devRes = await prodApp.request(
      '/phone-auth',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '0988111222',
          name: 'Unverified Store B User',
          referral_code: 'REFB123',
        }),
      },
      {
        AURA_DB: db,
        JWT_SECRET,
        ENVIRONMENT: 'development',
        PILOT_TENANT_ID: 'store-b',
      } as unknown as Env,
      {
        waitUntil: (p: Promise<unknown>) => {
          waitUntilPromises.push(p);
        },
        passThroughOnException: () => {},
        props: {},
      } as unknown as ExecutionContext
    );
    expect(devRes.status).toBe(200);
    const devJson = (await devRes.json()) as { bonus_granted: number; customer: { phone_verified: boolean } };
    expect(devJson.bonus_granted).toBe(10000);
    expect(devJson.customer.phone_verified).toBe(false);

    await Promise.all(waitUntilPromises);
    const refCountAfterUnverified = sqlite
      .prepare('SELECT COUNT(*) as cnt FROM referral_redemptions')
      .get() as { cnt: number };
    expect(refCountAfterUnverified.cnt).toBe(0);
  });

  it('AY2-F7: scopes loyalty_tiers and active rewards by tenant in lookup-handler and summary-handler', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        phone TEXT,
        loyalty_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze',
        verified_at TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
      CREATE TABLE cashback_wallets (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        balance INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE cashback_transactions (
        id TEXT PRIMARY KEY,
        wallet_id TEXT,
        customer_id TEXT,
        type TEXT,
        amount INTEGER,
        expires_at TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE loyalty_tiers (
        tier_name TEXT NOT NULL,
        min_points INTEGER NOT NULL,
        cashback_rate REAL DEFAULT 0.02,
        points_multiplier REAL DEFAULT 1,
        perks TEXT DEFAULT '[]',
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE user_rewards (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        status TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      -- Store A has a low silver threshold (100), Store B has a high silver threshold (500)
      INSERT INTO loyalty_tiers (tier_name, min_points, cashback_rate, points_multiplier, tenant_id)
      VALUES ('bronze', 0, 0.02, 1, 'store-a'),
             ('silver', 100, 0.05, 1.5, 'store-a'),
             ('bronze', 0, 0.02, 1, 'store-b'),
             ('silver', 500, 0.04, 1.2, 'store-b');
      INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, verified_at, tenant_id, created_at)
      VALUES ('cust_b_1', 'b1@storeb.vn', 'Customer B1', '0903334444', 50, 50, 'bronze', '2026-01-01T00:00:00Z', 'store-b', '2026-01-01T00:00:00Z');
      INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
      VALUES ('wal_b_1', 'cust_b_1', 20000, 20000, 0, 'store-b');
      INSERT INTO user_rewards (id, customer_id, status, tenant_id)
      VALUES ('ur_1', 'cust_b_1', 'active', 'store-b'),
             ('ur_2', 'cust_b_1', 'pending', 'store-b'),
             ('ur_3', 'cust_b_1', 'used', 'store-b'),
             ('ur_other_tenant', 'cust_b_1', 'active', 'store-a');
    `);

    const db = createSqliteD1(sqlite);
    const app = new Hono<{ Bindings: Env }>();
    app.get('/lookup', handleLookup);
    app.get('/summary', async (c, next) => {
      c.set('customer' as never, {
        id: 'cust_b_1',
        email: 'b1@storeb.vn',
        name: 'Customer B1',
        phone: '0903334444',
        loyalty_points: 50,
        lifetime_points: 50,
        loyalty_tier: 'bronze',
        verified_at: '2026-01-01T00:00:00Z',
        tenant_id: 'store-b',
        created_at: '2026-01-01T00:00:00Z',
      } as never);
      await next();
    }, handleSummary);

    const custTokenB = await generateJWT(
      { id: 'cust_b_1', email: 'b1@storeb.vn', name: 'Customer B1', role: 'customer', tenantId: 'store-b' },
      JWT_SECRET
    );

    const env = {
      AURA_DB: db,
      JWT_SECRET,
      PILOT_TENANT_ID: 'store-b',
    } as unknown as Env;

    // 1. Lookup uses store-b's silver threshold (500, so to_next = 450), not store-a's (100)
    const lookupRes = await app.request(
      '/lookup?phone=0903334444',
      { headers: { Authorization: `Bearer ${custTokenB}` } },
      env
    );
    expect(lookupRes.status).toBe(200);
    const lookupJson = (await lookupRes.json()) as {
      ok: boolean;
      member: { tier_progress: { next_tier: string; to_next: number } };
    };
    expect(lookupJson.ok).toBe(true);
    expect(lookupJson.member.tier_progress.next_tier).toBe('silver');
    expect(lookupJson.member.tier_progress.to_next).toBe(450);

    // 2. Summary uses store-b's next_tier (min_points = 500) and counts both active + pending rewards in store-b (2)
    const summaryRes = await app.request('/summary', {}, env);
    expect(summaryRes.status).toBe(200);
    const summaryJson = (await summaryRes.json()) as {
      success: boolean;
      data: { next_tier: { tier_name: string; min_points: number }; active_rewards: number };
    };
    expect(summaryJson.data.next_tier).toEqual({ tier_name: 'silver', min_points: 500 });
    expect(summaryJson.data.active_rewards).toBe(2);
  });

  it('AY2-F8: deducts cashback from both orders.total and orders.total_amount in spend-cashback-handler', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        customer_phone TEXT,
        total INTEGER,
        total_amount INTEGER,
        discount INTEGER DEFAULT 0,
        cashback_used INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'unpaid',
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE cashback_wallets (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        balance INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        tenant_id TEXT DEFAULT 'default',
        updated_at TEXT
      );
      CREATE TABLE cashback_transactions (
        id TEXT PRIMARY KEY,
        wallet_id TEXT,
        customer_id TEXT,
        order_id TEXT,
        type TEXT,
        amount INTEGER,
        balance_after INTEGER,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT
      );
      INSERT INTO orders (id, customer_id, customer_phone, total, total_amount, discount, cashback_used, status, payment_status, tenant_id)
      VALUES ('ord_dual_1', 'cust_sp_1', '0905556666', 100000, 100000, 0, 0, 'pending', 'unpaid', 'store-b');
      INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
      VALUES ('wal_sp_1', 'cust_sp_1', 50000, 50000, 0, 'store-b');
    `);

    const db = createSqliteD1(sqlite);
    const app = new Hono<{ Bindings: Env }>();
    app.post('/spend-cashback', async (c, next) => {
      c.set('customer' as never, {
        id: 'cust_sp_1',
        phone: '0905556666',
        tenant_id: 'store-b',
      } as never);
      await next();
    }, handleSpendCashback);

    const res = await app.request(
      '/spend-cashback',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ord_dual_1', amount: 30000 }),
      },
      {
        AURA_DB: db,
        JWT_SECRET,
        PILOT_TENANT_ID: 'store-b',
      } as unknown as Env
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { amount_spent: number; new_balance: number; order_total: number };
    };
    expect(json.success).toBe(true);
    expect(json.data).toEqual({
      amount_spent: 30000,
      new_balance: 20000,
      order_total: 70000,
    });

    const orderRow = sqlite
      .prepare("SELECT total, total_amount, discount, cashback_used FROM orders WHERE id = 'ord_dual_1'")
      .get() as { total: number; total_amount: number; discount: number; cashback_used: number };
    expect(orderRow).toEqual({
      total: 70000,
      total_amount: 70000,
      discount: 30000,
      cashback_used: 30000,
    });
  });
});
