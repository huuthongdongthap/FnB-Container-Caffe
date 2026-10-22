// @vitest-environment node
/** Split bill validation and persistence contract against actual SQLite. */
import { afterEach, describe, expect, it } from 'vitest';
import { splitOrders } from '@aura/domain-order';
import { orderCreationFixture } from '../../integrations/order-creation-fixture';

const fixtures: ReturnType<typeof orderCreationFixture>[] = [];
function fixture() { const f = orderCreationFixture(); fixtures.push(f); return f; }
afterEach(() => { for (const { sqlite } of fixtures.splice(0)) sqlite.close(); });
const entry = { items: [{ id: 'coffee', name: 'Coffee', price: 1000, quantity: 2 }], total: 1000,
  customer_name: 'Split customer', customer_phone: '0909123456', payment_method: 'cod' };
const payload = { table_id: 'D1', orders: [entry, { ...entry, payment_method: 'payos' }] };
const request = (body: unknown) => new Request('https://test.aura/api/orders/split', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('splitOrders', () => {
  it('creates independent bills with stable response shape and correct catalog prices', async () => {
    const { env, sqlite } = fixture();
    const response = await splitOrders(request(payload), env);
    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true); expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({ total: 40000, status: 'pending', payment_status: 'unpaid', table_id: 'table-default' });
    expect(body.data[0].id).not.toBe(body.data[1].id);
    expect(sqlite.prepare('SELECT COUNT(*) count FROM order_items').get()).toMatchObject({ count: 2 });
    expect(sqlite.prepare('SELECT method,amount FROM payments').all()).toEqual([{ method: 'cod', amount: 40000 }]);
  });
  it('defaults to COD when a payment method is omitted', async () => {
    const { env } = fixture();
    const { payment_method: _method, ...withoutMethod } = entry;
    const response = await splitOrders(request({ table_id: 'D1', orders: [withoutMethod, withoutMethod] }), env);
    expect(response.status).toBe(201);
    expect((await response.json() as any).data.every((o: any) => o.payment_method === 'cod')).toBe(true);
  });
  it.each([[], [entry], Array(5).fill(entry)])('rejects invalid number of sub-orders', async orders => {
    const { env, sqlite } = fixture();
    expect((await splitOrders(request({ table_id: 'D1', orders }), env)).status).toBe(400);
    expect(sqlite.prepare('SELECT COUNT(*) count FROM orders').get()).toMatchObject({ count: 0 });
  });
  it('rejects missing table information', async () => {
    const { env } = fixture();
    expect((await splitOrders(request({ orders: [entry, entry] }), env)).status).toBe(400);
  });
  it('rejects unresolved tables without a table-less fallback', async () => {
    const { env } = fixture();
    expect((await splitOrders(request({ ...payload, table_id: 'missing-table' }), env)).status).toBe(400);
  });
  it.each(['momo', 'apple_pay', 'google_pay'])('rejects unsupported method %s before writing', async method => {
    const { env, sqlite } = fixture();
    const response = await splitOrders(request({ ...payload, orders: [entry, { ...entry, payment_method: method }] }), env);
    expect(response.status).toBe(400);
    expect(sqlite.prepare('SELECT COUNT(*) count FROM orders').get()).toMatchObject({ count: 0 });
  });
  it('returns a sanitized failure on database errors', async () => {
    const { env } = fixture();
    env.AURA_DB.prepare = () => { throw new Error('D1 error'); };
    const response = await splitOrders(request(payload), env);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: 'Failed to create split orders' });
  });
});
