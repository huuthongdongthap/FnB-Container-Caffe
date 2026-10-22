// @vitest-environment node
/**
 * Payment COD Lifecycle Contract Tests
 * Verifies:
 * - COD orders cannot be marked paid through PayOS link creation
 * - KDS staff mark-cod-paid handler
 * - Synchronization between `orders.payment_status` and `payments.status`
 * - Guard rails against marking cancelled or non-COD orders as paid
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeCodTestEnv,
  makeWebhookTestEnv,
  signPayosData,
  TEST_CHECKSUM_KEY,
} from './payment-test-helpers';

describe('Payment COD Lifecycle Contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects PayOS link creation for COD without marking it collected', async () => {
    const { paymentApp, env, executedStatements } = makeCodTestEnv({
      id: 'ORD_COD_1',
      total: 55000,
      status: 'pending',
      payment_status: 'cod_pending',
      is_cod: 1,
    });

    const res = await paymentApp.fetch(
      new Request('https://test.aura/api/payment/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ORD_COD_1' }),
      }),
      env
    );

    expect(res.status).toBe(409);
    expect(executedStatements.some(s => /UPDATE (orders|payments).*status = 'completed'/.test(s.sql))).toBe(false);
  });

  it('COD collection marks payment paid without completing kitchen work and syncs ledger', async () => {
    const { kdsApp, env, executedStatements } = makeCodTestEnv({
      id: 'ORD_COD_2',
      total: 70000,
      status: 'preparing',
      payment_status: 'cod_pending',
      is_cod: 1,
    });

    const res = await kdsApp.fetch(
      new Request('https://test.aura/ORD_COD_2/mark-cod-paid', {
        method: 'PATCH',
      }),
      env
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; message: string };
    expect(body.success).toBe(true);
    expect(body.message).toBe('Marked as paid');

    const orderUpdate = executedStatements.find(s => s.sql.includes("UPDATE orders SET payment_status = 'paid'"));
    expect(orderUpdate).toBeDefined();
    expect(orderUpdate?.sql).not.toContain("status = 'completed'");
    const payUpdate = executedStatements.find(s => s.sql.includes('UPDATE payments SET status = \'completed\''));
    expect(payUpdate).toBeDefined();
    expect(payUpdate?.binds[1]).toBe('ORD_COD_2');
  });

  it('collects a canonical COD order without relying on the legacy is_cod flag', async () => {
    const { kdsApp, env, executedStatements } = makeCodTestEnv({
      id: 'ORD_COD_CANONICAL',
      total: 70000,
      status: 'preparing',
      payment_status: 'unpaid',
      payment_method: 'cod',
      is_cod: 0,
    });

    const res = await kdsApp.fetch(
      new Request('https://test.aura/ORD_COD_CANONICAL/mark-cod-paid', { method: 'PATCH' }),
      env
    );

    expect(res.status).toBe(200);
    expect(executedStatements.some(statement => statement.sql.includes("payment_status = 'paid'"))).toBe(true);
  });

  it('returns idempotent success if COD order is already paid', async () => {
    const { kdsApp, env, executedStatements } = makeCodTestEnv({
      id: 'ORD_COD_3',
      total: 50000,
      status: 'completed',
      payment_status: 'paid',
      is_cod: 1,
    });

    const res = await kdsApp.fetch(
      new Request('https://test.aura/ORD_COD_3/mark-cod-paid', {
        method: 'PATCH',
      }),
      env
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; message: string };
    expect(body.success).toBe(true);
    expect(body.message).toBe('Already paid');
    expect(executedStatements.length).toBe(0);
  });

  it('rejects marking cancelled order as paid with HTTP 409', async () => {
    const { kdsApp, env } = makeCodTestEnv({
      id: 'ORD_COD_4',
      total: 40000,
      status: 'cancelled',
      payment_status: 'unpaid',
      is_cod: 1,
    });

    const res = await kdsApp.fetch(
      new Request('https://test.aura/ORD_COD_4/mark-cod-paid', {
        method: 'PATCH',
      }),
      env
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.error).toContain('Cannot collect a cancelled order');
  });

  it('rejects a PayOS webhook for COD payment rows without updating either record', async () => {
    const { app, env, executedStatements } = makeWebhookTestEnv({
      payment: { id: 'PAY_COD', order_id: 'ORD_COD', status: 'pending', amount: 55000, method: 'cod' },
      orderMethod: 'cod',
    });
    const payload = {
      success: true,
      data: { orderCode: 12345, amount: 55000, description: 'Order ORD_COD', code: '00' },
    };
    const res = await app.fetch(new Request('https://test.aura/payos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-payos-signature': signPayosData(payload.data, TEST_CHECKSUM_KEY),
      },
      body: JSON.stringify(payload),
    }), env, { waitUntil: () => {} } as any);

    expect(res.status).toBe(409);
    expect(executedStatements).toHaveLength(0);
  });

  it('rejects non-COD orders from mark-cod-paid with HTTP 409', async () => {
    const { kdsApp, env } = makeCodTestEnv({
      id: 'ORD_ONLINE_1',
      total: 60000,
      status: 'pending',
      payment_status: 'unpaid',
      is_cod: 0,
    });

    const res = await kdsApp.fetch(
      new Request('https://test.aura/ORD_ONLINE_1/mark-cod-paid', {
        method: 'PATCH',
      }),
      env
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.error).toContain('Not a COD order');
  });
});
