// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paymentRouter } from '../commands/payos-create-link';
import { paymentSqliteDB, payosCheckoutResponse } from '../../../../worker/src/__tests__/helpers/payment-sqlite-db';

function createMockEnv(overrides: Record<string, unknown> = {}) {
  const defaultOrder = {
    id: 'ORD_GUEST_01',
    total: 55000,
    payment_method: 'payos',
    payment_status: 'unpaid',
    customer_id: null,
    is_cod: 0,
  };

  const fixture = paymentSqliteDB();
  const order = { ...defaultOrder, ...(overrides._order as object || {}) };
  if (!overrides._orderNotFound) fixture.seed('orders', order);
  if (overrides._existingPayment) fixture.seed('payments', { order_id: order.id, method: 'payos', amount: order.total,
    ...overrides._existingPayment as object });
  const db = fixture.db;

  return {
    AURA_DB: db,
    PAYOS_CLIENT_ID: 'test-client-id',
    PAYOS_API_KEY: 'test-api-key',
    PAYOS_CHECKSUM_KEY: 'test-checksum-key-12345678901234567890',
    FE_BASE_URL: 'https://auraspace.cafe',
    ...overrides,
  };
}

describe('POST /api/payment/create-link - Guest Checkout & Authorization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows unauthenticated guest to create payment link for guest order', async () => {
    const env = createMockEnv();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
      payosCheckoutResponse(JSON.parse(String(init?.body)), 'test-checksum-key-12345678901234567890', 'test-checkout-url'));

    const req = new Request('https://test.aura/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'ORD_GUEST_01',
        description: 'AURA Cafe B02',
      }),
    });

    const res = await paymentRouter.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.checkoutUrl).toBe('https://pay.payos.vn/web/test-checkout-url');
  });

  it('returns cached payment link when already created', async () => {
    const env = createMockEnv({
      _existingPayment: {
        id: 'PAY_123',
        transaction_id: '987654321',
        payment_url: 'https://pay.payos.vn/web/cached-url',
        status: 'pending',
      },
    });

    const req = new Request('https://test.aura/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'ORD_GUEST_01',
      }),
    });

    const res = await paymentRouter.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.cached).toBe(true);
    expect(body.checkoutUrl).toBe('https://pay.payos.vn/web/cached-url');
  });

  it('returns 404 when order does not exist', async () => {
    const env = createMockEnv({ _orderNotFound: true });
    const req = new Request('https://test.aura/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'ORD_NON_EXISTENT',
      }),
    });

    const res = await paymentRouter.fetch(req, env);
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('returns 409 when order is already marked as paid', async () => {
    const env = createMockEnv({
      _order: {
        id: 'ORD_PAID_01',
        total: 50000,
        payment_method: 'payos',
        payment_status: 'paid',
        customer_id: null,
        is_cod: 0,
      },
    });

    const req = new Request('https://test.aura/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'ORD_PAID_01',
      }),
    });

    const res = await paymentRouter.fetch(req, env);
    expect(res.status).toBe(409);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('returns 400 when order total is below minimum (< 1000)', async () => {
    const env = createMockEnv({
      _order: {
        id: 'ORD_LOW_01',
        total: 500,
        payment_method: 'payos',
        payment_status: 'unpaid',
        customer_id: null,
        is_cod: 0,
      },
    });

    const req = new Request('https://test.aura/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'ORD_LOW_01',
      }),
    });

    const res = await paymentRouter.fetch(req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('accepts both snake_case (order_id) and camelCase (orderId)', async () => {
    const env = createMockEnv({
      _existingPayment: {
        id: 'PAY_CAMEL',
        transaction_id: '11223344',
        payment_url: 'https://pay.payos.vn/web/camel-case-url',
        status: 'pending',
      },
    });

    const req = new Request('https://test.aura/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ORD_GUEST_01',
      }),
    });

    const res = await paymentRouter.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.checkoutUrl).toBe('https://pay.payos.vn/web/camel-case-url');
  });
});
