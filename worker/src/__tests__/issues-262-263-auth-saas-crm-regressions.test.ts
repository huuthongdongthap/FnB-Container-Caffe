// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { D1Database } from '@cloudflare/workers-types';
import { applyAccrual, type LoyaltyPolicy } from '@aura/domain-crm';
import { reverseRefundTranche } from '../../../packages/domain/crm/commands/refund-tranche';
import { loyaltyRouter } from '../routes/loyalty';
import { registerRewardHandlers } from '../routes/openapi-loyalty-handlers/reward-handlers';
import { registerTierHandlers } from '../routes/openapi-loyalty-handlers/tier-handlers';
import { RedeemRewardSchema } from '../schemas/loyalty/models';
import { reviewsRouter } from '../routes/reviews';
import { checkinRouter } from '../routes/checkin';
import { generateJWT } from '../lib/jwt';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const makeStmt = (sql: string, bound: unknown[] = []) => ({
    sql,
    bind(...args: unknown[]) {
      return makeStmt(sql, args);
    },
    async first<T = Record<string, unknown>>() {
      const row = sqlite.prepare(sql).get(...(bound as never[])) as T | undefined;
      return row ?? null;
    },
    async all<T = Record<string, unknown>>() {
      const results = sqlite.prepare(sql).all(...(bound as never[])) as T[];
      return { success: true, results, meta: { changes: 0 } };
    },
    async run() {
      const res = sqlite.prepare(sql).run(...(bound as never[]));
      return { success: true, meta: { changes: Number(res.changes ?? 0), last_row_id: Number(res.lastInsertRowid ?? 0) } };
    },
  });
  return {
    prepare(sql: string) {
      return makeStmt(sql);
    },
    async batch(stmts: Array<{ sql?: string; run: () => Promise<unknown>; all: () => Promise<unknown> }>) {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) {
          out.push(s.sql && /^\s*SELECT\b/i.test(s.sql) ? await s.all() : await s.run());
        }
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as D1Database;
}
import { updateAdminCustomer } from '../routes/admin-handlers';
import { chatRouter } from '../routes/chat';
import { createSaasCommercialRoutes } from '../routes/saas-commercial';

