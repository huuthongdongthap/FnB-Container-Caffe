/**
 * Categories Route Tests — /api/categories
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock D1 ─────────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = { categories: [...(seedData.categories || [])] };

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
  const mod = await import('../worker/src/routes/categories.ts');
  router = mod.categoriesRouter;
});

describe('GET /', () => {
  test('returns 200 with category list', async () => {
    env.AURA_DB = createMockD1({
      categories: [
        { id: 'cat1', name: 'Coffee', slug: 'coffee', sort_order: 1 },
        { id: 'cat2', name: 'Tea', slug: 'tea', sort_order: 2 },
      ],
    });

    const res = await router.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  test('returns 200 with empty array when no categories', async () => {
    const res = await router.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });
});

describe('GET /:id', () => {
  test('returns 200 with single category', async () => {
    env.AURA_DB = createMockD1({
      categories: [{ id: 'cat1', name: 'Coffee', slug: 'coffee', sort_order: 1 }],
    });

    const res = await router.request('/cat1', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Coffee');
  });

  test('returns 404 when not found', async () => {
    const res = await router.request('/nonexistent', { method: 'GET' }, env);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('POST /', () => {
  test('creates category and returns 201', async () => {
    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Category' }),
    }, env);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('New Category');
  });

  test('returns 400 on missing name', async () => {
    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Invalid input|expected/i);
  });
});

describe('PUT /:id', () => {
  test('updates category and returns 200', async () => {
    env.AURA_DB = createMockD1({
      categories: [{ id: 'cat1', name: 'Coffee', slug: 'coffee', sort_order: 1 }],
    });

    const res = await router.request('/cat1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Coffee' }),
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
  test('deletes category and returns 200', async () => {
    env.AURA_DB = createMockD1({
      categories: [{ id: 'cat1', name: 'Coffee', slug: 'coffee', sort_order: 1 }],
    });

    const res = await router.request('/cat1', { method: 'DELETE' }, env);
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
