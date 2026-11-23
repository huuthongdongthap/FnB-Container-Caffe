import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OrderBroadcaster } from '../../do/OrderBroadcaster';
import { parseOrderBroadcast } from '../../do/order-broadcast-event';
import {
  dispatchOrderBroadcast,
  normalizeBroadcastTotal,
  parseBroadcastItems,
  parseBroadcastTimestamp,
} from '../../../../packages/domain/order/policies/order-broadcast';
import { updateOrder } from '../../../../packages/domain/order/commands/update-order';

function createRuntimeState() {
  const data = new Map<string, unknown>();
  return {
    storage: {
      get: vi.fn(async <T>(key: string) => structuredClone(data.get(key)) as T | undefined),
      put: vi.fn(async (key: string, value: unknown) => {
        data.set(key, structuredClone(value));
      }),
    },
    blockConcurrencyWhile: async <T>(cb: () => Promise<T>) => cb(),
  };
}

/**
 * Simulates Cloudflare workerd's DurableObjectStub JS Proxy:
 * - `stub.fetch(...)` delegates to the DO's HTTP `fetch` handler.
 * - Any other property access (such as `stub.broadcast`) returns a synthetic
 *   function whose invocation throws the workerd non-RPC error, matching
 *   production behavior for DO classes that do not extend `DurableObject`.
 */
function createWorkerdProxyNamespace() {
  const instances = new Map<string, OrderBroadcaster>();
  const fetchCalls: Array<{ channel: string; url: string; method: string; body: unknown }> = [];
  const rpcAttempts: string[] = [];

  const getInstance = (channel: string) => {
    let instance = instances.get(channel);
    if (!instance) {
      instance = new OrderBroadcaster(createRuntimeState());
      instances.set(channel, instance);
    }
    return instance;
  };

  const namespace = {
    idFromName: vi.fn((name: string) => name),
    get: vi.fn((id: unknown) => {
      const channel = String(id);
      const instance = getInstance(channel);
      return new Proxy(
        {
          fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
            const req = input instanceof Request ? input : new Request(String(input), init);
            const clone = req.clone();
            let parsedBody: unknown = null;
            try {
              parsedBody = await clone.json();
            } catch {
              parsedBody = null;
            }
            fetchCalls.push({ channel, url: req.url, method: req.method, body: parsedBody });
            return instance.fetch(req);
          },
        },
        {
          get(target, prop, receiver) {
            if (prop in target) return Reflect.get(target, prop, receiver);
            if (prop === 'then') return undefined;
            return (..._args: unknown[]) => {
              rpcAttempts.push(String(prop));
              return Promise.reject(
                new Error(
                  'The receiving Durable Object does not support RPC, because its class was not declared with extends DurableObject',
                ),
              );
            };
          },
        },
      );
    }),
  };

  return { namespace, instances, fetchCalls, rpcAttempts };
}

