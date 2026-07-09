/** ERPNext Expenses — TDD tests */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { expenseRoutes } from '../../routes/erpnext/expenses';
import { createMockEnv, createMockDB, createMockKV, TEST_JWT_SECRET } from '../test-utils';
import { generateJWT } from '../../lib/jwt';

function makeStmt(overrides: Record<string, unknown> = {}) {
  const stmt: Record<string, unknown> = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] as Record<string, unknown>[], success: true }),
    run: vi.fn().mockResolvedValue({ success: true, changes: 1 }),
    ...overrides
  };
  return stmt as any;
}

function makeMockDb(overrides: Record<string, unknown> = {}): ReturnType<typeof createMockDB> {
  const prepareSpy = vi.fn().mockReturnValue(makeStmt(overrides));
  const db = createMockDB();
  (db as any).prepare = prepareSpy;
  return db;
}

async function fetchExpenses(
  path: string,
  opts: { env?: Record<string, unknown>; method?: string; body?: string } = {}
): Promise<Response> {
  const env = {
    ...createMockEnv(),
    AUTH_KV: createMockKV(),
    JWT_SECRET: TEST_JWT_SECRET,
    ...opts.env
  };
  const app = new Hono<{ Bindings: Record<string, unknown> }>();
  expenseRoutes(app as any);
  const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'owner' }, TEST_JWT_SECRET);
  const reqInit: RequestInit = {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    method: opts.method || 'GET'
  };
  if (opts.body) {
    reqInit.body = opts.body;
  }
  return app.fetch(new Request(`https://test.aura${path}`, reqInit), env as any);
}

describe('erpnext-expenses routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/erpnext/expenses', () => {
    it('returns 200 with data array', async() => {
      const rows = [
        { id: 'e1', amount: 50000, category: 'Nguyen lieu', date: '2025-01-01', description: 'Coffee beans', erpnext_id: null, sync_status: 'pending', created_at: '2025-01-01' }
      ];
      const res = await fetchExpenses('/api/erpnext/expenses?limit=10', {
        env: { AURA_DB: makeMockDb({ all: vi.fn().mockResolvedValue({ results: rows, success: true }) }) }
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('returns 401 when Authorization header is missing', async() => {
      const env = { ...createMockEnv(), AURA_DB: makeMockDb() };
      const app = new Hono<{ Bindings: Record<string, unknown> }>();
      expenseRoutes(app as any);
      const res = await app.fetch(new Request('https://test.aura/api/erpnext/expenses'), env as any);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/erpnext/expenses/sync', () => {
    it('returns mock data when ERPNEXT_MOCK=true', async() => {
      const res = await fetchExpenses('/api/erpnext/expenses/sync', {
        method: 'POST',
        env: { AURA_DB: makeMockDb(), ERPNEXT_MOCK: 'true' },
        body: JSON.stringify({ amount: 50000, category: 'Nguyen lieu', date: '2025-01-01' })
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect((body.data as Record<string, unknown>).mock).toBe(true);
    });

    it('returns 400 for invalid body (missing required fields)', async() => {
      const res = await fetchExpenses('/api/erpnext/expenses/sync', {
        method: 'POST',
        env: { AURA_DB: makeMockDb() },
        body: JSON.stringify({ amount: 'not-a-number' })
      });
      expect(res.status).toBe(400);
    });
  });
});
