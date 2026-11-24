import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { broadcastRouter } from '../../routes/broadcast';
import { mixpostRouter } from '../../routes/mixpost';
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
      } as any
    );
    expect(fbRes.status).toBe(200);
    const json = (await fbRes.json()) as { success: boolean; data: Array<{ id: number; provider: string }> };
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe(11);
  });

  it('POST /posts rejects staff (403), invalid scheduled_at (400), and missing Mixpost id (502 without DB insert)', async () => {
    const db = createBroadcastDb({});
    const env = {
      ...createMockEnv(),
      AURA_DB: db,
      MIXPOST_API_URL: 'https://mixpost.example.com',
      MIXPOST_API_TOKEN: 'secret-mixpost-token',
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
});
