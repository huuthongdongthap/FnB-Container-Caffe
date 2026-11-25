/** Canonical attendance and schedule storage uses the legacy INTEGER primary key. */
export const CASH_DRAWER_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'supervisor',
  'cashier',
  'staff',
  'waiter',
  'shipper',
  'rider',
]);
export const PAYOUT_ROLES = new Set(CASH_DRAWER_ROLES);
export const CASH_ASSIGN_ROLES = new Set(CASH_DRAWER_ROLES);
export const NON_CASH_SHIFT_ROLES = new Set(['barista', 'kitchen', 'chef', 'bep']);
export const RECONCILIATION_ROLES = new Set([
  ...CASH_DRAWER_ROLES,
  ...NON_CASH_SHIFT_ROLES,
]);

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
  opening_cash?: number;
  expected_cash?: number | null;
  actual_cash?: number | null;
  cash_variance?: number | null;
  remitted_cash?: number | null;
  closing_float?: number | null;
  handover_to_staff_id?: string | null;
  online_sales_total?: number | null;
  notes: string | null;
  created_at: string;
}
export interface ShiftRecord extends Omit<ShiftRow, 'id'> { id: string }

export interface ShiftSlotInfo {
  code: 'morning' | 'afternoon' | 'night';
  label: string;
  shortLabel: string;
  window: string;
}

function slotInfoFromHour(hour: number): ShiftSlotInfo {
  if (hour >= 6 && hour < 14) {
    return { code: 'morning', label: 'Ca sáng (06:00–14:00)', shortLabel: 'Ca sáng', window: '06:00–14:00' };
  }
  if (hour >= 14 && hour < 22) {
    return { code: 'afternoon', label: 'Ca chiều (14:00–22:00)', shortLabel: 'Ca chiều', window: '14:00–22:00' };
  }
  return { code: 'night', label: 'Ca đêm (22:00–06:00)', shortLabel: 'Ca đêm', window: '22:00–06:00' };
}

/** Normalize SQLite/ISO UTC timestamps and derive store shift slot in Asia/Ho_Chi_Minh. */
export function deriveShiftSlot(
  timestamp?: string | null,
  explicitShift?: string | null,
  startTime?: string | null,
): ShiftSlotInfo {
  const normalizedExplicit = String(explicitShift || '').trim().toLowerCase();
  if (normalizedExplicit === 'morning' || normalizedExplicit === 'ca_1' || normalizedExplicit === 'ca1') {
    return { code: 'morning', label: 'Ca sáng (06:00–14:00)', shortLabel: 'Ca sáng', window: '06:00–14:00' };
  }
  if (normalizedExplicit === 'afternoon' || normalizedExplicit === 'ca_2' || normalizedExplicit === 'ca2') {
    return { code: 'afternoon', label: 'Ca chiều (14:00–22:00)', shortLabel: 'Ca chiều', window: '14:00–22:00' };
  }
  if (normalizedExplicit === 'night' || normalizedExplicit === 'evening' || normalizedExplicit === 'ca_3' || normalizedExplicit === 'ca3') {
    return { code: 'night', label: 'Ca đêm (22:00–06:00)', shortLabel: 'Ca đêm', window: '22:00–06:00' };
  }
  if (typeof startTime === 'string') {
    const startMatch = /^([01]?\d|2[0-3]):([0-5]\d)/.exec(startTime.trim());
    if (startMatch) {
      return slotInfoFromHour(Number.parseInt(startMatch[1] ?? '0', 10));
    }
  }
  let date = new Date();
  if (timestamp && typeof timestamp === 'string') {
    const trimmed = timestamp.trim();
    const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)
      ? `${trimmed.replace(' ', 'T')}Z`
      : trimmed;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    hour12: false,
  }).format(date);
  const hour = Number.parseInt(hourStr, 10);
  return slotInfoFromHour(hour);
}

export const isActiveAttendance = (row: Pick<ShiftRow, 'clock_in' | 'clock_out'>) => row.clock_in !== null && row.clock_out === null;
export function shiftDto(row: ShiftRow) {
  const status = isActiveAttendance(row) ? 'in_progress' : row.clock_out !== null ? 'completed' : row.attendance_state || 'scheduled';
  const slot = deriveShiftSlot(row.clock_in || row.created_at, row.shift, row.start_time);
  return { ...row, id: String(row.id), status, staffId: row.staff_id, locationId: row.tenant_id,
    shift_slot: slot.code, shift_name: slot.label, shift_short_name: slot.shortLabel, shift_window: slot.window,
    startTime: row.start_time, endTime: row.end_time, breakMinutes: 0,
    createdAt: row.created_at, updatedAt: row.created_at };
}
export function attendanceDto(row: ShiftRow) {
  return { ...shiftDto(row), shiftId: String(row.id), shift_id: String(row.id),
    checkIn: row.clock_in, checkOut: row.clock_out, check_in: row.clock_in, check_out: row.clock_out,
    total_hours: row.hours_worked, breakStart: null, breakEnd: null, deviceFingerprint: null };
}
