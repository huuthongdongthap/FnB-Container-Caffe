/**
 * Shared helpers for the checklist lifecycle policy.
 *
 * Kept in their own module so the run-state transitions and the item-detail
 * rules stay independently readable, and because both `checkItem` and
 * `completeRun` must agree on exactly what "required detail supplied" means —
 * a rule defined in two places is a rule that eventually disagrees with itself.
 */

import type { SopRun, SopRunItem, SopTemplateItem } from '../../model/sop-types';

/** True when a value was actually supplied (not empty, not whitespace-only). */
export function isPresent(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

/** True when every detail this item demands has been supplied. */
export function hasRequiredDetail(
  item: Pick<SopTemplateItem, 'requireNote' | 'requireValue'>,
  detail: { note?: string | null; value?: string | null }
): boolean {
  if (item.requireNote === 1 && String(detail.note ?? '').trim().length === 0) return false;
  if (item.requireValue === 1 && !isPresent(detail.value)) return false;
  return true;
}

/** Critical template items that are still unticked and therefore block completion. */
export function blockingCriticalItems(
  run: SopRun,
  templateItems: SopTemplateItem[]
): SopTemplateItem[] {
  const unchecked = new Set(
    run.items.filter((row) => row.isChecked !== 1).map((row) => row.templateItemId)
  );
  return templateItems.filter((item) => item.isCritical === 1 && unchecked.has(item.id));
}

/** Tick percentage of the template, floored; 100 only when every item is ticked. */
export function computeProgress(run: SopRun, templateItems: SopTemplateItem[]): number {
  if (templateItems.length === 0) return 0;
  const done = run.items.filter((row) => row.isChecked === 1).length;
  return Math.min(100, Math.floor((done / templateItems.length) * 100));
}

/** A checked row missing a detail its template item requires. */
export function findRowMissingDetail(
  rows: SopRunItem[],
  templateItems: SopTemplateItem[]
): SopRunItem | null {
  const byId = new Map(templateItems.map((item) => [item.id, item]));
  for (const row of rows) {
    if (row.isChecked !== 1) continue;
    const item = byId.get(row.templateItemId);
    if (!item) continue;
    if (!hasRequiredDetail(item, row)) return row;
  }
  return null;
}
