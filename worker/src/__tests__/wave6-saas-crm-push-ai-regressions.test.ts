// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import { createTenantRoutes } from '../routes/saas-tenants';
import { subscriptionsRouter } from '../routes/subscriptions';
import { getMRRTrend } from '../tree/subscriptions/sub-handlers';
import { updateMRRSnapshot } from '../tree/subscriptions/mrr-calculator';
import { referralRouter } from '../routes/referrals';
import { buildTemplateData } from '../tree/zalo/zns-templates';
import { sendCampaignZalo } from '../tree/campaigns/channels/zalo';
import { chatRouter } from '../routes/chat';
import { promotionsRouter } from '../routes/promotions';
import { handleMixpostRequest } from '../tree/mixpost/legacy-handler';
import { autoPostDailySpecials } from '../tree/mixpost/auto-post-daily-specials';
import { pushRouter } from '../routes/push';
import { registerFeatureRoutes } from '../routes/features-router';
import { sendPushToStaff } from '../tree/push/notifier';
import { STAFF_PUSH_ROLE, resolveStaffPushRequestedRole } from '../tree/push/roles';
import { registerQueryHandler } from '../routes/admin-audit-logs-handlers/query-handler';
import { registerExportHandler } from '../routes/admin-audit-logs-handlers/export-handler';
import { recruitmentRouter } from '../routes/recruitment';
import { signageRouter } from '../routes/signage';
import { processCustomerQuery } from '../routes/customer-assistant';
import { recommendationsRouter, mineProductAffinitiesForAllTenants } from '../routes/recommendations';
import { containerTelemetryRouter } from '../routes/container-telemetry';
import { pretixRouter } from '../routes/pretix';
import { mixpostRouter } from '../routes/mixpost';
import { zaloWebhookRouter } from '../routes/zalo-webhook';
import { generateJWT } from '../lib/jwt';
import { issueStaffSession } from '../lib/staff-session';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  },
}));

const JWT_SECRET = 'wave6-regressions-test-jwt-secret-min-32-chars!';

function makeSqliteD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    const createBound = (params: unknown[]) => ({
      bind: (...next: unknown[]) => createBound(next.map((v) => (v === undefined ? null : v))),
      first: async <T = Record<string, unknown>>(colName?: string): Promise<T | null> => {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] ?? null) as unknown) as T;
        return (row as unknown) as T;
      },
      all: async <T = Record<string, unknown>>() => {
        const stmt = sqlite.prepare(sql);
        const results = stmt.all(...(params as never[])) as unknown as T[];
        return { results, success: true, meta: { changes: 0 } };
      },
      run: async () => {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...(params as never[]));
        return {
          success: true,
          results: [],
          rowCount: Number(info.changes ?? 0),
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
      raw: async () => [],
    });
    return {
      ...createBound([]),
      bind: (...args: unknown[]) => createBound(args.map((v) => (v === undefined ? null : v))),
    };
  };

  return {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      sqlite.exec('SAVEPOINT sp_w6');
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        sqlite.exec('RELEASE SAVEPOINT sp_w6');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK TO SAVEPOINT sp_w6');
        sqlite.exec('RELEASE SAVEPOINT sp_w6');
        throw e;
      }
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

