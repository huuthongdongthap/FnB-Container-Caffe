// @vitest-environment node
/** Refund operations must never manufacture provider success or cross tenant boundaries. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { refundRouter } from '../../routes/refunds';
import { paymentSqliteDB } from '../helpers/payment-sqlite-db';
import { createMockEnv, TEST_JWT_SECRET } from '../test-utils';
import { generateJWT } from '../../lib/jwt';

function fixture(status = 'completed', tenant = 'default') {
  const sql = paymentSqliteDB(); sql.order('ORDER', tenant); sql.payment('ORDER', status);
  sql.sqlite.exec("ALTER TABLE orders ADD COLUMN points_earned INTEGER DEFAULT 0; ALTER TABLE orders ADD COLUMN cashback_earned INTEGER DEFAULT 0;");
  sql.sqlite.exec("INSERT INTO refund_tenant_readiness VALUES ('default', datetime('now'), 'local-test', 'fresh test DB');");
  sql.sqlite.exec(`CREATE TABLE customers (id TEXT, tenant_id TEXT);
    CREATE TABLE loyalty_point_logs (customer_id TEXT, order_id TEXT, points_change INTEGER, tenant_id TEXT);
    CREATE TABLE cashback_transactions (customer_id TEXT, order_id TEXT, type TEXT, amount INTEGER, tenant_id TEXT);`);
  sql.sqlite.exec("UPDATE orders SET payment_status = 'paid'");
  // Known fixture actors remain independent of the token generation helper.
  for (const [role, tenant] of [['owner','default'], ['cashier','cafe-a'], ['staff','default'], ['waiter','default'], ['kitchen','default']]) {
    sql.staffAccount(`${role}-${tenant}`, role, tenant);
  }
  return { ...sql, env: { ...createMockEnv(), AURA_DB: sql.db }, app: new Hono().route('/api/payments', refundRouter) };
}
async function headers(role = 'owner', tenantId = 'default') {
  // Claims the staff-session gate requires: the credential entry this session
  // came from and the session version it was issued at.
  const token = await generateJWT({ id: `${role}-${tenantId}`, role, tenantId, name: 'Local',
    ...(role === 'customer' ? {} : { authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' }) }, TEST_JWT_SECRET, 28800);
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}
function req(body: Record<string, unknown>, auth: Record<string, string> = {}) {
  return new Request('https://test.aura/api/payments/refund', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(body) });
}
const valid = { paymentId: 'pay_ORDER', amount: 20000, reason: 'Customer request' };
beforeEach(() => vi.restoreAllMocks());

describe('POST /api/payments/refund', () => {
  it.each([20000, 10000])('returns explicit unavailable for valid amount %s without changing paid funds', async (amount) => {
    const { app, env, sqlite } = fixture(); const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const before = sqlite.prepare('SELECT * FROM payments').get();
    const res = await app.fetch(req({ ...valid, amount }, await headers()), env);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ success: false, code: 'REFUND_PROVIDER_UNAVAILABLE', retryable: false, reconciliationRequired: true });
    expect(sqlite.prepare('SELECT * FROM payments').get()).toEqual(before);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('paid');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['processing', 'refunded', 'partial'])('does not retry a historical %s refund or touch its record', async (status) => {
    const { app, env, sqlite } = fixture(); sqlite.prepare('UPDATE payments SET refund_status = ?').run(status);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (let repeat = 0; repeat < 2; repeat++) expect((await app.fetch(req(valid, await headers()), env)).status).toBe(409);
    expect(sqlite.prepare('SELECT refund_status FROM payments').get()?.refund_status).toBe(status);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects unknown payments', async () => {
    const { app, env } = fixture(); expect((await app.fetch(req({ ...valid, paymentId: 'missing' }, await headers()), env)).status).toBe(404);
  });
  it('rejects unpaid transfers', async () => {
    const { app, env } = fixture('pending'); expect((await app.fetch(req(valid, await headers()), env)).status).toBe(400);
  });
  it.each([{ ...valid, amount: 21000 }, { ...valid, amount: 0 }, { ...valid, amount: -1 },
    { ...valid, amount: 1.5 }, { paymentId: 'pay_ORDER', amount: 1000 }, { amount: 1000, reason: 'x' }])('rejects invalid request %o', async (body) => {
    const { app, env } = fixture(); expect((await app.fetch(req(body, await headers()), env)).status).toBe(400);
  });
  it('rejects retired payment methods with no provider I/O', async () => {
    const { app, env, sqlite } = fixture(); sqlite.exec("UPDATE payments SET method = 'momo'");
    const spy = vi.spyOn(globalThis, 'fetch'); expect((await app.fetch(req(valid, await headers()), env)).status).toBe(409); expect(spy).not.toHaveBeenCalled();
  });
  it('does not reveal another tenant payment or invoke provider', async () => {
    const { app, env, sqlite } = fixture('completed', 'cafe-b'); const spy = vi.spyOn(globalThis, 'fetch');
    const before = sqlite.prepare('SELECT * FROM payments').get();
    expect((await app.fetch(req(valid, await headers('cashier', 'cafe-a')), env)).status).toBe(404);
    expect(sqlite.prepare('SELECT * FROM payments').get()).toEqual(before); expect(spy).not.toHaveBeenCalled();
  });
  it.each(['staff', 'waiter', 'customer', 'kitchen'])('rejects non-financial role %s', async (role) => {
    const { app, env } = fixture(); const spy = vi.spyOn(globalThis, 'fetch');
    expect((await app.fetch(req(valid, await headers(role)), env)).status).toBe(403); expect(spy).not.toHaveBeenCalled();
  });
  it('requires a signed session', async () => {
    const { app, env } = fixture(); expect((await app.fetch(req(valid), env)).status).toBe(401);
  });
});

describe('manual refund transfer ledger', () => {
  it('accumulates distinct partial tranches and rejects trimmed replay references', async () => {
    const { app, env, sqlite } = fixture();
    const auth = await headers();
    const first = { ...valid, amount: 5000, manual_transfer_ref: ' BANK-1 ' };
    expect((await app.fetch(req(first, auth), env)).status).toBe(200);
    expect((await app.fetch(req({ ...first, manual_transfer_ref: 'BANK-1' }, auth), env)).status).toBe(409);
    expect(sqlite.prepare('SELECT refund_amount FROM payments').get()?.refund_amount).toBe(5000);
    expect((await app.fetch(req({ ...valid, amount: 16000, manual_transfer_ref: 'BANK-2' }, auth), env)).status).toBe(400);
    expect((await app.fetch(req({ ...valid, amount: 15000, manual_transfer_ref: 'BANK-2' }, auth), env)).status).toBe(200);
    expect(sqlite.prepare('SELECT refund_amount, status FROM payments').get()).toMatchObject({ refund_amount: 20000, status: 'refunded' });
    expect((await app.fetch(req(first, auth), env)).status).toBe(409);
    expect(sqlite.prepare('SELECT count(*) AS n FROM payment_refund_transfers').get()?.n).toBe(2);
  });

  it('does not record a financial write when durable ledger storage is unavailable', async () => {
    const { app, env, sqlite } = fixture();
    sqlite.exec('DROP TABLE payment_refund_transfers');
    expect((await app.fetch(req({ ...valid, manual_transfer_ref: 'BANK-1' }, await headers()), env)).status).toBe(500);
    expect(sqlite.prepare('SELECT refund_amount FROM payments').get()?.refund_amount).toBeNull();
  });

  it('rolls back payment CAS when ledger insertion fails', async () => {
    const { app, env, sqlite } = fixture();
    sqlite.exec("CREATE TRIGGER reject_transfer BEFORE INSERT ON payment_refund_transfers BEGIN SELECT RAISE(ABORT, 'ledger unavailable'); END");
    expect((await app.fetch(req({ ...valid, manual_transfer_ref: 'BANK-1' }, await headers()), env)).status).toBe(500);
    expect(sqlite.prepare('SELECT refund_amount FROM payments').get()?.refund_amount).toBeNull();
    expect(sqlite.prepare('SELECT count(*) AS n FROM payment_refund_transfers').get()?.n).toBe(0);
  });

  it.each(['abort', 'ignore', 'unpaid'])('rolls back full settlement on order %s and retries the same reference after repair', async (mode) => {
    const { app, env, sqlite } = fixture(); const auth = await headers();
    if (mode === 'unpaid') sqlite.exec("UPDATE orders SET payment_status = 'unpaid'");
    else sqlite.exec(`CREATE TRIGGER reject_order BEFORE UPDATE OF payment_status ON orders BEGIN SELECT RAISE(${mode === 'abort' ? "ABORT, 'order failure'" : 'IGNORE'}); END`);
    const request = { ...valid, manual_transfer_ref: 'BANK-ROLLBACK' };
    expect((await app.fetch(req(request, auth), env)).status).toBe(mode === 'abort' ? 500 : 409);
    expect(sqlite.prepare('SELECT refund_amount, status FROM payments').get()).toMatchObject({ refund_amount: null, status: 'completed' });
    expect(sqlite.prepare('SELECT count(*) n FROM payment_refund_transfers').get()?.n).toBe(0);
    expect(sqlite.prepare('SELECT count(*) n FROM refund_loyalty_work').get()?.n).toBe(0);
    sqlite.exec("DROP TRIGGER IF EXISTS reject_order; UPDATE orders SET payment_status = 'paid'");
    expect((await app.fetch(req(request, auth), env)).status).toBe(200);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('refunded');
    expect(sqlite.prepare('SELECT count(*) n FROM payment_refund_transfers').get()?.n).toBe(1);
  });

  it('aborts a zero-row payment CAS without creating a transfer or changing the order', async () => {
    const { app, env, sqlite } = fixture();
    sqlite.exec('CREATE TRIGGER ignore_payment BEFORE UPDATE OF refund_status ON payments BEGIN SELECT RAISE(IGNORE); END');
    expect((await app.fetch(req({ ...valid, manual_transfer_ref: 'CAS' }, await headers()), env)).status).toBe(409);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('paid');
    expect(sqlite.prepare('SELECT count(*) n FROM payment_refund_transfers').get()?.n).toBe(0);
  });

  it('blocks the entire tenant until authoritative legacy reference reconciliation, not just historical payments', async () => {
    const { app, env, sqlite } = fixture(); const auth = await headers();
    sqlite.exec('DELETE FROM refund_tenant_readiness');
    sqlite.exec("UPDATE payments SET refund_status = 'partial', refund_amount = 5000");
    const before = sqlite.prepare('SELECT * FROM payments').get();
    const res = await app.fetch(req({ ...valid, amount: 5000, manual_transfer_ref: 'HISTORICAL-UNKNOWN' }, auth), env);
    expect(res.status).toBe(409); expect(await res.json()).toMatchObject({ code: 'REFUND_HISTORY_UNRECONCILED' });
    sqlite.exec(`INSERT INTO orders (id, tenant_id, payment_status, total) VALUES ('NEW', 'default', 'paid', 20000);
      INSERT INTO payments (id, order_id, amount, status, method, transaction_id) VALUES ('pay_NEW', 'NEW', 20000, 'paid', 'payos', '999');`);
    expect((await app.fetch(req({ ...valid, paymentId: 'pay_NEW', manual_transfer_ref: 'HISTORICAL-UNKNOWN' }, auth), env)).status).toBe(409);
    expect(sqlite.prepare("SELECT * FROM payments WHERE id = 'pay_ORDER'").get()).toEqual(before);
    expect(sqlite.prepare('SELECT count(*) n FROM payment_refund_transfers').get()?.n).toBe(0);
  });

  it('blocks a known historical reference on another payment after explicit reconciliation', async () => {
    const { app, env, sqlite } = fixture();
    sqlite.exec(`INSERT INTO payment_refund_transfers (tenant_id, manual_transfer_ref, payment_id, amount, reason, actor_id, created_at)
      VALUES ('default', 'OLD-BANK', 'historical-payment', 1000, 'Imported evidence', 'operator', datetime('now'))`);
    expect((await app.fetch(req({ ...valid, manual_transfer_ref: 'OLD-BANK' }, await headers()), env)).status).toBe(409);
    expect(sqlite.prepare('SELECT refund_amount FROM payments').get()?.refund_amount).toBeNull();
  });

  it('retries durable failed loyalty work with the same reference without settling money again', async () => {
    const { app, env, sqlite } = fixture(); const auth = await headers();
    sqlite.exec('DROP TABLE cashback_transactions');
    const request = { ...valid, manual_transfer_ref: 'RETRY-LOYALTY' };
    const first = await app.fetch(req(request, auth), env);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ data: { loyalty_reversal: { status: 'failed', retryable: true } } });
    const settled = sqlite.prepare('SELECT * FROM payments').get();
    // Repair ledger reads; zero accrual requires no customer reversal.
    sqlite.exec('CREATE TABLE cashback_transactions (customer_id TEXT, order_id TEXT, type TEXT, amount INTEGER, tenant_id TEXT);');
    const retry = await app.fetch(req(request, auth), env);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ data: { loyalty_reversal: { status: 'skipped', reason: 'no_points_to_reverse' } } });
    expect(sqlite.prepare('SELECT * FROM payments').get()).toEqual(settled);
    expect(sqlite.prepare('SELECT count(*) n FROM payment_refund_transfers').get()?.n).toBe(1);
    expect(sqlite.prepare('SELECT status FROM refund_loyalty_work').get()?.status).toBe('completed');
    expect((await app.fetch(req(request, auth), env)).status).toBe(409);
  });

  it('rejects oversized transfer references without updating paid funds', async () => {
    const { app, env, sqlite } = fixture();
    expect((await app.fetch(req({ ...valid, manual_transfer_ref: 'x'.repeat(201) }, await headers()), env)).status).toBe(400);
    expect(sqlite.prepare('SELECT refund_amount FROM payments').get()?.refund_amount).toBeNull();
  });
});

describe('GET /api/payments/refunds/:paymentId', () => {
  it('preserves historical partial refund details', async () => {
    const { app, env, sqlite } = fixture(); sqlite.exec("UPDATE payments SET refund_status = 'partial', refund_amount = 10000, refund_reason = 'Historical'");
    const res = await app.fetch(new Request('https://test.aura/api/payments/refunds/pay_ORDER', { headers: await headers() }), env);
    expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ data: { refundStatus: 'partial', refundAmount: 10000, refundReason: 'Historical' } });
  });
  it('conceals foreign tenant refund details', async () => {
    const { app, env } = fixture('completed', 'cafe-b');
    expect((await app.fetch(new Request('https://test.aura/api/payments/refunds/pay_ORDER', { headers: await headers('cashier', 'cafe-a') }), env)).status).toBe(404);
  });
  it('requires authentication', async () => {
    const { app, env } = fixture(); expect((await app.fetch(new Request('https://test.aura/api/payments/refunds/pay_ORDER'), env)).status).toBe(401);
  });
});
