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
  if (!Array.isArray(denominations)) return 0;
  return denominations.reduce((sum, d) => {
    const denom = typeof d?.denomination === 'number' && Number.isFinite(d.denomination) && d.denomination > 0 ? d.denomination : 0;
    const count = typeof d?.count === 'number' && Number.isFinite(d.count) && d.count > 0 ? d.count : 0;
    return sum + denom * count;
  }, 0);
}

function determineVarianceStatus(variance: number): VarianceStatus {
  if (variance === 0) return 'balanced';
  return variance > 0 ? 'overage' : 'shortage';
}

async function getShiftWindow(
  db: D1Database,
  shiftId: string,
  tenantId?: string
): Promise<{ clock_in: string; clock_out: string | null; opening_cash?: number | null; staff_id?: string | null; tenant_id?: string | null } | null> {
  const rawNormTenant = tenantId ? tenantId.trim() : undefined;
  const normTenant = rawNormTenant === 'hq' ? '*' : rawNormTenant;
  const matchesTenant = (row: { tenant_id?: string | null }) => {
    if (!normTenant || normTenant === '*') return true;
    if (!('tenant_id' in row) || row.tenant_id === undefined) {
      return normTenant === 'default';
    }
    const rowTenant = typeof row.tenant_id === 'string' && row.tenant_id.trim() ? row.tenant_id.trim() : 'default';
    return rowTenant === normTenant;
  };
  const allowUnscopedFallback = !normTenant || normTenant === '*' || normTenant === 'default';
  if (normTenant) {
    try {
      const staffShift = await db
        .prepare('SELECT clock_in, clock_out, opening_cash, staff_id, tenant_id FROM staff_shifts WHERE id = ?')
        .bind(shiftId)
        .first<{ clock_in: string; clock_out: string | null; opening_cash?: number | null; staff_id?: string | null; tenant_id?: string | null }>();
      if (staffShift) return matchesTenant(staffShift) ? staffShift : null;
    } catch {
      // Fallback when opening_cash or staff_id column is absent
    }
    try {
      const staffShift = await db
        .prepare('SELECT clock_in, clock_out, tenant_id FROM staff_shifts WHERE id = ?')
        .bind(shiftId)
        .first<{ clock_in: string; clock_out: string | null; tenant_id?: string | null }>();
      if (staffShift) return matchesTenant(staffShift) ? staffShift : null;
    } catch {
      // Fallback to legacy query when tenant_id column is absent
    }
  }
  if (allowUnscopedFallback) {
    try {
      const staffShift = await db
        .prepare('SELECT clock_in, clock_out, opening_cash, staff_id FROM staff_shifts WHERE id = ?')
        .bind(shiftId)
        .first<{ clock_in: string; clock_out: string | null; opening_cash?: number | null; staff_id?: string | null; tenant_id?: string | null }>();
      if (staffShift) return matchesTenant(staffShift) ? staffShift : null;
    } catch {
      // Fallback when opening_cash or staff_id column is absent
    }
    try {
      const staffShift = await db
        .prepare('SELECT clock_in, clock_out FROM staff_shifts WHERE id = ?')
        .bind(shiftId)
        .first<{ clock_in: string; clock_out: string | null; tenant_id?: string | null }>();
      if (staffShift) return matchesTenant(staffShift) ? staffShift : null;
    } catch {
      // Fallback to legacy shifts table when staff_shifts is absent in unit test mocks
    }
  }
  if (normTenant) {
    try {
      const row = await db
        .prepare('SELECT clock_in, clock_out, opening_cash, staff_id, tenant_id FROM shifts WHERE id = ?')
        .bind(shiftId)
        .first<{ clock_in: string; clock_out: string | null; opening_cash?: number | null; staff_id?: string | null; tenant_id?: string | null }>();
      if (row) return matchesTenant(row) ? row : null;
    } catch {
      // Fallback when opening_cash or staff_id column is absent
    }
    try {
      const row = await db
        .prepare('SELECT clock_in, clock_out, tenant_id FROM shifts WHERE id = ?')
        .bind(shiftId)
        .first<{ clock_in: string; clock_out: string | null; tenant_id?: string | null }>();
      if (row) return matchesTenant(row) ? row : null;
    } catch {
      // Fallback to legacy query when tenant_id column is absent
    }
    try {
      const row = await db
        .prepare('SELECT COALESCE(actual_start, start_time) AS clock_in, actual_end AS clock_out, tenant_id FROM shifts WHERE id = ?')
        .bind(shiftId)
        .first<{ clock_in: string; clock_out: string | null; tenant_id?: string | null }>();
      if (row) return matchesTenant(row) ? row : null;
    } catch {
      // Fallback when actual_start/start_time/tenant_id columns are absent
    }
  }
  if (!allowUnscopedFallback) {
    return null;
  }
  try {
    const row = await db
      .prepare('SELECT clock_in, clock_out, opening_cash, staff_id FROM shifts WHERE id = ?')
      .bind(shiftId)
      .first<{ clock_in: string; clock_out: string | null; opening_cash?: number | null; staff_id?: string | null; tenant_id?: string | null }>();
    if (row) return matchesTenant(row) ? row : null;
  } catch {
    // Fallback when opening_cash or staff_id column is absent
  }
  try {
    const row = await db
      .prepare('SELECT clock_in, clock_out FROM shifts WHERE id = ?')
      .bind(shiftId)
      .first<{ clock_in: string; clock_out: string | null; tenant_id?: string | null }>();
    if (row) return matchesTenant(row) ? row : null;
  } catch {
    // Fallback to shifts with actual_start/start_time
  }
  try {
    return await db
      .prepare('SELECT COALESCE(actual_start, start_time) AS clock_in, actual_end AS clock_out FROM shifts WHERE id = ?')
      .bind(shiftId)
      .first<{ clock_in: string; clock_out: string | null }>();
  } catch {
    return null;
  }
}

