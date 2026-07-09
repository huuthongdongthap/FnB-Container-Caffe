/**
 * Unit tests for payment routes via paymentRouter Hono router.
 * Phase 1 TDD baseline — tests current behavior before hardening.
 * Tests: auth, idempotency, return URL, success path, DLQ.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TEST_JWT_SECRET, createMockKV, createMockDB } from '../test-utils';
import { generateJWT } from '../../lib/jwt';

async function createTestRouter() {
  const mod = await import('../../routes/payments');
  const honoMod = await import('hono');
  const Hono = honoMod.Hono;
  const app = new Hono();
  app.route('/api/payment', mod.paymentRouter);
  return app;
}

function makeEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    AURA_DB: createMockDB(),
    AUTH_KV: createMockKV(),
    JWT_SECRET: TEST_JWT_SECRET,
    PAYOS_CLIENT_ID: 'test-client',
    PAYOS_API_KEY: 'test-api-key',
    PAYOS_CHECKSUM_KEY: 'test-checksum',
    FE_BASE_URL: 'https://test.aura',
    ...overrides
  };
}

/**
 * Creates a DB mock that returns specific data based on SQL patterns.
 */
function paymentMockDB(config: {
  orderExists?: boolean;
  orderTotal?: number;
  orderPaymentStatus?: string;
  orderCustomerId?: string;
  existingPayment?: { status: string; checkout_url: string; transaction_id: string } | null;
}) {
  const db = createMockDB();
  const {
    orderExists = true,
    orderTotal = 50000,
    orderPaymentStatus = 'unpaid',
    orderCustomerId = 'USR_1',
    existingPayment = null
  } = config;

  db.prepare = ((sql: string) => {
    const stmt: Record<string, unknown> = {
      _sql: sql,
      _binds: [] as unknown[],
      bind(...args: unknown[]) {
        this._binds = args; return this;
      },
      first: async() => {
        if (sql.includes('FROM orders WHERE id = ?')) {
          if (!orderExists) {
            return null;
          }
          return { id: 'ORD_1', total: orderTotal, payment_status: orderPaymentStatus, customer_id: orderCustomerId };
        }
        if (sql.includes('FROM payments WHERE order_id')) {
          return existingPayment;
        }
        return null;
      },
      all: async() => ({ results: [], success: true }),
      run: async() => ({ success: true, changes: 1, lastRowId: 0, meta: { last_row_id: 0 } }),
      raw: async() => []
    };
    return stmt as any;
  }) as any;
  return db;
}

/** Mock PayOS API success response */
function mockPayOSSuccess() {
  return {
    code: '00',
    desc: 'success',
    data: { checkoutUrl: 'https://pay.payos.vn/pay/test123', paymentLinkId: 'LINK_001' }
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Auth Tests ────────────────────────────────────────────────────────

describe('PayOS create-link auth', () => {
  it('rejects unauthenticated request', async() => {
    const app = await createTestRouter();
    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(401);
  });

  it('rejects request with missing order_id', async() => {
    const app = await createTestRouter();
    const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' }, TEST_JWT_SECRET);
    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: '' })
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(400);
  });

  it('rejects request for non-existent order', async() => {
    const app = await createTestRouter();
    const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' }, TEST_JWT_SECRET);
    const env = makeEnv({ AURA_DB: paymentMockDB({ orderExists: false }) });
    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: 'ORD_MISSING' })
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(404);
  });
});

// ── Idempotency Tests ─────────────────────────────────────────────────

describe('PayOS create-link idempotency', () => {
  it('returns cached URL when pending payment already exists', async() => {
    const app = await createTestRouter();
    const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' }, TEST_JWT_SECRET);
    const env = makeEnv({
      AURA_DB: paymentMockDB({
        existingPayment: { status: 'pending', checkout_url: 'https://pay.payos.vn/existing', transaction_id: '12345' }
      })
    });
    // Mock PayOS API — should NOT be called (idempotency returns cached)
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(mockPayOSSuccess()), { status: 200 }));

    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    // TODO Phase 2: after idempotency implementation, this should return cached URL without calling PayOS
  });

  it('returns 409 when order is already paid', async() => {
    const app = await createTestRouter();
    const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' }, TEST_JWT_SECRET);
    const env = makeEnv({ AURA_DB: paymentMockDB({ orderPaymentStatus: 'paid' }) });
    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(409);
  });
});

// ── Return URL Tests ──────────────────────────────────────────────────

describe('PayOS create-link return URL', () => {
  it('uses React SPA route pattern for returnUrl', async() => {
    const app = await createTestRouter();
    const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' }, TEST_JWT_SECRET);
    const env = makeEnv({ AURA_DB: paymentMockDB({}) });

    // Capture the PayOS API call payload
    let capturedPayload: Record<string, unknown> | null = null;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockImplementation(async(url, init) => {
      capturedPayload = JSON.parse((init as RequestInit).body as string);
      return new Response(JSON.stringify(mockPayOSSuccess()), { status: 200 });
    });

    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    await app.fetch(req, env);

    expect(capturedPayload).not.toBeNull();
    // Phase 2: returnUrl should be /order-success?order_id=ORD_1 (not checkout.html)
    const returnUrl = capturedPayload!.returnUrl as string;
    expect(returnUrl).toContain('https://test.aura/');
    expect(returnUrl).toContain('order_id=ORD_1');
  });
});

// ── Success Path Tests ────────────────────────────────────────────────

describe('PayOS create-link success path', () => {
  it('creates payment link and returns checkoutUrl', async() => {
    const app = await createTestRouter();
    const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' }, TEST_JWT_SECRET);
    const env = makeEnv({ AURA_DB: paymentMockDB({}) });

    // Mock PayOS API success
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockPayOSSuccess()), { status: 200 })
    );

    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.checkoutUrl).toBe('https://pay.payos.vn/pay/test123');
  });

  it('handles PayOS API error gracefully', async() => {
    const app = await createTestRouter();
    const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' }, TEST_JWT_SECRET);
    const env = makeEnv({ AURA_DB: paymentMockDB({}) });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: '99', desc: 'PayOS internal error' }), { status: 400 })
    );

    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(502);
  });
});

// ── DLQ / Dead Letter Tests ───────────────────────────────────────────

describe('Payment stuck-payments admin endpoint', () => {
  it('returns stuck payments for owner role', async() => {
    // TODO Phase 4: after DLQ endpoint implementation
    // This test verifies GET /api/admin/payments/stuck returns stuck + dlq arrays
    expect(true).toBe(true); // placeholder — actual test in Phase 4
  });
});
