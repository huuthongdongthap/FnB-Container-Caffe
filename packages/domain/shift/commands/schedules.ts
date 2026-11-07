import { managerScope, shiftTarget, ShiftContractError, type ShiftScope } from './shift-access';
import { getShift } from './shift-repository';

export interface ScheduleInput { staffId?: string; locationId?: string; date?: string; startTime?: string; endTime?: string; breakMinutes?: number; status?: string; notes?: string }

function normalizeHHMM(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function isValidCalendarDate(value?: string | null): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const [yStr, mStr, dStr] = trimmed.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

function assertValidCalendarDate(value?: string | null) {
  if (!isValidCalendarDate(value)) {
    throw new ShiftContractError('Invalid calendar date (expected YYYY-MM-DD)', 400);
  }
}

function assertValidTimeRange(startTime?: string | null, endTime?: string | null) {
  const start = normalizeHHMM(startTime);
  const end = normalizeHHMM(endTime);
  if (!start || !end || start >= end) {
    throw new ShiftContractError('startTime must be before endTime', 400);
  }
}

async function assertNoScheduleOverlap(
  scope: ShiftScope,
  staffId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: string
): Promise<void> {
  const excludeClause = excludeId ? ' AND id != ?' : '';
  const binds: (string | number)[] = [
    scope.tenantId,
    staffId,
    date,
    endTime,
    startTime,
    ...(excludeId ? [excludeId] : []),
  ];
  const overlap = await scope.env.AURA_DB.prepare(
    `SELECT id, start_time, end_time, attendance_state
     FROM staff_shifts
     WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
       AND staff_id = ?
       AND date = ?
       AND COALESCE(attendance_state, 'scheduled') != 'cancelled'
       AND start_time < ?
       AND end_time > ?${excludeClause}
     LIMIT 1`
  )
    .bind(...binds)
    .first<{ id: string | number; start_time?: string; end_time?: string; attendance_state?: string }>()
    .catch(() => null);

  if (overlap && overlap.id !== undefined && overlap.id !== null) {
    if (excludeId && String(overlap.id) === String(excludeId)) {
      return;
    }
    const existStart = normalizeHHMM(overlap.start_time);
    const existEnd = normalizeHHMM(overlap.end_time);
    if (
      overlap.attendance_state === 'cancelled' ||
      (existStart && existEnd && (existStart >= endTime || existEnd <= startTime))
    ) {
      return;
    }
    throw new ShiftContractError('Overlapping shift schedule exists for staff member', 409);
  }
}

export function scheduleInput(scope: ShiftScope, body: ScheduleInput) {
  const locId = typeof body.locationId === 'string' ? body.locationId.trim() : '';
  if (locId && (locId === '*' || locId.toLowerCase() === 'hq' || (scope.tenantId !== '*' && locId !== scope.tenantId))) {
    throw new ShiftContractError('Location does not match store', 403);
  }
  if (body.breakMinutes) throw new ShiftContractError('Break tracking is unavailable for pilot schedules', 400);
  if (body.status && !['scheduled', 'cancelled'].includes(body.status)) throw new ShiftContractError('Use attendance check-in/out to record work', 400);
  if (body.date !== undefined) {
    assertValidCalendarDate(body.date);
  }
  if (body.startTime !== undefined && body.endTime !== undefined) {
    assertValidTimeRange(body.startTime, body.endTime);
  }
}
export async function createSchedule(scope: ShiftScope, body: ScheduleInput) {
  managerScope(scope); scheduleInput(scope, body);
  assertValidCalendarDate(body.date);
  assertValidTimeRange(body.startTime, body.endTime);
  const normalizedStart = normalizeHHMM(body.startTime)!;
  const normalizedEnd = normalizeHHMM(body.endTime)!;
  const normalizedDate = body.date!.trim();
  const staff = await shiftTarget(scope, body.staffId);
  const targetTenant = (typeof staff.tenant_id === 'string' && staff.tenant_id.trim()) || (scope.tenantId === '*' ? 'default' : scope.tenantId);
  const locId = typeof body.locationId === 'string' ? body.locationId.trim() : '';
  if (locId && locId !== targetTenant) throw new ShiftContractError('Location does not match store', 403);
  const targetScope: ShiftScope = { ...scope, tenantId: targetTenant };
  await assertNoScheduleOverlap(targetScope, staff.id, normalizedDate, normalizedStart, normalizedEnd);
  const result = await scope.env.AURA_DB.prepare(`INSERT INTO staff_shifts
    (tenant_id, staff_id, staff_name, role, date, shift, start_time, end_time, attendance_state, notes)
    VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, 'scheduled', ?)`)
    .bind(targetTenant, staff.id, staff.name, staff.role, normalizedDate, normalizedStart, normalizedEnd, body.notes ?? null).run();
  return getShift(targetScope, String(result.meta.last_row_id));
}
export async function updateSchedule(scope: ShiftScope, id: string, body: ScheduleInput) {
  managerScope(scope); scheduleInput(scope, body);
  const current = await getShift(scope, id);
  const currentTenant = (current.tenant_id && String(current.tenant_id).trim()) || (scope.tenantId === '*' ? 'default' : scope.tenantId);
  const locId = typeof body.locationId === 'string' ? body.locationId.trim() : '';
  if (locId && locId !== currentTenant) throw new ShiftContractError('Location does not match store', 403);
  if (current.clock_in !== null || current.clock_out !== null) throw new ShiftContractError('Recorded attendance cannot be edited as a schedule', 409);
  if (current.attendance_state === 'cancelled') {
    const isIdempotentCancel =
      body.status === 'cancelled' &&
      body.staffId === undefined &&
      body.date === undefined &&
      body.startTime === undefined &&
      body.endTime === undefined &&
      body.notes === undefined;
    if (isIdempotentCancel) return current;
    throw new ShiftContractError('Cancelled shift cannot be modified', 409);
  }
  const effectiveDate = (body.date ?? current.date).trim();
  assertValidCalendarDate(effectiveDate);
  const effectiveStart = body.startTime ?? current.start_time;
  const effectiveEnd = body.endTime ?? current.end_time;
  if (body.startTime !== undefined || body.endTime !== undefined) {
    assertValidTimeRange(effectiveStart, effectiveEnd);
  }
  const normalizedStart = normalizeHHMM(effectiveStart) ?? effectiveStart;
  const normalizedEnd = normalizeHHMM(effectiveEnd) ?? effectiveEnd;
  const effectiveStatus = body.status ?? current.attendance_state;
  const targetScope: ShiftScope = { ...scope, tenantId: currentTenant };
  const staff = await shiftTarget(targetScope, body.staffId || current.staff_id);
  if (effectiveStatus !== 'cancelled' && normalizedStart && normalizedEnd) {
    await assertNoScheduleOverlap(targetScope, staff.id, effectiveDate, normalizedStart, normalizedEnd, String(current.id));
  }
  const result = await scope.env.AURA_DB.prepare(`UPDATE staff_shifts SET staff_id = ?, staff_name = ?, role = ?, date = ?,
    start_time = ?, end_time = ?, attendance_state = ?, notes = ?
    WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND staff_id = ? AND clock_in IS NULL AND clock_out IS NULL AND attendance_state != 'cancelled'`)
    .bind(staff.id, staff.name, staff.role, effectiveDate, normalizedStart,
      normalizedEnd, effectiveStatus, body.notes ?? current.notes,
      current.id, currentTenant, current.staff_id).run();
  if (!result.meta.changes) throw new ShiftContractError('Schedule changed; reload before editing', 409);
  return getShift(targetScope, id);
}
