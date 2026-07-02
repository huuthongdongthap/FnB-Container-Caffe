/**
 * Orders (Hono) Route Tests — /api/orders
 * KDS dashboard + checkout flow.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock JWT: verifyJWT used by GET /my-orders
vi.mock('../worker/src/lib/jwt.ts', () => ({
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

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    orders: [...(seedData.orders || [])],
    customers: [...(seedData.customers || [])],
  };

  function getTable(sql: string): string {
    const from = sql.match(/\bFROM\s+(\w+)/i);
    if (from) return from[1];
    const insert = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
    if (insert) return insert[1];
    const update = sql.match(/UPDATE\s+(\w+)/i);
    if (update) return update[1];
    return '';
  }

  function extractWhereCols(sql: string): string[] {
    const wherePart = sql.match(/WHERE\s+(.+?)(?:ORDER\s+BY|LIMIT|$)/i);
    if (!wherePart) return [];
    const conds = wherePart[1].split(/\s+AND\s+/i);
    return conds.map(c => {
      const m = c.match(/(\w+)\s*(?:=|>=|<=|!=|>|<)\s*\?/);
      return m ? m[1] : '';
    }).filter(Boolean);
  }

  return {
    prepare: vi.fn((sql: string) => {
      const bindValues: any[] = [];
      const stmt: any = {
        _sql: sql,
        bind: vi.fn((...vals: any[]) => { bindValues.push(...vals); return stmt; }),
        first: vi.fn(async () => {
          const t = getTable(sql);
          const rows = tables[t] || [];
          const whereCols = extractWhereCols(sql);
          if (whereCols.length > 0 && bindValues.length > 0) {
            for (const row of rows) {
              let match = true;
              for (let i = 0; i < Math.min(whereCols.length, bindValues.length); i++) {
                if (String((row as Record<string, unknown>)[whereCols[i]]) !== String(bindValues[i])) { match = false; break; }
              }
              if (match) return row;
            }
            return null;
          }
          return (tables[t] || [])[0] || null;
        }),
        all: vi.fn(async () => {
          const t = getTable(sql);
          return { results: [...(tables[t] || [])] };
        }),
        run: vi.fn(async () => {
          const insert = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
          if (insert) {
            const t = insert[1];
            if (!tables[t]) tables[t] = [];
            const row: any = {};
            const cols = sql.match(/\(([^)]+)\)/);
            if (cols) {
              cols[1].split(',').map(c => c.trim()).forEach((n, i) => {
                row[n] = bindValues[i];
              });
            }
            tables[t].push(row);
          }
          return { success: true };
        }),
      };
      return stmt;
    }),
  };
}

function createEnv(overrides: Record<string, unknown> = {}) {
  return { AURA_DB: createMockD1(), JWT_SECRET: 'test-secret', ...overrides };
}

let router: any;
let env: ReturnType<typeof createEnv>;

beforeEach(async () => {
  vi.clearAllMocks();
  env = createEnv();
  const mod = await import('../worker/src/routes/orders-hono.ts');
  router = mod.ordersRouter;
});

describe('GET /', () => {
  test('returns 200 with order list', async () => {
    env.AURA_DB = createMockD1({
      orders: [
        { id: 'ORD-1', customer_name: 'Alice', status: 'pending', total: 50000, items: '[]' },
      ],
    });

    const res = await router.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  test('returns 200 with empty array when no orders', async () => {
    const res = await router.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });
});

describe('GET /:id', () => {
  test('returns 200 with single order', async () => {
    env.AURA_DB = createMockD1({
      orders: [{ id: 'ORD-1', customer_name: 'Alice', status: 'pending', total: 50000, items: '[]' }],
    });

    const res = await router.request('/ORD-1', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.customer_name).toBe('Alice');
  });

  test('returns 404 when not found', async () => {
    const res = await router.request('/NONEXISTENT', { method: 'GET' }, env);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// Note: GET /kds and PATCH /:id/status require requireAuth middleware
// and are not tested here (would need auth mock). They are staff-only routes.

describe('POST /checkout', () => {
  test('creates order and returns 201', async () => {
    const res = await router.request('/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ product_id: 'p1', quantity: 2, price: 25000 }],
        customer_name: 'Alice',
        total: 50000,
      }),
    }, env);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.customer_name).toBe('Alice');
  });

  test('returns 400 on missing items', async () => {
    const res = await router.request('/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: 50000 }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 on empty items array', async () => {
    const res = await router.request('/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [], total: 0 }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('GET /my-orders', () => {
  const mockCustomer = { id: 'USR_001', name: 'Alice', phone: '0909123001', email: 'alice@test.com', loyalty_tier: 'bronze' };

  test('returns 200 with customer order history', async () => {
    env.AURA_DB = createMockD1({
      customers: [mockCustomer],
      orders: [
        { id: 'ORD-1', customer_name: 'Alice', customer_phone: '0909123001', items: '[]', total: 50000, status: 'completed', payment_method: 'cod', created_at: '2026-07-01T00:00:00Z' },
        { id: 'ORD-2', customer_name: 'Alice', customer_phone: '0909123001', items: '[]', total: 35000, status: 'pending', payment_method: 'payos', created_at: '2026-07-02T00:00:00Z' },
      ],
    });

    const res = await router.request('/my-orders', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Record<string, unknown>[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  test('returns 401 without authorization header', async () => {
    const res = await router.request('/my-orders', { method: 'GET' }, env);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Unauthorized/i);
  });

  test('returns 401 with invalid token', async () => {
    const res = await router.request('/my-orders', {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid-token' },
    }, env);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Token/);
  });

  test('returns empty array when customer has no orders', async () => {
    env.AURA_DB = createMockD1({ customers: [mockCustomer], orders: [] });

    const res = await router.request('/my-orders', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  test('returns empty array when customerId missing from token', async () => {
    const jwt = await import('../worker/src/lib/jwt.ts');
    (jwt.verifyJWT as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ email: 'no-id@test.com' });

    env.AURA_DB = createMockD1({ orders: [] });
    const res = await router.request('/my-orders', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });
});

