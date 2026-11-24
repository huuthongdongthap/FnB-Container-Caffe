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

  it('returns 403 when unauthenticated guest requests payment link for a registered customer order', async () => {
    const env = createMockEnv({
      _order: {
        id: 'ORD_OWNED_01',
        total: 65000,
        payment_method: 'payos',
        payment_status: 'unpaid',
        customer_id: 'cust_registered_01',
        is_cod: 0,
      },
    });

    const req = new Request('https://test.aura/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'ORD_OWNED_01',
      }),
    });

    const res = await paymentRouter.fetch(req, env);
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('rate-limits guest regenerate requests with a 30s cooldown and 3-attempt hourly cap', async () => {
    const env = createMockEnv({
      _order: {
        id: 'ORD_GUEST_REGEN_01',
        total: 55000,
        payment_method: 'payos',
        payment_status: 'unpaid',
        customer_id: null,
        is_cod: 0,
      },
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (!init?.method || init.method === 'GET') {
        return new Response(JSON.stringify({ code: 'not-found' }), { status: 404 });
      }
      if (urlStr.endsWith('/cancel')) {
        return new Response(JSON.stringify({ code: '00' }), { status: 200 });
      }
      return payosCheckoutResponse(
        JSON.parse(String(init?.body)),
        'test-checksum-key-12345678901234567890',
        'regen-checkout-url',
      );
    });

    const makeRegenReq = () =>
      new Request('https://test.aura/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: 'ORD_GUEST_REGEN_01',
          regenerate: true,
        }),
      });

    let nowMs = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs);

    // 1st regenerate attempt allowed
    const first = await paymentRouter.fetch(makeRegenReq(), env);
    expect(first.status).toBe(200);

    // Immediate 2nd attempt within 30s cooldown -> 429
    nowMs += 5_000;
    const cooldownRes = await paymentRouter.fetch(makeRegenReq(), env);
    expect(cooldownRes.status).toBe(429);
    expect(Number(cooldownRes.headers.get('Retry-After'))).toBeGreaterThanOrEqual(25);
    const cooldownBody = (await cooldownRes.json()) as Record<string, unknown>;
    expect(cooldownBody).toMatchObject({
      success: false,
      code: 'PAYOS_REGENERATE_RATE_LIMITED',
      retryable: true,
    });

    // Advance past 30s cooldown -> 2nd and 3rd attempts allowed
    nowMs += 31_000;
    expect((await paymentRouter.fetch(makeRegenReq(), env)).status).toBe(200);
    nowMs += 31_000;
    expect((await paymentRouter.fetch(makeRegenReq(), env)).status).toBe(200);

    // 4th attempt after cooldown -> blocked by max 3 attempts cap
    nowMs += 31_000;
    const cappedRes = await paymentRouter.fetch(makeRegenReq(), env);
    expect(cappedRes.status).toBe(429);
    const cappedBody = (await cappedRes.json()) as Record<string, unknown>;
    expect(cappedBody).toMatchObject({
      success: false,
      code: 'PAYOS_REGENERATE_RATE_LIMITED',
      retryable: false,
    });
  });
});
