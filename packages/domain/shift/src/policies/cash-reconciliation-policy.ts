import type {
  ShiftReconciliation,
  ReconciliationInput,
  VarianceStatus,
} from '../model/reconciliation-types';

import type { D1Database } from '@cloudflare/workers-types';
import { ShiftContractError } from '../../commands/shift-access';

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

  if (normTenant && normTenant !== '*') {
    try {
      const scoped = await db
        .prepare(
          `SELECT clock_in, clock_out, opening_cash, staff_id, tenant_id FROM staff_shifts
           WHERE CAST(id AS TEXT) = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        )
        .bind(shiftId, normTenant)
        .first<{ clock_in: string; clock_out: string | null; opening_cash?: number | null; staff_id?: string | null; tenant_id?: string | null }>();
      if (scoped && typeof scoped.clock_in === 'string') return matchesTenant(scoped) ? scoped : null;
    } catch {
      // Fallback for schemas or mocks missing opening_cash/staff_id/CAST
    }
  } else {
    try {
      const hqShift = await db
        .prepare('SELECT clock_in, clock_out, opening_cash, staff_id, tenant_id FROM staff_shifts WHERE CAST(id AS TEXT) = ?')
        .bind(shiftId)
        .first<{ clock_in: string; clock_out: string | null; opening_cash?: number | null; staff_id?: string | null; tenant_id?: string | null }>();
      if (hqShift && typeof hqShift.clock_in === 'string') return matchesTenant(hqShift) ? hqShift : null;
    } catch {
      // Fallback below
    }
  }

  for (const sql of [
    'SELECT clock_in, clock_out, opening_cash, staff_id, tenant_id FROM staff_shifts WHERE id = ?',
    'SELECT clock_in, clock_out, tenant_id FROM staff_shifts WHERE id = ?',
    'SELECT clock_in, clock_out, opening_cash, staff_id, tenant_id FROM shifts WHERE id = ?',
  ]) {
    try {
      const row = await db
        .prepare(sql)
        .bind(shiftId)
        .first<{ clock_in: string; clock_out: string | null; opening_cash?: number | null; staff_id?: string | null; tenant_id?: string | null }>();
      if (row && typeof row.clock_in === 'string') return matchesTenant(row) ? row : null;
    } catch {
      // Try next fallback
    }
  }

  if (!allowUnscopedFallback) return null;

  try {
    const row = await db
      .prepare('SELECT clock_in, clock_out, opening_cash, staff_id FROM staff_shifts WHERE id = ?')
      .bind(shiftId)
      .first<{ clock_in: string; clock_out: string | null; opening_cash?: number | null; staff_id?: string | null; tenant_id?: string | null }>();
    if (row && typeof row.clock_in === 'string') return matchesTenant(row) ? row : null;
  } catch {
    return null;
  }
  return null;
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
  tenantId?: string,
  asOf?: string
): Promise<number> {
  const shift = await getShiftWindow(db, shiftId, tenantId);
  if (!shift?.clock_in) throw new ShiftContractError('Shift not found', 404);
  const tenant = resolveShiftTenant(shift, tenantId) || 'default';
  const now = asOf || new Date().toISOString();
  const endTime = shift.clock_out || now;
  try {
    const rows = await db.prepare(`SELECT p.id, p.amount, a.shift_id,
        (SELECT COUNT(*) FROM staff_shifts s
         WHERE COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?
         AND julianday(COALESCE(a.settled_at, p.updated_at, p.created_at)) >= julianday(s.clock_in)
         AND julianday(COALESCE(a.settled_at, p.updated_at, p.created_at)) <= julianday(COALESCE(s.clock_out, ?))) AS candidates
      FROM payments p LEFT JOIN cash_payment_attributions a ON a.payment_id = p.id AND a.tenant_id = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
      WHERE p.method IN ('cash', 'cod') AND p.status = 'completed'
      AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = ?
      AND julianday(COALESCE(a.settled_at, p.updated_at, p.created_at)) >= julianday(?)
      AND julianday(COALESCE(a.settled_at, p.updated_at, p.created_at)) <= julianday(?)`)
      .bind(tenant, now, tenant, shift.clock_in, endTime)
      .all<{ id: string; amount: number; shift_id: string | null; candidates: number }>();
    if (Array.isArray(rows?.results) && (rows.results.length > 0 || Boolean(shift.staff_id))) {
      let total = 0;
      for (const row of rows.results) {
        if (row.shift_id !== null && row.shift_id !== undefined) {
          if (String(row.shift_id) === String(shiftId)) total += row.amount;
        } else {
          if (row.candidates !== 1) throw new ShiftContractError('Ambiguous cash payment responsibility; assign collecting shift before reconciliation', 409);
          total += row.amount;
        }
      }
      return total;
    }
  } catch (err) {
    if (err instanceof ShiftContractError) throw err;
    const msg = String(err);
    if (!/no such table:.*cash_payment_attributions|no such column:.*tenant_id|not a function/i.test(msg)) {
      throw err;
    }
  }

  // Legacy pre-attribution schema fallback (tenant-scoped; never falls back across non-default tenants)
  try {
    const scopedResult = await db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
         WHERE method IN ('cash', 'cod')
         AND COALESCE(updated_at, created_at) >= ? AND COALESCE(updated_at, created_at) <= ?
         AND status = 'completed'
         AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      )
      .bind(shift.clock_in, endTime, tenant)
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
        `SELECT COALESCE(SUM(p.amount), 0) AS total FROM payments p
         LEFT JOIN orders o ON o.id = p.order_id
         WHERE p.method IN ('cash', 'cod')
         AND p.created_at >= ? AND p.created_at <= ?
         AND p.status = 'completed'
         AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?`
      )
      .bind(shift.clock_in, endTime, tenant)
      .first<{ total: number }>();
    if (joinedResult && typeof joinedResult.total === 'number') {
      return joinedResult.total;
    }
  } catch {
    // Non-default tenant must fail closed to 0 rather than querying unscoped payments
  }

  if (tenant !== 'default') return 0;

  try {
    const defaultOnly = await db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
         WHERE method IN ('cash', 'cod')
         AND created_at >= ? AND created_at <= ?
         AND status = 'completed'`
      )
      .bind(shift.clock_in, endTime)
      .first<{ total: number }>();
    return defaultOnly?.total || 0;
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
  const tenant = tenantId?.trim() || 'default';
  try {
    const result = await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM cash_payouts
      WHERE shift_id = ? AND status = 'completed'
        AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`)
      .bind(shiftId, tenant).first<{ total: number }>();
    return result?.total || 0;
  } catch (err) {
    if (!/no such column:.*tenant_id/i.test(String(err))) {
      throw err;
    }
    if (tenant !== 'default') return 0;
    const fallback = await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM cash_payouts
      WHERE shift_id = ? AND status = 'completed'`)
      .bind(shiftId).first<{ total: number }>();
    return fallback?.total || 0;
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
  tenantId?: string,
  actorRole?: string
): Promise<ShiftReconciliation> {
  const db = (env as Env)?.AURA_DB ?? (env as D1Database);
  const rawTenant = tenantId ? tenantId.trim() : '';
  const hasExplicitTenant = Boolean(rawTenant);
  const normTenant = hasExplicitTenant ? (rawTenant === 'hq' ? '*' : rawTenant) : 'default';

  if (typeof input.opening_float !== 'number' || !Number.isFinite(input.opening_float) || input.opening_float < 0) {
    throw new ShiftContractError('Invalid opening_float: must be a non-negative number', 400);
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
    throw new ShiftContractError('Invalid actual_cash_counted: must be a non-negative number', 400);
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
        throw new ShiftContractError('Invalid cash denomination or count: must be non-negative numbers', 400);
      }
    }
  }

  const shiftWindow = await getShiftWindow(db, input.shift_id, normTenant);
  if (hasExplicitTenant && normTenant !== '*' && !shiftWindow) {
    throw new ShiftContractError('Shift not found or belongs to another tenant', 404);
  }
  if (!shiftWindow?.clock_in) throw new ShiftContractError('Shift not found', 404);

  const effectiveReconTenant =
    normTenant && normTenant !== '*'
      ? normTenant
      : resolveShiftTenant(shiftWindow, normTenant);
  if (!effectiveReconTenant || effectiveReconTenant === '*') {
    throw new ShiftContractError('Concrete tenant required', 403);
  }

  let actor: { tenant_id?: string | null; role: string; is_active: number } | null = null;
  try {
    actor = await db.prepare('SELECT tenant_id, role, is_active FROM users WHERE id = ?').bind(staffId)
      .first<{ tenant_id: string | null; role: string; is_active: number }>();
  } catch (err) {
    if (/no such column:.*tenant_id/i.test(String(err))) {
      const legacyActor = await db.prepare('SELECT role, is_active FROM users WHERE id = ?').bind(staffId)
        .first<{ role: string; is_active: number }>();
      actor = legacyActor ? { ...legacyActor, tenant_id: 'default' } : null;
    } else {
      throw err;
    }
  }
  const hasRealActorRow = Boolean(actor && typeof actor.is_active === 'number' && typeof actor.role === 'string');
  if (shiftWindow.staff_id) {
    if (!hasRealActorRow || !actor || actor.is_active !== 1) {
      throw new ShiftContractError('Forbidden cross-tenant or inactive reconciliation actor', 403);
    }
    const effectiveActorRole = actorRole ?? actor.role;
    if (actorRole !== undefined && actor.role !== actorRole) {
      throw new ShiftContractError('Forbidden cross-tenant or inactive reconciliation actor', 403);
    }
    if (!['staff', 'cashier', 'waiter', 'supervisor', 'manager', 'owner', 'admin'].includes(effectiveActorRole) ||
        (shiftWindow.staff_id !== staffId && !['supervisor', 'manager', 'owner', 'admin'].includes(effectiveActorRole))) {
      throw new ShiftContractError('Forbidden reconciliation actor', 403);
    }
    const actorTenant = (actor.tenant_id?.trim() || 'default').toLowerCase();
    const isHqActor = ['owner', 'admin'].includes(effectiveActorRole) && (actorTenant === 'hq' || actorTenant === '*');
    if (!isHqActor && (actor.tenant_id?.trim() || 'default') !== effectiveReconTenant) {
      throw new ShiftContractError('Forbidden cross-tenant or inactive reconciliation actor', 403);
    }
  } else if (hasRealActorRow && actor) {
    if (actor.is_active !== 1 || (actorRole !== undefined && actor.role !== actorRole)) {
      throw new ShiftContractError('Forbidden cross-tenant or inactive reconciliation actor', 403);
    }
    if (!['staff', 'cashier', 'waiter', 'supervisor', 'manager', 'owner', 'admin'].includes(actor.role)) {
      throw new ShiftContractError('Forbidden reconciliation actor', 403);
    }
    const actorTenant = (actor.tenant_id?.trim() || 'default').toLowerCase();
    const isHqActor = ['owner', 'admin'].includes(actor.role) && (actorTenant === 'hq' || actorTenant === '*');
    if (!isHqActor && (actor.tenant_id?.trim() || 'default') !== effectiveReconTenant) {
      throw new ShiftContractError('Forbidden cross-tenant or inactive reconciliation actor', 403);
    }
  }

  let existingRecon: unknown = null;
  try {
    existingRecon = await db.prepare(
      "SELECT id, shift_id, tenant_id FROM shift_reconciliations WHERE shift_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
    ).bind(input.shift_id, effectiveReconTenant).first();
  } catch (err) {
    if (effectiveReconTenant === 'default' && /no such column:.*tenant_id/i.test(String(err))) {
      existingRecon = await db.prepare(
        'SELECT id, shift_id FROM shift_reconciliations WHERE shift_id = ? LIMIT 1'
      ).bind(input.shift_id).first();
    } else {
      throw err;
    }
  }
  if (existingRecon) throw new ShiftContractError(`Shift ${input.shift_id} has already been reconciled`, 409);

  const hasDenominations = Array.isArray(input.denominations?.denominations) && input.denominations.denominations.length > 0;
  const calculatedFromDenominations = hasDenominations ? calculateTotalCash(input.denominations.denominations) : null;
  if (hasDenominations && typeof rawActualCounted === 'number' && rawActualCounted !== calculatedFromDenominations) {
    throw new ShiftContractError('actual_cash_counted does not match denomination breakdown', 400);
  }
  const actualCash = calculatedFromDenominations !== null
    ? calculatedFromDenominations
    : typeof rawActualCounted === 'number'
      ? rawActualCounted
      : 0;
  let authoritativeOpeningFloat: number;
  if (shiftWindow.opening_cash !== undefined && shiftWindow.opening_cash !== null) {
    if (typeof shiftWindow.opening_cash !== 'number' || !Number.isFinite(shiftWindow.opening_cash) || shiftWindow.opening_cash < 0) {
      throw new ShiftContractError('Invalid recorded opening_cash', 409);
    }
    authoritativeOpeningFloat = shiftWindow.opening_cash;
    if (authoritativeOpeningFloat !== input.opening_float) {
      throw new ShiftContractError('Opening float does not match recorded opening_cash', 409);
    }
  } else {
    authoritativeOpeningFloat = input.opening_float;
  }
  const reconciliationTime = new Date().toISOString();
  const cashPayments = await getCashPaymentsForShift(db, input.shift_id, effectiveReconTenant, reconciliationTime);
  const cashPayouts = await getCashPayoutsForShift(db, input.shift_id, effectiveReconTenant);
  const expectedCash = authoritativeOpeningFloat + cashPayments - cashPayouts;
  const variance = actualCash - expectedCash;
  const varianceStatus = determineVarianceStatus(variance);

  const reconciliation: ShiftReconciliation = {
    id: `recon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    shift_id: input.shift_id,
    staff_id: shiftWindow.staff_id || staffId,
    opening_float: authoritativeOpeningFloat,
    expected_cash: expectedCash,
    actual_cash: actualCash,
    variance,
    variance_status: varianceStatus,
    denominations: input.denominations,
    cash_payment_total: cashPayments,
    cash_payout_total: cashPayouts,
    notes: input.notes ?? null,
    created_at: reconciliationTime,
  };

  try {
    await db.prepare(`INSERT INTO shift_reconciliations (
        id, shift_id, staff_id, opening_float, expected_cash, actual_cash,
        variance, variance_status, denominations, cash_payment_total,
        cash_payout_total, notes, tenant_id, created_at,
        reconciled_by, opening_cash, variance_amount, status, cash_sales
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        reconciliation.id, input.shift_id, reconciliation.staff_id, authoritativeOpeningFloat,
        expectedCash, actualCash, variance, varianceStatus, JSON.stringify(input.denominations),
        cashPayments, cashPayouts, reconciliation.notes, effectiveReconTenant, reconciliation.created_at,
        staffId, authoritativeOpeningFloat, variance, varianceStatus, cashPayments
      ).run();
  } catch (err) {
    if (/UNIQUE|constraint/i.test(String(err))) {
      throw new ShiftContractError(`Shift ${input.shift_id} has already been reconciled`, 409);
    }
    if (effectiveReconTenant === 'default' && /no such column|has no column named/i.test(String(err))) {
      try {
        await db.prepare(`INSERT INTO shift_reconciliations (
            id, shift_id, staff_id, opening_float, expected_cash, actual_cash,
            variance, variance_status, denominations, cash_payment_total,
            cash_payout_total, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            reconciliation.id, input.shift_id, reconciliation.staff_id, authoritativeOpeningFloat,
            expectedCash, actualCash, variance, varianceStatus, JSON.stringify(input.denominations),
            cashPayments, cashPayouts, reconciliation.notes, reconciliation.created_at
          ).run();
      } catch (legacyErr) {
        if (/UNIQUE|constraint/i.test(String(legacyErr))) {
          throw new ShiftContractError(`Shift ${input.shift_id} has already been reconciled`, 409);
        }
        throw legacyErr;
      }
    } else {
      throw err;
    }
  }

  const deleteReconciliation = async () => {
    try {
      return await db
        .prepare('DELETE FROM shift_reconciliations WHERE id = ? AND tenant_id = ?')
        .bind(reconciliation.id, effectiveReconTenant)
        .run();
    } catch (delErr) {
      if (effectiveReconTenant === 'default' && /no such column:.*tenant_id/i.test(String(delErr))) {
        return await db
          .prepare('DELETE FROM shift_reconciliations WHERE id = ?')
          .bind(reconciliation.id)
          .run();
      }
      throw delErr;
    }
  };

  // Re-verify cash ledger (payments & payouts) after locking the reconciliation row so a concurrent
  // COD collection or payout between the read and insert cannot be silently omitted from handover.
  let verifiedCashPayments: number;
  let verifiedCashPayouts: number;
  try {
    verifiedCashPayments = await getCashPaymentsForShift(db, input.shift_id, effectiveReconTenant, new Date().toISOString());
    verifiedCashPayouts = await getCashPayoutsForShift(db, input.shift_id, effectiveReconTenant);
  } catch (verifyErr) {
    let rollbackErr: unknown = null;
    let rollbackChanges: number | undefined;
    try {
      const rollback = await deleteReconciliation();
      if (rollback.meta && typeof rollback.meta.changes === 'number') {
        rollbackChanges = rollback.meta.changes;
      }
    } catch (err) {
      rollbackErr = err;
    }
    if (rollbackErr || rollbackChanges === 0) {
      const verifyMsg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
      const rbMsg = rollbackErr
        ? (rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr))
        : 'no reconciliation row deleted';
      throw new Error(
        `CRITICAL: shift reconciliation verification failed (${verifyMsg}) and rollback failed for reconciliation ${reconciliation.id} (${rbMsg})`,
      );
    }
    throw verifyErr;
  }
  if (verifiedCashPayments !== cashPayments || verifiedCashPayouts !== cashPayouts) {
    const rollback = await deleteReconciliation();
    if (rollback.meta && typeof rollback.meta.changes === 'number' && rollback.meta.changes === 0) {
      throw new Error('Failed to roll back concurrent shift reconciliation');
    }
    throw new ShiftContractError('Shift cash ledger changed concurrently; refresh and retry reconciliation', 409);
  }

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
