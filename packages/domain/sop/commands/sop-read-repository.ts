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

/** Fields a run needs from its template to evaluate rules and render item labels. */
const RUN_TEMPLATE_COLUMNS = `SELECT ti.id, ti.tenant_id, ti.template_id, ti.label, ti.description,
  ti.order_index, ti.is_critical, ti.requires_note, ti.requires_value FROM sop_template_items ti`;

/** Rows for the run list when item hydration is not available. */
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

export interface ListRunsForStaffDayOptions {
  staffId?: string;
  date?: string;
  templateId?: string;
}

/**
 * Runs for one day, optionally filtered by staffId and templateId, with run
 * items and template item rules batch-hydrated so progress and overdue views
 * reflect actual checklist ticks.
 */
export async function listRunsForStaffDay(
  scope: SopScope,
  staffIdOrOptions: string | ListRunsForStaffDayOptions,
  dateArg?: string,
  templateIdArg?: string | { templateId?: string }
): Promise<SopRun[]> {
  const staffId =
    typeof staffIdOrOptions === 'string'
      ? staffIdOrOptions
      : (staffIdOrOptions.staffId ?? '');
  const date =
    typeof staffIdOrOptions === 'string'
      ? (dateArg ?? '')
      : (staffIdOrOptions.date ?? dateArg ?? '');
  const rawTemplateId =
    typeof staffIdOrOptions === 'object' && staffIdOrOptions !== null
      ? staffIdOrOptions.templateId
      : typeof templateIdArg === 'string'
        ? templateIdArg
        : templateIdArg?.templateId;
  const templateId = typeof rawTemplateId === 'string' ? rawTemplateId.trim() : '';

  const staffFilter = staffId.length > 0 ? ' AND r.staff_id = ?' : '';
  const templateFilter = templateId.length > 0 ? ' AND r.template_id = ?' : '';
  const bindParams: string[] = [
    scope.tenantId,
    ...(staffId.length > 0 ? [staffId] : []),
    date,
    ...(templateId.length > 0 ? [templateId] : []),
  ];

  const runs = await sopDatabase(scope)
    .prepare(
      `SELECT r.id, r.tenant_id, r.template_id, r.template_version, r.shift_id, r.staff_id, r.staff_name,
              r.shift_type, r.status, r.scheduled_date, r.started_at, r.completed_at, r.abandoned_reason,
              r.reminder_sent_at, r.created_at, r.updated_at
       FROM sop_runs r WHERE r.tenant_id = ?${staffFilter} AND r.scheduled_date = ?${templateFilter}`
    )
    .bind(...bindParams)
    .all<SopRunRow>();

  const rows = (runs.results ?? []).filter(
    (row) => templateId.length === 0 || row.template_id === templateId
  );
  if (rows.length === 0) return [];

  try {
    const runIds = rows.map((row) => row.id);
    const runPlaceholders = runIds.map(() => '?').join(', ');
    const allItems = await sopDatabase(scope)
      .prepare(
        `SELECT id, tenant_id, run_id, template_item_id, is_checked, checked_at, checked_by,
                note, value, created_at
         FROM sop_run_items WHERE tenant_id = ? AND run_id IN (${runPlaceholders})`
      )
      .bind(scope.tenantId, ...runIds)
      .all<SopRunItemRow>();

    const templateIds = [...new Set(rows.map((row) => row.template_id))];
    const tplPlaceholders = templateIds.map(() => '?').join(', ');
    const allTemplateItems = await sopDatabase(scope)
      .prepare(
        `${RUN_TEMPLATE_COLUMNS} WHERE ti.tenant_id = ? AND ti.template_id IN (${tplPlaceholders}) ORDER BY ti.order_index, ti.id`
      )
      .bind(scope.tenantId, ...templateIds)
      .all<SopTemplateItemRow>();

    const itemsByRun = new Map<string, SopRunItemRow[]>();
    for (const item of allItems.results ?? []) {
      const list = itemsByRun.get(item.run_id) ?? [];
      list.push(item);
      itemsByRun.set(item.run_id, list);
    }

    const tplItemsByTemplate = new Map<string, SopTemplateItemRow[]>();
    for (const tplItem of allTemplateItems.results ?? []) {
      const list = tplItemsByTemplate.get(tplItem.template_id) ?? [];
      list.push(tplItem);
      tplItemsByTemplate.set(tplItem.template_id, list);
    }

    return rows.map((row) => {
      const rItems = itemsByRun.get(row.id) ?? [];
      const tItems = tplItemsByTemplate.get(row.template_id) ?? [];
      return runWithItems(
        row,
        rItems,
        tItems,
        tItems.map((item) => item.id)
      );
    });
  } catch {
    return rows.map(toRunListRow);
  }
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
