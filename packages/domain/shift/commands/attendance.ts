import { CASH_DRAWER_ROLES, deriveShiftSlot, type ShiftRow } from '../model/shift-types';
import { businessDate, shiftCalendarDateOffset, shiftTarget, ShiftContractError, type ShiftScope } from './shift-access';
import { ACTIVE_ATTENDANCE_SQL, getShift } from './shift-repository';

function parseHHMMMinutes(raw?: string | null): number | null {
  if (typeof raw !== 'string') return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)/.exec(raw.trim());
  if (!m) return null;
  return Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
}

function getIctMinutesSinceMidnight(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = Number.parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const m = Number.parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return (Number.isFinite(h) ? h % 24 : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function isScheduledShiftDateEligible(scheduled: ShiftRow, now = new Date()): boolean {
  const todayBiz = businessDate(now);
  if (scheduled.date === todayBiz) return true;
  const yesterdayBiz = shiftCalendarDateOffset(todayBiz, -1);
  if (scheduled.date !== yesterdayBiz) return false;

  const startMin = parseHHMMMinutes(scheduled.start_time);
  const endMin = parseHHMMMinutes(scheduled.end_time);
  const ictMin = getIctMinutesSinceMidnight(now);
  if (startMin !== null && endMin !== null && startMin > endMin) {
    // Overnight schedule crossing 00:00 (e.g. 22:00 -> 06:00): allow clock-in through end + 60m grace
    return ictMin <= endMin + 60;
  }
  if (startMin !== null && startMin >= 20 * 60) {
    // Late-night schedule (e.g. 23:30) clocked in shortly after midnight (up to 03:00 ICT)
    return ictMin <= 180;
  }
  return false;
}

function isCashReconciliationFlagEnabled(env: unknown): boolean {
  const rec = env as Record<string, unknown> | undefined;
  const flag = String(rec?.CASH_RECONCILIATION_ENABLED ?? '').trim().toLowerCase();
  return flag === 'true' || flag === '1';
}

async function isTenantCashReconOptedOut(
  env: unknown,
  db: ShiftScope['env']['AURA_DB'],
  tenantId: string,
): Promise<boolean> {
  const rec = env as Record<string, unknown> | undefined;
  const disabledTenants = String(rec?.CASH_RECONCILIATION_DISABLED_TENANTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (disabledTenants.includes(tenantId)) return true;
  try {
    const res = await db
      .prepare(
        `SELECT value FROM settings
         WHERE key = 'cash_reconciliation_enabled'
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') IN (?, 'default')
         ORDER BY CASE WHEN COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? THEN 0 ELSE 1 END
         LIMIT 1`,
      )
      .bind(tenantId, tenantId)
      .all<{ value: string }>();
    const resolved = res.results?.[0]?.value;
    if (resolved !== undefined && ['false', '0'].includes(String(resolved).trim().toLowerCase())) return true;
  } catch {
    // settings table absent -> fall back to env flag
  }
  return false;
}

async function assertShiftCashReconciledBeforeClockOut(
  scope: ShiftScope,
  active: ShiftRow,
  fallbackRole: string,
  targetTenant: string,
): Promise<void> {
  if (!isCashReconciliationFlagEnabled(scope.env)) return;
  const db = scope.env.AURA_DB;
  if (await isTenantCashReconOptedOut(scope.env, db, targetTenant)) return;

  const shiftIdStr = String(active.id);
  let hasReconTable = true;
  let existingRecon: unknown = null;
  try {
    existingRecon = await db
      .prepare(
        "SELECT id FROM shift_reconciliations WHERE shift_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
      )
      .bind(shiftIdStr, targetTenant)
      .first();
  } catch (err) {
    if (/no such table:.*shift_reconciliations/i.test(String(err))) {
      hasReconTable = false;
    } else if (targetTenant === 'default' && /no such column:.*tenant_id/i.test(String(err))) {
      existingRecon = await db
        .prepare('SELECT id FROM shift_reconciliations WHERE shift_id = ? LIMIT 1')
        .bind(shiftIdStr)
        .first();
    } else {
      throw err;
    }
  }
  if (!hasReconTable || existingRecon) return;

  const openingCash = typeof active.opening_cash === 'number' && Number.isFinite(active.opening_cash) ? active.opening_cash : 0;
  const recordedCashSales = Number((active as unknown as Record<string, unknown>).cash_sales || 0);
  const normalizedRole = String(active.role || fallbackRole || '').trim().toLowerCase();
  let holdsCash = openingCash > 0 || recordedCashSales > 0 || CASH_DRAWER_ROLES.has(normalizedRole);

  if (!holdsCash) {
    try {
      const attr = await db
        .prepare(
          "SELECT payment_id FROM cash_payment_attributions WHERE shift_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
        )
        .bind(shiftIdStr, targetTenant)
        .first();
      if (attr) holdsCash = true;
    } catch {
      // cash_payment_attributions optional in minimal schemas
    }
  }
  if (!holdsCash) {
    try {
      const payout = await db
        .prepare(
          "SELECT id FROM cash_payouts WHERE shift_id = ? AND status = 'completed' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
        )
        .bind(shiftIdStr, targetTenant)
        .first();
      if (payout) holdsCash = true;
    } catch {
      // cash_payouts optional in minimal schemas
    }
  }

  if (holdsCash) {
    throw new ShiftContractError(
      'Cash reconciliation is required before closing this shift',
      409,
      'CASH_RECONCILIATION_REQUIRED',
      { shift_id: shiftIdStr },
    );
  }
}

export async function clockIn(scope: ShiftScope, staffId?: string, notes?: string, scheduledId?: string, openingCash?: number): Promise<ShiftRow> {
  if (openingCash !== undefined && (!Number.isFinite(openingCash) || openingCash < 0)) {
    throw new ShiftContractError('Invalid opening_cash', 400);
  }
  const staff = await shiftTarget(scope, staffId), db = scope.env.AURA_DB;
  const targetTenant = (typeof staff.tenant_id === 'string' && staff.tenant_id.trim()) || (scope.tenantId === '*' ? 'default' : scope.tenantId);
  const targetScope: ShiftScope = { ...scope, tenantId: targetTenant };
  const existing = await db.prepare(`SELECT id FROM staff_shifts WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND staff_id = ? AND ${ACTIVE_ATTENDANCE_SQL}`)
    .bind(targetTenant, staff.id).first();
  if (existing) throw new ShiftContractError('Already clocked in', 409);
  const nowDate = new Date();
  const now = nowDate.toISOString();
  let id: string;
  try {
    if (scheduledId) {
      const scheduled = await getShift(targetScope, scheduledId);
      if (scheduled.staff_id !== staff.id || !isScheduledShiftDateEligible(scheduled, nowDate) || scheduled.attendance_state !== 'scheduled') {
        throw new ShiftContractError('Scheduled shift is unavailable', 409);
      }
      const presetOpeningCash = typeof scheduled.opening_cash === 'number' && Number.isFinite(scheduled.opening_cash)
        ? scheduled.opening_cash
        : 0;
      if (!scope.canManage && presetOpeningCash > 0 && openingCash !== undefined && openingCash !== presetOpeningCash) {
        throw new ShiftContractError('Only managers can override a scheduled opening cash float', 403);
      }
      const resolvedOpeningCash = openingCash !== undefined ? openingCash : presetOpeningCash;
      const shiftSlotCode = deriveShiftSlot(now, scheduled.shift, scheduled.start_time).code;
      let saved;
      try {
        saved = await db.prepare(`UPDATE staff_shifts SET clock_in = ?, shift = ?, opening_cash = ?, attendance_state = 'active', notes = COALESCE(?, notes)
          WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND staff_id = ? AND clock_in IS NULL AND clock_out IS NULL AND attendance_state = 'scheduled'`)
          .bind(now, shiftSlotCode, resolvedOpeningCash, notes ?? null, scheduled.id, targetTenant, staff.id).run();
      } catch (err) {
        if (resolvedOpeningCash === 0 && /no such column:\s*opening_cash|has no column named\s+opening_cash/i.test(String(err))) {
          saved = await db.prepare(`UPDATE staff_shifts SET clock_in = ?, shift = ?, attendance_state = 'active', notes = COALESCE(?, notes)
            WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND staff_id = ? AND clock_in IS NULL AND clock_out IS NULL AND attendance_state = 'scheduled'`)
            .bind(now, shiftSlotCode, notes ?? null, scheduled.id, targetTenant, staff.id).run();
        } else {
          throw err;
        }
      }
      if (!saved.meta.changes) throw new ShiftContractError('Shift changed; reload attendance', 409);
      id = String(scheduled.id);
    } else {
      const resolvedOpeningCash = openingCash ?? 0;
      const shiftSlotCode = deriveShiftSlot(now).code;
      let result;
      try {
        result = await db.prepare(`INSERT INTO staff_shifts
          (tenant_id, staff_id, staff_name, role, date, shift, clock_in, attendance_state, notes, opening_cash)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`)
          .bind(targetTenant, staff.id, staff.name, staff.role, businessDate(nowDate), shiftSlotCode, now, notes ?? null, resolvedOpeningCash).run();
      } catch (err) {
        if (resolvedOpeningCash === 0 && /no such column:\s*opening_cash|has no column named\s+opening_cash/i.test(String(err))) {
          result = await db.prepare(`INSERT INTO staff_shifts
            (tenant_id, staff_id, staff_name, role, date, shift, clock_in, attendance_state, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`)
            .bind(targetTenant, staff.id, staff.name, staff.role, businessDate(nowDate), shiftSlotCode, now, notes ?? null).run();
        } else {
          throw err;
        }
      }
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
  const resolvedAttendanceId = attendanceId !== undefined && String(attendanceId).trim() !== ''
    ? String(attendanceId).trim()
    : undefined;
  const resolvedNotes = notes;
  const preloaded = resolvedAttendanceId ? await getShift(scope, resolvedAttendanceId) : undefined;
  const checkStaffId = staffId || (!scope.canManage ? scope.actor.id : undefined);
  if (preloaded && checkStaffId && String(preloaded.staff_id) !== String(checkStaffId).trim()) {
    throw new ShiftContractError('Attendance record does not match staff member', 409);
  }
  const staff = await shiftTarget(scope, staffId || preloaded?.staff_id, { allowInactiveTarget: true }), db = scope.env.AURA_DB;
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
  await assertShiftCashReconciledBeforeClockOut(targetScope, active, staff.role, targetTenant);
  const now = new Date(), elapsed = now.getTime() - new Date(active.clock_in).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new ShiftContractError('Invalid clock-in timestamp', 409);
  const hours = Math.round(elapsed / 3600000 * 100) / 100;
  const mergedNotes = resolvedNotes ? [active.notes, resolvedNotes].filter(Boolean).join('; ') : active.notes;
  let saved;
  try {
    saved = await db.prepare(`UPDATE staff_shifts SET clock_out = ?, hours_worked = ?, attendance_state = 'completed', status = 'closed', notes = ?
      WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND staff_id = ? AND clock_in = ? AND clock_out IS NULL`)
      .bind(now.toISOString(), hours, mergedNotes, active.id, targetTenant, staff.id, active.clock_in).run();
  } catch (err) {
    if (/no such column:\s*status|has no column named\s+status/i.test(String(err))) {
      saved = await db.prepare(`UPDATE staff_shifts SET clock_out = ?, hours_worked = ?, attendance_state = 'completed', notes = ?
        WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND staff_id = ? AND clock_in = ? AND clock_out IS NULL`)
        .bind(now.toISOString(), hours, mergedNotes, active.id, targetTenant, staff.id, active.clock_in).run();
    } else {
      throw err;
    }
  }
  if (!saved.meta.changes) throw new ShiftContractError('Shift already closed or changed', 409);
  return getShift(targetScope, String(active.id));
}
