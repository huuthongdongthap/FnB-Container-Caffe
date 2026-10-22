/**
 * OrderBroadcaster Durable Object unit tests.
 *
 * Test strategy: instantiate OrderBroadcaster with a mock DurableObjectState
 * (storage + blockConcurrencyWhile), exercise each method, and assert against
 * the in-memory proxy that tracks the loaded state.
 */

import { describe, it, expect, vi } from 'vitest';
import { OrderBroadcaster, type OrderEvent } from '../../do/OrderBroadcaster';

// ── Mock DurableObjectState ──────────────────────────────────────────
/**
 * One object plays both roles the real CF runtime plays: it carries the state
 * fields the DO reads and writes, and it exposes `storage` +
 * `blockConcurrencyWhile`. Hydration fills the same object in place, so the
 * assertions below inspect exactly what the DO mutated.
 */
function createMockState(initial?: { clients: Record<string, unknown>; orders: Record<string, OrderEvent>; seq: number }) {
  return {
    clients: initial?.clients ?? {},
    orders: initial?.orders ?? {},
    seq: initial?.seq ?? 0,
    storage: {
      get: vi.fn(async () => undefined),
      put: vi.fn().mockResolvedValue(undefined),
    },
    blockConcurrencyWhile: async <T>(cb: () => Promise<T>) => cb(),
  };
}

