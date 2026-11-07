import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateJWT } from '../lib/jwt';
import { createMockEnv, createMockKV, STAFF_ACCOUNT_ROW, isStaffAccountLookup, TEST_JWT_SECRET } from './test-utils';
import { handleErpnextPosRequest } from '../routes/erpnext-pos';
import { handleErpnextInvoicesRequest } from '../routes/erpnext-invoices';
import { erpnextSyncRoutes } from '../routes/erpnext-sync';
import { processErpnextRetryQueue } from '../routes/cron-handlers/erpnext-sync';
import { customerRoutes } from '../routes/erpnext/customers';
import { vendorRoutes } from '../routes/erpnext/vendors';
import { expenseRoutes } from '../routes/erpnext/expenses';
import type { Env } from '../types/env';

function createEmptyAuthKv() {
  return {
    get: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  } as unknown as KVNamespace;
}

async function makeStaffToken(role = 'owner', tenantId = 'default') {
  return generateJWT(
    {
      email: 'staff@aura.test',
      name: 'Staff',
      id: 'USR_1',
      role,
      tenantId,
      tenant_id: tenantId,
      authVersion: 1,
      authTime: Math.floor(Date.now() / 1000),
      sessionType: 'staff-web',
    },
    TEST_JWT_SECRET,
    28800
  );
}

