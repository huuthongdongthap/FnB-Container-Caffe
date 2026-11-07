import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { sendCashbackExpiryWarnings } from '../../routes/cron-handlers/cashback-warnings';
import { checkOverdueOrders, checkInventoryAlerts } from '../../routes/cron-handlers/order-checks';
import { registerCronAdminRoutes } from '../../routes/cron-admin';
import { registerJobCrudHandlers } from '../../routes/openapi-cron-handlers/job-crud-handlers';
import { registerRunHandlers } from '../../routes/openapi-cron-handlers/run-handlers';
import { registerSummaryHandlers } from '../../routes/openapi-cron-handlers/summary-handlers';
import { registerCheckoutHandlers } from '../../routes/dindin-handlers/checkout-handlers';
import { registerConfigHandlers } from '../../routes/dindin-handlers/config-handlers';
import { sopScope, SopAccessError } from '@aura/domain-sop';
import { mockStaffToken, isStaffAccountLookup } from '../test-utils';

vi.mock('../../routes/zalo', () => ({
  sendZNS: vi.fn(async () => ({ ok: true, sent: true })),
  notifyMember: vi.fn(async () => ({ ok: true })),
}));

const TEST_JWT_SECRET = 'phase51-ax4-jwt-secret-key-minimum-32-chars!!';

function createKvMock(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
  } as unknown as KVNamespace;
}

