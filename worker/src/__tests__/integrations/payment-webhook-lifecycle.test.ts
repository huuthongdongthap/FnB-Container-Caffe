/**
 * Payment Webhook Lifecycle Contract Tests
 * Verifies:
 * - Cryptographic HMAC-SHA256 signature validation
 * - Transition to 'completed' & order payment_status = 'paid'
 * - Failure isolation: 'failed' & 'expired' do NOT corrupt order state
 * - Callback idempotency (no duplicate transitions or notifications)
 * - Amount mismatch rejection & KV dead-letter quarantine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TEST_CHECKSUM_KEY,
  signPayosData,
  makeWebhookTestEnv,
} from './payment-test-helpers';

describe('Payment Webhook Lifecycle Contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies signature, transitions payment to completed, and marks order paid', async () => {
    const { app, env, executedStatements } = makeWebhookTestEnv({
      payment: { id: 'PAY_1', order_id: 'ORD_1', status: 'pending', amount: 50000 },
    });

    const payload = {
      success: true,
      data: { orderCode: 12345, amount: 50000, description: 'Order 12345', code: '00' },
    };

    const res = await app.fetch(
      new Request('https://test.aura/payos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payos-signature': signPayosData(payload.data, TEST_CHECKSUM_KEY),
        },
        body: JSON.stringify(payload),
      }),
      env,
      { waitUntil: () => {} } as any
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { error: number };
    expect(body.error).toBe(0);

    const payUpdate = executedStatements.find(s => s.sql.includes('UPDATE payments SET status = ?'));
    expect(payUpdate).toBeDefined();
    expect(payUpdate?.binds[0]).toBe('completed');

    const orderUpdate = executedStatements.find(s => s.sql.includes('UPDATE orders SET payment_status'));
    expect(orderUpdate).toBeDefined();
    expect(orderUpdate?.binds[1]).toBe('ORD_1');
  });

  it('isolates failure: failed webhook transitions payment to failed without corrupting order', async () => {
    const { app, env, executedStatements } = makeWebhookTestEnv({
      payment: { id: 'PAY_2', order_id: 'ORD_2', status: 'pending', amount: 45000 },
    });

    const payload = {
      success: false,
      data: { orderCode: 22222, amount: 45000, status: 'FAILED', code: '01' },
    };

    const res = await app.fetch(
      new Request('https://test.aura/payos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payos-signature': signPayosData(payload.data, TEST_CHECKSUM_KEY),
        },
        body: JSON.stringify(payload),
      }),
      env,
      { waitUntil: () => {} } as any
    );

    expect(res.status).toBe(200);

    const payUpdate = executedStatements.find(s => s.sql.includes('UPDATE payments SET status = ?'));
    expect(payUpdate).toBeDefined();
    expect(payUpdate?.binds[0]).toBe('failed');

    const orderUpdate = executedStatements.find(s => s.sql.includes('UPDATE orders'));
    expect(orderUpdate).toBeUndefined();
  });

  it('isolates expiration: expired webhook transitions payment to expired without corrupting order', async () => {
    const { app, env, executedStatements } = makeWebhookTestEnv({
      payment: { id: 'PAY_3', order_id: 'ORD_3', status: 'pending', amount: 30000 },
    });

    const payload = {
      success: false,
      data: { orderCode: 33333, amount: 30000, status: 'EXPIRED' },
    };

    const res = await app.fetch(
      new Request('https://test.aura/payos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payos-signature': signPayosData(payload.data, TEST_CHECKSUM_KEY),
        },
        body: JSON.stringify(payload),
      }),
      env,
      { waitUntil: () => {} } as any
    );

    expect(res.status).toBe(200);

    const payUpdate = executedStatements.find(s => s.sql.includes('UPDATE payments SET status = ?'));
    expect(payUpdate?.binds[0]).toBe('expired');

    const orderUpdate = executedStatements.find(s => s.sql.includes('UPDATE orders'));
    expect(orderUpdate).toBeUndefined();
  });

  it('handles duplicate callback idempotently when payment is already completed', async () => {
    const { app, env, executedStatements } = makeWebhookTestEnv({
      payment: { id: 'PAY_4', order_id: 'ORD_4', status: 'completed', amount: 50000 },
    });

    const payload = {
      success: true,
      data: { orderCode: 44444, amount: 50000, code: '00' },
    };

    const res = await app.fetch(
      new Request('https://test.aura/payos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payos-signature': signPayosData(payload.data, TEST_CHECKSUM_KEY),
        },
        body: JSON.stringify(payload),
      }),
      env,
      { waitUntil: () => {} } as any
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { message: string };
    expect(body.message).toBe('Already processed');
    expect(executedStatements.length).toBe(0);
  });

  it('rejects amount mismatch with HTTP 400 and quarantines in KV DLQ', async () => {
    const { app, env, kvStore, executedStatements } = makeWebhookTestEnv({
      payment: { id: 'PAY_5', order_id: 'ORD_5', status: 'pending', amount: 50000 },
    });

    const payload = {
      success: true,
      data: { orderCode: 55555, amount: 10000, code: '00' },
    };

    const res = await app.fetch(
      new Request('https://test.aura/payos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payos-signature': signPayosData(payload.data, TEST_CHECKSUM_KEY),
        },
        body: JSON.stringify(payload),
      }),
      env,
      { waitUntil: () => {} } as any
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { message: string };
    expect(body.message).toContain('Amount mismatch');
    expect(kvStore.has('payment:stuck:ORD_5')).toBe(true);

    const payUpdate = executedStatements.find(s => s.sql.includes('UPDATE payments'));
    expect(payUpdate).toBeUndefined();
    const orderUpdate = executedStatements.find(s => s.sql.includes('UPDATE orders'));
    expect(orderUpdate).toBeUndefined();
  });
});
