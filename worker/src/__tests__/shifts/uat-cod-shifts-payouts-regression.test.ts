// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import {
  reconciliationRoutes,
  assignCashPaymentsToShift,
  createShiftCashPayout,
  listShiftCashPayouts,
} from '@aura/domain-shift';
import { clockIn, clockOut } from '../../../../packages/domain/shift/commands/attendance';
import { shiftScope } from '../../../../packages/domain/shift/commands/shift-access';
import { shiftsRouter } from '../../../../packages/domain/shift/commands/shifts';
import { registerReconciliationHandlers } from '../../routes/reports-handlers/reconciliation-handlers';
import { COD_COLLECTION_ROLES } from '../../routes/orders-hono-handlers/kds-handlers';
import type { Env } from '../../types/env';

function createSqliteD1(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      let binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds = args;
          return stmt;
        },
        async first<T = unknown>() {
          return (sqlite.prepare(sql).get(...(binds as never[])) as T | undefined) ?? null;
        },
        async all<T = unknown>() {
          return { results: sqlite.prepare(sql).all(...(binds as never[])) as T[], success: true };
        },
        async run() {
          const info = sqlite.prepare(sql).run(...(binds as never[]));
          return { success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
        },
      };
      return stmt;
    },
  };
}

function setupDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, name TEXT, phone TEXT DEFAULT '0900000000', email TEXT DEFAULT 'staff@test.local', role TEXT, tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1
    );
    CREATE TABLE staff_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT DEFAULT 'default',
      staff_id TEXT NOT NULL,
      staff_name TEXT,
      role TEXT,
      date TEXT,
      shift TEXT,
      clock_in TEXT,
      clock_out TEXT,
      hours_worked REAL,
      attendance_state TEXT,
      notes TEXT,
      opening_cash REAL DEFAULT 0
    );
    CREATE TABLE shift_reconciliations (
      id TEXT PRIMARY KEY,
      shift_id TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'default',
      staff_id TEXT,
      opening_float REAL DEFAULT 0,
      cash_payment_total REAL DEFAULT 0,
      cash_payout_total REAL DEFAULT 0,
      expected_cash REAL DEFAULT 0,
      actual_cash REAL DEFAULT 0,
      variance REAL DEFAULT 0,
      variance_status TEXT DEFAULT 'balanced',
      denominations TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE cash_payouts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      shift_id TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      method TEXT,
      amount REAL,
      status TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE cash_payment_attributions (
      payment_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      shift_id TEXT NOT NULL,
      collected_by TEXT NOT NULL,
      settled_at TEXT NOT NULL
    );
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      items TEXT,
      total REAL,
      status TEXT,
      payment_status TEXT,
      payment_method TEXT,
      customer_name TEXT DEFAULT 'Walk-in',
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO users (id, name, role, tenant_id, is_active) VALUES
      ('admin-flagship', 'Flagship Admin', 'admin', 'default', 1),
      ('legacy-empty-tenant', 'Legacy Staff', 'cashier', '', 1),
      ('barista-1', 'Barista One', 'barista', 'default', 1),
      ('cashier-1', 'Cashier One', 'cashier', 'default', 1);
  `);
  return { sqlite, db: createSqliteD1(sqlite) };
}

const dbs: DatabaseSync[] = [];
afterEach(() => {
  for (const s of dbs.splice(0)) s.close();
});

describe('UAT #132/#133/#134 COD, shifts, payouts, and reconciliation regressions', () => {
  it('#132: COD_COLLECTION_ROLES includes waiter and shipper while keeping generic staff out', () => {
    expect(COD_COLLECTION_ROLES).toEqual(
      expect.arrayContaining(['owner', 'manager', 'supervisor', 'cashier', 'admin', 'waiter', 'shipper']),
    );
    expect(COD_COLLECTION_ROLES).not.toContain('staff');
  });

  it('#133: numeric-only clock-out notes are saved as notes, not misparsed as attendanceId (no 404)', async () => {
    const { sqlite, db } = setupDb();
    dbs.push(sqlite);
    const env = { AURA_DB: db } as unknown as Env;
    const scope = await shiftScope(env, { id: 'cashier-1', role: 'cashier', tenantId: 'default' });
    const opened = await clockIn(scope, 'cashier-1', 'open', undefined, 500000);
    const closed = await clockOut(scope, 'cashier-1', undefined, '500000');
    expect(String(closed.id)).toBe(String(opened.id));
    expect(closed.clock_out).toBeTruthy();
    expect(closed.notes).toContain('500000');
  });

  it('#133: flagship admin has canManage=true even in production pilot and empty tenant_id normalizes to default', async () => {
    const { sqlite, db } = setupDb();
    dbs.push(sqlite);
    const env = { AURA_DB: db, ENVIRONMENT: 'production', PILOT_TENANT_ID: 'default' } as unknown as Env;
    const adminScope = await shiftScope(env, { id: 'admin-flagship', role: 'admin', tenantId: 'default' });
    expect(adminScope.canManage).toBe(true);

    const legacyScope = await shiftScope(env, { id: 'legacy-empty-tenant', role: 'cashier', tenantId: 'default' });
    expect(legacyScope.tenantId).toBe('default');
  });

  it('#133: POST /api/shifts/clock-out accepts explicit shift_id with numeric notes', async () => {
    const { sqlite, db } = setupDb();
    dbs.push(sqlite);
    const env = { AURA_DB: db } as unknown as Env;
    const scope = await shiftScope(env, { id: 'barista-1', role: 'barista', tenantId: 'default' });
    const opened = await clockIn(scope, 'barista-1', undefined, undefined, 0);

    const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown> } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'barista-1', role: 'barista', tenantId: 'default' });
      await next();
    });
    app.route('/api/shifts', shiftsRouter);

    const res = await app.request(
      '/api/shifts/clock-out',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: 'barista-1', shift_id: String(opened.id), notes: '12345' }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; notes: string } };
    expect(body.data.id).toBe(String(opened.id));
    expect(body.data.notes).toBe('12345');
  });

  it('#132/#134: assign-cash-payments and cash_payouts endpoints work end-to-end', async () => {
    const { sqlite, db } = setupDb();
    dbs.push(sqlite);
    const env = { AURA_DB: db, CASH_RECONCILIATION_ENABLED: 'true' } as unknown as Env;
    const scope = await shiftScope(env, { id: 'cashier-1', role: 'cashier', tenantId: 'default' });
    const shift = await clockIn(scope, 'cashier-1', undefined, undefined, 200000);
    sqlite.prepare(
      "INSERT INTO payments (id, order_id, method, amount, status, tenant_id) VALUES ('pay-1', 'ord-1', 'cod', 50000, 'completed', 'default')"
    ).run();

    const assigned = await assignCashPaymentsToShift(env, String(shift.id), ['pay-1'], 'cashier-1', 'default', 'cashier');
    expect(assigned.assigned_count).toBe(1);

    const createdPayout = await createShiftCashPayout(
      env,
      String(shift.id),
      { amount: 25000, reason: 'Mua đá viên' },
      'cashier-1',
      'default',
      'cashier',
    );
    expect(createdPayout.amount).toBe(25000);

    const list = await listShiftCashPayouts(env, String(shift.id), 'default');
    expect(list).toHaveLength(1);
    expect(list[0].reason).toBe('Mua đá viên');

    // Verify route layer for barista role on reconciliation endpoint (no 403)
    const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'barista-1', role: 'barista', tenantId: 'default' });
      c.set('tenantId', 'default');
      await next();
    });
    reconciliationRoutes(app);
    const reconRes = await app.request(`/api/shifts/${shift.id}/reconciliation`, { method: 'GET' }, env);
    expect(reconRes.status).toBe(404); // Not reconciled yet, NOT 403
  });

  it('#134: reconciliation report populates categories and flags unreconciled shifts', async () => {
    const { sqlite, db } = setupDb();
    dbs.push(sqlite);
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    sqlite.prepare(
      `INSERT INTO categories (id, name, tenant_id) VALUES ('cat-tea', 'Trà sữa', 'default')`
    ).run();
    sqlite.prepare(
      `INSERT INTO orders (id, items, total, status, payment_status, payment_method, tenant_id, created_at)
       VALUES ('ord-cat-1', ?, 90000, 'completed', 'paid', 'cod', 'default', datetime('now'))`
    ).run(JSON.stringify([{ name: 'Latte', category: 'Coffee', quantity: 2, price: 45000 }]));
    sqlite.prepare(
      `INSERT INTO orders (id, items, total, status, payment_status, payment_method, tenant_id, created_at)
       VALUES ('ord-cat-2', ?, 55000, 'completed', 'paid', 'cod', 'default', datetime('now'))`
    ).run(JSON.stringify([{ name: 'Matcha Milk Tea', category_id: 'cat-tea', quantity: 1, price: 55000 }]));
    sqlite.prepare(
      `INSERT INTO staff_shifts (tenant_id, staff_id, staff_name, role, date, shift, clock_in, opening_cash)
       VALUES ('default', 'cashier-1', 'Cashier One', 'cashier', ?, 'attendance', datetime('now'), 100000)`
    ).run(today);

    const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'admin-flagship', role: 'admin', tenantId: 'default' });
      c.set('tenantId', 'default');
      await next();
    });
    registerReconciliationHandlers(app);

    const env = { AURA_DB: db, CASH_RECONCILIATION_ENABLED: 'true' } as unknown as Env;
    const res = await app.request(`/reconciliation?from=${today}&to=${today}`, { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        categories: Array<{ category: string; items_sold: number; revenue: number }>;
        has_unreconciled_shifts: boolean;
        unreconciled_shifts: Array<{ shift_id: string }>;
      };
    };
    expect(body.data.categories).toEqual([
      { category: 'Coffee', items_sold: 2, revenue: 90000 },
      { category: 'Trà sữa', items_sold: 1, revenue: 55000 },
    ]);
    expect(body.data.has_unreconciled_shifts).toBe(true);
    expect(body.data.unreconciled_shifts.length).toBe(1);
  });

  it('shift cash assignment and payout endpoints fail closed for missing, inactive, demoted, or cross-tenant actors', async () => {
    const { sqlite, db } = setupDb();
    dbs.push(sqlite);
    sqlite.prepare(
      `INSERT INTO users (id, name, role, tenant_id, is_active) VALUES
        ('inactive-cashier', 'Inactive Cashier', 'cashier', 'default', 0),
        ('other-tenant-mgr', 'Other Store Mgr', 'manager', 'store-b', 1)`
    ).run();
    const env = { AURA_DB: db, CASH_RECONCILIATION_ENABLED: 'true' } as unknown as Env;
    const scope = await shiftScope(env, { id: 'cashier-1', role: 'cashier', tenantId: 'default' });
    const shift = await clockIn(scope, 'cashier-1', undefined, undefined, 200000);
    sqlite.prepare(
      "INSERT INTO payments (id, order_id, method, amount, status, tenant_id) VALUES ('pay-sec-1', 'ord-sec-1', 'cod', 50000, 'completed', 'default')"
    ).run();

    // Unknown / deleted actor fails closed (403)
    await expect(
      assignCashPaymentsToShift(env, String(shift.id), ['pay-sec-1'], 'ghost-user', 'default', 'manager')
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      createShiftCashPayout(env, String(shift.id), { amount: 10000, reason: 'Ice' }, 'ghost-user', 'default', 'manager')
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      listShiftCashPayouts(env, String(shift.id), 'default', 'ghost-user', 'manager')
    ).rejects.toMatchObject({ status: 403 });

    // Inactive actor fails closed (403)
    await expect(
      listShiftCashPayouts(env, String(shift.id), 'default', 'inactive-cashier', 'cashier')
    ).rejects.toMatchObject({ status: 403 });

    // Stale JWT claiming manager when DB role is cashier fails closed (403)
    await expect(
      createShiftCashPayout(env, String(shift.id), { amount: 10000, reason: 'Ice' }, 'cashier-1', 'default', 'manager')
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      listShiftCashPayouts(env, String(shift.id), 'default', 'cashier-1', 'manager')
    ).rejects.toMatchObject({ status: 403 });

    // Cross-tenant manager fails closed (403) — including wildcard/hq tenant target
    await expect(
      assignCashPaymentsToShift(env, String(shift.id), ['pay-sec-1'], 'other-tenant-mgr', 'default', 'manager')
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      assignCashPaymentsToShift(env, String(shift.id), ['pay-sec-1'], 'other-tenant-mgr', '*', 'manager')
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      listShiftCashPayouts(env, String(shift.id), 'hq', 'other-tenant-mgr', 'manager')
    ).rejects.toMatchObject({ status: 403 });
  });
});