describe('dispatchOrderBroadcast — workerd DurableObjectStub proxy compatibility', () => {
  it('invokes stub.fetch instead of synthetic RPC stub.broadcast on workerd Proxy stubs', async () => {
    const { namespace, instances, fetchCalls, rpcAttempts } = createWorkerdProxyNamespace();
    const payload = {
      orderId: 'ord-proxy-1',
      status: 'preparing',
      payment_status: 'paid',
      items: [{ name: 'Ca Phe Sua Da', quantity: 1, price: 35000 }],
      total: 35000,
      customer_name: 'Nguyen Van A',
      customer_phone: '0901234567',
      table_id: 'T01',
      createdAt: 1700000000000,
      updatedAt: 1700000005000,
    };

    await dispatchOrderBroadcast(namespace, 'ord-proxy-1', payload);

    expect(rpcAttempts).toEqual([]);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]).toMatchObject({
      channel: 'ord-proxy-1',
      url: 'https://do/broadcast',
      method: 'POST',
    });
    const stored = instances.get('ord-proxy-1')?.getState(0) ?? [];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      orderId: 'ord-proxy-1',
      status: 'preparing',
      payment_status: 'paid',
      total: 35000,
      seq: 1,
    });
  });

  it('falls back to stub.broadcast only for unit-test mocks without fetch', async () => {
    const broadcastSpy = vi.fn(async () => {});
    const namespace = {
      idFromName: vi.fn((name: string) => name),
      get: vi.fn(() => ({ broadcast: broadcastSpy })),
    };

    await dispatchOrderBroadcast(namespace, 'ord-mock-1', { orderId: 'ord-mock-1', status: 'cancelled' });

    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    expect(broadcastSpy).toHaveBeenCalledWith({ orderId: 'ord-mock-1', status: 'cancelled' });
  });

  it('throws when the Durable Object rejects a malformed broadcast payload with non-2xx', async () => {
    const { namespace } = createWorkerdProxyNamespace();

    await expect(
      dispatchOrderBroadcast(namespace, 'ord-cold-bad', { orderId: 'ord-cold-bad', status: 'cancelled' }),
    ).rejects.toThrow('Order broadcast returned HTTP 400');
  });

  it('accepts completed payment_status on cold Durable Object broadcasts', () => {
    const parsed = parseOrderBroadcast({
      orderId: 'ord-completed-pay',
      status: 'completed',
      payment_status: 'completed',
      items: [],
      total: 42000,
      customer_name: 'Guest',
      customer_phone: '0900000001',
      table_id: null,
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
    });

    expect(parsed).toMatchObject({
      orderId: 'ord-completed-pay',
      status: 'completed',
      payment_status: 'completed',
      total: 42000,
    });
  });

  it('normalizes items, SQLite/ISO timestamps, and totals for cold DO safety', () => {
    expect(parseBroadcastItems('[{"name":"Latte"}]')).toEqual([{ name: 'Latte' }]);
    expect(parseBroadcastItems('not-json')).toEqual([]);
    expect(parseBroadcastItems('{"not":"array"}')).toEqual([]);

    expect(parseBroadcastTimestamp('2026-11-23 08:30:00', 123)).toBe(Date.parse('2026-11-23T08:30:00Z'));
    expect(parseBroadcastTimestamp('2026-11-23T08:30:00Z', 123)).toBe(Date.parse('2026-11-23T08:30:00Z'));
    expect(parseBroadcastTimestamp('invalid-date', 456)).toBe(456);

    expect(normalizeBroadcastTotal(49500.4)).toBe(49500);
    expect(normalizeBroadcastTotal(-100)).toBe(0);
    expect(normalizeBroadcastTotal(Number.NaN)).toBe(0);
  });

  it('updateOrder broadcasts through workerd Proxy stub to real OrderBroadcaster with zero RPC calls', async () => {
    const { namespace, instances, fetchCalls, rpcAttempts } = createWorkerdProxyNamespace();
    const orderRow = {
      id: 'ord-update-do-1',
      status: 'pending',
      items: JSON.stringify([{ name: 'Tra Dao', quantity: 2, price: 35000 }]),
      total: 70000,
      payment_status: 'unpaid',
      customer_name: 'Minh',
      customer_phone: '0909111222',
      table_id: 'T02',
      created_at: '2026-11-23 09:00:00',
      tenant_id: 'default',
      session_id: null,
    };

    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({ results: [orderRow] })),
          first: vi.fn(async () => (sql.includes('SELECT') ? orderRow : null)),
          run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
        })),
      })),
    };

    const req = new Request('https://api.auraspace.cafe/api/orders/ord-update-do-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'preparing' }),
    });

    const response = await updateOrder(
      req,
      { AURA_DB: db, ORDER_BROADCASTER: namespace },
      'ord-update-do-1',
      'barista',
      'default',
    );

    expect(response.status).toBe(200);
    expect(rpcAttempts).toEqual([]);
    expect(fetchCalls).toHaveLength(1);
    const events = instances.get('ord-update-do-1')?.getState(0) ?? [];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      orderId: 'ord-update-do-1',
      status: 'preparing',
      payment_status: 'unpaid',
      total: 70000,
      customer_name: 'Minh',
      customer_phone: '0909111222',
      table_id: 'T02',
      createdAt: Date.parse('2026-11-23T09:00:00Z'),
    });
  });

  it('deploy-cloudflare.sh appends worker-local bin to PATH without shadowing earlier entries', () => {
    const script = readFileSync(resolve(process.cwd(), 'deploy-cloudflare.sh'), 'utf8');
    expect(script).toContain('export PATH="${PATH}:${SCRIPT_DIR}/${WORKER_DIR}/node_modules/.bin"');
  });
});
