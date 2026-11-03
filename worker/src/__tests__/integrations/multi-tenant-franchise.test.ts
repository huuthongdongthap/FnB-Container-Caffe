/**
 * Integration Test: Multi-Tenant & Franchise Preparation (Q2 2027)
 *
 * Verifies:
 * 1. Backward compatibility: Unscoped / wildcard admin orders query.
 * 2. Row-level tenant isolation: Tenant scoping in shared-listing and admin-orders.
 * 3. Franchise location listing: HQ global view vs franchisee-scoped view.
 * 4. Franchise container onboarding: HQ authorization vs non-HQ rejection.
 * 5. Cross-tenant IDOR protection: Forbidden access for mismatched tenants.
 * 6. Franchise economics & royalty accounting: Accurate revenue share computation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminOrders } from '@aura/domain-order';
import { buildOrderFilterClause } from '../../../../packages/domain/order/queries/shared-listing';
import { createMockEnv, TEST_JWT_SECRET } from '../test-utils';
import { generateJWT } from '../../lib/jwt';
import app from '../../index';
import { openApiTablesRouter } from '../../routes/openapi-tables';
import { openApiOrdersRouter } from '../../routes/openapi-orders';
import { openApiLoyaltyRouter } from '../../routes/openapi-loyalty';
import { openApiPromotionsRouter } from '../../routes/openapi-promotions';
import { openApiInventoryRouter } from '../../routes/openapi-inventory';
import { openApiStaffRouter } from '../../routes/openapi-staff-handlers/routes';
import { adminAuditLogsRouter } from '../../routes/admin-audit-logs-handlers/routes';
import { crmRouter } from '../../routes/crm';
import { campaignsRouter } from '../../routes/campaigns';
import { openApiCronRouter } from '../../routes/openapi-cron';
import { adminLoyaltyRouter } from '../../routes/admin-loyalty';
import { broadcastRouter } from '../../routes/broadcast';
import { birthdayRouter } from '../../routes/birthday';
import { reviewsRouter } from '../../routes/reviews';
import { checkinRouter } from '../../routes/checkin';
import { referralRouter, applyReferralForNewCustomer } from '../../routes/referrals';
import { posCustomerRouter } from '../../routes/pos-customer';
import { tableSessionsRouter } from '../../routes/table-sessions';
import { floorPlanRouter } from '../../routes/floor-plan';
import { signageRouter } from '../../routes/signage';
import { adminSalesRouter } from '../../routes/admin-sales';
import { adminQRRouter } from '../../routes/admin-qr';
import { subscriptionsRouter } from '../../routes/subscriptions';
import { customersRouter } from '../../routes/customers';
import { demandForecastRouter } from '../../routes/demand-forecast';
import { franchiseRouter } from '../../routes/franchise-locations';
import { PROFILE_SQL } from '../../routes/customers-handlers/types';
import { dindinRouter } from '../../routes/dindin';
import { categoriesRouter, productsRouter, menuModifiersRouter } from '@aura/domain-catalog';
import { canAccessPaymentOrder } from '../../../../packages/domain/payment/policies/payment-access';
import { promotionsRouter } from '../../routes/promotions-handlers';
import { reservationsRouter } from '../../../../packages/domain/reservation/src/routes/reservations';
import { authRoutes } from '../../routes/openapi-auth-handlers/routes';
import { processCustomerQuery } from '../../routes/customer-assistant';

async function authRequest(
  method: string,
  path: string,
  role: string,
  tenantId: string = 'default',
  body?: unknown
): Promise<Request> {
  const token = await generateJWT({
    id: `user-${role}`,
    sub: `user-${role}`,
    role,
    email: `${role}@test.aura`,
    name: `User ${role}`,
    tenantId,
    authVersion: 1,
    authTime: Math.floor(Date.now() / 1000),
    sessionType: 'staff-web'
  } as any, TEST_JWT_SECRET, 28800);

  const init: RequestInit & { headers: Record<string, string> } = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  };
  if (body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  return new Request(`https://test.aura${path}`, init);
}

/**
 * The staff-session gate judges a presented token against its account row, so
 * every staff request in this suite answers the account lookup with the row
 * named by `authRequest`'s token.
 */
function staffAccountRow(role: string, tenantId: string) {
  return { id: `user-${role}`, name: `User ${role}`, phone: null, role, tenant_id: tenantId, is_active: 1, auth_version: 1 };
}

/** True for the exact lookup shape the request-time session gate issues. */
function isAccountLookup(sql: string): boolean {
  return /FROM users WHERE id = \?/i.test(sql);
}

/** Statement answering the gate's account read with the token's own account. */
function accountStatement(role: string, tenantId: string) {
  const row = staffAccountRow(role, tenantId);
  const stmt: any = {
    bind: () => stmt,
    first: async () => row,
    all: async () => ({ results: [row], success: true, meta: {} }),
    run: async () => ({ success: true, changes: 0, lastRowId: 0, meta: {} }),
    raw: async () => [],
  };
  return stmt;
}

describe('Multi-Tenant & Franchise Preparation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Shared Listing & Tenant Filter Clause', () => {
    it('appends tenant_id predicate when tenantId is provided and not wildcard', () => {
      const { clause, params } = buildOrderFilterClause({
        tenantId: 'tenant_sadec_02',
        filters: [['o.status', 'pending']]
      });

      expect(clause).toContain('AND o.tenant_id = ?');
      expect(clause).toContain('AND o.status = ?');
      expect(params).toEqual(['tenant_sadec_02', 'pending']);
    });

    it('omits tenant_id predicate when tenantId is wildcard or undefined', () => {
      const wildcard = buildOrderFilterClause({
        tenantId: '*',
        filters: [['o.status', 'completed']]
      });
      expect(wildcard.clause).not.toContain('tenant_id');
      expect(wildcard.params).toEqual(['completed']);

      const unscoped = buildOrderFilterClause({
        filters: [['o.status', 'completed']]
      });
      expect(unscoped.clause).not.toContain('tenant_id');
      expect(unscoped.params).toEqual(['completed']);
    });
  });

  describe('2. Row-Level Tenant Isolation on Admin Orders', () => {
    it('isolates orders and count queries to the resolved tenant', async () => {
      const capturedQueries: Array<{ query: string; params: unknown[] }> = [];

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...args: unknown[]) => {
            capturedQueries.push({ query: sql, params: args });
            return {
              all: vi.fn().mockResolvedValue({
                results: sql.includes('COUNT') ? [{ total: 1 }] : [{ id: 'ord_t2', total: 50000 }]
              })
            };
          })
        }))
      };

      const env = { AURA_DB: mockDb };
      const req = new Request('https://test.aura/api/admin/orders?status=pending');

      const res = await getAdminOrders(req, env as any, 'tenant_sadec_02');
      expect(res.status).toBe(200);

      const data = await res.json() as any;
      expect(data.success).toBe(true);

      expect(capturedQueries[0].query).toContain('o.tenant_id = ?');
      expect(capturedQueries[0].params).toContain('tenant_sadec_02');

      expect(capturedQueries[1].query).toContain('tenant_id = ?');
      expect(capturedQueries[1].params).toContain('tenant_sadec_02');
    });
  });

  describe('3. Franchise Locations Listing & HQ Rollup', () => {
    it('allows HQ owner to list all locations across containers', async () => {
      const mockLocations = [
        { id: 'loc_sd_01', code: 'SD-01', name: 'Sa Đéc Flagship', tenant_id: 'default' },
        { id: 'loc_sd_02', code: 'SD-02', name: 'Sa Đéc Container 02', tenant_id: 'tenant_sadec_02' }
      ];

      const mockDb = {
        prepare: vi.fn((sql: string) => (isAccountLookup(sql)
          ? accountStatement('owner', 'default')
          : {
            bind: vi.fn(() => ({
              all: vi.fn().mockResolvedValue({ results: mockLocations }),
              first: vi.fn().mockResolvedValue(null)
            }))
          }))
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any
      });

      const req = await authRequest('GET', '/api/franchise/locations', 'owner', 'default');
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it('confines franchisee staff to their assigned tenantId', async () => {
      let executedQuery = '';
      let boundParams: unknown[] = [];

      const mockDb = {
        prepare: vi.fn((sql: string) => (isAccountLookup(sql)
          ? accountStatement('staff', 'tenant_sadec_02')
          : {
            bind: vi.fn((...args: unknown[]) => {
              executedQuery = sql;
              boundParams = args;
              return {
                all: vi.fn().mockResolvedValue({
                  results: [{ id: 'loc_sd_02', code: 'SD-02', tenant_id: 'tenant_sadec_02' }]
                })
              };
            })
          }))
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any
      });

      const req = await authRequest('GET', '/api/franchise/locations', 'staff', 'tenant_sadec_02');
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);
      expect(executedQuery).toContain('AND tenant_id = ?');
      expect(boundParams).toEqual(['tenant_sadec_02']);
    });
  });

  describe('4. Cross-Tenant IDOR Protection & Onboarding', () => {
    it('forbids franchisee from accessing another location profile', async () => {
      const mockDb = {
        prepare: vi.fn((sql: string) => (isAccountLookup(sql)
          ? accountStatement('staff', 'tenant_sadec_02')
          : {
            bind: vi.fn(() => ({
              first: vi.fn().mockResolvedValue({
                id: 'loc_sd_flagship',
                tenant_id: 'default',
                code: 'SD-01',
                name: 'Sa Đéc Flagship'
              }),
              all: vi.fn().mockResolvedValue({ results: [] })
            }))
          }))
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any
      });

      const req = await authRequest('GET', '/api/franchise/locations/loc_sd_flagship', 'staff', 'tenant_sadec_02');
      const res = await app.fetch(req, env);
      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.error).toContain('Access denied');
    });

    it('rejects franchise onboarding from non-HQ users', async () => {
      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: {
          prepare: vi.fn((sql: string) => (isAccountLookup(sql)
            ? accountStatement('owner', 'tenant_sadec_02')
            : {
              bind: vi.fn(() => ({
                run: vi.fn().mockResolvedValue({ success: true }),
                first: vi.fn().mockResolvedValue(null)
              }))
            }))
        } as any
      });

      const req = await authRequest('POST', '/api/franchise/locations', 'owner', 'tenant_sadec_02', {
        code: 'SD-03',
        name: 'Unauthorized Container'
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(403);
    });
  });

  describe('5. Franchise Economics & Royalty Accounting', () => {
    it('accurately computes gross sales, royalty fees, and net payout', async () => {
      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn(() => ({
            first: vi.fn().mockImplementation(async () => {
              if (isAccountLookup(sql)) return staffAccountRow('manager', 'tenant_sadec_02');
              if (sql.includes('franchise_locations')) {
                return {
                  id: 'loc_sd_02',
                  tenant_id: 'tenant_sadec_02',
                  code: 'SD-02',
                  name: 'Sa Đéc Container 02',
                  royalty_percentage: 6.5
                };
              }
              if (sql.includes('COUNT(*)')) {
                return {
                  order_count: 120,
                  gross_sales: 10000000
                };
              }
              return null;
            }),
            all: vi.fn().mockResolvedValue({ results: [] })
          }))
        }))
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any
      });

      const req = await authRequest('GET', '/api/franchise/locations/loc_sd_02/metrics', 'manager', 'tenant_sadec_02');
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);

      const metrics = body.data;
      expect(metrics.order_count).toBe(120);
      expect(metrics.gross_sales).toBe(10000000);
      expect(metrics.royalty_percentage).toBe(6.5);
      expect(metrics.royalty_amount).toBe(650000); // 6.5% of 10,000,000
      expect(metrics.net_franchisee_payout).toBe(9350000); // 10,000,000 - 650,000
    });
  });

  describe('6. JWT-Bound Tenant Confinement on Protected Forecasting, Pricing & Edge Routes', () => {
    it('prevents non-HQ franchise manager from spoofing ?tenant_id=default across protected routers', async () => {
      const boundTenants: string[] = [];
      const mockDb = {
        // The gate's own account bind is short-circuited before the tracker,
        // otherwise the expected binding list would include a staff id.
        prepare: vi.fn((sql: string) => (isAccountLookup(sql)
          ? accountStatement('manager', 'tenant_sadec_02')
          : {
            bind: vi.fn((...args: unknown[]) => {
              if (typeof args[0] === 'string') {
                boundTenants.push(args[0]);
              }
              return {
                all: vi.fn().mockResolvedValue({ results: [] }),
                first: vi.fn().mockResolvedValue(null),
                run: vi.fn().mockResolvedValue({ success: true })
              };
            })
          }))
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any
      });

      const endpoints = [
        '/api/edge/containers/status?tenant_id=default',
        '/api/pricing/dynamic/rules?tenant_id=default',
        '/api/inventory/forecasting/run-rate?tenant_id=default',
        '/api/admin/metrics/forecast?tenant_id=default'
      ];

      for (const ep of endpoints) {
        const req = await authRequest('GET', ep, 'manager', 'tenant_sadec_02');
        const res = await app.fetch(req, env);
        expect(res.status).toBe(200);
      }

      expect(boundTenants).toEqual([
        'tenant_sadec_02',
        'tenant_sadec_02',
        'tenant_sadec_02',
        'tenant_sadec_02'
      ]);
    });

    it('binds franchise manager writes in dynamic pricing rules to their JWT tenantId', async () => {
      let insertedArgs: unknown[] = [];
      const mockDb = {
        prepare: vi.fn((sql: string) => (isAccountLookup(sql)
          ? accountStatement('manager', 'tenant_sadec_02')
          : {
            bind: vi.fn((...args: unknown[]) => {
              insertedArgs = args;
              return {
                run: vi.fn().mockResolvedValue({ success: true })
              };
            })
          }))
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any
      });

      const req = await authRequest('POST', '/api/pricing/dynamic/rules', 'manager', 'tenant_sadec_02', {
        name: 'Franchise Happy Hour',
        rule_type: 'happy_hour',
        discount_percent: 15,
        start_time: '14:00',
        end_time: '16:00'
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(201);
      expect(insertedArgs[1]).toBe('tenant_sadec_02');
    });

    it('authorizes HQ admin role across franchise, edge telemetry, demand forecast, and dynamic pricing routers', async () => {
      const boundTenants: string[] = [];
      const tenantBinds: string[] = [];
      const mockDb = {
        prepare: (sql: string) => {
          if (isAccountLookup(sql)) return accountStatement('admin', 'default');
          // A privileged cross-tenant read also lands in the audit log; only the
          // tenant bindings of the reads/writes themselves are confined here.
          const isAuditWrite = /INSERT INTO audit_logs/i.test(sql);
          const stmt = {
            bind: vi.fn((...args: unknown[]) => {
              const first = args[0];
              if (typeof first === 'string') {
                boundTenants.push(first);
                if (!isAuditWrite && (first.startsWith('tenant_') || first === '*')) {
                  tenantBinds.push(first);
                }
              }
              return {
                all: vi.fn().mockResolvedValue({ results: [] }),
                first: vi.fn().mockResolvedValue(null),
                run: vi.fn().mockResolvedValue({ success: true })
              };
            })
          };
          return stmt as any;
        }
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any
      });

      const endpoints = [
        '/api/franchise/locations?tenant_id=tenant_sadec_02',
        '/api/edge/containers/status?tenant_id=tenant_sadec_02',
        '/api/pricing/dynamic/rules?tenant_id=tenant_sadec_02',
        '/api/inventory/forecasting/run-rate?tenant_id=tenant_sadec_02',
        '/api/admin/metrics/forecast?tenant_id=tenant_sadec_02'
      ];

      for (const ep of endpoints) {
        const req = await authRequest('GET', ep, 'admin', 'default');
        const res = await app.fetch(req, env);
        expect(res.status).toBe(200);
      }

      // Every protected route binds the requested tenant — none fall back to
      // 'default' or to the admin's own tenant.
      expect(tenantBinds).toEqual([
        'tenant_sadec_02',
        'tenant_sadec_02',
        'tenant_sadec_02',
        'tenant_sadec_02',
        'tenant_sadec_02'
      ]);
    });
  });

  describe('7. OpenAPI Tables, OpenAPI Orders Update, Auth /me & Customer Assistant Tenant/Role Parity', () => {
    it('isolates OpenAPI table CRUD and bulk-status across tenants and authorizes supervisor', async () => {
      const defaultTable = {
        id: 'tbl-default-1',
        table_number: 1,
        code: 'T01',
        name: 'Bàn 1',
        zone: 'indoor',
        zone_id: 'indoor',
        capacity: 4,
        status: 'available',
        is_active: 1,
        tenant_id: null,
      };
      const tenantBTable = {
        id: 'tbl-b-1',
        table_number: 1,
        code: 'T01',
        name: 'Bàn 1 B',
        zone: 'indoor',
        zone_id: 'indoor',
        capacity: 4,
        status: 'available',
        is_active: 1,
        tenant_id: 'tenant_sadec_02',
      };

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          if (isAccountLookup(sql)) return accountStatement('supervisor', 'tenant_sadec_02');
          return {
            bind: vi.fn((...args: unknown[]) => ({
              first: vi.fn(async () => {
                if (/COUNT\(\*\)/i.test(sql)) return { total: 1 };
                if (/WHERE (?:t\.)?id = \?/i.test(sql)) {
                  const id = args[0];
                  if (id === 'tbl-default-1') return defaultTable;
                  if (id === 'tbl-b-1') return tenantBTable;
                }
                return null;
              }),
              all: vi.fn(async () => ({
                results: [defaultTable, tenantBTable],
              })),
              run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
            })),
          };
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      const listReq = await authRequest('GET', '/api/tables', 'supervisor', 'tenant_sadec_02');
      const listRes = await openApiTablesRouter.fetch(listReq, env);
      expect(listRes.status).toBe(200);
      const listJson = (await listRes.json()) as any;
      expect(listJson.data.tables).toHaveLength(1);
      expect(listJson.data.tables[0].id).toBe('tbl-b-1');

      const getCrossReq = await authRequest('GET', '/api/tables/tbl-default-1', 'supervisor', 'tenant_sadec_02');
      const getCrossRes = await openApiTablesRouter.fetch(getCrossReq, env);
      expect(getCrossRes.status).toBe(404);

      const patchCrossReq = await authRequest('PATCH', '/api/tables/tbl-default-1', 'supervisor', 'tenant_sadec_02', {
        name: 'Tampered',
      });
      const patchCrossRes = await openApiTablesRouter.fetch(patchCrossReq, env);
      expect(patchCrossRes.status).toBe(404);

      const deleteCrossReq = await authRequest('DELETE', '/api/tables/tbl-default-1', 'supervisor', 'tenant_sadec_02');
      const deleteCrossRes = await openApiTablesRouter.fetch(deleteCrossReq, env);
      expect(deleteCrossRes.status).toBe(404);

      const bulkCrossReq = await authRequest('POST', '/api/tables/bulk-status', 'supervisor', 'tenant_sadec_02', {
        tableIds: ['tbl-default-1'],
        status: 'occupied',
      });
      const bulkCrossRes = await openApiTablesRouter.fetch(bulkCrossReq, env);
      expect(bulkCrossRes.status).toBe(404);
    });

    it('blocks cross-tenant PATCH /api/orders/:id on OpenAPI orders router and authorizes supervisor & shipper on /api/auth/me', async () => {
      const mockDb = {
        prepare: vi.fn((sql: string) => {
          if (isAccountLookup(sql)) return accountStatement('supervisor', 'tenant_sadec_02');
          return {
            bind: vi.fn(() => ({
              first: vi.fn(async () => {
                if (/FROM orders WHERE id = \?/i.test(sql)) {
                  return { id: 'ord-default-1', status: 'pending', tenant_id: 'default', customer_id: null };
                }
                if (/FROM users WHERE id = \?/i.test(sql)) {
                  return {
                    id: 'user-supervisor',
                    email: 'supervisor@test.aura',
                    name: 'User supervisor',
                    role: 'supervisor',
                    is_active: 1,
                    created_at: '2026-10-31T00:00:00Z',
                  };
                }
                return null;
              }),
              all: vi.fn(async () => ({ results: [] })),
              run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
            })),
          };
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      const patchOrderReq = await authRequest('PATCH', '/api/orders/ord-default-1', 'supervisor', 'tenant_sadec_02', {
        notes: 'cross-tenant write attempt',
      });
      const patchOrderRes = await openApiOrdersRouter.fetch(patchOrderReq, env);
      expect(patchOrderRes.status).toBe(404);

      const meReq = await authRequest('GET', '/api/auth/me', 'supervisor', 'tenant_sadec_02');
      const meRes = await authRoutes.fetch(meReq, env);
      expect(meRes.status).not.toBe(403);
    });

    it('scopes cafe_tables join by tenant_id in customer assistant table_bill lookup', async () => {
      const capturedSql: string[] = [];
      const mockDb = {
        prepare: vi.fn((sql: string) => {
          capturedSql.push(sql);
          return {
            bind: vi.fn(() => ({
              first: vi.fn(async () => ({ id: 'ord-b-9', total: 65000, status: 'preparing' })),
            })),
          };
        }),
      };

      const result = await processCustomerQuery(mockDb as any, null, 'tenant_sadec_02', {
        query: 'tính tiền bàn 5',
        table_number: '5',
        channel: 'web',
      });
      expect(result.intent).toBe('table_bill');
      expect(capturedSql[0]).toContain("COALESCE(NULLIF(t.tenant_id, ''), 'default') = COALESCE(NULLIF(o.tenant_id, ''), 'default')");
    });
  });

  describe('8. OpenAPI Loyalty, Promotions, Reservations & Inventory Tenant/Role Parity', () => {
    it('isolates OpenAPI loyalty admin adjust-points and accounts across tenants and authorizes supervisor', async () => {
      const mockDb = {
        prepare: vi.fn((sql: string) => {
          return {
            bind: vi.fn((...args: unknown[]) => ({
              first: vi.fn(async () => {
                if (/FROM users WHERE id = \?/i.test(sql)) {
                  const id = args[0];
                  if (id === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
                  if (id === 'cust-default') return { id: 'cust-default', tenant_id: null };
                  if (id === 'cust-b') return { id: 'cust-b', tenant_id: 'tenant_sadec_02' };
                }
                if (/FROM loyalty_accounts WHERE customer_id = \?/i.test(sql)) {
                  const id = args[0];
                  if (id === 'cust-default') {
                    return { id: 'la-default', customer_id: 'cust-default', current_points: 50, lifetime_points: 50, tier: 'bronze' };
                  }
                  if (id === 'cust-b') {
                    return { id: 'la-b', customer_id: 'cust-b', current_points: 100, lifetime_points: 100, tier: 'bronze' };
                  }
                }
                if (/FROM loyalty_transactions WHERE id = \?/i.test(sql)) {
                  return {
                    id: args[0],
                    account_id: 'la-b',
                    type: 'adjust',
                    points: 25,
                    balance_after: 125,
                    description: 'Supervisor adjustment',
                    created_at: '2026-10-31T00:00:00Z',
                  };
                }
                return null;
              }),
              all: vi.fn(async () => ({
                results: [
                  { id: 'la-default', customer_id: 'cust-default', current_points: 50, tier: 'bronze', created_at: '2026-10-31T00:00:00Z', updated_at: '2026-10-31T00:00:00Z' },
                  { id: 'la-b', customer_id: 'cust-b', current_points: 125, tier: 'bronze', created_at: '2026-10-31T00:00:00Z', updated_at: '2026-10-31T00:00:00Z' },
                ],
              })),
              run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
            })),
            run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
          };
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      const crossAdjustReq = await authRequest('POST', '/api/loyalty/admin/adjust-points', 'supervisor', 'tenant_sadec_02', {
        customerId: 'cust-default',
        points: 25,
        reason: 'Cross-tenant attempt',
        idempotencyKey: 'idem-cross-1',
      });
      const crossAdjustRes = await openApiLoyaltyRouter.fetch(crossAdjustReq, env);
      expect(crossAdjustRes.status).toBe(404);

      const ownAdjustReq = await authRequest('POST', '/api/loyalty/admin/adjust-points', 'supervisor', 'tenant_sadec_02', {
        customerId: 'cust-b',
        points: 25,
        reason: 'Supervisor adjustment',
        idempotencyKey: 'idem-own-1',
      });
      const ownAdjustRes = await openApiLoyaltyRouter.fetch(ownAdjustReq, env);
      expect(ownAdjustRes.status).toBe(200);

      const listAccountsReq = await authRequest('GET', '/api/loyalty/admin/accounts', 'supervisor', 'tenant_sadec_02');
      const listAccountsRes = await openApiLoyaltyRouter.fetch(listAccountsReq, env);
      expect(listAccountsRes.status).toBe(200);
      const listAccountsJson = (await listAccountsRes.json()) as any;
      expect(listAccountsJson.data).toHaveLength(1);
      expect(listAccountsJson.data[0].customer_id).toBe('cust-b');
    });

    it('isolates legacy and OpenAPI promotions across tenants on null/default tenant rows and authorizes supervisor', async () => {
      const defaultPromo = {
        id: 'promo-default-1',
        code: 'DEFAULT10',
        name: 'Default 10%',
        type: 'percentage',
        discount_type: 'percentage',
        discount_value: 10,
        percent: 10,
        max_discount: 20000,
        min_order: 0,
        usage_limit: 100,
        usage_count: 0,
        current_uses: 0,
        is_active: 1,
        tenant_id: null,
        created_at: '2026-10-31T00:00:00Z',
        updated_at: '2026-10-31T00:00:00Z',
      };
      const tenantBPromo = {
        ...defaultPromo,
        id: 'promo-b-1',
        code: 'SADEC20',
        name: 'Sa Dec 20%',
        discount_value: 20,
        percent: 20,
        tenant_id: 'tenant_sadec_02',
      };

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          if (isAccountLookup(sql)) return accountStatement('supervisor', 'tenant_sadec_02');
          return {
            all: vi.fn(async () => ({ results: [defaultPromo, tenantBPromo] })),
            bind: vi.fn((...args: unknown[]) => ({
              first: vi.fn(async () => {
                if (/COUNT\(\*\)/i.test(sql)) return { total: 2 };
                if (/FROM orders WHERE id = \?/i.test(sql)) {
                  return { id: 'ord-default-1', tenant_id: 'default', status: 'pending' };
                }
                if (/FROM promotions/i.test(sql)) {
                  const key = String(args[0]).toUpperCase();
                  if (key === 'DEFAULT10' || args[0] === 'promo-default-1') return defaultPromo;
                  if (key === 'SADEC20' || args[0] === 'promo-b-1') return tenantBPromo;
                }
                return null;
              }),
              all: vi.fn(async () => ({ results: [defaultPromo, tenantBPromo] })),
              run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
            })),
          };
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      const listLegacyReq = await authRequest('GET', '/', 'supervisor', 'tenant_sadec_02');
      const listLegacyRes = await promotionsRouter.fetch(listLegacyReq, env);
      expect(listLegacyRes.status).toBe(200);
      const listLegacyJson = (await listLegacyRes.json()) as any;
      expect(listLegacyJson.data).toHaveLength(1);
      expect(listLegacyJson.data[0].code).toBe('SADEC20');

      const getCrossLegacyReq = await authRequest('GET', '/DEFAULT10', 'supervisor', 'tenant_sadec_02');
      const getCrossLegacyRes = await promotionsRouter.fetch(getCrossLegacyReq, env);
      expect(getCrossLegacyRes.status).toBe(404);

      const redeemCrossOrderReq = await authRequest('POST', '/redeem', 'supervisor', 'tenant_sadec_02', {
        code: 'SADEC20',
        order_id: 'ord-default-1',
        order_total: 100000,
      });
      const redeemCrossOrderRes = await promotionsRouter.fetch(redeemCrossOrderReq, env);
      expect(redeemCrossOrderRes.status).toBe(404);

      const listOpenApiReq = await authRequest('GET', '/api/promotions', 'supervisor', 'tenant_sadec_02');
      const listOpenApiRes = await openApiPromotionsRouter.fetch(listOpenApiReq, env);
      expect(listOpenApiRes.status).toBe(200);
      const listOpenApiJson = (await listOpenApiRes.json()) as any;
      expect(listOpenApiJson.data.promotions).toHaveLength(1);
      expect(listOpenApiJson.data.promotions[0].id).toBe('promo-b-1');

      const patchCrossOpenApiReq = await authRequest('PATCH', '/api/promotions/promo-default-1', 'supervisor', 'tenant_sadec_02', {
        name: 'Tampered',
      });
      const patchCrossOpenApiRes = await openApiPromotionsRouter.fetch(patchCrossOpenApiReq, env);
      expect(patchCrossOpenApiRes.status).toBe(404);
    });

    it('isolates reservations and OpenAPI inventory ingredients/movements across tenants and authorizes supervisor', async () => {
      const defaultTable = { id: 'tbl-default-1', table_number: 'T1', zone: 'indoor', capacity: 4, tenant_id: null };
      const tenantBTable = { id: 'tbl-b-1', table_number: 'B1', zone: 'indoor', capacity: 4, tenant_id: 'tenant_sadec_02' };
      const defaultIngredient = { id: 'ing-default-1', name: 'Cà phê hạt', sku: 'CF-01', unit: 'kg', current_stock: 10 };
      const tenantBIngredient = { id: 'ing-b-1', name: 'Sữa tươi B', sku: 'MLK-B1', unit: 'l', current_stock: 20 };

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          if (isAccountLookup(sql)) return accountStatement('supervisor', 'tenant_sadec_02');
          return {
            all: vi.fn(async () => ({ results: [defaultTable, tenantBTable] })),
            bind: vi.fn((...args: unknown[]) => ({
              first: vi.fn(async () => {
                if (/COUNT\(\*\)/i.test(sql)) return { total: 2 };
                if (/FROM cafe_tables WHERE id = \? OR table_number = \?/i.test(sql)) {
                  const key = String(args[0]);
                  if (key === 'tbl-default-1' || key === 'T1') return defaultTable;
                  if (key === 'tbl-b-1' || key === 'B1') return tenantBTable;
                }
                if (/FROM reservations WHERE id = \?/i.test(sql)) {
                  if (args[0] === 'rsv-default-1') return { id: 'rsv-default-1', table_id: 'tbl-default-1', status: 'pending' };
                  if (args[0] === 'rsv-b-1') return { id: 'rsv-b-1', table_id: 'tbl-b-1', status: 'pending' };
                }
                if (/FROM ingredients WHERE id = \?/i.test(sql)) {
                  if (args[0] === 'ing-default-1') return defaultIngredient;
                  if (args[0] === 'ing-b-1') return tenantBIngredient;
                }
                if (/FROM inventory_items WHERE id = \?/i.test(sql)) {
                  if (args[0] === 'ing-default-1') return { id: 'ing-default-1', tenant_id: null };
                  if (args[0] === 'ing-b-1') return { id: 'ing-b-1', tenant_id: 'tenant_sadec_02' };
                }
                return null;
              }),
              all: vi.fn(async () => {
                if (/FROM ingredients/i.test(sql)) {
                  return { results: [defaultIngredient, tenantBIngredient] };
                }
                if (/FROM reservations/i.test(sql)) {
                  return {
                    results: [
                      { id: 'rsv-default-1', table_id: 'tbl-default-1', status: 'pending' },
                      { id: 'rsv-b-1', table_id: 'tbl-b-1', status: 'pending' },
                    ],
                  };
                }
                return { results: [] };
              }),
              run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
            })),
          };
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      const listRsvReq = await authRequest('GET', '/', 'supervisor', 'tenant_sadec_02');
      const listRsvRes = await reservationsRouter.fetch(listRsvReq, env);
      expect(listRsvRes.status).toBe(200);
      const listRsvJson = (await listRsvRes.json()) as any;
      expect(listRsvJson.data).toHaveLength(1);
      expect(listRsvJson.data[0].id).toBe('rsv-b-1');

      const approveCrossRsvReq = await authRequest('PATCH', '/rsv-default-1/approve', 'supervisor', 'tenant_sadec_02');
      const approveCrossRsvRes = await reservationsRouter.fetch(approveCrossRsvReq, env);
      expect(approveCrossRsvRes.status).toBe(404);

      const listIngReq = await authRequest('GET', '/api/inventory/ingredients', 'supervisor', 'tenant_sadec_02');
      const listIngRes = await openApiInventoryRouter.fetch(listIngReq, env);
      expect(listIngRes.status).toBe(200);
      const listIngJson = (await listIngRes.json()) as any;
      expect(listIngJson.data).toHaveLength(1);
      expect(listIngJson.data[0].id).toBe('ing-b-1');

      const getCrossIngReq = await authRequest('GET', '/api/inventory/ingredients/ing-default-1', 'supervisor', 'tenant_sadec_02');
      const getCrossIngRes = await openApiInventoryRouter.fetch(getCrossIngReq, env);
      expect(getCrossIngRes.status).toBe(404);

      const movCrossIngReq = await authRequest('POST', '/api/inventory/movements', 'supervisor', 'tenant_sadec_02', {
        ingredientId: 'ing-default-1',
        type: 'in',
        quantity: 5,
        notes: 'cross-tenant stock adjustment attempt',
      });
      const movCrossIngRes = await openApiInventoryRouter.fetch(movCrossIngReq, env);
      expect(movCrossIngRes.status).toBe(404);
    });
  });

  describe('9. OpenAPI Staff, Suppliers, Purchase Orders, Movements, Table Zones & Audit Logs Tenant Isolation', () => {
    it('scopes GET /api/auth/staff and /api/staff by tenant, allows supervisor read access, and blocks non-admin from creating admin role', async () => {
      const staffDefault = { id: 'st-def-1', name: 'Staff Default', email: 'def@aura.vn', role: 'staff', tenant_id: 'default', is_active: 1, auth_version: 1, created_at: '2026-10-30T00:00:00Z' };
      const staffSadec = { id: 'st-sad-1', name: 'Staff Sadec', email: 'sad@aura.vn', role: 'staff', tenant_id: 'tenant_sadec_02', is_active: 1, auth_version: 1, created_at: '2026-10-30T00:00:00Z' };

      let currentCallerRole = 'supervisor';
      let currentCallerTenant = 'tenant_sadec_02';
      const mockDb = {
        prepare: vi.fn((sql: string) => {
          return {
            all: vi.fn(async () => ({ results: [staffSadec] })),
            bind: vi.fn((...args: unknown[]) => ({
              first: vi.fn(async () => {
                if (/COUNT\(\*\)/i.test(sql)) return { total: 1 };
                if (/FROM users WHERE id = \?/i.test(sql)) {
                  const id = String(args[0]);
                  if (id === `user-${currentCallerRole}`) {
                    return staffAccountRow(currentCallerRole, currentCallerTenant);
                  }
                  const reqTenant = String(args[1] || '');
                  if (id === 'st-def-1' && (!reqTenant || reqTenant === 'default')) return staffDefault;
                  if (id === 'st-sad-1' && (!reqTenant || reqTenant === 'tenant_sadec_02')) return staffSadec;
                }
                return null;
              }),
              all: vi.fn(async () => {
                if (sql.includes("COALESCE(NULLIF(tenant_id, ''), 'default') = ?")) {
                  const t = String(args[0]);
                  return { results: t === 'tenant_sadec_02' ? [staffSadec] : [staffDefault] };
                }
                return { results: [staffDefault, staffSadec] };
              }),
              run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
            })),
          };
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. Supervisor in tenant_sadec_02 can list GET /api/auth/staff and sees only tenant_sadec_02
      const authStaffReq = await authRequest('GET', '/api/auth/staff', 'supervisor', 'tenant_sadec_02');
      const authStaffRes = await authRoutes.fetch(authStaffReq, env);
      expect(authStaffRes.status).toBe(200);
      const authStaffJson = (await authStaffRes.json()) as any;
      expect(authStaffJson.data.staff).toHaveLength(1);
      expect(authStaffJson.data.staff[0].id).toBe('st-sad-1');

      // 2. Supervisor in tenant_sadec_02 can list GET /api/staff and read own-tenant staff, but 404 on default tenant staff
      const openApiStaffListReq = await authRequest('GET', '/api/staff', 'supervisor', 'tenant_sadec_02');
      const openApiStaffListRes = await openApiStaffRouter.fetch(openApiStaffListReq, env);
      expect(openApiStaffListRes.status).toBe(200);

      const getCrossStaffReq = await authRequest('GET', '/api/staff/st-def-1', 'supervisor', 'tenant_sadec_02');
      const getCrossStaffRes = await openApiStaffRouter.fetch(getCrossStaffReq, env);
      expect(getCrossStaffRes.status).toBe(404);

      // 3. Supervisor is blocked (403) from POST /api/staff
      const supCreateStaffReq = await authRequest('POST', '/api/staff', 'supervisor', 'tenant_sadec_02', {
        name: 'New Barista',
        email: 'barista2@aura.vn',
        password: 'Password123!',
        role: 'staff',
      });
      const supCreateStaffRes = await openApiStaffRouter.fetch(supCreateStaffReq, env);
      expect(supCreateStaffRes.status).toBe(403);

      // 4. Owner (non-admin) is blocked (403) from creating role: 'admin' via POST /api/staff and POST /api/auth/register-staff
      currentCallerRole = 'owner';
      const ownerCreateAdminReq = await authRequest('POST', '/api/staff', 'owner', 'tenant_sadec_02', {
        name: 'Rogue Admin',
        email: 'rogueadmin@aura.vn',
        password: 'Password123!',
        role: 'admin',
      });
      const ownerCreateAdminRes = await openApiStaffRouter.fetch(ownerCreateAdminReq, env);
      expect(ownerCreateAdminRes.status).toBe(403);

      const ownerRegAdminReq = await authRequest('POST', '/api/auth/register-staff', 'owner', 'tenant_sadec_02', {
        name: 'Rogue Admin 2',
        email: 'rogueadmin2@aura.vn',
        password: 'Password123!',
        role: 'admin',
      });
      const ownerRegAdminRes = await authRoutes.fetch(ownerRegAdminReq, env);
      expect(ownerRegAdminRes.status).toBe(403);
    });

    it('isolates suppliers, purchase orders, stock movements, table zones, and audit logs across tenants', async () => {
      const supDefault = { id: 'sup-def-1', name: 'Default Beans Co', is_active: 1 };
      const supSadec = { id: 'sup-sad-1', name: 'Sadec Milk Co', is_active: 1, tenant_id: 'tenant_sadec_02' };
      const poDefault = { id: 'po-def-1', supplier_id: 'sup-def-1', status: 'pending', created_by: 'user-owner-default' };
      const poSadec = { id: 'po-sad-1', supplier_id: 'sup-sad-1', status: 'pending', created_by: 'user-supervisor' };
      const movDefault = { id: 'mov-def-1', ingredient_id: 'ing-def-1', type: 'in', quantity: 5, created_at: '2026-10-30T00:00:00Z' };
      const movSadec = { id: 'mov-sad-1', ingredient_id: 'ing-sad-1', type: 'in', quantity: 10, created_at: '2026-10-30T00:00:00Z' };
      const zoneDefault = { id: 'zone-def-1', slug: 'indoor', name: 'Indoor Default', sort_order: 0, is_active: 1, location_id: 'default' };
      const zoneSadec = { id: 'zone-sad-1', slug: 'garden', name: 'Garden Sadec', sort_order: 1, is_active: 1, location_id: 'tenant_sadec_02' };
      const auditDefault = { id: 1, actor_id: 'user-owner-default', actor_name: 'Owner Def', action: 'order.create', resource_type: 'order', resource_id: 'ord-1', details: '{"tenant_id":"default"}', ip_address: null, created_at: '2026-10-30T00:00:00Z' };
      const auditSadec = { id: 2, actor_id: 'user-supervisor', actor_name: 'Sup Sadec', action: 'order.create', resource_type: 'order', resource_id: 'ord-2', details: '{"tenant_id":"tenant_sadec_02"}', ip_address: null, created_at: '2026-10-30T00:00:00Z' };

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          return {
            all: vi.fn(async () => ({ results: [] })),
            bind: vi.fn((...args: unknown[]) => ({
              first: vi.fn(async () => {
                if (/COUNT\(\*\)/i.test(sql)) return { total: 2 };
                if (/FROM suppliers WHERE id = \?/i.test(sql)) {
                  if (args[0] === 'sup-def-1') return supDefault;
                  if (args[0] === 'sup-sad-1') return supSadec;
                }
                if (/FROM purchase_orders.*WHERE.*id = \?/is.test(sql)) {
                  if (args[0] === 'po-def-1') return poDefault;
                  if (args[0] === 'po-sad-1') return poSadec;
                }
                if (/FROM users WHERE id = \?/i.test(sql)) {
                  if (args[0] === 'user-owner-default') return { id: 'user-owner-default', tenant_id: 'default' };
                  if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
                }
                if (/FROM inventory_items WHERE id = \?/i.test(sql)) {
                  if (args[0] === 'ing-def-1') return { id: 'ing-def-1', tenant_id: 'default', cost_per_unit: 100 };
                  if (args[0] === 'ing-sad-1') return { id: 'ing-sad-1', tenant_id: 'tenant_sadec_02', cost_per_unit: 100 };
                }
                if (/FROM table_zones WHERE id = \?/i.test(sql)) {
                  if (args[0] === 'zone-def-1') return zoneDefault;
                  if (args[0] === 'zone-sad-1') return zoneSadec;
                }
                return null;
              }),
              all: vi.fn(async () => {
                if (/FROM suppliers/i.test(sql)) return { results: [supDefault, supSadec] };
                if (/FROM purchase_orders/i.test(sql)) return { results: [poDefault, poSadec] };
                if (/FROM stock_movements/i.test(sql)) return { results: [movDefault, movSadec] };
                if (/FROM table_zones/i.test(sql)) return { results: [zoneDefault, zoneSadec] };
                if (/FROM audit_logs/i.test(sql)) return { results: [auditDefault, auditSadec] };
                return { results: [] };
              }),
              run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
            })),
          };
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. Suppliers: list returns only tenant_sadec_02; cross-tenant GET/PATCH returns 404
      const listSupReq = await authRequest('GET', '/api/inventory/suppliers', 'supervisor', 'tenant_sadec_02');
      const listSupRes = await openApiInventoryRouter.fetch(listSupReq, env);
      expect(listSupRes.status).toBe(200);
      const listSupJson = (await listSupRes.json()) as any;
      expect(listSupJson.data).toHaveLength(1);
      expect(listSupJson.data[0].id).toBe('sup-sad-1');

      const getCrossSupReq = await authRequest('GET', '/api/inventory/suppliers/sup-def-1', 'supervisor', 'tenant_sadec_02');
      expect((await openApiInventoryRouter.fetch(getCrossSupReq, env)).status).toBe(404);

      // 2. Purchase Orders: list returns only tenant_sadec_02; cross-tenant GET/PATCH/receive returns 404
      const listPoReq = await authRequest('GET', '/api/inventory/purchase-orders', 'supervisor', 'tenant_sadec_02');
      const listPoRes = await openApiInventoryRouter.fetch(listPoReq, env);
      expect(listPoRes.status).toBe(200);
      const listPoJson = (await listPoRes.json()) as any;
      expect(listPoJson.data).toHaveLength(1);
      expect(listPoJson.data[0].id).toBe('po-sad-1');

      const getCrossPoReq = await authRequest('GET', '/api/inventory/purchase-orders/po-def-1', 'supervisor', 'tenant_sadec_02');
      expect((await openApiInventoryRouter.fetch(getCrossPoReq, env)).status).toBe(404);

      // 3. Movements: list returns only movements for tenant_sadec_02 ingredients
      const listMovReq = await authRequest('GET', '/api/inventory/movements', 'supervisor', 'tenant_sadec_02');
      const listMovRes = await openApiInventoryRouter.fetch(listMovReq, env);
      expect(listMovRes.status).toBe(200);
      const listMovJson = (await listMovRes.json()) as any;
      expect(listMovJson.data).toHaveLength(1);
      expect(listMovJson.data[0].id).toBe('mov-sad-1');

      // 4. Table Zones: list returns only tenant_sadec_02 zones; cross-tenant GET/PATCH/DELETE returns 404
      const listZoneReq = await authRequest('GET', '/api/table-zones', 'supervisor', 'tenant_sadec_02');
      const listZoneRes = await openApiTablesRouter.fetch(listZoneReq, env);
      expect(listZoneRes.status).toBe(200);
      const listZoneJson = (await listZoneRes.json()) as any;
      expect(listZoneJson.data.zones).toHaveLength(1);
      expect(listZoneJson.data.zones[0].id).toBe('zone-sad-1');

      const getCrossZoneReq = await authRequest('GET', '/api/table-zones/zone-def-1', 'supervisor', 'tenant_sadec_02');
      expect((await openApiTablesRouter.fetch(getCrossZoneReq, env)).status).toBe(404);

      // 5. Audit Logs: supervisor is authorized and receives only tenant_sadec_02 rows in query and export
      const listAuditReq = await authRequest('GET', '/', 'supervisor', 'tenant_sadec_02');
      const listAuditRes = await adminAuditLogsRouter.fetch(listAuditReq, env);
      expect(listAuditRes.status).toBe(200);
      const listAuditJson = (await listAuditRes.json()) as any;
      expect(listAuditJson.rows).toHaveLength(1);
      expect(listAuditJson.rows[0].actor_id).toBe('user-supervisor');

      const exportAuditReq = await authRequest('GET', '/export', 'supervisor', 'tenant_sadec_02');
      const exportAuditRes = await adminAuditLogsRouter.fetch(exportAuditReq, env);
      expect(exportAuditRes.status).toBe(200);
      const csvText = await exportAuditRes.text();
      expect(csvText).toContain('user-supervisor');
      expect(csvText).not.toContain('user-owner-default');
    });
  });

  describe('10. CRM, Campaigns & OpenAPI Cron Multi-Tenant Isolation & Role Hardening (F1–F3)', () => {
    it('isolates CRM fulfillment, customer profile/consent & segments per tenant and enables supervisor access', async () => {
      const nowIso = new Date().toISOString();
      const custDefault = {
        id: 'cust-def-1',
        name: 'Default Customer',
        phone: '0901000001',
        loyalty_tier: 'silver',
        lifetime_points: 120,
        tenant_id: null,
        last_order_at: nowIso,
        first_order_at: nowIso,
        order_count: 2,
      };
      const custSadec = {
        id: 'cust-sad-1',
        name: 'SaDec Customer',
        phone: '0902000002',
        loyalty_tier: 'gold',
        lifetime_points: 250,
        tenant_id: 'tenant_sadec_02',
        last_order_at: nowIso,
        first_order_at: nowIso,
        order_count: 3,
      };
      const orderDefault = {
        id: 'ord-def-1',
        status: 'pending',
        order_type: 'pickup',
        channel: 'pickup',
        customer_id: 'cust-def-1',
        tenant_id: 'default',
        created_at: nowIso,
      };
      const orderSadec = {
        id: 'ord-sad-1',
        status: 'pending',
        order_type: 'pickup',
        channel: 'pickup',
        customer_id: 'cust-sad-1',
        tenant_id: 'tenant_sadec_02',
        created_at: nowIso,
      };

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-admin') return staffAccountRow('admin', 'default');
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            if (args[0] === 'cust-def-1') return custDefault;
            if (args[0] === 'cust-sad-1') return custSadec;
          }
          if (/FROM orders WHERE id = \?/i.test(sql)) {
            if (args[0] === 'ord-def-1') return orderDefault;
            if (args[0] === 'ord-sad-1') return orderSadec;
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM customers/i.test(sql)) {
            return { results: [custDefault, custSadec] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. Supervisor in tenant_sadec_02 can read own tenant order fulfillment, blocked (403) on default tenant order
      const ownFulfillReq = await authRequest('GET', '/orders/ord-sad-1/fulfillment', 'supervisor', 'tenant_sadec_02');
      const ownFulfillRes = await crmRouter.fetch(ownFulfillReq, env);
      expect(ownFulfillRes.status).toBe(200);

      const crossFulfillReq = await authRequest('GET', '/orders/ord-def-1/fulfillment', 'supervisor', 'tenant_sadec_02');
      const crossFulfillRes = await crmRouter.fetch(crossFulfillReq, env);
      expect(crossFulfillRes.status).toBe(403);

      // 2. Supervisor in tenant_sadec_02 is blocked (403) on default tenant customer profile & consent
      const crossProfileReq = await authRequest('GET', '/customers/cust-def-1/profile', 'supervisor', 'tenant_sadec_02');
      expect((await crmRouter.fetch(crossProfileReq, env)).status).toBe(403);

      const crossConsentReq = await authRequest('PATCH', '/account/consent', 'supervisor', 'tenant_sadec_02', {
        purpose: 'marketing_sms',
        granted: true,
        customerId: 'cust-def-1',
      });
      expect((await crmRouter.fetch(crossConsentReq, env)).status).toBe(403);

      // 3. Segments list & segment customers are scoped to tenant_sadec_02 for supervisor, while HQ admin sees both
      const segListReq = await authRequest('GET', '/segments', 'supervisor', 'tenant_sadec_02');
      const segListRes = await crmRouter.fetch(segListReq, env);
      expect(segListRes.status).toBe(200);
      const segListJson = (await segListRes.json()) as any;
      const newFirstWeek = segListJson.data.find((s: any) => s.key === 'new_first_week');
      expect(newFirstWeek.count).toBe(1);
      expect(newFirstWeek.customers[0].id).toBe('cust-sad-1');

      const segCustReq = await authRequest('GET', '/segments/new_first_week/customers', 'supervisor', 'tenant_sadec_02');
      const segCustRes = await crmRouter.fetch(segCustReq, env);
      expect(segCustRes.status).toBe(200);
      const segCustJson = (await segCustRes.json()) as any;
      expect(segCustJson.data.count).toBe(1);
      expect(segCustJson.data.customers).toHaveLength(1);
      expect(segCustJson.data.customers[0].id).toBe('cust-sad-1');

      const adminSegCustReq = await authRequest('GET', '/segments/new_first_week/customers?tenant_id=*', 'admin', 'default');
      const adminSegCustRes = await crmRouter.fetch(adminSegCustReq, env);
      expect(adminSegCustRes.status).toBe(200);
      const adminSegCustJson = (await adminSegCustRes.json()) as any;
      expect(adminSegCustJson.data.count).toBe(2);
    });

    it('restricts campaign config mutations to owner/manager/admin and scopes campaign stats and cron jobs/runs by tenant', async () => {
      const nowIso = '2026-10-31T10:00:00.000Z';
      const jobDefId = '11111111-1111-4111-8111-111111111111';
      const jobSadId = '22222222-2222-4222-8222-222222222222';
      const runDefId = '33333333-3333-4333-8333-333333333333';
      const runSadId = '44444444-4444-4444-8444-444444444444';
      const jobDefault = {
        id: jobDefId,
        name: 'Default Reconcile',
        cron_expression: '0 2 * * *',
        handler: 'payment-reconcile',
        is_active: 1,
        status: 'pending',
        created_by: 'user-owner-default',
        created_at: nowIso,
        updated_at: nowIso,
      };
      const jobSadec = {
        id: jobSadId,
        name: 'SaDec Sync',
        cron_expression: '0 3 * * *',
        handler: 'inventory-sync',
        is_active: 1,
        status: 'pending',
        created_by: 'user-manager-sadec',
        created_at: nowIso,
        updated_at: nowIso,
      };
      const runDefault = {
        id: runDefId,
        job_id: jobDefId,
        status: 'failed',
        duration_ms: 120,
        started_at: nowIso,
        created_at: nowIso,
      };
      const runSadec = {
        id: runSadId,
        job_id: jobSadId,
        status: 'success',
        duration_ms: 80,
        started_at: nowIso,
        created_at: nowIso,
      };

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-staff') return staffAccountRow('staff', 'tenant_sadec_02');
            if (args[0] === 'user-manager-sadec' || args[0] === 'user-manager') return staffAccountRow('manager', 'tenant_sadec_02');
            if (args[0] === 'user-owner-default') return { id: 'user-owner-default', role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 };
          }
          if (/FROM cron_jobs WHERE id = \?/i.test(sql)) {
            if (args[0] === jobDefId) return jobDefault;
            if (args[0] === jobSadId) return jobSadec;
          }
          if (/FROM cron_runs WHERE id = \?/i.test(sql)) {
            if (args[0] === runDefId) return runDefault;
            if (args[0] === runSadId) return runSadec;
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM campaign_logs/i.test(sql)) {
            return {
              results: [
                { trigger: 'welcome', status: 'sent', sent_at: nowIso, customer_id: 'cust-def-1' },
                { trigger: 'welcome', status: 'sent', sent_at: nowIso, customer_id: 'cust-sad-1' },
                { trigger: 'birthday', status: 'sent', sent_at: nowIso, customer_id: 'cust-sad-1' },
              ],
            };
          }
          if (/FROM customers/i.test(sql)) {
            return {
              results: [
                { id: 'cust-def-1', tenant_id: 'default' },
                { id: 'cust-sad-1', tenant_id: 'tenant_sadec_02' },
              ],
            };
          }
          if (/FROM cron_jobs/i.test(sql)) {
            return { results: [jobDefault, jobSadec] };
          }
          if (/FROM cron_runs/i.test(sql)) {
            return { results: [runDefault, runSadec] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. Campaigns: supervisor can read stats/all (scoped to tenant_sadec_02), but staff & supervisor get 403 on PUT/DELETE /:trigger
      const statsReq = await authRequest('GET', '/stats/all', 'supervisor', 'tenant_sadec_02');
      const statsRes = await campaignsRouter.fetch(statsReq, env);
      expect(statsRes.status).toBe(200);
      const statsJson = (await statsRes.json()) as any;
      expect(statsJson.data.welcome.total_sent).toBe(1);
      expect(statsJson.data.birthday.total_sent).toBe(1);

      const staffMutateCampReq = await authRequest('PUT', '/welcome', 'staff', 'tenant_sadec_02', { is_active: 0 });
      expect((await campaignsRouter.fetch(staffMutateCampReq, env)).status).toBe(403);

      const supDeleteCampReq = await authRequest('DELETE', '/welcome', 'supervisor', 'tenant_sadec_02');
      expect((await campaignsRouter.fetch(supDeleteCampReq, env)).status).toBe(403);

      // 2. OpenAPI Cron: supervisor can list jobs & summary (scoped to tenant_sadec_02), blocked (403) on POST /api/cron/jobs, and 404 on cross-tenant job/run
      const cronListReq = await authRequest('GET', '/api/cron/jobs', 'supervisor', 'tenant_sadec_02');
      const cronListRes = await openApiCronRouter.fetch(cronListReq, env);
      expect(cronListRes.status).toBe(200);
      const cronListJson = (await cronListRes.json()) as any;
      expect(cronListJson.data.jobs).toHaveLength(1);
      expect(cronListJson.data.jobs[0].id).toBe(jobSadId);

      const cronSumReq = await authRequest('GET', '/api/cron/summary', 'supervisor', 'tenant_sadec_02');
      const cronSumRes = await openApiCronRouter.fetch(cronSumReq, env);
      expect(cronSumRes.status).toBe(200);
      const cronSumJson = (await cronSumRes.json()) as any;
      expect(cronSumJson.data.totalJobs).toBe(1);
      expect(cronSumJson.data.totalRuns).toBe(1);
      expect(cronSumJson.data.successfulRuns).toBe(1);
      expect(cronSumJson.data.failedRuns).toBe(0);

      const supCreateCronReq = await authRequest('POST', '/api/cron/jobs', 'supervisor', 'tenant_sadec_02', {
        name: 'Unauthorized Job',
        cronExpression: '0 4 * * *',
        handler: 'custom',
      });
      expect((await openApiCronRouter.fetch(supCreateCronReq, env)).status).toBe(403);

      const crossCronGetReq = await authRequest('GET', `/api/cron/jobs/${jobDefId}`, 'manager', 'tenant_sadec_02');
      expect((await openApiCronRouter.fetch(crossCronGetReq, env)).status).toBe(404);

      const crossRunGetReq = await authRequest('GET', `/api/cron/runs/${runDefId}`, 'manager', 'tenant_sadec_02');
      expect((await openApiCronRouter.fetch(crossRunGetReq, env)).status).toBe(404);
    });
  });

  describe('11. Promotions, Loyalty Admin, Broadcast, Birthday, Reviews & Checkin Multi-Tenant Hardening (G1–G3)', () => {
    it('isolates OpenAPI promotions pagination & summary and OpenAPI/Admin loyalty customer-backed accounts per tenant (G1–G2)', async () => {
      const nowIso = new Date().toISOString();
      const promoDefault = {
        id: '11111111-1111-4111-8111-111111111191',
        code: 'DEF50',
        name: 'Default Promo',
        type: 'coupon',
        discount_type: 'fixed_amount',
        discount_value: 50000,
        min_order_amount: 0,
        usage_count: 2,
        per_user_limit: 1,
        start_date: '2026-01-01T00:00:00Z',
        end_date: '2027-12-31T00:00:00Z',
        is_active: 1,
        applicable_to: 'all',
        tenant_id: 'default',
        created_at: nowIso,
        updated_at: nowIso,
      };
      const promoSadec = {
        id: '22222222-2222-4222-8222-222222222292',
        code: 'SADEC25',
        name: 'SaDec Promo',
        type: 'happy_hour',
        discount_type: 'percentage',
        discount_value: 25,
        min_order_amount: 0,
        usage_count: 1,
        per_user_limit: 1,
        start_date: '2026-01-01T00:00:00Z',
        end_date: '2027-12-31T00:00:00Z',
        is_active: 1,
        applicable_to: 'all',
        tenant_id: 'tenant_sadec_02',
        created_at: nowIso,
        updated_at: nowIso,
      };
      const usageDefault = {
        id: 'u-def-1',
        promotion_id: promoDefault.id,
        order_id: 'ord-def-1',
        user_id: 'cust-def-1',
        discount_amount: 100000,
        created_at: nowIso,
      };
      const usageSadec = {
        id: 'u-sad-1',
        promotion_id: promoSadec.id,
        order_id: 'ord-sad-1',
        user_id: 'cust-sad-1',
        discount_amount: 25000,
        created_at: nowIso,
      };
      const custDefault = {
        id: 'cust-def-1',
        name: 'Default Member',
        phone: '0901111222',
        email: 'def@aura.vn',
        loyalty_points: 800,
        lifetime_points: 1200,
        loyalty_tier: 'silver',
        tenant_id: 'default',
      };
      const custSadec = {
        id: 'cust-sad-1',
        name: 'SaDec Member',
        phone: '0903333444',
        email: 'sad@aura.vn',
        loyalty_points: 300,
        lifetime_points: 500,
        loyalty_tier: 'gold',
        tenant_id: 'tenant_sadec_02',
      };
      const laDefault = {
        id: 'la_cust-def-1',
        user_id: 'cust-def-1',
        points_balance: 800,
        lifetime_points: 1200,
        tier: 'silver',
        tier_expires_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      const laSadec = {
        id: 'la_cust-sad-1',
        user_id: 'cust-sad-1',
        points_balance: 300,
        lifetime_points: 500,
        tier: 'gold',
        tier_expires_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      const txDefaultEarn = {
        id: 'ltx-def-1',
        account_id: laDefault.id,
        user_id: custDefault.id,
        type: 'earn',
        points: 1200,
        balance_after: 800,
        description: 'Order earn',
        created_at: nowIso,
      };
      const txSadecEarn = {
        id: 'ltx-sad-1',
        account_id: laSadec.id,
        user_id: custSadec.id,
        type: 'earn',
        points: 500,
        balance_after: 500,
        description: 'Order earn',
        created_at: nowIso,
      };
      const txSadecRedeem = {
        id: 'ltx-sad-2',
        account_id: laSadec.id,
        user_id: custSadec.id,
        type: 'redeem',
        points: -200,
        balance_after: 300,
        description: 'Redeem reward',
        created_at: nowIso,
      };

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-manager') return staffAccountRow('manager', 'tenant_sadec_02');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            if (args[0] === custDefault.id) return custDefault;
            if (args[0] === custSadec.id) return custSadec;
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM promotions/i.test(sql)) {
            return { results: [promoDefault, promoSadec] };
          }
          if (/FROM promotion_usages/i.test(sql)) {
            return { results: [usageDefault, usageSadec] };
          }
          if (/FROM loyalty_accounts/i.test(sql)) {
            return { results: [laDefault, laSadec] };
          }
          if (/FROM loyalty_transactions/i.test(sql)) {
            return { results: [txDefaultEarn, txSadecEarn, txSadecRedeem] };
          }
          if (/FROM customers/i.test(sql)) {
            return { results: [custDefault, custSadec] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. OpenAPI Promotions: page=1&limit=1 for tenant_sadec_02 filters BEFORE pagination
      const promoListReq = await authRequest('GET', '/api/promotions?page=1&limit=1', 'supervisor', 'tenant_sadec_02');
      const promoListRes = await openApiPromotionsRouter.fetch(promoListReq, env);
      expect(promoListRes.status).toBe(200);
      const promoListJson = (await promoListRes.json()) as any;
      expect(promoListJson.data.promotions).toHaveLength(1);
      expect(promoListJson.data.promotions[0].code).toBe('SADEC25');
      expect(promoListJson.data.meta.total).toBe(1);

      // 2. OpenAPI Promotions Summary: scoped to tenant_sadec_02
      const promoSumReq = await authRequest('GET', '/api/promotions/summary', 'supervisor', 'tenant_sadec_02');
      const promoSumRes = await openApiPromotionsRouter.fetch(promoSumReq, env);
      expect(promoSumRes.status).toBe(200);
      const promoSumJson = (await promoSumRes.json()) as any;
      expect(promoSumJson.data.totalPromotions).toBe(1);
      expect(promoSumJson.data.activePromotions).toBe(1);
      expect(promoSumJson.data.totalDiscountGiven).toBe(25000);
      expect(promoSumJson.data.topPromotions).toHaveLength(1);
      expect(promoSumJson.data.topPromotions[0].code).toBe('SADEC25');

      // 3. OpenAPI Loyalty Admin Accounts & Summary: customer-backed accounts isolated to tenant_sadec_02
      const loyAccReq = await authRequest('GET', '/api/loyalty/admin/accounts?page=1&limit=1', 'supervisor', 'tenant_sadec_02');
      const loyAccRes = await openApiLoyaltyRouter.fetch(loyAccReq, env);
      expect(loyAccRes.status).toBe(200);
      const loyAccJson = (await loyAccRes.json()) as any;
      expect(loyAccJson.data).toHaveLength(1);
      expect(loyAccJson.data[0].user_id).toBe('cust-sad-1');

      const loySumReq = await authRequest('GET', '/api/loyalty/admin/summary', 'supervisor', 'tenant_sadec_02');
      const loySumRes = await openApiLoyaltyRouter.fetch(loySumReq, env);
      expect(loySumRes.status).toBe(200);
      const loySumJson = (await loySumRes.json()) as any;
      expect(loySumJson.data.totalMembers).toBe(1);
      expect(loySumJson.data.totalPointsIssued).toBe(500);
      expect(loySumJson.data.totalPointsRedeemed).toBe(200);

      // 4. Admin Loyalty Dashboard Widgets & Tiers: scoped for tenant_sadec_02, wildcard for HQ owner
      const widSadReq = await authRequest('GET', '/widgets', 'supervisor', 'tenant_sadec_02');
      const widSadRes = await adminLoyaltyRouter.fetch(widSadReq, env);
      expect(widSadRes.status).toBe(200);
      const widSadJson = (await widSadRes.json()) as any;
      const sadTotalMembersWidget = widSadJson.data.find((w: any) => w.title === 'Total Members');
      const sadTopTierWidget = widSadJson.data.find((w: any) => w.title === 'Top Tier');
      expect(sadTotalMembersWidget.value).toBe(1);
      expect(sadTopTierWidget.value).toBe('gold');

      const tiersSadReq = await authRequest('GET', '/tiers', 'supervisor', 'tenant_sadec_02');
      const tiersSadRes = await adminLoyaltyRouter.fetch(tiersSadReq, env);
      expect(tiersSadRes.status).toBe(200);
      const tiersSadJson = (await tiersSadRes.json()) as any;
      expect(tiersSadJson.data.total).toBe(1);
      expect(tiersSadJson.data.distribution).toEqual([{ tier: 'gold', count: 1, percentage: 100 }]);

      const widHqReq = await authRequest('GET', '/widgets?tenant_id=*', 'owner', 'default');
      const widHqRes = await adminLoyaltyRouter.fetch(widHqReq, env);
      expect(widHqRes.status).toBe(200);
      const widHqJson = (await widHqRes.json()) as any;
      const hqTotalMembersWidget = widHqJson.data.find((w: any) => w.title === 'Total Members');
      expect(hqTotalMembersWidget.value).toBe(2);
    });

    it('enforces broadcast admin roles and HQ wildcard/supervisor parity on birthday, reviews & checkin (G3)', async () => {
      const todayIso = new Date().toISOString();
      const todayMmDd = todayIso.slice(5, 10);
      const custDefault = {
        id: 'cust-def-1',
        name: 'Default Member',
        phone: '0901111222',
        email: 'def@aura.vn',
        date_of_birth: `1995-${todayMmDd}`,
        birthday: `1995-${todayMmDd}`,
        tenant_id: 'default',
      };
      const custSadec = {
        id: 'cust-sad-1',
        name: 'SaDec Member',
        phone: '0903333444',
        email: 'sad@aura.vn',
        date_of_birth: `1998-${todayMmDd}`,
        birthday: `1998-${todayMmDd}`,
        tenant_id: 'tenant_sadec_02',
      };
      const revDefault = {
        id: 'rev-def-1',
        order_id: 'ord-def-1',
        rating: 5,
        comment: 'Great Default',
        customer_name: 'Default Member',
        created_at: todayIso,
        order_tenant_id: 'default',
      };
      const revSadec = {
        id: 'rev-sad-1',
        order_id: 'ord-sad-1',
        rating: 4,
        comment: 'Good SaDec',
        customer_name: 'SaDec Member',
        created_at: todayIso,
        order_tenant_id: 'tenant_sadec_02',
      };
      const ciSadec = {
        id: 'ci-sad-1',
        customer_id: 'cust-sad-1',
        customer_name: 'SaDec Member',
        checkin_date: todayIso.slice(0, 10),
        checkin_time: todayIso,
        reward_amount: 5000,
        status: 'pending',
        staff_id: null,
        created_at: todayIso,
        customer_tenant_id: 'tenant_sadec_02',
      };

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-staff') return staffAccountRow('staff', 'tenant_sadec_02');
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            if (args[0] === 'cust-def-1') return custDefault;
            if (args[0] === 'cust-sad-1') return custSadec;
          }
          if (/FROM checkins WHERE id = \?/i.test(sql)) {
            if (args[0] === 'ci-sad-1') return ciSadec;
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM customers/i.test(sql)) return { results: [custDefault, custSadec] };
          if (/FROM reviews/i.test(sql)) return { results: [revDefault, revSadec] };
          if (/FROM checkins/i.test(sql)) return { results: [ciSadec] };
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. Broadcast: staff is rejected (403) from POST /api/broadcast/send
      const staffBroadcastReq = await authRequest('POST', '/api/broadcast/send', 'staff', 'tenant_sadec_02', {
        segment: 'all',
        channel: 'sms',
        message: 'Unauthorized blast',
      });
      const staffBroadcastRes = await app.fetch(staffBroadcastReq, env);
      expect(staffBroadcastRes.status).toBe(403);

      // 2. Birthday: HQ owner with ?tenant_id=* can check eligibility of tenant_sadec_02 customer; supervisor can PUT /config
      const bdayHqReq = await authRequest('GET', '/check?customer_id=cust-sad-1&tenant_id=*', 'owner', 'default');
      // Attach user context via app route /api/admin/birthday
      const bdayAppHqReq = await authRequest('GET', '/api/admin/birthday/check?customer_id=cust-sad-1&tenant_id=*', 'owner', 'default');
      const bdayAppHqRes = await app.fetch(bdayAppHqReq, env);
      expect(bdayAppHqRes.status).toBe(200);
      const bdayAppHqJson = (await bdayAppHqRes.json()) as any;
      expect(bdayAppHqJson.data.eligible).toBe(true);
      expect(bdayAppHqJson.data.customer_id).toBe('cust-sad-1');
      void bdayHqReq;

      const supBdayCfgReq = await authRequest('PUT', '/config', 'supervisor', 'tenant_sadec_02', { discountPercent: 20 });
      const supBdayCfgRes = await birthdayRouter.fetch(supBdayCfgReq, env);
      expect(supBdayCfgRes.status).toBe(200);

      // 3. Reviews: supervisor for tenant_sadec_02 only sees tenant_sadec_02 reviews even if spoofing X-Tenant-ID: default
      const revSadReq = await authRequest('GET', '/api/admin/../reviews', 'supervisor', 'tenant_sadec_02');
      revSadReq.headers.set('X-Tenant-ID', 'default');
      // Test reviewsRouter with authenticated user — unauthenticated X-Tenant-ID is now ignored (AB3 fix)
      const revDirectSadReq = await authRequest('GET', '/?page=1&limit=20', 'supervisor', 'tenant_sadec_02');
      const revDirectSadRes = await reviewsRouter.fetch(revDirectSadReq, env);
      const revDirectSadJson = (await revDirectSadRes.json()) as any;
      expect(revDirectSadJson.data).toHaveLength(1);
      expect(revDirectSadJson.data[0].id).toBe('rev-sad-1');

      // 4. Checkin: supervisor can list and approve tenant_sadec_02 checkin
      const ciListReq = await authRequest('GET', '/', 'supervisor', 'tenant_sadec_02');
      const ciListRes = await checkinRouter.fetch(ciListReq, env);
      expect(ciListRes.status).toBe(200);
      const ciListJson = (await ciListRes.json()) as any;
      expect(ciListJson.data).toHaveLength(1);
      expect(ciListJson.data[0].id).toBe('ci-sad-1');

      const ciApproveReq = await authRequest('PATCH', '/ci-sad-1/approve', 'supervisor', 'tenant_sadec_02');
      const ciApproveRes = await checkinRouter.fetch(ciApproveReq, env);
      expect(ciApproveRes.status).toBe(200);
    });
  });

  describe('12. Referrals, POS Customer Lookup, Table Sessions, Floor Plan, Signage & Admin QR/Sales Multi-Tenant Hardening (H1–H3)', () => {
    it('isolates customer referrals across tenants while allowing same-tenant referral apply (H1)', async () => {
      const custDefault = {
        id: 'cust-def-1',
        name: 'Default Referrer',
        phone: '0901111222',
        email: 'def@aura.vn',
        loyalty_points: 100,
        lifetime_points: 100,
        tenant_id: 'default',
      };
      const custSadecReferrer = {
        id: 'cust-sad-1',
        name: 'SaDec Referrer',
        phone: '0903333444',
        email: 'sad1@aura.vn',
        loyalty_points: 200,
        lifetime_points: 200,
        tenant_id: 'tenant_sadec_02',
      };
      const custSadecReferee = {
        id: 'cust-sad-2',
        name: 'SaDec Referee',
        phone: '0905555666',
        email: 'sad2@aura.vn',
        loyalty_points: 0,
        lifetime_points: 0,
        tenant_id: 'tenant_sadec_02',
      };
      const rcDefault = {
        id: 'rc-def-1',
        customer_id: 'cust-def-1',
        code: 'FNB-DEF123',
        times_used: 0,
        total_points_earned: 0,
        created_at: '2026-10-31T00:00:00.000Z',
      };
      const rcSadec = {
        id: 'rc-sad-1',
        customer_id: 'cust-sad-1',
        code: 'FNB-SAD456',
        times_used: 0,
        total_points_earned: 0,
        created_at: '2026-10-31T00:00:00.000Z',
      };

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            if (args[0] === 'cust-def-1') return custDefault;
            if (args[0] === 'cust-sad-1') return custSadecReferrer;
            if (args[0] === 'cust-sad-2') return custSadecReferee;
          }
          if (/FROM referral_codes WHERE code = \?/i.test(sql)) {
            if (args[0] === 'FNB-DEF123') return rcDefault;
            if (args[0] === 'FNB-SAD456') return rcSadec;
          }
          if (/FROM referrals WHERE referred_customer_id = \?/i.test(sql)) {
            if (/AND status = \?/i.test(sql)) {
              return { id: 'ref-pend-1', bonus_type: 'cashback' };
            }
            return null;
          }
          return null;
        }),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // SaDec customer token
      const sadecCustToken = await generateJWT(
        { id: 'cust-sad-2', email: 'sad2@aura.vn', role: 'customer', tenantId: 'tenant_sadec_02' },
        TEST_JWT_SECRET,
        3600
      );

      // 1. SaDec customer cannot apply Default store's referral code (404)
      const crossApplyRes = await referralRouter.fetch(
        new Request('http://localhost/apply', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sadecCustToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: 'FNB-DEF123' }),
        }),
        env
      );
      expect(crossApplyRes.status).toBe(404);

      // 2. SaDec customer CAN apply SaDec referrer's code (200)
      const sameApplyRes = await referralRouter.fetch(
        new Request('http://localhost/apply', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sadecCustToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: 'FNB-SAD456' }),
        }),
        env
      );
      expect(sameApplyRes.status).toBe(200);

      // 3. applyReferralForNewCustomer helper also blocks cross-tenant referral
      const crossHelperRes = await applyReferralForNewCustomer(mockDb as any, 'cust-sad-2', 'FNB-DEF123');
      expect(crossHelperRes.success).toBe(false);
      expect(crossHelperRes.reason).toBe('referrer_not_found');
    });

    it('scopes POS customer lookup, Admin Sales CSV, Table Sessions, Floor Plan, Signage & Admin QR with HQ wildcard support (H2–H3)', async () => {
      const todayIso = new Date().toISOString();
      const custSadecPos = {
        id: 'cust-sad-1',
        name: 'SaDec POS VIP',
        phone: '0903333444',
        email: 'sad@aura.vn',
        loyalty_tier: 'gold',
        loyalty_points: 300,
        lifetime_points: 300,
        created_at: todayIso,
        tenant_id: 'tenant_sadec_02',
        cashback_balance: 45000,
        total_earned: 60000,
        total_spent: 15000,
        visit_count: 4,
      };
      const tblDefault = { id: 'tbl-def-1', table_number: 1, zone: 'Indoor', capacity: 4, status: 'Occupied', tenant_id: 'default' };
      const tblSadec = { id: 'tbl-sad-1', table_number: 2, zone: 'Garden', capacity: 4, status: 'Occupied', tenant_id: 'tenant_sadec_02' };
      const sesDefault = { id: 'ses-def-1', table_id: 'tbl-def-1', status: 'active', opened_at: todayIso, order_count: 1, total_amount: 50000 };
      const sesSadec = { id: 'ses-sad-1', table_id: 'tbl-sad-1', status: 'active', opened_at: todayIso, order_count: 2, total_amount: 95000 };
      const prodDefault = {
        product_name: 'Default Latte',
        price: 45000,
        image_url: '',
        description: '',
        category_id: 1,
        category_name: 'Coffee',
        category_sort_order: 1,
        tenant_id: 'default',
      };
      const prodSadec = {
        product_name: 'SaDec Lotus Tea',
        price: 55000,
        image_url: '',
        description: '',
        category_id: 2,
        category_name: 'Tea',
        category_sort_order: 2,
        tenant_id: 'tenant_sadec_02',
      };

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
          }
          if (/FROM customers c/i.test(sql) && /LEFT JOIN cashback_wallets/i.test(sql)) {
            const tenantArg = args[0];
            if (tenantArg === '*' || tenantArg === 'tenant_sadec_02') return custSadecPos;
            return null;
          }
          if (/FROM cafe_tables WHERE id = \?/i.test(sql)) {
            if (args[0] === 'tbl-def-1') return tblDefault;
            if (args[0] === 'tbl-sad-1') return tblSadec;
          }
          if (/FROM table_sessions WHERE table_id = \? AND status = 'active'/i.test(sql)) {
            if (args[0] === 'tbl-def-1') return sesDefault;
            if (args[0] === 'tbl-sad-1') return sesSadec;
          }
          if (/FROM table_sessions WHERE id = \?/i.test(sql)) {
            if (args[0] === 'ses-def-1') return sesDefault;
            if (args[0] === 'ses-sad-1') return sesSadec;
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM cafe_tables/i.test(sql) && /GROUP BY status/i.test(sql)) {
            const tenantArg = args[0];
            if (tenantArg === '*') return { results: [{ status: 'Occupied', c: 2 }] };
            return { results: [{ status: 'Occupied', c: 1 }] };
          }
          if (/FROM cafe_tables/i.test(sql)) {
            return { results: [tblDefault, tblSadec] };
          }
          if (/FROM table_sessions/i.test(sql)) {
            return { results: [sesDefault, sesSadec] };
          }
          if (/FROM products p/i.test(sql)) {
            return { results: [prodDefault, prodSadec] };
          }
          if (/FROM orders/i.test(sql)) {
            const tenantArg = args[0];
            const ordDef = { id: 'ord-def-1', customer_name: 'Def', items: '[]', total: 50000, payment_method: 'cash', status: 'completed', created_at: todayIso };
            const ordSad = { id: 'ord-sad-1', customer_name: 'Sad', items: '[]', total: 95000, payment_method: 'payos', status: 'completed', created_at: todayIso };
            if (tenantArg === '*') return { results: [ordDef, ordSad] };
            if (tenantArg === 'tenant_sadec_02') return { results: [ordSad] };
            return { results: [ordDef] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        QR_SIGNING_SECRET: 'qr-signing-secret-test-123456',
        AURA_DB: mockDb as any,
      });

      // 1. POS Customer Lookup: HQ owner with ?tenant_id=* can look up SaDec customer; Default store supervisor without wildcard gets found: false
      const posHqReq = await authRequest('GET', '/?phone=0903333444&tenant_id=*', 'owner', 'default');
      const posHqRes = await posCustomerRouter.fetch(posHqReq, env);
      expect(posHqRes.status).toBe(200);
      const posHqJson = (await posHqRes.json()) as any;
      expect(posHqJson.found).toBe(true);
      expect(posHqJson.customer.id).toBe('cust-sad-1');

      // 2. Table Sessions: SaDec supervisor attempting POST / on Default store table tbl-def-1 gets 404 (not 409 leaking ses-def-1)
      const crossOpenSesReq = await authRequest('POST', '/', 'supervisor', 'tenant_sadec_02', { table_id: 'tbl-def-1' });
      const crossOpenSesRes = await tableSessionsRouter.fetch(crossOpenSesReq, env);
      expect(crossOpenSesRes.status).toBe(404);

      const hqListSesReq = await authRequest('GET', '/?tenant_id=*', 'owner', 'default');
      const hqListSesRes = await tableSessionsRouter.fetch(hqListSesReq, env);
      expect(hqListSesRes.status).toBe(200);
      const hqListSesJson = (await hqListSesRes.json()) as any;
      expect(hqListSesJson.data).toHaveLength(2);

      // 3. Floor Plan & Summary: HQ owner with ?tenant_id=* sees all 2 tables
      const fpHqReq = await authRequest('GET', '/?tenant_id=*', 'owner', 'default');
      const fpHqRes = await floorPlanRouter.fetch(fpHqReq, env);
      expect(fpHqRes.status).toBe(200);
      const fpHqJson = (await fpHqRes.json()) as any;
      expect(fpHqJson.summary.total).toBe(2);

      const fpSumHqReq = await authRequest('GET', '/summary?tenant_id=*', 'owner', 'default');
      const fpSumHqRes = await floorPlanRouter.fetch(fpSumHqReq, env);
      expect(fpSumHqRes.status).toBe(200);
      const fpSumHqJson = (await fpSumHqRes.json()) as any;
      expect(fpSumHqJson.data.total).toBe(2);

      // 4. Signage: SaDec supervisor spoofing X-Tenant-ID: default still only receives SaDec menu; HQ owner with ?tenant_id=* sees both
      const sigSpoofReq = await authRequest('GET', '/menu', 'supervisor', 'tenant_sadec_02');
      sigSpoofReq.headers.set('X-Tenant-ID', 'default');
      const sigSpoofRes = await signageRouter.fetch(sigSpoofReq, env);
      expect(sigSpoofRes.status).toBe(200);
      const sigSpoofJson = (await sigSpoofRes.json()) as any;
      expect(sigSpoofJson.data).toHaveLength(1);
      expect(sigSpoofJson.data[0].products[0].name).toBe('SaDec Lotus Tea');

      const sigHqReq = await authRequest('GET', '/menu?tenant_id=*', 'owner', 'default');
      const sigHqRes = await signageRouter.fetch(sigHqReq, env);
      expect(sigHqRes.status).toBe(200);
      const sigHqJson = (await sigHqRes.json()) as any;
      expect(sigHqJson.data).toHaveLength(2);

      // 5. Admin Sales CSV & Admin QR: HQ wildcard and supervisor role parity
      const csvHqReq = await authRequest('GET', '/csv?range=7d&tenant_id=*', 'owner', 'default');
      const csvHqRes = await adminSalesRouter.fetch(csvHqReq, env);
      expect(csvHqRes.status).toBe(200);
      const csvText = await csvHqRes.text();
      expect(csvText).toContain('ord-def-1');
      expect(csvText).toContain('ord-sad-1');

      const qrSupReq = await authRequest('GET', '/tables', 'supervisor', 'tenant_sadec_02');
      const qrSupRes = await adminQRRouter.fetch(qrSupReq, env);
      expect(qrSupRes.status).toBe(200);
      const qrSupJson = (await qrSupRes.json()) as any;
      expect(qrSupJson.data).toHaveLength(1);
      expect(qrSupJson.data[0].id).toBe('tbl-sad-1');
    });
  });

  describe('13. Subscriptions, Invoice Receipts, Customers Admin/Profile, Demand Forecast & Franchise Locations Hardening (I1–I3)', () => {
    it('enforces tenant isolation, HQ wildcard (?tenant_id=*), and supervisor parity on Subscriptions & Invoice Receipts (I1)', async () => {
      const todayDate = new Date().toISOString().slice(0, 10);
      const subDefaultActive = {
        id: 'sub-def-active',
        plan_id: 'plan-1',
        customer_id: 'cust-def-1',
        customer_name: 'Default Co',
        status: 'active',
        billing_cycle: 'monthly',
        next_billing_date: todayDate,
        amount_vnd: 5000000,
        zone: 'Indoor',
        tenant_id: 'default',
      };
      const subDefaultCancelled = {
        id: 'sub-def-canc',
        plan_id: 'plan-1',
        customer_id: 'cust-def-1',
        customer_name: 'Default Co Cancelled',
        status: 'cancelled',
        billing_cycle: 'monthly',
        next_billing_date: todayDate,
        amount_vnd: 5000000,
        zone: 'Indoor',
        tenant_id: 'default',
      };
      const subSadecActive = {
        id: 'sub-sad-active',
        plan_id: 'plan-1',
        customer_id: 'cust-sad-1',
        customer_name: 'SaDec Co',
        status: 'active',
        billing_cycle: 'monthly',
        next_billing_date: todayDate,
        amount_vnd: 3000000,
        zone: 'Garden',
        tenant_id: 'tenant_sadec_02',
      };
      const subSadecCancelled = {
        id: 'sub-sad-canc',
        plan_id: 'plan-1',
        customer_id: 'cust-sad-1',
        customer_name: 'SaDec Cancelled',
        status: 'cancelled',
        billing_cycle: 'monthly',
        next_billing_date: todayDate,
        amount_vnd: 3000000,
        zone: 'Garden',
        tenant_id: 'tenant_sadec_02',
      };
      const invSadec = {
        id: 'inv-sad-1',
        subscription_id: 'sub-sad-active',
        amount_vnd: 3000000,
        status: 'paid',
        period_start: '2026-10-01',
        period_end: '2026-11-01',
        invoice_number: 'INV-SAD-001',
        paid_at: '2026-10-02T10:00:00Z',
        payment_method: 'bank_transfer',
        customer_id: 'cust-sad-1',
        customer_name: 'SaDec Co',
        customer_email: 'sadec@aura.vn',
        subscription_tenant_id: 'tenant_sadec_02',
        plan_name: 'Container Pro',
      };

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-manager') return staffAccountRow('manager', 'default');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
          }
          if (/SELECT COALESCE\(SUM\(amount_vnd\), 0\) as mrr, COUNT\(\*\) as count FROM subscriptions/i.test(sql)) {
            const tenantArg = args[0];
            if (tenantArg === '*') return { mrr: 8000000, count: 2 };
            if (tenantArg === 'tenant_sadec_02') return { mrr: 3000000, count: 1 };
            return { mrr: 5000000, count: 1 };
          }
          if (/SELECT COALESCE\(AVG\(amount_vnd\), 0\) as avg FROM subscriptions/i.test(sql)) {
            const tenantArg = args[0];
            if (tenantArg === '*') return { avg: 4000000 };
            if (tenantArg === 'tenant_sadec_02') return { avg: 3000000 };
            return { avg: 5000000 };
          }
          if (/under_1m/i.test(sql)) {
            return { under_1m: 0, from_1m_to_3m: 0, from_3m_to_5m: 1, above_5m: 1 };
          }
          if (/SELECT COUNT\(\*\) as count FROM subscriptions/i.test(sql)) {
            return { count: 1 };
          }
          if (/FROM subscriptions WHERE id = \?/i.test(sql)) {
            if (args[0] === 'sub-def-canc') return subDefaultCancelled;
            if (args[0] === 'sub-sad-canc') return subSadecCancelled;
            if (args[0] === 'sub-sad-active') return subSadecActive;
          }
          if (/FROM subscription_invoices i/i.test(sql) && /WHERE i\.id = \?/i.test(sql)) {
            if (args[0] === 'inv-sad-1') return invSadec;
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM mrr_snapshots/i.test(sql)) {
            return { results: [{ snapshot_date: todayDate, mrr_vnd: 99000000, active_subscriptions: 25 }] };
          }
          if (/FROM subscriptions WHERE status = 'active' AND next_billing_date <= \?/i.test(sql)) {
            return { results: [subDefaultActive, subSadecActive] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. GET /stats: SaDec supervisor gets SaDec MRR (3M); HQ owner with ?tenant_id=* gets combined MRR (8M)
      const sadStatsReq = await authRequest('GET', '/stats', 'supervisor', 'tenant_sadec_02');
      const sadStatsRes = await subscriptionsRouter.fetch(sadStatsReq, env);
      expect(sadStatsRes.status).toBe(200);
      const sadStatsJson = (await sadStatsRes.json()) as any;
      expect(sadStatsJson.data.mrr_vnd).toBe(3000000);
      expect(sadStatsJson.data.active_subscriptions).toBe(1);

      const hqStatsReq = await authRequest('GET', '/stats?tenant_id=*', 'owner', 'default');
      const hqStatsRes = await subscriptionsRouter.fetch(hqStatsReq, env);
      expect(hqStatsRes.status).toBe(200);
      const hqStatsJson = (await hqStatsRes.json()) as any;
      expect(hqStatsJson.data.mrr_vnd).toBe(8000000);
      expect(hqStatsJson.data.active_subscriptions).toBe(2);

      // 2. GET /mrr: SaDec supervisor gets live tenant-scoped MRR (3M, source: 'live') instead of global mrr_snapshots (99M)
      const sadMrrReq = await authRequest('GET', '/mrr', 'supervisor', 'tenant_sadec_02');
      const sadMrrRes = await subscriptionsRouter.fetch(sadMrrReq, env);
      expect(sadMrrRes.status).toBe(200);
      const sadMrrJson = (await sadMrrRes.json()) as any;
      expect(sadMrrJson.data.source).toBe('live');
      expect(sadMrrJson.data.snapshots[0].mrr_vnd).toBe(3000000);

      // 3. DELETE /:id: SaDec supervisor cannot delete Default store's cancelled subscription (404), can delete SaDec's (200)
      const crossDelReq = await authRequest('DELETE', '/sub-def-canc', 'supervisor', 'tenant_sadec_02');
      const crossDelRes = await subscriptionsRouter.fetch(crossDelReq, env);
      expect(crossDelRes.status).toBe(404);

      const sameDelReq = await authRequest('DELETE', '/sub-sad-canc', 'supervisor', 'tenant_sadec_02');
      const sameDelRes = await subscriptionsRouter.fetch(sameDelReq, env);
      expect(sameDelRes.status).toBe(200);

      // 4. POST /invoices/generate: SaDec supervisor only generates 1 invoice (for sub-sad-active), not sub-def-active
      const genSadReq = await authRequest('POST', '/invoices/generate', 'supervisor', 'tenant_sadec_02');
      const genSadRes = await subscriptionsRouter.fetch(genSadReq, env);
      expect(genSadRes.status).toBe(200);
      const genSadJson = (await genSadRes.json()) as any;
      expect(genSadJson.generated_count).toBe(1);

      // 5. GET /api/subscriptions/invoices/:id/receipt: Default manager gets 404 on SaDec invoice; HQ owner with ?tenant_id=* gets 200
      const crossReceiptReq = await authRequest('GET', '/api/subscriptions/invoices/inv-sad-1/receipt', 'manager', 'default');
      const crossReceiptRes = await app.fetch(crossReceiptReq, env);
      expect(crossReceiptRes.status).toBe(404);

      const hqReceiptReq = await authRequest('GET', '/api/subscriptions/invoices/inv-sad-1/receipt?tenant_id=*', 'owner', 'default');
      const hqReceiptRes = await app.fetch(hqReceiptReq, env);
      expect(hqReceiptRes.status).toBe(200);
      const receiptText = await hqReceiptRes.text();
      expect(receiptText).toContain('INV-SAD-001');
    });

    it('enforces Customers Admin/Profile visit_count tenant scoping, HQ wildcard (?tenant_id=*), and Demand Forecast & Franchise Locations parity (I2–I3)', async () => {
      // Verify PROFILE_SQL correlates orders.tenant_id with customers.tenant_id
      expect(PROFILE_SQL).toContain("COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')");

      const todayIso = new Date().toISOString();
      const custDef = {
        id: 'cust-def-1',
        name: 'Default Customer',
        phone: '0901111222',
        email: 'def@aura.vn',
        loyalty_tier: 'gold',
        loyalty_points: 100,
        lifetime_points: 100,
        created_at: todayIso,
        tenant_id: 'default',
        visit_count: 2,
      };
      const custSad = {
        id: 'cust-sad-1',
        name: 'SaDec Customer',
        phone: '0903333444',
        email: 'sad@aura.vn',
        loyalty_tier: 'gold',
        loyalty_points: 250,
        lifetime_points: 250,
        created_at: todayIso,
        tenant_id: 'tenant_sadec_02',
        visit_count: 5,
      };
      const locDefault = {
        id: 'loc-def-1',
        tenant_id: 'default',
        code: 'AURA-HQ',
        name: 'AURA Default Container',
        city: 'Sa Đéc',
        royalty_percentage: 5.0,
        status: 'active',
      };
      const locSadec = {
        id: 'loc-sad-1',
        tenant_id: 'tenant_sadec_02',
        code: 'AURA-SAD02',
        name: 'AURA SaDec River',
        city: 'Sa Đéc',
        royalty_percentage: 6.0,
        status: 'active',
      };

      const capturedSqls: string[] = [];
      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
          }
          if (/SELECT COUNT\(\*\) as count FROM customers/i.test(sql) || /SELECT COUNT\(DISTINCT customer_phone\) as count FROM orders/i.test(sql)) {
            const tenantArg = args.find((a) => a === '*' || a === 'tenant_sadec_02' || a === 'default');
            if (tenantArg === '*') return { count: 2 };
            return { count: 1 };
          }
          if (/FROM franchise_locations WHERE id = \?/i.test(sql)) {
            if (args[0] === 'loc-def-1') return locDefault;
            if (args[0] === 'loc-sad-1') return locSadec;
          }
          if (/SELECT COUNT\(\*\) as order_count, COALESCE\(SUM\(total\), 0\) as gross_sales/i.test(sql)) {
            // Verify COALESCE(NULLIF(tenant_id, ''), 'default') = ? is used so legacy NULL tenant_id orders are counted
            expect(sql).toContain("COALESCE(NULLIF(tenant_id, ''), 'default') = ?");
            return { order_count: 4, gross_sales: 400000 };
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/SELECT COUNT\(\*\) as total FROM customers/i.test(sql)) {
            if (args[0] === '*') return { results: [{ total: 2 }] };
            return { results: [{ total: 1 }] };
          }
          if (/FROM customers c/i.test(sql) && /LEFT JOIN cashback_wallets/i.test(sql)) {
            if (args[0] === '*') return { results: [custDef, custSad] };
            if (args[0] === 'tenant_sadec_02') return { results: [custSad] };
            return { results: [custDef] };
          }
          if (/FROM orders/i.test(sql) && /strftime\('%w'/i.test(sql)) {
            if (args[0] === '*') {
              return {
                results: [
                  { total: 100000, created_at: todayIso, dow: '5', hour: '08' },
                  { total: 150000, created_at: todayIso, dow: '6', hour: '18' },
                ],
              };
            }
            return { results: [{ total: 150000, created_at: todayIso, dow: '6', hour: '18' }] };
          }
          if (/FROM orders/i.test(sql) && /GROUP BY hour/i.test(sql)) {
            if (args[0] === '*') return { results: [{ hour: '08', orders_count: 3 }, { hour: '18', orders_count: 4 }] };
            return { results: [{ hour: '18', orders_count: 2 }] };
          }
          if (/FROM franchise_locations/i.test(sql)) {
            if (args[0] === 'tenant_sadec_02') return { results: [locSadec] };
            return { results: [locDefault, locSadec] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          capturedSqls.push(sql);
          return {
            ...makeStmt(sql, []),
            bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
          };
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. Customers Admin: supervisor can access /segments and /, HQ owner with ?tenant_id=* sees all 2 customers
      const supCustSegReq = await authRequest('GET', '/segments', 'supervisor', 'tenant_sadec_02');
      const supCustSegRes = await customersRouter.fetch(supCustSegReq, env);
      expect(supCustSegRes.status).toBe(200);

      const hqCustListReq = await authRequest('GET', '/?tenant_id=*', 'owner', 'default');
      const hqCustListRes = await customersRouter.fetch(hqCustListReq, env);
      expect(hqCustListRes.status).toBe(200);
      const hqCustListJson = (await hqCustListRes.json()) as any;
      expect(hqCustListJson.data).toHaveLength(2);
      expect(hqCustListJson.pagination.total).toBe(2);

      // 2. Demand Forecast: supervisor can access /forecast and /forecast/hourly; HQ owner with ?tenant_id=* aggregates all tenants
      const supForecastReq = await authRequest('GET', '/forecast?days=7', 'supervisor', 'tenant_sadec_02');
      const supForecastRes = await demandForecastRouter.fetch(supForecastReq, env);
      expect(supForecastRes.status).toBe(200);
      const supForecastJson = (await supForecastRes.json()) as any;
      expect(supForecastJson.data.tenant_id).toBe('tenant_sadec_02');
      expect(supForecastJson.data.historical_sample_orders).toBe(1);

      const hqForecastReq = await authRequest('GET', '/forecast?days=7&tenant_id=*', 'owner', 'default');
      const hqForecastRes = await demandForecastRouter.fetch(hqForecastReq, env);
      expect(hqForecastRes.status).toBe(200);
      const hqForecastJson = (await hqForecastRes.json()) as any;
      expect(hqForecastJson.data.tenant_id).toBe('*');
      expect(hqForecastJson.data.historical_sample_orders).toBe(2);

      const hqHourlyReq = await authRequest('GET', '/forecast/hourly?tenant_id=*', 'owner', 'default');
      const hqHourlyRes = await demandForecastRouter.fetch(hqHourlyReq, env);
      expect(hqHourlyRes.status).toBe(200);
      const hqHourlyJson = (await hqHourlyRes.json()) as any;
      expect(hqHourlyJson.data.hourly_distribution['08']).toBe(3);
      expect(hqHourlyJson.data.hourly_distribution['18']).toBe(4);

      // 3. Franchise Locations: supervisor can list own branch location and view its metrics
      const supLocListReq = await authRequest('GET', '/locations', 'supervisor', 'tenant_sadec_02');
      const supLocListRes = await franchiseRouter.fetch(supLocListReq, env);
      expect(supLocListRes.status).toBe(200);
      const supLocListJson = (await supLocListRes.json()) as any;
      expect(supLocListJson.data).toHaveLength(1);
      expect(supLocListJson.data[0].id).toBe('loc-sad-1');

      const supLocMetricsReq = await authRequest('GET', '/locations/loc-sad-1/metrics', 'supervisor', 'tenant_sadec_02');
      const supLocMetricsRes = await franchiseRouter.fetch(supLocMetricsReq, env);
      expect(supLocMetricsRes.status).toBe(200);
      const supLocMetricsJson = (await supLocMetricsRes.json()) as any;
      expect(supLocMetricsJson.data.gross_sales).toBe(400000);
      expect(supLocMetricsJson.data.royalty_amount).toBe(24000);
    });
  });

  describe('14. Payments Manual Reconcile, Admin Customers/Orders, DinDin Checkout & Catalog Multi-Tenant Hardening (J1–J3)', () => {
    it('allows supervisor & HQ wildcard (?tenant_id=*) on manual payment reconcile while isolating cross-branch payments and normalizing empty-string tenant_id (J1)', async () => {
      // Verify canAccessPaymentOrder normalizes empty-string tenant_id to 'default'
      const mockDefaultCtx = {
        get: (k: string) => (k === 'user' ? { id: 'u-1', role: 'supervisor', tenantId: 'default' } : undefined),
        req: { query: () => undefined, header: () => undefined },
      };
      const mockSadecCtx = {
        get: (k: string) => (k === 'user' ? { id: 'u-2', role: 'supervisor', tenantId: 'tenant_sadec_02' } : undefined),
        req: { query: () => undefined, header: () => undefined },
      };
      expect(canAccessPaymentOrder(mockDefaultCtx, { id: 'ord-empty', customer_id: null, tenant_id: '' })).toBe(true);
      expect(canAccessPaymentOrder(mockSadecCtx, { id: 'ord-empty', customer_id: null, tenant_id: '' })).toBe(false);

      const payDef = {
        id: 'pay-def-1',
        order_id: 'ord-def-1',
        transaction_id: 'tx-def-1',
        tenant_id: 'default',
        order_tenant_id: 'default',
        status: 'paid',
        order_payment_status: 'paid',
      };
      const paySad = {
        id: 'pay-sad-1',
        order_id: 'ord-sad-1',
        transaction_id: 'tx-sad-1',
        tenant_id: 'tenant_sadec_02',
        order_tenant_id: 'tenant_sadec_02',
        status: 'paid',
        order_payment_status: 'paid',
      };

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
          }
          if (/FROM payments p/i.test(sql) && /JOIN orders o ON o\.id = p\.order_id/i.test(sql)) {
            if (args[0] === 'pay-def-1') return payDef;
            if (args[0] === 'pay-sad-1') return paySad;
          }
          if (/SELECT id, order_id, status, amount, transaction_id FROM payments WHERE id = \?/i.test(sql)) {
            if (args[0] === 'pay-def-1') return { ...payDef, amount: 50000 };
            if (args[0] === 'pay-sad-1') return { ...paySad, amount: 75000 };
          }
          return null;
        }),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. SaDec supervisor gets 404 on Default branch payment, 200 on SaDec branch payment
      const supCrossReq = await authRequest('POST', '/api/admin/payments/pay-def-1/reconcile', 'supervisor', 'tenant_sadec_02');
      const supCrossRes = await app.fetch(supCrossReq, env);
      expect(supCrossRes.status).toBe(404);

      const supOwnReq = await authRequest('POST', '/api/admin/payments/pay-sad-1/reconcile', 'supervisor', 'tenant_sadec_02');
      const supOwnRes = await app.fetch(supOwnReq, env);
      expect(supOwnRes.status).toBe(200);
      const supOwnJson = (await supOwnRes.json()) as any;
      expect(supOwnJson.outcome).toBe('already_settled');

      // 2. HQ owner in 'default' with ?tenant_id=* can reconcile SaDec branch payment (200 instead of 404)
      const hqWildcardReq = await authRequest('POST', '/api/admin/payments/pay-sad-1/reconcile?tenant_id=*', 'owner', 'default');
      const hqWildcardRes = await app.fetch(hqWildcardReq, env);
      expect(hqWildcardRes.status).toBe(200);
      const hqWildcardJson = (await hqWildcardRes.json()) as any;
      expect(hqWildcardJson.outcome).toBe('already_settled');
    });

    it('enforces HQ wildcard (?tenant_id=*) and supervisor parity on Admin Customers, Admin Orders, and DinDin Checkouts (J2)', async () => {
      const todayIso = new Date().toISOString();
      const custDef = { id: 'cust-def-1', name: 'Def Cust', phone: '0901111222', email: 'd@a.vn', loyalty_tier: 'gold', tenant_id: 'default', visit_count: 1, created_at: todayIso };
      const custSad = { id: 'cust-sad-1', name: 'Sad Cust', phone: '0903333444', email: 's@a.vn', loyalty_tier: 'silver', tenant_id: 'tenant_sadec_02', visit_count: 3, created_at: todayIso };
      const ddOrderDef = {
        id: 'dd-ord-def',
        order_number: 'DD-DEF-01',
        status: 'confirmed',
        payment_status: 'paid',
        payment_method: 'cash',
        total: 50000,
        items: JSON.stringify([{ productId: 'p1', name: 'Latte', price: 50000, quantity: 1 }]),
        notes: JSON.stringify({ source: 'dindin' }),
        created_at: todayIso,
        tenant_id: 'default',
      };
      const ddOrderSad = {
        id: 'dd-ord-sad',
        order_number: 'DD-SAD-01',
        status: 'confirmed',
        payment_status: 'paid',
        payment_method: 'payos',
        total: 65000,
        items: JSON.stringify([{ productId: 'p2', name: 'Lotus Tea', price: 65000, quantity: 1 }]),
        notes: JSON.stringify({ source: 'dindin' }),
        created_at: todayIso,
        tenant_id: 'tenant_sadec_02',
      };

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
          }
          if (/SELECT COUNT\(\*\) as total FROM customers/i.test(sql)) {
            if (args[0] === '*') return { total: 2 };
            return { total: 1 };
          }
          if (/FROM orders WHERE id = \?/i.test(sql)) {
            if (args[0] === 'dd-ord-def') return ddOrderDef;
            if (args[0] === 'dd-ord-sad') return ddOrderSad;
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM customers c LEFT JOIN cashback_wallets/i.test(sql)) {
            // Verify visit_count subquery correlates o.tenant_id with c.tenant_id
            expect(sql).toContain("COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')");
            if (args[0] === '*') return { results: [custDef, custSad] };
            if (args[0] === 'tenant_sadec_02') return { results: [custSad] };
            return { results: [custDef] };
          }
          if (/WHERE customer_name = 'DIN'/i.test(sql)) {
            return { results: [ddOrderDef, ddOrderSad] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. Admin Customers: SaDec supervisor spoofing X-Tenant-ID: default gets only SaDec customers; HQ owner with ?tenant_id=* gets both
      const supCustReq = await authRequest('GET', '/api/admin/customers', 'supervisor', 'tenant_sadec_02');
      supCustReq.headers.set('X-Tenant-ID', 'default');
      const supCustRes = await app.fetch(supCustReq, env);
      expect(supCustRes.status).toBe(200);
      const supCustJson = (await supCustRes.json()) as any;
      expect(supCustJson.customers).toHaveLength(1);
      expect(supCustJson.customers[0].id).toBe('cust-sad-1');

      const hqCustReq = await authRequest('GET', '/api/admin/customers?tenant_id=*', 'owner', 'default');
      const hqCustRes = await app.fetch(hqCustReq, env);
      expect(hqCustRes.status).toBe(200);
      const hqCustJson = (await hqCustRes.json()) as any;
      expect(hqCustJson.customers).toHaveLength(2);
      expect(hqCustJson.pagination.total).toBe(2);

      // 2. DinDin Checkouts: SaDec supervisor only sees SaDec checkout and gets 404 printing Default checkout; HQ owner with ?tenant_id=* sees both
      const supDdListReq = await authRequest('GET', '/checkouts', 'supervisor', 'tenant_sadec_02');
      const supDdListRes = await dindinRouter.fetch(supDdListReq, env);
      expect(supDdListRes.status).toBe(200);
      const supDdListJson = (await supDdListRes.json()) as any;
      expect(supDdListJson.data).toHaveLength(1);
      expect(supDdListJson.data[0].orderId).toBe('dd-ord-sad');

      const supDdCrossPrintReq = await authRequest('POST', '/checkout/dd-ord-def/print', 'supervisor', 'tenant_sadec_02');
      const supDdCrossPrintRes = await dindinRouter.fetch(supDdCrossPrintReq, env);
      expect(supDdCrossPrintRes.status).toBe(404);

      const hqDdListReq = await authRequest('GET', '/checkouts?tenant_id=*', 'owner', 'default');
      const hqDdListRes = await dindinRouter.fetch(hqDdListReq, env);
      expect(hqDdListRes.status).toBe(200);
      const hqDdListJson = (await hqDdListRes.json()) as any;
      expect(hqDdListJson.data).toHaveLength(2);
    });

    it('enforces Catalog (categories, products, menu-modifiers, happy-hour) supervisor parity and tenant-scoped product slugs (J3)', async () => {
      const catDefault = { id: 'cat-def-1', name: 'Default Coffee', slug: 'ca-phe', sort_order: 1, tenant_id: 'default' };
      const catSadec = { id: 'cat-sad-1', name: 'SaDec Coffee', slug: 'ca-phe', sort_order: 1, tenant_id: 'tenant_sadec_02' };
      const prodDefault = {
        id: 'prod-def-1',
        name: 'Default Iced Milk Coffee',
        slug: 'ca-phe-sua-da',
        price: 39000,
        category_id: 'cat-def-1',
        is_available: 1,
        tenant_id: 'default',
      };
      const prodSadec = {
        id: 'prod-sad-1',
        name: 'SaDec Iced Milk Coffee',
        slug: 'ca-phe-sua-da',
        price: 35000,
        category_id: 'cat-sad-1',
        is_available: 1,
        tenant_id: 'tenant_sadec_02',
      };

      const createdProducts: Record<string, unknown>[] = [];
      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
          }
          if (/FROM products p LEFT JOIN categories c ON p\.category_id = c\.id WHERE p\.id = \?/i.test(sql)) {
            const found = [prodDefault, prodSadec, ...createdProducts].find((p) => p.id === args[0]);
            return found ?? null;
          }
          if (/FROM modifier_groups WHERE id = \?/i.test(sql)) {
            return { id: args[0], name: 'Ice Level', type: 'single', required: 1, sort_order: 0, is_active: 1, tenant_id: 'tenant_sadec_02' };
          }
          if (/FROM happy_hour_windows WHERE id = \?/i.test(sql)) {
            return { id: args[0], name: 'Afternoon HH', day_of_week: 5, start_time: '14:00', end_time: '17:00', discount_rate: 0.2, active: 1, tenant_id: 'tenant_sadec_02' };
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM categories/i.test(sql)) {
            return { results: [catDefault, catSadec] };
          }
          if (/FROM products/i.test(sql)) {
            return { results: [prodDefault, prodSadec, ...createdProducts] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          if (/INSERT INTO products/i.test(sql)) {
            createdProducts.push({
              id: args[0],
              name: args[1],
              slug: args[2],
              price: args[4],
              category_id: args[6],
              is_available: 1,
              tenant_id: args[args.length - 1],
            });
          }
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. Standalone categoriesRouter & productsRouter resolve caller JWT via conditional optionalAuth() on GET
      const sadCatReq = await authRequest('GET', '/', 'supervisor', 'tenant_sadec_02');
      const sadCatRes = await categoriesRouter.fetch(sadCatReq, env);
      expect(sadCatRes.status).toBe(200);
      const sadCatJson = (await sadCatRes.json()) as any;
      expect(sadCatJson.data).toHaveLength(1);
      expect(sadCatJson.data[0].id).toBe('cat-sad-1');

      // 2. Tenant-scoped GET /slug/:slug returns SaDec's product for SaDec supervisor even though Default tenant has the first row with same slug
      const sadSlugReq = await authRequest('GET', '/slug/ca-phe-sua-da', 'supervisor', 'tenant_sadec_02');
      const sadSlugRes = await productsRouter.fetch(sadSlugReq, env);
      expect(sadSlugRes.status).toBe(200);
      const sadSlugJson = (await sadSlugRes.json()) as any;
      expect(sadSlugJson.data.id).toBe('prod-sad-1');
      expect(sadSlugJson.data.price).toBe(35000);

      // 3. Tenant-scoped slug uniqueness on POST /: duplicate slug in same tenant returns 409; slug existing only in Default tenant is allowed (201) for SaDec supervisor
      const dupSadProdReq = await authRequest('POST', '/', 'supervisor', 'tenant_sadec_02', {
        name: 'Duplicate SaDec Coffee',
        slug: 'ca-phe-sua-da',
        price: 35000,
        category_id: 'cat-sad-1',
      });
      expect((await productsRouter.fetch(dupSadProdReq, env)).status).toBe(409);

      // Add a Default-only slug product and verify SaDec supervisor CAN create the same slug in tenant_sadec_02
      createdProducts.push({
        id: 'prod-def-only',
        name: 'Default Matcha',
        slug: 'matcha-latte',
        price: 55000,
        category_id: 'cat-def-1',
        is_available: 1,
        tenant_id: 'default',
      });
      const newSadProdReq = await authRequest('POST', '/', 'supervisor', 'tenant_sadec_02', {
        name: 'SaDec Matcha',
        slug: 'matcha-latte',
        price: 49000,
        category_id: 'cat-sad-1',
      });
      const newSadProdRes = await productsRouter.fetch(newSadProdReq, env);
      expect(newSadProdRes.status).toBe(201);

      // 4. Supervisor parity on menuModifiersRouter (/groups & /happy-hour)
      const supGroupReq = await authRequest('POST', '/groups', 'supervisor', 'tenant_sadec_02', {
        name: 'Ice Level',
        type: 'single',
        required: true,
      });
      expect((await menuModifiersRouter.fetch(supGroupReq, env)).status).toBe(201);

      const supHhReq = await authRequest('POST', '/happy-hour', 'supervisor', 'tenant_sadec_02', {
        name: 'Afternoon HH',
        day_of_week: 5,
        start_time: '14:00',
        end_time: '17:00',
        discount_rate: 0.2,
      });
      expect((await menuModifiersRouter.fetch(supHhReq, env)).status).toBe(201);
    });
  });

  // ── 15. Edge Telemetry, Dynamic Pricing, Inventory Forecasting, AI Recommendations, Franchise, Customer Assistant & Inner Integration Sub-Routers Hardening (K1–K3) ──

  describe('15. Edge Telemetry, Dynamic Pricing, Inventory Forecasting, AI Recommendations, Franchise, Customer Assistant & Inner Integration Sub-Routers Hardening (K1–K3)', () => {
    it('enforces supervisor parity, conditional optionalAuth(), HQ wildcard (?tenant_id=*), and empty-string tenant normalization across Dynamic Pricing, Container Telemetry, Inventory Forecasting, AI Recommendations, and AI Barista (K1)', async () => {
      const { dynamicPricingRouter } = await import('../../routes/dynamic-pricing');
      const { containerTelemetryRouter } = await import('../../routes/container-telemetry');
      const { inventoryForecastingRouter } = await import('../../routes/inventory-forecasting');
      const { recommendationsRouter } = await import('../../routes/recommendations');
      const { aiBaristaRouter } = await import('../../routes/ai-barista');

      const rules = [
        {
          id: 'rule-def-1',
          tenant_id: '',
          name: 'Default All-Day Flash',
          rule_type: 'category_flash',
          discount_percent: 20,
          target_category: null,
          target_product_id: 'prod-1',
          min_margin_percent: 10,
          days_of_week: '0,1,2,3,4,5,6',
          start_time: '00:00',
          end_time: '23:59',
          is_active: 1,
        },
        {
          id: 'rule-sad-1',
          tenant_id: 'tenant_sadec_02',
          name: 'SaDec All-Day Flash',
          rule_type: 'category_flash',
          discount_percent: 30,
          target_category: null,
          target_product_id: 'prod-1',
          min_margin_percent: 10,
          days_of_week: '0,1,2,3,4,5,6',
          start_time: '00:00',
          end_time: '23:59',
          is_active: 1,
        },
      ];

      const telemetryLogs: Array<Record<string, unknown>> = [
        {
          id: 'tel-def-1',
          container_id: 'CONT-01',
          tenant_id: '',
          power_source: 'grid',
          battery_percentage: 100,
          ambient_temp_celsius: 26,
          kds_online: 1,
          network_ping_ms: 12,
          alert_status: 'NORMAL',
          alert_message: null,
          created_at: new Date().toISOString(),
        },
        {
          id: 'tel-sad-1',
          container_id: 'CONT-SAD-02',
          tenant_id: 'tenant_sadec_02',
          power_source: 'solar',
          battery_percentage: 85,
          ambient_temp_celsius: 29,
          kds_online: 1,
          network_ping_ms: 18,
          alert_status: 'NORMAL',
          alert_message: null,
          created_at: new Date().toISOString(),
        },
      ];

      const inventoryItems = [
        { id: 'inv-def-1', sku: 'SKU-DEF-1', name: 'Default Beans', current_stock: 15, min_stock: 5, unit: 'kg', tenant_id: '', active: 1 },
        { id: 'inv-sad-1', sku: 'SKU-SAD-1', name: 'SaDec Beans', current_stock: 8, min_stock: 5, unit: 'kg', tenant_id: 'tenant_sadec_02', active: 1 },
      ];
      const snapshots: Array<Record<string, unknown>> = [];
      const affinities: Array<Record<string, unknown>> = [
        { id: 'def_coffee_pastry', tenant_id: '', item_a: 'coffee_1', item_b: 'pastry_def', co_occurrence_count: 12, affinity_score: 0.85 },
        { id: 'sad_coffee_pastry', tenant_id: 'tenant_sadec_02', item_a: 'coffee_1', item_b: 'pastry_sad', co_occurrence_count: 9, affinity_score: 0.92 },
      ];
      const baristaLogs: Array<Record<string, unknown>> = [];

      const makeStmt = (sql: string, args: unknown[]) => ({
        sql,
        args,
        first: vi.fn(async () => {
          if (isAccountLookup(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM dynamic_pricing_rules/i.test(sql)) {
            const t = String(args[0] ?? 'default');
            return {
              results: rules.filter((r) => t === '*' || ((r.tenant_id || 'default') === t)),
            };
          }
          if (/FROM container_telemetry_logs/i.test(sql)) {
            if (/WHERE container_id = \?/i.test(sql)) {
              const cid = String(args[0] ?? '');
              const t = String(args[1] ?? 'default');
              return {
                results: telemetryLogs.filter(
                  (r) => r.container_id === cid && (t === '*' || ((String(r.tenant_id || '') || 'default') === t))
                ),
              };
            }
            const t = String(args[0] ?? 'default');
            return {
              results: telemetryLogs.filter((r) => t === '*' || ((String(r.tenant_id || '') || 'default') === t)),
            };
          }
          if (/FROM inventory_items/i.test(sql)) {
            const t = String(args[0] ?? 'default');
            return {
              results: inventoryItems.filter((r) => t === '*' || ((r.tenant_id || 'default') === t)),
            };
          }
          if (/FROM inventory_forecast_snapshots/i.test(sql)) {
            const t = String(args[0] ?? 'default');
            return {
              results: snapshots.filter((r) => t === '*' || ((String(r.tenant_id || '') || 'default') === t)),
            };
          }
          if (/FROM ai_product_affinities/i.test(sql)) {
            const t = String(args[0] ?? 'default');
            return {
              results: affinities.filter((r) => t === '*' || ((String(r.tenant_id || '') || 'default') === t)),
            };
          }
          if (/SELECT items FROM orders/i.test(sql)) {
            const t = String(args[0] ?? 'default');
            const allOrders = [
              { tenant_id: '', items: JSON.stringify([{ id: 'coffee_1', name: 'Coffee 1', quantity: 2 }, { id: 'cake_def', name: 'Cake Def', quantity: 1 }]) },
              { tenant_id: 'tenant_sadec_02', items: JSON.stringify([{ id: 'coffee_1', name: 'Coffee 1', quantity: 3 }, { id: 'cake_sad', name: 'Cake Sad', quantity: 3 }]) },
            ];
            return {
              results: allOrders.filter((o) => t === '*' || ((o.tenant_id || 'default') === t)),
            };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          if (/INSERT INTO container_telemetry_logs/i.test(sql)) {
            telemetryLogs.push({
              id: args[0],
              container_id: args[1],
              tenant_id: args[2],
              power_source: args[3],
              battery_percentage: args[4],
              ambient_temp_celsius: args[5],
              kds_online: args[6],
              network_ping_ms: args[7],
              alert_status: args[8],
              alert_message: args[9],
              created_at: new Date().toISOString(),
            });
          }
          if (/INSERT INTO inventory_forecast_snapshots/i.test(sql)) {
            snapshots.push({
              id: args[0],
              tenant_id: args[1],
              item_sku: args[2],
              item_name: args[3],
            });
          }
          if (/INSERT INTO ai_barista_interactions/i.test(sql)) {
            baristaLogs.push({ id: args[0], tenant_id: args[1] });
          }
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
        batch: vi.fn(async (stmts: Array<{ run: () => Promise<unknown> }>) => {
          for (const s of stmts) await s.run();
          return [];
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        EDGE_TELEMETRY_SECRET: 'edge-sec-test-123456',
        AURA_DB: mockDb as any,
      });

      // 1. Dynamic pricing: standalone calculate with supervisor JWT in tenant_sadec_02 resolves SaDec's 30% discount rule (ignoring ?tenant_id=default spoof)
      const calcSadReq = await authRequest(
        'POST',
        '/calculate?tenant_id=default',
        'supervisor',
        'tenant_sadec_02',
        { items: [{ product_id: 'prod-1', price: 50000, quantity: 1 }] }
      );
      const calcSadRes = await dynamicPricingRouter.fetch(calcSadReq, env);
      expect(calcSadRes.status).toBe(200);
      const calcSadJson = (await calcSadRes.json()) as any;
      expect(calcSadJson.data.items[0].discount_percent).toBe(30);
      expect(calcSadJson.data.items[0].rule_name).toBe('SaDec All-Day Flash');

      // Supervisor can GET /rules and HQ owner can GET /rules?tenant_id=* across both tenants (including empty-string default rule)
      const supRulesReq = await authRequest('GET', '/rules', 'supervisor', 'tenant_sadec_02');
      const supRulesRes = await dynamicPricingRouter.fetch(supRulesReq, env);
      expect(supRulesRes.status).toBe(200);
      expect(((await supRulesRes.json()) as any).data).toHaveLength(1);

      const hqRulesReq = await authRequest('GET', '/rules?tenant_id=*', 'owner', 'default');
      const hqRulesRes = await dynamicPricingRouter.fetch(hqRulesReq, env);
      expect(hqRulesRes.status).toBe(200);
      expect(((await hqRulesRes.json()) as any).data).toHaveLength(2);

      // 2. Container Telemetry: secret-authenticated edge device can specify X-Tenant-ID, supervisor can read status, and HQ owner can aggregate with ?tenant_id=*
      const hbReq = new Request('https://test.local/telemetry/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-edge-telemetry-secret': 'edge-sec-test-123456',
          'X-Tenant-ID': 'tenant_sadec_02',
        },
        body: JSON.stringify({
          container_id: 'CONT-SAD-03',
          power_source: 'grid',
          ambient_temp_celsius: 27.5,
          kds_online: true,
          network_ping_ms: 15,
        }),
      });
      const hbRes = await containerTelemetryRouter.fetch(hbReq, env);
      expect(hbRes.status).toBe(200);
      expect(telemetryLogs.some((l) => l.container_id === 'CONT-SAD-03' && l.tenant_id === 'tenant_sadec_02')).toBe(true);

      const supStatusReq = await authRequest('GET', '/containers/status', 'supervisor', 'tenant_sadec_02');
      const supStatusRes = await containerTelemetryRouter.fetch(supStatusReq, env);
      expect(supStatusRes.status).toBe(200);
      expect(((await supStatusRes.json()) as any).count).toBe(2); // CONT-SAD-02 + CONT-SAD-03

      const hqStatusReq = await authRequest('GET', '/containers/status?tenant_id=*', 'owner', 'default');
      const hqStatusRes = await containerTelemetryRouter.fetch(hqStatusReq, env);
      expect(hqStatusRes.status).toBe(200);
      expect(((await hqStatusRes.json()) as any).count).toBe(3); // CONT-01 ('') + CONT-SAD-02 + CONT-SAD-03

      // 3. Inventory Forecasting: supervisor can run-rate/snapshot/history, and HQ owner ?tenant_id=* snapshots each item under its own concrete tenant_id
      const supRunRateReq = await authRequest('GET', '/run-rate', 'supervisor', 'tenant_sadec_02');
      const supRunRateRes = await inventoryForecastingRouter.fetch(supRunRateReq, env);
      expect(supRunRateRes.status).toBe(200);
      expect(((await supRunRateRes.json()) as any).data).toHaveLength(1);

      const hqSnapReq = await authRequest('POST', '/snapshot?tenant_id=*', 'owner', 'default');
      const hqSnapRes = await inventoryForecastingRouter.fetch(hqSnapReq, env);
      expect(hqSnapRes.status).toBe(200);
      expect(snapshots).toHaveLength(2);
      expect(snapshots.map((s) => s.tenant_id).sort()).toEqual(['default', 'tenant_sadec_02']);

      // 4. AI Recommendations & AI Barista: conditional optionalAuth() prevents tenant spoofing and allows supervisor on /mine-affinities
      const recSadReq = await authRequest(
        'GET',
        '/frequently-bought-together?item_id=coffee_1&tenant_id=default',
        'supervisor',
        'tenant_sadec_02'
      );
      const recSadRes = await recommendationsRouter.fetch(recSadReq, env);
      expect(recSadRes.status).toBe(200);
      const recSadJson = (await recSadRes.json()) as any;
      expect(recSadJson.data[0].id).toBe('sad_coffee_pastry');
      expect(recSadJson.data[0].score).toBe(0.92);

      const mineSupReq = await authRequest('POST', '/mine-affinities', 'supervisor', 'tenant_sadec_02');
      expect((await recommendationsRouter.fetch(mineSupReq, env)).status).toBe(200);

      const baristaReq = await authRequest('POST', '/recommend?tenant_id=*', 'owner', 'default', {
        prompt: 'Cà phê muối đậm đà',
      });
      expect((await aiBaristaRouter.fetch(baristaReq, env)).status).toBe(200);
      expect(baristaLogs[0]?.tenant_id).toBe('default'); // '*' normalized to 'default' on insert
    });

    it('enforces empty-string tenant normalization & HQ explicit tenant filter on Franchise Locations, Customer Assistant, and Zalo Webhook (K2)', async () => {
      const { franchiseRouter } = await import('../../routes/franchise-locations');
      const { customerAssistantRouter } = await import('../../routes/customer-assistant');
      const { zaloWebhookRouter } = await import('../../routes/zalo-webhook');

      const locations = [
        { id: 'loc-def', tenant_id: '', code: 'AURA-HQ-01', name: 'HQ Flagship', royalty_percentage: 5, status: 'active' },
        { id: 'loc-sad', tenant_id: 'tenant_sadec_02', code: 'AURA-SAD-02', name: 'SaDec Container 02', royalty_percentage: 6, status: 'active' },
      ];
      const orders = [
        { id: 'ord-def-99', tenant_id: '', status: 'preparing', total: 55000, total_amount: 55000, customer_phone: '0901112222' },
        { id: 'ord-sad-88', tenant_id: 'tenant_sadec_02', status: 'ready', total: 75000, total_amount: 75000, customer_phone: '0901112222' },
      ];

      const makeStmt = (sql: string, args: unknown[]) => ({
        sql,
        args,
        first: vi.fn(async () => {
          if (isAccountLookup(sql)) {
            if (args[0] === 'user-manager') return staffAccountRow('manager', 'default');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-customer') return staffAccountRow('customer', 'tenant_sadec_02');
          }
          if (/FROM franchise_locations WHERE id = \?/i.test(sql)) {
            return locations.find((l) => l.id === args[0]) ?? null;
          }
          if (/COUNT\(\*\) as order_count.*FROM orders/is.test(sql)) {
            const t = String(args[0] ?? 'default');
            const matched = orders.filter((o) => (o.tenant_id || 'default') === t);
            return {
              order_count: matched.length,
              gross_sales: matched.reduce((acc, o) => acc + o.total, 0),
            };
          }
          if (/FROM orders WHERE \(\? = '\*' OR COALESCE\(NULLIF\(tenant_id, ''\), 'default'\) = \?\)/i.test(sql)) {
            const t = String(args[0] ?? 'default');
            if (/LOWER\(id\) = LOWER\(\?\)/i.test(sql)) {
              const oid = String(args[2] ?? '').toLowerCase();
              return orders.find((o) => o.id.toLowerCase() === oid && (t === '*' || (o.tenant_id || 'default') === t)) ?? null;
            }
            const phone = String(args[2] ?? '');
            return orders.find((o) => o.customer_phone === phone && (t === '*' || (o.tenant_id || 'default') === t)) ?? null;
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM franchise_locations/i.test(sql)) {
            const t = String(args[0] ?? 'default');
            return {
              results: locations.filter((l) => t === '*' || (l.tenant_id || 'default') === t),
            };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. Default-tenant manager can access loc-def even when loc-def.tenant_id is ''
      const defMgrLocsReq = await authRequest('GET', '/locations', 'manager', 'default');
      const defMgrLocsRes = await franchiseRouter.fetch(defMgrLocsReq, env);
      expect(defMgrLocsRes.status).toBe(200);
      expect(((await defMgrLocsRes.json()) as any).data).toHaveLength(1);

      const defMgrDetailReq = await authRequest('GET', '/locations/loc-def', 'manager', 'default');
      expect((await franchiseRouter.fetch(defMgrDetailReq, env)).status).toBe(200);

      // HQ owner passing explicit ?tenant_id=tenant_sadec_02 gets 403 when querying loc-def (tenant mismatch against explicit filter)
      const hqScopedMismatchReq = await authRequest('GET', '/locations/loc-def?tenant_id=tenant_sadec_02', 'owner', 'default');
      expect((await franchiseRouter.fetch(hqScopedMismatchReq, env)).status).toBe(403);

      // 2. Customer Assistant: authenticated SaDec customer cannot read Default order even if passing ?tenant_id=default; public caller with ?tenant_id=tenant_sadec_02 gets SaDec order
      const custToken = await generateJWT(
        {
          id: 'cust-sad-1',
          sub: 'cust-sad-1',
          role: 'customer',
          tenantId: 'tenant_sadec_02',
        } as any,
        TEST_JWT_SECRET,
        3600
      );
      const sadCustChatReq = new Request('https://test.local/?tenant_id=default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custToken}`,
        },
        body: JSON.stringify({
          query: 'Kiểm tra đơn #ord-def-99',
          order_id: 'ord-def-99',
        }),
      });
      const sadCustChatRes = await customerAssistantRouter.fetch(sadCustChatReq, env);
      expect(sadCustChatRes.status).toBe(200);
      expect(((await sadCustChatRes.json()) as any).data.reply).toContain('chưa tìm thấy');

      const pubSadChatReq = new Request('https://test.local/?tenant_id=tenant_sadec_02', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Kiểm tra đơn #ord-sad-88', order_id: 'ord-sad-88' }),
      });
      const pubSadChatRes = await customerAssistantRouter.fetch(pubSadChatReq, env);
      expect(pubSadChatRes.status).toBe(200);
      expect(((await pubSadChatRes.json()) as any).data.reply).toContain('#ord-sad-88');

      // 3. Zalo Webhook /simulate allows supervisor role and scopes order lookup to supervisor's tenant
      const supSimReq = await authRequest('POST', '/simulate', 'supervisor', 'tenant_sadec_02', {
        text: 'Đơn hàng của tôi',
        phone: '0901112222',
      });
      const supSimRes = await zaloWebhookRouter.fetch(supSimReq, env);
      expect(supSimRes.status).toBe(200);
      expect(((await supSimRes.json()) as any).data.reply).toContain('#ord-sad-88');
    });

    it('enforces supervisor role parity & tenant isolation across inner integration and ops routers (ERPNext, Frigate, TastyIgniter, HomeAssistant, Pretix, CalBookings, WiFi, Push, CronAdmin) (K3)', async () => {
      const { Hono } = await import('hono');
      const { erpnextSyncRoutes } = await import('../../routes/erpnext-sync');
      const { customerRoutes } = await import('../../routes/erpnext/customers');
      const { vendorRoutes } = await import('../../routes/erpnext/vendors');
      const { expenseRoutes } = await import('../../routes/erpnext/expenses');
      const { createFrigateRoutes } = await import('../../routes/integrations/frigate');
      const { createTIRoutes } = await import('../../routes/integrations/tastyigniter');
      const { createHARouter } = await import('../../routes/homeassistant/index');
      const { pretixRouter } = await import('../../routes/pretix-handlers/routes');
      const { calBookingWebhookRouter } = await import('../../routes/cal-booking-webhook');
      const { createWifiRoutes } = await import('../../routes/wifi');
      const { pushRouter } = await import('../../routes/push');
      const { registerCronAdminRoutes } = await import('../../routes/cron-admin');

      const app = new Hono<any>();
      erpnextSyncRoutes(app);
      customerRoutes(app);
      vendorRoutes(app);
      expenseRoutes(app);
      app.route('/api/integrations/frigate', createFrigateRoutes());
      app.route('/api/integrations/tastyigniter', createTIRoutes());
      app.route('/api/ha', createHARouter());
      app.route('/api/pretix', pretixRouter);
      app.route('/api/cal-booking-webhook', calBookingWebhookRouter);
      app.route('/api/wifi', createWifiRoutes());
      app.route('/api/push', pushRouter);
      registerCronAdminRoutes(app);

      const reservations = [
        { id: 'res-def-1', cal_uid: 'cal-def', attendee_name: 'Default Guest', status: 'confirmed', tenant_id: '', created_at: '2026-10-31T08:00:00Z' },
        { id: 'res-sad-1', cal_uid: 'cal-sad', attendee_name: 'SaDec Guest', status: 'confirmed', tenant_id: 'tenant_sadec_02', created_at: '2026-10-31T09:00:00Z' },
      ];

      const makeStmt = (sql: string, args: unknown[]) => ({
        sql,
        args,
        first: vi.fn(async () => {
          if (isAccountLookup(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
            if (args[0] === 'user-waiter') return staffAccountRow('waiter', 'tenant_sadec_02');
          }
          return { cnt: 0, total: 1 };
        }),
        all: vi.fn(async () => {
          if (/FROM reservations/i.test(sql)) {
            const t = String(args[0] ?? 'default');
            return {
              results: reservations.filter((r) => t === '*' || ((r.tenant_id || 'default') === t)),
            };
          }
          if (/FROM customers/i.test(sql)) {
            return {
              results: [
                { id: 'c-def', name: 'Def Cust', tenant_id: '' },
                { id: 'c-sad', name: 'Sad Cust', tenant_id: 'tenant_sadec_02' },
              ],
            };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        HA_MOCK: 'true',
        AURA_DB: mockDb as any,
      });

      // Supervisor parity checks across inner sub-routers (previously 403 Forbidden)
      expect((await app.fetch(await authRequest('GET', '/api/erpnext/sync/inventory', 'supervisor', 'tenant_sadec_02'), env)).status).toBe(200);
      expect((await app.fetch(await authRequest('GET', '/api/erpnext/customers', 'supervisor', 'tenant_sadec_02'), env)).status).toBe(200);
      expect((await app.fetch(await authRequest('GET', '/api/erpnext/vendors', 'supervisor', 'tenant_sadec_02'), env)).status).toBe(200);
      expect((await app.fetch(await authRequest('GET', '/api/erpnext/expenses', 'supervisor', 'tenant_sadec_02'), env)).status).toBe(200);
      expect((await app.fetch(await authRequest('GET', '/api/integrations/frigate/events', 'supervisor', 'tenant_sadec_02'), env)).status).toBe(200);
      expect((await app.fetch(await authRequest('GET', '/api/integrations/tastyigniter/menu', 'supervisor', 'tenant_sadec_02'), env)).status).toBe(200);
      expect((await app.fetch(await authRequest('GET', '/api/ha/devices', 'supervisor', 'tenant_sadec_02'), env)).status).toBe(200);
      expect((await app.fetch(await authRequest('GET', '/api/pretix/orders', 'waiter', 'tenant_sadec_02'), env)).status).toBe(403);
      expect((await app.fetch(await authRequest('GET', '/api/pretix/orders', 'supervisor', 'tenant_sadec_02'), env)).status).toBe(503); // passes pretixStaffAuth (not 403), reaches handler
      expect((await app.fetch(await authRequest('POST', '/api/wifi/authorize', 'supervisor', 'tenant_sadec_02', { mac: 'AA:BB:CC:DD:EE:FF', action: 'grant' }), env)).status).toBe(200);
      expect((await app.fetch(await authRequest('GET', '/api/push/list-subscriptions', 'supervisor', 'tenant_sadec_02'), env)).status).toBe(200);
      expect((await app.fetch(await authRequest('POST', '/api/push/subscribe', 'supervisor', 'tenant_sadec_02', { name: 'Sup Device', role: 'supervisor' }), env)).status).toBe(201);
      expect((await app.fetch(await authRequest('POST', '/api/admin/zalo/send-expiry-warnings', 'supervisor', 'tenant_sadec_02'), env)).status).toBe(200);

      // Cal.com bookings: supervisor in tenant_sadec_02 sees only SaDec reservation; HQ owner with ?tenant_id=* sees both (including empty-string default reservation)
      const supCalRes = await app.fetch(await authRequest('GET', '/api/cal-booking-webhook/bookings', 'supervisor', 'tenant_sadec_02'), env);
      expect(supCalRes.status).toBe(200);
      const supCalJson = (await supCalRes.json()) as any;
      expect(supCalJson.data).toHaveLength(1);
      expect(supCalJson.data[0].id).toBe('res-sad-1');

      const hqCalRes = await app.fetch(await authRequest('GET', '/api/cal-booking-webhook/bookings?tenant_id=*', 'owner', 'default'), env);
      expect(hqCalRes.status).toBe(200);
      const hqCalJson = (await hqCalRes.json()) as any;
      expect(hqCalJson.data).toHaveLength(2);
    });
  });

  // =========================================================================
  // 16. Phase L1–L3: Default Store Empty-String/NULL Tenant Parity, Order/KDS/SSE
  //     Isolation, Guest Loyalty/Visit/Referral Tenant Scoping, Supervisor Parity
  // =========================================================================
  describe('16. Phase L1–L3: Default Store Empty/NULL Tenant Parity, Order/KDS/SSE & Loyalty Isolation', () => {
    it('normalizes default store NULL/empty tenant_id across analytics, reports, floor-plan, mobile, stats, KDS, OpenAPI orders, SSE, table lookup, and enforces cross-tenant guest customer isolation + supervisor parity', async () => {
      const { Hono } = await import('hono');
      const { authEndpointsRouter } = await import('../../routes/auth-endpoints');
      const { erpnextSyncRoutes } = await import('../../routes/erpnext-sync');
      const { floorPlanRouter } = await import('../../routes/floor-plan');
      const { adminSalesRouter } = await import('../../routes/admin-sales');
      const { registerMetricsHandlers } = await import('../../routes/analytics-handlers/metrics-handlers');
      const { buildTenantClause, buildCustomerJoinTenantClause } = await import('../../routes/reports-handlers/analytics-handlers');
      const { getOrdersMobile, getOrderDetail } = await import('../../routes/orders-mobile');
      const { getStats } = await import('../../../../packages/domain/order/queries/stats');
      const { fetchOrderRecord } = await import('../../routes/order-stream-log');
      const { fetchOrderForRead } = await import('../../routes/openapi-orders-handlers/order-read-handlers');
      const { transitionOrderStatus } = await import('../../../../packages/domain/order/policies/order-status-transition');
      const { resolveOrderCreationTable } = await import('../../../../packages/domain/order/policies/order-creation-scope');
      const { creditLoyaltyIfEligible } = await import('../../../../packages/domain/order/policies/loyalty-trigger');
      const { updateOrder } = await import('../../../../packages/domain/order/commands/update-order');

      // 1. L1: Verify buildTenantClause and buildCustomerJoinTenantClause include empty-string for default store
      expect(buildTenantClause('default').and).toContain("tenant_id = ''");
      expect(buildTenantClause('default').where).toContain("tenant_id = ''");
      expect(buildTenantClause('tenant_sadec_02').and.trim()).toBe('AND tenant_id = ?');
      expect(buildCustomerJoinTenantClause('default').and).toContain("c.tenant_id = ''");
      expect(buildCustomerJoinTenantClause('tenant_sadec_02').and.trim()).toBe('AND c.tenant_id = ?');

      const executedQueries: Array<{ sql: string; args: unknown[] }> = [];
      const makeStmt = (sql: string, args: unknown[]) => ({
        sql,
        args,
        first: vi.fn(async () => {
          executedQueries.push({ sql, args });
          if (isAccountLookup(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'default');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
            if (args[0] === 'user-waiter') return staffAccountRow('waiter', 'default');
          }
          if (/FROM cashback_transactions/i.test(sql)) return null;
          if (/FROM loyalty_policies/i.test(sql)) {
            return {
              id: 'pol-1',
              earn_rate_percent: 5,
              min_order_vnd: 20000,
              max_earn_per_order_vnd: 50000,
              point_expiry_days: 365,
              is_active: 1,
            };
          }
          if (/FROM orders WHERE id = \?/i.test(sql)) {
            const id = String(args[0] ?? '');
            if (id === 'ord-default-empty') {
              return {
                id: 'ord-default-empty',
                status: 'pending',
                payment_status: 'paid',
                total: 55000,
                items: '[]',
                customer_id: null,
                customer_phone: '0909888777',
                customer_email: 'guest@example.com',
                tenant_id: '',
                created_at: '2026-10-31T08:00:00Z',
              };
            }
            if (id === 'ord-sadec-guest') {
              return {
                id: 'ord-sadec-guest',
                status: 'completed',
                payment_status: 'paid',
                total: 65000,
                items: '[]',
                customer_id: null,
                customer_phone: '0909888777',
                customer_email: 'guest@example.com',
                tenant_id: 'tenant_sadec_02',
                created_at: '2026-10-31T09:00:00Z',
              };
            }
          }
          if (/FROM customers WHERE/i.test(sql)) {
            // Only return customer if tenant matches 'default' (simulating a customer registered only in default store)
            const tenantArg = args[2];
            if (tenantArg === 'default' || tenantArg === '*') {
              return { id: 'cust-default-only' };
            }
            return null;
          }
          if (/FROM cafe_tables/i.test(sql)) {
            if (sql.includes("tenant_id = ''") && args[1] === 'default') {
              return { id: 'tbl-default-01' };
            }
            return null;
          }
          return {
            total_orders: 3,
            total_revenue: 150000,
            completed_orders: 2,
            pending_orders: 1,
            gross: 150000,
            refunds: 0,
            tx_count: 3,
          };
        }),
        all: vi.fn(async () => {
          executedQueries.push({ sql, args });
          if (/FROM orders WHERE id = \?/i.test(sql)) {
            const id = String(args[0] ?? 'ord-default-empty');
            return {
              results: [
                {
                  id,
                  status: id === 'ord-sadec-guest' ? 'served' : 'pending',
                  payment_status: 'paid',
                  total: 55000,
                  items: '[]',
                  customer_name: 'Guest',
                  customer_phone: '0909888777',
                  table_id: 'tbl-default-01',
                  tenant_id: id === 'ord-sadec-guest' ? 'tenant_sadec_02' : '',
                  created_at: '2026-10-31T08:00:00Z',
                },
              ],
            };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          executedQueries.push({ sql, args });
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      const { optionalAuth } = await import('../../middleware/auth');
      const app = new Hono<any>();
      app.route('/', authEndpointsRouter);
      erpnextSyncRoutes(app);
      app.route('/api/floor-plan', floorPlanRouter);
      app.route('/api/admin/sales', adminSalesRouter);
      const analyticsSub = new Hono<any>();
      registerMetricsHandlers(analyticsSub);
      app.route('/api/analytics', analyticsSub);
      app.get('/api/orders/mobile', optionalAuth(), getOrdersMobile);
      app.get('/api/orders/mobile/:id', optionalAuth(), getOrderDetail);

      // 2. L3: Supervisor parity on GET /staff and POST /api/admin/erpnext-sync/:entity
      const supStaffRes = await app.fetch(await authRequest('GET', '/staff', 'supervisor', 'default'), env);
      expect(supStaffRes.status).toBe(200);
      const waiterStaffRes = await app.fetch(await authRequest('GET', '/staff', 'waiter', 'default'), env);
      expect(waiterStaffRes.status).toBe(403);

      const supErpSyncRes = await app.fetch(await authRequest('POST', '/api/admin/erpnext-sync/customers', 'supervisor', 'default'), env);
      expect(supErpSyncRes.status).toBe(200);
      const waiterErpSyncRes = await app.fetch(await authRequest('POST', '/api/admin/erpnext-sync/customers', 'waiter', 'default'), env);
      expect(waiterErpSyncRes.status).toBe(403);

      // 3. L1: Floor-plan summary, admin-sales CSV, payout estimate, mobile orders, and stats include tenant_id = '' for default
      executedQueries.length = 0;
      const fpRes = await app.fetch(await authRequest('GET', '/api/floor-plan/summary', 'supervisor', 'default'), env);
      expect(fpRes.status).toBe(200);
      expect(executedQueries.some((q) => /FROM cafe_tables/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      const csvRes = await app.fetch(await authRequest('GET', '/api/admin/sales/csv', 'supervisor', 'default'), env);
      expect(csvRes.status).toBe(200);
      expect(executedQueries.some((q) => /FROM orders/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      const payoutRes = await app.fetch(await authRequest('GET', '/api/analytics/payout', 'owner', 'default'), env);
      expect(payoutRes.status).toBe(200);
      expect(executedQueries.some((q) => /FROM orders/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      const mobListRes = await app.fetch(await authRequest('GET', '/api/orders/mobile', 'supervisor', 'default'), env);
      expect(mobListRes.status).toBe(200);
      expect(executedQueries.some((q) => /FROM orders/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      const mobDetailRes = await app.fetch(await authRequest('GET', '/api/orders/mobile/ord-default-empty', 'supervisor', 'default'), env);
      expect(mobDetailRes.status).toBe(200);
      expect(executedQueries.some((q) => /FROM orders WHERE id = \?/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      await getStats(new Request('https://test.local/api/orders/stats'), env as any, 'default');
      expect(executedQueries.some((q) => /FROM orders/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      // 4. L2: fetchOrderRecord (SSE), fetchOrderForRead (OpenAPI), resolveOrderCreationTable, transitionOrderStatus
      executedQueries.length = 0;
      await fetchOrderRecord(mockDb as any, 'ord-default-empty', 'default');
      expect(executedQueries.some((q) => /FROM orders/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      await fetchOrderForRead(mockDb as any, 'ord-default-empty', 'default');
      expect(executedQueries.some((q) => /FROM orders/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      const tblId = await resolveOrderCreationTable(mockDb as any, 'T01', 'default');
      expect(tblId).toBe('tbl-default-01');

      executedQueries.length = 0;
      const transRes = await transitionOrderStatus(mockDb as any, 'ord-default-empty', 'confirmed', 'supervisor', { tenantId: 'default' });
      expect(transRes.success).toBe(true);
      expect(executedQueries.some((q) => /UPDATE orders SET status = \?/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      // 5. L2: Cross-tenant guest customer lookup isolation on loyalty trigger & updateOrder
      executedQueries.length = 0;
      await creditLoyaltyIfEligible(mockDb as any, env as any, 'ord-sadec-guest');
      const loyaltyCustQuery = executedQueries.find((q) => /FROM customers WHERE/i.test(q.sql));
      expect(loyaltyCustQuery).toBeDefined();
      expect(loyaltyCustQuery!.sql).toContain("COALESCE(NULLIF(tenant_id, ''), 'default') = ?");
      expect(loyaltyCustQuery!.args).toContain('tenant_sadec_02');
      // Because 'cust-default-only' belongs to 'default', the lookup for 'ord-sadec-guest' returns null and skips cross-tenant accrual
      expect(executedQueries.some((q) => /INSERT INTO cashback_transactions/i.test(q.sql))).toBe(false);

      executedQueries.length = 0;
      const updRes = await updateOrder(
        new Request('https://test.local/api/orders/ord-sadec-guest', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        }),
        env as any,
        'ord-sadec-guest',
        'supervisor',
        'tenant_sadec_02'
      );
      expect(updRes.status).toBe(200);
      const visitCustQueries = executedQueries.filter((q) => /FROM customers WHERE/i.test(q.sql));
      expect(visitCustQueries.length).toBeGreaterThan(0);
      for (const q of visitCustQueries) {
        expect(q.sql).toContain("COALESCE(NULLIF(tenant_id, ''), 'default') = ?");
      }
    });
  });

  // =========================================================================
  // 17. Phase M1–M3: Analytics Tree, POS Customer, Shared Order Listing, KDS Mobile,
  //     Legacy Table Occupancy Updates, Cross-Tenant Order Claim/Ownership & Supervisor Parity
  // =========================================================================
  describe('17. Phase M1–M3: Analytics Tree, Table Occupancy, Order Ownership/Claim & Supervisor Parity', () => {
    it('normalizes default store empty/NULL tenant_id across analytics tree, shared-listing, KDS mobile, POS customer, admin loyalty, table occupancy updates, and enforces cross-tenant order claim/ownership + supervisor parity', async () => {
      const { Hono } = await import('hono');
      const { optionalAuth } = await import('../../middleware/auth');
      const { getOrdersInRange } = await import('../../tree/analytics/csv-export');
      const { getCustomerMetrics } = await import('../../tree/analytics/customer-metrics');
      const { getPeakHours } = await import('../../tree/analytics/peak-hours');
      const { getTopProducts } = await import('../../tree/analytics/top-products');
      const { getZoneStats } = await import('../../tree/analytics/zone-analytics');
      const { posCustomerRouter } = await import('../../routes/pos-customer');
      const { adminLoyaltyRouter } = await import('../../routes/admin-loyalty');
      const { getKdsMobile } = await import('../../../../packages/domain/kitchen/commands/kds-mobile');
      const { handleGuestCheckin } = await import('../../routes/orders-hono-handlers/guest-handlers');
      const { tablesRouter } = await import('../../../../packages/domain/table/commands/tables');
      const { claimGuestOrder, resolveServerOrderOwnership } = await import('../../../../packages/domain/customer/policies/order-ownership-policy');
      const { chatRouter } = await import('../../routes/chat');

      // 1. M1: buildOrderFilterClause default store vs non-default store
      const defFilter = buildOrderFilterClause({ tenantId: 'default', filters: [['o.status', 'pending']] });
      expect(defFilter.clause).toContain("AND (o.tenant_id = ? OR o.tenant_id IS NULL OR o.tenant_id = '')");
      expect(defFilter.params).toEqual(['default', 'pending']);

      const sadFilter = buildOrderFilterClause({ tenantId: 'tenant_sadec_02', filters: [['o.status', 'pending']] });
      expect(sadFilter.clause).toBe(' AND o.tenant_id = ? AND o.status = ?');
      expect(sadFilter.params).toEqual(['tenant_sadec_02', 'pending']);

      const executedQueries: Array<{ sql: string; args: unknown[] }> = [];
      const makeStmt = (sql: string, args: unknown[]) => ({
        sql,
        args,
        first: vi.fn(async () => {
          executedQueries.push({ sql, args });
          if (isAccountLookup(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'default');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
          }
          if (/SELECT id, customer_id, total, order_type FROM orders WHERE id = \?/i.test(sql)) {
            if (args[0] === 'ord-legacy-default') {
              return { id: 'ord-legacy-default', customer_id: null, total: 45000, order_type: 'dine_in' };
            }
          }
          if (/SELECT tenant_id FROM orders WHERE id = \?/i.test(sql)) {
            if (args[0] === 'ord-legacy-default') {
              return { tenant_id: '' };
            }
          }
          if (/FROM cafe_tables WHERE id = \?/i.test(sql)) {
            return { id: 'tbl-legacy-def', table_number: 1, status: 'Available', tenant_id: '' };
          }
          if (/FROM cafe_tables/i.test(sql)) {
            return { id: 'tbl-legacy-def' };
          }
          if (/FROM customers c/i.test(sql)) {
            return {
              id: 'cust-def-pos',
              name: 'Default POS Customer',
              phone: '0901234567',
              email: 'pos@example.com',
              loyalty_tier: 'gold',
              loyalty_points: 120,
              lifetime_points: 200,
              created_at: '2026-10-31T00:00:00Z',
              tenant_id: '',
              cashback_balance: 15000,
              total_earned: 25000,
              total_spent: 10000,
              visit_count: 3,
            };
          }
          if (/FROM customers WHERE/i.test(sql)) {
            const scopedArg = args[2];
            if (scopedArg === 'default') return { id: 'cust-def-only' };
            return null;
          }
          return { total_customers: 5, new_30d: 2, repeat_rate: 0.4, avg_order_value: 55000 };
        }),
        all: vi.fn(async () => {
          executedQueries.push({ sql, args });
          if (/SELECT COUNT\(\*\) as total FROM orders/i.test(sql)) {
            return { results: [{ total: 1 }] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          executedQueries.push({ sql, args });
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
        batch: vi.fn(async (stmts: Array<{ sql: string; args: unknown[] }>) => {
          for (const s of stmts) {
            executedQueries.push({ sql: s.sql, args: s.args });
          }
          return stmts.map(() => ({ success: true, meta: { changes: 1 } }));
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 2. M1: Analytics tree functions include tenant_id = '' for 'default'
      executedQueries.length = 0;
      await getOrdersInRange(mockDb as any, '2026-10-01', '2026-10-31', 'default');
      expect(executedQueries.some((q) => /FROM orders/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      await getCustomerMetrics(mockDb as any, 'default');
      expect(executedQueries.filter((q) => q.sql.includes("tenant_id = ''")).length).toBe(4);

      executedQueries.length = 0;
      await getPeakHours(mockDb as any, 30, 'default');
      expect(executedQueries.some((q) => /FROM orders o/i.test(q.sql) && q.sql.includes("o.tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      await getTopProducts(mockDb as any, 10, 'default');
      expect(executedQueries.some((q) => /JOIN orders o/i.test(q.sql) && q.sql.includes("o.tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      await getZoneStats(mockDb as any, 30, 'default');
      expect(executedQueries.some((q) => /FROM orders o/i.test(q.sql) && q.sql.includes("o.tenant_id = ''"))).toBe(true);

      // 3. M1: getAdminOrders for 'default' includes tenant_id = '' in both main and count queries
      executedQueries.length = 0;
      const adminOrdRes = await getAdminOrders(new Request('https://test.local/api/admin/orders'), env as any, 'default');
      expect(adminOrdRes.status).toBe(200);
      expect(executedQueries.some((q) => /FROM orders o/i.test(q.sql) && q.sql.includes("o.tenant_id = ''"))).toBe(true);
      expect(executedQueries.some((q) => /SELECT COUNT\(\*\)/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      // 4. M1 + M2 + M3: Mount routers for KDS mobile, POS customer, admin loyalty, guest checkin, tables, and chat
      const app = new Hono<any>();
      app.get('/mobile/kds/orders', optionalAuth(), getKdsMobile);
      app.route('/api/pos/customer', posCustomerRouter);
      app.route('/api/admin-loyalty', adminLoyaltyRouter);
      app.post('/api/orders/guest-checkin', optionalAuth(), handleGuestCheckin);
      app.route('/api/tables', tablesRouter);
      app.route('/api/chat', chatRouter);

      executedQueries.length = 0;
      const kdsMobRes = await app.fetch(await authRequest('GET', '/mobile/kds/orders', 'supervisor', 'default'), env);
      expect(kdsMobRes.status).toBe(200);
      expect(executedQueries.some((q) => /FROM orders o/i.test(q.sql) && q.sql.includes("o.tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      const posCustRes = await app.fetch(await authRequest('GET', '/api/pos/customer?phone=0901234567', 'supervisor', 'default'), env);
      expect(posCustRes.status).toBe(200);
      expect(executedQueries.some((q) => q.sql.includes("o.tenant_id = ''") && q.sql.includes("c.tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      const topCustRes = await app.fetch(await authRequest('GET', '/api/admin-loyalty/top-customers', 'supervisor', 'default'), env);
      expect(topCustRes.status).toBe(200);
      expect(executedQueries.some((q) => q.sql.includes("COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default')"))).toBe(true);

      // 5. M2: handleGuestCheckin and tablesRouter PATCH /:id/occupy include tenant_id = '' for default store
      executedQueries.length = 0;
      const guestCheckinRes = await app.fetch(
        new Request('https://test.local/api/orders/guest-checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_id: 'tbl-legacy-def', customer_name: 'QR Guest', customer_phone: '0901234567' }),
        }),
        env
      );
      expect(guestCheckinRes.status).toBe(201);
      expect(executedQueries.some((q) => /UPDATE cafe_tables SET status = 'Occupied'/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      executedQueries.length = 0;
      const occupyRes = await app.fetch(await authRequest('PATCH', '/api/tables/tbl-legacy-def/occupy', 'supervisor', 'default'), env);
      expect(occupyRes.status).toBe(200);
      expect(executedQueries.some((q) => /UPDATE cafe_tables SET status = \?/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      // 6. M2: claimGuestOrder blocks non-default tenant from claiming legacy default-store order (tenant_id = '')
      const crossClaim = await claimGuestOrder({
        db: mockDb as any,
        orderId: 'ord-legacy-default',
        actor: { id: 'cust-sad-1', role: 'customer' },
        tenantId: 'tenant_sadec_02',
      });
      expect(crossClaim.success).toBe(false);
      expect(crossClaim.statusCode).toBe(404);

      const validClaim = await claimGuestOrder({
        db: mockDb as any,
        orderId: 'ord-legacy-default',
        actor: { id: 'cust-def-1', role: 'customer' },
        tenantId: 'default',
      });
      expect(validClaim.success).toBe(true);

      // 7. M2: resolveServerOrderOwnership scopes staff phone lookup by tenantId
      executedQueries.length = 0;
      const sadOwnership = await resolveServerOrderOwnership({
        actor: { id: 'user-supervisor', role: 'supervisor' },
        customerPhone: '0901234567',
        db: mockDb as any,
        tenantId: 'tenant_sadec_02',
      });
      expect(sadOwnership.customerId).toBeNull();
      expect(executedQueries.some((q) => /FROM customers WHERE/i.test(q.sql) && q.sql.includes("COALESCE(NULLIF(tenant_id, ''), 'default') = ?"))).toBe(true);

      const defOwnership = await resolveServerOrderOwnership({
        actor: { id: 'user-supervisor', role: 'supervisor' },
        customerPhone: '0901234567',
        db: mockDb as any,
        tenantId: 'default',
      });
      expect(defOwnership.customerId).toBe('cust-def-only');

      // 8. M3: Chat router allows supervisor role (not 403)
      const chatSupRes = await app.fetch(await authRequest('GET', '/api/chat/conversations', 'supervisor', 'default'), env);
      expect(chatSupRes.status).not.toBe(403);
    });
  });

  // =========================================================================
  // 18. Phase N1–N3: CRM Cross-Tenant Order Correlation, Loyalty Legacy Default
  //     Store Guards, Promotions/StaffTips/WiFi Empty-String Normalization & Supervisor Parity
  // =========================================================================
  describe('18. Phase N1–N3: CRM Cross-Tenant Order Correlation, Loyalty Legacy Default Guards, Promotions/StaffTips/WiFi Empty-String Normalization & Supervisor Parity', () => {
    it('correlates CRM 360/segments/events/account/lookup orders by tenant, guards legacy default-store loyalty cashback/phone-auth/OTP, normalizes empty-string tenant_id in promotions/staff-tips/wifi, and enforces supervisor parity (N1–N3)', async () => {
      const { Hono } = await import('hono');
      const { getCustomer360 } = await import('../../../../packages/domain/crm/commands/customer-360');
      const { buildSegment } = await import('../../../../packages/domain/crm/commands/segments');
      const { aggregateEvents } = await import('../../../../packages/domain/crm/commands/aggregate-events');
      const { getCustomerAccount } = await import('../../../../packages/domain/crm/commands/get-customer-account');
      const { lookupProfile } = await import('../../../../packages/domain/crm/lookup-profile');
      const { getFulfillment } = await import('../../../../packages/domain/crm/commands/get-fulfillment');
      const { getOrder } = await import('../../../../packages/domain/order/queries/get-order');
      const { handleSpendCashback } = await import('../../tree/loyalty/spend-cashback-handler');
      const { handlePhoneAuth } = await import('../../tree/loyalty/phone-auth-handler');
      const { handlePhoneOtpRequest } = await import('../../tree/loyalty/phone-otp-handler');
      const { promotionsRouter } = await import('../../routes/promotions');
      const { staffTipsRouter } = await import('../../../../packages/domain/staff/commands/staff-tips');
      const { authorizeWifiOverride } = await import('../../tree/wifi/session');
      const { campaignsRouter } = await import('../../routes/campaigns');
      const { crmRouter } = await import('../../routes/crm');
      const { handleErpnextRequest } = await import('../../routes/erpnext');

      const executedQueries: Array<{ sql: string; args: unknown[] }> = [];
      const makeStmt = (sql: string, args: unknown[]) => ({
        sql,
        args,
        first: vi.fn(async () => {
          executedQueries.push({ sql, args });
          if (isAccountLookup(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'default');
            if (args[0] === 'user-waiter') return staffAccountRow('waiter', 'default');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
          }
          if (/FROM cashback_transactions/i.test(sql)) return null;
          if (/FROM orders WHERE id = \?/i.test(sql)) {
            const oid = String(args[0] ?? '');
            if (oid === 'ord-legacy-def') {
              return {
                id: 'ord-legacy-def',
                status: 'pending',
                channel: 'pickup',
                order_type: 'pickup',
                customer_id: 'cust-def-1',
                total: 50000,
                total_amount: 50000,
                created_at: '2026-10-31T08:00:00Z',
                tenant_id: '',
              };
            }
            if (oid === 'ord-sad-1') {
              return {
                id: 'ord-sad-1',
                status: 'pending',
                channel: 'pickup',
                order_type: 'pickup',
                customer_id: 'cust-sad-1',
                total: 60000,
                total_amount: 60000,
                created_at: '2026-10-31T09:00:00Z',
                tenant_id: 'tenant_sadec_02',
              };
            }
          }
          if (/SELECT COUNT\(\*\) AS c FROM orders/i.test(sql)) {
            return { c: 2 };
          }
          if (/FROM customers WHERE/i.test(sql)) {
            return {
              id: 'cust-def-1',
              name: 'Default Member',
              phone: '0901234567',
              email: 'def@aura.vn',
              loyalty_tier: 'gold',
              loyalty_points: 100,
              lifetime_points: 250,
              created_at: '2026-10-01T00:00:00Z',
              tenant_id: '',
              verified_at: null,
            };
          }
          if (/FROM promotions WHERE/i.test(sql)) {
            return {
              id: 'promo-def-1',
              code: 'SUMMER10',
              percent: 10,
              max_discount: 20000,
              min_order: 30000,
              usage_limit: 100,
              usage_count: 1,
              starts_at: null,
              expires_at: null,
              is_active: 1,
              tenant_id: '',
            };
          }
          if (/FROM campaign_configs WHERE trigger = \?/i.test(sql)) {
            return {
              trigger: args[0] ?? 'welcome',
              is_active: 1,
              channels: '["zalo"]',
              timing: 'immediate',
              updated_at: '2026-10-31T00:00:00Z',
            };
          }
          return null;
        }),
        all: vi.fn(async () => {
          executedQueries.push({ sql, args });
          if (/FROM orders o\s+LEFT JOIN customers c/i.test(sql)) {
            return {
              results: [
                {
                  id: 'ord-legacy-def',
                  type: 'OrderLinked',
                  source: 'order',
                  timestamp: '2026-10-31T08:00:00Z',
                  payload: JSON.stringify({ total: 50000, status: 'completed', payment_method: 'cash' }),
                  total: 50000,
                  items: JSON.stringify([{ name: 'Latte', quantity: 1 }]),
                  channel: 'pickup',
                  payment_method: 'cash',
                  created_at: '2026-10-31T08:00:00Z',
                },
              ],
            };
          }
          if (/FROM customers c\s+LEFT JOIN orders o/i.test(sql)) {
            return {
              results: [
                {
                  id: 'cust-def-1',
                  name: 'Default Member',
                  phone: '0901234567',
                  tier: 'gold',
                  lifetime_points: 250,
                  last_order_at: '2026-10-31T08:00:00Z',
                  first_order_at: '2026-10-29T08:00:00Z',
                  order_count: 1,
                },
              ],
            };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          executedQueries.push({ sql, args });
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. N1: CRM 360, segments, aggregateEvents, getCustomerAccount, lookupProfile correlate orders by tenant_id
      executedQueries.length = 0;
      const c360 = await getCustomer360(mockDb as any, 'cust-def-1');
      expect(c360.customerId).toBe('cust-def-1');
      expect(
        executedQueries.some(
          (q) =>
            /FROM orders o\s+LEFT JOIN customers c/i.test(q.sql) &&
            q.sql.includes("COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default')")
        )
      ).toBe(true);

      executedQueries.length = 0;
      const seg = await buildSegment(mockDb as any, 'new_first_week', undefined, { tenantId: 'default' }, new Date('2026-10-31T12:00:00Z'));
      expect(seg.count).toBe(1);
      expect(
        executedQueries.some(
          (q) =>
            /FROM customers c\s+LEFT JOIN orders o/i.test(q.sql) &&
            q.sql.includes("COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default')") &&
            q.sql.includes("WHERE COALESCE(NULLIF(c.tenant_id, ''), 'default') = ?")
        )
      ).toBe(true);

      executedQueries.length = 0;
      await aggregateEvents(mockDb as any, 'cust-def-1');
      expect(
        executedQueries.some(
          (q) =>
            /OrderLinked/i.test(q.sql) &&
            q.sql.includes("COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default')")
        )
      ).toBe(true);

      executedQueries.length = 0;
      await getCustomerAccount(mockDb as any, 'cust-def-1');
      expect(
        executedQueries.some(
          (q) => /FROM orders/i.test(q.sql) && q.sql.includes("AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?") && q.args.includes('default')
        )
      ).toBe(true);

      executedQueries.length = 0;
      await lookupProfile(mockDb as any, '0901234567', { tenantId: 'default' });
      expect(
        executedQueries.some(
          (q) => /FROM orders/i.test(q.sql) && q.sql.includes("AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?2")
        )
      ).toBe(true);

      // 2. N1: getFulfillment blocks cross-tenant order access and normalizes queueDepth with NULLIF(tenant_id, '')
      const crossFulfillment = await getFulfillment(mockDb as any, 'ord-legacy-def', undefined, undefined, 'tenant_sadec_02');
      expect(crossFulfillment.ok).toBe(false);
      if (!crossFulfillment.ok) {
        expect(crossFulfillment.code).toBe('forbidden');
      }

      executedQueries.length = 0;
      const sameFulfillment = await getFulfillment(mockDb as any, 'ord-legacy-def', undefined, undefined, 'default');
      expect(sameFulfillment.ok).toBe(true);
      expect(
        executedQueries.some(
          (q) => /SELECT COUNT\(\*\) AS c FROM orders/i.test(q.sql) && q.sql.includes("COALESCE(NULLIF(tenant_id, ''), 'default') = ?")
        )
      ).toBe(true);

      // 3. N1: getOrder scopes by default empty/NULL tenant_id when tenantId is provided
      executedQueries.length = 0;
      await getOrder(new Request('https://test.local/api/orders/ord-legacy-def'), env as any, 'ord-legacy-def', 'default');
      expect(executedQueries.some((q) => /FROM orders WHERE id = \?/i.test(q.sql) && q.sql.includes("tenant_id = ''"))).toBe(true);

      // 4. N2: Loyalty spend-cashback, phone-auth, and phone-otp reject legacy default-store row (tenant_id = '') when called from tenant_sadec_02
      const loyaltyApp = new Hono<any>();
      loyaltyApp.post('/spend-cashback', async (c, next) => {
        c.set('customer', { id: 'cust-def-1', tenant_id: 'tenant_sadec_02' });
        await next();
      }, handleSpendCashback);
      loyaltyApp.post('/phone-auth', handlePhoneAuth);
      loyaltyApp.post('/phone-otp/request', handlePhoneOtpRequest);

      const sadecEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        PILOT_TENANT_ID: 'tenant_sadec_02',
        AURA_DB: mockDb as any,
      });

      const crossSpendRes = await loyaltyApp.fetch(
        new Request('https://test.local/spend-cashback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord-legacy-def', amount: 10000 }),
        }),
        sadecEnv
      );
      expect(crossSpendRes.status).toBe(403);

      const crossPhoneAuthRes = await loyaltyApp.fetch(
        new Request('https://test.local/phone-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '0901234567' }),
        }),
        sadecEnv
      );
      expect(crossPhoneAuthRes.status).toBe(403);

      const crossPhoneOtpRes = await loyaltyApp.fetch(
        new Request('https://test.local/phone-otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '0901234567' }),
        }),
        sadecEnv
      );
      expect(crossPhoneOtpRes.status).toBe(403);

      // 5. N2: Promotions PATCH & DELETE in 'default' store scope by COALESCE(NULLIF(tenant_id, ''), 'default') = ? so they do not clobber franchise rows
      const app = new Hono<any>();
      app.route('/api/promotions', promotionsRouter);
      app.route('/api/staff-tips', staffTipsRouter);
      app.route('/api/campaigns', campaignsRouter);
      app.route('/api/crm', crmRouter);

      executedQueries.length = 0;
      const patchPromoRes = await app.fetch(
        await authRequest('PATCH', '/api/promotions/SUMMER10', 'supervisor', 'default', { percent: 15 }),
        env
      );
      expect(patchPromoRes.status).toBe(200);
      expect(
        executedQueries.some(
          (q) => /UPDATE promotions/i.test(q.sql) && q.sql.includes("WHERE code = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?")
        )
      ).toBe(true);

      executedQueries.length = 0;
      const delPromoRes = await app.fetch(
        await authRequest('DELETE', '/api/promotions/SUMMER10', 'supervisor', 'default'),
        env
      );
      expect(delPromoRes.status).toBe(200);
      expect(
        executedQueries.some(
          (q) => /DELETE FROM promotions WHERE code = \? AND COALESCE\(NULLIF\(tenant_id, ''\), 'default'\) = \?/i.test(q.sql)
        )
      ).toBe(true);

      // 6. N2: Staff tips and WiFi revoke normalize empty-string tenant_id with NULLIF(tenant_id, '')
      executedQueries.length = 0;
      const tipsRes = await app.fetch(await authRequest('GET', '/api/staff-tips', 'supervisor', 'default'), env);
      expect(tipsRes.status).toBe(200);
      expect(
        executedQueries.some((q) => /FROM orders o/i.test(q.sql) && q.sql.includes("COALESCE(NULLIF(o.tenant_id, ''), 'default') = ?"))
      ).toBe(true);

      executedQueries.length = 0;
      await authorizeWifiOverride(env as any, { mac: 'AA:BB:CC:11:22:33', action: 'revoke' }, 'default');
      expect(
        executedQueries.some(
          (q) =>
            /UPDATE wifi_sessions SET status = 'revoked'/i.test(q.sql) &&
            q.sql.includes("COALESCE(NULLIF(tenant_id, ''), 'default') = ?") &&
            q.args.includes('default')
        )
      ).toBe(true);

      // 7. N3: Inner supervisor role parity on CRM consent update and ERPNext configure
      const supConsentRes = await app.fetch(
        await authRequest('PATCH', '/api/crm/account/consent', 'supervisor', 'default', {
          customerId: 'cust-def-1',
          purpose: 'marketing',
          granted: true,
        }),
        env
      );
      expect(supConsentRes.status).toBe(200);

      const supErpCfgReq = await authRequest('DELETE', '/api/erpnext/configure', 'supervisor', 'default');
      const supErpCfgRes = await handleErpnextRequest(supErpCfgReq, env as any, 'default');
      expect(supErpCfgRes.status).toBe(200);

      const waiterErpCfgReq = await authRequest('DELETE', '/api/erpnext/configure', 'waiter', 'default');
      const waiterErpCfgRes = await handleErpnextRequest(waiterErpCfgReq, env as any, 'default');
      expect(waiterErpCfgRes.status).toBe(403);
    });
  });

  describe('19. Phase O1–O3: Auth Customer Session, Order Promo/Welcome, HomeAssistant, Frigate, Mixpost, Mautic, Zalo, WiFi & ERPNext Sync Default-Store Isolation & Empty-String Normalization', () => {
    it('isolates default-store customer sessions, order promos/WELCOME discounts, IoT/marketing integrations, and ERPNext sync status across default, empty-string, and franchise tenants', async () => {
      const { getCurrentUser } = await import('../../tree/auth/current-user');
      const { getAuthSession } = await import('../../routes/auth-session');
      const { createOrder } = await import('../../../../packages/domain/order/commands/create-order');
      const { getDeviceState, toggleDevice, getZoneDevices } = await import('../../tree/homeassistant/devices');
      const { getAutomationLog } = await import('../../tree/homeassistant/automations');
      const { createHARouter } = await import('../../routes/homeassistant/index');
      const { getFrigateEvents } = await import('../../tree/integrations/frigate/sync');
      const { resolveTemplate } = await import('../../tree/mixpost/template-resolver');
      const { matchesMauticTenant } = await import('../../tree/mautic/sync-state');
      const { notifyMember } = await import('../../tree/zalo/notify-member');
      const { checkWifiSessionStatus } = await import('../../tree/wifi/session');
      const { erpnextSyncRoutes } = await import('../../routes/erpnext-sync');
      const { Hono } = await import('hono');

      const executedQueries: Array<{ sql: string; args: unknown[] }> = [];
      const mockDb = {
        async batch(stmts: unknown[]) {
          return stmts.map(() => ({ success: true, meta: { changes: 1 } }));
        },
        prepare(sql: string) {
          let boundArgs: unknown[] = [];
          const runFirst = async () => {
            executedQueries.push({ sql, args: boundArgs });
            if (/FROM users WHERE id = \?/i.test(sql)) {
              if (boundArgs[0] === 'user-owner') return staffAccountRow('owner', 'default');
            }
            if (/FROM products WHERE id = \?/i.test(sql)) {
              return { id: 'prod_1', name: 'Cà Phê', price: 100000, is_available: 1, available: 1, category_id: 'cat_coffee' };
            }
            if (/SELECT .* FROM customers WHERE id = \?/i.test(sql)) {
              const id = String(boundArgs[0] || '');
              if (id === 'cust_legacy_null') {
                return { id: 'cust_legacy_null', name: 'Legacy Null', phone: '0901112222', email: 'null@aura.vn', tenant_id: null };
              }
              if (id === 'cust_legacy_empty') {
                return { id: 'cust_legacy_empty', name: 'Legacy Empty', phone: '0901113333', email: 'empty@aura.vn', tenant_id: '' };
              }
              if (id === 'cust_fran') {
                return { id: 'cust_fran', name: 'Fran Cust', phone: '0901114444', email: 'fran@aura.vn', tenant_id: 'tenant_sadec_02' };
              }
            }
            if (/SELECT \* FROM promotions WHERE UPPER\(code\) = \?/i.test(sql)) {
              const code = String(boundArgs[0] || '');
              const reqTenant = String(boundArgs[1] || 'default');
              if (code === 'FRANONLY' && reqTenant === 'tenant_sadec_02') {
                return {
                  id: 'promo_fran',
                  code: 'FRANONLY',
                  percent: 20,
                  max_discount: 50000,
                  min_order: 0,
                  usage_limit: 100,
                  usage_count: 0,
                  is_active: 1,
                  tenant_id: 'tenant_sadec_02',
                };
              }
              return null;
            }
            if (/SELECT COUNT\(\*\) AS cnt FROM orders WHERE \(customer_id = \? OR customer_phone = \?\)/i.test(sql)) {
              const reqTenant = String(boundArgs[2] || '');
              // Guest has 2 prior orders at 'default', 0 at 'tenant_sadec_02'
              return { cnt: reqTenant === 'tenant_sadec_02' ? 0 : 2 };
            }
            if (/FROM ha_device_states WHERE entity_id = \?/i.test(sql)) {
              const entityId = String(boundArgs[0] || '');
              if (entityId === 'light.fran_zone') {
                return { entity_id: 'light.fran_zone', state: 'off', attributes: '{}', last_changed: '2026-10-31T00:00:00Z', last_updated: '2026-10-31T00:00:00Z', tenant_id: 'tenant_sadec_02' };
              }
              if (entityId === 'light.def_empty') {
                return { entity_id: 'light.def_empty', state: 'off', attributes: '{}', last_changed: '2026-10-31T00:00:00Z', last_updated: '2026-10-31T00:00:00Z', tenant_id: '' };
              }
            }
            if (/FROM wifi_sessions WHERE client_mac = \?/i.test(sql)) {
              return {
                id: 'wifi_def_1',
                client_mac: 'AA:BB:CC:DD:EE:01',
                phone: '0901234567',
                status: 'authorized',
                authorized_at: new Date(Date.now() - 60_000).toISOString(),
                expires_at: new Date(Date.now() + 3600_000).toISOString(),
                tenant_id: '',
              };
            }
            if (/SELECT COUNT\(\*\) AS cnt FROM erpnext_sync_queue/i.test(sql)) {
              const reqTenant = String(boundArgs[0] || '');
              return { cnt: reqTenant === 'default' ? 2 : 9 };
            }
            return null;
          };
          const runAll = async () => {
            executedQueries.push({ sql, args: boundArgs });
            if (/FROM ha_device_states WHERE entity_id LIKE \?/i.test(sql) || /FROM ha_device_states ORDER BY entity_id/i.test(sql)) {
              return {
                results: [
                  { entity_id: 'light.indoor_def_empty', state: 'on', attributes: '{}', last_changed: '2026-10-31T00:00:00Z', last_updated: '2026-10-31T00:00:00Z', tenant_id: '' },
                  { entity_id: 'light.indoor_fran_zone', state: 'on', attributes: '{}', last_changed: '2026-10-31T00:00:00Z', last_updated: '2026-10-31T00:00:00Z', tenant_id: 'tenant_sadec_02' },
                ],
                success: true,
              };
            }
            if (/FROM ha_automation_log/i.test(sql)) {
              return {
                results: [
                  { id: 1, automation_id: 'r_def', trigger_entity: 'sensor.temp', payload: '{}', result: 'ok', executed_at: '2026-10-31T01:00:00Z', tenant_id: '' },
                  { id: 2, automation_id: 'r_fran', trigger_entity: 'sensor.temp', payload: '{}', result: 'ok', executed_at: '2026-10-31T02:00:00Z', tenant_id: 'tenant_sadec_02' },
                ],
                success: true,
              };
            }
            if (/FROM frigate_events/i.test(sql)) {
              return {
                results: [
                  { id: 'fe_def', camera: 'cam_1', label: 'person', start_time: 1000, end_time: 1010, score: 0.92, payload: '{}', received_at: '2026-10-31T01:00:00Z', tenant_id: '' },
                  { id: 'fe_fran', camera: 'cam_2', label: 'person', start_time: 2000, end_time: 2010, score: 0.95, payload: '{}', received_at: '2026-10-31T02:00:00Z', tenant_id: 'tenant_sadec_02' },
                ],
                success: true,
              };
            }
            if (/SELECT tenant_id FROM customers/i.test(sql)) {
              return {
                results: [
                  { tenant_id: '' },
                  { tenant_id: 'default' },
                  { tenant_id: 'tenant_sadec_02' },
                ],
                success: true,
              };
            }
            if (/SELECT tenant_id FROM orders WHERE DATE\(created_at\) = \?/i.test(sql)) {
              return {
                results: [
                  { tenant_id: '' },
                  { tenant_id: 'tenant_sadec_02' },
                ],
                success: true,
              };
            }
            if (/FROM erpnext_sync_logs ORDER BY created_at DESC/i.test(sql)) {
              return {
                results: [
                  { id: 'log_fran', method: 'POST', endpoint: '/api/admin/erpnext-sync/orders', request_body: JSON.stringify({ tenant_id: 'tenant_sadec_02' }), response_body: null, error: 'Franchise ERP Error', created_at: '2026-10-31T04:00:00Z', tenant_id: 'tenant_sadec_02' },
                  { id: 'log_def', method: 'POST', endpoint: '/api/admin/erpnext-sync/inventory', request_body: JSON.stringify({ tenant_id: 'default' }), response_body: '{}', error: null, created_at: '2026-10-31T03:00:00Z', tenant_id: '' },
                ],
                success: true,
              };
            }
            return { results: [], success: true };
          };
          const runExec = async () => {
            executedQueries.push({ sql, args: boundArgs });
            return { success: true, meta: { changes: 1 } };
          };
          return {
            bind(...args: unknown[]) {
              boundArgs = args;
              return { first: runFirst, all: runAll, run: runExec };
            },
            first: runFirst,
            all: runAll,
            run: runExec,
          };
        },
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. O1: Customer session guard blocks franchise JWT on legacy null/empty tenant_id customer rows
      const franCustOnLegacyNullJwt = await generateJWT(
        { id: 'cust_legacy_null', sub: 'cust_legacy_null', role: 'customer', type: 'access', tenantId: 'tenant_sadec_02' } as any,
        TEST_JWT_SECRET,
        3600
      );
      const franCustOnLegacyEmptyJwt = await generateJWT(
        { id: 'cust_legacy_empty', sub: 'cust_legacy_empty', role: 'customer', type: 'access', tenantId: 'tenant_sadec_02' } as any,
        TEST_JWT_SECRET,
        3600
      );
      const defCustOnLegacyEmptyJwt = await generateJWT(
        { id: 'cust_legacy_empty', sub: 'cust_legacy_empty', role: 'customer', type: 'access', tenantId: 'default' } as any,
        TEST_JWT_SECRET,
        3600
      );

      const treeNullRes = await getCurrentUser(
        new Request('https://api.test/api/auth/me', { headers: { Authorization: `Bearer ${franCustOnLegacyNullJwt}` } }),
        env as any
      );
      expect(treeNullRes.status).toBe(403);

      const routeEmptyRes = await getAuthSession(
        new Request('https://api.test/api/auth/me', { headers: { Authorization: `Bearer ${franCustOnLegacyEmptyJwt}` } }),
        env as any
      );
      expect(routeEmptyRes.status).toBe(403);

      const routeDefEmptyRes = await getAuthSession(
        new Request('https://api.test/api/auth/me', { headers: { Authorization: `Bearer ${defCustOnLegacyEmptyJwt}` } }),
        env as any
      );
      expect(routeDefEmptyRes.status).toBe(200);

      // 2. O1: Order creation promo & WELCOME first-visit discount scoped by tenant
      const welcomeFranOrderRes = await createOrder(
        new Request('https://api.test/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Guest Fran',
            customer_phone: '0908889999',
            order_type: 'takeaway',
            payment_method: 'cod',
            total: 100000,
            items: [{ id: 'prod_1', name: 'Cà Phê', price: 100000, quantity: 1 }],
            promo_code: 'WELCOME',
          }),
        }),
        env as any,
        undefined,
        { id: 'staff_fran', role: 'staff', tenantId: 'tenant_sadec_02' }
      );
      expect(welcomeFranOrderRes.status).toBe(201);

      // Same guest ordering with WELCOME at 'default' where they already have 2 orders -> rejected (400)
      const welcomeDefOrderRes = await createOrder(
        new Request('https://api.test/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Guest Fran',
            customer_phone: '0908889999',
            order_type: 'takeaway',
            payment_method: 'cod',
            total: 100000,
            items: [{ id: 'prod_1', name: 'Cà Phê', price: 100000, quantity: 1 }],
            promo_code: 'WELCOME',
          }),
        }),
        env as any
      );
      expect(welcomeDefOrderRes.status).toBe(400);

      // Franchise promo code 'FRANONLY' rejected when ordering at 'default'
      const crossTenantPromoOrderRes = await createOrder(
        new Request('https://api.test/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Guest Def',
            customer_phone: '0908889999',
            order_type: 'takeaway',
            payment_method: 'cod',
            total: 100000,
            items: [{ id: 'prod_1', name: 'Cà Phê', price: 100000, quantity: 1 }],
            promo_code: 'FRANONLY',
          }),
        }),
        env as any
      );
      expect(crossTenantPromoOrderRes.status).toBe(400);

      // 3. O2: HomeAssistant, Frigate, Mixpost, Mautic, Zalo, WiFi default-store isolation & empty-string normalization
      const defViewFranDevice = await getDeviceState(env as any, 'light.fran_zone', 'default');
      expect(defViewFranDevice.status).toBe(404);
      const defViewEmptyDevice = await getDeviceState(env as any, 'light.def_empty', 'default');
      expect(defViewEmptyDevice.status).toBe(200);
      const defViewEmptyBody = (await defViewEmptyDevice.json()) as { device: { entity_id: string } };
      expect(defViewEmptyBody.device.entity_id).toBe('light.def_empty');
      const franViewEmptyDevice = await getDeviceState(env as any, 'light.def_empty', 'tenant_sadec_02');
      expect(franViewEmptyDevice.status).toBe(404);

      executedQueries.length = 0;
      const crossToggle = await toggleDevice(env as any, 'light.fran_zone', true, 'default');
      expect(crossToggle.status).toBe(404);
      expect(executedQueries.some((q) => /UPDATE ha_device_states/i.test(q.sql))).toBe(false);

      const defZoneDevicesRes = await getZoneDevices(env as any, 'indoor', 'default');
      const defZoneDevicesBody = (await defZoneDevicesRes.json()) as { devices: Array<{ entity_id: string }> };
      expect(defZoneDevicesBody.devices.map((d) => d.entity_id)).toEqual(['light.indoor_def_empty']);

      const defAutoLogsRes = await getAutomationLog(env as any, 20, 'default');
      const defAutoLogsBody = (await defAutoLogsRes.json()) as { entries: Array<{ automation_id: string }> };
      expect(defAutoLogsBody.entries.map((l) => l.automation_id)).toEqual(['r_def']);

      const haApp = new Hono<{ Bindings: any }>();
      haApp.route('/api/ha', createHARouter());
      const haDevicesRes = await haApp.fetch(
        await authRequest('GET', '/api/ha/devices', 'owner', 'default'),
        env
      );
      expect(haDevicesRes.status).toBe(200);
      const haDevicesBody = (await haDevicesRes.json()) as { devices: Array<{ entity_id: string }> };
      expect(haDevicesBody.devices.map((d) => d.entity_id)).toEqual(['light.indoor_def_empty']);

      const defFrigateEvents = await getFrigateEvents(env as any, { tenantId: 'default' });
      expect(defFrigateEvents.events.map((e) => e.id)).toEqual(['fe_def']);

      const mixpostResolved = await resolveTemplate('Customers: {{total_customers}}, Orders: {{today_orders}}', env as any, 'default');
      expect(mixpostResolved).toBe('Customers: 2, Orders: 1');

      expect(matchesMauticTenant({ tenant_id: '' }, 'default')).toBe(true);
      expect(matchesMauticTenant({ tenant_id: '' }, 'tenant_sadec_02')).toBe(false);

      const zaloCrossNotify = await notifyMember(env as any, {
        customer_id: 'cust_legacy_empty',
        template_key: 'order_confirmed',
        data: { order_id: 'ord_1' },
        tenantId: 'tenant_sadec_02',
      });
      expect(zaloCrossNotify.ok).toBe(false);
      expect(zaloCrossNotify.reason).toBe('customer_not_found');

      const wifiCheckFranOnEmpty = await checkWifiSessionStatus(env as any, 'AA:BB:CC:DD:EE:01', 'tenant_sadec_02');
      expect(wifiCheckFranOnEmpty.authorized).toBe(false);
      const wifiCheckDefOnEmpty = await checkWifiSessionStatus(env as any, 'AA:BB:CC:DD:EE:01', 'default');
      expect(wifiCheckDefOnEmpty.authorized).toBe(true);

      // 4. O3: ERPNext Sync Status default-store isolation (excludes franchise error logs & queue count)
      const erpSyncApp = new Hono<{ Bindings: Env }>();
      erpnextSyncRoutes(erpSyncApp);
      const erpStatusRes = await erpSyncApp.fetch(
        await authRequest('GET', '/api/admin/erpnext-sync/status', 'owner', 'default'),
        env
      );
      expect(erpStatusRes.status).toBe(200);
      const erpStatusBody = (await erpStatusRes.json()) as {
        status: string;
        pendingItems: number;
        lastSync: string | null;
        errorMessage?: string;
        logs: Array<{ id: string }>;
      };
      expect(erpStatusBody.logs.map((l) => l.id)).toEqual(['log_def']);
      expect(erpStatusBody.lastSync).toBe('2026-10-31T03:00:00Z');
      expect(erpStatusBody.errorMessage).toBeUndefined();
      expect(erpStatusBody.pendingItems).toBe(2);
      expect(erpStatusBody.status).toBe('pending');
    });
  });

  // =========================================================================
  // Suite 20: Phase P1–P3 — Mautic Bridge Default-Store Sync, Checkin Multi-Store Phone Ordering, Subscriptions Invoice/MRR Isolation, CRM Segments Tenant Options & Whitespace Normalization
  // =========================================================================
  describe('Suite 20: Mautic Bridge Default Sync, Checkin Multi-Store Phone, Subscriptions Invoice/MRR, CRM Segments & Whitespace Normalization (P1–P3)', () => {
    it('enforces Mautic bridge default-store scoping, checkin phone tenant ordering, subscription invoice & MRR isolation, CRM listSegments tenant option, and whitespace tenant_id normalization (P1–P3)', async () => {
      const { handleMauticBridgeRequest } = await import('../../tree/mautic/bridge-handler');
      const { checkinRouter } = await import('../../routes/checkin');
      const { createSubscription, getMRRTrend } = await import('../../tree/subscriptions/sub-handlers');
      const { listInvoices, payInvoice, generateInvoices } = await import('../../tree/subscriptions/invoice-handlers');
      const { listSegments } = await import('../../../../packages/domain/crm/commands/segments');
      const { matchesTenantRow } = await import('../../lib/db');
      const { getTablesMobile } = await import('../../routes/tables-mobile');
      const { Hono } = await import('hono');

      // 1. P3: Universal whitespace-only tenant_id normalization
      expect(matchesTenantRow({ id: 'r1', tenant_id: '   ' }, 'default')).toBe(true);
      expect(matchesTenantRow({ id: 'r1', tenant_id: '   ' }, 'tenant_sadec_02')).toBe(false);
      expect(matchesTenantRow({ id: 'r2' }, 'default')).toBe(true);
      expect(matchesTenantRow({ id: 'r2' }, 'tenant_sadec_02')).toBe(false);

      const customers: Array<Record<string, unknown>> = [
        {
          id: 'cust_def_phone',
          name: 'Default Member',
          phone: '0907778888',
          email: 'def@aura.vn',
          loyalty_points: 120,
          lifetime_points: 120,
          loyalty_tier: 'silver',
          total_spent: 500000,
          visit_count: 5,
          tenant_id: '   ',
          created_at: '2026-10-01T00:00:00Z',
        },
        {
          id: 'cust_fran_phone',
          name: 'SaDec Member',
          phone: '0907778888',
          email: 'fran@aura.vn',
          loyalty_points: 300,
          lifetime_points: 300,
          loyalty_tier: 'gold',
          total_spent: 1500000,
          visit_count: 10,
          tenant_id: 'tenant_sadec_02',
          created_at: '2026-10-01T00:00:00Z',
        },
      ];

      const checkins: Array<Record<string, unknown>> = [];
      const subscriptions: Array<Record<string, unknown>> = [
        {
          id: 'sub_def_1',
          plan_id: 'plan_1',
          customer_id: 'cust_def_phone',
          customer_name: 'Default Member',
          customer_phone: '0907778888',
          zone: 'Zone A',
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: '2026-10-01',
          current_period_end: '2026-11-01',
          next_billing_date: '2026-10-01',
          amount_vnd: 2000000,
          tenant_id: 'default',
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        },
      ];
      const invoices: Array<Record<string, unknown>> = [
        {
          id: 'inv_legacy_fran',
          subscription_id: 'sub_fran_legacy',
          amount_vnd: 5000000,
          status: 'pending',
          period_start: '2026-10-01',
          period_end: '2026-11-01',
          invoice_number: 'INV-FRAN-01',
          tenant_id: 'default', // Legacy default column value on franchise subscription invoice
          created_at: '2026-10-01T00:00:00Z',
        },
      ];
      subscriptions.push({
        id: 'sub_fran_legacy',
        plan_id: 'plan_1',
        customer_id: 'cust_fran_phone',
        customer_name: 'SaDec Member',
        customer_phone: '0907778888',
        zone: 'SaDec Deck',
        status: 'active',
        billing_cycle: 'monthly',
        current_period_start: '2026-10-01',
        current_period_end: '2026-11-01',
        next_billing_date: '2026-10-01',
        amount_vnd: 5000000,
        tenant_id: 'tenant_sadec_02',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      });
      const mrrSnapshots: Array<Record<string, unknown>> = [];

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-manager') return staffAccountRow('manager', 'default');
            if (args[0] === 'user-owner') return staffAccountRow('owner', 'default');
            if (args[0] === 'user-waiter') return staffAccountRow('waiter', 'default');
          }
          if (/FROM customers WHERE phone = \? ORDER BY CASE WHEN COALESCE\(NULLIF\(tenant_id, ''\), 'default'\) = \?/i.test(sql)) {
            const phone = String(args[0] ?? '');
            const targetTenant = String(args[1] ?? 'default');
            const matching = customers
              .filter((c) => c.phone === phone)
              .sort((a, b) => {
                const ta = (String(a.tenant_id ?? '').trim()) || 'default';
                const tb = (String(b.tenant_id ?? '').trim()) || 'default';
                return (ta === targetTenant ? 0 : 1) - (tb === targetTenant ? 0 : 1);
              });
            return matching[0] ?? null;
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            return customers.find((c) => c.id === String(args[0] ?? '')) ?? null;
          }
          if (/SELECT id FROM checkins WHERE customer_id = \? AND checkin_date = \?/i.test(sql)) {
            return checkins.find((ci) => ci.customer_id === args[0] && ci.checkin_date === args[1]) ?? null;
          }
          if (/SELECT \* FROM checkins WHERE id = \?/i.test(sql)) {
            return checkins.find((ci) => ci.id === args[0]) ?? null;
          }
          if (/FROM subscription_plans WHERE id = \?/i.test(sql)) {
            return { id: 'plan_1', name: 'Container 20ft', slug: 'c20', monthly_price_vnd: 3500000, deposit_vnd: 1000000, is_active: 1 };
          }
          if (/SELECT id FROM subscription_invoices WHERE subscription_id = \? AND period_start = \?/i.test(sql)) {
            return invoices.find((i) => i.subscription_id === args[0] && i.period_start === args[1]) ?? null;
          }
          if (/SELECT COUNT\(\*\) as count, COALESCE\(SUM\(amount_vnd\), 0\) as mrr FROM subscriptions WHERE status = 'active' AND COALESCE\(NULLIF\((?:TRIM\(tenant_id\)|tenant_id), ''\), 'default'\) = 'default'/i.test(sql)) {
            const defActive = subscriptions.filter(
              (s) => s.status === 'active' && ((String(s.tenant_id ?? '').trim()) || 'default') === 'default'
            );
            return {
              count: defActive.length,
              mrr: defActive.reduce((sum, s) => sum + Number(s.amount_vnd || 0), 0),
            };
          }
          if (/SELECT COUNT\(\*\) as count FROM subscriptions WHERE status = 'cancelled'/i.test(sql)) {
            return { count: 0 };
          }
          if (/SELECT COUNT\(\*\) as count FROM subscriptions WHERE created_at >= \? AND COALESCE\(NULLIF\((?:TRIM\(tenant_id\)|tenant_id), ''\), 'default'\) = 'default'/i.test(sql)) {
            const defNew = subscriptions.filter(
              (s) => ((String(s.tenant_id ?? '').trim()) || 'default') === 'default'
            );
            return { count: defNew.length };
          }
          if (/FROM subscriptions s LEFT JOIN subscription_plans p ON s\.plan_id = p\.id WHERE s\.id = \?/i.test(sql)) {
            return subscriptions.find((s) => s.id === args[0]) ?? null;
          }
          if (/SELECT \* FROM subscription_invoices WHERE id = \?/i.test(sql)) {
            return invoices.find((i) => i.id === args[0]) ?? null;
          }
          if (/SELECT \* FROM subscriptions WHERE id = \?/i.test(sql)) {
            return subscriptions.find((s) => s.id === args[0]) ?? null;
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM customers c/i.test(sql) && /GROUP BY c\.id/i.test(sql)) {
            const targetTenant = args[0] ? String(args[0]) : undefined;
            const rows = customers
              .filter((c) => {
                if (!targetTenant) return true;
                const ct = (String(c.tenant_id ?? '').trim()) || 'default';
                return ct === targetTenant;
              })
              .map((c) => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                tier: c.loyalty_tier,
                lifetime_points: c.lifetime_points,
                last_order_at: '2026-10-30T10:00:00Z',
                first_order_at: '2026-10-30T10:00:00Z',
                order_count: 2,
              }));
            return { results: rows };
          }
          if (/FROM customers c/i.test(sql) || /FROM customers WHERE/i.test(sql)) {
            return { results: customers };
          }
          if (/FROM subscription_invoices i LEFT JOIN subscriptions s/i.test(sql)) {
            return {
              results: invoices.map((inv) => {
                const sub = subscriptions.find((s) => s.id === inv.subscription_id);
                return {
                  ...inv,
                  customer_name: sub?.customer_name ?? 'Unknown',
                  sub_tenant_id: sub?.tenant_id ?? null,
                  plan_name: 'Container 20ft',
                };
              }),
            };
          }
          if (/FROM subscriptions WHERE status = 'active' AND next_billing_date <= \?/i.test(sql)) {
            return { results: subscriptions.filter((s) => s.status === 'active') };
          }
          if (/FROM mrr_snapshots/i.test(sql)) {
            return { results: mrrSnapshots };
          }
          if (/FROM tables/i.test(sql)) {
            return {
              results: [
                { id: 't_legacy_no_col', table_number: 1, status: 'available' },
                { id: 't_ws_def', table_number: 2, status: 'available', tenant_id: '   ' },
                { id: 't_fran', table_number: 3, status: 'occupied', tenant_id: 'tenant_sadec_02' },
              ],
            };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          if (/INSERT INTO checkins/i.test(sql)) {
            checkins.push({
              id: args[0],
              customer_id: args[1],
              customer_name: args[2],
              checkin_date: args[3],
              checkin_time: args[4],
              reward_amount: args[5],
              status: args[6],
              created_at: args[7],
            });
          }
          if (/INSERT INTO subscriptions/i.test(sql)) {
            subscriptions.push({
              id: args[0],
              plan_id: args[1],
              customer_id: args[2],
              customer_name: args[3],
              customer_email: args[4],
              customer_phone: args[5],
              container_number: args[6],
              zone: args[7],
              status: 'active',
              billing_cycle: args[8],
              current_period_start: args[9],
              current_period_end: args[10],
              next_billing_date: args[11],
              amount_vnd: args[12],
              deposit_paid: args[13],
              deposit_vnd: args[14],
              notes: args[15],
              tenant_id: args[16],
              created_at: args[17],
              updated_at: args[18],
            });
          }
          if (/INSERT INTO subscription_invoices/i.test(sql)) {
            if (args.length >= 9) {
              invoices.push({
                id: args[0],
                subscription_id: args[1],
                amount_vnd: args[2],
                status: 'pending',
                period_start: args[3],
                period_end: args[4],
                invoice_number: args[5],
                tenant_id: args[6],
                created_at: args[7],
              });
            } else {
              invoices.push({
                id: args[0],
                subscription_id: args[1],
                amount_vnd: args[2],
                status: 'pending',
                period_start: args[3],
                period_end: args[4],
                invoice_number: args[5],
                tenant_id: 'default',
                created_at: args[6],
              });
            }
          }
          if (/INSERT INTO mrr_snapshots/i.test(sql)) {
            const snap = {
              id: args[0],
              snapshot_date: args[1],
              mrr_vnd: args[2],
              arr_vnd: args[3],
              active_subscriptions: args[4],
            };
            const idx = mrrSnapshots.findIndex((s) => s.snapshot_date === args[1]);
            if (idx >= 0) mrrSnapshots[idx] = snap;
            else mrrSnapshots.push(snap);
          }
          if (/UPDATE subscription_invoices SET status = 'manual'/i.test(sql)) {
            const inv = invoices.find((i) => i.id === args[4]);
            if (inv) inv.status = 'manual';
          }
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 2. P1: Mautic Bridge default-store sync scopes to 'default' (does not sync franchise customer into default state)
      const mauticClientFactory = await import('../../tree/mautic/client-factory');
      const syncedContactEmails: string[] = [];
      const mauticSpy = vi.spyOn(mauticClientFactory, 'getMauticClient').mockReturnValue({
        syncContacts: vi.fn(async (contacts: Array<{ email: string }>) => {
          syncedContactEmails.push(...contacts.map((c) => c.email));
          return { created: contacts.length, updated: 0, errors: [] };
        }),
        addToCampaign: vi.fn(async () => ({})),
      } as any);
      try {
        const mauticSyncRes = await handleMauticBridgeRequest(
          new Request('https://api.test/api/mautic-bridge/sync-all', { method: 'POST' }),
          env as any,
          'default'
        );
        expect(mauticSyncRes.status).toBe(200);
        const mauticSyncBody = (await mauticSyncRes.json()) as {
          data: { contacts: { synced: number }; campaigns: { enrolled: number } };
        };
        expect(mauticSyncBody.data.contacts.synced).toBe(1);
        expect(syncedContactEmails).toEqual(['def@aura.vn']);
      } finally {
        mauticSpy.mockRestore();
      }

      // 3. P1: Checkin phone lookup orders matching tenant's customer row first when phone exists in both stores
      const checkinApp = new Hono<{ Bindings: Env }>();
      checkinApp.route('/api/checkin', checkinRouter);
      const franCheckinRes = await checkinApp.fetch(
        new Request('https://api.test/api/checkin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: JSON.stringify({
            phone: '0907778888',
          }),
        }),
        env
      );
      expect(franCheckinRes.status).toBe(201);
      const franCheckinBody = (await franCheckinRes.json()) as { data: { customer_id: string; customer_name: string } };
      expect(franCheckinBody.data.customer_id).toBe('cust_fran_phone');
      expect(franCheckinBody.data.customer_name).toBe('SaDec Member');

      // 4. P2: Subscriptions createSubscription, listInvoices, payInvoice, generateInvoices, and updateMRRSnapshot isolation
      const { optionalAuth } = await import('../../middleware/auth');
      const subApp = new Hono<{ Bindings: Env }>();
      subApp.use('*', optionalAuth());
      subApp.post('/api/subscriptions', createSubscription);
      subApp.get('/api/subscriptions/mrr-trend', getMRRTrend);
      subApp.get('/api/subscriptions/invoices', listInvoices);
      subApp.post('/api/subscriptions/invoices/:id/pay', payInvoice);
      subApp.post('/api/subscriptions/invoices/generate', generateInvoices);
      subApp.get('/api/mobile/tables', getTablesMobile);

      // Franchise supervisor creates subscription -> first invoice gets tenant_id = 'tenant_sadec_02', and default MRR snapshot only counts default store (2,000,000 VND)
      const createFranSubRes = await subApp.fetch(
        await authRequest('POST', '/api/subscriptions', 'supervisor', 'tenant_sadec_02', {
          plan_id: 'plan_1',
          customer_id: 'cust_fran_phone',
          customer_name: 'SaDec Member',
          customer_phone: '0907778888',
          billing_cycle: 'monthly',
          amount_vnd: 3500000,
        }),
        env
      );
      expect(createFranSubRes.status).toBe(201);
      expect(mrrSnapshots).toHaveLength(1);
      expect(mrrSnapshots[0].mrr_vnd).toBe(2000000);
      expect(mrrSnapshots[0].active_subscriptions).toBe(1);

      // Default store listing invoices does not see inv_legacy_fran (even though inv_legacy_fran.tenant_id === 'default', its parent sub_tenant_id is 'tenant_sadec_02')
      const defInvoicesRes = await subApp.fetch(
        await authRequest('GET', '/api/subscriptions/invoices', 'manager', 'default'),
        env
      );
      expect(defInvoicesRes.status).toBe(200);
      const defInvoicesBody = (await defInvoicesRes.json()) as { data: Array<{ id: string }> };
      expect(defInvoicesBody.data).toHaveLength(0);

      // Franchise store listing invoices sees both inv_legacy_fran and the newly created subscription invoice
      const franInvoicesRes = await subApp.fetch(
        await authRequest('GET', '/api/subscriptions/invoices', 'supervisor', 'tenant_sadec_02'),
        env
      );
      expect(franInvoicesRes.status).toBe(200);
      const franInvoicesBody = (await franInvoicesRes.json()) as { data: Array<{ id: string; tenant_id: string }> };
      expect(franInvoicesBody.data.map((i) => i.id)).toContain('inv_legacy_fran');
      expect(franInvoicesBody.data).toHaveLength(2);

      // Default manager cannot pay inv_legacy_fran (404), whereas SaDec supervisor can pay it (200)
      const defPayFranInvRes = await subApp.fetch(
        await authRequest('POST', '/api/subscriptions/invoices/inv_legacy_fran/pay', 'manager', 'default', {
          payment_method: 'bank_transfer',
        }),
        env
      );
      expect(defPayFranInvRes.status).toBe(404);

      const franPayInvRes = await subApp.fetch(
        await authRequest('POST', '/api/subscriptions/invoices/inv_legacy_fran/pay', 'supervisor', 'tenant_sadec_02', {
          payment_method: 'bank_transfer',
        }),
        env
      );
      expect(franPayInvRes.status).toBe(200);

      // generateInvoices for default store only generates for sub_def_1 with tenant_id = 'default'
      const genDefRes = await subApp.fetch(
        await authRequest('POST', '/api/subscriptions/invoices/generate', 'manager', 'default'),
        env
      );
      expect(genDefRes.status).toBe(200);
      const genDefBody = (await genDefRes.json()) as { generated_count: number };
      expect(genDefBody.generated_count).toBe(1);

      // 5. P2: CRM listSegments forwards tenantId option to buildSegment
      const franSegments = await listSegments(
        mockDb as any,
        undefined,
        new Date('2026-10-31T12:00:00Z'),
        { tenantId: 'tenant_sadec_02' }
      );
      const newFirstWeekSeg = franSegments.find((s) => s.key === 'new_first_week');
      expect(newFirstWeekSeg?.count).toBe(1);
      expect(newFirstWeekSeg?.customers.map((c) => c.id)).toEqual(['cust_fran_phone']);

      // 6. P3: tables-mobile matches rows without tenant_id column or whitespace tenant_id for 'default', isolates from 'tenant_sadec_02'
      const defMobileTablesRes = await subApp.fetch(
        await authRequest('GET', '/api/mobile/tables', 'waiter', 'default'),
        env
      );
      expect(defMobileTablesRes.status).toBe(200);
      const defMobileTablesBody = (await defMobileTablesRes.json()) as { tables: Array<{ id: string }> };
      expect(defMobileTablesBody.tables.map((t) => t.id)).toEqual(['t_legacy_no_col', 't_ws_def']);

      const franMobileTablesRes = await subApp.fetch(
        await authRequest('GET', '/api/mobile/tables', 'supervisor', 'tenant_sadec_02'),
        env
      );
      expect(franMobileTablesRes.status).toBe(200);
      const franMobileTablesBody = (await franMobileTablesRes.json()) as { tables: Array<{ id: string }> };
      expect(franMobileTablesBody.tables.map((t) => t.id)).toEqual(['t_fran']);
    });
  });

  // =========================================================================
  // Suite 21: Phase Q1–Q3 — Mautic Promo Campaign Tenant Selection, Birthday & Phone-Auth Multi-Store Phone Lookup, Order Side-Effects & PayOS Referral Tenant Isolation, Subscription Receipt Tenant Normalization
  // =========================================================================
  describe('Suite 21: Mautic Promo Tenant Selection, Birthday & Phone-Auth Multi-Store Lookup, Order Side-Effects & PayOS Referral Isolation, Subscription Receipt Normalization (Q1–Q3)', () => {
    it('enforces Mautic promo campaign tenant_id selection, birthday & phone-auth multi-store phone resolution, order side-effects & PayOS webhook customer tenant scoping, and subscription receipt tenant normalization (Q1–Q3)', async () => {
      const { triggerPromoCampaign } = await import('../../tree/mautic/promo-campaign');
      const { birthdayRouter } = await import('../../routes/birthday');
      const { handlePhoneAuth } = await import('../../tree/loyalty/phone-auth-handler');
      const { runPostOrderSideEffects } = await import('../../../../packages/domain/order/commands/create-order-side-effects');
      const { getInvoiceReceipt } = await import('../../routes/subscription-receipt');
      const { optionalAuth } = await import('../../middleware/auth');
      const { Hono } = await import('hono');

      const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const bdayDob = `1995-${todayIso.slice(5, 10)}`;

      const customers: Array<Record<string, unknown>> = [
        {
          id: 'cust_def_gold',
          name: 'Default Gold',
          phone: '0906667777',
          email: 'defgold@aura.vn',
          loyalty_points: 500,
          lifetime_points: 500,
          loyalty_tier: 'gold',
          date_of_birth: bdayDob,
          tenant_id: 'default',
          verified_at: null,
          created_at: '2026-10-01T00:00:00Z',
        },
        {
          id: 'cust_fran_gold',
          name: 'SaDec Gold',
          phone: '0906667777',
          email: 'frangold@aura.vn',
          loyalty_points: 800,
          lifetime_points: 800,
          loyalty_tier: 'gold',
          date_of_birth: bdayDob,
          tenant_id: 'tenant_sadec_02',
          verified_at: null,
          created_at: '2026-10-01T00:00:00Z',
        },
      ];
      const wallets: Array<Record<string, unknown>> = [];
      const referralCodes: Array<Record<string, unknown>> = [
        { code: 'REFDEF01', customer_id: 'cust_def_gold', uses: 0, max_uses: 10 },
      ];
      const referrals: Array<Record<string, unknown>> = [];

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-manager') return staffAccountRow('manager', 'default');
          }
          if (/FROM customers WHERE phone = \? ORDER BY CASE WHEN COALESCE\(NULLIF\(tenant_id, ''\), 'default'\) = \?/i.test(sql)) {
            const phone = String(args[0] ?? '');
            const targetTenant = String(args[1] ?? 'default');
            const matching = customers
              .filter((c) => c.phone === phone)
              .sort((a, b) => {
                const ta = (String(a.tenant_id ?? '').trim()) || 'default';
                const tb = (String(b.tenant_id ?? '').trim()) || 'default';
                return (ta === targetTenant ? 0 : 1) - (tb === targetTenant ? 0 : 1);
              });
            const found = matching[0];
            return found ? { ...found, birthday: found.date_of_birth } : null;
          }
          if (/FROM customers WHERE phone = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const phone = String(args[0] ?? '');
            const targetTenant = String(args[1] ?? 'default');
            return (
              customers.find(
                (c) => c.phone === phone && ((String(c.tenant_id ?? '').trim()) || 'default') === targetTenant
              ) ?? null
            );
          }
          if (/SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = \?/i.test(sql)) {
            const phone = String(args[0] ?? '');
            return customers.find((c) => c.phone === phone) ?? null;
          }
          if (/SELECT tenant_id, verified_at FROM customers WHERE id = \?/i.test(sql)) {
            const cust = customers.find((c) => c.id === args[0]);
            return cust ? { tenant_id: cust.tenant_id, verified_at: cust.verified_at ?? null } : null;
          }
          if (/SELECT code, customer_id, uses, max_uses FROM referral_codes WHERE code = \?/i.test(sql)) {
            return referralCodes.find((r) => r.code === args[0]) ?? null;
          }
          if (/SELECT tenant_id FROM customers WHERE id = \?/i.test(sql)) {
            const cust = customers.find((c) => c.id === args[0]);
            return cust ? { tenant_id: cust.tenant_id } : null;
          }
          if (/FROM birthday_redemptions WHERE customer_id = \? AND year = \?/i.test(sql)) {
            return null;
          }
          if (/FROM subscription_invoices i LEFT JOIN subscriptions s/i.test(sql)) {
            if (args[0] === 'inv_ws_sub_tenant') {
              return {
                id: 'inv_ws_sub_tenant',
                subscription_id: 'sub_ws',
                amount_vnd: 2500000,
                status: 'paid',
                period_start: '2026-10-01',
                period_end: '2026-11-01',
                invoice_number: 'INV-WS-01',
                customer_name: 'SaDec Gold',
                customer_email: 'frangold@aura.vn',
                subscription_tenant_id: '   ', // Whitespace on joined subscription_tenant_id
                tenant_id: 'tenant_sadec_02', // Authoritative fallback on invoice row
                plan_name: 'Container 20ft',
              };
            }
            return null;
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/SELECT id, name, phone, email, loyalty_tier, tenant_id FROM customers/i.test(sql)) {
            const tier = String(args[0] ?? '').toLowerCase();
            const scopedTenant = args[1] ? String(args[1]) : null;
            const rows = customers.filter((c) => {
              if (String(c.loyalty_tier ?? '').toLowerCase() !== tier) return false;
              if (!scopedTenant) return true;
              const ct = (String(c.tenant_id ?? '').trim()) || 'default';
              return ct === scopedTenant;
            });
            return { results: rows };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          if (/INSERT INTO customers/i.test(sql)) {
            if (sql.includes("'checkout'")) {
              customers.push({
                id: args[0],
                email: args[1],
                name: args[2],
                phone: args[3],
                loyalty_points: 0,
                lifetime_points: 0,
                loyalty_tier: 'bronze',
                source: 'checkout',
                created_at: args[4],
                updated_at: args[5],
                tenant_id: args[6] ?? 'default',
              });
            } else if (args.length >= 9) {
              customers.push({
                id: args[0],
                email: args[1],
                name: args[2],
                phone: args[3],
                loyalty_tier: args[4],
                date_of_birth: args[5],
                source: args[6],
                created_at: args[7],
                updated_at: args[8],
                tenant_id: args[9] ?? 'default',
              });
            }
          }
          if (/INSERT INTO cashback_wallets/i.test(sql)) {
            wallets.push({
              id: args[0],
              customer_id: args[1],
              tenant_id: args[4] ?? 'default',
            });
          }
          if (/INSERT INTO referrals/i.test(sql)) {
            referrals.push({ id: args[0], referrer_id: args[1], referee_id: args[2] });
          }
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          const base = makeStmt(sql, []);
          return {
            ...base,
            bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
          };
        }),
        batch: vi.fn(async (stmts: Array<{ run: () => Promise<unknown> }>) => {
          for (const s of stmts) {
            if (typeof s.run === 'function') await s.run();
          }
          return [];
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        MAUTIC_CAMPAIGN_PROMO: '30',
      });

      // 1. Q1: triggerPromoCampaign selects tenant_id and scopes enrollment per store
      const mauticClientFactory = await import('../../tree/mautic/client-factory');
      const enrolledEmails: string[] = [];
      const mauticSpy = vi.spyOn(mauticClientFactory, 'getMauticClient').mockReturnValue({
        createOrUpdateContact: vi.fn(async (contact: { email: string }) => {
          enrolledEmails.push(contact.email);
          return 101;
        }),
        addContactToCampaign: vi.fn(async () => true),
      } as any);
      try {
        const defPromoRes = await triggerPromoCampaign(
          env as any,
          { segment: { tier: 'gold' }, templateName: 'tpl', promoTitle: 'Sale', promoDesc: 'Desc' },
          'default'
        );
        expect(defPromoRes.enrolled).toBe(1);
        expect(enrolledEmails).toEqual(['defgold@aura.vn']);

        enrolledEmails.length = 0;
        const franPromoRes = await triggerPromoCampaign(
          env as any,
          { segment: { tier: 'gold' }, templateName: 'tpl', promoTitle: 'Sale', promoDesc: 'Desc' },
          'tenant_sadec_02'
        );
        expect(franPromoRes.enrolled).toBe(1);
        expect(enrolledEmails).toEqual(['frangold@aura.vn']);
      } finally {
        mauticSpy.mockRestore();
      }

      // 2. Q1: Birthday check phone lookup orders caller's tenant row first when same phone exists in both stores
      const bdayApp = new Hono<{ Bindings: Env }>();
      bdayApp.route('/api/birthday', birthdayRouter);
      const franBdayCheckRes = await bdayApp.fetch(
        await authRequest('GET', '/api/birthday/check?phone=0906667777', 'supervisor', 'tenant_sadec_02'),
        env
      );
      expect(franBdayCheckRes.status).toBe(200);
      const franBdayCheckBody = (await franBdayCheckRes.json()) as {
        data: { eligible: boolean; customer_id: string; customer_name: string };
      };
      expect(franBdayCheckBody.data.eligible).toBe(true);
      expect(franBdayCheckBody.data.customer_id).toBe('cust_fran_gold');
      expect(franBdayCheckBody.data.customer_name).toBe('SaDec Gold');

      // 3. Q1: Phone-auth multi-store phone login resolves tenant_sadec_02's customer instead of failing 403 on cust_def_gold
      const phoneAuthApp = new Hono<{ Bindings: Env }>();
      phoneAuthApp.post('/api/loyalty/phone-auth', handlePhoneAuth);
      const franEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'tenant_sadec_02',
      });
      const existingLoginRes = await phoneAuthApp.fetch(
        new Request('https://api.test/api/loyalty/phone-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '0906667777' }),
        }),
        franEnv
      );
      expect(existingLoginRes.status).toBe(200);
      const existingLoginBody = (await existingLoginRes.json()) as {
        customer: { id: string; name: string };
        is_new: boolean;
      };
      expect(existingLoginBody.is_new).toBe(false);
      expect(existingLoginBody.customer.id).toBe('cust_fran_gold');

      // New customer signup at tenant_sadec_02 with a 'default' store referral code ('REFDEF01') rejects cross-tenant referral redemption
      const newSignupRes = await phoneAuthApp.fetch(
        new Request('https://api.test/api/loyalty/phone-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: '0905554444',
            name: 'New SaDec Member',
            referral_code: 'REFDEF01',
          }),
        }),
        franEnv
      );
      expect(newSignupRes.status).toBe(200);
      await new Promise((r) => setTimeout(r, 20));
      expect(referrals).toHaveLength(0);

      // 4. Q2: runPostOrderSideEffects scopes customer lookup & auto-creation to tenantId
      await runPostOrderSideEffects({
        db: mockDb as any,
        env: env as any,
        orderId: 'ord_fran_side_1',
        tenantId: 'tenant_sadec_02',
        data: {
          customer_name: 'Checkout Guest SaDec',
          customer_phone: '0903332222',
        },
        snapshot: {
          items: [],
          subtotal: 50000,
          discount: 0,
          total: 50000,
          promoApplied: null,
        } as any,
        validatedMethod: 'cod',
        resolvedTableId: null,
      });
      const createdCheckoutCust = customers.find((c) => c.phone === '0903332222');
      expect(createdCheckoutCust).toBeDefined();
      expect(createdCheckoutCust?.tenant_id).toBe('tenant_sadec_02');
      expect(createdCheckoutCust?.email).toBe('0903332222+tenant_sadec_02@loyalty.aura');
      const createdCheckoutWallet = wallets.find((w) => w.customer_id === createdCheckoutCust?.id);
      expect(createdCheckoutWallet?.tenant_id).toBe('tenant_sadec_02');

      // 5. Q3: getInvoiceReceipt normalizes whitespace subscription_tenant_id ('   ') to fall back to inv.tenant_id ('tenant_sadec_02')
      const receiptApp = new Hono<{ Bindings: Env }>();
      receiptApp.use('*', optionalAuth());
      receiptApp.get('/api/subscriptions/invoices/:id/receipt', getInvoiceReceipt);

      const defReceiptRes = await receiptApp.fetch(
        await authRequest('GET', '/api/subscriptions/invoices/inv_ws_sub_tenant/receipt', 'manager', 'default'),
        env
      );
      expect(defReceiptRes.status).toBe(404);

      const franReceiptRes = await receiptApp.fetch(
        await authRequest('GET', '/api/subscriptions/invoices/inv_ws_sub_tenant/receipt', 'supervisor', 'tenant_sadec_02'),
        env
      );
      expect(franReceiptRes.status).toBe(200);
    });
  });

  // =========================================================================
  // Suite 22: Phase R1–R3 — Loyalty Wallet Summary & Spend-Cashback Tenant Scoping,
  //           Customer Lifecycle (FindOrCreate & Merge) Cross-Tenant Guards,
  //           Order Ownership & Loyalty Trigger Whitespace Tenant Normalization
  // =========================================================================
  describe('Suite 22: Loyalty Wallet Tenant Scoping, Customer Lifecycle Cross-Tenant Merge Guard, Order Ownership & Loyalty Trigger Whitespace Normalization (R1–R3)', () => {
    it('scopes loyalty summary & spend-cashback wallets by tenant, blocks cross-tenant customer profile merges, scopes findOrCreateCustomerByIdentifier, and normalizes whitespace tenant_id in order ownership & loyalty trigger (R1–R3)', async () => {
      const { handleSummary } = await import('../../tree/loyalty/summary-handler');
      const { handleSpendCashback } = await import('../../tree/loyalty/spend-cashback-handler');
      const {
        findOrCreateCustomerByIdentifier,
        mergeCustomerProfiles,
        findCustomerByIdentifier,
        claimGuestOrder,
      } = await import('../../../../packages/domain/customer');
      const { creditLoyaltyIfEligible } = await import('../../../../packages/domain/order/policies/loyalty-trigger');
      const { Hono } = await import('hono');

      const customers: Array<Record<string, unknown>> = [
        {
          id: 'cust_fran_r1',
          name: 'SaDec Wallet Customer',
          phone: '0901112222',
          email: 'fran_r1@aura.vn',
          loyalty_points: 200,
          lifetime_points: 200,
          loyalty_tier: 'silver',
          tenant_id: 'tenant_sadec_02',
          created_at: '2026-10-01T00:00:00Z',
        },
        {
          id: 'cust_def_ws',
          name: 'Default Whitespace Customer',
          phone: '0908889999',
          email: 'def_ws@aura.vn',
          loyalty_points: 100,
          lifetime_points: 100,
          loyalty_tier: 'bronze',
          tenant_id: '   ',
          created_at: '2026-10-01T00:00:00Z',
        },
      ];

      const identities: Array<Record<string, unknown>> = [
        {
          id: 'ident_def_ws',
          customer_id: 'cust_def_ws',
          identifier_type: 'phone',
          identifier_value: '0908889999',
          is_primary: 1,
        },
      ];

      // Seed a 'default' wallet for cust_fran_r1 with 500,000 balance to verify tenant isolation on wallet queries
      const wallets: Array<Record<string, unknown>> = [
        {
          id: 'wal_def_leak',
          customer_id: 'cust_fran_r1',
          balance: 500000,
          total_earned: 500000,
          total_spent: 0,
          tenant_id: 'default',
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        },
      ];

      const orders: Array<Record<string, unknown>> = [
        {
          id: 'ord_fran_r1',
          customer_id: 'cust_fran_r1',
          total_amount: 50000,
          total: 50000,
          status: 'confirmed',
          payment_status: 'paid',
          tenant_id: 'tenant_sadec_02',
        },
        {
          id: 'ord_guest_ws_def',
          customer_id: null,
          customer_phone: '0908889999',
          customer_email: 'def_ws@aura.vn',
          total_amount: 100000,
          total: 100000,
          status: 'completed',
          payment_status: 'paid',
          tenant_id: '   ',
        },
        {
          id: 'ord_guest_fran_r3',
          customer_id: null,
          customer_phone: '0908889999',
          customer_email: 'def_ws@aura.vn',
          total_amount: 100000,
          total: 100000,
          status: 'completed',
          payment_status: 'paid',
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const cashbackTxs: Array<Record<string, unknown>> = [];

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          if (/SELECT \* FROM cashback_wallets WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const cid = String(args[0] ?? '');
            const t = String(args[1] ?? 'default');
            return (
              wallets.find(
                (w) => w.customer_id === cid && ((String(w.tenant_id ?? '').trim()) || 'default') === t
              ) ?? null
            );
          }
          if (/SELECT balance FROM cashback_wallets WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const cid = String(args[0] ?? '');
            const t = String(args[1] ?? 'default');
            const w = wallets.find(
              (x) => x.customer_id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t
            );
            return w ? { balance: w.balance } : null;
          }
          if (/SELECT id FROM cashback_transactions WHERE order_id = \? AND type = 'spend'/i.test(sql)) {
            return cashbackTxs.find((tx) => tx.order_id === args[0] && tx.type === 'spend') ?? null;
          }
          if (/SELECT id FROM cashback_transactions WHERE order_id = \? AND type = 'earn'/i.test(sql)) {
            return cashbackTxs.find((tx) => tx.order_id === args[0] && tx.type === 'earn') ?? null;
          }
          if (/FROM loyalty_policy/i.test(sql) || /FROM loyalty_tiers/i.test(sql)) {
            return {
              id: 1,
              points_per_1000vnd: 1,
              cashback_rate: 0.05,
              tier_name: 'silver',
              min_points: 100,
            };
          }
          if (/SELECT tenant_id FROM orders WHERE id = \?/i.test(sql)) {
            const o = orders.find((x) => x.id === args[0]);
            return o ? { tenant_id: o.tenant_id } : null;
          }
          if (/SELECT id, customer_id, total, order_type FROM orders WHERE id = \?/i.test(sql) || /SELECT \* FROM orders WHERE id = \?/i.test(sql)) {
            return orders.find((x) => x.id === args[0]) ?? null;
          }
          if (/SELECT ci\.customer_id FROM customer_identities ci JOIN customers c ON c\.id = ci\.customer_id WHERE ci\.identifier_type = \? AND ci\.identifier_value = \? AND COALESCE\(NULLIF\(TRIM\(c\.tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const iType = String(args[0] ?? '');
            const iVal = String(args[1] ?? '');
            const t = String(args[2] ?? 'default');
            const found = identities.find((i) => {
              if (i.identifier_type !== iType || i.identifier_value !== iVal) return false;
              const cust = customers.find((c) => c.id === i.customer_id);
              if (!cust) return false;
              const ct = (String(cust.tenant_id ?? '').trim()) || 'default';
              return ct === t;
            });
            return found ? { customer_id: found.customer_id } : null;
          }
          if (/SELECT ci\.customer_id FROM customer_identities ci JOIN customers c ON c\.id = ci\.customer_id WHERE ci\.identifier_type = 'phone' AND ci\.identifier_value = \? AND COALESCE\(NULLIF\(TRIM\(c\.tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const phone = String(args[0] ?? '');
            const t = String(args[1] ?? 'default');
            const found = identities.find((i) => {
              if (i.identifier_type !== 'phone' || i.identifier_value !== phone) return false;
              const cust = customers.find((c) => c.id === i.customer_id);
              if (!cust) return false;
              const ct = (String(cust.tenant_id ?? '').trim()) || 'default';
              return ct === t;
            });
            return found ? { customer_id: found.customer_id } : null;
          }
          if (/SELECT id FROM customers WHERE phone = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const phone = String(args[0] ?? '');
            const t = String(args[1] ?? 'default');
            return (
              customers.find(
                (c) => c.phone === phone && ((String(c.tenant_id ?? '').trim()) || 'default') === t
              ) ?? null
            );
          }
          if (/SELECT id FROM customers WHERE \(\(email = \? AND email IS NOT NULL\) OR \(phone = \? AND phone IS NOT NULL\)\) AND \(\? = '\*' OR COALESCE\(NULLIF\(tenant_id, ''\), 'default'\) = \? OR COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?\)/i.test(sql)) {
            const email = args[0] ? String(args[0]) : null;
            const phone = args[1] ? String(args[1]) : null;
            const t = String(args[4] ?? 'default');
            return (
              customers.find((c) => {
                const matchId = (email && c.email === email) || (phone && c.phone === phone);
                if (!matchId) return false;
                if (t === '*') return true;
                const ct = (String(c.tenant_id ?? '').trim()) || 'default';
                return ct === t;
              }) ?? null
            );
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            return customers.find((c) => c.id === args[0]) ?? null;
          }
          return null;
        }),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => {
          if (/INSERT INTO cashback_wallets \(id, customer_id, balance, total_earned, total_spent, tenant_id, created_at, updated_at\)/i.test(sql)) {
            wallets.push({
              id: args[0],
              customer_id: args[1],
              balance: 0,
              total_earned: 0,
              total_spent: 0,
              tenant_id: args[2],
              created_at: args[3],
              updated_at: args[4],
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE cashback_wallets SET balance = balance - \?, total_spent = total_spent \+ \?, updated_at = \? WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \? AND balance >= \?/i.test(sql)) {
            const amt = Number(args[0]);
            const cid = String(args[3]);
            const t = String(args[4]);
            const minBal = Number(args[5]);
            const w = wallets.find(
              (x) => x.customer_id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t && Number(x.balance) >= minBal
            );
            if (!w) return { success: true, meta: { changes: 0 } };
            w.balance = Number(w.balance) - amt;
            w.total_spent = Number(w.total_spent) + amt;
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO customers/i.test(sql)) {
            customers.push({
              id: args[0],
              email: args[1],
              name: args[2],
              phone: args[3],
              loyalty_points: 0,
              lifetime_points: 0,
              loyalty_tier: 'bronze',
              source: args[4],
              created_at: args[5],
              updated_at: args[6],
              tenant_id: args[7] ?? 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO customer_identities/i.test(sql)) {
            identities.push({
              id: args[0],
              customer_id: args[1],
              identifier_type: args[2],
              identifier_value: args[3],
              is_primary: args[4],
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE orders SET customer_id = \?, updated_at = \? WHERE id = \? AND customer_id IS NULL/i.test(sql)) {
            const o = orders.find((x) => x.id === args[2] && x.customer_id === null);
            if (!o) return { success: true, meta: { changes: 0 } };
            o.customer_id = args[0];
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          const base = makeStmt(sql, []);
          return {
            ...base,
            bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
          };
        }),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      // 1. R1: handleSummary scopes cashback_wallets by customer's tenant_id ('tenant_sadec_02')
      //        Does NOT leak the 500,000 VND 'default' wallet; auto-creates a 'tenant_sadec_02' wallet with balance 0
      const loyaltyApp = new Hono<{ Bindings: Env; Variables: { customer: unknown } }>();
      loyaltyApp.use('*', async (c, next) => {
        c.set('customer', customers[0]);
        await next();
      });
      loyaltyApp.get('/api/loyalty/summary', handleSummary as any);
      loyaltyApp.post('/api/loyalty/spend-cashback', handleSpendCashback as any);

      const summaryRes = await loyaltyApp.fetch(new Request('https://api.test/api/loyalty/summary'), env);
      expect(summaryRes.status).toBe(200);
      const summaryBody = (await summaryRes.json()) as { data: { wallet: { balance: number } } };
      expect(summaryBody.data.wallet.balance).toBe(0);
      const franWallet = wallets.find((w) => w.customer_id === 'cust_fran_r1' && w.tenant_id === 'tenant_sadec_02');
      expect(franWallet).toBeDefined();

      // Fund the 'tenant_sadec_02' wallet with 15,000 VND while 'default' wallet has 500,000 VND
      franWallet!.balance = 15000;
      franWallet!.total_earned = 15000;

      // Attempting to spend 20,000 VND fails with 400 ('So du khong du', balance: 15000) instead of using the 500,000 VND 'default' wallet
      const overSpendRes = await loyaltyApp.fetch(
        new Request('https://api.test/api/loyalty/spend-cashback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord_fran_r1', amount: 20000 }),
        }),
        env
      );
      expect(overSpendRes.status).toBe(400);
      const overSpendBody = (await overSpendRes.json()) as { balance: number };
      expect(overSpendBody.balance).toBe(15000);

      // Spending 10,000 VND deducts from the 'tenant_sadec_02' wallet (leaving 5,000) and leaves 'default' wallet untouched at 500,000
      const validSpendRes = await loyaltyApp.fetch(
        new Request('https://api.test/api/loyalty/spend-cashback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord_fran_r1', amount: 10000 }),
        }),
        env
      );
      expect(validSpendRes.status).toBe(200);
      const validSpendBody = (await validSpendRes.json()) as { data: { amount_spent: number; new_balance: number } };
      expect(validSpendBody.data.amount_spent).toBe(10000);
      expect(validSpendBody.data.new_balance).toBe(5000);
      expect(wallets.find((w) => w.id === 'wal_def_leak')?.balance).toBe(500000);

      // 2. R2: findOrCreateCustomerByIdentifier scopes lookup & creation by tenantId
      const franFindOrCreate = await findOrCreateCustomerByIdentifier({
        db: mockDb as any,
        identifierType: 'phone',
        identifierValue: '0908889999',
        name: 'SaDec Same Phone',
        tenantId: 'tenant_sadec_02',
      });
      expect(franFindOrCreate.created).toBe(true);
      expect(franFindOrCreate.customerId).not.toBe('cust_def_ws');
      const createdFranCust = customers.find((c) => c.id === franFindOrCreate.customerId);
      expect(createdFranCust?.tenant_id).toBe('tenant_sadec_02');

      // 3. R2: mergeCustomerProfiles rejects cross-tenant customer profile merges
      const crossMergeRes = await mergeCustomerProfiles({
        db: mockDb as any,
        primaryCustomerId: 'cust_def_ws',
        secondaryCustomerId: 'cust_fran_r1',
        reason: 'Attempted cross-tenant merge',
      });
      expect(crossMergeRes.ok).toBe(false);
      expect(crossMergeRes.error).toContain('Cross-tenant customer merge forbidden');

      // 4. R2: findCustomerByIdentifier & claimGuestOrder normalize whitespace-only tenant_id ('   ') to 'default'
      const wsFoundId = await findCustomerByIdentifier(mockDb as any, '0908889999', '   ');
      expect(wsFoundId).toBe('cust_def_ws');
      const franClaimWsOrder = await claimGuestOrder({
        db: mockDb as any,
        orderId: 'ord_guest_ws_def',
        actor: { id: 'cust_fran_r1', role: 'customer' },
        tenantId: 'tenant_sadec_02',
      });
      expect(franClaimWsOrder.success).toBe(false);
      expect(franClaimWsOrder.statusCode).toBe(404);

      const defClaimWsOrder = await claimGuestOrder({
        db: mockDb as any,
        orderId: 'ord_guest_ws_def',
        actor: { id: 'cust_def_ws', role: 'customer' },
        tenantId: '   ',
      });
      expect(defClaimWsOrder.success).toBe(true);

      // 5. R3: creditLoyaltyIfEligible normalizes whitespace-only customer tenant_id ('   ') for default store orders,
      //        while preventing franchise guest order ('ord_guest_fran_r3') from matching the default whitespace customer
      orders.find((o) => o.id === 'ord_guest_ws_def')!.customer_id = null;
      await creditLoyaltyIfEligible(mockDb as any, env as any, 'ord_guest_fran_r3');
      // Franchise guest order should NOT resolve 'cust_def_ws'
      const franLoyaltyQueries = mockDb.prepare.mock.calls.map((c) => c[0] as string);
      expect(
        franLoyaltyQueries.some((q) =>
          q.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        )
      ).toBe(true);

      // 6. R1/R3: handleLookup scopes customer & cashback_wallets by store tenantId (returns 5,000 VND franchise wallet, not 500,000 VND default wallet)
      const { handleLookup } = await import('../../tree/loyalty/lookup-handler');
      const lookupCustomerQuery = (sql: string, args: unknown[]) => {
        if (/SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
          const phone = String(args[0] ?? '');
          const t = String(args[1] ?? 'default');
          return customers.find((c) => c.phone === phone && ((String(c.tenant_id ?? '').trim()) || 'default') === t) ?? null;
        }
        return null;
      };
      const origPrepare = mockDb.prepare;
      mockDb.prepare = vi.fn((sql: string) => ({
        ...makeStmt(sql, []),
        bind: vi.fn((...args: unknown[]) => {
          const base = makeStmt(sql, args);
          const origFirst = base.first;
          base.first = vi.fn(async () => {
            if (/FROM users WHERE id = \?/i.test(sql)) {
              if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            }
            const lk = lookupCustomerQuery(sql, args);
            if (lk) return lk;
            return origFirst();
          });
          return base;
        }),
      })) as any;

      const lookupApp = new Hono<{ Bindings: Env }>();
      lookupApp.get('/api/loyalty/lookup', handleLookup);
      const franEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'tenant_sadec_02',
      });
      const lookupRes = await lookupApp.fetch(
        await authRequest('GET', '/api/loyalty/lookup?phone=0901112222', 'supervisor', 'tenant_sadec_02'),
        franEnv
      );
      expect(lookupRes.status).toBe(200);
      const lookupBody = (await lookupRes.json()) as { ok: boolean; member: { cashback_balance: number } };
      expect(lookupBody.ok).toBe(true);
      expect(lookupBody.member.cashback_balance).toBe(5000);
      mockDb.prepare = origPrepare;
    });
  });

  // =========================================================================
  // Suite 23: Phase S1–S3 — Loyalty Cashback/Rewards Routes, Checkin Approve Wallet,
  //           CRM Accrual/Reversal/Referral Wallets & Subscription MRR Whitespace Normalization
  // =========================================================================
  describe('Suite 23: Loyalty Cashback/Rewards Routes, Checkin Approve Wallet, CRM Accrual/Reversal/Referral Wallets & Subscription MRR Whitespace Normalization (S1–S3)', () => {
    it('scopes /api/loyalty/cashback & /rewards & /redeem by store tenant, scopes checkin approve wallet, scopes CRM applyAccrual/reverseAccrual/referral wallets by tenant, and normalizes whitespace tenant_id in updateMRRSnapshot & subscription stats/trend (S1–S3)', async () => {
      const { loyaltyRouter } = await import('../../routes/loyalty');
      const { checkinRouter } = await import('../../routes/checkin');
      const { applyAccrual } = await import('../../../../packages/domain/crm/commands/accrual');
      const { reverseAccrual } = await import('../../../../packages/domain/crm/commands/refund-reversal');
      const { rewardReferralOnFirstOrder } = await import('../../../../packages/domain/crm/commands/referral');
      const { processReferralCashbackOnFirstOrder } = await import('../../tree/referrals/referral-cashback');
      const { updateMRRSnapshot } = await import('../../tree/subscriptions/mrr-calculator');
      const { getStatsHandler, getMRRTrend } = await import('../../tree/subscriptions/sub-handlers');
      const { Hono } = await import('hono');

      const customers: Array<Record<string, unknown>> = [
        {
          id: 'cust_fran_s1',
          name: 'SaDec Customer S1',
          phone: '0901239999',
          email: 'fran_s1@aura.vn',
          loyalty_points: 500,
          lifetime_points: 500,
          loyalty_tier: 'gold',
          tenant_id: 'tenant_sadec_02',
        },
        {
          id: 'cust_def_ref',
          name: 'Default Referrer',
          phone: '0901230000',
          email: 'def_ref@aura.vn',
          loyalty_points: 100,
          lifetime_points: 100,
          loyalty_tier: 'silver',
          tenant_id: 'default',
        },
      ];

      const wallets: Array<Record<string, unknown>> = [
        {
          id: 'wal_def_s1',
          customer_id: 'cust_fran_s1',
          balance: 900000,
          total_earned: 900000,
          total_spent: 0,
          tenant_id: 'default',
        },
        {
          id: 'wal_fran_s1',
          customer_id: 'cust_fran_s1',
          balance: 25000,
          total_earned: 25000,
          total_spent: 0,
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const cashbackTxs: Array<Record<string, unknown>> = [
        {
          id: 'ctx_def_1',
          wallet_id: 'wal_def_s1',
          customer_id: 'cust_fran_s1',
          type: 'earn',
          amount: 900000,
          created_at: '2026-10-01T00:00:00Z',
        },
        {
          id: 'ctx_fran_1',
          wallet_id: 'wal_fran_s1',
          customer_id: 'cust_fran_s1',
          type: 'earn',
          amount: 25000,
          created_at: '2026-10-02T00:00:00Z',
        },
      ];

      const rewards: Array<Record<string, unknown>> = [
        { id: 'rew_def_only', title: 'Default Store Mug', point_cost: 100, tenant_id: 'default' },
        { id: 'rew_fran_only', title: 'SaDec Phin Filter', point_cost: 100, tenant_id: 'tenant_sadec_02' },
        { id: 'rew_global', title: 'Global Sticker', point_cost: 50 },
      ];

      const checkins: Array<Record<string, unknown>> = [
        {
          id: 'ci_fran_new_wal',
          customer_id: 'cust_fran_new_wal',
          customer_name: 'SaDec Checkin Guest',
          checkin_date: '2026-11-02',
          checkin_time: '08:30:00',
          reward_amount: 5000,
          status: 'pending',
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const orders: Array<Record<string, unknown>> = [
        {
          id: 'ord_fran_s2',
          customer_id: 'cust_fran_s1',
          total: 100000,
          cashback_used: 0,
          points_earned: 13,
          cashback_earned: 7000,
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const referrals: Array<Record<string, unknown>> = [
        {
          id: 'ref_cross_s2',
          referrer_id: 'cust_def_ref',
          referred_customer_id: 'cust_fran_s1',
          referral_code: 'REFDEF99',
          status: 'pending',
          bonus_type: 'cashback',
        },
      ];

      const subscriptions: Array<Record<string, unknown>> = [
        {
          id: 'sub_def_ws',
          plan_id: 'plan_1',
          status: 'active',
          amount_vnd: 1500000,
          zone: 'Zone A',
          tenant_id: '   ',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'sub_fran_1',
          plan_id: 'plan_1',
          status: 'active',
          amount_vnd: 2500000,
          zone: 'Zone B',
          tenant_id: 'tenant_sadec_02',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mrrSnapshots: Array<Record<string, unknown>> = [];

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        sql,
        args,
        first: vi.fn(async () => {
          if (isAccountLookup(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-manager') return staffAccountRow('manager', 'default');
          }
          if (/SELECT id FROM customers WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql) ||
              /SELECT id, loyalty_points, lifetime_points, loyalty_tier, tenant_id\s+FROM customers WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql) ||
              /SELECT id, tenant_id FROM customers WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const cid = String(args[0] ?? '');
            const t = String(args[1] ?? 'default');
            return customers.find((c) => c.id === cid && ((String(c.tenant_id ?? '').trim()) || 'default') === t) ?? null;
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            return customers.find((c) => c.id === args[0]) ?? null;
          }
          if (/SELECT id(?:, balance(?:, total_earned)?)? FROM cashback_wallets WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const cid = String(args[0] ?? '');
            const t = String(args[1] ?? 'default');
            return wallets.find((w) => w.customer_id === cid && ((String(w.tenant_id ?? '').trim()) || 'default') === t) ?? null;
          }
          if (/SELECT \* FROM rewards WHERE id = \?/i.test(sql)) {
            return rewards.find((r) => r.id === args[0]) ?? null;
          }
          if (/SELECT \* FROM checkins WHERE id = \?/i.test(sql)) {
            return checkins.find((ci) => ci.id === args[0]) ?? null;
          }
          if (/FROM orders WHERE id = \?/i.test(sql)) {
            return orders.find((o) => o.id === args[0]) ?? null;
          }
          if (/FROM referrals WHERE referred_customer_id = \?/i.test(sql)) {
            return referrals.find((r) => r.referred_customer_id === args[0] && r.status === 'pending') ?? null;
          }
          if (/FROM subscriptions WHERE status = 'active' AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = 'default'/i.test(sql)) {
            const matching = subscriptions.filter(
              (s) => s.status === 'active' && ((String(s.tenant_id ?? '').trim()) || 'default') === 'default'
            );
            return {
              count: matching.length,
              mrr: matching.reduce((acc, s) => acc + Number(s.amount_vnd || 0), 0),
            };
          }
          if (/FROM subscriptions WHERE status = 'active' AND \(\? = '\*' OR COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?\)/i.test(sql)) {
            const t = String(args[args.length - 1] ?? 'default');
            const matching = subscriptions.filter(
              (s) => s.status === 'active' && (t === '*' || ((String(s.tenant_id ?? '').trim()) || 'default') === t)
            );
            return {
              count: matching.length,
              mrr: matching.reduce((acc, s) => acc + Number(s.amount_vnd || 0), 0),
              avg: matching.length > 0 ? matching.reduce((acc, s) => acc + Number(s.amount_vnd || 0), 0) / matching.length : 0,
              under_1m: 0,
              from_1m_to_3m: matching.length,
              from_3m_to_5m: 0,
              above_5m: 0,
            };
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (/FROM cashback_transactions WHERE wallet_id = \?/i.test(sql)) {
            return { results: cashbackTxs.filter((tx) => tx.wallet_id === args[0]) };
          }
          if (/SELECT \* FROM rewards ORDER BY point_cost ASC/i.test(sql)) {
            return { results: rewards };
          }
          if (/SELECT \* FROM mrr_snapshots/i.test(sql)) {
            return { results: [] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          if (/INSERT INTO cashback_wallets \(id, customer_id, balance, total_earned, total_spent, created_at, updated_at, tenant_id\)/i.test(sql)) {
            wallets.push({
              id: args[0],
              customer_id: args[1],
              balance: args[2],
              total_earned: args[3],
              total_spent: 0,
              created_at: args[4],
              updated_at: args[5],
              tenant_id: args[6],
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE cashback_wallets\s+SET balance = MAX\(0, balance - \?\), updated_at = \?\s+WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const rev = Number(args[0]);
            const cid = String(args[2]);
            const t = String(args[3]);
            const w = wallets.find((x) => x.customer_id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
            if (w) w.balance = Math.max(0, Number(w.balance) - rev);
            return { success: true, meta: { changes: w ? 1 : 0 } };
          }
          if (/INSERT INTO mrr_snapshots/i.test(sql)) {
            mrrSnapshots.push({
              id: args[0],
              snapshot_date: args[1],
              mrr_vnd: args[2],
              active_subscriptions: args[4],
            });
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const batchExecuted: Array<{ sql: string; args: unknown[] }> = [];
      const mockDb = {
        prepare: vi.fn((sql: string) => {
          const base = makeStmt(sql, []);
          return {
            ...base,
            bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
          };
        }),
        batch: vi.fn(async (stmts: Array<{ sql: string; args: unknown[] }>) => {
          for (const s of stmts) {
            batchExecuted.push({ sql: s.sql, args: s.args });
            if (/UPDATE cashback_wallets\s+SET balance = COALESCE\(balance, 0\) \+ \?, total_earned = COALESCE\(total_earned, 0\) \+ \?, updated_at = \?\s+WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(s.sql)) {
              const delta = Number(s.args[0]);
              const earned = Number(s.args[1]);
              const cid = String(s.args[3]);
              const t = String(s.args[4]);
              const w = wallets.find((x) => x.customer_id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
              if (w) {
                w.balance = Number(w.balance ?? 0) + delta;
                w.total_earned = Number(w.total_earned ?? 0) + earned;
              }
            } else if (/UPDATE cashback_wallets\s+SET balance = \?, total_earned = total_earned \+ \?, updated_at = \?\s+WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(s.sql)) {
              const nextBal = Number(s.args[0]);
              const earned = Number(s.args[1]);
              const cid = String(s.args[3]);
              const t = String(s.args[4]);
              const w = wallets.find((x) => x.customer_id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
              if (w) {
                w.balance = nextBal;
                w.total_earned = Number(w.total_earned) + earned;
              }
            }
          }
          return [];
        }),
      };

      const franEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'tenant_sadec_02',
      });

      // 1. S1: /api/loyalty/cashback scopes wallet lookup by storeTenant ('tenant_sadec_02')
      //        Returns only ctx_fran_1 (25,000 VND) and never leaks ctx_def_1 (900,000 VND)
      const custToken = await generateJWT(
        { id: 'cust_fran_s1', sub: 'cust_fran_s1', role: 'customer', tenantId: 'tenant_sadec_02' } as any,
        TEST_JWT_SECRET,
        3600
      );
      const cashbackRes = await loyaltyRouter.fetch(
        new Request('https://api.test/cashback', {
          headers: { Authorization: `Bearer ${custToken}` },
        }),
        franEnv
      );
      expect(cashbackRes.status).toBe(200);
      const cashbackBody = (await cashbackRes.json()) as { data: Array<{ id: string; amount: number }> };
      expect(cashbackBody.data).toHaveLength(1);
      expect(cashbackBody.data[0].id).toBe('ctx_fran_1');

      // 2. S1: /api/loyalty/rewards filters out 'default' tenant-only rewards for 'tenant_sadec_02' customer,
      //        and /api/loyalty/redeem rejects redeeming 'rew_def_only' with 404
      const rewardsRes = await loyaltyRouter.fetch(
        new Request('https://api.test/rewards', {
          headers: { Authorization: `Bearer ${custToken}` },
        }),
        franEnv
      );
      expect(rewardsRes.status).toBe(200);
      const rewardsBody = (await rewardsRes.json()) as { data: Array<{ id: string }> };
      expect(rewardsBody.data.map((r) => r.id)).toEqual(['rew_fran_only', 'rew_global']);

      const crossRedeemRes = await loyaltyRouter.fetch(
        new Request('https://api.test/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
          body: JSON.stringify({ reward_id: 'rew_def_only' }),
        }),
        franEnv
      );
      expect(crossRedeemRes.status).toBe(404);

      // 3. S1: PATCH /api/checkin/:id/approve creates cashback_wallets row with checkin's tenant_id ('tenant_sadec_02')
      const checkinApp = new Hono<{ Bindings: Env }>();
      checkinApp.route('/api/checkin', checkinRouter);
      const approveRes = await checkinApp.fetch(
        await authRequest('PATCH', '/api/checkin/ci_fran_new_wal/approve', 'supervisor', 'tenant_sadec_02'),
        franEnv
      );
      expect(approveRes.status).toBe(200);
      const createdCheckinWal = wallets.find((w) => w.customer_id === 'cust_fran_new_wal');
      expect(createdCheckinWal).toBeDefined();
      expect(createdCheckinWal?.tenant_id).toBe('tenant_sadec_02');
      expect(createdCheckinWal?.balance).toBe(5000);

      // 4. S2: applyAccrual & reverseAccrual with tenantId='tenant_sadec_02' update ONLY the 'tenant_sadec_02' wallet
      //        and reject cross-tenant customer accrual
      const basePolicy = {
        tiers: [{ tierName: 'gold', minPoints: 200, cashbackRate: 0.07, pointMultiplier: 1.3, expiryDays: 365 }],
        defaultTier: { tierName: 'bronze', minPoints: 0, cashbackRate: 0.03, pointMultiplier: 1.0, expiryDays: 365 },
        campaignMultiplier: 1.0,
        maxCapPerTx: 50000,
        campaignCode: null,
        expiresAt: null,
      };
      const crossAccrual = await applyAccrual(mockDb as any, basePolicy, {
        orderId: 'ord_fran_s2',
        customerId: 'cust_def_ref',
        orderTotalVnd: 100000,
        tenantId: 'tenant_sadec_02',
      });
      expect(crossAccrual).toEqual({ ok: false, reason: 'customer_not_found' });

      const validAccrual = await applyAccrual(mockDb as any, basePolicy, {
        orderId: 'ord_fran_s2',
        customerId: 'cust_fran_s1',
        orderTotalVnd: 100000,
        tenantId: 'tenant_sadec_02',
      });
      expect(validAccrual.ok).toBe(true);
      // Franchise wallet updated from 25,000 -> 32,000; Default wallet untouched at 900,000
      expect(wallets.find((w) => w.id === 'wal_fran_s1')?.balance).toBe(32000);
      expect(wallets.find((w) => w.id === 'wal_def_s1')?.balance).toBe(900000);

      const validReversal = await reverseAccrual(mockDb as any, basePolicy, {
        orderId: 'ord_fran_s2',
        customerId: 'cust_fran_s1',
        refundAmountVnd: 100000,
        tenantId: 'tenant_sadec_02',
      });
      expect(validReversal.ok).toBe(true);
      expect(wallets.find((w) => w.id === 'wal_fran_s1')?.balance).toBe(25000);
      expect(wallets.find((w) => w.id === 'wal_def_s1')?.balance).toBe(900000);

      // 5. S2: rewardReferralOnFirstOrder & processReferralCashbackOnFirstOrder block cross-tenant referrer reward when tenantId is passed
      const crossDomainReferral = await rewardReferralOnFirstOrder(
        mockDb as any,
        'cust_fran_s1',
        'ord_fran_s2',
        100000,
        undefined,
        'tenant_sadec_02'
      );
      expect(crossDomainReferral.success).toBe(false);
      expect(crossDomainReferral.reason).toBe('referrer_not_found');

      const crossTreeReferral = await processReferralCashbackOnFirstOrder(
        mockDb as any,
        'cust_fran_s1',
        'ord_fran_s2',
        100000,
        'tenant_sadec_02'
      );
      expect(crossTreeReferral.success).toBe(false);
      expect(crossTreeReferral.reason).toBe('referrer_not_found');

      // 6. S3: updateMRRSnapshot, getStatsHandler, and getMRRTrend normalize whitespace-only tenant_id ('   ') to 'default'
      await updateMRRSnapshot(mockDb as any);
      expect(mrrSnapshots).toHaveLength(1);
      expect(mrrSnapshots[0].mrr_vnd).toBe(1500000);
      expect(mrrSnapshots[0].active_subscriptions).toBe(1);

      const subApp = new Hono<{ Bindings: Env }>();
      subApp.get('/api/subscriptions/stats', getStatsHandler);
      subApp.get('/api/subscriptions/mrr-trend', getMRRTrend);
      const defEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      const defStatsRes = await subApp.fetch(
        await authRequest('GET', '/api/subscriptions/stats', 'manager', 'default'),
        defEnv
      );
      expect(defStatsRes.status).toBe(200);
      const defStatsBody = (await defStatsRes.json()) as { data: { mrr_vnd: number; active_subscriptions: number } };
      expect(defStatsBody.data.mrr_vnd).toBe(1500000);
      expect(defStatsBody.data.active_subscriptions).toBe(1);

      const defTrendRes = await subApp.fetch(
        await authRequest('GET', '/api/subscriptions/mrr-trend', 'manager', 'default'),
        defEnv
      );
      expect(defTrendRes.status).toBe(200);
      const defTrendBody = (await defTrendRes.json()) as { data: { snapshots: Array<{ mrr_vnd: number }> } };
      expect(defTrendBody.data.snapshots[0].mrr_vnd).toBe(1500000);
    });
  });

  // =========================================================================
  // Suite 24: Phase T1–T3 — Order/KDS/PayOS/CRM Event Tenant Propagation to Accrual/Reversal/Referral,
  //           Legacy Referral Tree Tenant Scoping & Whitespace Tenant Normalization Across CRM/KDS/Analytics Routes
  // =========================================================================
  describe('Suite 24: Order/KDS/PayOS/CRM Event Tenant Propagation to Accrual/Reversal/Referral, Legacy Referral Tree Tenant Scoping & Whitespace Tenant Normalization (T1–T3)', () => {
    it('propagates order/event tenantId in creditLoyaltyIfEligible & consumeCrmEvent, scopes processReferralOnFirstOrder & applyReferralForNewCustomer by tenantId, and normalizes whitespace tenant_id across CRM, staff-tips, kds-mobile & analytics routes (T1–T3)', async () => {
      const { creditLoyaltyIfEligible } = await import('../../../../packages/domain/order/policies/loyalty-trigger');
      const { consumeCrmEvent } = await import('../../../../packages/domain/crm/commands/consume-crm-event');
      const { processReferralOnFirstOrder } = await import('../../tree/referrals/process-referral');
      const { applyReferralForNewCustomer } = await import('../../tree/referrals/apply-referral');
      const { lookupProfile } = await import('../../../../packages/domain/crm/lookup-profile');
      const { getCustomerAccount } = await import('../../../../packages/domain/crm/commands/get-customer-account');
      const { getCustomer360 } = await import('../../../../packages/domain/crm/commands/customer-360');
      const { getFulfillment } = await import('../../../../packages/domain/crm/commands/get-fulfillment');
      const { aggregateEvents } = await import('../../../../packages/domain/crm/commands/aggregate-events');
      const { staffTipsRouter } = await import('../../../../packages/domain/staff/commands/staff-tips');
      const { customerAssistantRouter } = await import('../../routes/customer-assistant');
      const { recommendationsRouter } = await import('../../routes/recommendations');
      const { franchiseRouter } = await import('../../routes/franchise-locations');
      const { containerTelemetryRouter } = await import('../../routes/container-telemetry');
      const { demandForecastRouter } = await import('../../routes/demand-forecast');
      const { dynamicPricingRouter } = await import('../../routes/dynamic-pricing');
      const { inventoryForecastingRouter } = await import('../../routes/inventory-forecasting');
      const { Hono } = await import('hono');

      const customers: Array<Record<string, unknown>> = [
        {
          id: 'cust_fran_t1',
          name: 'SaDec Customer T1',
          phone: '0907771111',
          email: 'fran_t1@aura.vn',
          loyalty_points: 300,
          lifetime_points: 300,
          loyalty_tier: 'gold',
          tenant_id: 'tenant_sadec_02',
        },
        {
          id: 'cust_fran_referee_t2',
          name: 'SaDec Referee T2',
          phone: '0907772222',
          email: 'fran_referee@aura.vn',
          loyalty_points: 0,
          lifetime_points: 0,
          loyalty_tier: 'bronze',
          tenant_id: 'tenant_sadec_02',
        },
        {
          id: 'cust_def_t1',
          name: 'Default Customer T1',
          phone: '0907770000',
          email: 'def_t1@aura.vn',
          loyalty_points: 100,
          lifetime_points: 100,
          loyalty_tier: 'silver',
          tenant_id: '   ',
        },
      ];

      const wallets: Array<Record<string, unknown>> = [
        {
          id: 'wal_def_t1',
          customer_id: 'cust_fran_t1',
          balance: 800000,
          total_earned: 800000,
          total_spent: 0,
          tenant_id: 'default',
        },
        {
          id: 'wal_fran_t1',
          customer_id: 'cust_fran_t1',
          balance: 10000,
          total_earned: 10000,
          total_spent: 0,
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const orders: Array<Record<string, unknown>> = [
        {
          id: 'ord_cross_t1',
          customer_id: 'cust_def_t1',
          total: 100000,
          total_amount: 100000,
          status: 'completed',
          payment_status: 'paid',
          tenant_id: 'tenant_sadec_02',
          created_at: new Date().toISOString(),
        },
        {
          id: 'ord_same_t1',
          customer_id: 'cust_fran_t1',
          total: 100000,
          total_amount: 100000,
          cashback_used: 0,
          points_earned: 13,
          cashback_earned: 7000,
          status: 'completed',
          payment_status: 'paid',
          tenant_id: 'tenant_sadec_02',
          created_at: new Date().toISOString(),
        },
        {
          id: 'ord_def_ws_t3',
          customer_id: 'cust_def_t1',
          customer_phone: '0907770000',
          total: 65000,
          total_amount: 65000,
          status: 'pending',
          payment_status: 'unpaid',
          order_type: 'pickup',
          items: JSON.stringify([{ product_id: 'prod_cf_muoi', name: 'Cà phê muối', quantity: 2 }]),
          tip_amount: 15000,
          updated_by: 'staff_def_1',
          tenant_id: '   ',
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
      ];

      const referrals: Array<Record<string, unknown>> = [
        {
          id: 'ref_cross_pts',
          referrer_id: 'cust_def_t1',
          referred_customer_id: 'cust_fran_referee_t2',
          referral_code: 'REFDEFT2',
          points_awarded: 100,
          status: 'pending',
          bonus_type: 'cashback',
        },
      ];

      const referralCodes: Array<Record<string, unknown>> = [
        { id: 'rc_def_t2', customer_id: 'cust_def_t1', code: 'REFDEFT2', times_used: 0, total_points_earned: 0 },
        { id: 'rc_fran_t2', customer_id: 'cust_fran_t1', code: 'REFFRANT2', times_used: 0, total_points_earned: 0 },
      ];

      const cashbackTxs: Array<Record<string, unknown>> = [];
      const executedSqls: string[] = [];

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        sql,
        args,
        first: vi.fn(async () => {
          executedSqls.push(sql);
          if (isAccountLookup(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-manager') return staffAccountRow('manager', 'default');
          }
          if (/SELECT id FROM cashback_transactions WHERE order_id = \? AND type = 'earn'/i.test(sql)) {
            return cashbackTxs.find((tx) => tx.order_id === args[0] && tx.type === 'earn') ?? null;
          }
          if (/FROM orders WHERE id = \?/i.test(sql)) {
            return orders.find((o) => o.id === args[0]) ?? null;
          }
          if (/SELECT COUNT\(\*\) AS c FROM orders WHERE status = \? AND created_at < \?/i.test(sql)) {
            const st = String(args[0] ?? 'pending');
            const t = String(args[2] ?? 'default');
            const c = orders.filter((o) => o.status === st && ((String(o.tenant_id ?? '').trim()) || 'default') === t).length;
            return { c };
          }
          if (/SELECT id AS customer_id FROM customers WHERE \(phone = \? OR phone = \?\) AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const p1 = String(args[0] ?? '');
            const p2 = String(args[1] ?? '');
            const t = String(args[2] ?? 'default');
            const found = customers.find(
              (c) => (c.phone === p1 || c.phone === p2) && ((String(c.tenant_id ?? '').trim()) || 'default') === t
            );
            return found ? { customer_id: found.id } : null;
          }
          if (/SELECT id, loyalty_points, lifetime_points, loyalty_tier, tenant_id\s+FROM customers WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql) ||
              /SELECT id, tenant_id FROM customers WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const cid = String(args[0] ?? '');
            const t = String(args[1] ?? 'default');
            return customers.find((c) => c.id === cid && ((String(c.tenant_id ?? '').trim()) || 'default') === t) ?? null;
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            return customers.find((c) => c.id === args[0]) ?? null;
          }
          if (/FROM cashback_wallets WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const cid = String(args[0] ?? '');
            const t = String(args[1] ?? 'default');
            return wallets.find((w) => w.customer_id === cid && ((String(w.tenant_id ?? '').trim()) || 'default') === t) ?? null;
          }
          if (/FROM referrals WHERE referred_customer_id = \? AND status = \?/i.test(sql)) {
            return referrals.find((r) => r.referred_customer_id === args[0] && r.status === args[1]) ?? null;
          }
          if (/SELECT \* FROM referral_codes WHERE code = \?/i.test(sql)) {
            return referralCodes.find((rc) => rc.code === args[0]) ?? null;
          }
          return null;
        }),
        all: vi.fn(async () => {
          executedSqls.push(sql);
          if (/FROM orders/i.test(sql) && /COALESCE\(NULLIF\(TRIM\((?:o\.)?tenant_id\), ''\), 'default'\)/i.test(sql)) {
            return {
              results: orders.filter((o) => ((String(o.tenant_id ?? '').trim()) || 'default') === 'default'),
            };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          executedSqls.push(sql);
          if (/UPDATE cashback_wallets\s+SET balance = MAX\(0, balance - \?\), updated_at = \?\s+WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const rev = Number(args[0]);
            const cid = String(args[2]);
            const t = String(args[3]);
            const w = wallets.find((x) => x.customer_id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
            if (w) w.balance = Math.max(0, Number(w.balance) - rev);
            return { success: true, meta: { changes: w ? 1 : 0 } };
          }
          if (/UPDATE customers SET loyalty_points = COALESCE\(loyalty_points,\s*0\)\s*\+\s*\?, lifetime_points = COALESCE\(lifetime_points,\s*0\)\s*\+\s*\?, updated_at = \? WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const delta = Number(args[0]);
            const cid = String(args[3]);
            const t = String(args[4]);
            const c = customers.find((x) => x.id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
            if (c) {
              c.loyalty_points = Number(c.loyalty_points || 0) + delta;
              c.lifetime_points = Number(c.lifetime_points || 0) + Number(args[1]);
            }
            return { success: true, meta: { changes: c ? 1 : 0 } };
          }
          if (/UPDATE customers SET loyalty_points = COALESCE\(loyalty_points,\s*0\)\s*\+\s*\?, lifetime_points = COALESCE\(lifetime_points,\s*0\)\s*\+\s*\?, updated_at = \? WHERE id = \?/i.test(sql)) {
            const delta = Number(args[0]);
            const cid = String(args[3]);
            const c = customers.find((x) => x.id === cid);
            if (c) {
              c.loyalty_points = Number(c.loyalty_points || 0) + delta;
              c.lifetime_points = Number(c.lifetime_points || 0) + Number(args[1]);
            }
            return { success: true, meta: { changes: c ? 1 : 0 } };
          }
          if (/UPDATE customers SET loyalty_points = \?, lifetime_points = \?, updated_at = \? WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const pts = Number(args[0]);
            const lpts = Number(args[1]);
            const cid = String(args[3]);
            const t = String(args[4]);
            const c = customers.find((x) => x.id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
            if (c) {
              c.loyalty_points = pts;
              c.lifetime_points = lpts;
            }
            return { success: true, meta: { changes: c ? 1 : 0 } };
          }
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          const base = makeStmt(sql, []);
          return {
            ...base,
            bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
          };
        }),
        batch: vi.fn(async (stmts: Array<{ sql: string; args: unknown[] }>) => {
          for (const s of stmts) {
            executedSqls.push(s.sql);
            if (/UPDATE cashback_wallets\s+SET balance = COALESCE\(balance, 0\) \+ \?, total_earned = COALESCE\(total_earned, 0\) \+ \?, updated_at = \?\s+WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(s.sql)) {
              const delta = Number(s.args[0]);
              const earned = Number(s.args[1]);
              const cid = String(s.args[3]);
              const t = String(s.args[4]);
              const w = wallets.find((x) => x.customer_id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
              if (w) {
                w.balance = Number(w.balance ?? 0) + delta;
                w.total_earned = Number(w.total_earned ?? 0) + earned;
              }
            } else if (/UPDATE cashback_wallets\s+SET balance = \?, total_earned = total_earned \+ \?, updated_at = \?\s+WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(s.sql)) {
              const nextBal = Number(s.args[0]);
              const earned = Number(s.args[1]);
              const cid = String(s.args[3]);
              const t = String(s.args[4]);
              const w = wallets.find((x) => x.customer_id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
              if (w) {
                w.balance = nextBal;
                w.total_earned = Number(w.total_earned) + earned;
              }
            }
            if (/INSERT INTO cashback_transactions/i.test(s.sql)) {
              cashbackTxs.push({ id: s.args[0], wallet_id: s.args[1], customer_id: s.args[2], order_id: s.args[3], type: 'earn', amount: s.args[4] });
            }
          }
          return [];
        }),
      };

      // 1. T1: creditLoyaltyIfEligible forwards order.tenant_id ('tenant_sadec_02') to applyAccrual:
      //        - Cross-tenant order ('ord_cross_t1' with customer 'cust_def_t1') is blocked
      //        - Same-tenant order ('ord_same_t1' with customer 'cust_fran_t1') credits ONLY 'wal_fran_t1'
      await creditLoyaltyIfEligible(mockDb as any, {}, 'ord_cross_t1');
      expect(cashbackTxs.some((tx) => tx.order_id === 'ord_cross_t1')).toBe(false);

      await creditLoyaltyIfEligible(mockDb as any, {}, 'ord_same_t1');
      expect(wallets.find((w) => w.id === 'wal_fran_t1')?.balance).toBeGreaterThan(10000);
      expect(wallets.find((w) => w.id === 'wal_def_t1')?.balance).toBe(800000);
      const afterOrderEarnBalance = Number(wallets.find((w) => w.id === 'wal_fran_t1')?.balance);

      // 2. T1: consumeCrmEvent forwards tenantId from event.payload to applyAccrual & reverseAccrual
      const crossCrmPaid = await consumeCrmEvent({
        db: mockDb as any,
        event: {
          eventType: 'order_paid',
          customerId: 'cust_def_t1',
          orderId: 'ord_cross_t1',
          payload: { totalAmount: 100000, tenantId: 'tenant_sadec_02' },
        },
      });
      expect(crossCrmPaid.ok).toBe(false);

      const sameCrmCancelled = await consumeCrmEvent({
        db: mockDb as any,
        event: {
          eventType: 'order_cancelled',
          customerId: 'cust_fran_t1',
          orderId: 'ord_same_t1',
          payload: { totalAmount: 100000, tenant_id: 'tenant_sadec_02' },
        },
      });
      expect(sameCrmCancelled.ok).toBe(true);
      expect(Number(wallets.find((w) => w.id === 'wal_fran_t1')?.balance)).toBeLessThan(afterOrderEarnBalance);
      expect(wallets.find((w) => w.id === 'wal_def_t1')?.balance).toBe(800000);

      // 3. T2: processReferralOnFirstOrder & applyReferralForNewCustomer enforce tenantId scoping
      const crossLegacyRef = await processReferralOnFirstOrder(mockDb as any, 'cust_fran_referee_t2', 'tenant_sadec_02');
      expect(crossLegacyRef).toEqual({ success: false, reason: 'referrer_not_found' });
      expect(customers.find((c) => c.id === 'cust_def_t1')?.loyalty_points).toBe(100);

      const crossApplyRef = await applyReferralForNewCustomer(mockDb as any, 'cust_fran_referee_t2', 'REFDEFT2', 'tenant_sadec_02');
      expect(crossApplyRef).toEqual({ success: false, reason: 'referrer_not_found' });

      const sameApplyRef = await applyReferralForNewCustomer(mockDb as any, 'cust_fran_referee_t2', 'REFFRANT2', 'tenant_sadec_02');
      expect(sameApplyRef.success).toBe(true);

      // Switch referral row to same-tenant referrer and verify processReferralOnFirstOrder succeeds
      referrals[0].referrer_id = 'cust_fran_t1';
      const sameLegacyRef = await processReferralOnFirstOrder(mockDb as any, 'cust_fran_referee_t2', 'tenant_sadec_02');
      expect(sameLegacyRef.success).toBe(true);
      expect(customers.find((c) => c.id === 'cust_fran_t1')?.loyalty_points).toBe(400);

      // 4. T3: Whitespace-only tenant_id ('   ') normalization via COALESCE(NULLIF(TRIM(tenant_id), ''), 'default')
      executedSqls.length = 0;
      const prof = await lookupProfile(mockDb as any, '0907770000', { tenantId: 'default' });
      expect(prof.found).toBe(true);
      expect(prof.customerId).toBe('cust_def_t1');
      expect(executedSqls.some((s) => s.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"))).toBe(true);

      executedSqls.length = 0;
      const acct = await getCustomerAccount(mockDb as any, 'cust_def_t1');
      expect(acct.customerId).toBe('cust_def_t1');
      expect(executedSqls.some((s) => s.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"))).toBe(true);

      executedSqls.length = 0;
      await getCustomer360(mockDb as any, 'cust_def_t1');
      expect(
        executedSqls.some((s) =>
          s.includes("COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')")
        )
      ).toBe(true);

      executedSqls.length = 0;
      await aggregateEvents(mockDb as any, 'cust_def_t1');
      expect(
        executedSqls.some((s) =>
          s.includes("COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')")
        )
      ).toBe(true);

      executedSqls.length = 0;
      const ful = await getFulfillment(mockDb as any, 'ord_def_ws_t3', 'cust_def_t1', undefined, 'default');
      expect(ful.ok).toBe(true);
      expect(executedSqls.some((s) => s.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"))).toBe(true);

      // Verify route handlers emit COALESCE(NULLIF(TRIM(...), ''), 'default')
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/staff-tips', staffTipsRouter);
      app.route('/api/assistant', customerAssistantRouter);
      app.route('/api/recommendations', recommendationsRouter);
      app.route('/api/franchise', franchiseRouter);
      app.route('/api/edge', containerTelemetryRouter);
      app.route('/api/forecast', demandForecastRouter);
      app.route('/api/pricing/dynamic', dynamicPricingRouter);
      app.route('/api/inventory/forecasting', inventoryForecastingRouter);

      const defEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
      });

      executedSqls.length = 0;
      await app.fetch(await authRequest('GET', '/api/staff-tips/staff_def_1', 'manager', 'default'), defEnv);
      await app.fetch(new Request('https://api.test/api/recommendations/trending'), defEnv);
      await app.fetch(await authRequest('GET', '/api/franchise/locations', 'manager', 'default'), defEnv);
      await app.fetch(await authRequest('GET', '/api/edge/containers/status', 'manager', 'default'), defEnv);
      await app.fetch(await authRequest('GET', '/api/forecast/forecast/hourly', 'manager', 'default'), defEnv);
      await app.fetch(new Request('https://api.test/api/pricing/dynamic/active'), defEnv);
      await app.fetch(await authRequest('GET', '/api/inventory/forecasting/history', 'manager', 'default'), defEnv);

      expect(executedSqls.some((s) => s.includes("COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?"))).toBe(true);
      expect(executedSqls.some((s) => s.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"))).toBe(true);
    });
  });

  // =========================================================================
  // Suite 25: Phase U1–U3 — OpenAPI Order Update/Cancel Reversal & Accrual Parity,
  //           Inventory Restore & BOM Recipe/Ingredient Tenant Scoping, and
  //           Check-in / Birthday / Promotion Code-Keyed Multi-Tenant Isolation
  // =========================================================================
  describe('Suite 25: OpenAPI Order Update/Cancel Reversal & Accrual Parity, Inventory Restore & BOM Recipe/Ingredient Tenant Scoping, and Check-in/Birthday/Promotion Multi-Tenant Isolation (U1–U3)', () => {
    it('enforces tenant-scoped reversal/accrual in handleOpenApiUpdateOrder & handleCancelOrder, scopes restoreInventoryForOrder/getCanonicalRecipe/deductOrderStock by tenant, and isolates same-day checkins, birthday redemptions & code-keyed promotion usage by tenant (U1–U3)', async () => {
      const { handleOpenApiUpdateOrder, handleCancelOrder } = await import('../../routes/openapi-orders-handlers/order-write-handlers');
      const { restoreInventoryForOrder } = await import('../../../../packages/domain/inventory/src/routes/order-deduction');
      const { getCanonicalRecipe, deductOrderStock } = await import('../../../../packages/domain/inventory/src/policies/inventory-recipe-policy');
      const { checkinRouter } = await import('../../routes/checkin');
      const { birthdayRouter } = await import('../../routes/birthday');
      const { promotionsRouter } = await import('../../routes/promotions');
      const { Hono } = await import('hono');

      const todayStr = new Date().toISOString().slice(0, 10);
      const todayMonthDay = todayStr.slice(5); // MM-DD

      const customers: Array<Record<string, unknown>> = [
        {
          id: 'cust_fran_u1',
          name: 'SaDec Customer U1',
          phone: '0906661111',
          email: 'fran_u1@aura.vn',
          birthday: `1995-${todayMonthDay}`,
          date_of_birth: `1995-${todayMonthDay}`,
          loyalty_points: 250,
          lifetime_points: 250,
          loyalty_tier: 'gold',
          tenant_id: 'tenant_sadec_02',
        },
        {
          id: 'cust_def_u1',
          name: 'Default Customer U1',
          phone: '0906660000',
          email: 'def_u1@aura.vn',
          birthday: `1995-${todayMonthDay}`,
          date_of_birth: `1995-${todayMonthDay}`,
          loyalty_points: 100,
          lifetime_points: 100,
          loyalty_tier: 'silver',
          tenant_id: '   ',
        },
      ];

      const wallets: Array<Record<string, unknown>> = [
        {
          id: 'wal_def_u1',
          customer_id: 'cust_fran_u1',
          balance: 700000,
          total_earned: 700000,
          total_spent: 0,
          tenant_id: 'default',
        },
        {
          id: 'wal_fran_u1',
          customer_id: 'cust_fran_u1',
          balance: 20000,
          total_earned: 20000,
          total_spent: 0,
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const orders: Array<Record<string, unknown>> = [
        {
          id: 'ord_fran_u1',
          customer_id: 'cust_fran_u1',
          customer_phone: '0906661111',
          total: 100000,
          total_amount: 100000,
          status: 'served',
          payment_status: 'paid',
          tenant_id: 'tenant_sadec_02',
          created_at: new Date().toISOString(),
        },
        {
          id: 'ord_fran_cancel_u1',
          customer_id: 'cust_fran_u1',
          customer_phone: '0906661111',
          total: 100000,
          total_amount: 100000,
          points_earned: 100,
          cashback_earned: 5000,
          status: 'confirmed',
          payment_status: 'paid',
          tenant_id: 'tenant_sadec_02',
          created_at: new Date().toISOString(),
        },
        {
          id: 'ord_def_ws_u1',
          customer_id: 'cust_def_u1',
          total: 50000,
          status: 'pending',
          payment_status: 'unpaid',
          tenant_id: '   ',
          created_at: new Date().toISOString(),
        },
      ];

      const inventoryItems: Array<Record<string, unknown>> = [
        { id: 'inv_def_1', sku: 'SKU_DEF', name: 'Default Beans', current_stock: 50, unit: 'kg', tenant_id: 'default' },
        { id: 'inv_fran_1', sku: 'SKU_FRAN', name: 'SaDec Beans', current_stock: 30, unit: 'kg', tenant_id: 'tenant_sadec_02' },
      ];

      const inventoryTxs: Array<Record<string, unknown>> = [
        { id: 'itx_cross_1', item_id: 'inv_def_1', type: 'reserve', quantity: -5, reference_id: 'ord_fran_cancel_u1', reference_type: 'order' },
        { id: 'itx_same_1', item_id: 'inv_fran_1', type: 'reserve', quantity: -3, reference_id: 'ord_fran_cancel_u1', reference_type: 'order' },
      ];

      const recipes: Array<Record<string, unknown>> = [
        { id: 'rec_def_only', product_id: 'prod_def_only', name: 'Default Recipe', is_active: 1, tenant_id: '   ' },
        { id: 'rec_fran_u2', product_id: 'prod_fran_u2', name: 'SaDec Recipe', is_active: 1, tenant_id: 'tenant_sadec_02' },
      ];

      const recipeItems: Array<Record<string, unknown>> = [
        { recipe_id: 'rec_def_only', ingredient_id: 'ing_def_u2', quantity: 20, unit: 'g' },
        { recipe_id: 'rec_fran_u2', ingredient_id: 'ing_def_u2', quantity: 15, unit: 'g' },
      ];

      const ingredients: Array<Record<string, unknown>> = [
        { id: 'ing_def_u2', name: 'Default Arabica', current_stock: 500, unit: 'g', cost_per_unit: 500, tenant_id: 'default' },
      ];

      const stockMovements: Array<Record<string, unknown>> = [];

      const promotions: Array<Record<string, unknown>> = [
        { code: 'SHAREDCODE', percent: 10, max_discount: 20000, min_order: 0, usage_limit: 10, usage_count: 5, current_uses: 5, used_count: 5, is_active: 1, tenant_id: 'default' },
        { code: 'SHAREDCODE', percent: 15, max_discount: 30000, min_order: 0, usage_limit: 10, usage_count: 2, current_uses: 2, used_count: 2, is_active: 1, tenant_id: 'tenant_sadec_02' },
      ];

      const promoRedemptions: Array<Record<string, unknown>> = [
        { order_id: 'ord_fran_cancel_u1', code: 'SHAREDCODE', discount_amount: 15000 },
      ];

      const checkins: Array<Record<string, unknown>> = [
        {
          id: 'ci_def_today',
          customer_id: 'cust_fran_u1',
          customer_name: 'Checked In At Default',
          checkin_date: todayStr,
          checkin_time: new Date().toISOString(),
          reward_amount: 5000,
          status: 'pending',
          tenant_id: 'default',
        },
      ];

      const birthdayRedemptions: Array<Record<string, unknown>> = [
        {
          id: 'bday_def_year',
          customer_id: 'cust_fran_u1',
          discount_percent: 15,
          redeemed_at: new Date().toISOString(),
          tenant_id: 'default',
        },
      ];

      const cashbackTxs: Array<Record<string, unknown>> = [
        {
          id: 'ctx_earn_cancel_u1',
          wallet_id: 'wal_fran_u1',
          customer_id: 'cust_fran_u1',
          order_id: 'ord_fran_cancel_u1',
          type: 'earn',
          amount: 7000,
        },
      ];

      const executedSqls: string[] = [];

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        sql,
        args,
        first: vi.fn(async () => {
          executedSqls.push(sql);
          if (isAccountLookup(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
            if (args[0] === 'user-manager') return staffAccountRow('manager', 'default');
          }
          if (/FROM orders WHERE id = \?/i.test(sql) || /FROM orders o\s+LEFT JOIN cafe_tables/i.test(sql)) {
            return orders.find((o) => o.id === args[0]) ?? null;
          }
          if (/SELECT customer_id FROM cashback_transactions WHERE order_id = \? AND type = 'earn'/i.test(sql)) {
            return cashbackTxs.find((tx) => tx.order_id === args[0] && tx.type === 'earn') ?? null;
          }
          if (/SELECT id FROM cashback_transactions WHERE order_id = \? AND type = 'earn'/i.test(sql)) {
            return cashbackTxs.find((tx) => tx.order_id === args[0] && tx.type === 'earn') ?? null;
          }
          if (/SELECT promotion_id, code FROM promotion_redemptions WHERE order_id = \?/i.test(sql)) {
            return promoRedemptions.find((pr) => pr.order_id === args[0]) ?? null;
          }
          if (/SELECT order_id, discount_amount FROM promotion_redemptions WHERE order_id = \?/i.test(sql)) {
            return promoRedemptions.find((pr) => pr.order_id === args[0]) ?? null;
          }
          if (/SELECT id, loyalty_points, lifetime_points, loyalty_tier, tenant_id\s+FROM customers WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql) ||
              /SELECT id, tenant_id FROM customers WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const cid = String(args[0] ?? '');
            const t = String(args[1] ?? 'default');
            return customers.find((c) => c.id === cid && ((String(c.tenant_id ?? '').trim()) || 'default') === t) ?? null;
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            return customers.find((c) => c.id === args[0]) ?? null;
          }
          if (/FROM cashback_wallets WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const cid = String(args[0] ?? '');
            const t = String(args[1] ?? 'default');
            return wallets.find((w) => w.customer_id === cid && ((String(w.tenant_id ?? '').trim()) || 'default') === t) ?? null;
          }
          if (/SELECT id, tenant_id FROM inventory_items WHERE id = \?/i.test(sql)) {
            return inventoryItems.find((i) => i.id === args[0]) ?? null;
          }
          if (/SELECT id, product_id, name, instructions, tenant_id FROM recipes WHERE product_id = \? AND is_active = 1 AND/i.test(sql)) {
            const pid = String(args[0] ?? '');
            const t = String(args[1] ?? 'default');
            return recipes.find((r) => r.product_id === pid && ((String(r.tenant_id ?? '').trim()) || 'default') === t) ?? null;
          }
          if (/SELECT id, product_id, name, instructions, tenant_id FROM recipes WHERE product_id = \?/i.test(sql)) {
            return recipes.find((r) => r.product_id === args[0]) ?? null;
          }
          if (/SELECT id, current_stock, tenant_id FROM ingredients WHERE id = \?/i.test(sql) || /SELECT id, tenant_id FROM ingredients WHERE id = \?/i.test(sql)) {
            return ingredients.find((i) => i.id === args[0]) ?? null;
          }
          if (/SELECT id FROM stock_movements WHERE reference_id = \?/i.test(sql)) {
            return stockMovements.find((m) => m.reference_id === args[0]) ?? null;
          }
          if (/SELECT id FROM checkins WHERE customer_id = \? AND checkin_date = \?$/i.test(sql.trim())) {
            return checkins.find((ci) => ci.customer_id === args[0] && ci.checkin_date === args[1]) ?? null;
          }
          if (/SELECT id, tenant_id FROM checkins WHERE customer_id = \? AND checkin_date = \? AND/i.test(sql)) {
            const cid = String(args[0] ?? '');
            const dt = String(args[1] ?? '');
            const t = String(args[2] ?? 'default');
            return checkins.find((ci) => ci.customer_id === cid && ci.checkin_date === dt && ((String(ci.tenant_id ?? '').trim()) || 'default') === t) ?? null;
          }
          if (/SELECT \* FROM checkins WHERE id = \?/i.test(sql)) {
            return checkins.find((ci) => ci.id === args[0]) ?? null;
          }
          if (/SELECT id FROM birthday_redemptions WHERE customer_id = \? AND redeemed_at >= \?$/i.test(sql.trim())) {
            return birthdayRedemptions.find((b) => b.customer_id === args[0]) ?? null;
          }
          if (/SELECT id, tenant_id FROM birthday_redemptions WHERE customer_id = \? AND redeemed_at >= \? AND/i.test(sql)) {
            const cid = String(args[0] ?? '');
            const t = String(args[2] ?? 'default');
            return birthdayRedemptions.find((b) => b.customer_id === cid && ((String(b.tenant_id ?? '').trim()) || 'default') === t) ?? null;
          }
          if (/SELECT \* FROM birthday_redemptions WHERE id = \?/i.test(sql)) {
            return birthdayRedemptions.find((b) => b.id === args[0]) ?? null;
          }
          if (/SELECT \* FROM promotions WHERE UPPER\(code\) = \? AND/i.test(sql)) {
            const c = String(args[0] ?? '').toUpperCase();
            const t = String(args[1] ?? 'default');
            return promotions.find((p) => String(p.code).toUpperCase() === c && ((String(p.tenant_id ?? '').trim()) || 'default') === t) ?? null;
          }
          if (/SELECT \* FROM promotions WHERE UPPER\(code\) = \?$/i.test(sql.trim())) {
            const c = String(args[0] ?? '').toUpperCase();
            return promotions.find((p) => String(p.code).toUpperCase() === c) ?? null;
          }
          return null;
        }),
        all: vi.fn(async () => {
          executedSqls.push(sql);
          if (/FROM inventory_transactions\s+WHERE reference_id = \? AND reference_type = 'order' AND type = 'reserve'/i.test(sql)) {
            return { results: inventoryTxs.filter((tx) => tx.reference_id === args[0] && tx.type === 'reserve') };
          }
          if (/FROM recipe_items ri/i.test(sql)) {
            const rid = String(args[0] ?? '');
            const items = recipeItems
              .filter((ri) => ri.recipe_id === rid)
              .map((ri) => {
                const ing = ingredients.find((i) => i.id === ri.ingredient_id);
                return {
                  ingredient_id: ri.ingredient_id,
                  quantity: ri.quantity,
                  unit: ri.unit,
                  ing_name: ing?.name,
                  cost_per_unit: ing?.cost_per_unit ?? 0,
                };
              });
            return { results: items };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          executedSqls.push(sql);
          if (/UPDATE orders SET status = \?/i.test(sql)) {
            const nextStatus = String(args[0]);
            const oid = String(args[args.length - 1] ?? args[1]);
            const ord = orders.find((o) => o.id === oid || args.includes(o.id));
            if (ord) ord.status = nextStatus;
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE cashback_wallets\s+SET balance = MAX\(0, balance - \?\), updated_at = \?\s+WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const rev = Number(args[0]);
            const cid = String(args[2]);
            const t = String(args[3]);
            const w = wallets.find((x) => x.customer_id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
            if (w) w.balance = Math.max(0, Number(w.balance) - rev);
            return { success: true, meta: { changes: w ? 1 : 0 } };
          }
          if (/UPDATE promotions[\s\S]*WHERE UPPER\(code\) = UPPER\(\?\) AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const code = String(args[0]).toUpperCase();
            const t = String(args[1]);
            const p = promotions.find((x) => String(x.code).toUpperCase() === code && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
            if (p) {
              p.usage_count = Math.max(0, Number(p.usage_count) - 1);
              p.current_uses = Math.max(0, Number(p.current_uses) - 1);
              p.used_count = Math.max(0, Number(p.used_count) - 1);
            }
            return { success: true, meta: { changes: p ? 1 : 0 } };
          }
          if (/UPDATE promotions SET usage_count = COALESCE\(usage_count, 0\) \+ 1 WHERE code = \? AND \(COALESCE\(NULLIF\(tenant_id, ''\), 'default'\) = \? OR COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?2\)/i.test(sql)) {
            const code = String(args[0]).toUpperCase();
            const t = String(args[1]);
            const p = promotions.find((x) => String(x.code).toUpperCase() === code && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
            if (p) p.usage_count = Number(p.usage_count) + 1;
            return { success: true, meta: { changes: p ? 1 : 0 } };
          }
          if (/INSERT INTO stock_movements/i.test(sql)) {
            stockMovements.push({ id: args[0], ingredient_id: args[1], quantity: args[2], reference_id: args[3] });
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO checkins/i.test(sql)) {
            checkins.push({
              id: args[0],
              customer_id: args[1],
              customer_name: args[2],
              checkin_date: args[3],
              checkin_time: args[4],
              reward_amount: args[5],
              status: args[6],
              created_at: args[7],
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE checkins SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const ci = checkins.find((x) => x.id === args[1]);
            if (ci) ci.tenant_id = args[0];
            return { success: true, meta: { changes: ci ? 1 : 0 } };
          }
          if (/INSERT INTO birthday_redemptions/i.test(sql)) {
            birthdayRedemptions.push({
              id: args[0],
              customer_id: args[1],
              discount_percent: args[2],
              order_id: args[3],
              redeemed_at: args[4],
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE birthday_redemptions SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const br = birthdayRedemptions.find((x) => x.id === args[1]);
            if (br) br.tenant_id = args[0];
            return { success: true, meta: { changes: br ? 1 : 0 } };
          }
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          const base = makeStmt(sql, []);
          return {
            ...base,
            bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
          };
        }),
        batch: vi.fn(async (stmts: Array<{ sql: string; args: unknown[] }>) => {
          for (const s of stmts) {
            executedSqls.push(s.sql);
            if (/UPDATE cashback_wallets\s+SET balance = COALESCE\(balance, 0\) \+ \?, total_earned = COALESCE\(total_earned, 0\) \+ \?, updated_at = \?\s+WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(s.sql)) {
              const delta = Number(s.args[0]);
              const earned = Number(s.args[1]);
              const cid = String(s.args[3]);
              const t = String(s.args[4]);
              const w = wallets.find((x) => x.customer_id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
              if (w) {
                w.balance = Number(w.balance ?? 0) + delta;
                w.total_earned = Number(w.total_earned ?? 0) + earned;
              }
            } else if (/UPDATE cashback_wallets\s+SET balance = \?, total_earned = total_earned \+ \?, updated_at = \?\s+WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(s.sql)) {
              const nextBal = Number(s.args[0]);
              const earned = Number(s.args[1]);
              const cid = String(s.args[3]);
              const t = String(s.args[4]);
              const w = wallets.find((x) => x.customer_id === cid && ((String(x.tenant_id ?? '').trim()) || 'default') === t);
              if (w) {
                w.balance = nextBal;
                w.total_earned = Number(w.total_earned) + earned;
              }
            }
            if (/UPDATE inventory_items SET current_stock = current_stock \+ \?/i.test(s.sql)) {
              const qty = Number(s.args[0]);
              const iid = String(s.args[1]);
              const item = inventoryItems.find((i) => i.id === iid);
              if (item) item.current_stock = Number(item.current_stock) + qty;
            }
          }
          return [];
        }),
      };

      const franEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'tenant_sadec_02',
      });

      // 1. U1: OpenAPI handleOpenApiUpdateOrder transitions 'ord_fran_u1' -> 'completed' and credits ONLY 'wal_fran_u1'
      const orderApiApp = new Hono<{ Bindings: Env }>();
      orderApiApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'user-supervisor', role: 'supervisor', tenantId: 'tenant_sadec_02' });
        c.set('tenantId' as any, 'tenant_sadec_02');
        await next();
      });
      orderApiApp.patch('/api/orders/:id', (c) => handleOpenApiUpdateOrder(c as any));
      orderApiApp.post('/api/orders/:id/cancel', (c) => handleCancelOrder(c as any));

      const completeRes = await orderApiApp.fetch(
        new Request('https://api.test/api/orders/ord_fran_u1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        }),
        franEnv
      );
      expect(completeRes.status).toBe(200);
      expect(Number(wallets.find((w) => w.id === 'wal_fran_u1')?.balance)).toBeGreaterThan(20000);
      expect(wallets.find((w) => w.id === 'wal_def_u1')?.balance).toBe(700000);

      // Transition 'ord_fran_cancel_u1' -> 'cancelled' via handleOpenApiUpdateOrder:
      // - Restores ONLY 'inv_fran_1' (30 -> 33), NOT cross-tenant 'inv_def_1' (remains 50)
      // - Reverses cashback on 'wal_fran_u1', NOT 'wal_def_u1'
      // - Decrements 'SHAREDCODE' usage ONLY for 'tenant_sadec_02' (2 -> 1), leaving 'default' at 5
      const walletBeforeCancel = Number(wallets.find((w) => w.id === 'wal_fran_u1')?.balance);
      const cancelViaPatchRes = await orderApiApp.fetch(
        new Request('https://api.test/api/orders/ord_fran_cancel_u1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled', reason: 'Customer changed mind' }),
        }),
        franEnv
      );
      expect(cancelViaPatchRes.status).toBe(200);
      expect(inventoryItems.find((i) => i.id === 'inv_fran_1')?.current_stock).toBe(33);
      expect(inventoryItems.find((i) => i.id === 'inv_def_1')?.current_stock).toBe(50);
      expect(Number(wallets.find((w) => w.id === 'wal_fran_u1')?.balance)).toBeLessThan(walletBeforeCancel);
      expect(wallets.find((w) => w.id === 'wal_def_u1')?.balance).toBe(700000);
      expect(promotions.find((p) => p.tenant_id === 'tenant_sadec_02')?.usage_count).toBe(1);
      expect(promotions.find((p) => p.tenant_id === 'default')?.usage_count).toBe(5);

      // 2. U2: restoreInventoryForOrder aborts when caller tenantId mismatches order.tenant_id
      await restoreInventoryForOrder({ AURA_DB: mockDb as any }, 'ord_fran_u1', 'default');
      expect(inventoryItems.find((i) => i.id === 'inv_fran_1')?.current_stock).toBe(33);

      // U2: getCanonicalRecipe normalizes whitespace-only tenant_id ('   ') to 'default' and blocks cross-tenant fallback
      const crossRecipe = await getCanonicalRecipe(mockDb as any, 'prod_def_only', 'tenant_sadec_02');
      expect(crossRecipe).toBeNull();
      const wsDefaultRecipe = await getCanonicalRecipe(mockDb as any, 'prod_def_only', 'default');
      expect(wsDefaultRecipe).not.toBeNull();
      expect(wsDefaultRecipe?.id).toBe('rec_def_only');

      // U2: deductOrderStock rejects cross-tenant ingredient in allowNegative: false and skips cross-tenant stock_movements in allowNegative: true
      const strictDeduct = await deductOrderStock(
        mockDb as any,
        'ord_fran_u2_strict',
        [{ productId: 'prod_fran_u2', quantity: 1 }],
        { allowNegative: false, tenantId: 'tenant_sadec_02' }
      );
      expect(strictDeduct.ok).toBe(false);
      expect(strictDeduct.error).toBe('insufficient_stock');

      const lenientDeduct = await deductOrderStock(
        mockDb as any,
        'ord_fran_u2_lenient',
        [{ productId: 'prod_fran_u2', quantity: 1 }],
        { allowNegative: true, tenantId: 'tenant_sadec_02' }
      );
      expect(lenientDeduct.ok).toBe(true);
      expect(stockMovements.some((m) => m.reference_id === 'ord_fran_u2_lenient')).toBe(false);

      // 3. U3: Check-in same-day duplicate guard isolates by tenant and persists tenant_id on checkins
      const checkinApp = new Hono<{ Bindings: Env }>();
      checkinApp.route('/api/checkin', checkinRouter);
      const franCheckinRes = await checkinApp.fetch(
        new Request('https://api.test/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_sadec_02' },
          body: JSON.stringify({ customer_id: 'cust_fran_u1', customer_name: 'SaDec Customer U1' }),
        }),
        franEnv
      );
      expect(franCheckinRes.status).toBe(201);
      const newCheckin = checkins.find((ci) => ci.id !== 'ci_def_today');
      expect(newCheckin?.tenant_id).toBe('tenant_sadec_02');

      // Second check-in on the same day at the SAME tenant ('tenant_sadec_02') is blocked with 400
      const dupFranCheckinRes = await checkinApp.fetch(
        new Request('https://api.test/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_sadec_02' },
          body: JSON.stringify({ customer_id: 'cust_fran_u1', customer_name: 'SaDec Customer U1' }),
        }),
        franEnv
      );
      expect(dupFranCheckinRes.status).toBe(400);

      // 4. U3: Birthday annual redemption check & redeem isolate by tenant and persist tenant_id on birthday_redemptions
      const bdayApp = new Hono<{ Bindings: Env }>();
      bdayApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'user-supervisor', role: 'supervisor', tenantId: 'tenant_sadec_02' });
        c.set('tenantId' as any, 'tenant_sadec_02');
        await next();
      });
      bdayApp.route('/api/birthday', birthdayRouter);
      const bdayCheckRes = await bdayApp.fetch(
        new Request('https://api.test/api/birthday/check?customer_id=cust_fran_u1', {
          headers: { 'X-Tenant-ID': 'tenant_sadec_02' },
        }),
        franEnv
      );
      expect(bdayCheckRes.status).toBe(200);
      const bdayCheckBody = (await bdayCheckRes.json()) as { data: { eligible: boolean } };
      expect(bdayCheckBody.data.eligible).toBe(true);

      const bdayRedeemRes = await bdayApp.fetch(
        new Request('https://api.test/api/birthday/redeem', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: JSON.stringify({ customer_id: 'cust_fran_u1', order_id: 'ord_fran_u1' }),
        }),
        franEnv
      );
      expect(bdayRedeemRes.status).toBe(201);
      const newBday = birthdayRedemptions.find((b) => b.id !== 'bday_def_year');
      expect(newBday?.tenant_id).toBe('tenant_sadec_02');

      // 5. U3: Promotion code-keyed /redeem increments ONLY the 'tenant_sadec_02' promotion row (1 -> 2), leaving 'default' at 5
      const promoApp = new Hono<{ Bindings: Env }>();
      promoApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'user-supervisor', role: 'supervisor', tenantId: 'tenant_sadec_02' });
        c.set('tenantId' as any, 'tenant_sadec_02');
        await next();
      });
      promoApp.route('/api/promotions', promotionsRouter);
      const promoRedeemRes = await promoApp.fetch(
        new Request('https://api.test/api/promotions/redeem', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: JSON.stringify({ code: 'SHAREDCODE', order_id: 'ord_fran_u1', order_total: 100000 }),
        }),
        franEnv
      );
      expect(promoRedeemRes.status).toBe(200);
      expect(promotions.find((p) => p.tenant_id === 'tenant_sadec_02')?.usage_count).toBe(2);
      expect(promotions.find((p) => p.tenant_id === 'default')?.usage_count).toBe(5);
    });
  });

  // =========================================================================
  // Suite 26: Phase V1-V3 — Loyalty Rewards/Redeem/My-Rewards/Points/Summary,
  //           Referral Code/Apply/Stats, OpenAPI Promotion Usage & PO Receive
  //           Multi-Tenant Isolation
  // =========================================================================
  describe('Suite 26: Phase V1-V3 — Loyalty Rewards, Referrals, Promotion Usage & PO Receive Multi-Tenant Isolation', () => {
    it('isolates loyalty_rewards catalog/redeem/my-rewards/points/summary, referral code/apply/stats, promotion_usages, and PO receive across tenants', async () => {
      const { loyaltyRouter } = await import('../../routes/loyalty');
      const { referralRouter } = await import('../../routes/referrals');
      const { registerUsageHandlers } = await import('../../routes/openapi-promotions-handlers/usage-handlers');
      const { registerPurchaseOrderHandlers } = await import('../../routes/openapi-inventory-handlers/purchase-order-handlers');
      const { OpenAPIHono } = await import('@hono/zod-openapi');
      const { Hono } = await import('hono');

      const custSadecToken = await generateJWT(
        { id: 'cust_fran_v1', role: 'customer', tenantId: 'tenant_sadec_02' },
        TEST_JWT_SECRET,
        3600
      );

      const customers: Array<Record<string, unknown>> = [
        {
          id: 'cust_fran_v1',
          name: 'SaDec Customer V1',
          phone: '0977111222',
          email: 'v1@sadec.vn',
          loyalty_points: 500,
          lifetime_points: 500,
          loyalty_tier: 'silver',
          tenant_id: 'tenant_sadec_02',
          created_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'cust_ref_owner_fran',
          name: 'SaDec Referrer',
          phone: '0977333444',
          loyalty_points: 200,
          tenant_id: 'tenant_sadec_02',
        },
        {
          id: 'cust_ref_owner_def',
          name: 'Default Referrer',
          phone: '0977555666',
          loyalty_points: 200,
          tenant_id: 'default',
        },
      ];

      const loyaltyRewards: Array<Record<string, unknown>> = [
        {
          id: 'lr_def_v1',
          name: 'Default Free Latte',
          points_cost: 100,
          description: 'Default store reward',
          type: 'free_item',
          value: 45000,
          is_active: 1,
          tenant_id: 'default',
        },
        {
          id: 'lr_fran_v1',
          name: 'SaDec Free Matcha',
          points_cost: 150,
          description: 'SaDec store reward',
          type: 'free_item',
          value: 50000,
          is_active: 1,
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const userRewards: Array<Record<string, unknown>> = [
        {
          id: 'uwr_def_existing',
          customer_id: 'cust_fran_v1',
          reward_id: 'lr_def_v1',
          code: 'DEF-CODE-1',
          status: 'active',
          tenant_id: 'default',
          created_at: '2026-11-01T00:00:00.000Z',
        },
      ];

      const loyaltyRedemptions: Array<Record<string, unknown>> = [];
      const loyaltyPointLogs: Array<Record<string, unknown>> = [
        {
          id: 'ptl_def_existing',
          customer_id: 'cust_fran_v1',
          points_change: 50,
          reason: 'earn',
          tenant_id: 'default',
          created_at: '2026-11-01T00:00:00.000Z',
        },
      ];
      const loyaltyTransactions: Array<Record<string, unknown>> = [];

      const referralCodes: Array<Record<string, unknown>> = [
        {
          id: 'refc_def_existing',
          customer_id: 'cust_fran_v1',
          code: 'FNB-DEF001',
          times_used: 3,
          total_points_earned: 300,
          tenant_id: 'default',
          created_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'refc_owner_fran',
          customer_id: 'cust_ref_owner_fran',
          code: 'FNB-SADEC1',
          times_used: 1,
          total_points_earned: 0,
          tenant_id: 'tenant_sadec_02',
          created_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'refc_owner_def',
          customer_id: 'cust_ref_owner_def',
          code: 'FNB-ONLYDF',
          times_used: 1,
          total_points_earned: 0,
          tenant_id: 'default',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ];

      const referrals: Array<Record<string, unknown>> = [
        {
          id: 'ref_def_prev',
          referrer_id: 'cust_fran_v1',
          referred_customer_id: 'cust_fran_v1',
          referral_code: 'FNB-DEF001',
          status: 'completed',
          cashback_awarded_vnd: 10000,
          tenant_id: 'default',
          created_at: '2026-10-01T00:00:00.000Z',
        },
      ];

      const promotions: Array<Record<string, unknown>> = [
        {
          id: '11111111-1111-4111-8111-111111111111',
          code: 'SADECVIP',
          name: 'SaDec VIP Promo',
          discount_type: 'fixed',
          discount_value: 15000,
          is_active: 1,
          max_uses: 10,
          current_uses: 1,
          usage_count: 1,
          usage_limit_per_customer: 1,
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const promotionUsages: Array<Record<string, unknown>> = [
        {
          id: 'pu_def_existing',
          promotion_id: '11111111-1111-4111-8111-111111111111',
          customer_id: 'cust_fran_v1',
          order_id: '33333333-3333-4333-8333-333333333333',
          discount_amount: 15000,
          tenant_id: 'default',
        },
      ];

      const orders: Array<Record<string, unknown>> = [
        {
          id: '22222222-2222-4222-8222-222222222222',
          customer_id: 'cust_fran_v1',
          status: 'pending',
          total: 100000,
          subtotal: 100000,
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const purchaseOrders: Array<Record<string, unknown>> = [
        {
          id: 'po_fran_v3',
          po_number: 'PO-SADEC-V3',
          supplier_id: 'sup_fran_1',
          status: 'ordered',
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const ingredients: Array<Record<string, unknown>> = [
        {
          id: 'ing_def_v3',
          name: 'Default Coffee Beans',
          current_stock: 100,
          tenant_id: 'default',
        },
        {
          id: 'ing_fran_v3',
          name: 'SaDec Coffee Beans',
          current_stock: 40,
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const stockMovements: Array<Record<string, unknown>> = [];
      const inventoryTransactions: Array<Record<string, unknown>> = [];

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          const makeStmt = (args: unknown[]) => ({
            bind: (...b: unknown[]) => makeStmt(b),
            first: async () => {
              if (/FROM customers WHERE id = \?/i.test(sql)) {
                const cid = String(args[0]);
                const cust = customers.find((c) => c.id === cid) || null;
                if (cust && /TRIM\(tenant_id\)/i.test(sql) && args[1]) {
                  if (String(cust.tenant_id || 'default').trim() !== String(args[1])) return null;
                }
                return cust;
              }
              if (/FROM rewards WHERE id = \?/i.test(sql)) {
                return null;
              }
              if (/FROM loyalty_rewards WHERE id = \?/i.test(sql)) {
                const rid = String(args[0]);
                const r = loyaltyRewards.find((rw) => rw.id === rid) || null;
                if (!r) return null;
                return {
                  id: r.id,
                  title: r.name,
                  point_cost: r.points_cost,
                  ...(sql.includes('tenant_id') ? { tenant_id: r.tenant_id } : {}),
                };
              }
              if (/FROM cashback_wallets WHERE customer_id = \?/i.test(sql)) {
                return { id: 'wal_fran_v1', customer_id: args[0], balance: 25000, total_earned: 25000, total_spent: 0, tenant_id: 'tenant_sadec_02' };
              }
              if (/FROM referral_codes WHERE customer_id = \?/i.test(sql)) {
                const cid = String(args[0]);
                return referralCodes.find((rc) => rc.customer_id === cid) || null;
              }
              if (/FROM referral_codes WHERE code = \?/i.test(sql)) {
                const code = String(args[0]);
                return referralCodes.find((rc) => rc.code === code) || null;
              }
              if (/FROM referrals WHERE referred_customer_id = \?/i.test(sql)) {
                const cid = String(args[0]);
                return referrals.find((r) => r.referred_customer_id === cid) || null;
              }
              if (/FROM promotions WHERE id = \?/i.test(sql)) {
                const pid = String(args[0]);
                return promotions.find((p) => p.id === pid) || null;
              }
              if (/SELECT COUNT\(\*\) as cnt FROM promotion_usages WHERE promotion_id = \? AND customer_id = \?/i.test(sql)) {
                const pid = String(args[0]);
                const cid = String(args[1]);
                const tid = args[2] ? String(args[2]) : undefined;
                const cnt = promotionUsages.filter(
                  (u) => u.promotion_id === pid && u.customer_id === cid && (!tid || String(u.tenant_id || 'default').trim() === tid)
                ).length;
                return { cnt };
              }
              if (/FROM orders WHERE id = \?/i.test(sql)) {
                return orders.find((o) => o.id === String(args[0])) || null;
              }
              if (/FROM promotion_usages WHERE order_id = \?/i.test(sql)) {
                return null;
              }
              if (/FROM purchase_orders WHERE id = \?/i.test(sql)) {
                return purchaseOrders.find((po) => po.id === String(args[0])) || null;
              }
              if (/FROM ingredients WHERE id = \?/i.test(sql)) {
                return ingredients.find((i) => i.id === String(args[0])) || null;
              }
              return null;
            },
            all: async () => {
              if (/FROM rewards ORDER BY/i.test(sql)) {
                return { results: [] };
              }
              if (/FROM loyalty_rewards WHERE is_active = 1/i.test(sql)) {
                return {
                  results: loyaltyRewards.map((r) => ({
                    id: r.id,
                    title: r.name,
                    point_cost: r.points_cost,
                    description: r.description,
                    discount_type: r.type,
                    discount_value: r.value,
                    is_active: r.is_active,
                    ...(sql.includes('tenant_id') ? { tenant_id: r.tenant_id } : {}),
                  })),
                };
              }
              if (/SELECT COUNT\(\*\) as cnt FROM user_rewards/i.test(sql)) {
                const cid = String(args[0]);
                const tid = args[1] ? String(args[1]) : undefined;
                const cnt = userRewards.filter(
                  (ur) => ur.customer_id === cid && ur.status === 'active' && (!tid || String(ur.tenant_id || 'default').trim() === tid)
                ).length;
                return { results: [{ cnt }] };
              }
              if (/FROM user_rewards ur LEFT JOIN rewards r/i.test(sql)) {
                const cid = String(args[0]);
                return {
                  results: userRewards
                    .filter((ur) => ur.customer_id === cid)
                    .map((ur) => {
                      const lr = loyaltyRewards.find((rw) => rw.id === ur.reward_id);
                      return {
                        ...ur,
                        title: lr?.name || 'Reward',
                        discount_type: lr?.type || 'free_item',
                        discount_value: lr?.value || 0,
                        r_tenant_id: null,
                        lr_tenant_id: lr?.tenant_id ?? null,
                      };
                    }),
                };
              }
              if (/FROM loyalty_point_logs WHERE customer_id = \?/i.test(sql)) {
                const cid = String(args[0]);
                return { results: loyaltyPointLogs.filter((l) => l.customer_id === cid) };
              }
              if (/SELECT COUNT\(\*\) as cnt FROM referrals WHERE referrer_id = \?/i.test(sql)) {
                const cid = String(args[0]);
                const tid = args[1] ? String(args[1]) : undefined;
                const cnt = referrals.filter(
                  (r) => r.referrer_id === cid && (!tid || String(r.tenant_id || 'default').trim() === tid)
                ).length;
                return { results: [{ cnt }] };
              }
              if (/SELECT COALESCE\(SUM\(cashback_awarded_vnd\), 0\) as total FROM referrals/i.test(sql)) {
                const cid = String(args[0]);
                const st = String(args[1]);
                const tid = args[2] ? String(args[2]) : undefined;
                const total = referrals
                  .filter((r) => r.referrer_id === cid && r.status === st && (!tid || String(r.tenant_id || 'default').trim() === tid))
                  .reduce((sum, r) => sum + Number(r.cashback_awarded_vnd || 0), 0);
                return { results: [{ total }] };
              }
              if (/FROM referrals r LEFT JOIN customers c/i.test(sql)) {
                const cid = String(args[0]);
                return {
                  results: referrals
                    .filter((r) => r.referrer_id === cid)
                    .map((r) => ({ ...r, referred_name: 'Friend', referred_phone: '0988777666' })),
                };
              }
              if (/FROM purchase_order_items WHERE purchase_order_id = \?/i.test(sql)) {
                return { results: [] };
              }
              return { results: [] };
            },
            run: async () => {
              if (/UPDATE customers SET loyalty_points = loyalty_points - \?/i.test(sql)) {
                const cost = Number(args[0]);
                const cid = String(args[2]);
                const tid = args.length >= 5 ? String(args[3]) : undefined;
                const cust = customers.find((c) => c.id === cid && (!tid || String(c.tenant_id || 'default').trim() === tid));
                if (!cust || Number(cust.loyalty_points || 0) < cost) {
                  return { success: true, meta: { changes: 0 } };
                }
                cust.loyalty_points = Number(cust.loyalty_points) - cost;
                return { success: true, meta: { changes: 1 } };
              }
              if (/INSERT INTO loyalty_point_logs/i.test(sql)) {
                loyaltyPointLogs.push({ id: args[0], customer_id: args[1], points_change: args[2], reason: args[3], tenant_id: 'default' });
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE loyalty_point_logs SET tenant_id = \? WHERE id = \?/i.test(sql)) {
                const row = loyaltyPointLogs.find((l) => l.id === args[1]);
                if (row) row.tenant_id = args[0];
                return { success: true, meta: { changes: 1 } };
              }
              if (/INSERT OR IGNORE INTO loyalty_transactions/i.test(sql)) {
                loyaltyTransactions.push({ id: args[0], customer_id: args[2], tenant_id: 'default' });
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE loyalty_transactions SET tenant_id = \? WHERE id = \?/i.test(sql)) {
                const row = loyaltyTransactions.find((t) => t.id === args[1]);
                if (row) row.tenant_id = args[0];
                return { success: true, meta: { changes: 1 } };
              }
              if (/INSERT INTO user_rewards/i.test(sql)) {
                userRewards.push({ id: args[0], customer_id: args[1], reward_id: args[2], code: args[3], status: 'active', tenant_id: 'default' });
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE user_rewards SET tenant_id = \? WHERE id = \?/i.test(sql)) {
                const row = userRewards.find((u) => u.id === args[1]);
                if (row) row.tenant_id = args[0];
                return { success: true, meta: { changes: 1 } };
              }
              if (/INSERT OR IGNORE INTO loyalty_redemptions/i.test(sql)) {
                loyaltyRedemptions.push({ id: args[0], customer_id: args[1], reward_id: args[2], code: args[3], tenant_id: 'default' });
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE loyalty_redemptions SET tenant_id = \? WHERE id = \?/i.test(sql)) {
                const row = loyaltyRedemptions.find((r) => r.id === args[1]);
                if (row) row.tenant_id = args[0];
                return { success: true, meta: { changes: 1 } };
              }
              if (/INSERT INTO referral_codes/i.test(sql)) {
                referralCodes.push({ id: args[0], customer_id: args[1], code: args[2], times_used: 0, total_points_earned: 0, tenant_id: 'default', created_at: args[3] });
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE referral_codes SET tenant_id = \? WHERE id = \?/i.test(sql)) {
                const row = referralCodes.find((r) => r.id === args[1]);
                if (row) row.tenant_id = args[0];
                return { success: true, meta: { changes: 1 } };
              }
              if (/INSERT INTO referrals/i.test(sql)) {
                referrals.push({ id: args[0], referrer_id: args[1], referred_customer_id: args[2], referral_code: args[3], status: 'pending', cashback_awarded_vnd: args[4], tenant_id: 'default', created_at: args[6] });
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE referrals SET tenant_id = \? WHERE id = \?/i.test(sql)) {
                const row = referrals.find((r) => r.id === args[1]);
                if (row) row.tenant_id = args[0];
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE promotions SET current_uses = COALESCE\(current_uses, 0\) \+ 1/i.test(sql)) {
                const pid = String(args[1]);
                const tid = args[2] ? String(args[2]) : undefined;
                const promo = promotions.find((p) => p.id === pid && (!tid || String(p.tenant_id || 'default').trim() === tid));
                if (!promo) return { success: true, meta: { changes: 0 } };
                promo.current_uses = Number(promo.current_uses || 0) + 1;
                promo.usage_count = Number(promo.usage_count || 0) + 1;
                return { success: true, meta: { changes: 1 } };
              }
              if (/INSERT INTO promotion_usages/i.test(sql)) {
                promotionUsages.push({ id: args[0], promotion_id: args[1], order_id: args[2], customer_id: args[3], discount_amount: args[4], tenant_id: 'default' });
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE promotion_usages SET tenant_id = \? WHERE id = \?/i.test(sql)) {
                const row = promotionUsages.find((u) => u.id === args[1]);
                if (row) row.tenant_id = args[0];
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE purchase_orders SET status = 'received'/i.test(sql)) {
                const po = purchaseOrders.find((p) => p.id === args[1]);
                if (po) po.status = 'received';
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE ingredients SET current_stock = COALESCE\(current_stock,\s*0\)\s*\+\s*\?/i.test(sql)) {
                const ing = ingredients.find((i) => i.id === args[2]);
                if (ing) ing.current_stock = Number(ing.current_stock || 0) + Number(args[0]);
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE ingredients SET current_stock = \?/i.test(sql)) {
                const ing = ingredients.find((i) => i.id === args[2]);
                if (ing) ing.current_stock = Number(args[0]);
                return { success: true, meta: { changes: 1 } };
              }
              if (/INSERT INTO stock_movements/i.test(sql)) {
                stockMovements.push({ id: args[0], ingredient_id: args[1], quantity: args[3], reference_id: args[4], tenant_id: 'default' });
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE stock_movements SET tenant_id = \? WHERE id = \?/i.test(sql)) {
                const row = stockMovements.find((m) => m.id === args[1]);
                if (row) row.tenant_id = args[0];
                return { success: true, meta: { changes: 1 } };
              }
              if (/INSERT OR IGNORE INTO inventory_transactions|INSERT INTO inventory_transactions/i.test(sql)) {
                inventoryTransactions.push({ id: args[0], item_id: args[1], quantity: args[2], reference_id: args[3], tenant_id: 'default' });
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE inventory_transactions SET tenant_id = \? WHERE id = \?/i.test(sql)) {
                const row = inventoryTransactions.find((t) => t.id === args[1]);
                if (row) row.tenant_id = args[0];
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 1 } };
            },
          });
          return makeStmt([]);
        }),
      };

      const franEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'tenant_sadec_02',
      });

      const loyaltyApp = new Hono<{ Bindings: Env }>();
      loyaltyApp.route('/api/loyalty', loyaltyRouter);

      // 1. V1: GET /api/loyalty/rewards returns ONLY 'lr_fran_v1' (filters out 'lr_def_v1' from loyalty_rewards fallback)
      const rewardsRes = await loyaltyApp.fetch(
        new Request('https://api.test/api/loyalty/rewards', {
          headers: { Authorization: `Bearer ${custSadecToken}` },
        }),
        franEnv
      );
      expect(rewardsRes.status).toBe(200);
      const rewardsBody = (await rewardsRes.json()) as { data: Array<{ id: string }> };
      expect(rewardsBody.data.map((r) => r.id)).toEqual(['lr_fran_v1']);

      // V1: POST /api/loyalty/redeem blocks cross-tenant 'lr_def_v1' with 404
      const crossRedeemRes = await loyaltyApp.fetch(
        new Request('https://api.test/api/loyalty/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custSadecToken}` },
          body: JSON.stringify({ reward_id: 'lr_def_v1' }),
        }),
        franEnv
      );
      expect(crossRedeemRes.status).toBe(404);

      // V1: POST /api/loyalty/redeem succeeds on 'lr_fran_v1' and persists tenant_id = 'tenant_sadec_02'
      const validRedeemRes = await loyaltyApp.fetch(
        new Request('https://api.test/api/loyalty/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custSadecToken}` },
          body: JSON.stringify({ reward_id: 'lr_fran_v1' }),
        }),
        franEnv
      );
      expect(validRedeemRes.status).toBe(200);
      expect(customers.find((c) => c.id === 'cust_fran_v1')?.loyalty_points).toBe(350);
      expect(userRewards.find((u) => u.reward_id === 'lr_fran_v1')?.tenant_id).toBe('tenant_sadec_02');
      expect(loyaltyRedemptions.find((r) => r.reward_id === 'lr_fran_v1')?.tenant_id).toBe('tenant_sadec_02');
      expect(loyaltyPointLogs.find((l) => l.reason === 'redeem')?.tenant_id).toBe('tenant_sadec_02');

      // V1: GET /api/loyalty/my-rewards & GET /api/loyalty/points return ONLY 'tenant_sadec_02' rows
      const myRewardsRes = await loyaltyApp.fetch(
        new Request('https://api.test/api/loyalty/my-rewards', {
          headers: { Authorization: `Bearer ${custSadecToken}` },
        }),
        franEnv
      );
      expect(myRewardsRes.status).toBe(200);
      const myRewardsBody = (await myRewardsRes.json()) as { data: Array<{ reward_id: string }> };
      expect(myRewardsBody.data.map((r) => r.reward_id)).toEqual(['lr_fran_v1']);

      const pointsRes = await loyaltyApp.fetch(
        new Request('https://api.test/api/loyalty/points', {
          headers: { Authorization: `Bearer ${custSadecToken}` },
        }),
        franEnv
      );
      expect(pointsRes.status).toBe(200);
      const pointsBody = (await pointsRes.json()) as { data: Array<{ reason: string }> };
      expect(pointsBody.data.map((p) => p.reason)).toEqual(['redeem']);

      // V1: GET /api/loyalty/summary counts active_rewards ONLY for 'tenant_sadec_02' (1, not 2)
      const summaryRes = await loyaltyApp.fetch(
        new Request('https://api.test/api/loyalty/summary', {
          headers: { Authorization: `Bearer ${custSadecToken}` },
        }),
        franEnv
      );
      expect(summaryRes.status).toBe(200);
      const summaryBody = (await summaryRes.json()) as { data: { active_rewards: number } };
      expect(summaryBody.data.active_rewards).toBe(1);

      // 2. V2: Referral code, apply & stats isolate by tenant and persist tenant_id
      const refApp = new Hono<{ Bindings: Env }>();
      refApp.route('/api/referrals', referralRouter);

      const getCodeRes = await refApp.fetch(
        new Request('https://api.test/api/referrals/code', {
          headers: { Authorization: `Bearer ${custSadecToken}` },
        }),
        franEnv
      );
      expect(getCodeRes.status).toBe(200);
      const getCodeBody = (await getCodeRes.json()) as { data: { code: string } };
      expect(getCodeBody.data.code).not.toBe('FNB-DEF001');
      expect(referralCodes.find((rc) => rc.code === getCodeBody.data.code)?.tenant_id).toBe('tenant_sadec_02');

      // Cross-tenant referral code 'FNB-ONLYDF' is rejected with 404
      const applyCrossRefRes = await refApp.fetch(
        new Request('https://api.test/api/referrals/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custSadecToken}` },
          body: JSON.stringify({ code: 'FNB-ONLYDF' }),
        }),
        franEnv
      );
      expect(applyCrossRefRes.status).toBe(404);

      // Same-tenant referral code 'FNB-SADEC1' succeeds even though 'cust_fran_v1' had a 'default' referral ('ref_def_prev')
      const applyValidRefRes = await refApp.fetch(
        new Request('https://api.test/api/referrals/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custSadecToken}` },
          body: JSON.stringify({ code: 'FNB-SADEC1' }),
        }),
        franEnv
      );
      expect(applyValidRefRes.status).toBe(200);
      const newRefRow = referrals.find((r) => r.referral_code === 'FNB-SADEC1');
      expect(newRefRow?.tenant_id).toBe('tenant_sadec_02');

      // GET /api/referrals/stats excludes 'default' referrals ('ref_def_prev') for 'cust_fran_v1' in 'tenant_sadec_02'
      const statsRes = await refApp.fetch(
        new Request('https://api.test/api/referrals/stats', {
          headers: { Authorization: `Bearer ${custSadecToken}` },
        }),
        franEnv
      );
      expect(statsRes.status).toBe(200);
      const statsBody = (await statsRes.json()) as {
        data: { total_referrals: number; total_cashback_earned_vnd: number; recent_referrals: unknown[] };
      };
      expect(statsBody.data.total_referrals).toBe(0);
      expect(statsBody.data.total_cashback_earned_vnd).toBe(0);
      expect(statsBody.data.recent_referrals).toHaveLength(0);

      // 3. V3: OpenAPI POST /api/promotions/use scopes per-customer usage count by tenant and persists tenant_id
      const promoUseApp = new OpenAPIHono<{ Bindings: Env }>();
      promoUseApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'cust_fran_v1', customerId: 'cust_fran_v1', role: 'customer', tenantId: 'tenant_sadec_02' });
        c.set('tenantId' as any, 'tenant_sadec_02');
        await next();
      });
      registerUsageHandlers(promoUseApp);

      const promoUseRes = await promoUseApp.fetch(
        new Request('https://api.test/api/promotions/use', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promotionId: '11111111-1111-4111-8111-111111111111',
            orderId: '22222222-2222-4222-8222-222222222222',
            discountAmount: 15000,
          }),
        }),
        franEnv
      );
      expect(promoUseRes.status).toBe(200);
      const newPromoUsage = promotionUsages.find((u) => u.order_id === '22222222-2222-4222-8222-222222222222');
      expect(newPromoUsage?.tenant_id).toBe('tenant_sadec_02');

      // 4. V3: OpenAPI POST /api/inventory/purchase-orders/{id}/receive enforces PO's effectiveTenant on ingredients even under wildcard admin ('*')
      const poReceiveApp = new OpenAPIHono<{ Bindings: Env }>();
      poReceiveApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'hq-owner', role: 'owner', tenantId: '*' });
        c.set('tenantId' as any, '*');
        await next();
      });
      registerPurchaseOrderHandlers(poReceiveApp);

      const crossIngReceiveRes = await poReceiveApp.fetch(
        new Request('https://api.test/api/inventory/purchase-orders/po_fran_v3/receive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ ingredientId: 'ing_def_v3', receivedQuantity: 10 }],
          }),
        }),
        franEnv
      );
      expect(crossIngReceiveRes.status).toBe(400);
      expect(ingredients.find((i) => i.id === 'ing_def_v3')?.current_stock).toBe(100);

      const validPoReceiveRes = await poReceiveApp.fetch(
        new Request('https://api.test/api/inventory/purchase-orders/po_fran_v3/receive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ ingredientId: 'ing_fran_v3', receivedQuantity: 15 }],
          }),
        }),
        franEnv
      );
      expect(validPoReceiveRes.status).toBe(200);
      expect(ingredients.find((i) => i.id === 'ing_fran_v3')?.current_stock).toBe(55);
      expect(stockMovements[0]?.tenant_id).toBe('tenant_sadec_02');
      expect(inventoryTransactions[0]?.tenant_id).toBe('tenant_sadec_02');
    });
  });

  // =========================================================================
  // Suite 27: Phase W1–W3 — Push Subscriptions & Notifier, Campaign Engine &
  //           Triggers, Cron Order-Checks & Cashback Warnings, Mautic Sync /
  //           Enrollment & Loyalty Bonus Campaigns Multi-Tenant Isolation
  // =========================================================================
  describe('Suite 27: Phase W1–W3 — Push Subscriptions/Notifier, Campaign Engine/Triggers, Cron Handlers, Mautic & Bonus Campaigns Multi-Tenant Isolation', () => {
    it('isolates push_subscriptions & WebPush notifier, campaign_logs & trigger detectors, cron checkOverdueOrders & sendCashbackExpiryWarnings, Mautic enrollment/sync cursor, and bonus_campaigns across tenants (W1–W3)', async () => {
      const { pushRouter } = await import('../../routes/push');
      const { sendPushToCustomer, sendPushToStaff } = await import('../../tree/push/notifier');
      const { deduplicate, logSend } = await import('../../tree/campaigns/campaign-engine');
      const { detectWelcomeCandidates } = await import('../../tree/campaigns/triggers/welcome');
      const { detectBirthdayCandidates: detectTreeBirthday } = await import('../../tree/campaigns/triggers/birthday');
      const { detectWinbackCandidates: detectTreeWinback } = await import('../../tree/campaigns/triggers/winback');
      const { detectPostVisitCandidates } = await import('../../tree/campaigns/triggers/post-visit');
      const { detectCashbackExpiry, markExpiryNotified } = await import('../../tree/campaigns/triggers/cashback-expiry');
      const { runCampaignTriggers } = await import('../../tree/campaigns/cron-handler');
      const { checkOverdueOrders } = await import('../../routes/cron-handlers/order-checks');
      const { sendCashbackExpiryWarnings } = await import('../../routes/cron-handlers/cashback-warnings');
      const { trackEnrollment, isAlreadyEnrolled } = await import('../../tree/mautic/enrollment-tracker');
      const { syncMauticContacts } = await import('../../tree/mautic/contact-sync-cron');
      const { getActiveCampaign } = await import('../../tree/loyalty/campaign');
      const { loyaltyRouter } = await import('../../routes/loyalty');
      const { Hono } = await import('hono');

      const pushSubs: Array<Record<string, unknown>> = [
        {
          id: 'ps_def_1',
          endpoint: 'https://fcm.googleapis.com/fcm/send/def-sub-1',
          p256dh: 'p256_def',
          auth: 'auth_def',
          customer_id: 'cust_def_w1',
          staff_role: 'barista',
          tenant_id: 'default',
          created_at: '2026-11-01T00:00:00.000Z',
        },
        {
          id: 'ps_fran_1',
          endpoint: 'https://fcm.googleapis.com/fcm/send/fran-sub-1',
          p256dh: 'p256_fran',
          auth: 'auth_fran',
          customer_id: 'cust_fran_w1',
          staff_role: 'barista',
          tenant_id: 'tenant_sadec_02',
          created_at: '2026-11-01T00:00:00.000Z',
        },
      ];

      const customers: Array<Record<string, unknown>> = [
        {
          id: 'cust_def_w1',
          name: 'Default Customer W1',
          phone: '0908880001',
          email: 'def_w1@aura.vn',
          zalo: '0908880001',
          loyalty_tier: 'silver',
          loyalty_points: 120,
          tenant_id: 'default',
          last_expiry_warning_at: null,
          updated_at: new Date().toISOString(),
        },
        {
          id: 'cust_fran_w1',
          name: 'SaDec Customer W1',
          phone: '0908880002',
          email: 'fran_w1@aura.vn',
          zalo: '0908880002',
          loyalty_tier: 'gold',
          loyalty_points: 300,
          tenant_id: 'tenant_sadec_02',
          last_expiry_warning_at: null,
          updated_at: new Date().toISOString(),
        },
      ];

      const campaignLogs: Array<Record<string, unknown>> = [
        {
          id: 'cl_def_existing',
          trigger: 'welcome_series',
          campaign_type: 'welcome_series',
          customer_id: 'cust_fran_w1',
          channel: 'zalo',
          template_key: 'welcome_bonus',
          status: 'sent',
          sent_at: new Date().toISOString(),
          tenant_id: 'default',
        },
      ];

      const campaignEnrollments: Array<Record<string, unknown>> = [
        {
          id: 'ce_def_existing',
          customer_id: 'cust_fran_w1',
          campaign_type: 'winback',
          campaign_id: '10',
          created_at: new Date().toISOString(),
          mautic_contact_id: '101',
          status: 'enrolled',
          tenant_id: 'default',
        },
      ];

      const overdueOrders: Array<Record<string, unknown>> = [
        {
          id: 'ord_overdue_def',
          customer_name: 'Default Overdue',
          status: 'pending',
          notes: null,
          tenant_id: 'default',
          created_at: new Date(Date.now() - 30 * 60000).toISOString(),
        },
        {
          id: 'ord_overdue_fran',
          customer_name: 'SaDec Overdue',
          status: 'pending',
          notes: null,
          tenant_id: 'tenant_sadec_02',
          created_at: new Date(Date.now() - 30 * 60000).toISOString(),
        },
      ];

      const bonusCampaigns: Array<Record<string, unknown>> = [
        {
          id: 1,
          code: 'DEF_OPENING',
          name: 'Default Store Bonus',
          description: 'Default only',
          cashback_multiplier: 2,
          signup_bonus_vnd: 20000,
          signup_bonus_cap: 100,
          refer_bonus_vnd: 10000,
          active: 1,
          start_date: '2026-01-01 00:00:00',
          end_date: '2027-12-31 23:59:59',
          tenant_id: 'default',
        },
        {
          id: 2,
          code: 'SADEC_OPENING',
          name: 'SaDec Grand Opening',
          description: 'SaDec only',
          cashback_multiplier: 3,
          signup_bonus_vnd: 30000,
          signup_bonus_cap: 100,
          refer_bonus_vnd: 15000,
          active: 1,
          start_date: '2026-01-01 00:00:00',
          end_date: '2027-12-31 23:59:59',
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];
      const kvStore = new Map<string, string>();

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        sql,
        args,
        bind: (...b: unknown[]) => makeStmt(sql, b),
        first: async () => {
          executedSqls.push({ sql, args });
          if (isAccountLookup(sql)) {
            if (args[0] === 'user-supervisor') return staffAccountRow('supervisor', 'tenant_sadec_02');
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            const cid = String(args[0]);
            const cust = customers.find((c) => c.id === cid) || null;
            if (cust && /TRIM\(tenant_id\)/i.test(sql) && args[1]) {
              if (String(cust.tenant_id || 'default').trim() !== String(args[1])) return null;
            }
            return cust;
          }
          if (/FROM campaign_logs/i.test(sql)) {
            const cid = String(args[0]);
            const trig = String(args[1]);
            const tid = args[3] ? String(args[3]) : undefined;
            const hit = campaignLogs.find(
              (l) =>
                l.customer_id === cid &&
                (l.trigger === trig || l.campaign_type === trig) &&
                (!tid || String(l.tenant_id || 'default').trim() === tid)
            );
            return hit ? { id: hit.id, sent_at: hit.sent_at } : null;
          }
          if (/SELECT 1 FROM campaign_enrollments WHERE customer_id = \?/i.test(sql)) {
            const cid = String(args[0]);
            const ctype = String(args[1]);
            const tid = args[3] ? String(args[3]) : undefined;
            const hit = campaignEnrollments.find(
              (e) =>
                e.customer_id === cid &&
                e.campaign_type === ctype &&
                (!tid || String(e.tenant_id || 'default').trim() === tid)
            );
            return hit ? { 1: 1 } : null;
          }
          if (/FROM bonus_campaigns WHERE active = 1/i.test(sql)) {
            const tid = args[2] ? String(args[2]) : undefined;
            if (tid) {
              return bonusCampaigns.find((b) => String(b.tenant_id || 'default').trim() === tid) || null;
            }
            return bonusCampaigns[bonusCampaigns.length - 1] || null;
          }
          if (/SELECT COUNT\(\*\) as count FROM signup_bonus_log/i.test(sql)) {
            return { count: 5 };
          }
          return null;
        },
        all: async () => {
          executedSqls.push({ sql, args });
          if (/FROM push_subscriptions/i.test(sql)) {
            if (/WHERE customer_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
              const cid = String(args[0]);
              const tid = String(args[1]);
              return {
                results: pushSubs.filter(
                  (s) => s.customer_id === cid && String(s.tenant_id || 'default').trim() === tid
                ),
              };
            }
            if (/WHERE staff_role IS NOT NULL AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
              const tid = String(args[0]);
              return {
                results: pushSubs.filter(
                  (s) => s.staff_role && String(s.tenant_id || 'default').trim() === tid
                ),
              };
            }
            return { results: [...pushSubs] };
          }
          if (/SELECT DISTINCT customer_id FROM campaign_logs/i.test(sql)) {
            const ctype = String(args[0]);
            const tid = /TRIM\(tenant_id\) = \?/i.test(sql) ? String(args[args.length - 1]) : undefined;
            const rows = campaignLogs
              .filter(
                (l) =>
                  l.campaign_type === ctype &&
                  (!tid || String(l.tenant_id || 'default').trim() === tid)
              )
              .map((l) => ({ customer_id: l.customer_id }));
            return { results: rows };
          }
          if (/FROM orders/i.test(sql) && /status IN \('pending', 'confirmed'/i.test(sql)) {
            const tid = args[1] ? String(args[1]) : undefined;
            return {
              results: overdueOrders.filter(
                (o) => !tid || String(o.tenant_id || 'default').trim() === tid
              ),
            };
          }
          if (/FROM cashback_transactions ct\s+JOIN cashback_wallets cw/i.test(sql)) {
            const tid = args[1] && /TRIM\(cw\.tenant_id\)/i.test(sql) ? String(args[1]) : undefined;
            const matchingCustomers = customers.filter(
              (c) => !tid || String(c.tenant_id || 'default').trim() === tid
            );
            return {
              results: matchingCustomers.map((c) => ({
                id: c.id,
                customer_id: c.id,
                name: c.name,
                phone: c.phone,
                email: c.email,
                zalo: c.zalo,
                loyalty_tier: c.loyalty_tier,
                loyalty_points: c.loyalty_points,
                expiring_amount: 15000,
                total_expiring: 15000,
                earliest_expiry: new Date(Date.now() + 3 * 86400000).toISOString(),
              })),
            };
          }
          if (/FROM customers c/i.test(sql)) {
            const tid = /TRIM\(c\.tenant_id\)/i.test(sql)
              ? (args.find((a) => a === 'tenant_sadec_02' || a === 'default') as string | undefined)
              : undefined;
            return {
              results: customers.filter(
                (c) => !tid || String(c.tenant_id || 'default').trim() === tid
              ),
            };
          }
          return { results: [] };
        },
        run: async () => {
          executedSqls.push({ sql, args });
          if (/INSERT INTO push_subscriptions/i.test(sql)) {
            pushSubs.push({
              id: args[0],
              customer_id: args[1],
              endpoint: args[2],
              auth_key: args[3],
              p256dh_key: args[4],
              user_agent: args[5],
              role: args[6],
              created_at: args[7],
              tenant_id: 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE push_subscriptions SET tenant_id = \? WHERE endpoint = \?/i.test(sql)) {
            const sub = pushSubs.find((s) => s.endpoint === args[1]);
            if (sub) sub.tenant_id = args[0];
            return { success: true, meta: { changes: sub ? 1 : 0 } };
          }
          if (/DELETE FROM push_subscriptions WHERE endpoint = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const ep = String(args[0]);
            const tid = String(args[1]);
            const idx = pushSubs.findIndex(
              (s) => s.endpoint === ep && String(s.tenant_id || 'default').trim() === tid
            );
            if (idx >= 0) pushSubs.splice(idx, 1);
            return { success: true, meta: { changes: idx >= 0 ? 1 : 0 } };
          }
          if (/INSERT INTO campaign_logs/i.test(sql)) {
            campaignLogs.push({
              id: args[0],
              customer_id: args[1],
              trigger: args[2],
              campaign_type: args[2],
              channel: args[3],
              sent_at: args[4],
              status: args[5],
              error: args[6],
              tenant_id: 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE campaign_logs SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = campaignLogs.find((l) => l.id === args[1]);
            if (row) row.tenant_id = args[0];
            return { success: true, meta: { changes: row ? 1 : 0 } };
          }
          if (/INSERT INTO campaign_enrollments/i.test(sql)) {
            campaignEnrollments.push({
              id: args[0],
              customer_id: args[1],
              campaign_type: args[2],
              campaign_id: args[3],
              created_at: args[4],
              mautic_contact_id: args[5],
              status: args[6],
              tenant_id: 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE campaign_enrollments SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = campaignEnrollments.find((e) => e.id === args[1]);
            if (row) row.tenant_id = args[0];
            return { success: true, meta: { changes: row ? 1 : 0 } };
          }
          if (/UPDATE customers SET last_expiry_warning_at = \? WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const ts = String(args[0]);
            const cid = String(args[1]);
            const tid = String(args[2]);
            const cust = customers.find((c) => c.id === cid && String(c.tenant_id || 'default').trim() === tid);
            if (cust) cust.last_expiry_warning_at = ts;
            return { success: true, meta: { changes: cust ? 1 : 0 } };
          }
          return { success: true, meta: { changes: 1 } };
        },
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => makeStmt(sql, [])),
        batch: vi.fn(async (stmts: Array<{ sql: string; args: unknown[]; run: () => Promise<unknown> }>) => {
          for (const s of stmts) {
            if (/UPDATE orders SET notes =/i.test(s.sql)) {
              executedSqls.push({ sql: s.sql, args: s.args });
              const oid = String(s.args[3]);
              const tid = s.args[4] ? String(s.args[4]) : undefined;
              const ord = overdueOrders.find(
                (o) => o.id === oid && (!tid || String(o.tenant_id || 'default').trim() === tid)
              );
              if (ord) ord.notes = '[OVERDUE]';
            } else if (typeof s.run === 'function') {
              await s.run();
            } else {
              executedSqls.push({ sql: s.sql, args: s.args });
            }
          }
          return [];
        }),
      };

      const franEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'tenant_sadec_02',
        AUTH_KV: {
          get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
          put: vi.fn(async (k: string, v: string) => {
            kvStore.set(k, v);
          }),
        } as any,
      });

      // 1. W1: Push routes & WebPush notifier multi-tenant isolation
      const pushApp = new Hono<{ Bindings: Env }>();
      pushApp.route('/api/push', pushRouter);

      const listSubsRes = await pushApp.fetch(
        await authRequest('GET', '/api/push/list-subscriptions', 'supervisor', 'tenant_sadec_02'),
        franEnv
      );
      expect(listSubsRes.status).toBe(200);
      const listSubsBody = (await listSubsRes.json()) as { subscriptions: Array<{ endpoint: string }> };
      expect(listSubsBody.subscriptions.map((s) => s.endpoint)).toEqual([
        'https://fcm.googleapis.com/fcm/send/fran-sub-1',
      ]);

      // Unauthenticated POST /subscribe with cross-tenant customer_id ('cust_def_w1') is rejected with 400 and never inserted
      const crossSubRes = await pushApp.fetch(
        new Request('https://api.test/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_sadec_02' },
          body: JSON.stringify({
            endpoint: 'https://fcm.googleapis.com/fcm/send/cross-attempt',
            p256dh_key: 'k1_p256dh_valid_key',
            auth_key: 'a1_auth_valid_key',
            customer_id: 'cust_def_w1',
          }),
        }),
        franEnv
      );
      expect(crossSubRes.status).toBe(400);
      expect(pushSubs.some((s) => String(s.endpoint).endsWith('cross-attempt'))).toBe(false);

      // Valid POST /subscribe for 'cust_fran_w1' persists tenant_id = 'tenant_sadec_02'
      const validSubRes = await pushApp.fetch(
        new Request('https://api.test/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_sadec_02' },
          body: JSON.stringify({
            endpoint: 'https://fcm.googleapis.com/fcm/send/fran-sub-2',
            p256dh_key: 'k2_p256dh_valid_key',
            auth_key: 'a2_auth_valid_key',
            customer_id: 'cust_fran_w1',
          }),
        }),
        franEnv
      );
      expect([200, 201]).toContain(validSubRes.status);
      expect(pushSubs.find((s) => String(s.endpoint).endsWith('fran-sub-2'))?.tenant_id).toBe('tenant_sadec_02');

      // DELETE /subscribe from 'tenant_sadec_02' cannot delete 'default' endpoint
      await pushApp.fetch(
        new Request('https://api.test/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_sadec_02' },
          body: JSON.stringify({ endpoint: 'https://fcm.googleapis.com/fcm/send/def-sub-1' }),
        }),
        franEnv
      );
      expect(pushSubs.some((s) => s.id === 'ps_def_1')).toBe(true);

      // Notifier sendPushToCustomer & sendPushToStaff scope queries by tenant_id
      executedSqls.length = 0;
      await sendPushToCustomer(
        { ...franEnv, VAPID_PUBLIC_KEY: undefined } as any,
        'cust_fran_w1',
        { title: 'Test', body: 'Hello' },
        'tenant_sadec_02'
      );
      await sendPushToStaff(
        { ...franEnv, VAPID_PUBLIC_KEY: undefined } as any,
        { title: 'Staff', body: 'Order' },
        undefined,
        'tenant_sadec_02'
      );

      // 2. W2: Campaign deduplicate, logSend, trigger detectors & cron-handler tenant isolation
      // Even though 'cust_fran_w1' has a 'default' welcome_series row in campaign_logs, deduplicate for 'tenant_sadec_02' returns false (not sent in this tenant)!
      const alreadySentFran = await deduplicate(mockDb as any, 'cust_fran_w1', 'welcome_series' as any, 3650, 'tenant_sadec_02');
      expect(alreadySentFran).toBe(false);

      await logSend(
        mockDb as any,
        {
          customer_id: 'cust_fran_w1',
          trigger: 'welcome_series' as any,
          channel: 'zalo',
          sent: true,
        },
        'tenant_sadec_02'
      );
      const insertedLog = campaignLogs.find((l) => l.id !== 'cl_def_existing');
      expect(insertedLog?.tenant_id).toBe('tenant_sadec_02');

      // Now deduplicate for 'tenant_sadec_02' returns true (already sent in 'tenant_sadec_02')
      const alreadySentAfterLog = await deduplicate(mockDb as any, 'cust_fran_w1', 'welcome_series' as any, 3650, 'tenant_sadec_02');
      expect(alreadySentAfterLog).toBe(true);

      // Trigger detectors emit tenant-scoped SQL when tenantId='tenant_sadec_02'
      executedSqls.length = 0;
      await detectWelcomeCandidates(mockDb as any, 'tenant_sadec_02');
      await detectTreeBirthday(mockDb as any, 'tenant_sadec_02');
      await detectTreeWinback(mockDb as any, 'tenant_sadec_02');
      await detectPostVisitCandidates(mockDb as any, 'tenant_sadec_02');
      await detectCashbackExpiry(mockDb as any, 'tenant_sadec_02');
      await markExpiryNotified(mockDb as any, ['cust_fran_w1'], 'tenant_sadec_02');
      expect(
        executedSqls.filter((q) => q.sql.includes("COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?")).length
      ).toBeGreaterThanOrEqual(4);
      expect(customers.find((c) => c.id === 'cust_fran_w1')?.last_expiry_warning_at).not.toBeNull();
      expect(customers.find((c) => c.id === 'cust_def_w1')?.last_expiry_warning_at).toBeNull();

      // runCampaignTriggers resolves tenantId from PILOT_TENANT_ID ('tenant_sadec_02') and tags all new campaign_logs with 'tenant_sadec_02'
      const cronRes = await runCampaignTriggers(franEnv as any);
      expect(cronRes.triggered).toBeGreaterThan(0);
      expect(
        campaignLogs.filter((l) => l.id !== 'cl_def_existing').every((l) => l.tenant_id === 'tenant_sadec_02')
      ).toBe(true);

      // 3. W3: Cron checkOverdueOrders & sendCashbackExpiryWarnings, Mautic enrollment/sync, and Loyalty getActiveCampaign
      await checkOverdueOrders(franEnv as any);
      expect(overdueOrders.find((o) => o.id === 'ord_overdue_fran')?.notes).toBe('[OVERDUE]');
      expect(overdueOrders.find((o) => o.id === 'ord_overdue_def')?.notes).toBeNull();

      customers.find((c) => c.id === 'cust_fran_w1')!.last_expiry_warning_at = null;
      const warnRes = await sendCashbackExpiryWarnings(franEnv as any);
      expect(warnRes.notified).toBe(1);
      expect(customers.find((c) => c.id === 'cust_fran_w1')?.last_expiry_warning_at).not.toBeNull();
      expect(customers.find((c) => c.id === 'cust_def_w1')?.last_expiry_warning_at).toBeNull();

      // Mautic isAlreadyEnrolled & trackEnrollment isolate by tenantId
      const enrolledInFranBefore = await isAlreadyEnrolled(mockDb as any, 'cust_fran_w1', 'winback', 30, 'tenant_sadec_02');
      expect(enrolledInFranBefore).toBe(false);
      await trackEnrollment(mockDb as any, 'cust_fran_w1', 'winback', '10', 202, 'enrolled', 'tenant_sadec_02');
      const enrolledInFranAfter = await isAlreadyEnrolled(mockDb as any, 'cust_fran_w1', 'winback', 30, 'tenant_sadec_02');
      expect(enrolledInFranAfter).toBe(true);

      // Mautic syncMauticContacts scopes KV cursor key to 'mautic_last_sync_ts:tenant_sadec_02' when customers list is empty
      executedSqls.length = 0;
      const emptyFranEnv = {
        ...franEnv,
        MAUTIC_BASE_URL: 'https://mautic.aura.vn',
        MAUTIC_CLIENT_ID: 'cid',
        MAUTIC_CLIENT_SECRET: 'csec',
        AURA_DB: {
          prepare: vi.fn((sql: string) => ({
            bind: (...args: unknown[]) => ({
              all: async () => {
                executedSqls.push({ sql, args });
                return { results: [] };
              },
            }),
          })),
        },
      };
      await syncMauticContacts(emptyFranEnv as any);
      expect(kvStore.has('mautic_last_sync_ts:tenant_sadec_02')).toBe(true);
      expect(kvStore.has('mautic_last_sync_ts')).toBe(false);

      // Loyalty getActiveCampaign & GET /api/loyalty/active-campaign return ONLY 'SADEC_OPENING' for 'tenant_sadec_02'
      const activeFranCampaign = await getActiveCampaign(mockDb as any, 'tenant_sadec_02');
      expect(activeFranCampaign?.code).toBe('SADEC_OPENING');

      const loyaltyApp = new Hono<{ Bindings: Env }>();
      loyaltyApp.route('/api/loyalty', loyaltyRouter);
      const activeCampRes = await loyaltyApp.fetch(
        new Request('https://api.test/api/loyalty/active-campaign'),
        franEnv
      );
      expect(activeCampRes.status).toBe(200);
      const activeCampBody = (await activeCampRes.json()) as { campaign: { code: string } };
      expect(activeCampBody.campaign.code).toBe('SADEC_OPENING');
    });
  });

  // =========================================================================
  // Suite 28: Phase Y1–Y3 — ERPNext Retry Queue & KV BYOK Factory, Payment
  //           Reconciliation Cron, Cal.com Bookings/Webhooks, DinDin Cart /
  //           Checkout / Config, Customer Domain Spine & Pretix Webhook Log
  //           Multi-Tenant Isolation
  // =========================================================================
  describe('Suite 28: Phase Y1–Y3 — ERPNext Queue/KV, Payment Reconcile Cron, Cal.com, DinDin, Customer Spine & Pretix Multi-Tenant Isolation', () => {
    it('isolates ERPNext KV BYOK & retry queue, payment reconciliation cron, Cal.com bookings/webhooks, DinDin cart/config/checkout, customer domain spine, and Pretix webhook logs across tenants (Y1–Y3)', async () => {
      const { createErpnextClientWithKv } = await import('../../erpnext/client/factory');
      const { processErpnextRetryQueue } = await import('../../routes/cron-handlers/erpnext-sync');
      const { runPaymentReconciliation } = await import('../../routes/cron-handlers/payment-reconcile');
      const { createReservationFromBooking } = await import('../../tree/cal-booking/process-booking');
      const { calBookingWebhookRouter } = await import('../../routes/cal-booking-webhook');
      const { dindinRouter } = await import('../../routes/dindin');
      const { registerWebhookHandler } = await import('../../routes/pretix-handlers/webhook-handler');
      const { computeHmacSha256 } = await import('@aura/domain-security');
      const {
        identifyCustomer,
        recordConsent,
        hasActiveConsent,
        recordVisit,
        linkOrder,
      } = await import('@aura/domain-customer');
      const { Hono } = await import('hono');

      const kvStore = new Map<string, string>();
      const erpnextQueue: Array<Record<string, unknown>> = [
        {
          id: 'eq_def_1',
          order_id: 'ord_def_y1',
          doctype: 'Sales Invoice',
          payload: JSON.stringify({ order_id: 'ord_def_y1', tenant_id: 'default', total: 50000 }),
          attempts: 0,
          max_attempts: 5,
          next_retry_at: '2026-01-01T00:00:00.000Z',
          status: 'pending',
          tenant_id: 'default',
          order_tenant_id: 'default',
        },
        {
          id: 'eq_fran_1',
          order_id: 'ord_fran_y1',
          doctype: 'Sales Invoice',
          payload: JSON.stringify({
            order_id: 'ord_fran_y1',
            tenant_id: 'tenant_sadec_02',
            customer_name: 'SaDec Guest',
            items: [{ id: 'item_1', name: 'Cà Phê Muối', quantity: 1, price: 45000 }],
            subtotal: 45000,
            total: 45000,
            payment_method: 'cash',
          }),
          attempts: 0,
          max_attempts: 5,
          next_retry_at: '2026-01-01T00:00:00.000Z',
          status: 'pending',
          tenant_id: 'tenant_sadec_02',
          order_tenant_id: 'tenant_sadec_02',
        },
      ];

      const reconcileCandidates: Array<Record<string, unknown>> = [
        {
          payment_id: 'pay_def_y1',
          order_id: 'ord_def_y1',
          provider_tx_id: '10001',
          amount: 50000,
          status: 'pending',
          order_status: 'pending',
          created_at: new Date(Date.now() - 10 * 60000).toISOString(),
          order_tenant_id: 'default',
        },
        {
          payment_id: 'pay_fran_y1',
          order_id: 'ord_fran_y1',
          provider_tx_id: '20002',
          amount: 45000,
          status: 'pending',
          order_status: 'pending',
          created_at: new Date(Date.now() - 10 * 60000).toISOString(),
          order_tenant_id: 'tenant_sadec_02',
        },
      ];

      const reservations: Array<Record<string, unknown>> = [
        {
          id: 'res_def_existing',
          table_id: 'tbl_def_1',
          customer_name: 'Shared Caller',
          customer_phone: '0905556666',
          guest_count: 4,
          date: '2026-11-10',
          time: '19:00',
          status: 'confirmed',
          cal_booking_uid: 'cal_uid_def_1',
          tenant_id: 'default',
        },
      ];

      const cafeTables: Array<Record<string, unknown>> = [
        { id: 'tbl_def_1', capacity: 4, seats: 4, zone: 'indoor', status: 'available', tenant_id: 'default' },
        { id: 'tbl_fran_1', capacity: 4, seats: 4, zone: 'garden', status: 'available', tenant_id: 'tenant_sadec_02' },
      ];

      const bookings: Array<Record<string, unknown>> = [
        {
          id: 'bk_def_1',
          cal_uid: 'cal_uid_def_1',
          status: 'confirmed',
          tenant_id: 'default',
        },
      ];

      const dindinCarts: Array<Record<string, unknown>> = [];
      const dindinConfigs: Array<Record<string, unknown>> = [
        {
          id: 1,
          config: JSON.stringify({
            menu: {
              sections: [
                {
                  name: 'Drinks',
                  items: [{ id: 'm_def', name: 'Default Latte', price: 35000 }],
                },
              ],
            },
            settings: { store_name: 'Default Store' },
          }),
          tenant_id: 'default',
        },
      ];
      const dindinOrders: Array<Record<string, unknown>> = [];

      const customerIdentities: Array<Record<string, unknown>> = [
        {
          id: 'cid_def_existing',
          customer_id: 'cust_def_y3',
          kind: 'phone',
          value: '0909998888',
          verified: 0,
          source: 'signup',
          tenant_id: 'default',
        },
      ];
      const consents: Array<Record<string, unknown>> = [];
      const visits: Array<Record<string, unknown>> = [];
      const customerEvents: Array<Record<string, unknown>> = [];
      const pretixWebhookLogs: Array<Record<string, unknown>> = [];

      let activeStaffTenant = 'tenant_sadec_02';
      const makeStmt = (sql: string, args: unknown[] = []) => ({
        sql,
        args,
        bind: (...b: unknown[]) => makeStmt(sql, b),
        first: async () => {
          if (isAccountLookup(sql)) {
            return staffAccountRow('manager', activeStaffTenant);
          }
          if (/FROM payments WHERE order_id = \? AND provider = 'payos'/i.test(sql)) {
            const oid = String(args[0]);
            const cand = reconcileCandidates.find((r) => r.order_id === oid);
            if (!cand) return null;
            return {
              id: cand.payment_id,
              order_id: cand.order_id,
              amount: cand.amount,
              status: cand.status,
              provider_tx_id: cand.provider_tx_id,
            };
          }
          if (/SELECT status, payment_status, tenant_id FROM orders WHERE id = \?/i.test(sql)) {
            const oid = String(args[0]);
            const cand = reconcileCandidates.find((r) => r.order_id === oid);
            if (!cand) return null;
            return {
              status: cand.order_status,
              payment_status: 'unpaid',
              tenant_id: cand.order_tenant_id,
            };
          }
          if (/FROM reservations WHERE cal_booking_uid = \?/i.test(sql)) {
            const uid = String(args[0]);
            return reservations.find((r) => r.cal_booking_uid === uid) || null;
          }
          if (/FROM bookings WHERE cal_uid = \?/i.test(sql)) {
            const uid = String(args[0]);
            return bookings.find((b) => b.cal_uid === uid) || null;
          }
          if (/FROM dindin_cart WHERE session_id IN \(\?, \?\)/i.test(sql)) {
            const s1 = String(args[0]);
            const s2 = String(args[1]);
            const tid = String(args[2] || 'default');
            return (
              dindinCarts.find(
                (c) =>
                  (c.session_id === s1 || c.session_id === s2) &&
                  String(c.tenant_id || 'default').trim() === tid
              ) || null
            );
          }
          if (/FROM dindin_cart WHERE session_id = \?/i.test(sql)) {
            const sid = String(args[0]);
            return dindinCarts.find((c) => c.session_id === sid) || null;
          }
          if (/FROM dindin_config/i.test(sql)) {
            const tid = args[0] ? String(args[0]) : 'default';
            return (
              dindinConfigs.find((cfg) => String(cfg.tenant_id || 'default').trim() === tid) || null
            );
          }
          if (/FROM customer_identities WHERE kind = \? AND value = \?/i.test(sql)) {
            const kind = String(args[0]);
            const val = String(args[1]);
            const tid = args[2] ? String(args[2]) : 'default';
            return (
              customerIdentities.find(
                (ci) =>
                  ci.kind === kind &&
                  ci.value === val &&
                  String(ci.tenant_id || 'default').trim() === tid
              ) || null
            );
          }
          if (/FROM consents WHERE customer_id = \? AND purpose = \? AND granted = 1 AND revoked_at IS NULL/i.test(sql)) {
            const cid = String(args[0]);
            const purpose = String(args[1]);
            const tid = args[2] ? String(args[2]) : 'default';
            return (
              consents.find(
                (c) =>
                  c.customer_id === cid &&
                  c.purpose === purpose &&
                  c.granted === 1 &&
                  c.revoked_at === null &&
                  String(c.tenant_id || 'default').trim() === tid
              ) || null
            );
          }
          if (/FROM consents WHERE customer_id = \? AND purpose = \? AND revoked_at IS NULL/i.test(sql)) {
            const cid = String(args[0]);
            const purpose = String(args[1]);
            const tid = args[2] ? String(args[2]) : 'default';
            return (
              consents.find(
                (c) =>
                  c.customer_id === cid &&
                  c.purpose === purpose &&
                  c.revoked_at === null &&
                  String(c.tenant_id || 'default').trim() === tid
              ) || null
            );
          }
          if (/FROM visits WHERE order_id = \?/i.test(sql)) {
            const oid = String(args[0]);
            const tid = args[1] ? String(args[1]) : 'default';
            return (
              visits.find(
                (v) => v.order_id === oid && String(v.tenant_id || 'default').trim() === tid
              ) || null
            );
          }
          if (/FROM customer_events WHERE customer_id = \? AND event_type = 'OrderLinked'/i.test(sql)) {
            const cid = String(args[0]);
            const likeStr = String(args[1]).replace(/%/g, '');
            const tid = args[2] ? String(args[2]) : 'default';
            return (
              customerEvents.find(
                (e) =>
                  e.customer_id === cid &&
                  e.event_type === 'OrderLinked' &&
                  String(e.payload || '').includes(likeStr) &&
                  String(e.tenant_id || 'default').trim() === tid
              ) || null
            );
          }
          return null;
        },
        all: async () => {
          if (/FROM erpnext_sync_queue/i.test(sql)) {
            return { results: [...erpnextQueue] };
          }
          if (/FROM payments p\s+JOIN orders o ON o\.id = p\.order_id/i.test(sql)) {
            return { results: [...reconcileCandidates] };
          }
          if (/FROM reservations WHERE cal_booking_uid = \?/i.test(sql)) {
            const uid = String(args[0]);
            return {
              results: reservations.filter((r) => r.cal_booking_uid === uid),
            };
          }
          if (/FROM cafe_tables/i.test(sql)) {
            const minCap = Number(args[0] || 1);
            return {
              results: cafeTables.filter(
                (t) => Number(t.capacity ?? t.seats ?? 2) >= minCap && String(t.status).toLowerCase() === 'available'
              ),
            };
          }
          return { results: [] };
        },
        run: async () => {
          if (/UPDATE erpnext_sync_queue\s+SET status = 'completed'/i.test(sql)) {
            const qid = String(args[1]);
            const row = erpnextQueue.find((q) => q.id === qid);
            if (row) row.status = 'completed';
            return { success: true, meta: { changes: row ? 1 : 0 } };
          }
          if (/UPDATE erpnext_sync_queue\s+SET status = \?/i.test(sql)) {
            const qid = String(args[args.length - 1]);
            const row = erpnextQueue.find((q) => q.id === qid);
            if (row) row.attempts = Number(args[2]);
            return { success: true, meta: { changes: row ? 1 : 0 } };
          }
          if (/UPDATE payments SET status = 'completed'/i.test(sql)) {
            const pid = String(args[2]);
            const row = reconcileCandidates.find((r) => r.payment_id === pid);
            if (row) row.status = 'completed';
            return { success: true, meta: { changes: row ? 1 : 0 } };
          }
          if (/UPDATE orders SET status = 'confirmed', payment_status = 'paid'/i.test(sql)) {
            const oid = String(args[1]);
            const row = reconcileCandidates.find((r) => r.order_id === oid);
            if (row) row.order_status = 'confirmed';
            return { success: true, meta: { changes: row ? 1 : 0 } };
          }
          if (/INSERT INTO reservations/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            reservations.push({
              id: args[0],
              table_id: args[1],
              customer_name: args[2],
              customer_phone: args[3],
              guest_count: args[4],
              date: args[5],
              time: args[6],
              zone: args[7],
              notes: args[8],
              cal_booking_uid: args[9],
              customer_email: args[10],
              reservation_time: args[11],
              special_requests: args[12],
              status: 'confirmed',
              tenant_id: hasTenantCol ? args[13] : 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE reservations SET status = 'cancelled'/i.test(sql)) {
            const uid = String(args[args.length - 1]);
            let changes = 0;
            for (const r of reservations) {
              if (r.cal_booking_uid === uid) {
                r.status = 'cancelled';
                changes++;
              }
            }
            return { success: true, meta: { changes } };
          }
          if (/UPDATE bookings SET status = 'cancelled'/i.test(sql)) {
            const uid = String(args[args.length - 1]);
            const row = bookings.find((b) => b.cal_uid === uid);
            if (row) row.status = 'cancelled';
            return { success: true, meta: { changes: row ? 1 : 0 } };
          }
          if (/INSERT(?: OR REPLACE)? INTO dindin_cart/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            const sid = String(args[0]);
            const tid = hasTenantCol ? String(args[3]) : 'default';
            const idx = dindinCarts.findIndex((c) => c.session_id === sid);
            const record = {
              session_id: sid,
              raw: args[1],
              cart: args[2],
              tenant_id: tid,
            };
            if (idx >= 0) dindinCarts[idx] = record;
            else dindinCarts.push(record);
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO orders/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            dindinOrders.push({
              id: args[0],
              customer_name: args[1],
              customer_phone: args[2],
              tenant_id: hasTenantCol ? args[8] : 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO dindin_config/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            const tid = hasTenantCol ? String(args[1]) : 'default';
            const idx = dindinConfigs.findIndex(
              (cfg) => String(cfg.tenant_id || 'default').trim() === tid
            );
            const record = {
              id: dindinConfigs.length + 1,
              config: hasTenantCol ? args[0] : args[0],
              tenant_id: tid,
            };
            if (idx >= 0) dindinConfigs[idx] = record;
            else dindinConfigs.push(record);
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE dindin_config SET config = \?/i.test(sql)) {
            const tid = String(args[2] || 'default');
            const row = dindinConfigs.find((cfg) => String(cfg.tenant_id || 'default').trim() === tid);
            if (row) row.config = args[0];
            return { success: true, meta: { changes: row ? 1 : 0 } };
          }
          if (/INSERT INTO customer_identities/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            customerIdentities.push({
              id: args[0],
              customer_id: args[1],
              kind: args[2],
              value: args[3],
              verified: args[4],
              source: args[5],
              tenant_id: hasTenantCol ? args[6] : 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO consents/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            consents.push({
              id: args[0],
              customer_id: args[1],
              purpose: args[2],
              granted: args[3],
              source: args[4],
              policy_version: args[5],
              granted_at: args[6],
              revoked_at: args[7],
              tenant_id: hasTenantCol ? args[8] : 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO visits/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            visits.push({
              id: args[0],
              customer_id: args[1],
              visited_at: args[2],
              channel: args[3],
              order_id: args[4],
              spent: args[5],
              tenant_id: hasTenantCol ? args[6] : 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO customer_events/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            customerEvents.push({
              id: args[0],
              customer_id: args[1],
              event_type: args[2],
              payload: args[3],
              tenant_id: hasTenantCol ? args[4] : 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO pretix_webhook_log/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            pretixWebhookLogs.push({
              notification_id: args[0],
              organizer: args[1],
              event: args[2],
              code: args[3],
              action: args[4],
              payload: args[5],
              tenant_id: hasTenantCol ? args[6] : 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 1 } };
        },
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => makeStmt(sql, [])),
      };

      const mockKv = {
        get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
        put: vi.fn(async (k: string, v: string) => {
          kvStore.set(k, v);
        }),
        delete: vi.fn(async (k: string) => {
          kvStore.delete(k);
        }),
      };

      const franEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'tenant_sadec_02',
        AUTH_KV: mockKv as any,
        CAL_WEBHOOK_SECRET: 'cal_sec_y2',
        PRETIX_WEBHOOK_SECRET: 'pretix_sec_y3',
      });

      // 1. Y1: ERPNext KV BYOK factory isolation & retry queue tenant filtering
      kvStore.set('erpnext:api_url', 'https://erp-default.aura.vn');
      kvStore.set('erpnext:api_key', 'def_key');
      kvStore.set('erpnext:api_secret', 'def_sec');

      // Non-default tenant ('tenant_sadec_02') MUST NOT inherit default tenant's KV BYOK credentials
      const leakedClient = await createErpnextClientWithKv(franEnv as any, 'tenant_sadec_02');
      expect(leakedClient).toBeNull();
      const defaultClient = await createErpnextClientWithKv(franEnv as any, 'default');
      expect(defaultClient).not.toBeNull();

      // Configure tenant-specific BYOK credentials for 'tenant_sadec_02'
      kvStore.set('erpnext:tenant_sadec_02:api_url', 'https://erp-sadec.aura.vn');
      kvStore.set('erpnext:tenant_sadec_02:api_key', 'sadec_key');
      kvStore.set('erpnext:tenant_sadec_02:api_secret', 'sadec_sec');
      const sadecClient = await createErpnextClientWithKv(franEnv as any, 'tenant_sadec_02');
      expect(sadecClient).not.toBeNull();

      // processErpnextRetryQueue processes ONLY 'eq_fran_1' ('tenant_sadec_02') and leaves 'eq_def_1' ('default') untouched
      const queueRes = await processErpnextRetryQueue(
        {
          ...franEnv,
          ERPNEXT_URL: 'https://erp-sadec.aura.vn',
          ERPNEXT_API_KEY: 'sadec_key',
          ERPNEXT_API_SECRET: 'sadec_sec',
        } as any,
        'tenant_sadec_02'
      );
      expect(queueRes.processed).toBe(1);
      expect(erpnextQueue.find((q) => q.id === 'eq_def_1')?.attempts).toBe(0);
      expect(erpnextQueue.find((q) => q.id === 'eq_def_1')?.status).toBe('pending');
      expect(
        (erpnextQueue.find((q) => q.id === 'eq_fran_1')?.attempts as number) > 0 ||
          erpnextQueue.find((q) => q.id === 'eq_fran_1')?.status === 'completed'
      ).toBe(true);

      // Y1: Payment reconciliation cron reconciles ONLY 'pay_fran_y1' ('tenant_sadec_02'), leaving 'pay_def_y1' ('default') pending
      const reconcileReport = await runPaymentReconciliation(
        {
          ...franEnv,
          PAYOS_CLIENT_ID: 'payos_cid',
          PAYOS_API_KEY: 'payos_key',
          PAYOS_CHECKSUM_KEY: 'payos_chk',
        } as any,
        {
          tenantId: 'tenant_sadec_02',
        }
      );
      expect(reconcileReport.processed).toBe(1);
      expect(Object.keys(reconcileReport.outcomes)).toEqual(['pay_fran_y1']);
      expect(reconcileReport.outcomes.pay_def_y1).toBeUndefined();

      // 2. Y2: Cal.com reservation duplicate guard & webhook cancellation tenant isolation
      const calBookingRes = await createReservationFromBooking(
        mockDb as any,
        {
          uid: 'cal_uid_fran_1',
          title: 'Table for 4',
          startTime: '2026-11-10T12:00:00.000Z', // 19:00 ICT (+07:00)
          endTime: '2026-11-10T13:30:00.000Z',
          attendees: [{ name: 'Shared Caller', email: 'caller@sadec.vn', phone: '0905556666' }],
        },
        'tenant_sadec_02'
      );
      expect('error' in calBookingRes).toBe(false);
      if (!('error' in calBookingRes)) {
        expect(calBookingRes.status).toBe('confirmed');
        expect(calBookingRes.table_id).toBe('tbl_fran_1');
      }
      const franReservation = reservations.find((r) => r.cal_booking_uid === 'cal_uid_fran_1');
      expect(franReservation?.tenant_id).toBe('tenant_sadec_02');
      bookings.push({
        id: 'bk_fran_1',
        cal_uid: 'cal_uid_fran_1',
        status: 'confirmed',
        tenant_id: 'tenant_sadec_02',
      });

      const calApp = new Hono<{ Bindings: Env }>();
      calApp.route('/api/webhooks/cal', calBookingWebhookRouter);

      // Cross-tenant BOOKING_CANCELLED for 'cal_uid_def_1' from 'tenant_sadec_02' is rejected with 404
      const crossCalCancelRes = await calApp.fetch(
        new Request('https://api.test/api/webhooks/cal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cal-webhook-secret': 'cal_sec_y2',
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: JSON.stringify({
            triggerEvent: 'BOOKING_CANCELLED',
            createdAt: new Date().toISOString(),
            payload: {
              uid: 'cal_uid_def_1',
              title: 'Default Table',
              startTime: '2026-11-10T12:00:00.000Z',
              endTime: '2026-11-10T13:00:00.000Z',
              attendees: [{ name: 'Shared Caller', email: 'caller@def.vn', timeZone: 'Asia/Ho_Chi_Minh' }],
              organizer: { name: 'AURA', email: 'host@aura.vn' },
              location: 'Default Store',
            },
          }),
        }),
        franEnv
      );
      expect(crossCalCancelRes.status).toBe(404);
      expect(reservations.find((r) => r.id === 'res_def_existing')?.status).toBe('confirmed');

      // Same-tenant BOOKING_CANCELLED for 'cal_uid_fran_1' from 'tenant_sadec_02' succeeds (200)
      const validCalCancelRes = await calApp.fetch(
        new Request('https://api.test/api/webhooks/cal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cal-webhook-secret': 'cal_sec_y2',
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: JSON.stringify({
            triggerEvent: 'BOOKING_CANCELLED',
            createdAt: new Date().toISOString(),
            payload: {
              uid: 'cal_uid_fran_1',
              title: 'SaDec Table',
              startTime: '2026-11-10T12:00:00.000Z',
              endTime: '2026-11-10T13:00:00.000Z',
              attendees: [{ name: 'Shared Caller', email: 'caller@sadec.vn', timeZone: 'Asia/Ho_Chi_Minh' }],
              organizer: { name: 'AURA', email: 'host@aura.vn' },
              location: 'AURA Sa Đéc',
            },
          }),
        }),
        franEnv
      );
      expect(validCalCancelRes.status).toBe(200);
      expect(franReservation?.status).toBe('cancelled');

      // 3. Y2: DinDin config, cart, and checkout tenant isolation
      const dindinApp = new Hono<{ Bindings: Env }>();
      dindinApp.route('/api/dindin', dindinRouter);

      // PUT /api/dindin/config isolates config by tenant
      activeStaffTenant = 'tenant_sadec_02';
      const putCfgRes = await dindinApp.fetch(
        await authRequest('PUT', '/api/dindin/config', 'manager', 'tenant_sadec_02', {
          menu: {
            sections: [
              {
                name: 'Drinks',
                items: [{ id: 'm1', name: 'Trà Sen', price: 40000 }],
              },
            ],
          },
          settings: {
            store_id: 'store_sadec_02',
            store_name: 'AURA Sa Đéc',
          },
        }),
        franEnv
      );
      expect(putCfgRes.status).toBe(200);
      expect(kvStore.has('dindin:tenant_sadec_02:config')).toBe(true);
      expect(dindinConfigs.find((cfg) => cfg.tenant_id === 'tenant_sadec_02')).toBeDefined();
      expect(
        JSON.parse(String(dindinConfigs.find((cfg) => cfg.tenant_id === 'default')?.config || '{}'))?.settings?.store_name
      ).toBe('Default Store');

      // PATCH /api/dindin/cart/:sessionId adds item into tenant-scoped KV & D1
      const patchCartRes = await dindinApp.fetch(
        await authRequest('PATCH', '/api/dindin/cart/sess_fran_y2', 'manager', 'tenant_sadec_02', {
          action: 'add',
          item: { id: 'm1', name: 'Trà Sen', price: 40000, qty: 2 },
        }),
        franEnv
      );
      expect(patchCartRes.status).toBe(200);
      expect(kvStore.has('dindin:tenant_sadec_02:cart:sess_fran_y2')).toBe(true);
      expect(kvStore.has('dindin:cart:sess_fran_y2')).toBe(false);
      expect(
        dindinCarts.find((c) => c.session_id === 'tenant_sadec_02::sess_fran_y2')?.tenant_id
      ).toBe('tenant_sadec_02');

      // GET /api/dindin/cart/:sessionId under 'default' tenant for 'sess_fran_y2' returns empty cart
      const defEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'default',
        AUTH_KV: mockKv as any,
      });
      activeStaffTenant = 'default';
      const getDefCartRes = await dindinApp.fetch(
        await authRequest('GET', '/api/dindin/cart/sess_fran_y2', 'manager', 'default'),
        defEnv
      );
      expect(getDefCartRes.status).toBe(200);
      const getDefCartBody = (await getDefCartRes.json()) as { data: { items: unknown[] } };
      expect(getDefCartBody.data.items).toHaveLength(0);

      // POST /api/dindin/checkout under 'tenant_sadec_02' creates tenant-tagged order & idempotency key
      activeStaffTenant = 'tenant_sadec_02';
      const checkoutReq = await authRequest('POST', '/api/dindin/checkout', 'manager', 'tenant_sadec_02', {
        sessionId: 'sess_fran_y2',
        payment_method: 'cod',
      });
      checkoutReq.headers.set('Idempotency-Key', 'idem_y2_1');
      const checkoutRes = await dindinApp.fetch(checkoutReq, franEnv);
      expect(checkoutRes.status).toBe(200);
      expect(kvStore.has('dindin:tenant_sadec_02:idempotency:idem_y2_1')).toBe(true);
      expect(dindinOrders[0]?.tenant_id).toBe('tenant_sadec_02');

      // 4. Y3: Customer domain spine (identifyCustomer, recordConsent, hasActiveConsent, recordVisit, linkOrder) & Pretix webhook log
      const idRes = await identifyCustomer({
        db: mockDb as any,
        customerId: 'cust_fran_y3',
        phone: '0909998888',
        source: 'signup',
        tenantId: 'tenant_sadec_02',
      });
      expect(idRes).not.toBeNull();
      expect(idRes?.created).toBe(true);
      expect(
        customerIdentities.find((ci) => ci.customer_id === 'cust_fran_y3')?.tenant_id
      ).toBe('tenant_sadec_02');

      const consentRes = await recordConsent({
        db: mockDb as any,
        customerId: 'cust_fran_y3',
        purpose: 'crm',
        granted: true,
        source: 'signup',
        tenantId: 'tenant_sadec_02',
      });
      expect(consentRes.ok).toBe(true);
      expect(await hasActiveConsent(mockDb as any, 'cust_fran_y3', 'crm', 'tenant_sadec_02')).toBe(true);
      expect(await hasActiveConsent(mockDb as any, 'cust_fran_y3', 'crm', 'default')).toBe(false);

      const visitRes = await recordVisit({
        db: mockDb as any,
        customerId: 'cust_fran_y3',
        orderId: 'ord_fran_y3',
        spent: 65000,
        tenantId: 'tenant_sadec_02',
      });
      expect(visitRes.ok).toBe(true);
      expect(visitRes.created).toBe(true);
      expect(visits[0]?.tenant_id).toBe('tenant_sadec_02');

      const linkRes = await linkOrder({
        db: mockDb as any,
        customerId: 'cust_fran_y3',
        orderId: 'ord_fran_y3',
        total: 65000,
        tenantId: 'tenant_sadec_02',
      });
      expect(linkRes.ok).toBe(true);
      expect(linkRes.created).toBe(true);
      expect(
        customerEvents.filter((e) => e.customer_id === 'cust_fran_y3').every((e) => e.tenant_id === 'tenant_sadec_02')
      ).toBe(true);

      // Pretix webhook handler logs tenant_id = 'tenant_sadec_02'
      const pretixApp = new Hono<{ Bindings: Env }>();
      registerWebhookHandler(pretixApp as any);
      const pretixPayload = JSON.stringify({
        notification_id: 777,
        organizer: 'aura',
        event: 'workshop-sadec',
        code: 'ORD99',
        action: 'pretix.event.order.paid',
      });
      const sig = await computeHmacSha256(pretixPayload, 'pretix_sec_y3');
      const pretixRes = await pretixApp.fetch(
        new Request('https://api.test/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-pretix-Signature': sig,
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: pretixPayload,
        }),
        franEnv
      );
      expect(pretixRes.status).toBe(200);
      expect(pretixWebhookLogs[0]?.tenant_id).toBe('tenant_sadec_02');
    });
  });

  // =========================================================================
  // Suite 29: Phase Z1–Z3 — ERPNext Invoices/Accounting & Product/POS Sync,
  //           Zalo Webhook Dedup & ZNS Audit Logs, Mautic Enrollment Isolation,
  //           and Standalone Reviews / Mobile Tables Multi-Tenant Hardening
  // =========================================================================
  describe('Suite 29: Phase Z1–Z3 — ERPNext Invoices/POS, Zalo Dedup/ZNS, Mautic Enrollment & Reviews/Tables Multi-Tenant Isolation', () => {
    it('isolates ERPNext accounting KV BYOK, unmapped invoice fail-closed, product sync PK namespacing, POS webhook logs, Zalo msg_id dedup, ZNS audit logs, Mautic default-vs-tenant enrollment, standalone reviews, and mobile table updates across tenants (Z1–Z3)', async () => {
      const { createErpnextAccountingClientWithKv } = await import('../../clients/erpnext-accounting-client');
      const { ErpnextClient } = await import('../../clients/erpnext-client');
      const { ErpnextProductClient } = await import('../../clients/erpnext-product-client');
      const { handleErpnextInvoicesRequest } = await import('../../routes/erpnext-invoices');
      const { handleErpnextPosRequest } = await import('../../routes/erpnext-pos');
      const { zaloWebhookRouter } = await import('../../routes/zalo-webhook');
      const { sendZNS } = await import('../../tree/zalo/zns-sender');
      const { isAlreadyEnrolled } = await import('../../tree/mautic/enrollment-tracker');
      const { reviewsRouter } = await import('../../routes/reviews');
      const { updateTableStatus } = await import('../../routes/tables-mobile');
      const { Hono } = await import('hono');

      const kvStore = new Map<string, string>();
      const cacheKvStore = new Map<string, string>();
      const erpnextMappings: Array<Record<string, unknown>> = [
        {
          local_type: 'order',
          local_id: 'ord_def_z1',
          erpnext_doctype: 'Sales Invoice',
          erpnext_name: 'SINV-DEF-001',
          synced_at: '2026-11-02T00:00:00.000Z',
          tenant_id: 'default',
          order_tenant_id: 'default',
        },
        {
          local_type: 'order',
          local_id: 'ord_fran_standalone_z1',
          erpnext_doctype: 'Sales Invoice',
          erpnext_name: 'SINV-FRAN-001',
          synced_at: '2026-11-02T01:00:00.000Z',
          tenant_id: 'tenant_sadec_02',
          order_tenant_id: null,
        },
      ];
      const erpnextProductMappings: Array<Record<string, unknown>> = [];
      const erpnextWebhookLogs: Array<Record<string, unknown>> = [];
      const notificationAuditLogs: Array<Record<string, unknown>> = [];
      const campaignEnrollments: Array<Record<string, unknown>> = [
        {
          id: 'ce_fran_only_z2',
          customer_id: 'cust_shared_z2',
          campaign_type: 'winback',
          campaign_id: 'camp_1',
          created_at: new Date().toISOString(),
          mautic_contact_id: '501',
          status: 'enrolled',
          tenant_id: 'tenant_sadec_02',
        },
      ];
      const reviews: Array<Record<string, unknown>> = [
        {
          id: 'rev_def_z3',
          order_id: '',
          rating: 2,
          comment: 'Default store review',
          customer_name: 'Default Reviewer',
          tenant_id: 'default',
          created_at: '2026-11-02T00:00:00.000Z',
        },
      ];
      const cafeTables: Array<Record<string, unknown>> = [
        {
          id: 'tbl_fran_z3',
          table_number: 5,
          name: 'Bàn 5',
          capacity: 4,
          zone: 'Garden',
          status: 'Available',
          tenant_id: 'tenant_sadec_02',
        },
      ];
      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];

      let activeStaffTenant = 'tenant_sadec_02';
      const makeStmt = (sql: string, args: unknown[] = []) => ({
        sql,
        args,
        bind: (...b: unknown[]) => makeStmt(sql, b),
        first: async () => {
          executedSqls.push({ sql, args });
          if (isAccountLookup(sql)) {
            return staffAccountRow('manager', activeStaffTenant);
          }
          if (/FROM erpnext_mappings m LEFT JOIN orders o/i.test(sql) && /WHERE m\.erpnext_name = \?/i.test(sql)) {
            const invId = String(args[0]);
            const hit = erpnextMappings.find((m) => m.erpnext_name === invId);
            if (!hit) return null;
            return {
              tenant_id: hit.tenant_id || hit.order_tenant_id || null,
            };
          }
          if (/SELECT 1 FROM campaign_enrollments WHERE customer_id = \?/i.test(sql)) {
            const cid = String(args[0]);
            const ctype = String(args[1]);
            const tid = /TRIM\(tenant_id\)/i.test(sql) ? String(args[3]) : undefined;
            const hit = campaignEnrollments.find(
              (e) =>
                e.customer_id === cid &&
                e.campaign_type === ctype &&
                (!tid || String(e.tenant_id || 'default').trim() === tid)
            );
            return hit ? { 1: 1 } : null;
          }
          if (/SELECT \* FROM reviews WHERE id = \?/i.test(sql)) {
            const rid = String(args[0]);
            return reviews.find((r) => r.id === rid) || null;
          }
          if (/SELECT id, customer_id, tenant_id FROM orders WHERE id = \?/i.test(sql)) {
            if (args[0] === 'ord_fran_z3') {
              return { id: 'ord_fran_z3', customer_id: 'cust_fran_z3', tenant_id: 'tenant_sadec_02' };
            }
            return null;
          }
          if (/SELECT \* FROM cafe_tables WHERE id = \?/i.test(sql)) {
            const tid = String(args[0]);
            return cafeTables.find((t) => t.id === tid) || null;
          }
          return null;
        },
        all: async () => {
          executedSqls.push({ sql, args });
          if (/FROM erpnext_mappings m[\s\S]*LEFT JOIN orders o/i.test(sql) && /WHERE m\.local_type = \?/i.test(sql)) {
            return {
              results: erpnextMappings.map((m) => ({
                local_id: m.local_id,
                erpnext_name: m.erpnext_name,
                synced_at: m.synced_at,
                tenant_id: m.tenant_id || m.order_tenant_id || null,
              })),
            };
          }
          if (/SELECT r\.rating, r\.tenant_id, o\.tenant_id as order_tenant_id FROM reviews r/i.test(sql)) {
            return {
              results: reviews.map((r) => ({
                rating: r.rating,
                tenant_id: r.tenant_id,
                order_tenant_id: null,
              })),
            };
          }
          if (/SELECT r\.\*, o\.tenant_id as order_tenant_id FROM reviews r/i.test(sql)) {
            return {
              results: reviews.map((r) => ({
                ...r,
                order_tenant_id: null,
              })),
            };
          }
          return { results: [] };
        },
        run: async () => {
          executedSqls.push({ sql, args });
          if (/INSERT INTO erpnext_product_sync/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            const pid = String(args[0]);
            const idx = erpnextProductMappings.findIndex((p) => p.product_id === pid);
            const rec = {
              product_id: pid,
              erpnext_item_code: args[1],
              last_synced_at: args[2],
              erpnext_modified: args[3],
              tenant_id: hasTenantCol ? args[4] : 'default',
            };
            if (idx >= 0) erpnextProductMappings[idx] = rec;
            else erpnextProductMappings.push(rec);
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO erpnext_webhook_log/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            erpnextWebhookLogs.push({
              doctype: args[0],
              docname: args[1],
              action: args[2],
              payload: args[3],
              tenant_id: hasTenantCol ? args[4] : 'default',
              created_at: hasTenantCol ? args[5] : args[4],
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO notification_audit_log/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            notificationAuditLogs.push({
              phone: args[0],
              template_key: args[1],
              data: args[2],
              status: args[3],
              response: args[4],
              tenant_id: hasTenantCol ? args[5] : 'default',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO reviews/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            reviews.push({
              id: args[0],
              order_id: args[1] || '',
              rating: args[2],
              comment: args[3],
              customer_name: args[4],
              tenant_id: hasTenantCol ? args[5] : 'default',
              created_at: hasTenantCol ? args[6] : args[5],
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE cafe_tables SET status = \? WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
            const newStatus = String(args[0]);
            const tid = String(args[1]);
            const tenant = String(args[2]);
            const tbl = cafeTables.find(
              (t) => t.id === tid && String(t.tenant_id || 'default').trim() === tenant
            );
            if (tbl) tbl.status = newStatus;
            return { success: true, meta: { changes: tbl ? 1 : 0 } };
          }
          return { success: true, meta: { changes: 1 } };
        },
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => makeStmt(sql, [])),
      };

      const mockKv = {
        get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
        put: vi.fn(async (k: string, v: string) => {
          kvStore.set(k, v);
        }),
        delete: vi.fn(async (k: string) => {
          kvStore.delete(k);
        }),
      };

      const mockCacheKv = {
        get: vi.fn(async (k: string) => cacheKvStore.get(k) ?? null),
        put: vi.fn(async (k: string, v: string) => {
          cacheKvStore.set(k, v);
        }),
      };

      const franEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'tenant_sadec_02',
        ENVIRONMENT: 'test',
        AUTH_KV: mockKv as any,
        CACHE_KV: mockCacheKv as any,
        ERPNEXT_URL: 'https://erp.aura.vn',
        ERPNEXT_API_KEY: 'key_z1',
        ERPNEXT_API_SECRET: 'sec_z1',
      });

      // 1. Z1: createErpnextAccountingClientWithKv isolates KV BYOK per tenant
      const envWithoutGlobalErp = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        AUTH_KV: mockKv as any,
        ERPNEXT_URL: undefined,
        ERPNEXT_API_KEY: undefined,
        ERPNEXT_API_SECRET: undefined,
      });
      kvStore.set('erpnext:api_url', 'https://erp-default.aura.vn');
      kvStore.set('erpnext:api_key', 'def_key');
      kvStore.set('erpnext:api_secret', 'def_sec');

      expect(await createErpnextAccountingClientWithKv(envWithoutGlobalErp as any, 'tenant_sadec_02')).toBeNull();
      expect(await createErpnextAccountingClientWithKv(envWithoutGlobalErp as any, 'default')).not.toBeNull();

      kvStore.set('erpnext:tenant_sadec_02:api_url', 'https://erp-sadec.aura.vn');
      kvStore.set('erpnext:tenant_sadec_02:api_key', 'sadec_key');
      kvStore.set('erpnext:tenant_sadec_02:api_secret', 'sadec_sec');
      expect(await createErpnextAccountingClientWithKv(envWithoutGlobalErp as any, 'tenant_sadec_02')).not.toBeNull();

      // Z1: Unmapped invoice ID fails closed (404) for non-default tenant 'tenant_sadec_02' on /pdf and /vat
      const unmappedInvRes = await handleErpnextInvoicesRequest(
        new Request('https://api.test/api/erpnext-invoices/SINV-UNMAPPED-999/pdf', {
          method: 'GET',
        }),
        franEnv as any,
        'tenant_sadec_02'
      );
      expect(unmappedInvRes.status).toBe(404);

      // Z1: GET /api/erpnext-invoices/list returns standalone mapping with m.tenant_id='tenant_sadec_02' and excludes 'default'
      const listInvRes = await handleErpnextInvoicesRequest(
        new Request('https://api.test/api/erpnext-invoices/list', {
          method: 'GET',
        }),
        franEnv as any,
        'tenant_sadec_02'
      );
      expect(listInvRes.status).toBe(200);
      const listInvBody = (await listInvRes.json()) as { data: Array<{ erpnext_name: string }> };
      expect(listInvBody.data.map((i) => i.erpnext_name)).toEqual(['SINV-FRAN-001']);

      // Z1: ErpnextProductClient.syncProductsToLocal namespaces product_id per tenant to prevent PRIMARY KEY collision
      const baseErpClient = new ErpnextClient({
        url: 'https://erp.aura.vn',
        apiKey: 'k',
        apiSecret: 's',
      });
      const prodClient = new ErpnextProductClient(baseErpClient, {
        AURA_DB: mockDb as any,
        AURA_KV: mockKv as any,
      });

      const changedProducts = [
        {
          name: 'FNB-LATTE-1',
          item_code: 'latte_1',
          item_name: 'Latte',
          modified: '2026-11-02T00:00:00.000Z',
        },
      ];
      await prodClient.syncProductsToLocal({ AURA_DB: mockDb as any }, changedProducts, 'default');
      await prodClient.syncProductsToLocal({ AURA_DB: mockDb as any }, changedProducts, 'tenant_sadec_02');

      expect(erpnextProductMappings).toHaveLength(2);
      expect(erpnextProductMappings.find((p) => p.product_id === 'latte_1')?.tenant_id).toBe('default');
      expect(erpnextProductMappings.find((p) => p.product_id === 'tenant_sadec_02::latte_1')?.tenant_id).toBe('tenant_sadec_02');

      // Z1: POST /api/erpnext-pos/webhook logs tenant_id in erpnext_webhook_log
      const posWebhookPayload = JSON.stringify({
        doctype: 'Item',
        docname: 'FNB-LATTE-1',
        action: 'on_update',
        data: { standard_rate: 48000, disabled: 0 },
      });
      const posWebhookRes = await handleErpnextPosRequest(
        new Request('https://api.test/api/erpnext-pos/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-erpnext-webhook-secret': 'pos_sec_z1',
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: posWebhookPayload,
        }),
        { ...franEnv, ERPNEXT_WEBHOOK_SECRET: 'pos_sec_z1' } as any,
        'tenant_sadec_02'
      );
      expect(posWebhookRes.status).toBe(200);
      expect(erpnextWebhookLogs[0]?.tenant_id).toBe('tenant_sadec_02');

      // 2. Z2: Zalo webhook msg_id deduplication is tenant-namespaced
      const zaloApp = new Hono<{ Bindings: Env }>();
      zaloApp.route('/api/webhooks/zalo', zaloWebhookRouter);

      const defEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'default',
        ENVIRONMENT: 'test',
        AUTH_KV: mockKv as any,
        CACHE_KV: mockCacheKv as any,
      });

      const zaloPayload = JSON.stringify({
        event_name: 'user_send_text',
        sender: { id: 'zalo_u1' },
        message: { msg_id: 'msg_shared_z2', text: 'menu' },
      });

      const zaloDefRes = await zaloApp.fetch(
        new Request('https://api.test/api/webhooks/zalo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: zaloPayload,
        }),
        defEnv
      );
      expect(zaloDefRes.status).toBe(200);
      expect(kvStore.has('zalo_msg:msg_shared_z2')).toBe(true);

      // Same msg_id sent to 'tenant_sadec_02' is NOT skipped as duplicate
      const zaloFranRes = await zaloApp.fetch(
        new Request('https://api.test/api/webhooks/zalo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: zaloPayload,
        }),
        franEnv
      );
      expect(zaloFranRes.status).toBe(200);
      const zaloFranBody = (await zaloFranRes.json()) as { deduplicated?: boolean };
      expect(zaloFranBody.deduplicated).toBeUndefined();
      expect(kvStore.has('zalo_msg:tenant_sadec_02:msg_shared_z2')).toBe(true);

      // Z2: sendZNS records tenant_id in notification_audit_log
      const { TEMPLATE_IDS } = await import('../../tree/zalo/zns-templates');
      const prevTpl = TEMPLATE_IDS.welcome_signup;
      TEMPLATE_IDS.welcome_signup = 'ZNS_TPL_TEST_01';
      try {
        await sendZNS(
          { AURA_DB: mockDb as any, ZALO_ACCESS_TOKEN: 'zalo_tok_z2' },
          {
            phone: '0901234567',
            template_key: 'welcome_signup',
            data: { name: 'SaDec Guest', member_id: 'M1', balance: 10000 },
            tenantId: 'tenant_sadec_02',
          }
        );
      } finally {
        TEMPLATE_IDS.welcome_signup = prevTpl;
      }
      expect(notificationAuditLogs[0]?.tenant_id).toBe('tenant_sadec_02');

      // Z2: Mautic isAlreadyEnrolled for 'default' tenant is NOT suppressed by 'tenant_sadec_02' enrollment
      expect(await isAlreadyEnrolled(mockDb as any, 'cust_shared_z2', 'winback', 30, 'tenant_sadec_02')).toBe(true);
      expect(await isAlreadyEnrolled(mockDb as any, 'cust_shared_z2', 'winback', 30, 'default')).toBe(false);

      // 3. Z3: Standalone review persists tenant_id and GET /api/reviews/stats isolates per tenant
      const revApp = new Hono<{ Bindings: Env }>();
      revApp.route('/api/reviews', reviewsRouter);

      const custFranToken = await generateJWT(
        { id: 'cust_fran_z3', role: 'customer', tenantId: 'tenant_sadec_02' },
        TEST_JWT_SECRET,
        3600
      );
      const postRevRes = await revApp.fetch(
        new Request('https://api.test/api/reviews', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${custFranToken}`,
          },
          body: JSON.stringify({
            order_id: 'ord_fran_z3',
            rating: 5,
            comment: 'Excellent coffee in Sa Đéc!',
            customer_name: 'SaDec Reviewer',
          }),
        }),
        franEnv
      );
      expect(postRevRes.status).toBe(201);
      expect(reviews.find((r) => r.customer_name === 'SaDec Reviewer')?.tenant_id).toBe('tenant_sadec_02');

      const franStatsRes = await revApp.fetch(
        new Request('https://api.test/api/reviews/stats', {
          headers: { Authorization: `Bearer ${custFranToken}` },
        }),
        franEnv
      );
      expect(franStatsRes.status).toBe(200);
      const franStatsBody = (await franStatsRes.json()) as {
        data: { total_reviews: number; average_rating: number };
      };
      expect(franStatsBody.data).toEqual({ total_reviews: 1, average_rating: 5 });

      const defStatsRes = await revApp.fetch(
        new Request('https://api.test/api/reviews/stats'),
        defEnv
      );
      expect(defStatsRes.status).toBe(200);
      const defStatsBody = (await defStatsRes.json()) as {
        data: { total_reviews: number; average_rating: number };
      };
      expect(defStatsBody.data).toEqual({ total_reviews: 1, average_rating: 2 });

      // Z3: Mobile tables updateTableStatus scopes UPDATE by tenant_id
      const mobileApp = new Hono<{ Bindings: Env }>();
      mobileApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'waiter-sadec', role: 'waiter', tenantId: 'tenant_sadec_02' });
        c.set('tenantId' as any, 'tenant_sadec_02');
        await next();
      });
      mobileApp.patch('/mobile/tables/:id', (c) => updateTableStatus(c));

      executedSqls.length = 0;
      const patchTblRes = await mobileApp.fetch(
        new Request('https://api.test/mobile/tables/tbl_fran_z3', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'occupied' }),
        }),
        franEnv
      );
      expect(patchTblRes.status).toBe(200);
      expect(cafeTables[0]?.status).toBe('Occupied');
      expect(
        executedSqls.some(
          (q) =>
            q.sql.includes("UPDATE cafe_tables SET status = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?") &&
            q.args[0] === 'Occupied' &&
            q.args[1] === 'tbl_fran_z3' &&
            q.args[2] === 'tenant_sadec_02'
        )
      ).toBe(true);
    });
  });

  // =========================================================================
  // Suite 30: Phase AA1–AA3 — Default-Tenant Campaign/Mautic/Push Isolation,
  //           Reports RBAC & Subscriptions MRR/Invoice Hardening, Shift Cash
  //           Reconciliation, Staff Tips, Table Sessions & SOP Audit Actor
  // =========================================================================
  describe('Suite 30: Phase AA1–AA3 — Default-Tenant Campaign/Mautic/Push, Reports RBAC, Subscriptions MRR, Shift Reconcile, Staff Tips & SOP Audit Isolation', () => {
    it('enforces default-tenant isolation across Mautic/Campaigns/Push, blocks non-staff on /api/reports, protects mrr_snapshots from non-default overwrites, and scopes shift cash reconciliation, staff tips, table sessions & SOP audit actor (AA1–AA3)', async () => {
      const { getCustomerAccount } = await import('../../../../packages/domain/crm/commands/get-customer-account');
      const { lookupProfile } = await import('../../../../packages/domain/crm/lookup-profile');
      const { deduplicate: deduplicateCrm } = await import('../../../../packages/domain/crm/commands/campaign/dedup');
      const {
        detectBirthdayCandidates: detectCrmBirthday,
        detectWinbackCandidates: detectCrmWinback,
      } = await import('../../../../packages/domain/crm/commands/campaign/detect');
      const { deduplicate } = await import('../../tree/campaigns/campaign-engine');
      const { detectWelcomeCandidates } = await import('../../tree/campaigns/triggers/welcome');
      const { detectBirthdayCandidates: detectTreeBirthday } = await import('../../tree/campaigns/triggers/birthday');
      const { detectWinbackCandidates: detectTreeWinback } = await import('../../tree/campaigns/triggers/winback');
      const { detectPostVisitCandidates } = await import('../../tree/campaigns/triggers/post-visit');
      const { detectCashbackExpiry, markExpiryNotified } = await import('../../tree/campaigns/triggers/cashback-expiry');
      const {
        detectBirthdayCandidates: detectMauticBirthday,
        detectWinbackCandidates: detectMauticWinback,
      } = await import('../../tree/mautic/campaign-detection');
      const { sendPushToCustomer, sendPushToStaff } = await import('../../tree/push/notifier');
      const { reportsRouter } = await import('../../routes/reports-handlers/routes');
      const { updateMRRSnapshot } = await import('../../tree/subscriptions/mrr-calculator');
      const { getStatsHandler } = await import('../../tree/subscriptions/sub-handlers');
      const { listInvoices } = await import('../../tree/subscriptions/invoice-handlers');
      const { reconcileShiftCash, getReconciliationForShift } = await import(
        '../../../../packages/domain/shift/src/policies/cash-reconciliation-policy'
      );
      const { staffTipsRouter } = await import('../../../../packages/domain/staff/commands/staff-tips');
      const { registerSessionHandlers } = await import('../../routes/table-sessions-handlers/session-handlers');
      const { auditActor } = await import('../../routes/openapi-sop-handlers/sop-audit');
      const { Hono } = await import('hono');

      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];
      const mrrSnapshots: Array<Record<string, unknown>> = [];
      const shiftReconciliations: Array<Record<string, unknown>> = [];
      const orders: Array<Record<string, unknown>> = [
        {
          id: 'ord_def_aa1',
          customer_id: 'cust_def_aa1',
          customer_phone: '0901112222',
          total: 45000,
          tip_amount: 5000,
          updated_by: 'staff_sadec_1',
          status: 'completed',
          created_at: '2026-11-02T08:00:00.000Z',
          tenant_id: 'default',
        },
        {
          id: 'ord_fran_aa1',
          customer_id: 'cust_def_aa1',
          customer_phone: '0901112222',
          total: 95000,
          tip_amount: 15000,
          updated_by: 'staff_sadec_1',
          status: 'completed',
          created_at: '2026-11-02T09:00:00.000Z',
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const payments: Array<Record<string, unknown>> = [
        {
          id: 'pay_cash_def',
          method: 'cash',
          amount: 100000,
          status: 'completed',
          created_at: '2026-11-02T08:30:00.000Z',
          tenant_id: 'default',
        },
        {
          id: 'pay_cash_fran',
          method: 'cash',
          amount: 250000,
          status: 'completed',
          created_at: '2026-11-02T08:45:00.000Z',
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const cashPayouts: Array<Record<string, unknown>> = [
        {
          id: 'payout_def',
          amount: 20000,
          status: 'completed',
          created_at: '2026-11-02T09:00:00.000Z',
          tenant_id: 'default',
        },
        {
          id: 'payout_fran',
          amount: 50000,
          status: 'completed',
          created_at: '2026-11-02T09:15:00.000Z',
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const tableSessions: Array<Record<string, unknown>> = [
        {
          id: 'tsess_def_aa3',
          table_id: 'tbl_shared_1',
          status: 'active',
          opened_at: '2026-11-02T08:00:00.000Z',
          tenant_id: 'default',
        },
        {
          id: 'tsess_fran_aa3',
          table_id: 'tbl_shared_1',
          status: 'active',
          opened_at: '2026-11-02T08:30:00.000Z',
          tenant_id: 'tenant_sadec_02',
        },
      ];

      let activeStaffTenant = 'tenant_sadec_02';
      const makeStmt = (sql: string, args: unknown[] = []) => ({
        sql,
        args,
        bind: (...b: unknown[]) => makeStmt(sql, b),
        first: async () => {
          executedSqls.push({ sql, args });
          if (isAccountLookup(sql)) {
            return staffAccountRow('manager', activeStaffTenant);
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            return {
              id: 'cust_def_aa1',
              name: 'Default Customer AA1',
              phone: '0901112222',
              email: 'def_aa1@aura.vn',
              loyalty_tier: 'gold',
              loyalty_points: 200,
              lifetime_points: 500,
              tenant_id: 'default',
            };
          }
          if (/FROM customers WHERE \(?phone = \?/i.test(sql)) {
            return {
              id: 'cust_def_aa1',
              customer_id: 'cust_def_aa1',
              name: 'Default Customer AA1',
              phone: '0901112222',
              email: 'def_aa1@aura.vn',
              loyalty_tier: 'gold',
              loyalty_points: 200,
              lifetime_points: 500,
              tenant_id: 'default',
            };
          }
          if (/SELECT clock_in, clock_out, tenant_id FROM staff_shifts WHERE id = \?/i.test(sql)) {
            if (args[0] === 'shift_fran_aa3') {
              return {
                clock_in: '2026-11-02T08:00:00.000Z',
                clock_out: '2026-11-02T12:00:00.000Z',
                tenant_id: 'tenant_sadec_02',
              };
            }
            return null;
          }
          if (/SELECT COALESCE\(SUM\(amount\), 0\) as total FROM payments/i.test(sql)) {
            const tid = /TRIM\(tenant_id\)/i.test(sql) ? String(args[2]) : undefined;
            const total = payments
              .filter((p) => !tid || String(p.tenant_id || 'default').trim() === tid)
              .reduce((sum, p) => sum + Number(p.amount || 0), 0);
            return { total };
          }
          if (/SELECT COALESCE\(SUM\(amount\), 0\) as total FROM cash_payouts/i.test(sql)) {
            const tid = /TRIM\(tenant_id\)/i.test(sql) ? String(args[2]) : undefined;
            const total = cashPayouts
              .filter((p) => !tid || String(p.tenant_id || 'default').trim() === tid)
              .reduce((sum, p) => sum + Number(p.amount || 0), 0);
            return { total };
          }
          if (/SELECT \* FROM shift_reconciliations WHERE shift_id = \?/i.test(sql)) {
            const sid = String(args[0]);
            return shiftReconciliations.find((r) => r.shift_id === sid) || null;
          }
          if (/SELECT \* FROM subscriptions WHERE id = \?/i.test(sql)) {
            if (args[0] === 'sub_def_aa2') {
              return {
                id: 'sub_def_aa2',
                customer_id: 'cust_fran_aa2',
                customer_email: 'fran@aura.vn',
                status: 'active',
                tenant_id: 'default',
              };
            }
            return null;
          }
          if (/SELECT \* FROM orders WHERE id = \?/i.test(sql)) {
            const oid = String(args[0]);
            return orders.find((o) => o.id === oid) || null;
          }
          if (/SELECT id, tenant_id FROM users WHERE id = \?/i.test(sql)) {
            return { id: String(args[0]), tenant_id: 'tenant_sadec_02' };
          }
          if (/COALESCE\(SUM\(amount_vnd\), 0\) as mrr/i.test(sql) && /FROM subscriptions/i.test(sql)) {
            const tid = args.find((a) => a === 'tenant_sadec_02' || a === 'default');
            return { count: 1, mrr: tid === 'tenant_sadec_02' ? 15000000 : 10000000 };
          }
          if (/SELECT COUNT\(\*\) as count FROM/i.test(sql)) {
            return { count: 1 };
          }
          if (/SELECT COALESCE\(SUM/i.test(sql)) {
            return { total: 100000 };
          }
          return null;
        },
        all: async () => {
          executedSqls.push({ sql, args });
          if (/SELECT \* FROM orders/i.test(sql)) {
            // Simulate fallback returning both tenants' orders to test JS-level resolvedTenant filter
            return { results: [...orders] };
          }
          if (/FROM push_subscriptions/i.test(sql)) {
            const allSubs = [
              {
                id: 'ps_def_aa1',
                endpoint: 'https://fcm.googleapis.com/fcm/send/def-aa1',
                p256dh: 'p_def',
                auth: 'a_def',
                customer_id: 'cust_def_aa1',
                staff_role: 'barista',
                tenant_id: 'default',
              },
              {
                id: 'ps_fran_aa1',
                endpoint: 'https://fcm.googleapis.com/fcm/send/fran-aa1',
                p256dh: 'p_fran',
                auth: 'a_fran',
                customer_id: 'cust_def_aa1',
                staff_role: 'barista',
                tenant_id: 'tenant_sadec_02',
              },
            ];
            if (/TRIM\(tenant_id\)/i.test(sql)) {
              const tid = String(args[args.length - 1]);
              return {
                results: allSubs.filter((s) => String(s.tenant_id || 'default').trim() === tid),
              };
            }
            return { results: allSubs };
          }
          if (/FROM subscriptions WHERE status IN \('active', 'past_due', 'paused'\)/i.test(sql)) {
            return {
              results: [
                {
                  id: 'sub_def_1',
                  status: 'active',
                  billing_cycle: 'monthly',
                  amount_vnd: 10000000,
                  tenant_id: 'default',
                },
                {
                  id: 'sub_fran_1',
                  status: 'active',
                  billing_cycle: 'monthly',
                  amount_vnd: 15000000,
                  tenant_id: 'tenant_sadec_02',
                },
              ],
            };
          }
          if (/FROM subscription_plans p LEFT JOIN subscriptions s|FROM subscriptions s JOIN subscription_plans p/i.test(sql)) {
            const tid = /TRIM\(s\.tenant_id\)/i.test(sql) ? String(args[0]) : undefined;
            return {
              results: [
                {
                  name: 'Container Basic',
                  slug: 'container-basic',
                  count: tid === 'tenant_sadec_02' ? 1 : 2,
                  revenue: tid === 'tenant_sadec_02' ? 15000000 : 25000000,
                },
              ],
            };
          }
          if (/FROM subscriptions WHERE status = 'active'/i.test(sql)) {
            return {
              results: [
                {
                  zone: 'Zone A',
                  count: 1,
                  revenue: 15000000,
                },
              ],
            };
          }
          if (/SELECT \* FROM table_sessions/i.test(sql)) {
            return { results: [...tableSessions] };
          }
          if (/SELECT \* FROM cafe_tables/i.test(sql)) {
            return {
              results: [
                { id: 'tbl_shared_1', status: 'Available', tenant_id: 'default' },
                { id: 'tbl_shared_1', status: 'Available', tenant_id: 'tenant_sadec_02' },
              ],
            };
          }
          return { results: [] };
        },
        run: async () => {
          executedSqls.push({ sql, args });
          if (/INSERT (?:OR REPLACE )?INTO mrr_snapshots/i.test(sql)) {
            const mrrVal = typeof args[1] === 'number' ? args[1] : args[2];
            mrrSnapshots.push({
              snapshot_date: typeof args[1] === 'number' ? args[0] : args[1],
              mrr_vnd: mrrVal,
              arr_vnd: typeof args[1] === 'number' ? args[2] : args[3],
              active_count: typeof args[1] === 'number' ? args[3] : args[4],
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/INSERT INTO shift_reconciliations/i.test(sql)) {
            const hasTenantCol = /tenant_id/i.test(sql);
            shiftReconciliations.push({
              id: args[0],
              shift_id: args[1],
              staff_id: args[2],
              opening_float: args[3],
              expected_cash: args[4],
              actual_cash: args[5],
              variance: args[6],
              variance_status: args[7],
              denominations: args[8],
              cash_payment_total: args[9],
              cash_payout_total: args[10],
              notes: args[11],
              tenant_id: hasTenantCol ? args[12] : 'default',
              created_at: hasTenantCol ? args[13] : args[12],
            });
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 1 } };
        },
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => makeStmt(sql, [])),
        batch: vi.fn(async (stmts: Array<{ sql: string; args: unknown[] }>) => {
          for (const s of stmts) {
            executedSqls.push({ sql: s.sql, args: s.args });
          }
          return stmts.map(() => ({ success: true, meta: { changes: 1 } }));
        }),
      };

      const franEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'tenant_sadec_02',
        ENVIRONMENT: 'test',
      });

      // 1. AA1: getCustomerAccount & lookupProfile filter out foreign-tenant orders ('ord_fran_aa1') for 'default' customer
      const account = await getCustomerAccount(mockDb as any, 'cust_def_aa1', { tenantId: 'default' });
      expect(account.recentOrders.map((o) => o.id)).toEqual(['ord_def_aa1']);

      const profile = await lookupProfile(mockDb as any, '0901112222', 'default');
      expect(profile?.recentOrders.map((o) => o.id)).toEqual(['ord_def_aa1']);

      // AA1: Campaign triggers, deduplication, Mautic detection & WebPush notifier scope SQL even when tenantId === 'default'
      executedSqls.length = 0;
      await deduplicate(mockDb as any, 'cust_def_aa1', 'welcome_series' as any, 3650, 'default');
      await detectWelcomeCandidates(mockDb as any, 'default');
      await detectTreeBirthday(mockDb as any, 'default');
      await detectTreeWinback(mockDb as any, 'default');
      await detectPostVisitCandidates(mockDb as any, 'default');
      await detectCashbackExpiry(mockDb as any, 'default');
      await markExpiryNotified(mockDb as any, ['cust_def_aa1'], 'default');
      await deduplicateCrm(mockDb as any, 'cust_def_aa1', 'birthday', 365, 'default');
      await detectCrmBirthday(mockDb as any, 'default');
      await detectCrmWinback(mockDb as any, 'default');
      const mauticEnv = {
        ...franEnv,
        MAUTIC_BASE_URL: 'https://mautic.test',
        MAUTIC_CLIENT_ID: 'admin',
        MAUTIC_CLIENT_SECRET: 'secret',
        MAUTIC_CAMPAIGN_BIRTHDAY: '11',
        MAUTIC_CAMPAIGN_WINBACK: '10',
      };
      await detectMauticBirthday(mauticEnv as any, 'default');
      await detectMauticWinback(mauticEnv as any, 'default');
      await sendPushToCustomer({ ...franEnv, VAPID_PUBLIC_KEY: undefined } as any, 'cust_def_aa1', { title: 'Hi', body: 'Default' }, 'default');
      await sendPushToStaff({ ...franEnv, VAPID_PUBLIC_KEY: undefined } as any, { title: 'Staff', body: 'Default' }, undefined, 'default');

      const defaultScopedQueries = executedSqls.filter(
        (q) => q.sql.includes('tenant_id') && q.args.includes('default')
      );
      expect(defaultScopedQueries.length).toBeGreaterThanOrEqual(12);

      // 2. AA2: /api/reports enforces staff RBAC when authenticated user is present (blocks customer/vendor with 403)
      const reportsApp = new Hono<{ Bindings: Env }>();
      reportsApp.use('*', async (c, next) => {
        const role = c.req.header('X-Test-Role');
        if (role) {
          c.set('user' as any, { id: 'u1', role, tenantId: 'tenant_sadec_02' });
        }
        c.set('tenantId' as any, 'tenant_sadec_02');
        await next();
      });
      reportsApp.route('/api/reports', reportsRouter);

      const custReportRes = await reportsApp.fetch(
        new Request('https://api.test/api/reports/summary', {
          headers: { 'X-Test-Role': 'customer' },
        }),
        franEnv
      );
      expect(custReportRes.status).toBe(403);

      const mgrReportRes = await reportsApp.fetch(
        new Request('https://api.test/api/reports/summary', {
          headers: { 'X-Test-Role': 'manager' },
        }),
        franEnv
      );
      expect(mgrReportRes.status).toBe(200);

      // AA2: updateMRRSnapshot does NOT overwrite global mrr_snapshots for non-default tenant 'tenant_sadec_02'
      await updateMRRSnapshot(mockDb as any, 'tenant_sadec_02');
      expect(mrrSnapshots).toHaveLength(0);
      await updateMRRSnapshot(mockDb as any, 'default');
      expect(mrrSnapshots).toHaveLength(1);
      expect(mrrSnapshots[0]?.mrr_vnd).toBe(10000000);

      // AA2: getStatsHandler scopes byPlan by tenant_id
      const subApp = new Hono<{ Bindings: Env }>();
      subApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'mgr-sadec', role: 'manager', tenantId: 'tenant_sadec_02' });
        c.set('tenantId' as any, 'tenant_sadec_02');
        await next();
      });
      subApp.get('/stats', (c) => getStatsHandler(c));
      subApp.get('/invoices', (c) => listInvoices(c));

      const subStatsRes = await subApp.fetch(new Request('https://api.test/stats'), franEnv);
      expect(subStatsRes.status).toBe(200);
      const subStatsBody = (await subStatsRes.json()) as {
        data: { mrr_vnd: number; by_plan: Array<{ count: number }> };
      };
      expect(subStatsBody.data.mrr_vnd).toBe(15000000);
      expect(subStatsBody.data.by_plan[0]?.count).toBe(1);

      // AA2: listInvoices fails closed (empty data) when customer queries cross-tenant subscription_id
      const custSubApp = new Hono<{ Bindings: Env }>();
      custSubApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'cust_fran_aa2', role: 'customer', tenantId: 'tenant_sadec_02' });
        c.set('tenantId' as any, 'tenant_sadec_02');
        await next();
      });
      custSubApp.get('/invoices', (c) => listInvoices(c));
      const crossInvRes = await custSubApp.fetch(
        new Request('https://api.test/invoices?subscription_id=sub_def_aa2'),
        franEnv
      );
      expect(crossInvRes.status).toBe(200);
      const crossInvBody = (await crossInvRes.json()) as { data: unknown[] };
      expect(crossInvBody.data).toEqual([]);

      // 3. AA3: Shift cash reconciliation isolates cash payments/payouts by shift tenant and persists tenant_id
      const recon = await reconcileShiftCash(
        { AURA_DB: mockDb as any },
        {
          shift_id: 'shift_fran_aa3',
          opening_float: 500000,
          denominations: { denominations: [{ denomination: 500000, count: 1 }, { denomination: 200000, count: 1 }] },
          notes: 'SaDec shift close',
        },
        'staff_sadec_1',
        'tenant_sadec_02'
      );
      // Expected cash for 'tenant_sadec_02': 500,000 + 250,000 (pay_cash_fran) - 50,000 (payout_fran) = 700,000
      expect(recon.cash_payment_total).toBe(250000);
      expect(recon.cash_payout_total).toBe(50000);
      expect(recon.expected_cash).toBe(700000);
      expect(recon.variance).toBe(0);
      expect(shiftReconciliations[0]?.tenant_id).toBe('tenant_sadec_02');

      expect(await getReconciliationForShift({ AURA_DB: mockDb as any }, 'shift_fran_aa3', 'default')).toBeNull();
      expect(await getReconciliationForShift({ AURA_DB: mockDb as any }, 'shift_fran_aa3', 'tenant_sadec_02')).not.toBeNull();

      // AA3: Staff tips POST /assign scopes UPDATE orders by tenant_id
      const tipsApp = new Hono<{ Bindings: Env }>();
      tipsApp.route('/api/staff-tips', staffTipsRouter);
      executedSqls.length = 0;
      const assignTipRes = await tipsApp.fetch(
        await authRequest('POST', '/api/staff-tips/assign', 'manager', 'tenant_sadec_02', {
          order_id: 'ord_fran_aa1',
          staff_id: 'staff_sadec_1',
          tip_amount: 20000,
        }),
        franEnv
      );
      expect(assignTipRes.status).toBe(200);
      expect(
        executedSqls.some(
          (q) =>
            q.sql.includes("UPDATE orders SET tip_amount = ?, updated_by = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?") &&
            q.args[3] === 'ord_fran_aa1' &&
            q.args[4] === 'tenant_sadec_02'
        )
      ).toBe(true);

      // AA3: Table sessions GET / filters by session.tenant_id even when table_id collides
      const sessApp = new Hono<{ Bindings: Env }>();
      sessApp.use('*', async (c, next) => {
        c.set('tenantId' as any, 'tenant_sadec_02');
        await next();
      });
      registerSessionHandlers(sessApp);
      const listSessRes = await sessApp.fetch(new Request('https://api.test/'), franEnv);
      expect(listSessRes.status).toBe(200);
      const listSessBody = (await listSessRes.json()) as { data: Array<{ id: string }> };
      expect(listSessBody.data.map((s) => s.id)).toEqual(['tsess_fran_aa3']);

      // AA3: auditActor resolves tenantId from user.tenant_id or getTenantId(c)
      const mockCtx = {
        get: (k: string) =>
          k === 'user'
            ? { id: 'staff_sadec_1', name: 'SaDec Staff', role: 'staff', tenant_id: 'tenant_sadec_02' }
            : k === 'tenantId'
              ? 'tenant_sadec_02'
              : undefined,
        env: franEnv,
        req: { header: () => undefined },
      } as any;
      const actor = auditActor(mockCtx);
      expect(actor.tenantId).toBe('tenant_sadec_02');
    });
  });

  // =========================================================================
  // Suite 31: Phase AB1–AB3 — Cron & Campaign/Mautic/Push Default-Tenant Scoping,
  //           Loyalty Policy (bonus_campaigns + KV), Referrals, Checkin/Birthday/WiFi
  //           & Floor-Plan Isolation, and Order/Customer Spine & Inventory PO/BOM
  // =========================================================================
  describe('Suite 31: Phase AB1–AB3 — Cron, Campaign/Mautic/Push, Loyalty Policy, Referrals, Checkin/Birthday/WiFi, Floor-Plan & Inventory PO/BOM Isolation', () => {
    it('enforces default-tenant scoping in cron overdue/cashback warnings, stamps default tenant_id on campaign_logs/enrollments/push/referrals/checkin/birthday/wifi/PO/stock_movements, isolates loadPolicy & getActiveCampaign, and scopes floor-plan & inventory PO/BOM (AB1–AB3)', async () => {
      const { checkOverdueOrders } = await import('../../routes/cron-handlers/order-checks');
      const { sendCashbackExpiryWarnings } = await import('../../routes/cron-handlers/cashback-warnings');
      const { logSend } = await import('../../tree/campaigns/campaign-engine');
      const { trackEnrollment } = await import('../../tree/mautic/enrollment-tracker');
      const { pushRouter } = await import('../../routes/push');
      const { markNotificationRead } = await import('../../routes/notifications-mobile');
      const { loadPolicy } = await import('../../../../packages/domain/crm/commands/loyalty-policy');
      const { consumeCrmEvent } = await import('../../../../packages/domain/crm/commands/consume-crm-event');
      const { getActiveCampaign } = await import('../../tree/loyalty/campaign');
      const { referralRouter } = await import('../../routes/referrals');
      const { checkinRouter } = await import('../../routes/checkin');
      const { birthdayRouter } = await import('../../routes/birthday');
      const { authorizeWifiOverride } = await import('../../tree/wifi/session');
      const { floorPlanRouter } = await import('../../routes/floor-plan');
      const {
        createCanonicalPurchaseOrder,
        receivePurchaseOrder,
        cancelPurchaseOrder,
      } = await import('../../../../packages/domain/inventory/src/policies/purchasing-receiving-policy');
      const { deductOrderStock } = await import(
        '../../../../packages/domain/inventory/src/policies/inventory-recipe-policy'
      );
      const { purchasing } = await import('../../../../packages/domain/inventory/src/routes/purchasing');
      const { Hono } = await import('hono');

      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];
      const kvMap = new Map<string, string>();
      const mockKv = {
        get: vi.fn(async (key: string) => kvMap.get(key) ?? null),
        put: vi.fn(async (key: string, val: string) => {
          kvMap.set(key, val);
        }),
      };

      const bonusCampaigns: Array<Record<string, unknown>> = [
        {
          id: 1,
          code: 'DEF_SPRING_2X',
          name: 'Default 2x',
          cashback_multiplier: 2.0,
          max_cap_per_customer_vnd: 40000,
          start_date: '2026-01-01 00:00:00',
          end_date: '2026-12-31 23:59:59',
          active: 1,
          tenant_id: 'default',
        },
        {
          id: 2,
          code: 'SADEC_GRAND_3X',
          name: 'SaDec 3x',
          cashback_multiplier: 3.0,
          max_cap_per_customer_vnd: 90000,
          start_date: '2026-01-01 00:00:00',
          end_date: '2026-12-31 23:59:59',
          active: 1,
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const campaignLogs: Array<Record<string, unknown>> = [];
      const campaignEnrollments: Array<Record<string, unknown>> = [];
      const pushSubs: Array<Record<string, unknown>> = [];
      const checkins: Array<Record<string, unknown>> = [];
      const birthdayRedemptions: Array<Record<string, unknown>> = [];
      const wifiSessions: Array<Record<string, unknown>> = [];
      const purchaseOrders: Array<Record<string, unknown>> = [];
      const purchaseOrderItems: Array<Record<string, unknown>> = [];
      const stockMovements: Array<Record<string, unknown>> = [];
      const referralCodes: Array<Record<string, unknown>> = [
        {
          id: 'rc_def_ab2',
          customer_id: 'cust_def_ab2',
          code: 'FNB-DEFAB2',
          times_used: 1,
          total_points_earned: 0,
          created_at: '2026-11-01T00:00:00.000Z',
          tenant_id: 'default',
        },
      ];
      const referrals: Array<Record<string, unknown>> = [
        {
          id: 'ref_def_1',
          referrer_id: 'cust_def_ab2',
          referred_customer_id: 'cust_def_friend',
          referral_code: 'FNB-DEFAB2',
          points_awarded: 0,
          cashback_awarded_vnd: 10000,
          status: 'completed',
          created_at: '2026-11-01T01:00:00.000Z',
          tenant_id: 'default',
        },
        {
          id: 'ref_fran_1',
          referrer_id: 'cust_def_ab2',
          referred_customer_id: 'cust_fran_friend',
          referral_code: 'FNB-SADEC2',
          points_awarded: 0,
          cashback_awarded_vnd: 10000,
          status: 'completed',
          created_at: '2026-11-01T02:00:00.000Z',
          tenant_id: 'tenant_sadec_02',
        },
      ];

      let activeStaffTenant = 'default';
      const makeStmt = (sql: string, args: unknown[] = []) => ({
        sql,
        args,
        bind: (...b: unknown[]) => makeStmt(sql, b),
        first: async () => {
          executedSqls.push({ sql, args });
          if (isAccountLookup(sql)) {
            return staffAccountRow('manager', activeStaffTenant);
          }
          if (/FROM bonus_campaigns/i.test(sql)) {
            if (/COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
              const tid = String(args[2]);
              const matches = bonusCampaigns
                .filter((c) => String(c.tenant_id || 'default').trim() === tid)
                .sort((a, b) => Number(b.id) - Number(a.id));
              return matches[0] ?? null;
            }
            const sorted = [...bonusCampaigns].sort((a, b) => Number(b.id) - Number(a.id));
            return sorted[0] ?? null;
          }
          if (/SELECT \* FROM referral_codes WHERE customer_id = \?/i.test(sql)) {
            return referralCodes.find((r) => r.customer_id === args[0]) ?? null;
          }
          if (/FROM checkins WHERE customer_id = \?/i.test(sql)) {
            return null;
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            return {
              id: String(args[0]),
              name: 'Default Birthday Customer',
              phone: '0905556666',
              birthday: new Date().toISOString().slice(0, 10),
              date_of_birth: new Date().toISOString().slice(0, 10),
              loyalty_points: 50,
              lifetime_points: 50,
              loyalty_tier: 'bronze',
              tenant_id: 'default',
            };
          }
          if (/FROM birthday_redemptions WHERE customer_id = \?/i.test(sql)) {
            return null;
          }
          if (/SELECT \* FROM cafe_tables WHERE id = \?/i.test(sql)) {
            return { id: String(args[0]), table_number: 1, zone: 'Indoor', status: 'Reserved', tenant_id: activeStaffTenant };
          }
          if (/FROM table_sessions WHERE table_id = \? AND status = 'active'/i.test(sql)) {
            return { id: 'tsess_ab2_1', tenant_id: activeStaffTenant };
          }
          if (/SELECT \* FROM suppliers WHERE id = \? AND is_active = 1/i.test(sql)) {
            return { id: String(args[0]), name: 'Default Supplier', is_active: 1, tenant_id: 'default' };
          }
          if (/SELECT \* FROM ingredients WHERE id = \?/i.test(sql) || /SELECT id, current_stock, tenant_id FROM ingredients WHERE id = \?/i.test(sql) || /SELECT id, tenant_id FROM ingredients WHERE id = \?/i.test(sql)) {
            return { id: String(args[0]), name: 'Coffee Beans', cost_per_unit: 200, current_stock: 500, tenant_id: 'default' };
          }
          if (/SELECT \* FROM purchase_orders WHERE id = \?/i.test(sql)) {
            return purchaseOrders.find((p) => p.id === args[0]) ?? null;
          }
          if (/FROM stock_movements WHERE reference_id = \?/i.test(sql)) {
            const refId = String(args[0]);
            if (/COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
              const tid = String(args[1]);
              return stockMovements.find((m) => m.reference_id === refId && String(m.tenant_id || 'default') === tid) ?? null;
            }
            return stockMovements.find((m) => m.reference_id === refId) ?? null;
          }
          if (/FROM recipes WHERE product_id = \?/i.test(sql)) {
            return { id: 'rec_ab3_1', product_id: String(args[0]), name: 'Espresso BOM', tenant_id: 'default' };
          }
          return null;
        },
        all: async () => {
          executedSqls.push({ sql, args });
          if (/FROM orders\s+WHERE status IN \('pending', 'confirmed', 'preparing'/i.test(sql)) {
            return {
              results: [
                { id: 'ord_overdue_def', customer_name: 'Default Guest', status: 'confirmed', created_at: '2026-11-01T00:00:00Z', tenant_id: 'default' },
              ],
            };
          }
          if (/FROM cashback_transactions ct\s+JOIN cashback_wallets cw/i.test(sql)) {
            return {
              results: [
                { customer_id: 'cust_warn_def', name: 'Warn Def', phone: '0901112222', total_expiring: 15000, tenant_id: 'default' },
              ],
            };
          }
          if (/SELECT COUNT\(\*\) as cnt FROM referrals WHERE referrer_id = \?/i.test(sql)) {
            const tid = /TRIM\(tenant_id\)/i.test(sql) ? String(args[1]) : undefined;
            const cnt = referrals.filter(
              (r) => r.referrer_id === args[0] && (!tid || String(r.tenant_id || 'default').trim() === tid)
            ).length;
            return { results: [{ cnt }] };
          }
          if (/SELECT COALESCE\(SUM\(cashback_awarded_vnd\), 0\) as total FROM referrals/i.test(sql)) {
            const tid = /TRIM\(tenant_id\)/i.test(sql) ? String(args[2]) : undefined;
            const total = referrals
              .filter((r) => r.referrer_id === args[0] && r.status === args[1] && (!tid || String(r.tenant_id || 'default').trim() === tid))
              .reduce((s, r) => s + Number(r.cashback_awarded_vnd || 0), 0);
            return { results: [{ total }] };
          }
          if (/FROM referrals r LEFT JOIN customers c/i.test(sql)) {
            return { results: [...referrals] };
          }
          if (/FROM purchase_order_items WHERE purchase_order_id = \?/i.test(sql)) {
            return { results: purchaseOrderItems.filter((i) => i.purchase_order_id === args[0]) };
          }
          if (/FROM recipe_items ri/i.test(sql)) {
            return {
              results: [{ ingredient_id: 'ing_ab3_1', quantity: 18, unit: 'g', ing_name: 'Beans', cost_per_unit: 200 }],
            };
          }
          if (/SELECT \* FROM purchase_orders/i.test(sql)) {
            if (/COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
              const tid = String(args[0]);
              return { results: purchaseOrders.filter((p) => String(p.tenant_id || 'default') === tid) };
            }
            return { results: [...purchaseOrders] };
          }
          return { results: [] };
        },
        run: async () => {
          executedSqls.push({ sql, args });
          if (/INSERT INTO campaign_logs/i.test(sql)) {
            campaignLogs.push({ id: args[0], customer_id: args[1], campaign_type: args[2], tenant_id: 'default_unset' });
          }
          if (/UPDATE campaign_logs SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = campaignLogs.find((r) => r.id === args[1]);
            if (row) row.tenant_id = args[0];
          }
          if (/INSERT INTO campaign_enrollments/i.test(sql)) {
            campaignEnrollments.push({ id: args[0], customer_id: args[1], campaign_type: args[2], tenant_id: 'default_unset' });
          }
          if (/UPDATE campaign_enrollments SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = campaignEnrollments.find((r) => r.id === args[1]);
            if (row) row.tenant_id = args[0];
          }
          if (/INSERT INTO push_subscriptions/i.test(sql)) {
            pushSubs.push({ id: args[0], customer_id: args[1], endpoint: args[2], tenant_id: 'default_unset' });
          }
          if (/UPDATE push_subscriptions SET tenant_id = \? WHERE endpoint = \?/i.test(sql)) {
            const row = pushSubs.find((r) => r.endpoint === args[1]);
            if (row) row.tenant_id = args[0];
          }
          if (/INSERT INTO checkins/i.test(sql)) {
            checkins.push({ id: args[0], customer_id: args[1], tenant_id: 'default_unset' });
          }
          if (/UPDATE checkins SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = checkins.find((r) => r.id === args[1]);
            if (row) row.tenant_id = args[0];
          }
          if (/INSERT INTO birthday_redemptions/i.test(sql)) {
            birthdayRedemptions.push({ id: args[0], customer_id: args[1], tenant_id: 'default_unset' });
          }
          if (/UPDATE birthday_redemptions SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = birthdayRedemptions.find((r) => r.id === args[1]);
            if (row) row.tenant_id = args[0];
          }
          if (/INSERT INTO wifi_sessions/i.test(sql)) {
            wifiSessions.push({ id: args[0], client_mac: args[1], tenant_id: 'default_unset' });
          }
          if (/UPDATE wifi_sessions SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = wifiSessions.find((r) => r.id === args[1]);
            if (row) row.tenant_id = args[0];
          }
          if (/INSERT INTO purchase_orders/i.test(sql)) {
            const hasTenant = /tenant_id/i.test(sql);
            purchaseOrders.push({
              id: args[0],
              po_number: args[1],
              supplier_id: args[2],
              status: 'ordered',
              tenant_id: hasTenant ? args[11] : 'default_unset',
            });
          }
          if (/INSERT INTO purchase_order_items/i.test(sql)) {
            purchaseOrderItems.push({
              id: args[0],
              purchase_order_id: args[1],
              ingredient_id: args[2],
              quantity: args[3],
              unit_price: args[4],
              total_price: args[5],
              received_quantity: 0,
            });
          }
          if (/INSERT INTO stock_movements/i.test(sql)) {
            const hasTenant = /tenant_id/i.test(sql);
            stockMovements.push({
              id: args[0],
              ingredient_id: args[1],
              quantity: args[2],
              reference_id: args[3],
              tenant_id: hasTenant ? args[args.length - 1] : 'default_unset',
            });
          }
          return { success: true, meta: { changes: 1 } };
        },
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => makeStmt(sql, [])),
        batch: vi.fn(async (stmts: Array<{ sql: string; args: unknown[] }>) => {
          for (const s of stmts) {
            executedSqls.push({ sql: s.sql, args: s.args });
          }
          return stmts.map(() => ({ success: true, meta: { changes: 1 } }));
        }),
      };

      const defEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        AUTH_KV: mockKv as any,
        PILOT_TENANT_ID: 'default',
        ENVIRONMENT: 'test',
      });

      // 1. AB1: Cron checkOverdueOrders & sendCashbackExpiryWarnings explicitly scope SQL for 'default' tenant
      executedSqls.length = 0;
      await checkOverdueOrders(defEnv as any, 'default');
      expect(
        executedSqls.some(
          (q) =>
            /FROM orders/i.test(q.sql) &&
            q.sql.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?") &&
            q.args.includes('default')
        )
      ).toBe(true);
      expect(
        executedSqls.some(
          (q) =>
            /UPDATE orders SET notes/i.test(q.sql) &&
            q.sql.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?") &&
            q.args.includes('default')
        )
      ).toBe(true);

      executedSqls.length = 0;
      const warnRes = await sendCashbackExpiryWarnings(defEnv as any, 'default');
      expect(warnRes.notified).toBe(1);
      expect(
        executedSqls.some(
          (q) =>
            /FROM cashback_transactions ct\s+JOIN cashback_wallets cw/i.test(q.sql) &&
            q.sql.includes("COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?") &&
            q.args.includes('default')
        )
      ).toBe(true);
      expect(
        executedSqls.some(
          (q) =>
            /UPDATE customers SET last_expiry_warning_at = \?/i.test(q.sql) &&
            q.sql.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?") &&
            q.args.includes('default')
        )
      ).toBe(true);

      // AB1: logSend & trackEnrollment stamp tenant_id = 'default'
      await logSend(
        mockDb as any,
        {
          customer_id: 'cust_def_ab1',
          trigger: 'welcome_series' as any,
          channel: 'zns',
          sent: true,
        },
        'default'
      );
      expect(campaignLogs[0]?.tenant_id).toBe('default');

      await trackEnrollment(mockDb as any, 'cust_def_ab1', 'winback', '10', 101, 'enrolled', 'default');
      expect(campaignEnrollments[0]?.tenant_id).toBe('default');

      // AB1: Push subscribe & unsubscribe stamp and scope 'default' tenant; markNotificationRead scopes 'default' tenant
      const pushApp = new Hono<{ Bindings: Env }>();
      pushApp.route('/api/push', pushRouter);
      const subPushRes = await pushApp.fetch(
        new Request('https://api.test/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'https://fcm.googleapis.com/fcm/send/ab1-def',
            p256dh_key: 'p_key',
            auth_key: 'a_key',
            customer_id: 'cust_def_ab1',
          }),
        }),
        defEnv
      );
      expect(subPushRes.status).toBe(201);
      expect(pushSubs[0]?.tenant_id).toBe('default');

      activeStaffTenant = 'default';
      executedSqls.length = 0;
      const unsubPushRes = await pushApp.fetch(
        await authRequest('DELETE', '/api/push/subscribe', 'manager', 'default', {
          endpoint: 'https://fcm.googleapis.com/fcm/send/ab1-def',
        }),
        defEnv
      );
      expect(unsubPushRes.status).toBe(200);
      expect(
        executedSqls.some(
          (q) =>
            /DELETE FROM push_subscriptions WHERE endpoint = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(q.sql) &&
            q.args[1] === 'default'
        )
      ).toBe(true);

      const notifApp = new Hono<{ Bindings: Env }>();
      notifApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'staff_def_1', role: 'waiter', tenantId: 'default' });
        c.set('tenantId' as any, 'default');
        await next();
      });
      notifApp.patch('/mobile/notifications/:id/read', (c) => markNotificationRead(c));
      executedSqls.length = 0;
      const readNotifRes = await notifApp.fetch(
        new Request('https://api.test/mobile/notifications/notif_1/read', { method: 'PATCH' }),
        defEnv
      );
      expect(readNotifRes.status).toBe(200);
      expect(
        executedSqls.some(
          (q) =>
            /UPDATE notifications[\s\S]*SET read_at = \?[\s\S]*COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(q.sql) &&
            q.args[3] === 'default'
        )
      ).toBe(true);

      // 2. AB2: loadPolicy & getActiveCampaign isolate bonus_campaigns & KV override per tenant
      kvMap.set('loyalty:policy:default', JSON.stringify({ maxCapPerTx: 45000 }));
      kvMap.set('loyalty:policy:tenant_sadec_02', JSON.stringify({ maxCapPerTx: 95000 }));

      const defPolicy = await loadPolicy(mockDb as any, mockKv as any, new Date('2026-06-01T00:00:00Z'), 'default');
      expect(defPolicy.campaignCode).toBe('DEF_SPRING_2X');
      expect(defPolicy.campaignMultiplier).toBe(2.0);
      expect(defPolicy.maxCapPerTx).toBe(45000);

      const franPolicy = await loadPolicy(mockDb as any, mockKv as any, new Date('2026-06-01T00:00:00Z'), 'tenant_sadec_02');
      expect(franPolicy.campaignCode).toBe('SADEC_GRAND_3X');
      expect(franPolicy.campaignMultiplier).toBe(3.0);
      expect(franPolicy.maxCapPerTx).toBe(95000);

      // getActiveCampaign(db, 'default') recovers 'DEF_SPRING_2X' even though 'SADEC_GRAND_3X' has higher id (id=2)
      const defActiveCamp = await getActiveCampaign(mockDb as any, 'default');
      expect(defActiveCamp?.code).toBe('DEF_SPRING_2X');

      // AB2: referrals GET /stats for 'default' tenant excludes 'tenant_sadec_02' referrals
      const custDefToken = await generateJWT(
        { id: 'cust_def_ab2', role: 'customer', tenantId: 'default' },
        TEST_JWT_SECRET,
        3600
      );
      const refApp = new Hono<{ Bindings: Env }>();
      refApp.route('/api/referrals', referralRouter);
      const refStatsRes = await refApp.fetch(
        new Request('https://api.test/api/referrals/stats', {
          headers: { Authorization: `Bearer ${custDefToken}` },
        }),
        defEnv
      );
      expect(refStatsRes.status).toBe(200);
      const refStatsBody = (await refStatsRes.json()) as {
        data: { total_referrals: number; total_cashback_earned_vnd: number; recent_referrals: unknown[] };
      };
      expect(refStatsBody.data.total_referrals).toBe(1);
      expect(refStatsBody.data.total_cashback_earned_vnd).toBe(10000);
      expect(refStatsBody.data.recent_referrals).toHaveLength(1);

      // AB2: checkin, birthday, wifi stamp tenant_id = 'default'
      const checkinApp = new Hono<{ Bindings: Env }>();
      checkinApp.route('/api/checkin', checkinRouter);
      const checkinRes = await checkinApp.fetch(
        new Request('https://api.test/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custDefToken}` },
          body: JSON.stringify({ customer_id: 'cust_def_ab2' }),
        }),
        defEnv
      );
      expect(checkinRes.status).toBe(201);
      expect(checkins[0]?.tenant_id).toBe('default');

      const bdayApp = new Hono<{ Bindings: Env }>();
      bdayApp.route('/api/birthday', birthdayRouter);
      const bdayRes = await bdayApp.fetch(
        new Request('https://api.test/api/birthday/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custDefToken}` },
          body: JSON.stringify({ customer_id: 'cust_def_ab2' }),
        }),
        defEnv
      );
      expect(bdayRes.status).toBe(201);
      expect(birthdayRedemptions[0]?.tenant_id).toBe('default');

      await authorizeWifiOverride({ AURA_DB: mockDb as any }, { mac: 'AA:BB:CC:DD:EE:FF', action: 'grant' }, 'default');
      expect(wifiSessions[0]?.tenant_id).toBe('default');

      // AB2: floor-plan no-show & release scope table_sessions and cafe_tables by tenant_id
      const fpApp = new Hono<{ Bindings: Env }>();
      fpApp.route('/api/floor-plan', floorPlanRouter);
      activeStaffTenant = 'default';
      executedSqls.length = 0;
      const noShowRes = await fpApp.fetch(
        await authRequest('POST', '/api/floor-plan/tbl_fp_1/no-show', 'manager', 'default', { timeout_minutes: 15 }),
        defEnv
      );
      expect(noShowRes.status).toBe(200);
      expect(
        executedSqls.some(
          (q) =>
            /SELECT id, tenant_id FROM table_sessions WHERE table_id = \? AND status = 'active' AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(q.sql) &&
            q.args[1] === 'default'
        )
      ).toBe(true);
      expect(
        executedSqls.some(
          (q) =>
            /UPDATE cafe_tables SET status = 'Available' WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(q.sql) &&
            q.args[1] === 'default'
        )
      ).toBe(true);

      // 3. AB3: consumeCrmEvent scopes UPDATE visits by tenant_id and forwards tenantId to loadPolicy
      executedSqls.length = 0;
      await consumeCrmEvent({
        db: mockDb as any,
        event: {
          eventType: 'customer_linked',
          customerId: 'cust_def_ab2',
          orderId: 'ord_def_ab3',
          payload: { totalAmount: 50000, tenantId: 'default' },
        } as any,
      });
      expect(
        executedSqls.some(
          (q) =>
            /UPDATE visits SET customer_id = \? WHERE order_id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(q.sql) &&
            q.args[2] === 'default'
        )
      ).toBe(true);
      expect(
        executedSqls.some(
          (q) =>
            /FROM bonus_campaigns/i.test(q.sql) &&
            q.sql.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?") &&
            q.args.includes('default')
        )
      ).toBe(true);

      // AB3: Purchasing PO creation, receiving, cancellation, GET /purchase-orders & BOM deductOrderStock stamp and scope tenant_id = 'default'
      const createdPo = await createCanonicalPurchaseOrder(
        mockDb as any,
        {
          supplierId: 'sup_def_1',
          items: [{ ingredientId: 'ing_ab3_1', quantity: 50, unitPrice: 200 }],
          tenantId: 'default',
        },
        'default'
      );
      expect(purchaseOrders[0]?.tenant_id).toBe('default');

      // Seed a foreign-tenant stock_movement with the same receiptId 'rcpt_shared_ab3' to verify tenant-scoped idempotency
      stockMovements.push({
        id: 'mov_fran_rcpt',
        ingredient_id: 'ing_fran_1',
        quantity: 50,
        reference_id: 'rcpt_shared_ab3',
        tenant_id: 'tenant_sadec_02',
      });
      const rcvRes = await receivePurchaseOrder(
        mockDb as any,
        createdPo.id,
        [{ ingredientId: 'ing_ab3_1', receivedQuantity: 50 }],
        { receiptId: 'rcpt_shared_ab3', tenantId: 'default' }
      );
      expect(rcvRes.ok).toBe(true);
      expect(rcvRes.alreadyReceived).toBe(false);
      expect(
        stockMovements.find((m) => m.reference_id === 'rcpt_shared_ab3' && m.tenant_id === 'default')
      ).toBeDefined();

      // Seed a foreign-tenant PO and verify GET /purchase-orders scopes SQL by tenant_id before LIMIT
      purchaseOrders.push({
        id: 'po_fran_ab3',
        po_number: 'PO-999999',
        supplier_id: 'sup_fran_1',
        status: 'ordered',
        tenant_id: 'tenant_sadec_02',
      });
      const poApp = new Hono<any>();
      poApp.use('*', async (c, next) => {
        c.set('tenantId', 'default');
        await next();
      });
      purchasing(poApp);
      const listPoRes = await poApp.fetch(new Request('https://api.test/purchase-orders?limit=10'), defEnv as any);
      expect(listPoRes.status).toBe(200);
      const listPoBody = (await listPoRes.json()) as { data: Array<{ id: string }> };
      expect(listPoBody.data.map((p) => p.id)).toEqual([createdPo.id]);

      // BOM deductOrderStock stamps tenant_id = 'default' on consumption stock_movements and isolates idempotency by tenant
      stockMovements.push({
        id: 'mov_fran_ord',
        ingredient_id: 'ing_fran_1',
        quantity: -18,
        reference_id: 'ord_shared_ab3',
        tenant_id: 'tenant_sadec_02',
      });
      const deductRes = await deductOrderStock(
        mockDb as any,
        'ord_shared_ab3',
        [{ productId: 'prod_espresso', quantity: 1 }],
        { tenantId: 'default' }
      );
      expect(deductRes.ok).toBe(true);
      expect(deductRes.alreadyDeducted).toBe(false);
      expect(
        stockMovements.find((m) => m.reference_id === 'ord_shared_ab3' && m.tenant_id === 'default')
      ).toBeDefined();
    });
  });

  // =========================================================================
  // Suite 32: Phase AC1–AC3 — Order Creation & Cancel Rollback, Reservations &
  //           Table-Session Pagination, Catalog Menu Projection, Promotions Usage,
  //           Referrals & Loyalty Dual-Write, Inventory RBAC & Order Deduction,
  //           and Staff Hierarchy / Tips / SOP Violations / Analytics Export RBAC
  // =========================================================================
  describe('Suite 32: Phase AC1–AC3 — Order/Cancel/Reservations/Sessions, Menu Projection/Promos/Referrals/Loyalty, Inventory RBAC/Deduction & Staff/Tips/SOP/Export Isolation', () => {
    it('enforces non-staff order tenant resolution, cancel rollback scoping, SQL pagination tenant filters, menu_items tenant projection, default-tenant promo usage, referral cashback tenant guard, loyalty dual-write tenant stamping, inventory transaction RBAC, and staff/tips/SOP/export boundaries (AC1–AC3)', async () => {
      const { resolveOrderCreationScope } = await import(
        '../../../../packages/domain/order/policies/order-creation-scope'
      );
      const { reservationsRouter } = await import(
        '../../../../packages/domain/reservation/src/routes/reservations'
      );
      const { registerOrderHandlers } = await import('../../routes/table-sessions-handlers/order-handlers');
      const { registerSessionHandlers } = await import('../../routes/table-sessions-handlers/session-handlers');
      const { syncProductToMenuProjection } = await import(
        '../../../../packages/domain/catalog/policies/menu-projection'
      );
      const { registerUsageHandlers } = await import('../../routes/openapi-promotions-handlers/usage-handlers');
      const { reverseReferralCashback } = await import('../../tree/referrals/reverse-cashback');
      const { processReferralCashbackOnFirstOrder } = await import('../../tree/referrals/referral-cashback');
      const {
        getLoyaltyAccountWithFallback,
        syncLoyaltyAccountAndCustomerBalance,
        recordLoyaltyTransactionDualWrite,
      } = await import('../../routes/openapi-loyalty-handlers/loyalty-db-helpers');
      const { handleSpendCashback } = await import('../../tree/loyalty/spend-cashback-handler');
      const { inventoryTransactions } = await import(
        '../../../../packages/domain/inventory/src/routes/inventory-transactions'
      );
      const { deductInventoryForOrder } = await import(
        '../../../../packages/domain/inventory/src/routes/order-deduction'
      );
      const { staffManagementDenial } = await import('../../lib/staff-account-mutation');
      const { staffTipsRouter } = await import('../../../../packages/domain/staff/commands/staff-tips');
      const { recordViolation } = await import(
        '../../../../packages/domain/sop/commands/sop-violation-repository'
      );
      const { registerExportHandlers } = await import('../../routes/analytics-handlers/export-handlers');
      const { Hono } = await import('hono');
      const { OpenAPIHono } = await import('@hono/zod-openapi');

      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];
      const menuItems: Array<Record<string, unknown>> = [];
      const promotionUsages: Array<Record<string, unknown>> = [];
      const referrals: Array<Record<string, unknown>> = [
        {
          id: 'ref_fran_ac2',
          referrer_id: 'cust_referrer_fran',
          referred_customer_id: 'cust_referred_shared',
          referral_code: 'FNB-FRAN99',
          status: 'completed',
          cashback_awarded_vnd: 10000,
          tenant_id: 'tenant_sadec_02',
        },
      ];
      const cashbackWallets: Array<Record<string, unknown>> = [
        {
          customer_id: 'cust_spend_ac2',
          balance: 50000,
          lifetime_earned: 50000,
          lifetime_spent: 0,
          lifetime_expired: 0,
          tenant_id: 'default',
        },
      ];
      const loyaltyAccounts: Array<Record<string, unknown>> = [];
      const loyaltyTxs: Array<Record<string, unknown>> = [];
      const loyaltyPointLogs: Array<Record<string, unknown>> = [];
      const inventoryTxRows: Array<Record<string, unknown>> = [];
      const stockMovementRows: Array<Record<string, unknown>> = [];
      const tableSessions: Array<Record<string, unknown>> = [
        {
          id: 'tsess_def_ac1',
          table_id: 'tbl_ac1',
          status: 'active',
          orders_count: 1,
          total_amount: 50000,
          tenant_id: 'default',
        },
      ];

      let activeStaffRole = 'manager';
      let activeStaffTenant = 'default';
      const makeStmt = (sql: string, args: unknown[] = []) => ({
        sql,
        args,
        bind: (...b: unknown[]) => makeStmt(sql, b),
        first: async () => {
          executedSqls.push({ sql, args });
          if (args[0] === 'staff_foreign_sadec' && /FROM users WHERE id = \?/i.test(sql)) {
            return { id: 'staff_foreign_sadec', role: 'waiter', tenant_id: 'tenant_sadec_02' };
          }
          if (isAccountLookup(sql)) {
            return staffAccountRow(activeStaffRole, activeStaffTenant);
          }
          if (/FROM products p[\s\S]*WHERE p\.id = \?/i.test(sql)) {
            return {
              id: 'prod_sadec_ac2',
              name: 'Cà Phê Muối Sa Đéc',
              category_id: 'cat_coffee',
              category_slug: 'coffee',
              price: 39000,
              description: 'Salt coffee',
              image_url: null,
              is_available: 1,
              sort_order: 1,
              tenant_id: 'tenant_sadec_02',
            };
          }
          if (/SELECT \* FROM promotions WHERE (?:UPPER\(code\)|id) = \?/i.test(sql)) {
            return {
              id: 'promo_def_ac2',
              code: 'WELCOME10',
              name: 'Welcome 10k',
              type: 'fixed',
              discount_type: 'fixed',
              value: 10000,
              discount_value: 10000,
              min_order_amount: 20000,
              min_order_value: 20000,
              max_uses_per_customer: 1,
              usage_limit_per_customer: 1,
              current_uses: 0,
              is_active: 1,
              start_date: '2026-01-01T00:00:00Z',
              end_date: '2026-12-31T23:59:59Z',
              tenant_id: 'default',
            };
          }
          if (/SELECT COUNT\(\*\) as (?:count|cnt) FROM promotion_usages/i.test(sql)) {
            if (/COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
              const tid = String(args[2]);
              const count = promotionUsages.filter(
                (u) => u.promotion_id === args[0] && u.customer_id === args[1] && String(u.tenant_id || 'default') === tid
              ).length;
              return { count, cnt: count };
            }
            return { count: promotionUsages.length, cnt: promotionUsages.length };
          }
          if (/SELECT id FROM promotion_usages WHERE order_id = \? AND promotion_id = \?/i.test(sql)) {
            return null;
          }
          if (/SELECT \* FROM referrals WHERE id = \? AND status = \?/i.test(sql)) {
            const rid = String(args[0]);
            const st = String(args[1]);
            if (/COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
              const tid = String(args[2]);
              return (
                referrals.find(
                  (r) =>
                    r.id === rid &&
                    r.status === st &&
                    String(r.tenant_id || 'default').trim() === tid
                ) ?? null
              );
            }
            return referrals.find((r) => r.id === rid && r.status === st) ?? null;
          }
          if (/SELECT \* FROM referrals WHERE referred_customer_id = \? AND status = \?/i.test(sql)) {
            const cid = String(args[0]);
            const st = String(args[1]);
            if (/COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
              const tid = String(args[2]);
              return (
                referrals.find(
                  (r) =>
                    r.referred_customer_id === cid &&
                    r.status === st &&
                    String(r.tenant_id || 'default').trim() === tid
                ) ?? null
              );
            }
            return referrals.find((r) => r.referred_customer_id === cid && r.status === st) ?? null;
          }
          if (/SELECT \* FROM loyalty_accounts WHERE customer_id = \?/i.test(sql)) {
            const cid = String(args[0]);
            const tid = args[1] ? String(args[1]) : 'default';
            return loyaltyAccounts.find((a) => a.customer_id === cid && String(a.tenant_id || 'default') === tid) ?? null;
          }
          if (/FROM customers WHERE id = \?/i.test(sql)) {
            return {
              id: String(args[0]),
              customer_id: String(args[0]),
              points_balance: 0,
              lifetime_points: 0,
              tier: 'bronze',
              referral_code: 'REF123',
              tenant_id: 'default',
            };
          }
          if (/SELECT id, total, status(?:, table_id)?(?:, tenant_id)? FROM orders WHERE id = \?/i.test(sql)) {
            return { id: String(args[0]), total: 80000, status: 'pending', table_id: null, tenant_id: 'default' };
          }
          if (/SELECT \* FROM cashback_wallets WHERE customer_id = \?/i.test(sql)) {
            const cid = String(args[0]);
            const tid = String(args[1] || 'default');
            return cashbackWallets.find((w) => w.customer_id === cid && String(w.tenant_id || 'default') === tid) ?? null;
          }
          if (/SELECT id FROM cashback_transactions WHERE order_id = \?/i.test(sql)) {
            return null;
          }
          if (/SELECT \* FROM inventory_items WHERE id = \?/i.test(sql)) {
            return {
              id: String(args[0]),
              sku: 'MILK-01',
              name: 'Sữa Đặc',
              current_stock: 20,
              unit: 'lon',
              min_stock: 5,
              tenant_id: 'default',
            };
          }
          if (/SELECT id, sku, name, current_stock, unit, tenant_id FROM inventory_items/i.test(sql)) {
            return {
              id: 'inv_ac3_1',
              sku: 'MILK-01',
              name: 'Sữa Đặc',
              current_stock: 20,
              unit: 'lon',
              tenant_id: 'default',
            };
          }
          if (/SELECT tenant_id FROM orders WHERE id = \?/i.test(sql)) {
            return { tenant_id: null };
          }
          if (/SELECT id, role, tenant_id FROM users WHERE id = \?/i.test(sql)) {
            if (args[0] === 'staff_foreign_sadec') {
              return { id: 'staff_foreign_sadec', role: 'waiter', tenant_id: 'tenant_sadec_02' };
            }
            return { id: String(args[0]), role: 'waiter', tenant_id: 'default' };
          }
          if (/SELECT \* FROM table_sessions WHERE id = \?/i.test(sql)) {
            return tableSessions.find((s) => s.id === args[0]) ?? null;
          }
          if (/SELECT \* FROM cafe_tables WHERE id = \?/i.test(sql)) {
            return { id: String(args[0]), status: 'Available', tenant_id: 'default' };
          }
          if (/SELECT \* FROM orders WHERE id = \?/i.test(sql)) {
            return {
              id: String(args[0]),
              customer_id:
                args[0] === '33333333-3333-4333-8333-333333333333' ? 'cust_spend_ac2' : 'cust_shared_ac2',
              total: 50000,
              total_amount: 50000,
              cashback_used: 0,
              status: 'pending',
              payment_status: 'unpaid',
              tenant_id: 'default',
            };
          }
          return null;
        },
        all: async () => {
          executedSqls.push({ sql, args });
          if (/FROM reservations r/i.test(sql)) {
            return { results: [] };
          }
          return { results: [] };
        },
        run: async () => {
          executedSqls.push({ sql, args });
          if (/INSERT INTO menu_items/i.test(sql)) {
            menuItems.push({
              id: args[0],
              category: args[1],
              name: args[2],
              tenant_id: args[9],
            });
          }
          if (/INSERT INTO promotion_usages/i.test(sql)) {
            const hasTenant = /tenant_id/i.test(sql);
            promotionUsages.push({
              id: args[0],
              promotion_id: args[1],
              order_id: args[2],
              customer_id: args[3],
              discount_amount: args[4],
              tenant_id: hasTenant ? args[5] : 'unset',
            });
          }
          if (/UPDATE promotion_usages SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = promotionUsages.find((u) => u.id === args[1]);
            if (row) row.tenant_id = args[0];
          }
          if (/INSERT INTO referrals/i.test(sql)) {
            referrals.push({
              id: args[0],
              referrer_id: args[1],
              referred_customer_id: args[2],
              referral_code: args[3],
              tenant_id: 'unset',
            });
          }
          if (/UPDATE referrals SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = referrals.find((r) => r.id === args[1]);
            if (row) row.tenant_id = args[0];
          }
          if (/INSERT(?: OR IGNORE)? INTO loyalty_accounts/i.test(sql)) {
            loyaltyAccounts.push({
              id: args[0],
              customer_id: args[1],
              points_balance: args[2] ?? 0,
              lifetime_points: args[3] ?? 0,
              tier: args[4] ?? 'bronze',
              tenant_id: 'unset',
            });
          }
          if (/UPDATE loyalty_accounts SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = loyaltyAccounts.find((a) => a.id === args[1]);
            if (row) row.tenant_id = args[0];
          }
          if (/INSERT INTO loyalty_transactions/i.test(sql)) {
            loyaltyTxs.push({
              id: args[0],
              account_id: args[1],
              customer_id: args[2],
              type: args[3],
              points: args[4],
              tenant_id: 'unset',
            });
          }
          if (/UPDATE loyalty_transactions SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = loyaltyTxs.find((t) => t.id === args[1]);
            if (row) row.tenant_id = args[0];
          }
          if (/INSERT(?: OR IGNORE)? INTO loyalty_point_logs/i.test(sql)) {
            loyaltyPointLogs.push({
              id: args[0],
              customer_id: args[1],
              order_id: args[2],
              points_change: args[3],
              tenant_id: 'unset',
            });
          }
          if (/UPDATE loyalty_point_logs SET tenant_id = \? WHERE id = \?/i.test(sql)) {
            const row = loyaltyPointLogs.find((l) => l.id === args[1]);
            if (row) row.tenant_id = args[0];
          }
          if (/INSERT INTO inventory_transactions/i.test(sql)) {
            const hasTenant = /tenant_id/i.test(sql);
            inventoryTxRows.push({
              id: args[0],
              item_id: args[1],
              type: args[2],
              quantity: args[3],
              tenant_id: hasTenant ? args[args.length - 1] : 'unset',
            });
          }
          if (/INSERT INTO stock_movements/i.test(sql)) {
            const hasTenant = /tenant_id/i.test(sql);
            stockMovementRows.push({
              id: args[0],
              ingredient_id: args[1],
              type: args[2],
              quantity: args[3],
              tenant_id: hasTenant ? args[args.length - 1] : 'unset',
            });
          }
          return { success: true, meta: { changes: 1 } };
        },
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => makeStmt(sql, [])),
        batch: vi.fn(async (stmts: Array<{ sql: string; args: unknown[]; run: () => Promise<any> }>) => {
          for (const s of stmts) {
            if (typeof s.run === 'function') {
              await s.run();
            } else {
              executedSqls.push({ sql: s.sql, args: s.args });
            }
          }
          return stmts.map(() => ({ success: true, meta: { changes: 1 } }));
        }),
      };

      const defEnv = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb as any,
        PILOT_TENANT_ID: 'default',
        ENVIRONMENT: 'test',
      });

      // 1. AC1: resolveOrderCreationScope preserves non-staff actor.tenantId & resolves guest/customer X-Tenant-ID
      const nonStaffConcrete = await resolveOrderCreationScope(
        new Request('https://api.test/api/orders', { method: 'POST' }),
        defEnv as any,
        { id: 'u_guest', tenantId: 'tenant_sadec_02' }
      );
      expect(nonStaffConcrete.tenantId).toBe('tenant_sadec_02');

      const guestHeaderTenant = await resolveOrderCreationScope(
        new Request('https://api.test/api/orders', {
          method: 'POST',
          headers: { 'X-Tenant-ID': 'tenant_sadec_02' },
        }),
        defEnv as any,
        { id: 'u_cust', role: 'customer', tenantId: 'default' }
      );
      expect(guestHeaderTenant.tenantId).toBe('tenant_sadec_02');

      // AC1: GET /api/reservations pushes tenant_id into SQL before LIMIT/OFFSET
      const resApp = new Hono<{ Bindings: Env }>();
      resApp.route('/api/reservations', reservationsRouter);
      executedSqls.length = 0;
      const listRes = await resApp.fetch(
        await authRequest('GET', '/api/reservations?limit=10&offset=0', 'manager', 'default'),
        defEnv
      );
      expect(listRes.status).toBe(200);
      expect(
        executedSqls.some(
          (q) =>
            /FROM reservations r/i.test(q.sql) &&
            q.sql.includes("AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ? ORDER BY") &&
            q.args.includes('default')
        )
      ).toBe(true);

      // AC1: Table sessions POST /:id/orders scopes UPDATE orders & UPDATE table_sessions by tenant_id
      const sessOrderApp = new Hono<{ Bindings: Env }>();
      sessOrderApp.use('*', async (c, next) => {
        c.set('tenantId' as any, 'default');
        await next();
      });
      registerOrderHandlers(sessOrderApp);
      registerSessionHandlers(sessOrderApp);
      executedSqls.length = 0;
      const linkOrdRes = await sessOrderApp.fetch(
        new Request('https://api.test/tsess_def_ac1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord_ac1_1' }),
        }),
        defEnv
      );
      expect(linkOrdRes.status).toBe(200);
      expect(
        executedSqls.some(
          (q) =>
            /UPDATE orders SET table_id = \?, updated_at = \? WHERE id = \?[\s\S]*COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(q.sql) &&
            q.args[3] === 'default'
        )
      ).toBe(true);
      expect(
        executedSqls.some(
          (q) =>
            /UPDATE table_sessions[\s\S]*WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(q.sql) &&
            q.args[3] === 'default'
        )
      ).toBe(true);

      // 2. AC2: syncProductToMenuProjection propagates products.tenant_id into menu_items
      await syncProductToMenuProjection(mockDb as any, 'prod_sadec_ac2');
      expect(menuItems[0]?.tenant_id).toBe('tenant_sadec_02');

      // AC2: Promotions usage-handlers scopes promotion_usages count for 'default' tenant & stamps tenant_id = 'default'
      const promoUuid = '11111111-1111-4111-8111-111111111111';
      const orderUuid = '22222222-2222-4222-8222-222222222222';
      promotionUsages.push({
        id: 'pu_fran_1',
        promotion_id: promoUuid,
        order_id: 'ord_fran_1',
        customer_id: 'cust_shared_ac2',
        discount_amount: 10000,
        tenant_id: 'tenant_sadec_02',
      });
      const promoApp = new OpenAPIHono<{ Bindings: Env }>();
      promoApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'cust_shared_ac2', customerId: 'cust_shared_ac2', role: 'customer', tenantId: 'default' });
        c.set('tenantId' as any, 'default');
        await next();
      });
      registerUsageHandlers(promoApp as any);
      const applyPromoRes = await promoApp.fetch(
        new Request('https://api.test/api/promotions/use', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promotionId: promoUuid,
            orderId: orderUuid,
            discountAmount: 10000,
          }),
        }),
        defEnv
      );
      expect(applyPromoRes.status).toBe(200);
      expect(
        promotionUsages.find((u) => u.order_id === orderUuid)?.tenant_id
      ).toBe('default');

      // AC2: reverseReferralCashback & processReferralCashbackOnFirstOrder for 'default' tenant do NOT touch 'tenant_sadec_02' referral
      executedSqls.length = 0;
      const revRefRes = await reverseReferralCashback(
        mockDb as any,
        'ref_fran_ac2',
        'default'
      );
      expect(revRefRes.success).toBe(false);
      expect(referrals[0]?.status).toBe('completed');

      referrals.push({
        id: 'ref_fran_pending_ac2',
        referrer_id: 'cust_referrer_fran',
        referred_customer_id: 'cust_referred_shared',
        referral_code: 'FNB-FRAN99',
        status: 'pending',
        cashback_awarded_vnd: 0,
        tenant_id: 'tenant_sadec_02',
      });
      const procRefRes = await processReferralCashbackOnFirstOrder(
        mockDb as any,
        'cust_referred_shared',
        'ord_def_first',
        50000,
        'default'
      );
      expect(procRefRes.success).toBe(false);
      expect(referrals[1]?.status).toBe('pending');

      // AC2: Loyalty dual-write & handleSpendCashback stamp tenant_id = 'default' and scope UPDATE by tenant_id
      const { account: acc } = await getLoyaltyAccountWithFallback(
        mockDb as any,
        'cust_loy_ac2',
        '2026-11-03T00:00:00Z',
        'default'
      );
      expect(acc?.tenant_id).toBe('default');
      await syncLoyaltyAccountAndCustomerBalance(mockDb as any, {
        accountId: acc!.id,
        customerId: 'cust_loy_ac2',
        newBalance: 100,
        lifetimeDelta: 100,
        tenantId: 'default',
        now: '2026-11-03T00:00:00Z',
      });
      await recordLoyaltyTransactionDualWrite(mockDb as any, {
        txId: 'ltx_ac2_1',
        accountId: acc!.id,
        customerId: 'cust_loy_ac2',
        type: 'earn',
        points: 100,
        balanceAfter: 100,
        description: 'Earned 100 pts',
        orderId: 'ord_ac2_1',
        tenantId: 'default',
        now: '2026-11-03T00:00:00Z',
      });
      expect(loyaltyTxs[0]?.tenant_id).toBe('default');
      expect(loyaltyPointLogs[0]?.tenant_id).toBe('default');

      const spendApp = new Hono<{ Bindings: Env }>();
      spendApp.use('*', async (c, next) => {
        c.set('customer' as any, { id: 'cust_spend_ac2', phone: '0901234567', tenant_id: 'default' });
        await next();
      });
      spendApp.post('/loyalty/spend', (c) => handleSpendCashback(c as any));
      executedSqls.length = 0;
      const spendRes = await spendApp.fetch(
        new Request('https://api.test/loyalty/spend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: '33333333-3333-4333-8333-333333333333',
            amount: 15000,
          }),
        }),
        defEnv
      );
      expect(spendRes.status).toBe(200);
      expect(
        executedSqls.some(
          (q) =>
            /UPDATE orders SET cashback_used = \?[\s\S]*WHERE id = \? AND COALESCE\(cashback_used, 0\) = 0 AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(q.sql) &&
            q.args[4] === 'default'
        )
      ).toBe(true);

      // 3. AC3: inventoryTransactions blocks barista from 'in'/'adjust'/'release' (403) & allows 'waste' (201) with tenant_id stamped
      const invApp = new Hono<{ Bindings: Env }>();
      invApp.use('*', async (c, next) => {
        const role = c.req.header('X-Test-Role') || 'barista';
        c.set('user' as any, { id: 'staff_barista_1', role, tenantId: 'default' });
        c.set('tenantId' as any, 'default');
        await next();
      });
      inventoryTransactions(invApp as any);

      const baristaInRes = await invApp.fetch(
        new Request('https://api.test/inv_ac3_1/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Test-Role': 'barista' },
          body: JSON.stringify({ item_id: 'inv_ac3_1', type: 'in', quantity: 50, notes: 'Unauthorized restock' }),
        }),
        defEnv
      );
      expect(baristaInRes.status).toBe(403);

      const baristaWasteRes = await invApp.fetch(
        new Request('https://api.test/inv_ac3_1/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Test-Role': 'barista' },
          body: JSON.stringify({ item_id: 'inv_ac3_1', type: 'waste', quantity: 2, notes: 'Spilled milk' }),
        }),
        defEnv
      );
      expect(baristaWasteRes.status).toBe(201);
      expect(inventoryTxRows[0]?.tenant_id).toBe('default');

      // AC3: deductInventoryForOrder normalizes effectiveTenant = 'default' when orders.tenant_id is NULL
      executedSqls.length = 0;
      await deductInventoryForOrder(defEnv as any, 'ord_null_tenant_ac3', [
        { product_id: 'MILK-01', quantity: 2, name: 'Sữa Đặc' },
      ]);
      expect(
        executedSqls.some(
          (q) =>
            /SELECT id, sku, name, current_stock, unit, tenant_id FROM inventory_items[\s\S]*COALESCE\(NULLIF\(tenant_id, ''\), 'default'\) = \?/i.test(q.sql) &&
            q.args.includes('default')
        )
      ).toBe(true);

      // AC3: staffManagementDenial blocks supervisor from mutating staff & blocks owner from mutating admin
      expect(
        staffManagementDenial(
          { role: 'supervisor', tenantId: 'default' },
          { id: 'u_waiter', role: 'waiter', tenant_id: 'default', auth_version: 1, is_active: 1 } as any
        )
      ).toContain('Không đủ quyền');
      expect(
        staffManagementDenial(
          { role: 'owner', tenantId: 'default' },
          { id: 'u_admin', role: 'admin', tenant_id: 'default', auth_version: 1, is_active: 1 } as any
        )
      ).toContain('Chỉ admin');

      // AC3: GET /api/staff-tips blocks non-manager waiter from viewing another staff member's tips (403)
      const tipsApp = new Hono<{ Bindings: Env }>();
      tipsApp.route('/api/staff-tips', staffTipsRouter);
      activeStaffRole = 'waiter';
      activeStaffTenant = 'default';
      const crossTipsRes = await tipsApp.fetch(
        await authRequest('GET', '/api/staff-tips?staff_id=other_staff_99', 'waiter', 'default'),
        defEnv
      );
      expect(crossTipsRes.status).toBe(403);

      // AC3: recordViolation rejects foreign-tenant staffId with 404 SopAccessError
      await expect(
        recordViolation(
          {
            env: defEnv as any,
            tenantId: 'default',
            actorId: 'mgr_def_1',
            actorRole: 'manager',
            canManage: true,
          },
          {
            staffId: 'staff_foreign_sadec',
            category: 'lateness' as any,
            note: 'Cross-tenant violation attempt',
          }
        )
      ).rejects.toThrow('Staff member not found');

      // AC3: GET /api/analytics/export blocks non-manager waiter with 403
      const expApp = new Hono<{ Bindings: Env }>();
      expApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'w1', role: 'waiter', tenantId: 'default' });
        c.set('tenantId' as any, 'default');
        await next();
      });
      registerExportHandlers(expApp);
      const expRes = await expApp.fetch(
        new Request('https://api.test/export?start=2026-11-01&end=2026-11-02'),
        defEnv
      );
      expect(expRes.status).toBe(403);
    });
  });

  describe('Suite 33 — Phase AD1–AD3: Payment Reconcile, Invoices, ERPNext, Webhooks, CRM/Customer, Tables, Shifts, Kitchen & Inventory Isolation', () => {
    it('AD1: runPaymentReconciliation, listInvoices/payInvoice, handleErpnextInvoicesRequest, and Cal/Pretix webhooks enforce SQL-before-LIMIT tenant isolation and default tenant stamping', async () => {
      const { Hono } = await import('hono');
      const { runPaymentReconciliation } = await import('../../routes/cron-handlers/payment-reconcile');
      const { listInvoices, payInvoice } = await import('../../tree/subscriptions/invoice-handlers');
      const { handleErpnextInvoicesRequest } = await import('../../routes/erpnext-invoices');
      const { createReservationFromBooking } = await import('../../tree/cal-booking/process-booking');
      const { registerWebhookHandler: registerPretixWebhookHandler } = await import('../../routes/pretix-handlers/webhook-handler');
      const { computeHmacSha256 } = await import('@aura/domain-security');

      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];
      const insertedReservations: Array<Record<string, unknown>> = [];
      const insertedPretixLogs: Array<Record<string, unknown>> = [];

      const db = {
        prepare: (sql: string) => {
          const runWith = (args: unknown[]) => {
            executedSqls.push({ sql, args });
            return {
              first: async () => {
                if (/FROM subscription_invoices WHERE id = \?/i.test(sql)) {
                  return { id: String(args[0]), subscription_id: 'sub_ad1_1', amount_vnd: 500000, status: 'pending', tenant_id: 'default' };
                }
                if (/FROM subscriptions WHERE id = \?/i.test(sql)) {
                  return { id: 'sub_ad1_1', tenant_id: 'default', status: 'active' };
                }
                if (/FROM cafe_tables/i.test(sql)) {
                  return { id: 'tbl_ad1_1', capacity: 4, status: 'available', tenant_id: 'default' };
                }
                return null;
              },
              all: async () => {
                if (/FROM payments p[\s\S]*JOIN orders o/i.test(sql)) {
                  const hasTenantFilter = /COALESCE\(NULLIF\(TRIM\(o\.tenant_id\), ''\), 'default'\) = \?/i.test(sql);
                  return {
                    results: hasTenantFilter
                      ? [{ payment_id: 'pay_sadec_1', status: 'completed', order_payment_status: 'pending', order_tenant_id: 'sadec', created_at: '2026-11-01T00:00:00Z' }]
                      : [],
                  };
                }
                if (/FROM subscription_invoices i/i.test(sql)) {
                  const hasTenantFilter = /COALESCE\(s\.tenant_id, i\.tenant_id\)/i.test(sql);
                  return {
                    results: hasTenantFilter
                      ? [{ id: 'inv_sadec_1', subscription_id: 'sub_sadec_1', sub_tenant_id: 'sadec', status: 'pending' }]
                      : [],
                  };
                }
                if (/FROM erpnext_mappings m/i.test(sql)) {
                  const hasTenantFilter = /COALESCE\(m\.tenant_id, o\.tenant_id\)/i.test(sql);
                  return {
                    results: hasTenantFilter
                      ? [{ id: 'map_sadec_1', order_id: 'ord_sadec_1', local_id: 'ord_sadec_1', sync_status: 'failed', tenant_id: 'sadec' }]
                      : [],
                  };
                }
                if (/FROM cafe_tables/i.test(sql)) {
                  return { results: [{ id: 'tbl_ad1_1', table_number: 'T1', capacity: 4, status: 'available', tenant_id: 'default' }] };
                }
                return { results: [] };
              },
              run: async () => {
                if (/INSERT INTO reservations/i.test(sql) && /tenant_id/i.test(sql)) {
                  insertedReservations.push({ sql, args });
                }
                if (/INSERT INTO pretix_webhook_log/i.test(sql) && /tenant_id/i.test(sql)) {
                  insertedPretixLogs.push({ sql, args });
                }
                return { success: true, meta: { changes: 1 } };
              },
            };
          };
          return {
            bind: (...args: unknown[]) => runWith(args),
            first: () => runWith([]).first(),
            all: () => runWith([]).all(),
            run: () => runWith([]).run(),
          };
        },
      } as unknown as D1Database;

      // 1. runPaymentReconciliation pushes tenant predicate into SQL before LIMIT 25
      await runPaymentReconciliation(
        {
          AURA_DB: db,
          PAYOS_CLIENT_ID: 'cid',
          PAYOS_API_KEY: 'key',
          PAYOS_CHECKSUM_KEY: 'chk',
        } as any,
        { tenantId: 'sadec', budgetMs: 1 }
      );
      expect(
        executedSqls.some(
          (q) =>
            /FROM payments p[\s\S]*COALESCE\(NULLIF\(TRIM\(o\.tenant_id\), ''\), 'default'\) = \?[\s\S]*LIMIT 25/i.test(q.sql) &&
            q.args.includes('sadec')
        )
      ).toBe(true);

      // 2. listInvoices & payInvoice scope SQL by tenant_id
      const subApp = new Hono<{ Bindings: Env }>();
      subApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'adm_1', role: 'admin', tenantId: 'sadec' });
        c.set('tenantId' as any, 'sadec');
        await next();
      });
      subApp.get('/invoices', (c) => listInvoices(c as any));
      subApp.post('/invoices/:id/pay', (c) => payInvoice(c as any));

      const invListRes = await subApp.fetch(new Request('https://api.test/invoices'), { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as any);
      expect(invListRes.status).toBe(200);
      const invListJson = (await invListRes.json()) as { data: Array<{ id: string }> };
      expect(invListJson.data.map((r) => r.id)).toEqual(['inv_sadec_1']);

      // 3. handleErpnextInvoicesRequest pushes tenant predicate into GET /list before LIMIT 100
      const erpListRes = await handleErpnextInvoicesRequest(
        new Request('https://api.test/api/erpnext-invoices/list'),
        { AURA_DB: db },
        'sadec'
      );
      expect(erpListRes.status).toBe(200);
      const erpListJson = (await erpListRes.json()) as { data: Array<{ id: string }> };
      expect(erpListJson.data.map((r) => r.id)).toEqual(['map_sadec_1']);

      // 4. createReservationFromBooking and Pretix webhook stamp 'default' tenant_id
      await createReservationFromBooking(
        db,
        {
          uid: 'cal_uid_def_ad1',
          title: 'Table Booking',
          startTime: '2026-11-04T10:00:00Z',
          endTime: '2026-11-04T11:00:00Z',
          attendees: [{ name: 'Khách Default', email: 'def@aura.test', phoneNumber: '0901112233' }],
        },
        'default'
      );
      expect(insertedReservations.some((r) => r.args.includes('default'))).toBe(true);

      const pretixApp = new Hono<{ Bindings: Env }>();
      registerPretixWebhookHandler(pretixApp as any);
      const pretixBody = JSON.stringify({ notification_id: 101, organizer: 'aura', event: 'tasting', code: 'ORD1', action: 'pretix.event.order.paid' });
      const pretixSig = await computeHmacSha256(pretixBody, 'pretix_sec_ad1');
      await pretixApp.fetch(
        new Request('https://api.test/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-pretix-Signature': pretixSig },
          body: pretixBody,
        }),
        { AURA_DB: db, PRETIX_WEBHOOK_SECRET: 'pretix_sec_ad1' } as any
      );
      expect(insertedPretixLogs.some((r) => r.args.includes('default'))).toBe(true);
    });

    it('AD2: CRM segments, customer domain default-tenant stamping, consent RBAC/tenant scoping, and lookupProfile/aggregateEvents enforce tenant isolation', async () => {
      const { Hono } = await import('hono');
      const { registerSegmentHandlers } = await import('../../routes/crm-handlers/segment-handlers');
      const { registerAccountHandlers } = await import('../../routes/crm-handlers/account-handlers');
      const { recordConsent } = await import('../../../../packages/domain/customer/record-consent');
      const { identifyCustomer } = await import('../../../../packages/domain/customer/identify-customer');
      const { recordVisit } = await import('../../../../packages/domain/customer/record-visit');
      const { linkOrder } = await import('../../../../packages/domain/customer/link-order');
      const { lookupProfile } = await import('../../../../packages/domain/crm/lookup-profile');
      const { aggregateEvents } = await import('../../../../packages/domain/crm/commands/aggregate-events');

      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];
      let activeRole = 'manager';
      let activeTenant = 'sadec';

      const db = {
        prepare: (sql: string) => {
          const runWith = (args: unknown[]) => {
            executedSqls.push({ sql, args });
            return {
              first: async () => {
                if (isAccountLookup(sql)) {
                  return staffAccountRow(activeRole, activeTenant);
                }
                if (/FROM customers WHERE id = \?/i.test(sql)) {
                  return { id: String(args[0]), name: 'Khách A', phone: '0909000111', tenant_id: activeTenant, loyalty_points: 100 };
                }
                if (/FROM customer_identities ci[\s\S]*LEFT JOIN customers c/i.test(sql)) {
                  return { customer_id: 'cust_sadec_1', value: '0909000111' };
                }
                return null;
              },
              all: async () => {
                if (/FROM customers c[\s\S]*LEFT JOIN orders o/i.test(sql)) {
                  const hasTenantWhere = /COALESCE\(NULLIF\((?:TRIM\()?c\.tenant_id\)?, ''\), 'default'\) = \?/i.test(sql);
                  if (!hasTenantWhere) return { results: [] };
                  // Return 30 matching customers for sadec so count > 25 sample cap
                  return {
                    results: Array.from({ length: 30 }, (_, i) => ({
                      id: `cust_sadec_${i + 1}`,
                      name: `Khách ${i + 1}`,
                      phone: `09090001${String(i).padStart(2, '0')}`,
                      tier: 'gold',
                      lifetime_points: 1500,
                      order_count: 10,
                      last_order_at: new Date().toISOString(),
                      first_order_at: new Date().toISOString(),
                    })),
                  };
                }
                if (/SELECT id, tenant_id FROM customers/i.test(sql)) {
                  return {
                    results: Array.from({ length: 30 }, (_, i) => ({
                      id: `cust_sadec_${i + 1}`,
                      tenant_id: 'sadec',
                    })),
                  };
                }
                return { results: [] };
              },
              run: async () => ({ success: true, meta: { changes: 1 } }),
            };
          };
          return {
            bind: (...args: unknown[]) => runWith(args),
            first: () => runWith([]).first(),
            all: () => runWith([]).all(),
            run: () => runWith([]).run(),
          };
        },
      } as unknown as D1Database;

      const crmEnv = {
        AURA_DB: db,
        AUTH_KV: createMockEnv().AUTH_KV,
        JWT_SECRET: TEST_JWT_SECRET,
      } as unknown as Env;

      // 5. GET /api/crm/segments passes tenantId to listSegments and preserves full count (30) instead of truncating to 25
      const segApp = new Hono<{ Bindings: Env }>();
      segApp.use('*', async (c, next) => {
        c.set('tenantId' as any, activeTenant);
        await next();
      });
      registerSegmentHandlers(segApp);
      const segRes = await segApp.fetch(
        await authRequest('GET', '/segments', 'manager', 'sadec'),
        crmEnv
      );
      expect(segRes.status).toBe(200);
      const segJson = (await segRes.json()) as { data: Array<{ key: string; count: number; customers: unknown[] }> };
      const regularSeg = segJson.data.find((s) => s.key === 'regular');
      expect(regularSeg?.count).toBe(30);
      expect(regularSeg?.customers).toHaveLength(25);

      // 6. Customer domain commands stamp and scope 'default' tenant_id
      activeTenant = 'default';
      executedSqls.length = 0;
      await recordConsent({ db, customerId: 'cust_def_1', purpose: 'marketing', granted: true, source: 'staff', tenantId: 'default' });
      await identifyCustomer({ db, customerId: 'cust_def_1', phone: '0909123456', source: 'staff', tenantId: 'default' });
      await recordVisit({ db, customerId: 'cust_def_1', orderId: 'ord_def_1', spent: 55000, visitedAt: '2026-11-03T01:00:00Z', tenantId: 'default' });
      await linkOrder({ db, customerId: 'cust_def_1', orderId: 'ord_def_1', tenantId: 'default' });

      expect(executedSqls.some((q) => /INSERT INTO consents[\s\S]*tenant_id/i.test(q.sql) && q.args.includes('default'))).toBe(true);
      expect(executedSqls.some((q) => /INSERT INTO customer_identities[\s\S]*tenant_id/i.test(q.sql) && q.args.includes('default'))).toBe(true);
      expect(executedSqls.some((q) => /INSERT INTO visits[\s\S]*tenant_id/i.test(q.sql) && q.args.includes('default'))).toBe(true);
      expect(executedSqls.some((q) => /INSERT INTO customer_events[\s\S]*tenant_id/i.test(q.sql) && q.args.includes('default'))).toBe(true);

      // 7. PATCH /api/crm/account/consent blocks waiter (403) and stamps tenant_id for authorized staff
      const acctApp = new Hono<{ Bindings: Env }>();
      acctApp.use('*', async (c, next) => {
        c.set('tenantId' as any, activeTenant);
        await next();
      });
      registerAccountHandlers(acctApp);
      activeRole = 'waiter';
      const waiterConsentRes = await acctApp.fetch(
        await authRequest('PATCH', '/account/consent', 'waiter', 'default', {
          customerId: 'cust_def_1',
          purpose: 'marketing',
          granted: true,
        }),
        crmEnv
      );
      expect(waiterConsentRes.status).toBe(403);

      activeRole = 'manager';
      executedSqls.length = 0;
      const mgrConsentRes = await acctApp.fetch(
        await authRequest('PATCH', '/account/consent', 'manager', 'default', {
          customerId: 'cust_def_1',
          purpose: 'marketing',
          granted: true,
        }),
        crmEnv
      );
      expect(mgrConsentRes.status).toBe(200);
      expect(executedSqls.some((q) => /INSERT INTO consents[\s\S]*tenant_id/i.test(q.sql) && q.args.includes('default'))).toBe(true);

      // 8. lookupProfile & aggregateEvents scope customer_identities, consents, and visits by tenant_id
      activeTenant = 'sadec';
      executedSqls.length = 0;
      await lookupProfile(db, '0909000111', { tenantId: 'sadec' });
      expect(executedSqls.some((q) => /FROM customer_identities ci[\s\S]*LEFT JOIN customers c/i.test(q.sql) && q.args.includes('sadec'))).toBe(true);
      expect(executedSqls.some((q) => /FROM consents[\s\S]*COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(q.sql) && q.args.includes('sadec'))).toBe(true);

      executedSqls.length = 0;
      await aggregateEvents(db, 'cust_sadec_1', { tenantId: 'sadec' });
      expect(executedSqls.some((q) => /FROM visits[\s\S]*COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(q.sql) && q.args.includes('sadec'))).toBe(true);
    });

    it('AD3: Table zones/tables RBAC & SQL scoping, canonical shift lifecycle, kitchen station tickets RBAC, and PO/forecasting/inventory/notifications isolation', async () => {
      const { Hono } = await import('hono');
      const { OpenAPIHono } = await import('@hono/zod-openapi');
      const { registerZoneCrudHandlers } = await import('../../routes/openapi-tables-handlers/zone-crud-handlers');
      const { registerTableCrudHandlers } = await import('../../routes/openapi-tables-handlers/table-crud-handlers');
      const { openCanonicalShift, recordShiftSale, closeCanonicalShift } = await import('../../../../packages/domain/shift/src/policies/shift-lifecycle-policy');
      const { stationTicketsRouter } = await import('../../../../packages/domain/kitchen/commands/kitchen-station-tickets');
      const { inventoryForecastingRouter } = await import('../../routes/inventory-forecasting');
      const { inventorySnapshots } = await import('../../../../packages/domain/inventory/src/routes/inventory-snapshots');
      const { getNotifications, subscribePush } = await import('../../routes/notifications-mobile');

      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];
      const shiftsMap = new Map<string, Record<string, unknown>>();

      const db = {
        prepare: (sql: string) => {
          const runWith = (args: unknown[]) => {
            executedSqls.push({ sql, args });
            return {
              first: async () => {
                if (isAccountLookup(sql)) {
                  return staffAccountRow('manager', 'sadec');
                }
                if (/FROM staff_shifts WHERE id = \?/i.test(sql)) {
                  return shiftsMap.get(String(args[0])) ?? null;
                }
                if (/FROM inventory_items WHERE id = \?/i.test(sql)) {
                  return { id: String(args[0]), current_stock: 25, tenant_id: 'default' };
                }
                return null;
              },
              all: async () => {
                if (/FROM inventory_items/i.test(sql)) {
                  return {
                    results: [{ id: 'item_sadec_1', sku: 'SKU-1', name: 'Cà Phê Hạt', current_stock: 20, min_stock: 5, tenant_id: 'sadec' }],
                  };
                }
                if (/FROM inventory_transactions[\s\S]*GROUP BY item_id, tenant_id/i.test(sql)) {
                  return {
                    results: [{ item_id: 'item_sadec_1', total_depleted: 14, tenant_id: 'sadec' }],
                  };
                }
                if (/FROM notifications/i.test(sql)) {
                  const hasTenantFilter = /COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql);
                  return {
                    results: hasTenantFilter
                      ? [{ id: 'notif_sadec_1', type: 'shift', title_vi: 'Ca mới', title_en: 'New Shift', body_vi: null, body_en: null, data: '{}', read_at: null, created_at: '2026-11-03T01:00:00Z', tenant_id: 'sadec' }]
                      : [],
                  };
                }
                return { results: [] };
              },
              run: async () => {
                if (/INSERT INTO staff_shifts/i.test(sql) && /tenant_id/i.test(sql)) {
                  const id = String(args[0]);
                  shiftsMap.set(id, {
                    id,
                    staff_id: args[1],
                    staff_name: args[2],
                    role: args[3],
                    operating_unit_id: args[4],
                    tenant_id: args[args.length - 1],
                    status: 'open',
                    opening_cash: args[6],
                    total_sales: 0,
                    cash_sales: 0,
                    online_sales: 0,
                    order_count: 0,
                  });
                }
                return { success: true, meta: { changes: 1 } };
              },
            };
          };
          return {
            bind: (...args: unknown[]) => runWith(args),
            first: () => runWith([]).first(),
            all: () => runWith([]).all(),
            run: () => runWith([]).run(),
          };
        },
      } as unknown as D1Database;

      // 9. Zone & Table CRUD block non-manager ('staff' / 'waiter') on structural mutations
      const tblApp = new OpenAPIHono<{ Bindings: Env }>();
      tblApp.use('*', async (c, next) => {
        const role = c.req.header('X-Test-Role') || 'staff';
        c.set('user' as any, { id: 'u_tbl', role, tenantId: 'default' });
        c.set('tenantId' as any, 'default');
        await next();
      });
      registerZoneCrudHandlers(tblApp);
      registerTableCrudHandlers(tblApp);

      const staffZonePost = await tblApp.fetch(
        new Request('https://api.test/api/table-zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Test-Role': 'staff' },
          body: JSON.stringify({ name: 'Tầng 2', slug: 'floor-2' }),
        }),
        { AURA_DB: db } as any
      );
      expect(staffZonePost.status).toBe(403);

      const waiterBulkStatus = await tblApp.fetch(
        new Request('https://api.test/api/tables/bulk-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Test-Role': 'waiter' },
          body: JSON.stringify({ tableIds: ['tbl_1'], status: 'available' }),
        }),
        { AURA_DB: db } as any
      );
      expect(waiterBulkStatus.status).toBe(403);

      // 10. Canonical shift lifecycle stamps tenant_id and blocks cross-tenant recordShiftSale & closeCanonicalShift
      const opened = await openCanonicalShift(db, {
        staffId: 'staff_sadec_1',
        staffName: 'Thu Ngân Sa Đéc',
        role: 'cashier',
        operatingUnitId: 'sadec',
        tenantId: 'sadec',
        openingCash: 500000,
      });
      expect(opened.ok).toBe(true);
      const shiftId = opened.shift!.id;
      expect(shiftsMap.get(shiftId)?.tenant_id).toBe('sadec');

      const foreignSale = await recordShiftSale(db, {
        shiftId,
        orderId: 'ord_foreign_1',
        amount: 100000,
        paymentMethod: 'cash',
        tenantId: 'default',
      });
      expect(foreignSale.ok).toBe(false);
      expect(foreignSale.error).toBe('shift_not_found');

      const mismatchedStaffSale = await recordShiftSale(db, {
        shiftId,
        orderId: 'ord_sadec_1',
        amount: 100000,
        paymentMethod: 'cash',
        staffId: 'other_cashier_99',
        tenantId: 'sadec',
      });
      expect(mismatchedStaffSale.ok).toBe(false);
      expect(mismatchedStaffSale.error).toBe('shift_staff_mismatch');

      const foreignClose = await closeCanonicalShift(db, {
        shiftId,
        closedByStaffId: 'mgr_default_1',
        closedByRole: 'manager',
        actualCash: 500000,
        tenantId: 'default',
      });
      expect(foreignClose.ok).toBe(false);
      expect(foreignClose.error).toBe('shift_not_found');

      // 11. Kitchen station tickets block 'waiter' from starting KDS items (403)
      const kdsTktApp = new Hono<{ Bindings: Env }>();
      kdsTktApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'w_1', role: 'waiter', tenantId: 'default' });
        c.set('tenantId' as any, 'default');
        await next();
      });
      kdsTktApp.route('/', stationTicketsRouter);
      const waiterStartRes = await kdsTktApp.fetch(
        new Request('https://api.test/tickets/ord_1/items/itm_1/start?station_id=KS-1', { method: 'POST' }),
        { AURA_DB: db } as any
      );
      expect(waiterStartRes.status).toBe(403);

      // 12. Inventory forecasting selects tenant_id in inventory_transactions, inventorySnapshots blocks waiter (403), and mobile notifications scope/stamp tenant_id
      const forecastApp = new Hono<{ Bindings: Env }>();
      forecastApp.use('*', async (c, next) => {
        c.set('tenantId' as any, 'sadec');
        await next();
      });
      forecastApp.route('/', inventoryForecastingRouter);
      const runRateRes = await forecastApp.fetch(
        await authRequest('GET', '/run-rate?days=7', 'manager', 'sadec'),
        { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as any
      );
      expect(runRateRes.status).toBe(200);
      const runRateJson = (await runRateRes.json()) as { data: Array<{ item_id: string; daily_run_rate: number }> };
      expect(runRateJson.data[0]?.item_id).toBe('item_sadec_1');
      expect(runRateJson.data[0]?.daily_run_rate).toBe(2);

      const snapApp = new Hono<{ Bindings: Env }>();
      snapApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'w_1', role: 'waiter', tenantId: 'default' });
        c.set('tenantId' as any, 'default');
        await next();
      });
      inventorySnapshots(snapApp as any);
      const waiterSnapRes = await snapApp.fetch(
        new Request('https://api.test/inv_1/snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ closing_stock: 10 }),
        }),
        { AURA_DB: db } as any
      );
      expect(waiterSnapRes.status).toBe(403);

      const notifApp = new Hono<{ Bindings: Env }>();
      notifApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'u_mob_1', role: 'staff', tenantId: c.req.header('X-Test-Tenant') || 'default' });
        c.set('tenantId' as any, c.req.header('X-Test-Tenant') || 'default');
        await next();
      });
      notifApp.get('/notifications', (c) => getNotifications(c as any));
      notifApp.post('/subscribe', (c) => subscribePush(c as any));

      const notifRes = await notifApp.fetch(
        new Request('https://api.test/notifications', { headers: { 'X-Test-Tenant': 'sadec' } }),
        { AURA_DB: db } as any
      );
      expect(notifRes.status).toBe(200);
      const notifJson = (await notifRes.json()) as { notifications: Array<{ id: string }> };
      expect(notifJson.notifications.map((n) => n.id)).toEqual(['notif_sadec_1']);

      executedSqls.length = 0;
      const subPushRes = await notifApp.fetch(
        new Request('https://api.test/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Test-Tenant': 'default' },
          body: JSON.stringify({
            endpoint: 'https://push.example.com/sub/1',
            keys: { p256dh: 'k_p256', auth: 'k_auth' },
          }),
        }),
        { AURA_DB: db } as any
      );
      expect(subPushRes.status).toBe(201);
      expect(
        executedSqls.some(
          (q) =>
            /INSERT INTO push_subscriptions[\s\S]*tenant_id\s*=\s*excluded\.tenant_id/i.test(q.sql) &&
            q.args.includes('default')
        )
      ).toBe(true);
    });
  });

  // =========================================================================
  // Suite 34 — Phase AE1–AE3: Analytics/Metrics/Inventory/Cron, Table Sessions/
  // Reservations/Floor Plan & Reviews/Push/Zalo/Staff/POS Isolation
  // =========================================================================
  describe('Suite 34 — Phase AE1–AE3: Analytics/Metrics/Inventory/Cron, Table Sessions/Reservations/Floor Plan & Reviews/Push/Zalo/Staff/POS Isolation', () => {
    it('AE1: scopes getMetricSummary by tenant_id, pushes tenant_id into movement/ingredient/supplier & cron queries before LIMIT, and blocks waiter/cashier on analytics/reports', async () => {
      const { Hono } = await import('hono');
      const { getMetricSummary } = await import('../../lib/metrics-collector');
      const { registerMovementHandlers } = await import('../../routes/openapi-inventory-handlers/movement-handlers');
      const { registerSummaryHandlers } = await import('../../routes/openapi-cron-handlers/summary-handlers');
      const analyticsRouter = (await import('../../routes/analytics-handlers/routes')).default;
      const reportsRouter = (await import('../../routes/reports-handlers/routes')).default;

      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];
      const db: D1Database = {
        prepare(sql: string) {
          const run = (args: unknown[]) => {
            executedSqls.push({ sql, args });
            return {
              async first<T>() {
                if (/FROM users WHERE id = \?/i.test(sql) || /FROM staff WHERE id = \?/i.test(sql)) {
                  const id = String(args[0] || 'mgr_1');
                  const role = id.includes('waiter') ? 'waiter' : 'manager';
                  const tenant = id.includes('sadec') ? 'sadec' : 'default';
                  return { id, role, is_active: 1, auth_version: 1, tenant_id: tenant } as unknown as T;
                }
                if (/FROM _metrics/i.test(sql) && /AVG\(value\)/i.test(sql)) {
                  const tenantArg = args[2];
                  if (tenantArg === 'sadec') {
                    return { avg: 120, max: 150, min: 90, count: 2 } as unknown as T;
                  }
                  return { avg: 500, max: 900, min: 100, count: 10 } as unknown as T;
                }
                if (/SELECT COUNT\(\*\)\s+as\s+total\s+FROM\s+stock_movements/i.test(sql)) {
                  return { total: sql.includes('sm.tenant_id') ? 1 : 99 } as unknown as T;
                }
                return null;
              },
              async all<T>() {
                if (/FROM stock_movements sm/i.test(sql)) {
                  if (sql.includes('sm.tenant_id') && args.includes('sadec')) {
                    return {
                      results: [
                        {
                          id: 'mov_sadec_1',
                          ingredient_id: 'ing_sadec_1',
                          ingredient_name: 'Matcha',
                          type: 'waste',
                          quantity: -2,
                          tenant_id: 'sadec',
                          created_at: '2026-11-03T00:00:00Z',
                        },
                      ],
                    } as unknown as D1Result<T>;
                  }
                  return { results: [] } as unknown as D1Result<T>;
                }
                if (/FROM cron_jobs/i.test(sql)) {
                  if (sql.includes('tenant_id') && args.includes('sadec')) {
                    return {
                      results: [
                        { id: 'job_sadec_1', name: 'Sadec Reconcile', status: 'active', tenant_id: 'sadec' },
                      ],
                    } as unknown as D1Result<T>;
                  }
                  return { results: [] } as unknown as D1Result<T>;
                }
                if (/FROM cron_runs/i.test(sql)) {
                  if (sql.includes('tenant_id') && args.includes('sadec')) {
                    return {
                      results: [
                        {
                          id: 'run_sadec_1',
                          job_id: 'job_sadec_1',
                          status: 'success',
                          duration_ms: 45,
                          started_at: '2026-11-03T01:00:00Z',
                          tenant_id: 'sadec',
                        },
                      ],
                    } as unknown as D1Result<T>;
                  }
                  return { results: [] } as unknown as D1Result<T>;
                }
                return { results: [] } as unknown as D1Result<T>;
              },
              async run() {
                return { success: true, meta: { changes: 1 } } as unknown as D1Result;
              },
            };
          };
          return {
            bind: (...args: unknown[]) => run(args),
            first: <T>() => run([]).first<T>(),
            all: <T>() => run([]).all<T>(),
            run: () => run([]).run(),
          } as unknown as D1PreparedStatement;
        },
      } as unknown as D1Database;

      const summary = await getMetricSummary(db, 'revenue', '24h', 'sadec');
      expect(summary.count).toBe(2);
      expect(summary.avg).toBe(120);
      expect(
        executedSqls.some(
          (q) => /FROM _metrics/i.test(q.sql) && q.sql.includes("tags ->> '$.tenant_id'") && q.args.includes('sadec')
        )
      ).toBe(true);

      const { OpenAPIHono } = await import('@hono/zod-openapi');
      const invApp = new OpenAPIHono<{ Bindings: Env }>();
      invApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'mgr_sadec', role: 'manager', tenantId: 'sadec' });
        c.set('tenantId' as any, 'sadec');
        await next();
      });
      registerMovementHandlers(invApp as any);
      const movRes = await invApp.fetch(
        new Request('https://api.test/api/inventory/movements?type=waste&limit=10&page=1'),
        { AURA_DB: db } as any
      );
      expect(movRes.status).toBe(200);
      const movJson = (await movRes.json()) as { data: Array<{ id: string }>; meta: { total: number } };
      expect(movJson.data.map((m) => m.id)).toEqual(['mov_sadec_1']);
      expect(movJson.meta.total).toBe(1);

      const cronApp = new OpenAPIHono<{ Bindings: Env }>();
      cronApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'mgr_sadec', role: 'manager', tenantId: 'sadec' });
        c.set('tenantId' as any, 'sadec');
        await next();
      });
      registerSummaryHandlers(cronApp as any);
      const cronRes = await cronApp.fetch(
        new Request('https://api.test/api/cron/summary'),
        { AURA_DB: db } as any
      );
      expect(cronRes.status).toBe(200);
      const cronJson = (await cronRes.json()) as { data: { totalJobs: number; totalRuns: number } };
      expect(cronJson.data.totalJobs).toBe(1);
      expect(cronJson.data.totalRuns).toBe(1);

      const finApp = new Hono<{ Bindings: Env }>();
      finApp.route('/api/analytics', analyticsRouter);
      finApp.route('/api/reports', reportsRouter);

      const waiterAnalyticsReq = await authRequest('GET', '/api/analytics', 'waiter', 'default');
      const waiterAnalyticsRes = await finApp.fetch(waiterAnalyticsReq, { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as any);
      expect(waiterAnalyticsRes.status).toBe(403);

      const waiterReportsReq = await authRequest('GET', '/api/reports/daily', 'waiter', 'default');
      const waiterReportsRes = await finApp.fetch(waiterReportsReq, { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as any);
      expect(waiterReportsRes.status).toBe(403);
    });

    it('AE2: isolates table sessions, disambiguates table_number across tenants in table policies, and scopes reservation/Cal booking lookups', async () => {
      const { Hono } = await import('hono');
      const { registerSessionHandlers } = await import('../../routes/table-sessions-handlers/session-handlers');
      const { validateOrderTable } = await import('../../../../packages/domain/table/src/policies/table-availability-policy');
      const { releaseTable } = await import('../../../../packages/domain/table/src/policies/table-reservation-policy');
      const { registerBookingsHandler } = await import('../../routes/cal-booking-webhook-handlers/bookings-handler');

      let sadecTableStatus: 'Available' | 'Occupied' = 'Occupied';
      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];
      const db: D1Database = {
        prepare(sql: string) {
          const run = (args: unknown[]) => {
            executedSqls.push({ sql, args });
            return {
              async first<T>() {
                if (/FROM users WHERE id = \?/i.test(sql) || /FROM staff WHERE id = \?/i.test(sql)) {
                  const id = String(args[0] || 'mgr_sadec');
                  return { id, role: 'manager', is_active: 1, auth_version: 1, tenant_id: 'sadec' } as unknown as T;
                }
                if (/FROM cafe_tables WHERE id = \?/i.test(sql)) {
                  const id = String(args[0] || '');
                  if (id === 'tbl_sadec_1') {
                    return {
                      id: 'tbl_sadec_1',
                      table_number: 1,
                      capacity: 4,
                      status: sadecTableStatus,
                      is_active: 1,
                      tenant_id: 'sadec',
                      operating_unit_id: 'sadec',
                    } as unknown as T;
                  }
                  return null;
                }
                if (/FROM table_sessions WHERE table_id = \?/i.test(sql)) {
                  const tenantArg = args[args.length - 1];
                  if (tenantArg === 'sadec') return null;
                  return { id: 'sess_default_1', tenant_id: 'default' } as unknown as T;
                }
                return null;
              },
              async all<T>() {
                if (/FROM cafe_tables WHERE table_number = \?/i.test(sql)) {
                  return {
                    results: [
                      {
                        id: 'tbl_default_1',
                        table_number: 1,
                        capacity: 4,
                        status: 'Available',
                        is_active: 1,
                        tenant_id: 'default',
                        operating_unit_id: 'default',
                      },
                      {
                        id: 'tbl_sadec_1',
                        table_number: 1,
                        capacity: 6,
                        status: 'Available',
                        is_active: 1,
                        tenant_id: 'sadec',
                        operating_unit_id: 'sadec',
                      },
                    ],
                  } as unknown as D1Result<T>;
                }
                if (/FROM bookings/i.test(sql) || /FROM reservations/i.test(sql)) {
                  if (sql.includes('tenant_id') && args.includes('sadec')) {
                    return {
                      results: [
                        {
                          id: 'bk_sadec_1',
                          cal_uid: 'cal_sadec_1',
                          status: 'confirmed',
                          start_time: '2026-11-03T12:00:00Z',
                          tenant_id: 'sadec',
                        },
                      ],
                    } as unknown as D1Result<T>;
                  }
                  return { results: [] } as unknown as D1Result<T>;
                }
                return { results: [] } as unknown as D1Result<T>;
              },
              async run() {
                return { success: true, meta: { changes: 1 } } as unknown as D1Result;
              },
            };
          };
          return {
            bind: (...args: unknown[]) => run(args),
            first: <T>() => run([]).first<T>(),
            all: <T>() => run([]).all<T>(),
            run: () => run([]).run(),
          } as unknown as D1PreparedStatement;
        },
      } as unknown as D1Database;

      // 1. validateOrderTable disambiguates shared table_number = 1 across default and sadec
      const tableCheck = await validateOrderTable(db, '1', 'sadec');
      expect(tableCheck.ok).toBe(true);
      expect(tableCheck.table?.id).toBe('tbl_sadec_1');

      // 2. releaseTable scopes UPDATE reservations SET status = 'completed' by tenant_id
      executedSqls.length = 0;
      const relRes = await releaseTable(db, { tableId: 'tbl_sadec_1', operatingUnitId: 'sadec' });
      expect(relRes.ok).toBe(true);
      expect(
        executedSqls.some(
          (q) =>
            /UPDATE reservations SET status = 'completed'[\s\S]*tenant_id/i.test(q.sql) &&
            q.args.includes('sadec')
        )
      ).toBe(true);
      sadecTableStatus = 'Available';

      // 3. POST /api/table-sessions scopes conflict lookup by tenant_id
      const sessApp = new Hono<{ Bindings: Env }>();
      sessApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'st_sadec', role: 'waiter', tenantId: 'sadec' });
        c.set('tenantId' as any, 'sadec');
        await next();
      });
      registerSessionHandlers(sessApp as any);
      const createSessRes = await sessApp.fetch(
        new Request('https://api.test/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_id: 'tbl_sadec_1', guests: 4 }),
        }),
        { AURA_DB: db } as any
      );
      expect(createSessRes.status).toBe(201);

      // 4. Cal bookings GET pushes tenant_id into SQL before LIMIT
      const calApp = new Hono<{ Bindings: Env }>();
      registerBookingsHandler(calApp as any);
      const bkReq = await authRequest('GET', '/bookings?limit=10', 'manager', 'sadec');
      const bkRes = await calApp.fetch(
        bkReq,
        { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as any
      );
      expect(bkRes.status).toBe(200);
      const bkJson = (await bkRes.json()) as { data: Array<{ id: string }> };
      expect(bkJson.data.map((b) => b.id)).toEqual(['bk_sadec_1']);
    });

    it('AE3: blocks waiter review spoofing & owner->admin PIN escalation, scopes loyalty bonus/ZNS/push by default tenant, and enforces ERPNext/DinDin POS isolation', async () => {
      const { Hono } = await import('hono');
      const { reviewsRouter } = await import('../../routes/reviews');
      const { getActiveCampaign } = await import('../../tree/loyalty/campaign');
      const { registerStaffDevice } = await import('../../../../packages/domain/staff/commands/staff-auth');
      const { handleErpnextPosRequest } = await import('../../routes/erpnext-pos');
      const { registerCartHandlers } = await import('../../routes/dindin-handlers/cart-handlers');

      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];
      const db: D1Database = {
        prepare(sql: string) {
          const run = (args: unknown[]) => {
            executedSqls.push({ sql, args });
            return {
              async first<T>() {
                if (/FROM users WHERE id = \?/i.test(sql) || /FROM staff WHERE id = \?/i.test(sql)) {
                  const id = String(args[0] || '');
                  if (id === 'admin_platform_1') {
                    return {
                      id: 'admin_platform_1',
                      name: 'Platform Admin',
                      role: 'admin',
                      is_active: 1,
                      auth_version: 1,
                      tenant_id: 'default',
                    } as unknown as T;
                  }
                  const role = id.includes('waiter')
                    ? 'waiter'
                    : id.includes('staff')
                      ? 'staff'
                      : id.includes('admin')
                        ? 'admin'
                        : 'owner';
                  return { id, role, is_active: 1, auth_version: 1, tenant_id: 'default' } as unknown as T;
                }
                if (/FROM orders WHERE id = \?/i.test(sql)) {
                  return {
                    id: 'ord_cust_1',
                    customer_id: 'cust_real_1',
                    status: 'completed',
                    tenant_id: 'default',
                  } as unknown as T;
                }
                if (/FROM bonus_campaigns/i.test(sql)) {
                  if (sql.includes('tenant_id') && args.includes('default')) {
                    return {
                      id: 'camp_default_1',
                      name: 'Default Double Points',
                      multiplier: 2,
                      active: 1,
                      tenant_id: 'default',
                    } as unknown as T;
                  }
                  return {
                    id: 'camp_other_99',
                    name: 'Other Store 10x',
                    multiplier: 10,
                    active: 1,
                    tenant_id: 'other-store',
                  } as unknown as T;
                }
                return null;
              },
              async all<T>() {
                if (/FROM dindin_cart/i.test(sql)) {
                  if (sql.includes('tenant_id') && args.includes('sadec')) {
                    return {
                      results: [
                        { session_id: 'din_sadec_1', cart: '{"items":[]}', tenant_id: 'sadec', updated_at: '2026-11-03T00:00:00Z' },
                      ],
                    } as unknown as D1Result<T>;
                  }
                  return { results: [] } as unknown as D1Result<T>;
                }
                return { results: [] } as unknown as D1Result<T>;
              },
              async run() {
                return { success: true, meta: { changes: 1 } } as unknown as D1Result;
              },
            };
          };
          return {
            bind: (...args: unknown[]) => run(args),
            first: <T>() => run([]).first<T>(),
            all: <T>() => run([]).all<T>(),
            run: () => run([]).run(),
          } as unknown as D1PreparedStatement;
        },
      } as unknown as D1Database;

      // 1. Waiter cannot spoof a customer review on POST /api/reviews
      const revApp = new Hono<{ Bindings: Env }>();
      revApp.route('/api/reviews', reviewsRouter);
      const revReq = await authRequest('POST', '/api/reviews', 'waiter', 'default', {
        order_id: 'ord_cust_1',
        rating: 5,
        comment: 'Spoofed by waiter',
      });
      const revRes = await revApp.fetch(revReq, { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as any);
      expect(revRes.status).toBe(403);

      // 2. getActiveCampaign scopes by 'default' tenant in SQL before LIMIT 1
      const activeCamp = await getActiveCampaign(db, 'default');
      expect(activeCamp?.id).toBe('camp_default_1');
      expect(activeCamp?.multiplier).toBe(2);

      // 3. Store owner cannot register a PIN device for a platform 'admin' account
      const ownerEscalateApp = new Hono<{ Bindings: Env }>();
      ownerEscalateApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'owner_1', role: 'owner', tenantId: 'default' });
        c.set('staffUser' as any, { id: 'owner_1', role: 'owner', tenantId: 'default' });
        c.set('tenantId' as any, 'default');
        await next();
      });
      ownerEscalateApp.post('/register-device', (c) => registerStaffDevice(c as any));
      const escRes = await ownerEscalateApp.fetch(
        new Request('https://api.test/register-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_token: 'dev_escalate_token_123456',
            device_name: 'POS iPad 1',
            staff_id: 'admin_platform_1',
            role: 'admin',
            pin: '1234',
          }),
        }),
        { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as any
      );
      expect(escRes.status).toBe(403);

      // 4. ERPNext POS products/sync rejects 'staff' role with 403
      const erpStaffReq = await authRequest('POST', '/api/erpnext-pos/products/sync', 'staff', 'default', {
        products: [],
      });
      const erpSyncRes = await handleErpnextPosRequest(
        erpStaffReq,
        { AURA_DB: db, ERPNEXT_URL: 'https://erp.test', ERPNEXT_API_KEY: 'k', ERPNEXT_API_SECRET: 's' } as any,
        'default'
      );
      expect(erpSyncRes.status).toBe(403);

      // 5. DinDin GET /carts pushes tenant_id into SQL before LIMIT 50
      const dinApp = new Hono<{ Bindings: Env }>();
      dinApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'mgr_sadec', role: 'manager', tenantId: 'sadec' });
        c.set('tenantId' as any, 'sadec');
        await next();
      });
      registerCartHandlers(dinApp as any);
      const dinCartRes = await dinApp.fetch(
        new Request('https://api.test/carts'),
        { AURA_DB: db } as any
      );
      expect(dinCartRes.status).toBe(200);
      const dinCartJson = (await dinCartRes.json()) as { carts: Array<{ sessionId: string }> };
      expect(dinCartJson.carts.map((x) => x.sessionId)).toEqual(['din_sadec_1']);
    });
  });
});





