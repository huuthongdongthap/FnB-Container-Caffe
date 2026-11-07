import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { containerTelemetryRouter } from '../../routes/container-telemetry';
import { recommendationsRouter } from '../../routes/recommendations';
import { inventoryForecastingRouter } from '../../routes/inventory-forecasting';
import { franchiseRouter } from '../../routes/franchise-locations';
import { floorPlanRouter } from '../../routes/floor-plan';
import { getOrdersMobile, createOrderMobile, getOrderDetail } from '../../routes/orders-mobile';
import { getTablesMobile, updateTableStatus } from '../../routes/tables-mobile';
import { getNotifications, markNotificationRead, subscribePush } from '../../routes/notifications-mobile';
import { resolveOpenApiTablesTenant } from '../../routes/openapi-tables-handlers/helpers';
import { registerOrderHandlers } from '../../routes/table-sessions-handlers/order-handlers';
import { registerSessionHandlers } from '../../routes/table-sessions-handlers/session-handlers';
import { issueStaffSession } from '../../lib/staff-session';

const JWT_SECRET = 'test-jwt-secret-phase58-long-enough-32c!';

async function createStaffToken(id: string, role: string, tenantId: string): Promise<string> {
  const session = await issueStaffSession(
    { JWT_SECRET },
    { id, name: id, phone: '0900000001', role, tenant_id: tenantId, is_active: 1, auth_version: 1 },
    { email: `${id}@aura.vn`, sessionType: 'staff-web' }
  );
  return session.token;
}