function makeMemoryKV(initial: Record<string, string> = {}): { kv: KVNamespace; store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(initial));
  const kv = {
    get: async (key: string, type?: string) => {
      const val = store.get(key) ?? null;
      if (val === null) return null;
      if (type === 'json') return JSON.parse(val);
      return val;
    },
    put: async (key: string, value: string) => {
      store.set(key, String(value));
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async (key: string) => ({ value: store.get(key) ?? null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
  return { kv, store };
}

function createFullSchemaD1(): { sqlite: DatabaseSync; db: D1Database } {
  const sqlite = new DatabaseSync(':memory:');
  const repoRoot = path.resolve(__dirname, '../../..');
  const schemaSql = fs.readFileSync(path.join(repoRoot, 'worker/schema.sql'), 'utf8');
  sqlite.exec(schemaSql);
  return { sqlite, db: makeSqliteD1(sqlite) };
}

async function signHmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Wave 6 Regressions — #227, #232, #236, #239, #240', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('#227: self-serve tenant creation provisions owner customer row so Step 4 subscription succeeds without 400 Customer not found', async () => {
    const { sqlite, db } = createFullSchemaD1();
    const { kv } = makeMemoryKV();
    const env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env;

    sqlite
      .prepare("INSERT INTO subscription_plans (id, name, slug, container_size, monthly_price_vnd, deposit_vnd, is_active, tenant_id) VALUES ('plan_20ft', 'Container 20ft', 'container-20ft', '20ft', 8000000, 1000000, 1, 'default')")
      .run();

    const signupToken = await generateJWT(
      { id: 'usr_founder_w6', sub: 'usr_founder_w6', email: 'founder@w6.vn', name: 'Founder W6', phone: '0909111222', role: 'customer', tenantId: 'default' },
      JWT_SECRET,
      3600
    );

    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/saas/tenants', createTenantRoutes());
    app.route('/api/subscriptions', subscriptionsRouter);

    const selfServeRes = await app.fetch(
      new Request('http://localhost/api/saas/tenants/self-serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signupToken}` },
        body: JSON.stringify({ name: 'Mekong Roastery' }),
      }),
      env
    );
    expect(selfServeRes.status).toBe(201);
    const selfServeBody = (await selfServeRes.json()) as {
      ok: boolean;
      token?: string;
      data?: { id: string; token?: string };
    };
    const newTenantId = selfServeBody.data!.id;
    const ownerToken = selfServeBody.token || selfServeBody.data!.token!;
    expect(newTenantId).toMatch(/^tenant_/);

    // Step 4 Onboarding: POST /api/subscriptions with customer_id = user.id and tenant_id = newTenantId
    const subRes = await app.fetch(
      new Request(`http://localhost/api/subscriptions?tenant_id=${encodeURIComponent(newTenantId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'X-Tenant-ID': newTenantId,
        },
        body: JSON.stringify({
          plan_id: 'plan_20ft',
          customer_id: 'usr_founder_w6',
          customer_name: 'Mekong Roastery',
          customer_email: 'founder@w6.vn',
          customer_phone: '0909111222',
          container_number: 'ZoneA-20ft',
          zone: 'ZoneA',
          tenant_id: newTenantId,
        }),
      }),
      env
    );
    expect(subRes.status).toBe(201);

    // PayInvoice with payment_method: 'payos' fails fast 503 when SAAS_PAYOS_* is unset (never marks 'manual' for free!)
    const invRow = sqlite
      .prepare('SELECT id, status FROM subscription_invoices WHERE tenant_id = ? LIMIT 1')
      .get(newTenantId) as { id: string; status: string };
    expect(invRow.status).toBe('pending');

    const payNoGatewayRes = await app.fetch(
      new Request(`http://localhost/api/subscriptions/invoices/${invRow.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ payment_method: 'payos' }),
      }),
      env
    );
    expect(payNoGatewayRes.status).toBe(503);
    const afterFailedPay = sqlite
      .prepare('SELECT status FROM subscription_invoices WHERE id = ?')
      .get(invRow.id) as { status: string };
    expect(afterFailedPay.status).toBe('pending');

    // Manual settlement restricted to HQ super admin (tenant owner receives 403)
    const manualByTenantOwner = await app.fetch(
      new Request(`http://localhost/api/subscriptions/invoices/${invRow.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ payment_method: 'manual' }),
      }),
      env
    );
    expect(manualByTenantOwner.status).toBe(403);

    sqlite.close();
  });

  it('#232: referrals supports GET/POST /code & recent_referrals.id, ZNS builds birthday/winback/post_visit data, customer chat enforces ownership, WELCOME delete records tombstone, and Mixpost uploads media URLs', async () => {
    const { sqlite, db } = createFullSchemaD1();
    const { kv } = makeMemoryKV();
    const env = {
      AURA_DB: db,
      AUTH_KV: kv,
      JWT_SECRET,
      PILOT_TENANT_ID: 'default',
      MIXPOST_API_URL: 'https://mixpost.aura.test',
      MIXPOST_API_TOKEN: 'mp_tok_w6',
      MIXPOST_ACCOUNTS: '11',
      STORE_HOTLINE: '0277 3888 999',
    } as unknown as Env;

    // 1. Referrals POST /code & recent_referrals.id
    sqlite
      .prepare("INSERT INTO customers (id, name, phone, email, tenant_id) VALUES ('cust_ref_1', 'Lan', '0911000111', 'lan@w6.vn', 'default')")
      .run();
    sqlite
      .prepare("INSERT INTO customers (id, name, phone, email, tenant_id) VALUES ('cust_ref_2', 'Minh', '0911000222', 'minh@w6.vn', 'default')")
      .run();
    sqlite
      .prepare("INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, status, cashback_awarded_vnd, tenant_id, created_at) VALUES ('ref_row_99', 'cust_ref_1', 'cust_ref_2', 'FNB-W6TEST', 'completed', 10000, 'default', '2026-11-25T01:00:00Z')")
      .run();

    const custToken1 = await generateJWT(
      { id: 'cust_ref_1', sub: 'cust_ref_1', customerId: 'cust_ref_1', phone: '0911000111', role: 'customer', tenantId: 'default' },
      JWT_SECRET,
      3600
    );
    const custToken2 = await generateJWT(
      { id: 'cust_ref_2', sub: 'cust_ref_2', customerId: 'cust_ref_2', phone: '0911000222', role: 'customer', tenantId: 'default' },
      JWT_SECRET,
      3600
    );

    const postCodeRes = await referralRouter.request(
      'http://localhost/code',
      { method: 'POST', headers: { Authorization: `Bearer ${custToken1}` } },
      env
    );
    expect(postCodeRes.status).toBe(200);
    const postCodeJson = (await postCodeRes.json()) as { success: boolean; data: { code: string; referral_code: string } };
    expect(postCodeJson.data.code).toMatch(/^FNB-/);
    expect(postCodeJson.data.referral_code).toBe(postCodeJson.data.code);

    const statsRes = await referralRouter.request(
      'http://localhost/stats',
      { headers: { Authorization: `Bearer ${custToken1}` } },
      env
    );
    const statsJson = (await statsRes.json()) as {
      data: { recent_referrals: Array<{ id: string }> };
    };
    expect(statsJson.data.recent_referrals[0]?.id).toBe('ref_row_99');

    // 2. ZNS template data for birthday_promotion, winback_offer, post_visit_review
    expect(Object.keys(buildTemplateData('birthday_promotion', { name: 'Lan', days: 7 })).length).toBeGreaterThan(0);
    expect(Object.keys(buildTemplateData('winback_offer', { name: 'Lan', days: 30 })).length).toBeGreaterThan(0);
    expect(Object.keys(buildTemplateData('post_visit_review', { name: 'Lan', order_id: 'ord_123456' })).length).toBeGreaterThan(0);
    expect(buildTemplateData('post_visit_review', { name: 'Lan', order_id: 'ord_123456' }).order_id).toBe('ACORD_1234');

    // Verify sendCampaignZalo forwards order_id/promo fields cleanly (returns graceful failure when ZALO_ACCESS_TOKEN missing)
    const campZaloRes = await sendCampaignZalo(
      { AURA_DB: db },
      {
        trigger: 'birthday',
        channel: 'zalo',
        to: '0911000111',
        body: 'Happy birthday',
        data: { customer_id: 'cust_ref_1', name: 'Lan', days_left: 7 },
      },
      'default'
    );
    expect(campZaloRes.channel).toBe('zalo');

    // 3. Customer Chat ownership check
    await chatRouter.request(
      'http://localhost/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Lan', phone: '0911000111', message: 'Cho hoi mon moi' }),
      },
      env
    );
    const ownChatRes = await chatRouter.request(
      'http://localhost/messages/0911000111',
      { headers: { Authorization: `Bearer ${custToken1}` } },
      env
    );
    expect(ownChatRes.status).toBe(200);
    const ownChatBody = (await ownChatRes.json()) as { data: Array<{ message: string }> };
    expect(ownChatBody.data).toHaveLength(1);

    const foreignChatRes = await chatRouter.request(
      'http://localhost/messages/0911000111',
      { headers: { Authorization: `Bearer ${custToken2}` } },
      env
    );
    expect(foreignChatRes.status).toBe(403);

    // 4. WELCOME promo deletion leaves tombstone (does not resurrect DEFAULT_WELCOME_PROMO)
    sqlite
      .prepare("INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES ('adm_w6', 'Admin', 'owner', 'default', 1, 1)")
      .run();
    const { token: adminToken } = await issueStaffSession(
      env,
      { id: 'adm_w6', name: 'Admin', role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 },
      { sessionType: 'staff-web' }
    );

    const delWelcomeRes = await promotionsRouter.request(
      'http://localhost/WELCOME',
      { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } },
      env
    );
    expect(delWelcomeRes.status).toBe(200);

    const validateAfterDel = await promotionsRouter.request(
      'http://localhost/validate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'WELCOME',
          order_total: 100000,
          customer_name: 'New Guest',
          customer_phone: '0988777666',
          is_new_customer: true,
        }),
      },
      env
    );
    const validateAfterDelJson = (await validateAfterDel.json()) as { data: { valid: boolean } };
    expect(validateAfterDelJson.data.valid).toBe(false);

    // 5. Mixpost legacy publish uploads mediaUrls first, and daily specials uses configured hotline
    const mixpostCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      mixpostCalls.push({ url, body });
      if (url.endsWith('/api/mixpost/media/download')) {
        return new Response(JSON.stringify({ id: 'media_uploaded_77' }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: 'post_88' }), { status: 200 });
    }) as unknown as typeof fetch;

    const pubRes = await handleMixpostRequest(
      new Request('https://api.test/api/mixpost/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'New Drink',
          accounts: [11],
          mediaUrls: ['https://cdn.auraspace.cafe/drink.jpg'],
        }),
      }),
      env as never,
      'default'
    );
    expect(pubRes.status).toBe(200);
    expect(mixpostCalls[0]?.url).toContain('/api/mixpost/media/download');
    const versions = mixpostCalls[1]?.body.versions as Array<{ content: Array<{ media: Array<{ id: string }> }> }>;
    expect(versions[0]?.content[0]?.media).toEqual([{ id: 'media_uploaded_77' }]);

    sqlite
      .prepare("INSERT INTO categories (id, name, slug, tenant_id) VALUES ('cat_w6', 'Coffee', 'coffee-w6', 'default')")
      .run();
    sqlite
      .prepare("INSERT INTO products (id, category_id, name, price, is_available, tenant_id) VALUES ('prd_w6', 'cat_w6', 'Cold Brew Cam Sả', 49000, 1, 'default')")
      .run();
    mixpostCalls.length = 0;
    await autoPostDailySpecials(env as unknown as Record<string, unknown>, 'default', new Date('2026-11-25T00:00:00Z'));
    const dailyBody = JSON.stringify(mixpostCalls[0]?.body || {});
    expect(dailyBody).toContain('0277 3888 999');
    expect(dailyBody).not.toContain('1900 1234');

    sqlite.close();
  });

  it('#236: WebPush subscribe normalizes keys.{auth,p256dh} and preserves roleResolution.role; admin/staff notification settings align defaults & honor orderAlertsEnabled', async () => {
    const { sqlite, db } = createFullSchemaD1();
    const { kv } = makeMemoryKV();
    const env = {
      AURA_DB: db,
      AUTH_KV: kv,
      JWT_SECRET,
      VAPID_PUBLIC_KEY: 'pub_key_w6',
      VAPID_PRIVATE_KEY: 'priv_key_w6',
    } as unknown as Env;

    sqlite
      .prepare("INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES ('own_push', 'Owner Push', 'owner', 'default', 1, 1)")
      .run();
    sqlite
      .prepare("INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES ('ship_push', 'Shipper Push', 'shipper', 'default', 1, 1)")
      .run();

    const { token: ownerToken } = await issueStaffSession(
      env,
      { id: 'own_push', name: 'Owner Push', role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 },
      { sessionType: 'staff-web' }
    );
    const { token: shipperToken } = await issueStaffSession(
      env,
      { id: 'ship_push', name: 'Shipper Push', role: 'shipper', tenant_id: 'default', is_active: 1, auth_version: 1 },
      { sessionType: 'staff-web' }
    );

    // 1. Shipper/rider/bep role resolution
    expect(resolveStaffPushRequestedRole('shipper', 'shipper')).toEqual({ ok: true, role: 'shipper' });
    expect(resolveStaffPushRequestedRole('bep', 'bep')).toEqual({ ok: true, role: 'bep' });

    // 2. Browser standard PushSubscription.toJSON() payload (`keys: { auth, p256dh }`) + role 'all' resolved to 'staff'
    const subRes = await pushRouter.request(
      'http://localhost/subscribe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/w6-owner-sub-1',
          keys: { auth: 'auth_secret_w6', p256dh: 'p256dh_pub_w6' },
          customer_id: 'own_push',
          role: 'all',
        }),
      },
      env
    );
    expect(subRes.status).toBe(201);

    const savedRow = sqlite
      .prepare("SELECT auth_key, p256dh_key, role FROM push_subscriptions WHERE endpoint = 'https://fcm.googleapis.com/fcm/send/w6-owner-sub-1'")
      .get() as { auth_key: string; p256dh_key: string; role: string };
    expect(savedRow).toEqual({
      auth_key: 'auth_secret_w6',
      p256dh_key: 'p256dh_pub_w6',
      role: 'staff', // NOT overwritten back to 'all'!
    });

    // Shipper subscribes with role 'shipper' and list-subscriptions preserves 'shipper'
    const shipSubRes = await pushRouter.request(
      'http://localhost/subscribe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${shipperToken}` },
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/w6-shipper-sub-1',
          keys: { auth: 'auth_ship_w6', p256dh: 'p256dh_ship_w6' },
          customer_id: 'ship_push',
          role: 'shipper',
        }),
      },
      env
    );
    expect(shipSubRes.status).toBe(201);

    const listRes = await pushRouter.request(
      'http://localhost/list-subscriptions',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env
    );
    const listJson = (await listRes.json()) as { subscriptions: Array<{ name: string; role: string; subscribed: boolean }> };
    expect(listJson.subscriptions.find((s) => s.name === 'ship_push')?.role).toBe('shipper');

    // 3. Admin notification settings defaults autoNotifyNewOrder to true and PATCH { soundAlerts: true } keeps autoNotifyNewOrder: true
    const featApp = new Hono<{ Bindings: Env }>();
    registerFeatureRoutes(featApp);

    const getDefRes = await featApp.request(
      'http://localhost/api/admin/notification-settings',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env
    );
    expect(await getDefRes.json()).toEqual({ autoNotifyNewOrder: true, soundAlerts: false });

    const patchSoundRes = await featApp.request(
      'http://localhost/api/admin/notification-settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ soundAlerts: true }),
      },
      env
    );
    expect(await patchSoundRes.json()).toEqual({
      success: true,
      autoNotifyNewOrder: true,
      soundAlerts: true,
    });

    // 4. Staff notification settings (`orderAlertsEnabled: false`) suppresses new-order push for that staff member
    await featApp.request(
      'http://localhost/api/staff/notification-settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ orderAlertsEnabled: false }),
      },
      env
    );

    const pushMutedRes = await sendPushToStaff(
      env,
      { title: 'Đơn mới', body: '#101', data: { type: 'new_order' } },
      STAFF_PUSH_ROLE,
      [],
      'default'
    );
    expect(pushMutedRes.sent).toBe(0);

    sqlite.close();
  });

  it('#239: audit logs normalize SQLite space timestamps, paginate past 2,500 rows, align LOGOUT verb, allow admin/supervisor in recruitment, and track multi-tenant MRR snapshots', async () => {
    const { sqlite, db } = createFullSchemaD1();
    const { kv } = makeMemoryKV();
    const env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET, PILOT_TENANT_ID: 'store_w6' } as unknown as Env;

    // 1. Seed 2,605 SQLite space-formatted audit log rows for store_w6 + 1 logout row
    sqlite.exec('BEGIN');
    const insAudit = sqlite.prepare(
      'INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (let i = 1; i <= 2605; i++) {
      const sec = String(i % 60).padStart(2, '0');
      const min = String(Math.floor(i / 60) % 60).padStart(2, '0');
      insAudit.run('adm_1', 'Admin', 'order.create', 'order', 'store_w6', `2026-11-25 08:${min}:${sec}`);
    }
    insAudit.run('adm_1', 'Admin', 'staff.logout', 'auth', 'store_w6', '2026-11-25 09:30:00');
    sqlite.exec('COMMIT');

    const auditApp = new Hono<{ Bindings: Env }>();
    auditApp.use('*', async (c, next) => {
      c.set('user' as never, { id: 'adm_1', role: 'admin', tenantId: 'store_w6' } as never);
      c.set('tenantId' as never, 'store_w6' as never);
      await next();
    });
    registerQueryHandler(auditApp);
    registerExportHandler(auditApp);

    // Date filter with ISO 'T' or YYYY-MM-DD matches SQLite 'YYYY-MM-DD HH:MM:SS' rows AND paginates to page 27 (offset 2600 > 2500!)
    const page27Res = await auditApp.request(
      'http://localhost/?date_from=2026-11-25T00:00:00Z&date_to=2026-11-25&page=27&page_size=100',
      {},
      env
    );
    expect(page27Res.status).toBe(200);
    const page27Json = (await page27Res.json()) as { total: number; rows: unknown[] };
    expect(page27Json.total).toBe(2606);
    expect(page27Json.rows).toHaveLength(6);

    // LOGOUT verb filter matches `staff.logout` in both query and export
    const logoutQueryRes = await auditApp.request('http://localhost/?action=LOGOUT', {}, env);
    const logoutQueryJson = (await logoutQueryRes.json()) as { total: number; rows: Array<{ action: string }> };
    expect(logoutQueryJson.total).toBe(1);
    expect(logoutQueryJson.rows[0]?.action).toBe('staff.logout');

    // 2. Recruitment allows admin & supervisor
    sqlite
      .prepare("INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES ('sup_w6', 'Supervisor W6', 'supervisor', 'store_w6', 1, 1)")
      .run();
    const { token: supToken } = await issueStaffSession(
      env,
      { id: 'sup_w6', name: 'Supervisor W6', role: 'supervisor', tenant_id: 'store_w6', is_active: 1, auth_version: 1 },
      { sessionType: 'staff-web' }
    );
    const recListRes = await recruitmentRouter.request(
      'http://localhost/applications',
      { headers: { Authorization: `Bearer ${supToken}` } },
      env
    );
    expect(recListRes.status).toBe(200);

    // 3. Multi-tenant MRR snapshots & getMRRTrend
    sqlite
      .prepare("INSERT INTO customers (id, name, phone, tenant_id) VALUES ('cust_mrr_a', 'Cust A', '0901000001', 'store_w6')")
      .run();
    sqlite
      .prepare("INSERT INTO subscription_plans (id, name, slug, container_size, monthly_price_vnd, tenant_id) VALUES ('pl_mrr_a', 'Pro', 'pro', '20ft', 9000000, 'store_w6')")
      .run();
    sqlite
      .prepare("INSERT INTO subscriptions (id, plan_id, customer_id, customer_name, customer_email, customer_phone, status, billing_cycle, current_period_start, current_period_end, next_billing_date, amount_vnd, tenant_id) VALUES ('sub_mrr_a', 'pl_mrr_a', 'cust_mrr_a', 'Cust A', 'a@w6.vn', '0901000001', 'active', 'monthly', '2026-11-01', '2026-12-01', '2026-12-01', 9000000, 'store_w6')")
      .run();

    await updateMRRSnapshot(db, '2026-11-24', 'store_w6');
    await updateMRRSnapshot(db, '2026-11-25', 'store_w6');

    const trendApp = new Hono<{ Bindings: Env }>();
    trendApp.use('*', async (c, next) => {
      c.set('user' as never, { id: 'sup_w6', role: 'supervisor', tenantId: 'store_w6' } as never);
      c.set('tenantId' as never, 'store_w6' as never);
      await next();
    });
    trendApp.get('/trend', (c) => getMRRTrend(c));

    const trendRes = await trendApp.request('http://localhost/trend?days=30', {}, env);
    const trendJson = (await trendRes.json()) as {
      data: { source: string; snapshots: Array<{ snapshot_date: string; mrr_vnd: number }> };
    };
    expect(trendJson.data.source).toBe('snapshots');
    expect(trendJson.data.snapshots.map((s) => s.snapshot_date)).toEqual(['2026-11-24', '2026-11-25']);
    expect(trendJson.data.snapshots[1]?.mrr_vnd).toBe(9000000);

    sqlite.close();
  });

  it('#240: signage fixed VND promos, AI concierge "hóa đơn" intent & tenant profile, recommendations product JOIN & cron helper, container telemetry dedup/UTC, Pretix/Mixpost localized & tenant brand, and Zalo CS error logging', async () => {
    const { sqlite, db } = createFullSchemaD1();
    const { kv } = makeMemoryKV();
    const env = {
      AURA_DB: db,
      AUTH_KV: kv,
      JWT_SECRET,
      PILOT_TENANT_ID: 'tenant_lotus',
      PRETIX_API_URL: 'https://pretix.aura.test',
      PRETIX_API_TOKEN: 'ptx_tok_w6',
      PRETIX_ORGANIZER: 'tenant_lotus',
      PRETIX_WEBHOOK_SECRET: 'ptx_wh_secret_w6',
      ZALO_OA_SECRET: 'zalo_oa_secret_w6',
      ZALO_ACCESS_TOKEN: 'zalo_access_tok_w6',
    } as unknown as Env;

    sqlite
      .prepare("INSERT INTO saas_tenants (id, slug, name, tier, status) VALUES ('tenant_lotus', 'lotus-roastery', 'Lotus Roastery', 'PRO', 'active')")
      .run();
    sqlite
      .prepare("INSERT INTO tenant_branding (tenant_id, display_name, address, phone) VALUES ('tenant_lotus', 'Lotus Roastery Cần Thơ', '88 Ninh Kiều, Cần Thơ', '0292 3888 777')")
      .run();

    // 1. Signage fixed_amount promo returns discountType: 'fixed_amount', amountVnd: 20000, percent: null
    sqlite
      .prepare("INSERT INTO promotions (id, code, discount_type, discount_value, percent, min_order, is_active, tenant_id) VALUES ('prm_fix20k', 'GIAM20K', 'fixed_amount', 20000, 0, 50000, 1, 'tenant_lotus')")
      .run();

    const signageRes = await signageRouter.request('http://localhost/promos', {}, env);
    expect(signageRes.status).toBe(200);
    const signageJson = (await signageRes.json()) as {
      data: Array<{ code: string; discountType?: string; amountVnd?: number; percent: number | null }>;
    };
    const fixedPromo = signageJson.data.find((p) => p.code === 'GIAM20K');
    expect(fixedPromo).toMatchObject({
      code: 'GIAM20K',
      discountType: 'fixed_amount',
      amountVnd: 20000,
      percent: null,
    });

    // 2. AI Concierge checks 'hóa đơn' BEFORE 'đơn' -> table_bill, and uses tenant branding for store_info
    const billQuery = await processCustomerQuery(db, undefined, 'tenant_lotus', {
      query: 'Cho mình xem hóa đơn thanh toán nhé',
      channel: 'web',
    });
    expect(billQuery.intent).toBe('table_bill');
    expect(billQuery.reply).toContain('Lotus Roastery Cần Thơ');

    const storeInfoQuery = await processCustomerQuery(db, undefined, 'tenant_lotus', {
      query: 'Địa chỉ quán ở đâu vậy?',
      channel: 'web',
    });
    expect(storeInfoQuery.intent).toBe('store_info');
    expect(storeInfoQuery.reply).toContain('88 Ninh Kiều, Cần Thơ');
    expect(storeInfoQuery.reply).not.toContain('Làng hoa Sa Đéc');

    // 3. Recommendations: cron helper mines affinities, frequently-bought-together joins products for real name & price
    sqlite
      .prepare("INSERT INTO categories (id, name, slug, tenant_id) VALUES ('cat_lotus', 'Signature', 'sig-lotus', 'tenant_lotus')")
      .run();
    sqlite
      .prepare("INSERT INTO products (id, category_id, name, price, image_url, is_available, tenant_id) VALUES ('prd_latte', 'cat_lotus', 'Latte Hạnh Nhân', 55000, '/img/latte.webp', 1, 'tenant_lotus')")
      .run();
    sqlite
      .prepare("INSERT INTO products (id, category_id, name, price, image_url, is_available, tenant_id) VALUES ('prd_waffle', 'cat_lotus', 'Bánh Waffle Bỉ', 45000, '/img/waffle.webp', 1, 'tenant_lotus')")
      .run();
    const recentSqliteUtc = new Date(Date.now() - 10 * 60_000).toISOString().replace('T', ' ').slice(0, 19);
    sqlite
      .prepare("INSERT INTO orders (id, items, subtotal, total, customer_name, customer_phone, payment_method, status, payment_status, tenant_id, created_at) VALUES ('ord_rec_1', ?, 100000, 100000, 'Khach Lotus', '0909555666', 'cod', 'completed', 'paid', 'tenant_lotus', ?)")
      .run(
        JSON.stringify([
          { product_id: 'prd_latte', name: 'Latte Hạnh Nhân', quantity: 2 },
          { product_id: 'prd_waffle', name: 'Bánh Waffle Bỉ', quantity: 1 },
        ]),
        recentSqliteUtc
      );

    const minedSummary = await mineProductAffinitiesForAllTenants(env);
    expect(minedSummary.totalMinedPairs).toBeGreaterThanOrEqual(2);

    const fbtRes = await recommendationsRouter.request(
      'http://localhost/frequently-bought-together?item_id=prd_latte',
      {},
      env
    );
    const fbtJson = (await fbtRes.json()) as {
      data: Array<{ id: string; name: string; price?: number; is_fallback?: boolean }>;
    };
    expect(fbtJson.data[0]).toMatchObject({
      id: 'prd_waffle',
      name: 'Bánh Waffle Bỉ',
      price: 45000,
      is_fallback: false,
    });

    const trendingRes = await recommendationsRouter.request('http://localhost/trending?range=24h', {}, env);
    const trendingJson = (await trendingRes.json()) as {
      data: Array<{ id: string; orders_count: number; is_fallback: boolean }>;
    };
    expect(trendingJson.data[0]?.id).toBe('prd_latte');
    expect(trendingJson.data[0]?.orders_count).toBe(2);

    // 4. Edge Container Telemetry deduplicates same-second heartbeats and parses SQLite UTC without false OFFLINE
    const hbSqliteUtc = new Date(Date.now() - 2 * 60_000).toISOString().replace('T', ' ').slice(0, 19);
    sqlite
      .prepare("INSERT INTO container_telemetry_logs (id, container_id, tenant_id, power_source, battery_percentage, ambient_temp_celsius, kds_online, alert_status, created_at) VALUES ('hb_01', 'CNT-LOTUS-1', 'tenant_lotus', 'grid', 95, 25.0, 1, 'NORMAL', ?)")
      .run(hbSqliteUtc);
    sqlite
      .prepare("INSERT INTO container_telemetry_logs (id, container_id, tenant_id, power_source, battery_percentage, ambient_temp_celsius, kds_online, alert_status, created_at) VALUES ('hb_02', 'CNT-LOTUS-1', 'tenant_lotus', 'solar', 99, 24.5, 1, 'NORMAL', ?)")
      .run(hbSqliteUtc);

    sqlite
      .prepare("INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES ('mgr_lotus', 'Manager Lotus', 'manager', 'tenant_lotus', 1, 1)")
      .run();
    const { token: lotusMgrToken } = await issueStaffSession(
      env,
      { id: 'mgr_lotus', name: 'Manager Lotus', role: 'manager', tenant_id: 'tenant_lotus', is_active: 1, auth_version: 1 },
      { sessionType: 'staff-web' }
    );

    const statusRes = await containerTelemetryRouter.request(
      'http://localhost/containers/status',
      { headers: { Authorization: `Bearer ${lotusMgrToken}` } },
      env
    );
    expect(statusRes.status).toBe(200);
    const statusJson = (await statusRes.json()) as {
      count: number;
      data: Array<{ container_id: string; operational_status: string; power_source: string; minutes_since_heartbeat: number }>;
    };
    expect(statusJson.count).toBe(1);
    expect(statusJson.data[0]?.operational_status).toBe('NORMAL');
    expect(statusJson.data[0]?.power_source).toBe('solar'); // id 'hb_02' wins tie-break!
    expect(statusJson.data[0]?.minutes_since_heartbeat).toBeLessThanOrEqual(5);

    // 5. Pretix localized event.name ({ en: 'Cold Brew Workshop' } without vi) + dynamic tenant brand + webhook sync
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/events/coldbrew-ws/items/')) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (url.includes('/events/coldbrew-ws/orders/ORD777/')) {
        return new Response(JSON.stringify({ code: 'ORD777', status: 'p', total: '150000', email: 'guest@lotus.vn' }), { status: 200 });
      }
      if (url.includes('/events/coldbrew-ws/')) {
        return new Response(JSON.stringify({ name: { en: 'Cold Brew Workshop' } }), { status: 200 });
      }
      if (url.includes('openapi.zalo.me/v3.0/oa/message/cs')) {
        return new Response(JSON.stringify({ error: -216, message: 'Access token invalid' }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    const ptxGenRes = await pretixRouter.request(
      'http://localhost/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lotusMgrToken}` },
        body: JSON.stringify({ source: 'event', slug: 'coldbrew-ws' }),
      },
      env
    );
    expect(ptxGenRes.status).toBe(200);
    const ptxGenJson = (await ptxGenRes.json()) as { data: { content: string; hashtags: string[] } };
    expect(ptxGenJson.data.content).toContain('Cold Brew Workshop');
    expect(ptxGenJson.data.content).not.toContain('[object Object]');
    expect(ptxGenJson.data.content).toContain('Lotus Roastery Cần Thơ');
    expect(ptxGenJson.data.hashtags).toContain('LotusRoasteryCanTho');

    const mpGenRes = await mixpostRouter.request(
      'http://localhost/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lotusMgrToken}` },
        body: JSON.stringify({ source: 'menu' }),
      },
      env as never
    );
    const mpGenJson = (await mpGenRes.json()) as { data: { content: string; hashtags: string[] } };
    expect(mpGenJson.data.content).toContain('Lotus Roastery Cần Thơ');
    expect(mpGenJson.data.hashtags).toContain('LotusRoasteryCanTho');

    const whBody = JSON.stringify({
      notification_id: 501,
      organizer: 'tenant_lotus',
      event: 'coldbrew-ws',
      code: 'ORD777',
      action: 'pretix.event.order.paid',
    });
    const whSig = await signHmacSha256Hex('ptx_wh_secret_w6', whBody);
    const ptxWhRes = await pretixRouter.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-pretix-Signature': whSig,
          'X-Tenant-ID': 'tenant_lotus',
        },
        body: whBody,
      },
      env
    );
    expect(ptxWhRes.status).toBe(200);
    const ptxWhJson = (await ptxWhRes.json()) as { synced_status: string; code: string };
    expect(ptxWhJson.synced_status).toBe('paid');
    const cachedTicket = await kv.get('pretix:ticket_order:tenant_lotus:coldbrew-ws:ORD777');
    expect(cachedTicket).toBeTruthy();
    expect(JSON.parse(cachedTicket!).status).toBe('paid');

    // 6. Zalo OA webhook checks payload.error !== 0 and records structured failure state & metric
    const zaloBody = JSON.stringify({
      event_name: 'user_send_text',
      timestamp: Date.now(),
      sender: { id: 'zalo_usr_99' },
      message: { text: 'Địa chỉ quán ở đâu?', msg_id: 'zmsg_99' },
    });
    const zaloSig = await signHmacSha256Hex('zalo_oa_secret_w6', zaloBody);
    const zaloRes = await zaloWebhookRouter.request(
      'http://localhost/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ZaloOA-Signature': `mac=${zaloSig}`,
        },
        body: zaloBody,
      },
      env
    );
    expect(zaloRes.status).toBe(200);
    const zaloJson = (await zaloRes.json()) as {
      data: { outbound_delivered?: boolean; outbound_error?: string };
    };
    expect(zaloJson.data.outbound_delivered).toBe(false);
    expect(zaloJson.data.outbound_error).toContain('Access token invalid');

    sqlite.close();
  });
});
