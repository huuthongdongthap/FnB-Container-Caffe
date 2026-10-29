/** Canonical attendance and schedule storage uses the legacy INTEGER primary key. */
export interface ShiftRow {
  id: number;
  tenant_id: string;
  staff_id: string;
  staff_name: string;
  role: string;
  shift: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number | null;
  attendance_state: 'scheduled' | 'active' | 'completed' | 'cancelled' | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_at: string;
}
export interface ShiftRecord extends Omit<ShiftRow, 'id'> { id: string }

export const isActiveAttendance = (row: Pick<ShiftRow, 'clock_in' | 'clock_out'>) => row.clock_in !== null && row.clock_out === null;
export function shiftDto(row: ShiftRow) {
  const status = isActiveAttendance(row) ? 'in_progress' : row.clock_out !== null ? 'completed' : row.attendance_state || 'scheduled';
  return { ...row, id: String(row.id), status, staffId: row.staff_id, locationId: row.tenant_id,
    startTime: row.start_time, endTime: row.end_time, breakMinutes: 0,
    createdAt: row.created_at, updatedAt: row.created_at };
}
export function attendanceDto(row: ShiftRow) {
  return { ...shiftDto(row), shiftId: String(row.id), shift_id: String(row.id),
    checkIn: row.clock_in, checkOut: row.clock_out, check_in: row.clock_in, check_out: row.clock_out,
    total_hours: row.hours_worked, breakStart: null, breakEnd: null, deviceFingerprint: null };
}
