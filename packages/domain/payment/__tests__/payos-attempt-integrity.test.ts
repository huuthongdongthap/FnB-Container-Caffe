// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalPayOSData, verifyPayOSSignature } from '../policies/payos-signature';
import { validatePayOSAccess } from '../commands/payos-helpers';
import { getOrCreatePayOSAttempt } from '../commands/payos-attempt';
import { paymentSqliteDB, signedPayOSResponse, payosCheckoutResponse } from '../../../../worker/src/__tests__/helpers/payment-sqlite-db';

const fixture = () => {
  const sql = paymentSqliteDB();
  sql.order('order-1');
  return { ...sql, input: { db: sql.db, orderId: 'order-1', amount: 20000,
    clientId: 'local-id', apiKey: 'local-key', checksumKey: 'local-checksum',
    description: 'Order 1', returnUrl: 'https://test.aura/success', cancelUrl: 'https://test.aura/cancel' } };
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => vi.restoreAllMocks());

describe('PayOS durable attempt invariant (real SQLite)', () => {
  it('reserves before provider I/O and only one concurrent caller creates an invoice', async () => {
    const { input, sqlite } = fixture();
    let finish!: () => void;
    const release = new Promise<void>((resolve) => { finish = resolve; });
    const codes: number[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method !== 'POST') return json({ code: 'not-found' }, 404);
      const body = JSON.parse(String(init.body));
      expect(sqlite.prepare('SELECT transaction_id FROM payments').get()?.transaction_id).toBe(String(body.orderCode));
      codes.push(body.orderCode);
      await release;
      return payosCheckoutResponse({ orderCode: body.orderCode, amount: 20000 }, 'local-checksum', 'one');
    });
    const first = getOrCreatePayOSAttempt(input);
    await vi.waitFor(() => expect(codes).toHaveLength(1));
    const second = await getOrCreatePayOSAttempt(input);
    expect(second).toMatchObject({ ok: false, status: 202 });
    finish();
    expect(await first).toMatchObject({ ok: true });
    expect(sqlite.prepare('SELECT COUNT(*) count FROM payments').get()?.count).toBe(1);
    expect(codes).toHaveLength(1);
  });

  it('recovers a provider success whose POST response was lost, using the same code and verified GET id', async () => {
    const { input, sqlite } = fixture();
    let code = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (init?.method === 'POST') { code = String(JSON.parse(String(init.body)).orderCode); throw new Error('Lost response after provider commit'); }
      expect(String(url)).toContain(code);
      return signedPayOSResponse({ id: 'existing-link', orderCode: Number(code), amount: 20000, status: 'PENDING', transactions: [] }, 'local-checksum');
    });
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: false, status: 502 });
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: true, payment: { transaction_id: code, payment_url: 'https://pay.payos.vn/web/existing-link' } });
    expect(fetchSpy.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(sqlite.prepare('SELECT COUNT(*) count FROM payments').get()?.count).toBe(1);
  });

  it('recovers when persisting checkoutUrl failed after provider success without changing orderCode', async () => {
    const { input, sqlite } = fixture();
    sqlite.exec("CREATE TRIGGER fail_url BEFORE UPDATE OF payment_url ON payments BEGIN SELECT RAISE(FAIL, 'injected URL write failure'); END;");
    let code = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'POST') { code = String(JSON.parse(String(init.body)).orderCode); return payosCheckoutResponse({ orderCode: Number(code), amount: 20000 }, 'local-checksum', 'one'); }
      return signedPayOSResponse({ id: 'one', orderCode: Number(code), amount: 20000, status: 'PENDING', transactions: [] }, 'local-checksum');
    });
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: false, status: 502 });
    sqlite.exec('DROP TRIGGER fail_url');
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: true, payment: { transaction_id: code } });
    expect(fetchSpy.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it('retries an expired work lease with the SAME reserved code after a provider-not-found result', async () => {
    const { input, sqlite, payment } = fixture();
    payment('order-1');
    sqlite.exec("UPDATE payments SET updated_at = '2020-01-01T00:00:00.000Z'");
    const codes: number[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method !== 'POST') return json({ code: 'not-found' }, 404);
      codes.push(JSON.parse(String(init.body)).orderCode);
      return payosCheckoutResponse({ orderCode: 123456, amount: 20000 }, 'local-checksum', 'retry');
    });
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: true, payment: { transaction_id: '123456' } });
    expect(codes).toEqual([123456]);
  });

  it.each(['completed', 'refunded'])('does not recreate a terminal %s attempt', async (status) => {
    const { input, payment } = fixture();
    payment('order-1', status);
    const spy = vi.spyOn(globalThis, 'fetch');
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: false, status: 409 });
    expect(spy).not.toHaveBeenCalled();
  });

  it.each(['cancelled', 'failed'])('rotates a %s attempt in place when order is unpaid and provider confirms not PAID', async (status) => {
    const { input, payment, sqlite } = fixture();
    payment('order-1', status);
    const codes: number[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (!init?.method || init.method === 'GET') {
        return signedPayOSResponse({ id: 'old-link', orderCode: 123456, amount: 20000, status: 'CANCELLED' }, 'local-checksum');
      }
      const body = JSON.parse(String(init.body));
      codes.push(body.orderCode);
      return payosCheckoutResponse({ orderCode: body.orderCode, amount: 20000 }, 'local-checksum', 'rotated-from-closed');
    });
    const rotated = await getOrCreatePayOSAttempt(input);
    expect(rotated).toMatchObject({ ok: true, cached: false });
    expect(codes).toHaveLength(1);
    expect(codes[0]).not.toBe(123456);
    expect(sqlite.prepare('SELECT COUNT(*) count FROM payments').get()?.count).toBe(1);
  });

  it('fails closed with 502 when provider verification throws a network error during rotation', async () => {
    const { input, payment } = fixture();
    payment('order-1', 'cancelled');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network timeout'));
    const res = await getOrCreatePayOSAttempt(input);
    expect(res).toMatchObject({ ok: false, status: 502, code: 'PAYOS_UPSTREAM_UNAVAILABLE' });
  });

  it('fails closed with 409 PAYMENT_RECONCILIATION_REQUIRED on bad_signature during rotation', async () => {
    const { input, payment } = fixture();
    payment('order-1', 'cancelled');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ code: '00', data: { id: 'old-link', orderCode: 123456, amount: 20000, status: 'CANCELLED' }, signature: 'invalid-sig' }),
    );
    const res = await getOrCreatePayOSAttempt(input);
    expect(res).toMatchObject({ ok: false, status: 409, code: 'PAYMENT_RECONCILIATION_REQUIRED' });
  });

  it('fails closed with ORDER_ALREADY_PAID if provider reports PAID when attempting to rotate cancelled attempt', async () => {
    const { input, payment } = fixture();
    payment('order-1', 'cancelled');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (!init?.method || init.method === 'GET') {
        return signedPayOSResponse({ id: 'paid-link', orderCode: 123456, amount: 20000, status: 'PAID' }, 'local-checksum');
      }
      throw new Error('should not POST new link when already PAID');
    });
    const res = await getOrCreatePayOSAttempt(input);
    expect(res).toMatchObject({ ok: false, status: 409, code: 'ORDER_ALREADY_PAID' });
  });

  it('rotates an expired attempt in place to a fresh orderCode when the order is still unpaid', async () => {
    const { input, payment, sqlite } = fixture();
    payment('order-1', 'expired');
    const codes: number[] = [];
    const expiredAtValues: number[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (!init?.method || init.method === 'GET') {
        return signedPayOSResponse({ id: 'expired-link', orderCode: 123456, amount: 20000, status: 'EXPIRED' }, 'local-checksum');
      }
      const body = JSON.parse(String(init?.body));
      codes.push(body.orderCode);
      expiredAtValues.push(body.expiredAt);
      return payosCheckoutResponse({ orderCode: body.orderCode, amount: 20000 }, 'local-checksum', 'rotated-link');
    });
    const beforeSec = Math.floor(Date.now() / 1000);
    const rotated = await getOrCreatePayOSAttempt(input);
    const afterSec = Math.floor(Date.now() / 1000);
    expect(rotated).toMatchObject({ ok: true, cached: false });
    expect(codes).toHaveLength(1);
    expect(codes[0]).not.toBe(123456);
    expect(expiredAtValues[0]).toBeGreaterThanOrEqual(beforeSec + 15 * 60);
    expect(expiredAtValues[0]).toBeLessThanOrEqual(afterSec + 15 * 60 + 2);
    expect(sqlite.prepare('SELECT COUNT(*) count FROM payments').get()?.count).toBe(1);
    expect(sqlite.prepare('SELECT status, transaction_id FROM payments').get()).toMatchObject({
      status: 'pending',
      transaction_id: String(codes[0]),
    });
  });

  it('reconciles and blocks rotating an expired attempt when provider GET reports PAID, and cancels upstream when provider GET reports PENDING', async () => {
    const { input, payment, sqlite } = fixture();
    payment('order-1', 'expired');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (!init?.method || init.method === 'GET') {
        return signedPayOSResponse({ id: 'paid-expired-link', orderCode: 123456, amount: 20000, status: 'PAID' }, 'local-checksum');
      }
      throw new Error('must not create a new payment request when expired attempt was already PAID upstream');
    });
    const paidRes = await getOrCreatePayOSAttempt(input);
    expect(paidRes).toMatchObject({ ok: false, status: 409, code: 'ORDER_ALREADY_PAID' });
    expect(sqlite.prepare("SELECT payment_status FROM orders WHERE id = 'order-1'").get()?.payment_status).toBe('paid');

    // Second scenario: locally expired attempt is still PENDING at PayOS -> must cancel upstream before rotating
    const f2 = fixture();
    f2.payment('order-1', 'expired');
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      calls.push(`${init?.method ?? 'GET'} ${urlStr}`);
      if (!init?.method || init.method === 'GET') {
        return signedPayOSResponse({ id: 'pending-expired-link', orderCode: 123456, amount: 20000, status: 'PENDING' }, 'local-checksum');
      }
      if (urlStr.endsWith('/cancel')) {
        return json({ code: '00' }, 200);
      }
      const body = JSON.parse(String(init?.body));
      return payosCheckoutResponse({ orderCode: body.orderCode, amount: 20000 }, 'local-checksum', 'fresh-after-cancel');
    });
    const pendingRotated = await getOrCreatePayOSAttempt(f2.input);
    expect(pendingRotated).toMatchObject({ ok: true, cached: false });
    expect(calls).toEqual([
      'GET https://api-merchant.payos.vn/v2/payment-requests/123456',
      'POST https://api-merchant.payos.vn/v2/payment-requests/123456/cancel',
      'POST https://api-merchant.payos.vn/v2/payment-requests',
    ]);
  });

  it('does not rotate an expired attempt when the order is already marked paid', async () => {
    const { input, payment, sqlite } = fixture();
    payment('order-1', 'expired');
    sqlite.exec("UPDATE orders SET payment_status = 'paid' WHERE id = 'order-1'");
    const spy = vi.spyOn(globalThis, 'fetch');
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: false, status: 409 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('fails closed for historical duplicates and never creates a third provider invoice', async () => {
    const { input, payment, sqlite } = fixture();
    payment('order-1');
    sqlite.exec("INSERT INTO payments (id, order_id, method, amount, status, transaction_id) VALUES ('duplicate', 'order-1', 'payos', 20000, 'pending', '654321')");
    const spy = vi.spyOn(globalThis, 'fetch');
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: false, status: 409 });
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([{ orderCode: 654321, amount: 20000, status: 'PENDING' }, { orderCode: 123456, amount: 1000, status: 'PENDING' },
    { orderCode: 123456, amount: 20000, status: 'PAID' }])('rejects mismatched or already paid provider recovery: %s', async (data) => {
    const { input, payment } = fixture(); payment('order-1');
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(signedPayOSResponse(data, 'local-checksum'));
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: false, status: 409 });
    expect(spy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
  it.each([
    { orderCode: 999999, amount: 20000, status: 'PENDING', paymentLinkId: 'one', checkoutUrl: 'https://pay.payos.vn/web/one' },
    { amount: 1000, status: 'PENDING', paymentLinkId: 'one', checkoutUrl: 'https://pay.payos.vn/web/one' },
    { status: 'PAID', paymentLinkId: 'one', checkoutUrl: 'https://pay.payos.vn/web/one' },
    { status: 'PENDING', paymentLinkId: 'one', checkoutUrl: 'https://evil.test/checkout' },
  ])('rejects a signed but invalid creation response: %s', async (changes) => {
    const { input, sqlite } = fixture();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return signedPayOSResponse({ orderCode: body.orderCode, amount: 20000, ...changes }, 'local-checksum');
    });
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: false, status: 502 });
    expect(sqlite.prepare('SELECT payment_url FROM payments').get()?.payment_url).toBe(null);
  });

  it.each(['POST', 'GET'])('rejects a missing or forged signature in %s and preserves the reserved code', async (method) => {
    const { input, payment, sqlite } = fixture();
    if (method === 'GET') payment('order-1');
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const code = method === 'POST' ? JSON.parse(String(init?.body)).orderCode : 123456;
      return json({ code: '00', signature: '0'.repeat(64), data: { id: 'one', paymentLinkId: 'one',
        orderCode: code, amount: 20000, status: 'PENDING', checkoutUrl: 'https://pay.payos.vn/web/one' } });
    });
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: false, status: 502 });
    expect(sqlite.prepare('SELECT payment_url FROM payments').get()?.payment_url).toBe(null);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('canonicalizes signed transaction arrays by object key without reordering transactions', async () => {
    const data = { z: 1, a: null, b: 'undefined', skip: undefined,
      transactions: [{ a: 3, Z: 1, A: 2 }, { reference: 'b', memo: 'Cà phê' }] };
    expect(canonicalPayOSData(data)).toBe('a=&b=&transactions=[{"A":2,"Z":1,"a":3},{"memo":"Cà phê","reference":"b"}]&z=1');
    const signed = await signedPayOSResponse(data, 'local-checksum').json() as { signature: string };
    expect(await verifyPayOSSignature(data, signed.signature, 'local-checksum')).toBe(true);
    expect(await verifyPayOSSignature({ ...data, transactions: [...data.transactions].reverse() }, signed.signature, 'local-checksum')).toBe(false);
    expect(await verifyPayOSSignature(data, signed.signature, '')).toBe(false);
    expect(await verifyPayOSSignature(data, signed.signature, '   ')).toBe(false);
  });

  it('validatePayOSAccess blocks unauthenticated guests from customer-owned orders and permits supervisor', () => {
    const ownedOrder = { id: 'ord-cust-1', total: 45000, payment_status: 'unpaid', customer_id: 'cust-123' };
    expect(validatePayOSAccess(ownedOrder, null)).toEqual({ allowed: false, reason: 'forbidden' });
    expect(validatePayOSAccess(ownedOrder, 'cust-other', 'customer')).toEqual({ allowed: false, reason: 'forbidden' });
    expect(validatePayOSAccess(ownedOrder, 'cust-123', 'customer')).toEqual({ allowed: true });
    expect(validatePayOSAccess(ownedOrder, null, 'supervisor')).toEqual({ allowed: true });
  });

  it('accepts successful reservations and URL writes when D1 includes trigger changes', async () => {
    const { input, sqlite, db } = fixture();
    sqlite.exec(`CREATE TRIGGER pay_insert AFTER INSERT ON payments BEGIN UPDATE payments SET updated_at = '2020-01-01' WHERE id = NEW.id; END;
      CREATE TRIGGER pay_touch AFTER UPDATE ON payments BEGIN UPDATE payments SET created_at = COALESCE(created_at, '2020-01-01') WHERE id = NEW.id; END;`);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => payosCheckoutResponse(JSON.parse(String(init?.body)), 'local-checksum'));
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: true });
    const changed = await db.prepare("UPDATE payments SET payment_url = 'https://pay.payos.vn/web/new' WHERE id = ?").bind('payos:order-1').run();
    expect(changed.meta.changes).toBeGreaterThan(1);
    expect(await getOrCreatePayOSAttempt(input)).toMatchObject({ ok: true, cached: true });
  });

});
