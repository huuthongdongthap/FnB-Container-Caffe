/**
 * Checkin Route Tests — /api/checkin
 * Check-in rewards with staff approval flow.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    checkins: [...(seedData.checkins || [])],
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

  // Extract column names referenced in WHERE clause in order
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
                const rowVal = (row as Record<string, unknown>)[whereCols[i]];
                if (String(rowVal) !== String(bindValues[i])) { match = false; break; }
              }
              if (match) return row;
            }
            return null;
          }
          return rows[0] || null;
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
  const mod = await import('../worker/src/routes/checkin.ts');
  router = mod.checkinRouter;
});

describe('POST /', () => {
  test('creates a check-in and returns 201', async () => {
    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', name: 'Nguyen Van A' }],
    });

    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: 'cust1', customer_name: 'Nguyen Van A' }),
    }, env);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pending');
  });

  test('returns 400 when customer_id is missing', async () => {
    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 on duplicate check-in same day', async () => {
    const todayISO = new Date().toISOString().slice(0, 10);
    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', name: 'A' }],
      checkins: [{ id: 'ci_existing', customer_id: 'cust1', checkin_date: todayISO, status: 'pending' }],
    });

    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: 'cust1' }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Already checked in/i);
  });

  test('handles DB error gracefully', async () => {
    env.AURA_DB = createMockD1({ customers: [{ id: 'cust1', name: 'A' }] });
    // Make prepare throw on run
    const origPrepare = env.AURA_DB.prepare;
    env.AURA_DB.prepare = vi.fn((sql: string) => {
      const stmt = origPrepare(sql);
      stmt.run = vi.fn(async () => { throw new Error('DB Error'); });
      return stmt;
    });

    const res = await router.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: 'cust1' }),
    }, env);

    // Route has no try/catch but Hono handles it — should still get a response
    expect(res.status).toBe(500);
  });
});

describe('GET /', () => {
  test('returns list of check-ins', async () => {
    env.AURA_DB = createMockD1({
      checkins: [{ id: 'ci1', customer_id: 'cust1', status: 'pending', reward_amount: 5000, checkin_date: '2026-07-01' }],
    });

    const res = await router.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  test('returns 200 with empty array when no check-ins', async () => {
    const res = await router.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });
});
