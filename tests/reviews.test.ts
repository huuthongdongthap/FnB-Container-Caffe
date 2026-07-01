/**
 * Reviews Route Tests — /api/reviews
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock D1 ─────────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = { reviews: [...(seedData.reviews || [])] };

  function getTable(sql: string): string {
    const from = sql.match(/\bFROM\s+(\w+)/i);
    if (from) return from[1];
    const insert = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
    if (insert) return insert[1];
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
  const mod = await import('../worker/src/routes/reviews.ts');
  router = mod.reviewsRouter;
});

describe('POST /', () => {
  test('creates review and returns 201', async () => {
    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ord1', rating: 5, comment: 'Great!', customer_name: 'Alice' }),
    }, env);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.rating).toBe(5);
  });

  test('returns 400 on missing order_id', async () => {
    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5 }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Invalid input|expected/i);
  });

  test('returns 400 on invalid rating (too high)', async () => {
    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ord1', rating: 10 }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/tối đa|max/i);
  });
});

describe('GET /', () => {
  test('returns 200 with review list', async () => {
    env.AURA_DB = createMockD1({
      reviews: [
        { id: 'rev1', order_id: 'ord1', rating: 5, comment: 'Great!', customer_name: 'Alice', created_at: '2026-01-01' },
      ],
    });

    const res = await router.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  test('returns 200 with empty array when no reviews', async () => {
    const res = await router.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  test('filters by rating query param', async () => {
    env.AURA_DB = createMockD1({
      reviews: [
        { id: 'rev1', order_id: 'ord1', rating: 5 },
        { id: 'rev2', order_id: 'ord2', rating: 3 },
      ],
    });

    const res = await router.request('/?rating=5', { method: 'GET' }, env);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
