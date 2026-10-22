// @vitest-environment node
/**
 * Payment Intent Lifecycle Contract Tests
 * Verifies:
 * - Server authoritativeness for payment amount
 * - Rejection of tampered client amounts
 * - Idempotent caching of pending payment intents
 * - Deterministic rejection of already-paid orders (409)
 * - Strict persistence into canonical `payments` table
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { paymentRouter } from '@aura/domain-payment';
import { paymentSqliteDB, payosCheckoutResponse } from '../helpers/payment-sqlite-db';

function makeTestEnv(dbConfig: {
  order?: { id: string; total: number; payment_status: string; payment_method?: string; customer_id?: string | null; is_cod?: number } | null;
  existingPayment?: { id: string; transaction_id: string; payment_url: string; status: string } | null;
}) {
  const fixture = paymentSqliteDB();
  const executedStatements = fixture.executedStatements;
  if (dbConfig.order) fixture.seed('orders', dbConfig.order);
  if (dbConfig.order && dbConfig.existingPayment) fixture.seed('payments', {
    ...dbConfig.existingPayment, order_id: dbConfig.order.id, amount: dbConfig.order.total, method: 'payos' });
  const db = fixture.db;

  const app = new Hono<{ Bindings: any }>();
  app.route('/api/payment', paymentRouter);

  return {
    app,
    executedStatements,
    env: {
      AURA_DB: db,
      PAYOS_CLIENT_ID: 'client_123',
      PAYOS_API_KEY: 'key_123',
      PAYOS_CHECKSUM_KEY: 'checksum_key_123456789012345678',
      FE_BASE_URL: 'https://auraspace.cafe',
    },
  };
}

describe('Payment Intent Lifecycle Contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects tampered amount that does not match server order total', async () => {
    const { app, env } = makeTestEnv({
      order: { id: 'ORD_101', total: 65000, payment_status: 'unpaid', payment_method: 'payos', is_cod: 0 },
    });

    const res = await app.fetch(
      new Request('https://test.aura/api/payment/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: 'ORD_101',
          amount: 10000, // Tampered client price
        }),
      }),
      env
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('Tampered amount');
  });

  it('rejects payment request if order is already paid with HTTP 409', async () => {
    const { app, env } = makeTestEnv({
      order: { id: 'ORD_102', total: 50000, payment_status: 'paid', payment_method: 'payos', is_cod: 0 },
    });

    const res = await app.fetch(
      new Request('https://test.aura/api/payment/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ORD_102' }),
      }),
      env
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });

  it('returns cached checkout URL for existing pending payment idempotently', async () => {
    const { app, env } = makeTestEnv({
      order: { id: 'ORD_103', total: 75000, payment_status: 'unpaid', payment_method: 'payos', is_cod: 0 },
      existingPayment: {
        id: 'PAY_EXISTING',
        transaction_id: '998877',
        payment_url: 'https://pay.payos.vn/web/test-link',
        status: 'pending',
      },
    });

    const res = await app.fetch(
      new Request('https://test.aura/api/payment/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ORD_103' }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; checkoutUrl: string; orderCode: number; cached: boolean };
    expect(body.success).toBe(true);
    expect(body.cached).toBe(true);
    expect(body.checkoutUrl).toBe('https://pay.payos.vn/web/test-link');
    expect(body.orderCode).toBe(998877);
  });

  it('derives authoritative amount from server order total when creating link', async () => {
    const { app, env, executedStatements } = makeTestEnv({
      order: { id: 'ORD_104', total: 80000, payment_status: 'unpaid', payment_method: 'payos', is_cod: 0 },
      existingPayment: null,
    });

    // Mock PayOS API fetch response
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
      payosCheckoutResponse(JSON.parse(String(init?.body)), 'checksum_key_123456789012345678', 'new-link'));

    const res = await app.fetch(
      new Request('https://test.aura/api/payment/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ORD_104' }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; checkoutUrl: string };
    expect(body.success).toBe(true);
    expect(body.checkoutUrl).toBe('https://pay.payos.vn/web/new-link');

    // Verify insertion into canonical payments table with server total 80000
    const insertPayment = executedStatements.find(s => s.sql.includes('INSERT OR IGNORE INTO payments'));
    expect(insertPayment).toBeDefined();
    expect(insertPayment?.binds[1]).toBe('ORD_104');
    expect(insertPayment?.binds[2]).toBe(80000); // Server authoritative total
    const updateUrl = executedStatements.find(s => s.sql.includes('SET payment_url = ?'));
    expect(updateUrl?.binds[0]).toBe('https://pay.payos.vn/web/new-link');
  });

  it('rejects order with invalid or sub-minimum total (< 1000 VND)', async () => {
    const { app, env } = makeTestEnv({
      order: { id: 'ORD_105', total: 500, payment_status: 'unpaid', payment_method: 'payos', is_cod: 0 },
    });

    const res = await app.fetch(
      new Request('https://test.aura/api/payment/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ORD_105' }),
      }),
      env
    );

    expect(res.status).toBe(400);
  });
});
