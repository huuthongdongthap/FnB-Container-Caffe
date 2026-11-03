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

  it('Phase Z1-Z4 — enforces catalog handler tenant resolution, AI barista & assistant pilot store fallback, customer TRIM(tenant_id), and signage canonical filtering', async() => {
    const { getCustomerMenuHandler, getMenuItemHandler } = await import('../../routes/catalog-handlers/handlers');
    const { aiBaristaRouter } = await import('../../routes/ai-barista');
    const { customerAssistantRouter } = await import('../../routes/customer-assistant');
    const { signageRouter } = await import('../../routes/signage');

    // Z1: catalog-handlers resolve PILOT_TENANT_ID and filter out foreign tenant products
    const catalogDb = createMockDB();
    catalogDb.prepare = vi.fn(() => ({
      bind: (...args: unknown[]) => ({
        all: async() => ({
          results: args[0] === 'p_other'
            ? [{ id: 'p_other', name: 'Trà Sữa Chi Nhánh Khác', price: 45000, category_id: 'cat_1', category_name: 'Cà Phê', is_available: 1, tenant_id: 'tenant_other' }]
            : [
                { id: 'p_sadec', name: 'Bạc Xỉu Sa Đéc', price: 32000, category_id: 'cat_1', category_name: 'Cà Phê', is_available: 1, tenant_id: '  tenant_sadec_02  ' },
                { id: 'p_other', name: 'Trà Sữa Chi Nhánh Khác', price: 45000, category_id: 'cat_1', category_name: 'Cà Phê', is_available: 1, tenant_id: 'tenant_other' }
              ]
        })
      }),
      all: async() => ({ results: [] })
    })) as any;

    const catalogApp = new Hono<{ Bindings: any }>();
    catalogApp.get('/api/catalog/menu', getCustomerMenuHandler);
    catalogApp.get('/api/catalog/menu/:id', getMenuItemHandler);

    const catalogMenuRes = await catalogApp.fetch(
      new Request('https://test.aura/api/catalog/menu'),
      { ...createMockEnv(), PILOT_TENANT_ID: 'tenant_sadec_02', AURA_DB: catalogDb }
    );
    expect(catalogMenuRes.status).toBe(200);
    const catalogMenuJson = await catalogMenuRes.json() as any;
    expect(catalogMenuJson.data.totalItems).toBe(1);
    expect(catalogMenuJson.data.categories[0].items[0].id).toBe('p_sadec');

    const catalogItemRes = await catalogApp.fetch(
      new Request('https://test.aura/api/catalog/menu/p_other'),
      { ...createMockEnv(), PILOT_TENANT_ID: 'tenant_sadec_02', AURA_DB: catalogDb }
    );
    expect(catalogItemRes.status).toBe(404);

    // Z2: ai-barista & customer-assistant resolve PILOT_TENANT_ID on unauthenticated guest calls
    const boundArgs: unknown[][] = [];
    const assistantDb = createMockDB();
    assistantDb.prepare = vi.fn(() => ({
      bind: (...args: unknown[]) => {
        boundArgs.push(args);
        return {
          all: async() => ({
            results: [
              { id: 'p_sadec', name: 'Cà Phê Muối', price: 35000, category_name: 'Signature', is_available: 1, tenant_id: 'tenant_sadec_02' }
            ]
          }),
          first: async() => null,
          run: async() => ({ success: true })
        };
      }
    })) as any;

    const assistantApp = new Hono<{ Bindings: any }>();
    assistantApp.route('/api/barista', aiBaristaRouter);
    assistantApp.route('/api/assistant', customerAssistantRouter);

    const baristaRes = await assistantApp.fetch(
      new Request('https://test.aura/api/barista/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: 'tired', weather: 'hot' })
      }),
      { ...createMockEnv(), PILOT_TENANT_ID: 'tenant_sadec_02', AURA_DB: assistantDb }
    );
    expect(baristaRes.status).toBe(200);
    expect(boundArgs.some((args) => args.includes('tenant_sadec_02'))).toBe(true);

    boundArgs.length = 0;
    const chatRes = await assistantApp.fetch(
      new Request('https://test.aura/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Cho mình xem menu quán' })
      }),
      { ...createMockEnv(), PILOT_TENANT_ID: 'tenant_sadec_02', AURA_DB: assistantDb }
    );
    expect(chatRes.status).toBe(200);
    expect(boundArgs.some((args) => args.includes('tenant_sadec_02'))).toBe(true);

    // Z3: getAdminCustomers normalizes TRIM(c.tenant_id) and filters out foreign rows
    const adminSqls: string[] = [];
    const adminDb = createMockDB();
    adminDb.prepare = vi.fn((sql: string) => {
      adminSqls.push(sql);
      return {
        bind: () => ({
          all: async() => ({
            results: [
              { id: 'c_sadec', name: 'Khách Sa Đéc', phone: '0901112222', email: 'sadec@loyalty.aura', loyalty_tier: 'gold', tenant_id: '  tenant_sadec_02  ' },
              { id: 'c_other', name: 'Khách Khác', phone: '0909998888', email: 'other@loyalty.aura', loyalty_tier: 'silver', tenant_id: 'tenant_other' }
            ]
          }),
          first: async() => ({ total: 1 })
        })
      };
    }) as any;

    const adminListRes = await getAdminCustomers(
      new Request('https://test.aura/api/admin/customers'),
      { AURA_DB: adminDb, PILOT_TENANT_ID: 'tenant_sadec_02' }
    );
    expect(adminListRes.status).toBe(200);
    const adminListJson = await adminListRes.json() as any;
    expect(adminListJson.customers.map((c: { id: string }) => c.id)).toEqual(['c_sadec']);
    expect(adminSqls.some((s) => s.includes('TRIM(c.tenant_id)') && s.includes('TRIM(cw.tenant_id)'))).toBe(true);

    // Z4: signageRouter filters cross-tenant products and categories using canonical matchesTenantRow
    const signageDb = createMockDB();
    signageDb.prepare = vi.fn(() => ({
      all: async() => ({
        results: [
          {
            product_name: 'Cà Phê Sữa Đá',
            price: 29000,
            image_url: null,
            description: 'Đậm vị',
            category_id: 1,
            category_name: 'Cà Phê',
            category_sort_order: 1,
            tenant_id: '  tenant_sadec_02  '
          },
          {
            product_name: 'Món Chi Nhánh Khác',
            price: 39000,
            image_url: null,
            description: 'Khác',
            category_id: 2,
            category_name: 'Khác',
            category_sort_order: 2,
            tenant_id: 'tenant_other'
          }
        ]
      })
    })) as any;

    const signageApp = new Hono<{ Bindings: any }>();
    signageApp.route('/api/signage', signageRouter);
    const signageRes = await signageApp.fetch(
      new Request('https://test.aura/api/signage/menu'),
      { ...createMockEnv(), PILOT_TENANT_ID: 'tenant_sadec_02', AURA_DB: signageDb }
    );
    expect(signageRes.status).toBe(200);
    const signageJson = await signageRes.json() as any;
    expect(signageJson.data).toHaveLength(1);
    expect(signageJson.data[0].products[0].name).toBe('Cà Phê Sữa Đá');
  });
});
