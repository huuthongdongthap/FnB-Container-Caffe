/**
 * Phase 2 — Offline Queue Unit Tests
 *
 * Uses fake-indexeddb/auto (synchronous in-memory polyfill).
 * beforeEach() resets state by deleting the database.
 */

import 'fake-indexeddb/auto';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enqueueOrder,
  dequeueOrders,
  getPendingCount,
  clearQueue,
  registerBackgroundSync,
  _resetForTests,
  type QueuedOrder,
} from '../../lib/offline-queue';

// ── Helpers ─────────────────────────────────────────────────────────

function makeOrder(overrides?: Partial<QueuedOrder>): QueuedOrder {
  return {
    orderId: `ORD_${Math.random().toString(36).slice(2, 8)}`,
    idempotencyKey: `idem-${Math.random().toString(36).slice(2, 8)}`,
    payload: { name: 'Test Order', total: 10000 },
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  await _resetForTests();
  vi.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────

describe('Phase 2: Offline Queue', () => {
  it('enqueue — stores order and returns count 1', async () => {
    const o = makeOrder({ orderId: 'ORD_E1' });
    const n = await enqueueOrder(o);
    expect(n).toBe(1);
  });

  it('enqueue — multiple orders accumulate', async () => {
    await enqueueOrder(makeOrder({ orderId: 'ORD_A' }));
    await enqueueOrder(makeOrder({ orderId: 'ORD_B' }));
    expect(await getPendingCount()).toBe(2);
  });

  it('dequeue — returns all and empties store', async () => {
    await enqueueOrder(makeOrder({ orderId: 'ORD_D1', payload: { foo: 1 } }));
    await enqueueOrder(makeOrder({ orderId: 'ORD_D2', payload: { foo: 2 } }));
    const all = await dequeueOrders();
    expect(all).toHaveLength(2);
    expect(all.map(o => o.orderId).sort()).toEqual(['ORD_D1', 'ORD_D2']);
    expect(await getPendingCount()).toBe(0);
  });

  it('dequeue — returns empty array when store is empty', async () => {
    expect(await dequeueOrders()).toEqual([]);
  });

  it('clearQueue — empties store', async () => {
    await enqueueOrder(makeOrder({ orderId: 'ORD_C1' }));
    await enqueueOrder(makeOrder({ orderId: 'ORD_C2' }));
    await clearQueue();
    expect(await getPendingCount()).toBe(0);
  });

  it('idempotency — same key overwrites, no duplicate', async () => {
    const o = makeOrder({ orderId: 'ORD_DUP', idempotencyKey: 'idem-same' });
    await enqueueOrder(o);
    await enqueueOrder({ ...o, payload: { total: 20000 } });
    expect(await getPendingCount()).toBe(1);
    const [result] = await dequeueOrders();
    expect(result.payload.total).toBe(20000);
  });

  it('idempotency — different keys create separate entries', async () => {
    await enqueueOrder(makeOrder({ orderId: 'ORD_X', idempotencyKey: 'idem-x' }));
    await enqueueOrder(makeOrder({ orderId: 'ORD_Y', idempotencyKey: 'idem-y' }));
    expect(await getPendingCount()).toBe(2);
  });

  it('registerBackgroundSync — no-op in Node.js', async () => {
    expect(() => registerBackgroundSync()).not.toThrow();
  });

  it('getPendingCount — returns 0 on fresh queue', async () => {
    expect(await getPendingCount()).toBe(0);
  });

});
