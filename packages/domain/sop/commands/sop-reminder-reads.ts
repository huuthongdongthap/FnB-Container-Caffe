/**
 * Recurring-duty reminder read side — the ledger, and the open count.
 *
 * Read-only by design: the ledger is written by the scheduled task, never by a
 * request. The one mutation that exists is `acknowledgeReminder`, which marks a
 * notice as handled rather than deleting it — the obligation happened, and a
 * store's history of monthly duties it was warned about should survive the
 * warning being read.
 *
 * The role gate is repeated here rather than trusted from the route, for the
 * same reason as the violation register: reading it is a manager-level act.
 */

import type { SopReminder, SopReminderKind } from '../model/sop-types';
import type { SopReminderRow } from '../src/model/sop-row-mapper';
import { toReminder } from '../src/model/sop-row-mapper';
import { sopDatabase } from './sop-violation-columns';
import { SOP_VIOLATION_ROLES, SopAccessError, assertId, type SopScope } from './sop-access';

/** The reminder columns every read selects, in one place so they cannot drift. */
function sopReminderColumns(alias: string): string {
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}id, ${prefix}tenant_id, ${prefix}template_id, ${prefix}kind, ${prefix}day_key,
    ${prefix}run_id, ${prefix}staff_id, ${prefix}staff_name, ${prefix}sent_at,
    ${prefix}acknowledged_at, ${prefix}created_at, ${prefix}updated_at`;
}

function assertReminderRole(scope: SopScope): void {
  if (!SOP_VIOLATION_ROLES.includes(scope.actorRole as (typeof SOP_VIOLATION_ROLES)[number])) {
    throw new SopAccessError('Owner, manager or admin required', 403);
  }
}

/**
 * Newest first, and unacknowledged before acknowledged within the same day:
 * a notice nobody has handled is the one the console is asking about. The
 * ordering is stable on `id` so two rows written in the same pass do not swap
 * places between reads and make the list appear to flicker.
 */
export async function listReminders(
  scope: SopScope,
  filters: { kind?: string; dayKey?: string; templateId?: string; unreadOnly?: boolean; limit?: number } = {}
): Promise<SopReminder[]> {
  assertReminderRole(scope);

  const conditions = ['r.tenant_id = ?'];
  const params: (string | number)[] = [scope.tenantId];
  if (filters.kind) {
    conditions.push('r.kind = ?');
    params.push(filters.kind);
  }
  if (filters.dayKey) {
    conditions.push('r.day_key = ?');
    params.push(filters.dayKey);
  }
  if (filters.templateId) {
    conditions.push('r.template_id = ?');
    params.push(filters.templateId);
  }
  if (filters.unreadOnly) {
    conditions.push('r.acknowledged_at IS NULL');
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const rows = await sopDatabase(scope)
    .prepare(
      `SELECT ${sopReminderColumns('r')}
       FROM sop_reminders r WHERE ${conditions.join(' AND ')}
       ORDER BY (r.acknowledged_at IS NULL) DESC, r.day_key DESC, r.sent_at DESC, r.id DESC
       LIMIT ?`
    )
    .bind(...params, limit)
    .all<SopReminderRow>();

  return (rows.results ?? []).map(toReminder);
}

/**
 * Per-kind open counts for the badge, read in one pass rather than one query
 * per kind. The count is what the console shows, so it must agree with what
 * `listReminders` returns for the same filters.
 */
export async function countOpenReminders(
  scope: SopScope
): Promise<{ total: number; byKind: Record<SopReminderKind, number> }> {
  assertReminderRole(scope);

  const rows = await sopDatabase(scope)
    .prepare(
      `SELECT kind, COUNT(*) AS total FROM sop_reminders
       WHERE tenant_id = ? AND acknowledged_at IS NULL
       GROUP BY kind`
    )
    .bind(scope.tenantId)
    .all<{ kind: string; total: number }>();

  const byKind: Record<SopReminderKind, number> = { upcoming: 0, due_no_run: 0, overdue: 0 };
  let total = 0;
  for (const row of rows.results ?? []) {
    const kind = row.kind as SopReminderKind;
    if (kind in byKind) {
      byKind[kind] = Number(row.total);
      total += Number(row.total);
    }
  }
  return { total, byKind };
}

/**
 * Marks a notice as handled. Scoped by tenant so one store cannot acknowledge
 * another's notice by guessing an id, and idempotent: acknowledging twice is a
 * no-op rather than an error, because a double-tap on the button should not
 * surface as a 500 on a ledger that is already correct.
 */
export async function acknowledgeReminder(scope: SopScope, reminderId: string): Promise<boolean> {
  assertReminderRole(scope);
  assertId(reminderId, 'reminder id');

  const now = new Date().toISOString();
  const result = await sopDatabase(scope)
    .prepare(
      `UPDATE sop_reminders SET acknowledged_at = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ? AND acknowledged_at IS NULL`
    )
    .bind(now, now, reminderId, scope.tenantId)
    .run();
  return result.meta.changes > 0;
}
