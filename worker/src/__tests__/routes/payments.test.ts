// @vitest-environment node
/**
 * Unit tests for payment routes via paymentRouter Hono router.
 * Phase 1 TDD baseline — tests current behavior before hardening.
 * Tests: auth, idempotency, return URL, success path, DLQ.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TEST_JWT_SECRET, createMockKV, createMockDB } from '../test-utils';
import { generateJWT } from '../../lib/jwt';
import { paymentSqliteDB, payosCheckoutResponse } from '../helpers/payment-sqlite-db';

async function createTestRouter() {
  const mod = await import('@aura/domain-payment');
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
  orderPaymentMethod?: string;
  orderCustomerId?: string;
  existingPayment?: { status: string; payment_url?: string; checkout_url?: string; transaction_id: string } | null;
}) {
  const fixture = paymentSqliteDB();
  const { orderExists = true, orderTotal = 50000, orderPaymentStatus = 'unpaid',
    orderPaymentMethod = 'payos', orderCustomerId = 'USR_1', existingPayment = null } = config;
  if (orderExists) fixture.seed('orders', { id: 'ORD_1', total: orderTotal,
    payment_status: orderPaymentStatus, payment_method: orderPaymentMethod, customer_id: orderCustomerId || null });
  if (existingPayment) fixture.seed('payments', { id: 'PAY_1', order_id: 'ORD_1', method: 'payos',
    amount: orderTotal, created_at: '2020-01-01T00:00:00Z', updated_at: '2020-01-01T00:00:00Z', ...existingPayment });
  Object.defineProperty(fixture.db, 'executedSql', { get: () => fixture.executedStatements.map((statement) => statement.sql) });
  return fixture.db;
}


beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Auth Tests ────────────────────────────────────────────────────────

describe('PayOS create-link auth', () => {
  // Phase 1.2: guests (unauthenticated QR diners) are allowed to create links.
  // Without a JWT the route still resolves the order first — unknown order → 404.
  it('treats unauthenticated request as guest (order-not-found → 404, not 401)', async() => {
    const app = await createTestRouter();
    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(404);
  });

  it('allows guest to pay an order with no customer_id (guest order)', async() => {
    const app = await createTestRouter();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, init) => payosCheckoutResponse(JSON.parse(String(init.body)), 'test-checksum')));
    const env = makeEnv({ AURA_DB: paymentMockDB({ orderCustomerId: '' }) });
    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; checkoutUrl?: string };
    expect(body.success).toBe(true);
    expect(body.checkoutUrl).toBeTruthy();
  });

  it('rejects customer paying an order owned by a different customer (403)', async() => {
    const app = await createTestRouter();
    const token = await generateJWT({ email: 'other@b.com', name: 'Other', id: 'USR_2', role: 'customer' }, TEST_JWT_SECRET);
    const env = makeEnv({ AURA_DB: paymentMockDB({ orderCustomerId: 'USR_1' }) });
    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(403);
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
        existingPayment: {
          status: 'pending',
          payment_url: 'https://pay.payos.vn/existing',
          checkout_url: 'https://pay.payos.vn/existing',
          transaction_id: '12345'
        }
      })
    });
    // Mock PayOS API — should NOT be called (idempotency returns cached)
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockImplementation(async (_url, init) => payosCheckoutResponse(JSON.parse(String(init?.body)), 'test-checksum'));

    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(body.cached).toBe(true);
    expect(body.checkoutUrl).toBe('https://pay.payos.vn/existing');
  });

  it('proceeds to create PayOS link when existing pending payment has empty payment_url', async() => {
    const app = await createTestRouter();
    const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' }, TEST_JWT_SECRET);
    const env = makeEnv({
      AURA_DB: paymentMockDB({
        existingPayment: {
          status: 'pending',
          payment_url: '',
          checkout_url: '',
          transaction_id: '12345'
        }
      })
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => init?.method === 'POST' ? payosCheckoutResponse(JSON.parse(String(init.body)), 'test-checksum') : new Response(JSON.stringify({ code: 'not-found' }), { status: 404 }));

    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(body.orderCode).toBe(12345);
    expect(body.cached).toBe(true);
    expect(body.checkoutUrl).toBe('https://pay.payos.vn/web/test123');
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

describe('PayOS create-link payment method guard', () => {
  it('does not create a PayOS link or mark a COD order paid', async() => {
    const app = await createTestRouter();
    const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' }, TEST_JWT_SECRET);
    const db = paymentMockDB({ orderPaymentMethod: 'cod', orderPaymentStatus: 'cod_pending' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await app.fetch(new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: 'ORD_1' }),
    }), makeEnv({ AURA_DB: db }));

    expect(res.status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((db as any).executedSql.filter((sql: string) => /UPDATE orders|INSERT INTO payments/i.test(sql))).toHaveLength(0);
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
      return payosCheckoutResponse(JSON.parse(String(init?.body)), 'test-checksum');
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
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => payosCheckoutResponse(JSON.parse(String(init?.body)), 'test-checksum'));

    const req = new Request('https://test.aura/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: 'ORD_1' })
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.checkoutUrl).toBe('https://pay.payos.vn/web/test123');
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

  it('resolves transaction-code collision before contacting PayOS and persists only the registered code', async () => {
    const helpers = await import('../../../../packages/domain/payment/commands/payos-helpers');
    const { getOrCreatePayOSAttempt } = await import('../../../../packages/domain/payment/commands/payos-attempt');
    const fixture = paymentSqliteDB(); fixture.order('OTHER'); fixture.payment('OTHER', 'pending', '111111'); fixture.order('ORD_RETRY_1');
    vi.spyOn(helpers, 'generateOrderCode').mockReturnValueOnce(111111).mockReturnValueOnce(222222);
    const registeredCodes: number[] = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)); registeredCodes.push(body.orderCode);
      expect(fixture.sqlite.prepare("SELECT transaction_id FROM payments WHERE order_id = 'ORD_RETRY_1'").get()?.transaction_id).toBe(String(body.orderCode));
      return payosCheckoutResponse(body, 'local');
    });
    const result = await getOrCreatePayOSAttempt({ db: fixture.db, orderId: 'ORD_RETRY_1', amount: 20000,
      clientId: 'local', apiKey: 'local', checksumKey: 'local', description: 'Order', returnUrl: 'https://test.aura/success', cancelUrl: 'https://test.aura/cancel' });
    expect(result).toMatchObject({ ok: true, payment: { transaction_id: '222222' } });
    expect(fetchSpy).toHaveBeenCalledTimes(1); expect(registeredCodes).toEqual([222222]);
  });
});

// ── DLQ / Dead Letter Tests ───────────────────────────────────────────

describe('Payment stuck-payments admin endpoint', () => {
  it('returns full stuck payment amounts for owner role and masks amounts for non-owner', async() => {
    const { getStuckPayments } = await import('../../routes/admin-handlers');
    const kv = createMockKV();
    await kv.put('payment:stuck:ORD_99', JSON.stringify({
      orderId: 'ORD_99',
      orderCode: '12345',
      dbAmount: 50000,
      webhookAmount: 60000,
      detectedAt: '2026-10-18T00:00:00.000Z'
    }));
    const env = makeEnv({ AUTH_KV: kv });

    const ownerToken = await generateJWT(
      { id: 'USR_OWNER', email: 'owner@test.com', name: 'Owner', role: 'owner' },
      TEST_JWT_SECRET
    );
    const ownerReq = new Request('https://test.aura/api/admin/payments/stuck', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const ownerRes = await getStuckPayments(ownerReq, env);
    expect(ownerRes.status).toBe(200);
    const ownerBody = await ownerRes.json() as {
      stuck: Array<{ orderId: string; dbAmount: unknown; webhookAmount: unknown }>;
      dlq: unknown[];
      total: number;
    };
    expect(ownerBody.stuck).toHaveLength(1);
    expect(ownerBody.stuck[0].orderId).toBe('ORD_99');
    expect(ownerBody.stuck[0].dbAmount).toBe(50000);
    expect(ownerBody.stuck[0].webhookAmount).toBe(60000);

    const managerToken = await generateJWT(
      { id: 'USR_MGR', email: 'mgr@test.com', name: 'Manager', role: 'manager' },
      TEST_JWT_SECRET
    );
    const managerReq = new Request('https://test.aura/api/admin/payments/stuck', {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const managerRes = await getStuckPayments(managerReq, env);
    expect(managerRes.status).toBe(200);
    const managerBody = await managerRes.json() as {
      stuck: Array<{ orderId: string; amount?: unknown; dbAmount: unknown; webhookAmount: unknown }>;
    };
    expect(managerBody.stuck).toHaveLength(1);
    expect(managerBody.stuck[0].amount).toBe('***');
    expect(managerBody.stuck[0].dbAmount).toBe('***');
    expect(managerBody.stuck[0].webhookAmount).toBe('***');
  });
});
