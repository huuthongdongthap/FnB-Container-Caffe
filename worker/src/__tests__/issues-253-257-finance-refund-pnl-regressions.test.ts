// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { handleErpnextInvoicesRequest } from '../routes/erpnext-invoices';
import { registerPnlHandlers } from '../routes/reports-handlers/pnl-handlers';
import { handleRefund } from '../routes/refunds-handlers/mutation-handlers';
import { registerCheckoutHandlers } from '../routes/dindin-handlers/checkout-handlers';
import { collectCodPayment } from '../../../packages/domain/kitchen/commands/collect-cod-payment';
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
});
