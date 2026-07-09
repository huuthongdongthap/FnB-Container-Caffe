/** ERPNext Vendors — TDD tests */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { vendorRoutes } from '../../routes/erpnext/vendors';
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

async function fetchVendors(
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
  vendorRoutes(app as any);
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

describe('erpnext-vendors routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/erpnext/vendors', () => {
    it('returns 200 with data array', async() => {
      const rows = [
        { id: 'v1', name: 'Coffee Beans Co', tax_id: 'TAX01', address: 'HCM', phone: '0909', erpnext_id: null, sync_status: 'pending', created_at: '2025-01-01', updated_at: '2025-01-01' }
      ];
      const res = await fetchVendors('/api/erpnext/vendors?limit=10', {
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
      vendorRoutes(app as any);
      const res = await app.fetch(new Request('https://test.aura/api/erpnext/vendors'), env as any);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/erpnext/vendors/sync', () => {
    it('returns mock data when ERPNEXT_MOCK=true', async() => {
      const res = await fetchVendors('/api/erpnext/vendors/sync', {
        method: 'POST',
        env: { AURA_DB: makeMockDb(), ERPNEXT_MOCK: 'true' },
        body: JSON.stringify({ name: 'Vendor A', tax_id: 'TAX01' })
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect((body.data as Record<string, unknown>).mock).toBe(true);
    });

    it('returns 400 for invalid body (missing name)', async() => {
      const res = await fetchVendors('/api/erpnext/vendors/sync', {
        method: 'POST',
        env: { AURA_DB: makeMockDb() },
        body: JSON.stringify({ tax_id: 'TAX01' })
      });
      expect(res.status).toBe(400);
    });
  });
});
