/**
 * Mixpost Bridge Tests — API client + Hono routes
 *
 * Tests the Mixpost API client and the /api/mixpost/* Hono routes.
 * Uses mock D1 and mock fetch for isolated unit testing.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock D1 Database ──────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {};
  ['promotions', 'products', 'categories']
    .forEach(t => { tables[t] = [...(seedData[t] || [])]; });

  function parseWhere(sql: string) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    const table = fromMatch ? fromMatch[1] : null;
    const condMatch = sql.match(/(\w+)\s*(>=|<=|!=|>|<|=)\s*(\?|'[^']*'|"[^"]*"|\d+)/g);
    if (!condMatch || !table) return null;
    const conditions: Array<{ col: string; op: string; bindIdx?: number; literal?: string | number }> = [];
    let bindIdx = 0;
    for (const c of condMatch) {
      const m = c.match(/(\w+)\s*(>=|<=|!=|>|<|=)\s*(\?|'[^']*'|"[^"]*"|\d+)/)!;
      const vt = m[3];
      if (vt === '?') { conditions.push({ col: m[1], op: m[2], bindIdx }); bindIdx++; }
      else if (vt.startsWith("'") || vt.startsWith('"')) { conditions.push({ col: m[1], op: m[2], literal: vt.slice(1, -1) }); }
      else { conditions.push({ col: m[1], op: m[2], literal: Number(vt) }); }
    }
    return { table, conditions };
  }

  function matchRow(row: any, conditions: any[], bindValues: any[]) {
    for (const cond of conditions) {
      const val = cond.literal !== undefined ? cond.literal : bindValues[cond.bindIdx];
      const rowVal = row[cond.col];
      if (rowVal == null && val != null) return false;
      switch (cond.op) {
        case '=':  if (String(rowVal) !== String(val)) return false; break;
        case '>':  if (Number(rowVal) <= Number(val)) return false; break;
        case '<':  if (Number(rowVal) >= Number(val)) return false; break;
        default:   if (String(rowVal) !== String(val)) return false; break;
      }
    }
    return true;
  }

  function getPrimaryTable(sql: string) {
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : null;
  }

  const db = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q, _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
        first: vi.fn(async function (this: any) {
          const parsed = parseWhere(q);
          const table = getPrimaryTable(q);
          const rows = (table && tables[table]) ? tables[table] : [];
          if (!parsed || !tables[parsed.table]) return rows[0] || null;
          const matched = rows.filter(r => matchRow(r, parsed.conditions, this._bindValues));
          return matched[0] || null;
        }),
        all: vi.fn(async function (this: any) {
          const parsed = parseWhere(q);
          const table = getPrimaryTable(q);
          const rows = (table && tables[table]) ? tables[table] : [];
          if (!parsed || !tables[parsed.table]) return { results: [...rows] };
          const matched = rows.filter(r => matchRow(r, parsed.conditions, this._bindValues));
          return { results: matched };
        }),
      };
      return stmt;
    }),
  };
  return db;
}

// ── Mock Env ──────────────────────────────────────────────────────
function createMockEnv(overrides: Record<string, unknown> = {}) {
  return {
    AURA_DB: createMockD1(),
    MIXPOST_API_URL: 'http://mixpost.local:9000',
    MIXPOST_API_TOKEN: 'test-token-abc',
    ...overrides,
  };
}

// ── Seed Data ─────────────────────────────────────────────────────
const seedActivePromotions = [
  { code: 'AURA20', percent: 20, max_discount: 50000, min_order: 0, usage_limit: 100, usage_count: 5, starts_at: '2026-06-01T00:00:00Z', expires_at: '2026-07-31T23:59:59Z', is_active: 1, created_at: '2026-06-01T00:00:00Z' },
  { code: 'WELCOME', percent: 10, max_discount: 30000, min_order: 0, usage_limit: 0, usage_count: 10, starts_at: null, expires_at: null, is_active: 1, created_at: '2026-06-01T00:00:00Z' },
];

const seedProducts = [
  { id: 1, category_id: 1, name: 'Espresso', price: 35000, description: 'Dam vi', image_url: '/images/espresso.jpg', is_available: 1 },
  { id: 2, category_id: 1, name: 'Cappuccino', price: 45000, description: 'Beo ngay', image_url: '/images/cappuccino.jpg', is_available: 1 },
  { id: 3, category_id: 2, name: 'Tra Dao', price: 39000, description: 'Tra dao cam sa', image_url: '/images/tra-dao.jpg', is_available: 1 },
  { id: 4, category_id: 2, name: 'TRA CHANH', price: 25000, description: 'Mat lanh', image_url: '/images/tra-chanh.jpg', is_available: 1 },
  { id: 5, category_id: 3, name: 'Banh Croissant', price: 25000, description: 'Bo gion tan', image_url: '/images/croissant.jpg', is_available: 1 },
];

const inactivePromotions = [
  { code: 'EXPIRED', percent: 50, max_discount: 100000, min_order: 0, usage_limit: 50, usage_count: 50, starts_at: '2026-01-01T00:00:00Z', expires_at: '2026-01-31T23:59:59Z', is_active: 0, created_at: '2025-12-01T00:00:00Z' },
];

// ── Fetch mock (named variable for .mock.calls access) ─────────────
let mockFetch: ReturnType<typeof vi.fn>;

function mockFetchResponse(data: any, status = 200) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  mockFetch.mockResolvedValue(new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function mockFetchError(status: number, body: any) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  mockFetch.mockResolvedValue(new Response(payload, {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

let mixpostRouter: any;
let env: ReturnType<typeof createMockEnv>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch;
  env = createMockEnv();
});

// ── Mixpost Client Tests ─────────────────────────────────────────
describe('MixpostClient', () => {
  test('createPost sends correct request body', async () => {
    const mixpostResponse = { id: 42, accounts: [1], date: '2026-07-02', time: '10:00' };
    mockFetchResponse(mixpostResponse);

    const { createMixpostClient } = await import('../worker/src/lib/mixpost-client.ts');
    const client = createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);

    const result = await client.createPost({
      accounts: [1],
      content: 'Test post',
      date: '2026-07-02',
      time: '10:00',
    });

    expect(result).toEqual(mixpostResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://mixpost.local:9000/api/mixpost/posts');
    const body = JSON.parse(opts.body as string);
    expect(body.accounts).toEqual([1]);
    expect(body.versions[0].content[0].body).toBe('Test post');
  });

  test('includes Bearer auth header', async () => {
    mockFetchResponse({ id: 1 });

    const { createMixpostClient } = await import('../worker/src/lib/mixpost-client.ts');
    const client = createMixpostClient(env.MIXPOST_API_URL, 'my-secret-token');

    await client.createPost({ accounts: [1], content: 'Test' });
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(opts.headers!['Authorization' as keyof HeadersInit] || (opts.headers as Record<string, string>).Authorization).toBe('Bearer my-secret-token');
  });

  test('retries once on 5xx response', async () => {
    mockFetchError(503, 'Service Unavailable');

    const { createMixpostClient, MixpostApiError } = await import('../worker/src/lib/mixpost-client.ts');
    // Use short retry delay so test completes quickly
    const client = createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN, { retryDelay: 10 });

    const err = await client.createPost({ accounts: [1], content: 'Test' }).catch(e => e);
    expect(err).toBeInstanceOf(MixpostApiError);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 10000);

  test('throws MixpostApiError on 401', async () => {
    mockFetchError(401, { error: 'Unauthorized' });

    const { createMixpostClient, MixpostApiError } = await import('../worker/src/lib/mixpost-client.ts');
    const client = createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);

    const err = await client.createPost({ accounts: [1], content: 'Test' }).catch(e => e);
    expect(err).toBeInstanceOf(MixpostApiError);
    expect(err.status).toBe(401);
    expect(err.endpoint).toContain('/api/mixpost/posts');
    // Should NOT retry on 401 — only one fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('uploadMediaFromUrl sends POST to /media/download', async () => {
    mockFetchResponse({ id: 10, url: '/images/test.jpg' });

    const { createMixpostClient } = await import('../worker/src/lib/mixpost-client.ts');
    const client = createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);

    await client.uploadMediaFromUrl('http://example.com/img.jpg');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/mixpost/media/download');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body as string);
    expect(body.url).toBe('http://example.com/img.jpg');
  });

  test('listAccounts sends GET to /accounts', async () => {
    mockFetchResponse([{ id: 1, name: 'Facebook' }]);

    const { createMixpostClient } = await import('../worker/src/lib/mixpost-client.ts');
    const client = createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);

    const result = await client.listAccounts();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/mixpost/accounts');
    expect(opts.method).toBe('GET');
    expect(result).toEqual([{ id: 1, name: 'Facebook' }]);
  });

  test('getAccount sends GET to /accounts/{id}', async () => {
    mockFetchResponse({ id: 5, name: 'Instagram' });

    const { createMixpostClient } = await import('../worker/src/lib/mixpost-client.ts');
    const client = createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);

    const result = await client.getAccount(5);
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/api/mixpost/accounts/5');
    expect(result).toEqual({ id: 5, name: 'Instagram' });
  });
});

// ── Route: POST /api/mixpost/posts ───────────────────────────────
describe('POST /api/mixpost/posts', () => {
  async function mountRouter() {
    const mod = await import('../worker/src/routes/mixpost.ts');
    mixpostRouter = (mod as any).mixpostRouter;
  }

  test('creates post with valid input and returns postId', async () => {
    // Mock Mixpost API: create post returns { id: 99 }
    mockFetchResponse({ id: 99 });
    await mountRouter();

    const res = await mixpostRouter.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Test post content',
        accounts: [1, 2],
        scheduledAt: '2026-07-02T10:00:00+07:00',
      }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.postId).toBe(99);
  });

  test('returns 400 when content is missing', async () => {
    await mountRouter();

    const res = await mixpostRouter.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts: [1] }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/content|string/i);
  });

  test('returns 400 when accounts is empty', async () => {
    await mountRouter();

    const res = await mixpostRouter.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Test', accounts: [] }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('uploads media from URLs before creating post', async () => {
    // First fetch: upload media -> returns { id: 50 }
    // Second fetch: create post -> returns { id: 100 }
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 50 }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 100 }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    await mountRouter();

    const res = await mixpostRouter.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Post with media',
        accounts: [1],
        mediaUrls: ['http://example.com/img.jpg'],
      }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.postId).toBe(100);

    // Verify media download was called
    const firstCallUrl = mockFetch.mock.calls[0][0];
    expect(firstCallUrl).toContain('/api/mixpost/media/download');

    // Verify createPost was called after media upload with media IDs attached
    const secondCallUrl = mockFetch.mock.calls[1][0];
    expect(secondCallUrl).toContain('/api/mixpost/posts');
    const postBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    const mediaField = postBody.versions[0].content[0].media;
    expect(mediaField).toEqual([{ id: 50 }]);
  });

  test('returns 500 when Mixpost API fails', async () => {
    mockFetchError(500, 'Internal error');
    await mountRouter();

    const res = await mixpostRouter.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Test', accounts: [1] }),
    }, env);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    // Must not leak internal error details
    expect(body.error).not.toMatch(/Internal error/);
  }, 10000);
});

// ── Route: POST /api/mixpost/generate ────────────────────────────
describe('POST /api/mixpost/generate', () => {
  async function mountRouter() {
    const mod = await import('../worker/src/routes/mixpost.ts');
    mixpostRouter = (mod as any).mixpostRouter;
  }

  test('generates promo content from promotion source', async () => {
    env.AURA_DB = createMockD1({ promotions: seedActivePromotions });
    await mountRouter();

    const res = await mixpostRouter.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'promotion', id: 'AURA20' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toMatch(/AURA20/);
    expect(body.data.content).toMatch(/20%/);
    expect(body.data.content).toMatch(/Aura Cafe/);
    expect(body.data.content).toMatch(/#AuraCafe/);
    expect(body.data.hashtags).toContain('AuraCafe');
    expect(body.data.hashtags).toContain('KhuyenMai');
  });

  test('returns 404 for unknown promotion code', async () => {
    env.AURA_DB = createMockD1({ promotions: [] });
    await mountRouter();

    const res = await mixpostRouter.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'promotion', id: 'NONEXIST' }),
    }, env);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('generates menu content from menu source', async () => {
    env.AURA_DB = createMockD1({ products: seedProducts });
    await mountRouter();

    const res = await mixpostRouter.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'menu' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toMatch(/Aura Cafe/);
    expect(body.data.content).toMatch(/#MenuHangNgay/);
    expect(body.data.hashtags).toContain('AuraCafe');
    expect(body.data.hashtags).toContain('MenuHangNgay');
    // Should contain at least one product name
    expect(body.data.content).toMatch(/Espresso|Cappuccino|Tra Dao|Croissant/);
  });

  test('returns empty content when no products available', async () => {
    env.AURA_DB = createMockD1({ products: [] });
    await mountRouter();

    const res = await mixpostRouter.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'menu' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toMatch(/Aura Cafe/);
    expect(body.data.content).toMatch(/Hien chua co mon/);
  });

  test('returns 400 for unknown source type', async () => {
    await mountRouter();

    const res = await mixpostRouter.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'invalid' }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('handles menu source with optional category filter', async () => {
    env.AURA_DB = createMockD1({ products: seedProducts });
    await mountRouter();

    const res = await mixpostRouter.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'menu', category: 1 }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toMatch(/Aura Cafe/);
  });
});

// ── Route: GET /api/mixpost/accounts ──────────────────────────────
describe('GET /api/mixpost/accounts', () => {
  async function mountRouter() {
    const mod = await import('../worker/src/routes/mixpost.ts');
    mixpostRouter = (mod as any).mixpostRouter;
  }

  test('proxies to Mixpost API and returns accounts', async () => {
    const accounts = [
      { id: 1, name: 'Facebook Page', provider: 'facebook' },
      { id: 2, name: 'Instagram Profile', provider: 'instagram' },
    ];
    mockFetchResponse(accounts);
    await mountRouter();

    const res = await mixpostRouter.request('/accounts', { method: 'GET' }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(accounts);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/mixpost/accounts');
  });

  test('returns 500 when Mixpost API call fails', async () => {
    mockFetchError(502, 'Bad Gateway');
    await mountRouter();

    const res = await mixpostRouter.request('/accounts', { method: 'GET' }, env);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    // Must not leak internal details
    expect(body.error).not.toMatch(/Bad Gateway/);
  }, 10000);
});

// ── Route: GET /api/mixpost/posts ──────────────────────────────
describe('GET /api/mixpost/posts', () => {
  async function mountRouter() {
    const mod = await import('../worker/src/routes/mixpost.ts');
    mixpostRouter = (mod as any).mixpostRouter;
  }

  test('proxies to Mixpost API and returns posts', async () => {
    const posts = [
      { id: 10, status: 'scheduled', date: '2026-07-02' },
      { id: 11, status: 'published', date: '2026-07-01' },
    ];
    mockFetchResponse(posts);
    await mountRouter();

    const res = await mixpostRouter.request('/posts', { method: 'GET' }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(posts);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/mixpost/posts');
  });
});

// ── Cron: autoPostDailySpecials ──────────────────────────────────
describe('autoPostDailySpecials', () => {
  async function loadModule() {
    return await import('../worker/src/routes/mixpost.ts');
  }

  beforeEach(() => {
    env = createMockEnv({
      AURA_DB: createMockD1({ products: seedProducts }),
      MIXPOST_ACCOUNTS: '1,2',
    });
  });

  test('generates post from available products with Vietnamese content', async () => {
    mockFetchResponse({ id: 101 });
    const { autoPostDailySpecials } = await loadModule();
    await autoPostDailySpecials(env);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.versions[0].content[0].body).toMatch(/Aura Cafe/);
    expect(body.versions[0].content[0].body).toMatch(/1900 1234/);
    expect(body.versions[0].content[0].body).toMatch(/#MenuHangNgay/);
    expect(body.versions[0].content[0].body).toMatch(/Espresso|Cappuccino|TRA CHANH|Croissant/);
  });

  test('skips when no products available', async () => {
    env.AURA_DB = createMockD1({ products: [] });
    const { autoPostDailySpecials } = await loadModule();
    await autoPostDailySpecials(env);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('skips when MIXPOST_API_URL not set', async () => {
    env.MIXPOST_API_URL = undefined;
    const { autoPostDailySpecials } = await loadModule();
    await autoPostDailySpecials(env);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('uses accounts from MIXPOST_ACCOUNTS env var', async () => {
    mockFetchResponse({ id: 102 });
    const { autoPostDailySpecials } = await loadModule();
    await autoPostDailySpecials(env);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.accounts).toEqual([1, 2]);
  });

  test('skips when MIXPOST_ACCOUNTS is empty or not set', async () => {
    mockFetchResponse({ id: 103 });
    env.MIXPOST_ACCOUNTS = undefined;
    const { autoPostDailySpecials } = await loadModule();
    await autoPostDailySpecials(env);

    // No fetch call should be made — function returns early with no_accounts skip
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── Cron: autoPostNewPromotions ─────────────────────────────────
describe('autoPostNewPromotions', () => {
  async function loadModule() {
    return await import('../worker/src/routes/mixpost.ts');
  }

  beforeEach(() => {
    env = createMockEnv({
      AURA_DB: createMockD1({ promotions: [...seedActivePromotions, ...inactivePromotions] }),
      MIXPOST_ACCOUNTS: '1',
    });
  });

  test('generates post for each active promotion with discount percent', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 201 }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 202 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { autoPostNewPromotions } = await loadModule();
    await autoPostNewPromotions(env);

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First post: AURA20 (20%)
    const body1 = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body1.versions[0].content[0].body).toMatch(/AURA20/);
    expect(body1.versions[0].content[0].body).toMatch(/20%/);
    expect(body1.versions[0].content[0].body).toMatch(/Aura Cafe/);
    expect(body1.versions[0].content[0].body).toMatch(/#KhuyenMai/);
    expect(body1.accounts).toEqual([1]);

    // Second post: WELCOME (10%)
    const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body2.versions[0].content[0].body).toMatch(/WELCOME/);
    expect(body2.versions[0].content[0].body).toMatch(/10%/);
  });

  test('skips inactive promotions', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 201 }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 202 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { autoPostNewPromotions } = await loadModule();
    await autoPostNewPromotions(env);

    // Only 2 calls for active promotions, not 3
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify EXPIRED promotion is NOT posted
    const postedContent = mockFetch.mock.calls.map(c => JSON.parse(c[1].body).versions[0].content[0].body);
    expect(postedContent.every(c => !c.includes('EXPIRED'))).toBe(true);
  });

  test('skips when no active promotions', async () => {
    env.AURA_DB = createMockD1({ promotions: inactivePromotions });
    const { autoPostNewPromotions } = await loadModule();
    await autoPostNewPromotions(env);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('skips when Mixpost not configured', async () => {
    env.MIXPOST_API_URL = undefined;
    const { autoPostNewPromotions } = await loadModule();
    await autoPostNewPromotions(env);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── Cron: autoPostWeeklyHighlights ──────────────────────────────
describe('autoPostWeeklyHighlights', () => {
  async function loadModule() {
    return await import('../worker/src/routes/mixpost.ts');
  }

  beforeEach(() => {
    env = createMockEnv({
      AURA_DB: createMockD1({ products: seedProducts }),
      MIXPOST_ACCOUNTS: '1,2,3',
    });
  });

  test('generates post with product ranking and prices', async () => {
    mockFetchResponse({ id: 301 });
    const { autoPostWeeklyHighlights } = await loadModule();
    await autoPostWeeklyHighlights(env);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.accounts).toEqual([1, 2, 3]);
    expect(body.versions[0].content[0].body).toMatch(/Best Seller/);
    expect(body.versions[0].content[0].body).toMatch(/Aura Cafe/);
    expect(body.versions[0].content[0].body).toMatch(/#BestSeller/);
    expect(body.versions[0].content[0].body).toMatch(/1\./);
    expect(body.versions[0].content[0].body).toMatch(/Espresso|Cappuccino|TRA CHANH|Croissant/);
  });

  test('skips when no products', async () => {
    env.AURA_DB = createMockD1({ products: [] });
    const { autoPostWeeklyHighlights } = await loadModule();
    await autoPostWeeklyHighlights(env);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('skips when Mixpost not configured', async () => {
    env.MIXPOST_API_URL = undefined;
    const { autoPostWeeklyHighlights } = await loadModule();
    await autoPostWeeklyHighlights(env);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
