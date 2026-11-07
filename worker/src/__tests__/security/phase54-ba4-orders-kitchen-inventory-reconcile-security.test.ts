// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { creditLoyaltyIfEligible } from '../../../../packages/domain/order/policies/loyalty-trigger';
import { splitOrders } from '../../../../packages/domain/order/commands/split-orders';
import { createOrder } from '../../../../packages/domain/order/commands/create-order';
import { kitchenStationsRouter } from '../../../../packages/domain/kitchen/commands/kitchen-stations';
import { collectCodPayment } from '../../../../packages/domain/kitchen/commands/collect-cod-payment';
import { restoreInventoryForOrder } from '../../../../packages/domain/inventory/src/routes/order-deduction';
import { inventoryTransactions } from '../../../../packages/domain/inventory/src/routes/inventory-transactions';
import { purchasing } from '../../../../packages/domain/inventory/src/routes/purchasing';
import { receivePurchaseOrder } from '../../../../packages/domain/inventory/src/policies/purchasing-receiving-policy';
import { manualReconcilePayment } from '../../routes/payment-reconcile-handlers/manual-reconcile';

import { generateJWT } from '../../lib/jwt';

const JWT_SECRET = 'test-secret-at-least-32-chars-long-12345';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        params = values;
        return stmt;
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const s = sqlite.prepare(sql);
        const row = s.get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] as T) ?? null);
        return row as unknown as T;
      },
      async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
        const s = sqlite.prepare(sql);
        const rows = s.all(...(params as never[])) as unknown as T[];
        return { results: rows, success: true };
      },
      async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
        const s = sqlite.prepare(sql);
        const info = s.run(...(params as never[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
    };
    return stmt;
  };

  return {
    prepare,
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const st of statements) {
        out.push(await st.run());
      }
      return out;
    },
    async exec(script: string) {
      sqlite.exec(script);
      return { count: 0, duration: 0 };
    },
    dump() {
      throw new Error('Not implemented');
    },
  } as unknown as D1Database;
}

