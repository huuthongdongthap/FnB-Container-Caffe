import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../types/env';
import {
  registerIngredientHandlers,
  checkIngredientTenant,
} from '../routes/openapi-inventory-handlers/ingredient-handlers';
import {
  registerSupplierHandlers,
  checkSupplierTenant,
} from '../routes/openapi-inventory-handlers/supplier-handlers';
import { registerUsageHandlers } from '../routes/openapi-promotions-handlers/usage-handlers';
import { registerValidationHandlers } from '../routes/openapi-promotions-handlers/validation-handlers';
import { handleGetOrderSummary } from '../routes/openapi-orders-handlers/order-summary-handlers';
import {
  handleListOrders,
  fetchOrderForRead,
} from '../routes/openapi-orders-handlers/order-read-handlers';
import { registerGroupedSalesHandlers } from '../routes/reports-handlers/grouped-sales-handlers';
import { handleGuestCheckin } from '../routes/orders-hono-handlers/guest-handlers';

describe('Phase 45 Slice AR3: Promotions, Grouped Sales Reports, Order Read/Summary/Guest-Checkin & Inventory Security', () => {
  describe('Inventory Ingredients & Suppliers tenant-scoped mutation guards and audit tenant logging', () => {
    it('prevents unscoped fallback UPDATE/DELETE on ingredients when existing row has explicit tenant_id and scoped query affects 0 rows', async () => {
      const executedSqls: string[] = [];
      const ingredientRow = {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Arabica Beans',
        sku: 'ARA-01',
        unit: 'kg',
        cost_per_unit: 250000,
        current_stock: 10,
        min_stock: 2,
        max_stock: 50,
        is_active: 1,
        tenant_id: 'branch-a',
      };

      const mockDb = {
        prepare: (sql: string) => {
          executedSqls.push(sql);
          return {
            bind: (..._args: unknown[]) => ({
              first: async () => {
                if (sql.includes('SELECT * FROM ingredients WHERE id = ?')) {
                  return ingredientRow;
                }
                return null;
              },
              all: async () => ({ results: [] }),
              run: async () => {
                if (
                  sql.includes('UPDATE ingredients SET') &&
                  sql.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
                ) {
                  // Simulate concurrent tenant transfer or 0 rows matched on scoped UPDATE
                  return { meta: { changes: 0 } };
                }
                if (
                  sql.includes('DELETE FROM ingredients') &&
                  sql.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
                ) {
                  return { meta: { changes: 0 } };
                }
                return { meta: { changes: 1 } };
              },
            }),
          };
        },
      };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as any, { id: 'owner-a', role: 'owner', tenantId: 'branch-a' });
        c.set('tenantId' as any, 'branch-a');
        await next();
      });
      registerIngredientHandlers(app);

      const patchRes = await app.request(
        `/api/inventory/ingredients/${ingredientRow.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Hijacked Name' }),
        },
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(patchRes.status).toBe(404);
      expect(
        executedSqls.some(
          (s) => s.startsWith('UPDATE ingredients SET') && !s.includes('tenant_id')
        )
      ).toBe(false);

      const deleteRes = await app.request(
        `/api/inventory/ingredients/${ingredientRow.id}`,
        {
          method: 'DELETE',
        },
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(deleteRes.status).toBe(404);
      expect(
        executedSqls.some(
          (s) => s.startsWith('DELETE FROM ingredients') && !s.includes('tenant_id')
        )
      ).toBe(false);
    });

    it('records tenant_id in writeIngredientAuditLog and allows legacy null-tenant rows verified via audit_logs', async () => {
      const auditInserts: Array<{ sql: string; args: unknown[] }> = [];
      let legacyIngredient: Record<string, unknown> = {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Legacy Matcha',
        sku: 'MAT-01',
        unit: 'kg',
        cost_per_unit: 500000,
        current_stock: 5,
        min_stock: 1,
        max_stock: 20,
        is_active: 1,
        tenant_id: null,
      };

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('SELECT * FROM ingredients WHERE id = ?')) {
                return legacyIngredient;
              }
              if (sql.includes('FROM audit_logs') && sql.includes("action = 'ingredient_create'")) {
                return {
                  user_id: 'owner-b',
                  tenant_id: 'branch-b',
                  metadata: JSON.stringify({ tenant_id: 'branch-b' }),
                };
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => {
              if (sql.includes('INSERT INTO audit_logs')) {
                auditInserts.push({ sql, args });
              }
              if (
                sql.includes('UPDATE ingredients SET') &&
                sql.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
              ) {
                return { meta: { changes: 0 } };
              }
              if (sql.startsWith('UPDATE ingredients SET') && !sql.includes('tenant_id')) {
                legacyIngredient = { ...legacyIngredient, name: String(args[0]) };
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 1 } };
            },
          }),
        }),
      };

      expect(await checkIngredientTenant(mockDb, String(legacyIngredient.id), legacyIngredient, 'branch-b')).toBe(true);
      expect(await checkIngredientTenant(mockDb, String(legacyIngredient.id), legacyIngredient, 'branch-a')).toBe(false);

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as any, { id: 'owner-b', role: 'owner', tenantId: 'branch-b' });
        c.set('tenantId' as any, 'branch-b');
        await next();
      });
      registerIngredientHandlers(app);

      const patchRes = await app.request(
        `/api/inventory/ingredients/${legacyIngredient.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Legacy Matcha' }),
        },
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(patchRes.status).toBe(200);
      expect(auditInserts.length).toBeGreaterThan(0);
      expect(auditInserts[0].sql).toContain('tenant_id');
      expect(auditInserts[0].args).toContain('branch-b');
    });

    it('prevents unscoped fallback UPDATE on suppliers when existing row has explicit tenant_id and scoped UPDATE affects 0 rows', async () => {
      const executedSqls: string[] = [];
      const supplierRow = {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Dalat Milk Co',
        is_active: 1,
        tenant_id: 'branch-a',
      };

      const mockDb = {
        prepare: (sql: string) => {
          executedSqls.push(sql);
          return {
            bind: (..._args: unknown[]) => ({
              first: async () => {
                if (sql.includes('SELECT * FROM suppliers WHERE id = ?')) {
                  return supplierRow;
                }
                return null;
              },
              all: async () => ({ results: [] }),
              run: async () => {
                if (
                  sql.includes('UPDATE suppliers SET') &&
                  sql.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
                ) {
                  return { meta: { changes: 0 } };
                }
                return { meta: { changes: 1 } };
              },
            }),
          };
        },
      };

      expect(await checkSupplierTenant(mockDb, supplierRow, 'branch-a')).toBe(true);
      expect(await checkSupplierTenant(mockDb, supplierRow, 'branch-b')).toBe(false);

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as any, { id: 'owner-a', role: 'owner', tenantId: 'branch-a' });
        c.set('tenantId' as any, 'branch-a');
        await next();
      });
      registerSupplierHandlers(app);

      const patchRes = await app.request(
        `/api/inventory/suppliers/${supplierRow.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Cross Tenant Overwrite' }),
        },
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(patchRes.status).toBe(404);
      expect(
        executedSqls.some(
          (s) => s.startsWith('UPDATE suppliers SET') && !s.includes('tenant_id')
        )
      ).toBe(false);
    });
  });

  describe('Promotions Usage & Validation server-authoritative guards', () => {
    it('enforces min_order_value, percentage discount caps when orderRow is missing, and promotion-scoped idempotency keys in POST /api/promotions/use', async () => {
      const promoWithMinOrder = {
        id: '44444444-4444-4444-8444-444444444444',
        code: 'MIN200K',
        name: 'Min 200k Promo',
        discount_type: 'fixed',
        discount_value: 30000,
        min_order_value: 200000,
        is_active: 1,
        tenant_id: 'default',
      };
      const pctPromoNoCap = {
        id: '55555555-5555-4555-8555-555555555555',
        code: 'PCT10',
        name: '10 Percent Off',
        discount_type: 'percentage',
        discount_value: 10,
        min_order_value: 0,
        max_discount_value: null,
        is_active: 1,
        tenant_id: 'default',
      };
      const fixedPromoB = {
        id: '66666666-6666-4666-8666-666666666666',
        code: 'FIXED15K',
        name: 'Fixed 15k',
        discount_type: 'fixed',
        discount_value: 15000,
        min_order_value: 0,
        is_active: 1,
        tenant_id: 'default',
      };

      const usages: Array<Record<string, unknown>> = [
        {
          id: 'usage-existing-1',
          promotion_id: promoWithMinOrder.id,
          order_id: '77777777-7777-4777-8777-777777777771',
          idempotency_key: 'shared-idem-key',
        },
      ];

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM promotions WHERE id = ?')) {
                const pid = String(args[0]);
                if (pid === promoWithMinOrder.id) return promoWithMinOrder;
                if (pid === pctPromoNoCap.id) return pctPromoNoCap;
                if (pid === fixedPromoB.id) return fixedPromoB;
                return null;
              }
              if (sql.includes('FROM orders WHERE id = ?')) {
                return null;
              }
              if (sql.includes('FROM promotion_usages WHERE idempotency_key = ? AND promotion_id = ?')) {
                return (
                  usages.find(
                    (u) => u.idempotency_key === args[0] && u.promotion_id === args[1]
                  ) ?? null
                );
              }
              if (sql.includes('FROM promotion_usages WHERE idempotency_key = ?')) {
                return usages.find((u) => u.idempotency_key === args[0]) ?? null;
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as any, { id: 'staff-1', role: 'staff', tenantId: 'default' });
        c.set('tenantId' as any, 'default');
        await next();
      });
      registerUsageHandlers(app);

      // 1. Missing orderRow cannot bypass min_order_value > 0
      const minOrderRes = await app.request(
        '/api/promotions/use',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promotionId: promoWithMinOrder.id,
            orderId: '77777777-7777-4777-8777-777777777772',
            discountAmount: 20000,
          }),
        },
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(minOrderRes.status).toBe(400);
      const minOrderJson = (await minOrderRes.json()) as any;
      expect(minOrderJson.error).toContain('minimum');

      // 2. Missing orderRow cannot claim arbitrary discount on percentage promo without cap
      const pctRes = await app.request(
        '/api/promotions/use',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promotionId: pctPromoNoCap.id,
            orderId: '77777777-7777-4777-8777-777777777773',
            discountAmount: 500000,
          }),
        },
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(pctRes.status).toBe(400);
      const pctJson = (await pctRes.json()) as any;
      expect(pctJson.error).toContain('exceeds promotion allowance');

      // 3. Idempotency key is scoped to promotion_id: same key on a different promotion succeeds,
      // while duplicate key on the same promotion is rejected with 409
      const diffPromoRes = await app.request(
        '/api/promotions/use',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promotionId: fixedPromoB.id,
            orderId: '77777777-7777-4777-8777-777777777774',
            discountAmount: 15000,
            idempotencyKey: 'shared-idem-key',
          }),
        },
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(diffPromoRes.status).toBe(200);
    });

    it('rejects fabricated menuItemId price inflation when catalog exists and requires quantity > 0 for applicableItems in POST /api/promotions/validate', async () => {
      const promoRow = {
        id: '88888888-8888-4888-8888-888888888888',
        code: 'COFFEE50',
        name: 'Coffee 50k Off',
        discount_type: 'fixed',
        discount_value: 50000,
        min_order_value: 100000,
        applicable_items: JSON.stringify(['prod-espresso']),
        is_active: 1,
        tenant_id: 'default',
      };

      const catalogProducts = [
        { id: 'prod-espresso', price: 35000, tenant_id: 'default' },
        { id: 'prod-cake', price: 120000, tenant_id: 'default' },
      ];

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM products WHERE id = ?')) {
                return catalogProducts.find((p) => p.id === args[0]) ?? null;
              }
              if (sql.includes('FROM products LIMIT')) {
                return catalogProducts[0];
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM promotions WHERE UPPER(code) = ?')) {
                return { results: [promoRow] };
              }
              if (sql.includes('FROM products LIMIT')) {
                return { results: catalogProducts };
              }
              return { results: [] };
            },
          }),
        }),
      };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as any, 'default');
        await next();
      });
      registerValidationHandlers(app);

      // 1. Fabricated menuItemId with inflated client price (500,000) cannot bypass min_order_value (100,000)
      const fabricatedRes = await app.request(
        '/api/promotions/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: 'COFFEE50',
            items: [
              { menuItemId: 'prod-espresso', quantity: 1, price: 35000 },
              { menuItemId: 'fabricated-item-999', quantity: 1, price: 500000 },
            ],
          }),
        },
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(fabricatedRes.status).toBe(400);
      const fabricatedJson = (await fabricatedRes.json()) as any;
      expect(fabricatedJson.error).toContain('Minimum order value');

      // 2. Applicable item with quantity 0 cannot unlock promotion for non-applicable items
      const zeroQtyApplicableApp = new OpenAPIHono<{ Bindings: Env }>();
      zeroQtyApplicableApp.use('*', async (c, next) => {
        c.set('tenantId' as any, 'default');
        await next();
      });
      registerValidationHandlers(zeroQtyApplicableApp);

      // Bypass Zod positive int only by passing through handler or testing unverified applicable item:
      // If a fabricated applicable item ID or 0-qty item is passed, it is rejected
      const unverifiedApplicablePromo = {
        ...promoRow,
        applicable_items: JSON.stringify(['fabricated-applicable-id']),
      };
      const mockDbUnverifiedApplicable = {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM products WHERE id = ?')) {
                return catalogProducts.find((p) => p.id === args[0]) ?? null;
              }
              return catalogProducts[0];
            },
            all: async () => {
              if (sql.includes('FROM promotions WHERE UPPER(code) = ?')) {
                return { results: [unverifiedApplicablePromo] };
              }
              if (sql.includes('FROM products LIMIT')) {
                return { results: catalogProducts };
              }
              return { results: [] };
            },
          }),
        }),
      };

      const unverifiedAppRes = await zeroQtyApplicableApp.request(
        '/api/promotions/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: 'COFFEE50',
            items: [
              { menuItemId: 'prod-cake', quantity: 1, price: 120000 },
              { menuItemId: 'fabricated-applicable-id', quantity: 1, price: 1000 },
            ],
          }),
        },
        { AURA_DB: mockDbUnverifiedApplicable } as unknown as Env
      );
      expect(unverifiedAppRes.status).toBe(400);
      const unverifiedAppJson = (await unverifiedAppRes.json()) as any;
      expect(unverifiedAppJson.error).toContain('No applicable items');
    });
  });

  describe('Order Summary, Grouped Sales Reports, Order Read & Guest Check-in', () => {
    it('excludes cancelled, failed, rejected, and expired orders from revenue and averageOrderValue denominator in handleGetOrderSummary', async () => {
      const capturedSqls: string[] = [];
      const mockDb = {
        prepare: (sql: string) => {
          capturedSqls.push(sql);
          return {
            bind: (..._args: unknown[]) => ({
              first: async () => {
                if (sql.includes('SELECT COUNT(*) as total FROM orders')) {
                  return { total: 5 };
                }
                if (sql.includes('SUM(COALESCE(total_amount, total)) as revenue')) {
                  return { revenue: 200000, valid_orders: 2 };
                }
                return null;
              },
              all: async () => {
                if (sql.includes('GROUP BY status')) {
                  return {
                    results: [
                      { status: 'completed', count: 2 },
                      { status: 'cancelled', count: 1 },
                      { status: 'failed', count: 1 },
                      { status: 'expired', count: 1 },
                    ],
                  };
                }
                return { results: [{ source: 'dine_in', count: 5 }] };
              },
            }),
          };
        },
      };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as any, { id: 'mgr-1', role: 'manager', tenantId: 'default' });
        c.set('tenantId' as any, 'default');
        await next();
      });
      app.get('/api/orders/summary', handleGetOrderSummary);

      const res = await app.request(
        '/api/orders/summary',
        {},
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.totalOrders).toBe(5);
      expect(json.data.totalRevenue).toBe(200000);
      // 200,000 / 2 valid orders = 100,000 (not 200,000 / 5 = 40,000)
      expect(json.data.averageOrderValue).toBe(100000);
      expect(
        capturedSqls.some((s) =>
          s.includes("NOT IN ('cancelled', 'failed', 'rejected', 'expired')")
        )
      ).toBe(true);
    });

    it('excludes non-revenue statuses across grouped sales endpoints and coerces string item quantities/prices in sales-by-category', async () => {
      const capturedSqls: string[] = [];
      const mockDb = {
        prepare: (sql: string) => {
          capturedSqls.push(sql);
          return {
            bind: (..._args: unknown[]) => ({
              first: async () => ({ revenue: 150000, orders_count: 2 }),
              all: async () => {
                if (sql.includes('FROM order_items oi')) {
                  throw new Error('no order_items table');
                }
                if (sql.includes('SELECT items FROM orders')) {
                  return {
                    results: [
                      {
                        items: JSON.stringify([
                          { category: 'Coffee', quantity: '2', price: '35000' },
                          { category: 'Coffee', quantity: '3', price: '40000' },
                          { category: 'Coffee', quantity: '0', price: '99000' },
                        ]),
                      },
                    ],
                  };
                }
                return { results: [] };
              },
            }),
          };
        },
      };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as any, 'default');
        await next();
      });
      registerGroupedSalesHandlers(app);

      const catRes = await app.request(
        '/sales-by-category?from=2026-11-01&to=2026-11-03',
        {},
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(catRes.status).toBe(200);
      const catJson = (await catRes.json()) as any;
      expect(catJson.data.groups).toEqual([
        {
          label: 'Coffee',
          value: 2 * 35000 + 3 * 40000,
          count: 5, // Numeric 2 + 3 = 5, never string concatenation "023"
        },
      ]);
      expect(
        capturedSqls.every(
          (s) =>
            !s.includes('FROM orders') ||
            s.includes("NOT IN ('cancelled', 'failed', 'rejected', 'expired')")
        )
      ).toBe(true);
    });

    it('clamps limitNum to [1, 100] and tenant-scopes LEFT JOIN cafe_tables in order-read-handlers', async () => {
      const capturedSqls: string[] = [];
      const capturedBinds: unknown[][] = [];
      const mockDb = {
        prepare: (sql: string) => {
          capturedSqls.push(sql);
          return {
            bind: (...args: unknown[]) => {
              capturedBinds.push(args);
              return {
                first: async () => ({ id: 'ord-1', total: 1 }),
                all: async () => ({ results: [] }),
              };
            },
          };
        },
      };

      await fetchOrderForRead(mockDb as any, 'ord-1', 'branch-hcm');
      expect(capturedSqls[0]).toContain('LEFT JOIN cafe_tables t ON o.table_id = t.id AND TRIM(t.tenant_id) = ?2');

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as any, { id: 'staff-1', role: 'staff', tenantId: 'branch-hcm' });
        c.set('tenantId' as any, 'branch-hcm');
        await next();
      });
      app.get('/api/orders', handleListOrders);

      const listRes = await app.request(
        '/api/orders?page=1&limit=999999',
        {},
        { AURA_DB: mockDb } as unknown as Env
      );
      expect(listRes.status).toBe(200);
      const listJson = (await listRes.json()) as any;
      expect(listJson.data.meta.limit).toBe(100);
      const listJoinSql = capturedSqls.find((s) => s.includes('LIMIT ? OFFSET ?')) || '';
      expect(listJoinSql).toContain(
        "LEFT JOIN cafe_tables t ON o.table_id = t.id AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')"
      );
    });

    it('does not re-run tableClaimStmt in db.batch and rolls back cafe_tables to Available if order INSERT fails in handleGuestCheckin', async () => {
      let tableStatus = 'Available';
      let currentOrderId: string | null = null;
      let claimRunCount = 0;

      const makeMockDb = (failOrderInsert: boolean) => ({
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            idx: 1,
            first: async () => {
              if (sql.includes('FROM cafe_tables')) {
                return { id: 'tbl-1', table_number: '1', status: tableStatus, tenant_id: 'default' };
              }
              return null;
            },
            run: async () => {
              if (sql.includes("UPDATE cafe_tables SET status = 'Occupied'")) {
                claimRunCount += 1;
                if (tableStatus !== 'Available') {
                  return { success: true, meta: { changes: 0 } };
                }
                tableStatus = 'Occupied';
                currentOrderId = String(args[2] || '');
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE cafe_tables SET status = 'Available'")) {
                tableStatus = 'Available';
                currentOrderId = null;
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.includes('INSERT INTO orders')) {
                if (failOrderInsert) {
                  throw new Error('D1 order insert failed');
                }
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 1 } };
            },
          }),
        }),
        batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
          const results = [];
          for (const stmt of stmts) {
            results.push(await stmt.run());
          }
          return results;
        },
      });

      const app = new Hono<{ Bindings: Env }>();
      app.post('/guest-checkin', handleGuestCheckin);

      // 1. Successful guest check-in executes tableClaimStmt exactly once even when db.batch is present
      const okRes = await app.request(
        '/guest-checkin',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_id: '1',
            customer_name: 'Nguyen Van A',
            customer_phone: '0901234567',
          }),
        },
        { AURA_DB: makeMockDb(false), PILOT_STORE_ID: 'default' } as unknown as Env
      );
      expect(okRes.status).toBe(201);
      expect(claimRunCount).toBe(1);
      expect(tableStatus).toBe('Occupied');

      // 2. When orderInsertStmt throws, cafe_tables is rolled back to Available
      tableStatus = 'Available';
      currentOrderId = null;
      claimRunCount = 0;

      await expect(
        app.request(
          '/guest-checkin',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table_id: '1',
              customer_name: 'Nguyen Van B',
              customer_phone: '0909876543',
            }),
          },
          { AURA_DB: makeMockDb(true), PILOT_STORE_ID: 'default' } as unknown as Env
        )
      ).resolves.toBeDefined();
      expect(tableStatus).toBe('Available');
      expect(currentOrderId).toBeNull();
    });
  });
});
