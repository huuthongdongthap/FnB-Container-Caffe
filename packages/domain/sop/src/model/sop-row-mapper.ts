/**
 * Row mapper between D1 snake_case rows and the camelCase domain types.
 *
 * This is the only module in the package that knows the database column
 * spelling. The policy layer speaks camelCase and the D1 layer speaks
 * snake_case; keeping the translation in one place is what stops the two
 * spellings from drifting apart silently, because a mismapped field here fails
 * one test instead of producing a tick that silently vanishes on read-back.
 */

import type {
  SopDisciplineStep,
  SopRun,
  SopRunItem,
  SopShiftType,
  SopSource,
  SopTemplate,
  SopTemplateItem,
  SopViolation,
  SopViolationCategory,
} from '../../model/sop-types';
import type { SopReminder, SopReminderKind } from '../../model/sop-types';
import type { SopRunStatus, SopViolationStatus } from './sop-state';

/** Raw D1 row shape. Fields are nullable exactly as the table declares. */
export interface SopTemplateRow {
  id: string;
  tenant_id: string;
  code: string;
  title: string;
  description: string | null;
  source: string;
  shift_type: string;
  applicable_roles: string;
  version: number;
  is_active: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface SopTemplateItemRow {
  id: string;
  tenant_id: string;
  template_id: string;
  label: string;
  description: string | null;
  order_index: number;
  is_critical: number;
  requires_note: number;
  requires_value: number;
  created_at: string | null;
}

export interface SopRunRow {
  id: string;
  tenant_id: string;
  template_id: string;
  template_version: number;
  shift_id: string | null;
  staff_id: string;
  staff_name: string | null;
  shift_type: string;
  status: string;
  scheduled_date: string | null;
  started_at: string;
  completed_at: string | null;
  abandoned_reason: string | null;
  reminder_sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SopRunItemRow {
  id: string;
  tenant_id: string;
  run_id: string;
  template_item_id: string;
  is_checked: number;
  checked_at: string | null;
  checked_by: string | null;
  note: string | null;
  value: number | null;
  created_at: string | null;
}

export interface SopReminderRow {
  id: string;
  tenant_id: string;
  template_id: string;
  kind: string;
  day_key: string;
  // Non-null only for 'overdue'; the run-less kinds have no run to point at.
  run_id: string | null;
  staff_id: string | null;
  staff_name: string | null;
  sent_at: string;
  acknowledged_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SopViolationRow {
  id: string;
  tenant_id: string;
  staff_id: string;
  staff_name: string | null;
  category: string;
  is_serious: number;
  description: string | null;
  occurred_at: string | null;
  recorded_by: string;
  status: string;
  discipline_step: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  applied_by: string | null;
  applied_at: string | null;
  appeal_explanation: string | null;
  audit_log_id: string | null;
  closed_at: string | null;
  sanction_note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function toTemplate(row: SopTemplateRow, items: SopTemplateItemRow[]): SopTemplate {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    title: row.title,
    description: row.description,
    source: row.source as SopSource,
    // The day-15 and day-30 duties are saved with shift_type 'monthly'; the
    // policy treats them as not shift-bound, which is what 'any' means.
    shiftType: (row.shift_type === 'monthly' ? 'any' : row.shift_type) as SopShiftType,
    applicableRoles: row.applicable_roles,
    version: row.version,
    isActive: row.is_active,
    items: items
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((item) => ({
        id: item.id,
        templateId: item.template_id,
        label: item.label,
        description: item.description,
        requireValue: item.requires_value,
        requireNote: item.requires_note,
        orderIndex: item.order_index,
        isCritical: item.is_critical,
      })),
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

/**
 * A run with its ticked items in the template's declared order, plus the item
 * rules the run is judged against. Passing `templateItems` lets the policy read
 * the requirements the operator actually saw; leaving it out is valid for
 * callers that only need the checklist state and never judge completion.
 */
export function toRun(
  row: SopRunRow,
  itemRows: SopRunItemRow[] = [],
  templateItems: SopTemplateItemRow[] = [],
  itemOrder: string[] = []
): SopRun {
  const order = new Map(itemOrder.map((id, index) => [id, index]));
  const items: SopRunItem[] = itemRows
    .slice()
    .sort((a, b) => {
      const left = order.get(a.template_item_id) ?? Number.MAX_SAFE_INTEGER;
      const right = order.get(b.template_item_id) ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    })
    .map((item) => ({
      id: item.id,
      runId: item.run_id,
      templateItemId: item.template_item_id,
      isChecked: item.is_checked,
      // The column is REAL because the stocktake wants measurements; the domain
      // keeps it a string so a missing value stays null rather than becoming
      // NaN, which would compare false against every threshold.
      value: item.value === null || item.value === undefined ? null : String(item.value),
      note: item.note,
      checkedBy: item.checked_by,
      checkedAt: item.checked_at,
    }));

  const ruleMap = new Map(templateItems.map((item) => [item.id, item]));
  const rules: SopTemplateItem[] = items
    .map((item) => ruleMap.get(item.templateItemId))
    .filter((item): item is SopTemplateItemRow => item !== undefined)
    .map((item) => ({
      id: item.id,
      templateId: item.template_id,
      label: item.label,
      description: item.description,
      requireValue: item.requires_value,
      requireNote: item.requires_note,
      orderIndex: item.order_index,
      isCritical: item.is_critical,
    }));

  return {
    id: row.id,
    tenantId: row.tenant_id,
    templateId: row.template_id,
    templateVersion: row.template_version,
    shiftId: row.shift_id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    // A run written before scheduled_date existed has no day on its row; the
    // start timestamp is the only honest fallback.
    shiftType: (row.shift_type === 'monthly' ? 'any' : row.shift_type) as SopShiftType,
    status: row.status as SopRunStatus,
    scheduledDate: row.scheduled_date ?? row.started_at.slice(0, 10),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    // The table records only an abandon reason: 'abandoned' plus a reason is
    // already an audit fact, and a second timestamp would only restate status.
    abandonedAt: null,
    abandonReason: row.abandoned_reason,
    completedBy: null,
    reminderSentAt: row.reminder_sent_at,
    items,
    templateItems: rules,
  };
}

/**
 * A raised obligation. The kind is carried through as the domain union rather
 * than a free string: an unrecognised kind means a row written by a newer
 * handler than this reader, which the API must not silently present as one of
 * the three it knows.
 */
export function toReminder(row: SopReminderRow): SopReminder {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    templateId: row.template_id,
    kind: row.kind as SopReminderKind,
    dayKey: row.day_key,
    runId: row.run_id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    sentAt: row.sent_at,
    acknowledgedAt: row.acknowledged_at,
  };
}

export function toViolation(row: SopViolationRow): SopViolation {  return {
    id: row.id,
    tenantId: row.tenant_id,
    staffId: row.staff_id,
    category: row.category as SopViolationCategory,
    isSerious: row.is_serious,
    note: row.description ?? '',
    occurredAt: row.occurred_at ?? '',
    recordedBy: row.recorded_by,
    confirmedBy: row.confirmed_by,
    appliedBy: row.applied_by,
    disciplineStep: (row.discipline_step ?? 'none') as SopDisciplineStep,
    status: row.status as SopViolationStatus,
    appealExplanation: row.appeal_explanation,
    closedAt: row.closed_at,
    sanctionNote: row.sanction_note,
    createdAt: row.created_at ?? '',
  };
}
