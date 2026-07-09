/**
 * Unit tests for src/tree/orders/get-order.ts
 * Tests: getOrder — happy path, not found, null payment, DB error, SQL verification
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

/* ── DB helpers (sub-handlers pattern) ── */
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

/* ── imports under test (after vi.mock, before makeEnv because they run at import time) ── */
import { getOrder } from '../../../tree/orders/get-order';

describe('get-order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrder', () => {
    const orderRow = {
      id: 'ORD_001',
      status: 'pending',
      total: '50000',
      payment_status: 'unpaid',
      customer_name: 'Nguyen Van A',
      customer_phone: '0909123456',
      customer_address: '123 Test St',
      items: JSON.stringify([{ id: 'i1', name: 'Pho Bo', qty: 2, price: 25000 }]),
      created_at: '2026-07-08T10:00:00.000Z',
      updated_at: '2026-07-08T10:00:00.000Z'
    };

    it('returns order with parsed items and payment on happy path', async() => {
      const paymentRow = { id: 'PAY_001', method: 'cod', amount: '50000', status: 'pending' };
      // getOrder uses .all() for both queries — rows go in allResults
      const db = makeDB([
        makeChain(null, [orderRow]), // .all() → results: [orderRow]
        makeChain(null, [paymentRow]) // .all() → results: [paymentRow]
      ]);
      const env = { AURA_DB: db };

      const req = new Request('https://test.aura/api/orders/ORD_001');
      const result = await getOrder(req, env, 'ORD_001');

      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { success: boolean }).success).toBe(true);
      expect((body as Record<string, unknown> & { order: Record<string, unknown> }).order.id).toBe('ORD_001');
      expect((body as Record<string, unknown> & { order: Record<string, unknown> }).order.customer_name).toBe('Nguyen Van A');
      expect((body as Record<string, unknown> & { order: Record<string, unknown> }).order.items as Record<string, unknown>[]).toEqual([{ id: 'i1', name: 'Pho Bo', qty: 2, price: 25000 }]);
      expect((body as Record<string, unknown> & { order: Record<string, unknown> }).order.total as number).toBe(50000);
      expect((body as Record<string, unknown> & { order: Record<string, unknown> }).order.payment).toEqual(paymentRow);
    });

    it('returns 404 when order not found', async() => {
      const db = makeDB([makeChain(null, [])]); // .all() → results: []
      const env = { AURA_DB: db };

      const req = new Request('https://test.aura/api/orders/NONEXISTENT');
      const result = await getOrder(req, env, 'NONEXISTENT');

      expect(result.status).toBe(404);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { success: boolean }).success).toBe(false);
      expect((body as Record<string, unknown> & { error: string }).error).toBe('Order not found');
    });

    it('returns order with null payment when no payment row exists', async() => {
      const db = makeDB([
        makeChain(null, [orderRow]),
        makeChain(null, []) // empty payment results
      ]);
      const env = { AURA_DB: db };

      const req = new Request('https://test.aura/api/orders/ORD_001');
      const result = await getOrder(req, env, 'ORD_001');

      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { order: Record<string, unknown> }).order.payment).toBeNull();
    });

    it('returns 500 on database throw', async() => {
      const db = makeDB([]);
      (db as unknown as { prepare: unknown }).prepare = vi.fn(() => {
        throw new Error('D1 down');
      }) as never;
      const env = { AURA_DB: db };

      const req = new Request('https://test.aura/api/orders/ORD_001');
      const result = await getOrder(req, env, 'ORD_001');

      expect(result.status).toBe(500);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { success: boolean }).success).toBe(false);
      expect((body as Record<string, unknown> & { error: string }).error).toContain('Failed to fetch order');
    });

    it('handles items using quantity field instead of qty', async() => {
      const row = {
        ...orderRow,
        items: JSON.stringify([{ id: 'i1', name: 'Tra Sua', quantity: 3, price: 20000 }])
      };
      const db = makeDB([makeChain(null, [row]), makeChain(null, [])]);
      const env = { AURA_DB: db };

      const req = new Request('https://test.aura/api/orders/ORD_QTY');
      const result = await getOrder(req, env, 'ORD_QTY');

      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { order: Record<string, unknown> }).order.items as Record<string, unknown>[]).toEqual([{ id: 'i1', name: 'Tra Sua', quantity: 3, price: 20000 }]);
    });

    it('issues correct SQL: SELECT orders + SELECT payments', async() => {
      const db = makeDB([makeChain(null, [orderRow]), makeChain(null, [])]);
      const env = { AURA_DB: db };

      const req = new Request('https://test.aura/api/orders/ORD_001');
      await getOrder(req, env, 'ORD_001');

      const calls = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls as unknown[][];
      expect(calls.length).toBe(2);
      expect(calls[0][0]).toContain('SELECT');
      expect(calls[0][0] as string).toContain('FROM orders WHERE id = ?');
      expect(calls[1][0]).toContain('SELECT');
      expect(calls[1][0] as string).toContain('FROM payments WHERE order_id = ?');
    });

    it('binds order id as parameter in both queries', async() => {
      const db = makeDB([makeChain(null, [orderRow]), makeChain(null, [])]);
      const env = { AURA_DB: db };

      const req = new Request('https://test.aura/api/orders/ORD_BIND');
      await getOrder(req, env, 'ORD_BIND');

      // verify two SELECTs prepared and .bind(id) called on each chain
      const calls = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls as unknown[][];
      const c0 = (db.prepare as unknown as { mock: { results: { value: Record<string, unknown> }[] } }).mock.results[0].value as Record<string, unknown>;
      const c1 = (db.prepare as unknown as { mock: { results: { value: Record<string, unknown> }[] } }).mock.results[1].value as Record<string, unknown>;
      expect((c0 as { bind: (...args: unknown[]) => unknown }).bind('ORD_BIND')).toBe(c0);
      expect((c1 as { bind: (...args: unknown[]) => unknown }).bind('ORD_BIND')).toBe(c1);
      expect(calls[0][0] as string).toContain('orders WHERE id');
      expect(calls[1][0] as string).toContain('payments WHERE order_id');
    });
  });
});
