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
    tenantId
  } as any, TEST_JWT_SECRET);

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
        prepare: vi.fn(() => ({
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
        prepare: vi.fn((sql: string) => ({
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
        prepare: vi.fn(() => ({
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
          prepare: vi.fn(() => ({
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
});
