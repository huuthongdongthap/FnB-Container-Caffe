import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { getCustomer360 } from '../../../../packages/domain/crm/commands/customer-360';
import { detectWinbackCandidates } from '../../../../packages/domain/crm/commands/campaign/detect';
import { registerAdminHandlers } from '../../routes/customers-handlers/admin-handlers';
import { birthdayRouter } from '../../routes/birthday';
import { dynamicPricingRouter } from '../../routes/dynamic-pricing';
import { happyHourDiscountFor } from '../../../../packages/domain/catalog/policies/pricing';
import { recommendationsRouter } from '../../routes/recommendations';
import { demandForecastRouter } from '../../routes/demand-forecast';
import { inventoryTransactions } from '../../../../packages/domain/inventory/src/routes/inventory-transactions';
import { deductInventoryForOrder } from '../../../../packages/domain/inventory/src/routes/order-deduction';
import { registerPurchaseOrderHandlers } from '../../routes/openapi-inventory-handlers/purchase-order-handlers';
import { reconcileShiftCash } from '../../../../packages/domain/shift/src/policies/cash-reconciliation-policy';
import { staffTipsRouter } from '../../../../packages/domain/staff/commands/staff-tips';
import { registerStaffHandlers } from '../../routes/openapi-staff-handlers/staff-handlers';
import { writeCart } from '../../routes/dindin-handlers/types';
import { issueStaffSession, type StaffAccount } from '../../lib/staff-session';

const TEST_JWT_SECRET = 'test-secret-phase62-bi1-bi4-1234567890';

async function makeStaffToken(account: Partial<StaffAccount> & { id: string; role: string }) {
  const fullAccount: StaffAccount = {
    id: account.id,
    name: account.name ?? account.id,
    phone: account.phone ?? null,
    role: account.role,
    tenant_id: account.tenant_id ?? 'default',
    is_active: account.is_active ?? 1,
    auth_version: account.auth_version ?? 1,
  };
  const session = await issueStaffSession(
    { JWT_SECRET: TEST_JWT_SECRET },
    fullAccount,
    { sessionType: 'staff-web', email: `${account.id}@aura.vn` }
  );
  return { token: session.token, account: fullAccount };
}

