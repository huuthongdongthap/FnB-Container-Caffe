// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { purchasing } from '../../../packages/domain/inventory/src/routes/purchasing';
import {
  createCanonicalPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from '../../../packages/domain/inventory/src/policies/purchasing-receiving-policy';
import {
  getRecipeForProduct,
  calculateBomDepletion,
  deductIngredientsForOrder,
} from '../../../packages/domain/inventory/src/policies/bom-policy';
import { reconcileShiftCash } from '../../../packages/domain/shift/src/policies/cash-reconciliation-policy';
import { app } from '../index';
import { paymentSqliteDB } from './helpers/payment-sqlite-db';
import { generateJWT } from '../lib/jwt';
import { createMockEnv } from './test-utils';

const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';

describe('Phase 46 Slice AS3 — Purchasing & Receiving, BOM Depletion, Cash Reconciliation & OpenAPI Payments RBAC', () => {
  describe('AS3-1: Canonical Purchasing Router & Policy Hardening', () => {
    function buildPurchasingFixture() {
      const suppliers = [
        { id: 'sup_a', name: 'Supplier A', is_active: 1, tenant_id: 'tenant_a' },
      ];
      const ingredients = [
        { id: 'ing_a1', name: 'Espresso Beans', current_stock: 100, cost_per_unit: 250, tenant_id: 'tenant_a' },
      ];
      const purchaseOrders: Array<Record<string, unknown>> = [];
      const purchaseOrderItems: Array<Record<string, unknown>> = [];
      const stockMovements: Array<Record<string, unknown>> = [];
      let simulateConcurrentOverReceive = false;

      const db = {
        setSimulateConcurrentOverReceive(val: boolean) {
          simulateConcurrentOverReceive = val;
        },
        purchaseOrders,
        purchaseOrderItems,
        stockMovements,
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM suppliers WHERE id = ?')) {
                return suppliers.find((s) => s.id === args[0]) ?? null;
              }
              if (sql.includes('FROM ingredients WHERE id = ?')) {
                return ingredients.find((i) => i.id === args[0]) ?? null;
              }
              if (sql.includes('FROM purchase_orders WHERE id = ?')) {
                return purchaseOrders.find((p) => p.id === args[0]) ?? null;
              }
              if (sql.includes('FROM stock_movements WHERE reference_id = ?')) {
                const refId = args[0];
                const tenant = args[1];
                return (
                  stockMovements.find(
                    (m) => m.reference_id === refId && (!tenant || (m.tenant_id || 'default') === tenant)
                  ) ?? null
                );
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM purchase_orders')) {
                return { results: purchaseOrders };
              }
              if (sql.includes('FROM purchase_order_items WHERE purchase_order_id = ?')) {
                const poId = args[0];
                return {
                  results: purchaseOrderItems.filter((item) => item.purchase_order_id === poId),
                };
              }
              return { results: [] };
            },
            run: async () => {
              if (sql.includes('INSERT INTO purchase_orders')) {
                purchaseOrders.push({
                  id: args[0],
                  po_number: args[1],
                  supplier_id: args[2],
                  status: 'ordered',
                  subtotal: args[5],
                  total: args[6],
                  tenant_id: args[11] ?? 'default',
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes('INSERT INTO purchase_order_items')) {
                purchaseOrderItems.push({
                  id: args[0],
                  purchase_order_id: args[1],
                  ingredient_id: args[2],
                  quantity: args[3],
                  unit_price: args[4],
                  total_price: args[5],
                  received_quantity: 0,
                  tenant_id: args[6] ?? 'default',
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE purchase_order_items SET received_quantity = ?')) {
                if (simulateConcurrentOverReceive) {
                  return { meta: { changes: 0 } };
                }
                const item = purchaseOrderItems.find((i) => i.id === args[1]);
                const incoming = Number(args[2] ?? 0);
                if (!item || Number(item.received_quantity || 0) + incoming > Number(item.quantity)) {
                  return { meta: { changes: 0 } };
                }
                item.received_quantity = args[0];
                return { meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE ingredients SET current_stock = current_stock + ?')) {
                const ing = ingredients.find((i) => i.id === args[3]);
                if (ing) ing.current_stock += Number(args[0]);
                return { meta: { changes: 1 } };
              }
              if (sql.includes('INSERT INTO stock_movements')) {
                stockMovements.push({
                  id: args[0],
                  ingredient_id: args[1],
                  quantity: args[2],
                  reference_id: args[3],
                  tenant_id: args[7] ?? 'default',
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE purchase_orders SET status = 'cancelled'")) {
                const po = purchaseOrders.find((p) => p.id === args[1]);
                if (po) po.status = 'cancelled';
                return { meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE purchase_orders SET status = ?')) {
                const po = purchaseOrders.find((p) => p.id === args[2]);
                if (po) po.status = args[0];
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 1 } };
            },
          }),
        }),
        batch: async () => [],
      };

      return { db, suppliers, ingredients, purchaseOrders, purchaseOrderItems, stockMovements };
    }

    it('rejects unauthenticated (401) and unauthorized role (403) requests on purchasing mutation and read routes', async () => {
      const { db, purchaseOrders, purchaseOrderItems } = buildPurchasingFixture();
      purchaseOrders.push({
        id: 'po_1',
        po_number: 'PO-000001',
        supplier_id: 'sup_a',
        status: 'ordered',
        tenant_id: 'tenant_a',
      });
      purchaseOrderItems.push(
        { id: 'poi_1', purchase_order_id: 'po_1', ingredient_id: 'ing_a1', quantity: 10, tenant_id: 'tenant_a' },
        { id: 'poi_foreign', purchase_order_id: 'po_1', ingredient_id: 'ing_b1', quantity: 99, tenant_id: 'tenant_b' }
      );

      let currentUser: { role: string } | undefined;
      const poApp = new Hono<any>();
      poApp.use('*', async (c, next) => {
        if (currentUser) c.set('user', currentUser);
        c.set('tenantId', 'tenant_a');
        await next();
      });
      purchasing(poApp);

      // 1. Unauthenticated POST mutations -> 401
      currentUser = undefined;
      const unauthCreate = await poApp.fetch(
        new Request('https://api.test/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplier_id: 'sup_a', items: [{ ingredient_id: 'ing_a1', quantity: 5, unit_cost: 200 }] }),
        }),
        { AURA_DB: db } as any
      );
      expect(unauthCreate.status).toBe(401);

      const unauthReceive = await poApp.fetch(
        new Request('https://api.test/purchase-orders/po_1/receive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ ingredient_id: 'ing_a1', quantity: 5 }] }),
        }),
        { AURA_DB: db } as any
      );
      expect(unauthReceive.status).toBe(401);

      const unauthCancel = await poApp.fetch(
        new Request('https://api.test/purchase-orders/po_1/cancel', { method: 'POST' }),
        { AURA_DB: db } as any
      );
      expect(unauthCancel.status).toBe(401);

      // 2. Unauthorized role on GET & POST -> 403
      currentUser = { role: 'customer' };
      const customerList = await poApp.fetch(
        new Request('https://api.test/purchase-orders'),
        { AURA_DB: db } as any
      );
      expect(customerList.status).toBe(403);

      const customerDetail = await poApp.fetch(
        new Request('https://api.test/purchase-orders/po_1'),
        { AURA_DB: db } as any
      );
      expect(customerDetail.status).toBe(403);

      // 3. Kitchen role can read POs & detail filters purchase_order_items by tenant_id
      currentUser = { role: 'kitchen' };
      const kitchenDetail = await poApp.fetch(
        new Request('https://api.test/purchase-orders/po_1'),
        { AURA_DB: db } as any
      );
      expect(kitchenDetail.status).toBe(200);
      const detailBody = (await kitchenDetail.json()) as { data: { items: Array<{ id: string }> } };
      expect(detailBody.data.items.map((i) => i.id)).toEqual(['poi_1']);
    });

    it('rejects duplicate ingredientId lines, concurrent over-receiving, and cancelling partially_received POs', async () => {
      const { db } = buildPurchasingFixture();

      // 1. Duplicate ingredientId in createCanonicalPurchaseOrder -> throws
      await expect(
        createCanonicalPurchaseOrder(
          db as any,
          {
            supplierId: 'sup_a',
            items: [
              { ingredientId: 'ing_a1', quantity: 10, unitPrice: 250 },
              { ingredientId: 'ing_a1', quantity: 5, unitPrice: 250 },
            ],
            tenantId: 'tenant_a',
          },
          'tenant_a'
        )
      ).rejects.toThrow(/Duplicate ingredient ing_a1/);

      // 2. Valid PO creation
      const po = await createCanonicalPurchaseOrder(
        db as any,
        {
          supplierId: 'sup_a',
          items: [{ ingredientId: 'ing_a1', quantity: 10, unitPrice: 250 }],
          tenantId: 'tenant_a',
        },
        'tenant_a'
      );

      // 3. Partial receive succeeds -> status becomes partially_received
      const partialRes = await receivePurchaseOrder(
        db as any,
        po.id,
        [{ ingredientId: 'ing_a1', receivedQuantity: 4 }],
        { receiptId: 'rcpt_part_1', tenantId: 'tenant_a' }
      );
      expect(partialRes.ok).toBe(true);
      expect(partialRes.status).toBe('partially_received');

      // 4. Cancelling a partially_received PO is rejected
      const cancelPartial = await cancelPurchaseOrder(db as any, po.id, 'tenant_a');
      expect(cancelPartial.ok).toBe(false);
      expect(cancelPartial.error).toBe('cannot_cancel_partially_received_order');

      // 5. Concurrent over-receiving where conditional UPDATE returns 0 changes is rejected
      db.setSimulateConcurrentOverReceive(true);
      const concurrentRcv = await receivePurchaseOrder(
        db as any,
        po.id,
        [{ ingredientId: 'ing_a1', receivedQuantity: 6 }],
        { receiptId: 'rcpt_part_2', tenantId: 'tenant_a' }
      );
      expect(concurrentRcv.ok).toBe(false);
      expect(concurrentRcv.error).toBe('Cannot receive more than ordered quantity');
    });
  });

  describe('AS3-2: BOM Depletion Validation, Tenant Scoping & Order Idempotency', () => {
    it('skips non-finite or non-positive quantities in calculateBomDepletion and prevents non-default tenant recipe fallback', async () => {
      const recipeMap = new Map([
        [
          'prod_latte',
          [
            { ingredient_id: 'ing_beans', quantity: 18 },
            { ingredient_id: 'ing_bad_comp', quantity: -5 },
            { ingredient_id: 'ing_nan_comp', quantity: Number.NaN },
          ],
        ],
      ]);

      const depletion = calculateBomDepletion(
        [
          { product_id: 'prod_latte', quantity: 2 },
          { product_id: 'prod_latte', quantity: 0 },
          { product_id: 'prod_latte', quantity: -3 },
          { product_id: 'prod_latte', quantity: Number.NaN },
          { product_id: 'prod_latte', quantity: Number.POSITIVE_INFINITY },
        ],
        recipeMap
      );

      expect(depletion.get('ing_beans')).toBe(36);
      expect(depletion.has('ing_bad_comp')).toBe(false);
      expect(depletion.has('ing_nan_comp')).toBe(false);

      // Non-default tenant must not fall back to unscoped recipes query when tenant-scoped query fails
      const throwingTenantDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('tenant_id')) {
                throw new Error('no such column: tenant_id');
              }
              return { id: 'rec_default_leak' };
            },
            all: async () => ({ results: [{ ingredient_id: 'ing_leak', quantity: 10 }] }),
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
        batch: async () => [],
      };

      const leakedComponents = await getRecipeForProduct(throwingTenantDb as any, 'prod_latte', 'tenant_b');
      expect(leakedComponents).toEqual([]);
    });

    it('enforces idempotency in deductIngredientsForOrder and scopes ingredient updates and movements by tenant', async () => {
      const movements: Array<Record<string, unknown>> = [];
      const ingredientUpdates: Array<{ sql: string; args: unknown[] }> = [];

      const db = {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            sql,
            args,
            first: async () => {
              if (sql.includes('FROM stock_movements WHERE reference_id = ?')) {
                const orderId = args[0];
                const tenant = args[1];
                return (
                  movements.find(
                    (m) =>
                      m.reference_id === orderId &&
                      m.reference_type === 'order' &&
                      (!tenant || m.tenant_id === tenant)
                  ) ?? null
                );
              }
              if (sql.includes('FROM recipes WHERE product_id = ?')) {
                return { id: 'rec_espresso_a', tenant_id: 'tenant_a' };
              }
              return null;
            },
            all: async () => ({
              results: [{ ingredient_id: 'ing_beans_a', quantity: 18 }],
            }),
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
        batch: async (ops: Array<{ sql: string; args: unknown[] }>) => {
          for (const op of ops) {
            if (op.sql.includes('UPDATE ingredients')) {
              ingredientUpdates.push(op);
            }
            if (op.sql.includes('INSERT INTO stock_movements')) {
              movements.push({
                id: op.args[0],
                ingredient_id: op.args[1],
                quantity: op.args[2],
                reference_id: op.args[3],
                reference_type: 'order',
                tenant_id: op.args[6],
              });
            }
          }
          return [];
        },
      };

      await deductIngredientsForOrder(
        { AURA_DB: db as any },
        'ord_idem_1',
        [{ product_id: 'prod_espresso', quantity: 2 }],
        'tenant_a'
      );

      expect(ingredientUpdates).toHaveLength(1);
      expect(ingredientUpdates[0].sql).toContain("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?");
      expect(ingredientUpdates[0].args[3]).toBe('tenant_a');
      expect(movements).toHaveLength(1);

      // Second call for the same orderId in tenant_a is a no-op
      await deductIngredientsForOrder(
        { AURA_DB: db as any },
        'ord_idem_1',
        [{ product_id: 'prod_espresso', quantity: 2 }],
        'tenant_a'
      );
      expect(ingredientUpdates).toHaveLength(1);
      expect(movements).toHaveLength(1);
    });
  });

  describe('AS3-3: Shift Cash Reconciliation Isolation & Validation and OpenAPI Payments RBAC', () => {
    it('validates non-negative float/counted cash, prevents duplicate shift reconciliation, and isolates non-default tenant cash queries', async () => {
      const reconciliations: Array<Record<string, unknown>> = [];
      let joinedPaymentsCalled = false;

      const db = {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM staff_shifts WHERE id = ?')) {
                if (args[0] === 'shift_tenant_b') {
                  return {
                    clock_in: '2026-11-03T08:00:00.000Z',
                    clock_out: '2026-11-03T16:00:00.000Z',
                    tenant_id: 'tenant_b',
                  };
                }
                return null;
              }
              if (sql.includes('FROM shift_reconciliations WHERE shift_id = ?')) {
                const shiftId = args[0];
                const tenant = args[1];
                return (
                  reconciliations.find(
                    (r) => r.shift_id === shiftId && (!tenant || r.tenant_id === tenant)
                  ) ?? null
                );
              }
              if (sql.includes('FROM payments') && sql.includes('JOIN orders o ON o.id = p.order_id')) {
                joinedPaymentsCalled = true;
                return { total: 120000 };
              }
              if (sql.includes('FROM payments') && sql.includes('tenant_id')) {
                throw new Error('no such column: payments.tenant_id');
              }
              if (sql.includes('FROM cash_payouts') && sql.includes('tenant_id')) {
                throw new Error('no such column: cash_payouts.tenant_id');
              }
              if (sql.includes('FROM payments') || sql.includes('FROM cash_payouts')) {
                // Unscoped query would leak 999999 from other tenants if called
                return { total: 999999 };
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => {
              if (sql.includes('INSERT INTO shift_reconciliations')) {
                reconciliations.push({
                  id: args[0],
                  shift_id: args[1],
                  tenant_id: args[12],
                });
              }
              return { meta: { changes: 1 } };
            },
          }),
        }),
        batch: async () => [],
      };

      // 1. Negative opening_float is rejected
      await expect(
        reconcileShiftCash(
          { AURA_DB: db as any },
          {
            shift_id: 'shift_tenant_b',
            opening_float: -100,
            denominations: { denominations: [{ denomination: 100000, count: 1 }] },
          },
          'staff_1',
          'tenant_b'
        )
      ).rejects.toThrow(/Invalid opening_float/);

      // 2. Negative denomination count or actual_cash_counted is rejected
      await expect(
        reconcileShiftCash(
          { AURA_DB: db as any },
          {
            shift_id: 'shift_tenant_b',
            opening_float: 100000,
            denominations: { denominations: [{ denomination: 100000, count: -2 }] },
          },
          'staff_1',
          'tenant_b'
        )
      ).rejects.toThrow(/Invalid cash denomination or count/);

      // 3. Cross-tenant shift reconciliation is rejected
      await expect(
        reconcileShiftCash(
          { AURA_DB: db as any },
          {
            shift_id: 'shift_tenant_b',
            opening_float: 100000,
            denominations: { denominations: [{ denomination: 100000, count: 1 }] },
          },
          'staff_1',
          'tenant_a'
        )
      ).rejects.toThrow(/Shift not found or belongs to another tenant/);

      // 4. First reconciliation for shift_tenant_b uses JOIN orders fallback and returns 0 when payouts tenant query fails (no cross-tenant 999999 leak)
      const recon = await reconcileShiftCash(
        { AURA_DB: db as any },
        {
          shift_id: 'shift_tenant_b',
          opening_float: 200000,
          denominations: { denominations: [{ denomination: 100000, count: 3 }, { denomination: 20000, count: 1 }] },
        },
        'staff_1',
        'tenant_b'
      );
      expect(joinedPaymentsCalled).toBe(true);
      expect(recon.cash_payment_total).toBe(120000);
      expect(recon.cash_payout_total).toBe(0);
      expect(recon.expected_cash).toBe(320000);
      expect(recon.variance).toBe(0);

      // 5. Duplicate reconciliation for the same shift_id is rejected
      await expect(
        reconcileShiftCash(
          { AURA_DB: db as any },
          {
            shift_id: 'shift_tenant_b',
            opening_float: 200000,
            denominations: { denominations: [{ denomination: 100000, count: 3 }] },
          },
          'staff_1',
          'tenant_b'
        )
      ).rejects.toThrow(/already been reconciled/);
    });

    it('rejects staff and waiter roles on OpenAPI payments listing and refund routes with 403 Forbidden', async () => {
      const store = new Map<string, string>();
      const fixture = paymentSqliteDB();
      fixture.staffAccount('waiter-1', 'waiter', 'default');
      fixture.staffAccount('staff-1', 'staff', 'default');
      fixture.staffAccount('cashier-1', 'cashier', 'default');

      const env = {
        ...createMockEnv(),
        AURA_DB: fixture.db,
        AUTH_KV: {
          get: async (k: string) => store.get(k) ?? null,
          put: async (k: string, v: string) => {
            store.set(k, v);
          },
          delete: async (k: string) => {
            store.delete(k);
          },
        } as any,
        JWT_SECRET: TEST_SECRET,
      } as any;

      for (const [id, role] of [
        ['waiter-1', 'waiter'],
        ['staff-1', 'staff'],
      ] as const) {
        const token = await generateJWT(
          {
            id,
            sub: id,
            role,
            tenantId: 'default',
            authVersion: 1,
            authTime: Math.floor(Date.now() / 1000),
            sessionType: 'staff-web',
          },
          TEST_SECRET,
          28800
        );

        const listRes = await app.fetch(
          new Request('https://test.aura/api/payments', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          env
        );
        expect(listRes.status).toBe(403);

        const refundRes = await app.fetch(
          new Request('https://test.aura/api/payments/refund', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              paymentId: 'b1111111-1111-4111-8111-111111111111',
              amount: 10000,
              reason: 'Unauthorized role attempt',
            }),
          }),
          env
        );
        expect(refundRes.status).toBe(403);
      }

      const cashierToken = await generateJWT(
        {
          id: 'cashier-1',
          sub: 'cashier-1',
          role: 'cashier',
          tenantId: 'default',
          authVersion: 1,
          authTime: Math.floor(Date.now() / 1000),
          sessionType: 'staff-web',
        },
        TEST_SECRET,
        28800
      );
      const cashierListRes = await app.fetch(
        new Request('https://test.aura/api/payments', {
          headers: { Authorization: `Bearer ${cashierToken}` },
        }),
        env
      );
      expect(cashierListRes.status).toBe(200);
    });
  });
});
