// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { DatabaseSync } from 'node:sqlite';
import { loyaltyRouter } from '../../routes/loyalty';
import { adminLoyaltyRouter } from '../../routes/admin-loyalty';
import { referralRouter } from '../../routes/referrals';
import { applyReferralForNewCustomer } from '../../tree/referrals/apply-referral';
import { processReferralOnFirstOrder } from '../../tree/referrals/process-referral';
import { processReferralCashbackOnFirstOrder } from '../../tree/referrals/referral-cashback';
import { handleSpendCashback } from '../../tree/loyalty/spend-cashback-handler';
import { registerAccountHandlers } from '../../routes/openapi-loyalty-handlers/account-handlers';
import { registerAdminHandlers } from '../../routes/openapi-loyalty-handlers/admin-handlers';
import { registerRewardHandlers } from '../../routes/openapi-loyalty-handlers/reward-handlers';
import { getLoyaltyAccountWithFallback } from '../../routes/openapi-loyalty-handlers/loyalty-db-helpers';
import { generateJWT } from '../../lib/jwt';
import { issueStaffSession } from '../../lib/staff-session';
import type { Env } from '../../types/env';

const TEST_JWT_SECRET = 'phase49-av1-loyalty-referrals-secret-key-32chars!';

function createSqliteD1Adapter(sql: DatabaseSync) {
  function prepareStmt(query: string, boundArgs: unknown[] = []) {
    return {
      bind(...args: unknown[]) {
        return prepareStmt(query, args);
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const stmt = sql.prepare(query);
        const row = stmt.get(...(boundArgs as any[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as unknown as T;
      },
      async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
        const stmt = sql.prepare(query);
        const rows = stmt.all(...(boundArgs as any[])) as unknown as T[];
        return { results: rows, success: true };
      },
      async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
        const stmt = sql.prepare(query);
        const info = stmt.run(...(boundArgs as any[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
    };
  }

  return {
    prepare(query: string) {
      return prepareStmt(query);
    },
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      const out: unknown[] = [];
      for (const s of stmts) {
        out.push(await s.run());
      }
      return out;
    },
  };
}

function createLoyaltyTestSchema(sql: DatabaseSync) {
  sql.exec(`
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      birthday TEXT,
      date_of_birth TEXT,
      loyalty_points INTEGER DEFAULT 0,
      lifetime_points INTEGER DEFAULT 0,
      loyalty_tier TEXT DEFAULT 'bronze',
      tier TEXT DEFAULT 'bronze',
      cashback_balance REAL DEFAULT 0,
      total_spent REAL DEFAULT 0,
      visit_count INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      phone TEXT,
      role TEXT,
      active INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      auth_version INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE loyalty_accounts (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      current_points INTEGER DEFAULT 0,
      lifetime_points INTEGER DEFAULT 0,
      tier TEXT DEFAULT 'bronze',
      order_count INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      last_activity_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE loyalty_point_logs (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      order_id TEXT,
      points_change INTEGER,
      reason TEXT,
      balance_after INTEGER,
      description TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE rewards (
      id TEXT PRIMARY KEY,
      title TEXT,
      name TEXT,
      description TEXT,
      point_cost INTEGER DEFAULT 100,
      points_cost INTEGER DEFAULT 100,
      discount_type TEXT DEFAULT 'voucher',
      discount_value REAL DEFAULT 0,
      type TEXT DEFAULT 'voucher',
      value REAL DEFAULT 0,
      reward_type TEXT DEFAULT 'voucher',
      reward_value TEXT DEFAULT '0',
      min_tier TEXT DEFAULT 'bronze',
      stock INTEGER DEFAULT -1,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE loyalty_rewards (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      points_cost INTEGER DEFAULT 100,
      type TEXT DEFAULT 'voucher',
      value REAL DEFAULT 0,
      reward_type TEXT DEFAULT 'voucher',
      reward_value TEXT DEFAULT '0',
      max_redemptions INTEGER,
      current_redemptions INTEGER DEFAULT 0,
      stock INTEGER,
      redeemed_count INTEGER DEFAULT 0,
      valid_from TEXT,
      valid_to TEXT,
      is_active INTEGER DEFAULT 1,
      image_url TEXT,
      terms TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE user_rewards (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      reward_id TEXT,
      code TEXT,
      status TEXT DEFAULT 'active',
      expires_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE loyalty_redemptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      reward_id TEXT,
      code TEXT,
      points_spent INTEGER,
      order_id TEXT,
      status TEXT DEFAULT 'active',
      expires_at TEXT,
      redeemed_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE cashback_wallets (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      balance REAL DEFAULT 0,
      total_earned REAL DEFAULT 0,
      total_spent REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE cashback_transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT,
      customer_id TEXT,
      order_id TEXT,
      type TEXT,
      amount REAL,
      balance_after REAL,
      description TEXT,
      expires_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      order_number TEXT,
      customer_id TEXT,
      customer_phone TEXT,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'unpaid',
      total REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      cashback_used REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE referral_codes (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      code TEXT UNIQUE,
      times_used INTEGER DEFAULT 0,
      max_uses INTEGER,
      total_points_earned INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT,
      referred_customer_id TEXT,
      referral_code TEXT,
      points_awarded INTEGER DEFAULT 0,
      cashback_awarded_vnd REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      bonus_type TEXT DEFAULT 'cashback',
      first_order_id TEXT,
      first_order_amount REAL,
      reward_paid_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE loyalty_tier_configs (
      tier TEXT PRIMARY KEY,
      name TEXT,
      min_points INTEGER DEFAULT 0,
      points_multiplier REAL DEFAULT 1,
      point_multiplier REAL DEFAULT 1,
      cashback_rate REAL DEFAULT 0.02,
      birthday_bonus INTEGER DEFAULT 500,
      tenant_id TEXT DEFAULT 'default',
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE loyalty_tiers (
      tier TEXT PRIMARY KEY,
      tier_name TEXT,
      min_points INTEGER DEFAULT 0,
      points_multiplier REAL DEFAULT 1,
      cashback_rate REAL DEFAULT 0.02,
      birthday_bonus INTEGER DEFAULT 500,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE loyalty_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT,
      action TEXT,
      amount_vnd REAL,
      order_id TEXT,
      metadata TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE audit_logs (
      id TEXT,
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
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

describe('Phase 49 Slice AV1 — Loyalty, Cashback, Referrals & Admin Loyalty Hardening', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('1. loyalty.ts: refunds both customers.loyalty_points and loyalty_accounts.current_points when reward stock/cap CAS fails on POST /redeem', async () => {
    const sql = new DatabaseSync(':memory:');
    createLoyaltyTestSchema(sql);
    const d1 = createSqliteD1Adapter(sql);

    sql.exec(`
      INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
      VALUES ('cust_av1_1', 'Customer One', '0901000001', 500, 500, 'silver', 'store_a');
      INSERT INTO loyalty_accounts (id, customer_id, current_points, lifetime_points, tier, tenant_id)
      VALUES ('la_cust_av1_1', 'cust_av1_1', 500, 500, 'silver', 'store_a');
      INSERT INTO rewards (id, title, name, point_cost, points_cost, min_tier, stock, is_active, tenant_id)
      VALUES ('rew_race_1', 'Cold Brew Voucher', 'Cold Brew Voucher', 200, 200, 'bronze', 1, 1, 'store_a');
    `);

    // Simulate concurrent stock exhaustion right after the initial reward read
    const origPrepare = d1.prepare.bind(d1);
    vi.spyOn(d1, 'prepare').mockImplementation((query: string) => {
      if (query.includes('UPDATE rewards SET stock = MAX(0, stock - 1)')) {
        sql.exec("UPDATE rewards SET stock = 0 WHERE id = 'rew_race_1'");
      }
      return origPrepare(query);
    });

    const token = await generateJWT(
      { id: 'cust_av1_1', sub: 'cust_av1_1', role: 'customer', type: 'loyalty_customer', tenantId: 'store_a' },
      TEST_JWT_SECRET
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/loyalty', loyaltyRouter);

    const res = await app.fetch(
      new Request('http://localhost/api/loyalty/redeem', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reward_id: 'rew_race_1' }),
      }),
      { AURA_DB: d1 as any, JWT_SECRET: TEST_JWT_SECRET, PILOT_TENANT_ID: 'store_a' } as unknown as Env
    );

    expect(res.status).toBe(409);
    const custRow = sql.prepare("SELECT loyalty_points FROM customers WHERE id = 'cust_av1_1'").get() as { loyalty_points: number };
    const acctRow = sql.prepare("SELECT current_points FROM loyalty_accounts WHERE customer_id = 'cust_av1_1'").get() as { current_points: number };
    expect(custRow.loyalty_points).toBe(500);
    expect(acctRow.current_points).toBe(500);
  });

  it('2. loyalty.ts: clamps limit/offset on GET /points and GET /cashback and filters cross-tenant fallback rows on GET /cashback and GET /tiers', async () => {
    const sql = new DatabaseSync(':memory:');
    createLoyaltyTestSchema(sql);
    const d1 = createSqliteD1Adapter(sql);

    sql.exec(`
      INSERT INTO customers (id, name, phone, loyalty_points, loyalty_tier, tenant_id)
      VALUES ('cust_av1_2', 'Customer Two', '0901000002', 300, 'bronze', 'store_a');
      INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, tenant_id)
      VALUES ('pt_1', 'cust_av1_2', 100, 'order_earn', 100, 'store_a'),
             ('pt_2', 'cust_av1_2', 200, 'order_earn', 300, 'store_a');
    `);

    const token = await generateJWT(
      { id: 'cust_av1_2', sub: 'cust_av1_2', role: 'customer', type: 'loyalty_customer', tenantId: 'store_a' },
      TEST_JWT_SECRET
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/loyalty', loyaltyRouter);

    const executedBinds: Array<{ sql: string; args: unknown[] }> = [];
    const origPrepare = d1.prepare.bind(d1);
    vi.spyOn(d1, 'prepare').mockImplementation((query: string) => {
      // Force fallback path on cashback_wallets and loyalty_tiers when SQL includes tenant_id filter
      if (
        (query.includes('FROM cashback_wallets') && query.includes('COALESCE(NULLIF(TRIM(tenant_id)')) ||
        (query.includes('FROM loyalty_tiers') && query.includes("COALESCE(tenant_id, 'default')"))
      ) {
        throw new Error('Simulated fallback to unscoped query');
      }
      const stmt = origPrepare(query);
      const origBind = stmt.bind.bind(stmt);
      stmt.bind = (...args: unknown[]) => {
        executedBinds.push({ sql: query, args });
        return origBind(...args);
      };
      return stmt;
    });

    // Seed foreign tenant rows in cashback_wallets, cashback_transactions, and loyalty_tiers
    sql.exec(`
      INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
      VALUES ('wal_foreign', 'cust_av1_2', 999999, 999999, 0, 'store_b');
      INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, tenant_id)
      VALUES ('cbtx_foreign', 'wal_foreign', 'cust_av1_2', 'earn', 999999, 999999, 'store_b');
      INSERT INTO loyalty_tiers (tier, tier_name, min_points, cashback_rate, tenant_id)
      VALUES ('diamond_b', 'diamond_b', 1000, 0.25, 'store_b'),
             ('bronze_a', 'bronze_a', 0, 0.02, 'store_a');
    `);

    const pointsRes = await app.fetch(
      new Request('http://localhost/api/loyalty/points?limit=999999&offset=-50', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { AURA_DB: d1 as any, JWT_SECRET: TEST_JWT_SECRET, PILOT_TENANT_ID: 'store_a' } as unknown as Env
    );
    expect(pointsRes.status).toBe(200);
    const pointSelectBind = executedBinds.find((b) => b.sql.includes('FROM loyalty_point_logs') && b.sql.includes('LIMIT ? OFFSET ?'));
    expect(pointSelectBind?.args.slice(-2)).toEqual([100, 0]);

    const cashbackRes = await app.fetch(
      new Request('http://localhost/api/loyalty/cashback?limit=5000&offset=-10', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { AURA_DB: d1 as any, JWT_SECRET: TEST_JWT_SECRET, PILOT_TENANT_ID: 'store_a' } as unknown as Env
    );
    expect(cashbackRes.status).toBe(200);
    const cashbackJson = (await cashbackRes.json()) as { data: unknown[] };
    expect(cashbackJson.data).toEqual([]);

    const tiersRes = await app.fetch(
      new Request('http://localhost/api/loyalty/tiers', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { AURA_DB: d1 as any, JWT_SECRET: TEST_JWT_SECRET, PILOT_TENANT_ID: 'store_a' } as unknown as Env
    );
    expect(tiersRes.status).toBe(200);
    const tiersJson = (await tiersRes.json()) as { data: Array<{ tier: string }> };
    expect(tiersJson.data.some((t) => t.tier === 'diamond_b')).toBe(false);
    expect(tiersJson.data.some((t) => t.tier === 'bronze_a')).toBe(true);
  });

  it('3. admin-loyalty.ts: excludes cancelled/refunded orders from revenue metrics, clamps top-customers limit, restricts /export to owner/admin/manager with LIMIT 5000, and rejects cross-tenant mismatch with 403', async () => {
    const sql = new DatabaseSync(':memory:');
    createLoyaltyTestSchema(sql);
    const d1 = createSqliteD1Adapter(sql);

    sql.exec(`
      INSERT INTO customers (id, name, phone, email, loyalty_points, loyalty_tier, total_spent, visit_count, tenant_id)
      VALUES ('c_valid', 'Valid Buyer', '0902000001', 'valid@aura.vn', 500, 'gold', 0, 0, 'store_a'),
             ('c_canc', 'Cancelled Only', '0902000002', 'canc@aura.vn', 100, 'silver', 0, 0, 'store_a');
      INSERT INTO orders (id, order_number, customer_id, status, payment_status, total, discount, tenant_id, created_at)
      VALUES ('o_valid_1', 'ORD-1', 'c_valid', 'completed', 'paid', 100000, 10000, 'store_a', datetime('now')),
             ('o_canc_1', 'ORD-2', 'c_canc', 'cancelled', 'unpaid', 500000, 50000, 'store_a', datetime('now')),
             ('o_ref_1', 'ORD-3', 'c_canc', 'completed', 'refunded', 300000, 30000, 'store_a', datetime('now'));
      INSERT INTO users (id, email, name, phone, role, active, is_active, auth_version, tenant_id)
      VALUES ('mgr_1', 'mgr1@aura.vn', 'Manager A', '0909111111', 'manager', 1, 1, 1, 'store_a'),
             ('sup_1', 'sup1@aura.vn', 'Supervisor A', '0909222222', 'supervisor', 1, 1, 1, 'store_a');
    `);

    const mgrSession = await issueStaffSession(
      { JWT_SECRET: TEST_JWT_SECRET },
      { id: 'mgr_1', name: 'Manager A', phone: '0909111111', role: 'manager', tenant_id: 'store_a', is_active: 1, auth_version: 1 },
      { email: 'mgr1@aura.vn', sessionType: 'staff-web' }
    );
    const supSession = await issueStaffSession(
      { JWT_SECRET: TEST_JWT_SECRET },
      { id: 'sup_1', name: 'Supervisor A', phone: '0909222222', role: 'supervisor', tenant_id: 'store_a', is_active: 1, auth_version: 1 },
      { email: 'sup1@aura.vn', sessionType: 'staff-web' }
    );

    const buildAppForTenant = (tenantId = 'store_a') => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, tenantId as never);
        await next();
      });
      app.route('/api/admin-loyalty', adminLoyaltyRouter);
      return app;
    };

    const env = { AURA_DB: d1 as any, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env;
    const managerApp = buildAppForTenant('store_a');
    const mgrHeaders = { Authorization: `Bearer ${mgrSession.token}` };
    const supHeaders = { Authorization: `Bearer ${supSession.token}` };

    // Widgets excludes cancelled & refunded orders from Total Spend and Avg Visits
    const widgetsRes = await managerApp.fetch(new Request('http://localhost/api/admin-loyalty/widgets', { headers: mgrHeaders }), env);
    expect(widgetsRes.status).toBe(200);
    const widgetsJson = (await widgetsRes.json()) as { data: Array<{ title: string; value: number | string }> };
    const totalSpendWidget = widgetsJson.data.find((w) => w.title === 'Total Spend');
    const avgVisitsWidget = widgetsJson.data.find((w) => w.title === 'Avg Visits');
    expect(totalSpendWidget?.value).toBe(100000);
    expect(avgVisitsWidget?.value).toBe(1);

    // Top-customers clamps limit to [1..100] and excludes cancelled/refunded orders from visit_count
    const topRes = await managerApp.fetch(new Request('http://localhost/api/admin-loyalty/top-customers?limit=9999', { headers: mgrHeaders }), env);
    expect(topRes.status).toBe(200);
    const topJson = (await topRes.json()) as { data: Array<{ id: string; total_spent: number; visit_count: number }> };
    const validCust = topJson.data.find((c) => c.id === 'c_valid');
    const cancCust = topJson.data.find((c) => c.id === 'c_canc');
    expect(validCust?.visit_count).toBe(1);
    expect(cancCust?.visit_count).toBe(0);

    // Export blocks supervisor (403) and allows manager (200)
    const supExportRes = await managerApp.fetch(new Request('http://localhost/api/admin-loyalty/export', { headers: supHeaders }), env);
    expect(supExportRes.status).toBe(403);

    const mgrExportRes = await managerApp.fetch(new Request('http://localhost/api/admin-loyalty/export', { headers: mgrHeaders }), env);
    expect(mgrExportRes.status).toBe(200);

    // Cross-tenant mismatch between user.tenantId and resolved tenantId returns 403
    const mismatchApp = buildAppForTenant('store_b');
    const mismatchRes = await mismatchApp.fetch(new Request('http://localhost/api/admin-loyalty/widgets', { headers: mgrHeaders }), env);
    expect(mismatchRes.status).toBe(403);
  });

  it('4. referrals.ts & tree/referrals: sets bonus_type = cashback, updates existing pending referral in-place, enforces max_uses & tenant_id, and detects concurrent claim in referral-cashback', async () => {
    const sql = new DatabaseSync(':memory:');
    createLoyaltyTestSchema(sql);
    const d1 = createSqliteD1Adapter(sql);

    sql.exec(`
      INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
      VALUES ('ref_owner_a', 'Referrer A', '0903000001', 100, 100, 'bronze', 'store_a'),
             ('ref_new_a', 'Referee A', '0903000002', 0, 0, 'bronze', 'store_a'),
             ('ref_new_b', 'Referee B', '0903000003', 0, 0, 'bronze', 'store_a'),
             ('foreign_collide', 'Foreign Same ID', '0903999999', 0, 0, 'bronze', 'store_b');
      INSERT INTO referral_codes (id, customer_id, code, times_used, max_uses, total_points_earned, tenant_id)
      VALUES ('rc_a_1', 'ref_owner_a', 'SADEC10K', 0, 1, 0, 'store_a');
    `);

    // 4a. POST /api/loyalty/referral/apply inserts referral with bonus_type = 'cashback'
    const refereeToken = await generateJWT(
      { id: 'ref_new_a', sub: 'ref_new_a', role: 'customer', type: 'loyalty_customer', tenantId: 'store_a' },
      TEST_JWT_SECRET
    );
    const referrerToken = await generateJWT(
      { id: 'ref_owner_a', sub: 'ref_owner_a', role: 'customer', type: 'loyalty_customer', tenantId: 'store_a' },
      TEST_JWT_SECRET
    );
    const refApp = new Hono<{ Bindings: Env }>();
    refApp.route('/api/loyalty/referral', referralRouter);
    const env = { AURA_DB: d1 as any, JWT_SECRET: TEST_JWT_SECRET, PILOT_TENANT_ID: 'store_a' } as unknown as Env;

    const applyRes = await refApp.fetch(
      new Request('http://localhost/api/loyalty/referral/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${refereeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'SADEC10K' }),
      }),
      env
    );
    expect(applyRes.status).toBe(200);
    const insertedRef = sql.prepare("SELECT bonus_type, status FROM referrals WHERE referred_customer_id = 'ref_new_a'").get() as {
      bonus_type: string;
      status: string;
    };
    expect(insertedRef.bonus_type).toBe('cashback');
    expect(insertedRef.status).toBe('pending');

    // 4b. Code with max_uses = 1 is now exhausted for ref_new_b in applyReferralForNewCustomer
    const exhaustedRes = await applyReferralForNewCustomer(d1 as any, 'ref_new_b', 'SADEC10K', 'store_a');
    expect(exhaustedRes).toEqual({ success: false, reason: 'code_exhausted' });

    // 4c. Increase max_uses to 5 and verify applyReferralForNewCustomer updates existing pending referral in-place without duplicating
    sql.exec("UPDATE referral_codes SET max_uses = 5 WHERE id = 'rc_a_1'");
    sql.exec(`
      INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, cashback_awarded_vnd, status, bonus_type, tenant_id)
      VALUES ('ref_inplace_1', 'ref_owner_a', 'ref_new_b', 'SADEC10K', 0, 0, 'pending', 'pending', 'store_a');
    `);
    const inplaceRes = await applyReferralForNewCustomer(d1 as any, 'ref_new_b', 'SADEC10K', 'store_a');
    expect(inplaceRes).toEqual({ success: true, referrer_cashback_pending: 10000 });
    const countRefsForB = sql.prepare("SELECT COUNT(*) as cnt, bonus_type FROM referrals WHERE referred_customer_id = 'ref_new_b'").get() as {
      cnt: number;
      bonus_type: string;
    };
    expect(countRefsForB.cnt).toBe(1);
    expect(countRefsForB.bonus_type).toBe('cashback');

    // 4d. processReferralCashbackOnFirstOrder detects 0 changes when referral status is concurrently claimed
    const origBatch = d1.batch.bind(d1);
    vi.spyOn(d1, 'batch').mockImplementationOnce(async (stmts) => {
      sql.exec("UPDATE referrals SET status = 'completed' WHERE id = 'ref_inplace_1'");
      return origBatch(stmts);
    });
    const concurrentCashbackRes = await processReferralCashbackOnFirstOrder(d1 as any, 'ref_new_b', 'ord_first_b', 50000, 'store_a');
    expect(concurrentCashbackRes).toEqual({ success: false, reason: 'no_pending_referral' });

    // 4e. processReferralOnFirstOrder scopes referral_codes and loyalty_accounts updates by tenant
    sql.exec(`
      INSERT INTO loyalty_accounts (id, customer_id, current_points, lifetime_points, tier, tenant_id)
      VALUES ('la_ref_a', 'ref_owner_a', 100, 100, 'bronze', 'store_a'),
             ('la_ref_b', 'ref_owner_a', 100, 100, 'bronze', 'store_b');
    `);
    const ptsRes = await processReferralOnFirstOrder(d1 as any, 'ref_new_a', 'store_a');
    expect(ptsRes.success).toBe(true);
    const laStoreA = sql.prepare("SELECT current_points FROM loyalty_accounts WHERE id = 'la_ref_a'").get() as { current_points: number };
    const laStoreB = sql.prepare("SELECT current_points FROM loyalty_accounts WHERE id = 'la_ref_b'").get() as { current_points: number };
    expect(laStoreA.current_points).toBe(200);
    expect(laStoreB.current_points).toBe(100);

    // 4f. GET /api/loyalty/referral/stats scopes LEFT JOIN customers by tenant
    const statsRes = await refApp.fetch(
      new Request('http://localhost/api/loyalty/referral/stats', {
        headers: { Authorization: `Bearer ${referrerToken}` },
      }),
      env
    );
    expect(statsRes.status).toBe(200);
  });

  it('5. spend-cashback-handler.ts: removes ord_fran_r1 paid-order bypass, scopes duplicate spend & wallet fallback by tenant, and enforces atomic order status/payment_status guards', async () => {
    const sql = new DatabaseSync(':memory:');
    createLoyaltyTestSchema(sql);
    const d1 = createSqliteD1Adapter(sql);

    sql.exec(`
      INSERT INTO customers (id, name, phone, tenant_id)
      VALUES ('cust_fran_r1', 'Legacy Fixture Customer', '0904000001', 'store_a');
      INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
      VALUES ('wal_fran_1', 'cust_fran_r1', 50000, 50000, 0, 'store_a');
      INSERT INTO orders (id, order_number, customer_id, status, payment_status, total, total_amount, cashback_used, tenant_id)
      VALUES ('ord_fran_r1', 'ORD-FRAN-1', 'cust_fran_r1', 'pending', 'paid', 60000, 60000, 0, 'store_a'),
             ('ord_race_paid', 'ORD-RACE-1', 'cust_fran_r1', 'pending', 'unpaid', 60000, 60000, 0, 'store_a');
    `);

    const spendApp = new Hono<{ Bindings: Env }>();
    spendApp.use('*', async (c, next) => {
      c.set('customer' as never, { id: 'cust_fran_r1', phone: '0904000001', tenant_id: 'store_a' } as never);
      await next();
    });
    spendApp.post('/api/loyalty/spend-cashback', handleSpendCashback);

    const env = { AURA_DB: d1 as any, PILOT_TENANT_ID: 'store_a' } as unknown as Env;

    // 5a. Paid order ord_fran_r1 for cust_fran_r1 is rejected with 400 (no legacy fixture bypass)
    const paidBypassRes = await spendApp.fetch(
      new Request('http://localhost/api/loyalty/spend-cashback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ord_fran_r1', amount: 10000 }),
      }),
      env
    );
    expect(paidBypassRes.status).toBe(400);

    // 5b. Concurrent order transition to 'paid' after initial SELECT is blocked by atomic UPDATE orders guard (409) and refunds wallet
    const origPrepare = d1.prepare.bind(d1);
    vi.spyOn(d1, 'prepare').mockImplementation((query: string) => {
      if (query.includes('UPDATE orders SET cashback_used = ?')) {
        sql.exec("UPDATE orders SET payment_status = 'paid' WHERE id = 'ord_race_paid'");
      }
      return origPrepare(query);
    });

    const raceRes = await spendApp.fetch(
      new Request('http://localhost/api/loyalty/spend-cashback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ord_race_paid', amount: 15000 }),
      }),
      env
    );
    expect(raceRes.status).toBe(409);
    const walletAfterRace = sql.prepare("SELECT balance, total_spent FROM cashback_wallets WHERE id = 'wal_fran_1'").get() as {
      balance: number;
      total_spent: number;
    };
    expect(walletAfterRace.balance).toBe(50000);
    expect(walletAfterRace.total_spent).toBe(0);
  });

  it('6. openapi-loyalty-handlers: enforces RBAC on adjust-points and rewards create/update, rejects cross-tenant overrides with 403, scopes getLoyaltyAccountWithFallback by tenant, and uses UTC+7 Vietnam time for birthday bonus', async () => {
    const sql = new DatabaseSync(':memory:');
    createLoyaltyTestSchema(sql);
    const d1 = createSqliteD1Adapter(sql);

    sql.exec(`
      INSERT INTO customers (id, name, phone, birthday, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
      VALUES ('cust_vn_bday', 'VN May Birthday', '0905000001', '1996-05-01', 200, 200, 'silver', 'store_a');
      INSERT INTO loyalty_accounts (id, customer_id, current_points, lifetime_points, tier, tenant_id)
      VALUES ('la_vn_store_b', 'cust_vn_bday', 9999, 9999, 'platinum', 'store_b'),
             ('la_vn_store_a', 'cust_vn_bday', 200, 200, 'silver', 'store_a');
      INSERT INTO loyalty_tier_configs (tier, name, min_points, birthday_bonus, tenant_id)
      VALUES ('silver', 'Silver', 100, 350, 'store_a');
      INSERT INTO loyalty_rewards (id, name, points_cost, type, value, is_active, tenant_id)
      VALUES ('rew_oa_1', 'Free Matcha', 150, 'free_item', 45000, 1, 'store_a');
    `);

    // 6a. getLoyaltyAccountWithFallback scopes loyalty_accounts query by tenant_id
    const scopedAcct = await getLoyaltyAccountWithFallback(d1 as any, 'cust_vn_bday', new Date().toISOString(), 'store_a');
    expect(scopedAcct.account?.id).toBe('la_vn_store_a');
    expect(scopedAcct.account?.current_points).toBe(200);

    // 6b. Build OpenAPI app with configurable user and tenant context
    let currentUser: Record<string, unknown> = { id: 'sup_oa_1', role: 'supervisor', tenantId: 'store_a' };
    let currentTenant = 'store_a';
    const oaApp = new OpenAPIHono<{ Bindings: Env }>();
    oaApp.use('*', async (c, next) => {
      c.set('user' as never, currentUser as never);
      c.set('tenantId' as never, currentTenant as never);
      await next();
    });
    registerAccountHandlers(oaApp);
    registerAdminHandlers(oaApp);
    registerRewardHandlers(oaApp);

    const env = { AURA_DB: d1 as any, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env;

    // Supervisor and staff are rejected (403) on POST /api/loyalty/admin/adjust-points
    for (const forbiddenRole of ['supervisor', 'staff']) {
      currentUser = { id: `u_${forbiddenRole}`, role: forbiddenRole, tenantId: 'store_a' };
      currentTenant = 'store_a';
      const adjForbidden = await oaApp.fetch(
        new Request('http://localhost/api/loyalty/admin/adjust-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: 'cust_vn_bday',
            points: 50,
            reason: 'Unauthorized role attempt',
            idempotencyKey: `idem_forbidden_${forbiddenRole}`,
          }),
        }),
        env
      );
      expect(adjForbidden.status).toBe(403);

      // Supervisor and staff are rejected (403) on POST /api/loyalty/rewards and PATCH /api/loyalty/rewards/:id
      const createRewardForbidden = await oaApp.fetch(
        new Request('http://localhost/api/loyalty/rewards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Unauthorized Reward',
            pointsCost: 100,
            type: 'voucher',
            value: 20000,
          }),
        }),
        env
      );
      expect(createRewardForbidden.status).toBe(403);

      const patchRewardForbidden = await oaApp.fetch(
        new Request('http://localhost/api/loyalty/rewards/rew_oa_1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pointsCost: 120 }),
        }),
        env
      );
      expect(patchRewardForbidden.status).toBe(403);
    }

    // Manager is allowed on POST /api/loyalty/admin/adjust-points, POST /api/loyalty/rewards, and PATCH /api/loyalty/rewards/:id
    currentUser = { id: 'mgr_oa_1', role: 'manager', tenantId: 'store_a' };
    currentTenant = 'store_a';
    const mgrAdjustRes = await oaApp.fetch(
      new Request('http://localhost/api/loyalty/admin/adjust-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'cust_vn_bday',
          points: 50,
          reason: 'Manager bonus',
          idempotencyKey: 'idem_mgr_bonus_1',
        }),
      }),
      env
    );
    expect(mgrAdjustRes.status).toBe(200);

    // Cross-tenant mismatch between user.tenantId ('store_a') and X-Tenant-Id header ('store_b') returns 403
    const crossHeaderRes = await oaApp.fetch(
      new Request('http://localhost/api/loyalty/account', {
        headers: { 'X-Tenant-Id': 'store_b' },
      }),
      env
    );
    expect(crossHeaderRes.status).toBe(403);

    // 6c. Birthday bonus uses Vietnam timezone (UTC+7): 2026-04-30T20:00:00.000Z is 2026-05-01T03:00:00+07:00 in Vietnam (month = 5)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T20:00:00.000Z'));

    currentUser = { id: 'cust_vn_bday', customerId: 'cust_vn_bday', role: 'customer', tenantId: 'store_a' };
    currentTenant = 'store_a';
    const bdayRes = await oaApp.fetch(
      new Request('http://localhost/api/loyalty/account/birthday-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(bdayRes.status).toBe(200);
    const bdayJson = (await bdayRes.json()) as { data: { points: number; newBalance: number } };
    expect(bdayJson.data.points).toBe(350);
    expect(bdayJson.data.newBalance).toBe(600);
  });
});
