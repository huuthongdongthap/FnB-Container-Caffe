// @vitest-environment node
/** Canonical writer contracts execute real bootstrap SQL and catalog lookups. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOrder } from '@aura/domain-order';
import { orderCreationFixture } from '../../integrations/order-creation-fixture';
import { createMockKV } from '../../test-utils';

const fixtures: ReturnType<typeof orderCreationFixture>[] = [];
function fixture() { const f = orderCreationFixture(); fixtures.push(f); return f; }
afterEach(() => { for (const { sqlite } of fixtures.splice(0)) sqlite.close(); });
const base = {
  items: [{ product_id: 'coffee', name: 'Forged name', quantity: 2, price: 25000 }], total: 50000,
  customer_name: 'Nguyen Van A', customer_phone: '0909123456', customer_email: '', customer_address: '',
  payment_method: 'cod', shipping_fee: 0, discount: 0, notes: '', delivery_time: 'now', order_type: 'takeaway',
};
function request(overrides: Record<string, unknown> = {}, key?: string) {
  return new Request('https://test.aura/api/orders', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify({ ...base, ...overrides }),
  });
}

describe('createOrder', () => {
  it('rejects empty items before writing', async () => {
    const { env, sqlite } = fixture();
    expect((await createOrder(request({ items: [] }), env)).status).toBe(400);
    expect(sqlite.prepare('SELECT COUNT(*) count FROM orders').get()).toMatchObject({ count: 0 });
  });
  it('returns 201 with the stable order envelope and server-priced snapshot', async () => {
    const { env, sqlite } = fixture();
    const response = await createOrder(request(), env);
    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(body).toMatchObject({ success: true, message: 'Order created successfully' });
    expect(body.data.id).toMatch(/^ORD_/);
    expect(body.data).toMatchObject({ status: 'pending', payment_status: 'unpaid', total: 40000 });
    expect(body.data.items[0]).toMatchObject({ name: 'Coffee', price: 20000, quantity: 2 });
    expect(sqlite.prepare('SELECT total FROM orders').get()).toMatchObject({ total: 40000 });
  });
  it('includes customer, payment, numeric totals and null optional fields', async () => {
    const { env } = fixture();
    const { data } = await (await createOrder(request(), env)).json() as any;
    expect(data.customer).toEqual({ full_name: base.customer_name, phone: base.customer_phone, address: null });
    expect(data).toMatchObject({ customer_name: base.customer_name, customer_phone: base.customer_phone,
      customer_address: null, payment_method: 'cod', table_id: null, notes: null, delivery_time: 'now', shipping_fee: 0, discount: 0 });
    expect(new Date(data.created_at).toISOString()).toBe(data.created_at);
  });
  it('resolves a store table code and atomically occupies the correct table', async () => {
    const { env, sqlite } = fixture();
    const response = await createOrder(request({ table_id: 'D1', order_type: 'dine_in' }), env);
    expect(response.status).toBe(201);
    expect((await response.json() as any).data.table_id).toBe('table-default');
    expect(sqlite.prepare("SELECT status FROM cafe_tables WHERE id='table-default'").get()).toMatchObject({ status: 'Occupied' });
  });
  it('rejects an unresolved explicit table instead of creating an unbound order', async () => {
    const { env, sqlite } = fixture();
    expect((await createOrder(request({ table_id: '999' }), env)).status).toBe(400);
    expect(sqlite.prepare('SELECT COUNT(*) count FROM orders').get()).toMatchObject({ count: 0 });
  });
  it('does not query cafe_tables for takeaway without a table', async () => {
    const { env } = fixture();
    const spy = vi.spyOn(env.AURA_DB, 'prepare');
    expect((await createOrder(request(), env)).status).toBe(201);
    expect(spy.mock.calls.some(([sql]) => String(sql).includes('cafe_tables'))).toBe(false);
  });
  it('accepts an email without assigning unverified CRM account ownership', async () => {
    const { env, sqlite } = fixture();
    const response = await createOrder(request({ customer_email: 'guest@test.aura' }), env);
    expect(response.status).toBe(201);
    expect(sqlite.prepare('SELECT customer_email,customer_id FROM orders').get())
      .toMatchObject({ customer_email: 'guest@test.aura', customer_id: null });
  });
  it('keeps guest CRM attribution separate from account ownership', async () => {
    const { env, sqlite } = fixture();
    expect((await createOrder(request(), env)).status).toBe(201);
    expect(sqlite.prepare('SELECT COUNT(*) count FROM customers').get()).toMatchObject({ count: 1 });
    expect(sqlite.prepare('SELECT customer_id FROM orders').get()).toMatchObject({ customer_id: null });
  });
  it('returns a sanitized 500 when persistence fails', async () => {
    const { env, sqlite } = fixture();
    sqlite.exec("CREATE TRIGGER fail_order BEFORE INSERT ON orders BEGIN SELECT RAISE(ABORT,'Simulated DB failure'); END");
    const response = await createOrder(request(), env);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: 'Failed to create order' });
  });
  it('preserves quantity, notes and distinct catalog products', async () => {
    const { env, sqlite } = fixture();
    sqlite.exec("INSERT INTO products(id,category_id,name,price) VALUES('bread','coffee','Bread',15000)");
    const response = await createOrder(request({ items: [base.items[0], { product_id: 'bread', name: 'Bread', quantity: 1, notes: 'Warm' }] }), env);
    expect(response.status).toBe(201);
    const { data } = await response.json() as any;
    expect(data.total).toBe(55000);
    expect(data.items[1]).toMatchObject({ menuItemId: 'bread', price: 15000, notes: 'Warm' });
  });
  it('accepts PayOS without precreating an unusable pending payment', async () => {
    const { env, sqlite } = fixture();
    const response = await createOrder(request({ payment_method: 'payos' }), env);
    expect(response.status).toBe(201);
    expect((await response.json() as any).data).toMatchObject({ payment_method: 'payos', payment_status: 'unpaid' });
    expect(sqlite.prepare('SELECT COUNT(*) count FROM payments').get()).toMatchObject({ count: 0 });
  });
  it('rejects unsupported payment methods', async () => {
    const { env } = fixture();
    expect((await createOrder(request({ payment_method: 'visa' }), env)).status).toBe(400);
  });
  it('ignores untrusted shipping and discount values', async () => {
    const { env } = fixture();
    const response = await createOrder(request({ shipping_fee: 5000, discount: 39000 }), env);
    expect(response.status).toBe(201);
    expect((await response.json() as any).data).toMatchObject({ shipping_fee: 0, discount: 0, total: 40000 });
  });
  it('rejects unknown composite IDs without prefix or name fallback', async () => {
    const { env } = fixture();
    const response = await createOrder(request({ items: [{ id: 'coffee-Size M', name: 'Coffee', quantity: 1, price: 1000 }] }), env);
    expect(response.status).toBe(400);
  });
});

describe('Idempotency', () => {
  it('returns the original durable response on a duplicate scoped key', async () => {
    const { env, sqlite } = fixture();
    const first = await createOrder(request({}, 'repeat'), env);
    const replay = await createOrder(request({}, 'repeat'), env);
    expect(first.status).toBe(201); expect(replay.status).toBe(200);
    expect(replay.headers.get('X-Cache')).toBe('HIT');
    expect(await replay.json()).toEqual(await first.json());
    expect(sqlite.prepare('SELECT COUNT(*) count FROM orders').get()).toMatchObject({ count: 1 });
  });
  it('ignores a legacy global KV entry and caches the accepted scoped response', async () => {
    const { env, sqlite } = fixture();
    env.AUTH_KV = createMockKV({ 'order:idempotency:legacy': JSON.stringify({ data: { id: 'FOREIGN_ORDER' } }) });
    expect((await createOrder(request({}, 'legacy'), env)).status).toBe(201);
    const row = sqlite.prepare('SELECT scope_key,response_body FROM order_creation_requests').get() as any;
    expect(row.scope_key).toMatch(/^order:idempotency:v2:/);
    expect(JSON.parse(row.response_body).data.id).not.toBe('FOREIGN_ORDER');
    expect(await env.AUTH_KV.get(row.scope_key)).toBeTruthy();
  });
  it('creates independently when no idempotency key is given', async () => {
    const { env, sqlite } = fixture();
    expect((await createOrder(request(), env)).status).toBe(201);
    expect(sqlite.prepare('SELECT COUNT(*) count FROM order_creation_requests').get()).toMatchObject({ count: 0 });
  });
  it('retains replay safety when AUTH_KV is missing', async () => {
    const { env } = fixture(); env.AUTH_KV = undefined;
    expect((await createOrder(request({}, 'no-kv'), env)).status).toBe(201);
    expect((await createOrder(request({}, 'no-kv'), env)).status).toBe(200);
  });
  it('sets a 24-hour KV cache TTL without relying on it for durable correctness', async () => {
    const { env } = fixture();
    const put = vi.spyOn(env.AUTH_KV, 'put');
    expect((await createOrder(request({}, 'ttl'), env)).status).toBe(201);
    expect(put.mock.calls.some(([key, , options]) => String(key).startsWith('order:idempotency:v2:') && options?.expirationTtl === 86400)).toBe(true);
  });
});
