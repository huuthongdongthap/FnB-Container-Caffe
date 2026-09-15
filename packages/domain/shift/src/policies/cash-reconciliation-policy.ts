import type {
  ShiftReconciliation,
  ReconciliationInput,
  VarianceStatus,
} from '../model/reconciliation-types';

interface D1Database {
  prepare: (sql: string) => {
    bind: (...args: any[]) => {
      all: <T = any>() => Promise<{ results: T[] }>;
      first: <T = any>() => Promise<T | null>;
      run: () => Promise<{ meta: { changes: number } }>;
    };
  };
  batch: (ops: any[]) => Promise<any[]>;
}

interface Env {
  AURA_DB: D1Database;
}

function calculateTotalCash(denominations: { denomination: number; count: number }[]): number {
  return denominations.reduce((sum, d) => sum + d.denomination * d.count, 0);
}

function determineVarianceStatus(variance: number): VarianceStatus {
  if (variance === 0) return 'balanced';
  return variance > 0 ? 'overage' : 'shortage';
}

/**
 * Fetch cash payments received during shift time window.
 */
async function getCashPaymentsForShift(
  db: D1Database,
  shiftId: string
): Promise<number> {
  const shift = await db
    .prepare('SELECT clock_in, clock_out FROM shifts WHERE id = ?')
    .bind(shiftId)
    .first<{ clock_in: string; clock_out: string | null }>();

  if (!shift) return 0;

  const endTime = shift.clock_out || new Date().toISOString();

  const result = await db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments
       WHERE payment_method = 'cash'
       AND created_at >= ? AND created_at <= ?
       AND status = 'completed'`
    )
    .bind(shift.clock_in, endTime)
    .first<{ total: number }>();

  return result?.total ?? 0;
}

/**
 * Fetch cash payouts/refunds during shift time window.
 */
async function getCashPayoutsForShift(
  db: D1Database,
  shiftId: string
): Promise<number> {
  const shift = await db
    .prepare('SELECT clock_in, clock_out FROM shifts WHERE id = ?')
    .bind(shiftId)
    .first<{ clock_in: string; clock_out: string | null }>();

  if (!shift) return 0;

  const endTime = shift.clock_out || new Date().toISOString();

  const result = await db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM cash_payouts
       WHERE created_at >= ? AND created_at <= ?
       AND status = 'completed'`
    )
    .bind(shift.clock_in, endTime)
    .first<{ total: number }>();

  return result?.total ?? 0;
}

/**
 * Perform cash reconciliation for a shift.
 * Computes expected_cash = opening_float + cash_payments - cash_payouts
 * Computes variance = actual_cash - expected_cash
 */
export async function reconcileShiftCash(
  env: Env,
  input: ReconciliationInput,
  staffId: string
): Promise<ShiftReconciliation> {
  const db = env.AURA_DB;

  const actualCash = calculateTotalCash(input.denominations.denominations);
  const cashPayments = await getCashPaymentsForShift(db, input.shift_id);
  const cashPayouts = await getCashPayoutsForShift(db, input.shift_id);
  const expectedCash = input.opening_float + cashPayments - cashPayouts;
  const variance = actualCash - expectedCash;
  const varianceStatus = determineVarianceStatus(variance);

  const reconciliation: ShiftReconciliation = {
    id: `recon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    shift_id: input.shift_id,
    staff_id: staffId,
    opening_float: input.opening_float,
    expected_cash: expectedCash,
    actual_cash: actualCash,
    variance,
    variance_status: varianceStatus,
    denominations: input.denominations,
    cash_payment_total: cashPayments,
    cash_payout_total: cashPayouts,
    notes: input.notes ?? null,
    created_at: new Date().toISOString(),
  };

  await db.prepare(
    `INSERT INTO shift_reconciliations (
      id, shift_id, staff_id, opening_float, expected_cash, actual_cash,
      variance, variance_status, denominations, cash_payment_total,
      cash_payout_total, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    reconciliation.id,
    reconciliation.shift_id,
    reconciliation.staff_id,
    reconciliation.opening_float,
    reconciliation.expected_cash,
    reconciliation.actual_cash,
    reconciliation.variance,
    reconciliation.variance_status,
    JSON.stringify(reconciliation.denominations),
    reconciliation.cash_payment_total,
    reconciliation.cash_payout_total,
    reconciliation.notes,
    reconciliation.created_at
  ).run();

  return reconciliation;
}

export async function getReconciliationForShift(
  env: Env,
  shiftId: string
): Promise<ShiftReconciliation | null> {
  const db = env.AURA_DB;

  const row = await db
    .prepare('SELECT * FROM shift_reconciliations WHERE shift_id = ?')
    .bind(shiftId)
    .first<Record<string, unknown>>();

  if (!row) return null;

  return {
    ...(row as unknown as ShiftReconciliation),
    denominations: typeof row.denominations === 'string'
      ? JSON.parse(row.denominations)
      : row.denominations as ShiftReconciliation['denominations'],
  };
}
