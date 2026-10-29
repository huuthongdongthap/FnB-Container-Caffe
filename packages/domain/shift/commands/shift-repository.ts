import type { ShiftRow } from '../model/shift-types';
import { shiftDto } from '../model/shift-types';
import { businessDate, shiftId, shiftStaffFilter, ShiftContractError, type ShiftScope } from './shift-access';

export const ACTIVE_ATTENDANCE_SQL = 'clock_in IS NOT NULL AND clock_out IS NULL';
export interface ShiftQuery {
  staffId?: string; from?: string; to?: string; today?: boolean; attendanceOnly?: boolean;
  status?: string; page?: number; limit?: number; sort?: string; order?: string;
}
export async function listShifts(scope: ShiftScope, query: ShiftQuery = {}) {
  const staffId = shiftStaffFilter(scope, query.staffId);
  const clauses = ['tenant_id = ?', 'staff_id IS NOT NULL'];
  const values: (string | number)[] = [scope.tenantId];
  if (staffId) { clauses.push('staff_id = ?'); values.push(staffId); }
  if (query.attendanceOnly) clauses.push('clock_in IS NOT NULL');
  if (query.today) { clauses.push(`(date = ? OR (${ACTIVE_ATTENDANCE_SQL}))`); values.push(businessDate()); }
  for (const [date, op] of [[query.from, '>='], [query.to, '<=']] as const) {
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ShiftContractError('Invalid business date', 400);
      clauses.push(`date ${op} ?`); values.push(date);
    }
  }
  if (query.status) { clauses.push('attendance_state = ?'); values.push(query.status === 'in_progress' ? 'active' : query.status); }
  const page = Math.max(1, query.page || 1), limit = Math.min(100, Math.max(1, query.limit || 100));
  const sort = ({ startTime: 'start_time', start_time: 'start_time', checkIn: 'clock_in', check_in: 'clock_in',
    createdAt: 'created_at', created_at: 'created_at', status: 'attendance_state' } as Record<string, string>)[query.sort || ''] || 'date';
  const order = query.order === 'asc' ? 'ASC' : 'DESC';
  const where = clauses.join(' AND '), db = scope.env.AURA_DB;
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM staff_shifts WHERE ${where}`).bind(...values).first<{ total: number }>();
  const rows = await db.prepare(`SELECT * FROM staff_shifts WHERE ${where} ORDER BY ${sort} ${order}, id DESC LIMIT ? OFFSET ?`)
    .bind(...values, limit, (page - 1) * limit).all<ShiftRow>();
  const total = count?.total || 0;
  return { rows: rows.results || [], meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
export async function getShift(scope: ShiftScope, id: string): Promise<ShiftRow> {
  const staffId = shiftStaffFilter(scope);
  const row = await scope.env.AURA_DB.prepare(`SELECT * FROM staff_shifts WHERE id = ? AND tenant_id = ? AND staff_id IS NOT NULL${staffId ? ' AND staff_id = ?' : ''}`)
    .bind(shiftId(id), scope.tenantId, ...(staffId ? [staffId] : [])).first<ShiftRow>();
  if (!row) throw new ShiftContractError('Shift not found', 404);
  return row;
}
export const shiftData = (row: ShiftRow) => shiftDto(row);
