import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { broadcastRouter } from '../../routes/broadcast';
import { handleMixpostRequest, mixpostRouter } from '../../routes/mixpost';
import { createMockEnv } from '../test-utils';

const MOCK_ADMIN = {
  id: 'usr_mgr_1',
  role: 'manager',
  tenantId: 'tenant_a',
};

const MOCK_STAFF = {
  id: 'usr_staff_1',
  role: 'staff',
  tenantId: 'tenant_a',
};

function mountBroadcastApp(user?: { id: string; role: string; tenantId: string }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) {
      c.set('user' as never, user as never);
      c.set('tenantId' as never, user.tenantId as never);
    }
    await next();
  });
  app.route('/api/broadcast', broadcastRouter);
  return app;
}

function mountMixpostApp(user?: { id: string; role: string; tenantId: string }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) {
      c.set('user' as never, user as never);
      c.set('tenantId' as never, user.tenantId as never);
    }
    await next();
  });
  app.route('/api/mixpost', mixpostRouter);
  return app;
}

function createBroadcastDb(opts: {
  customers?: Array<Record<string, unknown>>;
  consents?: Array<Record<string, unknown>>;
  consentError?: Error;
  settings?: Array<Record<string, unknown>>;
  promotions?: Array<Record<string, unknown>>;
  mixpostPosts?: Array<Record<string, unknown>>;
}) {
  const insertRuns: Array<{ sql: string; args: unknown[] }> = [];
  return {
    insertRuns,
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        all: async () => {
          if (sql.includes('FROM customers')) {
            return { results: opts.customers ?? [] };
          }
          if (sql.includes('FROM consents')) {
            if (opts.consentError) throw opts.consentError;
            return { results: opts.consents ?? [] };
          }
          if (sql.includes('FROM tenant_settings') || sql.includes('FROM settings')) {
            return { results: opts.settings ?? [] };
          }
          if (sql.includes('FROM promotions')) {
            return { results: opts.promotions ?? [] };
          }
          if (sql.includes('FROM mixpost_posts')) {
            return { results: opts.mixpostPosts ?? [] };
          }
          return { results: [] };
        },
        first: async () => null,
        run: async () => {
          insertRuns.push({ sql, args });
          return { success: true, meta: { changes: 1 } };
        },
      }),
    }),
  };
}