async function mintStaffJwt(
  db: DatabaseSync,
  user: { id: string; role: string; tenantId: string },
  secret: string
): Promise<string> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      role TEXT,
      tenant_id TEXT,
      is_active INTEGER DEFAULT 1,
      auth_version INTEGER DEFAULT 1
    );
  `);
  db.prepare(
    `INSERT OR REPLACE INTO users (id, name, phone, role, tenant_id, is_active, auth_version)
     VALUES (?, ?, '0900000001', ?, ?, 1, 1)`
  ).run(user.id, `Staff ${user.id}`, user.role, user.tenantId);
  const nowSec = Math.floor(Date.now() / 1000) - 5;
  return generateJWT(
    {
      id: user.id,
      role: user.role,
      tenantId: user.tenantId,
      authVersion: 1,
      authTime: nowSec,
      sessionType: 'staff-web',
    } as never,
    secret,
    3600,
    nowSec
  );
}

const BASE_POLICY: LoyaltyPolicy = {
  tiers: [
    { tierName: 'bronze', minPoints: 0, cashbackRate: 0.02, pointMultiplier: 1 },
    { tierName: 'silver', minPoints: 100, cashbackRate: 0.05, pointMultiplier: 1.2 },
    { tierName: 'gold', minPoints: 500, cashbackRate: 0.08, pointMultiplier: 1.5 },
  ],
  campaignMultiplier: 1,
  maxCapPerTx: 100_000,
  expiresAt: null,
};

describe('Issues #262 & #263 — Auth, SaaS, CRM, Loyalty & Chat regressions', () => {
  it('#262: GET /api/saas/storefront/default resolves flagship tenant instead of 404', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE saas_tenants (id TEXT PRIMARY KEY, slug TEXT, name TEXT, tier TEXT, status TEXT, template_id TEXT, subdomain TEXT, trial_ends_at TEXT, current_period_end TEXT);
      CREATE TABLE tenant_branding (tenant_id TEXT PRIMARY KEY, brand_name TEXT);
      CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT, slug TEXT, description TEXT, sort_order INTEGER, is_active INTEGER, tenant_id TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, category_id TEXT, name TEXT, slug TEXT, price REAL, description TEXT, image_url TEXT, available INTEGER, is_available INTEGER, sort_order INTEGER, tenant_id TEXT);
      CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, code TEXT, name TEXT, zone TEXT, capacity INTEGER, status TEXT, sort_order INTEGER, is_active INTEGER, tenant_id TEXT);
      CREATE TABLE tenant_payment_configs (tenant_id TEXT PRIMARY KEY, provider TEXT, bank_bin TEXT, bank_account_no TEXT, bank_account_name TEXT, bank_name TEXT, payos_client_id_enc TEXT, payos_api_key_enc TEXT, payos_checksum_key_enc TEXT, is_active INTEGER);
    `);
    const db = createSqliteD1(sqlite);
    const app = new Hono();
    app.route('/api/saas', createSaasCommercialRoutes());

    const res = await app.request(
      'http://localhost/api/saas/storefront/default',
      {},
      { AURA_DB: db } as Record<string, unknown>,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean; data?: { tenant?: { slug?: string } } };
    expect(json.success).toBe(true);
    expect(json.data?.tenant?.slug).toBe('default');
  });

  it('#263: applyAccrual updates customers.total_spent, total_orders, and tier alongside loyalty_tier', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY, name TEXT, phone TEXT,
        loyalty_points INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze', tier TEXT DEFAULT 'bronze',
        total_spent REAL DEFAULT 0, total_orders INTEGER DEFAULT 0,
        tenant_id TEXT DEFAULT 'default', updated_at TEXT
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, customer_id TEXT, total REAL, status TEXT, payment_status TEXT,
        cashback_earned REAL DEFAULT 0, points_earned INTEGER DEFAULT 0,
        cashback_used REAL DEFAULT 0, tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE cashback_wallets (
        id TEXT PRIMARY KEY, customer_id TEXT, balance REAL DEFAULT 0,
        total_earned REAL DEFAULT 0, total_spent REAL DEFAULT 0,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE cashback_transactions (
        id TEXT PRIMARY KEY, wallet_id TEXT, customer_id TEXT, order_id TEXT,
        type TEXT, amount REAL, balance_after REAL, multiplier_applied REAL,
        campaign_id TEXT, remaining_amount REAL, description TEXT,
        expires_at TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE loyalty_point_logs (
        id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, points_change INTEGER,
        balance_after INTEGER, reason TEXT, description TEXT, reference_id TEXT,
        tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE loyalty_audit_log (
        id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, action TEXT,
        amount_vnd REAL, points INTEGER, tier_before TEXT, tier_after TEXT, note TEXT,
        entity_type TEXT, entity_id TEXT, actor_id TEXT, metadata TEXT,
        before_json TEXT, after_json TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE loyalty_accounts (
        id TEXT PRIMARY KEY, customer_id TEXT, current_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0, tier TEXT DEFAULT 'bronze',
        order_count INTEGER DEFAULT 0, total_spent REAL DEFAULT 0, last_activity_at TEXT,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
    `);
    sqlite.prepare(`INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, loyalty_tier, tier, total_spent, total_orders, tenant_id) VALUES ('c1', 'Alice', '0901234567', 0, 0, 'bronze', 'bronze', 0, 0, 'default')`).run();
    sqlite.prepare(`INSERT INTO orders (id, customer_id, total, status, payment_status, tenant_id) VALUES ('ord1', 'c1', 1050000, 'completed', 'paid', 'default')`).run();

    const db = createSqliteD1(sqlite);
    const res = await applyAccrual(db, BASE_POLICY, {
      orderId: 'ord1',
      customerId: 'c1',
      orderTotalVnd: 1050000,
      tenantId: 'default',
    });
    expect(res).toEqual(expect.objectContaining({ ok: true }));
    if (!res.ok) throw new Error(`${res.reason}: ${res.error}`);

    const cust = sqlite.prepare('SELECT loyalty_points, lifetime_points, loyalty_tier, tier, total_spent, total_orders FROM customers WHERE id = ?').get('c1') as Record<string, unknown>;
    expect(cust.loyalty_points).toBe(105);
    expect(cust.lifetime_points).toBe(105);
    expect(cust.loyalty_tier).toBe('silver');
    expect(cust.tier).toBe('silver');
    expect(cust.total_spent).toBe(1050000);
    expect(cust.total_orders).toBe(1);
  });

  it('#263: updateAdminCustomer rejects invalid tier, returns 404 on missing id, and returns 409 on duplicate phone', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY, name TEXT, phone TEXT UNIQUE, email TEXT,
        loyalty_tier TEXT DEFAULT 'bronze', tier TEXT DEFAULT 'bronze',
        birthday TEXT, tenant_id TEXT DEFAULT 'default'
      );
    `);
    sqlite.prepare(`INSERT INTO customers (id, name, phone, tenant_id) VALUES ('c1', 'Alice', '0901111111', 'default')`).run();
    sqlite.prepare(`INSERT INTO customers (id, name, phone, tenant_id) VALUES ('c2', 'Bob', '0902222222', 'default')`).run();
    const db = createSqliteD1(sqlite);
    const env = { AURA_DB: db };

    const invalidTierRes = await updateAdminCustomer(
      new Request('http://localhost/api/admin/customers/c1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'supervip_invalid' }),
      }),
      env,
      'c1',
      'default',
    );
    expect(invalidTierRes.status).toBe(400);

    const missingRes = await updateAdminCustomer(
      new Request('http://localhost/api/admin/customers/nonexistent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ghost' }),
      }),
      env,
      'nonexistent',
      'default',
    );
    expect(missingRes.status).toBe(404);

    const dupPhoneRes = await updateAdminCustomer(
      new Request('http://localhost/api/admin/customers/c1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0902222222' }),
      }),
      env,
      'c1',
      'default',
    );
    expect(dupPhoneRes.status).toBe(409);

    const validRes = await updateAdminCustomer(
      new Request('http://localhost/api/admin/customers/c1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'gold', birthday: '1995-05-10' }),
      }),
      env,
      'c1',
      'default',
    );
    expect(validRes.status).toBe(200);
    const updated = sqlite.prepare('SELECT loyalty_tier, tier, birthday FROM customers WHERE id = ?').get('c1') as Record<string, unknown>;
    expect(updated.loyalty_tier).toBe('gold');
    expect(updated.tier).toBe('gold');
    expect(updated.birthday).toBe('1995-05-10');
  });

  it('#263: POST /api/chat/messages rejects non-phone strings and normalizes 84... to 0...', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE contact_messages (
        id TEXT PRIMARY KEY, tenant_id TEXT, classification TEXT, name TEXT, phone TEXT,
        message TEXT, direction TEXT, category TEXT, status TEXT DEFAULT 'unread',
        read_at TEXT, created_at TEXT
      );
    `);
    const db = createSqliteD1(sqlite);
    const app = new Hono();
    app.route('/api/chat', chatRouter);

    const badRes = await app.request(
      'http://localhost/api/chat/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', phone: 'audit3notphone', message: 'hi' }),
      },
      { AURA_DB: db } as Record<string, unknown>,
    );
    expect(badRes.status).toBe(400);

    const okRes = await app.request(
      'http://localhost/api/chat/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', phone: '+84901234567', message: 'xin chao' }),
      },
      { AURA_DB: db } as Record<string, unknown>,
    );
    expect(okRes.status).toBe(201);
    const row = sqlite.prepare('SELECT phone, status FROM contact_messages LIMIT 1').get() as Record<string, unknown>;
    expect(row.phone).toBe('0901234567');
    expect(row.status).toBe('unread');
  });

  it('matches legacy 84/+84/0 phone formats in chat history and marks messages read while preserving classification quarantine', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE contact_messages (
        id TEXT PRIMARY KEY, tenant_id TEXT, classification TEXT, name TEXT, phone TEXT,
        message TEXT, direction TEXT, category TEXT, status TEXT DEFAULT 'unread',
        read_at TEXT, created_at TEXT
      );
      INSERT INTO contact_messages (id, tenant_id, classification, name, phone, message, direction, category, status, created_at) VALUES
        ('cm-chat-legacy-plus', 'store-a', 'chat', 'Lan', '+84901234567', 'Xin chào 1', 'customer', 'chat', 'unread', '2026-11-27T01:00:00Z'),
        ('cm-chat-legacy-84', 'store-a', 'chat', 'Lan', '84901234567', 'Xin chào 2', 'customer', 'chat', 'unread', '2026-11-27T01:02:00Z'),
        ('cm-unclassified', 'store-a', NULL, 'Lan', '0901234567', 'Chưa phân loại', 'customer', 'chat', 'unread', '2026-11-27T01:03:00Z'),
        ('cm-recruitment', 'store-a', 'contact', 'Lan', '0901234567', 'Ứng tuyển', 'customer', 'recruitment', 'unread', '2026-11-27T01:04:00Z'),
        ('cm-foreign', 'store-b', 'chat', 'Lan', '0901234567', 'Chi nhánh khác', 'customer', 'chat', 'unread', '2026-11-27T01:05:00Z');
    `);
    const db = createSqliteD1(sqlite);
    const secret = 'test-chat-history-secret-32-chars!!';
    const staffToken = await mintStaffJwt(sqlite, { id: 'staff-a', role: 'manager', tenantId: 'store-a' }, secret);

    const app = new Hono();
    app.route('/api/chat', chatRouter);

    const res = await app.request(
      'http://localhost/api/chat/messages/0901234567',
      { headers: { Authorization: `Bearer ${staffToken}`, 'X-Tenant-ID': 'store-a' } },
      { AURA_DB: db, JWT_SECRET: secret, PILOT_TENANT_ID: 'store-a' } as Record<string, unknown>,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; message: string; read_at: string | null }> };
    expect(body.data.map((m) => m.id)).toEqual(['cm-chat-legacy-plus', 'cm-chat-legacy-84']);

    const readRows = sqlite.prepare("SELECT id, status, read_at FROM contact_messages WHERE id IN ('cm-chat-legacy-plus', 'cm-chat-legacy-84')").all() as Array<{ id: string; status: string; read_at: string | null }>;
    expect(readRows.every((r) => r.status === 'read' && r.read_at !== null)).toBe(true);
    const quarantinedRows = sqlite.prepare("SELECT id, status, read_at FROM contact_messages WHERE id IN ('cm-unclassified', 'cm-recruitment', 'cm-foreign')").all() as Array<{ id: string; status: string; read_at: string | null }>;
    expect(quarantinedRows.every((r) => r.status === 'unread' && r.read_at === null)).toBe(true);
  });

  it('enforces PILOT_TENANT_ID on GET /api/loyalty/rewards and prevents non-default tier fallback from probing foreign tenant rows', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE rewards (
        id TEXT PRIMARY KEY, title TEXT, point_cost INTEGER, discount_type TEXT,
        discount_value REAL, is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE loyalty_tier_configs (
        id TEXT PRIMARY KEY, tier TEXT, name TEXT, min_points INTEGER,
        point_multiplier REAL, benefits TEXT, tenant_id TEXT DEFAULT 'default'
      );
      INSERT INTO rewards (id, title, point_cost, discount_type, discount_value, is_active, tenant_id) VALUES
        ('rw-pilot', 'Pilot Reward', 50, 'fixed', 10000, 1, 'pilot-store'),
        ('rw-other', 'Other Store Reward', 50, 'fixed', 10000, 1, 'other-store');
      INSERT INTO loyalty_tier_configs (id, tier, name, min_points, point_multiplier, benefits, tenant_id) VALUES
        ('tc-vip-b', 'platinum', 'Bạch Kim Store B', 2000, 2.0, '[]', 'store-b');
    `);
    const db = createSqliteD1(sqlite);
    const secret = 'test-pilot-loyalty-secret-32chars!';
    const otherCustToken = await generateJWT({ id: 'cust-other', role: 'customer', tenantId: 'other-store' }, secret);

    const app = new Hono();
    app.route('/api/loyalty', loyaltyRouter);

    const spoofRes = await app.request(
      'http://localhost/api/loyalty/rewards',
      { headers: { Authorization: `Bearer ${otherCustToken}` } },
      { AURA_DB: db, JWT_SECRET: secret, PILOT_TENANT_ID: 'pilot-store' } as Record<string, unknown>,
    );
    expect(spoofRes.status).toBe(403);

    const headerSpoofRes = await app.request(
      'http://localhost/api/loyalty/rewards?tenant_id=other-store',
      {},
      { AURA_DB: db, JWT_SECRET: secret, PILOT_TENANT_ID: 'pilot-store' } as Record<string, unknown>,
    );
    expect(headerSpoofRes.status).toBe(403);

    const pubRes = await app.request(
      'http://localhost/api/loyalty/rewards',
      {},
      { AURA_DB: db, JWT_SECRET: secret, PILOT_TENANT_ID: 'pilot-store' } as Record<string, unknown>,
    );
    expect(pubRes.status).toBe(200);
    const pubBody = (await pubRes.json()) as { data: Array<{ id: string }> };
    expect(pubBody.data.map((r) => r.id)).toEqual(['rw-pilot']);

    // Tier GET for store-a must not leak store-b's tier row
    const tierApp = new OpenAPIHono();
    tierApp.use('*', async (c, next) => {
      c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    registerTierHandlers(tierApp as never);
    const tierRes = await tierApp.request(
      'http://localhost/api/loyalty/tiers/platinum',
      { headers: { 'X-Tenant-ID': 'store-a' } },
      { AURA_DB: db } as Record<string, unknown>,
    );
    expect(tierRes.status).toBe(404);
  });

  it('preserves customerId in RedeemRewardSchema, keeps OpenAPI reward pagination & point_cost consistent, and charges resolved cost on staff redeem', async () => {
    const parsed = RedeemRewardSchema.parse({ rewardId: 'rw-1', customerId: 'cust-target' });
    expect(parsed.customerId).toBe('cust-target');

    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY, name TEXT, phone TEXT, loyalty_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0, loyalty_tier TEXT DEFAULT 'bronze',
        tenant_id TEXT DEFAULT 'default', updated_at TEXT
      );
      CREATE TABLE loyalty_accounts (
        id TEXT PRIMARY KEY, customer_id TEXT, current_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0, tier TEXT DEFAULT 'bronze',
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT, last_activity_at TEXT
      );
      CREATE TABLE loyalty_rewards (
        id TEXT PRIMARY KEY, name TEXT, description TEXT, type TEXT DEFAULT 'voucher',
        value REAL DEFAULT 0, points_cost INTEGER, min_tier TEXT DEFAULT 'bronze',
        max_redemptions INTEGER, current_redemptions INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE rewards (
        id TEXT PRIMARY KEY, title TEXT, point_cost INTEGER, discount_type TEXT,
        discount_value REAL, stock INTEGER DEFAULT 10, is_active INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE loyalty_transactions (
        id TEXT PRIMARY KEY, tenant_id TEXT, account_id TEXT, customer_id TEXT,
        type TEXT, points INTEGER, balance_after INTEGER, reward_id TEXT,
        order_id TEXT, description TEXT, reason TEXT, idempotency_key TEXT,
        created_by TEXT, created_at TEXT
      );
      CREATE TABLE loyalty_point_logs (
        id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, points_change INTEGER,
        reason TEXT, balance_after INTEGER, description TEXT, tenant_id TEXT, created_at TEXT
      );
      CREATE TABLE loyalty_redemptions (
        id TEXT PRIMARY KEY, tenant_id TEXT, account_id TEXT, customer_id TEXT,
        reward_id TEXT, order_id TEXT, points_spent INTEGER, code TEXT, status TEXT,
        expires_at TEXT, redeemed_at TEXT, created_at TEXT
      );
      CREATE TABLE user_rewards (
        id TEXT PRIMARY KEY, customer_id TEXT, reward_id TEXT, reward_name TEXT,
        code TEXT, status TEXT, expires_at TEXT, tenant_id TEXT, created_at TEXT
      );
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY, user_id TEXT, action TEXT, entity_type TEXT,
        entity_id TEXT, tenant_id TEXT, metadata TEXT, created_at TEXT
      );
      INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
        VALUES ('cust-vip', 'Khách VIP', '0908887766', 250, 250, 'silver', 'store-a');
      INSERT INTO loyalty_accounts (id, customer_id, current_points, lifetime_points, tier, tenant_id)
        VALUES ('la-vip', 'cust-vip', 250, 250, 'silver', 'store-a');
      INSERT INTO loyalty_rewards (id, name, points_cost, is_active, tenant_id) VALUES
        ('lr-a1', 'Cà phê 1', 50, 1, 'store-a'),
        ('lr-a2', 'Cà phê 2', 80, 1, 'store-a');
      INSERT INTO rewards (id, title, point_cost, discount_type, discount_value, stock, is_active, tenant_id) VALUES
        ('rw-legacy-cost', 'Bánh Ngọt', 150, 'fixed', 30000, 5, 1, 'store-a');
    `);
    const db = createSqliteD1(sqlite);

    const api = new OpenAPIHono();
    api.use('*', async (c, next) => {
      c.set('user' as never, { id: 'staff-a', role: 'manager', tenantId: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    registerRewardHandlers(api as never);

    // Page 2 of store-a's 2 loyalty_rewards must NOT bleed legacy 'rewards' rows onto page 2
    const page2Res = await api.request(
      'http://localhost/api/loyalty/rewards?page=2&limit=1',
      { headers: { 'X-Tenant-ID': 'store-a' } },
      { AURA_DB: db } as Record<string, unknown>,
    );
    expect(page2Res.status).toBe(200);
    const page2Body = (await page2Res.json()) as {
      data: { rewards: Array<{ id: string }>; meta: { total: number } };
    };
    expect(page2Body.data.meta.total).toBe(2);
    expect(page2Body.data.rewards.map((r) => r.id)).toEqual(['lr-a2']);

    // Detail & Staff Redeem of legacy reward must both enforce resolved 150 points_cost (not default 100)
    const detailRes = await api.request(
      'http://localhost/api/loyalty/rewards/rw-legacy-cost',
      { headers: { 'X-Tenant-ID': 'store-a' } },
      { AURA_DB: db } as Record<string, unknown>,
    );
    expect(detailRes.status).toBe(200);
    const detailBody = (await detailRes.json()) as { data: { points_cost: number; pointsCost: number } };
    expect(detailBody.data.points_cost).toBe(150);
    expect(detailBody.data.pointsCost).toBe(150);

    const redeemRes = await api.request(
      'http://localhost/api/loyalty/rewards/redeem',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({ rewardId: 'rw-legacy-cost', customerId: 'cust-vip' }),
      },
      { AURA_DB: db } as Record<string, unknown>,
    );
    expect(redeemRes.status).toBe(200);
    const afterAcc = sqlite.prepare("SELECT current_points FROM loyalty_accounts WHERE id = 'la-vip'").get() as { current_points: number };
    expect(afterAcc.current_points).toBe(100);
  });

  it('prefers caller tenant order on order_number collision in reviews and records checkin loyalty_accounts + loyalty_transactions audit rows', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, order_number TEXT, customer_id TEXT, customer_phone TEXT,
        status TEXT, tenant_id TEXT
      );
      CREATE TABLE customers (
        id TEXT PRIMARY KEY, name TEXT, phone TEXT, loyalty_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0, loyalty_tier TEXT DEFAULT 'bronze',
        cashback_balance REAL DEFAULT 0, tenant_id TEXT, updated_at TEXT
      );
      CREATE TABLE reviews (
        id TEXT PRIMARY KEY, order_id TEXT, product_id TEXT, rating INTEGER, comment TEXT,
        customer_name TEXT, customer_phone TEXT, is_approved INTEGER DEFAULT 1,
        tenant_id TEXT, created_at TEXT
      );
      CREATE TABLE checkins (
        id TEXT PRIMARY KEY, customer_id TEXT, tenant_id TEXT, status TEXT,
        reward_amount REAL DEFAULT 0, points_earned INTEGER DEFAULT 0, staff_id TEXT
      );
      CREATE TABLE cashback_wallets (
        id TEXT PRIMARY KEY, customer_id TEXT, balance REAL DEFAULT 0, total_earned REAL DEFAULT 0,
        total_spent REAL DEFAULT 0, lifetime_earned REAL DEFAULT 0, tenant_id TEXT,
        created_at TEXT, updated_at TEXT
      );
      CREATE TABLE cashback_transactions (
        id TEXT PRIMARY KEY, wallet_id TEXT, customer_id TEXT, type TEXT, amount REAL,
        balance_after REAL, description TEXT, reference_id TEXT, tenant_id TEXT, created_at TEXT
      );
      CREATE TABLE loyalty_accounts (
        id TEXT PRIMARY KEY, tenant_id TEXT, customer_id TEXT, current_points INTEGER DEFAULT 0,
        points_balance INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0, tier TEXT DEFAULT 'bronze',
        last_checkin_date TEXT, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE loyalty_transactions (
        id TEXT PRIMARY KEY, tenant_id TEXT, account_id TEXT, customer_id TEXT,
        type TEXT, points INTEGER, balance_after INTEGER, description TEXT,
        reason TEXT, created_at TEXT
      );
      INSERT INTO orders (id, order_number, customer_id, customer_phone, status, tenant_id) VALUES
        ('ord-collision-a', 'ORD-100', 'cust-rev-a', '0901111111', 'completed', 'store-a'),
        ('ord-collision-b', 'ORD-100', 'cust-rev-b', '0902222222', 'completed', 'store-b');
      INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, tenant_id) VALUES
        ('cust-rev-a', 'Khách A', '0901111111', 0, 0, 'store-a');
      INSERT INTO checkins (id, customer_id, tenant_id, status, reward_amount, points_earned) VALUES
        ('ci-pts-1', 'cust-rev-a', 'store-a', 'pending', 0, 30);
    `);
    const db = createSqliteD1(sqlite);
    const secret = 'test-review-checkin-secret-32chr!';
    const custAToken = await generateJWT({ id: 'cust-rev-a', role: 'customer', tenantId: 'store-a' }, secret);
    const staffAToken = await mintStaffJwt(sqlite, { id: 'mgr-rev-a', role: 'manager', tenantId: 'store-a' }, secret);

    const revApp = new Hono();
    revApp.route('/api/reviews', reviewsRouter);
    const revRes = await revApp.request(
      'http://localhost/api/reviews',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custAToken}`,
          'X-Tenant-ID': 'store-a',
        },
        body: JSON.stringify({ order_id: 'ORD-100', rating: 5, comment: 'Ngon xuất sắc' }),
      },
      { AURA_DB: db, JWT_SECRET: secret } as Record<string, unknown>,
    );
    expect(revRes.status).toBe(201);
    const revRow = sqlite.prepare('SELECT order_id, tenant_id FROM reviews LIMIT 1').get() as { order_id: string; tenant_id: string };
    expect(revRow.order_id).toBe('ord-collision-a');
    expect(revRow.tenant_id).toBe('store-a');

    const ciApp = new Hono();
    ciApp.route('/api/checkin', checkinRouter);
    const ciRes = await ciApp.request(
      'http://localhost/api/checkin/ci-pts-1/approve',
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${staffAToken}`, 'X-Tenant-ID': 'store-a' },
      },
      { AURA_DB: db, JWT_SECRET: secret } as Record<string, unknown>,
    );
    expect(ciRes.status).toBe(200);

    const custRow = sqlite.prepare("SELECT loyalty_points FROM customers WHERE id = 'cust-rev-a'").get() as { loyalty_points: number };
    const laRow = sqlite.prepare("SELECT current_points, tenant_id FROM loyalty_accounts WHERE customer_id = 'cust-rev-a'").get() as {
      current_points: number;
      tenant_id: string;
    };
    const ltxRow = sqlite.prepare("SELECT id, type, points, reason, balance_after FROM loyalty_transactions WHERE id = 'ltx_checkin_ci-pts-1'").get() as {
      id: string;
      type: string;
      points: number;
      reason: string;
      balance_after: number;
    };
    expect(custRow.loyalty_points).toBe(30);
    expect(laRow).toEqual({ current_points: 30, tenant_id: 'store-a' });
    expect(ltxRow).toEqual({ id: 'ltx_checkin_ci-pts-1', type: 'earn', points: 30, reason: 'checkin', balance_after: 30 });
  });

  it('accrues net spend after prior refund on re-accrual and syncs customers.tier on refund-tranche tier downgrade', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY, name TEXT, phone TEXT,
        loyalty_points INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze', tier TEXT DEFAULT 'bronze',
        total_spent REAL DEFAULT 0, total_orders INTEGER DEFAULT 0,
        tenant_id TEXT DEFAULT 'default', updated_at TEXT
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, customer_id TEXT, total REAL, status TEXT, payment_status TEXT,
        cashback_earned REAL DEFAULT 0, points_earned INTEGER DEFAULT 0,
        cashback_used REAL DEFAULT 0, tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE cashback_wallets (
        id TEXT PRIMARY KEY, customer_id TEXT, balance REAL DEFAULT 0,
        total_earned REAL DEFAULT 0, total_spent REAL DEFAULT 0,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE cashback_transactions (
        id TEXT PRIMARY KEY, wallet_id TEXT, customer_id TEXT, order_id TEXT,
        type TEXT, amount REAL, balance_after REAL, multiplier_applied REAL,
        campaign_id TEXT, remaining_amount REAL, description TEXT,
        expires_at TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE loyalty_point_logs (
        id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, points_change INTEGER,
        balance_after INTEGER, reason TEXT, description TEXT, reference_id TEXT,
        tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE loyalty_audit_log (
        id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, action TEXT,
        amount_vnd REAL, points INTEGER, tier_before TEXT, tier_after TEXT, note TEXT,
        entity_type TEXT, entity_id TEXT, actor_id TEXT, metadata TEXT,
        before_json TEXT, after_json TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE loyalty_accounts (
        id TEXT PRIMARY KEY, customer_id TEXT, current_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0, tier TEXT DEFAULT 'bronze',
        order_count INTEGER DEFAULT 0, total_spent REAL DEFAULT 0, last_activity_at TEXT,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE loyalty_redemptions (
        id TEXT PRIMARY KEY, customer_id TEXT, points_spent INTEGER, code TEXT,
        voucher_code TEXT, status TEXT, used_at TEXT, redeemed_at TEXT,
        created_at TEXT, tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE user_rewards (
        id TEXT PRIMARY KEY, customer_id TEXT, code TEXT, status TEXT, tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE refund_loyalty_work (
        id TEXT PRIMARY KEY, tenant_id TEXT, reversal_key TEXT, order_id TEXT, customer_id TEXT,
        status TEXT, amount REAL, points_reversed INTEGER DEFAULT 0, cashback_reversed REAL DEFAULT 0,
        attempts INTEGER DEFAULT 0, completed_at TEXT, created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT, last_error TEXT
      );
      CREATE TABLE refund_mutation_guards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reversal_ok INTEGER NOT NULL CHECK (reversal_ok = 1)
      );
    `);
    sqlite.prepare(`
      INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, loyalty_tier, tier, total_spent, total_orders, tenant_id)
      VALUES ('c-net', 'Minh', '0903334455', 0, 0, 'bronze', 'bronze', 0, 0, 'default')
    `).run();
    sqlite.prepare(`
      INSERT INTO orders (id, customer_id, total, status, payment_status, tenant_id)
      VALUES ('ord-net', 'c-net', 1500000, 'completed', 'paid', 'default')
    `).run();
    sqlite.prepare(`
      INSERT INTO refund_loyalty_work (id, tenant_id, reversal_key, order_id, customer_id, status, amount, points_reversed, cashback_reversed)
      VALUES ('rlw-prior', 'default', 'rk-prior', 'ord-net', 'c-net', 'completed', 500000, 0, 0)
    `).run();

    const db = createSqliteD1(sqlite);
    const accrualRes = await applyAccrual(db, BASE_POLICY, {
      orderId: 'ord-net',
      customerId: 'c-net',
      orderTotalVnd: 1500000,
      tenantId: 'default',
    });
    expect(accrualRes.ok).toBe(true);
    const custAfterAccrual = sqlite.prepare("SELECT total_spent, loyalty_points, loyalty_tier, tier FROM customers WHERE id = 'c-net'").get() as {
      total_spent: number;
      loyalty_points: number;
      loyalty_tier: string;
      tier: string;
    };
    expect(custAfterAccrual.total_spent).toBe(1000000);
    expect(custAfterAccrual.loyalty_points).toBe(100);
    expect(custAfterAccrual.loyalty_tier).toBe('silver');
    expect(custAfterAccrual.tier).toBe('silver');

    // Now refund the remaining 1,000,000 VND tranche -> drops lifetime_points from 100 to 0 and downgrades both loyalty_tier & tier to bronze
    sqlite.prepare(`
      INSERT INTO refund_loyalty_work (id, tenant_id, reversal_key, order_id, customer_id, status, amount)
      VALUES ('rlw-next', 'default', 'rk-next', 'ord-net', 'c-net', 'pending', 1000000)
    `).run();
    const refundRes = await reverseRefundTranche(db, BASE_POLICY, {
      orderId: 'ord-net',
      customerId: 'c-net',
      refundAmountVnd: 1000000,
      tenantId: 'default',
      reversalKey: 'rk-next',
    });
    expect(refundRes).toEqual({
      ok: true,
      pointsDeducted: 100,
      newLifetimePoints: 0,
      tierDowngraded: true,
      newTier: 'bronze',
    });
    const custAfterRefund = sqlite.prepare("SELECT loyalty_tier, tier, total_spent FROM customers WHERE id = 'c-net'").get() as {
      loyalty_tier: string;
      tier: string;
      total_spent: number;
    };
    expect(custAfterRefund.loyalty_tier).toBe('bronze');
    expect(custAfterRefund.tier).toBe('bronze');
    expect(custAfterRefund.total_spent).toBe(0);
  });
});
