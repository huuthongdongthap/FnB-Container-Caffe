/**
 * Read side of the SOP repository — templates and runs from D1. The violation
 * register lives in `sop-violation-reads.ts`.
 *
 * Every query filters on tenant_id first. That is not defensive style: the
 * tables are shared by every store in the deployment, so a query without the
 * tenant predicate returns another store's compliance evidence.
 */

import type { SopRun } from '../model/sop-types';
import type { SopRunItemRow, SopRunRow, SopTemplateItemRow } from '../src/model/sop-row-mapper';
import { toRun } from '../src/model/sop-row-mapper';
import { sopDatabase } from './sop-violation-columns';
import { type SopScope } from './sop-access';

/** Only the fields a run needs from its template, to avoid over-selecting. */
const RUN_TEMPLATE_COLUMNS = `SELECT ti.id, ti.template_id, ti.order_index, ti.is_critical,
  ti.requires_note, ti.requires_value FROM sop_template_items ti`;

/** Rows for the run list, without their item join — the list view does not read ticks. */
export function toRunListRow(row: SopRunRow): SopRun {
  return toRun(row);
}

/** A run with its items attached, ordered by the template's declared order. */
function runWithItems(
  row: SopRunRow,
  itemRows: SopRunItemRow[],
  templateItems: SopTemplateItemRow[],
  order: string[]
): SopRun {
  return toRun(row, itemRows, templateItems, order);
}

/**
 * Runs for one day. An empty `staffId` means the caller may see every member of
 * the store — the shift leader's view — so the staff predicate is dropped rather
 * than bound to `''`, which matches no row and silently returns nothing. The
 * tenant predicate always stays: it is what keeps one store out of another's
 * compliance records.
 */
export async function listRunsForStaffDay(scope: SopScope, staffId: string, date: string): Promise<SopRun[]> {
  const staffFilter = staffId.length > 0 ? ' AND r.staff_id = ?' : '';
  const runs = await sopDatabase(scope)
    .prepare(
      `SELECT r.id, r.tenant_id, r.template_id, r.template_version, r.shift_id, r.staff_id, r.staff_name,
              r.shift_type, r.status, r.scheduled_date, r.started_at, r.completed_at, r.abandoned_reason,
              r.reminder_sent_at, r.created_at, r.updated_at
       FROM sop_runs r WHERE r.tenant_id = ?${staffFilter} AND r.scheduled_date = ?`
    )
    .bind(scope.tenantId, ...(staffId.length > 0 ? [staffId] : []), date)
    .all<SopRunRow>();
  // Mapped without the item join: the day view shows progress and status, and
  // joining every tick for every run of the day is work nobody reads.
  return (runs.results ?? []).map(toRunListRow);
}

export async function findRun(scope: SopScope, runId: string): Promise<SopRun | null> {
  const row = await sopDatabase(scope)
    .prepare(
      `SELECT id, tenant_id, template_id, template_version, shift_id, staff_id, staff_name,
              shift_type, status, scheduled_date, started_at, completed_at, abandoned_reason,
              reminder_sent_at, created_at, updated_at
       FROM sop_runs WHERE tenant_id = ? AND id = ?`
    )
    .bind(scope.tenantId, runId)
    .first<SopRunRow>();
  if (!row) return null;

  const items = await sopDatabase(scope)
    .prepare(
      `SELECT id, tenant_id, run_id, template_item_id, is_checked, checked_at, checked_by,
              note, value, created_at
       FROM sop_run_items WHERE tenant_id = ? AND run_id = ?`
    )
    .bind(scope.tenantId, runId)
    .all<SopRunItemRow>();

  const templateItems = await sopDatabase(scope)
    .prepare(RUN_TEMPLATE_COLUMNS + ` WHERE ti.tenant_id = ? AND ti.template_id = ? ORDER BY ti.order_index, ti.id`)
    .bind(scope.tenantId, row.template_id)
    .all<SopTemplateItemRow>();

  const run = runWithItems(
    row,
    items.results ?? [],
    templateItems.results ?? [],
    (templateItems.results ?? []).map((item) => item.id)
  );
  return run;
}