function resolveShiftTenant(
  shift: { tenant_id?: string | null },
  tenantId?: string
): string | undefined {
  const rawNormTenant = tenantId ? tenantId.trim() : undefined;
  const normTenant = rawNormTenant === 'hq' ? '*' : rawNormTenant;
  if (normTenant && normTenant !== '*') return normTenant;
  if ('tenant_id' in shift && shift.tenant_id !== undefined) {
    return typeof shift.tenant_id === 'string' && shift.tenant_id.trim() ? shift.tenant_id.trim() : 'default';
  }
  return undefined;
}

/**
 * Fetch cash payments received during shift time window.
 */
async function getCashPaymentsForShift(
  db: D1Database,
  shiftId: string,
  tenantId?: string
): Promise<number> {
  const shift = await getShiftWindow(db, shiftId, tenantId);

  if (!shift) return 0;

  const endTime = shift.clock_out || new Date().toISOString();
  const effectiveTenant = resolveShiftTenant(shift, tenantId);

  if (effectiveTenant) {
    try {
      const scopedResult = await db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as total FROM payments
           WHERE method IN ('cash', 'cod')
           AND created_at >= ? AND created_at <= ?
           AND status = 'completed'
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        )
        .bind(shift.clock_in, endTime, effectiveTenant)
        .first<{ total: number }>();

      if (scopedResult && typeof scopedResult.total === 'number') {
        return scopedResult.total;
      }
    } catch {
      // Fallback to joining orders when payments.tenant_id is absent
    }

    try {
      const joinedResult = await db
        .prepare(
          `SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p
           LEFT JOIN orders o ON o.id = p.order_id
           WHERE p.method IN ('cash', 'cod')
           AND p.created_at >= ? AND p.created_at <= ?
           AND p.status = 'completed'
           AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?`
        )
        .bind(shift.clock_in, endTime, effectiveTenant)
        .first<{ total: number }>();

      if (joinedResult && typeof joinedResult.total === 'number') {
        return joinedResult.total;
      }
    } catch {
      // Fallback only for default tenant
    }

    if (effectiveTenant !== 'default') {
      return 0;
    }
  }

  try {
    const result = await db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM payments
         WHERE method IN ('cash', 'cod')
         AND created_at >= ? AND created_at <= ?
         AND status = 'completed'`
      )
      .bind(shift.clock_in, endTime)
      .first<{ total: number }>();

    if (result && typeof result.total === 'number') {
      return result.total;
    }
  } catch {
    // Fallback for legacy schema/mocks using payment_method column
  }

  try {
    const legacyResult = await db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM payments
         WHERE payment_method = 'cash'
         AND created_at >= ? AND created_at <= ?
         AND status = 'completed'`
      )
      .bind(shift.clock_in, endTime)
      .first<{ total: number }>();

    return legacyResult?.total ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch cash payouts/refunds during shift time window.
 */
