import type {
  ShiftReconciliation,
  ReconciliationInput,
  VarianceStatus,
} from '../model/reconciliation-types';

import type { D1Database } from '@cloudflare/workers-types';
import {
  CASH_ASSIGN_ROLES,
  CASH_DRAWER_ROLES,
  NON_CASH_SHIFT_ROLES,
  PAYOUT_ROLES,
  RECONCILIATION_ROLES,
} from '../../model/shift-types';
import { ShiftContractError } from '../../commands/shift-access';
import { assertCashSettlementWrite, assertReconciliationSnapshot } from '../../commands/cash-settlement';

export { CASH_ASSIGN_ROLES, CASH_DRAWER_ROLES, NON_CASH_SHIFT_ROLES, PAYOUT_ROLES, RECONCILIATION_ROLES };

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
    const queryAttributionRows = (includeAttendanceState: boolean, includeOrderGuard: boolean = true) =>
      db.prepare(`SELECT p.id, p.amount, a.shift_id,
          (SELECT COUNT(*) FROM staff_shifts s
           WHERE COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?
           AND s.clock_in IS NOT NULL
           ${includeAttendanceState ? "AND LOWER(COALESCE(s.attendance_state, 'active')) <> 'cancelled'" : ''}
           AND LOWER(COALESCE(s.role, '')) NOT IN ('barista', 'kitchen', 'chef', 'bep')
           AND julianday(COALESCE(p.updated_at, p.created_at)) >= julianday(s.clock_in)
           AND julianday(COALESCE(p.updated_at, p.created_at)) <= julianday(COALESCE(s.clock_out, ?))) AS candidates
        FROM payments p LEFT JOIN cash_payment_attributions a ON a.payment_id = p.id AND a.tenant_id = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
        WHERE p.method IN ('cash', 'cod') AND p.status = 'completed'
        AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = ?
        ${includeOrderGuard ? `AND NOT EXISTS (
          SELECT 1 FROM orders o
          WHERE o.id = p.order_id
            AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
            AND (LOWER(COALESCE(o.status, '')) IN ('cancelled', 'canceled', 'failed', 'expired', 'rejected')
              OR LOWER(COALESCE(o.payment_status, '')) = 'refunded')
        )` : ''}
        AND (a.shift_id = ? OR (a.shift_id IS NULL
          AND julianday(COALESCE(p.updated_at, p.created_at)) >= julianday(?)
          AND julianday(COALESCE(p.updated_at, p.created_at)) <= julianday(?)))`)
        .bind(tenant, now, tenant, shiftId, shift.clock_in, endTime)
        .all<{ id: string; amount: number; shift_id: string | null; candidates: number }>();

    let rows: { results?: Array<{ id: string; amount: number; shift_id: string | null; candidates: number }> };
    try {
      rows = await queryAttributionRows(true, true);
    } catch (innerErr) {
      const innerMsg = String(innerErr);
      if (/no such table:.*\borders\b/i.test(innerMsg)) {
        rows = await queryAttributionRows(true, false);
      } else if (/no such column:.*attendance_state/i.test(innerMsg)) {
        rows = await queryAttributionRows(false, true).catch(() => queryAttributionRows(false, false));
      } else {
        throw innerErr;
      }
    }

    if (Array.isArray(rows?.results) && (rows.results.length > 0 || Boolean(shift.staff_id))) {
      let total = 0;
      const ambiguousPaymentIds: string[] = [];
      for (const row of rows.results) {
        if (row.shift_id !== null && row.shift_id !== undefined) {
          if (String(row.shift_id) === String(shiftId)) total += row.amount;
        } else if (row.candidates !== 1) {
          ambiguousPaymentIds.push(String(row.id));
        } else {
          total += row.amount;
        }
      }
      if (ambiguousPaymentIds.length > 0) {
        throw new ShiftContractError(
          'Ambiguous cash payment responsibility; assign collecting shift before reconciliation',
          409,
          'AMBIGUOUS_CASH_PAYMENTS',
          { ambiguous_payment_ids: ambiguousPaymentIds },
        );
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

  if (typeof input.opening_float !== 'number' || !Number.isInteger(input.opening_float) || input.opening_float < 0) {
    throw new ShiftContractError('Invalid opening_float: must be a non-negative integer', 400);
  }
  const rawActualCounted =
    (input as unknown as Record<string, unknown>).actual_cash_counted ??
    (input.denominations as unknown as Record<string, unknown> | undefined)?.actual_cash_counted ??
    (input.denominations as unknown as Record<string, unknown> | undefined)?.total_counted ??
    (input.denominations as unknown as Record<string, unknown> | undefined)?.total_amount;
  if (
    rawActualCounted !== undefined &&
    (typeof rawActualCounted !== 'number' || !Number.isInteger(rawActualCounted) || rawActualCounted < 0)
  ) {
    throw new ShiftContractError('Invalid actual_cash_counted: must be a non-negative integer', 400);
  }
  if (Array.isArray(input.denominations?.denominations)) {
    for (const d of input.denominations.denominations) {
      if (
        typeof d?.denomination !== 'number' ||
        !Number.isInteger(d.denomination) ||
        d.denomination <= 0 ||
        typeof d?.count !== 'number' ||
        !Number.isInteger(d.count) ||
        d.count < 0
      ) {
        throw new ShiftContractError('Invalid cash denomination or count: must be non-negative integers', 400);
      }
      const isValidUnitOrBill =
        d.denomination === 1 ||
        (d.denomination >= 100 &&
          d.denomination <= 500_000 &&
          d.denomination % 100 === 0 &&
          (d.denomination < 500 || d.denomination % 500 === 0));
      if (!isValidUnitOrBill) {
        throw new ShiftContractError('Invalid cash denomination or count: unsupported VND denomination', 400);
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
    if (!RECONCILIATION_ROLES.has(effectiveActorRole) ||
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
    if (!RECONCILIATION_ROLES.has(actor.role)) {
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

  const hasRemitted = input.remitted_cash !== undefined;
  const hasClosing = input.closing_float !== undefined;

  if (hasRemitted && (typeof input.remitted_cash !== 'number' || !Number.isInteger(input.remitted_cash))) {
    throw new ShiftContractError('Invalid remitted_cash: must be a non-negative integer', 400);
  }
  if (hasClosing && (typeof input.closing_float !== 'number' || !Number.isInteger(input.closing_float))) {
    throw new ShiftContractError('Invalid closing_float: must be a non-negative integer', 400);
  }

  let remittedCash: number;
  let closingFloat: number;

  if (hasRemitted && hasClosing) {
    remittedCash = input.remitted_cash as number;
    closingFloat = input.closing_float as number;
  } else if (hasRemitted) {
    remittedCash = input.remitted_cash as number;
    closingFloat = Math.max(0, actualCash - remittedCash);
  } else if (hasClosing) {
    closingFloat = input.closing_float as number;
    remittedCash = actualCash - closingFloat;
  } else {
    remittedCash = 0;
    closingFloat = actualCash;
  }

  if (remittedCash < 0 || remittedCash > actualCash) {
    throw new ShiftContractError('Invalid remitted_cash: must be between 0 and actual_cash', 400);
  }
  if (closingFloat < 0 || closingFloat > actualCash) {
    throw new ShiftContractError('Invalid closing_float: must be between 0 and actual_cash', 400);
  }
  if (remittedCash + closingFloat !== actualCash) {
    throw new ShiftContractError(
      'Invalid cash split: remitted_cash + closing_float must equal actual_cash',
      400,
    );
  }

  let handoverToStaffId: string | null = null;
  if (input.handover_to_staff_id !== undefined && input.handover_to_staff_id !== null) {
    if (typeof input.handover_to_staff_id !== 'string') {
      throw new ShiftContractError('Invalid handover_to_staff_id', 400);
    }
    const trimmedHandoverTo = input.handover_to_staff_id.trim();
    if (trimmedHandoverTo.length > 120) {
      throw new ShiftContractError('Invalid handover_to_staff_id: exceeds 120 characters', 400);
    }
    if (trimmedHandoverTo) {
      if (shiftWindow.staff_id) {
        let recipient: { tenant_id?: string | null; role: string; is_active: number } | null = null;
        try {
          recipient = await db
            .prepare('SELECT tenant_id, role, is_active FROM users WHERE id = ?')
            .bind(trimmedHandoverTo)
            .first<{ tenant_id: string | null; role: string; is_active: number }>();
        } catch (err) {
          if (/no such column:.*tenant_id/i.test(String(err))) {
            const legacyRecipient = await db
              .prepare('SELECT role, is_active FROM users WHERE id = ?')
              .bind(trimmedHandoverTo)
              .first<{ role: string; is_active: number }>();
            recipient = legacyRecipient ? { ...legacyRecipient, tenant_id: 'default' } : null;
          } else {
            throw err;
          }
        }
        const recipientTenant = (recipient?.tenant_id?.trim() || 'default').toLowerCase();
        const isHqRecipient = Boolean(recipient && ['owner', 'admin'].includes(recipient.role) && (recipientTenant === 'hq' || recipientTenant === '*'));
        const sameTenantRecipient = Boolean(recipient && (recipient.tenant_id?.trim() || 'default') === effectiveReconTenant);
        if (!recipient || recipient.is_active !== 1 || !RECONCILIATION_ROLES.has(recipient.role) || (!isHqRecipient && !sameTenantRecipient)) {
          throw new ShiftContractError('Invalid handover recipient staff member', 400);
        }
      }
      handoverToStaffId = trimmedHandoverTo;
    }
  }

  let onlineSalesTotal = 0;
  const windowEnd = shiftWindow.clock_out || reconciliationTime;
  try {
    const queryScopedOnline = async (withRefundAmount: boolean, withAttendanceState: boolean) => {
      const amountExpr = withRefundAmount ? 'MAX(0, p.amount - COALESCE(p.refund_amount, 0))' : 'p.amount';
      const tsExpr = withRefundAmount
        ? 'CASE WHEN COALESCE(p.refund_amount, 0) > 0 THEN p.created_at ELSE COALESCE(p.updated_at, p.created_at) END'
        : 'COALESCE(p.updated_at, p.created_at)';
      const onlineOrderGuard = `AND NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = p.order_id
          AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
          AND (
            LOWER(COALESCE(o.status, '')) IN ('cancelled', 'canceled', 'failed', 'expired', 'rejected', 'refunded')
            OR LOWER(COALESCE(o.payment_status, '')) = 'refunded'
          )
      )`;
      if (shiftWindow.staff_id) {
        return db
          .prepare(
            `SELECT COALESCE(SUM(${amountExpr}), 0) AS total
             FROM payments p
             WHERE LOWER(COALESCE(p.method, '')) IN ('payos', 'bank_transfer', 'qr', 'vietqr')
               AND p.status IN ('completed', 'paid', 'partially_refunded')
               AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = ?
               ${onlineOrderGuard}
               AND julianday(${tsExpr}) >= julianday(?)
               AND julianday(${tsExpr}) <= julianday(?)
               AND COALESCE(
                 (SELECT CAST(s.id AS TEXT) FROM staff_shifts s
                  WHERE COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?
                    AND s.clock_in IS NOT NULL
                    ${withAttendanceState ? "AND LOWER(COALESCE(s.attendance_state, 'active')) <> 'cancelled'" : ''}
                    AND LOWER(COALESCE(s.role, '')) NOT IN ('barista', 'kitchen', 'chef', 'bep')
                    AND julianday(${tsExpr}) >= julianday(s.clock_in)
                    AND julianday(${tsExpr}) <= julianday(COALESCE(s.clock_out, ?))
                  ORDER BY CASE WHEN LOWER(COALESCE(s.role, '')) IN ('owner', 'admin', 'manager', 'supervisor', 'cashier') THEN 0 ELSE 1 END,
                           s.clock_in ASC, s.id ASC
                  LIMIT 1),
                 ?
               ) = ?`,
          )
          .bind(
            effectiveReconTenant,
            shiftWindow.clock_in,
            windowEnd,
            effectiveReconTenant,
            reconciliationTime,
            String(input.shift_id),
            String(input.shift_id),
          )
          .first<{ total: number }>();
      }
      return db
        .prepare(
          `SELECT COALESCE(SUM(${amountExpr}), 0) AS total
           FROM payments p
           WHERE LOWER(COALESCE(p.method, '')) IN ('payos', 'bank_transfer', 'qr', 'vietqr')
             AND p.status IN ('completed', 'paid', 'partially_refunded')
             AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = ?
             ${onlineOrderGuard}
             AND julianday(${tsExpr}) >= julianday(?)
             AND julianday(${tsExpr}) <= julianday(?)`,
        )
        .bind(effectiveReconTenant, shiftWindow.clock_in, windowEnd)
        .first<{ total: number }>();
    };

    let onlineRow: { total: number } | null = null;
    try {
      onlineRow = await queryScopedOnline(true, true);
    } catch (onlineErr) {
      const msg = String(onlineErr);
      if (/no such column:.*refund_amount/i.test(msg)) {
        try {
          onlineRow = await queryScopedOnline(false, true);
        } catch (attErr) {
          if (/no such column:.*attendance_state/i.test(String(attErr))) {
            onlineRow = await queryScopedOnline(false, false);
          } else {
            throw attErr;
          }
        }
      } else if (/no such column:.*attendance_state/i.test(msg)) {
        onlineRow = await queryScopedOnline(true, false);
      } else {
        onlineRow = await db
          .prepare(
            `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
             WHERE method = 'payos' AND status = 'completed'
               AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
               AND julianday(COALESCE(updated_at, created_at)) >= julianday(?)
               AND julianday(COALESCE(updated_at, created_at)) <= julianday(?)`,
          )
          .bind(effectiveReconTenant, shiftWindow.clock_in, windowEnd)
          .first<{ total: number }>();
      }
    }
    onlineSalesTotal = onlineRow?.total || 0;
  } catch {
    onlineSalesTotal = 0;
  }

  const shouldCloseShift = Boolean(input.close_shift) && !shiftWindow.clock_out;
  const closeElapsedMs = shouldCloseShift
    ? Math.max(0, new Date(reconciliationTime).getTime() - new Date(shiftWindow.clock_in).getTime())
    : 0;
  const closeHoursWorked = shouldCloseShift
    ? Math.round((closeElapsedMs / 3_600_000) * 100) / 100
    : null;

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
    remitted_cash: remittedCash,
    closing_float: closingFloat,
    handover_to_staff_id: handoverToStaffId,
    online_sales_total: onlineSalesTotal,
    ...(shouldCloseShift
      ? {
          shift_closed: true,
          clock_out: reconciliationTime,
          hours_worked: closeHoursWorked,
        }
      : {}),
    notes: input.notes ?? null,
    created_at: reconciliationTime,
  };

  const storedDenominationsJson = JSON.stringify({
    ...input.denominations,
    remitted_cash: remittedCash,
    closing_float: closingFloat,
    handover_to_staff_id: handoverToStaffId,
    online_sales_total: onlineSalesTotal,
  });

  const buildInsertStmt = (includeHandoverColumns: boolean) =>
    includeHandoverColumns
      ? db
          .prepare(
            `INSERT INTO shift_reconciliations (
              id, shift_id, staff_id, opening_float, expected_cash, actual_cash,
              variance, variance_status, denominations, cash_payment_total,
              cash_payout_total, notes, tenant_id, created_at,
              reconciled_by, opening_cash, variance_amount, status, cash_sales,
              remitted_cash, closing_float, handover_to_staff_id, online_sales_total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            reconciliation.id,
            input.shift_id,
            reconciliation.staff_id,
            authoritativeOpeningFloat,
            expectedCash,
            actualCash,
            variance,
            varianceStatus,
            storedDenominationsJson,
            cashPayments,
            cashPayouts,
            reconciliation.notes,
            effectiveReconTenant,
            reconciliation.created_at,
            staffId,
            authoritativeOpeningFloat,
            variance,
            varianceStatus,
            cashPayments,
            remittedCash,
            closingFloat,
            handoverToStaffId,
            onlineSalesTotal,
          )
      : db
          .prepare(
            `INSERT INTO shift_reconciliations (
              id, shift_id, staff_id, opening_float, expected_cash, actual_cash,
              variance, variance_status, denominations, cash_payment_total,
              cash_payout_total, notes, tenant_id, created_at,
              reconciled_by, opening_cash, variance_amount, status, cash_sales
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            reconciliation.id,
            input.shift_id,
            reconciliation.staff_id,
            authoritativeOpeningFloat,
            expectedCash,
            actualCash,
            variance,
            varianceStatus,
            storedDenominationsJson,
            cashPayments,
            cashPayouts,
            reconciliation.notes,
            effectiveReconTenant,
            reconciliation.created_at,
            staffId,
            authoritativeOpeningFloat,
            variance,
            varianceStatus,
            cashPayments,
          );

  const buildCloseShiftStmt = (includeStatusColumn: boolean) => {
    const cleanNote = typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim() : null;
    const statusSetter = includeStatusColumn ? ", status = 'closed'" : '';
    return db
      .prepare(
        `UPDATE staff_shifts
         SET clock_out = ?,
             hours_worked = ?,
             attendance_state = 'completed'${statusSetter},
             notes = CASE
               WHEN ? IS NOT NULL THEN CASE WHEN notes IS NOT NULL AND TRIM(notes) <> '' THEN notes || '; ' || ? ELSE ? END
               ELSE notes
             END
         WHERE CAST(id AS TEXT) = ?
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
           AND clock_in = ?
           AND clock_out IS NULL`,
      )
      .bind(
        reconciliationTime,
        closeHoursWorked ?? 0,
        cleanNote,
        cleanNote,
        cleanNote,
        input.shift_id,
        effectiveReconTenant,
        shiftWindow.clock_in,
      );
  };

  let didCloseShiftInBatch = false;
  const runCommit = async (includeHandoverColumns: boolean, includeStatusColumn: boolean) => {
    const insert = buildInsertStmt(includeHandoverColumns);
    if (shiftWindow.staff_id) {
      const batchStmts = [
        insert,
        assertCashSettlementWrite(db),
        assertReconciliationSnapshot(
          db,
          input.shift_id,
          effectiveReconTenant,
          shiftWindow.clock_in,
          cashPayments,
          cashPayouts,
        ),
      ];
      if (shouldCloseShift) {
        batchStmts.push(buildCloseShiftStmt(includeStatusColumn), assertCashSettlementWrite(db));
      }
      await db.batch(batchStmts);
      if (shouldCloseShift) didCloseShiftInBatch = true;
    } else {
      await insert.run();
      if (shouldCloseShift) {
        const closedRes = await buildCloseShiftStmt(includeStatusColumn).run();
        if ((closedRes.meta?.changes ?? 0) === 0) {
          throw new ShiftContractError('Shift already closed or changed concurrently', 409);
        }
        didCloseShiftInBatch = true;
      }
    }
  };

  try {
    try {
      await runCommit(true, true);
    } catch (firstErr) {
      const firstMsg = String(firstErr);
      const missingHandoverCols =
        /no such column:\s*(remitted_cash|closing_float|handover_to_staff_id|online_sales_total)|has no column named\s+(remitted_cash|closing_float|handover_to_staff_id|online_sales_total)/i.test(
          firstMsg,
        );
      const missingStatusCol =
        shouldCloseShift && /no such column:\s*status|has no column named\s+status/i.test(firstMsg);
      if (missingHandoverCols || missingStatusCol) {
        try {
          await runCommit(!missingHandoverCols, !missingStatusCol);
        } catch (secondErr) {
          const secondMsg = String(secondErr);
          if (
            !missingStatusCol &&
            shouldCloseShift &&
            /no such column:\s*status|has no column named\s+status/i.test(secondMsg)
          ) {
            await runCommit(false, false);
          } else {
            throw secondErr;
          }
        }
      } else {
        throw firstErr;
      }
    }
  } catch (err) {
    if (err instanceof ShiftContractError) throw err;
    if (/integer overflow/i.test(String(err))) {
      throw new ShiftContractError('Shift cash ledger changed concurrently; refresh and retry reconciliation', 409);
    }
    if (/UNIQUE|constraint/i.test(String(err))) {
      throw new ShiftContractError(`Shift ${input.shift_id} has already been reconciled`, 409);
    }
    if (shiftWindow.staff_id && /no such table|no such column|has no column named/i.test(String(err))) {
      throw new ShiftContractError('Cash reconciliation schema upgrade required before handover', 503);
    }
    if (!shiftWindow.staff_id && effectiveReconTenant === 'default' && /no such column|has no column named/i.test(String(err))) {
      try {
        await db.prepare(`INSERT INTO shift_reconciliations (
            id, shift_id, staff_id, opening_float, expected_cash, actual_cash,
            variance, variance_status, denominations, cash_payment_total,
            cash_payout_total, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            reconciliation.id, input.shift_id, reconciliation.staff_id, authoritativeOpeningFloat,
            expectedCash, actualCash, variance, varianceStatus, storedDenominationsJson,
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
    if (didCloseShiftInBatch) {
      await db
        .prepare(
          "UPDATE staff_shifts SET clock_out = NULL, hours_worked = NULL, attendance_state = 'active', status = 'open' WHERE CAST(id AS TEXT) = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
        )
        .bind(input.shift_id, effectiveReconTenant)
        .run()
        .catch(() =>
          db
            .prepare(
              "UPDATE staff_shifts SET clock_out = NULL, hours_worked = NULL, attendance_state = 'active' WHERE CAST(id AS TEXT) = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
            )
            .bind(input.shift_id, effectiveReconTenant)
            .run()
            .catch(() => undefined),
        );
    }
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
  tenantId?: string,
  actor?: { id: string; role: string }
): Promise<ShiftReconciliation | null> {
  const db = (env as Env)?.AURA_DB ?? (env as D1Database);
  const rawTenant = tenantId && tenantId.trim() ? tenantId.trim() : 'default';
  const normTenant = rawTenant === 'hq' ? '*' : rawTenant;

  if (actor) {
    const effectiveRole = await requireActiveActor(db, actor.id, actor.role, normTenant);
    if (!SHIFT_MANAGER_ROLES.has(effectiveRole)) {
      let shiftOwner: { staff_id?: string | null } | null = null;
      let hasShiftsTable = true;
      try {
        shiftOwner = normTenant === '*'
          ? await db
              .prepare('SELECT staff_id FROM staff_shifts WHERE CAST(id AS TEXT) = ? LIMIT 1')
              .bind(String(shiftId))
              .first<{ staff_id?: string | null }>()
          : await db
              .prepare(
                "SELECT staff_id FROM staff_shifts WHERE CAST(id AS TEXT) = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
              )
              .bind(String(shiftId), normTenant)
              .first<{ staff_id?: string | null }>();
      } catch (err) {
        if (/no such table:.*staff_shifts/i.test(String(err))) {
          hasShiftsTable = false;
        } else {
          throw err;
        }
      }
      if (hasShiftsTable) {
        if (!shiftOwner) return null;
        if (String(shiftOwner.staff_id || '') !== String(actor.id || '')) {
          throw new ShiftContractError('Forbidden: cannot view reconciliation for another staff member shift', 403);
        }
      }
    }
  }

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

  const parsedDenom = typeof row.denominations === 'string'
    ? (JSON.parse(row.denominations) as Record<string, unknown>)
    : (row.denominations as Record<string, unknown> | null);

  const cleanDenominations = {
    denominations: Array.isArray(parsedDenom?.denominations)
      ? parsedDenom.denominations
      : [],
  } as ShiftReconciliation['denominations'];

  const colRemitted = typeof row.remitted_cash === 'number' && Number.isFinite(row.remitted_cash) ? row.remitted_cash : undefined;
  const colClosing = typeof row.closing_float === 'number' && Number.isFinite(row.closing_float) ? row.closing_float : undefined;
  const colOnline = typeof row.online_sales_total === 'number' && Number.isFinite(row.online_sales_total) ? row.online_sales_total : undefined;
  const colHandover = typeof row.handover_to_staff_id === 'string' && row.handover_to_staff_id.trim()
    ? row.handover_to_staff_id.trim()
    : undefined;

  const jsonRemitted = typeof parsedDenom?.remitted_cash === 'number' ? parsedDenom.remitted_cash : undefined;
  const jsonClosing = typeof parsedDenom?.closing_float === 'number' ? parsedDenom.closing_float : undefined;
  const jsonOnline = typeof parsedDenom?.online_sales_total === 'number' ? parsedDenom.online_sales_total : undefined;
  const jsonHandover =
    typeof parsedDenom?.handover_to_staff_id === 'string' || parsedDenom?.handover_to_staff_id === null
      ? (parsedDenom.handover_to_staff_id as string | null)
      : undefined;

  const useJsonSplitFallback =
    colRemitted === 0 &&
    colClosing === 0 &&
    ((jsonRemitted !== undefined && jsonRemitted !== 0) || (jsonClosing !== undefined && jsonClosing !== 0));

  const resolvedRemitted = useJsonSplitFallback ? jsonRemitted : (colRemitted ?? jsonRemitted);
  const resolvedClosing = useJsonSplitFallback ? jsonClosing : (colClosing ?? jsonClosing);
  const resolvedOnline = colOnline === 0 && jsonOnline !== undefined && jsonOnline !== 0 ? jsonOnline : (colOnline ?? jsonOnline);
  const resolvedHandover = colHandover ?? jsonHandover;

  return {
    ...(row as unknown as ShiftReconciliation),
    denominations: cleanDenominations,
    ...(resolvedRemitted !== undefined ? { remitted_cash: resolvedRemitted } : {}),
    ...(resolvedClosing !== undefined ? { closing_float: resolvedClosing } : {}),
    ...(resolvedHandover !== undefined ? { handover_to_staff_id: resolvedHandover } : {}),
    ...(resolvedOnline !== undefined ? { online_sales_total: resolvedOnline } : {}),
  };
}

export interface ShiftCashPayout {
  id: string;
  tenant_id: string;
  shift_id: string;
  amount: number;
  reason: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
}

const SHIFT_MANAGER_ROLES = new Set(['owner', 'manager', 'supervisor', 'admin']);
const MAX_ASSIGN_PAYMENT_IDS = 100;
const MAX_PAYOUT_AMOUNT_VND = 100_000_000;

function normalizeScopeTenant(tenantId: string): string {
  const trimmed = tenantId.trim();
  return trimmed.toLowerCase() === 'hq' ? '*' : (trimmed || 'default');
}

async function requireActiveActor(
  db: D1Database,
  actorId: string,
  expectedRole: string,
  targetTenant: string,
  allowedRoles?: Set<string>,
): Promise<string> {
  if (!actorId.trim()) {
    throw new ShiftContractError('Forbidden: actor identity required', 403);
  }
  let actor: { is_active?: number | null; role?: string | null; tenant_id?: string | null } | null = null;
  let hasUsersTable = true;
  try {
    actor = await db
      .prepare('SELECT is_active, role, tenant_id FROM users WHERE id = ? LIMIT 1')
      .bind(actorId)
      .first<{ is_active?: number | null; role?: string | null; tenant_id?: string | null }>();
  } catch (err) {
    if (err instanceof ShiftContractError) throw err;
    if (/no such table:.*users/i.test(String(err))) {
      hasUsersTable = false;
    } else {
      throw err;
    }
  }
  if (!hasUsersTable) {
    if (allowedRoles && !allowedRoles.has(expectedRole)) {
      throw new ShiftContractError('Forbidden: insufficient role', 403);
    }
    return expectedRole;
  }
  if (!actor || Number(actor.is_active) !== 1 || typeof actor.role !== 'string' || !actor.role.trim()) {
    throw new ShiftContractError('Forbidden: inactive or unknown staff account', 403);
  }
  const dbRole = actor.role.trim();
  if (expectedRole && dbRole !== expectedRole) {
    throw new ShiftContractError('Forbidden: actor role mismatch', 403);
  }
  if (allowedRoles && !allowedRoles.has(dbRole)) {
    throw new ShiftContractError('Forbidden: insufficient role', 403);
  }
  const normalizedTargetTenant = normalizeScopeTenant(targetTenant);
  const actorTenantRaw = (actor.tenant_id?.trim() || 'default');
  const actorTenantLower = actorTenantRaw.toLowerCase();
  const isHqActor =
    (dbRole === 'owner' || dbRole === 'admin') && (actorTenantLower === 'hq' || actorTenantLower === '*');
  if (!isHqActor && (normalizedTargetTenant === '*' || actorTenantRaw !== normalizedTargetTenant)) {
    throw new ShiftContractError('Forbidden: cross-tenant actor', 403);
  }
  return dbRole;
}

async function requireUnreconciledShiftInTenant(
  db: D1Database,
  shiftId: string,
  tenantId: string,
): Promise<{ id: string; tenant: string; clock_in: string; clock_out: string | null; staff_id: string | null }> {
  const normTenant = normalizeScopeTenant(tenantId);
  const shift = normTenant === '*'
    ? await db.prepare('SELECT id, tenant_id, clock_in, clock_out, staff_id, attendance_state FROM staff_shifts WHERE id = ? LIMIT 1')
        .bind(shiftId)
        .first<{ id: string | number; tenant_id?: string | null; clock_in: string | null; clock_out: string | null; staff_id?: string | null; attendance_state?: string | null }>()
    : await db.prepare(
        "SELECT id, tenant_id, clock_in, clock_out, staff_id, attendance_state FROM staff_shifts WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      )
        .bind(shiftId, normTenant)
        .first<{ id: string | number; tenant_id?: string | null; clock_in: string | null; clock_out: string | null; staff_id?: string | null; attendance_state?: string | null }>();
  if (!shift) {
    throw new ShiftContractError('Shift not found', 404);
  }
  if (!shift.clock_in || String(shift.attendance_state || '').toLowerCase() === 'cancelled') {
    throw new ShiftContractError(`Shift ${shiftId} is not active or has been cancelled`, 409);
  }
  const effectiveTenant = (typeof shift.tenant_id === 'string' && shift.tenant_id.trim()) || (normTenant === '*' ? 'default' : normTenant);
  const existingRecon = await db.prepare(
    "SELECT id FROM shift_reconciliations WHERE shift_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
  ).bind(String(shift.id), effectiveTenant).first();
  if (existingRecon) {
    throw new ShiftContractError(`Shift ${shiftId} has already been reconciled`, 409);
  }
  return {
    id: String(shift.id),
    tenant: effectiveTenant,
    clock_in: shift.clock_in,
    clock_out: shift.clock_out,
    staff_id: shift.staff_id ? String(shift.staff_id) : null,
  };
}

export async function assignCashPaymentsToShift(
  env: Env | D1Database,
  shiftId: string,
  paymentIds: string[],
  actorId: string,
  tenantId: string,
  actorRole: string,
): Promise<{ shift_id: string; assigned_count: number; payment_ids: string[] }> {
  if (!CASH_ASSIGN_ROLES.has(actorRole)) {
    throw new ShiftContractError('Forbidden: insufficient role to assign cash payments', 403);
  }
  const db = (env as Env)?.AURA_DB ?? (env as D1Database);
  const normTenant = normalizeScopeTenant(tenantId);
  const effectiveRole = await requireActiveActor(db, actorId, actorRole, normTenant, CASH_ASSIGN_ROLES);
  const shift = await requireUnreconciledShiftInTenant(db, shiftId, tenantId);
  const isManager = SHIFT_MANAGER_ROLES.has(effectiveRole);
  if (!isManager && shift.staff_id !== actorId) {
    throw new ShiftContractError('Forbidden: cannot assign cash payments to another staff member shift', 403);
  }
  const cleanIds = Array.from(new Set(paymentIds.map((id) => String(id).trim()).filter(Boolean)));
  if (cleanIds.length === 0) {
    throw new ShiftContractError('payment_ids must be a non-empty array', 400);
  }
  if (cleanIds.length > MAX_ASSIGN_PAYMENT_IDS) {
    throw new ShiftContractError(`payment_ids cannot exceed ${MAX_ASSIGN_PAYMENT_IDS} items`, 400);
  }

  const now = new Date().toISOString();
  const validated: Array<{ id: string; amount: number; prevShiftId: string | null; settledAt: string }> = [];
  for (const paymentId of cleanIds) {
    const payment = await db.prepare(
      `SELECT id, amount, updated_at, created_at FROM payments
       WHERE id = ? AND method IN ('cash', 'cod') AND status = 'completed'
         AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
       LIMIT 1`
    ).bind(paymentId, shift.tenant).first<{ id: string; amount?: number | null; updated_at?: string | null; created_at?: string | null }>();
    if (!payment) {
      throw new ShiftContractError(`Completed cash payment ${paymentId} not found in tenant`, 404);
    }

    const globalAttr = await db
      .prepare('SELECT tenant_id FROM cash_payment_attributions WHERE payment_id = ? LIMIT 1')
      .bind(payment.id)
      .first<{ tenant_id?: string | null }>()
      .catch(() => null);
    if (globalAttr) {
      const globalTenant = (globalAttr.tenant_id?.trim() || 'default');
      if (globalTenant !== shift.tenant) {
        throw new ShiftContractError('Forbidden: payment attribution belongs to another tenant', 403);
      }
    }

    const existingAttr = await db.prepare(
      `SELECT a.shift_id, s.staff_id, r.id AS recon_id
       FROM cash_payment_attributions a
       LEFT JOIN staff_shifts s ON CAST(s.id AS TEXT) = a.shift_id
         AND COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?
       LEFT JOIN shift_reconciliations r ON r.shift_id = a.shift_id
         AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?
       WHERE a.payment_id = ? AND COALESCE(NULLIF(TRIM(a.tenant_id), ''), 'default') = ?
       LIMIT 1`
    ).bind(shift.tenant, shift.tenant, payment.id, shift.tenant).first<{
      shift_id: string;
      staff_id?: string | null;
      recon_id?: string | null;
    }>();

    if (existingAttr) {
      if (existingAttr.recon_id) {
        throw new ShiftContractError(`Payment ${payment.id} is already attributed to a reconciled shift`, 409);
      }
      if (!isManager && existingAttr.shift_id !== shift.id && existingAttr.staff_id !== actorId) {
        throw new ShiftContractError(`Forbidden: payment ${payment.id} is already attributed to another staff member shift`, 403);
      }
    }

    validated.push({
      id: payment.id,
      amount: Math.max(0, Number(payment.amount || 0)),
      prevShiftId: existingAttr?.shift_id ? String(existingAttr.shift_id) : null,
      settledAt: payment.updated_at || payment.created_at || now,
    });
  }

  // Guard attribution writes atomically in SQL against concurrent reconciliation of either
  // the target shift or any shift currently holding the payment, and enforce tenant_id match on conflict.
  const statements = validated.map((item) =>
    db.prepare(
      `INSERT INTO cash_payment_attributions (payment_id, tenant_id, shift_id, collected_by, settled_at)
       SELECT ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM shift_reconciliations
         WHERE shift_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
       )
       AND NOT EXISTS (
         SELECT 1 FROM cash_payment_attributions a
         JOIN shift_reconciliations r
           ON r.shift_id = a.shift_id
           AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(a.tenant_id), ''), 'default')
         WHERE a.payment_id = ?
           AND COALESCE(NULLIF(TRIM(a.tenant_id), ''), 'default') = ?
       )
       ON CONFLICT(payment_id) DO UPDATE SET
         shift_id = excluded.shift_id,
         collected_by = excluded.collected_by
       WHERE COALESCE(NULLIF(TRIM(cash_payment_attributions.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(excluded.tenant_id), ''), 'default')
       AND NOT EXISTS (
         SELECT 1 FROM shift_reconciliations
         WHERE shift_id = cash_payment_attributions.shift_id
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(cash_payment_attributions.tenant_id), ''), 'default')
       )
       AND NOT EXISTS (
         SELECT 1 FROM shift_reconciliations
         WHERE shift_id = excluded.shift_id
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(excluded.tenant_id), ''), 'default')
       )`
    ).bind(
      item.id, shift.tenant, shift.id, actorId, item.settledAt,
      shift.id, shift.tenant,
      item.id, shift.tenant,
    )
  );

  const writeResults: Array<{ meta?: { changes?: number }; changes?: number } | null | undefined> = [];
  if (typeof db.batch === 'function') {
    const batchRes = await db.batch(statements);
    if (Array.isArray(batchRes)) {
      writeResults.push(...(batchRes as Array<{ meta?: { changes?: number }; changes?: number }>));
    }
  } else {
    for (const stmt of statements) {
      writeResults.push((await stmt.run()) as { meta?: { changes?: number }; changes?: number });
    }
  }

  for (let i = 0; i < writeResults.length; i++) {
    const res = writeResults[i];
    const changes = res?.meta?.changes ?? res?.changes;
    if (changes !== undefined && Number(changes) === 0) {
      throw new ShiftContractError(
        `Payment ${validated[i]?.id ?? ''} or shift ${shift.id} was reconciled concurrently; refresh and retry`,
        409
      );
    }
  }

  // Sync staff_shifts.cash_sales, total_sales, and order_count on source and target shifts
  for (const item of validated) {
    if (item.prevShiftId === shift.id) continue;
    try {
      if (item.prevShiftId) {
        await db
          .prepare(
            `UPDATE staff_shifts
             SET cash_sales = MAX(0, COALESCE(cash_sales, 0) - ?),
                 total_sales = MAX(0, COALESCE(total_sales, 0) - ?),
                 order_count = MAX(0, COALESCE(order_count, 0) - 1)
             WHERE CAST(id AS TEXT) = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
          )
          .bind(item.amount, item.amount, item.prevShiftId, shift.tenant)
          .run();
      }
      await db
        .prepare(
          `UPDATE staff_shifts
           SET cash_sales = COALESCE(cash_sales, 0) + ?,
               total_sales = COALESCE(total_sales, 0) + ?,
               order_count = COALESCE(order_count, 0) + 1
           WHERE CAST(id AS TEXT) = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
        )
        .bind(item.amount, item.amount, shift.id, shift.tenant)
        .run();
    } catch {
      // Best-effort sync when minimal test schemas omit cash_sales / total_sales / order_count
    }
  }

  return {
    shift_id: shift.id,
    assigned_count: validated.length,
    payment_ids: validated.map((v) => v.id),
  };
}

export async function listShiftCashPayouts(
  env: Env | D1Database,
  shiftId: string,
  tenantId: string,
  actorId: string,
  actorRole: string,
): Promise<ShiftCashPayout[]> {
  const db = (env as Env)?.AURA_DB ?? (env as D1Database);
  const normTenant = normalizeScopeTenant(tenantId);
  const effectiveRole = await requireActiveActor(db, actorId, actorRole, normTenant);
  const shift = normTenant === '*'
    ? await db.prepare('SELECT id, tenant_id, staff_id FROM staff_shifts WHERE id = ? LIMIT 1')
        .bind(shiftId).first<{ id: string | number; tenant_id?: string | null; staff_id?: string | null }>()
    : await db.prepare(
        "SELECT id, tenant_id, staff_id FROM staff_shifts WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      ).bind(shiftId, normTenant).first<{ id: string | number; tenant_id?: string | null; staff_id?: string | null }>();
  if (!shift) {
    throw new ShiftContractError('Shift not found', 404);
  }
  if (!SHIFT_MANAGER_ROLES.has(effectiveRole) && String(shift.staff_id || '') !== String(actorId || '')) {
    throw new ShiftContractError('Forbidden: cannot view cash payouts for another staff member shift', 403);
  }
  const effectiveTenant = (typeof shift.tenant_id === 'string' && shift.tenant_id.trim()) || (normTenant === '*' ? 'default' : normTenant);
  const res = await db.prepare(
    `SELECT id, tenant_id, shift_id, amount, reason, status, created_by, created_at
     FROM cash_payouts
     WHERE shift_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
     ORDER BY created_at DESC`
  ).bind(String(shift.id), effectiveTenant).all<ShiftCashPayout>();
  return res.results || [];
}

export async function createShiftCashPayout(
  env: Env | D1Database,
  shiftId: string,
  input: { amount: number; reason: string },
  actorId: string,
  tenantId: string,
  actorRole: string,
): Promise<ShiftCashPayout> {
  if (!PAYOUT_ROLES.has(actorRole)) {
    throw new ShiftContractError('Forbidden: insufficient role to record cash payout', 403);
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > MAX_PAYOUT_AMOUNT_VND) {
    throw new ShiftContractError(`Payout amount must be a positive integer VND amount (max ${MAX_PAYOUT_AMOUNT_VND})`, 400);
  }
  const reason = String(input.reason || '').trim();
  if (!reason || reason.length > 300) {
    throw new ShiftContractError('Payout reason is required (max 300 characters)', 400);
  }
  const db = (env as Env)?.AURA_DB ?? (env as D1Database);
  const normTenant = normalizeScopeTenant(tenantId);
  const effectiveRole = await requireActiveActor(db, actorId, actorRole, normTenant, PAYOUT_ROLES);
  const shift = await requireUnreconciledShiftInTenant(db, shiftId, tenantId);
  const isManager = SHIFT_MANAGER_ROLES.has(effectiveRole);
  if (!isManager && shift.staff_id !== actorId) {
    throw new ShiftContractError('Forbidden: cannot record payout for another staff member shift', 403);
  }

  const id = `payout_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const payoutWrite = await db.prepare(
    `INSERT INTO cash_payouts (id, tenant_id, shift_id, amount, reason, status, created_by, created_at)
     SELECT ?, ?, ?, ?, ?, 'completed', ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM shift_reconciliations sr
       WHERE sr.shift_id = ?
         AND COALESCE(NULLIF(TRIM(sr.tenant_id), ''), 'default') = ?
     )`
  ).bind(id, shift.tenant, shift.id, input.amount, reason, actorId, createdAt, shift.id, shift.tenant).run();
  if ((payoutWrite.meta?.changes ?? 1) === 0) {
    throw new ShiftContractError(`Shift ${shiftId} has already been reconciled`, 409);
  }

  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, ?, 'shift_cash_payout_created', 'cash_payout', ?, ?, ?)`
    ).bind(
      `audit_${crypto.randomUUID()}`,
      shift.tenant,
      actorId,
      id,
      JSON.stringify({ shift_id: shift.id, amount: input.amount, reason }),
      createdAt,
    ).run();
  } catch {
    // Non-fatal when lightweight test schemas omit audit_logs
  }

  return {
    id,
    tenant_id: shift.tenant,
    shift_id: shift.id,
    amount: input.amount,
    reason,
    status: 'completed',
    created_by: actorId,
    created_at: createdAt,
  };
}
