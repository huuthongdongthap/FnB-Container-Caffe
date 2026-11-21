// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { transitionOrderStatus } from '@aura/domain-order/policies/order-status-transition';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { TEST_JWT_SECRET } from '../test-utils';
import { orderCreationFixture } from '../integrations/order-creation-fixture';

const fixtures: ReturnType<typeof orderCreationFixture>[] = [];
function fixture(status = 'preparing', paid = 'unpaid', tenant = 'cafe-a') {
  const value = orderCreationFixture(); fixtures.push(value);
  value.sqlite.prepare(`INSERT INTO orders(id,items,total,status,payment_status,payment_method,customer_name,customer_phone,tenant_id)
    VALUES ('COD_LOCAL','[]',20000,?,?,'cod','Local','0900000010',?)`).run(status, paid, tenant);
  value.sqlite.prepare("INSERT INTO payments(id,order_id,method,amount,status,tenant_id) VALUES ('COD_PAYMENT','COD_LOCAL','cod',20000,'pending',?)").run(tenant);
  // The request-time session gate reads the account row behind the token; with
  // no row it cannot tell a live session from a revoked one.
  // Each actor has an explicit canonical role/tenant matching its session.
  for (const role of ['cashier', 'staff']) value.sqlite.prepare(`INSERT INTO users (id,name,role,tenant_id,is_active,auth_version)
    VALUES (?,? ,?,'cafe-a',1,1)`).run(`local-${role}`, `Local ${role}`, role);
  return value;
}
async function request(path = '/api/orders/COD_LOCAL/mark-cod-paid', method = 'PATCH', role = 'cashier') {
  // The session gate judges these claims against the account row inserted below,
  // so the auth version must be present and must match that row.
  const token = await generateJWT({ id: `local-${role}`, role, tenantId: 'cafe-a', email: 'local@test.aura',
    authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' } as any, TEST_JWT_SECRET, 28800);
  return new Request(`https://test.aura${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
}
afterEach(() => { for (const value of fixtures.splice(0)) value.sqlite.close(); });

describe('atomic COD ledger and guarded legacy aliases (real SQLite)', () => {
  for (const status of ['pending', 'preparing', 'ready']) it(`collects twice safely without finishing ${status}`, async () => {
    const { sqlite, env } = fixture(status);
    expect((await app.fetch(await request(), env)).status).toBe(200);
    expect((await app.fetch(await request(), env)).status).toBe(200);
    expect(sqlite.prepare("SELECT status,payment_status FROM orders WHERE id='COD_LOCAL'").get()).toMatchObject({ status, payment_status: 'paid' });
    expect(sqlite.prepare("SELECT status FROM payments WHERE id='COD_PAYMENT'").get()?.status).toBe('completed');
    expect(sqlite.prepare('SELECT COUNT(*) count FROM payments').get()?.count).toBe(1);
  });
  it('rolls back order when payment write fails, then retry settles both', async () => {
    const { sqlite, env } = fixture();
    sqlite.exec("CREATE TRIGGER fail_cod_ledger BEFORE UPDATE OF status ON payments BEGIN SELECT RAISE(FAIL,'local ledger failure'); END;");
    expect((await app.fetch(await request(), env)).status).toBeGreaterThanOrEqual(500);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('unpaid');
    expect(sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('pending');
    sqlite.exec('DROP TRIGGER fail_cod_ledger');
    expect((await app.fetch(await request(), env)).status).toBe(200);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('paid');
    expect(sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('completed');
  });
  it('repairs a previously paid order with an unfinished COD ledger', async () => {
    const { sqlite, env } = fixture('preparing', 'paid');
    expect((await app.fetch(await request(), env)).status).toBe(200);
    expect(sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('completed');
    expect(sqlite.prepare('SELECT status FROM orders').get()?.status).toBe('preparing');
  });
  it('never recollects refunded money', async () => {
    const { sqlite, env } = fixture('completed', 'refunded');
    expect((await app.fetch(await request(), env)).status).toBe(409);
    expect(sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('refunded');
  });
  it('confines cancel alias to the signed store', async () => {
    const { sqlite, env } = fixture('pending', 'unpaid', 'cafe-b');
    expect((await app.fetch(await request('/api/orders/COD_LOCAL/cancel', 'POST', 'staff'), env)).status).toBe(404);
    expect(sqlite.prepare('SELECT status FROM orders').get()?.status).toBe('pending');
  });
  it.each(['cod', 'cash'])('requires %s collection before completing a served order', async (method) => {
    const { sqlite, env } = fixture('served');
    sqlite.prepare('UPDATE orders SET payment_method = ? WHERE id = ?').run(method, 'COD_LOCAL');
    const complete = () => request('/api/admin/orders/COD_LOCAL/complete', 'POST', 'staff');

    const blocked = await app.fetch(await complete(), env);
    expect(blocked.status).toBe(409);
    expect(sqlite.prepare('SELECT status,payment_status FROM orders').get()).toMatchObject({ status: 'served', payment_status: 'unpaid' });

    expect((await app.fetch(await request(), env)).status).toBe(200);
    expect((await app.fetch(await complete(), env)).status).toBe(200);
    expect(sqlite.prepare('SELECT status,payment_status FROM orders').get()).toMatchObject({ status: 'completed', payment_status: 'paid' });
    expect(sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('completed');
  });
  it.each(['cash', 'cod', 'legacy is_cod'])('uses persisted settlement despite stale paid input for %s', async (method) => {
    const { sqlite, env } = fixture('served');
    sqlite.prepare('UPDATE orders SET payment_method = ?, is_cod = 1').run(method === 'legacy is_cod' ? 'cod' : method);
    if (method === 'legacy is_cod') sqlite.exec('ALTER TABLE orders DROP COLUMN payment_method');
    const complete = () => transitionOrderStatus(env.AURA_DB, 'COD_LOCAL', 'completed', 'staff', {
      tenantId: 'cafe-a', currentOrder: { id: 'COD_LOCAL', status: 'served', payment_status: 'paid' }, paymentStatus: 'paid',
    });
    expect(await complete()).toMatchObject({ success: false, statusCode: 409 });
    expect(sqlite.prepare('SELECT status,payment_status FROM orders').get()).toMatchObject({ status: 'served', payment_status: 'unpaid' });
    sqlite.exec("UPDATE orders SET payment_status = 'paid'");
    expect(await complete()).toMatchObject({ success: true });
    expect(sqlite.prepare('SELECT status FROM orders').get()?.status).toBe('completed');
  });
  it('allows complete alias from served, preserving state machine rules', async () => {
    const { sqlite, env } = fixture('served', 'paid');
    expect((await app.fetch(await request('/api/admin/orders/COD_LOCAL/complete', 'POST', 'staff'), env)).status).toBe(200);
    expect(sqlite.prepare('SELECT status FROM orders').get()?.status).toBe('completed');
  });
});