describe('Promotion notifications via Zalo ZNS', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fails closed with 400 when ZALO_ACCESS_TOKEN is set without ZALO_ZNS_TEMPLATE_GENERAL_PROMOTION', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const db = createBroadcastDb({
      customers: [{ id: 'c1', name: 'An', phone: '0901234567', email: null, tenant_id: 'tenant_a' }],
      consents: [{ customer_id: 'c1', channel: 'zns', granted: 1, revoked_at: null }],
    });
    const env = {
      ...createMockEnv(),
      AURA_DB: db,
      ZALO_ACCESS_TOKEN: 'zalo-token-secret',
      ZALO_ZNS_TEMPLATE_GENERAL_PROMOTION: '',
    };

    const app = mountBroadcastApp(MOCK_ADMIN);
    const res = await app.fetch(
      new Request('https://test.aura/api/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: 'all',
          channel: 'zns',
          title: 'Ưu đãi SUMMER20',
          message: 'Giảm 20% cho thành viên',
          promo_code: 'SUMMER20',
        }),
      }),
      env as any
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { success: boolean; error: string; skipReasons?: Record<string, string> };
    expect(json.success).toBe(false);
    expect(json.error).toContain('ZALO_ZNS_TEMPLATE_GENERAL_PROMOTION');
    expect(json.skipReasons?.zns).toContain('not configured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends ZNS promotion template data only to consented same-tenant customers', async () => {
    const znsBodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.body) {
        znsBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      }
      return new Response(JSON.stringify({ error: 0, message: 'Success', data: { msg_id: 'zns_ok_1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const db = createBroadcastDb({
      customers: [
        { id: 'c_granted', name: 'Nguyen An', phone: '0901111111', email: null, tenant_id: 'tenant_a' },
        { id: 'c_revoked', name: 'Tran Binh', phone: '0902222222', email: null, tenant_id: 'tenant_a' },
        { id: 'c_missing', name: 'Le Chi', phone: '0903333333', email: null, tenant_id: 'tenant_a' },
        { id: 'c_other', name: 'Other Store', phone: '0904444444', email: null, tenant_id: 'tenant_b' },
      ],
      consents: [
        { customer_id: 'c_granted', channel: 'zns', granted: 1, revoked_at: null },
        { customer_id: 'c_revoked', channel: 'zns', granted: 1, revoked_at: '2026-01-01T00:00:00Z' },
        { customer_id: 'c_other', channel: 'zns', granted: 1, revoked_at: null },
      ],
    });
    const env = {
      ...createMockEnv(),
      AURA_DB: db,
      ZALO_ACCESS_TOKEN: 'zalo-token-secret',
      ZALO_ZNS_TEMPLATE_GENERAL_PROMOTION: '412345',
    };

    const app = mountBroadcastApp(MOCK_ADMIN);
    const res = await app.fetch(
      new Request('https://test.aura/api/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: 'all',
          channel: 'zns',
          title: 'Ưu đãi SUMMER20',
          message: 'Nhập mã SUMMER20 giảm 20%',
          promo_code: 'SUMMER20',
          discount: '20%',
          expires_at: '31/08/2026',
        }),
      }),
      env as any
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; sent_count: number; total: number };
    expect(json.success).toBe(true);
    expect(json.total).toBe(1);
    expect(json.sent_count).toBe(1);

    expect(znsBodies).toHaveLength(1);
    expect(znsBodies[0].phone).toBe('84901111111');
    expect(znsBodies[0].template_id).toBe('412345');
    expect(znsBodies[0].template_data).toEqual({
      customer_name: 'Nguyen An',
      title: 'Ưu đãi SUMMER20',
      message: 'Nhập mã SUMMER20 giảm 20%',
      promo_code: 'SUMMER20',
      discount: '20%',
      expires_at: '31/08/2026',
    });
  });

  it('fails closed with 503 when marketing consent verification throws DB error', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const db = createBroadcastDb({
      customers: [{ id: 'c1', name: 'An', phone: '0901111111', email: null, tenant_id: 'tenant_a' }],
      consentError: new Error('D1 connection reset'),
    });
    const env = {
      ...createMockEnv(),
      AURA_DB: db,
      ZALO_ACCESS_TOKEN: 'zalo-token-secret',
      ZALO_ZNS_TEMPLATE_GENERAL_PROMOTION: '412345',
    };

    const app = mountBroadcastApp(MOCK_ADMIN);
    const res = await app.fetch(
      new Request('https://test.aura/api/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: 'all', channel: 'zns', message: 'Promo test' }),
      }),
      env as any
    );

    expect(res.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('denies staff role and cross-tenant broadcast overrides with 403', async () => {
    const db = createBroadcastDb({});
    const env = { ...createMockEnv(), AURA_DB: db };

    const staffRes = await mountBroadcastApp(MOCK_STAFF).fetch(
      new Request('https://test.aura/api/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: 'all', channel: 'zns', message: 'Hi' }),
      }),
      env as any
    );
    expect(staffRes.status).toBe(403);

    const crossTenantRes = await mountBroadcastApp(MOCK_ADMIN).fetch(
      new Request('https://test.aura/api/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_b' },
        body: JSON.stringify({ segment: 'all', channel: 'zns', message: 'Hi' }),
      }),
      env as any
    );
    expect(crossTenantRes.status).toBe(403);
  });

  it('normalizes zalo consent channel to zns and lets a newer global opt-out clear earlier channel-specific opt-in', async () => {
    const znsBodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.body) {
        znsBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      }
      return new Response(JSON.stringify({ error: 0, message: 'Success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const db = createBroadcastDb({
      customers: [
        { id: 'c_zalo_alias', name: 'Zalo Alias', phone: '0905555555', email: null, tenant_id: 'tenant_a' },
        { id: 'c_global_optout', name: 'Global OptOut', phone: '0906666666', email: null, tenant_id: 'tenant_a' },
      ],
      consents: [
        { customer_id: 'c_zalo_alias', channel: 'zalo', granted: 1, revoked_at: null },
        { customer_id: 'c_global_optout', channel: 'zns', granted: 1, revoked_at: null },
        { customer_id: 'c_global_optout', channel: null, granted: 0, revoked_at: '2026-05-01T00:00:00Z' },
      ],
    });
    const env = {
      ...createMockEnv(),
      AURA_DB: db,
      ZALO_ACCESS_TOKEN: 'zalo-token-secret',
      ZALO_ZNS_TEMPLATE_GENERAL_PROMOTION: '412345',
    };

    const res = await mountBroadcastApp(MOCK_ADMIN).fetch(
      new Request('https://test.aura/api/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: 'all',
          channel: 'zns',
          title: 'Ưu đãi',
          message: 'Khuyến mãi',
        }),
      }),
      env as any
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; sent_count: number; total: number; queued: number; truncated: boolean };
    expect(json.success).toBe(true);
    expect(json.total).toBe(1);
    expect(json.sent_count).toBe(1);
    expect(json.queued).toBe(1);
    expect(json.truncated).toBe(false);
    expect(znsBodies).toHaveLength(1);
    expect(znsBodies[0].phone).toBe('84905555555');
  });

  it('caps broadcast deliveries at 200 per request and reports queued and truncated metadata', async () => {
    let fetchCount = 0;
    globalThis.fetch = vi.fn(async () => {
      fetchCount++;
      return new Response(JSON.stringify({ error: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const customers = Array.from({ length: 225 }, (_, idx) => ({
      id: `c_${idx + 1}`,
      name: `Guest ${idx + 1}`,
      phone: `090${String(1000000 + idx)}`,
      email: null,
      tenant_id: 'tenant_a',
    }));
    const consents = customers.map((cust) => ({
      customer_id: cust.id,
      channel: 'zns',
      granted: 1,
      revoked_at: null,
    }));

    const db = createBroadcastDb({ customers, consents });
    const env = {
      ...createMockEnv(),
      AURA_DB: db,
      ZALO_ACCESS_TOKEN: 'zalo-token-secret',
      ZALO_ZNS_TEMPLATE_GENERAL_PROMOTION: '412345',
    };

    const res = await mountBroadcastApp(MOCK_ADMIN).fetch(
      new Request('https://test.aura/api/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: 'all',
          channel: 'zns',
          title: 'Ưu đãi lớn',
          message: 'Giảm giá cuối tuần',
        }),
      }),
      env as any
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      sent_count: number;
      total: number;
      queued: number;
      truncated: boolean;
    };
    expect(json.success).toBe(true);
    expect(json.total).toBe(225);
    expect(json.queued).toBe(200);
    expect(json.sent_count).toBe(200);
    expect(json.truncated).toBe(true);
    expect(fetchCount).toBe(200);
  });
});

