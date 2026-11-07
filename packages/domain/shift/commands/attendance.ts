import type { ShiftRow } from '../model/shift-types';
import { businessDate, shiftTarget, ShiftContractError, type ShiftScope } from './shift-access';
import { ACTIVE_ATTENDANCE_SQL, getShift } from './shift-repository';

export async function clockIn(scope: ShiftScope, staffId?: string, notes?: string, scheduledId?: string): Promise<ShiftRow> {
  const staff = await shiftTarget(scope, staffId), db = scope.env.AURA_DB;
  const targetTenant = (typeof staff.tenant_id === 'string' && staff.tenant_id.trim()) || (scope.tenantId === '*' ? 'default' : scope.tenantId);
  const targetScope: ShiftScope = { ...scope, tenantId: targetTenant };
  const existing = await db.prepare(`SELECT id FROM staff_shifts WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND staff_id = ? AND ${ACTIVE_ATTENDANCE_SQL}`)
    .bind(targetTenant, staff.id).first();
  if (existing) throw new ShiftContractError('Already clocked in', 409);
  const now = new Date().toISOString();
  let id: string;
  try {
    if (scheduledId) {
      const scheduled = await getShift(targetScope, scheduledId);
      if (scheduled.staff_id !== staff.id || scheduled.date !== businessDate() || scheduled.attendance_state !== 'scheduled') {
        throw new ShiftContractError('Scheduled shift is unavailable', 409);
      }
      const saved = await db.prepare(`UPDATE staff_shifts SET clock_in = ?, attendance_state = 'active', notes = COALESCE(?, notes)
        WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND staff_id = ? AND clock_in IS NULL AND clock_out IS NULL AND attendance_state = 'scheduled'`)
        .bind(now, notes ?? null, scheduled.id, targetTenant, staff.id).run();
      if (!saved.meta.changes) throw new ShiftContractError('Shift changed; reload attendance', 409);
      id = String(scheduled.id);
    } else {
      const result = await db.prepare(`INSERT INTO staff_shifts
        (tenant_id, staff_id, staff_name, role, date, shift, clock_in, attendance_state, notes)
        VALUES (?, ?, ?, ?, ?, 'attendance', ?, 'active', ?)`)
        .bind(targetTenant, staff.id, staff.name, staff.role, businessDate(), now, notes ?? null).run();
      id = String(result.meta.last_row_id);
    }
  } catch (error) {
    if (error instanceof ShiftContractError) throw error;
    // Only the active-attendance unique constraint is a business conflict.
    if (String(error).includes('UNIQUE constraint failed: staff_shifts.tenant_id, staff_shifts.staff_id')) {
      throw new ShiftContractError('Already clocked in', 409);
    }
    throw error;
  }
  return getShift(targetScope, id);
}
export async function clockOut(scope: ShiftScope, staffId?: string, attendanceId?: string, notes?: string): Promise<ShiftRow> {
  let resolvedAttendanceId = attendanceId;
  let resolvedNotes = notes;
  if (
    resolvedNotes === undefined &&
    resolvedAttendanceId !== undefined &&
    !/^[1-9]\d*$/.test(String(resolvedAttendanceId).trim())
  ) {
    resolvedNotes = resolvedAttendanceId;
    resolvedAttendanceId = undefined;
  } else if (
    resolvedAttendanceId === undefined &&
    resolvedNotes !== undefined &&
    /^[1-9]\d*$/.test(String(resolvedNotes).trim())
  ) {
    resolvedAttendanceId = resolvedNotes;
    resolvedNotes = undefined;
  }
  const preloaded = resolvedAttendanceId ? await getShift({ ...scope, canManage: true }, resolvedAttendanceId) : undefined;
  const checkStaffId = staffId || (!scope.canManage ? scope.actor.id : undefined);
  if (preloaded && checkStaffId && String(preloaded.staff_id) !== String(checkStaffId).trim()) {
    throw new ShiftContractError('Attendance record does not match staff member', 409);
  }
  const staff = await shiftTarget(scope, staffId || preloaded?.staff_id), db = scope.env.AURA_DB;
  const targetTenant = (typeof staff.tenant_id === 'string' && staff.tenant_id.trim()) || (scope.tenantId === '*' ? 'default' : scope.tenantId);
  const targetScope: ShiftScope = { ...scope, tenantId: targetTenant };
  const scopedPreloaded = resolvedAttendanceId ? await getShift(targetScope, resolvedAttendanceId) : undefined;
  const active = scopedPreloaded ?? await db.prepare(
    `SELECT * FROM staff_shifts WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND staff_id = ? AND ${ACTIVE_ATTENDANCE_SQL} LIMIT 1`,
  ).bind(targetTenant, staff.id).first<ShiftRow>();
  if (resolvedAttendanceId && active && active.staff_id !== staff.id) {
    throw new ShiftContractError('Attendance record does not match staff member', 409);
  }
  if (!active || active.staff_id !== staff.id || !active.clock_in || active.clock_out) throw new ShiftContractError('No active shift found', 404);
  const now = new Date(), elapsed = now.getTime() - new Date(active.clock_in).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new ShiftContractError('Invalid clock-in timestamp', 409);
  const hours = Math.round(elapsed / 3600000 * 100) / 100;
  const mergedNotes = resolvedNotes ? [active.notes, resolvedNotes].filter(Boolean).join('; ') : active.notes;
  const saved = await db.prepare(`UPDATE staff_shifts SET clock_out = ?, hours_worked = ?, attendance_state = 'completed', notes = ?
    WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND staff_id = ? AND clock_in = ? AND clock_out IS NULL`)
    .bind(now.toISOString(), hours, mergedNotes, active.id, targetTenant, staff.id, active.clock_in).run();
  if (!saved.meta.changes) throw new ShiftContractError('Shift already closed or changed', 409);
  return getShift(targetScope, String(active.id));
}
