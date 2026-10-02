import { describe, it, expect } from 'vitest';
import { createOrder } from '../commands/create-order';

function createMockEnv(overrides: Record<string, unknown> = {}) {
  const store = new Map<string, string>();
  const kv = {
    get: async (key: string, type?: string) => {
      const val = store.get(key);
      if (!val) return null;
      return type === 'json' ? JSON.parse(val) : val;
    },
    put: async (key: string, val: string, opts?: { expirationTtl?: number }) => {
      store.set(key, val);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  };

  let insertCount = 0;
  const db = {
    prepare: (sql: string) => {
      const stmt = {
        _sql: sql,
        _binds: [] as unknown[],
        bind(...args: unknown[]) {
          stmt._binds = args;
          return stmt;
        },
        first: async <T = unknown>() => {
          if (sql.includes('FROM cafe_tables WHERE table_number = ?')) {
            return { id: 'tbl_b02', table_number: 'B02' } as T;
          }
          if (sql.includes('FROM menu_items WHERE id = ?') || sql.includes('FROM products WHERE id = ?')) {
            return { id: 'prod_coffee', name: 'Cà phê muối', price: 35000, available: 1 } as T;
          }
          return null as T;
        },
        run: async () => {
          if (sql.includes('INSERT INTO orders')) {
            insertCount++;
          }
          return { success: true, changes: 1, lastRowId: 1 };
        },
        all: async () => ({ results: [], success: true }),
        raw: async () => [],
      };
      return stmt;
    },
    batch: async (stmts: unknown[] = []) => stmts.map(() => ({ success: true, changes: 1 })),
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  };

  return {
    AURA_DB: db,
    AUTH_KV: kv,
    REALTIME_ENABLED: 'false',
    _store: store,
    getInsertCount: () => insertCount,
    ...overrides,
  };
}

describe('createOrder - Idempotency-Key KV Caching', () => {
  const baseOrder = {
    items: [{ id: 'prod_coffee', name: 'Cà phê muối', qty: 2, price: 35000 }],
    total: 70000,
    customer_name: 'Tran Van B',
    customer_phone: '0987654321',
    payment_method: 'cod',
    order_type: 'takeaway',
  };

  it('first request with Idempotency-Key creates order and populates KV cache', async () => {
    const env = createMockEnv();
    const idempotencyKey = 'idem-req-001';

    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(baseOrder),
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(env.getInsertCount()).toBe(1);

    // Verify written to KV
    const cached = await env.AUTH_KV.get(`order:idempotency:${idempotencyKey}`, 'json');
    expect(cached).not.toBeNull();
    expect((cached as any).data.total).toBe(70000);
  });

  it('second request with same Idempotency-Key returns cached response with X-Cache: HIT and avoids duplicate DB insert', async () => {
    const env = createMockEnv();
    const idempotencyKey = 'idem-req-002';

    // First request
    const req1 = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(baseOrder),
    });
    const res1 = await createOrder(req1, env);
    expect(res1.status).toBe(201);
    expect(env.getInsertCount()).toBe(1);

    // Second request with same idempotency key
    const req2 = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(baseOrder),
    });
    const res2 = await createOrder(req2, env);
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-Cache')).toBe('HIT');
    const body2 = await res2.json() as Record<string, unknown>;
    expect(body2.success).toBe(true);
    // Crucial check: Database insert count must still be 1!
    expect(env.getInsertCount()).toBe(1);
  });

  it('requests without Idempotency-Key do not cache and execute independent inserts', async () => {
    const env = createMockEnv();

    const req1 = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseOrder),
    });
    const res1 = await createOrder(req1, env);
    expect(res1.status).toBe(201);
    expect(env.getInsertCount()).toBe(1);

    const req2 = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseOrder),
    });
    const res2 = await createOrder(req2, env);
    expect(res2.status).toBe(201);
    expect(env.getInsertCount()).toBe(2);
  });

  it('requests proceed smoothly when AUTH_KV is missing from environment', async () => {
    const env = createMockEnv({ AUTH_KV: undefined });
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-no-kv',
      },
      body: JSON.stringify(baseOrder),
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(env.getInsertCount()).toBe(1);
  });
});
