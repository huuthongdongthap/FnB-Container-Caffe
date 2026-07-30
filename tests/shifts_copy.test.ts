import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock requireAuth — bypass auth for POST routes ──────────────────
vi.mock('../worker/src/middleware/auth.js', () => ({
  requireAuth: () => {
    return async (c: any, next: any) => {
      c.set('user', { id: 'test-user', email: 'staff@test.com', name: 'Test Staff', role: 'staff' });
      await next();
    };
  },
}));

// ── Mock D1 Database ──────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tableData: Record<string, any[]> = {};
  ['shifts'].forEach(t => { tableData[t] = [...(seedData[t] || [])]; });

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
          const table = getPrimaryTable(q);
          const rows = (table && tableData[table]) ? tableData[table] : [];
          const whereMatch = q.match(/WHERE\s+(\w+)\s*=\s*\?/g);
          if (whereMatch && this._bindValues.length > 0) {
            return rows.find((r: any) => {
              const conditions = whereMatch.map((w: string) => {
                const m = w.match(/WHERE\s+(\w+)\s*=\s*\?/i) || w.match(/AND\s+(\w+)\s*=\s*\?/i);
                return m ? m[1] : null;
              }).filter(Boolean);
              return conditions.every((col: string, i: number) => String(r[col]) === String(this._bindValues[i]));
            }) || null;
          }
          return rows[0] || null;
        }),
        all: vi.fn(async function () {
          const table = getPrimaryTable(q);
          const rows = (table && tableData[table]) ? tableData[table] : [];
          return { results: [...rows] };
        }),
        run: vi.fn(async function () {
          const insertMatch = q.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
          if (insertMatch) {
            const tbl = insertMatch[1];
            if (!tableData[tbl]) tableData[tbl] = [];
            const row: Record<string, unknown> = {};
            const cols = q.match(/\(([^)]+)\)/);
            if (cols) {
              const names = cols[1].split(',').map((c: string) => c.trim());
              names.forEach((n: string, i: number) => { row[n] = this._bindValues[i]; });
            }
            tableData[tbl].push(row);
          }
          return { success: true, meta: { last_row_id: tableData.shifts?.length || 0 } } as any;
        }),
      };
      return stmt;
    }),
  };
  return db;
}

let shiftsRouter: any;
let env: any;

beforeEach(() => { vi.clearAllMocks(); });

async function mountRouter() {
  const mod = await import('../worker/src/routes/shifts');
  shiftsRouter = mod.shiftsRouter;
}

describe('POST /clock-in', () => {
  test('clocks in staff and returns 201', async () => {
    env = { JWT_SECRET: 'test-secret', AURA_DB: createMockD1({ shifts: [] }) };
    await mountRouter();
    const res = await shiftsRouter.request('/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: 's1', staff_name: 'Staff One' }),
    }, env);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.staff_id).toBe('s1');
    expect(body.data.staff_name).toBe('Staff One');
  });

  test('returns 400 on missing staff_id', async () => {
    env = { JWT_SECRET: 'test-secret', AURA_DB: createMockD1({ shifts: [] }) };
    await mountRouter();
    const res = await shiftsRouter.request('/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_name: 'No ID' }),
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 on already clocked in today', async () => {
    const existingShift = { id: 'shift_existing', staff_id: 's1', staff_name: 'Staff One', clock_in: new Date().toISOString(), clock_out: null, date: new Date().toISOString().slice(0, 10), notes: null };
    env = { JWT_SECRET: 'test-secret', AURA_DB: createMockD1({ shifts: [existingShift] }) };
    await mountRouter();
    const res = await shiftsRouter.request('/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: 's1', staff_name: 'Staff One' }),
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already clocked/i);
  });
});

describe('POST /clock-out', () => {
  test('clocks out and returns 200', async () => {
    const activeShift = { id: 'shift_active', staff_id: 's1', staff_name: 'Staff One', clock_in: new Date(Date.now() - 3600000).toISOString(), clock_out: null, date: new Date().toISOString().slice(0, 10), notes: null };
    env = { JWT_SECRET: 'test-secret', AURA_DB: createMockD1({ shifts: [activeShift] }) };
    await mountRouter();
    const res = await shiftsRouter.request('/clock-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: 's1' }),
    }, env);
    
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('returns 400 on missing staff_id', async () => {
    env = { JWT_SECRET: 'test-secret', AURA_DB: createMockD1({ shifts: [] }) };
    await mountRouter();
    const res = await shiftsRouter.request('/clock-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 404 when no active shift', async () => {
    env = { JWT_SECRET: 'test-secret', AURA_DB: createMockD1({ shifts: [] }) };
    await mountRouter();
    const res = await shiftsRouter.request('/clock-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: 's1' }),
    }, env);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no active shift/i);
  });
});

describe('GET /', () => {
  test('returns shifts list', async () => {
    env = { JWT_SECRET: 'test-secret', AURA_DB: createMockD1({ shifts: [ { id: 's1', staff_id: 's1', staff_name: 'Staff One', clock_in: '2026-07-01T08:00:00Z', clock_out: '2026-07-01T17:00:00Z', hours_worked: 9, date: '2026-07-01', notes: null } ] }) };
    await mountRouter();
    const res = await shiftsRouter.request('/', { method: 'GET' }, env);
    
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].staff_id).toBe('s1');
  });

  test('returns empty array when no shifts', async () => {
    env = { JWT_SECRET: 'test-secret', AURA_DB: createMockD1({ shifts: [] }) };
    await mountRouter();
    const res = await shiftsRouter.request('/', { method: 'GET' }, env);
    
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  test('accepts query parameters without error', async () => {
    env = { JWT_SECRET: 'test-secret', AURA_DB: createMockD1({ shifts: [] }) };
    await mountRouter();
    const res = await shiftsRouter.request('/?from=2026-07-01&to=2026-07-31&staff_id=s1', { method: 'GET' }, env);
    
  });
});
