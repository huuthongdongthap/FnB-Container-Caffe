// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { applyAccrual } from '../../../../packages/domain/crm/commands/accrual';
import { DEFAULT_LOYALTY_POLICY } from '../../../../packages/domain/crm/commands/loyalty-policy';
import { consumeCrmEvent } from '../../../../packages/domain/crm/commands/consume-crm-event';
import { getOrCreateReferralCode, getReferralCode, redeemReferral } from '../../../../packages/domain/crm/commands/referral';
import { getCustomerAccount } from '../../../../packages/domain/crm/commands/get-customer-account';
import { requireAdmin, requireVendor } from '../../tree/subscriptions/middleware';
import { listSubscriptions, getStatsHandler, getMRRTrend, getSubscription } from '../../tree/subscriptions/sub-handlers';
import { realtimeOrdersRouter } from '../../routes/realtime-orders';
import { dispatchDigestViaCallback } from '../../lib/alerts/digest';
import { generateJWT } from '../../lib/jwt';
import { TEST_JWT_SECRET } from '../test-utils';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        params = values.map((v) => (v === undefined ? null : v));
        return stmt;
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const s = sqlite.prepare(sql);
        const row = s.get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] as T) ?? null);
        return row as unknown as T;
      },
      async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
        const s = sqlite.prepare(sql);
        const rows = s.all(...(params as never[])) as unknown as T[];
        return { results: rows, success: true };
      },
      async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
        const s = sqlite.prepare(sql);
        const info = s.run(...(params as never[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
    };
    return stmt;
  };

  return {
    prepare,
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const st of statements) {
        out.push(await st.run());
      }
      return out;
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
}

