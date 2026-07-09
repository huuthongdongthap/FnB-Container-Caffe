/**
 * Unit tests for src/tree/orders/update-order.ts
 * Tests: updateOrder — state machine, field updates, KV events, 500 error
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

/* ── DB helpers (matching sub-handlers pattern) ── */
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

/** Build a chain list where every unused chain returns a safe default. */
function fillChain(count: number, result = makeChain()) {
  return Array.from({ length: count }, () => result);
}

// Adds fallback chains to prevent queue exhaustion in tests that use AUTH_KV
function makeDB(chains: Record<string, unknown>[] = [makeChain()]): import('@cloudflare/workers-types').D1Database {
  const queue: Record<string, unknown>[] = [...chains, ...Array.from({ length: 10 }, () =>
    makeChain(undefined, undefined, { success: true, changes: 1 })
  )];
  return {
    prepare: vi.fn((_sql: string) => queue.shift() ?? makeChain(undefined, undefined, { success: true, changes: 1 }))
  } as unknown as import('@cloudflare/workers-types').D1Database;
}

function makeEnv(
  db: import('@cloudflare/workers-types').D1Database,
  extra: Record<string, unknown> = {}
) {
  return {
    AURA_DB: db,
    JWT_SECRET: 'test-jwt-secret-16char',
    ...extra
  };
}

function makeKV() {
  return {
    put: vi.fn(async() => {}),
    get: vi.fn(async() => null)
  } as unknown as import('@cloudflare/workers-types').KVNamespace;
}

/* ── imports under test ── */
import { updateOrder } from '../../../tree/orders/update-order';

