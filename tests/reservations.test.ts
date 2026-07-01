/**
 * Reservations Route Tests — /api/reservations
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    cafe_tables: [...(seedData.cafe_tables || [])],
    reservations: [...(seedData.reservations || [])],
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
          return rows[0] || null;
        }),
        all: vi.fn(async () => {
          const t = getTable(sql);
          const rows = tables[t] || [];
          const whereCols = extractWhereCols(sql);
          if (whereCols.length > 0 && bindValues.length > 0) {
            const filtered = rows.filter(r => {
              for (let i = 0; i < Math.min(whereCols.length, bindValues.length); i++) {
                if (String((r as Record<string, unknown>)[whereCols[i]]) !== String(bindValues[i])) return false;
              }
              return true;
            });
            return { results: filtered };
          }
          return { results: [...rows] };
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
  return { AURA_DB: createMockD1(), JWT_SECRET: 'test-secret', AUTH_KV: null, ...overrides };
}

let router: any;
let env: ReturnType<typeof createEnv>;

beforeEach(async () => {
  vi.clearAllMocks();
  env = createEnv();
  const mod = await import('../worker/src/routes/reservations.ts');
  router = mod.reservationsRouter;
});

describe('GET /availability', () => {
  test('returns 200 with table availability', async () => {
    env.AURA_DB = createMockD1({
      cafe_tables: [
        { id: 't1', table_number: 1, zone: 'Indoor', capacity: 4 },
        { id: 't2', table_number: 2, zone: 'Outdoor', capacity: 6 },
      ],
    });

    const res = await router.request('/availability?date=2026-07-15', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].available).toBe(true);
  });

  test('returns 400 when date is missing', async () => {
    const res = await router.request('/availability', { method: 'GET' }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/date is required/i);
  });
});

describe('POST /', () => {
  test('creates reservation and returns 201', async () => {
    env.AURA_DB = createMockD1({
      cafe_tables: [{ id: 't1', table_number: 1, zone: 'Indoor', capacity: 4 }],
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_id: 't1',
        customer_name: 'Alice',
        customer_phone: '0912345678',
        date: dateStr,
        time: '18:00',
        guest_count: 4,
      }),
    }, env);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.table_id).toBe('t1');
  });

  test('returns 400 on missing required fields', async () => {
    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 404 when table not found', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_id: 'nonexistent',
        customer_name: 'Alice',
        customer_phone: '0912345678',
        date: dateStr,
        time: '18:00',
      }),
    }, env);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/Table not found/i);
  });

  test('returns 409 when table is already reserved', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    env.AURA_DB = createMockD1({
      cafe_tables: [{ id: 't1', table_number: 1, zone: 'Indoor', capacity: 4 }],
      reservations: [{ id: 'rsv1', table_id: 't1', date: dateStr, time: '18:00', status: 'confirmed' }],
    });

    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_id: 't1',
        customer_name: 'Alice',
        customer_phone: '0912345678',
        date: dateStr,
        time: '18:00',
      }),
    }, env);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already reserved/i);
  });
});
