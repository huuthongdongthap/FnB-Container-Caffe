// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import {
  CASH_ASSIGN_ROLES,
  CASH_DRAWER_ROLES,
  PAYOUT_ROLES,
  RECONCILIATION_ROLES,
  reconciliationRoutes,
  shiftsRouter,
} from '../../../packages/domain/shift';
import { businessDate, shiftCalendarDateOffset, shiftScope } from '../../../packages/domain/shift/commands/shift-access';
import { createSchedule } from '../../../packages/domain/shift/commands/schedules';
import { clockIn, clockOut } from '../../../packages/domain/shift/commands/attendance';
import { getShift } from '../../../packages/domain/shift/commands/shift-repository';
import { resolveCashCollectingShift } from '../../../packages/domain/shift/commands/cash-settlement';
import { createShiftCashPayout } from '../../../packages/domain/shift/src/policies/cash-reconciliation-policy';
import { settlePayOS } from '../routes/webhooks-handlers/payos-settlement';
import { checkinRouter } from '../routes/checkin';
import { tableSessionsRouter } from '../routes/table-sessions';
import { floorPlanRouter } from '../routes/floor-plan';
import { getTablesMobile, updateTableStatus } from '../routes/tables-mobile';
import { createReservationFromBooking } from '../tree/cal-booking/process-booking';
import { parseBookingTime } from '../tree/cal-booking/time-parser';
import { reservationsRouter } from '../../../packages/domain/reservation/src/routes/reservations';
import { tablesRouter } from '../../../packages/domain/table/commands/tables';
import { generatePNG } from '../tree/qr/generator';
import { createMockEnv, TEST_JWT_SECRET } from './test-utils';
import { issueStaffSession, requireStaffAccount } from '../lib/staff-session';

const openDbs: DatabaseSync[] = [];

afterEach(() => {
  vi.useRealTimers();
  for (const sqlite of openDbs.splice(0)) {
    sqlite.close();
  }
});

function createCanonicalD1() {
  const sqlite = new DatabaseSync(':memory:');
  openDbs.push(sqlite);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const schemaSql = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');
  sqlite.exec(schemaSql);

  function prepare(sql: string) {
    let bound: SQLInputValue[] = [];
    const stmt = {
      bind(...args: SQLInputValue[]) {
        bound = args;
        return stmt;
      },
      async first<T = Record<string, unknown>>() {
        return (sqlite.prepare(sql).get(...bound) as T | undefined) ?? null;
      },
      async all<T = Record<string, unknown>>() {
        return { results: sqlite.prepare(sql).all(...bound) as T[], success: true };
      },
      async run() {
        const res = sqlite.prepare(sql).run(...bound);
        return {
          success: true,
          meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) },
        };
      },
    };
    return stmt;
  }

  const db = {
    prepare,
    async batch(ops: Array<ReturnType<typeof prepare>>) {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const op of ops) {
          out.push(await op.run());
        }
        sqlite.exec('COMMIT');
        return out;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  } as unknown as D1Database;

  return { sqlite, db };
}

