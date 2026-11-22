import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createMockDB, createMockEnv } from '../test-utils';
import {
  reconcileShiftCash,
  getReconciliationForShift,
  reconciliationRoutes,
} from '@aura/domain-shift';
import { shiftReconciliationRouter } from '../../routes/shift-reconciliation';

interface Denomination {
  denomination: number;
  count: number;
}

function makeReconciliationMockDB(opts: {
  shift: { clock_in: string; clock_out: string | null; staff_id?: string; opening_cash?: number; tenant_id?: string } | null;
  cashPayments?: number;
  cashPayouts?: number;
  openingCash?: number;
}) {
  const db = createMockDB();

  db.prepare = ((sql: string) => {
    return {
      _sql: sql,
      _binds: [] as unknown[],
      bind(...args: unknown[]) {
        this._binds = args;
        return this;
      },
      first: async () => {
        if (sql.includes('FROM staff_shifts') || sql.includes('SELECT clock_in, clock_out FROM shifts')) {
          if (!opts.shift) return null;
          return {
            staff_id: 'staff_1',
            tenant_id: 'default',
            opening_cash: opts.openingCash ?? opts.shift.opening_cash ?? 100_000,
            ...opts.shift,
          };
        }
        if (sql.includes('FROM users WHERE id = ?')) {
          return { tenant_id: 'default', role: 'staff', is_active: 1 };
        }
        if (sql.includes('FROM payments') && sql.includes("payment_method = 'cash'")) {
          return { total: opts.cashPayments ?? 0 };
        }
        if (sql.includes('FROM cash_payouts')) {
          return { total: opts.cashPayouts ?? 0 };
        }
        if (sql.includes('FROM shift_reconciliations WHERE')) {
          return null;
        }
        return null;
      },
      all: async () => {
        if (sql.includes('FROM payments p LEFT JOIN cash_payment_attributions')) {
          return {
            results: opts.cashPayments
              ? [{ id: 'pay_mock_1', amount: opts.cashPayments, shift_id: null, candidates: 1 }]
              : [],
            success: true,
          };
        }
        return { results: [], success: true };
      },
      run: async () => ({ success: true, changes: 1, lastRowId: 0 }),
      raw: async () => [],
    };
  }) as any;

  return { db };
}

function calcTotal(denoms: Denomination[]): number {
  return denoms.reduce((sum, d) => sum + d.denomination * d.count, 0);
}

