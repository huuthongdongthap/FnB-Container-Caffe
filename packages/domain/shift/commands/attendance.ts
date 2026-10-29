import type { ShiftRow } from '../model/shift-types';
import { businessDate, shiftTarget, ShiftContractError, type ShiftScope } from './shift-access';
import { ACTIVE_ATTENDANCE_SQL, getShift } from './shift-repository';

export async function clockIn(scope: ShiftScope, staffId?: string, notes?: string, scheduledId?: string): Promise<ShiftRow> {
  const staff = await shiftTarget(scope, staffId), db = scope.env.AURA_DB;
  const existing = await db.prepare(`SELECT id FROM staff_shifts WHERE tenant_id = ? AND staff_id = ? AND ${ACTIVE_ATTENDANCE_SQL}`)
    .bind(scope.tenantId, staff.id).first();
  if (existing) throw new ShiftContractError('Already clocked in', 409);
  const now = new Date().toISOString();
  let id: string;
  try {
    if (scheduledId) {
      const scheduled = await getShift(scope, scheduledId);
      if (scheduled.staff_id !== staff.id || scheduled.date !== businessDate() || scheduled.attendance_state !== 'scheduled') {
        throw new ShiftContractError('Scheduled shift is unavailable', 409);
      }
      const saved = await db.prepare(`UPDATE staff_shifts SET clock_in = ?, attendance_state = 'active', notes = COALESCE(?, notes)
        WHERE id = ? AND tenant_id = ? AND staff_id = ? AND clock_in IS NULL AND clock_out IS NULL AND attendance_state = 'scheduled'`)
        .bind(now, notes ?? null, scheduled.id, scope.tenantId, staff.id).run();
      if (!saved.meta.changes) throw new ShiftContractError('Shift changed; reload attendance', 409);
      id = String(scheduled.id);
    } else {
      const result = await db.prepare(`INSERT INTO staff_shifts
        (tenant_id, staff_id, staff_name, role, date, shift, clock_in, attendance_state, notes)
        VALUES (?, ?, ?, ?, ?, 'attendance', ?, 'active', ?)`)
        .bind(scope.tenantId, staff.id, staff.name, staff.role, businessDate(), now, notes ?? null).run();
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
  return getShift(scope, id);
}
export async function clockOut(scope: ShiftScope, staffId?: string, attendanceId?: string, notes?: string): Promise<ShiftRow> {
  const staff = await shiftTarget(scope, staffId), db = scope.env.AURA_DB;
  const active = attendanceId ? await getShift(scope, attendanceId) : await db.prepare(
    `SELECT * FROM staff_shifts WHERE tenant_id = ? AND staff_id = ? AND ${ACTIVE_ATTENDANCE_SQL} LIMIT 1`,
  ).bind(scope.tenantId, staff.id).first<ShiftRow>();
  if (!active || active.staff_id !== staff.id || !active.clock_in || active.clock_out) throw new ShiftContractError('No active shift found', 404);
  const now = new Date(), elapsed = now.getTime() - new Date(active.clock_in).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new ShiftContractError('Invalid clock-in timestamp', 409);
  const hours = Math.round(elapsed / 3600000 * 100) / 100;
  const mergedNotes = notes ? [active.notes, notes].filter(Boolean).join('; ') : active.notes;
  const saved = await db.prepare(`UPDATE staff_shifts SET clock_out = ?, hours_worked = ?, attendance_state = 'completed', notes = ?
    WHERE id = ? AND tenant_id = ? AND staff_id = ? AND clock_in = ? AND clock_out IS NULL`)
    .bind(now.toISOString(), hours, mergedNotes, active.id, scope.tenantId, staff.id, active.clock_in).run();
  if (!saved.meta.changes) throw new ShiftContractError('Shift already closed or changed', 409);
  return getShift(scope, String(active.id));
}
