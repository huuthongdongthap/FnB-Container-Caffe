import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paymentRouter } from '../commands/payos-create-link';

function createMockEnv(overrides: Record<string, unknown> = {}) {
  const defaultOrder = {
    id: 'ORD_GUEST_01',
    total: 55000,
    payment_status: 'unpaid',
    customer_id: null,
    is_cod: 0,
  };

  const db = {
    prepare: (sql: string) => {
      const stmt = {
        _sql: sql,
        _binds: [] as unknown[],
        bind(...args: unknown[]) {
          stmt._binds = args;
          return stmt;
        },
        first: async <T = unknown>() => {
          if (sql.includes('FROM orders WHERE id = ?')) {
            const orderId = stmt._binds[0];
            if (overrides._orderNotFound) return null as T;
            if (overrides._order) return overrides._order as T;
            return { ...defaultOrder, id: orderId } as T;
          }
          if (sql.includes('FROM payments WHERE order_id = ?')) {
            return (overrides._existingPayment ?? null) as T;
          }
          return null as T;
        },
        run: async () => ({ success: true, changes: 1 }),
        all: async () => ({ results: [], success: true }),
      };
      return stmt;
    },
  };

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
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        code: '00',
        desc: 'Success',
        data: {
          checkoutUrl: 'https://pay.payos.vn/web/test-checkout-url',
          orderCode: 123456789,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

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
