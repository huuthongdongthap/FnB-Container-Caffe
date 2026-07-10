import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getKdsMobile,
  updateKdsStatus,
} from '../../routes/kds-mobile';
import { TEST_JWT_SECRET } from '../test-utils';

// ── Mock D1 ─────────────────────────────────────────────────────────

function makeDb(
  orders: any[] = [],
  updateSuccess = true
): any {
  return {
    prepare: (_sql: string) => {
      const stmt: any = { _sql: _sql, _binds: [] };
      stmt.bind = (...args: unknown[]) => {
        stmt._binds = args;
        return stmt;
      };
      stmt.run = async () => ({
        success: updateSuccess,
        changes: 1,
        lastRowId: 1,
      });
      stmt.first = async () => null;
      stmt.all = async () => {
        const sql = stmt._sql || '';
        if (sql.includes('SELECT') && sql.includes('orders') && sql.includes('JOIN')) {
          return { results: orders, success: true };
        }
        return { results: [], success: true };
      };
      stmt.raw = async () => [];
      return stmt;
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  };
}

// ── Mock Context ──────────────────────────────────────────────────────

function makeCtx(
  role: string,
  userId = 'USR_1',
  path: string = '/mobile/kds/orders',
  method: string = 'GET',
  body?: any,
  db = makeDb(),
): any {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const init: any = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  const req: any = {
    raw: new Request('https://test.aura' + path, init),
    json: async () => body ?? {},
    query: (_n: string) => '',
    param: (_n: string) => '',
    header: (_n: string) => 'curl/7.68',
  };

  const env: any = { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET };
  const jsonFn = (_data: unknown, status = 200) =>
    new Response(JSON.stringify(_data), { status, headers: { 'Content-Type': 'application/json' } });

  return {
    req,
    env,
    get: (key: string) => (key === 'user' ? { id: userId, email: `${userId}@t.co`, name: 'T', role } : undefined),
    set: vi.fn(),
    json: jsonFn,
  };
}

// ── beforeEach ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getKdsMobile ──────────────────────────────────────────────────────

describe('getKdsMobile', () => {
  const sampleOrders = [
    { id: 'ORD_1', table_id: 'TBL_1', items: '[]', status: 'pending', created_at: '2026-07-10T10:00:00Z', updated_at: '2026-07-10T10:00:00Z', table_name: 'BÀN 01' },
    { id: 'ORD_2', table_id: 'TBL_1', items: '[]', status: 'preparing', created_at: '2026-07-10T09:30:00Z', updated_at: '2026-07-10T09:30:00Z', table_name: 'BÀN 01' },
  ];

  it('200 + active orders for owner', async () => {
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/kds/orders', 'GET', undefined, makeDb(sampleOrders));
    const res = await getKdsMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.orders).toHaveLength(2);
    expect(body.orders[0].table_name).toBe('BÀN 01');
  });

  it('200 + empty array when no active orders', async () => {
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/kds/orders', 'GET', undefined, makeDb([]));
    const res = await getKdsMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toEqual([]);
  });

  it('403 for customer role', async () => {
    const ctx: any = makeCtx('customer', 'CUS_1', '/mobile/kds/orders', 'GET', undefined, makeDb(sampleOrders));
    const res = await getKdsMobile(ctx);
    expect(res.status).toBe(403);
  });

  it('200 for manager', async () => {
    const ctx: any = makeCtx('manager', 'USR_MGR', '/mobile/kds/orders', 'GET', undefined, makeDb(sampleOrders));
    const res = await getKdsMobile(ctx);
    expect(res.status).toBe(200);
  });

  it('200 for staff role', async () => {
    const ctx: any = makeCtx('staff', 'USR_KITCHEN', '/mobile/kds/orders', 'GET', undefined, makeDb(sampleOrders));
    const res = await getKdsMobile(ctx);
    expect(res.status).toBe(200);
  });

  it('items are JSON-parsed', async () => {
    const ordersWithItems: any[] = [
      {
        id: 'ORD_X',
        table_id: 'TBL_1',
        items: JSON.stringify([{ name: 'Cà phê sữa', qty: 2 }]),
        status: 'pending',
        created_at: '2026-07-10T10:00:00Z',
        updated_at: '2026-07-10T10:00:00Z',
        table_name: 'BÀN 01',
      },
    ];
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/kds/orders', 'GET', undefined, makeDb(ordersWithItems));
    const res = await getKdsMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders[0].items).toEqual([{ name: 'Cà phê sữa', qty: 2 }]);
  });

  it('500 on DB error', async () => {
    const badDb: any = {
      prepare: () => ({
        bind: () => ({}),
        run: async () => ({ success: true, changes: 1 }),
        first: async () => null,
        all: async () => { throw new Error('D1 offline'); },
        raw: async () => [],
      }),
      batch: async () => [],
      exec: async () => ({ count: 0 }),
    };
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/kds/orders', 'GET', undefined, badDb);
    const res = await getKdsMobile(ctx);
    expect(res.status).toBe(500);
  });
});

// ── updateKdsStatus ───────────────────────────────────────────────────

describe('updateKdsStatus', () => {
  it('200 on valid status update by owner', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/kds/orders/ORD_1/status', 'PATCH', { status: 'preparing' }, db);
    ctx.req.param = (n: string) => (n === 'id' ? 'ORD_1' : '');
    const res = await updateKdsStatus(ctx);
    expect(res.status).toBe(200);
  });

  it('200 on status = ready', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('staff', 'USR_KITCHEN', '/mobile/kds/orders/ORD_1/status', 'PATCH', { status: 'ready' }, db);
    ctx.req.param = (n: string) => (n === 'id' ? 'ORD_1' : '');
    const res = await updateKdsStatus(ctx);
    expect(res.status).toBe(200);
  });

  it('400 on invalid status value', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/kds/orders/ORD_1/status', 'PATCH', { status: 'delivered' }, db);
    ctx.req.param = (n: string) => (n === 'id' ? 'ORD_1' : '');
    const res = await updateKdsStatus(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('không hợp lệ');
  });

  it('403 for customer role', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('customer', 'CUS_1', '/mobile/kds/orders/ORD_1/status', 'PATCH', { status: 'preparing' }, db);
    ctx.req.param = (n: string) => (n === 'id' ? 'ORD_1' : '');
    const res = await updateKdsStatus(ctx);
    expect(res.status).toBe(403);
  });

  it('403 for waiter — cannot update KDS', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('waiter', 'USR_W', '/mobile/kds/orders/ORD_1/status', 'PATCH', { status: 'preparing' }, db);
    ctx.req.param = (n: string) => (n === 'id' ? 'ORD_1' : '');
    const res = await updateKdsStatus(ctx);
    expect(res.status).toBe(403);
  });

  it('400 when order id is missing', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/kds/orders//status', 'PATCH', { status: 'preparing' }, db);
    ctx.req.param = (n: string) => '';
    const res = await updateKdsStatus(ctx);
    expect(res.status).toBe(400);
  });

  it('500 on DB failure during update', async () => {
    const badDb: any = {
      prepare: () => ({
        bind: () => ({}),
        run: async () => { throw new Error('D1 conn lost'); },
        first: async () => null,
        all: async () => ({ results: [] }),
        raw: async () => [],
      }),
      batch: async () => [],
      exec: async () => ({ count: 0 }),
    };
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/kds/orders/ORD_1/status', 'PATCH', { status: 'completed' }, badDb);
    ctx.req.param = (n: string) => (n === 'id' ? 'ORD_1' : '');
    const res = await updateKdsStatus(ctx);
    expect(res.status).toBe(500);
  });
});
