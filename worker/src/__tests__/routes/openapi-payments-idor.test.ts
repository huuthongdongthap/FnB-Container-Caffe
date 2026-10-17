/**
 * OpenAPI Payments IDOR Prevention & RBAC Tests
 * Verifies that:
 * - Customers can only create and access payments for their own orders (IDOR protection).
 * - Customers cannot list all store payments or issue refunds (403 Forbidden).
 * - Managers, staff, and owners can perform store payment operations.
 */

import { describe, it, expect } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv, createMockDB } from '../test-utils';

const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';
const ORD_CUST_1 = 'a1111111-1111-4111-8111-111111111111';
const ORD_CUST_2 = 'a2222222-2222-4222-8222-222222222222';
const PAY_1 = 'b1111111-1111-4111-8111-111111111111';
const PAY_2 = 'b2222222-2222-4222-8222-222222222222';
const IDEM_1 = 'c1111111-1111-4111-8111-111111111111';
const IDEM_2 = 'c2222222-2222-4222-8222-222222222222';

function makePaymentsTestEnv() {
  const store = new Map<string, string>();
  const db = createMockDB();

  const orders: Record<string, { id: string; customer_id: string | null; total: number; payment_status: string }> = {
    [ORD_CUST_1]: { id: ORD_CUST_1, customer_id: 'cust-1', total: 50000, payment_status: 'pending' },
    [ORD_CUST_2]: { id: ORD_CUST_2, customer_id: 'cust-2', total: 75000, payment_status: 'pending' },
  };

  const payments: Record<string, {
    id: string;
    order_id: string;
    method: string;
    amount: number;
    status: string;
    transaction_id: string | null;
    payment_url: string | null;
    created_at: string;
    updated_at: string;
  }> = {
    [PAY_1]: {
      id: PAY_1,
      order_id: ORD_CUST_1,
      method: 'momo',
      amount: 50000,
      status: 'pending',
      transaction_id: 'txn_123',
      payment_url: 'https://momo.vn/pay',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    [PAY_2]: {
      id: PAY_2,
      order_id: ORD_CUST_2,
      method: 'payos',
      amount: 75000,
      status: 'pending',
      transaction_id: 'txn_456',
      payment_url: 'https://payos.vn/pay',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  db.prepare = ((sql: string) => {
    let boundArgs: unknown[] = [];
    const stmt = {
      _sql: sql,
      bind: (...args: unknown[]) => {
        boundArgs = args;
        return stmt;
      },
      first: async () => {
        if (sql.includes('FROM orders WHERE id = ?')) {
          const id = boundArgs[0] as string;
          return orders[id] || null;
        }
        if (sql.includes('FROM payments') && sql.includes('WHERE order_id = ? AND method = ?')) {
          return null; // No existing pending payment
        }
        if (sql.includes('FROM payments p WHERE p.id = ?') || sql.includes('FROM payments WHERE id = ?')) {
          const id = boundArgs[0] as string;
          return payments[id] || null;
        }
        if (sql.includes('SELECT COUNT(*) as total FROM payments')) {
          return { total: Object.keys(payments).length };
        }
        return null;
      },
      all: async () => {
        if (sql.includes('FROM payments p')) {
          return { results: Object.values(payments), success: true };
        }
        return { results: [], success: true };
      },
      run: async () => ({ success: true, changes: 1, lastRowId: 1 }),
    };
    return stmt as any;
  }) as any;

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
          method: 'momo',
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
          method: 'momo',
          amount: 75000,
          idempotencyKey: IDEM_2,
        }),
      }),
      env
    );

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe('Forbidden');
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

  it('rejects customer with 403 Forbidden when viewing another customer payment (GET /api/payments/:id)', async () => {
    const env = makePaymentsTestEnv();
    const token = await generateJWT({ sub: 'cust-1', role: 'customer', name: 'Alice' }, TEST_SECRET);

    const res = await app.fetch(
      new Request(`https://test.aura/api/payments/${PAY_2}`, { // PAY_2 belongs to cust-2
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe('Forbidden');
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
});
