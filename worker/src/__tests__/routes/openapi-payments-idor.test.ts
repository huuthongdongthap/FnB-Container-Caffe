// @vitest-environment node
/**
 * OpenAPI Payments IDOR Prevention & RBAC Tests
 * Verifies that:
 * - Customers can only create and access payments for their own orders (IDOR protection).
 * - Customers cannot list all store payments or issue refunds (403 Forbidden).
 * - Managers, staff, and owners can perform store payment operations.
 */

import { describe, it, expect, vi } from 'vitest';
import { app } from '../../index';
import { paymentSqliteDB } from '../helpers/payment-sqlite-db';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv } from '../test-utils';

const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';
const ORD_CUST_1 = 'a1111111-1111-4111-8111-111111111111';
const ORD_CUST_2 = 'a2222222-2222-4222-8222-222222222222';
const PAY_1 = 'b1111111-1111-4111-8111-111111111111';
const PAY_2 = 'b2222222-2222-4222-8222-222222222222';
const IDEM_1 = 'c1111111-1111-4111-8111-111111111111';
const IDEM_2 = 'c2222222-2222-4222-8222-222222222222';

function makePaymentsTestEnv() {
  const store = new Map<string, string>();
  const fixture = paymentSqliteDB();
  fixture.seed('orders', { id: ORD_CUST_1, customer_id: 'cust-1', total: 50000, payment_method: 'payos' });
  fixture.seed('orders', { id: ORD_CUST_2, customer_id: 'cust-2', total: 75000, payment_method: 'payos' });
  fixture.seed('payments', { id: PAY_1, order_id: ORD_CUST_1, method: 'payos', amount: 50000,
    status: 'pending', transaction_id: '123', payment_url: 'https://pay.payos.vn/web/one' });
  fixture.seed('payments', { id: PAY_2, order_id: ORD_CUST_2, method: 'payos', amount: 75000,
    status: 'pending', transaction_id: '456', payment_url: 'https://pay.payos.vn/web/two' });
  const db = fixture.db;

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

describe('OpenAPI Payments IDOR & RBAC Hardening', () => {
  it('allows customer to create payment for their own order', async () => {
    const env = makePaymentsTestEnv();
    const token = await generateJWT({ sub: 'cust-1', role: 'customer', name: 'Alice' }, TEST_SECRET);

    const res = await app.fetch(
      new Request('https://test.aura/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: ORD_CUST_1,
          method: 'payos',
          amount: 50000,
          idempotencyKey: IDEM_1,
        }),
      }),
      env
    );

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('paymentId');
  });

  it('rejects unsupported methods for new payment intents', async () => {
    const env = makePaymentsTestEnv();
    const token = await generateJWT({ sub: 'cust-1', role: 'customer', name: 'Alice' }, TEST_SECRET);
    const res = await app.fetch(
      new Request('https://test.aura/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: ORD_CUST_1,
          method: 'momo',
          amount: 50000,
          idempotencyKey: IDEM_1,
        }),
      }),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('rejects customer with 403 Forbidden when creating payment for another customer order (IDOR)', async () => {
    const env = makePaymentsTestEnv();
    const token = await generateJWT({ sub: 'cust-1', role: 'customer', name: 'Alice' }, TEST_SECRET);

    const res = await app.fetch(
      new Request('https://test.aura/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: ORD_CUST_2, // Belongs to cust-2!
          method: 'payos',
          amount: 75000,
          idempotencyKey: IDEM_2,
        }),
      }),
      env
    );

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });

  it('allows customer to view payment for their own order (GET /api/payments/:id)', async () => {
    const env = makePaymentsTestEnv();
    const token = await generateJWT({ sub: 'cust-1', role: 'customer', name: 'Alice' }, TEST_SECRET);

    const res = await app.fetch(
      new Request(`https://test.aura/api/payments/${PAY_1}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(PAY_1);
  });

  it('rejects customer with concealed 404 when viewing another customer payment (GET /api/payments/:id)', async () => {
    const env = makePaymentsTestEnv();
    const token = await generateJWT({ sub: 'cust-1', role: 'customer', name: 'Alice' }, TEST_SECRET);

    const res = await app.fetch(
      new Request(`https://test.aura/api/payments/${PAY_2}`, { // PAY_2 belongs to cust-2
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });

  it('rejects customer from listing all store payments (GET /api/payments) with 403 Forbidden', async () => {
    const env = makePaymentsTestEnv();
    const token = await generateJWT({ sub: 'cust-1', role: 'customer', name: 'Alice' }, TEST_SECRET);

    const res = await app.fetch(
      new Request('https://test.aura/api/payments', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(res.status).toBe(403);
  });

  it('rejects customer from requesting refunds (POST /api/payments/refund) with 403 Forbidden', async () => {
    const env = makePaymentsTestEnv();
    const token = await generateJWT({ sub: 'cust-1', role: 'customer', name: 'Alice' }, TEST_SECRET);

    const res = await app.fetch(
      new Request('https://test.aura/api/payments/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentId: PAY_1,
          amount: 50000,
          reason: 'Customer request',
          idempotencyKey: IDEM_1,
        }),
      }),
      env
    );

    expect(res.status).toBe(403);
  });

  it('allows store manager to list payments and view any payment', async () => {
    const env = makePaymentsTestEnv();
    const token = await generateJWT({ sub: 'mgr-1', role: 'manager', name: 'Store Manager' }, TEST_SECRET);

    const listRes = await app.fetch(
      new Request('https://test.aura/api/payments', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as any;
    expect(listBody.success).toBe(true);

    const getRes = await app.fetch(
      new Request(`https://test.aura/api/payments/${PAY_1}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(getRes.status).toBe(200);
  });
  it('confines list results to the signed tenant even when client requests another tenant', async () => {
    const env = makePaymentsTestEnv();
    await env.AURA_DB.prepare('UPDATE orders SET tenant_id = ? WHERE id = ?').bind('cafe-a', ORD_CUST_1).run();
    await env.AURA_DB.prepare('UPDATE orders SET tenant_id = ? WHERE id = ?').bind('cafe-b', ORD_CUST_2).run();
    const token = await generateJWT({ id: 'staff-a', role: 'cashier', tenantId: 'cafe-a' }, TEST_SECRET);
    const res = await app.fetch(new Request('https://test.aura/api/payments?tenant_id=cafe-b', {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': 'cafe-b' } }), env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.meta.total).toBe(1); expect(body.data.payments.map((payment: any) => payment.id)).toEqual([PAY_1]);
  });

  it.each(['payment', 'refund', 'refund-details'])('conceals foreign tenant %s before provider I/O or money mutation', async (operation) => {
    const env = makePaymentsTestEnv();
    await env.AURA_DB.prepare('UPDATE orders SET tenant_id = ? WHERE id = ?').bind('cafe-b', ORD_CUST_2).run();
    await env.AURA_DB.prepare("UPDATE payments SET status = 'completed' WHERE id = ?").bind(PAY_2).run();
    const before = await env.AURA_DB.prepare('SELECT * FROM payments WHERE id = ?').bind(PAY_2).first();
    const token = await generateJWT({ id: 'staff-a', role: 'cashier', tenantId: 'cafe-a' }, TEST_SECRET);
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const url = operation === 'refund' ? '/api/payments/refund' : operation === 'refund-details' ? `/api/payments/refunds/${PAY_2}` : `/api/payments/${PAY_2}`;
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Provider must not be invoked'));
    try {
      const res = await app.fetch(new Request(`https://test.aura${url}`, operation === 'refund' ? { method: 'POST', headers: auth,
        body: JSON.stringify({ paymentId: PAY_2, amount: 75000, reason: 'Test foreign request' }) } : { headers: auth }), env);
      expect(res.status).toBe(404); expect(spy).not.toHaveBeenCalled();
      expect(await env.AURA_DB.prepare('SELECT * FROM payments WHERE id = ?').bind(PAY_2).first()).toEqual(before);
    } finally { spy.mockRestore(); }
  });

});
