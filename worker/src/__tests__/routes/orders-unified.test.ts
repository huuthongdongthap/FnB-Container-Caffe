/**
 * Unified Orders Router Precedence & Access Control Tests
 * Verifies single runtime ownership, strict route precedence, and guest checkout viability.
 */

import { describe, it, expect } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv, createMockDB } from '../test-utils';

const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';

function makeTestEnv() {
  const store = new Map<string, string>();
  const db = createMockDB();
  db.prepare = (_sql: string) => {
    const stmt = {
      bind: (..._args: unknown[]) => stmt,
      run: async () => ({ success: true, changes: 1, lastRowId: 1 }),
      first: async () => {
        if (_sql.includes('COUNT(*) as total FROM orders')) return { total: 10 };
        if (_sql.includes('SUM(total_amount) as revenue')) return { revenue: 500000 };
        if (_sql.includes('FROM cafe_tables WHERE table_number = ?')) return { id: 'tbl-1', table_number: '1' };
        if (_sql.includes('FROM products') || _sql.includes('FROM menu_items')) {
          return { id: 'prod-1', name: 'Cafe Sua Da', price: 35000, is_available: 1, available: 1 };
        }
        if (_sql.includes('FROM orders')) {
          return { id: 'ORD-123', status: 'pending', total: 50000, customer_name: 'Guest', items: '[]' };
        }
        return null;
      },
      all: async () => ({ results: [], success: true }),
    };
    return stmt as any;
  };
  db.batch = async () => [{ success: true, changes: 1, meta: { changes: 1 } }] as any;

  return {
    ...createMockEnv(),
    AURA_DB: db,
    AUTH_KV: {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => { store.set(k, v); },
      delete: async (k: string) => { store.delete(k); },
    } as any,
    JWT_SECRET: TEST_SECRET,
  } as any;
}

