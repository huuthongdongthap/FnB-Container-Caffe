/**
 * Unit tests for POST /api/orders/sync (Offline Order Sync & Idempotency)
 */

import { describe, it, expect } from 'vitest';
import { ordersCoreRouter } from '../../routes/orders-core';
import { createMockEnv, createMockDB, createMockKV } from '../test-utils';

function syncMockDB() {
  const db = createMockDB();
  db.prepare = ((sql: string) => {
    const stmt: Record<string, unknown> = {
      _sql: sql,
      _binds: [] as unknown[],
      bind(...args: unknown[]) {
        this._binds = args;
        return this;
      },
      first: async () => {
        if (sql.includes('FROM cafe_tables WHERE table_number')) {
          return { id: 'TBL_001' };
        }
        if (sql.toLowerCase().includes('from orders where id')) {
          return null;
        }
        return null;
      },
      all: async () => ({ results: [], success: true }),
      run: async () => ({ success: true, changes: 1, lastRowId: 1 }),
      raw: async () => []
    };
    return stmt as any;
  }) as any;
  return db;
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
          items: [{ name: 'Ca Phe Muoi', qty: 1, price: 30000 }],
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
        items: [{ name: 'Bac Xiu', qty: 2, price: 35000 }],
        total: 70000,
        customer_name: 'Tran Thi C',
        customer_phone: '0988776655',
        payment_method: 'cod',
        order_type: 'dine_in',
        table_id: '1',
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
        items: [{ name: 'Tra Dao', qty: 1, price: 28000 }],
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
    expect(data2.cached).toBe(true);
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