describe('update-order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── updateOrder — state machine + field updates ──────────────────

  describe('updateOrder', () => {
    it('allows valid transition: pending → confirmed', async() => {
      // chain[0]: SELECT orders WHERE id = ?
      // chain[1]: UPDATE orders SET status = ? WHERE id = ?
      // chain[2]: kv.put(event)  [silent via .catch()]
      // chain[3]: kv.put(latest_ts)  [silent via .catch()]
      const db = makeDB([
        makeChain(undefined, [{ id: 'ORD_1', status: 'pending' }]),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(),
        makeChain()
      ]);
      const env = makeEnv(db);

      const body = new TextEncoder().encode(JSON.stringify({ status: 'confirmed' }));
      const req = new Request('https://test.aura/api/orders/ORD_1', {
        method: 'PUT', body, headers: { 'Content-Type': 'application/json' }
      });

      const result = await updateOrder(req, env, 'ORD_1');
      expect(result.status).toBe(200);
    });

    it('allows valid transition: confirmed → preparing', async() => {
      const db = makeDB([
        makeChain(undefined, [{ id: 'ORD_1', status: 'confirmed' }]),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(),
        makeChain()
      ]);
      const env = makeEnv(db);

      const body = new TextEncoder().encode(JSON.stringify({ status: 'preparing' }));
      const req = new Request('https://test.aura/api/orders/ORD_1', {
        method: 'PUT', body, headers: { 'Content-Type': 'application/json' }
      });

      const result = await updateOrder(req, env, 'ORD_1');
      expect(result.status).toBe(200);
    });

    it('allows valid transition: preparing → ready', async() => {
      const db = makeDB([
        makeChain(undefined, [{ id: 'ORD_1', status: 'preparing' }]),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(),
        makeChain()
      ]);
      const env = makeEnv(db);

      const body = new TextEncoder().encode(JSON.stringify({ status: 'ready' }));
      const req = new Request('https://test.aura/api/orders/ORD_1', {
        method: 'PUT', body, headers: { 'Content-Type': 'application/json' }
      });

      const result = await updateOrder(req, env, 'ORD_1');
      expect(result.status).toBe(200);
    });

    it('allows valid transition: ready → served', async() => {
      const db = makeDB([
        makeChain(undefined, [{ id: 'ORD_1', status: 'ready' }]),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(),
        makeChain()
      ]);
      const env = makeEnv(db);

      const body = new TextEncoder().encode(JSON.stringify({ status: 'served' }));
      const req = new Request('https://test.aura/api/orders/ORD_1', {
        method: 'PUT', body, headers: { 'Content-Type': 'application/json' }
      });

      const result = await updateOrder(req, env, 'ORD_1');
      expect(result.status).toBe(200);
    });

    it('rejects invalid status transition: pending → served (skipping states)', async() => {
      const db = makeDB([makeChain(undefined, [{ id: 'ORD_1', status: 'pending' }])]);
      const env = makeEnv(db);

      const body = new TextEncoder().encode(JSON.stringify({ status: 'served' }));
      const req = new Request('https://test.aura/api/orders/ORD_1', {
        method: 'PUT', body, headers: { 'Content-Type': 'application/json' }
      });

      const result = await updateOrder(req, env, 'ORD_1');
      expect(result.status).toBe(400);
      const bodyJs = await result.json();
      expect(bodyJs.error).toContain('Invalid transition');
    });

    it('returns 404 when order not found', async() => {
      const db = makeDB([makeChain(null)]);
      const env = makeEnv(db);

      const body = new TextEncoder().encode(JSON.stringify({ status: 'confirmed' }));
      const req = new Request('https://test.aura/api/orders/NO_ORDER', {
        method: 'PUT', body, headers: { 'Content-Type': 'application/json' }
      });

      const result = await updateOrder(req, env, 'NO_ORDER');
      expect(result.status).toBe(404);
      const bodyJs = await result.json();
      expect(bodyJs.error).toBe('Order not found');
    });

    it('returns 400 when no updatable fields provided', async() => {
      const db = makeDB([makeChain(undefined, [{ id: 'ORD_1', status: 'pending' }])]);
      const env = makeEnv(db);

      const body = new TextEncoder().encode(JSON.stringify({}));
      const req = new Request('https://test.aura/api/orders/ORD_1', {
        method: 'PUT', body, headers: { 'Content-Type': 'application/json' }
      });

      const result = await updateOrder(req, env, 'ORD_1');
      expect(result.status).toBe(400);
      const bodyJs = await result.json();
      expect(bodyJs.error).toBe('No valid fields to update');
    });

    it('updates non-status fields: notes and delivery_time', async() => {
      const db = makeDB([
        makeChain(undefined, [{ id: 'ORD_1', status: 'pending' }]),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(),
        makeChain()
      ]);
      const env = makeEnv(db);

      const body = new TextEncoder().encode(JSON.stringify({
        notes: 'Extra napkins please',
        delivery_time: '2026-07-08T12:30:00.000Z'
      }));
      const req = new Request('https://test.aura/api/orders/ORD_1', {
        method: 'PUT', body, headers: { 'Content-Type': 'application/json' }
      });

      const result = await updateOrder(req, env, 'ORD_1');
      expect(result.status).toBe(200);
    });

    it('executes correct SQL sequence: SELECT then UPDATE with id param', async() => {
      const db = makeDB([
        makeChain(undefined, [{ id: 'ORD_1', status: 'pending' }]),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(),
        makeChain()
      ]);
      const env = makeEnv(db);

      const body = new TextEncoder().encode(JSON.stringify({ status: 'confirmed' }));
      const req = new Request('https://test.aura/api/orders/ORD_1', {
        method: 'PUT', body, headers: { 'Content-Type': 'application/json' }
      });

      await updateOrder(req, env, 'ORD_1');

      const calls = db.prepare.mock.calls as unknown[][];
      expect(calls[0][0]).toContain('SELECT');
      expect(calls[0][0]).toContain('orders WHERE id = ?');
      expect(calls[1][0]).toContain('UPDATE orders');
    });

    it('returns 500 on unhandled database error', async() => {
      const db = makeDB([]);
      (db as Record<string, unknown>).prepare = vi.fn(() => {
        throw new Error('D1 connection lost');
      }) as never;
      const env = makeEnv(db);

      const body = new TextEncoder().encode(JSON.stringify({ status: 'confirmed' }));
      const req = new Request('https://test.aura/api/orders/ORD_1', {
        method: 'PUT', body, headers: { 'Content-Type': 'application/json' }
      });

      const result = await updateOrder(req, env, 'ORD_1');
      expect(result.status).toBe(500);
      const bodyJs = await result.json();
      expect(bodyJs.success).toBe(false);
      expect(bodyJs.error).toContain('Failed to update order');
    });
  });
});