describe('Canonical Unified Orders Router (/api/orders)', () => {
  it('allows unauthenticated guest check-in (POST /api/orders/guest-checkin)', async () => {
    const env = makeTestEnv();
    const res = await app.fetch(
      new Request('https://test.aura/api/orders/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: 'Diner', customer_phone: '0901234567', table_id: '1' }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('table_number', '1');
  });

  it('allows unauthenticated guest checkout (POST /api/orders/guest-checkout)', async () => {
    const env = makeTestEnv();
    const res = await app.fetch(
      new Request('https://test.aura/api/orders/guest-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Guest Diner',
          customer_phone: '0909999888',
          items: [{ name: 'Cafe Sua', qty: 1, price: 30000 }],
          fulfillment_type: 'TAKEAWAY',
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.total).toBe(30000);
  });

  it('routes GET /api/orders/summary to summary handler (not captured by /:id)', async () => {
    const env = makeTestEnv();
    const token = await generateJWT({ sub: 'staff-1', role: 'staff', name: 'Staff' }, TEST_SECRET);
    const res = await app.fetch(
      new Request('https://test.aura/api/orders/summary', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('totalOrders', 10);
    expect(data.data).toHaveProperty('totalRevenue', 500000);
  });

  it('routes GET /api/orders/:id/events to SSE stream without requiring authentication', async () => {
    const env = makeTestEnv();
    const res = await app.fetch(
      new Request('https://test.aura/api/orders/ORD-123/events'),
      env
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
  });

  it('allows unauthenticated guest order creation (POST /api/orders)', async () => {
    const env = makeTestEnv();
    const res = await app.fetch(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Walk-in Diner',
          customer_phone: '0901112233',
          payment_method: 'cod',
          total: 35000,
          order_type: 'takeaway',
          items: [{ name: 'Cafe Sua Da', product_id: 'prod-1', quantity: 1, price: 35000 }],
        }),
      }),
      env
    );
    expect([200, 201]).toContain(res.status);
    const data = await res.json() as any;
    expect(data.success || data.ok).toBeTruthy();
  });

  it('enforces authentication on protected staff endpoints', async () => {
    const env = makeTestEnv();
    const kdsRes = await app.fetch(new Request('https://test.aura/api/orders/kds'), env);
    expect(kdsRes.status).toBe(401);

    const posRes = await app.fetch(new Request('https://test.aura/api/orders/checkout', { method: 'POST' }), env);
    expect(posRes.status).toBe(401);

    const listRes = await app.fetch(new Request('https://test.aura/api/orders'), env);
    expect(listRes.status).toBe(401);

    const getRes = await app.fetch(new Request('https://test.aura/api/orders/ORD-123'), env);
    expect(getRes.status).toBe(401);

    const patchRes = await app.fetch(new Request('https://test.aura/api/orders/ORD-123', { method: 'PATCH' }), env);
    expect(patchRes.status).toBe(401);
  });

  it('routes GET /api/orders/kds and POST /:id/cancel without wildcard collision', async () => {
    const env = makeTestEnv();
    const token = await generateJWT({ sub: 'staff-1', role: 'staff', name: 'Staff' }, TEST_SECRET);
    const kdsRes = await app.fetch(
      new Request('https://test.aura/api/orders/kds', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(kdsRes.status).toBe(200);
    const kdsData = await kdsRes.json() as any;
    expect(kdsData.success).toBe(true);

    const cancelRes = await app.fetch(
      new Request('https://test.aura/api/orders/ORD-123/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Customer requested' }),
      }),
      env
    );
    expect(cancelRes.status).toBe(200);
    const cancelData = await cancelRes.json() as any;
    expect(cancelData.success).toBe(true);
  });

  it('rejects non-positive item quantities and negative prices in guest checkout', async () => {
    const env = makeTestEnv();
    const zeroQtyRes = await app.fetch(
      new Request('https://test.aura/api/orders/guest-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Guest Diner',
          customer_phone: '0909999888',
          items: [{ name: 'Cafe Sua', qty: 0, price: 30000 }],
          fulfillment_type: 'TAKEAWAY',
        }),
      }),
      env
    );
    expect(zeroQtyRes.status).toBe(400);

    const negPriceRes = await app.fetch(
      new Request('https://test.aura/api/orders/guest-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Guest Diner',
          customer_phone: '0909999888',
          items: [{ name: 'Cafe Sua', qty: 1, price: -10000 }],
          fulfillment_type: 'TAKEAWAY',
        }),
      }),
      env
    );
    expect(negPriceRes.status).toBe(400);
  });

  it('prevents Origin: localhost from bypassing orderRateLimit in production', async () => {
    const env = makeTestEnv();
    env.ENVIRONMENT = 'production';
    await env.AUTH_KV.put('rate:order:203.0.113.50', '60');

    const res = await app.fetch(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          'cf-connecting-ip': '203.0.113.50',
        },
        body: JSON.stringify({
          customer_name: 'Flooder',
          customer_phone: '0901112233',
          payment_method: 'cod',
          total: 35000,
          items: [{ name: 'Cafe Sua Da', product_id: 'prod-1', quantity: 1, price: 35000 }],
        }),
      }),
      env
    );
    expect(res.status).toBe(429);
  });

  it('authorizes manager role on /kds, /checkout, and /:id/status', async () => {
    const env = makeTestEnv();
    const token = await generateJWT({ sub: 'mgr-1', role: 'manager', name: 'Store Manager' }, TEST_SECRET);

    const kdsRes = await app.fetch(
      new Request('https://test.aura/api/orders/kds', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(kdsRes.status).toBe(200);

    const posRes = await app.fetch(
      new Request('https://test.aura/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_name: 'Diner',
          customer_phone: '0901234567',
          payment_method: 'cash',
          order_type: 'dine_in',
          items: [{ name: 'Cafe Sua Da', product_id: 'prod-1', quantity: 1, price: 35000 }],
        }),
      }),
      env
    );
    expect([200, 201]).toContain(posRes.status);

    const statusRes = await app.fetch(
      new Request('https://test.aura/api/orders/ORD-123/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'confirmed' }),
      }),
      env
    );
    expect([200, 400]).toContain(statusRes.status); // Not 401 or 403
    expect(statusRes.status).not.toBe(401);
    expect(statusRes.status).not.toBe(403);
  });

  it('authorizes waiter on /checkout and barista on /kds and /:id/status', async () => {
    const env = makeTestEnv();
    const waiterToken = await generateJWT({ sub: 'w-1', role: 'waiter', name: 'Waiter' }, TEST_SECRET);
    const baristaToken = await generateJWT({ sub: 'b-1', role: 'barista', name: 'Barista' }, TEST_SECRET);

    const posRes = await app.fetch(
      new Request('https://test.aura/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${waiterToken}`,
        },
        body: JSON.stringify({
          customer_name: 'Table 3 Guest',
          customer_phone: '0901234567',
          payment_method: 'cash',
          order_type: 'dine_in',
          items: [{ name: 'Cold Brew', product_id: 'prod-1', quantity: 1, price: 45000 }],
        }),
      }),
      env
    );
    expect([200, 201]).toContain(posRes.status);

    const kdsRes = await app.fetch(
      new Request('https://test.aura/api/orders/kds', {
        headers: { Authorization: `Bearer ${baristaToken}` },
      }),
      env
    );
    expect(kdsRes.status).toBe(200);

    const statusRes = await app.fetch(
      new Request('https://test.aura/api/orders/ORD-123/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ status: 'preparing' }),
      }),
      env
    );
    expect(statusRes.status).not.toBe(401);
    expect(statusRes.status).not.toBe(403);
  });
});
