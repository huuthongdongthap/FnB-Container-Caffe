// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { handleErpnextInvoicesRequest } from '../routes/erpnext-invoices';
import { registerPnlHandlers } from '../routes/reports-handlers/pnl-handlers';
import { registerAnalyticsHandlers } from '../routes/reports-handlers/analytics-handlers';
import { handleRefund } from '../routes/refunds-handlers/mutation-handlers';
import { registerCheckoutHandlers } from '../routes/dindin-handlers/checkout-handlers';
import { registerSessionHandlers } from '../routes/table-sessions-handlers/session-handlers';
import { handleGetOrderById, handleTrackOrder } from '../routes/openapi-orders-handlers/order-read-handlers';
import { settlePayOS } from '../routes/webhooks-handlers/payos-settlement';
import { reconcilePayOSPayment } from '../../../packages/domain/payment/commands/payos-reconcile';
import { collectCodPayment } from '../../../packages/domain/kitchen/commands/collect-cod-payment';
import { executeKdsStatusTransition } from '../../../packages/domain/kitchen/commands/kds-status-transition';
import { runPostOrderSideEffects } from '../../../packages/domain/order/commands/create-order-side-effects';
import { splitOrders } from '../../../packages/domain/order/commands/split-orders';
import { updateOrder } from '../../../packages/domain/order/commands/update-order';
import { adjustShiftCustodyForCashRefund, compensateVoidedOrder } from '../../../packages/domain/order/policies/order-rollback';
import { reconcileShiftCash } from '../../../packages/domain/shift/src/policies/cash-reconciliation-policy';
import type { Env } from '../types/env';

