// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { orderCreationFixture } from './order-creation-fixture';

const fixtures: ReturnType<typeof orderCreationFixture>[] = [];
// The request-time session gate reads the account row behind each staff token,
// so the row's role and tenant have to match what `token` signs below: a
// divergent row reads as a role change and the session is revoked.
const fixture = (tenantId = 'cafe-a', id = 'staff-a') => {
  const value = orderCreationFixture();
  fixtures.push(value);
  value.sqlite.prepare(`INSERT INTO users (id,name,phone,role,tenant_id,is_active,auth_version)
    VALUES (?, 'Staff A', NULL, 'waiter', ?, 1, 1)`).run(id, tenantId);
  return value;
};
afterEach(() => { for (const { sqlite } of fixtures.splice(0)) sqlite.close(); });
const payload = {
  customer_name: 'Local checkout', customer_phone: '0900000010', total: 1000,
  payment_method: 'payos', order_type: 'takeaway',
  items: [{ product_id: 'coffee', name: 'Coffee', quantity: 1, price: 1000 }],
};
/**
 * Mints a signed staff token and guarantees its account row exists.
 *
 * The session gate reads the row behind the token on every request, so the row
 * is written here rather than at fixture setup: a caller can sign any tenant or
 * actor id and the account behind it will match the claims exactly.
 */
const token = async (tenantId: string, id = 'staff-a', sqlite?: { prepare: (sql: string) => { run: (...a: unknown[]) => unknown } }) => {
  sqlite?.prepare(`INSERT OR IGNORE INTO users (id,name,phone,role,tenant_id,is_active,auth_version)
    VALUES (?, 'Staff A', NULL, 'waiter', ?, 1, 1)`).run(id, tenantId);
  return generateJWT({ id, role: 'waiter', tenantId , authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web'}, 'test-jwt-secret-at-least-16-chars', 28800);
};
async function send(env: any, path: string, body: unknown, auth?: string, extra: Record<string, string> = {}) {
  return app.fetch(new Request(`https://test.aura${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...extra },
    body: JSON.stringify(body),
  }), env);
}

describe('Order creation financial and tenant boundaries (real local SQLite)', () => {
  it('discards client price, discount and service fee; uses existing server delivery policy', async () => {
    const { env, sqlite } = fixture();
    const response = await send(env, '/api/orders', { ...payload, discount: 19000, service_fee: 2000 });
    expect(response.status).toBe(201);
    const { data } = await response.json() as any;
    expect(data.total).toBe(20000);
    expect(data.discount).toBe(0);
    expect(sqlite.prepare('SELECT total,discount,service_fee FROM orders WHERE id=?').get(data.id))
      .toMatchObject({ total: 20000, discount: 0, service_fee: 0 });
    const delivery = await send(env, '/api/orders', { ...payload, order_type: 'delivery', customer_address: 'Sa Dec', shipping_fee: 0 });
    expect((await delivery.json() as any).data).toMatchObject({ total: 35000, shipping_fee: 15000 });
    const free = await send(env, '/api/orders', { ...payload, order_type: 'delivery', customer_address: 'Sa Dec',
      shipping_fee: 999999, items: [{ ...payload.items[0], quantity: 2 }] });
    expect((await free.json() as any).data).toMatchObject({ total: 40000, shipping_fee: 0 });
  });

  it.each(['/api/orders/guest-checkout', '/api/orders/checkout', '/mobile/orders'])('prices %s from the catalog', async path => {
    const { env, sqlite } = fixture();
    const auth = path.includes('guest-') ? undefined : await token('cafe-a', 'staff-a', sqlite);
    const response = await send(env, path, { ...payload, fulfillment_type: 'TAKEAWAY',
      ...(path === '/mobile/orders' ? { table_id: 'table-a' } : {}) }, auth);
    expect(response.status).toBe(201);
    const body = await response.json() as any;
    const id = body.order_id || body.data?.id;
    expect(sqlite.prepare('SELECT total,tenant_id FROM orders WHERE id=?').get(id))
      .toMatchObject({ total: 20000, tenant_id: auth ? 'cafe-a' : 'default' });
  });

  it('binds staff to signed cafe-a and guests to default despite body/header/query injection', async () => {
    const { env, sqlite } = fixture();
    for (const auth of [undefined, await token('cafe-a', 'staff-a', sqlite)]) {
      const response = await send(env, '/api/orders?tenant_id=cafe-b', { ...payload, tenant_id: 'cafe-b' }, auth, { 'x-tenant-id': 'cafe-b' });
      expect(response.status).toBe(201);
      const { data } = await response.json() as any;
      expect(sqlite.prepare('SELECT tenant_id FROM orders WHERE id=?').get(data.id))
        .toMatchObject({ tenant_id: auth ? 'cafe-a' : 'default' });
    }
  });

  it.each(['/api/orders', '/api/orders/guest-checkout', '/api/orders/checkout', '/mobile/orders'])('rejects foreign tables at %s without writing', async path => {
    const { env, sqlite } = fixture();
    const response = await send(env, path, { ...payload, order_type: 'dine_in', table_id: 'table-b' },
      path.includes('guest-') ? undefined : await token('cafe-a', 'staff-a', sqlite));
    expect([400, 403, 404]).toContain(response.status);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get()).toMatchObject({ count: 0 });
    expect(sqlite.prepare('SELECT status FROM cafe_tables WHERE id=?').get('table-b')).toMatchObject({ status: 'Available' });
  });

  it('never resolves unknown explicit IDs using a cheaper prefix or client name', async () => {
    const { env, sqlite } = fixture();
    for (const item of [{ product_id: 'coffee-premium', name: 'Coffee', price: 1000 }, { name: 'Coffee', price: 1000 }]) {
      const response = await send(env, '/api/orders', { ...payload, items: [item] });
      expect(response.status).toBe(400);
    }
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get()).toMatchObject({ count: 0 });
  });

  it.each(['/api/orders', '/api/orders/sync'])('scopes idempotency by tenant and actor at %s and rejects changed payloads', async path => {
    const { env, sqlite } = fixture();
    const headers = { 'Idempotency-Key': 'same-offline-key' };
    const a = await token('cafe-a', 'staff-a', sqlite);
    const first = await send(env, path, payload, a, headers);
    const replay = await send(env, path, payload, a, headers);
    const otherTenant = await send(env, path, payload, await token('cafe-b', 'staff-b', sqlite), headers);
    const otherActor = await send(env, path, payload, await token('cafe-a', 'another-staff', sqlite), headers);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.headers.get('X-Cache')).toBe('HIT');
    expect(otherTenant.status).toBe(201);
    expect(otherActor.status).toBe(201);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get()).toMatchObject({ count: 3 });
    const changed = await send(env, path, { ...payload, customer_name: 'different order' }, a, headers);
    expect(changed.status).toBe(409);
  });

  it('ignores legacy global idempotency cache and rejects a revoked signed session', async () => {
    const { env, sqlite } = fixture();
    await env.AUTH_KV.put('order:idempotency:legacy', JSON.stringify({ data: { id: 'foreign-order', total: 1 } }));
    const response = await send(env, '/api/orders', payload, undefined, { 'Idempotency-Key': 'legacy' });
    expect(response.status).toBe(201);
    const auth = await token('cafe-a', 'staff-a', sqlite);
    await env.AUTH_KV.put(`revoked:${auth}`, '1');
    const denied = await send(env, '/api/orders', payload, auth);
    expect(denied.status).toBe(401);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get()).toMatchObject({ count: 1 });
  });
});