describe('Phase 54 — Slice BA4 Security Hardening', () => {
  describe('BA4-2: Unpaid Order Loyalty Accrual Guard', () => {
    it('does not accrue loyalty points when payment_status is null or empty', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          total INTEGER,
          customer_id TEXT,
          customer_phone TEXT,
          customer_email TEXT,
          status TEXT,
          payment_status TEXT,
          tenant_id TEXT
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          loyalty_points INTEGER,
          loyalty_tier TEXT,
          total_spent INTEGER,
          tenant_id TEXT
        );
        CREATE TABLE cashback_transactions (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          customer_id TEXT,
          type TEXT,
          amount INTEGER,
          tenant_id TEXT
        );
        CREATE TABLE crm_policies (
          id TEXT PRIMARY KEY,
          config TEXT,
          tenant_id TEXT
        );
      `);
      sqlite.prepare("INSERT INTO customers (id, loyalty_points, loyalty_tier, total_spent, tenant_id) VALUES ('cust_1', 0, 'bronze', 0, 'default')").run();
      sqlite.prepare("INSERT INTO orders (id, total, customer_id, status, payment_status, tenant_id) VALUES ('ord_unpaid_null', 100000, 'cust_1', 'completed', NULL, 'default')").run();

      const db = createSqliteD1(sqlite);
      await creditLoyaltyIfEligible(db, {}, 'ord_unpaid_null');

      const cust = sqlite.prepare("SELECT loyalty_points FROM customers WHERE id = 'cust_1'").get() as { loyalty_points: number };
      expect(cust.loyalty_points).toBe(0);

      const earnCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM cashback_transactions WHERE order_id = 'ord_unpaid_null'").get() as { cnt: number };
      expect(earnCount.cnt).toBe(0);
    });
  });

  describe('BA4-3: Cross-Tenant Category Station Mapping & COD Settlement', () => {
    it('prevents tenant B from overwriting tenant A category_stations mapping', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE kitchen_stations (
          id TEXT PRIMARY KEY,
          name TEXT,
          tenant_id TEXT
        );
        CREATE TABLE categories (
          id TEXT PRIMARY KEY,
          name TEXT,
          tenant_id TEXT
        );
        CREATE TABLE category_stations (
          category_id TEXT PRIMARY KEY,
          station_id TEXT,
          tenant_id TEXT
        );
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          role TEXT,
          active INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT
        );
      `);
      sqlite.prepare("INSERT INTO users (id, name, phone, role, active, is_active, auth_version, tenant_id) VALUES ('mgr_b', 'Manager B', '0901234567', 'manager', 1, 1, 1, 'store_b')").run();
      sqlite.prepare("INSERT INTO kitchen_stations (id, name, tenant_id) VALUES ('st_a', 'Bar A', 'store_a')").run();
      sqlite.prepare("INSERT INTO kitchen_stations (id, name, tenant_id) VALUES ('st_b', 'Bar B', 'store_b')").run();
      sqlite.prepare("INSERT INTO category_stations (category_id, station_id, tenant_id) VALUES ('cat_shared', 'st_a', 'store_a')").run();

      const db = createSqliteD1(sqlite);
      const nowSec = Math.floor(Date.now() / 1000);
      const tokenB = await generateJWT({
        id: 'mgr_b',
        role: 'manager',
        tenantId: 'store_b',
        sessionType: 'staff-web',
        authVersion: 1,
        authTime: nowSec,
      } as any, JWT_SECRET, 28800, nowSec);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      app.route('/api/stations', kitchenStationsRouter);

      const res = await app.request('/api/stations/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
          'X-Tenant-ID': 'store_b',
        },
        body: JSON.stringify({
          category_id: 'cat_shared',
          station_id: 'st_b',
        }),
      });
      expect(res.status).toBe(403);

      const row = sqlite.prepare("SELECT station_id, tenant_id FROM category_stations WHERE category_id = 'cat_shared'").get() as { station_id: string; tenant_id: string };
      expect(row.station_id).toBe('st_a');
      expect(row.tenant_id).toBe('store_a');
    });

    it('rejects COD payment collection on failed, expired, or refunded orders', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          total INTEGER,
          status TEXT,
          payment_status TEXT,
          payment_method TEXT,
          tenant_id TEXT
        );
      `);
      sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method, tenant_id) VALUES ('ord_failed', 50000, 'failed', 'unpaid', 'cod', 'default')").run();
      sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method, tenant_id) VALUES ('ord_refunded', 50000, 'served', 'refunded', 'cod', 'default')").run();

      const db = createSqliteD1(sqlite);

      const resFailed = await collectCodPayment(db, 'ord_failed', 'default');
      expect(resFailed.success).toBe(false);
      if (!resFailed.success) {
        expect(resFailed.statusCode).toBe(409);
      }

      const resRefunded = await collectCodPayment(db, 'ord_refunded', 'default');
      expect(resRefunded.success).toBe(false);
      if (!resRefunded.success) {
        expect(resRefunded.statusCode).toBe(409);
      }
    });
  });

  describe('BA4-4: Hybrid Order Inventory Restoration & Transaction RBAC/Waste Guard', () => {
    it('restores both inventory_items and BOM ingredients when a hybrid order is cancelled', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY,
          current_stock REAL,
          updated_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE inventory_transactions (
          id TEXT PRIMARY KEY,
          item_id TEXT,
          type TEXT,
          quantity REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          tenant_id TEXT
        );
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY,
          current_stock REAL,
          updated_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE stock_movements (
          id TEXT PRIMARY KEY,
          ingredient_id TEXT,
          type TEXT,
          quantity REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          created_by TEXT,
          created_at TEXT,
          tenant_id TEXT
        );
      `);
      sqlite.prepare("INSERT INTO inventory_items (id, current_stock, tenant_id) VALUES ('sku_1', 8, 'default')").run();
      sqlite.prepare("INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, tenant_id) VALUES ('tx_res_1', 'sku_1', 'reserve', -2, 'ord_hybrid', 'order', 'default')").run();
      sqlite.prepare("INSERT INTO ingredients (id, current_stock, tenant_id) VALUES ('ing_1', 90, 'default')").run();
      sqlite.prepare("INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, tenant_id) VALUES ('sm_out_1', 'ing_1', 'out', 10, 'ord_hybrid', 'default')").run();

      const db = createSqliteD1(sqlite);
      await restoreInventoryForOrder({ AURA_DB: db as never }, 'ord_hybrid', 'default');

      const sku = sqlite.prepare("SELECT current_stock FROM inventory_items WHERE id = 'sku_1'").get() as { current_stock: number };
      expect(sku.current_stock).toBe(10);

      const ing = sqlite.prepare("SELECT current_stock FROM ingredients WHERE id = 'ing_1'").get() as { current_stock: number };
      expect(ing.current_stock).toBe(100);
    });

    it('rejects customer role from reading inventory transactions and blocks waste exceeding stock', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY,
          sku TEXT,
          current_stock REAL,
          min_stock REAL,
          unit TEXT,
          active INTEGER DEFAULT 1,
          updated_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE inventory_transactions (
          id TEXT PRIMARY KEY,
          item_id TEXT,
          type TEXT,
          quantity REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          created_by TEXT,
          tenant_id TEXT
        );
      `);
      sqlite.prepare("INSERT INTO inventory_items (id, sku, current_stock, min_stock, unit, tenant_id) VALUES ('item_1', 'SKU-1', 5, 1, 'pcs', 'default')").run();

      const db = createSqliteD1(sqlite);
      const app = new Hono();
      app.use('*', async (c, next) => {
        (c as any).env = { AURA_DB: db };
        await next();
      });
      inventoryTransactions(app as never);

      // Customer role denied on GET
      const custApp = new Hono();
      custApp.use('*', async (c, next) => {
        (c as any).env = { AURA_DB: db };
        c.set('user' as never, { id: 'cust_1', role: 'customer', tenantId: 'default' } as never);
        await next();
      });
      inventoryTransactions(custApp as never);
      const resCustGet = await custApp.request('/item_1/transactions');
      expect(resCustGet.status).toBe(403);

      // Staff waste exceeding stock rejected with 409
      const staffApp = new Hono();
      staffApp.use('*', async (c, next) => {
        (c as any).env = { AURA_DB: db };
        c.set('user' as never, { id: 'mgr_1', role: 'manager', tenantId: 'default' } as never);
        await next();
      });
      inventoryTransactions(staffApp as never);
      const resWaste = await staffApp.request('/item_1/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'waste',
          quantity: 10, // exceeds 5 in stock
          notes: 'Spilled',
        }),
      });
      expect(resWaste.status).toBe(409);

      const stockAfter = sqlite.prepare("SELECT current_stock FROM inventory_items WHERE id = 'item_1'").get() as { current_stock: number };
      expect(stockAfter.current_stock).toBe(5);
    });
  });

  describe('BA4-5: Purchasing Read RBAC & Duplicate Ingredient Receipt Aggregation', () => {
    it('blocks customer role from reading suppliers and purchase orders', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);
      const app = new Hono();
      app.use('*', async (c, next) => {
        (c as any).env = { AURA_DB: db };
        c.set('user' as never, { id: 'cust_1', role: 'customer', tenantId: 'default' } as never);
        await next();
      });
      purchasing(app as never);

      const resSuppliers = await app.request('/suppliers');
      expect(resSuppliers.status).toBe(403);

      const resPOs = await app.request('/purchase-orders');
      expect(resPOs.status).toBe(403);
    });

    it('aggregates duplicate ingredientId entries atomically when receiving a purchase order', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE purchase_orders (
          id TEXT PRIMARY KEY,
          supplier_id TEXT,
          status TEXT,
          received_date TEXT,
          updated_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE purchase_order_items (
          id TEXT PRIMARY KEY,
          purchase_order_id TEXT,
          ingredient_id TEXT,
          quantity REAL,
          unit_price REAL,
          received_quantity REAL,
          tenant_id TEXT
        );
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY,
          current_stock REAL,
          cost_per_unit REAL,
          updated_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE stock_movements (
          id TEXT PRIMARY KEY,
          ingredient_id TEXT,
          type TEXT,
          quantity REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          created_by TEXT,
          created_at TEXT,
          tenant_id TEXT
        );
      `);
      sqlite.prepare("INSERT INTO purchase_orders (id, supplier_id, status, tenant_id) VALUES ('po_1', 'sup_1', 'ordered', 'default')").run();
      sqlite.prepare("INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_price, received_quantity, tenant_id) VALUES ('poi_1', 'po_1', 'ing_beans', 10, 200000, 0, 'default')").run();
      sqlite.prepare("INSERT INTO ingredients (id, current_stock, cost_per_unit, tenant_id) VALUES ('ing_beans', 5, 180000, 'default')").run();

      const db = createSqliteD1(sqlite);
      const res = await receivePurchaseOrder(
        db as never,
        'po_1',
        [
          { ingredientId: 'ing_beans', receivedQuantity: 4 },
          { ingredientId: 'ing_beans', receivedQuantity: 6 },
        ],
        { receiptId: 'grn_test_1', tenantId: 'default' }
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.status).toBe('received');
      }

      const ing = sqlite.prepare("SELECT current_stock FROM ingredients WHERE id = 'ing_beans'").get() as { current_stock: number };
      expect(ing.current_stock).toBe(15);

      const poi = sqlite.prepare("SELECT received_quantity FROM purchase_order_items WHERE id = 'poi_1'").get() as { received_quantity: number };
      expect(poi.received_quantity).toBe(10);
    });
  });

  describe('BA4-1 & BA4-6: Split-Order Discount Bypass Guard, WELCOME +84 Phone Canonicalization & Manual Reconcile Guard', () => {
    it('rejects unverified discount on splitOrders even when legacy placeholder total is 1000', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          number INTEGER,
          table_number INTEGER,
          status TEXT,
          tenant_id TEXT
        );
        CREATE TABLE menu_items (
          id TEXT PRIMARY KEY,
          name TEXT,
          price INTEGER,
          available INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT
        );
      `);
      sqlite.prepare("INSERT INTO cafe_tables (id, number, status, tenant_id) VALUES ('tbl_1', 1, 'available', 'default')").run();
      sqlite.prepare("INSERT INTO menu_items (id, name, price, available, is_active, tenant_id) VALUES ('item_esp', 'Espresso', 35000, 1, 1, 'default')").run();

      const db = createSqliteD1(sqlite);
      const req = new Request('https://example.com/api/orders/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: 'tbl_1',
          orders: [
            {
              items: [{ id: 'item_esp', name: 'Espresso', price: 1000, quantity: 1 }],
              total: 1000,
              discount: 15000, // unverified discount must be rejected even with 1000 placeholder
              customer_name: 'Guest 1',
              customer_phone: '0901234567',
              payment_method: 'cod',
            },
            {
              items: [{ id: 'item_esp', name: 'Espresso', price: 35000, quantity: 1 }],
              total: 35000,
              customer_name: 'Guest 2',
              customer_phone: '0901234568',
              payment_method: 'cod',
            },
          ],
        }),
      });

      const res = await splitOrders(req, { AURA_DB: db }, undefined, {
        kind: 'staff',
        id: 'staff_1',
        role: 'cashier',
        tenantId: 'default',
      });
      expect(res.status).toBe(400);
    });

    it('blocks repeat WELCOME promo redemption across +84 and 0 phone formats and enforces manualReconcilePayment RBAC/tenant isolation', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE menu_items (
          id TEXT PRIMARY KEY,
          name TEXT,
          price INTEGER,
          available INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT
        );
        CREATE TABLE promotions (
          id TEXT PRIMARY KEY,
          code TEXT,
          discount_type TEXT,
          discount_value REAL,
          min_order INTEGER DEFAULT 0,
          active INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          usage_limit INTEGER,
          usage_count INTEGER DEFAULT 0,
          expires_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          total INTEGER,
          status TEXT,
          payment_status TEXT,
          customer_id TEXT,
          customer_phone TEXT,
          tenant_id TEXT
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          transaction_id TEXT,
          status TEXT,
          refund_status TEXT,
          reconcile_attempts INTEGER DEFAULT 0,
          tenant_id TEXT
        );
      `);
      sqlite.prepare("INSERT INTO menu_items (id, name, price, available, is_active, tenant_id) VALUES ('item_1', 'Latte', 50000, 1, 1, 'default')").run();
      sqlite.prepare("INSERT INTO promotions (id, code, discount_type, discount_value, min_order, active, is_active, tenant_id) VALUES ('promo_w', 'WELCOME', 'percentage', 15, 0, 1, 1, 'default')").run();
      // Existing order placed with 0901234567
      sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, customer_phone, tenant_id) VALUES ('ord_prev', 50000, 'completed', 'paid', '0901234567', 'default')").run();
      sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, tenant_id) VALUES ('ord_store_a', 50000, 'pending', 'unpaid', 'store_a')").run();
      sqlite.prepare("INSERT INTO payments (id, order_id, transaction_id, status, tenant_id) VALUES ('pay_store_a', 'ord_store_a', '12345', 'pending', 'store_a')").run();

      const db = createSqliteD1(sqlite);

      // Attempt WELCOME again using +84901234567
      const reqOrder = new Request('https://example.com/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: 'item_1', name: 'Latte', price: 50000, quantity: 1 }],
          customer_name: 'Repeat Guest',
          customer_phone: '+84901234567',
          order_type: 'takeaway',
          payment_method: 'cod',
          promo_code: 'WELCOME',
        }),
      });
      const resOrder = await createOrder(reqOrder, { AURA_DB: db }, undefined, {
        kind: 'staff',
        id: 'staff_1',
        role: 'cashier',
        tenantId: 'default',
      });
      expect(resOrder.status).toBe(400);

      // BA4-6: manualReconcilePayment rejects waiter role (403) and blocks store_b manager from store_a payment (404)
      const app = new Hono<{ Bindings: Env }>();
      app.post('/payments/:id/reconcile', async (c) => {
        (c as any).env = { AURA_DB: db };
        const role = c.req.header('x-test-role') || 'waiter';
        const tenantId = c.req.header('x-test-tenant') || 'store_b';
        c.set('user' as never, { id: 'u1', role, tenantId } as never);
        return manualReconcilePayment(c as never);
      });

      const resWaiter = await app.request('/payments/pay_store_a/reconcile', {
        method: 'POST',
        headers: { 'x-test-role': 'waiter', 'x-test-tenant': 'store_a' },
      });
      expect(resWaiter.status).toBe(403);

      const resCrossTenant = await app.request('/payments/pay_store_a/reconcile', {
        method: 'POST',
        headers: { 'x-test-role': 'manager', 'x-test-tenant': 'store_b', 'X-Tenant-ID': 'store_b' },
      });
      expect(resCrossTenant.status).toBe(404);
    });
  });
});
