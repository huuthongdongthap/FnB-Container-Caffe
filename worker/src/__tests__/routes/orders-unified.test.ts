/**
 * Unified Orders Router Precedence & Access Control Tests
 * Verifies single runtime ownership, strict route precedence, and guest checkout viability.
 */

import { describe, it, expect } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv, createMockDB, isStaffAccountLookup } from '../test-utils';

const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';

/**
 * The account rows the request-time session gate reads behind each staff token.
 * The row's role has to match the token's role claim, because the gate treats a
 * divergence as a role change and revokes the session.
 */
const STAFF_ROWS = [
  { id: 'staff-1', name: 'Staff', phone: null, role: 'staff', tenant_id: 'cafe-a', is_active: 1, auth_version: 1 },
  { id: 'cashier-1', name: 'Cashier', phone: null, role: 'cashier', tenant_id: 'cafe-a', is_active: 1, auth_version: 1 },
  { id: 'mgr-1', name: 'Store Manager', phone: null, role: 'manager', tenant_id: 'cafe-a', is_active: 1, auth_version: 1 },
  { id: 'w-1', name: 'Waiter', phone: null, role: 'waiter', tenant_id: 'cafe-a', is_active: 1, auth_version: 1 },
  { id: 'b-1', name: 'Barista', phone: null, role: 'barista', tenant_id: 'cafe-a', is_active: 1, auth_version: 1 },
];

function makeTestEnv() {
  const store = new Map<string, string>();
  const db = createMockDB(STAFF_ROWS);
  db.prepare = (_sql: string) => {
    // The session gate's account read is answered from the rows above; every
    // other statement keeps the scripted route data below.
    if (isStaffAccountLookup(_sql)) {
      let boundId = '';
      const account = {
        bind: (id: unknown) => { boundId = String(id ?? ''); return account; },
        first: async () => STAFF_ROWS.find(r => r.id === boundId) ?? null,
      };
      return account as any;
    }
    const stmt = {
      bind: (..._args: unknown[]) => stmt,
      run: async () => ({ success: true, changes: 1, lastRowId: 1 }),
      first: async () => {
        if (_sql.includes('COUNT(*) as total FROM orders')) return { total: 10 };
        if (_sql.includes('SUM(COALESCE(total_amount, total)) as revenue')) return { revenue: 500000 };
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
          items: [{ product_id: 'prod-1', name: 'Cafe Sua', qty: 1, price: 30000 }],
          fulfillment_type: 'TAKEAWAY',
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.total).toBe(35000);
    expect(data.payment_method).toBe('cod');
  });

  it('routes GET /api/orders/summary to summary handler (not captured by /:id)', async () => {
    const env = makeTestEnv();
    const token = await generateJWT({ sub: 'staff-1', role: 'staff', tenantId: 'cafe-a', name: 'Staff' , authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web'}, TEST_SECRET, 28800);
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

  it('routes GET /api/orders/:id/events to the SSE stream for a guest order', async () => {
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
    expect(data.data.payment_status).toBe('unpaid');
  });

  it('rejects unsupported payment methods on public, guest, and staff order APIs', async () => {
    const env = makeTestEnv();
    const unsupported = ['momo', 'apple_pay', 'google_pay'];
    const staffToken = await generateJWT({ sub: 'cashier-1', id: 'cashier-1', role: 'cashier', tenantId: 'cafe-a', name: 'Cashier' , authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web'}, TEST_SECRET, 28800);

    for (const payment_method of unsupported) {
      const customerOrder = await app.fetch(new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Guest', customer_phone: '0901112233', payment_method,
          total: 35000, order_type: 'takeaway',
          items: [{ name: 'Cafe Sua Da', product_id: 'prod-1', quantity: 1, price: 35000 }],
        }),
      }), env);
      expect(customerOrder.status).toBe(400);

      const guestCheckout = await app.fetch(new Request('https://test.aura/api/orders/guest-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Guest', customer_phone: '0901112233', payment_method,
          items: [{ name: 'Cafe Sua Da', qty: 1, price: 35000 }],
          fulfillment_type: 'TAKEAWAY',
        }),
      }), env);
      expect(guestCheckout.status).toBe(400);

      const staffCheckout = await app.fetch(new Request('https://test.aura/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({
          payment_method,
          items: [{ product_id: 'prod-1', quantity: 1, price: 35000 }],
        }),
      }), env);
      expect(staffCheckout.status).toBe(400);
    }
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
    const token = await generateJWT({ sub: 'staff-1', role: 'staff', tenantId: 'cafe-a', name: 'Staff' , authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web'}, TEST_SECRET, 28800);
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
    const token = await generateJWT({ sub: 'mgr-1', role: 'manager', tenantId: 'cafe-a', name: 'Store Manager' , authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web'}, TEST_SECRET, 28800);

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
          payment_method: 'cod',
          order_type: 'dine_in',
          table_id: '1',
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
    const waiterToken = await generateJWT({ sub: 'w-1', role: 'waiter', tenantId: 'cafe-a', name: 'Waiter' , authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web'}, TEST_SECRET, 28800);
    const baristaToken = await generateJWT({ sub: 'b-1', id: 'b-1', role: 'barista', tenantId: 'cafe-a', name: 'Barista', authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' }, TEST_SECRET, 28800);

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
          payment_method: 'cod',
          order_type: 'dine_in',
          table_id: '1',
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
