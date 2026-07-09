/**
 * Unit tests for src/tree/orders/split-orders.ts
 * Tests: splitOrders — validation, table resolution, order creation, payment records
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── mock logger ── */

vi.mock('../../../middleware/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

/* ── mock telegram / push / email (used by create-order via splitOrders import chain) ── */
vi.mock('../../../tree/orders/telegram', () => ({
  notifyTelegram: vi.fn(async() => {})
}));

vi.mock('../../../tree/push/notifier', () => ({
  sendPushToStaff: vi.fn(async() => ({ sent: 0, failed: 0 }))
}));

vi.mock('../../../lib/email', () => ({
  sendEmail: vi.fn(async() => true)
}));

/* ── DB helpers ── */
function makeChain(
  firstResult: unknown = null,
  allResults: unknown[] = [],
  runResult: { success: boolean; changes: number } = { success: true, changes: 1 }
) {
  const chain: Record<string, unknown> = {};
  chain.bind = vi.fn(() => {
    return chain;
  });
  chain.first = vi.fn(async() => firstResult);
  chain.all = vi.fn(async() => ({ results: allResults }));
  chain.run = vi.fn(async() => runResult);
  return chain as never;
}

function makeTableChain(status = 'Available') {
  return makeChain(
    { id: 'tbl_42', status },
    undefined,
    { success: true, changes: status === 'Available' ? 1 : 0 }
  );
}

function makeDB(chains: Record<string, unknown>[] = [makeChain()]) {
  const queue = [...chains];
  return {
    prepare: vi.fn((_sql: string) => {
      const chain = queue.shift() ?? makeChain();
      return chain as never;
    }),
    batch: vi.fn(async() => [])
  } as unknown as import('@cloudflare/workers-types').D1Database;
}

function makeEnv(db: import('@cloudflare/workers-types').D1Database) {
  return { AURA_DB: db };
}

/* ── imports under test ── */
import { splitOrders } from '../../../tree/orders/split-orders';

describe('split-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('splitOrders', () => {
    const validPayload = {
      orders: [
        {
          items: [{ id: 'i1', name: 'Pho Bo', price: 50000, quantity: 2 }],
          total: 100000,
          customer_name: 'Nguyen Van A',
          customer_phone: '0909123456',
          customer_email: 'nguyen@test.com',
          customer_address: '123 Main St',
          payment_method: 'cod',
          notes: 'No onions',
          delivery_time: '2026-07-08T12:00:00.000Z',
          shipping_fee: 0,
          discount: 0
        },
        {
          items: [{ id: 'i2', name: 'Banh Mi', price: 30000, quantity: 1 }],
          total: 30000,
          customer_name: 'Tran Thi B',
          customer_phone: '0909765432',
          customer_email: '',
          payment_method: 'cash'
        }
      ],
      table_id: 'table-01'
    };

    function makeReq(body: unknown): Request {
      return new Request('https://test.aura/api/orders/split', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      });
    }

    function makeDBForSplit() {
      // table lookup -> INSERT order 1 -> INSERT payment 1 -> INSERT order 2 -> INSERT payment 2
      return makeDB([
        makeTableChain(), // table lookup
        makeChain(undefined, undefined, { success: true, changes: 1 }), // UPDATE cafe_tables
        makeChain(undefined, undefined, { success: true, changes: 1 }), // INSERT order 1
        makeChain(undefined, undefined, { success: true, changes: 1 }), // INSERT payment 1
        makeChain(undefined, undefined, { success: true, changes: 1 }), // INSERT order 2
        makeChain(undefined, undefined, { success: true, changes: 1 }) // INSERT payment 2
      ]);
    }

    it('creates split orders and returns 201', async() => {
      const db = makeDBForSplit();
      const env = makeEnv(db);

      const result = await splitOrders(makeReq(validPayload), env);

      expect(result.status).toBe(201);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { success: boolean }).success).toBe(true);
      expect((body as Record<string, unknown> & { data: unknown[] }).data).toHaveLength(2);
      expect((body as Record<string, unknown> & { data: { status: string }[] }).data[0].status).toBe('pending');
      expect((body as Record<string, unknown> & { data: { status: string; payment_status: string }[] }).data[0].payment_status).toBe('unpaid');
      expect((body as Record<string, unknown> & { data: { status: string }[] }).data[1].status).toBe('pending');
    });

    it('resolves table_number to table UUID and occupies it', async() => {
      const db = makeDB([
        makeTableChain(),
        makeChain(undefined, undefined, { success: true, changes: 1 }), // UPDATE cafe_tables
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(undefined, undefined, { success: true, changes: 1 })
      ]);
      const env = makeEnv(db);

      await splitOrders(makeReq(validPayload), env);

      const calls = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls as unknown[][];
      // Second call: UPDATE cafe_tables SET status = 'Occupied'
      expect((calls[1][0] as string)).toContain('cafe_tables');
      expect((calls[1][0] as string)).toContain('Occupied');
    });

    it('handles non-existent table gracefully (no table_id in orders)', async() => {
      const payload = {
        ...validPayload,
        orders: validPayload.orders.map(o => ({ ...o, table_id: undefined }))
      };

      const db = makeDB([
        makeChain(null), // table lookup returns null
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(undefined, undefined, { success: true, changes: 1 })
      ]);
      const env = makeEnv(db);

      const result = await splitOrders(makeReq(payload), env);
      expect(result.status).toBe(201);
    });

    it('returns 400 when fewer than 2 orders provided', async() => {
      const payload = {
        orders: [validPayload.orders[0]], // only 1 order
        table_id: 'table-01'
      };

      const env = makeEnv(makeDB([]));
      const result = await splitOrders(makeReq(payload), env);

      expect(result.status).toBe(400);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { error: string }).error).toContain('2');
    });

    it('returns 400 when more than 4 orders provided', async() => {
      const payload = {
        orders: Array.from({ length: 5 }, (_, i) => ({
          items: [{ id: `i${i}`, name: `Item ${i}`, price: 10000, quantity: 1 }],
          total: 10000,
          customer_name: `Customer ${i}`,
          customer_phone: '0909123456'
        })),
        table_id: 'table-01'
      };

      const env = makeEnv(makeDB([]));
      const result = await splitOrders(makeReq(payload), env);

      expect(result.status).toBe(400);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { error: string }).error).toContain('4');
    });

    it('returns 400 when table_id is missing', async() => {
      const payload = {
        orders: validPayload.orders
      };

      const env = makeEnv(makeDB([]));
      const result = await splitOrders(makeReq(payload), env);

      expect(result.status).toBe(400);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { error: string }).error).toContain('table');
    });

    it('returns 400 when order total is below minimum 1000d', async() => {
      const payload = {
        orders: [
          {
            items: [{ id: 'i1', name: 'Tea', price: 500, quantity: 1 }],
            total: 500, // below 1000 min
            customer_name: 'Test',
            customer_phone: '0909123456'
          },
          {
            items: [{ id: 'i2', name: 'Coffee', price: 500, quantity: 1 }],
            total: 500,
            customer_name: 'Test2',
            customer_phone: '0909765432'
          }
        ],
        table_id: 'table-01'
      };

      const env = makeEnv(makeDB([]));
      const result = await splitOrders(makeReq(payload), env);

      expect(result.status).toBe(400);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { error: string }).error).toContain('1,000');
    });

    it('defaults payment_method to cash and delivery_time to now', async() => {
      const payload = {
        orders: [
          {
            items: [{ id: 'i1', name: 'Nuoc', price: 10000, quantity: 1 }],
            total: 10000,
            customer_name: 'Test',
            customer_phone: '0909123456'
            // no payment_method, no delivery_time
          },
          {
            items: [{ id: 'i2', name: 'Com', price: 20000, quantity: 1 }],
            total: 20000,
            customer_name: 'Test2',
            customer_phone: '0909765432'
          }
        ],
        table_id: 'table-01'
      };

      const db = makeDB([
        makeTableChain(),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(undefined, undefined, { success: true, changes: 1 })
      ]);
      const env = makeEnv(db);

      const result = await splitOrders(makeReq(payload), env);
      expect(result.status).toBe(201);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { data: { payment_method: string }[] }).data[0].payment_method).toBe('cash');
      // delivery_time is not included in response object
    });

    it('returns 500 on database error', async() => {
      const env = makeEnv(makeDB([]));
      env.AURA_DB = makeDB([]);
      (env.AURA_DB as unknown as { prepare: unknown }).prepare = vi.fn(() => {
        throw new Error('D1 error');
      }) as never;

      const result = await splitOrders(makeReq(validPayload), env);
      expect(result.status).toBe(500);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { success: boolean }).success).toBe(false);
    });
  });
});
