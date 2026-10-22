// @vitest-environment node
/** Real Hono routing, HMAC verification and transactional SQLite settlement for every alias. */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { app } from '../../index';
import { paymentSqliteDB } from '../helpers/payment-sqlite-db';
import { createMockKV } from '../test-utils';

const KEY = 'local-payos-checksum';
const aliases = ['/api/webhook/payos', '/api/payments/webhook/payos'];
function fixture(status = 'pending', orderStatus = 'unpaid') {
  const sql = paymentSqliteDB(); sql.order('ORDER'); sql.payment('ORDER', status);
  sql.sqlite.prepare('UPDATE orders SET payment_status = ?').run(orderStatus);
  return { ...sql, env: { AURA_DB: sql.db, AUTH_KV: createMockKV(), PAYOS_CHECKSUM_KEY: KEY, ENVIRONMENT: 'test' } as any };
}
function request(path: string, changes: Record<string, unknown> = {}, options: { success?: boolean; signature?: string } = {}) {
  const data = { orderCode: 123456, amount: 20000, code: '00', description: 'Local test', ...changes };
  const canonical = Object.keys(data).sort().map((key) => `${key}=${data[key as keyof typeof data]}`).join('&');
  const signature = options.signature ?? createHmac('sha256', KEY).update(canonical).digest('hex');
  return new Request(`https://test.aura${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '00', desc: 'success', success: options.success ?? true, data, signature }) });
}
const context = { waitUntil: (_promise: Promise<unknown>) => {} } as any;

describe.each(aliases)('PayOS settlement alias %s', (path) => {
  it('settles once, preserves fulfillment, and acknowledges duplicate delivery', async () => {
    const { env, sqlite } = fixture();
    sqlite.exec("UPDATE orders SET status = 'preparing'");
    for (let repeat = 0; repeat < 2; repeat++) expect((await app.fetch(request(path), env, context)).status).toBe(200);
    expect(sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('completed');
    expect(sqlite.prepare('SELECT payment_status, status FROM orders').get()).toMatchObject({ payment_status: 'paid', status: 'preparing' });
    expect(sqlite.prepare("SELECT COUNT(*) count FROM _metrics WHERE name = 'payment_success'").get()?.count).toBe(1);
  });

  it('recognizes changed rows and publishes once when timestamp triggers increase D1 changes', async () => {
    const { env, sqlite } = fixture();
    sqlite.exec(`CREATE TRIGGER pay_touch AFTER UPDATE ON payments BEGIN UPDATE payments SET created_at = '2020-01-01' WHERE id = NEW.id; END;
      CREATE TRIGGER order_touch AFTER UPDATE ON orders BEGIN UPDATE orders SET created_at = '2020-01-01' WHERE id = NEW.id; END;`);
    expect((await app.fetch(request(path), env, context)).status).toBe(200);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('paid');
    expect(sqlite.prepare("SELECT COUNT(*) count FROM _metrics WHERE name = 'payment_success'").get()?.count).toBe(1);
    expect((await app.fetch(request(path), env, context)).status).toBe(200);
    expect(sqlite.prepare("SELECT COUNT(*) count FROM _metrics WHERE name = 'payment_success'").get()?.count).toBe(1);
  });

  it('rolls back BOTH state updates when the order write fails, then heals on replay', async () => {
    const { env, sqlite } = fixture();
    sqlite.exec("CREATE TRIGGER fail_settlement BEFORE UPDATE OF payment_status ON orders BEGIN SELECT RAISE(FAIL, 'injected order write failure'); END");
    expect((await app.fetch(request(path), env, context)).status).toBe(500);
    expect(sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('pending');
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('unpaid');
    sqlite.exec('DROP TRIGGER fail_settlement');
    expect((await app.fetch(request(path), env, context)).status).toBe(200);
    expect(sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('completed');
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('paid');
  });

  it('repairs a historical completed payment whose order was left unpaid', async () => {
    const { env, sqlite } = fixture('completed');
    expect((await app.fetch(request(path), env, context)).status).toBe(200);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('paid');
    expect(sqlite.prepare("SELECT COUNT(*) count FROM _metrics WHERE name = 'payment_success'").get()?.count).toBe(0);
  });

  it('allows late success after failure without creating another payment', async () => {
    const { env, sqlite } = fixture('failed');
    expect((await app.fetch(request(path), env, context)).status).toBe(200);
    expect(sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('completed');
    expect(sqlite.prepare('SELECT COUNT(*) count FROM payments').get()?.count).toBe(1);
  });

  it.each([0, 1000, -1, 20000.5])('rejects incorrect amount %s with no state mutation', async (amount) => {
    const { env, sqlite } = fixture();
    expect((await app.fetch(request(path, { amount }), env, context)).status).toBe(400);
    expect(sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('pending');
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('unpaid');
  });


  it('refuses historical underpriced payments even when provider amount matches the payment row', async () => {
    const { env, sqlite } = fixture(); sqlite.exec('UPDATE payments SET amount = 1000');
    expect((await app.fetch(request(path, { amount: 1000 }), env, context)).status).toBe(400);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('unpaid');
  });

  it('uses legacy total_amount only when canonical total is absent', async () => {
    const { env, sqlite } = fixture(); sqlite.exec('ALTER TABLE orders RENAME COLUMN total TO total_amount');
    expect((await app.fetch(request(path), env, context)).status).toBe(200);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('paid');
  });
  it('rejects incorrect amount even on a completed replay', async () => {
    const { env } = fixture('completed', 'paid');
    expect((await app.fetch(request(path, { amount: 1000 }), env, context)).status).toBe(400);
  });

  it('rejects invalid signatures before writing', async () => {
    const { env, sqlite } = fixture();
    expect((await app.fetch(request(path, {}, { signature: 'bad' }), env, context)).status).toBe(401);
    expect(sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('pending');
  });

  it('keeps failed or expired transfers unpaid', async () => {
    const { env, sqlite } = fixture();
    expect((await app.fetch(request(path, { code: '01', status: 'EXPIRED' }, { success: false }), env, context)).status).toBe(200);
    expect(sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('expired');
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('unpaid');
  });

  it('does not let a PAID status label override a non-success result code', async () => {
    const { env, sqlite } = fixture();
    expect((await app.fetch(request(path, { code: '01', status: 'PAID' }), env, context)).status).toBe(200);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('unpaid');
  });

  it('refuses to pay a COD order through a PayOS webhook', async () => {
    const { env, sqlite } = fixture(); sqlite.exec("UPDATE orders SET payment_method = 'cod'");
    expect((await app.fetch(request(path), env, context)).status).toBe(409);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('unpaid');
  });

  it('does not let a second historical payment win settlement for an already paid order', async () => {
    const { env, sqlite } = fixture();
    sqlite.exec("INSERT INTO payments (id, order_id, method, amount, status, transaction_id) VALUES ('old_paid', 'ORDER', 'payos', 20000, 'completed', '999')");
    expect((await app.fetch(request(path), env, context)).status).toBe(409);
    expect(sqlite.prepare("SELECT status FROM payments WHERE id = 'pay_ORDER'").get()?.status).toBe('pending');
  });

  it('concurrent duplicate callbacks settle only one transition', async () => {
    const { env, sqlite } = fixture();
    const responses = await Promise.all([app.fetch(request(path), env, context), app.fetch(request(path), env, context)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(sqlite.prepare("SELECT COUNT(*) count FROM _metrics WHERE name = 'payment_success'").get()?.count).toBe(1);
  });

  it('acknowledges a signed unknown code and empty verification probe', async () => {
    const { env } = fixture();
    expect((await app.fetch(request(path, { orderCode: 999999 }), env, context)).status).toBe(200);
    if (path === '/api/webhook/payos') expect((await app.fetch(new Request(`https://test.aura${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), env, context)).status).toBe(200);
  });
});
