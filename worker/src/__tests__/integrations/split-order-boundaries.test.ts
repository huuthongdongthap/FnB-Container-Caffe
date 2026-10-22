// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { orderCreationFixture } from './order-creation-fixture';
import { payosCheckoutResponse } from '../helpers/payment-sqlite-db';

const fixtures: ReturnType<typeof orderCreationFixture>[] = [];
const fixture = () => { const value = orderCreationFixture(); fixtures.push(value); return value; };
afterEach(() => { vi.restoreAllMocks(); for (const { sqlite } of fixtures.splice(0)) sqlite.close(); });
const entry = { customer_name: 'Split guest', customer_phone: '0900000010', total: 1000,
  items: [{ id: 'coffee', name: 'Forged', quantity: 1, price: 1000 }], discount: 19000, shipping_fee: 0 };
const auth = () => generateJWT({ id: 'staff-a', role: 'waiter', tenantId: 'cafe-a' }, 'test-jwt-secret-at-least-16-chars');
function split(env: any, table_id: string, orders: unknown[], token?: string) {
  return app.fetch(new Request('https://test.aura/api/orders/split?tenant_id=cafe-b', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'cafe-b',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ table_id, tenant_id: 'cafe-b', orders }),
  }), env);
}

describe('Split bill server financial and tenant boundaries', () => {
  it('uses server prices, persists scoped lines and creates a ledger only for COD', async () => {
    const { env, sqlite } = fixture();
    const response = await split(env, 'A1', [{ ...entry, payment_method: 'cod' }, { ...entry, payment_method: 'payos' }], await auth());
    expect(response.status).toBe(201);
    const { data } = await response.json() as any;
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ total: 20000, table_id: 'table-a', payment_status: 'unpaid' });
    expect(data[0].items[0]).toMatchObject({ name: 'Coffee', menuItemId: 'coffee', price: 20000 });
    expect(sqlite.prepare('SELECT total, discount, tenant_id FROM orders').all())
      .toEqual([{ total: 20000, discount: 0, tenant_id: 'cafe-a' }, { total: 20000, discount: 0, tenant_id: 'cafe-a' }]);
    expect(sqlite.prepare('SELECT product_id,subtotal FROM order_items').all())
      .toEqual([{ product_id: 'coffee', subtotal: 20000 }, { product_id: 'coffee', subtotal: 20000 }]);
    expect(sqlite.prepare('SELECT method,amount,status FROM payments').all())
      .toEqual([{ method: 'cod', amount: 20000, status: 'pending' }]);
  });

  it('allows a split PayOS bill to reserve and create its first payment link', async () => {
    const { env, sqlite } = fixture();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
      payosCheckoutResponse(JSON.parse(String(init?.body)), env.PAYOS_CHECKSUM_KEY, 'split-link'));
    const response = await split(env, 'D1', [{ ...entry, payment_method: 'payos' }, entry]);
    expect(response.status).toBe(201);
    const { data } = await response.json() as any;
    const link = await app.fetch(new Request('https://test.aura/api/payment/create-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: data[0].id }),
    }), env);
    expect(link.status).toBe(200);
    expect(sqlite.prepare('SELECT method,amount,status,transaction_id FROM payments WHERE order_id=?').get(data[0].id))
      .toMatchObject({ method: 'payos', amount: 20000, status: 'pending', transaction_id: expect.any(String) });
  });

  it('confines guest tables to default and staff tables to their signed store', async () => {
    for (const [table, token] of [['table-b', undefined], ['table-b', await auth()]] as const) {
      const { env, sqlite } = fixture();
      expect((await split(env, table, [entry, entry], token)).status).toBe(400);
      expect(sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get()).toMatchObject({ count: 0 });
      expect(sqlite.prepare('SELECT status FROM cafe_tables WHERE id=?').get(table)).toMatchObject({ status: 'Available' });
    }
    const { env, sqlite } = fixture();
    expect((await split(env, 'D1', [entry, entry])).status).toBe(201);
    expect(sqlite.prepare('SELECT DISTINCT tenant_id FROM orders').all()).toEqual([{ tenant_id: 'default' }]);
  });

  it('rejects an unknown second item before any sub-order or table write', async () => {
    const { env, sqlite } = fixture();
    const response = await split(env, 'A1', [entry, { ...entry, items: [{ ...entry.items[0], id: 'coffee-cheap' }] }], await auth());
    expect(response.status).toBe(400);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get()).toMatchObject({ count: 0 });
    expect(sqlite.prepare('SELECT status FROM cafe_tables WHERE id=?').get('table-a')).toMatchObject({ status: 'Available' });
  });

  it('rolls back all sub-orders when a ledger insert fails', async () => {
    const { env, sqlite } = fixture();
    sqlite.exec("CREATE TRIGGER deny_split_payment BEFORE INSERT ON payments BEGIN SELECT RAISE(ABORT, 'injected'); END");
    expect((await split(env, 'A1', [entry, entry], await auth())).status).toBe(500);
    for (const table of ['orders', 'order_items', 'payments']) {
      expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toMatchObject({ count: 0 });
    }
    expect(sqlite.prepare('SELECT status FROM cafe_tables WHERE id=?').get('table-a')).toMatchObject({ status: 'Available' });
  });
});
