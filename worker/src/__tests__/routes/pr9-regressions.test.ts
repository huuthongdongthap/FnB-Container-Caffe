// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { pauseSubscription, resumeSubscription } from '../../tree/subscriptions/sub-handlers';
import { registerCheckoutHandlers } from '../../routes/dindin-handlers/checkout-handlers';
import { resolveStaffPushRequestedRole, STAFF_PUSH_ROLE } from '../../tree/push/roles';
import { sendPushToStaff } from '../../tree/push/notifier';
import { createTenantRoutes, generateSlug } from '../../routes/saas-tenants';
import { leadsRouter } from '../../routes/leads';
import { runCampaignTriggers } from '../../tree/campaigns/cron-handler';
import { generateJWT } from '../../lib/jwt';
import { issueStaffSession } from '../../lib/staff-session';
import {
  detectWelcomeCandidates,
  detectBirthdayCandidates,
  hasMarketingConsentForChannel,
} from '@aura/domain-crm';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  },
}));

function makeSqliteD1(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      const bind = (...args: unknown[]) => ({
        async first<T = Record<string, unknown>>() {
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...(args as never[]));
          return (row as T | undefined) ?? null;
        },
        async all<T = Record<string, unknown>>() {
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...(args as never[])) as T[];
          return { results };
        },
        async run() {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run(...(args as never[]));
          return { success: true, meta: { changes: Number(info.changes ?? 0) }, rowCount: Number(info.changes ?? 0) };
        },
      });
      return {
        bind,
        first: () => bind().first(),
        all: () => bind().all(),
        run: () => bind().run(),
      };
    },
    async batch(stmts: Array<{ run(): Promise<unknown> }>) {
      const out: unknown[] = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  };
}