describe('Phase 51 Slice AX4 — Cron Jobs/Runs, Cashback/Inventory Background Workers, SOP Scope & DinDin Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Cron Background Workers & Cron Admin Cross-Tenant Isolation', () => {
    it('blocks unscoped fallback and row-without-tenant_id leak in sendCashbackExpiryWarnings when tenantId !== default', async () => {
      const executedSql: string[] = [];
      const db = {
        prepare: (sql: string) => {
          executedSql.push(sql);
          const isScopedSelect = sql.includes('FROM customers c') && sql.includes('c.tenant_id');
          return {
            bind: (..._args: unknown[]) => ({
              all: async () => {
                if (isScopedSelect) {
                  throw new Error('no such column: c.tenant_id');
                }
                return {
                  results: [
                    { id: 1, name: 'Default Cust', phone: '0901111111', cashback_balance: 25000 },
                  ],
                };
              },
              run: async () => ({ success: true, meta: { changes: 1 } }),
            }),
            all: async () => ({
              results: [
                { id: 1, name: 'Default Cust', phone: '0901111111', cashback_balance: 25000 },
              ],
            }),
          };
        },
      };

      const nonDefaultRes = await sendCashbackExpiryWarnings(
        { AURA_DB: db },
        'tenant_b'
      );
      expect(nonDefaultRes).toEqual({ notified: 0 });
      expect(
        executedSql.some((s) => s.includes('FROM customers c') && !s.includes('tenant_id'))
      ).toBe(false);

      // Even if a scoped query returns a row missing tenant_id, matchesTenantRow rejects it for non-default tenant
      const dbReturningUnscopedRow = {
        prepare: (sql: string) => ({
          bind: (..._args: unknown[]) => ({
            all: async () => ({
              results: sql.includes('FROM cashback_transactions')
                ? [
                    { customer_id: '2', name: 'Missing Tenant Cust', phone: '0902222222', total_expiring: 30000 },
                    { customer_id: '3', name: 'Tenant B Cust', phone: '0903333333', total_expiring: 40000, tenant_id: 'tenant_b' },
                  ]
                : [],
            }),
            run: async () => ({ success: true, meta: { changes: 1 } }),
          }),
        }),
      };

      const filteredRes = await sendCashbackExpiryWarnings(
        { AURA_DB: dbReturningUnscopedRow },
        'tenant_b'
      );
      expect(filteredRes).toEqual({ notified: 1 });
    });

    it('blocks unscoped fallback and row-without-tenant_id leak in checkOverdueOrders and checkInventoryAlerts when tenantId !== default', async () => {
      const executedSql: string[] = [];
      const throwingScopedDb = {
        prepare: (sql: string) => {
          executedSql.push(sql);
          return {
            bind: (..._args: unknown[]) => ({
              all: async () => {
                if (sql.includes('tenant_id')) {
                  throw new Error('no such column: tenant_id');
                }
                return {
                  results: [
                    { id: 'ORD_LEAK', customer_name: 'Alice', total: 50000, status: 'pending', created_at: '2026-11-03T00:00:00Z' },
                  ],
                };
              },
            }),
            all: async () => ({
              results: [
                { id: 'INV_LEAK', name: 'Beans', current_stock: 1, min_stock: 10, unit: 'kg' },
              ],
            }),
          };
        },
      };

      await checkOverdueOrders({ AURA_DB: throwingScopedDb }, 'tenant_b');
      await checkInventoryAlerts({ AURA_DB: throwingScopedDb }, 'tenant_b');

      expect(
        executedSql.some((s) => !s.includes('tenant_id'))
      ).toBe(false);
    });

    it('rejects cross-tenant X-Tenant-ID / ?tenant_id overrides from non-HQ callers in cron-admin routes with 403', async () => {
      const app = new Hono<{ Bindings: Env }>();
      registerCronAdminRoutes(app);

      const managerTokenTenantA = await mockStaffToken(
        { id: 'mgr-a', role: 'manager', tenantId: 'tenant_a' },
        TEST_JWT_SECRET
      );
      const ownerTokenTenantA = await mockStaffToken(
        { id: 'own-a', role: 'owner', tenantId: 'tenant_a' },
        TEST_JWT_SECRET
      );
      const hqOwnerToken = await mockStaffToken(
        { id: 'own-hq', role: 'owner', tenantId: 'default' },
        TEST_JWT_SECRET
      );

      const staffRows: Record<string, Record<string, unknown>> = {
        'mgr-a': { id: 'mgr-a', name: 'Mgr A', role: 'manager', tenant_id: 'tenant_a', is_active: 1, auth_version: 1 },
        'own-a': { id: 'own-a', name: 'Own A', role: 'owner', tenant_id: 'tenant_a', is_active: 1, auth_version: 1 },
        'own-hq': { id: 'own-hq', name: 'Own HQ', role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 },
      };

      const env = {
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: {
          prepare: (sql: string) => ({
            bind: (...args: unknown[]) => ({
              first: async () => {
                if (isStaffAccountLookup(sql)) {
                  return staffRows[String(args[0])] ?? null;
                }
                const orderId = args[0];
                if (orderId === 'ORD_B') {
                  return { id: 'ORD_B', items: '[]', total: 45000, tenant_id: 'tenant_b' };
                }
                return null;
              },
              all: async () => ({ results: [] }),
              run: async () => ({ success: true, meta: { changes: 1 } }),
            }),
          }),
        },
      } as unknown as Env;

      // Store-bound owner on tenant_a trying to override X-Tenant-ID: tenant_b on telegram-sim -> 403
      const tgSimSpoofRes = await app.request(
        'http://localhost/api/test/telegram-sim',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ownerTokenTenantA}`,
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'tenant_b',
          },
          body: JSON.stringify({ order_id: 'ORD_B' }),
        },
        env
      );
      expect(tgSimSpoofRes.status).toBe(403);

      // Store-bound owner on tenant_a trying to override ?tenant_id=tenant_b on zalo-zns -> 403
      const znsSpoofRes = await app.request(
        'http://localhost/api/test/zalo-zns?tenant_id=tenant_b',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ownerTokenTenantA}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phone: '0901234567', template: 'cashback_earned' }),
        },
        env
      );
      expect(znsSpoofRes.status).toBe(403);

      // Store-bound manager on tenant_a trying to override X-Tenant-ID: tenant_b on send-expiry-warnings -> 403
      const expirySpoofRes = await app.request(
        'http://localhost/api/admin/zalo/send-expiry-warnings',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${managerTokenTenantA}`,
            'X-Tenant-ID': 'tenant_b',
          },
        },
        env
      );
      expect(expirySpoofRes.status).toBe(403);

      // HQ owner can target tenant_b on telegram-sim -> 200
      const hqSimRes = await app.request(
        'http://localhost/api/test/telegram-sim',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hqOwnerToken}`,
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'tenant_b',
          },
          body: JSON.stringify({ order_id: 'ORD_B' }),
        },
        env
      );
      expect(hqSimRes.status).toBe(200);
    });
  });

  describe('2. OpenAPI Cron Jobs, Runs & Summary Tenant Isolation', () => {
    it('rejects cross-tenant header/query overrides with 403 across job CRUD, run handlers, and summary', async () => {
      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'tenant_a' } as never);
        await next();
      });
      registerJobCrudHandlers(app);
      registerRunHandlers(app);
      registerSummaryHandlers(app);

      const env = {
        AURA_DB: {
          prepare: () => ({
            bind: () => ({
              first: async () => null,
              all: async () => ({ results: [] }),
              run: async () => ({ success: true, meta: { changes: 0 } }),
            }),
          }),
        },
      } as unknown as Env;

      const jobId = '11111111-1111-4111-8111-111111111111';
      const listRes = await app.request(
        'http://localhost/api/cron/jobs?tenant_id=tenant_b',
        { method: 'GET' },
        env
      );
      expect(listRes.status).toBe(403);

      const getRes = await app.request(
        `http://localhost/api/cron/jobs/${jobId}`,
        { method: 'GET', headers: { 'X-Tenant-ID': 'tenant_b' } },
        env
      );
      expect(getRes.status).toBe(403);

      const triggerRes = await app.request(
        `http://localhost/api/cron/jobs/${jobId}/trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_b' },
          body: JSON.stringify({}),
        },
        env
      );
      expect(triggerRes.status).toBe(403);

      const runsListRes = await app.request(
        `http://localhost/api/cron/jobs/${jobId}/runs`,
        { method: 'GET', headers: { 'X-Tenant-ID': 'tenant_b' } },
        env
      );
      expect(runsListRes.status).toBe(403);

      const summaryRes = await app.request(
        'http://localhost/api/cron/summary?tenant_id=tenant_b',
        { method: 'GET' },
        env
      );
      expect(summaryRes.status).toBe(403);
    });

    it('does not execute unscoped cron_runs fallback in GET /api/cron/jobs/:id/runs or GET /api/cron/summary when tenantId !== default', async () => {
      const executedSql: string[] = [];
      const jobBId = '22222222-2222-4222-8222-222222222222';
      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-b', role: 'manager', tenantId: 'tenant_b' } as never);
        c.set('tenantId' as never, 'tenant_b' as never);
        await next();
      });
      registerRunHandlers(app);
      registerSummaryHandlers(app);

      const env = {
        AURA_DB: {
          prepare: (sql: string) => {
            executedSql.push(sql);
            return {
              bind: (..._args: unknown[]) => ({
                first: async () => {
                  if (sql.includes('SELECT * FROM cron_jobs WHERE id = ?')) {
                    return { id: jobBId, name: 'Job B', tenant_id: 'tenant_b', is_active: 1 };
                  }
                  if (sql.includes('SELECT COUNT(*) as total FROM cron_runs') && sql.includes('tenant_id')) {
                    return { total: 0 };
                  }
                  // If unscoped count were called, it would return foreign runs
                  if (sql.includes('SELECT COUNT(*) as total FROM cron_runs')) {
                    return { total: 5 };
                  }
                  return null;
                },
                all: async () => {
                  if (sql.includes('FROM cron_jobs') && sql.includes('tenant_id')) {
                    return {
                      results: [{ id: jobBId, name: 'Job B', tenant_id: 'tenant_b', is_active: 1, status: 'idle' }],
                    };
                  }
                  if (sql.includes('FROM cron_runs') && sql.includes('tenant_id')) {
                    return { results: [] };
                  }
                  // Unscoped fallback would leak foreign tenant_a runs if executed
                  if (sql.includes('FROM cron_runs')) {
                    return {
                      results: [
                        {
                          id: 'run-leak-a',
                          job_id: jobBId,
                          status: 'failed',
                          error: 'secret-a',
                          tenant_id: 'tenant_a',
                          started_at: '2026-11-03T10:00:00Z',
                        },
                      ],
                    };
                  }
                  return { results: [] };
                },
              }),
            };
          },
        },
      } as unknown as Env;

      const runsRes = await app.request(`http://localhost/api/cron/jobs/${jobBId}/runs`, { method: 'GET' }, env);
      expect(runsRes.status).toBe(200);
      const runsBody = (await runsRes.json()) as { data: { runs: unknown[]; meta: { total: number } } };
      expect(runsBody.data.runs).toEqual([]);
      expect(runsBody.data.meta.total).toBe(0);

      const summaryRes = await app.request('http://localhost/api/cron/summary', { method: 'GET' }, env);
      expect(summaryRes.status).toBe(200);
      const summaryBody = (await summaryRes.json()) as { data: { totalRuns: number; failedRuns: number; recentFailures: unknown[] } };
      expect(summaryBody.data.totalRuns).toBe(0);
      expect(summaryBody.data.failedRuns).toBe(0);
      expect(summaryBody.data.recentFailures).toEqual([]);
    });
  });

  describe('3. DinDin Checkout Payment State Machine, Config Fail-Closed RBAC & Cross-Tenant Guards', () => {
    it('blocks POST /checkout/:orderId/qc with 409 for unpaid non-cash (payos) orders when payment_status is null and status is pending', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'tenant_a' } as never);
        c.set('tenantId' as never, 'tenant_a' as never);
        await next();
      });
      registerCheckoutHandlers(app);

      const orders = new Map<string, Record<string, unknown>>([
        [
          'DIN_PAYOS_UNPAID_NULL',
          {
            id: 'DIN_PAYOS_UNPAID_NULL',
            customer_name: 'DIN',
            payment_method: 'payos',
            payment_status: null,
            status: 'pending',
            tenant_id: 'tenant_a',
          },
        ],
        [
          'DIN_PAYOS_PENDING',
          {
            id: 'DIN_PAYOS_PENDING',
            customer_name: 'DIN',
            payment_method: 'payos',
            payment_status: 'pending',
            status: 'preparing',
            tenant_id: 'tenant_a',
          },
        ],
        [
          'DIN_PAYOS_PAID_STATUS',
          {
            id: 'DIN_PAYOS_PAID_STATUS',
            customer_name: 'DIN',
            payment_method: 'payos',
            payment_status: null,
            status: 'preparing',
            tenant_id: 'tenant_a',
          },
        ],
        [
          'DIN_COD_PENDING',
          {
            id: 'DIN_COD_PENDING',
            customer_name: 'DIN',
            payment_method: 'cod',
            payment_status: null,
            status: 'pending',
            tenant_id: 'tenant_a',
          },
        ],
      ]);

      const env = {
        AUTH_KV: createKvMock(),
        AURA_DB: {
          prepare: (sql: string) => ({
            bind: (...args: unknown[]) => ({
              first: async () => {
                if (sql.includes('FROM orders WHERE id = ?')) {
                  return orders.get(String(args[0])) ?? null;
                }
                return null;
              },
              run: async () => ({ success: true, meta: { changes: 1 } }),
            }),
          }),
        },
      } as unknown as Env;

      // 1. Unpaid PayOS order with payment_status: null and status: 'pending' -> 409
      const unpaidNullRes = await app.request(
        'http://localhost/checkout/DIN_PAYOS_UNPAID_NULL/qc',
        { method: 'POST', headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(unpaidNullRes.status).toBe(409);
      const unpaidNullBody = (await unpaidNullRes.json()) as { error: string };
      expect(unpaidNullBody.error).toContain('unpaid non-cash order');

      // 2. PayOS order with explicit payment_status: 'pending' -> 409
      const unpaidPendingRes = await app.request(
        'http://localhost/checkout/DIN_PAYOS_PENDING/qc',
        { method: 'POST', headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(unpaidPendingRes.status).toBe(409);

      // 3. PayOS order that already transitioned to 'preparing' (webhook paid) with legacy null payment_status -> 200
      const paidStatusRes = await app.request(
        'http://localhost/checkout/DIN_PAYOS_PAID_STATUS/qc',
        { method: 'POST', headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(paidStatusRes.status).toBe(200);

      // 4. COD order with status 'pending' -> 200
      const codRes = await app.request(
        'http://localhost/checkout/DIN_COD_PENDING/qc',
        { method: 'POST', headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(codRes.status).toBe(200);
    });

    it('enforces fail-closed role check on PUT /config when user role is missing or unauthorized, and blocks cross-tenant overrides on DinDin config & checkout routes', async () => {
      let currentUser: Record<string, unknown> | undefined;
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        if (currentUser !== undefined) {
          c.set('user' as never, currentUser as never);
        }
        await next();
      });
      registerConfigHandlers(app);
      registerCheckoutHandlers(app);

      const env = {
        JWT_SECRET: TEST_JWT_SECRET,
        AUTH_KV: createKvMock(),
        AURA_DB: {
          prepare: () => ({
            bind: () => ({
              first: async () => null,
              all: async () => ({ results: [] }),
              run: async () => ({ success: true, meta: { changes: 1 } }),
            }),
          }),
        },
      } as unknown as Env;

      const validConfigBody = {
        menu: { sections: [{ name: 'Coffee', items: [{ name: 'Latte', price: 45000 }] }] },
        settings: {},
      };

      // 1. User object with missing role -> 403
      currentUser = { id: 'u-no-role', tenantId: 'tenant_a' };
      const noRoleRes = await app.request(
        'http://localhost/config',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validConfigBody),
        },
        env
      );
      expect(noRoleRes.status).toBe(403);

      // 2. Unauthenticated request when JWT_SECRET is configured -> 403
      currentUser = undefined;
      const unauthRes = await app.request(
        'http://localhost/config',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validConfigBody),
        },
        env
      );
      expect(unauthRes.status).toBe(403);

      // 3. Manager bound to tenant_a spoofing X-Tenant-ID: tenant_b on PUT /config, GET /config, GET /checkouts, POST /checkout -> 403
      currentUser = { id: 'mgr-a', role: 'manager', tenantId: 'tenant_a' };
      const putConfigCrossRes = await app.request(
        'http://localhost/config',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_b' },
          body: JSON.stringify(validConfigBody),
        },
        env
      );
      expect(putConfigCrossRes.status).toBe(403);

      const getConfigCrossRes = await app.request(
        'http://localhost/config?tenant_id=tenant_b',
        { method: 'GET' },
        env
      );
      expect(getConfigCrossRes.status).toBe(403);

      const getCheckoutsCrossRes = await app.request(
        'http://localhost/checkouts',
        { method: 'GET', headers: { 'X-Tenant-ID': 'tenant_b' } },
        env
      );
      expect(getCheckoutsCrossRes.status).toBe(403);

      const postCheckoutCrossRes = await app.request(
        'http://localhost/checkout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_b' },
          body: JSON.stringify({ sessionId: 'sess-1', payment_method: 'cod' }),
        },
        env
      );
      expect(postCheckoutCrossRes.status).toBe(403);
    });
  });

  describe('4. SOP Scope Session Tenant Precedence, Snake-Case Claim Support & Cross-Tenant Override Rejection', () => {
    it('supports snake_case tenant_id and prevents env.SOP_TENANT_ID / env.PILOT_TENANT_ID from overriding an authenticated user explicit tenant claim', () => {
      const envWithStoreA = {
        SOP_TENANT_ID: 'store-a',
        PILOT_TENANT_ID: 'store-a',
      } as unknown as Env;

      // CamelCase user.tenantId takes precedence over env.SOP_TENANT_ID
      const camelScope = sopScope(envWithStoreA, {
        id: 'staff-b1',
        role: 'staff',
        tenantId: 'store-b',
      } as never);
      expect(camelScope.tenantId).toBe('store-b');

      // Snake_case user.tenant_id takes precedence over env.SOP_TENANT_ID
      const snakeScope = sopScope(envWithStoreA, {
        id: 'staff-b2',
        role: 'barista',
        tenant_id: 'store-b',
      } as never);
      expect(snakeScope.tenantId).toBe('store-b');

      // Legacy session without explicit tenant claim falls back to env.SOP_TENANT_ID / env.PILOT_TENANT_ID
      const legacyScope = sopScope(envWithStoreA, {
        id: 'staff-legacy',
        role: 'staff',
      } as never);
      expect(legacyScope.tenantId).toBe('store-a');
    });

    it('rejects cross-tenant header/query overrides from non-HQ SOP callers with 403 SopAccessError while allowing HQ owner concrete store target', () => {
      const env = { PILOT_TENANT_ID: 'default' } as unknown as Env;

      expect(() =>
        sopScope(
          env,
          { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never,
          {
            req: {
              query: () => undefined,
              header: (k: string) => (k.toLowerCase() === 'x-tenant-id' ? 'store-b' : undefined),
            },
          }
        )
      ).toThrowError(new SopAccessError('Cross-tenant access denied', 403));

      expect(() =>
        sopScope(
          env,
          { id: 'stf-a', role: 'staff', tenant_id: 'store-a' } as never,
          'store-b'
        )
      ).toThrowError(new SopAccessError('Cross-tenant access denied', 403));

      // HQ owner bound to default can target concrete store-b
      const hqScope = sopScope(
        env,
        { id: 'hq-owner', role: 'owner', tenantId: 'default' } as never,
        'store-b'
      );
      expect(hqScope.tenantId).toBe('store-b');

      // Wildcard override is always rejected with 403
      expect(() =>
        sopScope(
          env,
          { id: 'hq-owner', role: 'owner', tenantId: 'default' } as never,
          '*'
        )
      ).toThrow(SopAccessError);
    });
  });
});