describe('Phase 50 Slice AW3 — CRM Accrual/Referrals, Subscriptions Middleware/MRR, Digest & Realtime Channel Security', () => {
  it('1. applyAccrual rejects cancelled/rejected/failed/expired/refunded orders with order_not_eligible', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        total INTEGER,
        cashback_used INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'paid',
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        loyalty_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze',
        tenant_id TEXT DEFAULT 'default'
      );
    `);
    sqlite
      .prepare("INSERT INTO customers (id, loyalty_points, lifetime_points, loyalty_tier, tenant_id) VALUES ('cust-1', 100, 100, 'bronze', 'sadec')")
      .run();
    sqlite
      .prepare("INSERT INTO orders (id, customer_id, total, status, payment_status, tenant_id) VALUES ('ord-cancelled', 'cust-1', 150000, 'cancelled', 'paid', 'sadec')")
      .run();
    sqlite
      .prepare("INSERT INTO orders (id, customer_id, total, status, payment_status, tenant_id) VALUES ('ord-refunded', 'cust-1', 150000, 'completed', 'refunded', 'sadec')")
      .run();

    const db = createSqliteD1(sqlite);

    const resCancelled = await applyAccrual(db, DEFAULT_LOYALTY_POLICY, {
      orderId: 'ord-cancelled',
      customerId: 'cust-1',
      orderTotalVnd: 150000,
      tenantId: 'sadec',
    });
    expect(resCancelled).toEqual({ ok: false, reason: 'order_not_eligible' });

    const resRefunded = await applyAccrual(db, DEFAULT_LOYALTY_POLICY, {
      orderId: 'ord-refunded',
      customerId: 'cust-1',
      orderTotalVnd: 150000,
      tenantId: 'sadec',
    });
    expect(resRefunded).toEqual({ ok: false, reason: 'order_not_eligible' });
    sqlite.close();
  });

  it('2. consumeCrmEvent resolves tenant from orders/customers and skips accrual on customer_linked when order is cancelled/refunded', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        total INTEGER,
        cashback_used INTEGER DEFAULT 0,
        status TEXT DEFAULT 'cancelled',
        payment_status TEXT DEFAULT 'refunded',
        tenant_id TEXT DEFAULT 'sadec'
      );
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        loyalty_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze',
        tenant_id TEXT DEFAULT 'sadec'
      );
      CREATE TABLE visits (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        order_id TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
    `);
    sqlite.prepare("INSERT INTO customers (id, tenant_id) VALUES ('cust-sadec', 'sadec')").run();
    sqlite.prepare("INSERT INTO orders (id, customer_id, total, status, payment_status, tenant_id) VALUES ('ord-sadec-1', 'cust-sadec', 200000, 'cancelled', 'refunded', 'sadec')").run();
    sqlite.prepare("INSERT INTO visits (id, customer_id, order_id, tenant_id) VALUES ('vis-default', NULL, 'ord-sadec-1', 'default')").run();
    sqlite.prepare("INSERT INTO visits (id, customer_id, order_id, tenant_id) VALUES ('vis-sadec', NULL, 'ord-sadec-1', 'sadec')").run();

    const db = createSqliteD1(sqlite);
    const res = await consumeCrmEvent({
      db,
      event: {
        eventType: 'customer_linked',
        customerId: 'cust-sadec',
        orderId: 'ord-sadec-1',
        payload: { totalAmount: 200000 },
      },
    });
    expect(res.ok).toBe(true);
    // Only the sadec visit is linked; default visit remains untouched and no loyalty points accrued on cancelled order
    const defaultVisit = sqlite.prepare("SELECT customer_id FROM visits WHERE id = 'vis-default'").get() as { customer_id: string | null };
    const sadecVisit = sqlite.prepare("SELECT customer_id FROM visits WHERE id = 'vis-sadec'").get() as { customer_id: string | null };
    const custPoints = sqlite.prepare("SELECT loyalty_points FROM customers WHERE id = 'cust-sadec'").get() as { loyalty_points: number };
    expect(defaultVisit.customer_id).toBeNull();
    expect(sadecVisit.customer_id).toBe('cust-sadec');
    expect(custPoints.loyalty_points).toBe(0);
    sqlite.close();
  });

  it('3. getOrCreateReferralCode, getReferralCode, and redeemReferral isolate referral codes per tenant', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE referral_codes (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        code TEXT,
        times_used INTEGER DEFAULT 0,
        max_uses INTEGER,
        total_points_earned INTEGER DEFAULT 0,
        total_cashback_earned_vnd INTEGER DEFAULT 0,
        created_at TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE referrals (
        id TEXT PRIMARY KEY,
        referrer_customer_id TEXT,
        referred_customer_id TEXT,
        referral_code TEXT,
        status TEXT,
        referrer_reward_points INTEGER,
        referrer_cashback INTEGER,
        bonus_type TEXT,
        created_at TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
    `);
    sqlite.prepare("INSERT INTO customers (id, name, tenant_id) VALUES ('cust-a', 'Alice', 'tenant-a')").run();
    sqlite.prepare("INSERT INTO customers (id, name, tenant_id) VALUES ('cust-b', 'Bob', 'tenant-b')").run();

    const db = createSqliteD1(sqlite);
    const createdA = await getOrCreateReferralCode(db, 'cust-a', 'Alice', 'tenant-a');
    expect(createdA.isNew).toBe(true);

    // Cross-tenant lookup for cust-a under tenant-b returns null
    const crossCode = await getReferralCode(db, 'cust-a', 'tenant-b');
    expect(crossCode).toBeNull();

    // Cross-tenant redemption of tenant-a's code under tenant-b fails with invalid_code
    const crossRedeem = await redeemReferral(db, 'cust-b', createdA.code, 'points', undefined, 'tenant-b');
    expect(crossRedeem).toEqual({ success: false, reason: 'invalid_code' });
    sqlite.close();
  });

  it('4. getCustomerAccount isolates customer profile and order lookups strictly to the requested tenant', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        loyalty_tier TEXT DEFAULT 'bronze',
        loyalty_points INTEGER DEFAULT 50,
        lifetime_points INTEGER DEFAULT 50,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        customer_phone TEXT,
        total INTEGER,
        status TEXT,
        created_at TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
    `);
    sqlite
      .prepare("INSERT INTO customers (id, name, phone, email, loyalty_tier, loyalty_points, lifetime_points, tenant_id) VALUES ('cust-1', 'Tran Van A', '0901234567', 'a@example.com', 'silver', 250, 500, 'tenant-a')")
      .run();
    sqlite
      .prepare("INSERT INTO orders (id, customer_id, customer_phone, total, status, created_at, tenant_id) VALUES ('ord-a', 'cust-1', '0901234567', 85000, 'completed', '2026-11-03T10:00:00Z', 'tenant-a')")
      .run();
    sqlite
      .prepare("INSERT INTO orders (id, customer_id, customer_phone, total, status, created_at, tenant_id) VALUES ('ord-b', 'cust-other', '0901234567', 99000, 'completed', '2026-11-03T11:00:00Z', 'tenant-b')")
      .run();

    const db = createSqliteD1(sqlite);

    // Querying cust-1 under tenant-b returns empty profile
    const wrongTenantAcct = await getCustomerAccount(db, 'cust-1', { tenantId: 'tenant-b' });
    expect(wrongTenantAcct.name).toBeNull();
    expect(wrongTenantAcct.points).toBe(0);
    expect(wrongTenantAcct.recentOrders).toEqual([]);

    // Querying cust-1 under tenant-a returns only tenant-a orders (does not leak ord-b sharing phone)
    const rightTenantAcct = await getCustomerAccount(db, 'cust-1', { tenantId: 'tenant-a' });
    expect(rightTenantAcct.customerId).toBe('cust-1');
    expect(rightTenantAcct.recentOrders.map((o) => o.id)).toEqual(['ord-a']);
    sqlite.close();
  });

  it('5. subscription middleware (requireAdmin/requireVendor) enforces live staff active status, role demotion, and live tenant sync', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE staff_users (
        id TEXT PRIMARY KEY,
        role TEXT,
        tenant_id TEXT,
        is_active INTEGER DEFAULT 1
      );
    `);
    sqlite.prepare("INSERT INTO staff_users (id, role, tenant_id, is_active) VALUES ('staff-inactive', 'manager', 'sadec', 0)").run();
    sqlite.prepare("INSERT INTO staff_users (id, role, tenant_id, is_active) VALUES ('staff-demoted', 'waiter', 'sadec', 1)").run();
    sqlite.prepare("INSERT INTO staff_users (id, role, tenant_id, is_active) VALUES ('staff-live', 'manager', 'sadec', 1)").run();

    const db = createSqliteD1(sqlite);
    const app = new Hono<{ Bindings: Env }>();
    app.get('/sub-admin', async (c) => {
      const err = await requireAdmin(c);
      if (err) return err;
      return c.json({ tenantId: (c as unknown as { get: (k: string) => unknown }).get('tenantId') });
    });
    app.get('/sub-vendor', async (c) => {
      const err = await requireVendor(c);
      if (err) return err;
      return c.json({ ok: true });
    });

    const env = { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env;

    const inactiveToken = await generateJWT({ id: 'staff-inactive', role: 'manager', tenantId: 'sadec' }, TEST_JWT_SECRET);
    const resInactive = await app.request('/sub-admin', { headers: { Authorization: `Bearer ${inactiveToken}` } }, env);
    expect(resInactive.status).toBe(403);

    const demotedToken = await generateJWT({ id: 'staff-demoted', role: 'manager', tenantId: 'sadec' }, TEST_JWT_SECRET);
    const resDemoted = await app.request('/sub-admin', { headers: { Authorization: `Bearer ${demotedToken}` } }, env);
    expect(resDemoted.status).toBe(403);

    // Token claims tenantId 'default', but live DB says 'sadec' -> synced to 'sadec'
    const liveToken = await generateJWT({ id: 'staff-live', role: 'manager', tenantId: 'default' }, TEST_JWT_SECRET);
    const resLive = await app.request('/sub-admin', { headers: { Authorization: `Bearer ${liveToken}` } }, env);
    expect(resLive.status).toBe(200);
    const bodyLive = (await resLive.json()) as { tenantId: string };
    expect(bodyLive.tenantId).toBe('sadec');
    sqlite.close();
  });

  it('6. subscription handlers enforce role checks on listSubscriptions, normalize quarterly/annual MRR in stats/trend, and filter cross-tenant invoices', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE subscription_plans (
        id TEXT PRIMARY KEY,
        name TEXT,
        slug TEXT,
        container_size TEXT,
        monthly_price_vnd INTEGER,
        features TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE subscriptions (
        id TEXT PRIMARY KEY,
        plan_id TEXT,
        customer_id TEXT,
        customer_email TEXT,
        status TEXT DEFAULT 'active',
        billing_cycle TEXT DEFAULT 'monthly',
        amount_vnd INTEGER DEFAULT 0,
        zone TEXT DEFAULT 'Zone A',
        created_at TEXT,
        updated_at TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE subscription_invoices (
        id TEXT PRIMARY KEY,
        subscription_id TEXT,
        amount_vnd INTEGER,
        status TEXT,
        due_date TEXT,
        paid_at TEXT,
        created_at TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE mrr_snapshots (
        snapshot_date TEXT PRIMARY KEY,
        mrr_vnd INTEGER,
        arr_vnd INTEGER,
        active_subscriptions INTEGER
      );
    `);

    sqlite.prepare("INSERT INTO subscription_plans (id, name, slug, container_size, monthly_price_vnd, features, tenant_id) VALUES ('plan-1', 'Pro', 'pro', '20ft', 10000000, '[\"wifi\"]', 'sadec')").run();
    sqlite.prepare("INSERT INTO subscriptions (id, plan_id, customer_id, customer_email, status, billing_cycle, amount_vnd, zone, created_at, tenant_id) VALUES ('sub-q', 'plan-1', 'cust-1', 'c1@test.com', 'active', 'quarterly', 30000000, 'Zone A', '2026-11-01T00:00:00Z', 'sadec')").run();
    sqlite.prepare("INSERT INTO subscriptions (id, plan_id, customer_id, customer_email, status, billing_cycle, amount_vnd, zone, created_at, tenant_id) VALUES ('sub-y', 'plan-1', 'cust-2', 'c2@test.com', 'active', 'annual', 120000000, 'Zone B', '2026-11-02T00:00:00Z', 'sadec')").run();
    sqlite.prepare("INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, created_at, tenant_id) VALUES ('inv-sadec', 'sub-q', 30000000, 'paid', '2026-11-01T00:00:00Z', 'sadec')").run();
    sqlite.prepare("INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, created_at, tenant_id) VALUES ('inv-other', 'sub-q', 99000000, 'paid', '2026-11-02T00:00:00Z', 'other-tenant')").run();

    const db = createSqliteD1(sqlite);
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      const tid = c.req.header('X-Tenant-ID') || 'sadec';
      (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', tid);
      await next();
    });
    app.get('/list', listSubscriptions);
    app.get('/stats', getStatsHandler);
    app.get('/trend', getMRRTrend);
    app.get('/sub/:id', getSubscription);

    const env = { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env;

    // Waiter token is rejected on listSubscriptions with 403
    const waiterToken = await generateJWT({ id: 'w-1', role: 'waiter', tenantId: 'sadec' }, TEST_JWT_SECRET);
    const resWaiter = await app.request('/list', { headers: { Authorization: `Bearer ${waiterToken}` } }, env);
    expect(resWaiter.status).toBe(403);

    // Stats normalizes quarterly (30M / 3 = 10M) + annual (120M / 12 = 10M) => 20M MRR
    const resStats = await app.request('/stats', {}, env);
    expect(resStats.status).toBe(200);
    const statsJson = (await resStats.json()) as { data: { mrr_vnd: number; active_subscriptions: number } };
    expect(statsJson.data.mrr_vnd).toBe(20000000);
    expect(statsJson.data.active_subscriptions).toBe(2);

    // Trend for non-default tenant returns normalized live MRR (20M)
    const resTrend = await app.request('/trend?days=9999', {}, env);
    expect(resTrend.status).toBe(200);
    const trendJson = (await resTrend.json()) as { data: { snapshots: Array<{ mrr_vnd: number }> } };
    expect(trendJson.data.snapshots[0].mrr_vnd).toBe(20000000);

    // getSubscription filters out cross-tenant invoice rows
    const managerToken = await generateJWT({ id: 'm-1', role: 'manager', tenantId: 'sadec' }, TEST_JWT_SECRET);
    const resSub = await app.request('/sub/sub-q', { headers: { Authorization: `Bearer ${managerToken}` } }, env);
    expect(resSub.status).toBe(200);
    const subJson = (await resSub.json()) as { data: { recent_invoices: Array<{ id: string }> } };
    expect(subJson.data.recent_invoices.map((i) => i.id)).toEqual(['inv-sadec']);
    sqlite.close();
  });

  it('7. realtimeOrdersRouter blocks cross-tenant channel prefixes (403) and scopes non-default tenant channels, while dispatchDigestViaCallback scopes _metrics by tenant', async () => {
    const requestedChannels: string[] = [];
    const mockBroadcaster = {
      idFromName(name: string) {
        requestedChannels.push(name);
        return name;
      },
      get(_id: string) {
        return {
          async fetch() {
            return new Response(JSON.stringify({ connected: true }), { status: 200 });
          },
        };
      },
    };

    const env = { ORDER_BROADCASTER: mockBroadcaster } as unknown as Env;

    // Cross-tenant prefix mismatch -> 403
    const crossRes = await realtimeOrdersRouter.request(
      '/other-tenant:kitchen',
      { headers: { 'X-Tenant-ID': 'sadec' } },
      env,
    );
    expect(crossRes.status).toBe(403);

    // Non-default tenant bare channel -> automatically scoped to sadec:kitchen
    const scopedRes = await realtimeOrdersRouter.request(
      '/kitchen',
      { headers: { 'X-Tenant-ID': 'sadec' } },
      env,
    );
    expect(scopedRes.status).toBe(200);
    expect(requestedChannels).toEqual(['sadec:kitchen']);

    // Digest stats scoped by tenant_id in _metrics JSON tags
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE _metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        value REAL,
        tags TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    sqlite.prepare(`INSERT INTO _metrics (name, value, tags) VALUES ('order_created', 1, '{"tenant_id":"sadec"}')`).run();
    sqlite.prepare(`INSERT INTO _metrics (name, value, tags) VALUES ('revenue', 120000, '{"tenant_id":"sadec"}')`).run();
    sqlite.prepare(`INSERT INTO _metrics (name, value, tags) VALUES ('order_created', 1, '{"tenant_id":"other"}')`).run();
    sqlite.prepare(`INSERT INTO _metrics (name, value, tags) VALUES ('revenue', 999000, '{"tenant_id":"other"}')`).run();

    const db = createSqliteD1(sqlite);
    const messages: string[] = [];
    await dispatchDigestViaCallback(
      db,
      async (msg) => {
        messages.push(msg);
      },
      'en',
      'sadec',
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('120.000');
    expect(messages[0]).not.toContain('999.000');
    sqlite.close();
  });
});
