/**
 * Contact Routes Tests — POST /api/contact
 *
 * Tests for submitContact handler and contactRouter.fetch.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock D1 Database (simplified for contact) ─────────────────────
function createMockD1() {
  const rows: any[] = [];
  let lastRowId = 0;
  const db = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q, _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
        run: vi.fn(async function () {
          lastRowId++;
          const row: any = {};
          const cols = q.match(/\(([^)]+)\)/);
          if (cols) {
            const names = cols[1].split(',').map((c: string) => c.trim());
            names.forEach((n: string, i: number) => { row[n] = this._bindValues[i]; });
          }
          rows.push(row);
          return { success: true, lastRowId } as any;
        }),
      };
      return stmt;
    }),
  };
  return db;
}

let mockKv: Record<string, string>;

function createMockEnv(overrides: Record<string, unknown> = {}) {
  mockKv = {};
  return {
    AURA_DB: createMockD1(),
    AUTH_KV: {
      get: vi.fn(async (key: string) => mockKv[key] || null),
      put: vi.fn(async (key: string, value: string, opts?: any) => {
        mockKv[key] = value;
      }),
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitContact', () => {
  test('creates contact message and returns 201', async () => {
    const { submitContact } = await import('../worker/src/routes/contact');
    const env = createMockEnv();
    const req = new Request('https://test/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', phone: '0901234567', content: 'Help me please' }),
    });
    const res = await submitContact(req, env);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/tin nhắn/i);
  });

  test('returns 400 on missing required fields', async () => {
    const { submitContact } = await import('../worker/src/routes/contact');
    const env = createMockEnv();
    const req = new Request('https://test/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await submitContact(req, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 on invalid phone number', async () => {
    const { submitContact } = await import('../worker/src/routes/contact');
    const env = createMockEnv();
    const req = new Request('https://test/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', phone: 'invalid', content: 'Help' }),
    });
    const res = await submitContact(req, env);
    expect(res.status).toBe(400);
  });

  test('returns 429 when rate limited', async () => {
    const { submitContact } = await import('../worker/src/routes/contact');
    const env = createMockEnv();
    // Pre-seed rate limit counter to exceed max (3)
    mockKv['rl:ct:unknown'] = '3';
    const req = new Request('https://test/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', phone: '0901234567', content: 'Help' }),
    });
    const res = await submitContact(req, env);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/quá nhiều/i);
  });

  test('handles contact with optional email and category', async () => {
    const { submitContact } = await import('../worker/src/routes/contact');
    const env = createMockEnv();
    const req = new Request('https://test/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        phone: '0901234567',
        email: 'test@example.com',
        category: 'service',
        content: 'Great service!',
      }),
    });
    const res = await submitContact(req, env);
    expect(res.status).toBe(201);
  });
});

describe('contactRouter.fetch', () => {
  test('routes POST /api/contact to submitContact', async () => {
    const { contactRouter } = await import('../worker/src/routes/contact');
    const env = createMockEnv();
    const req = new Request('https://test/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', phone: '0901234567', content: 'Hello' }),
    });
    const res = await contactRouter.fetch(req, env);
    expect(res.status).toBe(201);
  });

  test('returns 404 for unknown path', async () => {
    const { contactRouter } = await import('../worker/src/routes/contact');
    const env = createMockEnv();
    const req = new Request('https://test/api/unknown', { method: 'GET' });
    const res = await contactRouter.fetch(req, env);
    expect(res.status).toBe(404);
  });
});