describe('Wave 2 Regressions (#222, #223, #234, #237)', () => {
  it('#222: enables multi-tenant shifts in production, HQ Admin self clock-in/out, overnight schedules, post-midnight grace clock-in, and reconciliation-joined getShift()', async () => {
    vi.useFakeTimers();
    // 2026-11-25 00:05 ICT = 2026-11-24 17:05 UTC
    vi.setSystemTime(new Date('2026-11-24T17:05:00.000Z'));

    const { sqlite, db } = createCanonicalD1();
    sqlite.exec(`
      INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES
        ('hq_owner', 'HQ Owner', 'owner', 'hq', 1, 1),
        ('sadec_mgr', 'Sa Dec Manager', 'manager', 'sa-dec-02', 1, 1),
        ('sadec_cashier', 'Sa Dec Cashier', 'cashier', 'sa-dec-02', 1, 1),
        ('sadec_bep', 'Sa Dec Bep', 'bep', 'sa-dec-02', 1, 1);
    `);

    const env = createMockEnv({
      AURA_DB: db,
      ENVIRONMENT: 'production',
      PILOT_TENANT_ID: 'default',
    });

    const mgrScope = await shiftScope(env, { id: 'sadec_mgr', role: 'manager', tenantId: 'sa-dec-02' });
    expect(mgrScope.tenantId).toBe('sa-dec-02');

    // Yesterday's overnight schedule (22:00 -> 06:00) derives shift='night' and stores opening_cash
    const todayBiz = businessDate();
    const yesterdayBiz = shiftCalendarDateOffset(todayBiz, -1);
    const overnightSched = await createSchedule(mgrScope, {
      staffId: 'sadec_cashier',
      date: yesterdayBiz,
      startTime: '22:00',
      endTime: '06:00',
      openingCash: 350_000,
    });
    expect(overnightSched.shift).toBe('night');
    expect(overnightSched.opening_cash).toBe(350_000);

    // Cross-midnight overlap on todayBiz 05:00 -> 13:00 must reject with 409, while 06:00 -> 14:00 succeeds
    await expect(
      createSchedule(mgrScope, {
        staffId: 'sadec_cashier',
        date: todayBiz,
        startTime: '05:00',
        endTime: '13:00',
      }),
    ).rejects.toMatchObject({ status: 409 });

    const handoffSched = await createSchedule(mgrScope, {
      staffId: 'sadec_cashier',
      date: todayBiz,
      startTime: '06:00',
      endTime: '14:00',
    });
    expect(handoffSched.shift).toBe('morning');

    // Non-manager cashier cannot override preset opening_cash (403), but post-midnight grace clock-in succeeds
    const cashierScope = await shiftScope(env, { id: 'sadec_cashier', role: 'cashier', tenantId: 'sa-dec-02' });
    await expect(
      clockIn(cashierScope, 'sadec_cashier', undefined, String(overnightSched.id), 100_000),
    ).rejects.toMatchObject({ status: 403 });

    const clockedInOvernight = await clockIn(cashierScope, 'sadec_cashier', 'Post-midnight grace', String(overnightSched.id));
    expect(clockedInOvernight.opening_cash).toBe(350_000);
    expect(clockedInOvernight.attendance_state).toBe('active');

    // Advance 5 hours to 05:05 ICT and clock out; overnight shift must remain visible in /api/shifts/today
    vi.setSystemTime(new Date('2026-11-24T22:05:00.000Z'));
    await clockOut(cashierScope, 'sadec_cashier', String(overnightSched.id));

    const tokenCashier = (
      await issueStaffSession({ JWT_SECRET: TEST_JWT_SECRET }, await requireStaffAccount(db, 'sadec_cashier'), {
        sessionType: 'staff-web',
      })
    ).token;

    const todayRes = await shiftsRouter.request(
      '/today',
      { headers: { Authorization: `Bearer ${tokenCashier}` } },
      env,
    );
    expect(todayRes.status).toBe(200);
    const todayBody = (await todayRes.json()) as { data: Array<{ id: string }>; meta?: { suggested_opening_cash: number } };
    expect(todayBody.data.some((s) => s.id === String(overnightSched.id))).toBe(true);

    // HQ Admin self clock-in & clock-out in target store sa-dec-02
    const hqStoreScope = await shiftScope(env, { id: 'hq_owner', role: 'owner', tenantId: 'hq' }, 'sa-dec-02');
    const hqShift = await clockIn(hqStoreScope, undefined, 'HQ store audit', undefined, 0);
    expect(hqShift.tenant_id).toBe('sa-dec-02');
    const hqClosed = await clockOut(hqStoreScope);
    expect(hqClosed.attendance_state).toBe('completed');

    // Role 'bep' works end-to-end on Shift APIs and pagination meta is returned on GET /api/shifts
    const tokenBep = (
      await issueStaffSession({ JWT_SECRET: TEST_JWT_SECRET }, await requireStaffAccount(db, 'sadec_bep'), {
        sessionType: 'staff-web',
      })
    ).token;
    const bepClockIn = await shiftsRouter.request(
      '/clock-in',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBep}` },
        body: JSON.stringify({ staff_id: 'sadec_bep', openingCash: 0 }),
      },
      env,
    );
    expect(bepClockIn.status).toBe(201);

    const pagedRes = await shiftsRouter.request(
      '/?limit=1&page=1&status=active',
      { headers: { Authorization: `Bearer ${tokenBep}` } },
      env,
    );
    expect(pagedRes.status).toBe(200);
    const pagedJson = (await pagedRes.json()) as { data: unknown[]; meta: { limit: number; page: number; total: number } };
    expect(pagedJson.data).toHaveLength(1);
    expect(pagedJson.meta).toMatchObject({ limit: 1, page: 1, total: 1 });
  });

  it('#223 & #234(1): enforces CASH_RECONCILIATION_REQUIRED on clockOut, supports atomic close_shift=true, persists dedicated handover columns, unifies 6-layer role matrix, and guards PayOS/payouts/opt-out', async () => {
    const { sqlite, db } = createCanonicalD1();
    sqlite.exec(`
      INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES
        ('hq_admin', 'HQ Admin', 'admin', 'hq', 1, 1),
        ('waiter_1', 'Waiter One', 'waiter', 'store-1', 1, 1),
        ('rider_1', 'Rider One', 'rider', 'store-1', 1, 1),
        ('bep_1', 'Kitchen Bep', 'bep', 'store-1', 1, 1),
        ('optout_cashier', 'Optout Cashier', 'cashier', 'store-optout', 1, 1);
      INSERT INTO settings (key, value, tenant_id) VALUES
        ('cash_reconciliation_enabled', 'false', 'store-optout');
    `);

    for (const role of ['owner', 'admin', 'manager', 'supervisor', 'cashier', 'staff', 'waiter', 'shipper', 'rider']) {
      expect(CASH_DRAWER_ROLES.has(role)).toBe(true);
      expect(PAYOUT_ROLES.has(role)).toBe(true);
      expect(CASH_ASSIGN_ROLES.has(role)).toBe(true);
      expect(RECONCILIATION_ROLES.has(role)).toBe(true);
    }

    const env = createMockEnv({
      AURA_DB: db,
      CASH_RECONCILIATION_ENABLED: 'true',
    });

    const waiterScope = await shiftScope(env, { id: 'waiter_1', role: 'waiter', tenantId: 'store-1' });
    const bepScope = await shiftScope(env, { id: 'bep_1', role: 'bep', tenantId: 'store-1' });

    const waiterShift = await clockIn(waiterScope, 'waiter_1', undefined, undefined, 200_000);
    const bepShift = await clockIn(bepScope, 'bep_1', undefined, undefined, 0);

    // Kitchen 'bep' with 0 opening_cash can clock out directly even when CASH_RECONCILIATION_ENABLED=true
    const closedBep = await clockOut(bepScope, 'bep_1', String(bepShift.id));
    expect(closedBep.attendance_state).toBe('completed');

    // Waiter shift holding cash is blocked from clockOut until reconciled (409 CASH_RECONCILIATION_REQUIRED)
    await expect(clockOut(waiterScope, 'waiter_1', String(waiterShift.id))).rejects.toMatchObject({
      status: 409,
      code: 'CASH_RECONCILIATION_REQUIRED',
    });

    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    sqlite.exec(`
      INSERT INTO orders (id, tenant_id, total, status, payment_status, payment_method, items, customer_name, customer_phone)
      VALUES
        ('ord_cash_1', 'store-1', 100000, 'completed', 'paid', 'cash', '[]', 'G1', '0900000001'),
        ('ord_payos_now', 'store-1', 150000, 'completed', 'partially_refunded', 'payos', '[]', 'G2', '0900000002'),
        ('ord_payos_old', 'store-1', 300000, 'completed', 'partially_refunded', 'payos', '[]', 'G3', '0900000003'),
        ('ord_payos_late', 'store-1', 90000, 'pending', 'unpaid', 'payos', '[]', 'G4', '0900000004');
      INSERT INTO payments (id, order_id, tenant_id, method, status, amount, refund_amount, created_at, updated_at)
      VALUES
        ('pay_cash_1', 'ord_cash_1', 'store-1', 'cash', 'completed', 100000, 0, '${now}', '${now}'),
        ('pay_payos_now', 'ord_payos_now', 'store-1', 'payos', 'completed', 150000, 30000, '${now}', '${now}'),
        ('pay_payos_old', 'ord_payos_old', 'store-1', 'payos', 'completed', 300000, 50000, '${yesterday}', '${now}'),
        ('pay_payos_late', 'ord_payos_late', 'store-1', 'payos', 'pending', 90000, 0, '${now}', '${now}');
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
    let currentUser: Record<string, unknown> = { id: 'waiter_1', sub: 'waiter_1', role: 'waiter', tenantId: 'store-1' };
    app.use('*', async (c, next) => {
      c.set('user', currentUser);
      c.set('tenantId', String(currentUser.tenantId || 'store-1'));
      await next();
    });
    reconciliationRoutes(app);

    // Invalid string / float / unknown denomination payloads must return 400
    const badStringRes = await app.request(
      `/api/shifts/${waiterShift.id}/reconcile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_float: 200_000,
          denominations: { denominations: [{ denomination: 200_000, count: 1 }] },
          remitted_cash: '100000',
        }),
      },
      env,
    );
    expect(badStringRes.status).toBe(400);

    const badDenomRes = await app.request(
      `/api/shifts/${waiterShift.id}/reconcile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_float: 200_000,
          denominations: { denominations: [{ denomination: 333, count: 1 }] },
        }),
      },
      env,
    );
    expect(badDenomRes.status).toBe(400);

    // Waiter records a cash payout (previously 403 for shipper/rider)
    const payoutRes = await app.request(
      `/api/shifts/${waiterShift.id}/payouts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 20_000, reason: 'Mua đá viên' }),
      },
      env,
    );
    expect(payoutRes.status).toBe(201);

    // Atomic close_shift=true reconciles (overlapping 'bep' did NOT cause AMBIGUOUS_CASH_PAYMENTS) and closes shift
    const reconRes = await app.request(
      `/api/shifts/${waiterShift.id}/reconcile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_float: 200_000,
          denominations: {
            denominations: [
              { denomination: 200_000, count: 1 },
              { denomination: 50_000, count: 1 },
              { denomination: 20_000, count: 1 },
              { denomination: 10_000, count: 1 },
            ],
          },
          remitted_cash: 130_000,
          closing_float: 150_000,
          handover_to_staff_id: 'rider_1',
          close_shift: true,
        }),
      },
      env,
    );
    expect(reconRes.status).toBe(201);
    const reconJson = (await reconRes.json()) as {
      data: {
        expected_cash: number;
        actual_cash: number;
        remitted_cash: number;
        closing_float: number;
        handover_to_staff_id: string;
        online_sales_total: number;
        shift_closed: boolean;
      };
    };
    // 200k + 100k - 20k = 280k; online = 150k - 30k = 120k (excludes yesterday's refunded 300k!)
    expect(reconJson.data).toMatchObject({
      expected_cash: 280_000,
      actual_cash: 280_000,
      remitted_cash: 130_000,
      closing_float: 150_000,
      handover_to_staff_id: 'rider_1',
      online_sales_total: 120_000,
      shift_closed: true,
    });

    // Dedicated SQLite columns persisted + getShift() joins reconciliation totals
    const dbReconRow = sqlite
      .prepare(
        'SELECT remitted_cash, closing_float, handover_to_staff_id, online_sales_total FROM shift_reconciliations WHERE shift_id = ?',
      )
      .get(String(waiterShift.id)) as Record<string, unknown>;
    expect(dbReconRow).toEqual({
      remitted_cash: 130_000,
      closing_float: 150_000,
      handover_to_staff_id: 'rider_1',
      online_sales_total: 120_000,
    });

    const joinedShift = await getShift(waiterScope, String(waiterShift.id));
    expect(joinedShift.clock_out).toBeTruthy();
    expect(joinedShift.expected_cash).toBe(280_000);
    expect(joinedShift.closing_float).toBe(150_000);

    // Post-reconciliation payout & collecting shift & PayOS settlement must NOT mutate reconciled shift
    await expect(
      createShiftCashPayout(env, String(waiterShift.id), { amount: 10_000, reason: 'Late' }, 'waiter_1', 'store-1', 'waiter'),
    ).rejects.toMatchObject({ status: 409 });

    const collectingAfter = await resolveCashCollectingShift(db, 'waiter_1', 'store-1');
    expect(collectingAfter.shift).toBeNull();

    await settlePayOS(
      db,
      { id: 'pay_payos_late', order_id: 'ord_payos_late', status: 'pending', amount: 90_000, method: 'payos' },
      true,
      'completed',
      new Date().toISOString(),
      'ref-late',
    );
    const shiftSalesAfter = sqlite
      .prepare('SELECT online_sales FROM staff_shifts WHERE id = ?')
      .get(waiterShift.id) as { online_sales: number };
    expect(shiftSalesAfter.online_sales).toBe(0);

    // HQ Admin wildcard caller respects store-optout cash_reconciliation_enabled = false (501)
    const optoutScope = await shiftScope(env, { id: 'optout_cashier', role: 'cashier', tenantId: 'store-optout' });
    const optoutShift = await clockIn(optoutScope, 'optout_cashier', undefined, undefined, 100_000);
    currentUser = { id: 'hq_admin', sub: 'hq_admin', role: 'admin', tenantId: 'hq' };
    const hqOptoutRes = await app.request(
      `/api/shifts/${optoutShift.id}/reconcile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening_float: 100_000, denominations: { denominations: [{ denomination: 100_000, count: 1 }] } }),
      },
      env,
    );
    expect(hqOptoutRes.status).toBe(501);
  });

  it('#234(2–5): walk-in guest check-in satisfies D1 FK and manager approval, isolates table_session orders, clears current_session_id on release, and allows shipper/rider mobile tables', async () => {
    const { sqlite, db } = createCanonicalD1();
    sqlite.exec(`
      INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES
        ('mgr_1', 'Manager', 'manager', 'default', 1, 1),
        ('shipper_1', 'Shipper', 'shipper', 'default', 1, 1),
        ('rider_1', 'Rider', 'rider', 'default', 1, 1);
      INSERT INTO cafe_tables (id, table_number, capacity, zone, status, tenant_id)
      VALUES ('tbl_1', 'T01', 4, 'Indoor', 'Available', 'default');
    `);

    const env = createMockEnv({ AURA_DB: db });

    // 1. Walk-in phone check-in with PRAGMA foreign_keys = ON creates customer + pending checkin, then manager approves
    const checkinApp = new Hono<{ Bindings: Env; Variables: { user?: Record<string, unknown>; tenantId?: string } }>();
    let checkinActor: Record<string, unknown> | undefined;
    checkinApp.use('*', async (c, next) => {
      if (checkinActor) c.set('user', checkinActor);
      c.set('tenantId', 'default');
      await next();
    });
    checkinApp.route('/api/checkin', checkinRouter);

    const createRes = await checkinApp.request(
      '/api/checkin',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0918889999' }),
      },
      env,
    );
    expect(createRes.status).toBe(201);
    const createdCheckin = (await createRes.json()) as { data: { id: string; customer_id: string; status: string; reward_amount: number } };
    expect(createdCheckin.data.status).toBe('pending');
    expect(createdCheckin.data.reward_amount).toBe(5000);

    checkinActor = { id: 'mgr_1', role: 'manager', tenantId: 'default' };
    const approveRes = await checkinApp.request(
      `/api/checkin/${createdCheckin.data.id}/approve`,
      { method: 'POST' },
      env,
    );
    expect(approveRes.status).toBe(200);
    const wallet = sqlite
      .prepare('SELECT balance FROM cashback_wallets WHERE customer_id = ?')
      .get(createdCheckin.data.customer_id) as { balance: number } | undefined;
    expect(wallet?.balance).toBe(5000);

    // 2. Table sessions write ISO opened_at, do not leak prior same-day orders, and release clears current_session_id + closes 'paying'
    const tsApp = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
    tsApp.use('*', async (c, next) => {
      c.set('user', { id: 'mgr_1', role: 'manager', tenantId: 'default' });
      c.set('tenantId', 'default');
      await next();
    });
    tsApp.route('/api/table-sessions', tableSessionsRouter);
    tsApp.route('/api/floor-plan', floorPlanRouter);
    tsApp.get('/mobile/tables', (c) => getTablesMobile(c as never));
    tsApp.patch('/mobile/tables/:id', (c) => updateTableStatus(c as never));

    // Seed an earlier order on tbl_1 from 2 hours ago on the same day (attached to closed session old_sess)
    const twoHoursAgoIso = new Date(Date.now() - 2 * 3_600_000).toISOString();
    sqlite.exec(`
      INSERT INTO table_sessions (id, table_id, status, opened_at, started_at, closed_at, tenant_id)
      VALUES ('old_sess', 'tbl_1', 'closed', '${twoHoursAgoIso}', '${twoHoursAgoIso}', '${twoHoursAgoIso}', 'default');
      INSERT INTO orders (id, table_id, session_id, tenant_id, items, total, status, payment_status, payment_method, customer_name, customer_phone, created_at, updated_at)
      VALUES ('ord_old_guest', 'tbl_1', 'old_sess', 'default', '[]', 65000, 'completed', 'paid', 'cash', 'Old Guest', '0900111222', '${twoHoursAgoIso}', '${twoHoursAgoIso}');
    `);

    const openSessRes = await tsApp.request(
      '/api/table-sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: 'tbl_1', customer_name: 'New Guest' }),
      },
      env,
    );
    expect(openSessRes.status).toBe(201);
    const newSession = ((await openSessRes.json()) as { data: { id: string; opened_at: string } }).data;
    expect(newSession.opened_at).toContain('T');

    const sessOrdersRes = await tsApp.request(`/api/table-sessions/${newSession.id}/orders`, { method: 'GET' }, env);
    expect(sessOrdersRes.status).toBe(200);
    const sessOrders = ((await sessOrdersRes.json()) as { data: Array<{ id: string }> }).data;
    expect(sessOrders).toHaveLength(0);

    // Move session to 'paying' and release via mobile tables -> clears current_session_id and closes 'paying' session
    sqlite.prepare("UPDATE table_sessions SET status = 'paying' WHERE id = ?").run(newSession.id);
    const mobileReleaseRes = await tsApp.request(
      '/mobile/tables/tbl_1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'free' }),
      },
      env,
    );
    expect(mobileReleaseRes.status).toBe(200);

    const tblAfterMobile = sqlite
      .prepare('SELECT status, current_session_id FROM cafe_tables WHERE id = ?')
      .get('tbl_1') as { status: string; current_session_id: string | null };
    expect(tblAfterMobile.status).toBe('Available');
    expect(tblAfterMobile.current_session_id).toBeNull();

    const sessAfterMobile = sqlite
      .prepare('SELECT status FROM table_sessions WHERE id = ?')
      .get(newSession.id) as { status: string };
    expect(sessAfterMobile.status).toBe('closed');

    // Shipper & rider can view /mobile/tables without 403
    const mobileShipperApp = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
    mobileShipperApp.use('*', async (c, next) => {
      c.set('user', { id: 'rider_1', role: 'rider', tenantId: 'default' });
      c.set('tenantId', 'default');
      await next();
    });
    mobileShipperApp.get('/mobile/tables', (c) => getTablesMobile(c as never));
    const riderTablesRes = await mobileShipperApp.request('/mobile/tables', { method: 'GET' }, env);
    expect(riderTablesRes.status).toBe(200);
  });

  it('#237: converts Cal.com UTC to ICT + checks 90m overlap + allows future booking on currently occupied table, validates reservation PATCH status & seated release, generates ?table= QR, and updates table fields', async () => {
    const { sqlite, db } = createCanonicalD1();
    sqlite.exec(`
      INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES
        ('mgr_1', 'Manager', 'manager', 'default', 1, 1);
      INSERT INTO cafe_tables (id, table_number, name, capacity, zone, status, notes, tenant_id)
      VALUES ('tbl_vip', 'V01', 'VIP 1', 6, 'VIP', 'Occupied', 'Old note', 'default');
    `);

    // 1. Cal.com UTC -> ICT (+07:00), allows future booking even though tbl_vip is currently 'Occupied', and blocks 90m overlap
    const parsedIct = parseBookingTime('2026-12-20T11:30:00.000Z');
    expect(parsedIct).toEqual({ date: '2026-12-20', time: '18:30' });

    const firstBooking = await createReservationFromBooking(db, {
      uid: 'cal_future_1',
      startTime: '2026-12-20T11:30:00.000Z', // 18:30 ICT
      attendees: [{ name: 'Khach Cal', email: 'cal@aura.vn', phone: '0905556666' }],
      metadata: { guest_count: 4, zone: 'VIP' },
    });
    expect(firstBooking).toMatchObject({ table_id: 'tbl_vip', status: 'confirmed' });

    // Overlapping booking 45 minutes later (19:15 ICT = 12:15 UTC) must be rejected because tbl_vip is booked within 90m
    const overlapBooking = await createReservationFromBooking(db, {
      uid: 'cal_future_overlap',
      startTime: '2026-12-20T12:15:00.000Z', // 19:15 ICT
      attendees: [{ name: 'Khach Overlap', email: 'ov@aura.vn', phone: '0905557777' }],
      metadata: { guest_count: 4, zone: 'VIP' },
    });
    expect('error' in overlapBooking).toBe(true);

    // 2. Reservations PATCH status validation, server-side search, and seated DELETE releasing Occupied table
    const env = createMockEnv({ AURA_DB: db });
    const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'mgr_1', role: 'manager', tenantId: 'default' });
      c.set('tenantId', 'default');
      await next();
    });
    app.route('/api/reservations', reservationsRouter);
    app.route('/api/tables', tablesRouter);

    const searchRes = await app.request('/api/reservations?search=0905556666', { method: 'GET' }, env);
    expect(searchRes.status).toBe(200);
    const searchedRows = ((await searchRes.json()) as { data: Array<{ id: string }> }).data;
    expect(searchedRows).toHaveLength(1);
    const createdRsvId = searchedRows[0]!.id;

    const badPatch = await app.request(
      `/api/reservations/${createdRsvId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'totally_invalid_status' }),
      },
      env,
    );
    expect(badPatch.status).toBe(400);

    // Seed a seated reservation for today owning an active session on tbl_vip ('Occupied') and verify DELETE frees the table
    const todayVn = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    sqlite.exec(`
      INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, status, tenant_id)
      VALUES ('rsv_seated_today', 'tbl_vip', 'Seated Guest', '0911223344', 4, '${todayVn}', '12:00', 'VIP', 'seated', 'default');
      INSERT INTO table_sessions (id, table_id, status, notes, opened_at, started_at, tenant_id)
      VALUES ('sess_seated_1', 'tbl_vip', 'active', 'reservation:rsv_seated_today', '${new Date().toISOString()}', '${new Date().toISOString()}', 'default');
      UPDATE cafe_tables SET status = 'Occupied', current_session_id = 'sess_seated_1' WHERE id = 'tbl_vip';
    `);

    const cancelSeatedRes = await app.request('/api/reservations/rsv_seated_today', { method: 'DELETE' }, env);
    expect(cancelSeatedRes.status).toBe(200);
    const releasedTable = sqlite
      .prepare('SELECT status, current_session_id FROM cafe_tables WHERE id = ?')
      .get('tbl_vip') as { status: string; current_session_id: string | null };
    expect(releasedTable.status).toBe('Available');
    expect(releasedTable.current_session_id).toBeNull();

    // 3. QR generator encodes ?table=<slug>&tenant=<tenant> (not /order/<slug>)
    const pngDefault = await generatePNG('v01-vip', 'https://auraspace.cafe');
    const pngTenant = await generatePNG('v01-vip', 'https://auraspace.cafe', undefined, 'sa-dec-02');
    const pngExplicit = await generatePNG(
      'v01-vip',
      'https://auraspace.cafe',
      'https://auraspace.cafe?table=v01-vip',
    );
    expect(new Uint8Array(pngDefault)).toEqual(new Uint8Array(pngExplicit));
    expect(new Uint8Array(pngTenant)).not.toEqual(new Uint8Array(pngDefault));

    // 4. PATCH /api/tables/:id updates table_number, name, zone, capacity, notes
    const patchTableRes = await app.request(
      '/api/tables/tbl_vip',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: 'V02',
          name: 'Garden VIP 2',
          zone: 'Garden',
          capacity: 8,
          notes: 'Near koi pond',
        }),
      },
      env,
    );
    expect(patchTableRes.status).toBe(200);
    const updatedTbl = sqlite
      .prepare('SELECT table_number, name, zone, capacity, notes FROM cafe_tables WHERE id = ?')
      .get('tbl_vip') as Record<string, unknown>;
    expect(updatedTbl).toEqual({
      table_number: 'V02',
      name: 'Garden VIP 2',
      zone: 'Garden',
      capacity: 8,
      notes: 'Near koi pond',
    });
  });
});
