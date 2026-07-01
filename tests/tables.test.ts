/**
 * Tables Routes Tests — GET /api/tables, GET /:id, PATCH /:id/status
 *
 * Tests for tablesRouter with D1 data and auth middleware.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock requireAuth — bypass auth for PATCH routes ───────────────
vi.mock('../worker/src/middleware/auth.js', () => ({
  requireAuth: () => {
    return async (c: any, next: any) => {
      c.set('user', { id: 'test-user', email: 'owner@test.com', name: 'Test Owner', role: 'owner' });
      await next();
    };
  },
}));

// ── Mock D1 Database ──────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {};
  ['cafe_tables'].forEach(t => { tables[t] = [...(seedData[t] || [])]; });

  function parseWhere(sql: string) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    const table = fromMatch ? fromMatch[1] : null;
    const condMatch = sql.match(/(\w+)\s*(>=|<=|!=|>|<|=)\s*(\?|'[^']*'|"[^"]*"|\d+)/g);
    if (!condMatch || !table) return null;
    const conditions: Array<{ col: string; op: string; bindIdx?: number; literal?: string | number }> = [];
    let bindIdx = 0;
    for (const c of condMatch) {
      const m = c.match(/(\w+)\s*(>=|<=|!=|>|<|=)\s*(\?|'[^']*'|"[^"]*"|\d+)/)!;
      const col = m[1];
      const op = m[2];
      const vt = m[3];
      // Skip guard clauses like 1=1
      if (col === '1' && op === '=' && vt === '1') continue;
      if (vt === '?') { conditions.push({ col, op, bindIdx }); bindIdx++; }
      else if (vt.startsWith("'") || vt.startsWith('"')) { conditions.push({ col, op, literal: vt.slice(1, -1) }); }
      else { conditions.push({ col, op, literal: Number(vt) }); }
    }
    if (conditions.length === 0) return null;
    return { table, conditions };
  }

  function matchRow(row: any, conditions: any[], bindValues: any[]) {
    for (const cond of conditions) {
      const val = cond.literal !== undefined ? cond.literal : bindValues[cond.bindIdx];
      const rowVal = row[cond.col];
      if (rowVal == null && val != null) return false;
      switch (cond.op) {
        case '=':  if (String(rowVal) !== String(val)) return false; break;
        case '>':  if (Number(rowVal) <= Number(val)) return false; break;
        case '<':  if (Number(rowVal) >= Number(val)) return false; break;
        default:   if (String(rowVal) !== String(val)) return false; break;
      }
    }
    return true;
  }

  function getPrimaryTable(sql: string) {
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : null;
  }

  const db = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q, _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
        first: vi.fn(async function () {
          const parsed = parseWhere(q);
          const table = getPrimaryTable(q);
          const rows = (table && tables[table]) ? tables[table] : [];
          if (!parsed || !rows.length) return rows[0] || null;
          const matched = rows.filter(r => matchRow(r, parsed.conditions, this._bindValues));
          return matched[0] || null;
        }),
        all: vi.fn(async function () {
          const parsed = parseWhere(q);
          const table = getPrimaryTable(q);
          const rows = (table && tables[table]) ? tables[table] : [];
          if (!parsed || !rows.length) return { results: [...rows] };
          const matched = rows.filter(r => matchRow(r, parsed.conditions, this._bindValues));
          return { results: matched };
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      return stmt;
    }),
  };
  return db;
}

const seedTables = [
  { id: 't1', table_number: 1, zone: 'Trong nha', capacity: 4, status: 'Available' },
  { id: 't2', table_number: 2, zone: 'Trong nha', capacity: 6, status: 'Occupied' },
  { id: 't3', table_number: 3, zone: 'Ngoai troi', capacity: 2, status: 'Available' },
];

let tablesRouter: any;
let env: any;

beforeEach(() => {
  vi.clearAllMocks();
});

async function mountRouter() {
  const mod = await import('../worker/src/routes/tables');
  tablesRouter = mod.tablesRouter;
}

describe('GET /', () => {
  test('returns all tables', async () => {
    env = { AURA_DB: createMockD1({ cafe_tables: seedTables }) };
    await mountRouter();

    const res = await tablesRouter.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(3);
  });

  test('filters by zone', async () => {
    env = { AURA_DB: createMockD1({ cafe_tables: seedTables }) };
    await mountRouter();

    const res = await tablesRouter.request('/?zone=Ngoai+troi', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].zone).toBe('Ngoai troi');
  });

  test('filters by status', async () => {
    env = { AURA_DB: createMockD1({ cafe_tables: seedTables }) };
    await mountRouter();

    const res = await tablesRouter.request('/?status=Occupied', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].status).toBe('Occupied');
  });
});

describe('GET /:id', () => {
  test('returns single table', async () => {
    env = { AURA_DB: createMockD1({ cafe_tables: seedTables }) };
    await mountRouter();

    const res = await tablesRouter.request('/t1', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.table_number).toBe(1);
  });

  test('returns 404 when not found', async () => {
    env = { AURA_DB: createMockD1({ cafe_tables: seedTables }) };
    await mountRouter();

    const res = await tablesRouter.request('/nonexistent', { method: 'GET' }, env);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not found/i);
  });
});

describe('PATCH /:id/status', () => {
  test('updates table status to Occupied', async () => {
    env = { AURA_DB: createMockD1({ cafe_tables: seedTables }) };
    await mountRouter();

    const res = await tablesRouter.request('/t1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Occupied' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/t1/);
  });

  test('returns 400 on invalid status', async () => {
    env = { AURA_DB: createMockD1({ cafe_tables: seedTables }) };
    await mountRouter();

    const res = await tablesRouter.request('/t1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'InvalidStatus' }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 on empty body', async () => {
    env = { AURA_DB: createMockD1({ cafe_tables: seedTables }) };
    await mountRouter();

    const res = await tablesRouter.request('/t1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
