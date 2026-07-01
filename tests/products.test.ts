/**
 * Products Route Tests — /api/products
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    products: [...(seedData.products || [])],
    categories: [...(seedData.categories || [])],
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

  return {
    prepare: vi.fn((sql: string) => {
      const bindValues: any[] = [];
      const stmt: any = {
        _sql: sql,
        bind: vi.fn((...vals: any[]) => { bindValues.push(...vals); return stmt; }),
        first: vi.fn(async () => {
          const t = getTable(sql);
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
  return { AURA_DB: createMockD1(), ...overrides };
}

let router: any;
let env: ReturnType<typeof createEnv>;

beforeEach(async () => {
  vi.clearAllMocks();
  env = createEnv();
  const mod = await import('../worker/src/routes/products.ts');
  router = mod.productsRouter;
});

describe('GET /', () => {
  test('returns 200 with product list', async () => {
    env.AURA_DB = createMockD1({
      products: [
        { id: 'p1', name: 'Espresso', price: 35000, category_id: 'cat1', is_available: 1 },
        { id: 'p2', name: 'Latte', price: 45000, category_id: 'cat1', is_available: 1 },
      ],
    });

    const res = await router.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  test('returns 200 with empty array when no products', async () => {
    const res = await router.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });
});

describe('GET /:id', () => {
  test('returns 200 with single product', async () => {
    env.AURA_DB = createMockD1({
      products: [{ id: 'p1', name: 'Espresso', price: 35000 }],
    });

    const res = await router.request('/p1', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Espresso');
  });

  test('returns 404 when not found', async () => {
    const res = await router.request('/nonexistent', { method: 'GET' }, env);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('POST /', () => {
  test('creates product and returns 201', async () => {
    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Product', price: 25000 }),
    }, env);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('New Product');
  });

  test('returns 400 on missing name', async () => {
    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 25000 }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Invalid input|expected/i);
  });

  test('returns 400 on invalid price (negative)', async () => {
    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'P', price: -100 }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('PUT /:id', () => {
  test('updates product and returns 200', async () => {
    env.AURA_DB = createMockD1({
      products: [{ id: 'p1', name: 'Espresso', price: 35000, slug: '', category_id: 'cat1', image_url: '', is_available: 1, sort_order: 0, compare_at_price: null, description: '' }],
    });

    const res = await router.request('/p1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Double Espresso', price: 40000 }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('returns 404 when not found', async () => {
    const res = await router.request('/nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    }, env);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('DELETE /:id', () => {
  test('deletes product and returns 200', async () => {
    env.AURA_DB = createMockD1({
      products: [{ id: 'p1', name: 'Espresso', price: 35000 }],
    });

    const res = await router.request('/p1', { method: 'DELETE' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('returns 404 when not found', async () => {
    const res = await router.request('/nonexistent', { method: 'DELETE' }, env);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