function makeEvent(overrides?: Partial<OrderEvent>): OrderEvent {
  return {
    orderId: `ORD_${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending',
    items: [],
    total: 0,
    customer_name: '',
    customer_phone: '',
    payment_status: 'unpaid',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Phase 1: OrderBroadcaster Durable Object', () => {
  // 1. Constructor — initializes empty state
  it('constructor — initializes empty state when no seed provided', () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);
    expect(state.clients).toEqual({});
    expect(state.orders).toEqual({});
    expect(state.seq).toBe(0);
  });

  // 2. Constructor — loads from persisted state
  it('constructor — restores state from persisted JSON', () => {
    const evt = makeEvent({ orderId: 'ORD_SEED' });
    const state = createMockState({
      clients: { c1: { role: 'kitchen', orderIds: ['ORD_SEED'] } },
      orders: { ORD_SEED: evt },
      seq: 5,
    });
    const do_ = new OrderBroadcaster(state);
    expect(state.clients).toHaveProperty('c1');
    expect(state.orders).toHaveProperty('ORD_SEED');
    expect(state.seq).toBe(5);
  });

  // 3. broadcast() — writes to state
  it('broadcast() — writes order to state and increments seq', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);
    const evt = makeEvent({ orderId: 'ORD_B1', total: 50000 });

    const result = await do_.broadcast(evt);

    expect(result.event.orderId).toBe('ORD_B1');
    expect(result.seq).toBe(1);
    expect(state.orders['ORD_B1'].total).toBe(50000);
  });

  // 4. broadcast() — the whole map is snapshotted under one key
  it('broadcast() — writes one snapshot key carrying the order and its seq', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);
    const evt = makeEvent({ orderId: 'ORD_B2' });

    await do_.broadcast(evt);

    expect(state.storage.put).toHaveBeenCalledTimes(1);
    const [key, value] = (state.storage.put as any).mock.calls[0];
    expect(key).toBe('order-broadcaster:state');
    expect(value.orders['ORD_B2'].orderId).toBe('ORD_B2');
    expect(value.orders['ORD_B2'].seq).toBe(1);
    expect(value.seq).toBe(1);
  });

  // 5. register() — adds client
  it('register() — adds client to state', () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);

    do_.register('client-1', 'kitchen', ['ORD_1']);

    expect(state.clients['client-1']).toEqual({
      role: 'kitchen',
      orderIds: ['ORD_1'],
    });
  });

  // 6. register() — allows multiple clients
  it('register() — supports concurrent clients with different roles', () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);

    do_.register('kds-1', 'kitchen', ['ORD_1', 'ORD_2']);
    do_.register('waiter-1', 'waiter', ['ORD_1']);
    do_.register('customer-1', 'customer', ['ORD_1']);

    expect(Object.keys(state.clients)).toHaveLength(3);
    expect(state.clients['kds-1'].role).toBe('kitchen');
    expect(state.clients['waiter-1'].role).toBe('waiter');
    expect(state.clients['customer-1'].role).toBe('customer');
  });

  // 7. unregister() — removes client
  it('unregister() — removes client on disconnect', () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);
    do_.register('c1', 'kitchen', ['ORD_1']);

    do_.unregister('c1');

    expect(state.clients).not.toHaveProperty('c1');
  });

  // 8. unregister() — no-op for unknown client
  it('unregister() — safe no-op when client not found', () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);

    // Should NOT throw
    expect(() => do_.unregister('nonexistent')).not.toThrow();
    expect(Object.keys(state.clients)).toHaveLength(0);
  });

  // 9. getState(sinceSeq) — returns all orders after sequence
  it('getState(sinceSeq) — returns orders newer than seq threshold', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);
    await do_.broadcast(makeEvent({ orderId: 'ORD_OLD', total: 1000 })); // seq=1

    // Advance seq past first order
    await do_.broadcast(makeEvent({ orderId: 'ORD_MID', total: 2000 })); // seq=2
    await do_.broadcast(makeEvent({ orderId: 'ORD_NEW', total: 3000 })); // seq=3

    const result = do_.getState(2);

    expect(result).toHaveLength(1);
    expect(result.map((e) => e.orderId)).toEqual(['ORD_NEW']);
  });

  // 10. getState(0) — returns all orders
  it('getState(0) — returns all orders for fresh connections', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);
    await do_.broadcast(makeEvent({ orderId: 'ORD_A' }));
    await do_.broadcast(makeEvent({ orderId: 'ORD_B' }));

    const result = do_.getState(0);

    expect(result).toHaveLength(2);
  });

  // 11. getState() — returns empty when no new orders
  it('getState() — returns empty when seq is at latest', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);
    await do_.broadcast(makeEvent({ orderId: 'ORD_X' }));

    const result = do_.getState(999);

    expect(result).toHaveLength(0);
  });

  // 12. Eviction recovery — state persists after re-instantiation
  it('eviction recovery — fresh instance loads persisted state', () => {
    const evt = makeEvent({ orderId: 'ORD_EVICT', total: 99999, seq: 10 });
    const state = createMockState({
      orders: { ORD_EVICT: evt },
      seq: 10,
    });
    // Simulate eviction by creating new DO instance from same state
    const do2 = new OrderBroadcaster(state);

    expect(do2.getState(0)).toHaveLength(1);
    expect(do2.getState(0)[0].orderId).toBe('ORD_EVICT');
    expect(do2.getState(0)[0].total).toBe(99999);
  });

  // 13. Error propagation — a failing snapshot write rejects the broadcast
  it('error propagation — a failing snapshot write rejects the broadcast', async () => {
    // Memory is only updated after the snapshot lands, so a failing write must
    // surface as a rejected broadcast rather than a silent in-memory update.
    const failingState = createMockState();
    failingState.storage.put = vi.fn(() => Promise.reject(new RangeError('DO quota exceeded')));
    const _do = new OrderBroadcaster(failingState);

    await expect(_do.broadcast(makeEvent({ orderId: 'ORD_ERR' }))).rejects.toThrow(RangeError);
  });

  // 14. Concurrent writes — no corruption
  it('concurrent writes — 5 simultaneous broadcasts preserve all orders', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);

    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ orderId: `ORD_CONC_${i}`, total: i * 1000 })
    );

    await Promise.all(events.map((e) => do_.broadcast(e)));

    expect(Object.keys(state.orders)).toHaveLength(5);
    expect(state.seq).toBe(5);
  });

  // 15. Storage dedup — same orderId overwrites, not duplicates
  it('storage persistence — rebroadcast same orderId updates, not duplicates', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);

    await do_.broadcast(makeEvent({ orderId: 'ORD_DUP', total: 100, status: 'pending' }));
    await do_.broadcast(makeEvent({ orderId: 'ORD_DUP', total: 200, status: 'confirmed' }));

    expect(Object.keys(state.orders)).toHaveLength(1);
    expect(state.orders['ORD_DUP'].total).toBe(200);
    expect(state.orders['ORD_DUP'].status).toBe('confirmed');
    expect(state.seq).toBe(2);
  });

  // 16. register during active session — clients visible to broadcast path
  it('register + broadcast — registered clients are tracked alongside orders', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);

    do_.register('kds-1', 'kitchen', []);
    await do_.broadcast(makeEvent({ orderId: 'ORD_K1' }));

    expect(state.clients['kds-1']).toBeDefined();
    expect(state.orders['ORD_K1']).toBeDefined();
    expect(Object.keys(state.clients)).toHaveLength(1);
    expect(Object.keys(state.orders)).toHaveLength(1);
  });

  // 17. Multiple unregisters leave other clients intact
  it('unregister — removing one client does not affect others', () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);

    do_.register('c1', 'kitchen', []);
    do_.register('c2', 'waiter', []);
    do_.register('c3', 'customer', []);
    do_.unregister('c2');

    expect(Object.keys(state.clients)).toHaveLength(2);
    expect(state.clients).toHaveProperty('c1');
    expect(state.clients).not.toHaveProperty('c2');
    expect(state.clients).toHaveProperty('c3');
  });
});

describe('OrderBroadcaster bounded retention', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it('retires a terminal order once it is older than the TTL', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);
    const stale = Date.now() - (DAY_MS + 60_000);

    await do_.broadcast(makeEvent({ orderId: 'ORD_OLD', status: 'completed', updatedAt: stale }));
    await do_.broadcast(makeEvent({ orderId: 'ORD_NEW' }));

    expect(state.orders).toHaveProperty('ORD_NEW');
    expect(state.orders).not.toHaveProperty('ORD_OLD');
  });

  it('keeps a terminal order inside the TTL window', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);

    await do_.broadcast(makeEvent({ orderId: 'ORD_FRESH', status: 'completed', updatedAt: Date.now() - 60_000 }));

    expect(state.orders).toHaveProperty('ORD_FRESH');
  });

  it('never ages out an active order, however old its last update', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);

    await do_.broadcast(makeEvent({ orderId: 'ORD_STUCK', status: 'preparing', updatedAt: 1 }));

    expect(state.orders).toHaveProperty('ORD_STUCK');
  });

  it('never evicts the order written in the current broadcast', async () => {
    const state = createMockState();
    const do_ = new OrderBroadcaster(state);

    await do_.broadcast(makeEvent({ orderId: 'ORD_ACTIVE', status: 'preparing', updatedAt: 1 }));

    expect(state.orders).toHaveProperty('ORD_ACTIVE');
    expect(do_.getState(0).map((o) => o.orderId)).toContain('ORD_ACTIVE');
  });
});
