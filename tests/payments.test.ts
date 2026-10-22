// @vitest-environment node
/**
 * Payment Routes Tests — POST /api/payment/create-link
 *
 * Tests for paymentRouter with PayOS integration, mocked D1, fetch, and crypto.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';
import { paymentSqliteDB, payosCheckoutResponse } from '../worker/src/__tests__/helpers/payment-sqlite-db';

// ── Polyfills ─────────────────────────────────────────────────────
(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;

// ── Mock requireAuth & optionalAuth ───────────────────────────────
vi.mock('../worker/src/middleware/auth', () => ({
  requireAuth: () => {
    return async (c: any, next: any) => {
      c.set('user', { id: 'cust-1', email: 'customer@test.com', name: 'Test Customer', role: 'customer' });
      await next();
    };
  },
  optionalAuth: () => {
    return async (c: any, next: any) => {
      c.set('user', { id: 'cust-1', email: 'customer@test.com', name: 'Test Customer', role: 'customer' });
      await next();
    };
  },
}));

// ── Mock D1 Database ──────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const fixture = paymentSqliteDB();
  for (const table of ['orders', 'payments'] as const) {
    for (const row of seedData[table] || []) fixture.seed(table, row);
  }
  return fixture.db;
}

let mockFetch: ReturnType<typeof vi.fn>;
let paymentRouter: any;
let env: any;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch;
});

async function mountRouter() {
  const mod = await import('@aura/domain-payment');
  paymentRouter = mod.paymentRouter;
}

const seedOrder = {
  id: 'ord-1',
  total: 50000,
  payment_method: 'payos',
  payment_status: 'pending',
  customer_id: 'cust-1',
};

describe('POST /create-link', () => {
  test('creates PayOS payment link successfully', async () => {
    mockFetch.mockImplementation(async (_url, init) => payosCheckoutResponse(JSON.parse(String(init.body)), 'test-checksum-key', 'pl_test'));

    env = {
      AURA_DB: createMockD1({ orders: [seedOrder], payments: [] }),
      PAYOS_CLIENT_ID: 'test-client-id',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
      FE_BASE_URL: 'https://auraspace.cafe',
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ord-1', description: 'Test order' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.checkoutUrl).toBe('https://pay.payos.vn/web/pl_test');
  });

  test('returns 400 on missing order_id', async () => {
    env = {
      AURA_DB: createMockD1({ orders: [], payments: [] }),
      PAYOS_CLIENT_ID: 'test-client-id',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 404 when order not found', async () => {
    env = {
      AURA_DB: createMockD1({ orders: [], payments: [] }),
      PAYOS_CLIENT_ID: 'test-client-id',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'nonexistent' }),
    }, env);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/không tìm thấy/i);
  });

  test('returns 409 when order already paid', async () => {
    const paidOrder = { ...seedOrder, payment_status: 'paid' };
    env = {
      AURA_DB: createMockD1({ orders: [paidOrder], payments: [] }),
      PAYOS_CLIENT_ID: 'test-client-id',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ord-1' }),
    }, env);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/đã được thanh toán/i);
  });

  test('returns 500 when PayOS env vars not configured', async () => {
    env = {
      AURA_DB: createMockD1({ orders: [seedOrder], payments: [] }),
      // No PayOS env vars
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ord-1' }),
    }, env);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/chưa được cấu hình/i);
  });

  test('returns 502 when PayOS API returns error', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ code: '01', desc: 'Invalid params' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    env = {
      AURA_DB: createMockD1({ orders: [seedOrder], payments: [] }),
      PAYOS_CLIENT_ID: 'test-client-id',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ord-1' }),
    }, env);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
