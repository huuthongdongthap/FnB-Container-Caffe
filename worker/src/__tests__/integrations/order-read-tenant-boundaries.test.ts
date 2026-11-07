// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { orderCreationFixture } from './order-creation-fixture';

const fixtures: ReturnType<typeof orderCreationFixture>[] = [];
/**
 * The session gate compares the account row's role against the token's role
 * claim and revokes any session where they diverge, so each row is written with
 * the role the request signs — a stale row reads as a role change, not "no data".
 */
const fixture = (role: string) => {
  const value = orderCreationFixture();
  fixtures.push(value);
  value.sqlite.prepare(`INSERT INTO users (id,name,phone,role,tenant_id,is_active,auth_version)
    VALUES ('local-staff','Local Staff',NULL,?,'cafe-a',1,1)`).run(role);
  return value;
};
afterEach(() => { for (const { sqlite } of fixtures.splice(0)) sqlite.close(); });
function seed(sqlite: ReturnType<typeof orderCreationFixture>['sqlite']) {
  sqlite.exec(`INSERT INTO orders (id,items,total,status,customer_name,customer_phone,payment_method,table_id,tenant_id) VALUES
    ('order-a','[]',20000,'pending','A customer','0900000010','cod','table-a','cafe-a'),
    ('order-b','[]',90000,'pending','PRIVATE B CUSTOMER','0999999999','cod','table-b','cafe-b');`);
}
async function get(env: any, path: string, tenantId = 'cafe-a', role = 'waiter') {
  const token = await generateJWT({ id: 'local-staff', role, tenantId,
    authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' }, 'test-jwt-secret-at-least-16-chars', 28800);
  return app.fetch(new Request(`https://test.aura${path}`, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': 'cafe-b' } }), env);
}

describe('All staff order read aliases enforce signed tenant confinement', () => {
  it.each(['/mobile/orders', '/api/orders'])('scopes list %s despite client tenant injection', async path => {
    const { env, sqlite } = fixture('waiter'); seed(sqlite);
    const response = await get(env, `${path}?tenant_id=cafe-b`);
    expect(response.status).toBe(200);
    const content = JSON.stringify(await response.json());
    expect(content).toContain('order-a');
    expect(content).not.toContain('order-b');
    expect(content).not.toContain('PRIVATE B CUSTOMER');
  });

  it.each(['/mobile/orders', '/api/orders'])('denies foreign detail %s but allows own store', async path => {
    const { env, sqlite } = fixture('waiter'); seed(sqlite);
    const denied = await get(env, `${path}/order-b?tenant_id=cafe-b`);
    expect(denied.status).toBe(404);
    expect(await denied.text()).not.toContain('PRIVATE B CUSTOMER');
    expect((await get(env, `${path}/order-a`)).status).toBe(200);
  });

  it('scopes summary revenue and permits an explicit HQ global view', async () => {
    const { env, sqlite } = fixture('manager'); seed(sqlite);
    const summary = await get(env, '/api/orders/summary', 'cafe-a', 'manager');
    expect(summary.status).toBe(200);
    const data = (await summary.json() as any).data;
    expect(data).toMatchObject({ totalOrders: 1, totalRevenue: 20000 });
    // The global view is signed by an HQ owner, so both the account row and the
    // tenant binding follow it: the session gate compares the row's role to the
    // token live, and only an HQ tenant may carry the '*' cross-tenant override.
    sqlite.prepare(`UPDATE users SET role = 'owner', tenant_id = 'hq' WHERE id = 'local-staff'`).run();
    const global = await get(env, '/api/orders?tenant_id=*', 'hq', 'owner');
    expect(global.status).toBe(200);
    const content = JSON.stringify(await global.json());
    expect(content).toContain('order-a'); expect(content).toContain('order-b');
  });

  it('paginates and searches /api/admin/orders within the signed tenant', async () => {
    const { env, sqlite } = fixture('manager');
    sqlite.exec(`INSERT INTO orders (id,items,total,status,customer_name,customer_phone,payment_method,table_id,tenant_id,created_at) VALUES
      ('ord-a-1','[]',20000,'pending','Alpha One','0900000001','cod','table-a','cafe-a','2026-10-01T10:00:00Z'),
      ('ord-a-2','[]',30000,'preparing','Beta Two','0900000002','cod','table-a','cafe-a','2026-10-01T10:05:00Z'),
      ('ord-a-3','[]',40000,'ready','Gamma Three','0900000003','cod','table-a','cafe-a','2026-10-01T10:10:00Z'),
      ('ord-b-1','[]',90000,'pending','Alpha Foreign','0900000099','cod','table-b','cafe-b','2026-10-01T10:15:00Z');`);

    const page2Res = await get(env, '/api/admin/orders?page=2&pageSize=2', 'cafe-a', 'manager');
    expect(page2Res.status).toBe(200);
    const page2Body = await page2Res.json() as any;
    expect(page2Body.pagination).toMatchObject({
      total: 3,
      limit: 2,
      offset: 2,
      page: 2,
      pageSize: 2,
    });
    expect(page2Body.orders.map((o: any) => o.id)).toEqual(['ord-a-1']);

    const searchRes = await get(env, '/api/admin/orders?search=Alpha', 'cafe-a', 'manager');
    expect(searchRes.status).toBe(200);
    const searchBody = await searchRes.json() as any;
    expect(searchBody.pagination.total).toBe(1);
    expect(searchBody.orders.map((o: any) => o.id)).toEqual(['ord-a-1']);
  });
});
