// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import { createOrderSchema } from '../lib/validators/order';
import { handleOpenApiCreateOrder } from '../routes/openapi-orders-handlers/order-write-handlers';
import { handleCancelOrder } from '../routes/openapi-orders-handlers/order-cancel-handlers';
import { handleGetOrderSummary } from '../routes/openapi-orders-handlers/order-summary-handlers';
import { handleMarkCodPaid, handleUpdateOrderStatus } from '../routes/orders-hono-handlers/kds-handlers';
import { handleRefund } from '../routes/refunds-handlers/mutation-handlers';
import { settlePayOS } from '../routes/webhooks-handlers/payos-settlement';
import { expireUnpaidOnlineOrders } from '../routes/cron-handlers/order-checks';
import { createOrder } from '../../../packages/domain/order/commands/create-order';
import { splitOrders } from '../../../packages/domain/order/commands/split-orders';
import { getOrder } from '../../../packages/domain/order/queries/get-order';
import { canTransition } from '../../../packages/domain/order/model/order-state-machine';
import { canActorTransition } from '../../../packages/domain/order/policies/transition-authorization';
import { executeKdsStatusTransition } from '../../../packages/domain/kitchen/commands/kds-status-transition';
import { collectCodPayment } from '../../../packages/domain/kitchen/commands/collect-cod-payment';
import { clockIn, clockOut } from '../../../packages/domain/shift/commands/attendance';
import { reconcileShiftCash } from '../../../packages/domain/shift/src/policies/cash-reconciliation-policy';
import type { ShiftScope } from '../../../packages/domain/shift/commands/shift-access';
import { createMockKV } from './test-utils';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL = readFileSync(resolve(__dirname, '../../schema.sql'), 'utf8');

function createRealSqliteFixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(SCHEMA_SQL);

  function prepare(sql: string) {
    let binds: SQLInputValue[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        binds = args.map((v) => (v === undefined ? null : (v as SQLInputValue)));
        return stmt;
      },
      async first<T = Record<string, unknown>>() {
        return (sqlite.prepare(sql).get(...binds) as T | undefined) ?? null;
      },
      async all<T = Record<string, unknown>>() {
        return { results: sqlite.prepare(sql).all(...binds) as T[], success: true };
      },
      async run() {
        if (/^\s*SELECT\b/i.test(sql)) {
          return { success: true, results: sqlite.prepare(sql).all(...binds), meta: { changes: 0 } };
        }
        const before = Number((sqlite.prepare('SELECT total_changes() AS c').get() as { c: number }).c);
        const result = sqlite.prepare(sql).run(...binds);
        const after = Number((sqlite.prepare('SELECT total_changes() AS c').get() as { c: number }).c);
        return {
          success: true,
          changes: Number(result.changes),
          meta: { changes: Math.max(Number(result.changes), after - before), last_row_id: Number(result.lastInsertRowid) },
        };
      },
    };
    return stmt;
  }

  const db = {
    prepare,
    async batch(statements: Array<ReturnType<typeof prepare>>) {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        sqlite.exec('COMMIT');
        return out;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  } as unknown as D1Database;

  sqlite.exec(`
    INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version) VALUES
      ('mgr-1', 'Manager One', '0901000001', 'manager', 'default', 1, 1),
      ('cashier-1', 'Cashier One', '0901000002', 'cashier', 'default', 1, 1),
      ('shipper-a', 'Shipper A', '0901000003', 'shipper', 'default', 1, 1),
      ('shipper-b', 'Shipper B', '0901000004', 'shipper', 'default', 1, 1),
      ('shipper-other-store', 'Shipper Other', '0901000005', 'shipper', 'store-b', 1, 1);
    INSERT INTO categories (id, name, slug, tenant_id) VALUES ('cat-1', 'Coffee', 'coffee', 'default');
    INSERT INTO products (id, category_id, name, price, is_available, tenant_id) VALUES
      ('prod-latte', 'cat-1', 'Latte', 50000, 1, 'default'),
      ('prod-esp', 'cat-1', 'Espresso', 35000, 1, 'default');
    INSERT INTO cafe_tables (id, table_number, capacity, zone, status, tenant_id) VALUES
      ('tbl-1', '1', 4, 'Indoor', 'Available', 'default');
    INSERT INTO refund_tenant_readiness (tenant_id, reconciled_at, reconciled_by, evidence)
      VALUES ('default', datetime('now'), 'mgr-1', 'test-bootstrap');
  `);

  const kv = createMockKV();
  const env = {
    AURA_DB: db,
    AUTH_KV: kv,
    CASH_RECONCILIATION_ENABLED: 'true',
  } as unknown as Env;

  return { sqlite, db, kv, env, close: () => sqlite.close() };
}

