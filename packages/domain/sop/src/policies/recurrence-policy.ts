/**
 * Recurrence and shift-derivation policy — pure functions, no database access.
 *
 * Two concerns:
 * 1. The fixed monthly duties (SOP 00 §5: deep clean on the 15th, stocktake on
 *    the 30th). February has no 30th, so the stocktake falls back to the last
 *    day of the month rather than silently skipping.
 * 2. Mapping a wall-clock hour and an operator role onto the template that
 *    should run, so the mobile app can suggest a checklist without the caller
 *    re-implementing the shift table.
 *
 * Boundaries live in one place so an opening-hours change is a single edit.
 */

import type { StaffRole } from '@aura/domain-staff';
import type { SopShiftType, SopTemplate } from '../../model/sop-types';

const DEEP_CLEAN_DAY = 15;
const AUDIT_DAY = 30;

/** Opening hours per SOP 00 + SOP 06; Ca A 06:00–14:00, Ca B 14:00–22:00. */
export const SHIFT_BOUNDARIES = {
  caA: { startHour: 6, endHour: 14 },
  caB: { startHour: 14, endHour: 22 },
  closingHour: 22,
} as const;

export function isDeepCleanDay(date: Date): boolean {
  return date.getDate() === DEEP_CLEAN_DAY;
}

/**
 * True on the stocktake day. Months shorter than 30 days fall back to their
 * last day, so a February stocktake lands on the 28th/29th.
 */
export function isAuditDay(date: Date): boolean {
  const day = date.getDate();
  if (day === AUDIT_DAY) return true;
  return day === auditDayOfMonth(date.getFullYear(), date.getMonth());
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * The day the monthly stocktake falls on: the 30th when the month has one,
 * otherwise its last day. Building the date from this value avoids the JS
 * overflow trap where `new Date(2027, 1, 30)` silently becomes March 2.
 */
function auditDayOfMonth(year: number, monthIndex: number): number {
  const last = lastDayOfMonth(year, monthIndex);
  return last >= AUDIT_DAY ? AUDIT_DAY : last;
}

/** Next deep-clean date strictly after `from`, used for the advance reminder. */
export function nextDeepClean(from: Date): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth(), DEEP_CLEAN_DAY);
  return candidate > from ? candidate : new Date(from.getFullYear(), from.getMonth() + 1, DEEP_CLEAN_DAY);
}

/** Next stocktake date strictly after `from`, honouring the short-month rule. */
export function nextAudit(from: Date): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth(), auditDayOfMonth(from.getFullYear(), from.getMonth()));
  if (candidate > from) return candidate;
  return new Date(from.getFullYear(), from.getMonth() + 1, auditDayOfMonth(from.getFullYear(), from.getMonth() + 1));
}

/**
 * Which shift an hour belongs to. Hours outside operating time are attributed to
 * Ca C, because a checklist completed at 01:00 is part of the previous evening's
 * close rather than a shift of its own.
 */
export function deriveShiftType(hour: number): SopShiftType {
  if (hour >= SHIFT_BOUNDARIES.caA.startHour && hour < SHIFT_BOUNDARIES.caB.startHour) return 'a';
  if (hour >= SHIFT_BOUNDARIES.caB.startHour && hour < SHIFT_BOUNDARIES.closingHour) return 'b';
  return 'c';
}

export interface TemplateMatchInput {
  templates: SopTemplate[];
  shiftType: SopShiftType;
  role: StaffRole | string;
  date: Date;
}

export interface TemplateMatch {
  /** The single best template for this moment, or null when nothing applies. */
  template: SopTemplate | null;
  /**
   * Why this template matched — or why none did.
   *
   * `not_clocked_in` is the caller's own state, not a policy outcome: the
   * template set is unchanged, but the member has no open shift to record
   * against. It is set by the caller rather than here, because this function is
   * pure and the open shift lives in the database.
   */
  reason: 'shift_template' | 'deep_clean_due' | 'inventory_audit_due' | 'not_clocked_in' | 'none_applicable';
}

/**
 * Picks the template an operator should run now. Shift-bound templates win
 * during operating hours; the fixed monthly duties apply on their day to any
 * active role. Only shift templates are role-filtered — monthly duties are
 * whole-store.
 */
export function sopForShift(input: TemplateMatchInput): TemplateMatch {
  const active = input.templates.filter((template) => template.isActive === 1);
  const roleOk = active.filter((template) => isRoleApplicable(template.applicableRoles, input.role));

  const shiftTemplates = roleOk.filter(
    (template) => template.shiftType === input.shiftType || template.shiftType === 'any'
  );
  if (isDeepCleanDay(input.date)) {
    const deepClean = active.find((template) => template.code === 'deep-clean-m15');
    if (deepClean) return { template: deepClean, reason: 'deep_clean_due' };
  }
  if (isAuditDay(input.date)) {
    const audit = active.find((template) => template.code === 'inventory-audit-m30');
    if (audit) return { template: audit, reason: 'inventory_audit_due' };
  }

  const preferred = shiftTemplates.find((template) => template.shiftType === input.shiftType);
  const chosen = preferred ?? shiftTemplates[0] ?? null;
  return { template: chosen, reason: chosen ? 'shift_template' : 'none_applicable' };
}

function isRoleApplicable(applicableRoles: string, role: StaffRole | string): boolean {
  const allowed = applicableRoles
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(String(role));
}

/**
 * Whether a run that is still open has overrun its window. Overdue work is
 * escalated to the shift leader; the window is per shift type.
 */
export function isOverdue(startedAt: string, shiftType: SopShiftType, now: Date): boolean {
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return false;
  const windowMinutes = shiftType === 'a' ? 30 : shiftType === 'b' ? 40 : 60;
  return now.getTime() - started > windowMinutes * 60_000;
}