describe('Promotion publishing via Mixpost Facebook Page', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('GET /accounts returns 503 when Mixpost is not configured and filters by provider=facebook when configured', async () => {
    const app = mountMixpostApp(MOCK_ADMIN);
    const unconfiguredRes = await app.fetch(
      new Request('https://test.aura/api/mixpost/accounts?provider=facebook'),
      { ...createMockEnv(), MIXPOST_API_URL: '', MIXPOST_API_TOKEN: '' } as any
    );
    expect(unconfiguredRes.status).toBe(503);

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: 11, name: 'AURA Cafe Sa Dec', provider: 'facebook_page' },
            { id: 12, name: 'AURA IG', provider: 'instagram' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const fbRes = await app.fetch(
      new Request('https://test.aura/api/mixpost/accounts?provider=facebook'),
      {
        ...createMockEnv(),
        MIXPOST_API_URL: 'https://mixpost.example.com',
        MIXPOST_API_TOKEN: 'secret-mixpost-token',
        MIXPOST_TENANT_ACCOUNTS_JSON: JSON.stringify({ tenant_a: [11, 12] }),
      } as any
    );
    expect(fbRes.status).toBe(200);
    const json = (await fbRes.json()) as { success: boolean; data: Array<{ id: number; provider: string }> };
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe(11);
  });

  it('enforces tenant social account ownership on GET /accounts and POST /posts across tenants', async () => {
    const db = createBroadcastDb({});
    const env = {
      ...createMockEnv(),
      AURA_DB: db,
      MIXPOST_API_URL: 'https://mixpost.example.com',
      MIXPOST_API_TOKEN: 'secret-mixpost-token',
      MIXPOST_TENANT_ACCOUNTS_JSON: JSON.stringify({ tenant_a: [11] }),
    };

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: 11, name: 'AURA Tenant A FB', provider: 'facebook_page' },
            { id: 22, name: 'AURA Tenant B FB', provider: 'facebook_page' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    // tenant_a only sees account 11
    const tenantAAccounts = await mountMixpostApp(MOCK_ADMIN).fetch(
      new Request('https://test.aura/api/mixpost/accounts'),
      env as any
    );
    expect(tenantAAccounts.status).toBe(200);
    const tenantAJson = (await tenantAAccounts.json()) as { data: Array<{ id: number }> };
    expect(tenantAJson.data.map((a) => a.id)).toEqual([11]);

    // Unmapped tenant_b fails closed with [] on GET /accounts
    const tenantBAdmin = { id: 'usr_mgr_b', role: 'manager', tenantId: 'tenant_b' };
    const tenantBAccounts = await mountMixpostApp(tenantBAdmin).fetch(
      new Request('https://test.aura/api/mixpost/accounts'),
      env as any
    );
    expect(tenantBAccounts.status).toBe(200);
    const tenantBJson = (await tenantBAccounts.json()) as { data: Array<{ id: number }> };
    expect(tenantBJson.data).toEqual([]);

    // Unmapped tenant_b is rejected with 403 when trying to post to tenant_a's account 11
    const crossPostRes = await mountMixpostApp(tenantBAdmin).fetch(
      new Request('https://test.aura/api/mixpost/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Cross-tenant hijack attempt', accounts: [11] }),
      }),
      env as any
    );
    expect(crossPostRes.status).toBe(403);
    const crossPostBody = (await crossPostRes.json()) as { error: string };
    expect(crossPostBody.error).toContain('Account not authorized for this tenant');

    // tenant_a is also rejected with 403 when trying to post to account 22 outside its allowlist
    const unauthorizedAccountRes = await mountMixpostApp(MOCK_ADMIN).fetch(
      new Request('https://test.aura/api/mixpost/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Unauthorized account', accounts: [22] }),
      }),
      env as any
    );
    expect(unauthorizedAccountRes.status).toBe(403);

    // default tenant excludes tenant_a's reserved account 11 and cannot post to account 11
    const defaultAdmin = { id: 'usr_mgr_def', role: 'manager', tenantId: 'default' };
    const defaultAccounts = await mountMixpostApp(defaultAdmin).fetch(
      new Request('https://test.aura/api/mixpost/accounts'),
      env as any
    );
    const defaultAccountsJson = (await defaultAccounts.json()) as { data: Array<{ id: number }> };
    expect(defaultAccountsJson.data.map((a) => a.id)).toEqual([22]);

    const defaultHijackRes = await mountMixpostApp(defaultAdmin).fetch(
      new Request('https://test.aura/api/mixpost/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Default posting to tenant_a page', accounts: [11] }),
      }),
      env as any
    );
    expect(defaultHijackRes.status).toBe(403);
  });

  it('POST /posts rejects staff (403), invalid scheduled_at (400), failed media upload (502), and missing Mixpost id (502 without DB insert)', async () => {
    const db = createBroadcastDb({});
    const env = {
      ...createMockEnv(),
      AURA_DB: db,
      MIXPOST_API_URL: 'https://mixpost.example.com',
      MIXPOST_API_TOKEN: 'secret-mixpost-token',
      MIXPOST_TENANT_ACCOUNTS_JSON: JSON.stringify({ tenant_a: [11] }),
    };

    const staffRes = await mountMixpostApp(MOCK_STAFF).fetch(
      new Request('https://test.aura/api/mixpost/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Promo!', accounts: [11] }),
      }),
      env as any
    );
    expect(staffRes.status).toBe(403);

    const badDateRes = await mountMixpostApp(MOCK_ADMIN).fetch(
      new Request('https://test.aura/api/mixpost/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Promo!', accounts: [11], scheduled_at: 'not-a-date' }),
      }),
      env as any
    );
    expect(badDateRes.status).toBe(400);

    // SSRF hardening: trailing dot localhost, 0.0.0.0/8, CGNAT 100.64.0.0/10, IPv6 literals are rejected with 400
    for (const unsafeUrl of [
      'http://localhost./promo.png',
      'http://127.0.0.1./promo.png',
      'http://0.1.2.3/promo.png',
      'http://100.64.0.1/promo.png',
      'http://[::ffff:127.0.0.1]/promo.png',
    ]) {
      const ssrfRes = await mountMixpostApp(MOCK_ADMIN).fetch(
        new Request('https://test.aura/api/mixpost/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Promo!', accounts: [11], media_urls: [unsafeUrl] }),
        }),
        env as any
      );
      expect(ssrfRes.status).toBe(400);
    }

    // Media upload failure returns 502 instead of silently publishing text-only
    globalThis.fetch = vi.fn(async () =>
      new Response('Upstream download failed', { status: 500 })
    ) as unknown as typeof fetch;

    const mediaFailRes = await mountMixpostApp(MOCK_ADMIN).fetch(
      new Request('https://test.aura/api/mixpost/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Promo with image!',
          accounts: [11],
          media_urls: ['https://cdn.example.com/promo.png'],
        }),
      }),
      { ...env, MIXPOST_API_URL: 'https://mixpost.example.com' } as any
    );
    expect(mediaFailRes.status).toBe(502);
    expect(db.insertRuns).toHaveLength(0);

    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    const missingIdRes = await mountMixpostApp(MOCK_ADMIN).fetch(
      new Request('https://test.aura/api/mixpost/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Promo!', accounts: [11] }),
      }),
      env as any
    );
    expect(missingIdRes.status).toBe(502);
    expect(db.insertRuns).toHaveLength(0);
  });

  it('POST /posts returns real postId and persists to D1 with tenant_id, and never leaks token on upstream failure', async () => {
    const db = createBroadcastDb({});
    const secretToken = 'super-secret-mixpost-bearer-999';
    const env = {
      ...createMockEnv(),
      AURA_DB: db,
      MIXPOST_API_URL: 'https://mixpost.example.com',
      MIXPOST_API_TOKEN: secretToken,
      MIXPOST_TENANT_ACCOUNTS_JSON: JSON.stringify({ tenant_a: [11] }),
    };

    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'mp_post_777' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    const okRes = await mountMixpostApp(MOCK_ADMIN).fetch(
      new Request('https://test.aura/api/mixpost/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Ưu đãi SUMMER20 giảm 20%',
          accounts: [11],
          scheduled_at: '2026-08-01T10:00:00.000Z',
        }),
      }),
      env as any
    );
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as { success: boolean; postId: string };
    expect(okJson).toEqual({ success: true, postId: 'mp_post_777' });
    expect(db.insertRuns).toHaveLength(1);
    expect(db.insertRuns[0].args[0]).toBe('Ưu đãi SUMMER20 giảm 20%');
    expect(db.insertRuns[0].args[1]).toBe('scheduled');
    expect(db.insertRuns[0].args[7]).toBe('tenant_a');

    globalThis.fetch = vi.fn(async () =>
      new Response(`Unauthorized for ${secretToken}`, { status: 401 })
    ) as unknown as typeof fetch;

    const failRes = await mountMixpostApp(MOCK_ADMIN).fetch(
      new Request('https://test.aura/api/mixpost/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Promo!', accounts: [11] }),
      }),
      env as any
    );
    expect(failRes.status).toBe(500);
    const failText = await failRes.text();
    expect(failText).not.toContain(secretToken);
  });

  it('POST /generate formats fixed-amount VND promotions as currency and GET /posts returns empty D1 list without leaking upstream posts', async () => {
    const db = createBroadcastDb({
      promotions: [
        {
          id: 'p_fixed',
          code: 'CASH15K',
          percent: 0,
          discount_type: 'fixed',
          discount_value: 15000,
          is_active: 1,
          tenant_id: 'tenant_a',
        },
      ],
      mixpostPosts: [],
    });
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const env = {
      ...createMockEnv(),
      AURA_DB: db,
      MIXPOST_API_URL: 'https://mixpost.example.com',
      MIXPOST_API_TOKEN: 'secret-mixpost-token',
    };

    const genRes = await mountMixpostApp(MOCK_ADMIN).fetch(
      new Request('https://test.aura/api/mixpost/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'promotion', id: 'CASH15K' }),
      }),
      env as any
    );
    expect(genRes.status).toBe(200);
    const genJson = (await genRes.json()) as { success: boolean; data: { content: string } };
    expect(genJson.data.content).toContain('15.000đ');
    expect(genJson.data.content).not.toContain('%');

    const defaultAdmin = { id: 'usr_def', role: 'manager', tenantId: 'default' };
    const listRes = await mountMixpostApp(defaultAdmin).fetch(
      new Request('https://test.aura/api/mixpost/posts'),
      env as any
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { success: boolean; data: unknown[]; source?: string };
    expect(listJson).toEqual({ success: true, data: [], source: 'd1' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves tenant Mixpost account ownership from D1 settings and enforces it in handleMixpostRequest /publish and /accounts', async () => {
    const db = createBroadcastDb({
      settings: [
        { tenant_id: 'tenant_a', key: 'mixpost_account_ids', value: '[11]' },
        { tenant_id: 'tenant_b', key: 'mixpost_account_ids', value: '22' },
      ],
    });
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/accounts')) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 11, name: 'Tenant A FB', provider: 'facebook_page' },
              { id: 22, name: 'Tenant B FB', provider: 'facebook_page' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ id: 'mp_legacy_1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const env = {
      ...createMockEnv(),
      AURA_DB: db,
      MIXPOST_API_URL: 'https://mixpost.example.com',
      MIXPOST_API_TOKEN: 'secret-mixpost-token',
    } as any;

    const accountsRes = await handleMixpostRequest(
      new Request('https://test.aura/api/mixpost/accounts'),
      env,
      'tenant_a'
    );
    expect(accountsRes.status).toBe(200);
    const accountsJson = (await accountsRes.json()) as { data: Array<{ id: number }> };
    expect(accountsJson.data.map((a) => a.id)).toEqual([11]);

    const crossPublishRes = await handleMixpostRequest(
      new Request('https://test.aura/api/mixpost/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hijack publish', accounts: [22] }),
      }),
      env,
      'tenant_a'
    );
    expect(crossPublishRes.status).toBe(403);

    const ownPublishRes = await handleMixpostRequest(
      new Request('https://test.aura/api/mixpost/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Own publish', accounts: [11] }),
      }),
      env,
      'tenant_a'
    );
    expect(ownPublishRes.status).toBe(200);
  });
});