function makeKV(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

describe('PR-9 regressions (#196, #198, #200)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('#196: resumeSubscription clears paused_at so a second pause succeeds without 409', async () => {
    const sqlite = new DatabaseSync(':memory:');
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
      INSERT INTO users VALUES ('adm_1', 'Admin', NULL, 'owner', 'default', 1, 1);
      CREATE TABLE subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT DEFAULT 'default',
        status TEXT NOT NULL,
        amount_vnd REAL DEFAULT 0,
        paused_at TEXT,
        current_period_end TEXT,
        next_billing_date TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE mrr_snapshots (
        id TEXT PRIMARY KEY,
        tenant_id TEXT DEFAULT 'default',
        snapshot_date TEXT NOT NULL UNIQUE,
        mrr_vnd INTEGER NOT NULL DEFAULT 0,
        arr_vnd INTEGER NOT NULL DEFAULT 0,
        active_subscriptions INTEGER NOT NULL DEFAULT 0,
        new_subscriptions_month INTEGER NOT NULL DEFAULT 0,
        churned_subscriptions_month INTEGER NOT NULL DEFAULT 0,
        expansion_mrr_vnd INTEGER DEFAULT 0,
        contraction_mrr_vnd INTEGER DEFAULT 0,
        churn_rate_pct REAL DEFAULT 0,
        avg_contract_value_vnd INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO subscriptions (id, tenant_id, status, paused_at, current_period_end, next_billing_date, created_at, updated_at)
      VALUES ('sub_1', 'default', 'active', NULL, '2026-12-31', '2026-12-31', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
    `);
    const db = makeSqliteD1(sqlite);
    const jwtSecret = 'test-secret-for-pr9-subscriptions-32b';
    const token = await generateJWT(
      { id: 'adm_1', sub: 'adm_1', role: 'owner', tenantId: 'default' },
      jwtSecret,
      3600
    );
    const app = new Hono<{ Bindings: Env }>();
    app.post('/subs/:id/pause', (c) => pauseSubscription(c));
    app.post('/subs/:id/resume', (c) => resumeSubscription(c));
    const env = { AURA_DB: db, AUTH_KV: makeKV(), JWT_SECRET: jwtSecret, ADMIN_API_KEY: 'test-admin-key' } as unknown as Env;
    const authHeaders = { Authorization: `Bearer ${token}`, 'X-Admin-Key': 'test-admin-key' };

    const p1 = await app.fetch(new Request('http://localhost/subs/sub_1/pause', { method: 'POST', headers: authHeaders }), env);
    expect(p1.status).toBe(200);

    const r1 = await app.fetch(new Request('http://localhost/subs/sub_1/resume', { method: 'POST', headers: authHeaders }), env);
    expect(r1.status).toBe(200);
    const rowAfterResume = sqlite.prepare('SELECT status, paused_at FROM subscriptions WHERE id = ?').get('sub_1') as { status: string; paused_at: string | null };
    expect(rowAfterResume.status).toBe('active');
    expect(rowAfterResume.paused_at).toBeNull();

    const p2 = await app.fetch(new Request('http://localhost/subs/sub_1/pause', { method: 'POST', headers: authHeaders }), env);
    expect(p2.status).toBe(200);
  });

  it('#196: DinDin GET /checkouts filters printed and qc_ok from hydrated KV state', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT DEFAULT 'default',
        customer_name TEXT,
        customer_phone TEXT,
        payment_method TEXT,
        items TEXT,
        total REAL,
        status TEXT,
        created_at TEXT
      );
      INSERT INTO orders VALUES ('DIN001', 'default', 'DIN', 'sess1', 'cod', '[]', 45000, 'pending', '2026-11-24T10:00:00Z');
      INSERT INTO orders VALUES ('DIN002', 'default', 'DIN', 'sess2', 'cod', '[]', 55000, 'pending', '2026-11-24T10:05:00Z');
    `);
    const kv = makeKV({
      'dindin:print:DIN001': JSON.stringify({ printed: true }),
      'dindin:qc:DIN002': JSON.stringify({ qcPassed: true }),
    });
    const router = new Hono<{ Bindings: Env }>();
    registerCheckoutHandlers(router);
    const env = { AURA_DB: makeSqliteD1(sqlite), AUTH_KV: kv } as unknown as Env;

    const printedRes = await router.fetch(new Request('http://localhost/checkouts?status=printed'), env);
    const printedJson = await printedRes.json() as { checkouts: Array<{ id: string }> };
    expect(printedJson.checkouts.map((o) => o.id)).toEqual(['DIN001']);

    const qcRes = await router.fetch(new Request('http://localhost/checkouts?status=qc_ok'), env);
    const qcJson = await qcRes.json() as { checkouts: Array<{ id: string }> };
    expect(qcJson.checkouts.map((o) => o.id)).toEqual(['DIN002']);
  });

  it('#198: kitchen/barista/chef/staff can subscribe to staff-kitchen and notifier honors autoNotifyNewOrder=false', async () => {
    expect(resolveStaffPushRequestedRole(STAFF_PUSH_ROLE, 'kitchen')).toEqual({ ok: true, role: STAFF_PUSH_ROLE });
    expect(resolveStaffPushRequestedRole(STAFF_PUSH_ROLE, 'barista')).toEqual({ ok: true, role: STAFF_PUSH_ROLE });
    expect(resolveStaffPushRequestedRole('all', 'owner')).toEqual({ ok: true, role: 'staff' });

    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE push_subscriptions (
        id TEXT PRIMARY KEY,
        endpoint TEXT,
        auth_key TEXT,
        p256dh_key TEXT,
        customer_id TEXT,
        role TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      INSERT INTO push_subscriptions VALUES ('p1', 'https://push.example.com/1', 'a', 'p', 'st1', 'kitchen', 'default');
    `);
    const kvOff = makeKV({ 'config:notification_settings:default': JSON.stringify({ autoNotifyNewOrder: false }) });
    const resOff = await sendPushToStaff(
      { AURA_DB: makeSqliteD1(sqlite), AUTH_KV: kvOff, VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' } as unknown as Parameters<typeof sendPushToStaff>[0],
      { title: 'New order', body: '#1', data: { type: 'new_order' } },
      STAFF_PUSH_ROLE,
      [],
      'default'
    );
    expect(resOff).toEqual({ sent: 0, failed: 0 });

    const kvOn = makeKV({ 'config:notification_settings:default': JSON.stringify({ autoNotifyNewOrder: true }) });
    const resOn = await sendPushToStaff(
      { AURA_DB: makeSqliteD1(sqlite), AUTH_KV: kvOn, VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' } as unknown as Parameters<typeof sendPushToStaff>[0],
      { title: 'New order', body: '#1', data: { type: 'new_order' } },
      STAFF_PUSH_ROLE,
      [],
      'default'
    );
    expect(resOn.sent).toBe(1);
  });

  it('#198: detectWelcomeCandidates excludes anonymized customers and revoked marketing consent; cron skips inactive triggers', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const recent = new Date().toISOString();
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        loyalty_tier TEXT,
        created_at TEXT,
        tenant_id TEXT DEFAULT 'default',
        anonymized_at TEXT
      );
      CREATE TABLE campaign_logs (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        trigger TEXT,
        channel TEXT,
        sent_at TEXT,
        status TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE consents (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        purpose TEXT,
        granted INTEGER,
        revoked_at TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE campaign_configs (
        tenant_id TEXT DEFAULT 'default',
        trigger TEXT PRIMARY KEY,
        is_active INTEGER DEFAULT 1,
        channels TEXT DEFAULT '["sms"]'
      );
      INSERT INTO customers VALUES ('c_ok', 'Good', '0901111111', NULL, 'bronze', '${recent}', 'default', NULL);
      INSERT INTO customers VALUES ('c_erased', 'Erased', '0902222222', NULL, 'bronze', '${recent}', 'default', '2026-11-20T00:00:00Z');
      INSERT INTO customers VALUES ('c_revoked', 'Revoked', '0903333333', NULL, 'bronze', '${recent}', 'default', NULL);
      INSERT INTO customers VALUES ('c_no_consent', 'NoConsent', '0904444444', NULL, 'bronze', '${recent}', 'default', NULL);
      INSERT INTO consents VALUES ('con_ok', 'c_ok', 'marketing', 1, NULL, 'default');
      INSERT INTO consents VALUES ('con_1', 'c_revoked', 'marketing', 0, '2026-11-21T00:00:00Z', 'default');
      INSERT INTO campaign_configs VALUES ('default', 'welcome', 0, '["sms"]');
    `);
    const db = makeSqliteD1(sqlite);
    const candidates = await detectWelcomeCandidates(db as unknown as import('@cloudflare/workers-types').D1Database, 'default');
    expect(candidates.map((c) => c.id)).toEqual(['c_ok']);

    const cronRes = await runCampaignTriggers({ AURA_DB: db, PILOT_STORE: 'default' });
    expect(cronRes.triggered).toBe(0);
    expect(cronRes.sent).toBe(0);
  });

  it('#200: POST /api/saas/tenants/self-serve provisions a trial workspace for default-tenant customer JWT and GET /my succeeds with refreshed token', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        phone TEXT,
        role TEXT,
        tenant_id TEXT DEFAULT 'default',
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1,
        updated_at TEXT
      );
      INSERT INTO users VALUES ('new_founder_1', 'founder@example.com', 'Founder', NULL, 'customer', 'default', 1, 1, '2026-11-24T00:00:00Z');
      CREATE TABLE saas_tenants (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE,
        name TEXT,
        tier TEXT,
        status TEXT,
        owner_user_id TEXT,
        trial_ends_at TEXT,
        current_period_end TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE tenant_subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        tier TEXT,
        status TEXT,
        trial_ends_at TEXT,
        current_period_end TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);
    const jwtSecret = 'test-secret-for-pr9-saas-selfserve-32b';
    const initialToken = await generateJWT(
      { id: 'new_founder_1', sub: 'new_founder_1', email: 'founder@example.com', role: 'customer', tenantId: 'default' },
      jwtSecret,
      3600
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/saas/tenants', createTenantRoutes());
    const env = { AURA_DB: makeSqliteD1(sqlite), AUTH_KV: makeKV(), JWT_SECRET: jwtSecret } as unknown as Env;

    const res = await app.fetch(
      new Request('http://localhost/api/saas/tenants/self-serve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${initialToken}`,
        },
        body: JSON.stringify({ name: 'My New Cafe' }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const json = await res.json() as { ok: boolean; token?: string | null; data?: { id?: string; slug?: string; token?: string | null } };
    expect(json.ok).toBe(true);
    expect(json.data?.slug).toBe('my-new-cafe');
    const refreshedToken = json.token || json.data?.token;
    expect(typeof refreshedToken).toBe('string');

    const myRes = await app.fetch(
      new Request('http://localhost/api/saas/tenants/my', {
        headers: { Authorization: `Bearer ${refreshedToken}` },
      }),
      env
    );
    expect(myRes.status).toBe(200);
    const myJson = await myRes.json() as { ok: boolean; data?: { id?: string; slug?: string } };
    expect(myJson.ok).toBe(true);
    expect(myJson.data?.id).toBe(json.data?.id);
  });

  it('#200: HQ super admin calling POST /api/saas/tenants/self-serve keeps HQ tenant_id and receives no demoted token', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        role TEXT,
        tenant_id TEXT,
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1,
        updated_at TEXT
      );
      INSERT INTO users (id, name, email, role, tenant_id, is_active, auth_version)
      VALUES ('hq_admin_1', 'HQ Boss', 'hq@example.com', 'admin', 'hq', 1, 1);
      CREATE TABLE saas_tenants (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE,
        name TEXT,
        tier TEXT,
        status TEXT,
        owner_user_id TEXT,
        trial_ends_at TEXT,
        current_period_end TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE tenant_subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        tier TEXT,
        status TEXT,
        trial_ends_at TEXT,
        current_period_end TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);
    const jwtSecret = 'test-secret-for-pr9-saas-hq-admin-32b';
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/saas/tenants', createTenantRoutes());
    const env = { AURA_DB: makeSqliteD1(sqlite), AUTH_KV: makeKV(), JWT_SECRET: jwtSecret } as unknown as Env;
    const { token: hqToken } = await issueStaffSession(
      env,
      { id: 'hq_admin_1', name: 'HQ Boss', role: 'admin', tenant_id: 'hq', is_active: 1, auth_version: 1 },
      { email: 'hq@example.com', sessionType: 'staff-web' }
    );

    const res = await app.fetch(
      new Request('http://localhost/api/saas/tenants/self-serve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hqToken}`,
        },
        body: JSON.stringify({ name: 'HQ Provisioned Cafe' }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const json = await res.json() as { ok: boolean; token?: string | null; data?: { id?: string; token?: string | null } };
    expect(json.ok).toBe(true);
    expect(json.token).toBeNull();
    expect(json.data?.token).toBeNull();

    const userRow = sqlite.prepare('SELECT tenant_id, role FROM users WHERE id = ?').get('hq_admin_1') as { tenant_id: string; role: string };
    expect(userRow.tenant_id).toBe('hq');
    expect(userRow.role).toBe('admin');
  });

  it('#201: POST /api/leads validates email and persists newsletter lead to KV', async () => {
    const kv = makeKV();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/leads', leadsRouter);
    const env = { AUTH_KV: kv } as unknown as Env;

    const badRes = await app.fetch(
      new Request('http://localhost/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      }),
      env
    );
    expect(badRes.status).toBe(400);

    const okRes = await app.fetch(
      new Request('http://localhost/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'VIP@AuraCafe.vn', source: 'promotions_newsletter' }),
      }),
      env
    );
    expect(okRes.status).toBe(201);
    const okJson = await okRes.json() as { success: boolean; data?: { email: string; source: string } };
    expect(okJson.success).toBe(true);
    expect(okJson.data?.email).toBe('vip@auracafe.vn');
    const stored = await kv.get('lead:default:vip@auracafe.vn');
    expect(stored).toContain('vip@auracafe.vn');
  });

  it('#196: DinDin POST /checkout rejects available=false (with sold_out=false) with HTTP 409 D04', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const dindinConfig = JSON.stringify({
      menu: {
        sections: [
          {
            items: [
              { id: 'item_unavail', name: 'Matcha Latte', price: 45000, sold_out: false, available: false },
            ],
          },
        ],
      },
    });
    sqlite.exec(`
      CREATE TABLE dindin_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT DEFAULT 'default',
        config TEXT NOT NULL
      );
    `);
    sqlite.prepare('INSERT INTO dindin_config (tenant_id, config) VALUES (?, ?)').run('default', dindinConfig);
    const kv = makeKV({
      'dindin:cart:sess_unavail': JSON.stringify({
        items: [{ id: 'item_unavail', name: 'Matcha Latte', price: 45000, qty: 1 }],
        updatedAt: new Date().toISOString(),
      }),
    });
    const router = new Hono<{ Bindings: Env }>();
    registerCheckoutHandlers(router);
    const env = { AURA_DB: makeSqliteD1(sqlite), AUTH_KV: kv } as unknown as Env;

    const res = await router.fetch(
      new Request('http://localhost/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': 'sess_unavail',
        },
        body: JSON.stringify({
          sessionId: 'sess_unavail',
          payment_method: 'cod',
          items: [{ id: 'item_unavail', name: 'Matcha Latte', price: 45000, qty: 1 }],
        }),
      }),
      env
    );
    expect(res.status).toBe(409);
    const json = await res.json() as { code?: string };
    expect(json.code).toBe('D04');
  });

  it('#200: generateSlug normalizes Vietnamese đ/Đ and trims trailing dashes after 40-char truncation', () => {
    expect(generateSlug('Đà Nẵng Điền')).toBe('da-nang-dien');
    const longWithBoundaryDash = `${'a'.repeat(39)} bbbbb`;
    const slug = generateSlug(longWithBoundaryDash);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug).toBe('a'.repeat(39));
  });

  it('#200: POST /api/saas/tenants/self-serve enforces reserved slugs, role/active guards, duplicate owner 409, cookie auth, and Set-Cookie session emission', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        phone TEXT,
        role TEXT,
        tenant_id TEXT DEFAULT 'default',
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1,
        updated_at TEXT
      );
      INSERT INTO users VALUES ('cust_cookie_1', 'cookie@example.com', 'Cookie Founder', '0909123456', 'customer', 'default', 1, 1, '2026-11-24T00:00:00Z');
      INSERT INTO users VALUES ('staff_existing_1', 'staff@example.com', 'Existing Staff', NULL, 'staff', 'default', 1, 1, '2026-11-24T00:00:00Z');
      INSERT INTO users VALUES ('inactive_cust_1', 'inactive@example.com', 'Inactive User', NULL, 'customer', 'default', 0, 1, '2026-11-24T00:00:00Z');
      CREATE TABLE saas_tenants (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE,
        name TEXT,
        tier TEXT,
        status TEXT,
        owner_user_id TEXT,
        trial_ends_at TEXT,
        current_period_end TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE tenant_subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        tier TEXT,
        status TEXT,
        trial_ends_at TEXT,
        current_period_end TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    const jwtSecret = 'test-secret-for-pr9-selfserve-hardening-32b';
    const cookieToken = await generateJWT(
      { id: 'cust_cookie_1', sub: 'cust_cookie_1', email: 'cookie@example.com', role: 'customer', tenantId: 'default' },
      jwtSecret,
      3600
    );
    const staffClaimAsCustomerToken = await generateJWT(
      { id: 'staff_existing_1', sub: 'staff_existing_1', email: 'staff@example.com', role: 'customer', tenantId: 'default' },
      jwtSecret,
      3600
    );
    const inactiveToken = await generateJWT(
      { id: 'inactive_cust_1', sub: 'inactive_cust_1', email: 'inactive@example.com', role: 'customer', tenantId: 'default' },
      jwtSecret,
      3600
    );

    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/saas/tenants', createTenantRoutes());
    const env = { AURA_DB: makeSqliteD1(sqlite), AUTH_KV: makeKV(), JWT_SECRET: jwtSecret } as unknown as Env;

    // 0. Cookie-only write request is blocked by CSRF guard (403)
    const cookieWriteRes = await app.fetch(
      new Request('http://localhost/api/saas/tenants/self-serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `access_token=${cookieToken}` },
        body: JSON.stringify({ name: 'Cookie Blocked Store' }),
      }),
      env
    );
    expect(cookieWriteRes.status).toBe(403);

    // 1. Reserved slug rejected with 400
    const reservedRes = await app.fetch(
      new Request('http://localhost/api/saas/tenants/self-serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cookieToken}` },
        body: JSON.stringify({ name: 'Admin Store', slug: 'admin' }),
      }),
      env
    );
    expect(reservedRes.status).toBe(400);
    expect((await reservedRes.json() as { error: string }).error).toBe('invalid_slug');

    // 2. Persisted staff account in D1 cannot escalate via forged customer role claim
    const staffRes = await app.fetch(
      new Request('http://localhost/api/saas/tenants/self-serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffClaimAsCustomerToken}` },
        body: JSON.stringify({ name: 'Staff Store' }),
      }),
      env
    );
    expect(staffRes.status).toBe(403);

    // 3. Inactive user in D1 rejected with 401/403 (auth middleware rejects inactive D1 user with 401 SESSION_REVOKED)
    const inactiveRes = await app.fetch(
      new Request('http://localhost/api/saas/tenants/self-serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${inactiveToken}` },
        body: JSON.stringify({ name: 'Inactive Store' }),
      }),
      env
    );
    expect([401, 403]).toContain(inactiveRes.status);

    // 4. Bearer-authenticated self-serve succeeds, sets HttpOnly cookie, returns owner user + token, and GET /my accepts that cookie
    const okRes = await app.fetch(
      new Request('http://localhost/api/saas/tenants/self-serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cookieToken}` },
        body: JSON.stringify({ name: 'Đà Nẵng Specialty' }),
      }),
      env
    );
    expect(okRes.status).toBe(201);
    const setCookie = okRes.headers.get('Set-Cookie') || '';
    expect(setCookie).toContain('access_token=');
    expect(setCookie).toContain('HttpOnly');
    const okJson = await okRes.json() as {
      ok: boolean;
      token: string | null;
      user: { id: string; role: string; tenantId: string } | null;
      data: { id: string; slug: string };
    };
    expect(okJson.ok).toBe(true);
    expect(okJson.data.slug).toBe('da-nang-specialty');
    expect(okJson.user?.role).toBe('owner');
    expect(okJson.user?.tenantId).toBe(okJson.data.id);

    const cookieReadMyRes = await app.fetch(
      new Request('http://localhost/api/saas/tenants/my', {
        headers: { Cookie: `access_token=${okJson.token}` },
      }),
      env
    );
    expect(cookieReadMyRes.status).toBe(200);

    // 5. Second attempt with the pre-onboarding token returns 409 already_has_tenant and preserves original tenant
    const dupRes = await app.fetch(
      new Request('http://localhost/api/saas/tenants/self-serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cookieToken}` },
        body: JSON.stringify({ name: 'Second Store' }),
      }),
      env
    );
    expect(dupRes.status).toBe(409);
    const dupJson = await dupRes.json() as { error: string; tenantId?: string };
    expect(dupJson.error).toBe('already_has_tenant');
    expect(dupJson.tenantId).toBe(okJson.data.id);
  });

  it('#201: POST /api/leads supports phone-only, email+phone merge, tenant uniqueness isolation, and rejects hq/* tenant headers', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE leads (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        email TEXT,
        phone TEXT,
        source TEXT NOT NULL DEFAULT 'promotions_newsletter',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (tenant_id, email),
        UNIQUE (tenant_id, phone)
      );
    `);
    const kv = makeKV();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/leads', leadsRouter);
    const env = { AURA_DB: makeSqliteD1(sqlite), AUTH_KV: kv } as unknown as Env;

    // 1. Phone-only submission normalizes digits and persists to KV + D1
    const phoneRes = await app.fetch(
      new Request('http://localhost/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'sadec_01' },
        body: JSON.stringify({ phone: '+84 901 234 567', source: 'promotions_newsletter' }),
      }),
      env
    );
    expect(phoneRes.status).toBe(201);
    const phoneJson = await phoneRes.json() as { success: boolean; data: { phone?: string; tenantId: string } };
    expect(phoneJson.data.phone).toBe('84901234567');
    expect(phoneJson.data.tenantId).toBe('sadec_01');
    expect(await kv.get('lead:sadec_01:phone:84901234567')).toContain('84901234567');

    // 2. Same phone under different tenant succeeds without conflict
    const otherTenantPhoneRes = await app.fetch(
      new Request('http://localhost/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'caolanh_02' },
        body: JSON.stringify({ phone: '+84 901 234 567' }),
      }),
      env
    );
    expect(otherTenantPhoneRes.status).toBe(201);

    // 3. Privileged tenant headers ('hq', '*') fall back to 'default'
    const hqHeaderRes = await app.fetch(
      new Request('http://localhost/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'hq' },
        body: JSON.stringify({ email: 'member@auracafe.vn' }),
      }),
      env
    );
    expect(hqHeaderRes.status).toBe(201);
    const hqJson = await hqHeaderRes.json() as { data: { tenantId: string } };
    expect(hqJson.data.tenantId).toBe('default');

    // 4. Re-submitting same email in same tenant with a phone merges phone onto existing row
    const mergeRes = await app.fetch(
      new Request('http://localhost/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'hq' },
        body: JSON.stringify({ email: 'member@auracafe.vn', phone: '0912345678', source: 'vip_popup' }),
      }),
      env
    );
    expect(mergeRes.status).toBe(201);
    const d1Rows = sqlite.prepare('SELECT tenant_id, email, phone, source FROM leads WHERE tenant_id = ?').all('default') as Array<{
      tenant_id: string;
      email: string | null;
      phone: string | null;
      source: string;
    }>;
    expect(d1Rows).toHaveLength(1);
    expect(d1Rows[0]).toEqual({
      tenant_id: 'default',
      email: 'member@auracafe.vn',
      phone: '0912345678',
      source: 'vip_popup',
    });
  });

  it('#198: channel-scoped PDPA consent honors zns->zalo alias, chronological global revocation override, and fail-closed tenant_id check', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const todayMmDd = new Date().toISOString().slice(5, 10);
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        date_of_birth TEXT,
        loyalty_tier TEXT,
        total_spent REAL DEFAULT 0,
        tenant_id TEXT DEFAULT 'default',
        anonymized_at TEXT
      );
      CREATE TABLE campaign_logs (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        trigger TEXT,
        channel TEXT,
        sent_at TEXT,
        status TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE consents (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        purpose TEXT,
        channel TEXT DEFAULT 'all',
        granted INTEGER,
        granted_at TEXT,
        revoked_at TEXT,
        updated_at TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      INSERT INTO customers VALUES ('c_sms_revoked', 'SMS Revoked', '0901000001', 'a@cafe.vn', '1995-${todayMmDd}', 'gold', 500000, 'default', NULL);
      INSERT INTO customers VALUES ('c_global_revoked', 'Global Revoked', '0901000002', 'b@cafe.vn', '1995-${todayMmDd}', 'gold', 500000, 'default', NULL);
      INSERT INTO customers VALUES ('c_zns_only', 'ZNS Only', '0901000003', 'c@cafe.vn', '1995-${todayMmDd}', 'gold', 500000, 'default', NULL);
      INSERT INTO customers VALUES ('c_global_regrant', 'Global Regrant', '0901000004', 'd@cafe.vn', '1995-${todayMmDd}', 'gold', 500000, 'default', NULL);

      -- c_sms_revoked: granted 'all' at t1, revoked 'sms' at t2 -> allowed for email & zalo, blocked for sms
      INSERT INTO consents VALUES ('con_a1', 'c_sms_revoked', 'marketing', 'all', 1, '2026-11-01T00:00:00Z', NULL, '2026-11-01T00:00:00Z', 'default');
      INSERT INTO consents VALUES ('con_a2', 'c_sms_revoked', 'marketing', 'sms', 0, '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z', '2026-11-02T00:00:00Z', 'default');

      -- c_global_revoked: granted 'zns' at t1, revoked 'all' at t2 -> blocked for zalo and all channels
      INSERT INTO consents VALUES ('con_b1', 'c_global_revoked', 'marketing', 'zns', 1, '2026-11-01T00:00:00Z', NULL, '2026-11-01T00:00:00Z', 'default');
      INSERT INTO consents VALUES ('con_b2', 'c_global_revoked', 'marketing', 'all', 0, '2026-11-01T00:00:00Z', '2026-11-03T00:00:00Z', '2026-11-03T00:00:00Z', 'default');

      -- c_zns_only: granted 'zns' -> allowed for zalo, blocked for sms
      INSERT INTO consents VALUES ('con_c1', 'c_zns_only', 'marketing', 'zns', 1, '2026-11-01T00:00:00Z', NULL, '2026-11-01T00:00:00Z', 'default');

      -- c_global_regrant: revoked 'zns' at t1, granted 'all' at t2 -> global re-grant restores zalo & sms
      INSERT INTO consents VALUES ('con_d1', 'c_global_regrant', 'marketing', 'zns', 0, NULL, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z', 'default');
      INSERT INTO consents VALUES ('con_d2', 'c_global_regrant', 'marketing', 'all', 1, '2026-11-04T00:00:00Z', NULL, '2026-11-04T00:00:00Z', 'default');
    `);
    const db = makeSqliteD1(sqlite) as unknown as import('@cloudflare/workers-types').D1Database;

    expect(await hasMarketingConsentForChannel(db, 'c_sms_revoked', 'sms', 'default')).toBe(false);
    expect(await hasMarketingConsentForChannel(db, 'c_sms_revoked', 'email', 'default')).toBe(true);
    expect(await hasMarketingConsentForChannel(db, 'c_sms_revoked', 'zalo', 'default')).toBe(true);
    expect(await hasMarketingConsentForChannel(db, 'c_global_revoked', 'zalo', 'default')).toBe(false);
    expect(await hasMarketingConsentForChannel(db, 'c_zns_only', 'zalo', 'default')).toBe(true);
    expect(await hasMarketingConsentForChannel(db, 'c_zns_only', 'sms', 'default')).toBe(false);
    expect(await hasMarketingConsentForChannel(db, 'c_global_regrant', 'zalo', 'default')).toBe(true);
    expect(await hasMarketingConsentForChannel(db, 'c_global_regrant', 'sms', 'default')).toBe(true);

    const smsBirthday = await detectBirthdayCandidates(db, 'default', 'sms');
    expect(smsBirthday.map((c) => c.id)).toEqual(['c_global_regrant']);

    const zaloBirthday = await detectBirthdayCandidates(db, 'default', 'zalo');
    expect(zaloBirthday.map((c) => c.id)).toEqual(['c_sms_revoked', 'c_zns_only', 'c_global_regrant']);

    const multiChannelBirthday = await detectBirthdayCandidates(db, 'default', ['sms', 'email']);
    expect(multiChannelBirthday.map((c) => c.id)).toEqual(['c_sms_revoked', 'c_global_regrant']);

    // Legacy schema without consents.tenant_id fails closed for non-default tenant
    const legacySqlite = new DatabaseSync(':memory:');
    legacySqlite.exec(`
      CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, loyalty_tier TEXT, date_of_birth TEXT, tenant_id TEXT);
      CREATE TABLE campaign_logs (id TEXT PRIMARY KEY, customer_id TEXT, trigger TEXT, channel TEXT, sent_at TEXT, status TEXT, tenant_id TEXT);
      CREATE TABLE consents (id TEXT PRIMARY KEY, customer_id TEXT, purpose TEXT, granted INTEGER, revoked_at TEXT);
      INSERT INTO customers VALUES ('c_fran', 'Fran', '0909999999', NULL, 'silver', '1995-${todayMmDd}', 'tenant_b');
      INSERT INTO consents VALUES ('con_f1', 'c_fran', 'marketing', 1, NULL);
    `);
    const legacyDb = makeSqliteD1(legacySqlite) as unknown as import('@cloudflare/workers-types').D1Database;
    expect(await detectBirthdayCandidates(legacyDb, 'tenant_b', 'sms')).toEqual([]);
  });

  it('#198: runCampaignTriggers defaults unconfigured triggers to inactive, merges tenant_campaign_configs over campaign_configs, and skips unconsented fallback channels', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const recent = new Date().toISOString();
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        loyalty_tier TEXT,
        created_at TEXT,
        tenant_id TEXT DEFAULT 'default',
        anonymized_at TEXT
      );
      CREATE TABLE campaign_logs (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        trigger TEXT,
        channel TEXT,
        sent_at TEXT,
        status TEXT,
        error TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE consents (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        purpose TEXT,
        channel TEXT DEFAULT 'all',
        granted INTEGER,
        revoked_at TEXT,
        updated_at TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE campaign_configs (
        tenant_id TEXT DEFAULT 'default',
        trigger TEXT PRIMARY KEY,
        is_active INTEGER DEFAULT 1,
        channels TEXT DEFAULT '["sms","email"]'
      );
      CREATE TABLE tenant_campaign_configs (
        tenant_id TEXT NOT NULL,
        trigger TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        channels TEXT DEFAULT '["sms","email"]',
        PRIMARY KEY (tenant_id, trigger)
      );
      INSERT INTO customers VALUES ('c_email_only', 'Email OptIn', '0908888888', 'emailonly@cafe.vn', 'silver', '${recent}', 'tenant_a', NULL);
      INSERT INTO consents VALUES ('con_e1', 'c_email_only', 'marketing', 'email', 1, NULL, '2026-11-24T00:00:00Z', 'tenant_a');
    `);
    const db = makeSqliteD1(sqlite);

    // 1. With no campaign_configs rows configured, triggers default to inactive
    const unconfiguredRes = await runCampaignTriggers({ AURA_DB: db, PILOT_TENANT_ID: 'tenant_a' });
    expect(unconfiguredRes).toEqual({ triggered: 0, sent: 0 });

    // 2. Base campaign_configs enables welcome (sms + email), while tenant_campaign_configs overrides only birthday for tenant_a.
    //    welcome remains active from base config; processTrigger skips unconsented 'sms' and attempts 'email'.
    sqlite.exec(`
      INSERT INTO campaign_configs (tenant_id, trigger, is_active, channels)
      VALUES ('default', 'welcome', 1, '["sms","email"]');
      INSERT INTO tenant_campaign_configs (tenant_id, trigger, is_active, channels)
      VALUES ('tenant_a', 'birthday', 0, '["sms"]');
    `);

    const mergedRes = await runCampaignTriggers({ AURA_DB: db, PILOT_TENANT_ID: 'tenant_a' });
    expect(mergedRes.triggered).toBe(1);
    const logRows = sqlite.prepare('SELECT customer_id, trigger, channel, tenant_id FROM campaign_logs').all() as Array<{
      customer_id: string;
      trigger: string;
      channel: string;
      tenant_id: string;
    }>;
    // Only email channel was attempted/logged because sms had no consent
    expect(logRows).toEqual([
      {
        customer_id: 'c_email_only',
        trigger: 'welcome',
        channel: 'email',
        tenant_id: 'tenant_a',
      },
    ]);
  });
});
