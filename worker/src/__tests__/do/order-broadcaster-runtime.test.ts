import { describe, expect, it, vi } from 'vitest';
import { OrderBroadcaster, type OrderEvent } from '../../do/OrderBroadcaster';
import { realtimeOrdersRouter } from '../../routes/realtime-orders';

const event: OrderEvent = { orderId: 'local-order', status: 'pending', payment_status: 'unpaid', items: [{ name: 'Coffee' }],
  total: 20000, customer_name: 'Local guest', customer_phone: '0900000010', createdAt: 1, updatedAt: 2 };
function runtime() {
  const data = new Map<string, unknown>();
  const storage = { get: vi.fn(async <T>(key: string) => structuredClone(data.get(key)) as T | undefined),
    put: vi.fn(async (key: string, value: unknown) => { data.set(key, structuredClone(value)); }) };
  return { storage, blockConcurrencyWhile: async <T>(cb: () => Promise<T>) => cb() };
}
const request = (body: unknown) => new Request('https://do/broadcast', { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('OrderBroadcaster real runtime adapter and internal fetch contract', () => {
  it('persists via actual state.storage and reloads after instance eviction', async () => {
    const state = runtime();
    const first = new OrderBroadcaster(state);
    expect((await first.fetch(request(event))).status).toBe(200);
    const second = new OrderBroadcaster(state);
    const result = await second.fetch(new Request('https://do/state'));
    expect(await result.json()).toEqual([{ ...event, table_id: null, seq: 1 }]);
    expect((await second.fetch(request({ ...event, status: 'preparing', updatedAt: 3 }))).status).toBe(200);
    const third = new OrderBroadcaster(state);
    expect(await (await third.fetch(new Request('https://do/state?since=1'))).json())
      .toEqual([{ ...event, table_id: null, status: 'preparing', updatedAt: 3, seq: 2 }]);
  });
  it('does not publish failed storage writes in memory or after recovery', async () => {
    const state = runtime(); const instance = new OrderBroadcaster(state);
    state.storage.put.mockRejectedValueOnce(new Error('injected'));
    expect((await instance.fetch(request(event))).status).toBe(503);
    expect(await (await instance.fetch(new Request('https://do/state'))).json()).toEqual([]);
    expect((await instance.fetch(request(event))).status).toBe(200);
    expect(instance.getState(0)[0].seq).toBe(1);
  });
  it.each([{ ...event, status: 'paid' }, { ...event, total: -1 }, { orderId: 'empty-order', status: 'ready' }])
    ('rejects malformed or unseeded partial order events', async invalid => {
      const state = runtime(); const instance = new OrderBroadcaster(state);
      expect((await instance.fetch(request(invalid))).status).toBe(400);
      expect(state.storage.put).not.toHaveBeenCalled();
    });
  it('rejects public-host writes even with a valid payload', async () => {
    const state = runtime(); const instance = new OrderBroadcaster(state);
    const response = await instance.fetch(new Request('https://auraspace.cafe/broadcast', {
      method: 'POST', body: JSON.stringify(event),
    }));
    expect(response.status).toBe(404); expect(state.storage.put).not.toHaveBeenCalled();
  });
  it('does not expose the internal write endpoint through the public GET realtime router', async () => {
    const stub = { fetch: vi.fn(async () => new Response('Not found', { status: 404 })) };
    const env = { ORDER_BROADCASTER: { get: vi.fn(() => stub) } };
    const response = await realtimeOrdersRouter.fetch(request(event), env);
    expect(response.status).toBe(404); expect(stub.fetch).not.toHaveBeenCalled();
  });
  it('applies a status delta only to an existing server snapshot', async () => {
    const instance = new OrderBroadcaster(runtime());
    expect((await instance.fetch(request(event))).status).toBe(200);
    expect((await instance.fetch(request({ order_id: event.orderId, status: 'ready', updated_at: new Date(3).toISOString() }))).status).toBe(200);
    expect(instance.getState(1)[0]).toMatchObject({ items: event.items, total: 20000, status: 'ready', updatedAt: 3 });
  });
});
