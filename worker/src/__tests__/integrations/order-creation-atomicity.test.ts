// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOrder } from '@aura/domain-order';
import { app } from '../../index';
import { payosCheckoutResponse } from '../helpers/payment-sqlite-db';
import { orderCreationFixture } from './order-creation-fixture';

const fixtures: ReturnType<typeof orderCreationFixture>[] = [];
const fixture = () => { const value = orderCreationFixture(); fixtures.push(value); return value; };
afterEach(() => { vi.restoreAllMocks(); for (const { sqlite } of fixtures.splice(0)) sqlite.close(); });
const body = { items: [{ product_id: 'coffee', name: 'Coffee', quantity: 1 }], total: 20000,
  customer_name: 'Guest', customer_phone: '0900000010', payment_method: 'cod', table_id: 'D1' };
const request = (key = 'durable-order', changes = {}) => new Request('https://test.aura/api/orders', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ ...body, ...changes }),
});

describe('Atomic canonical order acceptance', () => {
  it.each(['order_items', 'payments'])('rolls back order, table, and idempotency when %s fails', async table => {
    const { env, sqlite } = fixture();
    const broadcast = vi.fn(async () => Response.json({ success: true }));
    env.ORDER_BROADCASTER = { idFromName: () => '', get: () => ({ fetch: broadcast }) };
    sqlite.exec(`CREATE TRIGGER injected_failure BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'injected'); END`);
    expect((await createOrder(request(), env)).status).toBe(500);
    for (const name of ['orders', 'order_items', 'payments', 'order_creation_requests']) {
      expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get()).toMatchObject({ count: 0 });
    }
    expect(sqlite.prepare("SELECT status FROM cafe_tables WHERE id='table-default'").get()).toMatchObject({ status: 'Available' });
    expect(broadcast).not.toHaveBeenCalled();
    sqlite.exec('DROP TRIGGER injected_failure');
    expect((await createOrder(request(), env)).status).toBe(201);
  });

  it('replays durably with KV missing and rejects a changed payload', async () => {
    const { env, sqlite } = fixture();
    env.AUTH_KV = undefined;
    const first = await createOrder(request(), env);
    const repeated = await createOrder(request(), env);
    expect(first.status).toBe(201);
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toEqual(await first.json());
    expect((await createOrder(request('durable-order', { customer_name: 'changed' }), env)).status).toBe(409);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get()).toMatchObject({ count: 1 });
  });

  it('returns success after commit despite KV cache write failures', async () => {
    const { env, sqlite } = fixture();
    env.AUTH_KV.put = vi.fn(async () => { throw new Error('KV unavailable'); });
    expect((await createOrder(request(), env)).status).toBe(201);
    expect((await createOrder(request(), env)).status).toBe(200);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get()).toMatchObject({ count: 1 });
  });

  it('does not assign an unverified guest phone to an existing CRM owner', async () => {
    const { env, sqlite } = fixture();
    sqlite.exec("INSERT INTO customers (id,name,phone,email) VALUES ('registered-owner','Existing customer','0900000010','existing@test.aura')");
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
      payosCheckoutResponse(JSON.parse(String(init?.body)), env.PAYOS_CHECKSUM_KEY, 'returning-guest'));
    const response = await createOrder(request('returning-guest', { payment_method: 'payos' }), env);
    expect(response.status).toBe(201);
    const { data } = await response.json() as any;
    expect(sqlite.prepare('SELECT customer_id FROM orders').get()).toMatchObject({ customer_id: null });
    const link = await app.fetch(new Request('https://test.aura/api/payment/create-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: data.id }),
    }), env);
    expect(link.status).toBe(200);
    const tracked = await app.fetch(new Request(`https://test.aura/api/orders/${data.id}/track`), env);
    expect(tracked.status).toBe(200);
    expect((await tracked.json() as any).data.items[0].name).toBe('Coffee');
  });
});
