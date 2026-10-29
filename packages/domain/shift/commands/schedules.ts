import { managerScope, shiftTarget, ShiftContractError, type ShiftScope } from './shift-access';
import { getShift } from './shift-repository';

export interface ScheduleInput { staffId?: string; locationId?: string; date?: string; startTime?: string; endTime?: string; breakMinutes?: number; status?: string; notes?: string }
export function scheduleInput(scope: ShiftScope, body: ScheduleInput) {
  if (body.locationId && body.locationId !== scope.tenantId) throw new ShiftContractError('Location does not match store', 403);
  if (body.breakMinutes) throw new ShiftContractError('Break tracking is unavailable for pilot schedules', 400);
  if (body.status && !['scheduled', 'cancelled'].includes(body.status)) throw new ShiftContractError('Use attendance check-in/out to record work', 400);
}
export async function createSchedule(scope: ShiftScope, body: ScheduleInput) {
  managerScope(scope); scheduleInput(scope, body);
  const staff = await shiftTarget(scope, body.staffId);
  const result = await scope.env.AURA_DB.prepare(`INSERT INTO staff_shifts
    (tenant_id, staff_id, staff_name, role, date, shift, start_time, end_time, attendance_state, notes)
    VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, 'scheduled', ?)`)
    .bind(scope.tenantId, staff.id, staff.name, staff.role, body.date, body.startTime, body.endTime, body.notes ?? null).run();
  return getShift(scope, String(result.meta.last_row_id));
}
export async function updateSchedule(scope: ShiftScope, id: string, body: ScheduleInput) {
  managerScope(scope); scheduleInput(scope, body);
  const current = await getShift(scope, id);
  if (current.clock_in !== null || current.clock_out !== null) throw new ShiftContractError('Recorded attendance cannot be edited as a schedule', 409);
  const staff = await shiftTarget(scope, body.staffId || current.staff_id);
  const result = await scope.env.AURA_DB.prepare(`UPDATE staff_shifts SET staff_id = ?, staff_name = ?, role = ?, date = ?,
    start_time = ?, end_time = ?, attendance_state = ?, notes = ?
    WHERE id = ? AND tenant_id = ? AND staff_id = ? AND clock_in IS NULL AND clock_out IS NULL`)
    .bind(staff.id, staff.name, staff.role, body.date ?? current.date, body.startTime ?? current.start_time,
      body.endTime ?? current.end_time, body.status ?? current.attendance_state, body.notes ?? current.notes,
      current.id, scope.tenantId, current.staff_id).run();
  if (!result.meta.changes) throw new ShiftContractError('Schedule changed; reload before editing', 409);
  return getShift(scope, id);
}
