// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { clockIn, clockOut } from '../../../packages/domain/shift/commands/attendance';
import { deriveShiftSlot, shiftDto } from '../../../packages/domain/shift/model/shift-types';
import { reconcileShiftCash, assignCashPaymentsToShift, getReconciliationForShift } from '../../../packages/domain/shift/src/policies/cash-reconciliation-policy';
import { reconciliationRoutes } from '../../../packages/domain/shift/src/routes/reconciliation';
import { registerReconciliationHandlers } from '../routes/reports-handlers/reconciliation-handlers';
import { Hono } from 'hono';
import { settlePayOS } from '../routes/webhooks-handlers/payos-settlement';
import { canTransition, ORDER_STATUSES } from '../../../packages/domain/order/model/order-state-machine';
import { canActorTransition } from '../../../packages/domain/order/policies/transition-authorization';
import { transitionOrderStatus } from '../../../packages/domain/order/policies/order-status-transition';
import { executeKdsStatusTransition } from '../../../packages/domain/kitchen/commands/kds-status-transition';
import { createOrderSchema, updateOrderStatusSchema } from '../lib/validators/order';
import type { ShiftScope } from '../../../packages/domain/shift/commands/shift-access';
import type { Env } from '../types/env';

function createSqliteD1() {
  const sqlite = new DatabaseSync(':memory:');
  function prepare(sql: string) {
    let values: SQLInputValue[] = [];
    const statement = {
      bind(...args: SQLInputValue[]) {
        values = args;
        return statement;
      },
      async first<T = Record<string, unknown>>() {
        return (sqlite.prepare(sql).get(...values) as T | undefined) ?? null;
      },
      async all<T = Record<string, unknown>>() {
        return { results: sqlite.prepare(sql).all(...values) as T[], success: true };
      },
      async run() {
        const result = sqlite.prepare(sql).run(...values);
        return {
          success: true,
          meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) },
        };
      },
    };
    return statement;
  }
  const db = {
    prepare,
    async batch(ops: Array<ReturnType<typeof prepare>>) {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const op of ops) out.push(await op.run());
        sqlite.exec('COMMIT');
        return out;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  } as unknown as D1Database;
  return {
    db,
    exec: (sql: string) => sqlite.exec(sql),
    close: () => sqlite.close(),
  };
}

