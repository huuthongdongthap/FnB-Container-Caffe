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
  const tenant = tenantId?.trim() || 'default';
  return db.prepare(`SELECT clock_in, clock_out, opening_cash, staff_id, tenant_id FROM staff_shifts
    WHERE CAST(id AS TEXT) = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`)
    .bind(shiftId, tenant).first();
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
    .bind(tenant, now, tenant, shift.clock_in, shift.clock_out || now)
    .all<{ id: string; amount: number; shift_id: string | null; candidates: number }>();
  let total = 0;
  for (const row of rows.results) {
    if (row.shift_id !== null) {
      if (String(row.shift_id) === String(shiftId)) total += row.amount;
    } else {
      if (row.candidates !== 1) throw new ShiftContractError('Ambiguous cash payment responsibility; assign collecting shift before reconciliation', 409);
      total += row.amount;
    }
  }
  return total;
}

/**
 * Fetch cash payouts/refunds during shift time window.
 */
async function getCashPayoutsForShift(
  db: D1Database,
  shiftId: string,
  tenantId?: string
): Promise<number> {
  const result = await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM cash_payouts
    WHERE shift_id = ? AND status = 'completed'
      AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`)
    .bind(shiftId, tenantId || 'default').first<{ total: number }>();
  return result?.total || 0;
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
  actorRole = 'staff'
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
    throw new ShiftContractError('Shift not found or belongs to another tenant', 404);
  }
  if (!shiftWindow?.staff_id || !shiftWindow.clock_in) throw new ShiftContractError('Shift not found', 404);
  if (!['staff', 'cashier', 'waiter', 'supervisor', 'manager', 'owner', 'admin'].includes(actorRole) ||
      (shiftWindow.staff_id !== staffId && !['manager', 'owner', 'admin'].includes(actorRole))) {
    throw new ShiftContractError('Forbidden reconciliation actor', 403);
  }
  const actor = await db.prepare('SELECT tenant_id, role, is_active FROM users WHERE id = ?').bind(staffId)
    .first<{ tenant_id: string | null; role: string; is_active: number }>();
  if (!actor || actor.is_active !== 1 || actor.role !== actorRole || (actor.tenant_id?.trim() || 'default') !== normTenant) {
    throw new ShiftContractError('Forbidden cross-tenant or inactive reconciliation actor', 403);
  }
  if (normTenant === '*') throw new ShiftContractError('Concrete tenant required', 403);

  let effectiveReconTenant = normTenant && normTenant !== '*' ? normTenant : undefined;
  if (!effectiveReconTenant && shiftWindow) {
    effectiveReconTenant = resolveShiftTenant(shiftWindow, normTenant);
  }

  const existingRecon = await db.prepare(`SELECT id FROM shift_reconciliations
    WHERE shift_id = ? AND tenant_id = ? LIMIT 1`)
    .bind(input.shift_id, effectiveReconTenant || 'default').first();
  if (existingRecon) throw new ShiftContractError(`Shift ${input.shift_id} has already been reconciled`, 409);

  const actualCash = typeof rawActualCounted === 'number' ? rawActualCounted : Array.isArray(input.denominations?.denominations)
    ? calculateTotalCash(input.denominations.denominations)
    : typeof rawActualCounted === 'number'
      ? rawActualCounted
      : 0;
  if (typeof shiftWindow.opening_cash !== 'number' || !Number.isFinite(shiftWindow.opening_cash) || shiftWindow.opening_cash < 0) {
    throw new ShiftContractError('Invalid recorded opening_cash', 409);
  }
  const authoritativeOpeningFloat = shiftWindow.opening_cash;
  if (authoritativeOpeningFloat !== input.opening_float) {
    throw new ShiftContractError('Opening float does not match recorded opening_cash', 409);
  }
  const reconciliationTime = new Date().toISOString();
  const cashPayments = await getCashPaymentsForShift(db, input.shift_id, normTenant, reconciliationTime);
  const cashPayouts = await getCashPayoutsForShift(db, input.shift_id, normTenant);
  const expectedCash = authoritativeOpeningFloat + cashPayments - cashPayouts;
  const variance = actualCash - expectedCash;
  const varianceStatus = determineVarianceStatus(variance);

  const reconciliation: ShiftReconciliation = {
    id: `recon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    shift_id: input.shift_id,
    staff_id: shiftWindow.staff_id,
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
        id, shift_id, staff_id, reconciled_by, tenant_id, opening_float, opening_cash,
        expected_cash, actual_cash, variance, variance_amount, variance_status, status,
        denominations, cash_payment_total, cash_sales, cash_payout_total, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(reconciliation.id, input.shift_id, shiftWindow.staff_id, staffId, effectiveReconTenant || 'default',
        authoritativeOpeningFloat, authoritativeOpeningFloat, expectedCash, actualCash, variance, variance,
        varianceStatus, varianceStatus, JSON.stringify(input.denominations), cashPayments, cashPayments,
        cashPayouts, reconciliation.notes, reconciliation.created_at).run();
  } catch (err) {
    if (/UNIQUE|constraint/i.test(String(err))) {
      throw new ShiftContractError(`Shift ${input.shift_id} has already been reconciled`, 409);
    }
    throw err;
  }

  // Re-verify cash ledger after locking the reconciliation row so a concurrent COD collection
  // settled between the read and insert cannot be silently omitted from the handover total.
  const verifiedCashPayments = await getCashPaymentsForShift(db, input.shift_id, normTenant, new Date().toISOString());
  if (verifiedCashPayments !== cashPayments) {
    await db.prepare('DELETE FROM shift_reconciliations WHERE id = ?').bind(reconciliation.id).run().catch(() => {});
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