describe('Phase 46 Slice AS4 — ERPNext POS, Invoices, Sync & Sub-Routes Security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('AS4-1: erpnext-pos.ts JWT signature verification & per-tenant credential isolation', () => {
    it('rejects forged x-user-role: admin header without valid signed JWT on POST /products/sync', async () => {
      const req = new Request('https://test.local/api/erpnext-pos/products/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          products: [{ name: 'ITEM-001', item_code: 'COFFEE', item_name: 'Coffee', modified: null }],
        }),
      });

      const res = await handleErpnextPosRequest(req, {
        JWT_SECRET: TEST_JWT_SECRET,
        ERPNEXT_URL: 'https://erp.global.test',
        ERPNEXT_API_KEY: 'global-key',
        ERPNEXT_API_SECRET: 'global-secret',
      });

      expect(res.status).toBe(401);
    });

    it('rejects forged unsigned base64 JWT on POST /products/sync', async () => {
      const fakeHeader = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const fakePayload = btoa(JSON.stringify({ sub: 'attacker', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }));
      const forgedToken = `${fakeHeader}.${fakePayload}.forged-signature`;

      const req = new Request('https://test.local/api/erpnext-pos/products/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${forgedToken}`,
        },
        body: JSON.stringify({
          products: [{ name: 'ITEM-001', item_code: 'COFFEE', item_name: 'Coffee', modified: null }],
        }),
      });

      const res = await handleErpnextPosRequest(req, {
        JWT_SECRET: TEST_JWT_SECRET,
        ERPNEXT_URL: 'https://erp.global.test',
        ERPNEXT_API_KEY: 'global-key',
        ERPNEXT_API_SECRET: 'global-secret',
      });

      expect(res.status).toBe(401);
    });

    it('accepts valid signed JWT with allowed role on POST /products/sync and rejects disallowed role with 403', async () => {
      const waiterToken = await generateJWT(
        { sub: 'staff-waiter', role: 'waiter', tenant_id: 'default' },
        TEST_JWT_SECRET,
        3600
      );
      const waiterReq = new Request('https://test.local/api/erpnext-pos/products/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${waiterToken}`,
        },
        body: JSON.stringify({
          products: [{ name: 'ITEM-001', item_code: 'COFFEE', item_name: 'Coffee', modified: null }],
        }),
      });
      const waiterRes = await handleErpnextPosRequest(waiterReq, {
        JWT_SECRET: TEST_JWT_SECRET,
        ERPNEXT_URL: 'https://erp.global.test',
        ERPNEXT_API_KEY: 'global-key',
        ERPNEXT_API_SECRET: 'global-secret',
      });
      expect(waiterRes.status).toBe(403);

      const adminToken = await generateJWT(
        { sub: 'staff-admin', role: 'admin', tenant_id: 'default' },
        TEST_JWT_SECRET,
        3600
      );
      const mockDb = {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            run: vi.fn(async () => ({ success: true })),
          })),
        })),
      } as unknown as D1Database;

      const adminReq = new Request('https://test.local/api/erpnext-pos/products/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          products: [{ name: 'ITEM-001', item_code: 'COFFEE', item_name: 'Coffee', modified: null }],
        }),
      });
      const adminRes = await handleErpnextPosRequest(adminReq, {
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb,
        ERPNEXT_URL: 'https://erp.global.test',
        ERPNEXT_API_KEY: 'global-key',
        ERPNEXT_API_SECRET: 'global-secret',
      });
      expect(adminRes.status).toBe(200);
      const adminBody = (await adminRes.json()) as { success: boolean; data: { updated: number } };
      expect(adminBody.success).toBe(true);
      expect(adminBody.data.updated).toBe(1);
    });

    it('does not fall back to global env.ERPNEXT_* when AUTH_KV has no credentials for non-default tenant', async () => {
      const adminToken = await generateJWT(
        { sub: 'staff-admin-b', role: 'admin', tenant_id: 'store-b' },
        TEST_JWT_SECRET,
        3600
      );
      const env = {
        JWT_SECRET: TEST_JWT_SECRET,
        AUTH_KV: createEmptyAuthKv(),
        ERPNEXT_URL: 'https://erp.global.test',
        ERPNEXT_API_KEY: 'global-key',
        ERPNEXT_API_SECRET: 'global-secret',
      };

      const salesOrderReq = new Request('https://test.local/api/erpnext-pos/sales-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'store-b',
        },
        body: JSON.stringify({
          customer_name: 'Customer B',
          items: [{ item_code: 'COFFEE', qty: 1, rate: 30000 }],
        }),
      });
      const salesOrderRes = await handleErpnextPosRequest(salesOrderReq, env, 'store-b');
      expect(salesOrderRes.status).toBe(503);

      const syncReq = new Request('https://test.local/api/erpnext-pos/products/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
          'X-Tenant-ID': 'store-b',
        },
        body: JSON.stringify({
          products: [{ name: 'ITEM-001', item_code: 'COFFEE', item_name: 'Coffee', modified: null }],
        }),
      });
      const syncRes = await handleErpnextPosRequest(syncReq, env, 'store-b');
      expect(syncRes.status).toBe(503);
    });

    it('rejects webhook in production when NODE_ENV is production and ERPNEXT_WEBHOOK_SECRET is missing', async () => {
      const req = new Request('https://test.local/api/erpnext-pos/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctype: 'Sales Order', docname: 'SO-001', action: 'on_update' }),
      });
      const res = await handleErpnextPosRequest(req, { NODE_ENV: 'production' });
      expect(res.status).toBe(503);
    });
  });

  describe('AS4-2: erpnext-invoices.ts fail-closed order lookup, server-authoritative retry, and KV credential isolation', () => {
    it('fails closed (404) when D1 .first() throws on loadOrderForInvoice during POST /create', async () => {
      const failingDb = {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => {
              throw new Error('D1 query failure');
            }),
          })),
        })),
      } as unknown as D1Database;

      const req = new Request('https://test.local/api/erpnext-invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'ord-fail-closed',
          items: [{ id: 'COFFEE', name: 'Coffee', quantity: 1, price: 35000 }],
          total: 35000,
        }),
      });

      const res = await handleErpnextInvoicesRequest(req, {
        AURA_DB: failingDb,
        ERPNEXT_URL: 'https://erp.global.test',
        ERPNEXT_API_KEY: 'global-key',
        ERPNEXT_API_SECRET: 'global-secret',
      });
      expect(res.status).toBe(404);
    });

    it('ignores untrusted request body fields on POST /retry and skips rows where loadOrderForInvoice returns allowed: false', async () => {
      const createdInvoices: Array<Record<string, unknown>> = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        if (init?.method === 'POST' && typeof init.body === 'string') {
          createdInvoices.push(JSON.parse(init.body) as Record<string, unknown>);
        }
        return new Response(JSON.stringify({ data: { name: 'SINV-AUTH-001' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...args: unknown[]) => ({
            all: vi.fn(async () => {
              if (sql.includes('FROM erpnext_mappings')) {
                return {
                  results: [
                    { local_id: 'ord-valid-1', tenant_id: 'default' },
                    { local_id: 'ord-foreign-2', tenant_id: 'default' },
                  ],
                };
              }
              return { results: [] };
            }),
            first: vi.fn(async () => {
              const id = String(args[0] ?? '');
              if (sql.includes('FROM orders') && id === 'ord-valid-1') {
                return {
                  id: 'ord-valid-1',
                  items: JSON.stringify([{ id: 'CAPPUCCINO', item_code: 'CAPPUCCINO', name: 'Cappuccino', quantity: 2, price: 45000 }]),
                  total: 90000,
                  discount_amount: 0,
                  customer_name: 'Authoritative Customer',
                  tenant_id: 'default',
                };
              }
              if (sql.includes('FROM orders') && id === 'ord-foreign-2') {
                return {
                  id: 'ord-foreign-2',
                  items: JSON.stringify([{ id: 'TEA', item_code: 'TEA', name: 'Tea', quantity: 1, price: 25000 }]),
                  total: 25000,
                  tenant_id: 'other-tenant',
                };
              }
              return null;
            }),
            run: vi.fn(async () => ({ success: true })),
          })),
        })),
      } as unknown as D1Database;

      const req = new Request('https://test.local/api/erpnext-invoices/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total: 1,
          discount_amount: 89999,
          items: [{ id: 'TAMPERED', item_code: 'TAMPERED', name: 'Tampered Item', quantity: 1, price: 1 }],
        }),
      });

      const res = await handleErpnextInvoicesRequest(req, {
        AURA_DB: db,
        ERPNEXT_URL: 'https://erp.global.test',
        ERPNEXT_API_KEY: 'global-key',
        ERPNEXT_API_SECRET: 'global-secret',
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: { retried: number } };
      expect(json.data.retried).toBe(1);
      expect(createdInvoices).toHaveLength(1);
      const postedItems = (createdInvoices[0].items as Array<Record<string, unknown>>) || [];
      expect(postedItems[0].item_name).toBe('Cappuccino');
      expect(postedItems[0].rate).toBe(45000);
      expect(postedItems[0].qty).toBe(2);
    });

    it('does not fall back to global env.ERPNEXT_* for non-default tenant when AUTH_KV has no tenant credentials', async () => {
      const db = {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({
              id: 'ord-b-1',
              total: 50000,
              tenant_id: 'store-b',
            })),
          })),
        })),
      } as unknown as D1Database;

      const req = new Request('https://test.local/api/erpnext-invoices/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'store-b',
        },
        body: JSON.stringify({
          id: 'ord-b-1',
          items: [{ id: 'COFFEE', name: 'Coffee', quantity: 1, price: 50000 }],
          total: 50000,
        }),
      });

      const res = await handleErpnextInvoicesRequest(
        req,
        {
          AURA_DB: db,
          AUTH_KV: createEmptyAuthKv(),
          ERPNEXT_URL: 'https://erp.global.test',
          ERPNEXT_API_KEY: 'global-key',
          ERPNEXT_API_SECRET: 'global-secret',
        },
        'store-b'
      );
      expect(res.status).toBe(503);
    });
  });

  describe('AS4-3: erpnext-sync.ts & cron-handlers/erpnext-sync.ts tenant SQL filtering, deduplication, and queue update scoping', () => {
    it('filters by tenant_id in SQL before LIMIT, deduplicates by item_id, and skips items without finite non-negative current_stock', async () => {
      const executedQueries: string[] = [];
      const putPayloads: Array<{ url: string; body: Record<string, unknown> }> = [];

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (init?.method === 'PUT' && typeof init.body === 'string') {
          putPayloads.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
        }
        return new Response(JSON.stringify({ data: { name: 'BIN-001' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          if (isStaffAccountLookup(sql)) {
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn(async () => ({ ...STAFF_ACCOUNT_ROW, id: 'USR_1', role: 'owner', tenant_id: 'default' })),
              all: vi.fn(async () => ({ results: [] })),
              run: vi.fn(async () => ({ success: true })),
            };
          }
          executedQueries.push(sql);
          return {
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({
                results: [
                  {
                    item_id: 'item-coffee',
                    sku: 'SKU-COFFEE',
                    name: 'Coffee Beans',
                    quantity: -3,
                    current_stock: 42,
                    reference_type: 'order',
                    created_at: '2026-11-03T10:05:00Z',
                    tenant_id: 'default',
                  },
                  {
                    item_id: 'item-coffee',
                    sku: 'SKU-COFFEE',
                    name: 'Coffee Beans',
                    quantity: -5,
                    current_stock: 45,
                    reference_type: 'order',
                    created_at: '2026-11-03T10:00:00Z',
                    tenant_id: 'default',
                  },
                  {
                    item_id: 'item-milk-no-stock',
                    sku: 'SKU-MILK',
                    name: 'Fresh Milk',
                    quantity: -2,
                    current_stock: null,
                    reference_type: 'order',
                    created_at: '2026-11-03T10:02:00Z',
                    tenant_id: 'default',
                  },
                  {
                    item_id: 'item-sugar-negative-stock',
                    sku: 'SKU-SUGAR',
                    name: 'Sugar',
                    quantity: -4,
                    current_stock: -1,
                    reference_type: 'order',
                    created_at: '2026-11-03T10:01:00Z',
                    tenant_id: 'default',
                  },
                ],
              })),
              run: vi.fn(async () => ({ success: true })),
            })),
          };
        }),
      } as unknown as D1Database;

      const app = new Hono<{ Bindings: Env }>();
      erpnextSyncRoutes(app);

      const adminToken = await makeStaffToken('owner', 'default');

      const res = await app.fetch(
        new Request('https://test.local/api/erpnext/sync/inventory', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        {
          ...createMockEnv(),
          AUTH_KV: createMockKV(),
          JWT_SECRET: TEST_JWT_SECRET,
          AURA_DB: mockDb,
          ERPNEXT_URL: 'https://erp.global.test',
          ERPNEXT_API_KEY: 'global-key',
          ERPNEXT_API_SECRET: 'global-secret',
        } as unknown as Env
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; synced: number; total: number };
      expect(body.success).toBe(true);
      expect(body.synced).toBe(1);
      expect(body.total).toBe(3);

      expect(executedQueries[0]).toMatch(/COALESCE\(NULLIF\(TRIM\(it\.tenant_id\),\s*''\)/i);
      expect(executedQueries[0].indexOf('COALESCE')).toBeLessThan(executedQueries[0].indexOf('LIMIT 500'));

      expect(putPayloads).toHaveLength(1);
      expect(putPayloads[0].url).toContain('/api/resource/Bin/SKU-COFFEE');
      expect(putPayloads[0].body).toEqual({ actual_qty: 42 });
    });

    it('scopes UPDATE erpnext_sync_queue by tenant_id in processErpnextRetryQueue', async () => {
      const updateStatements: Array<{ sql: string; args: unknown[] }> = [];

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: { name: 'SO-001' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...args: unknown[]) => ({
            all: vi.fn(async () => ({
              results: [
                {
                  id: 'queue-row-b1',
                  entity_type: 'product',
                  entity_id: 'prod-1',
                  action: 'sync',
                  payload: '{}',
                  attempts: 0,
                  next_retry_at: null,
                  tenant_id: 'store-b',
                },
              ],
            })),
            run: vi.fn(async () => {
              if (sql.includes('UPDATE erpnext_sync_queue')) {
                updateStatements.push({ sql, args });
              }
              return { success: true };
            }),
          })),
        })),
      } as unknown as D1Database;

      const result = await processErpnextRetryQueue(
        {
          AURA_DB: mockDb,
          ERPNEXT_URL: 'https://erp.global.test',
          ERPNEXT_API_KEY: 'global-key',
          ERPNEXT_API_SECRET: 'global-secret',
        },
        'store-b'
      );

      expect(result.succeeded).toBe(1);
      expect(updateStatements).toHaveLength(1);
      expect(updateStatements[0].sql).toMatch(/WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\),\s*''\),\s*'default'\) = \?/i);
      expect(updateStatements[0].args[1]).toBe('queue-row-b1');
      expect(updateStatements[0].args[2]).toBe('store-b');
    });
  });

  describe('AS4-4: erpnext/{customers,vendors,expenses}.ts SQL-before-LIMIT tenant filtering, ID-scoped customer update, and KV credential isolation', () => {
    it('applies SQL tenant filter before LIMIT on vendors.ts and expenses.ts', async () => {
      const executedQueries: Array<{ sql: string; args: unknown[] }> = [];
      const mockDb = {
        prepare: vi.fn((sql: string) => {
          if (isStaffAccountLookup(sql)) {
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn(async () => ({ ...STAFF_ACCOUNT_ROW, id: 'USR_1', role: 'owner', tenant_id: 'store-b' })),
              all: vi.fn(async () => ({ results: [] })),
              run: vi.fn(async () => ({ success: true })),
            };
          }
          return {
            bind: vi.fn((...args: unknown[]) => {
              executedQueries.push({ sql, args });
              return {
                all: vi.fn(async () => ({
                  results: [{ id: 'row-b-1', name: 'Store B Entity', tenant_id: 'store-b', date: '2026-11-03' }],
                })),
              };
            }),
          };
        }),
      } as unknown as D1Database;

      const app = new Hono<{ Bindings: Env }>();
      vendorRoutes(app);
      expenseRoutes(app);

      const tokenB = await makeStaffToken('owner', 'store-b');
      const envB = {
        ...createMockEnv(),
        AUTH_KV: createMockKV(),
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb,
      } as unknown as Env;

      const vendorRes = await app.fetch(
        new Request('https://test.local/api/erpnext/vendors?limit=25', {
          headers: { Authorization: `Bearer ${tokenB}`, 'X-Tenant-ID': 'store-b' },
        }),
        envB
      );
      expect(vendorRes.status).toBe(200);

      const expenseRes = await app.fetch(
        new Request('https://test.local/api/erpnext/expenses?from=2026-11-01&limit=25', {
          headers: { Authorization: `Bearer ${tokenB}`, 'X-Tenant-ID': 'store-b' },
        }),
        envB
      );
      expect(expenseRes.status).toBe(200);

      const vendorQuery = executedQueries.find((q) => q.sql.includes('FROM suppliers'));
      expect(vendorQuery).toBeDefined();
      expect(vendorQuery!.sql).toMatch(/WHERE COALESCE\(NULLIF\(TRIM\(tenant_id\),\s*''\),\s*'default'\) = \?\s+ORDER BY created_at DESC LIMIT \?/i);
      expect(vendorQuery!.args).toEqual(['store-b', 25]);

      const expenseQuery = executedQueries.find((q) => q.sql.includes('FROM expenses'));
      expect(expenseQuery).toBeDefined();
      expect(expenseQuery!.sql).toMatch(/COALESCE\(NULLIF\(TRIM\(tenant_id\),\s*''\),\s*'default'\) = \?\s+ORDER BY date DESC LIMIT \?/i);
      expect(expenseQuery!.args).toEqual(['2026-11-01', 'store-b', 25]);
    });

    it('updates customers.erpnext_id by customer id + tenant_id and blocks global ERPNext fallback for non-default tenants', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: { name: 'CUST-ERP-009' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      let currentAccountTenant = 'default';
      const updateCalls: Array<{ sql: string; args: unknown[] }> = [];
      const mockDb = {
        prepare: vi.fn((sql: string) => {
          if (isStaffAccountLookup(sql)) {
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn(async () => ({ ...STAFF_ACCOUNT_ROW, id: 'USR_1', role: 'owner', tenant_id: currentAccountTenant })),
              all: vi.fn(async () => ({ results: [] })),
              run: vi.fn(async () => ({ success: true })),
            };
          }
          return {
            bind: vi.fn((...args: unknown[]) => ({
              first: vi.fn(async () => {
                if (sql.includes('SELECT id, name FROM customers')) {
                  return { id: 'cust-pk-42', name: 'Nguyen Van A' };
                }
                return null;
              }),
              run: vi.fn(async () => {
                if (sql.startsWith('UPDATE customers')) {
                  updateCalls.push({ sql, args });
                }
                return { success: true };
              }),
            })),
          };
        }),
      } as unknown as D1Database;

      const app = new Hono<{ Bindings: Env }>();
      customerRoutes(app);
      vendorRoutes(app);
      expenseRoutes(app);

      const defaultAdminToken = await makeStaffToken('owner', 'default');

      const syncCustRes = await app.fetch(
        new Request('https://test.local/api/erpnext/customers/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${defaultAdminToken}`,
          },
          body: JSON.stringify({ name: 'Nguyen Van A', phone: '0901234567' }),
        }),
        {
          ...createMockEnv(),
          AUTH_KV: createMockKV(),
          JWT_SECRET: TEST_JWT_SECRET,
          AURA_DB: mockDb,
          ERPNEXT_URL: 'https://erp.global.test',
          ERPNEXT_API_KEY: 'global-key',
          ERPNEXT_API_SECRET: 'global-secret',
        } as unknown as Env
      );
      expect(syncCustRes.status).toBe(200);
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].sql).toMatch(/WHERE id = \? AND COALESCE\(NULLIF\(TRIM\(tenant_id\),\s*''\),\s*'default'\) = \?/i);
      expect(updateCalls[0].args).toEqual(['CUST-ERP-009', 'synced', 'cust-pk-42', 'default']);

      // Non-default tenant without KV credentials must not fall back to global env.ERPNEXT_*
      currentAccountTenant = 'store-b';
      const storeBAdminToken = await makeStaffToken('owner', 'store-b');
      const nonDefaultEnv = {
        ...createMockEnv(),
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: mockDb,
        AUTH_KV: createMockKV(),
        ERPNEXT_URL: 'https://erp.global.test',
        ERPNEXT_API_KEY: 'global-key',
        ERPNEXT_API_SECRET: 'global-secret',
      } as unknown as Env;

      const custBRes = await app.fetch(
        new Request('https://test.local/api/erpnext/customers/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${storeBAdminToken}`,
            'X-Tenant-ID': 'store-b',
          },
          body: JSON.stringify({ name: 'Customer B' }),
        }),
        nonDefaultEnv
      );
      expect(custBRes.status).toBe(503);

      const vendorBRes = await app.fetch(
        new Request('https://test.local/api/erpnext/vendors/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${storeBAdminToken}`,
            'X-Tenant-ID': 'store-b',
          },
          body: JSON.stringify({ name: 'Vendor B' }),
        }),
        nonDefaultEnv
      );
      expect(vendorBRes.status).toBe(503);

      const expenseBRes = await app.fetch(
        new Request('https://test.local/api/erpnext/expenses/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${storeBAdminToken}`,
            'X-Tenant-ID': 'store-b',
          },
          body: JSON.stringify({ amount: 120000, category: 'Supplies', date: '2026-11-03' }),
        }),
        nonDefaultEnv
      );
      expect(expenseBRes.status).toBe(503);
    });
  });
});