describe('PR-4: Shifts, Cash Reconciliation, Counter Cash & Delivery State Machine', () => {
  let d1: ReturnType<typeof createSqliteD1>;

  afterEach(() => {
    d1?.close();
  });

  beforeEach(() => {
    d1 = createSqliteD1();
    d1.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL,
        tenant_id TEXT DEFAULT 'default',
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1
      );
      CREATE TABLE staff_shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT DEFAULT 'default',
        staff_id TEXT NOT NULL,
        staff_name TEXT NOT NULL,
        role TEXT NOT NULL,
        date TEXT NOT NULL,
        shift TEXT NOT NULL,
        clock_in TEXT,
        clock_out TEXT,
        hours_worked REAL,
        attendance_state TEXT DEFAULT 'active',
        status TEXT DEFAULT 'open',
        start_time TEXT,
        end_time TEXT,
        opening_cash REAL DEFAULT 0,
        online_sales REAL DEFAULT 0,
        cash_sales REAL DEFAULT 0,
        total_sales REAL DEFAULT 0,
        order_count INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT DEFAULT 'default',
        payment_method TEXT DEFAULT 'payos',
        payment_status TEXT DEFAULT 'unpaid',
        status TEXT DEFAULT 'pending',
        updated_at TEXT
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        tenant_id TEXT DEFAULT 'default',
        method TEXT NOT NULL,
        status TEXT NOT NULL,
        amount REAL NOT NULL,
        provider_reference TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
      CREATE TABLE cash_payment_attributions (
        payment_id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL,
        tenant_id TEXT DEFAULT 'default',
        collected_by TEXT,
        settled_at TEXT
      );
      CREATE TABLE cash_payouts (
        id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL,
        tenant_id TEXT DEFAULT 'default',
        amount REAL NOT NULL,
        status TEXT DEFAULT 'completed'
      );
      CREATE TABLE shift_reconciliations (
        id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL,
        staff_id TEXT NOT NULL,
        opening_float REAL NOT NULL,
        expected_cash REAL NOT NULL,
        actual_cash REAL NOT NULL,
        variance REAL NOT NULL,
        variance_status TEXT NOT NULL,
        denominations TEXT NOT NULL,
        cash_payment_total REAL DEFAULT 0,
        cash_payout_total REAL DEFAULT 0,
        notes TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT NOT NULL,
        reconciled_by TEXT,
        opening_cash REAL,
        variance_amount REAL,
        status TEXT,
        cash_sales REAL
      );
      INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES
        ('mgr-1', 'Manager One', 'manager', 'default', 1, 1),
        ('cashier-1', 'Cashier One', 'cashier', 'default', 1, 1),
        ('barista-1', 'Barista One', 'barista', 'default', 1, 1),
        ('inactive-1', 'Inactive Staff', 'cashier', 'default', 0, 1);
    `);
  });

  function makeScope(actorId: string, role: string, canManage: boolean): ShiftScope {
    return {
      env: { AURA_DB: d1.db } as unknown as Env,
      tenantId: 'default',
      actor: { id: actorId, name: actorId, phone: null, role, tenant_id: 'default', is_active: 1, auth_version: 1 },
      canManage,
    };
  }

  it('#162 & #167: clockIn records shift slot and clockOut updates status to closed', async () => {
    const scope = makeScope('cashier-1', 'cashier', false);
    const opened = await clockIn(scope, 'cashier-1', 'Opening shift', undefined, 500_000);
    expect(['morning', 'afternoon', 'night']).toContain(opened.shift);
    const dto = shiftDto(opened);
    expect(dto.shift_name).toMatch(/^Ca (sáng|chiều|đêm)/);

    const closed = await clockOut(scope, 'cashier-1', String(opened.id), 'Closing shift');
    expect(closed.clock_out).toBeTruthy();
    const raw = await d1.db.prepare('SELECT status, attendance_state FROM staff_shifts WHERE id = ?').bind(opened.id).first<{ status: string; attendance_state: string }>();
    expect(raw?.status).toBe('closed');
    expect(raw?.attendance_state).toBe('completed');
  });

  it('#167: deriveShiftSlot uses Asia/Ho_Chi_Minh timezone consistently', () => {
    // 04:19 UTC = 11:19 Asia/Ho_Chi_Minh -> Ca sáng (06:00-14:00)
    expect(deriveShiftSlot('2026-11-24 04:19:00').code).toBe('morning');
    // 08:00 UTC = 15:00 Asia/Ho_Chi_Minh -> Ca chiều (14:00-22:00)
    expect(deriveShiftSlot('2026-11-24T08:00:00.000Z').code).toBe('afternoon');
    // 16:00 UTC = 23:00 Asia/Ho_Chi_Minh -> Ca đêm (22:00-06:00)
    expect(deriveShiftSlot('2026-11-24T16:00:00.000Z').code).toBe('night');
  });

  it('#168: reconciling a shift with an explicitly assigned out-of-window cash payment succeeds without 409', async () => {
    const scope = makeScope('cashier-1', 'cashier', false);
    const opened = await clockIn(scope, 'cashier-1', undefined, undefined, 100_000);
    // Payment settled 1 hour before shift clock_in, explicitly assigned to this shift
    const beforeClockIn = new Date(new Date(opened.clock_in!).getTime() - 3_600_000).toISOString();
    d1.exec(`
      INSERT INTO payments (id, order_id, tenant_id, method, status, amount, created_at, updated_at)
      VALUES ('pay-early-1', 'ord-early-1', 'default', 'cod', 'completed', 50000, '${beforeClockIn}', '${beforeClockIn}');
    `);
    await assignCashPaymentsToShift(d1.db, String(opened.id), ['pay-early-1'], 'mgr-1', 'default', 'manager');

    const recon = await reconcileShiftCash(
      d1.db,
      {
        shift_id: String(opened.id),
        opening_float: 100_000,
        denominations: { denominations: [{ denomination: 50_000, count: 3 }] },
        remitted_cash: 50_000,
      },
      'cashier-1',
      'default',
      'cashier',
    );
    expect(recon.cash_payment_total).toBe(50_000);
    expect(recon.expected_cash).toBe(150_000);
    expect(recon.actual_cash).toBe(150_000);
    expect(recon.variance).toBe(0);
    expect(recon.remitted_cash).toBe(50_000);
    expect(recon.closing_float).toBe(100_000);

    const reloaded = await getReconciliationForShift(d1.db, String(opened.id), 'default', { id: 'cashier-1', role: 'cashier' });
    expect(reloaded?.remitted_cash).toBe(50_000);
    expect(reloaded?.closing_float).toBe(100_000);
  });

  it('#175: HTTP POST /reconcile and GET /reconciliation round-trip remitted_cash, closing_float, and handover_to_staff_id', async () => {
    const scope = makeScope('cashier-1', 'cashier', false);
    const opened = await clockIn(scope, 'cashier-1', undefined, undefined, 200_000);

    const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'cashier-1', sub: 'cashier-1', role: 'cashier', tenantId: 'default' });
      c.set('tenantId', 'default');
      await next();
    });
    reconciliationRoutes(app);

    const env = { AURA_DB: d1.db, CASH_RECONCILIATION_ENABLED: 'true' } as unknown as Env;
    const postRes = await app.request(
      `/api/shifts/${opened.id}/reconcile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_float: 200_000,
          denominations: { denominations: [{ denomination: 100_000, count: 2 }] },
          remitted_cash: 50_000,
          closing_float: 150_000,
          handover_to_staff_id: 'mgr-1',
        }),
      },
      env,
    );
    expect(postRes.status).toBe(201);
    const postJson = (await postRes.json()) as { success: boolean; data: Record<string, unknown> };
    expect(postJson.success).toBe(true);
    expect(postJson.data.remitted_cash).toBe(50_000);
    expect(postJson.data.closing_float).toBe(150_000);
    expect(postJson.data.handover_to_staff_id).toBe('mgr-1');

    const getRes = await app.request(`/api/shifts/${opened.id}/reconciliation`, { method: 'GET' }, env);
    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as { success: boolean; data: Record<string, unknown> };
    expect(getJson.success).toBe(true);
    expect(getJson.data.remitted_cash).toBe(50_000);
    expect(getJson.data.closing_float).toBe(150_000);
    expect(getJson.data.handover_to_staff_id).toBe('mgr-1');
  });

  it('#169: manager can clock out an open shift belonging to a deactivated staff member', async () => {
    d1.exec(`
      INSERT INTO staff_shifts (id, tenant_id, staff_id, staff_name, role, date, shift, clock_in, attendance_state, status, opening_cash)
      VALUES (99, 'default', 'inactive-1', 'Inactive Staff', 'cashier', '2026-11-24', 'morning', '2026-11-24T01:00:00.000Z', 'active', 'open', 0);
    `);
    const mgrScope = makeScope('mgr-1', 'manager', true);
    const closed = await clockOut(mgrScope, 'inactive-1', '99', 'Manager closed deactivated staff shift');
    expect(closed.clock_out).toBeTruthy();
    expect(closed.attendance_state).toBe('completed');
  });

  it('#175: cashier + barista clocked in concurrently does not cause 409 ambiguous cash responsibility, and PayOS syncs online_sales', async () => {
    const cashierScope = makeScope('cashier-1', 'cashier', false);
    const baristaScope = makeScope('barista-1', 'barista', false);
    const cashierShift = await clockIn(cashierScope, 'cashier-1', undefined, undefined, 200_000);
    await clockIn(baristaScope, 'barista-1', undefined, undefined, 0);

    const now = new Date().toISOString();
    d1.exec(`
      INSERT INTO orders (id, tenant_id, payment_method, payment_status, status)
      VALUES ('ord-payos-1', 'default', 'payos', 'unpaid', 'pending');
      INSERT INTO payments (id, order_id, tenant_id, method, status, amount, created_at, updated_at)
      VALUES
        ('pay-cash-1', 'ord-cash-1', 'default', 'cash', 'completed', 45000, '${now}', '${now}'),
        ('pay-payos-1', 'ord-payos-1', 'default', 'payos', 'pending', 85000, '${now}', '${now}');
    `);

    await settlePayOS(
      d1.db,
      { id: 'pay-payos-1', order_id: 'ord-payos-1', status: 'pending', amount: 85000, method: 'payos' },
      true,
      'completed',
      now,
      'ref-123',
    );
    const shiftAfterPayos = await d1.db.prepare('SELECT online_sales FROM staff_shifts WHERE id = ?').bind(cashierShift.id).first<{ online_sales: number }>();
    expect(shiftAfterPayos?.online_sales).toBe(85000);

    const recon = await reconcileShiftCash(
      d1.db,
      {
        shift_id: String(cashierShift.id),
        opening_float: 200_000,
        denominations: { denominations: [{ denomination: 200_000, count: 1 }, { denomination: 45_000, count: 1 }] },
      },
      'cashier-1',
      'default',
      'cashier',
    );
    expect(recon.cash_payment_total).toBe(45_000);
    expect(recon.online_sales_total).toBe(85_000);
  });

  it('#176 & #177: delivery COD validator, delivering state machine, and rider authorization', () => {
    expect(ORDER_STATUSES).toContain('delivering');
    expect(canTransition('ready', 'delivering').ok).toBe(true);
    expect(canTransition('delivering', 'delivered').ok).toBe(true);
    expect(canTransition('delivering', 'failed').ok).toBe(true);
    expect(canTransition('delivering', 'cancelled').ok).toBe(true);

    expect(canActorTransition('rider', 'ready', 'delivering').ok).toBe(true);
    expect(canActorTransition('rider', 'delivering', 'delivered').ok).toBe(true);
    expect(canActorTransition('rider', 'delivering', 'failed').ok).toBe(true);
    expect(canActorTransition('staff', 'ready', 'delivering').ok).toBe(true);

    const statusParsed = updateOrderStatusSchema.safeParse({
      status: 'delivering',
      assigned_shipper_id: 'shipper-1',
      shipper_name: 'Nguyen Van Shipper',
    });
    expect(statusParsed.success).toBe(true);

    const deliveryCodParsed = createOrderSchema.safeParse({
      items: [{ name: 'Latte', quantity: 1, price: 45000 }],
      total: 60000,
      customer_name: 'Khach Giao Hang',
      customer_phone: '0901234567',
      customer_address: '123 Nguyen Hue, Q1',
      payment_method: 'cod',
      order_type: 'delivery',
      pay_now: false,
    });
    expect(deliveryCodParsed.success).toBe(true);
  });

  it('rejects invalid remitted_cash + closing_float !== actual_cash with 400', async () => {
    const scope = makeScope('cashier-1', 'cashier', false);
    const shift = await clockIn(scope, 'cashier-1', undefined, undefined, 200_000);

    await expect(
      reconcileShiftCash(
        d1.db,
        {
          shift_id: String(shift.id),
          opening_float: 200_000,
          denominations: { denominations: [{ denomination: 200_000, count: 1 }] },
          remitted_cash: 100_000,
          closing_float: 150_000,
        },
        'cashier-1',
        'default',
        'cashier',
      ),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      reconcileShiftCash(
        d1.db,
        {
          shift_id: String(shift.id),
          opening_float: 200_000,
          denominations: { denominations: [{ denomination: 200_000, count: 1 }] },
          closing_float: 250_000,
        },
        'cashier-1',
        'default',
        'cashier',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('reconciliation report distinguishes denominated vs undenominated shifts with metadata', async () => {
    d1.exec(`
      ALTER TABLE orders ADD COLUMN total REAL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE orders ADD COLUMN items TEXT DEFAULT '[]';
      ALTER TABLE orders ADD COLUMN customer_name TEXT DEFAULT '';
      ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT '';
    `);

    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const createdAt = `${today}T05:00:00.000Z`;

    d1.exec(`
      INSERT INTO shift_reconciliations (
        id, tenant_id, shift_id, staff_id, opening_float, expected_cash, actual_cash,
        variance, variance_status, denominations, cash_payment_total, cash_payout_total, created_at
      ) VALUES
      (
        'recon-undenom', 'default', 'shift-1', 'cashier-1', 200000, 200000, 200000,
        0, 'balanced',
        '{"denominations":[],"remitted_cash":100000,"closing_float":100000}',
        0, 0, '${createdAt}'
      ),
      (
        'recon-denom', 'default', 'shift-2', 'cashier-1', 200000, 200000, 200000,
        0, 'balanced',
        '{"denominations":[{"denomination":200000,"count":1}],"remitted_cash":100000,"closing_float":100000}',
        0, 0, '${createdAt}'
      );
    `);

    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('tenantId' as never, 'default' as never);
      c.set('user' as never, { id: 'admin-1', role: 'admin', tenantId: 'default' } as never);
      await next();
    });
    registerReconciliationHandlers(app);

    const res = await app.request(
      `/reconciliation?from=${today}&to=${today}`,
      { method: 'GET' },
      { AURA_DB: d1.db, CASH_RECONCILIATION_ENABLED: 'true', JWT_SECRET: 'test-secret' } as unknown as Env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { shifts: Array<{ shift_id: string; denominated: boolean }> };
    };
    expect(body.success).toBe(true);
    const undenom = body.data.shifts.find((s) => s.shift_id === 'shift-1');
    const denom = body.data.shifts.find((s) => s.shift_id === 'shift-2');
    expect(undenom?.denominated).toBe(false);
    expect(denom?.denominated).toBe(true);
  });

  it('guards void transitions (failed/expired) on paid orders and persists delivery metadata when schema supports it', async () => {
    d1.exec(`
      ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in';
      ALTER TABLE orders ADD COLUMN assigned_shipper_id TEXT;
      ALTER TABLE orders ADD COLUMN shipper_name TEXT;
      ALTER TABLE orders ADD COLUMN failure_reason TEXT;
      INSERT OR REPLACE INTO users (id, name, role, tenant_id, is_active)
      VALUES ('shipper-1', 'Nguyen Van Shipper', 'rider', 'default', 1);
      INSERT INTO orders (id, tenant_id, order_type, payment_method, payment_status, status)
      VALUES
        ('ord-paid-deliv', 'default', 'delivery', 'payos', 'paid', 'delivering'),
        ('ord-paid-pending', 'default', 'delivery', 'payos', 'paid', 'pending'),
        ('ord-cod-deliv', 'default', 'delivery', 'cod', 'unpaid', 'ready');
    `);

    const blockedFail = await transitionOrderStatus(d1.db, 'ord-paid-deliv', 'failed', 'shipper', { tenantId: 'default' });
    expect(blockedFail.success).toBe(false);
    expect(blockedFail.statusCode).toBe(400);

    const blockedExpire = await transitionOrderStatus(d1.db, 'ord-paid-pending', 'expired', 'manager', { tenantId: 'default' });
    expect(blockedExpire.success).toBe(false);
    expect(blockedExpire.statusCode).toBe(409);

    const dispatch = await executeKdsStatusTransition(d1.db, 'ord-cod-deliv', 'delivering', 'rider', {
      tenantId: 'default',
      actorId: 'shipper-1',
      fields: { assigned_shipper_id: 'shipper-1', shipper_name: 'Nguyen Van Shipper' },
    });
    expect(dispatch.success).toBe(true);

    const failUnpaid = await executeKdsStatusTransition(d1.db, 'ord-cod-deliv', 'failed', 'rider', {
      tenantId: 'default',
      actorId: 'shipper-1',
      fields: { failure_reason: 'Customer unreachable' },
    });
    expect(failUnpaid.success).toBe(true);

    const stored = await d1.db
      .prepare('SELECT status, assigned_shipper_id, shipper_name, failure_reason FROM orders WHERE id = ?')
      .bind('ord-cod-deliv')
      .first<{ status: string; assigned_shipper_id: string | null; shipper_name: string | null; failure_reason: string | null }>();
    expect(stored).toEqual({
      status: 'failed',
      assigned_shipper_id: 'shipper-1',
      shipper_name: 'Nguyen Van Shipper',
      failure_reason: 'Customer unreachable',
    });
  });

  it('prevents non-manager clock-out attendanceId probing and returns 404 for unknown manager target', async () => {
    const cashierScope = makeScope('cashier-1', 'cashier', false);
    const baristaScope = makeScope('barista-1', 'barista', false);
    const mgrScope = makeScope('mgr-1', 'manager', true);

    const cashierShift = await clockIn(cashierScope, 'cashier-1', undefined, undefined, 100_000);

    await expect(clockOut(baristaScope, undefined, String(cashierShift.id))).rejects.toMatchObject({
      status: 404,
    });

    await expect(clockOut(mgrScope, 'missing-staff-id')).rejects.toMatchObject({
      status: 404,
      message: 'Staff not found',
    });
  });

  it('excludes scheduled/cancelled shifts from cash ambiguity, returns structured ambiguous_payment_ids, bounds online_sales by clock_out, and validates handover recipient', async () => {
    d1.exec(`
      INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES
        ('cashier-2', 'Cashier Two', 'cashier', 'default', 1, 1),
        ('other-store-mgr', 'Other Store Mgr', 'manager', 'store-b', 1, 1);
    `);

    const cashier1Scope = makeScope('cashier-1', 'cashier', false);
    const shift1 = await clockIn(cashier1Scope, 'cashier-1', undefined, undefined, 100_000);
    const nowMs = Date.now();
    const clockInTime = new Date(nowMs - 10_000).toISOString();
    const duringShift = new Date(nowMs - 8_000).toISOString();
    d1.exec(`UPDATE staff_shifts SET clock_in = '${clockInTime}' WHERE id = ${shift1.id};`);

    // Add a scheduled (clock_in IS NULL) and a cancelled cashier shift — neither should cause ambiguity
    d1.exec(`
      INSERT INTO staff_shifts (tenant_id, staff_id, staff_name, role, date, shift, clock_in, attendance_state, status, opening_cash)
      VALUES
        ('default', 'cashier-2', 'Cashier Two', 'cashier', '2026-11-24', 'morning', NULL, 'scheduled', 'open', 0),
        ('default', 'cashier-cancelled', 'Cancelled Cashier', 'cashier', '2026-11-24', 'morning', '${clockInTime}', 'cancelled', 'closed', 0);
      INSERT INTO payments (id, order_id, tenant_id, method, status, amount, created_at, updated_at)
      VALUES
        ('pay-cash-clean', 'ord-cash-clean', 'default', 'cash', 'completed', 50000, '${duringShift}', '${duringShift}');
    `);

    // Reject inactive and cross-tenant handover_to_staff_id
    await expect(
      reconcileShiftCash(
        d1.db,
        {
          shift_id: String(shift1.id),
          opening_float: 100_000,
          denominations: { denominations: [{ denomination: 100_000, count: 1 }, { denomination: 50_000, count: 1 }] },
          handover_to_staff_id: 'inactive-1',
        },
        'cashier-1',
        'default',
        'cashier',
      ),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      reconcileShiftCash(
        d1.db,
        {
          shift_id: String(shift1.id),
          opening_float: 100_000,
          denominations: { denominations: [{ denomination: 100_000, count: 1 }, { denomination: 50_000, count: 1 }] },
          handover_to_staff_id: 'other-store-mgr',
        },
        'cashier-1',
        'default',
        'cashier',
      ),
    ).rejects.toMatchObject({ status: 400 });

    // Now add a truly active overlapping cashier shift -> 409 must include code + ambiguous_payment_ids
    const cashier2Scope = makeScope('cashier-2', 'cashier', false);
    const shift2 = await clockIn(cashier2Scope, 'cashier-2', undefined, undefined, 0);
    const shift2ClockIn = new Date(nowMs - 6_000).toISOString();
    const overlapTime = new Date(nowMs - 4_000).toISOString();
    d1.exec(`
      UPDATE staff_shifts SET clock_in = '${shift2ClockIn}' WHERE id = ${shift2.id};
      UPDATE payments SET created_at = '${overlapTime}', updated_at = '${overlapTime}' WHERE id = 'pay-cash-clean';
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'cashier-1', sub: 'cashier-1', role: 'cashier', tenantId: 'default' });
      c.set('tenantId', 'default');
      await next();
    });
    reconciliationRoutes(app);
    const env = { AURA_DB: d1.db, CASH_RECONCILIATION_ENABLED: 'true' } as unknown as Env;

    const conflictRes = await app.request(
      `/api/shifts/${shift1.id}/reconcile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_float: 100_000,
          denominations: { denominations: [{ denomination: 100_000, count: 1 }, { denomination: 50_000, count: 1 }] },
        }),
      },
      env,
    );
    expect(conflictRes.status).toBe(409);
    const conflictBody = (await conflictRes.json()) as {
      code?: string;
      ambiguous_payment_ids?: string[];
    };
    expect(conflictBody.code).toBe('AMBIGUOUS_CASH_PAYMENTS');
    expect(conflictBody.ambiguous_payment_ids).toEqual(['pay-cash-clean']);

    // Assign via route, close shift1, add a post-clock-out PayOS payment, and verify online_sales_total excludes it
    const assignRes = await app.request(
      `/api/shifts/${shift1.id}/assign-cash-payments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_ids: ['pay-cash-clean'] }),
      },
      env,
    );
    expect(assignRes.status).toBe(200);

    const closedClockOut = new Date(nowMs - 2_000).toISOString();
    const afterClockOut = new Date(nowMs - 1_000).toISOString();
    d1.exec(`
      UPDATE staff_shifts SET clock_out = '${closedClockOut}', attendance_state = 'completed', status = 'closed' WHERE id = ${shift1.id};
      INSERT INTO payments (id, order_id, tenant_id, method, status, amount, created_at, updated_at)
      VALUES
        ('pay-payos-in', 'ord-payos-in', 'default', 'payos', 'completed', 40000, '${overlapTime}', '${overlapTime}'),
        ('pay-payos-after', 'ord-payos-after', 'default', 'payos', 'completed', 99000, '${afterClockOut}', '${afterClockOut}');
    `);

    const okRes = await app.request(
      `/api/shifts/${shift1.id}/reconcile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_float: 100_000,
          denominations: { denominations: [{ denomination: 100_000, count: 1 }, { denomination: 50_000, count: 1 }] },
          handover_to_staff_id: 'mgr-1',
        }),
      },
      env,
    );
    expect(okRes.status).toBe(201);
    const okJson = (await okRes.json()) as { data: { cash_payment_total: number; online_sales_total: number; handover_to_staff_id: string | null } };
    expect(okJson.data.cash_payment_total).toBe(50_000);
    expect(okJson.data.online_sales_total).toBe(40_000);
    expect(okJson.data.handover_to_staff_id).toBe('mgr-1');
  });
});