describe('cash reconciliation', () => {
  it('marks balanced when actual equals expected', async () => {
    const shift = {
      clock_in: '2026-09-15T08:00:00Z',
      clock_out: '2026-09-15T16:00:00Z',
    };
    const { db } = makeReconciliationMockDB({
      shift,
      cashPayments: 500_000,
      cashPayouts: 50_000,
    });

    const env = createMockEnv();
    (env as any).AURA_DB = db;

    const openingFloat = 100_000;
    const expectedCash = openingFloat + 500_000 - 50_000;
    const denominations: Denomination[] = [
      { denomination: 500_000, count: 1 },
      { denomination: 100_000, count: Math.floor(expectedCash / 100_000) },
    ];
    // Adjust to match exact expected
    const adjustedDenoms: Denomination[] = [
      { denomination: 500_000, count: 1 },
      { denomination: 50_000, count: 1 },
    ];
    const actualCash = calcTotal(adjustedDenoms);

    const result = await reconcileShiftCash(
      env as any,
      {
        shift_id: 'shift_1',
        opening_float: openingFloat,
        denominations: { denominations: adjustedDenoms },
      },
      'staff_1'
    );

    expect(result.shift_id).toBe('shift_1');
    expect(result.staff_id).toBe('staff_1');
    expect(result.opening_float).toBe(openingFloat);
    expect(result.expected_cash).toBe(550_000);
    expect(result.actual_cash).toBe(actualCash);
    expect(result.variance).toBe(actualCash - 550_000);
    expect(result.variance_status).toBe('balanced');
    expect(result.cash_payment_total).toBe(500_000);
    expect(result.cash_payout_total).toBe(50_000);
  });

  it('detects shortage when actual < expected', async () => {
    const shift = {
      staff_id: 'staff_2',
      clock_in: '2026-09-15T08:00:00Z',
      clock_out: '2026-09-15T16:00:00Z',
    };
    const { db } = makeReconciliationMockDB({
      shift,
      cashPayments: 300_000,
      cashPayouts: 0,
    });

    const env = createMockEnv();
    (env as any).AURA_DB = db;

    const openingFloat = 100_000;
    const expectedCash = openingFloat + 300_000;
    const denominations: Denomination[] = [
      { denomination: 300_000, count: 1 },
    ];
    const actualCash = calcTotal(denominations);

    const result = await reconcileShiftCash(
      env as any,
      {
        shift_id: 'shift_2',
        opening_float: openingFloat,
        denominations: { denominations },
      },
      'staff_2'
    );

    expect(result.expected_cash).toBe(expectedCash);
    expect(result.actual_cash).toBe(actualCash);
    expect(result.variance).toBeLessThan(0);
    expect(result.variance_status).toBe('shortage');
  });

  it('detects overage when actual > expected', async () => {
    const shift = {
      staff_id: 'staff_3',
      clock_in: '2026-09-15T08:00:00Z',
      clock_out: '2026-09-15T16:00:00Z',
    };
    const { db } = makeReconciliationMockDB({
      shift,
      cashPayments: 200_000,
      cashPayouts: 0,
    });

    const env = createMockEnv();
    (env as any).AURA_DB = db;

    const openingFloat = 100_000;
    const expectedCash = openingFloat + 200_000;
    const denominations: Denomination[] = [
      { denomination: 500_000, count: 1 },
    ];
    const actualCash = calcTotal(denominations);

    const result = await reconcileShiftCash(
      env as any,
      {
        shift_id: 'shift_3',
        opening_float: openingFloat,
        denominations: { denominations },
      },
      'staff_3'
    );

    expect(result.expected_cash).toBe(expectedCash);
    expect(result.actual_cash).toBe(actualCash);
    expect(result.variance).toBeGreaterThan(0);
    expect(result.variance_status).toBe('overage');
  });

  it('returns null when no reconciliation exists', async () => {
    const { db } = makeReconciliationMockDB({ shift: null });

    const env = createMockEnv();
    (env as any).AURA_DB = db;

    const result = await getReconciliationForShift(env as any, 'shift_missing');
    expect(result).toBeNull();
  });

  it('uses current time when shift has not clocked out', async () => {
    const shift = {
      staff_id: 'staff_4',
      clock_in: '2026-09-15T08:00:00Z',
      clock_out: null,
    };
    const { db } = makeReconciliationMockDB({
      shift,
      cashPayments: 150_000,
      cashPayouts: 0,
    });

    const env = createMockEnv();
    (env as any).AURA_DB = db;

    const denominations: Denomination[] = [
      { denomination: 250_000, count: 1 },
    ];
    const result = await reconcileShiftCash(
      env as any,
      {
        shift_id: 'shift_open',
        opening_float: 100_000,
        denominations: { denominations },
      },
      'staff_4'
    );

    expect(result.expected_cash).toBe(250_000);
    expect(result.actual_cash).toBe(250_000);
    expect(result.variance_status).toBe('balanced');
  });

  it('preserves access checks and explicitly gates the unvalidated pilot cash lifecycle', async () => {
    const app = new Hono<any>();
    let mockUser: { sub?: string; role: string } | undefined;
    app.use('*', async (c, next) => { if (mockUser) c.set('user', mockUser); await next(); });
    reconciliationRoutes(app);
    const db = { prepare() { throw new Error('Cash gate must not query old shift topology'); } };
    const request = (method: string, suffix: string) => app.request(`/api/shifts/1/${suffix}`, { method }, { AURA_DB: db });
    expect((await request('GET', 'reconciliation')).status).toBe(401);
    mockUser = { sub: 'customer', role: 'customer' };
    expect((await request('POST', 'reconcile')).status).toBe(403);
    mockUser = { sub: 'manager', role: 'manager' };
    for (const [method, suffix] of [['GET', 'reconciliation'], ['POST', 'reconcile']]) {
      const response = await request(method, suffix);
      expect(response.status).toBe(501);
      expect((await response.json()).code).toBe('PILOT_CASH_RECONCILIATION_DISABLED');
    }
  });

  it('maps invalid input to HTTP 400 and internal/rollback failures to HTTP 500 without leaking raw errors on both routers', async () => {
    const failingDb = {
      prepare(sql: string) {
        if (/FROM tenants/i.test(sql)) {
          return {
            bind() {
              return { async first() { return null; } };
            },
          };
        }
        if (/FROM staff_shifts/i.test(sql)) {
          return {
            bind() {
              return {
                async first() {
                  return {
                    clock_in: '2026-11-21T01:00:00Z',
                    clock_out: null,
                    opening_cash: 100000,
                    staff_id: 'staff-1',
                    tenant_id: 'store-a',
                  };
                },
              };
            },
          };
        }
        if (/FROM users/i.test(sql)) {
          return {
            bind() {
              return {
                async first() {
                  return { id: 'manager-1', role: 'manager', tenant_id: 'store-a', is_active: 1 };
                },
              };
            },
          };
        }
        if (/FROM shift_reconciliations/i.test(sql)) {
          return {
            bind() {
              return { async first() { return null; } };
            },
          };
        }
        return {
          bind() {
            return {
              async first() { throw new Error('CRITICAL: shift reconciliation verification failed (Shift not found) and rollback failed'); },
              async all() { throw new Error('CRITICAL: shift reconciliation verification failed (Shift not found) and rollback failed'); },
              async run() { throw new Error('CRITICAL: shift reconciliation verification failed (Shift not found) and rollback failed'); },
            };
          },
        };
      },
    };

    const mockUser = { sub: 'manager-1', id: 'manager-1', role: 'manager', tenant_id: 'store-a' };
    const env = { AURA_DB: failingDb, CASH_RECONCILIATION_ENABLED: 'true' };

    const domainApp = new Hono<{ Variables: { user: typeof mockUser } }>();
    domainApp.use('*', async (c, next) => {
      c.set('user', mockUser);
      await next();
    });
    reconciliationRoutes(domainApp as unknown as Parameters<typeof reconciliationRoutes>[0]);

    const workerApp = new Hono<{ Variables: { user: typeof mockUser } }>();
    workerApp.use('*', async (c, next) => {
      c.set('user', mockUser);
      await next();
    });
    workerApp.route('/api/shifts', shiftReconciliationRouter as unknown as Hono<{ Variables: { user: typeof mockUser } }>);

    for (const app of [domainApp, workerApp]) {
      const nullPayloadRes = await app.request(
        '/api/shifts/shift-1/reconcile',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'null',
        },
        env,
      );
      expect(nullPayloadRes.status).toBe(400);

      for (const badBody of [
        { opening_float: -1000, denominations: { denominations: [] } },
        { opening_float: 0, actual_cash_counted: -1, denominations: { denominations: [] } },
        { opening_float: 0, denominations: { denominations: [{ denomination: -50000, count: 1 }] } },
      ]) {
        const badInputRes = await app.request(
          '/api/shifts/shift-1/reconcile',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(badBody),
          },
          env,
        );
        expect(badInputRes.status).toBe(400);
        const badInputBody = (await badInputRes.json()) as { success: boolean; error: string };
        expect(badInputBody.success).toBe(false);
        expect(badInputBody.error).toContain('Invalid');
      }

      const internalErrRes = await app.request(
        '/api/shifts/shift-1/reconcile',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opening_float: 100000, denominations: { denominations: [{ denomination: 100000, count: 1 }] } }),
        },
        env,
      );
      expect(internalErrRes.status).toBe(500);
      const internalErrBody = (await internalErrRes.json()) as { success: boolean; error: string };
      expect(internalErrBody).toEqual({ success: false, error: 'Failed to reconcile shift cash' });
    }
  });
});
