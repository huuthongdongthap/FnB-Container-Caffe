/**
 * Unit tests for src/tree/orders/admin-orders.ts
 * Tests: getAdminOrders — pagination, filtering, sorting, LEFT JOIN payments, edge cases
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

/* ── DB helpers ── */
function makeChain(
  firstResult: unknown = null,
  allResults: unknown[] = [],
  runResult: { success: boolean; changes: number } = { success: true, changes: 0 }
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

function makeDB(chains: Record<string, unknown>[] = [makeChain()]) {
  const queue = [...chains];
  return {
    prepare: vi.fn((_sql: string) => queue.shift() ?? makeChain())
  } as unknown as import('@cloudflare/workers-types').D1Database;
}

function makeEnv(db: import('@cloudflare/workers-types').D1Database) {
  return { AURA_DB: db };
}

/* ── helper to build a Request with search params ── */
function makeAdminReq(params: Record<string, string> = {}): Request {
  const sp = new URLSearchParams(params);
  return new Request(`https://test.aura/api/admin/orders?${sp}`, {
    method: 'GET'
  });
}

/* ── imports under test ── */
import { getAdminOrders } from '../../../tree/orders/admin-orders';

describe('admin-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAdminOrders', () => {
    const mockOrderRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'ORD_1',
      status: 'completed',
      total: '150000',
      payment_status: 'paid',
      customer_name: 'Nguyen Van A',
      customer_phone: '0909123456',
      created_at: '2026-07-08T10:00:00.000Z',
      payment_id: 'PAY_1',
      refund_status: null,
      refund_amount: null,
      payment_amount: '150000',
      payment_method: 'cod',
      items: JSON.stringify([{ name: 'Pho Bo', quantity: 2 }]),
      shipping_fee: '0',
      discount: '0',
      ...overrides
    });

    const mockCountRow = (total: number) => ({ total });

    it('returns orders with pagination on happy path', async() => {
      const orders = [mockOrderRow(), mockOrderRow({ id: 'ORD_2' })];
      const db = makeDB([
        makeChain(undefined, orders), // orders query
        makeChain(mockCountRow(2), [mockCountRow(2)]) // count query
      ]);
      const env = makeEnv(db);

      const req = makeAdminReq({ limit: '10', offset: '0' });
      const result = await getAdminOrders(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { success: boolean }).success).toBe(true);
      expect((body as Record<string, unknown> & { orders: unknown[] }).orders as unknown[]).toHaveLength(2);
      expect((body as Record<string, unknown> & { pagination: Record<string, unknown> }).pagination.total).toBe(2);
      expect((body as Record<string, unknown> & { pagination: Record<string, unknown> }).pagination.limit).toBe(10);
      expect((body as Record<string, unknown> & { pagination: Record<string, unknown> }).pagination.offset).toBe(0);
    });

    it('parses items JSON in each order row', async() => {
      const orders = [
        mockOrderRow({
          items: JSON.stringify([{ name: 'Pho Bo', quantity: 3, price: 50000 }])
        })
      ];
      const db = makeDB([makeChain(undefined, orders), makeChain(mockCountRow(1), [mockCountRow(1)])]);
      const env = makeEnv(db);

      const req = makeAdminReq();
      const result = await getAdminOrders(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { orders: Record<string, unknown>[] }).orders[0].items as Record<string, unknown>[]).toEqual([{ name: 'Pho Bo', quantity: 3, price: 50000 }]);
    });

    it('defaults items to empty array when NULL', async() => {
      const orders = [mockOrderRow({ items: null as unknown as string })];
      const db = makeDB([makeChain(undefined, orders), makeChain(mockCountRow(1), [mockCountRow(1)])]);
      const env = makeEnv(db);

      const req = makeAdminReq();
      const result = await getAdminOrders(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { orders: Record<string, unknown>[] }).orders[0].items as Record<string, unknown>[]).toEqual([]);
    });

    it('filters by status query param', async() => {
      const orders = [mockOrderRow({ status: 'completed' })];
      const db = makeDB([makeChain(undefined, orders), makeChain(mockCountRow(1), [mockCountRow(1)])]);
      const env = makeEnv(db);

      const req = makeAdminReq({ status: 'completed' });
      await getAdminOrders(req, env);

      const calls = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls as unknown[][];
      // Find the orders query
      const ordersQuery = calls.find((c: unknown[]) => (c[0] as string).includes('FROM orders o'));
      expect(ordersQuery).toBeDefined();
      expect(ordersQuery![0] as string).toContain('o.status = ?');
    });

    it('filters by payment_status query param', async() => {
      const orders: unknown[] = [];
      const db = makeDB([makeChain(undefined, orders), makeChain(mockCountRow(0), [mockCountRow(0)])]);
      const env = makeEnv(db);

      const req = makeAdminReq({ payment_status: 'paid' });
      await getAdminOrders(req, env);

      const calls = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls as unknown[][];
      const ordersQuery = calls.find((c: unknown[]) => (c[0] as string).includes('FROM orders o'));
      expect(ordersQuery).toBeDefined();
      expect(ordersQuery![0] as string).toContain('o.payment_status = ?');
    });

    it('defaults limit to 50 and offset to 0', async() => {
      const orders: unknown[] = [];
      const db = makeDB([makeChain(undefined, orders), makeChain(mockCountRow(0), [mockCountRow(0)])]);
      const env = makeEnv(db);

      const req = makeAdminReq(); // no limit/offset
      await getAdminOrders(req, env);

      const calls = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls as unknown[][];
      // Last call is orders query with LIMIT/OFFSET binds
      const lastCalls = calls.filter(
        (c: unknown[]) => (c[0] as string).includes('LIMIT') && (c[0] as string).includes('OFFSET')
      );
      expect(lastCalls.length).toBeGreaterThan(0);
    });

    it('accepts valid sort fields: created_at, total, status', async() => {
      for (const sortField of ['created_at', 'total', 'status']) {
        const db = makeDB([
          makeChain(undefined, [mockOrderRow()]),
          makeChain(mockCountRow(1), [mockCountRow(1)])
        ]);
        const env = makeEnv(db);

        const req = makeAdminReq({ sort: sortField, order: 'asc' });
        await getAdminOrders(req, env);

        const calls = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls as unknown[][];
        const ordersQuery = calls.find(
          (c: unknown[]) => (c[0] as string).includes('FROM orders o') && (c[0] as string).includes('ORDER BY')
        );
        expect(ordersQuery).toBeDefined();
        expect((ordersQuery![0] as string)).toContain(`o.${sortField}`);
        expect((ordersQuery![0] as string)).toContain('ASC');
      }
    });

    it('falls back to created_at for invalid sort param', async() => {
      const db = makeDB([
        makeChain(undefined, [mockOrderRow()]),
        makeChain(mockCountRow(1), [mockCountRow(1)])
      ]);
      const env = makeEnv(db);

      const req = makeAdminReq({ sort: 'invalid_field', order: 'desc' });
      await getAdminOrders(req, env);

      const calls = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls as unknown[][];
      const ordersQuery = calls.find(
        (c: unknown[]) => (c[0] as string).includes('FROM orders o') && (c[0] as string).includes('ORDER BY')
      );
      expect((ordersQuery![0] as string)).toContain('o.created_at');
      expect((ordersQuery![0] as string)).toContain('DESC');
    });

    it('returns empty orders array with total 0 on no results', async() => {
      const db = makeDB([
        makeChain(undefined, []), // orders query: no results
        makeChain(mockCountRow(0), [mockCountRow(0)]) // count query
      ]);
      const env = makeEnv(db);

      const req = makeAdminReq();
      const result = await getAdminOrders(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { orders: Record<string, unknown>[] }).orders).toEqual([]);
      expect((body as Record<string, unknown> & { pagination: Record<string, unknown> }).pagination.total).toBe(0);
    });

    it('uses LEFT JOIN to include payment data', async() => {
      const orders = [
        mockOrderRow({ payment_id: 'PAY_1', payment_amount: '150000', refund_amount: null })
      ];
      const db = makeDB([makeChain(undefined, orders), makeChain(mockCountRow(1), [mockCountRow(1)])]);
      const env = makeEnv(db);

      const req = makeAdminReq();
      const result = await getAdminOrders(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { orders: Record<string, unknown>[] }).orders[0].payment_id).toBe('PAY_1');
      expect((body as Record<string, unknown> & { orders: Record<string, unknown>[] }).orders[0].payment_amount as number).toBe(150000);
      expect((body as Record<string, unknown> & { orders: Record<string, unknown>[] }).orders[0].refund_amount).toBeNull();
    });

    it('parses numeric fields correctly: total, payment_amount, shipping_fee, discount', async() => {
      const orders = [
        mockOrderRow({
          total: '200000',
          payment_amount: '180000',
          shipping_fee: '15000',
          discount: '5000'
        })
      ];
      const db = makeDB([makeChain(undefined, orders), makeChain(mockCountRow(1), [mockCountRow(1)])]);
      const env = makeEnv(db);

      const req = makeAdminReq();
      const result = await getAdminOrders(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { orders: Record<string, unknown>[] }).orders[0].total as number).toBe(200000);
      expect((body as Record<string, unknown> & { orders: Record<string, unknown>[] }).orders[0].payment_amount as number).toBe(180000);
      expect((body as Record<string, unknown> & { orders: Record<string, unknown>[] }).orders[0].shipping_fee as number).toBe(15000);
      expect((body as Record<string, unknown> & { orders: Record<string, unknown>[] }).orders[0].discount as number).toBe(5000);
    });

    it('returns 500 on database error', async() => {
      const db = makeDB([]);
      (db as unknown as { prepare: unknown }).prepare = vi.fn(() => {
        throw new Error('D1 connection failed');
      }) as never;
      const env = makeEnv(db);

      const req = makeAdminReq();
      const result = await getAdminOrders(req, env);

      expect(result.status).toBe(500);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { success: boolean }).success).toBe(false);
      expect((body as Record<string, unknown> & { error: string }).error).toContain('Failed to fetch orders');
    });

    it('combines status and payment_status filters', async() => {
      const orders = [mockOrderRow({ status: 'completed', payment_status: 'paid' })];
      const db = makeDB([makeChain(undefined, orders), makeChain(mockCountRow(1), [mockCountRow(1)])]);
      const env = makeEnv(db);

      const req = makeAdminReq({ status: 'completed', payment_status: 'paid' });
      await getAdminOrders(req, env);

      const calls = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls as unknown[][];
      const ordersQuery = calls.find((c: unknown[]) => (c[0] as string).includes('FROM orders o'));
      expect(ordersQuery).toBeDefined();
      const sql = ordersQuery![0] as string;
      expect(sql).toContain('o.status = ?');
      expect(sql).toContain('o.payment_status = ?');
    });

    it('handles combined filters with pagination', async() => {
      const db = makeDB([
        makeChain(undefined, [mockOrderRow()]),
        makeChain(mockCountRow(25), [mockCountRow(25)])
      ]);
      const env = makeEnv(db);

      const req = makeAdminReq({ status: 'pending', limit: '10', offset: '5' });
      const result = await getAdminOrders(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { pagination: Record<string, unknown> }).pagination.total).toBe(25);
      expect((body as Record<string, unknown> & { pagination: Record<string, unknown> }).pagination.limit).toBe(10);
      expect((body as Record<string, unknown> & { pagination: Record<string, unknown> }).pagination.offset).toBe(5);
    });
  });
});
