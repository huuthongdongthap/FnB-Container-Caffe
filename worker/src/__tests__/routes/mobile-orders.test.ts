import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrdersMobile, createOrderMobile, getOrderDetail } from '../../routes/orders-mobile';
import { createMockEnv, createMockKV, TEST_JWT_SECRET } from '../test-utils';

// ── Helpers ──────────────────────────────────────────────────────────

function buildOrdersMockDb(orders: Array<Record<string, unknown>>): any {
  const orderMap = new Map(orders.map(o => [o.id as string, o]));

  return {
    prepare: (_sql: string) => {
      const s: any = { _sql, _binds: [] as unknown[] };
      s.bind = (...args: unknown[]) => { s._binds = args; return s; };
      s.first = async () => {
        const sql = s._sql || '';
        if (sql.includes('WHERE id = ?')) {
          const id = String(s._binds[0]);
          return orderMap.get(id) ?? null;
        }
        return null;
      };
      s.all = async () => {
        const sql = s._sql || '';
        if (sql.includes('FROM orders')) {
          if (sql.includes('WHERE') && s._binds.length > 0) {
            const tableId = String(s._binds[0]);
            return { results: orders.filter(o => o.table_id === tableId), success: true };
          }
          return { results: orders, success: true };
        }
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

function mockOrdersContext(opts: {
  role?: string;
  method?: string;
  body?: unknown;
  orderId?: string;
  tableId?: string;
  orders?: Array<Record<string, unknown>>;
} = {}): any {
  const role = opts.role ?? 'staff';
  const method = opts.method ?? 'GET';
  const tableId = opts.tableId ?? 'TBL_1';
  const orderId = opts.orderId ?? 'ORD_1';
  const orders = opts.orders ?? [
    {
      id: 'ORD_1',
      table_id: 'TBL_1',
      items: JSON.stringify([{ name: 'Phở bò', qty: 1, price: 45000 }]),
      status: 'pending',
      created_at: '2026-07-10T08:00:00Z',
      updated_at: '2026-07-10T08:00:00Z',
    },
    {
      id: 'ORD_2',
      table_id: 'TBL_2',
      items: JSON.stringify([{ name: 'Bún chả', qty: 2, price: 50000 }]),
      status: 'pending',
      created_at: '2026-07-10T08:05:00Z',
      updated_at: '2026-07-10T08:05:00Z',
    },
  ];

  const db = buildOrdersMockDb(orders);

  const rawHeaders: Record<string, string> = {};
  if (method !== 'GET' && opts.body !== undefined) {
    rawHeaders['Content-Type'] = 'application/json';
  }

  // Determine path
  let path = 'https://test.aura/mobile/orders';
  if (method === 'GET' && opts.orderId) {
    path = `https://test.aura/mobile/orders/${opts.orderId}`;
  }

  const req: any = {
    raw: new Request(path, {
      method,
      headers: rawHeaders,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
    param: (name: string) => {
      if (name === 'id') return opts.orderId ?? undefined;
      return undefined;
    },
    query: (name: string) => name === 'table_id' ? (opts.tableId ?? undefined) : undefined,
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

describe('getOrdersMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const sampleOrders = [
    { id: 'ORD_1', table_id: 'TBL_1', items: '[{"name":"Phở","qty":1,"price":45000}]', status: 'pending', created_at: '2026-07-10T08:00:00Z', updated_at: '2026-07-10T08:00:00Z' },
    { id: 'ORD_2', table_id: 'TBL_2', items: '[{"name":"Bún","qty":2,"price":30000}]', status: 'pending', created_at: '2026-07-10T08:05:00Z', updated_at: '2026-07-10T08:05:00Z' },
  ];

  it('returns 200 + all orders for owner', async () => {
    const ctx: any = mockOrdersContext({ role: 'owner', orders: sampleOrders });
    const res = await getOrdersMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.orders).toHaveLength(2);
  });

  it('returns 200 + all orders for manager', async () => {
    const ctx: any = mockOrdersContext({ role: 'manager', orders: sampleOrders });
    const res = await getOrdersMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(2);
  });

  it('returns 200 + all orders for staff (kitchen)', async () => {
    const ctx: any = mockOrdersContext({ role: 'staff', orders: sampleOrders });
    const res = await getOrdersMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(2);
  });

  it('returns 200 + all orders for waiter', async () => {
    const ctx: any = mockOrdersContext({ role: 'waiter', orders: sampleOrders });
    const res = await getOrdersMobile(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(2);
  });

  it('returns 403 for customer role', async () => {
    const ctx: any = mockOrdersContext({ role: 'customer', orders: sampleOrders });
    const res = await getOrdersMobile(ctx);
    expect(res.status).toBe(403);
  });

  it('filters orders by table_id query parameter', async () => {
    const ctx: any = mockOrdersContext({ role: 'owner', tableId: 'TBL_1', orders: sampleOrders });
    const res = await getOrdersMobile(ctx);
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].table_id).toBe('TBL_1');
  });

  it('parses items JSON from string field', async () => {
    const ctx: any = mockOrdersContext({ role: 'owner', orders: sampleOrders });
    const res = await getOrdersMobile(ctx);
    const body = await res.json();
    expect(Array.isArray(body.orders[0].items)).toBe(true);
    expect(body.orders[0].items[0].name).toBe('Phở');
  });

  it('returns 500 on database error', async () => {
    const badDb: any = {
      prepare: () => ({
        bind: (..._args: unknown[]) => ({
          all: async () => { throw new Error('D1 error'); },
        }),
      }),
    };
    const ctx: any = {
      req: {
        raw: new Request('https://test.aura/mobile/orders', { method: 'GET' }),
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
    const res = await getOrdersMobile(ctx);
    expect(res.status).toBe(500);
  });
});

describe('createOrderMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const validOrderBody = {
    table_id: 'TBL_1',
    items: [{ name: 'Cà phê sữa', qty: 2, price: 25000, note: 'Ít đường' }],
  };

  it('returns 201 for owner creating order', async () => {
    const ctx: any = mockOrdersContext({
      role: 'owner',
      method: 'POST',
      body: validOrderBody,
    });
    const res = await createOrderMobile(ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.order_id).toBeTruthy();
  });

  it('returns 201 for manager creating order', async () => {
    const ctx: any = mockOrdersContext({
      role: 'manager',
      method: 'POST',
      body: validOrderBody,
    });
    const res = await createOrderMobile(ctx);
    expect(res.status).toBe(201);
  });

  it('returns 201 for waiter creating order', async () => {
    const ctx: any = mockOrdersContext({
      role: 'waiter',
      method: 'POST',
      body: validOrderBody,
    });
    const res = await createOrderMobile(ctx);
    expect(res.status).toBe(201);
  });

  it('returns 400 when table_id is missing', async () => {
    const ctx: any = mockOrdersContext({
      role: 'owner',
      method: 'POST',
      body: { items: [{ name: 'Món A', qty: 1, price: 10000 }] },
    });
    const res = await createOrderMobile(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when items is empty array', async () => {
    const ctx: any = mockOrdersContext({
      role: 'owner',
      method: 'POST',
      body: { table_id: 'TBL_1', items: [] },
    });
    const res = await createOrderMobile(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 403 for kitchen staff creating order', async () => {
    const ctx: any = mockOrdersContext({
      role: 'staff',
      method: 'POST',
      body: validOrderBody,
    });
    const res = await createOrderMobile(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 403 for customer creating order', async () => {
    const ctx: any = mockOrdersContext({
      role: 'customer',
      method: 'POST',
      body: validOrderBody,
    });
    const res = await createOrderMobile(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 400 for non-array items', async () => {
    const ctx: any = mockOrdersContext({
      role: 'owner',
      method: 'POST',
      body: { table_id: 'TBL_1', items: 'not-an-array' },
    });
    const res = await createOrderMobile(ctx);
    expect(res.status).toBe(400);
  });

  it('creates order with unique id containing timestamp', async () => {
    const ctx: any = mockOrdersContext({
      role: 'owner',
      method: 'POST',
      body: validOrderBody,
    });
    const res = await createOrderMobile(ctx);
    const body = await res.json();
    expect(body.order_id).toMatch(/^ORD_/);
  });

  it('returns 500 on database error during create', async () => {
    const badDb: any = {
      prepare: () => ({
        bind: () => ({
          run: async () => { throw new Error('D1 insert failed'); },
        }),
      }),
    };
    const ctx: any = {
      req: {
        raw: new Request('https://test.aura/mobile/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validOrderBody),
        }),
        param: () => undefined,
        query: () => undefined,
        json: async () => validOrderBody,
        header: () => '',
      },
      env: { AURA_DB: badDb, AUTH_KV: createMockKV(), JWT_SECRET: TEST_JWT_SECRET },
      get: (key: string) => key === 'user' ? { id: 'USR_1', role: 'owner' } : undefined,
      set: () => {},
      json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
    };
    const res = await createOrderMobile(ctx);
    expect(res.status).toBe(500);
  });
});

describe('getOrderDetail', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const fullOrder = {
    id: 'ORD_1',
    table_id: 'TBL_1',
    items: '[{"name":"Phở","qty":1,"price":45000,"note":"Thêm hành"}]',
    status: 'pending',
    created_at: '2026-07-10T08:00:00Z',
    updated_at: '2026-07-10T08:00:00Z',
  };

  it('returns 200 + order detail for owner', async () => {
    const ctx: any = mockOrdersContext({ role: 'owner', orderId: 'ORD_1', orders: [fullOrder] });
    const res = await getOrderDetail(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.order.id).toBe('ORD_1');
  });

  it('returns 200 + order detail for waiter', async () => {
    const ctx: any = mockOrdersContext({ role: 'waiter', orderId: 'ORD_1', orders: [fullOrder] });
    const res = await getOrderDetail(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.order.id).toBe('ORD_1');
  });

  it('returns 403 for customer', async () => {
    const ctx: any = mockOrdersContext({ role: 'customer', orderId: 'ORD_1', orders: [fullOrder] });
    const res = await getOrderDetail(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 404 when order not found', async () => {
    const ctx: any = {
      req: {
        raw: new Request('https://test.aura/mobile/orders/ORD_MISSING', { method: 'GET' }),
        param: () => 'ORD_MISSING',
        query: () => undefined,
        json: async () => ({}),
        header: () => '',
      },
      env: {
        AURA_DB: {
          prepare: () => ({
            bind: () => ({ first: async () => null }),
          }),
        },
        AUTH_KV: createMockKV(),
        JWT_SECRET: TEST_JWT_SECRET,
      },
      get: (key: string) => key === 'user' ? { id: 'USR_1', role: 'owner' } : undefined,
      set: () => {},
      json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
    };
    const res = await getOrderDetail(ctx);
    expect(res.status).toBe(404);
  });

  it('returns 400 when order_id is missing', async () => {
    const ctx: any = {
      ...mockOrdersContext({ role: 'owner' }),
      req: {
        ...mockOrdersContext({ role: 'owner' }).req,
        param: () => undefined,
      },
    };
    const res = await getOrderDetail(ctx);
    expect(res.status).toBe(400);
  });

  it('parses items from JSON string in detail response', async () => {
    const ctx: any = mockOrdersContext({ role: 'owner', orderId: 'ORD_1', orders: [fullOrder] });
    const res = await getOrderDetail(ctx);
    const body = await res.json();
    expect(Array.isArray(body.order.items)).toBe(true);
    expect(body.order.items[0].name).toBe('Phở');
  });

  it('returns 500 on database error', async () => {
    const badDb: any = {
      prepare: () => ({
        bind: () => ({
          first: async () => { throw new Error('DB error'); },
        }),
      }),
    };
    const ctx: any = {
      req: {
        raw: new Request('https://test.aura/mobile/orders/ORD_1', { method: 'GET' }),
        param: () => 'ORD_1',
        query: () => undefined,
        json: async () => ({}),
        header: () => '',
      },
      env: { AURA_DB: badDb, AUTH_KV: createMockKV(), JWT_SECRET: TEST_JWT_SECRET },
      get: (key: string) => key === 'user' ? { id: 'USR_1', role: 'owner' } : undefined,
      set: () => {},
      json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
    };
    const res = await getOrderDetail(ctx);
    expect(res.status).toBe(500);
  });
});
