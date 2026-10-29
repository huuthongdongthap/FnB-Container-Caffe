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
