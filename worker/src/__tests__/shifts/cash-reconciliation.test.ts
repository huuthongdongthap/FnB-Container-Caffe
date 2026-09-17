import { describe, it, expect } from 'vitest';
import { createMockDB, createMockEnv } from '../test-utils';
import {
  reconcileShiftCash,
  getReconciliationForShift,
} from '@aura/domain-shift';

interface Denomination {
  denomination: number;
  count: number;
}

function makeReconciliationMockDB(opts: {
  shift: { clock_in: string; clock_out: string | null } | null;
  cashPayments?: number;
  cashPayouts?: number;
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
        if (sql.includes('SELECT clock_in, clock_out FROM shifts')) {
          return opts.shift;
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
      all: async () => ({ results: [], success: true }),
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
});