function createSqliteD1(): { db: D1Database; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  const wrapStmt = (sql: string, params: unknown[] = []) => ({
    bind: (...bound: unknown[]) => wrapStmt(sql, bound.map((v) => (v === undefined ? null : v))),
    first: async <T = Record<string, unknown>>() => {
      const row = raw.prepare(sql).get(...(params as [])) as T | undefined;
      return row ?? null;
    },
    all: async <T = Record<string, unknown>>() => {
      const results = raw.prepare(sql).all(...(params as [])) as T[];
      return { results, success: true, meta: { changes: 0 } };
    },
    run: async () => {
      const info = raw.prepare(sql).run(...(params as []));
      return { success: true, meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) } };
    },
  });

  const db = {
    prepare: (sql: string) => wrapStmt(sql),
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      raw.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        raw.exec('COMMIT');
        return out;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
    exec: async (sql: string) => {
      raw.exec(sql);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;

  return { db, raw };
}

describe('Issues #253-#257 Finance, Refund, P&L, ERP & Shift Regressions', () => {
  it('#253: DinDin QC keeps unpaid COD order collectable (ready, not completed) so collectCodPayment succeeds', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', customer_name TEXT DEFAULT 'Walk-in', status TEXT, payment_method TEXT,
        payment_status TEXT, total REAL, is_cod INTEGER DEFAULT 1, cod_paid_at TEXT, cod_paid_by TEXT, updated_at TEXT, created_at TEXT
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        refund_status TEXT, refund_amount REAL DEFAULT 0,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE _metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, value REAL, labels TEXT, timestamp INTEGER);
      CREATE TABLE staff_shifts (
        id TEXT PRIMARY KEY, staff_id TEXT, role TEXT, clock_in TEXT, clock_out TEXT,
        cash_sales REAL DEFAULT 0, total_sales REAL DEFAULT 0, order_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active', attendance_state TEXT DEFAULT 'active',
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE shift_reconciliations (id TEXT PRIMARY KEY, shift_id TEXT, tenant_id TEXT DEFAULT 'default');
      CREATE TABLE cash_payment_attributions (
        payment_id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', shift_id TEXT, collected_by TEXT, settled_at TEXT
      );
      INSERT INTO staff_shifts (id, staff_id, role, clock_in, tenant_id)
      VALUES ('shift-cod-1', 'staff-1', 'cashier', '2026-11-26T01:00:00Z', 'default');
      INSERT INTO orders (id, tenant_id, status, payment_method, payment_status, total, is_cod, created_at)
      VALUES ('DIN-cod-1', 'default', 'preparing', 'cod', 'cod_pending', 85000, 1, '2026-11-26T10:00:00Z');
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user?: { id: string; role: string; tenant_id: string } } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'staff-1', role: 'staff', tenant_id: 'default' });
      await next();
    });
    registerCheckoutHandlers(app as unknown as Parameters<typeof registerCheckoutHandlers>[0]);

    const mockKv = { get: async () => null, put: async () => {}, delete: async () => {} };
    const qcRes = await app.request(
      '/checkout/DIN-cod-1/qc',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ qcPassed: true, checkedItems: ['item-1'] }) },
      { AURA_DB: db, AUTH_KV: mockKv } as unknown as Env
    );
    expect(qcRes.status).toBe(200);
    const qcBody = (await qcRes.json()) as { status: string };
    expect(qcBody.status).toBe('ready');

    const collectRes = await collectCodPayment(db, 'DIN-cod-1', 'default', 'staff-1');
    expect(collectRes.success).toBe(true);

    const metric = raw.prepare("SELECT value FROM _metrics WHERE name = 'revenue'").get() as { value: number } | undefined;
    expect(metric?.value).toBe(85000);
  });

  it('#254: ERPNext invoice creation blocks unpaid/cod_pending orders with 409', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', status TEXT, payment_status TEXT, total REAL
      );
      INSERT INTO orders (id, tenant_id, status, payment_status, total)
      VALUES ('ord-unpaid-1', 'default', 'pending', 'cod_pending', 120000);
    `);

    const req = new Request('http://localhost/api/erpnext-invoices/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'ord-unpaid-1' }),
    });
    const res = await handleErpnextInvoicesRequest(req, { AURA_DB: db } as unknown as Parameters<typeof handleErpnextInvoicesRequest>[1], 'default');
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unpaid|pending/i);
  });

  it('#255: POST /api/payments/refund blocks orders with issued e-invoice (409 EINVOICE_ADJUSTMENT_REQUIRED)', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', status TEXT, payment_status TEXT,
        customer_id TEXT, total REAL
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        transaction_id TEXT, refund_status TEXT, refund_amount REAL DEFAULT 0, tenant_id TEXT DEFAULT 'default',
        created_at TEXT, updated_at TEXT
      );
      CREATE TABLE erpnext_mappings (
        id TEXT PRIMARY KEY, aura_order_id TEXT, local_type TEXT, local_id TEXT,
        sync_status TEXT, erpnext_invoice_id TEXT, erpnext_id TEXT
      );
      INSERT INTO orders (id, tenant_id, status, payment_status, total)
      VALUES ('ord-einv-1', 'default', 'confirmed', 'paid', 150000);
      INSERT INTO payments (id, order_id, method, amount, status, transaction_id, tenant_id, created_at)
      VALUES ('pay-einv-1', 'ord-einv-1', 'cash', 150000, 'completed', '', 'default', '2026-11-26T10:00:00Z');
      INSERT INTO erpnext_mappings (id, aura_order_id, local_type, local_id, sync_status, erpnext_invoice_id)
      VALUES ('map-1', 'ord-einv-1', 'sales_invoice', 'ord-einv-1', 'issued', 'SINV-0001');
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user?: { id: string; role: string; tenant_id: string } } }>();
    app.post('/refund', async (c) => {
      c.set('user', { id: 'owner-1', role: 'owner', tenant_id: 'default' });
      return handleRefund(c as unknown as Parameters<typeof handleRefund>[0]);
    });

    const res = await app.request(
      '/refund',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId: 'pay-einv-1', amount: 150000, reason: 'Customer request' }),
      },
      { AURA_DB: db } as unknown as Env
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('EINVOICE_ADJUSTMENT_REQUIRED');
  });

  it('#256: P&L excludes cpo_ref_/cpo_pref_ cash payouts, attributes multi-tranche refunds by transfer date, and nets total_collected', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', status TEXT, payment_status TEXT,
        customer_name TEXT DEFAULT 'Walk-in', items TEXT DEFAULT '[]', total REAL, shipping_fee REAL DEFAULT 0, service_fee REAL DEFAULT 0, tip_amount REAL DEFAULT 0,
        discount REAL DEFAULT 0, cod_paid_at TEXT, created_at TEXT
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        refund_amount REAL DEFAULT 0, refunded_at TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE payment_refund_transfers (
        tenant_id TEXT, manual_transfer_ref TEXT, payment_id TEXT, amount REAL, reason TEXT, actor_id TEXT, created_at TEXT
      );
      CREATE TABLE cash_payouts (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', shift_id TEXT, amount REAL, reason TEXT, status TEXT, created_at TEXT
      );
      INSERT INTO orders (id, tenant_id, status, payment_status, total, created_at)
      VALUES ('ord-pnl-1', 'default', 'completed', 'partially_refunded', 100000, '2026-11-20T05:00:00Z');
      INSERT INTO payments (id, order_id, method, amount, status, refund_amount, refunded_at, tenant_id, created_at)
      VALUES ('pay-pnl-1', 'ord-pnl-1', 'cash', 100000, 'completed', 50000, '2026-11-22T05:00:00Z', 'default', '2026-11-20T05:00:00Z');
      INSERT INTO payment_refund_transfers (tenant_id, manual_transfer_ref, payment_id, amount, reason, actor_id, created_at)
      VALUES
        ('default', 'ref-1', 'pay-pnl-1', 30000, 'Khách đổi ý', 'owner-1', '2026-11-21T05:00:00Z'),
        ('default', 'ref-2', 'pay-pnl-1', 20000, 'Làm nhầm size', 'owner-1', '2026-11-22T05:00:00Z');
      INSERT INTO cash_payouts (id, tenant_id, shift_id, amount, reason, status, created_at)
      VALUES
        ('cpo_pref_pay-pnl-1_ref-1', 'default', 'shift-1', 30000, 'Khách đổi ý', 'completed', '2026-11-21T05:00:00Z'),
        ('cpo_op_1', 'default', 'shift-1', 15000, 'Mua đá viên', 'completed', '2026-11-21T05:00:00Z');
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user?: { id: string; role: string; tenant_id: string } } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'owner-1', role: 'owner', tenant_id: 'default' });
      await next();
    });
    registerPnlHandlers(app as unknown as Parameters<typeof registerPnlHandlers>[0]);

    const res = await app.request(
      '/pnl?from=2026-11-20&to=2026-11-22',
      { method: 'GET' },
      { AURA_DB: db } as unknown as Env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data?: { daily: Array<{ date: string; refunds: number; cash_payouts: number; total_collected: number; net_revenue: number }> };
      daily?: Array<{ date: string; refunds: number; cash_payouts: number; total_collected: number; net_revenue: number }>;
    };
    const daily = body.data?.daily ?? body.daily ?? [];
    const d20 = daily.find((d) => d.date === '2026-11-20');
    const d21 = daily.find((d) => d.date === '2026-11-21');
    const d22 = daily.find((d) => d.date === '2026-11-22');
    expect(d20?.total_collected).toBe(100000);
    expect(d21?.refunds).toBe(30000);
    expect(d22?.refunds).toBe(20000);
    // Only the operating payout (15000) is counted; cpo_pref_* (30000) is excluded!
    expect(d21?.cash_payouts).toBe(15000);
  });

  it('#256: Shift reconciliation online_sales_total excludes cancelled PayOS orders and includes bank_transfer/qr', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT, is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default');
      INSERT INTO users (id, role, is_active, tenant_id) VALUES ('cashier-1', 'cashier', 1, 'default');
      CREATE TABLE cash_payouts (id TEXT PRIMARY KEY, shift_id TEXT, tenant_id TEXT DEFAULT 'default', amount REAL, status TEXT, created_at TEXT);
      CREATE TABLE staff_shifts (
        id TEXT PRIMARY KEY, staff_id TEXT, role TEXT, clock_in TEXT, clock_out TEXT,
        opening_cash REAL DEFAULT 0, hours_worked REAL, notes TEXT,
        tenant_id TEXT DEFAULT 'default', status TEXT DEFAULT 'active', attendance_state TEXT DEFAULT 'active'
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', status TEXT, payment_status TEXT, total REAL
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        refund_status TEXT, refund_amount REAL DEFAULT 0, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE cash_payment_attributions (
        payment_id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', shift_id TEXT, collected_by TEXT, settled_at TEXT
      );
      CREATE TABLE shift_reconciliations (
        id TEXT PRIMARY KEY, shift_id TEXT, tenant_id TEXT, staff_id TEXT,
        opening_float REAL, opening_cash REAL, cash_sales_total REAL, cash_payouts_total REAL,
        cash_payment_total REAL, cash_payout_total REAL, denominations TEXT,
        expected_cash REAL, actual_counted REAL, actual_cash REAL, variance REAL, variance_amount REAL, variance_status TEXT,
        cash_sales REAL, remitted_cash REAL, closing_float REAL, handover_to_staff_id TEXT,
        online_sales_total REAL, reconciled_by TEXT, notes TEXT, reconciled_at TEXT, created_at TEXT,
        status TEXT DEFAULT 'completed', variance_reason TEXT
      );
      INSERT INTO staff_shifts (id, staff_id, role, clock_in, opening_cash, tenant_id)
      VALUES ('shift-1', 'cashier-1', 'cashier', '2026-11-26T01:00:00Z', 500000, 'default');
      INSERT INTO orders (id, tenant_id, status, payment_status, total)
      VALUES
        ('ord-payos-cancelled', 'default', 'cancelled', 'paid', 200000),
        ('ord-qr-ok', 'default', 'completed', 'paid', 75000);
      INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
      VALUES
        ('pay-1', 'ord-payos-cancelled', 'payos', 200000, 'completed', 'default', '2026-11-26T02:00:00Z', '2026-11-26T02:00:00Z'),
        ('pay-2', 'ord-qr-ok', 'vietqr', 75000, 'completed', 'default', '2026-11-26T02:05:00Z', '2026-11-26T02:05:00Z');
    `);

    const recon = await reconcileShiftCash(
      db,
      {
        shift_id: 'shift-1',
        opening_float: 500000,
        actual_counted: 500000,
      },
      'cashier-1',
      'default'
    );
    expect(recon.online_sales_total).toBe(75000);
  });

  it('PayOS settlement attributes online_sales once to non-kitchen shift, reconcilePayOSPayment respects partially_refunded orders, and records production _metrics schema', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', status TEXT, payment_status TEXT,
        payment_method TEXT, total REAL, customer_id TEXT, customer_phone TEXT, customer_email TEXT,
        customer_name TEXT, items TEXT DEFAULT '[]', order_type TEXT DEFAULT 'dine_in',
        table_id TEXT, notes TEXT, updated_at TEXT, created_at TEXT
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        transaction_id TEXT, payment_url TEXT, refund_status TEXT, refund_amount REAL DEFAULT 0,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE staff_shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT DEFAULT 'default', staff_id TEXT,
        role TEXT, clock_in TEXT, clock_out TEXT, total_sales REAL DEFAULT 0,
        cash_sales REAL DEFAULT 0, online_sales REAL DEFAULT 0, order_count INTEGER DEFAULT 0
      );
      CREATE TABLE shift_reconciliations (id TEXT PRIMARY KEY, shift_id TEXT, tenant_id TEXT DEFAULT 'default');
      CREATE TABLE _metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT DEFAULT 'default',
        name TEXT NOT NULL, value REAL NOT NULL DEFAULT 0, tags TEXT, created_at TEXT
      );
      INSERT INTO staff_shifts (id, tenant_id, staff_id, role, clock_in)
      VALUES
        (1, 'default', 'cashier-1', 'cashier', '2026-11-26T01:00:00Z'),
        (2, 'default', 'barista-1', 'barista', '2026-11-26T02:00:00Z');
      INSERT INTO orders (id, tenant_id, status, payment_status, payment_method, total, created_at)
      VALUES
        ('ord-payos-1', 'default', 'pending', 'pending', 'payos', 120000, '2026-11-26T02:10:00Z'),
        ('ord-payos-partial', 'default', 'confirmed', 'partially_refunded', 'payos', 90000, '2026-11-26T02:15:00Z');
      INSERT INTO payments (id, order_id, method, amount, status, transaction_id, refund_amount, tenant_id, created_at)
      VALUES
        ('pay-payos-1', 'ord-payos-1', 'payos', 120000, 'pending', '88001', 0, 'default', '2026-11-26T02:10:00Z'),
        ('pay-payos-partial', 'ord-payos-partial', 'payos', 90000, 'completed', '88002', 30000, 'default', '2026-11-26T02:15:00Z');
    `);

    const res1 = await reconcilePayOSPayment({
      db,
      paymentId: 'pay-payos-1',
      tenantId: 'default',
      clientId: 'cid',
      apiKey: 'key',
      checksumKey: 'chk',
      source: 'manual',
      preVerified: {
        ok: true,
        status: 'PAID',
        amount: 120000,
        amountPaid: 120000,
        amountRemaining: 0,
      },
    });
    expect(res1.ok).toBe(true);
    expect(res1.outcome).toBe('settled');

    const cashierShift = raw.prepare('SELECT online_sales, total_sales, order_count FROM staff_shifts WHERE id = 1').get() as {
      online_sales: number;
      total_sales: number;
      order_count: number;
    };
    const baristaShift = raw.prepare('SELECT online_sales, total_sales, order_count FROM staff_shifts WHERE id = 2').get() as {
      online_sales: number;
      total_sales: number;
      order_count: number;
    };
    // Barista clocked in more recently, but online_sales must go to cashier once (not double-counted and not to kitchen/barista).
    expect(cashierShift).toEqual({ online_sales: 120000, total_sales: 120000, order_count: 1 });
    expect(baristaShift).toEqual({ online_sales: 0, total_sales: 0, order_count: 0 });

    const metricRow = raw.prepare("SELECT name, value, tenant_id FROM _metrics WHERE name = 'revenue'").get() as {
      name: string;
      value: number;
      tenant_id: string;
    };
    expect(metricRow).toEqual({ name: 'revenue', value: 120000, tenant_id: 'default' });

    const resPartial = await reconcilePayOSPayment({
      db,
      paymentId: 'pay-payos-partial',
      tenantId: 'default',
      clientId: 'cid',
      apiKey: 'key',
      checksumKey: 'chk',
      source: 'manual',
      preVerified: {
        ok: true,
        status: 'PAID',
        amount: 90000,
        amountPaid: 90000,
        amountRemaining: 0,
      },
    });
    expect(resPartial.ok).toBe(true);
    expect(resPartial.outcome).toBe('already_settled');
    const ordPartialAfter = raw.prepare("SELECT payment_status FROM orders WHERE id = 'ord-payos-partial'").get() as {
      payment_status: string;
    };
    expect(ordPartialAfter.payment_status).toBe('partially_refunded');
  });

  it('Cash refund enforces idempotency_key dedupe, guards closed shifts from cash_payouts writes, decrements table_sessions once, and avoids duplicate order_created revenue metrics', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', status TEXT, payment_status TEXT,
        payment_method TEXT, total REAL, session_id TEXT, table_id TEXT, customer_id TEXT,
        customer_name TEXT, customer_phone TEXT, items TEXT DEFAULT '[]',
        points_earned INTEGER DEFAULT 0, cashback_earned INTEGER DEFAULT 0,
        updated_at TEXT, created_at TEXT
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        transaction_id TEXT, refund_status TEXT, refund_amount REAL DEFAULT 0,
        refund_reason TEXT, refunded_at TEXT, loyalty_status TEXT,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE payment_refund_transfers (
        tenant_id TEXT, manual_transfer_ref TEXT, payment_id TEXT, amount REAL,
        reason TEXT, actor_id TEXT, loyalty_status TEXT DEFAULT 'completed', created_at TEXT,
        PRIMARY KEY (tenant_id, manual_transfer_ref)
      );
      CREATE TABLE refund_mutation_guards (settlement_ok INTEGER CHECK (settlement_ok = 1));
      CREATE TABLE refund_loyalty_work (
        tenant_id TEXT, reversal_key TEXT, payment_id TEXT, order_id TEXT, amount REAL,
        status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, completed_at TEXT,
        updated_at TEXT, last_error TEXT, PRIMARY KEY (tenant_id, reversal_key)
      );
      CREATE TABLE customers (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE loyalty_point_logs (
        id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, points_change INTEGER,
        tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE cashback_transactions (
        id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, amount REAL, type TEXT,
        tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE staff_shifts (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', staff_id TEXT, role TEXT,
        clock_in TEXT, clock_out TEXT, cash_sales REAL DEFAULT 0, total_sales REAL DEFAULT 0,
        order_count INTEGER DEFAULT 0
      );
      CREATE TABLE shift_reconciliations (id TEXT PRIMARY KEY, shift_id TEXT, tenant_id TEXT DEFAULT 'default');
      CREATE TABLE cash_payment_attributions (
        payment_id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', shift_id TEXT, collected_by TEXT, settled_at TEXT
      );
      CREATE TABLE cash_payouts (
        id TEXT PRIMARY KEY, shift_id TEXT, tenant_id TEXT DEFAULT 'default', amount REAL,
        reason TEXT, category TEXT, approved_by TEXT, created_by TEXT, status TEXT, created_at TEXT
      );
      CREATE TABLE table_sessions (
        id TEXT PRIMARY KEY, table_id TEXT, tenant_id TEXT DEFAULT 'default', status TEXT,
        order_count INTEGER DEFAULT 1, total_amount REAL DEFAULT 0, current_order_id TEXT, updated_at TEXT
      );
      CREATE TABLE _metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT DEFAULT 'default',
        name TEXT NOT NULL, value REAL NOT NULL DEFAULT 0, tags TEXT, created_at TEXT
      );
      INSERT INTO staff_shifts (id, tenant_id, staff_id, role, clock_in, clock_out, cash_sales, total_sales, order_count)
      VALUES ('shift-closed-1', 'default', 'cashier-1', 'cashier', '2026-11-26T01:00:00Z', '2026-11-26T05:00:00Z', 100000, 100000, 1);
      INSERT INTO table_sessions (id, table_id, tenant_id, status, order_count, total_amount, current_order_id)
      VALUES ('sess-ref-1', 'tbl-1', 'default', 'ordering', 2, 100000, 'ord-cash-ref-1');
      INSERT INTO orders (id, tenant_id, status, payment_status, payment_method, total, session_id, table_id, created_at)
      VALUES ('ord-cash-ref-1', 'default', 'confirmed', 'paid', 'cash', 100000, 'sess-ref-1', 'tbl-1', '2026-11-26T02:00:00Z');
      INSERT INTO payments (id, order_id, method, amount, status, refund_amount, tenant_id, created_at)
      VALUES ('pay-cash-ref-1', 'ord-cash-ref-1', 'cash', 100000, 'completed', 0, 'default', '2026-11-26T02:00:00Z');
      INSERT INTO cash_payment_attributions (payment_id, tenant_id, shift_id, collected_by, settled_at)
      VALUES ('pay-cash-ref-1', 'default', 'shift-closed-1', 'cashier-1', '2026-11-26T02:00:00Z');
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user?: { id: string; role: string; tenant_id: string } } }>();
    app.post('/refund', async (c) => {
      c.set('user', { id: 'owner-1', role: 'owner', tenant_id: 'default' });
      return handleRefund(c as unknown as Parameters<typeof handleRefund>[0]);
    });

    // 1. Partial cash refund with idempotency_key (and closed original shift -> no cash_payouts row created on closed shift)
    const reqBody = {
      paymentId: 'pay-cash-ref-1',
      amount: 40000,
      reason: 'Khách đổi món',
      idempotency_key: 'idem-cash-tranche-1',
    };
    const res1 = await app.request(
      '/refund',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(reqBody) },
      { AURA_DB: db } as unknown as Env
    );
    expect(res1.status).toBe(200);

    // Closed shift must not receive a cash_payouts row when no open drawer shift exists
    const closedShiftPayouts = raw.prepare('SELECT COUNT(*) as cnt FROM cash_payouts').get() as { cnt: number };
    expect(closedShiftPayouts.cnt).toBe(0);

    // Retry with same idempotency_key must not double-refund the remaining 60,000
    const resRetry = await app.request(
      '/refund',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(reqBody) },
      { AURA_DB: db } as unknown as Env
    );
    expect(resRetry.status).toBe(409);
    const payAfterRetry = raw.prepare("SELECT refund_amount FROM payments WHERE id = 'pay-cash-ref-1'").get() as {
      refund_amount: number;
    };
    expect(payAfterRetry.refund_amount).toBe(40000);

    // 2. Full refund of remaining 60,000 decrements table_sessions.order_count once (2 -> 1) and records negative revenue in production _metrics
    const resFull = await app.request(
      '/refund',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          paymentId: 'pay-cash-ref-1',
          amount: 60000,
          reason: 'Huỷ toàn bộ đơn',
          idempotency_key: 'idem-cash-tranche-2',
        }),
      },
      { AURA_DB: db } as unknown as Env
    );
    expect(resFull.status).toBe(200);

    const sessAfter = raw.prepare("SELECT order_count, total_amount, current_order_id FROM table_sessions WHERE id = 'sess-ref-1'").get() as {
      order_count: number;
      total_amount: number;
      current_order_id: string | null;
    };
    expect(sessAfter.order_count).toBe(1);
    expect(sessAfter.total_amount).toBe(0);
    expect(sessAfter.current_order_id).toBeNull();

    const negMetrics = raw.prepare("SELECT value, tenant_id FROM _metrics WHERE name = 'revenue' ORDER BY id ASC").all() as Array<{
      value: number;
      tenant_id: string;
    }>;
    expect(negMetrics).toEqual([
      { value: -40000, tenant_id: 'default' },
      { value: -60000, tenant_id: 'default' },
    ]);

    // 3. runPostOrderSideEffects does not insert a duplicate 'revenue' row in _metrics
    await runPostOrderSideEffects({
      db,
      env: {},
      orderId: 'ord-cash-ref-1',
      tenantId: 'default',
      data: { customer_name: 'Walk-in', customer_phone: '0901112222' },
      snapshot: {
        items: [],
        itemsJson: '[]',
        subtotal: 50000,
        discount: 0,
        shipping_fee: 0,
        tip_amount: 0,
        total: 50000,
      },
      validatedMethod: 'cod',
      resolvedTableId: null,
      initialPaymentStatus: 'paid',
    });
    const revMetricsAfterCreate = raw.prepare("SELECT COUNT(*) as cnt FROM _metrics WHERE name = 'revenue'").get() as {
      cnt: number;
    };
    expect(revMetricsAfterCreate.cnt).toBe(2);
  });

  it('P&L recognizes fully refunded completed orders and nets cross-day refunds in totals.total_collected, while Analytics buckets COD orders by cod_paid_at', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', status TEXT, payment_status TEXT,
        customer_name TEXT DEFAULT 'Walk-in', items TEXT DEFAULT '[]', total REAL,
        shipping_fee REAL DEFAULT 0, service_fee REAL DEFAULT 0, tip_amount REAL DEFAULT 0,
        discount REAL DEFAULT 0, cod_paid_at TEXT, created_at TEXT
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        refund_amount REAL DEFAULT 0, refunded_at TEXT, tenant_id TEXT DEFAULT 'default',
        created_at TEXT, updated_at TEXT
      );
      CREATE TABLE payment_refund_transfers (
        tenant_id TEXT, manual_transfer_ref TEXT, payment_id TEXT, amount REAL,
        reason TEXT, actor_id TEXT, created_at TEXT
      );
      INSERT INTO orders (id, tenant_id, status, payment_status, items, total, cod_paid_at, created_at)
      VALUES
        ('ord-full-ref', 'default', 'completed', 'refunded', '[{"product_id":"p1","name":"Latte","quantity":2,"price":50000}]', 100000, '2026-11-20T03:00:00Z', '2026-11-20T03:00:00Z'),
        ('ord-cod-settle', 'default', 'completed', 'paid', '[{"product_id":"p2","name":"Matcha","quantity":1,"price":60000}]', 60000, '2026-11-21T04:00:00Z', '2026-11-20T04:00:00Z');
      INSERT INTO payments (id, order_id, method, amount, status, refund_amount, refunded_at, tenant_id, created_at)
      VALUES
        ('pay-full-ref', 'ord-full-ref', 'cash', 100000, 'refunded', 100000, '2026-11-21T06:00:00Z', 'default', '2026-11-20T03:00:00Z'),
        ('pay-cod-settle', 'ord-cod-settle', 'cod', 60000, 'completed', 0, NULL, 'default', '2026-11-21T04:00:00Z');
      INSERT INTO payment_refund_transfers (tenant_id, manual_transfer_ref, payment_id, amount, reason, actor_id, created_at)
      VALUES ('default', 'full-ref-1', 'pay-full-ref', 100000, 'Full refund next day', 'owner-1', '2026-11-21T06:00:00Z');
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user?: { id: string; role: string; tenant_id: string } } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'owner-1', role: 'owner', tenant_id: 'default' });
      await next();
    });
    registerPnlHandlers(app as unknown as Parameters<typeof registerPnlHandlers>[0]);
    registerAnalyticsHandlers(app as unknown as Parameters<typeof registerAnalyticsHandlers>[0]);

    const pnlRes = await app.request('/pnl?from=2026-11-20&to=2026-11-21', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
    expect(pnlRes.status).toBe(200);
    const pnlJson = (await pnlRes.json()) as {
      data: {
        daily: Array<{ date: string; gross_sales: number; refunds: number; net_revenue: number; total_collected: number }>;
        totals: { gross_sales: number; refunds: number; net_revenue: number; total_collected: number };
      };
    };
    const pnlBody = pnlJson.data;
    const day20 = pnlBody.daily.find((d) => d.date === '2026-11-20');
    const day21 = pnlBody.daily.find((d) => d.date === '2026-11-21');
    // Day 20 recognized the 100,000 sale; Day 21 recognized the 60,000 settled COD order and the 100,000 full refund
    expect(day20?.gross_sales).toBe(100000);
    expect(day21?.gross_sales).toBe(60000);
    expect(day21?.refunds).toBe(100000);
    // Across the 2-day range, gross collected was 160,000 and refunds were 100,000 -> totals.total_collected = 60,000
    expect(pnlBody.totals.gross_sales).toBe(160000);
    expect(pnlBody.totals.refunds).toBe(100000);
    expect(pnlBody.totals.net_revenue).toBe(60000);
    expect(pnlBody.totals.total_collected).toBe(60000);

    // Analytics /daily, /orders, /top-products, and /peak-hours bucket ord-cod-settle on 2026-11-21 (its cod_paid_at date)
    const dailyRes = await app.request(
      '/daily?from=2026-11-20&to=2026-11-21',
      { method: 'GET' },
      { AURA_DB: db } as unknown as Env
    );
    expect(dailyRes.status).toBe(200);
    const dailyJson = (await dailyRes.json()) as { data: Array<{ date: string; orders: number; revenue: number }> };
    const daily21 = dailyJson.data.find((d) => d.date === '2026-11-21');
    expect(daily21?.orders).toBe(1);
    expect(daily21?.revenue).toBe(60000);

    const ordersAnalyticsRes = await app.request(
      '/orders?from=2026-11-21&to=2026-11-21',
      { method: 'GET' },
      { AURA_DB: db } as unknown as Env
    );
    expect(ordersAnalyticsRes.status).toBe(200);
    const ordersAnalyticsBody = (await ordersAnalyticsRes.json()) as {
      data: Array<{ status: string; count: number; revenue: number }>;
    };
    const completedBucket = ordersAnalyticsBody.data.find((b) => b.status === 'completed');
    expect(completedBucket?.revenue).toBe(60000);

    const topProductsRes = await app.request(
      '/top-products?from=2026-11-21&to=2026-11-21',
      { method: 'GET' },
      { AURA_DB: db } as unknown as Env
    );
    expect(topProductsRes.status).toBe(200);
    const topProductsBody = (await topProductsRes.json()) as {
      data: Array<{ name: string; qty: number; revenue: number }>;
    };
    expect(topProductsBody.data).toHaveLength(1);
    expect(topProductsBody.data[0]?.name).toBe('Matcha');

    const peakHoursRes = await app.request(
      '/peak-hours?from=2026-11-21&to=2026-11-21',
      { method: 'GET' },
      { AURA_DB: db } as unknown as Env
    );
    expect(peakHoursRes.status).toBe(200);
    const peakHoursBody = (await peakHoursRes.json()) as {
      data: Array<{ hour: number; order_count: number; revenue: number }>;
    };
    // 2026-11-21T04:00:00Z is 11:00 ICT (UTC+7)
    const hour11 = peakHoursBody.data.find((h) => h.hour === 11);
    expect(hour11).toEqual({ hour: 11, order_count: 1, revenue: 60000 });
  });

  it('ERPNext invoice create/retry honors positive orders.discount when discount_amount is 0 and skips unpaid orders on retry', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', status TEXT, payment_status TEXT,
        items TEXT, total REAL, discount REAL DEFAULT 0, discount_amount REAL DEFAULT 0,
        customer_name TEXT, customer_phone TEXT, customer_id TEXT
      );
      CREATE TABLE erpnext_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, aura_order_id TEXT, local_type TEXT, local_id TEXT,
        erpnext_id TEXT, erpnext_model TEXT, erpnext_doctype TEXT, erpnext_name TEXT,
        sync_status TEXT, error_message TEXT, attempts INTEGER DEFAULT 0, retry_count INTEGER DEFAULT 0,
        last_synced_at TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT, synced_at TEXT
      );
      INSERT INTO orders (id, tenant_id, status, payment_status, items, total, discount, discount_amount, customer_name, customer_phone)
      VALUES
        ('ord-disc-1', 'default', 'completed', 'paid', '[{"name":"Cold Brew","quantity":1,"price":50000,"subtotal":50000}]', 40000, 10000, 0, 'Khach VIP', '0909998888'),
        ('ord-unpaid-retry', 'default', 'pending', 'cod_pending', '[{"name":"Latte","quantity":1,"price":45000,"subtotal":45000}]', 45000, 0, 0, 'Khach COD', '0901112222');
      INSERT INTO erpnext_mappings (id, aura_order_id, local_type, local_id, sync_status, attempts, retry_count, tenant_id)
      VALUES (1, 'ord-unpaid-retry', 'order', 'ord-unpaid-retry', 'failed', 1, 1, 'default');
    `);

    const erpPayloads: Array<Record<string, unknown>> = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/resource/Customer')) {
        return new Response(JSON.stringify({ data: [{ name: 'CUST-VIP', customer_name: 'Khach VIP' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/api/resource/Sales%20Invoice') || url.includes('/api/resource/Sales Invoice')) {
        if (init?.body) {
          erpPayloads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        }
        return new Response(JSON.stringify({ data: { name: 'SINV-DISC-001' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    }) as typeof fetch;

    try {
      const env = {
        AURA_DB: db,
        ERPNEXT_URL: 'https://erp.example.com',
        ERPNEXT_API_KEY: 'key',
        ERPNEXT_API_SECRET: 'secret',
      } as unknown as Parameters<typeof handleErpnextInvoicesRequest>[1];

      // 1. /retry skips ord-unpaid-retry because its payment_status is cod_pending
      const retryReq = new Request('http://localhost/api/erpnext-invoices/retry', { method: 'POST' });
      const retryRes = await handleErpnextInvoicesRequest(retryReq, env, 'default');
      expect(retryRes.status).toBe(200);
      expect(erpPayloads).toHaveLength(0);

      // 2. /create on ord-disc-1 succeeds and preserves total=40000 with discount=10000
      const createReq = new Request('http://localhost/api/erpnext-invoices/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'ord-disc-1' }),
      });
      const createRes = await handleErpnextInvoicesRequest(createReq, env, 'default');
      expect(createRes.status).toBe(201);
      expect(erpPayloads).toHaveLength(1);
      expect(erpPayloads[0]?.grand_total).toBe(40000);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('OpenAPI order read handlers resolve order_items and payments using canonical order.id when queried by order_number', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY, name TEXT, slug TEXT, tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE menu_items (
        id TEXT PRIMARY KEY, name TEXT, tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, order_number TEXT, tenant_id TEXT DEFAULT 'default',
        status TEXT, payment_status TEXT, payment_method TEXT, total REAL,
        customer_name TEXT, customer_phone TEXT, items TEXT DEFAULT '[]',
        created_at TEXT, updated_at TEXT
      );
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY, order_id TEXT, product_id TEXT, name TEXT,
        quantity INTEGER, unit_price REAL, price REAL, subtotal REAL,
        tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      INSERT INTO products (id, name, slug, tenant_id)
      VALUES ('prod-1', 'Americano', 'americano', 'default');
      INSERT INTO orders (id, order_number, tenant_id, status, payment_status, payment_method, total, customer_name, customer_phone, created_at)
      VALUES ('ORD_CANONICAL_1', 'AURA-2026-0099', 'default', 'preparing', 'paid', 'payos', 55000, 'Nguyen A', '0901234567', '2026-11-26T03:00:00Z');
      INSERT INTO order_items (id, order_id, product_id, name, quantity, unit_price, price, subtotal, tenant_id)
      VALUES ('item-1', 'ORD_CANONICAL_1', 'prod-1', 'Americano', 1, 55000, 55000, 55000, 'default');
      INSERT INTO payments (id, order_id, method, amount, status, tenant_id)
      VALUES ('pay-canon-1', 'ORD_CANONICAL_1', 'payos', 55000, 'completed', 'default');
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user?: { id: string; role: string; tenant_id: string }; tenantId?: string } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'staff-1', role: 'cashier', tenant_id: 'default' });
      c.set('tenantId', 'default');
      await next();
    });
    app.get('/orders/:id', (c) => handleGetOrderById(c as unknown as Parameters<typeof handleGetOrderById>[0]));
    app.get('/orders/:id/status', (c) => handleTrackOrder(c as unknown as Parameters<typeof handleTrackOrder>[0]));

    const getRes = await app.request('/orders/AURA-2026-0099', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as {
      data: { id: string; items: Array<{ menuItemId: string }>; payments: Array<{ id: string }> };
    };
    expect(getBody.data.id).toBe('ORD_CANONICAL_1');
    expect(getBody.data.items).toHaveLength(1);
    expect(getBody.data.items[0]?.menuItemId).toBe('prod-1');
    expect(getBody.data.payments).toHaveLength(1);
    expect(getBody.data.payments[0]?.id).toBe('pay-canon-1');

    const trackRes = await app.request('/orders/AURA-2026-0099/status', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
    expect(trackRes.status).toBe(200);
    const trackBody = (await trackRes.json()) as {
      data: { id: string; items: Array<{ name: string }> };
    };
    expect(trackBody.data.id).toBe('ORD_CANONICAL_1');
    expect(trackBody.data.items).toHaveLength(1);
  });

  it('DinDin confirm-payment rejects unverified PayOS orders with 409 and attributes cash/COD confirmation to cod_paid_at and open cashier shift', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', customer_name TEXT, status TEXT,
        payment_method TEXT, payment_status TEXT, total REAL, cod_paid_at TEXT, updated_at TEXT, created_at TEXT
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        transaction_id TEXT, payment_url TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE staff_shifts (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', staff_id TEXT, role TEXT,
        clock_in TEXT, clock_out TEXT, cash_sales REAL DEFAULT 0, total_sales REAL DEFAULT 0, order_count INTEGER DEFAULT 0
      );
      CREATE TABLE shift_reconciliations (id TEXT PRIMARY KEY, shift_id TEXT, tenant_id TEXT DEFAULT 'default');
      CREATE TABLE cash_payment_attributions (
        payment_id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', shift_id TEXT, collected_by TEXT, settled_at TEXT
      );
      INSERT INTO staff_shifts (id, tenant_id, staff_id, role, clock_in)
      VALUES ('shift-dindin-1', 'default', 'cashier-dindin', 'cashier', '2026-11-26T01:00:00Z');
      INSERT INTO orders (id, tenant_id, customer_name, status, payment_method, payment_status, total, created_at)
      VALUES
        ('DIN-PAYOS-UNPAID', 'default', 'DIN', 'pending', 'payos', 'pending', 75000, '2026-11-26T02:00:00Z'),
        ('DIN-CASH-UNPAID', 'default', 'DIN', 'preparing', 'cash', 'unpaid', 65000, '2026-11-26T02:05:00Z');
      INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, tenant_id, created_at)
      VALUES
        ('pay_din-payos-unpaid', 'DIN-PAYOS-UNPAID', 'payos', 75000, 'pending', '99111', 'https://pay.payos.vn/web/99111', 'default', '2026-11-26T02:00:00Z'),
        ('pay_din-cash-unpaid', 'DIN-CASH-UNPAID', 'cash', 65000, 'pending', NULL, NULL, 'default', '2026-11-26T02:05:00Z');
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user?: { id: string; role: string; tenant_id: string } } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'cashier-dindin', role: 'cashier', tenant_id: 'default' });
      await next();
    });
    registerCheckoutHandlers(app as unknown as Parameters<typeof registerCheckoutHandlers>[0]);
    const mockKv = { get: async () => null, put: async () => {}, delete: async () => {} };

    // 1. Unverified PayOS order with issued payment URL cannot be confirmed manually
    const payosConfirmRes = await app.request(
      '/checkout/DIN-PAYOS-UNPAID/confirm-payment',
      { method: 'POST' },
      { AURA_DB: db, AUTH_KV: mockKv } as unknown as Env
    );
    expect(payosConfirmRes.status).toBe(409);
    const payosOrdAfter = raw.prepare("SELECT payment_status FROM orders WHERE id = 'DIN-PAYOS-UNPAID'").get() as {
      payment_status: string;
    };
    expect(payosOrdAfter.payment_status).toBe('pending');

    // 2. Unpaid cash order passes QC -> status 'ready', then confirm-payment sets cod_paid_at and credits cashier shift
    const cashQcRes = await app.request(
      '/checkout/DIN-CASH-UNPAID/qc',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ qcPassed: true }) },
      { AURA_DB: db, AUTH_KV: mockKv } as unknown as Env
    );
    expect(cashQcRes.status).toBe(200);
    const cashOrdReady = raw.prepare("SELECT status FROM orders WHERE id = 'DIN-CASH-UNPAID'").get() as { status: string };
    expect(cashOrdReady.status).toBe('ready');

    const cashConfirmRes = await app.request(
      '/checkout/DIN-CASH-UNPAID/confirm-payment',
      { method: 'POST' },
      { AURA_DB: db, AUTH_KV: mockKv } as unknown as Env
    );
    expect(cashConfirmRes.status).toBe(200);
    const cashOrdPaid = raw.prepare("SELECT payment_status, cod_paid_at FROM orders WHERE id = 'DIN-CASH-UNPAID'").get() as {
      payment_status: string;
      cod_paid_at: string | null;
    };
    expect(cashOrdPaid.payment_status).toBe('paid');
    expect(Boolean(cashOrdPaid.cod_paid_at)).toBe(true);

    const shiftAfter = raw.prepare("SELECT cash_sales, total_sales, order_count FROM staff_shifts WHERE id = 'shift-dindin-1'").get() as {
      cash_sales: number;
      total_sales: number;
      order_count: number;
    };
    expect(shiftAfter).toEqual({ cash_sales: 65000, total_sales: 65000, order_count: 1 });
    const attrRow = raw.prepare("SELECT shift_id, collected_by FROM cash_payment_attributions WHERE payment_id = 'pay_din-cash-unpaid'").get() as {
      shift_id: string;
      collected_by: string;
    };
    expect(attrRow).toEqual({ shift_id: 'shift-dindin-1', collected_by: 'cashier-dindin' });
  });

  it('Table session close accepts partially_refunded orders and ignores historical sessionless or other-session unpaid orders, and splitOrders allocates parent discounts and cleans up rollback fields', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE cafe_tables (
        id TEXT PRIMARY KEY, number INTEGER, table_number INTEGER, name TEXT, status TEXT, current_order_id TEXT,
        is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE table_sessions (
        id TEXT PRIMARY KEY, table_id TEXT, status TEXT, opened_at TEXT, closed_at TEXT,
        order_count INTEGER DEFAULT 1, total_amount REAL DEFAULT 0, notes TEXT,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE menu_items (
        id TEXT PRIMARY KEY, name TEXT, price INTEGER, available INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, order_number TEXT, table_id TEXT, session_id TEXT,
        tenant_id TEXT DEFAULT 'default', status TEXT, payment_status TEXT, payment_method TEXT,
        items TEXT DEFAULT '[]', total REAL, discount REAL DEFAULT 0, discount_amount REAL DEFAULT 0,
        shipping_fee REAL DEFAULT 0, tip_amount REAL DEFAULT 0, customer_name TEXT, customer_phone TEXT,
        customer_email TEXT, customer_address TEXT, notes TEXT, delivery_time TEXT, order_type TEXT,
        customer_id TEXT, guest_token_hash TEXT, cancelled_at TEXT, previous_status TEXT,
        cancel_alert INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY, order_id TEXT, product_id TEXT, quantity INTEGER,
        subtotal REAL, modifiers TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      INSERT INTO cafe_tables (id, number, table_number, name, status, is_active, tenant_id)
      VALUES ('tbl-10', 10, 10, 'Table 10', 'occupied', 1, 'default');
      INSERT INTO table_sessions (id, table_id, status, opened_at, order_count, total_amount, tenant_id)
      VALUES ('sess-current', 'tbl-10', 'ordering', '2026-11-26T10:00:00Z', 1, 70000, 'default');
      INSERT INTO orders (id, table_id, session_id, tenant_id, status, payment_status, total, created_at)
      VALUES
        ('ord-old-session', 'tbl-10', 'sess-old', 'default', 'pending', 'unpaid', 50000, '2026-11-26T08:00:00Z'),
        ('ord-old-null-sess', 'tbl-10', NULL, 'default', 'pending', 'unpaid', 40000, '2026-11-26T09:00:00Z'),
        ('ord-curr-partial-ref', 'tbl-10', 'sess-current', 'default', 'completed', 'partially_refunded', 70000, '2026-11-26T10:05:00Z');
      INSERT INTO menu_items (id, name, price, available, is_active, tenant_id)
      VALUES ('prod-1', 'Cappuccino', 50000, 1, 1, 'default');
      INSERT INTO orders (id, table_id, session_id, tenant_id, status, payment_status, payment_method, total, discount, discount_amount, customer_name, customer_phone, created_at)
      VALUES ('ord-parent-disc', 'tbl-10', 'sess-current', 'default', 'confirmed', 'unpaid', 'cod', 80000, 20000, 0, 'Parent Guest', '0901112222', '2026-11-26T10:10:00Z');
    `);

    const sessionApp = new Hono<{ Bindings: Env; Variables: { user?: { id: string; role: string; tenant_id: string }; tenantId?: string } }>();
    sessionApp.use('*', async (c, next) => {
      c.set('user', { id: 'waiter-1', role: 'waiter', tenant_id: 'default' });
      c.set('tenantId', 'default');
      await next();
    });
    registerSessionHandlers(sessionApp as unknown as Parameters<typeof registerSessionHandlers>[0]);

    // Waiter can close sess-current once ord-parent-disc is split, even though ord-curr-partial-ref is partially_refunded and old session orders are unpaid
    const splitRes = await splitOrders(
      new Request('http://localhost/api/orders/split', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          parent_order_id: 'ord-parent-disc',
          table_id: 'tbl-10',
          orders: [
            {
              customer_name: 'Child 1',
              customer_phone: '0901112223',
              payment_method: 'cod',
              items: [{ id: 'prod-1', name: 'Cappuccino', quantity: 1, price: 50000 }],
              discount: 10000,
              total: 40000,
            },
            {
              customer_name: 'Child 2',
              customer_phone: '0901112224',
              payment_method: 'cod',
              items: [{ id: 'prod-1', name: 'Cappuccino', quantity: 1, price: 50000 }],
              discount: 10000,
              total: 40000,
            },
          ],
        }),
      }),
      { AURA_DB: db },
      undefined,
      { id: 'waiter-1', role: 'waiter', tenantId: 'default' }
    );
    expect(splitRes.status).toBe(201);
    const splitBody = (await splitRes.json()) as { orders: Array<{ id: string; total: number }> };
    expect(splitBody.orders).toHaveLength(2);
    expect(splitBody.orders.map((o) => o.total)).toEqual([40000, 40000]);

    const childRows = raw
      .prepare("SELECT total, discount, payment_status FROM orders WHERE id IN (?, ?) ORDER BY id")
      .all(splitBody.orders[0]!.id, splitBody.orders[1]!.id) as Array<{ total: number; discount: number; payment_status: string }>;
    expect(childRows).toEqual([
      { total: 40000, discount: 10000, payment_status: 'unpaid' },
      { total: 40000, discount: 10000, payment_status: 'unpaid' },
    ]);

    // Mark the 2 split children as paid, leaving only ord-curr-partial-ref (partially_refunded) in sess-current
    raw.prepare("UPDATE orders SET payment_status = 'paid' WHERE id IN (?, ?)").run(
      splitBody.orders[0]!.id,
      splitBody.orders[1]!.id
    );

    const closeRes = await sessionApp.request(
      '/sess-current/close',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) },
      { AURA_DB: db } as unknown as Env
    );
    expect(closeRes.status).toBe(200);

    // Rollback cleanup when child batch fails mid-split clears cancelled_at, cancel_alert, and previous_status
    raw.exec(`
      INSERT INTO orders (id, table_id, session_id, tenant_id, status, payment_status, payment_method, total, discount, discount_amount, customer_name, customer_phone, created_at)
      VALUES ('ord-parent-fail', 'tbl-10', 'sess-current', 'default', 'confirmed', 'unpaid', 'cod', 100000, 0, 0, 'Fail Guest', '0901112299', '2026-11-26T10:15:00Z');
    `);
    const failingBatchDb = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'batch') {
          return async () => {
            throw new Error('simulated batch failure');
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const failedSplitRes = await splitOrders(
      new Request('http://localhost/api/orders/split', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          parent_order_id: 'ord-parent-fail',
          table_id: 'tbl-10',
          orders: [
            {
              customer_name: 'Child A',
              customer_phone: '0901112298',
              payment_method: 'cod',
              items: [{ id: 'prod-1', name: 'Cappuccino', quantity: 1, price: 50000 }],
              total: 50000,
            },
            {
              customer_name: 'Child B',
              customer_phone: '0901112297',
              payment_method: 'cod',
              items: [{ id: 'prod-1', name: 'Cappuccino', quantity: 1, price: 50000 }],
              total: 50000,
            },
          ],
        }),
      }),
      { AURA_DB: failingBatchDb },
      undefined,
      { id: 'waiter-1', role: 'waiter', tenantId: 'default' }
    );
    expect(failedSplitRes.status).toBe(500);
    const parentAfterRollback = raw
      .prepare("SELECT status, cancelled_at, cancel_alert, previous_status FROM orders WHERE id = 'ord-parent-fail'")
      .get() as { status: string; cancelled_at: string | null; cancel_alert: number; previous_status: string | null };
    expect(parentAfterRollback).toEqual({
      status: 'confirmed',
      cancelled_at: null,
      cancel_alert: 0,
      previous_status: null,
    });
  });

  it('KDS transition and updateOrder guard ERPNext e-invoices on paid status, exclude cod_pending visits, and settlePayOS/compensateVoidedOrder enforce shift custody invariants', async () => {
    const { db, raw } = createSqliteD1();
    raw.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY, phone TEXT, total_visits INTEGER DEFAULT 0,
        last_visit_at TEXT, tenant_id TEXT DEFAULT 'default', updated_at TEXT
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, order_number TEXT, tenant_id TEXT DEFAULT 'default', status TEXT,
        payment_status TEXT, payment_method TEXT, order_type TEXT DEFAULT 'dine_in',
        items TEXT DEFAULT '[]', total REAL, shipping_fee REAL DEFAULT 0,
        discount REAL DEFAULT 0, discount_amount REAL DEFAULT 0,
        customer_id TEXT, customer_name TEXT, customer_phone TEXT, customer_email TEXT,
        customer_address TEXT, notes TEXT,
        table_id TEXT, session_id TEXT, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        transaction_id TEXT, provider_reference TEXT, refund_amount REAL DEFAULT 0,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE staff_shifts (
        id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', staff_id TEXT, role TEXT,
        clock_in TEXT, clock_out TEXT, cash_sales REAL DEFAULT 0, online_sales REAL DEFAULT 0,
        total_sales REAL DEFAULT 0, order_count INTEGER DEFAULT 0
      );
      CREATE TABLE shift_reconciliations (id TEXT PRIMARY KEY, shift_id TEXT, tenant_id TEXT DEFAULT 'default');
      CREATE TABLE cash_payment_attributions (
        payment_id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', shift_id TEXT, collected_by TEXT, settled_at TEXT
      );
      CREATE TABLE cash_payouts (
        id TEXT PRIMARY KEY, shift_id TEXT, tenant_id TEXT DEFAULT 'default', amount REAL,
        reason TEXT, category TEXT, approved_by TEXT, created_by TEXT, status TEXT, created_at TEXT
      );
      CREATE TABLE erpnext_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, aura_order_id TEXT, local_type TEXT, local_id TEXT,
        erpnext_id TEXT, erpnext_model TEXT, erpnext_doctype TEXT, erpnext_name TEXT, sync_status TEXT,
        error_message TEXT, attempts INTEGER DEFAULT 0, retry_count INTEGER DEFAULT 0,
        last_synced_at TEXT, tenant_id TEXT DEFAULT 'default',
        created_at TEXT, updated_at TEXT, synced_at TEXT
      );
      INSERT INTO customers (id, phone, total_visits, tenant_id)
      VALUES ('cust-kds-1', '0907776666', 0, 'default');
      INSERT INTO staff_shifts (id, tenant_id, staff_id, role, clock_in, clock_out)
      VALUES
        ('shift-barista', 'default', 'bar-1', 'barista', '2026-11-26T02:00:00Z', NULL),
        ('shift-cash-closed', 'default', 'cash-1', 'cashier', '2026-11-25T01:00:00Z', '2026-11-25T09:00:00Z');
      INSERT INTO orders (id, order_number, tenant_id, status, payment_status, payment_method, order_type, items, total, discount, discount_amount, customer_id, customer_name, customer_phone, created_at)
      VALUES
        ('ord-kds-cod', 'ORD-KDS-1', 'default', 'ready', 'cod_pending', 'cod', 'dine_in', '[{"name":"Latte","quantity":1,"price":50000,"subtotal":50000}]', 50000, 0, 0, 'cust-kds-1', 'COD Guest', '0907776666', '2026-11-26T02:10:00Z'),
        ('ord-upd-paid', 'ORD-UPD-1', 'default', 'served', 'paid', 'cash', 'dine_in', '[{"name":"Latte","quantity":1,"price":50000,"subtotal":50000}]', 42000, 8000, 0, 'cust-kds-1', 'Paid Guest', '0907776666', '2026-11-26T02:11:00Z'),
        ('ord-payos-direct', 'ORD-PAYOS-D', 'default', 'pending', 'pending', 'payos', 'dine_in', '[]', 85000, 0, 0, NULL, 'PayOS Guest', '0907776665', '2026-11-26T02:12:00Z'),
        ('ord-void-cash', 'ORD-VOID-C', 'default', 'confirmed', 'paid', 'cash', 'dine_in', '[]', 60000, 0, 0, NULL, 'Void Cash', '0907776664', '2026-11-26T02:13:00Z');
      INSERT INTO payments (id, order_id, method, amount, status, transaction_id, tenant_id, created_at)
      VALUES
        ('pay-direct-1', 'ord-payos-direct', 'payos', 85000, 'pending', '77001', 'default', '2026-11-26T02:12:00Z'),
        ('pay-void-cash', 'ord-void-cash', 'cash', 60000, 'completed', NULL, 'default', '2026-11-26T02:13:00Z');
      INSERT INTO cash_payment_attributions (payment_id, tenant_id, shift_id, collected_by, settled_at)
      VALUES ('pay-void-cash', 'default', 'shift-cash-closed', 'cash-1', '2026-11-25T02:00:00Z');
    `);

    const erpInvoices: Array<Record<string, unknown>> = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/resource/Customer')) {
        return new Response(JSON.stringify({ data: [{ name: 'CUST-PAID', customer_name: 'Paid Guest' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/api/resource/Sales%20Invoice') || url.includes('/api/resource/Sales Invoice')) {
        if (init?.body) erpInvoices.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response(JSON.stringify({ data: { name: 'SINV-UPD-001' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    }) as typeof fetch;

    try {
      const kvStore = new Map<string, string>([
        ['erpnext:api_url', 'https://erp.example.com'],
        ['erpnext:api_key', 'key'],
        ['erpnext:api_secret', 'secret'],
      ]);
      const authKv = {
        get: async (key: string) => kvStore.get(key) ?? null,
        put: async (key: string, val: string) => {
          kvStore.set(key, val);
        },
        delete: async (key: string) => {
          kvStore.delete(key);
        },
      };
      const updPendingTasks: Promise<unknown>[] = [];
      const env = {
        AURA_DB: db,
        AUTH_KV: authKv,
        ERPNEXT_URL: 'https://erp.example.com',
        ERPNEXT_API_KEY: 'key',
        ERPNEXT_API_SECRET: 'secret',
        ERPNEXT_SYNC_ENABLED: 'true',
        executionCtx: {
          waitUntil: (p: Promise<unknown>) => {
            updPendingTasks.push(p);
          },
        },
      };

      // 1. KDS transition of cod_pending order to served must NOT increment visits and must NOT issue an ERPNext invoice
      const kdsPendingTasks: Promise<unknown>[] = [];
      const kdsRes = await executeKdsStatusTransition(db, 'ord-kds-cod', 'served', 'owner', {
        tenantId: 'default',
        env,
        waitUntil: (p) => {
          kdsPendingTasks.push(p);
        },
      });
      await Promise.allSettled(kdsPendingTasks);
      expect(kdsRes.success).toBe(true);
      const custAfterCod = raw.prepare("SELECT total_visits FROM customers WHERE id = 'cust-kds-1'").get() as { total_visits: number };
      expect(custAfterCod.total_visits).toBe(0);
      expect(erpInvoices).toHaveLength(0);

      // 2. updateOrder completing a paid discounted order forwards total=42000 and discount=8000 to ERPNext
      const updRes = await updateOrder(
        new Request('http://localhost/api/orders/ord-upd-paid', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        }),
        env,
        'ord-upd-paid',
        'owner',
        'default',
        'owner-1'
      );
      await Promise.allSettled(updPendingTasks);
      expect(updRes.status).toBe(200);
      expect(erpInvoices).toHaveLength(1);
      expect(erpInvoices[0]?.total).toBe(50000);
      expect(erpInvoices[0]?.grand_total).toBe(42000);

      // 3. settlePayOS ignores open barista shift (only kitchen role open) and is idempotent on replay
      const s1 = await settlePayOS(
        db,
        { id: 'pay-direct-1', order_id: 'ord-payos-direct', status: 'pending', amount: 85000, method: 'payos' },
        true,
        'completed',
        '2026-11-26T02:14:00Z',
        'REF-77001'
      );
      expect(s1).toEqual({ paymentChanged: true, orderChanged: true });
      const s2 = await settlePayOS(
        db,
        { id: 'pay-direct-1', order_id: 'ord-payos-direct', status: 'completed', amount: 85000, method: 'payos' },
        true,
        'completed',
        '2026-11-26T02:15:00Z',
        'REF-77001'
      );
      expect(s2).toEqual({ paymentChanged: false, orderChanged: false });
      const baristaAfter = raw.prepare("SELECT online_sales FROM staff_shifts WHERE id = 'shift-barista'").get() as {
        online_sales: number;
      };
      expect(baristaAfter.online_sales).toBe(0);

      // 4. adjustShiftCustodyForCashRefund & compensateVoidedOrder do not insert cash_payouts against a closed shift
      await adjustShiftCustodyForCashRefund(db, 'pay-void-cash', 60000, 'default', 'owner-1', 'Closed shift guard test');
      await compensateVoidedOrder({
        db,
        env,
        orderId: 'ord-void-cash',
        tenantId: 'default',
        actorId: 'owner-1',
        reason: 'Void test',
        skipInventoryRestore: true,
        skipTableRelease: true,
      });
      const payoutsAfterClosed = raw.prepare('SELECT COUNT(*) as cnt FROM cash_payouts').get() as { cnt: number };
      expect(payoutsAfterClosed.cnt).toBe(0);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
