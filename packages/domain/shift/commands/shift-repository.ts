import type { ShiftRow } from '../model/shift-types';
import { shiftDto } from '../model/shift-types';
import { businessDate, shiftCalendarDateOffset, shiftId, shiftStaffFilter, ShiftContractError, type ShiftScope } from './shift-access';

export const ACTIVE_ATTENDANCE_SQL = 'clock_in IS NOT NULL AND clock_out IS NULL';
export interface ShiftQuery {
  staffId?: string; from?: string; to?: string; today?: boolean; attendanceOnly?: boolean;
  status?: string; page?: number; limit?: number; sort?: string; order?: string;
}

const LATEST_RECON_JOIN_SQL = `LEFT JOIN shift_reconciliations r
  ON r.id = (
    SELECT r2.id
    FROM shift_reconciliations r2
    WHERE r2.shift_id = CAST(s.id AS TEXT)
      AND COALESCE(NULLIF(TRIM(r2.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default')
    ORDER BY r2.created_at DESC, r2.rowid DESC
    LIMIT 1
  )`;

export async function listShifts(scope: ShiftScope, query: ShiftQuery = {}) {
  const staffId = shiftStaffFilter(scope, query.staffId);
  const clauses: string[] = ['staff_id IS NOT NULL'];
  const values: (string | number)[] = [];
  if (scope.tenantId !== '*') {
    clauses.unshift("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?");
    values.push(scope.tenantId);
  }
  if (staffId) { clauses.push('staff_id = ?'); values.push(staffId); }
  if (query.attendanceOnly) clauses.push('clock_in IS NOT NULL');
  if (query.today) {
    const todayBiz = businessDate();
    const yesterdayBiz = shiftCalendarDateOffset(todayBiz, -1);
    const todayStartUtcIso = new Date(`${todayBiz}T00:00:00+07:00`).toISOString();
    clauses.push(
      `(date = ? OR (${ACTIVE_ATTENDANCE_SQL}) OR (clock_out IS NOT NULL AND julianday(clock_out) >= julianday(?)) OR (date = ? AND attendance_state = 'scheduled' AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time > end_time))`
    );
    clauses.push("COALESCE(attendance_state, 'active') != 'cancelled'");
    values.push(todayBiz, todayStartUtcIso, yesterdayBiz);
  }
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
  const qualifiedWhere = clauses.map((c) => c.replace(/\b(tenant_id|staff_id|clock_in|clock_out|date|attendance_state|start_time|end_time)\b/g, 's.$1')).join(' AND ');
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM staff_shifts WHERE ${where}`).bind(...values).first<{ total: number }>();
  let rows: { results?: ShiftRow[] };
  try {
    rows = await db.prepare(
      `SELECT s.*, r.expected_cash AS expected_cash, r.actual_cash AS actual_cash, r.variance AS cash_variance,
              r.remitted_cash AS remitted_cash, r.closing_float AS closing_float,
              r.handover_to_staff_id AS handover_to_staff_id, r.online_sales_total AS online_sales_total
       FROM staff_shifts s
       ${LATEST_RECON_JOIN_SQL}
       WHERE ${qualifiedWhere}
       ORDER BY s.${sort} ${order}, s.id DESC LIMIT ? OFFSET ?`
    ).bind(...values, limit, (page - 1) * limit).all<ShiftRow>();
  } catch (err) {
    const msg = String(err);
    if (/no such column:.*r\.(remitted_cash|closing_float|handover_to_staff_id|online_sales_total)/i.test(msg)) {
      rows = await db.prepare(
        `SELECT s.*, r.expected_cash AS expected_cash, r.actual_cash AS actual_cash, r.variance AS cash_variance
         FROM staff_shifts s
         ${LATEST_RECON_JOIN_SQL}
         WHERE ${qualifiedWhere}
         ORDER BY s.${sort} ${order}, s.id DESC LIMIT ? OFFSET ?`
      ).bind(...values, limit, (page - 1) * limit).all<ShiftRow>();
    } else if (/no such table:.*shift_reconciliations/i.test(msg)) {
      rows = await db.prepare(`SELECT * FROM staff_shifts WHERE ${where} ORDER BY ${sort} ${order}, id DESC LIMIT ? OFFSET ?`)
        .bind(...values, limit, (page - 1) * limit).all<ShiftRow>();
    } else {
      throw err;
    }
  }
  const total = count?.total || 0;
  return { rows: rows.results || [], meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getShift(scope: ShiftScope, id: string): Promise<ShiftRow> {
  const staffId = shiftStaffFilter(scope);
  const cleanId = shiftId(id);
  const db = scope.env.AURA_DB;
  const tenantSql = scope.tenantId === '*' ? '' : " AND COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?";
  const plainTenantSql = scope.tenantId === '*' ? '' : " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
  const tenantBinds = scope.tenantId === '*' ? [] : [scope.tenantId];
  const staffBinds = staffId ? [staffId] : [];
  let row: ShiftRow | null = null;
  try {
    row = await db.prepare(
      `SELECT s.*, r.expected_cash AS expected_cash, r.actual_cash AS actual_cash, r.variance AS cash_variance,
              r.remitted_cash AS remitted_cash, r.closing_float AS closing_float,
              r.handover_to_staff_id AS handover_to_staff_id, r.online_sales_total AS online_sales_total
       FROM staff_shifts s
       ${LATEST_RECON_JOIN_SQL}
       WHERE s.id = ?${tenantSql} AND s.staff_id IS NOT NULL${staffId ? ' AND s.staff_id = ?' : ''}`
    ).bind(cleanId, ...tenantBinds, ...staffBinds).first<ShiftRow>();
  } catch (err) {
    const msg = String(err);
    if (/no such column:.*r\.(remitted_cash|closing_float|handover_to_staff_id|online_sales_total)/i.test(msg)) {
      row = await db.prepare(
        `SELECT s.*, r.expected_cash AS expected_cash, r.actual_cash AS actual_cash, r.variance AS cash_variance
         FROM staff_shifts s
         ${LATEST_RECON_JOIN_SQL}
         WHERE s.id = ?${tenantSql} AND s.staff_id IS NOT NULL${staffId ? ' AND s.staff_id = ?' : ''}`
      ).bind(cleanId, ...tenantBinds, ...staffBinds).first<ShiftRow>();
    } else if (/no such table:.*shift_reconciliations/i.test(msg)) {
      row = await db.prepare(`SELECT * FROM staff_shifts WHERE id = ?${plainTenantSql} AND staff_id IS NOT NULL${staffId ? ' AND staff_id = ?' : ''}`)
        .bind(cleanId, ...tenantBinds, ...staffBinds).first<ShiftRow>();
    } else {
      throw err;
    }
  }
  if (!row) throw new ShiftContractError('Shift not found', 404);
  return row;
}

export async function getSuggestedOpeningCash(scope: ShiftScope): Promise<{
  suggested_opening_cash: number;
  latest_reconciled_shift_id: string | null;
  latest_handover_to_staff_id: string | null;
}> {
  const targetTenant = scope.tenantId === '*' ? 'default' : scope.tenantId;
  try {
    let row: {
      shift_id?: string | null;
      closing_float?: number | null;
      handover_to_staff_id?: string | null;
      denominations?: string | null;
    } | null = null;
    try {
      row = await scope.env.AURA_DB.prepare(
        `SELECT shift_id, closing_float, handover_to_staff_id, denominations
         FROM shift_reconciliations
         WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT 1`
      ).bind(targetTenant).first();
    } catch {
      row = await scope.env.AURA_DB.prepare(
        `SELECT shift_id, denominations
         FROM shift_reconciliations
         WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT 1`
      ).bind(targetTenant).first();
    }
    if (!row) {
      return { suggested_opening_cash: 0, latest_reconciled_shift_id: null, latest_handover_to_staff_id: null };
    }
    let parsedDenom: Record<string, unknown> | null = null;
    if (typeof row.denominations === 'string') {
      try {
        parsedDenom = JSON.parse(row.denominations) as Record<string, unknown>;
      } catch {
        parsedDenom = null;
      }
    }
    const colFloat = typeof row.closing_float === 'number' && Number.isFinite(row.closing_float) ? row.closing_float : null;
    const jsonFloat = typeof parsedDenom?.closing_float === 'number' && Number.isFinite(parsedDenom.closing_float) ? parsedDenom.closing_float : null;
    const resolvedFloat = Math.max(0, colFloat ?? jsonFloat ?? 0);
    const resolvedHandover =
      (typeof row.handover_to_staff_id === 'string' && row.handover_to_staff_id.trim()) ||
      (typeof parsedDenom?.handover_to_staff_id === 'string' && parsedDenom.handover_to_staff_id.trim()) ||
      null;
    return {
      suggested_opening_cash: resolvedFloat,
      latest_reconciled_shift_id: row.shift_id ? String(row.shift_id) : null,
      latest_handover_to_staff_id: resolvedHandover,
    };
  } catch {
    return { suggested_opening_cash: 0, latest_reconciled_shift_id: null, latest_handover_to_staff_id: null };
  }
}

export const shiftData = (row: ShiftRow) => shiftDto(row);