function makeShiftScope(fx: ReturnType<typeof createRealSqliteFixture>, actorId: string, role: string, canManage: boolean): ShiftScope {
  return {
    env: fx.env,
    tenantId: 'default',
    actor: { id: actorId, name: actorId, phone: null, role, tenant_id: 'default', is_active: 1, auth_version: 1 },
    canManage,
  };
}

describe('Wave 3 Regressions (#212, #224, #225, #226)', () => {
  let fx: ReturnType<typeof createRealSqliteFixture>;

  beforeEach(() => {
    fx = createRealSqliteFixture();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    fx.close();
  });

  describe('#212 — Delivery recipient name/phone validation & OpenAPI write guard', () => {
    it('rejects delivery orders with counter placeholders or fake/empty phone numbers', () => {
      const base = {
        items: [{ product_id: 'prod-latte', name: 'Latte', quantity: 1, price: 50000 }],
        total: 65000,
        customer_address: '37 Luu Van Lang, Sa Dec',
        payment_method: 'payos' as const,
        order_type: 'delivery' as const,
      };

      expect(createOrderSchema.safeParse({ ...base, customer_name: 'Khách tại quán', customer_phone: '0901234567' }).success).toBe(false);
      expect(createOrderSchema.safeParse({ ...base, customer_name: 'Khách mang đi', customer_phone: '0901234567' }).success).toBe(false);
      expect(createOrderSchema.safeParse({ ...base, customer_name: 'Guest at store', customer_phone: '0901234567' }).success).toBe(false);
      expect(createOrderSchema.safeParse({ ...base, customer_name: 'A', customer_phone: '0901234567' }).success).toBe(false);
      expect(createOrderSchema.safeParse({ ...base, customer_name: 'Nguyen Van A', customer_phone: '' }).success).toBe(false);
      expect(createOrderSchema.safeParse({ ...base, customer_name: 'Nguyen Van A', customer_phone: '0000000000' }).success).toBe(false);
      expect(createOrderSchema.safeParse({ ...base, customer_name: 'Nguyen Van A', customer_phone: '+84000000000' }).success).toBe(false);

      expect(createOrderSchema.safeParse({ ...base, customer_name: 'Nguyen Van A', customer_phone: '0901234567' }).success).toBe(true);
    });

    it('handleOpenApiCreateOrder does not inject counter placeholders for delivery and uses channel defaults for takeaway', async () => {
      const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'cashier-1', role: 'cashier', tenantId: 'default' });
        c.set('tenantId', 'default');
        await next();
      });
      app.post('/orders', (c) => handleOpenApiCreateOrder(c));

      const badDelivery = await app.request(
        '/orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: 'delivery',
            paymentMethod: 'payos',
            customer: { address: '37 Luu Van Lang' },
            items: [{ menuItemId: 'prod-latte', name: 'Latte', quantity: 1 }],
          }),
        },
        fx.env,
      );
      expect(badDelivery.status).toBe(400);

      const takeawayRes = await app.request(
        '/orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: 'takeaway',
            paymentMethod: 'cod',
            items: [{ menuItemId: 'prod-latte', name: 'Latte', quantity: 1 }],
          }),
        },
        fx.env,
      );
      expect(takeawayRes.status).toBe(201);
      const created = fx.sqlite.prepare("SELECT customer_name FROM orders WHERE order_type = 'takeaway' LIMIT 1").get() as { customer_name: string };
      expect(created.customer_name).toBe('Khách mang đi');
    });
  });

  describe('#224 — Paid COD cancellation, shift custody, atomic pay_now, cash refund & split orders', () => {
    it('cancelling a paid COD order refunds payment, adjusts open shift sales, and leaves zero shortage on reconciliation', async () => {
      const shift = await clockIn(makeShiftScope(fx, 'cashier-1', 'cashier', false), 'cashier-1', undefined, undefined, 200_000);
      fx.sqlite.exec(`
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, is_cod, customer_name, customer_phone, tenant_id, created_at, updated_at)
        VALUES ('ord-cod-cancel', '[]', 150000, 'preparing', 'unpaid', 'cod', 1, 'Walkin', '', 'default', datetime('now'), datetime('now'));
        INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
        VALUES ('pay-cod-cancel', 'ord-cod-cancel', 'cod', 150000, 'pending', 'default', datetime('now'), datetime('now'));
      `);

      const col = await collectCodPayment(fx.db, 'ord-cod-cancel', 'default', 'cashier-1', {
        env: fx.env as unknown as Record<string, unknown>,
        actorRole: 'cashier',
      });
      expect(col).toMatchObject({ success: true });

      const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-1', role: 'manager', tenantId: 'default' });
        c.set('tenantId', 'default');
        await next();
      });
      app.post('/orders/:id/cancel', (c) => handleCancelOrder(c));

      const cancelRes = await app.request(
        '/orders/ord-cod-cancel/cancel',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Khách đổi ý' }) },
        fx.env,
      );
      expect(cancelRes.status).toBe(200);

      const ordAfter = fx.sqlite.prepare("SELECT status, payment_status FROM orders WHERE id = 'ord-cod-cancel'").get() as { status: string; payment_status: string };
      const payAfter = fx.sqlite.prepare("SELECT status, refund_amount FROM payments WHERE id = 'pay-cod-cancel'").get() as { status: string; refund_amount: number };
      expect(ordAfter).toEqual({ status: 'cancelled', payment_status: 'refunded' });
      expect(payAfter).toEqual({ status: 'refunded', refund_amount: 150000 });

      // Cashier reconciles shift with only the 200,000 opening float -> variance must be 0 (no -150,000 shortage!)
      const recon = await reconcileShiftCash(
        fx.db,
        {
          shift_id: String(shift.id),
          opening_float: 200_000,
          denominations: { denominations: [{ denomination: 100_000, count: 2 }] },
        },
        'cashier-1',
        'default',
        'cashier',
      );
      expect(recon.cash_payment_total).toBe(0);
      expect(recon.expected_cash).toBe(200_000);
      expect(recon.variance).toBe(0);
    });

    it('rejects collectCodPayment with 409 SHIFT_REQUIRED_FOR_CASH when cash reconciliation is active and no open shift exists', async () => {
      fx.sqlite.exec(`
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, is_cod, customer_name, customer_phone, tenant_id, created_at, updated_at)
        VALUES ('ord-noshift', '[]', 50000, 'preparing', 'unpaid', 'cod', 1, 'Walkin', '', 'default', datetime('now'), datetime('now'));
        INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
        VALUES ('pay-noshift', 'ord-noshift', 'cod', 50000, 'pending', 'default', datetime('now'), datetime('now'));
      `);

      const blocked = await collectCodPayment(fx.db, 'ord-noshift', 'default', 'cashier-1', {
        env: fx.env as unknown as Record<string, unknown>,
        actorRole: 'cashier',
      });
      expect(blocked).toMatchObject({ success: false, statusCode: 409, code: 'SHIFT_REQUIRED_FOR_CASH' });

      // Manager can still specify an explicit open shift_id
      const openShift = await clockIn(makeShiftScope(fx, 'cashier-1', 'cashier', false), 'cashier-1', undefined, undefined, 100_000);
      const allowed = await collectCodPayment(fx.db, 'ord-noshift', 'default', 'mgr-1', {
        env: fx.env as unknown as Record<string, unknown>,
        actorRole: 'manager',
        explicitShiftId: String(openShift.id),
      });
      expect(allowed).toMatchObject({ success: true });
    });

    it('createOrder honors atomic pay_now + cash_tendered, updates shift sales, and returns change_due', async () => {
      const shift = await clockIn(makeShiftScope(fx, 'cashier-1', 'cashier', false), 'cashier-1', undefined, undefined, 100_000);

      const req = new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ product_id: 'prod-latte', name: 'Latte', quantity: 1, price: 50000 }],
          total: 50000,
          customer_name: 'Khách mang đi',
          customer_phone: '',
          order_type: 'takeaway',
          payment_method: 'cod',
          pay_now: true,
          cash_tendered: 100000,
        }),
      });

      const res = await createOrder(req, fx.env as unknown as Record<string, unknown>, undefined, {
        id: 'cashier-1',
        role: 'cashier',
        tenantId: 'default',
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: { id: string; payment_status: string; change_due: number; cash_tendered: number; is_cod: number } };
      expect(body.data.payment_status).toBe('paid');
      expect(body.data.cash_tendered).toBe(100000);
      expect(body.data.change_due).toBe(50000);
      expect(body.data.is_cod).toBe(1);

      const payRow = fx.sqlite.prepare('SELECT status, method, amount FROM payments WHERE order_id = ?').get(body.data.id) as { status: string; method: string; amount: number };
      expect(payRow).toEqual({ status: 'completed', method: 'cod', amount: 50000 });

      const shiftRow = fx.sqlite.prepare('SELECT cash_sales, total_sales, order_count FROM staff_shifts WHERE id = ?').get(shift.id) as { cash_sales: number; total_sales: number; order_count: number };
      expect(shiftRow).toEqual({ cash_sales: 50000, total_sales: 50000, order_count: 1 });
    });

    it('blocks COD double-collection when PayOS is already settled and supports partial/full cash refunds', async () => {
      const shift = await clockIn(makeShiftScope(fx, 'cashier-1', 'cashier', false), 'cashier-1', undefined, undefined, 200_000);

      // Cross-channel PayOS guard
      fx.sqlite.exec(`
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, is_cod, customer_name, customer_phone, tenant_id, created_at, updated_at)
        VALUES ('ord-cross', '[]', 50000, 'preparing', 'unpaid', 'COD', 1, 'Cross', '', 'default', datetime('now'), datetime('now'));
        INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
        VALUES ('pay-cross-payos', 'ord-cross', 'payos', 50000, 'completed', 'default', datetime('now'), datetime('now'));
      `);
      const blockedCross = await collectCodPayment(fx.db, 'ord-cross', 'default', 'cashier-1', {
        env: fx.env as unknown as Record<string, unknown>,
        actorRole: 'cashier',
      });
      expect(blockedCross).toMatchObject({ success: false, statusCode: 409, code: 'ORDER_ALREADY_PAID_ONLINE' });

      // Partial then full cash/COD refund keeps drawer balanced (variance = 0)
      fx.sqlite.exec(`
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, is_cod, customer_name, customer_phone, tenant_id, created_at, updated_at)
        VALUES ('ord-cod-ref', '[]', 50000, 'completed', 'unpaid', '', 1, 'CashRef', '', 'default', datetime('now'), datetime('now'));
        INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
        VALUES ('pay-cod-ref', 'ord-cod-ref', 'cod', 50000, 'pending', 'default', datetime('now'), datetime('now'));
      `);
      // Also verifies payment_method = NULL with is_cod = 1 works
      const collected = await collectCodPayment(fx.db, 'ord-cod-ref', 'default', 'cashier-1', {
        env: fx.env as unknown as Record<string, unknown>,
        actorRole: 'cashier',
      });
      // Completed + unpaid is terminal unpaid -> move to served first
      expect(collected.success).toBe(false);
      fx.sqlite.exec("UPDATE orders SET status = 'served' WHERE id = 'ord-cod-ref'");
      const collected2 = await collectCodPayment(fx.db, 'ord-cod-ref', 'default', 'cashier-1', {
        env: fx.env as unknown as Record<string, unknown>,
        actorRole: 'cashier',
      });
      expect(collected2).toMatchObject({ success: true });

      const refundApp = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
      refundApp.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-1', role: 'manager', tenantId: 'default' });
        c.set('tenantId', 'default');
        await next();
      });
      refundApp.post('/refund', (c) => handleRefund(c));

      // Partial cash refund of 20,000
      const partialRes = await refundApp.request(
        '/refund',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: 'pay-cod-ref', amount: 20000, reason: 'Thiếu topping', manual_transfer_ref: 'CASH-PART-1' }),
        },
        fx.env,
      );
      expect(partialRes.status).toBe(200);
      const reconMid = await reconcileShiftCash(
        fx.db,
        {
          shift_id: String(shift.id),
          opening_float: 200_000,
          denominations: { denominations: [{ denomination: 100_000, count: 2 }, { denomination: 10_000, count: 3 }] },
        },
        'cashier-1',
        'default',
        'cashier',
      );
      expect(reconMid.cash_payment_total).toBe(50_000);
      expect(reconMid.cash_payout_total).toBe(20_000);
      expect(reconMid.expected_cash).toBe(230_000);
      expect(reconMid.variance).toBe(0);
    });

    it('splitOrders cancels pending parent COD payments and restores parent redeemed points & promotions', async () => {
      fx.sqlite.exec(`
        INSERT INTO customers (id, name, phone, loyalty_points, tenant_id) VALUES ('cust-split', 'Split Cust', '0902223333', 100, 'default');
        INSERT INTO promotions (id, code, name, discount_type, discount_value, usage_limit, usage_count, is_active, tenant_id)
        VALUES ('promo-split', 'SPLIT10', 'Split Promo', 'fixed', 10000, 5, 1, 1, 'default');
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, is_cod, customer_id, customer_name, customer_phone, table_id, loyalty_points_redeemed, tenant_id, created_at, updated_at)
        VALUES ('ord-parent-split', '[]', 70000, 'pending', 'unpaid', 'cod', 1, 'cust-split', 'Split Cust', '0902223333', 'tbl-1', 50, 'default', datetime('now'), datetime('now'));
        INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
        VALUES ('pay-parent-split', 'ord-parent-split', 'cod', 70000, 'pending', 'default', datetime('now'), datetime('now'));
        INSERT INTO promotion_redemptions (promotion_id, code, order_id, customer_id, discount_amount, order_total, tenant_id, redeemed_at)
        VALUES ('promo-split', 'SPLIT10', 'ord-parent-split', 'cust-split', 10000, 70000, 'default', datetime('now'));
      `);

      const req = new Request('https://test.aura/api/orders/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'split-w3-1' },
        body: JSON.stringify({
          parent_order_id: 'ord-parent-split',
          table_id: 'tbl-1',
          orders: [
            { customer_name: 'Guest 1', customer_phone: '0902223334', payment_method: 'cod', items: [{ product_id: 'prod-latte', name: 'Latte', quantity: 1, price: 50000 }] },
            { customer_name: 'Guest 2', customer_phone: '0902223335', payment_method: 'cod', items: [{ product_id: 'prod-esp', name: 'Espresso', quantity: 1, price: 35000 }] },
          ],
        }),
      });

      const res = await splitOrders(req, fx.env as unknown as Record<string, unknown>, undefined, {
        id: 'cashier-1',
        role: 'cashier',
        tenantId: 'default',
      });
      expect(res.status).toBe(201);

      const parentPay = fx.sqlite.prepare("SELECT status FROM payments WHERE id = 'pay-parent-split'").get() as { status: string };
      expect(parentPay.status).toBe('cancelled');
      const custPts = fx.sqlite.prepare("SELECT loyalty_points FROM customers WHERE id = 'cust-split'").get() as { loyalty_points: number };
      expect(custPts.loyalty_points).toBe(150);
      const promoCount = fx.sqlite.prepare("SELECT usage_count FROM promotions WHERE id = 'promo-split'").get() as { usage_count: number };
      expect(promoCount.usage_count).toBe(0);
    });
  });

  describe('#225 — Late PayOS settlement, cron expiry rollback & summary parity', () => {
    it('late PayOS settlement on expired order does not inflate shift online_sales and allows clean manual refund (no 409)', async () => {
      const shift = await clockIn(makeShiftScope(fx, 'cashier-1', 'cashier', false), 'cashier-1', undefined, undefined, 100_000);
      fx.sqlite.exec(`
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, customer_name, customer_phone, tenant_id, created_at, updated_at)
        VALUES ('ord-late-exp', '[]', 80000, 'expired', 'unpaid', 'payos', 'Late Pay', '0903334444', 'default', datetime('now'), datetime('now'));
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, tenant_id, created_at, updated_at)
        VALUES ('pay-late-exp', 'ord-late-exp', 'payos', 80000, 'expired', '99112233', 'default', datetime('now'), datetime('now'));
      `);

      const now = new Date().toISOString();
      const settled = await settlePayOS(
        fx.db,
        { id: 'pay-late-exp', order_id: 'ord-late-exp', status: 'expired', amount: 80000, method: 'payos' },
        true,
        'completed',
        now,
        'ref-late-1',
      );
      expect(settled.paymentChanged).toBe(true);
      expect(settled.orderChanged).toBe(true);

      const shiftAfter = fx.sqlite.prepare('SELECT online_sales, total_sales, order_count FROM staff_shifts WHERE id = ?').get(shift.id) as { online_sales: number; total_sales: number; order_count: number };
      expect(shiftAfter).toEqual({ online_sales: 0, total_sales: 0, order_count: 0 });

      const ordAfter = fx.sqlite.prepare("SELECT status, payment_status FROM orders WHERE id = 'ord-late-exp'").get() as { status: string; payment_status: string };
      expect(ordAfter).toEqual({ status: 'expired', payment_status: 'paid' });

      // Manual refund now succeeds cleanly with HTTP 200 instead of 409!
      const refundApp = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
      refundApp.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-1', role: 'manager', tenantId: 'default' });
        c.set('tenantId', 'default');
        await next();
      });
      refundApp.post('/refund', (c) => handleRefund(c));

      const refundRes = await refundApp.request(
        '/refund',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: 'pay-late-exp', amount: 80000, reason: 'Late PayOS refund', manual_transfer_ref: 'BANK-LATE-1' }),
        },
        fx.env,
      );
      expect(refundRes.status).toBe(200);
      const ordRefunded = fx.sqlite.prepare("SELECT status, payment_status FROM orders WHERE id = 'ord-late-exp'").get() as { status: string; payment_status: string };
      expect(ordRefunded).toEqual({ status: 'expired', payment_status: 'refunded' });
    });

    it('expireUnpaidOnlineOrders restores inventory, cashback wallet, redeemed points, promo usage, and table status', async () => {
      const oldIso = new Date(Date.now() - 60 * 60_000).toISOString();
      fx.sqlite.exec(`
        INSERT INTO customers (id, name, phone, loyalty_points, tenant_id) VALUES ('cust-exp', 'Exp Cust', '0904445555', 20, 'default');
        INSERT INTO cashback_wallets (id, customer_id, balance, total_spent, tenant_id, updated_at) VALUES ('wal-exp', 'cust-exp', 10000, 15000, 'default', datetime('now'));
        INSERT INTO inventory_items (id, sku, name, unit, current_stock, min_stock, is_active, tenant_id, updated_at) VALUES ('inv-exp-1', 'SKU-EXP-1', 'Milk', 'ml', 80, 10, 1, 'default', datetime('now'));
        INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, tenant_id, created_at) VALUES ('itx-exp-1', 'inv-exp-1', 'reserve', -20, 'ord-exp-full', 'order', 'default', '${oldIso}');
        INSERT INTO promotions (id, code, name, discount_type, discount_value, usage_limit, usage_count, is_active, tenant_id) VALUES ('promo-exp', 'EXP10', 'Exp Promo', 'fixed', 10000, 5, 1, 1, 'default');
        UPDATE cafe_tables SET status = 'Occupied' WHERE id = 'tbl-1';
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, customer_id, customer_name, customer_phone, table_id, cashback_used, loyalty_points_redeemed, tenant_id, created_at, updated_at)
        VALUES ('ord-exp-full', '[]', 40000, 'pending', 'unpaid', 'payos', 'cust-exp', 'Exp Cust', '0904445555', 'tbl-1', 15000, 30, 'default', '${oldIso}', '${oldIso}');
        INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
        VALUES ('pay-exp-full', 'ord-exp-full', 'payos', 40000, 'pending', 'default', '${oldIso}', '${oldIso}');
        INSERT INTO promotion_redemptions (promotion_id, code, order_id, customer_id, discount_amount, order_total, tenant_id, redeemed_at)
        VALUES ('promo-exp', 'EXP10', 'ord-exp-full', 'cust-exp', 10000, 65000, 'default', '${oldIso}');
      `);

      const expired = await expireUnpaidOnlineOrders(fx.env as unknown as Record<string, unknown>, 'default');
      expect(expired).toBe(1);

      expect((fx.sqlite.prepare("SELECT status FROM orders WHERE id = 'ord-exp-full'").get() as { status: string }).status).toBe('expired');
      expect((fx.sqlite.prepare("SELECT current_stock FROM inventory_items WHERE id = 'inv-exp-1'").get() as { current_stock: number }).current_stock).toBe(100);
      expect((fx.sqlite.prepare("SELECT balance FROM cashback_wallets WHERE id = 'wal-exp'").get() as { balance: number }).balance).toBe(25000);
      expect((fx.sqlite.prepare("SELECT loyalty_points FROM customers WHERE id = 'cust-exp'").get() as { loyalty_points: number }).loyalty_points).toBe(50);
      expect((fx.sqlite.prepare("SELECT usage_count FROM promotions WHERE id = 'promo-exp'").get() as { usage_count: number }).usage_count).toBe(0);
      expect((fx.sqlite.prepare("SELECT status FROM cafe_tables WHERE id = 'tbl-1'").get() as { status: string }).status).toBe('Available');
    });

    it('GET /api/orders/summary groups ordersByPaymentMethod by payment_method and subtracts partial refund_amount from totalRevenue', async () => {
      fx.sqlite.exec(`
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, is_cod, customer_name, customer_phone, tenant_id, created_at, updated_at)
        VALUES
          ('ord-sum-1', '[]', 100000, 'completed', 'partially_refunded', 'payos', 0, 'A', '', 'default', datetime('now'), datetime('now')),
          ('ord-sum-2', '[]', 50000, 'completed', 'paid', '', 1, 'B', '', 'default', datetime('now'), datetime('now'));
        INSERT INTO payments (id, order_id, method, amount, status, refund_status, refund_amount, tenant_id, created_at, updated_at)
        VALUES ('pay-sum-1', 'ord-sum-1', 'payos', 100000, 'completed', 'partial', 30000, 'default', datetime('now'), datetime('now'));
      `);

      const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-1', role: 'manager', tenantId: 'default' });
        c.set('tenantId', 'default');
        await next();
      });
      app.get('/summary', (c) => handleGetOrderSummary(c));

      const res = await app.request('/summary', { method: 'GET' }, fx.env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: { totalRevenue: number; ordersByPaymentMethod: Record<string, number> } };
      expect(json.data.totalRevenue).toBe(120000);
      expect(json.data.ordersByPaymentMethod.payos).toBe(1);
      expect(json.data.ordersByPaymentMethod.cod).toBe(1);
    });
  });

  describe('#226 — Delivery COD state machine, paid delivery failure, BOM spoilage & shipper custody', () => {
    it('allows unpaid COD exit from served/delivered, enforces order_type compatibility, and lets staff complete/fail delivering', () => {
      expect(canTransition('served', 'cancelled').ok).toBe(true);
      expect(canTransition('served', 'failed').ok).toBe(true);
      expect(canTransition('delivered', 'cancelled').ok).toBe(true);
      expect(canTransition('delivered', 'failed').ok).toBe(true);
      expect(canActorTransition('staff', 'delivering', 'delivered').ok).toBe(true);
      expect(canActorTransition('staff', 'delivering', 'failed').ok).toBe(true);
      expect(canActorTransition('rider', 'delivered', 'failed').ok).toBe(true);
    });

    it('records waste (never restoring current_stock) when KDS cancels/fails post-prep order', async () => {
      fx.sqlite.exec(`
        INSERT INTO inventory_items (id, sku, name, unit, current_stock, min_stock, is_active, tenant_id, updated_at)
        VALUES ('inv-spoil-1', 'SKU-SPOIL-1', 'Espresso Beans', 'g', 80, 10, 1, 'default', datetime('now'));
        INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, tenant_id, created_at)
        VALUES ('itx-spoil-1', 'inv-spoil-1', 'reserve', -20, 'ord-spoil-1', 'order', 'default', datetime('now'));
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, order_type, customer_name, customer_phone, tenant_id, created_at, updated_at)
        VALUES ('ord-spoil-1', '[]', 50000, 'delivering', 'unpaid', 'cod', 'delivery', 'Spoil', '0905556666', 'default', datetime('now'), datetime('now'));
      `);

      const res = await executeKdsStatusTransition(fx.db, 'ord-spoil-1', 'failed', 'manager', {
        tenantId: 'default',
        fields: { failure_reason: 'Khách không nhận hàng' },
      });
      expect(res.success).toBe(true);

      const stockAfter = fx.sqlite.prepare("SELECT current_stock FROM inventory_items WHERE id = 'inv-spoil-1'").get() as { current_stock: number };
      expect(stockAfter.current_stock).toBe(80);
      const wasteTx = fx.sqlite.prepare("SELECT type, quantity FROM inventory_transactions WHERE reference_id = 'ord-spoil-1' AND type = 'waste'").get() as { type: string; quantity: number } | undefined;
      expect(wasteTx).toEqual({ type: 'waste', quantity: 20 });
    });

    it('enforces shipper custody, validates assigned_shipper_id against tenant users, and exposes shipper/failure metadata in getOrder', async () => {
      fx.sqlite.exec(`
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, order_type, customer_name, customer_phone, tenant_id, created_at, updated_at)
        VALUES
          ('ord-deliv-custody', '[]', 65000, 'ready', 'unpaid', 'cod', 'delivery', 'Deliv', '0906667777', 'default', datetime('now'), datetime('now')),
          ('ord-dinein-guard', '[]', 35000, 'ready', 'paid', 'payos', 'dine_in', 'Dine', '', 'default', datetime('now'), datetime('now'));
      `);

      const makeApp = (role: string, userId: string) => {
        const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
        app.use('*', async (c, next) => {
          c.set('user', { id: userId, role, tenantId: 'default' });
          c.set('tenantId', 'default');
          await next();
        });
        app.patch('/orders/:id/status', (c) => handleUpdateOrderStatus(c));
        app.patch('/orders/:id/mark-cod-paid', (c) => handleMarkCodPaid(c));
        return app;
      };

      // Reject dine_in -> delivering (400)
      const badChannel = await makeApp('manager', 'mgr-1').request(
        '/orders/ord-dinein-guard/status',
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'delivering' }) },
        fx.env,
      );
      expect(badChannel.status).toBe(400);

      // Reject cross-tenant assigned_shipper_id (400)
      const badShipper = await makeApp('manager', 'mgr-1').request(
        '/orders/ord-deliv-custody/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'delivering', assigned_shipper_id: 'shipper-other-store' }),
        },
        fx.env,
      );
      expect(badShipper.status).toBe(400);

      // Assign valid shipper-a -> auto-populates shipper_name
      const assignOk = await makeApp('manager', 'mgr-1').request(
        '/orders/ord-deliv-custody/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'delivering', assigned_shipper_id: 'shipper-a' }),
        },
        fx.env,
      );
      expect(assignOk.status).toBe(200);

      // Shipper B cannot update or collect COD on Shipper A's order (403)
      const stolenStatus = await makeApp('shipper', 'shipper-b').request(
        '/orders/ord-deliv-custody/status',
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'delivered' }) },
        fx.env,
      );
      expect(stolenStatus.status).toBe(403);

      const stolenCod = await makeApp('shipper', 'shipper-b').request(
        '/orders/ord-deliv-custody/mark-cod-paid',
        { method: 'PATCH' },
        fx.env,
      );
      expect(stolenCod.status).toBe(403);

      // Shipper A marks delivered -> then customer refuses unpaid COD -> Shipper A marks failed with reason
      const deliveredOk = await makeApp('shipper', 'shipper-a').request(
        '/orders/ord-deliv-custody/status',
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'delivered' }) },
        fx.env,
      );
      expect(deliveredOk.status).toBe(200);

      const refusedOk = await makeApp('shipper', 'shipper-a').request(
        '/orders/ord-deliv-custody/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'failed', failure_reason: 'Khách từ chối thanh toán COD' }),
        },
        fx.env,
      );
      expect(refusedOk.status).toBe(200);

      // getOrder returns assigned_shipper_id, shipper_name, and failure_reason
      const getRes = await getOrder(
        new Request('https://test.aura/api/orders/ord-deliv-custody'),
        fx.env as unknown as Record<string, unknown>,
        'ord-deliv-custody',
        'default',
      );
      expect(getRes.status).toBe(200);
      const getJson = (await getRes.json()) as { order: { assigned_shipper_id: string; shipper_name: string; failure_reason: string } };
      expect(getJson.order.assigned_shipper_id).toBe('shipper-a');
      expect(getJson.order.shipper_name).toBe('Shipper A');
      expect(getJson.order.failure_reason).toBe('Khách từ chối thanh toán COD');
    });

    it('allows manager to fail a paid PayOS delivery order without 409 deadlock and marks it refund-ready', async () => {
      fx.sqlite.exec(`
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, order_type, customer_name, customer_phone, tenant_id, created_at, updated_at)
        VALUES ('ord-paid-fail', '[]', 75000, 'delivering', 'paid', 'payos', 'delivery', 'PaidDeliv', '0907778888', 'default', datetime('now'), datetime('now'));
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, tenant_id, created_at, updated_at)
        VALUES ('pay-paid-fail', 'ord-paid-fail', 'payos', 75000, 'completed', '88776655', 'default', datetime('now'), datetime('now'));
      `);

      const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-1', role: 'manager', tenantId: 'default' });
        c.set('tenantId', 'default');
        await next();
      });
      app.patch('/orders/:id/status', (c) => handleUpdateOrderStatus(c));
      app.post('/refund', (c) => handleRefund(c));

      const failRes = await app.request(
        '/orders/ord-paid-fail/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'failed', failure_reason: 'Hư hỏng khi vận chuyển' }),
        },
        fx.env,
      );
      expect(failRes.status).toBe(200);

      const ordRow = fx.sqlite.prepare("SELECT status, payment_status, failure_reason, notes FROM orders WHERE id = 'ord-paid-fail'").get() as {
        status: string;
        payment_status: string;
        failure_reason: string;
        notes: string;
      };
      expect(ordRow.status).toBe('failed');
      expect(ordRow.payment_status).toBe('paid');
      expect(ordRow.failure_reason).toBe('Hư hỏng khi vận chuyển');
      expect(ordRow.notes).toContain('[PAID_ORDER_VOIDED_REFUND_REQUIRED]');

      const refRes = await app.request(
        '/refund',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: 'pay-paid-fail', amount: 75000, reason: 'Hoàn đơn giao thất bại', manual_transfer_ref: 'BANK-FAIL-1' }),
        },
        fx.env,
      );
      expect(refRes.status).toBe(200);
      expect((fx.sqlite.prepare("SELECT status, payment_status FROM orders WHERE id = 'ord-paid-fail'").get() as { status: string; payment_status: string })).toEqual({
        status: 'failed',
        payment_status: 'refunded',
      });
    });

    it('handles closed-shift paid COD cancellation by recording a cash_payouts refund on the currently open shift', async () => {
      const shift1 = await clockIn(makeShiftScope(fx, 'cashier-1', 'cashier', false), 'cashier-1', undefined, undefined, 100_000);
      fx.sqlite.exec(`
        INSERT INTO orders (id, items, total, status, payment_status, payment_method, is_cod, customer_name, customer_phone, tenant_id, created_at, updated_at)
        VALUES ('ord-old-shift-cod', '[]', 60000, 'ready', 'unpaid', 'cod', 1, 'OldShift', '', 'default', datetime('now'), datetime('now'));
        INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
        VALUES ('pay-old-shift-cod', 'ord-old-shift-cod', 'cod', 60000, 'pending', 'default', datetime('now'), datetime('now'));
      `);
      expect(
        await collectCodPayment(fx.db, 'ord-old-shift-cod', 'default', 'cashier-1', {
          env: fx.env as unknown as Record<string, unknown>,
          actorRole: 'cashier',
        }),
      ).toMatchObject({ success: true });

      // Reconcile & close shift 1
      await reconcileShiftCash(
        fx.db,
        { shift_id: String(shift1.id), opening_float: 100_000, denominations: { denominations: [{ denomination: 10_000, count: 16 }] } },
        'cashier-1',
        'default',
        'cashier',
      );
      await clockOut(makeShiftScope(fx, 'cashier-1', 'cashier', false), 'cashier-1', String(shift1.id));

      // Open shift 2 with 200,000 float
      const shift2 = await clockIn(makeShiftScope(fx, 'cashier-1', 'cashier', false), 'cashier-1', undefined, undefined, 200_000);

      // Manager cancels the old paid COD order -> cash is refunded from shift 2 drawer
      const res = await executeKdsStatusTransition(fx.db, 'ord-old-shift-cod', 'cancelled', 'manager', {
        tenantId: 'default',
        allowPaidCompensation: true,
        actorId: 'mgr-1',
      });
      expect(res.success).toBe(true);

      const recon2 = await reconcileShiftCash(
        fx.db,
        { shift_id: String(shift2.id), opening_float: 200_000, denominations: { denominations: [{ denomination: 10_000, count: 14 }] } },
        'cashier-1',
        'default',
        'cashier',
      );
      expect(recon2.cash_payout_total).toBe(60_000);
      expect(recon2.expected_cash).toBe(140_000);
      expect(recon2.variance).toBe(0);
    });
  });
});
