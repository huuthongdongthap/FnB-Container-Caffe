/**
 * Payment COD Lifecycle Contract Tests
 * Verifies:
 * - Cash collection short-circuit in payment-link creation
 * - KDS staff mark-cod-paid handler
 * - Synchronization between `orders.payment_status` and `payments.status`
 * - Guard rails against marking cancelled or non-COD orders as paid
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCodTestEnv } from './payment-test-helpers';

describe('Payment COD Lifecycle Contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('cash collection short-circuits PayOS and syncs both orders and payments tables', async () => {
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

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; is_cod: boolean; message: string };
    expect(body.success).toBe(true);
    expect(body.is_cod).toBe(true);
    expect(body.message).toBe('Cash collected');

    const orderUpdate = executedStatements.find(s => s.sql.includes('UPDATE orders SET status = \'completed\''));
    expect(orderUpdate).toBeDefined();
    expect(orderUpdate?.binds[2]).toBe('ORD_COD_1');

    const payUpdate = executedStatements.find(s => s.sql.includes('UPDATE payments SET status = \'completed\''));
    expect(payUpdate).toBeDefined();
    expect(payUpdate?.binds[1]).toBe('ORD_COD_1');
  });

  it('KDS staff mark-cod-paid updates order to completed/paid and syncs payments table', async () => {
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

    const orderUpdate = executedStatements.find(s => s.sql.includes('UPDATE orders SET status = \'completed\''));
    expect(orderUpdate).toBeDefined();
    const payUpdate = executedStatements.find(s => s.sql.includes('UPDATE payments SET status = \'completed\''));
    expect(payUpdate).toBeDefined();
    expect(payUpdate?.binds[1]).toBe('ORD_COD_2');
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
    expect(body.error).toContain('Cannot mark cancelled order as paid');
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
