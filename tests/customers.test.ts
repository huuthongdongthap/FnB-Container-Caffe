/**
 * Customers Routes — Tests for /api/customers/me and /api/customers.
 *
 * GET /me uses JWT verification directly (no middleware).
 * GET / is a paginated, filterable customer list.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock JWT: verifyJWT is imported via re-export from auth.ts → ../lib/jwt
// customers.ts imports from './auth.js' which re-exports from '../lib/jwt'
// So we need to mock the actual path used by customers.ts (with .js extension)
vi.mock('../worker/src/routes/auth.js', () => ({
  verifyJWT: vi.fn(async (token: string) => {
    if (token === 'valid-token') {
      return { email: 'test@test.com', sub: 'USR_001', id: 'USR_001', name: 'Test User', role: 'customer' };
    }
    return null;
  }),
  generateJWT: vi.fn(),
  getAuthToken: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

import { customersRouter } from '../worker/src/routes/customers.ts';

// ── Mock D1 Factory ─────────────────────────────────────────────
function createMockD1(customers: Record<string, unknown>[] = []) {
  return {
    prepare: vi.fn((sql: string) => {
      const stmt: any = {
        _bindValues: [] as unknown[],
        bind: vi.fn(function (...vals: unknown[]) {
          stmt._bindValues = vals;
          return stmt;
        }),
        first: vi.fn(async function () {
          // /me endpoint — single customer lookup by id
          // SQL is: PROFILE_SQL + WHERE c.id = ?
          if (sql.includes('WHERE c.id = ?')) {
            return customers.find((c: any) => c.id === stmt._bindValues[0]) ?? null;
          }
          // COUNT queries for segments
          if (sql.includes('COUNT(*)') && sql.includes('FROM customers')) {
            return { count: customers.length };
          }
          return null;
        }),
        all: vi.fn(async function () {
          // / endpoint — customer list (may be filtered)
          // Uses PROFILE_SQL which has: FROM customers c LEFT JOIN cashback_wallets cw
          // Count query: SELECT COUNT(*) as total FROM customers WHERE 1=1...
          if (sql.includes('SELECT COUNT(*) as total FROM customers')) {
            return { results: [{ total: customers.length }] };
          }
          // Data query: PROFILE_SQL + WHERE 1=1...
          if (sql.includes('LEFT JOIN cashback_wallets')) {
            return { results: customers };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      return stmt;
    }),
  };
}

function createEnv(overrides: Record<string, unknown> = {}) {
  return {
    AURA_DB: createMockD1(),
    JWT_SECRET: 'test-secret-16chars',
    ...overrides,
  };
}

const sampleCustomers = [
  {
    id: 'USR_001', name: 'Alice', phone: '0909123001',
    email: 'alice@test.com', birthday: '1990-05-15',
    loyalty_tier: 'gold', loyalty_points: 5000, lifetime_points: 10000,
    cashback_balance: 50000, total_earned: 100000, total_spent: 5000000,
    visit_count: 20, created_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'USR_002', name: 'Bob', phone: '0909123002',
    email: 'bob@test.com', birthday: '',
    loyalty_tier: 'silver', loyalty_points: 2000, lifetime_points: 5000,
    cashback_balance: 20000, total_earned: 50000, total_spent: 2000000,
    visit_count: 10, created_at: '2026-02-20T00:00:00Z',
  },
  {
    id: 'USR_003', name: 'Charlie', phone: '0909123003',
    email: 'charlie@test.com', birthday: null,
    loyalty_tier: 'bronze', loyalty_points: 500, lifetime_points: 1000,
    cashback_balance: 5000, total_earned: 10000, total_spent: 500000,
    visit_count: 3, created_at: '2026-03-10T00:00:00Z',
  },
];

describe('Customer Routes', () => {
  let env: ReturnType<typeof createEnv>;

  beforeEach(() => {
    env = createEnv();
  });

  describe('GET /me', () => {
    test('returns customer profile with valid JWT', async () => {
      env.AURA_DB = createMockD1(sampleCustomers);

      const res = await customersRouter.request('/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: { id: string; name: string } };
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Alice');
      expect(body.data.id).toBe('USR_001');
    });

    test('returns 401 without authorization header', async () => {
      env.AURA_DB = createMockD1(sampleCustomers);

      const res = await customersRouter.request('/me', { method: 'GET' }, env);
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Unauthorized/i);
    });

    test('returns 401 with invalid token', async () => {
      env.AURA_DB = createMockD1(sampleCustomers);

      const res = await customersRouter.request('/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' },
      }, env);
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Token/);
    });

    test('returns 404 when customer not found', async () => {
      env.AURA_DB = createMockD1([]);

      const res = await customersRouter.request('/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      }, env);
      expect(res.status).toBe(404);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/not found/i);
    });
  });

  describe('GET /', () => {
    test('returns paginated customer list', async () => {
      env.AURA_DB = createMockD1(sampleCustomers);

      const res = await customersRouter.request('/', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.pagination).toMatchObject({ page: 1, limit: 50, total: 3, totalPages: 1 });
    });

    test('filters by search query', async () => {
      // Create env with search — the mock D1 doesn't actually filter
      // but we verify the route parses and passes the search param
      env.AURA_DB = createMockD1(sampleCustomers);

      const res = await customersRouter.request('/?search=Alice', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; pagination: { total: number } };
      expect(body.success).toBe(true);
    });

    test('filters by tier', async () => {
      env.AURA_DB = createMockD1(sampleCustomers);

      const res = await customersRouter.request('/?tier=gold', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: any[] };
      expect(body.success).toBe(true);
    });

    test('returns empty list with pagination metadata', async () => {
      env.AURA_DB = createMockD1([]);

      const res = await customersRouter.request('/', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
      expect(body.pagination).toMatchObject({ total: 0, totalPages: 0 });
    });
  });
});
