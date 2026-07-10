import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTablesMobile, updateTableStatus } from '../../routes/tables-mobile';
import { createMockEnv, createMockKV, TEST_JWT_SECRET } from '../test-utils';

// ── Helpers ──────────────────────────────────────────────────────────

function buildTablesMockDb(tables: Array<Record<string, unknown>>): any {
  const tableMap = new Map(tables.map(t => [t.id as string, t]));

  return {
    prepare: (_sql: string) => {
      const s: any = {
        _sql: _sql,
        _binds: [] as unknown[],
      };
      s.bind = (...args: unknown[]) => { s._binds = args; return s; };
      s.first = async () => {
        const sql = s._sql || '';
        if (sql.includes('SELECT') || sql.includes('UPDATE')) {
          const id = String(s._binds[0]);
          return tableMap.get(id) ?? null;
        }
        return null;
      };
      s.all = async () => {
        const sql = s._sql || '';
        if (sql.includes('FROM tables')) return { results: tables, success: true };
        return { results: [], success: true };
      };
      s.run = async () => ({ success: true, changes: 1 });
      return s;
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  };
}

function mockTablesContext(opts: {
  role?: string;
  method?: string;
  tableId?: string;
  tables?: Array<Record<string, unknown>>;
  body?: unknown;
} = {}): any {
  const role = opts.role ?? 'staff';
  const method = opts.method ?? 'GET';
  const tableId = opts.tableId ?? 'TBL_1';
  const tables = opts.tables ?? [
    { id: 'TBL_1', name: 'Bàn 1', status: 'free', capacity: 4, created_at: '2026-07-01T08:00:00Z' },
    { id: 'TBL_2', name: 'Bàn 2', status: 'occupied', capacity: 2, created_at: '2026-07-01T08:00:00Z' },
    { id: 'TBL_3', name: 'Bàn 3', status: 'reserved', capacity: 6, created_at: '2026-07-01T08:00:00Z' },
  ];

  const db = buildTablesMockDb(tables);

  const rawHeaders: Record<string, string> = {};
  if (method === 'PATCH' && opts.body !== undefined) {
    rawHeaders['Content-Type'] = 'application/json';
  }

  const reqBody = method === 'PATCH' && opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  const req: any = {
    raw: new Request(`https://test.aura/mobile/tables/${method === 'PATCH' ? tableId : ''}`, {
      method,
      headers: rawHeaders,
      body: reqBody,
    }),
    param: (name: string) => name === 'id' ? tableId : undefined,
    query: () => undefined,
    json: async () => opts.body ?? {},
    header: () => '',
  };

  return {
    req,
    env: { AURA_DB: db, AUTH_KV: createMockKV(), JWT_SECRET: TEST_JWT_SECRET },
    get: (key: string) => key === 'user' ? { id: 'USR_1', email: 'staff@test.local', name: 'Staff', role } : undefined,
    set: () => {},
    json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('getTablesMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const sampleTables = [
    { id: 'TBL_1', name: 'Bàn 1', status: 'free', capacity: 4, created_at: '2026-07-01T08:00:00Z' },
    { id: 'TBL_2', name: 'Bàn 2', status: 'occupied', capacity: 2, created_at: '2026-07-01T08:00:00Z' },
  ];

  it('returns 200 + tables for owner', async () => {
    const ctx: any = mockTablesContext({ role: 'owner', tables: sampleTables });
    const res = await getTablesMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tables).toHaveLength(2);
  });

  it('returns 200 + tables for manager', async () => {
    const ctx: any = mockTablesContext({ role: 'manager', tables: sampleTables });
    const res = await getTablesMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tables).toHaveLength(2);
  });

  it('returns 200 + tables for staff', async () => {
    const ctx: any = mockTablesContext({ role: 'staff', tables: sampleTables });
    const res = await getTablesMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tables).toHaveLength(2);
  });

  it('returns 200 + tables for waiter', async () => {
    const ctx: any = mockTablesContext({ role: 'waiter', tables: sampleTables });
    const res = await getTablesMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tables).toHaveLength(2);
  });

  it('returns 200 + empty array when no tables exist', async () => {
    const ctx: any = mockTablesContext({ role: 'owner', tables: [] });
    const res = await getTablesMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tables).toHaveLength(0);
  });

  it('includes table name and status in response', async () => {
    const ctx: any = mockTablesContext({ role: 'owner', tables: sampleTables });
    const res = await getTablesMobile(ctx);
    const body = await res.json();
    expect(body.tables[0].name).toBe('Bàn 1');
    expect(body.tables[0].status).toBe('free');
  });

  it('returns 500 on database error', async () => {
    const badDb: any = {
      prepare: () => ({
        bind: () => ({
          all: async () => { throw new Error('D1 down'); },
        }),
      }),
    };
    const ctx: any = {
      req: {
        raw: new Request('https://test.aura/mobile/tables', { method: 'GET' }),
        param: () => undefined,
        query: () => undefined,
        json: async () => ({}),
        header: () => '',
      },
      env: { AURA_DB: badDb, AUTH_KV: createMockKV(), JWT_SECRET: TEST_JWT_SECRET },
      get: (key: string) => key === 'user' ? { id: 'USR_1', role: 'owner' } : undefined,
      set: () => {},
      json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
    };
    const res = await getTablesMobile(ctx);
    expect(res.status).toBe(500);
  });
});

