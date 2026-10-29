import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv, staffSessionClaims } from '../test-utils';
import { Hono } from 'hono';
import { customersRouter } from '../../routes/customers';
import {
  getAdminCustomers,
  createAdminCustomer,
  updateAdminCustomer,
  deleteAdminCustomer,
} from '../../routes/admin-handlers';

function makeDB(): ReturnType<typeof createMockDB> {
  return createMockDB([{ id: 'm1', name: 'Manager', role: 'manager', tenant_id: 'default', is_active: 1, auth_version: 1 }, { id: 'a1', name: 'Admin', role: 'admin', tenant_id: 'default', is_active: 1, auth_version: 1 }]);
}

describe('customers smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET / — returns 200 with empty list for authenticated staff and 401 when unauthenticated', async() => {
    const app = new Hono();
    app.route('/api/customers', customersRouter);

    const secret = 'test-jwt-secret-at-least-16-chars';
    const env = { ...createMockEnv(), AURA_DB: makeDB(), JWT_SECRET: secret };

    const unauthReq = new Request('https://test.aura/api/customers', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const unauthRes = await app.fetch(unauthReq, env);
    expect(unauthRes.status).toBe(401);

    const { generateJWT } = await import('../../lib/jwt');
    const managerToken = await generateJWT({ id: 'm1', role: 'manager', email: 'm@test.aura', ...staffSessionClaims() } as any, secret, 28800);
    const req = new Request('https://test.aura/api/customers', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${managerToken}` }
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
  });

  it('GET /segments — missing auth returns 401', async() => {
    const app = new Hono();
    app.route('/api/customers', customersRouter);

    const req = new Request('https://test.aura/api/customers/segments', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB(), JWT_SECRET: 'test-jwt-secret-at-least-16-chars' };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(401);
  });

  it('GET / — enforces staff/manager/owner auth in production environment', async() => {
    const app = new Hono();
    app.route('/api/customers', customersRouter);

    const prodEnv = {
      ...createMockEnv(),
      ENVIRONMENT: 'production',
      AURA_DB: makeDB(),
      JWT_SECRET: 'test-jwt-secret-at-least-16-chars'
    };

    const unauthReq = new Request('https://test.aura/api/customers', { method: 'GET' });
    const unauthRes = await app.fetch(unauthReq, prodEnv);
    expect(unauthRes.status).toBe(401);

    const { generateJWT } = await import('../../lib/jwt');
    const customerToken = await generateJWT({ id: 'c1', role: 'customer', email: 'c@test.aura' } as any, prodEnv.JWT_SECRET);
    const customerReq = new Request('https://test.aura/api/customers', {
      method: 'GET',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const customerRes = await app.fetch(customerReq, prodEnv);
    expect(customerRes.status).toBe(403);

    const managerToken = await generateJWT({ id: 'm1', role: 'manager', email: 'm@test.aura', ...staffSessionClaims() } as any, prodEnv.JWT_SECRET, 28800);
    const managerReq = new Request('https://test.aura/api/customers', {
      method: 'GET',
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const managerRes = await app.fetch(managerReq, prodEnv);
    expect(managerRes.status).toBe(200);
  });

  it('GET /segments — sanitizes internal D1 errors on HTTP 500', async() => {
    const app = new Hono();
    app.route('/api/customers', customersRouter);
    const db = makeDB();
    const original = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => /FROM users WHERE id/i.test(sql) ? original(sql) : ({
      bind: () => ({ first: () => Promise.reject(new Error('SQLITE_ERROR: no such column secret_col')) }),
      first: () => Promise.reject(new Error('SQLITE_ERROR: no such column secret_col'))
    } as any));

    const { generateJWT } = await import('../../lib/jwt');
    const secret = 'test-jwt-secret-at-least-16-chars';
    const token = await generateJWT({ id: 'm1', role: 'manager', email: 'm@test.aura', ...staffSessionClaims() } as any, secret, 28800);
    const req = new Request('https://test.aura/api/customers/segments', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });

    const res = await app.fetch(req, { ...createMockEnv(), AURA_DB: db, JWT_SECRET: secret });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('SQLITE_ERROR');
    expect(text).not.toContain('secret_col');
  });

  it('GET / — allows admin role and filters loyalty_tier case-insensitively', async() => {
    const app = new Hono();
    app.route('/api/customers', customersRouter);
    const db = makeDB();
    const prepareSpy = vi.spyOn(db, 'prepare');
    const { generateJWT } = await import('../../lib/jwt');
    const secret = 'test-jwt-secret-at-least-16-chars';
    const adminToken = await generateJWT({ id: 'a1', role: 'admin', email: 'a@test.aura', ...staffSessionClaims() } as any, secret, 28800);

    const req = new Request('https://test.aura/api/customers?tier=gold&search=090', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const res = await app.fetch(req, { ...createMockEnv(), ENVIRONMENT: 'production', AURA_DB: db, JWT_SECRET: secret });
    expect(res.status).toBe(200);
    const sqlCalls = prepareSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(sqlCalls.some((s: string) => s.includes('LOWER(c.loyalty_tier) = LOWER(?)'))).toBe(true);
  });

  it('admin-handlers CRUD — supports canonical D1 loyalty_tier schema and non-null fallback email', async() => {
    const db = makeDB();
    db.prepare = vi.fn((sql: string) => ({
      bind: (..._args: unknown[]) => ({
        all: async() => ({
          results: [
            {
              id: 'c_1',
              name: 'Le Thi Hoa',
              phone: '0946013633',
              email: '0946013633@loyalty.aura',
              loyalty_tier: 'gold',
              cashback_balance: 25000,
              total_spent: 500000,
              visit_count: 4,
              created_at: '2026-10-17T00:00:00Z'
            }
          ]
        }),
        first: async() => ({ total: 1 }),
        run: async() => {
          if (sql.includes('INSERT INTO customers') && !sql.includes('loyalty_tier')) {
            throw new Error('D1_ERROR: table customers has no column named tier');
          }
          return { success: true };
        }
      })
    })) as any;

    const env = { AURA_DB: db };

    // 1. List customers
    const listRes = await getAdminCustomers(new Request('https://test.aura/api/admin/customers?tier=gold'), env);
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json() as any;
    expect(listJson.customers[0]).toMatchObject({
      id: 'c_1',
      tier: 'gold',
      loyalty_tier: 'gold',
      totalOrders: 4,
      totalSpent: 500000
    });

    // 2. Create customer without email (generates @loyalty.aura fallback for D1 NOT NULL constraint)
    const createRes = await createAdminCustomer(
      new Request('https://test.aura/api/admin/customers', {
        method: 'POST',
        body: JSON.stringify({ name: 'Tran Van B', phone: '0909 111 222', tier: 'Platinum' })
      }),
      env
    );
    expect(createRes.status).toBe(201);
    const createJson = await createRes.json() as any;
    expect(createJson.customer.email).toBe('0909111222@loyalty.aura');
    expect(createJson.customer.tier).toBe('platinum');
    expect(createJson.customer.loyalty_tier).toBe('platinum');

    // 3. Update customer tier
    const updateRes = await updateAdminCustomer(
      new Request('https://test.aura/api/admin/customers/c_1', {
        method: 'PATCH',
        body: JSON.stringify({ tier: 'silver', name: 'Le Thi Hoa Updated' })
      }),
      env,
      'c_1'
    );
    expect(updateRes.status).toBe(200);

    // 4. Delete customer
    const deleteRes = await deleteAdminCustomer(env, 'c_1');
    expect(deleteRes.status).toBe(200);
  });
});
