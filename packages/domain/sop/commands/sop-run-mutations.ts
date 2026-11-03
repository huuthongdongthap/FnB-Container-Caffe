/**
 * SOP run mutations — ticking an item, completing and abandoning a run.
 *
 * Apart from `sop-write-repository.ts` (which starts runs) so each file stays
 * inside the size ceiling; the shared accessors and policy-error mapping come
 * from `sop-write-support.ts`.
 */

import {
  abandonRun,
  checkItem,
  completeRun,
  type AbandonRunInput,
  type CheckItemInput,
  type CompleteRunInput,
  type SopRun,
} from '../index';
import { assertActorOrManager, assertId, SopAccessError, type SopScope } from './sop-access';
import { sopDatabase } from './sop-violation-columns';
import { findRun } from './sop-read-repository';
import { mapPolicyError, nowIso, templateItemOf, templateItemsOf } from './sop-write-support';

export async function setItemChecked(
  scope: SopScope,
  runId: string,
  templateItemId: string,
  payload: { isChecked: boolean; note?: string | null; value?: number | null }
): Promise<SopRun> {
  const id = assertId(runId, 'runId');
  const itemId = assertId(templateItemId, 'itemId');

  const run = await findRun(scope, id);
  if (!run) throw new SopAccessError('Run not found', 404);
  assertActorOrManager(scope, run.staffId);

  let itemIdx = run.items.findIndex((row) => row.templateItemId === itemId);
  if (itemIdx === -1) {
    const ruleIdx = (run.templateItems ?? []).findIndex((rule) => rule.id === itemId);
    if (ruleIdx !== -1 && ruleIdx < run.items.length) {
      itemIdx = ruleIdx;
    }
  }
  const item = itemIdx !== -1 ? run.items[itemIdx] : undefined;
  if (!item) throw new SopAccessError('Item not found', 404);

  const rawRule =
    run.templateItems?.find((rule) => rule.id === item.templateItemId || rule.id === itemId) ??
    run.templateItems?.[itemIdx] ??
    templateItemOf(run, item.templateItemId);
  const alignedRule = { ...rawRule, id: item.templateItemId };

  const updated = checkItem({
    run,
    item: alignedRule,
    isChecked: payload.isChecked,
    note: payload.note ?? null,
    value: payload.value === null || payload.value === undefined ? null : String(payload.value),
    checkedBy: scope.actorId,
    now: nowIso(),
  } satisfies CheckItemInput);
  if (!updated.ok) throw new SopAccessError(mapPolicyError(updated.error), 409);

  const next = updated.data;
  const written = next.items.find((row) => row.templateItemId === item.templateItemId)!;

  const result = await sopDatabase(scope)
    .prepare(
      `UPDATE sop_run_items
          SET is_checked = ?, checked_at = ?, checked_by = ?, note = ?, value = ?
        WHERE tenant_id = ? AND run_id = ? AND template_item_id = ?`
    )
    .bind(
      written.isChecked,
      written.checkedAt,
      written.checkedBy,
      written.note,
      written.value === null ? null : Number(written.value),
      scope.tenantId,
      id,
      item.templateItemId
    )
    .run();
  if (!result.meta.changes) throw new SopAccessError('Run changed; reload', 409);

  return next;
}

export async function completeRunForStaff(scope: SopScope, runId: string): Promise<SopRun> {
  const id = assertId(runId, 'runId');
  const run = await findRun(scope, id);
  if (!run) throw new SopAccessError('Run not found', 404);
  assertActorOrManager(scope, run.staffId);

  const templateItems = templateItemsOf(run);
  const ruleIds = new Set(templateItems.map((rule) => rule.id));
  const alignedRun: SopRun = {
    ...run,
    items: run.items.map((row, idx) =>
      ruleIds.has(row.templateItemId) || !templateItems[idx]
        ? row
        : { ...row, templateItemId: templateItems[idx].id }
    ),
  };

  const closed = completeRun({
    run: alignedRun,
    templateItems,
    completedBy: scope.actorId,
    now: nowIso(),
  } satisfies CompleteRunInput);
  if (!closed.ok) throw new SopAccessError(mapPolicyError(closed.error), 409);

  const result = await sopDatabase(scope)
    .prepare(
      `UPDATE sop_runs SET status = 'completed', completed_at = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ? AND status = 'in_progress'`
    )
    .bind(closed.data.completedAt, nowIso(), scope.tenantId, id)
    .run();
  if (!result.meta.changes) throw new SopAccessError('Run is already closed', 409);

  return { ...closed.data, items: run.items };
}

export async function abandonRunForStaff(
  scope: SopScope,
  runId: string,
  payload: { reason: string }
): Promise<SopRun> {
  const id = assertId(runId, 'runId');
  const run = await findRun(scope, id);
  if (!run) throw new SopAccessError('Run not found', 404);
  assertActorOrManager(scope, run.staffId);

  const abandoned = abandonRun({ run, reason: payload.reason ?? '', now: nowIso() } satisfies AbandonRunInput);
  if (!abandoned.ok) throw new SopAccessError(mapPolicyError(abandoned.error), 400);

  const result = await sopDatabase(scope)
    .prepare(
      `UPDATE sop_runs SET status = 'abandoned', abandoned_reason = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ? AND status = 'in_progress'`
    )
    .bind(abandoned.data.abandonReason, nowIso(), scope.tenantId, id)
    .run();
  if (!result.meta.changes) throw new SopAccessError('Run is already closed', 409);

  return abandoned.data;
}

