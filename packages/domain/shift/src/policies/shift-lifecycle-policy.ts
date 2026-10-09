/**
 * Canonical Shift, Staff & POS Lifecycle Policy
 * Flow: STAFF → SHIFT OPEN → POS SALES → ORDER → PAYMENT → SHIFT CLOSE → RECONCILIATION
 * Invariants: Single active shift per operator; opening cash server-recorded;
 * closed shifts immutable; explicit variance calculation; server-authoritative payments.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { StaffRole } from '@aura/domain-staff';
import type {
  OpenShiftInput,
  PosSaleInput,
  CloseShiftInput,
  ShiftRecord,
} from '../model/shift-pos-types';

export function canStaffOperateShift(role: StaffRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'staff';
}

export async function openCanonicalShift(
  db: D1Database,
  input: OpenShiftInput
): Promise<{ ok: boolean; shift?: ShiftRecord; error?: string }> {
  if (!canStaffOperateShift(input.role)) {
    return { ok: false, error: 'unauthorized_role' };
  }
  if (typeof input.openingCash !== 'number' || input.openingCash < 0) {
    return { ok: false, error: 'invalid_opening_cash' };
  }

  const operatingUnit = input.operatingUnitId || 'main_store';
  const existing = await db.prepare(
    `SELECT id FROM staff_shifts
     WHERE staff_id = ? AND status = 'open' AND clock_out IS NULL LIMIT 1`
  ).bind(input.staffId).first<{ id: string }>();

  if (existing) {
    return { ok: false, error: 'duplicate_active_shift' };
  }

  const now = new Date().toISOString();
  const shiftId = `shift_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const shift: ShiftRecord = {
    id: shiftId,
    staff_id: input.staffId,
    staff_name: input.staffName,
    role: input.role,
    operating_unit_id: operatingUnit,
    clock_in: now,
    clock_out: null,
    status: 'open',
    opening_cash: input.openingCash,
    expected_cash: null,
    actual_cash: null,
    cash_variance: null,
    total_sales: 0,
    cash_sales: 0,
    online_sales: 0,
    order_count: 0,
    notes: input.notes || null,
    created_at: now,
    updated_at: now,
  };

  await db.prepare(
    `INSERT INTO staff_shifts (
      id, staff_id, staff_name, role, operating_unit_id, clock_in,
      clock_out, status, opening_cash, total_sales, cash_sales,
      online_sales, order_count, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'open', ?, 0, 0, 0, 0, ?, ?, ?)`
  ).bind(
    shift.id, shift.staff_id, shift.staff_name, shift.role,
    shift.operating_unit_id, shift.clock_in, shift.opening_cash,
    shift.notes, now, now
  ).run();

  return { ok: true, shift };
}

export async function recordShiftSale(
  db: D1Database,
  input: PosSaleInput
): Promise<{ ok: boolean; alreadyRecorded?: boolean; error?: string }> {
  const shift = await db.prepare(
    'SELECT id, status, operating_unit_id, cash_sales, online_sales, total_sales, order_count FROM staff_shifts WHERE id = ?'
  ).bind(input.shiftId).first<ShiftRecord>();

  if (!shift) return { ok: false, error: 'shift_not_found' };
  if (shift.status === 'closed' || shift.status === 'audited') {
    return { ok: false, error: 'closed_shift_immutable' };
  }
  if (input.operatingUnitId && input.operatingUnitId !== shift.operating_unit_id) {
    return { ok: false, error: 'cross_operating_unit_mismatch' };
  }

  const isCash = input.paymentMethod === 'cash';
  const cashDelta = isCash ? input.amount : 0;
  const onlineDelta = isCash ? 0 : input.amount;
  const now = new Date().toISOString();

  await db.prepare(
    `UPDATE staff_shifts
     SET cash_sales = cash_sales + ?,
         online_sales = online_sales + ?,
         total_sales = total_sales + ?,
         order_count = order_count + 1,
         updated_at = ?
     WHERE id = ?`
  ).bind(cashDelta, onlineDelta, input.amount, now, input.shiftId).run();

  return { ok: true, alreadyRecorded: false };
}

export async function closeCanonicalShift(
  db: D1Database,
  input: CloseShiftInput
): Promise<{ ok: boolean; shift?: ShiftRecord; variance?: number; error?: string }> {
  const shift = await db.prepare(
    'SELECT * FROM staff_shifts WHERE id = ?'
  ).bind(input.shiftId).first<ShiftRecord>();

  if (!shift) return { ok: false, error: 'shift_not_found' };
  if (shift.status === 'closed' || shift.status === 'audited') {
    return { ok: false, error: 'shift_already_closed' };
  }
  if (!canStaffOperateShift(input.closedByRole)) {
    return { ok: false, error: 'unauthorized_role' };
  }
  if (input.closedByRole === 'staff' && shift.staff_id !== input.closedByStaffId) {
    return { ok: false, error: 'unauthorized_shift_closer' };
  }

  const expectedCash = Number(shift.opening_cash || 0) + Number(shift.cash_sales || 0);
  const variance = input.actualCash - expectedCash;
  const now = new Date().toISOString();

  await db.prepare(
    `UPDATE staff_shifts
     SET status = 'closed',
         clock_out = ?,
         expected_cash = ?,
         actual_cash = ?,
         cash_variance = ?,
         notes = COALESCE(?, notes),
         updated_at = ?
     WHERE id = ?`
  ).bind(now, expectedCash, input.actualCash, variance, input.notes || null, now, input.shiftId).run();

  const updatedShift: ShiftRecord = {
    ...shift,
    status: 'closed',
    clock_out: now,
    expected_cash: expectedCash,
    actual_cash: input.actualCash,
    cash_variance: variance,
    notes: input.notes || shift.notes,
    updated_at: now,
  };

  return { ok: true, shift: updatedShift, variance };
}
