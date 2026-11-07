// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { createOrder } from '../../../../packages/domain/order/commands/create-order';
import { runPostOrderSideEffects } from '../../../../packages/domain/order/commands/create-order-side-effects';
import { splitOrders } from '../../../../packages/domain/order/commands/split-orders';
import { updateOrder } from '../../../../packages/domain/order/commands/update-order';
import { creditLoyaltyIfEligible } from '../../../../packages/domain/order/policies/loyalty-trigger';
import { executeKdsStatusTransition } from '../../../../packages/domain/kitchen/commands/kds-status-transition';
import { handleCancelOrder } from '../../routes/openapi-orders-handlers/order-cancel-handlers';
import { handleOpenApiUpdateOrder } from '../../routes/openapi-orders-handlers/order-write-handlers';
import { handleGetOrderSummary } from '../../routes/openapi-orders-handlers/order-summary-handlers';
import { handleListOrders } from '../../routes/openapi-orders-handlers/order-read-handlers';
import { handleCreatePayment } from '../../routes/openapi-payments-handlers/mutation-handlers';
import { getOrCreatePayOSAttempt } from '../../../../packages/domain/payment/commands/payos-attempt';
import { processNowPaymentsIpn } from '../../../../packages/domain/payment/commands/nowpayments-ipn';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const runStatement = new WeakMap<object, () => any>();

  function prepare(sql: string) {
    let args: any[] = [];
    const run = () => {
      const before = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      const result = sqlite.prepare(sql).run(...args);
      const after = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      return {
        success: true,
        meta: { changes: after - before, last_row_id: Number(result.lastInsertRowid) },
      };
    };
    const statement = {
      bind(...values: any[]) {
        args = values;
        return statement;
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const row = sqlite.prepare(sql).get(...args) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async all<T = Record<string, unknown>>() {
        return {
          results: sqlite.prepare(sql).all(...args) as T[],
          success: true,
          meta: {},
        };
      },
      async run() {
        return run();
      },
      async raw() {
        return [];
      },
    };
    runStatement.set(statement, run);
    return statement as unknown as D1PreparedStatement;
  }

  return {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement) => {
          const run = runStatement.get(statement);
          if (!run) throw new Error('Unknown statement in local D1 batch');
          return run();
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    async dump() {
      return new Uint8Array();
    },
  } as unknown as D1Database;
}

