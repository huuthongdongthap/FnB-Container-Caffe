/**
 * Violation read side — the register and the monthly ladder counter.
 *
 * Apart from the checklist reads so a file stays inside the size ceiling. The
 * role gate is repeated here rather than inferred from the caller: the register
 * holds conduct evidence about named staff, so reading it is a manager-level act
 * no matter which route reached this function.
 */

import type { SopViolation } from '../model/sop-types';
import type { SopViolationRow } from '../src/model/sop-row-mapper';
import { toViolation } from '../src/model/sop-row-mapper';
import { sopDatabase, sopViolationColumns } from './sop-violation-columns';
import { SOP_VIOLATION_ROLES, SopAccessError, type SopScope } from './sop-access';

/** The register, filterable by status, month and staff — all optional. */
export async function listViolations(
  scope: SopScope,
  filters: { status?: string; month?: string; staffId?: string }
): Promise<SopViolation[]> {
  if (!SOP_VIOLATION_ROLES.includes(scope.actorRole as (typeof SOP_VIOLATION_ROLES)[number])) {
    throw new SopAccessError('Owner, manager or admin required', 403);
  }

  const conditions = ['v.tenant_id = ?'];
  const params: (string | number)[] = [scope.tenantId];
  if (filters.status) {
    conditions.push('v.status = ?');
    params.push(filters.status);
  }
  if (filters.month) {
    conditions.push("strftime('%Y-%m', v.occurred_at) = ?");
    params.push(filters.month);
  }
  if (filters.staffId) {
    conditions.push('v.staff_id = ?');
    params.push(filters.staffId);
  }

  const rows = await sopDatabase(scope)
    .prepare(
      `SELECT ${sopViolationColumns('v')}
       FROM sop_violations v WHERE ${conditions.join(' AND ')}
       ORDER BY v.occurred_at DESC, v.id DESC`
    )
    .bind(...params)
    .all<SopViolationRow>();
  return (rows.results ?? []).map(toViolation);
}

/**
 * Prior confirmed offences in the same calendar month — the ladder depends on it.
 *
 * Counts every state past confirmation, not just the two that were open when this
 * was written. Closing a file settles it, it does not delete it (SOP 09 §5: the
 * record survives a dismissal), so a closed first offence must still push the
 * next one a rung up instead of restarting the month at a written warning. Only
 * `recorded` is excluded: an unconfirmed breach is not yet a violation, and the
 * recorder cannot confirm it themselves anyway.
 */
export async function countConfirmedInMonth(scope: SopScope, staffId: string, month: string): Promise<number> {
  const row = await sopDatabase(scope)
    .prepare(
      `SELECT COUNT(*) AS total FROM sop_violations
       WHERE tenant_id = ? AND staff_id = ? AND status IN ('confirmed', 'applied', 'appealed', 'closed')
         AND strftime('%Y-%m', occurred_at) = ?`
    )
    .bind(scope.tenantId, staffId, month)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

export type { SopViolationRow };