describe('updateTableStatus', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when table_id is missing', async () => {
    const ctx: any = {
      ...mockTablesContext({ role: 'owner' }),
      req: {
        ...mockTablesContext({ role: 'owner' }).req,
        param: () => undefined,
      },
    };
    const res = await updateTableStatus(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 404 when table does not exist', async () => {
    const emptyDb: any = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          run: async () => ({ success: true, changes: 0 }),
        }),
      }),
    };
    const ctx: any = {
      req: {
        raw: new Request('https://test.aura/mobile/tables/TBL_99', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'occupied' }),
        }),
        param: () => 'TBL_99',
        query: () => undefined,
        json: async () => ({ status: 'occupied' }),
        header: () => '',
      },
      env: { AURA_DB: emptyDb, AUTH_KV: createMockKV(), JWT_SECRET: TEST_JWT_SECRET },
      get: (key: string) => key === 'user' ? { id: 'USR_1', role: 'owner' } : undefined,
      set: () => {},
      json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
    };
    const res = await updateTableStatus(ctx);
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing status in body', async () => {
    const ctx: any = mockTablesContext({ role: 'owner', tableId: 'TBL_1', body: {} });
    const res = await updateTableStatus(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status value', async () => {
    const ctx: any = mockTablesContext({
      role: 'owner',
      tableId: 'TBL_1',
      body: { status: 'broken' },
    });
    const res = await updateTableStatus(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 200 when owner updates table to occupied', async () => {
    const ctx: any = mockTablesContext({
      role: 'owner',
      tableId: 'TBL_1',
      body: { status: 'occupied' },
    });
    const res = await updateTableStatus(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 200 when waiter updates table to reserved', async () => {
    const ctx: any = mockTablesContext({
      role: 'waiter',
      tableId: 'TBL_1',
      body: { status: 'reserved' },
    });
    const res = await updateTableStatus(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 200 when manager updates table to free', async () => {
    const ctx: any = mockTablesContext({
      role: 'manager',
      tableId: 'TBL_1',
      body: { status: 'free' },
    });
    const res = await updateTableStatus(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 403 when kitchen staff tries to update table', async () => {
    const ctx: any = mockTablesContext({
      role: 'staff',
      tableId: 'TBL_1',
      body: { status: 'occupied' },
    });
    const res = await updateTableStatus(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 403 when customer tries to update table', async () => {
    const ctx: any = mockTablesContext({
      role: 'customer',
      tableId: 'TBL_1',
      body: { status: 'occupied' },
    });
    const res = await updateTableStatus(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 200 + updated table data in response', async () => {
    const ctx: any = mockTablesContext({
      role: 'owner',
      tableId: 'TBL_1',
      body: { status: 'occupied' },
    });
    const res = await updateTableStatus(ctx);
    const body = await res.json();
    expect(body.table).toBeDefined();
    expect(body.table.status).toBe('occupied');
  });
});
