// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { app } from '../../index';
import { paymentSqliteDB, signedPayOSResponse } from '../helpers/payment-sqlite-db';
import { createMockKV, TEST_JWT_SECRET } from '../test-utils';
import { issueStaffSession } from '../../lib/staff-session';
import {
  RECONCILE_LEASE_MS,
  claimReconcileJob,
  reconcilePayOSPayment,
  releaseReconcileJob,
  writePaymentReviewMarker,
} from '../../../../packages/domain/payment/commands/payos-reconcile';
import { getOrCreatePayOSAttempt } from '../../../../packages/domain/payment/commands/payos-attempt';
import { runPaymentReconciliation } from '../../routes/cron-handlers/payment-reconcile';
import { getStuckPayments } from '../../routes/admin-handlers';

const KEY = 'local-payos-checksum';
const context = { waitUntil: (_p: Promise<unknown>) => {} } as any;

function createReconcileFixture(opts: {
  paymentStatus?: string;
  orderPaymentStatus?: string;
  orderStatus?: string;
  tenantId?: string;
  createdAt?: string;
} = {}) {
  const sql = paymentSqliteDB();
  const tenantId = opts.tenantId ?? 'default';
  const createdAt = opts.createdAt ?? new Date(Date.now() - 10 * 60 * 1000).toISOString();
  sql.order('ORD_1', tenantId, 'cust_1');
  sql.payment('ORD_1', opts.paymentStatus ?? 'pending', '123456');
  sql.sqlite.prepare('UPDATE orders SET payment_status = ?, status = ?, created_at = ?, updated_at = ? WHERE id = ?')
    .run(opts.orderPaymentStatus ?? 'unpaid', opts.orderStatus ?? 'pending', createdAt, createdAt, 'ORD_1');
  sql.sqlite.prepare('UPDATE payments SET created_at = ?, updated_at = ?, payment_url = ? WHERE id = ?')
    .run(createdAt, createdAt, 'https://pay.payos.vn/web/link_1', 'pay_ORD_1');

  const kv = createMockKV();
  const env = {
    AURA_DB: sql.db,
    AUTH_KV: kv,
    JWT_SECRET: TEST_JWT_SECRET,
    PAYOS_CLIENT_ID: 'local-client',
    PAYOS_API_KEY: 'local-api-key',
    PAYOS_CHECKSUM_KEY: KEY,
    ENVIRONMENT: 'test',
  } as any;

  return { ...sql, kv, env };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PayOS Payment Reconciliation & Identifiable DLQ (real SQLite)', () => {
  it('settles PAID full amount once, sets order paid, and records single payment_success metric', async () => {
    const { db, kv, sqlite } = createReconcileFixture();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      signedPayOSResponse({
        id: 'link_1',
        orderCode: 123456,
        amount: 20000,
        amountPaid: 20000,
        amountRemaining: 0,
        status: 'PAID',
      }, KEY)
    );

    const first = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'cron',
    });
    expect(first).toMatchObject({ ok: true, status: 200, outcome: 'settled', paymentChanged: true });

    const second = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'cron',
    });
    expect(second).toMatchObject({ ok: true, status: 200, outcome: 'already_settled', paymentChanged: false });

    expect(sqlite.prepare('SELECT status FROM payments WHERE id = ?').get('pay_ORD_1')?.status).toBe('completed');
    expect(sqlite.prepare('SELECT payment_status FROM orders WHERE id = ?').get('ORD_1')?.payment_status).toBe('paid');
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM _metrics WHERE name = 'payment_success'").get()?.count).toBe(1);
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('keeps financial state unchanged when provider returns PENDING', async () => {
    const { db, kv, sqlite } = createReconcileFixture();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      signedPayOSResponse({ id: 'link_1', orderCode: 123456, amount: 20000, status: 'PENDING' }, KEY)
    );

    const res = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'cron',
    });
    expect(res).toMatchObject({ ok: true, status: 200, outcome: 'pending', paymentChanged: false });
    expect(sqlite.prepare('SELECT status FROM payments WHERE id = ?').get('pay_ORD_1')?.status).toBe('pending');
    expect(sqlite.prepare('SELECT payment_status FROM orders WHERE id = ?').get('ORD_1')?.payment_status).toBe('unpaid');
  });

  it.each([
    ['CANCELLED', 'cancelled'],
    ['EXPIRED', 'expired'],
  ])('applies terminal %s rule without cancelling or refunding fulfillment', async (providerStatus, expectedDbStatus) => {
    const { db, kv, sqlite } = createReconcileFixture({ orderStatus: 'preparing' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      signedPayOSResponse({ id: 'link_1', orderCode: 123456, amount: 20000, status: providerStatus }, KEY)
    );

    const res = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'cron',
    });
    expect(res).toMatchObject({ ok: true, status: 200, outcome: 'settled' });
    expect(sqlite.prepare('SELECT status FROM payments WHERE id = ?').get('pay_ORD_1')?.status).toBe(expectedDbStatus);
    expect(sqlite.prepare('SELECT status, payment_status FROM orders WHERE id = ?').get('ORD_1')).toMatchObject({
      status: 'preparing',
      payment_status: 'unpaid',
    });
  });

  it.each([
    { label: 'partial payment', amountPaid: 15000, amountRemaining: 5000 },
    { label: 'overpaid payment', amountPaid: 25000, amountRemaining: 0 },
  ])('flags $label as requires_review without mutating order total or creating extra payments', async ({ amountPaid, amountRemaining }) => {
    const { db, kv, sqlite } = createReconcileFixture();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      signedPayOSResponse({ id: 'link_1', orderCode: 123456, amount: 20000, amountPaid, amountRemaining, status: 'PAID' }, KEY)
    );

    const res = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'cron',
    });
    expect(res).toMatchObject({ ok: false, status: 409, outcome: 'requires_review' });
    expect(sqlite.prepare('SELECT total, payment_status FROM orders WHERE id = ?').get('ORD_1')).toMatchObject({
      total: 20000,
      payment_status: 'unpaid',
    });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM payments').get()?.count).toBe(1);
    const reviews = await kv.list({ prefix: 'payment:review:' });
    expect(reviews.keys).toHaveLength(1);
  });

  it.each([
    { id: 'link_1', orderCode: 999999, amount: 20000, status: 'PAID' },
    { id: 'link_1', orderCode: 123456, amount: 99000, status: 'PAID' },
    { id: 'wrong_link_id', orderCode: 123456, amount: 20000, status: 'PAID' },
    { id: 'link_1', orderCode: 123456, amount: 20000, status: 'PROCESSING_MYSTERY' },
  ])('flags provider mismatch or unknown status as requires_review with KV marker: %o', async (payload) => {
    const { db, kv, sqlite } = createReconcileFixture();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(signedPayOSResponse(payload, KEY));

    const res = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'manual',
    });
    expect(res).toMatchObject({ ok: false, status: 409, outcome: 'requires_review' });
    expect(sqlite.prepare('SELECT payment_status FROM orders WHERE id = ?').get('ORD_1')?.payment_status).toBe('unpaid');
    expect((await kv.list({ prefix: 'payment:review:' })).keys).toHaveLength(1);
  });

  it('rejects invalid provider signatures and malformed responses with 502 without settling', async () => {
    const { db, kv, sqlite } = createReconcileFixture();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: '00',
        signature: '0'.repeat(64),
        data: { id: 'link_1', orderCode: 123456, amount: 20000, status: 'PAID' },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: '99', desc: 'invalid' }), { status: 200 }));

    const badSig = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'manual',
    });
    expect(badSig).toMatchObject({ ok: false, status: 502, outcome: 'provider_error', reason: 'bad_signature' });

    const malformed = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'manual',
    });
    expect(malformed).toMatchObject({ ok: false, status: 502, outcome: 'provider_error', reason: 'server_error' });
    expect(sqlite.prepare('SELECT payment_status FROM orders WHERE id = ?').get('ORD_1')?.payment_status).toBe('unpaid');
  });

  it('skips calling provider when transaction_id is empty or non-numeric', async () => {
    const { db, kv, sqlite } = createReconcileFixture();
    sqlite.prepare("UPDATE payments SET transaction_id = 'abc-invalid' WHERE id = 'pay_ORD_1'").run();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'cron',
    });
    expect(res).toMatchObject({ ok: false, status: 409, outcome: 'requires_review' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('settles payment when order was cancelled but provider confirms PAID, preserving cancelled order status and writing review marker', async () => {
    const { db, kv, sqlite } = createReconcileFixture({ orderStatus: 'cancelled' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      signedPayOSResponse({ id: 'link_1', orderCode: 123456, amount: 20000, amountPaid: 20000, amountRemaining: 0, status: 'PAID' }, KEY)
    );

    const res = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'cron',
    });
    expect(res).toMatchObject({ ok: true, status: 200, outcome: 'settled' });
    expect(sqlite.prepare('SELECT status, payment_status FROM orders WHERE id = ?').get('ORD_1')).toMatchObject({
      status: 'cancelled',
      payment_status: 'paid',
    });
    const markerRaw = await kv.get('payment:review:pay_ORD_1');
    expect(markerRaw).toBeTruthy();
    expect(JSON.parse(markerRaw!)).toMatchObject({ stage: 'cancelled_order_paid', errorCode: 'PAID_ON_CANCELLED_ORDER' });
  });

  it('never reverts refunded payments or orders back to paid, and returns already_settled when order is already paid despite provider mismatch', async () => {
    const { db, kv, sqlite } = createReconcileFixture({ paymentStatus: 'refunded', orderPaymentStatus: 'refunded' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      signedPayOSResponse({ id: 'link_1', orderCode: 999999, amount: 20000, status: 'PAID' }, KEY)
    );

    const refundedRes = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'cron',
    });
    expect(refundedRes).toMatchObject({ ok: true, outcome: 'already_settled', paymentChanged: false });
    expect(sqlite.prepare('SELECT status FROM payments WHERE id = ?').get('pay_ORD_1')?.status).toBe('refunded');
    expect(sqlite.prepare('SELECT payment_status FROM orders WHERE id = ?').get('ORD_1')?.payment_status).toBe('refunded');
    expect(fetchSpy).not.toHaveBeenCalled();

    sqlite.prepare("UPDATE payments SET status = 'completed' WHERE id = 'pay_ORD_1'").run();
    sqlite.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = 'ORD_1'").run();
    const paidRes = await reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'cron',
    });
    expect(paidRes).toMatchObject({ ok: true, outcome: 'already_settled', paymentChanged: false });
  });

  it('enforces CAS lease acquisition, blocks concurrent claim, rejects stale owner release, and allows re-claim after expiry', async () => {
    const { db } = createReconcileFixture();
    const t0 = 1_700_000_000_000;

    expect(await claimReconcileJob(db, 'pay_ORD_1', 'worker-a', t0, false)).toBe(true);
    expect(await claimReconcileJob(db, 'pay_ORD_1', 'worker-b', t0 + 1000, true)).toBe(false);
    expect(await releaseReconcileJob(db, 'pay_ORD_1', 'worker-b', 'pending', t0 + 60_000, t0 + 2000)).toBe(false);

    // After 90s lease expires, worker-b can claim even if worker-a crashed
    expect(await claimReconcileJob(db, 'pay_ORD_1', 'worker-b', t0 + RECONCILE_LEASE_MS + 1, true)).toBe(true);
    expect(await releaseReconcileJob(db, 'pay_ORD_1', 'worker-a', 'pending', t0 + 60_000, t0 + RECONCILE_LEASE_MS + 2)).toBe(false);
    expect(await releaseReconcileJob(db, 'pay_ORD_1', 'worker-b', 'pending', t0 + RECONCILE_LEASE_MS + 60_000, t0 + RECONCILE_LEASE_MS + 2)).toBe(true);
  });

  it('rolls back both payment and order when a fault occurs mid-settlement batch', async () => {
    const { db, kv, sqlite } = createReconcileFixture();
    sqlite.exec("CREATE TRIGGER fail_order_paid BEFORE UPDATE OF payment_status ON orders BEGIN SELECT RAISE(FAIL, 'injected batch failure'); END;");
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      signedPayOSResponse({ id: 'link_1', orderCode: 123456, amount: 20000, amountPaid: 20000, amountRemaining: 0, status: 'PAID' }, KEY)
    );

    await expect(reconcilePayOSPayment({
      db, kv, paymentId: 'pay_ORD_1', clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY, source: 'cron',
    })).rejects.toThrow();

    expect(sqlite.prepare('SELECT status FROM payments WHERE id = ?').get('pay_ORD_1')?.status).toBe('pending');
    expect(sqlite.prepare('SELECT payment_status FROM orders WHERE id = ?').get('ORD_1')?.payment_status).toBe('unpaid');
  });

  it('handles concurrent webhook + 2 cron runs + manual reconcile with exactly one effective transition and one metric', async () => {
    const { env, sqlite } = createReconcileFixture();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      signedPayOSResponse({ id: 'link_1', orderCode: 123456, amount: 20000, amountPaid: 20000, amountRemaining: 0, status: 'PAID' }, KEY)
    );
    sqlite.prepare("INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES ('u_cashier', 'Cashier', 'cashier', 'default', 1, 1)").run();
    const { token } = await issueStaffSession(
      { JWT_SECRET: TEST_JWT_SECRET },
      { id: 'u_cashier', name: 'Cashier', phone: null, role: 'cashier', tenant_id: 'default', is_active: 1, auth_version: 1 },
      { email: 'c@test.com', sessionType: 'staff-web' }
    );

    const webhookData = { orderCode: 123456, amount: 20000, code: '00', description: 'Order' };
    const canonical = Object.keys(webhookData).sort().map((k) => `${k}=${webhookData[k as keyof typeof webhookData]}`).join('&');
    const signature = createHmac('sha256', KEY).update(canonical).digest('hex');
    const webhookReq = new Request('https://test.aura/api/webhook/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '00', desc: 'success', success: true, data: webhookData, signature }),
    });
    const manualReq = new Request('https://test.aura/api/admin/payments/pay_ORD_1/reconcile', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    await Promise.all([
      app.fetch(webhookReq, env, context),
      runPaymentReconciliation(env),
      runPaymentReconciliation(env),
      app.fetch(manualReq, env, context),
    ]);

    expect(sqlite.prepare('SELECT status FROM payments WHERE id = ?').get('pay_ORD_1')?.status).toBe('completed');
    expect(sqlite.prepare('SELECT payment_status FROM orders WHERE id = ?').get('ORD_1')?.payment_status).toBe('paid');
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM _metrics WHERE name = 'payment_success'").get()?.count).toBe(1);
  });

  it('applies exponential backoff on timeout / 429 / 500, preserves candidate, prioritizes attempts=0 for fairness, and exits on budget exhaustion', async () => {
    const { env, sqlite } = createReconcileFixture();
    const nowMs = Date.now();
    const oldIso = new Date(nowMs - 10 * 60 * 1000).toISOString();
    sqlite.prepare("INSERT INTO orders (id, tenant_id, total, payment_status, payment_method, status, created_at) VALUES ('ORD_2', 'default', 20000, 'unpaid', 'payos', 'pending', ?)").run(oldIso);
    sqlite.prepare("INSERT INTO payments (id, order_id, method, amount, status, transaction_id, created_at, updated_at) VALUES ('pay_ORD_2', 'ORD_2', 'payos', 20000, 'pending', '222222', ?, ?)").run(oldIso, oldIso);
    sqlite.prepare("INSERT INTO payment_reconciliation_jobs (payment_id, next_attempt_at, attempts, last_checked_at, last_outcome, updated_at) VALUES ('pay_ORD_1', ?, 2, ?, 'provider_error', ?)")
      .run(String(nowMs - 1000), String(nowMs - 600_000), String(nowMs - 600_000));

    const seenOrder: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      seenOrder.push(String(url));
      if (String(url).endsWith('222222')) return new Response('Too Many Requests', { status: 429 });
      return new Response('Gateway Error', { status: 502 });
    });

    const run1 = await runPaymentReconciliation(env, { nowMs });
    expect(run1.processed).toBe(2);
    // Fairness: pay_ORD_2 (attempts = 0) is claimed before pay_ORD_1 (attempts = 2)
    expect(seenOrder[0]).toContain('222222');

    const job1 = sqlite.prepare('SELECT attempts, next_attempt_at, last_outcome FROM payment_reconciliation_jobs WHERE payment_id = ?').get('pay_ORD_1') as any;
    const job2 = sqlite.prepare('SELECT attempts, next_attempt_at, last_outcome FROM payment_reconciliation_jobs WHERE payment_id = ?').get('pay_ORD_2') as any;
    expect(job2.attempts).toBe(1);
    expect(job2.last_outcome).toBe('provider_error');
    expect(Number(job2.next_attempt_at) - nowMs).toBe(5 * 60 * 1000);
    expect(job1.attempts).toBe(3);
    expect(Number(job1.next_attempt_at) - nowMs).toBe(20 * 60 * 1000);

    // Budget exhaustion: budgetMs = 0 exits immediately without claiming
    const budgetRun = await runPaymentReconciliation(env, { nowMs: nowMs + 60 * 60 * 1000, budgetMs: 0 });
    expect(budgetRun.processed).toBe(0);
  });

  it('enforces auth, RBAC, cross-tenant 404, cooldown bypass, and 202 when lease is busy on POST /api/admin/payments/:id/reconcile', async () => {
    const { env, db, sqlite } = createReconcileFixture({ tenantId: 'store-a' });
    sqlite.prepare("INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES ('u_waiter', 'Waiter', 'waiter', 'store-a', 1, 1)").run();
    sqlite.prepare("INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES ('u_mgr_b', 'Manager B', 'manager', 'store-b', 1, 1)").run();
    sqlite.prepare("INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES ('u_mgr_a', 'Manager A', 'manager', 'store-a', 1, 1)").run();

    const { token: waiterToken } = await issueStaffSession(
      { JWT_SECRET: TEST_JWT_SECRET },
      { id: 'u_waiter', name: 'Waiter', phone: null, role: 'waiter', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
      { email: 'w@a.com', sessionType: 'staff-web' }
    );
    const { token: mgrBToken } = await issueStaffSession(
      { JWT_SECRET: TEST_JWT_SECRET },
      { id: 'u_mgr_b', name: 'Manager B', phone: null, role: 'manager', tenant_id: 'store-b', is_active: 1, auth_version: 1 },
      { email: 'b@b.com', sessionType: 'staff-web' }
    );
    const { token: mgrAToken } = await issueStaffSession(
      { JWT_SECRET: TEST_JWT_SECRET },
      { id: 'u_mgr_a', name: 'Manager A', phone: null, role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
      { email: 'a@a.com', sessionType: 'staff-web' }
    );

    // Anonymous -> 401
    expect((await app.fetch(new Request('https://test.aura/api/admin/payments/pay_ORD_1/reconcile', { method: 'POST' }), env, context)).status).toBe(401);
    // Disallowed role (waiter) -> 403
    expect((await app.fetch(new Request('https://test.aura/api/admin/payments/pay_ORD_1/reconcile', {
      method: 'POST', headers: { Authorization: `Bearer ${waiterToken}` },
    }), env, context)).status).toBe(403);
    // Cross-tenant -> 404
    expect((await app.fetch(new Request('https://test.aura/api/admin/payments/pay_ORD_1/reconcile', {
      method: 'POST', headers: { Authorization: `Bearer ${mgrBToken}` },
    }), env, context)).status).toBe(404);

    // Active lease held by another worker -> 202
    const nowMs = Date.now();
    await claimReconcileJob(db, 'pay_ORD_1', 'other-worker', nowMs, true);
    const busyRes = await app.fetch(new Request('https://test.aura/api/admin/payments/pay_ORD_1/reconcile', {
      method: 'POST', headers: { Authorization: `Bearer ${mgrAToken}` },
    }), env, context);
    expect(busyRes.status).toBe(202);

    // Release with future cooldown (15m), then manual retry bypasses cooldown and settles
    await releaseReconcileJob(db, 'pay_ORD_1', 'other-worker', 'pending', nowMs + 15 * 60 * 1000, nowMs);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      signedPayOSResponse({ id: 'link_1', orderCode: 123456, amount: 20000, amountPaid: 20000, amountRemaining: 0, status: 'PAID' }, KEY)
    );
    const okRes = await app.fetch(new Request('https://test.aura/api/admin/payments/pay_ORD_1/reconcile', {
      method: 'POST', headers: { Authorization: `Bearer ${mgrAToken}` },
    }), env, context);
    expect(okRes.status).toBe(200);
    expect(await okRes.json()).toEqual({
      paymentId: 'pay_ORD_1',
      orderId: 'ORD_1',
      orderCode: '123456',
      outcome: 'settled',
    });
  });

  it('settles PAID during create-link recovery and returns 409 ORDER_ALREADY_PAID without creating a second attempt', async () => {
    const { db, kv, sqlite } = createReconcileFixture();
    sqlite.prepare('UPDATE payments SET payment_url = NULL WHERE id = ?').run('pay_ORD_1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      signedPayOSResponse({ id: 'link_1', orderCode: 123456, amount: 20000, amountPaid: 20000, amountRemaining: 0, status: 'PAID' }, KEY)
    );

    const res = await getOrCreatePayOSAttempt({
      db, kv, orderId: 'ORD_1', amount: 20000, clientId: 'local-client', apiKey: 'local-api-key', checksumKey: KEY,
      description: 'Order 1', returnUrl: 'https://test.aura/ok', cancelUrl: 'https://test.aura/cancel',
    });
    expect(res).toMatchObject({ ok: false, status: 409, code: 'ORDER_ALREADY_PAID', orderId: 'ORD_1' });
    expect(sqlite.prepare('SELECT status FROM payments WHERE id = ?').get('pay_ORD_1')?.status).toBe('completed');
    expect(sqlite.prepare('SELECT payment_status FROM orders WHERE id = ?').get('ORD_1')?.payment_status).toBe('paid');
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM payments').get()?.count).toBe(1);
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('truncates untrusted review marker IDs, writes unknown orderCode webhook markers, and surfaces reconcileStatus in getStuckPayments', async () => {
    const { env, kv, sqlite } = createReconcileFixture();
    const longUntrusted = 'x'.repeat(120) + '<script>secret</script>';
    await writePaymentReviewMarker(kv, {
      paymentId: longUntrusted,
      orderId: longUntrusted,
      orderCode: '999888',
      source: 'webhook',
      stage: 'signature_verify',
      errorCode: 'INVALID_SIGNATURE',
      untrusted: true,
    });

    // Unknown orderCode webhook still returns 200 ACK and creates a review marker
    const unknownData = { orderCode: 777666, amount: 20000, code: '00', description: 'Unknown' };
    const canonical = Object.keys(unknownData).sort().map((k) => `${k}=${unknownData[k as keyof typeof unknownData]}`).join('&');
    const sig = createHmac('sha256', KEY).update(canonical).digest('hex');
    const whRes = await app.fetch(new Request('https://test.aura/api/webhook/payos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '00', desc: 'success', success: true, data: unknownData, signature: sig }),
    }), env, context);
    expect(whRes.status).toBe(200);

    await writePaymentReviewMarker(kv, {
      paymentId: 'pay_ORD_1', orderId: 'ORD_1', orderCode: '123456',
      source: 'cron', stage: 'amount_check', errorCode: 'PARTIAL_PAYMENT',
    });
    sqlite.prepare("INSERT INTO payment_reconciliation_jobs (payment_id, next_attempt_at, last_outcome, attempts, updated_at) VALUES ('pay_ORD_1', '0', 'settled', 1, '0')").run();

    const stuckRes = await getStuckPayments(new Request('https://test.aura/api/admin/payments/stuck'), env);
    const body = await stuckRes.json() as { reviews: Array<Record<string, any>> };
    expect(body.reviews.length).toBeGreaterThanOrEqual(3);
    const untrustedEntry = body.reviews.find((r) => r.untrusted === true)!;
    expect(untrustedEntry.paymentId.length).toBeLessThanOrEqual(64);
    expect(untrustedEntry.paymentId).not.toContain('<script>');
    const reconciledEntry = body.reviews.find((r) => r.paymentId === 'pay_ORD_1')!;
    expect(reconciledEntry.reconcileStatus).toBe('reconciled');
    const unknownEntry = body.reviews.find((r) => r.orderCode === '777666')!;
    expect(unknownEntry.reconcileStatus).toBe('unprocessed');
  });
});