async function getCashPayoutsForShift(
  db: D1Database,
  shiftId: string,
  tenantId?: string
): Promise<number> {
  const shift = await getShiftWindow(db, shiftId, tenantId);

  if (!shift) return 0;

  const endTime = shift.clock_out || new Date().toISOString();
  const effectiveTenant = resolveShiftTenant(shift, tenantId);

  if (effectiveTenant) {
    try {
      const scopedResult = await db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as total FROM cash_payouts
           WHERE created_at >= ? AND created_at <= ?
           AND status = 'completed'
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        )
        .bind(shift.clock_in, endTime, effectiveTenant)
        .first<{ total: number }>();

      if (scopedResult && typeof scopedResult.total === 'number') {
        return scopedResult.total;
      }
    } catch {
      // Fallback to joining orders when cash_payouts.tenant_id is absent
    }

    try {
      const joinedResult = await db
        .prepare(
          `SELECT COALESCE(SUM(p.amount), 0) as total FROM cash_payouts p
           LEFT JOIN orders o ON o.id = p.order_id
           WHERE p.created_at >= ? AND p.created_at <= ?
           AND p.status = 'completed'
           AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?`
        )
        .bind(shift.clock_in, endTime, effectiveTenant)
        .first<{ total: number }>();

      if (joinedResult && typeof joinedResult.total === 'number') {
        return joinedResult.total;
      }
    } catch {
      // Fallback only for default tenant
    }

    if (effectiveTenant !== 'default') {
      return 0;
    }
  }

  try {
    const result = await db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_payouts
         WHERE created_at >= ? AND created_at <= ?
         AND status = 'completed'`
      )
      .bind(shift.clock_in, endTime)
      .first<{ total: number }>();

    return result?.total ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Perform cash reconciliation for a shift.
 * Computes expected_cash = opening_float + cash_payments - cash_payouts
 * Computes variance = actual_cash - expected_cash
 */
export async function reconcileShiftCash(
  env: Env | D1Database,
  input: ReconciliationInput,
  staffId: string,
  tenantId?: string
): Promise<ShiftReconciliation> {
  const db = (env as Env)?.AURA_DB ?? (env as D1Database);
  const rawTenant = tenantId ? tenantId.trim() : '';
  const hasExplicitTenant = Boolean(rawTenant);
  const normTenant = hasExplicitTenant ? (rawTenant === 'hq' ? '*' : rawTenant) : 'default';

  if (typeof input.opening_float !== 'number' || !Number.isFinite(input.opening_float) || input.opening_float < 0) {
    throw new Error('Invalid opening_float: must be a non-negative number');
  }
  const rawActualCounted =
    (input as unknown as Record<string, unknown>).actual_cash_counted ??
    (input.denominations as unknown as Record<string, unknown> | undefined)?.actual_cash_counted ??
    (input.denominations as unknown as Record<string, unknown> | undefined)?.total_counted ??
    (input.denominations as unknown as Record<string, unknown> | undefined)?.total_amount;
  if (
    rawActualCounted !== undefined &&
    (typeof rawActualCounted !== 'number' || !Number.isFinite(rawActualCounted) || rawActualCounted < 0)
  ) {
    throw new Error('Invalid actual_cash_counted: must be a non-negative number');
  }
  if (Array.isArray(input.denominations?.denominations)) {
    for (const d of input.denominations.denominations) {
      if (
        typeof d?.denomination !== 'number' ||
        !Number.isFinite(d.denomination) ||
        d.denomination < 0 ||
        typeof d?.count !== 'number' ||
        !Number.isFinite(d.count) ||
        d.count < 0
      ) {
        throw new Error('Invalid cash denomination or count: must be non-negative numbers');
      }
    }
  }

  const shiftWindow = await getShiftWindow(db, input.shift_id, normTenant);
  if (hasExplicitTenant && normTenant !== '*' && !shiftWindow) {
    throw new Error('Shift not found or belongs to another tenant');
  }
  const candidateStaffId = (input as { staff_id?: string }).staff_id ?? staffId;
  if (
    shiftWindow?.staff_id &&
    typeof shiftWindow.staff_id === 'string' &&
    shiftWindow.staff_id.trim() !== '' &&
    typeof candidateStaffId === 'string' &&
    candidateStaffId.trim() !== '' &&
    shiftWindow.staff_id.trim() !== candidateStaffId.trim()
  ) {
    throw new Error("Shift operator mismatch: cannot reconcile another staff member's shift");
  }

  let effectiveReconTenant = normTenant && normTenant !== '*' ? normTenant : undefined;
  if (!effectiveReconTenant && shiftWindow) {
    effectiveReconTenant = resolveShiftTenant(shiftWindow, normTenant);
  }

  // Prevent duplicate reconciliation for the same shift within the tenant
  try {
    let existingRecon: Record<string, unknown> | null = null;
    if (effectiveReconTenant && effectiveReconTenant !== '*') {
      try {
        existingRecon = await db
          .prepare(
            "SELECT id, shift_id, tenant_id FROM shift_reconciliations WHERE shift_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
          )
          .bind(input.shift_id, effectiveReconTenant)
          .first<Record<string, unknown>>();
      } catch {
        if (effectiveReconTenant === 'default' || normTenant === '*') {
          existingRecon = await db
            .prepare('SELECT id, shift_id FROM shift_reconciliations WHERE shift_id = ? LIMIT 1')
            .bind(input.shift_id)
            .first<Record<string, unknown>>();
        }
      }
    } else {
      existingRecon = await db
        .prepare('SELECT id, shift_id FROM shift_reconciliations WHERE shift_id = ? LIMIT 1')
        .bind(input.shift_id)
        .first<Record<string, unknown>>();
    }
    if (
      existingRecon &&
      (existingRecon.shift_id === input.shift_id || String(existingRecon.id || '').startsWith('recon_'))
    ) {
      throw new Error(`Shift ${input.shift_id} has already been reconciled`);
    }
  } catch (err) {
    if ((err as Error)?.message?.includes('already been reconciled')) {
      throw err;
    }
  }

  const actualCash = Array.isArray(input.denominations?.denominations)
    ? calculateTotalCash(input.denominations.denominations)
    : typeof rawActualCounted === 'number'
      ? rawActualCounted
      : 0;
  const authoritativeOpeningFloat =
    shiftWindow &&
    shiftWindow.opening_cash !== undefined &&
    shiftWindow.opening_cash !== null &&
    Number.isFinite(Number(shiftWindow.opening_cash)) &&
    Number(shiftWindow.opening_cash) >= 0
      ? Number(shiftWindow.opening_cash)
      : input.opening_float;
  const cashPayments = await getCashPaymentsForShift(db, input.shift_id, normTenant);
  const cashPayouts = await getCashPayoutsForShift(db, input.shift_id, normTenant);
  const expectedCash = authoritativeOpeningFloat + cashPayments - cashPayouts;
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

  if (effectiveReconTenant && effectiveReconTenant !== '*') {
    try {
      await db.prepare(
        `INSERT INTO shift_reconciliations (
          id, shift_id, staff_id, opening_float, expected_cash, actual_cash,
          variance, variance_status, denominations, cash_payment_total,
          cash_payout_total, notes, tenant_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        effectiveReconTenant,
        reconciliation.created_at
      ).run();
      return reconciliation;
    } catch (err) {
      if (effectiveReconTenant !== 'default') throw err;
    }
  }

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
  env: Env | D1Database,
  shiftId: string,
  tenantId?: string
): Promise<ShiftReconciliation | null> {
  const db = (env as Env)?.AURA_DB ?? (env as D1Database);
  const rawTenant = tenantId && tenantId.trim() ? tenantId.trim() : 'default';
  const normTenant = rawTenant === 'hq' ? '*' : rawTenant;

  let row: Record<string, unknown> | null = null;
  if (normTenant !== '*') {
    try {
      row = await db
        .prepare(
          "SELECT * FROM shift_reconciliations WHERE shift_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        )
        .bind(shiftId, normTenant)
        .first<Record<string, unknown>>();
    } catch {
      row =
        normTenant === 'default'
          ? await db
              .prepare('SELECT * FROM shift_reconciliations WHERE shift_id = ?')
              .bind(shiftId)
              .first<Record<string, unknown>>()
          : null;
    }
  } else {
    row = await db
      .prepare('SELECT * FROM shift_reconciliations WHERE shift_id = ?')
      .bind(shiftId)
      .first<Record<string, unknown>>();
  }

  if (!row) return null;
  if (normTenant !== '*') {
    if (!('tenant_id' in row) || row.tenant_id === undefined) {
      if (normTenant !== 'default') return null;
    } else {
      const rowTenant = typeof row.tenant_id === 'string' && row.tenant_id.trim() ? row.tenant_id.trim() : 'default';
      if (rowTenant !== normTenant) return null;
    }
  }

  return {
    ...(row as unknown as ShiftReconciliation),
    denominations: typeof row.denominations === 'string'
      ? JSON.parse(row.denominations)
      : row.denominations as ShiftReconciliation['denominations'],
  };
}
