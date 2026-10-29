/**
 * Checklist run lifecycle policy — pure functions, no database access.
 *
 * Enforces the evidence invariants that make a completed checklist trustworthy:
 * critical items must be ticked before completion, required notes/values must be
 * present, and a completed or abandoned run is immutable. Callers in phase 4
 * pass already-loaded rows and persist the returned state.
 */

import type { SopRun, SopRunItem, SopTemplate, SopTemplateItem } from '../../model/sop-types';
import { canTransitionRun, isRunTerminal } from '../model/sop-state';
import {
  blockingCriticalItems,
  computeProgress,
  findRowMissingDetail,
  hasRequiredDetail,
} from './checklist-lifecycle-utils';

export interface StartRunInput {
  runId: string;
  tenantId: string;
  template: SopTemplate;
  templateVersion: number;
  staffId: string;
  staffName?: string | null;
  shiftId?: string | null;
  now: string;
  /** The store's calendar day the run belongs to; captured at start. */
  scheduledDate: string;
}

export interface CheckItemInput {
  run: SopRun;
  item: SopTemplateItem;
  isChecked: boolean;
  note?: string | null;
  value?: string | null;
  checkedBy: string;
  now: string;
}

export type PolicyResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** A template is executable when active and it declares at least one item. */
export function isTemplateExecutable(template: SopTemplate): boolean {
  return template.isActive === 1 && template.items.length > 0;
}

/**
 * Builds a fresh run with one unchecked row per template item, in declared order.
 * The version the run started against is pinned so later template edits never
 * rewrite history that was already submitted as evidence.
 */
export function startRun(input: StartRunInput): PolicyResult<SopRun> {
  if (!isTemplateExecutable(input.template)) {
    return { ok: false, error: 'template_not_executable' };
  }

  const items: SopRunItem[] = input.template.items.map((item) => ({
    id: `${input.runId}:${item.id}`,
    runId: input.runId,
    templateItemId: item.id,
    isChecked: 0,
    note: null,
    value: null,
    checkedBy: null,
    checkedAt: null,
  }));

  return {
    ok: true,
    data: {
      id: input.runId,
      tenantId: input.tenantId,
      templateId: input.template.id,
      templateVersion: input.templateVersion,
      shiftId: input.shiftId ?? null,
      staffId: input.staffId,
      // Captured at start so a run always carries the day it was opened on, even
      // if the operator crosses midnight mid-checklist.
      staffName: input.staffName ?? null,
      shiftType: input.template.shiftType,
      status: 'in_progress',
      scheduledDate: input.scheduledDate,
      startedAt: input.now,
      completedAt: null,
      abandonedAt: null,
      abandonReason: null,
      completedBy: null,
      reminderSentAt: null,
      items,
    },
  };
}

/**
 * Ticks or unticks one item. Unticking clears any note/value that was only
 * supplied to satisfy that item's requirement. The actor always comes from the
 * authenticated session, never the request body.
 */
export function checkItem(input: CheckItemInput): PolicyResult<SopRun> {
  if (isRunTerminal(input.run.status)) {
    return { ok: false, error: 'run_immutable' };
  }
  if (input.isChecked && !hasRequiredDetail(input.item, input)) {
    return { ok: false, error: 'missing_required_detail' };
  }

  const items = input.run.items.map((row) =>
    row.templateItemId === input.item.id
      ? {
          ...row,
          isChecked: input.isChecked ? 1 : 0,
          note: input.isChecked ? (input.note ?? null) : null,
          value: input.isChecked ? (input.value ?? null) : null,
          checkedBy: input.checkedBy,
          checkedAt: input.now,
        }
      : row
  );

  return { ok: true, data: { ...input.run, items } };
}

export interface CompleteRunInput {
  run: SopRun;
  templateItems: SopTemplateItem[];
  completedBy: string;
  now: string;
}

/**
 * Completes a run once every critical item is ticked and every required detail
 * is present. Non-critical unchecked items are allowed through — skipping an
 * optional step is not a compliance failure, but skipping a critical one is.
 */
export function completeRun(input: CompleteRunInput): PolicyResult<SopRun> {
  if (!canTransitionRun(input.run.status, 'completed')) {
    return { ok: false, error: 'run_immutable' };
  }
  if (blockingCriticalItems(input.run, input.templateItems).length > 0) {
    return { ok: false, error: 'critical_items_incomplete' };
  }
  if (findRowMissingDetail(input.run.items, input.templateItems)) {
    return { ok: false, error: 'missing_required_detail' };
  }

  return {
    ok: true,
    data: {
      ...input.run,
      status: 'completed',
      completedAt: input.now,
      completedBy: input.completedBy,
    },
  };
}

export interface AbandonRunInput {
  run: SopRun;
  reason: string;
  now: string;
}

/** Abandons a run with a mandatory reason — an unexplained gap is not auditable. */
export function abandonRun(input: AbandonRunInput): PolicyResult<SopRun> {
  if (!canTransitionRun(input.run.status, 'abandoned')) {
    return { ok: false, error: 'run_immutable' };
  }
  if (!input.reason.trim()) {
    return { ok: false, error: 'reason_required' };
  }

  return {
    ok: true,
    data: {
      ...input.run,
      status: 'abandoned',
      abandonedAt: input.now,
      abandonReason: input.reason.trim(),
    },
  };
}

export { blockingCriticalItems, computeProgress };