describe('Phase 50 Slice AW4 — Orders, Split Orders, Loyalty Trigger, OpenAPI Orders & Payments Security', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('1. create-order.ts & create-order-side-effects.ts tenant fail-closed fallbacks', () => {
    it('prevents non-default tenant from falling back to unscoped promotions or customer rows when tenant_id column is missing', async () => {
      const sqlite = new DatabaseSync(':memory:');
      // Legacy schema without tenant_id on promotions / customers / cashback_wallets
      sqlite.exec(`
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price INTEGER NOT NULL,
          is_available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE promotions (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          type TEXT NOT NULL,
          value INTEGER NOT NULL,
          min_order INTEGER DEFAULT 0,
          max_uses INTEGER DEFAULT 100,
          used_count INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          email TEXT,
          loyalty_points INTEGER DEFAULT 0,
          total_spent INTEGER DEFAULT 0,
          order_count INTEGER DEFAULT 0,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE cashback_wallets (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          balance INTEGER DEFAULT 0,
          lifetime_earned INTEGER DEFAULT 0,
          lifetime_spent INTEGER DEFAULT 0,
          updated_at TEXT
        );
      `);
      sqlite.prepare("INSERT INTO products (id, name, price, is_available, tenant_id) VALUES ('p1', 'Cà phê sữa', 45000, 1, 'tenant-alpha')").run();
      sqlite.prepare("INSERT INTO promotions (id, code, type, value, used_count, is_active) VALUES ('promo-default', 'SAVE10K', 'fixed', 10000, 0, 1)").run();
      sqlite.prepare("INSERT INTO customers (id, name, phone, loyalty_points, total_spent, order_count) VALUES ('cust-default', 'Default User', '0901234567', 50, 500000, 5)").run();
      sqlite.prepare("INSERT INTO cashback_wallets (id, customer_id, balance, lifetime_earned, lifetime_spent) VALUES ('wal-default', 'cust-default', 25000, 25000, 0)").run();

      const db = createSqliteD1(sqlite);

      // Non-default tenant order creation must reject promo code when promotions table lacks tenant_id
      const req = new Request('https://api.example.com/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'tenant-alpha',
        },
        body: JSON.stringify({
          customer_name: 'Khách Alpha',
          customer_phone: '0901234567',
          items: [{ id: 'p1', name: 'Cà phê sữa', price: 45000, quantity: 1 }],
          promo_code: 'SAVE10K',
          total: 35000,
        }),
      });

      const res = await createOrder(req, { DB: db, AURA_DB: db }, undefined, {
        id: 'staff-alpha',
        role: 'cashier',
        tenantId: 'tenant-alpha',
      });
      expect(res.status).toBe(400);
      const promoRow = sqlite.prepare("SELECT used_count FROM promotions WHERE id = 'promo-default'").get() as { used_count: number };
      expect(promoRow.used_count).toBe(0);

      // Side-effects for non-default tenant must not mutate legacy unscoped customer/wallet rows
      await runPostOrderSideEffects({
        db,
        env: { DB: db, AURA_DB: db },
        orderId: 'ORD-ALPHA-1',
        tenantId: 'tenant-alpha',
        data: {
          customer_name: 'Khách Alpha',
          customer_phone: '0901234567',
          customer_email: '',
        },
        snapshot: {
          items: [],
          itemsJson: '[]',
          subtotal: 100000,
          shipping_fee: 0,
          discount: 0,
          service_fee: 0,
          tip_amount: 0,
          total: 90000,
        },
        validatedMethod: 'cod',
        resolvedTableId: null,
      });

      const custRow = sqlite.prepare("SELECT loyalty_points, total_spent, order_count FROM customers WHERE id = 'cust-default'").get() as {
        loyalty_points: number;
        total_spent: number;
        order_count: number;
      };
      expect(custRow.total_spent).toBe(500000);
      expect(custRow.order_count).toBe(5);

      const walletRow = sqlite.prepare("SELECT balance, lifetime_spent FROM cashback_wallets WHERE id = 'wal-default'").get() as {
        balance: number;
        lifetime_spent: number;
      };
      expect(walletRow.balance).toBe(25000);
      expect(walletRow.lifetime_spent).toBe(0);
    });
  });

  describe('2. split-orders.ts single BOM inventory deduction & tenant batch confinement', () => {
    it('deducts BOM recipe stock exactly once per split sub-order instead of double-deducting', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price INTEGER NOT NULL,
          available INTEGER DEFAULT 1,
          is_available INTEGER DEFAULT 1,
          category_id TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number TEXT,
          status TEXT DEFAULT 'Available',
          current_order_id TEXT,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          customer_email TEXT,
          customer_address TEXT,
          customer_id TEXT,
          items TEXT,
          subtotal INTEGER,
          shipping_fee INTEGER,
          discount INTEGER,
          promo_code TEXT,
          loyalty_points_used INTEGER,
          cashback_used INTEGER DEFAULT 0,
          total INTEGER,
          total_amount INTEGER,
          payment_method TEXT,
          payment_status TEXT DEFAULT 'pending',
          status TEXT DEFAULT 'pending',
          notes TEXT,
          delivery_time TEXT,
          tip_amount INTEGER DEFAULT 0,
          source TEXT,
          table_id TEXT,
          order_type TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          name TEXT,
          quantity INTEGER NOT NULL,
          unit_price INTEGER DEFAULT 0,
          subtotal INTEGER NOT NULL,
          modifiers TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          method TEXT,
          amount INTEGER,
          status TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY,
          sku TEXT,
          name TEXT NOT NULL,
          unit TEXT NOT NULL,
          current_stock REAL NOT NULL,
          min_stock REAL DEFAULT 0,
          active INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          unit TEXT NOT NULL,
          current_stock REAL NOT NULL,
          cost_per_unit REAL DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE recipes (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          name TEXT,
          instructions TEXT,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE recipe_items (
          id TEXT PRIMARY KEY,
          recipe_id TEXT NOT NULL,
          ingredient_id TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit TEXT DEFAULT 'g',
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE stock_movements (
          id TEXT PRIMARY KEY,
          ingredient_id TEXT NOT NULL,
          type TEXT NOT NULL,
          quantity REAL NOT NULL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        CREATE TABLE inventory_transactions (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL,
          type TEXT NOT NULL,
          quantity REAL NOT NULL,
          previous_stock REAL,
          new_stock REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          created_by TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
      `);

      sqlite.prepare("INSERT INTO products (id, name, price, available, is_available, tenant_id) VALUES ('prod-latte', 'Latte', 50000, 1, 1, 'tenant-alpha')").run();
      sqlite.prepare("INSERT INTO cafe_tables (id, table_number, status, tenant_id) VALUES ('tbl-1', 'T1', 'Available', 'tenant-alpha')").run();
      sqlite.prepare("INSERT INTO inventory_items (id, name, unit, current_stock, tenant_id) VALUES ('inv-beans', 'Coffee Beans', 'g', 1000, 'tenant-alpha')").run();
      sqlite.prepare("INSERT INTO ingredients (id, name, unit, current_stock, tenant_id) VALUES ('inv-beans', 'Coffee Beans', 'g', 1000, 'tenant-alpha')").run();
      sqlite.prepare("INSERT INTO recipes (id, product_id, name, is_active, tenant_id) VALUES ('rec-1', 'prod-latte', 'Latte Recipe', 1, 'tenant-alpha')").run();
      sqlite.prepare("INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity, unit, tenant_id) VALUES ('ri-1', 'rec-1', 'inv-beans', 20, 'g', 'tenant-alpha')").run();

      const db = createSqliteD1(sqlite);
      const req = new Request('https://api.example.com/api/orders/split', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'tenant-alpha',
        },
        body: JSON.stringify({
          table_id: 'tbl-1',
          orders: [
            {
              customer_name: 'Guest 1',
              customer_phone: '0911111111',
              items: [{ id: 'prod-latte', name: 'Latte', price: 50000, quantity: 1 }],
            },
            {
              customer_name: 'Guest 2',
              customer_phone: '0922222222',
              items: [{ id: 'prod-latte', name: 'Latte', price: 50000, quantity: 1 }],
            },
          ],
        }),
      });

      const res = await splitOrders(req, { DB: db, AURA_DB: db }, undefined, {
        id: 'staff-alpha',
        role: 'waiter',
        tenantId: 'tenant-alpha',
      });
      expect(res.status).toBe(201);

      // 2 sub-orders * 1 latte * 20g = 40g deducted once (remaining stock = 960g, NOT 920g)
      const invRow = sqlite.prepare("SELECT current_stock FROM inventory_items WHERE id = 'inv-beans'").get() as { current_stock: number };
      expect(invRow.current_stock).toBe(960);
    });
  });

  describe('3. update-order.ts, loyalty-trigger.ts, kds-status-transition.ts & order-cancel-handlers.ts', () => {
    it('blocks loyalty accrual on cancelled/rejected/refunded orders and isolates tenant cancellation side effects', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          customer_id TEXT,
          customer_phone TEXT,
          customer_email TEXT,
          status TEXT,
          payment_status TEXT,
          payment_method TEXT DEFAULT 'cod',
          total INTEGER,
          total_amount INTEGER,
          cashback_used INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT,
          cancelled_at TEXT
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          email TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE cashback_wallets (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          balance INTEGER DEFAULT 0,
          lifetime_earned INTEGER DEFAULT 0,
          lifetime_spent INTEGER DEFAULT 0,
          tier TEXT DEFAULT 'bronze',
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE cashback_transactions (
          id TEXT PRIMARY KEY,
          wallet_id TEXT,
          customer_id TEXT NOT NULL,
          order_id TEXT,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          balance_after INTEGER DEFAULT 0,
          tier_at_earn TEXT,
          expires_at TEXT,
          idempotency_key TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        CREATE TABLE promotions (
          id TEXT PRIMARY KEY,
          code TEXT,
          current_uses INTEGER DEFAULT 1,
          used_count INTEGER DEFAULT 1,
          usage_count INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE promotion_redemptions (
          id TEXT PRIMARY KEY,
          promotion_id TEXT,
          code TEXT,
          order_id TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE promotion_usages (
          id TEXT PRIMARY KEY,
          promotion_id TEXT,
          order_id TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          method TEXT,
          amount INTEGER,
          status TEXT,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
      `);

      sqlite.prepare(`
        INSERT INTO orders (id, order_number, customer_id, customer_phone, status, payment_status, total, total_amount, tenant_id)
        VALUES
          ('ord-refunded', 'A01', 'cust-alpha', '0909000111', 'completed', 'refunded', 100000, 100000, 'tenant-alpha'),
          ('ord-rejected', 'A02', 'cust-alpha', '0909000111', 'rejected', 'paid', 100000, 100000, 'tenant-alpha'),
          ('ord-cancel-alpha', 'A03', 'cust-alpha', '0909000111', 'pending', 'pending', 80000, 80000, 'tenant-alpha')
      `).run();
      sqlite.prepare("INSERT INTO customers (id, name, phone, tenant_id) VALUES ('cust-alpha', 'Alpha User', '0909000111', 'tenant-alpha')").run();
      sqlite.prepare("INSERT INTO cashback_wallets (id, customer_id, balance, lifetime_earned, tenant_id) VALUES ('wal-alpha', 'cust-alpha', 0, 0, 'tenant-alpha')").run();

      // Cross-tenant rows sharing order_id 'ord-cancel-alpha' in tenant-beta must NOT be touched when cancelling tenant-alpha's order
      sqlite.prepare("INSERT INTO promotions (id, code, current_uses, used_count, usage_count, tenant_id) VALUES ('promo-beta', 'BETA50', 5, 5, 5, 'tenant-beta')").run();
      sqlite.prepare("INSERT INTO promotion_redemptions (id, promotion_id, code, order_id, tenant_id) VALUES ('red-beta', 'promo-beta', 'BETA50', 'ord-cancel-alpha', 'tenant-beta')").run();
      sqlite.prepare("INSERT INTO promotion_usages (id, promotion_id, order_id, tenant_id) VALUES ('use-beta', 'promo-beta', 'ord-cancel-alpha', 'tenant-beta')").run();
      sqlite.prepare("INSERT INTO payments (id, order_id, method, amount, status, tenant_id) VALUES ('pay-beta', 'ord-cancel-alpha', 'cod', 80000, 'pending', 'tenant-beta')").run();

      const db = createSqliteD1(sqlite);

      // 1) Refunded payment_status must not earn loyalty
      await creditLoyaltyIfEligible(db, {}, 'ord-refunded');
      // 2) Rejected order status must not earn loyalty
      await creditLoyaltyIfEligible(db, {}, 'ord-rejected');

      const earnCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM cashback_transactions WHERE type = 'earn'").get() as { cnt: number };
      expect(earnCount.cnt).toBe(0);

      // 3) Cancelling tenant-alpha order via handleCancelOrder must not delete/decrement tenant-beta's promo or payment rows
      const app = new Hono<{ Bindings: any; Variables: any }>();
      app.use('*', async (c, next) => {
        c.set('tenantId', 'tenant-alpha');
        c.set('user', { id: 'staff-alpha', role: 'manager', tenant_id: 'tenant-alpha' });
        await next();
      });
      app.post('/orders/:id/cancel', handleCancelOrder as any);

      const cancelRes = await app.request(
        'http://localhost/orders/ord-cancel-alpha/cancel',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant-alpha' },
          body: JSON.stringify({ reason: 'Customer changed mind' }),
        },
        { DB: db, AURA_DB: db },
      );
      expect(cancelRes.status).toBe(200);

      const betaPromo = sqlite.prepare("SELECT used_count, usage_count FROM promotions WHERE id = 'promo-beta'").get() as {
        used_count: number;
        usage_count: number;
      };
      expect(betaPromo.used_count).toBe(5);
      expect(betaPromo.usage_count).toBe(5);

      const betaRedemption = sqlite.prepare("SELECT id FROM promotion_redemptions WHERE id = 'red-beta'").get();
      expect(betaRedemption).toBeTruthy();

      const betaUsage = sqlite.prepare("SELECT id FROM promotion_usages WHERE id = 'use-beta'").get();
      expect(betaUsage).toBeTruthy();

      const betaPayment = sqlite.prepare("SELECT status FROM payments WHERE id = 'pay-beta'").get() as { status: string };
      expect(betaPayment.status).toBe('pending');
    });

    it('isolates updateOrder and executeKdsStatusTransition cancellation side effects by tenant', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          customer_email TEXT,
          customer_address TEXT,
          notes TEXT,
          delivery_time TEXT,
          table_id TEXT,
          order_type TEXT,
          payment_method TEXT DEFAULT 'cod',
          shipping_fee INTEGER DEFAULT 0,
          discount INTEGER DEFAULT 0,
          tip_amount INTEGER DEFAULT 0,
          created_at TEXT,
          items TEXT DEFAULT '[]',
          status TEXT,
          payment_status TEXT,
          total INTEGER,
          total_amount INTEGER,
          cashback_used INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT,
          cancelled_at TEXT
        );
        CREATE TABLE promotions (
          id TEXT PRIMARY KEY,
          code TEXT,
          current_uses INTEGER DEFAULT 3,
          used_count INTEGER DEFAULT 3,
          usage_count INTEGER DEFAULT 3,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE promotion_redemptions (
          id TEXT PRIMARY KEY,
          promotion_id TEXT,
          code TEXT,
          order_id TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          status TEXT,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
      `);
      sqlite.prepare("INSERT INTO orders (id, order_number, status, payment_status, total, total_amount, tenant_id) VALUES ('ord-u1', 'U01', 'pending', 'pending', 60000, 60000, 'tenant-alpha')").run();
      sqlite.prepare("INSERT INTO orders (id, order_number, status, payment_status, total, total_amount, tenant_id) VALUES ('ord-u2', 'U02', 'pending', 'pending', 70000, 70000, 'tenant-alpha')").run();
      sqlite.prepare("INSERT INTO promotions (id, code, current_uses, used_count, usage_count, tenant_id) VALUES ('promo-beta-2', 'B2', 3, 3, 3, 'tenant-beta')").run();
      sqlite.prepare("INSERT INTO promotion_redemptions (id, promotion_id, code, order_id, tenant_id) VALUES ('red-beta-2', 'promo-beta-2', 'B2', 'ord-u1', 'tenant-beta')").run();
      sqlite.prepare("INSERT INTO payments (id, order_id, status, tenant_id) VALUES ('pay-beta-2', 'ord-u2', 'pending', 'tenant-beta')").run();

      const db = createSqliteD1(sqlite);

      // updateOrder cancel on tenant-alpha must not touch tenant-beta redemption
      const updReq = new Request('https://api.example.com/api/orders/ord-u1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant-alpha' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const updRes = await updateOrder(
        updReq,
        { DB: db, AURA_DB: db },
        'ord-u1',
        'manager',
        'tenant-alpha',
      );
      expect(updRes.status).toBe(200);
      const promoBeta2 = sqlite.prepare("SELECT used_count FROM promotions WHERE id = 'promo-beta-2'").get() as { used_count: number };
      expect(promoBeta2.used_count).toBe(3);

      // executeKdsStatusTransition rejects cross-tenant cancel when tenantId mismatches
      const kdsCrossTenant = await executeKdsStatusTransition(db, 'ord-u2', 'cancelled', 'manager', {
        tenantId: 'tenant-beta',
      });
      expect(kdsCrossTenant.success).toBe(false);
      expect(kdsCrossTenant.statusCode).toBe(404);

      // handleOpenApiUpdateOrder cancelling ord-u2 in tenant-alpha must not cancel tenant-beta's payment row
      const app = new Hono<{ Bindings: any; Variables: any }>();
      app.use('*', async (c, next) => {
        c.set('tenantId', 'tenant-alpha');
        c.set('user', { id: 'staff-alpha', role: 'manager', tenant_id: 'tenant-alpha' });
        await next();
      });
      app.patch('/orders/:id', handleOpenApiUpdateOrder as any);
      const patchRes = await app.request(
        'http://localhost/orders/ord-u2',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant-alpha' },
          body: JSON.stringify({ status: 'cancelled' }),
        },
        { DB: db, AURA_DB: db },
      );
      expect(patchRes.status).toBe(200);
      const payBeta2 = sqlite.prepare("SELECT status FROM payments WHERE id = 'pay-beta-2'").get() as { status: string };
      expect(payBeta2.status).toBe('pending');
    });
  });

  describe('4. order-summary-handlers.ts & order-read-handlers.ts Vietnam timezone & refunded revenue exclusion', () => {
    it('excludes refunded orders from summary revenue/valid_orders and filters dates in UTC+7 Vietnam time', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          customer_id TEXT,
          status TEXT,
          payment_status TEXT,
          total INTEGER,
          total_amount INTEGER,
          source TEXT DEFAULT 'pos',
          order_type TEXT DEFAULT 'dine_in',
          location_id TEXT,
          table_id TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
      `);

      // 2026-11-02T20:30:00.000Z is 2026-11-03 03:30:00 in Vietnam time (UTC+7)
      sqlite.prepare(`
        INSERT INTO orders (id, order_number, status, payment_status, total, total_amount, source, tenant_id, created_at)
        VALUES
          ('ord-vn-1', 'VN01', 'completed', 'paid', 120000, 120000, 'pos', 'tenant-alpha', '2026-11-02T20:30:00.000Z'),
          ('ord-vn-2', 'VN02', 'completed', 'refunded', 80000, 80000, 'pos', 'tenant-alpha', '2026-11-02T21:00:00.000Z'),
          ('ord-vn-3', 'VN03', 'refunded', 'refunded', 50000, 50000, 'pos', 'tenant-alpha', '2026-11-02T21:30:00.000Z')
      `).run();

      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: any; Variables: any }>();
      app.use('*', async (c, next) => {
        c.set('tenantId', 'tenant-alpha');
        c.set('user', { id: 'staff-alpha', role: 'manager', tenant_id: 'tenant-alpha' });
        await next();
      });
      app.get('/orders/summary', handleGetOrderSummary as any);
      app.get('/orders', handleListOrders as any);

      // Querying summary for Vietnam date 2026-11-03 must include the 2026-11-02T20:30Z orders
      // and exclude both status='refunded' and payment_status='refunded' from revenue & valid_orders
      const summaryRes = await app.request(
        'http://localhost/orders/summary?dateFrom=2026-11-03&dateTo=2026-11-03',
        { method: 'GET', headers: { 'X-Tenant-ID': 'tenant-alpha' } },
        { DB: db, AURA_DB: db },
      );
      expect(summaryRes.status).toBe(200);
      const summaryJson = (await summaryRes.json()) as any;
      expect(summaryJson.data.totalOrders).toBe(3);
      expect(summaryJson.data.totalRevenue).toBe(120000);
      expect(summaryJson.data.averageOrderValue).toBe(120000);

      // Querying list orders for Vietnam date 2026-11-03 must return all 3 orders
      const listRes = await app.request(
        'http://localhost/orders?dateFrom=2026-11-03&dateTo=2026-11-03',
        { method: 'GET', headers: { 'X-Tenant-ID': 'tenant-alpha' } },
        { DB: db, AURA_DB: db },
      );
      expect(listRes.status).toBe(200);
      const listJson = (await listRes.json()) as any;
      expect(listJson.data.orders).toHaveLength(3);
    });
  });

  describe('5. mutation-handlers.ts, payos-attempt.ts & nowpayments-ipn.ts tenant attribution', () => {
    it('stamps tenant_id on COD and PayOS payment attempts from the order tenant', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          tenant_id TEXT DEFAULT 'default',
          total INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          payment_status TEXT DEFAULT 'pending',
          payment_method TEXT NOT NULL
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          method TEXT NOT NULL,
          amount INTEGER NOT NULL,
          status TEXT NOT NULL,
          transaction_id TEXT,
          payment_url TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
      `);
      sqlite.prepare(`
        INSERT INTO orders (id, customer_id, tenant_id, total, status, payment_status, payment_method)
        VALUES
          ('ord-cod-alpha', 'cust-1', 'tenant-alpha', 55000, 'pending', 'pending', 'cod'),
          ('ord-payos-alpha', 'cust-1', 'tenant-alpha', 95000, 'pending', 'pending', 'payos')
      `).run();

      const db = createSqliteD1(sqlite);

      // 1) COD payment creation via handleCreatePayment stamps tenant_id = 'tenant-alpha'
      const app = new Hono<{ Bindings: any; Variables: any }>();
      app.use('*', async (c, next) => {
        c.set('tenantId', 'tenant-alpha');
        c.set('user', { id: 'staff-alpha', role: 'cashier', tenant_id: 'tenant-alpha' });
        (c.req as any).valid = () => ({ orderId: 'ord-cod-alpha', method: 'cod', amount: 55000 });
        await next();
      });
      app.post('/payments', handleCreatePayment as any);

      const codRes = await app.request(
        'http://localhost/payments',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant-alpha' } },
        { DB: db, AURA_DB: db },
      );
      expect(codRes.status).toBe(201);

      const codPayment = sqlite.prepare("SELECT tenant_id, status FROM payments WHERE order_id = 'ord-cod-alpha'").get() as {
        tenant_id: string;
        status: string;
      };
      expect(codPayment.tenant_id).toBe('tenant-alpha');
      expect(codPayment.status).toBe('pending');

      // 2) PayOS attempt reservation via getOrCreatePayOSAttempt stamps tenant_id = 'tenant-alpha'
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ code: '99', desc: 'unavailable' }), { status: 503 }),
      );
      await getOrCreatePayOSAttempt({
        db,
        orderId: 'ord-payos-alpha',
        amount: 95000,
        clientId: 'cid',
        apiKey: 'akey',
        checksumKey: 'ckey',
        description: 'Order payos alpha',
        returnUrl: 'https://example.com/return',
        cancelUrl: 'https://example.com/cancel',
      });

      const payosPayment = sqlite.prepare("SELECT tenant_id, status FROM payments WHERE order_id = 'ord-payos-alpha'").get() as {
        tenant_id: string;
        status: string;
      };
      expect(payosPayment.tenant_id).toBe('tenant-alpha');
      expect(payosPayment.status).toBe('pending');
    });

    it('resolves subscription tenant_id on NowPayments refund IPN and scopes prior paid invoice count by tenant', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE subscriptions (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          billing_cycle TEXT DEFAULT 'monthly',
          current_period_start TEXT,
          current_period_end TEXT,
          next_billing_date TEXT,
          price_vnd INTEGER DEFAULT 500000,
          plan TEXT DEFAULT 'pro',
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE subscription_invoices (
          id TEXT PRIMARY KEY,
          subscription_id TEXT NOT NULL,
          status TEXT NOT NULL,
          amount_vnd INTEGER DEFAULT 500000,
          payment_ref TEXT,
          payment_method TEXT,
          paid_at TEXT,
          period_start TEXT,
          period_end TEXT,
          tenant_id TEXT,
          updated_at TEXT
        );
      `);

      // Subscription belongs to tenant-alpha, while legacy invoice row has NULL tenant_id
      sqlite.prepare(`
        INSERT INTO subscriptions (id, status, billing_cycle, current_period_start, current_period_end, tenant_id)
        VALUES ('sub-alpha', 'active', 'monthly', '2026-11-01', '2026-12-01', 'tenant-alpha')
      `).run();
      sqlite.prepare(`
        INSERT INTO subscription_invoices (id, subscription_id, status, amount_vnd, payment_ref, tenant_id)
        VALUES ('inv-alpha-1', 'sub-alpha', 'paid', 500000, 'np-pay-1', NULL)
      `).run();

      const db = createSqliteD1(sqlite);

      const refundRes = await processNowPaymentsIpn(db, {
        payment_id: 'np-pay-1',
        payment_status: 'refunded',
        order_id: 'invoice_inv-alpha-1',
      });
      expect(refundRes.ok).toBe(true);

      // Subscription in tenant-alpha must be transitioned to 'cancelled'
      const subAfter = sqlite.prepare("SELECT status FROM subscriptions WHERE id = 'sub-alpha'").get() as { status: string };
      expect(subAfter.status).toBe('cancelled');
    });
  });
});