describe('Phase 62 Security Regression Suite (BI1-BI4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('BI1: CRM, Customers, Campaigns, Birthday & Mautic Hardening', () => {
    it('excludes cancelled/refunded/rejected orders from Customer 360 spend and frequency bands', async () => {
      const mockDb = {
        prepare: (sql: string) => ({
          bind: (..._args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM customers')) {
                return {
                  id: 'cust_bi1_1',
                  phone: '0901234567',
                  name: 'Test Customer',
                  tier: 'silver',
                  loyalty_points: 100,
                  total_spent: 150000,
                  total_orders: 1,
                  tenant_id: 'store-a',
                };
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM orders')) {
                return {
                  results: [
                    {
                      id: 'ord_valid_1',
                      total: 150000,
                      status: 'completed',
                      payment_status: 'paid',
                      items: JSON.stringify([{ product_id: 'latte_1', name: 'Latte', quantity: 2 }]),
                      created_at: new Date().toISOString(),
                      tenant_id: 'store-a',
                    },
                    {
                      id: 'ord_cancelled_1',
                      total: 900000,
                      status: 'canceled',
                      payment_status: 'pending',
                      items: JSON.stringify([{ product_id: 'fake_1', name: 'Fake Expensive Item', quantity: 10 }]),
                      created_at: new Date().toISOString(),
                      tenant_id: 'store-a',
                    },
                    {
                      id: 'ord_refunded_1',
                      total: 500000,
                      status: 'completed',
                      payment_status: 'refunded',
                      items: JSON.stringify([{ product_id: 'refund_1', name: 'Refunded Item', quantity: 5 }]),
                      created_at: new Date().toISOString(),
                      tenant_id: 'store-a',
                    },
                  ],
                };
              }
              return { results: [] };
            },
          }),
        }),
      };

      const res = await getCustomer360(mockDb as never, 'cust_bi1_1', undefined, { tenantId: 'store-a' });
      expect(res.preferences.orderCount).toBe(1);
      expect(res.preferences.totalSpentCents).toBe(150000);
      expect(res.preferences.favouriteItems.map((i) => i.name)).toEqual(['Latte']);
    });

    it('blocks cross-tenant ?store_id= and ?tenantId= overrides in /api/customers/segments for non-HQ manager', async () => {
      const { token, account } = await makeStaffToken({ id: 'mgr_1', role: 'manager', tenant_id: 'store-a' });
      const app = new Hono<{ Bindings: Env }>();
      registerAdminHandlers(app);

      const mockDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM users')) return account;
              return null;
            },
          }),
        }),
      };

      const res = await app.request(
        'http://localhost/segments?store_id=store-b',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        },
        {
          JWT_SECRET: TEST_JWT_SECRET,
          AURA_DB: mockDb,
        } as unknown as Env
      );
      expect(res.status).toBe(403);
    });

    it('rejects wildcard tenant in PUT /api/birthday/config and non-existent order_id in POST /api/birthday/redeem', async () => {
      const { token: hqToken, account: hqAccount } = await makeStaffToken({
        id: 'hq_1',
        role: 'owner',
        tenant_id: 'hq',
      });

      const resWildcard = await birthdayRouter.request(
        'http://localhost/config',
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${hqToken}`,
            'X-Tenant-ID': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ discount_percent: 25 }),
        },
        {
          JWT_SECRET: TEST_JWT_SECRET,
          AURA_DB: {
            prepare: (sql: string) => ({
              bind: () => ({
                first: async () => (sql.includes('FROM users') ? hqAccount : null),
              }),
            }),
          },
        } as unknown as Env
      );
      expect(resWildcard.status).toBe(400);

      const { token: staffToken, account: staffAccount } = await makeStaffToken({
        id: 'cashier_1',
        role: 'cashier',
        tenant_id: 'store-a',
      });
      const mockDb = {
        prepare: (sql: string) => ({
          bind: (..._args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM users')) return staffAccount;
              if (sql.includes('FROM birthday_Configs') || sql.includes('FROM birthday_configs')) {
                return { enabled: 1, discount_percent: 20, max_discount: 50000, min_order_amount: 0, valid_days_before: 7, valid_days_after: 7, tenant_id: 'store-a' };
              }
              if (sql.includes('FROM customers')) {
                const todayMd = new Date(Date.now() + 7 * 3600_000).toISOString().slice(5, 10);
                return { id: 'cust_bday_1', name: 'Bday User', phone: '0909999999', birthday: `1995-${todayMd}`, tenant_id: 'store-a' };
              }
              if (sql.includes('FROM birthday_redemptions')) {
                return null;
              }
              if (sql.includes('FROM orders')) {
                return null; // Order does not exist!
              }
              return null;
            },
          }),
        }),
      };

      const resMissingOrder = await birthdayRouter.request(
        'http://localhost/redeem',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${staffToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer_id: 'cust_bday_1',
            order_id: 'ord_nonexistent_999',
            order_amount: 500000,
          }),
        },
        {
          JWT_SECRET: TEST_JWT_SECRET,
          AURA_DB: mockDb,
        } as unknown as Env
      );
      expect(resMissingOrder.status).toBe(404);
    });

    it('excludes cancelled and refunded orders in winback campaign SQL query', async () => {
      const executedSql: string[] = [];
      const mockDb = {
        prepare: (sql: string) => {
          executedSql.push(sql);
          return {
            bind: () => ({
              all: async () => ({ results: [] }),
            }),
          };
        },
      };

      await detectWinbackCandidates(mockDb as never, 30, 'store-a');
      expect(executedSql.length).toBeGreaterThan(0);
      expect(executedSql[0]).toContain("'cancelled'");
      expect(executedSql[0]).toContain("'refunded'");
    });
  });

  describe('BI2: Catalog, Dynamic Pricing, Happy Hour & Recommendations Hardening', () => {
    it('prevents unauthenticated caller from spoofing item.category in POST /api/pricing/calculate', async () => {
      const mockDb = {
        prepare: (sql: string) => ({
          bind: (..._args: unknown[]) => ({
            all: async () => {
              if (sql.includes('FROM dynamic_pricing_rules')) {
                return {
                  results: [
                    {
                      id: 'rule_pastry_50',
                      name: 'Pastry Clearance',
                      rule_type: 'category_flash',
                      discount_percent: 50,
                      target_category: 'pastry',
                      target_product_id: null,
                      min_margin_percent: 0,
                      days_of_week: '0,1,2,3,4,5,6',
                      start_time: '00:00',
                      end_time: '23:59',
                      is_active: 1,
                      tenant_id: 'default',
                    },
                  ],
                };
              }
              if (sql.includes('FROM products')) {
                return {
                  results: [
                    { id: 'coffee_1', price: 100000, cost_price: 20000, category: 'coffee', category_id: 'cat_coffee', tenant_id: 'default' },
                  ],
                };
              }
              return { results: [] };
            },
          }),
        }),
      };

      const res = await dynamicPricingRouter.request(
        'http://localhost/calculate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ product_id: 'coffee_1', price: 100000, quantity: 1, category: 'pastry' }],
          }),
        },
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { total_savings: number; discounted_total: number } };
      expect(body.data.total_savings).toBe(0);
      expect(body.data.discounted_total).toBe(100000);
    });

    it('matches Happy Hour category rules by both category_id and categorySlug', () => {
      const now = new Date();
      const windowRule = {
        id: 'hh_1',
        name: 'Coffee Happy Hour',
        day_of_week: now.getDay(),
        start_time: '00:00',
        end_time: '23:59',
        discount_rate: 0.2,
        apply_to: 'category' as const,
        apply_ids: JSON.stringify(['coffee']),
        priority: 10,
        active: 1,
      };
      const matched = happyHourDiscountFor([windowRule], now, {
        productId: 'prod_1',
        categoryId: 'cat_uuid_123',
        categorySlug: 'coffee',
      });
      expect(matched).not.toBeNull();
      expect(matched?.discount_rate).toBe(0.2);
    });

    it('blocks cross-tenant ?store_id= override on POST /api/recommendations/mine-affinities', async () => {
      const { token, account } = await makeStaffToken({
        id: 'mgr_a',
        role: 'manager',
        tenant_id: 'store-a',
      });
      const res = await recommendationsRouter.request(
        'http://localhost/mine-affinities?store_id=store-b',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
        {
          JWT_SECRET: TEST_JWT_SECRET,
          AURA_DB: {
            prepare: (sql: string) => ({
              bind: () => ({
                first: async () => (sql.includes('FROM users') ? account : null),
              }),
            }),
          },
        } as unknown as Env
      );
      expect(res.status).toBe(403);
    });
  });

  describe('BI3: Demand Forecast, Inventory Transactions, Order Deduction & PO Receiving Hardening', () => {
    it('blocks cross-tenant ?store_id= override and wildcard tenant user in GET /api/admin/metrics/forecast', async () => {
      const { token, account } = await makeStaffToken({
        id: 'mgr_a',
        role: 'manager',
        tenant_id: 'store-a',
      });
      const res = await demandForecastRouter.request(
        'http://localhost/forecast?store_id=store-b',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        },
        {
          JWT_SECRET: TEST_JWT_SECRET,
          AURA_DB: {
            prepare: (sql: string) => ({
              bind: () => ({
                first: async () => (sql.includes('FROM users') ? account : null),
              }),
            }),
          },
        } as unknown as Env
      );
      expect(res.status).toBe(403);
    });

    it('rejects negative inventory adjust transaction when adjustment exceeds current_stock', async () => {
      const app = new Hono<{ Bindings: { AURA_DB: any } }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr_1', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      inventoryTransactions(app as never);

      const mockDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => ({
              id: 'inv_1',
              sku: 'MILK-01',
              name: 'Fresh Milk',
              current_stock: 5,
              unit: 'L',
              min_stock: 2,
              tenant_id: 'store-a',
            }),
          }),
        }),
        batch: vi.fn(),
      };

      const res = await app.request(
        'http://localhost/inv_1/transactions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'adjust',
            quantity: -10,
            notes: 'Count adjustment',
          }),
        },
        { AURA_DB: mockDb }
      );
      expect(res.status).toBe(409);
      expect(mockDb.batch).not.toHaveBeenCalled();
    });

    it('skips inventory deduction when target order is cancelled or belongs to another tenant', async () => {
      const batchSpy = vi.fn();
      const mockDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM orders')) {
                return {
                  id: 'ord_cancelled_99',
                  status: 'cancelled',
                  payment_status: 'pending',
                  tenant_id: 'store-a',
                };
              }
              return null;
            },
            all: async () => ({ results: [] }),
          }),
        }),
        batch: batchSpy,
      };

      await deductInventoryForOrder(
        { AURA_DB: mockDb } as never,
        [{ product_id: 'prod_1', quantity: 2 }],
        'ord_cancelled_99',
        'store-a'
      );
      expect(batchSpy).not.toHaveBeenCalled();
    });

    it('blocks receiving unscheduled inventory items against a blank 0-cost purchase order', async () => {
      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr_1', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerPurchaseOrderHandlers(app);

      const batchSpy = vi.fn();
      const mockDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM purchase_orders')) {
                return {
                  id: 'po_blank_1',
                  status: 'ordered',
                  total_cost: 0,
                  tenant_id: 'store-a',
                };
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM purchase_order_items')) {
                return { results: [] };
              }
              return { results: [] };
            },
          }),
        }),
        batch: batchSpy,
      };

      const res = await app.request(
        'http://localhost/api/inventory/purchase-orders/po_blank_1/receive',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ ingredientId: 'arbitrary_item_1', receivedQuantity: 500 }],
          }),
        },
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(res.status).toBe(400);
      expect(batchSpy).not.toHaveBeenCalled();
    });
  });

  describe('BI4: Shift Cash Reconciliation, Staff Tips, Staff KV Revocation & DinDin Cart Hardening', () => {
    it('enforces server-authoritative shift opening_cash and operator ownership in reconcileShiftCash', async () => {
      const mockDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM staff_shifts')) {
                return {
                  clock_in: '2026-11-04T08:00:00.000Z',
                  clock_out: null,
                  opening_cash: 500000,
                  staff_id: 'cashier_owner',
                  tenant_id: 'store-a',
                };
              }
              if (sql.includes('FROM shift_reconciliations')) {
                return null;
              }
              if (sql.includes('FROM payments')) {
                return { total: 200000 };
              }
              if (sql.includes('FROM cash_payouts')) {
                return { total: 0 };
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      };

      await expect(
        reconcileShiftCash(
          { AURA_DB: mockDb } as never,
          {
            shift_id: 'shift_bi4_1',
            opening_float: 0,
            denominations: { denominations: [{ denomination: 500000, count: 1 }, { denomination: 200000, count: 1 }] },
          },
          'other_cashier',
          'store-a'
        )
      ).rejects.toThrow(/Shift operator mismatch/);

      const recon = await reconcileShiftCash(
        { AURA_DB: mockDb } as never,
        {
          shift_id: 'shift_bi4_1',
          opening_float: 0, // Spoofed 0 opening float; server shift has 500,000 + 200,000 cash sales = 700,000
          denominations: { denominations: [{ denomination: 200000, count: 1 }] },
        },
        'cashier_owner',
        'store-a'
      );
      expect(recon.expected_cash).toBe(700000);
      expect(recon.variance).toBe(-500000);
    });

    it('blocks retroactive tip fabrication on a paid order when existingTipAmount is 0', async () => {
      const { token, account } = await makeStaffToken({
        id: 'cashier_1',
        role: 'cashier',
        tenant_id: 'store-a',
      });

      const mockDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM users')) return account;
              if (sql.includes('FROM orders')) {
                return {
                  id: 'ord_settled_1',
                  total: 200000,
                  tip_amount: 0,
                  updated_by: 'waiter_1',
                  status: 'completed',
                  payment_status: 'paid',
                  tenant_id: 'store-a',
                };
              }
              return null;
            },
          }),
        }),
      };

      const res = await staffTipsRouter.fetch(
        new Request('https://test.aura/assign', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-ID': 'store-a',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_id: 'ord_settled_1',
            staff_id: 'cashier_1',
            tip_amount: 50000,
          }),
        }),
        {
          JWT_SECRET: TEST_JWT_SECRET,
          AURA_DB: mockDb,
        } as unknown as Env
      );
      expect(res.status).toBe(409);
    });

    it('revokes AUTH_KV user:<email> cache via staff_login_identities when users.email is null on DELETE /api/staff/:id', async () => {
      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'owner_1', role: 'owner', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerStaffHandlers(app);

      const kvStore = new Map<string, string>([
        ['user:barista@store-a.vn', JSON.stringify({ id: 'staff_target_1', email: 'barista@store-a.vn', role: 'barista', active: true })],
      ]);
      const mockKv = {
        get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
        put: vi.fn(async (k: string, v: string) => {
          kvStore.set(k, v);
        }),
        delete: vi.fn(async (k: string) => {
          kvStore.delete(k);
        }),
      };

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM users') && args[0] === 'owner_1') {
                return { id: 'owner_1', name: 'Owner', phone: null, role: 'owner', tenant_id: 'store-a', is_active: 1, auth_version: 1 };
              }
              if (sql.includes('FROM users') && args[0] === 'staff_target_1') {
                return { id: 'staff_target_1', name: 'Barista', phone: null, email: null, role: 'barista', tenant_id: 'store-a', is_active: 1, auth_version: 1 };
              }
              if (sql.includes('FROM staff_login_identities')) {
                return { email: 'barista@store-a.vn' };
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      };

      const res = await app.request(
        'http://localhost/api/staff/staff_target_1',
        { method: 'DELETE' },
        {
          AURA_DB: mockDb,
          AUTH_KV: mockKv,
        } as unknown as Env
      );
      expect(res.status).toBe(200);
      const updated = JSON.parse(kvStore.get('user:barista@store-a.vn') || '{}');
      expect(updated.active).toBe(false);
      expect(updated.is_active).toBe(0);
    });

    it('prevents non-default tenant writeCart from falling back to tenantless dindin_cart INSERT on D1 error', async () => {
      const executedSql: string[] = [];
      const mockDb = {
        prepare: (sql: string) => {
          executedSql.push(sql);
          return {
            bind: () => ({
              run: async () => {
                throw new Error('simulated D1 error');
              },
            }),
          };
        },
      };

      await writeCart(
        {
          AURA_DB: mockDb,
          AUTH_KV: { put: vi.fn(), get: vi.fn() },
        } as unknown as Env,
        'sess_123',
        { items: [], updatedAt: new Date().toISOString() } as never,
        'store-b'
      );
      expect(executedSql.length).toBe(1);
      expect(executedSql[0]).toContain('tenant_id');
    });
  });
});
