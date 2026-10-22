// @vitest-environment node
/**
 * Unit tests for POST /api/orders/sync (Offline Order Sync & Idempotency)
 */

import { afterEach, describe, it, expect } from 'vitest';
import { ordersCoreRouter } from '../../routes/orders-core';
import { createMockEnv, createMockKV } from '../test-utils';
import { orderCreationFixture } from '../integrations/order-creation-fixture';
const fixtures: ReturnType<typeof orderCreationFixture>[] = [];
afterEach(() => { for (const { sqlite } of fixtures.splice(0)) sqlite.close(); });

function syncMockDB() {
  const fixture = orderCreationFixture(); fixtures.push(fixture);
  return fixture.env.AURA_DB;
}

describe('POST /sync (Offline Orders Sync)', () => {
  it('successfully creates an order from nested orderData payload', async () => {
    const kv = createMockKV();
    const env = { ...createMockEnv(), AURA_DB: syncMockDB(), AUTH_KV: kv, REALTIME_ENABLED: 'false' };
    const req = new Request('https://test.aura/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localId: 'local_test_123',
        orderData: {
          items: [{ product_id: 'coffee', name: 'Ca Phe Muoi', qty: 1, price: 30000 }],
          total: 30000,
          customer_name: 'Le Van B',
          customer_phone: '0909123456',
          payment_method: 'cod',
          order_type: 'takeaway',
        },
        createdAt: Date.now() - 5000,
      }),
    });

    const res = await ordersCoreRouter.fetch(req, env);
    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.ok).toBe(true);
    expect(data.localId).toBe('local_test_123');
    expect(data.order).toBeDefined();
  });

  it('supports flat payload structure with localId', async () => {
    const kv = createMockKV();
    const env = { ...createMockEnv(), AURA_DB: syncMockDB(), AUTH_KV: kv, REALTIME_ENABLED: 'false' };
    const req = new Request('https://test.aura/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localId: 'local_flat_456',
        items: [{ product_id: 'coffee', name: 'Bac Xiu', qty: 2, price: 35000 }],
        total: 70000,
        customer_name: 'Tran Thi C',
        customer_phone: '0988776655',
        payment_method: 'cod',
        order_type: 'dine_in',
        table_id: 'D1',
      }),
    });

    const res = await ordersCoreRouter.fetch(req, env);
    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.localId).toBe('local_flat_456');
  });

  it('serves cached idempotent response on repeated sync request with same localId', async () => {
    const kv = createMockKV();
    const env = { ...createMockEnv(), AURA_DB: syncMockDB(), AUTH_KV: kv, REALTIME_ENABLED: 'false' };
    const reqPayload = {
      localId: 'local_idem_789',
      orderData: {
        items: [{ product_id: 'coffee', name: 'Tra Dao', qty: 1, price: 28000 }],
        total: 28000,
        customer_name: 'Vo Van D',
        customer_phone: '0911223344',
        payment_method: 'cod',
        order_type: 'takeaway',
      },
    };

    // First request - creates order
    const req1 = new Request('https://test.aura/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqPayload),
    });
    const res1 = await ordersCoreRouter.fetch(req1, env);
    expect(res1.status).toBe(201);

    // Second request - returns cached response
    const req2 = new Request('https://test.aura/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqPayload),
    });
    const res2 = await ordersCoreRouter.fetch(req2, env);
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-Cache')).toBe('HIT');
    const data2 = await res2.json() as Record<string, unknown>;
    expect(data2.success).toBe(true);
    expect(data2.localId).toBe('local_idem_789');
  });

  it('rejects invalid order data with 400', async () => {
    const kv = createMockKV();
    const env = { ...createMockEnv(), AURA_DB: syncMockDB(), AUTH_KV: kv, REALTIME_ENABLED: 'false' };
    const req = new Request('https://test.aura/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localId: 'local_bad_001',
        items: [],
        total: 0,
        customer_name: 'Bad Order',
        customer_phone: '0900000000',
        payment_method: 'cod',
      }),
    });

    const res = await ordersCoreRouter.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('handles invalid JSON body gracefully with 400', async () => {
    const kv = createMockKV();
    const env = { ...createMockEnv(), AURA_DB: syncMockDB(), AUTH_KV: kv, REALTIME_ENABLED: 'false' };
    const req = new Request('https://test.aura/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const res = await ordersCoreRouter.fetch(req, env);
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(false);
  });
});
