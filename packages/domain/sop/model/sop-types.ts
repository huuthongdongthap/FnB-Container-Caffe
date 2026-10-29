/**
 * SOP digitization domain types — pure data shapes, no D1/KV imports.
 *
 * A "template" is the machine-readable form of a paper SOP checklist
 * (opening, closing, deep clean, stocktake). A "run" is one execution of a
 * template by one staff member inside one shift. A "violation" is a breach of
 * the conduct code, escalated through a fixed three-step approval ladder.
 *
 * These interfaces are camelCase throughout. The snake_case column spelling
 * lives in `src/model/sop-row-mapper.ts`, which is the single place that knows
 * how a D1 row maps onto one of these shapes.
 */

import type { SopRunStatus, SopViolationStatus } from '../src/model/sop-state';

/** Which paper SOP document a template was transcribed from. */
export type SopSource = 'SOP00' | 'SOP01' | 'SOP06' | 'SOP09';

/**
 * Shift a template belongs to. `any` means the template is not shift-bound
 * (onboarding, deep clean, stocktake).
 */
export type SopShiftType = 'a' | 'b' | 'c' | 'any';

/** The six prohibited-conduct groups from SOP 09 §2. */
export type SopViolationCategory =
  | 'time'
  | 'conduct'
  | 'assets_finance'
  | 'secrets'
  | 'stimulants'
  | 'workspace';

/** Discipline ladder step, in escalating order. */
export type SopDisciplineStep = 'none' | 'written_warning' | 'fine' | 'termination';

export interface SopTemplateItem {
  id: string;
  templateId: string;
  label: string;
  description: string | null;
  /** Item must carry a numeric measurement before the run can complete. */
  requireValue: number;
  /** Item must carry a free-text note before the run can complete. */
  requireNote: number;
  orderIndex: number;
  /** A critical item blocks completion while unchecked. */
  isCritical: number;
}

export interface SopTemplate {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  description: string | null;
  source: SopSource;
  shiftType: SopShiftType;
  /** Comma-separated roles allowed to execute this template. */
  applicableRoles: string;
  /** Bumped on every item edit; a run pins the version it started against. */
  version: number;
  isActive: number;
  items: SopTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SopRunItem {
  id: string;
  runId: string;
  templateItemId: string;
  isChecked: number;
  note: string | null;
  value: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
}

export interface SopRun {
  id: string;
  tenantId: string;
  templateId: string;
  templateVersion: number;
  shiftId: string | null;
  staffId: string;
  staffName: string | null;
  shiftType: SopShiftType;
  status: SopRunStatus;
  /**
   * The calendar day the checklist belongs to, in the store's timezone. A run
   * opened just after midnight still belongs to the previous day's shift, which
   * is why it is captured at start rather than derived from `startedAt`.
   */
  scheduledDate: string;
  startedAt: string;
  completedAt: string | null;
  abandonedAt: string | null;
  abandonReason: string | null;
  completedBy: string | null;
  reminderSentAt: string | null;
  items: SopRunItem[];
  /**
   * The item rules this run was pinned against, read from the template version
   * the run recorded. Loaded by the repository so the policy can judge a tick
   * against the requirements the operator actually saw, not the template as it
   * reads today. Not persisted on the run row.
   */
  templateItems?: SopTemplateItem[];
}

/**
 * The three reasons a reminder exists. `upcoming` is advance notice before a
 * monthly duty, `due_no_run` is the duty's own day with nobody having started
 * it, and `overdue` is a run that has overrun the window its shift allows.
 */
export type SopReminderKind = 'upcoming' | 'due_no_run' | 'overdue';

/**
 * An obligation the store owes, raised by the recurring-duty task. It is a
 * notice, not a checklist record: nothing here is work that was performed.
 */
export interface SopReminder {
  id: string;
  tenantId: string;
  templateId: string;
  kind: SopReminderKind;
  /** The store's calendar day the reminder is about, as YYYY-MM-DD. */
  dayKey: string;
  /** Set only for `overdue`, which is about one specific run. */
  runId: string | null;
  staffId: string | null;
  staffName: string | null;
  sentAt: string;
  acknowledgedAt: string | null;
}

export interface SopViolation {
  id: string;
  tenantId: string;
  staffId: string;
  category: SopViolationCategory;
  /** True for the serious breaches that jump straight to termination. */
  isSerious: number;
  note: string;
  occurredAt: string;
  recordedBy: string;
  confirmedBy: string | null;
  appliedBy: string | null;
  disciplineStep: SopDisciplineStep;
  status: SopViolationStatus;
  appealExplanation: string | null;
  closedAt: string | null;
  /** The applying manager's own note, kept apart from `note` — see the migration. */
  sanctionNote: string | null;
  createdAt: string;
}
