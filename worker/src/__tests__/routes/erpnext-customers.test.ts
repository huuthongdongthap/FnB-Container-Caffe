import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { customerRoutes } from '../../routes/erpnext/customers';
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
  (db as any).batch = vi.fn().mockResolvedValue([{ success: true, changes: 1 }]);
  return db;
}

async function fetchCustomers(
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
  customerRoutes(app as any);
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

describe('erpnext-customers routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/erpnext/customers', () => {
    it('returns 200 with data array + pagination', async() => {
      const rows = [
        { id: '1', name: 'Nguyen Van A', phone: '0909123456', email: 'a@mail.com', tax_id: 'TAX001', erpnext_id: null, sync_status: 'pending', created_at: '2025-01-01', updated_at: '2025-01-01' }
      ];
      const res = await fetchCustomers('/api/erpnext/customers?page=1&limit=10', {
        env: { AURA_DB: makeMockDb({ all: vi.fn().mockResolvedValue({ results: rows, success: true }), first: vi.fn().mockResolvedValue({ total: 1 }) }) }
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toEqual({ page: 1, limit: 10, total: 1 });
    });

    it('returns 401 when Authorization header is missing', async() => {
      const env = { ...createMockEnv(), AURA_DB: makeMockDb({ all: vi.fn().mockResolvedValue({ results: [], success: true }) }) };
      const app = new Hono<{ Bindings: Record<string, unknown> }>();
      customerRoutes(app as any);
      const res = await app.fetch(new Request('https://test.aura/api/erpnext/customers'), env as any);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/erpnext/customers/sync', () => {
    it('returns mock data when ERPNEXT_MOCK=true', async() => {
      const res = await fetchCustomers('/api/erpnext/customers/sync', {
        method: 'POST',
        env: { AURA_DB: makeMockDb(), ERPNEXT_MOCK: 'true' },
        body: JSON.stringify({ name: 'Test User', phone: '0909123456', email: 'test@test.com' })
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect((body.data as Record<string, unknown>).mock).toBe(true);
    });

    it('returns 400 for invalid body', async() => {
      const res = await fetchCustomers('/api/erpnext/customers/sync', {
        method: 'POST',
        env: { AURA_DB: makeMockDb() },
        body: JSON.stringify({ invalid: true })
      });
      expect(res.status).toBe(400);
    });

    it('POST valid body calls DB and returns 200', async() => {
      const runSpy = vi.fn().mockResolvedValue({ success: true, changes: 1 });
      const res = await fetchCustomers('/api/erpnext/customers/sync', {
        method: 'POST',
        env: { AURA_DB: makeMockDb({ run: runSpy }), ERPNEXT_MOCK: 'true' },
        body: JSON.stringify({ name: 'Tran Van B', phone: '0909876543', email: 'b@mail.com', tax_id: '' })
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });
  });

  describe('GET /api/erpnext/customers/:id', () => {
    it('returns 200 with customer data', async() => {
      const row = { id: '1', name: 'Nguyen Van A', phone: '0909123456' };
      const res = await fetchCustomers('/api/erpnext/customers/1', { env: { AURA_DB: makeMockDb({ first: vi.fn().mockResolvedValue(row) }) } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect((body.data as Record<string, unknown>).id).toBe('1');
    });

    it('returns 404 when customer not found', async() => {
      const res = await fetchCustomers('/api/erpnext/customers/999', { env: { AURA_DB: makeMockDb({ first: vi.fn().mockResolvedValue(null) }) } });
      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Customer not found');
    });
  });
});