describe('Phase 58 Security Gate (BE1..BE4)', () => {
  describe('BE1: Container Telemetry & AI Recommendations Tenant Isolation', () => {
    it('rejects non-HQ cross-tenant query/header overrides on container telemetry routes with 403', async () => {
      const token = await createStaffToken('staff-a', 'manager', 'tenant-a');
      const env = {
        JWT_SECRET,
        AURA_DB: {
          prepare: vi.fn((sql: string) => ({
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn(async () => {
              if (sql.includes('FROM users')) {
                return { id: 'staff-a', role: 'manager', tenant_id: 'tenant-a', is_active: 1, auth_version: 1 };
              }
              return null;
            }),
          })),
        },
      } as unknown as Env;

      const resQuerySnake = await containerTelemetryRouter.request(
        'http://localhost/containers/status?tenant_id=tenant-b',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(resQuerySnake.status).toBe(403);

      const resQueryCamel = await containerTelemetryRouter.request(
        'http://localhost/containers/status?tenantId=tenant-b',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(resQueryCamel.status).toBe(403);

      const resWildcardHeader = await containerTelemetryRouter.request(
        'http://localhost/containers/CNT-01/history',
        { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': '*' } },
        env
      );
      expect(resWildcardHeader.status).toBe(403);
    });

    it('enforces tenant-scoped ON CONFLICT WHERE guard and fail-closed batch on recommendations mine-affinities', async () => {
      const token = await createStaffToken('mgr-b', 'manager', 'tenant-b');
      const preparedSqls: string[] = [];
      let shouldThrowBatch = false;

      const env = {
        JWT_SECRET,
        AURA_DB: {
          prepare: vi.fn((sql: string) => {
            preparedSqls.push(sql);
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn(async () => {
                if (sql.includes('FROM users')) {
                  return { id: 'mgr-b', role: 'manager', tenant_id: 'tenant-b', is_active: 1, auth_version: 1 };
                }
                return null;
              }),
              all: vi.fn().mockResolvedValue({
                results: [
                  { items: JSON.stringify([{ product_id: 'prod-1' }, { product_id: 'prod-2' }]) },
                ],
              }),
              run: vi.fn().mockResolvedValue({ success: true }),
            };
          }),
          batch: vi.fn(async () => {
            if (shouldThrowBatch) {
              throw new Error('D1 batch error');
            }
            return [];
          }),
        },
      } as unknown as Env;

      const crossTenantRes = await recommendationsRouter.request(
        'http://localhost/frequently-bought-together?item_id=prod-1&tenantId=tenant-a',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(crossTenantRes.status).toBe(403);

      const okRes = await recommendationsRouter.request(
        'http://localhost/mine-affinities',
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(okRes.status).toBe(200);
      const upsertSql = preparedSqls.find((s) => s.includes('INSERT INTO ai_product_affinities'));
      expect(upsertSql).toBeDefined();
      expect(upsertSql).toContain(
        "WHERE COALESCE(NULLIF(TRIM(ai_product_affinities.tenant_id), ''), 'default') = excluded.tenant_id"
      );

      shouldThrowBatch = true;
      const failClosedRes = await recommendationsRouter.request(
        'http://localhost/mine-affinities',
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(failClosedRes.status).toBe(500);
    });
  });

  describe('BE2: Inventory Forecasting, Franchise Locations & Floor Plan Tenant Guards', () => {
    it('guards inventory_forecast_snapshots ON CONFLICT by tenant_id and fails closed on non-default batch error', async () => {
      const token = await createStaffToken('mgr-b', 'manager', 'tenant-b');
      const preparedSqls: string[] = [];
      let batchFails = false;

      const env = {
        JWT_SECRET,
        AURA_DB: {
          prepare: vi.fn((sql: string) => {
            preparedSqls.push(sql);
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn(async () => {
                if (sql.includes('FROM users')) {
                  return { id: 'mgr-b', role: 'manager', tenant_id: 'tenant-b', is_active: 1, auth_version: 1 };
                }
                return null;
              }),
              all: vi.fn().mockResolvedValue({
                results: [
                  {
                    id: 'inv-1',
                    sku: 'COFFEE-01',
                    name: 'Beans',
                    unit: 'kg',
                    current_stock: 10,
                    min_stock: 5,
                    reorder_point: 8,
                    cost_per_unit: 100,
                    supplier_id: null,
                    supplier_name: null,
                    lead_time_days: 2,
                    tenant_id: 'tenant-b',
                    total_consumed_14d: 28,
                  },
                ],
              }),
            };
          }),
          batch: vi.fn(async () => {
            if (batchFails) throw new Error('Snapshot batch write failed');
            return [];
          }),
        },
      } as unknown as Env;

      const mismatchRes = await inventoryForecastingRouter.request(
        'http://localhost/reorder-alerts?tenant_id=tenant-a',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(mismatchRes.status).toBe(403);

      const snapOk = await inventoryForecastingRouter.request(
        'http://localhost/snapshot',
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(snapOk.status).toBe(200);
      const snapshotUpsert = preparedSqls.find((s) => s.includes('INSERT INTO inventory_forecast_snapshots'));
      expect(snapshotUpsert).toBeDefined();
      expect(snapshotUpsert).toContain(
        "WHERE COALESCE(NULLIF(TRIM(inventory_forecast_snapshots.tenant_id), ''), 'default') = excluded.tenant_id"
      );

      batchFails = true;
      const snapFail = await inventoryForecastingRouter.request(
        'http://localhost/snapshot',
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(snapFail.status).toBe(500);
    });

    it('rejects cross-tenant overrides and legacy tenantless rows for non-default tenants in franchiseRouter', async () => {
      const token = await createStaffToken('mgr-b', 'manager', 'tenant-b');
      const env = {
        JWT_SECRET,
        AURA_DB: {
          prepare: vi.fn((sql: string) => ({
            bind: vi.fn().mockReturnThis(),
            first: vi.fn(async () => {
              if (sql.includes('FROM users')) {
                return { id: 'mgr-b', role: 'manager', tenant_id: 'tenant-b', is_active: 1, auth_version: 1 };
              }
              if (sql.includes('COALESCE(NULLIF(TRIM(tenant_id)')) {
                throw new Error('no such column: tenant_id');
              }
              return { id: 'loc_legacy', code: 'SD01', name: 'Legacy Store' };
            }),
            all: vi.fn().mockResolvedValue({ results: [] }),
          })),
        },
      } as unknown as Env;

      const overrideRes = await franchiseRouter.request(
        'http://localhost/locations?tenantId=tenant-a',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(overrideRes.status).toBe(403);

      const legacyLocRes = await franchiseRouter.request(
        'http://localhost/locations/loc_legacy',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(legacyLocRes.status).toBe(403);
    });

    it('scopes table_sessions JOIN by tenant_id and strips cross-tenant/legacy session fields in floorPlanRouter', async () => {
      const token = await createStaffToken('mgr-b', 'manager', 'tenant-b');
      const preparedSqls: string[] = [];
      const env = {
        JWT_SECRET,
        AURA_DB: {
          prepare: vi.fn((sql: string) => {
            preparedSqls.push(sql);
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn(async () => {
                if (sql.includes('FROM users')) {
                  return { id: 'mgr-b', role: 'manager', tenant_id: 'tenant-b', is_active: 1, auth_version: 1 };
                }
                return null;
              }),
              all: vi.fn().mockResolvedValue({
                results: [
                  {
                    id: 'tbl-b1',
                    table_number: 'B1',
                    tenant_id: 'tenant-b',
                    session_id: 'sess-unscoped',
                    session_status: 'active',
                    customer_name: 'Leaked Guest',
                    guest_count: 4,
                    started_at: '2026-11-04T00:00:00Z',
                    current_order_id: 'ord-leaked',
                    session_tenant_id: null,
                  },
                ],
              }),
            };
          }),
        },
      } as unknown as Env;

      const mismatchRes = await floorPlanRouter.request(
        'http://localhost/?tenant_id=tenant-a',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(mismatchRes.status).toBe(403);

      const okRes = await floorPlanRouter.request(
        'http://localhost/',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(okRes.status).toBe(200);
      expect(preparedSqls.some((s) => s.includes("COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default')"))).toBe(true);
      const body = (await okRes.json()) as { data: Array<Record<string, unknown>> };
      expect(body.data[0]?.active_session).toBeNull();
    });
  });

  describe('BE3: Mobile Orders, Tables & Notifications Tenant Confinement', () => {
    it('rejects camelCase tenantId and wildcard overrides in mobile orders and tables handlers', async () => {
      const makeCtx = (url: string, headers: Record<string, string>, paramId?: string) => {
        const parsed = new URL(url);
        return {
          get: (k: string) => (k === 'user' ? { id: 'w1', role: 'waiter', tenantId: 'tenant-a' } : k === 'tenantId' ? 'tenant-a' : undefined),
          req: {
            query: (k: string) => parsed.searchParams.get(k) ?? undefined,
            header: (k: string) => headers[k] ?? headers[k.toLowerCase()],
            param: () => paramId,
            json: async () => ({ table_id: 'T1', status: 'free', items: [{ id: 'p1', qty: 1, price: 10000 }] }),
            raw: new Request(url, { headers }),
          },
          env: { AURA_DB: { prepare: vi.fn() } },
        } as any;
      };

      const resOrdersList = await getOrdersMobile(makeCtx('http://localhost/mobile/orders?tenantId=tenant-b', {}));
      expect(resOrdersList.status).toBe(403);

      const resOrderCreate = await createOrderMobile(makeCtx('http://localhost/mobile/orders', { 'x-tenant-id': '*' }));
      expect(resOrderCreate.status).toBe(403);

      const resOrderDetail = await getOrderDetail(makeCtx('http://localhost/mobile/orders/o1?tenantId=tenant-b', {}, 'o1'));
      expect(resOrderDetail.status).toBe(403);

      const resTablesList = await getTablesMobile(makeCtx('http://localhost/mobile/tables?tenantId=tenant-b', {}));
      expect(resTablesList.status).toBe(403);

      const resTablePatch = await updateTableStatus(makeCtx('http://localhost/mobile/tables/t1', { 'X-Tenant-ID': '*' }, 't1'));
      expect(resTablePatch.status).toBe(403);
    });

    it('confines snake_case user.tenant_id and unbound non-HQ staff in notifications-mobile', async () => {
      const boundParams: unknown[][] = [];
      const makeNotifCtx = (
        user: Record<string, unknown>,
        url = 'http://localhost/mobile/notifications',
        headers: Record<string, string> = {}
      ) => {
        const parsed = new URL(url);
        return {
          get: (k: string) => (k === 'user' ? user : k === 'tenantId' ? headers['X-Tenant-ID'] : undefined),
          req: {
            query: (k: string) => parsed.searchParams.get(k) ?? undefined,
            header: (k: string) => headers[k] ?? headers[k.toLowerCase()],
            param: () => 'notif-1',
            json: async () => ({
              endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
              keys: { p256dh: 'key-p256dh', auth: 'key-auth' },
            }),
            raw: new Request(url, { headers }),
          },
          env: {
            AURA_DB: {
              prepare: vi.fn(() => ({
                bind: vi.fn((...args: unknown[]) => {
                  boundParams.push(args);
                  return {
                    all: vi.fn().mockResolvedValue({ results: [] }),
                    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
                    first: vi.fn().mockResolvedValue(null),
                  };
                }),
              })),
            },
          },
        } as any;
      };

      // 1. Snake-case tenant_id staff cannot be overridden by X-Tenant-ID header
      const snakeRes = await getNotifications(
        makeNotifCtx({ id: 'u-snake', role: 'waiter', tenant_id: 'tenant-a' }, 'http://localhost/mobile/notifications', {
          'X-Tenant-ID': 'tenant-b',
        })
      );
      expect(snakeRes.status).toBe(200);
      expect(boundParams[boundParams.length - 1]).toEqual(['u-snake', 'tenant-a', 'tenant-a']);

      // 2. Unbound non-HQ staff cannot escalate via X-Tenant-ID header (confined to 'default')
      const unboundRes = await markNotificationRead(
        makeNotifCtx({ id: 'u-unbound', role: 'waiter' }, 'http://localhost/mobile/notifications/notif-1/read', {
          'X-Tenant-ID': 'tenant-b',
        })
      );
      expect(unboundRes.status).toBe(200);
      expect(boundParams[boundParams.length - 1]?.[3]).toBe('default');

      // 3. Explicit cross-tenant query parameter is rejected with 403
      const queryOverrideRes = await subscribePush(
        makeNotifCtx({ id: 'u-snake', role: 'waiter', tenant_id: 'tenant-a' }, 'http://localhost/mobile/notifications/subscribe?tenantId=tenant-b')
      );
      expect(queryOverrideRes.status).toBe(403);
    });
  });

  describe('BE4: Table Sessions & OpenAPI Tables Helpers Hardening', () => {
    it('rejects camelCase tenantId and wildcard overrides in resolveOpenApiTablesTenant', () => {
      const mockCtx = {
        get: (k: string) => (k === 'user' ? { id: 'u1', role: 'waiter', tenantId: 'tenant-a' } : undefined),
        req: {
          query: (k: string) => (k === 'tenantId' ? 'tenant-b' : undefined),
          header: () => undefined,
        },
        json: (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
      };
      const res = resolveOpenApiTablesTenant(mockCtx, 'read');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.response.status).toBe(403);
      }
    });

    it('rejects refunded payment_status orders and fails closed on non-default tenant DB errors in order-handlers', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'w-b', role: 'waiter', tenantId: 'tenant-b' } as never);
        await next();
      });
      registerOrderHandlers(app);

      let orderPaymentStatus = 'refunded';
      let failTenantSessionUpdate = false;
      const executedSqls: string[] = [];

      const env = {
        AURA_DB: {
          prepare: vi.fn((sql: string) => {
            executedSqls.push(sql);
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn(async () => {
                if (sql.includes('FROM table_sessions')) {
                  return { id: 'sess-b1', table_id: 'tbl-b1', status: 'active', tenant_id: 'tenant-b' };
                }
                if (sql.includes('FROM orders')) {
                  return {
                    id: 'ord-b1',
                    total: 55000,
                    status: 'confirmed',
                    payment_status: orderPaymentStatus,
                    table_id: null,
                    tenant_id: 'tenant-b',
                  };
                }
                return null;
              }),
              run: vi.fn(async () => {
                if (sql.includes('UPDATE table_sessions') && failTenantSessionUpdate) {
                  throw new Error('D1 table_sessions write failure');
                }
                return { meta: { changes: 1 } };
              }),
            };
          }),
        },
      } as unknown as Env;

      // 1. Order with payment_status = 'refunded' is rejected with 400
      const refundedRes = await app.request(
        'http://localhost/sess-b1/orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord-b1' }),
        },
        env
      );
      expect(refundedRes.status).toBe(400);

      // 2. When payment_status = 'paid' but tenant-scoped table_sessions UPDATE fails for 'tenant-b', fail closed (500) without unscoped fallback
      orderPaymentStatus = 'paid';
      failTenantSessionUpdate = true;
      executedSqls.length = 0;

      const failClosedRes = await app.request(
        'http://localhost/sess-b1/orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord-b1' }),
        },
        env
      );
      expect(failClosedRes.status).toBe(500);
      const unscopedSessionUpdates = executedSqls.filter(
        (s) => s.includes('UPDATE table_sessions') && !s.includes('tenant_id')
      );
      expect(unscopedSessionUpdates).toHaveLength(0);
    });

    it('fails closed on non-default tenant session mutations without unscoped table_sessions fallback', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'w-b', role: 'waiter', tenantId: 'tenant-b' } as never);
        await next();
      });
      registerSessionHandlers(app);

      const executedSqls: string[] = [];
      const env = {
        AURA_DB: {
          prepare: vi.fn((sql: string) => {
            executedSqls.push(sql);
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn(async () => {
                if (sql.includes('FROM table_sessions')) {
                  return { id: 'sess-b1', table_id: 'tbl-b1', status: 'active', tenant_id: 'tenant-b' };
                }
                return null;
              }),
              run: vi.fn(async () => {
                if (sql.includes('UPDATE table_sessions')) {
                  throw new Error('Simulated D1 update error');
                }
                return { meta: { changes: 1 } };
              }),
            };
          }),
        },
      } as unknown as Env;

      const patchRes = await app.request(
        'http://localhost/sess-b1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ordering' }),
        },
        env
      );
      expect(patchRes.status).toBe(500);
      const unscopedUpdates = executedSqls.filter(
        (s) => s.includes('UPDATE table_sessions') && !s.includes('tenant_id')
      );
      expect(unscopedUpdates).toHaveLength(0);
    });
  });
});
