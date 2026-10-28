/**
 * SOP checklist schemas — templates and runs.
 *
 * The wire shapes mirror the domain types in `packages/domain/sop`; the
 * snake_case D1 columns never reach a client. Numeric flags (`requireValue`,
 * `isCritical`) are declared as booleans here so an API consumer does not have
 * to know how the table stores them.
 *
 * Split across several files to stay under the 200-line ceiling:
 *   - `sop-enums.ts`: enums and the shared item shape (imported by all others)
 *   - this file: template and run
 *   - `sop-today.ts`: the open shift and why a template matched
 *   - `sop-violations.ts`: conduct breaches and the discipline ladder
 *   - `sop-admin.ts`: the oversight dashboard and template authoring
 *   - `sop-params.ts`: path params and list queries
 */

import { z } from '@hono/zod-openapi';
import {
  DateSchema,
  DateTimeSchema,
  PaginationMetaSchema,
} from './common';
import {
  SopDisciplineStepEnum,
  SopRunStatusEnum,
  SopShiftTypeEnum,
  SopSourceEnum,
  SopTemplateItemSchema,
} from './sop-enums';
import { SopOpenShiftSchema, SopTemplateReasonSchema } from './sop-today';

export const SopTemplateSchema = z
  .object({
    id: z.string().min(1),
    code: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable(),
    source: SopSourceEnum,
    shiftType: SopShiftTypeEnum,
    applicableRoles: z.string().min(1),
    version: z.number().int().positive(),
    isActive: z.boolean(),
    items: z.array(SopTemplateItemSchema),
    updatedAt: DateTimeSchema,
  })
  .openapi('SopTemplate');

export const SopTemplateListItemSchema = SopTemplateSchema.omit({ items: true }).openapi('SopTemplateListItem');

export const SopRunItemSchema = z
  .object({
    id: z.string().min(1),
    templateItemId: z.string().min(1),
    isChecked: z.boolean(),
    note: z.string().nullable(),
    /** Kept a string so an unmeasured item stays null instead of becoming NaN. */
    value: z.string().nullable(),
    checkedAt: DateTimeSchema.nullable(),
    /** The staff member who ticked it — always from the session, never from a body. */
    checkedBy: z.string().nullable(),
  })
  .openapi('SopRunItem');

/** A ticked item together with the rule it was judged against. */
export const SopRunItemStateSchema = z
  .object({
    item: SopRunItemSchema,
    rule: SopTemplateItemSchema,
  })
  .openapi('SopRunItemState');

export const SopRunSchema = z
  .object({
    id: z.string().min(1),
    templateId: z.string().min(1),
    templateVersion: z.number().int().positive(),
    shiftId: z.string().nullable(),
    staffId: z.string().min(1),
    status: SopRunStatusEnum,
    scheduledDate: DateSchema,
    startedAt: DateTimeSchema,
    completedAt: DateTimeSchema.nullable(),
    abandonReason: z.string().nullable(),
    items: z.array(SopRunItemSchema),
  })
  .openapi('SopRun');

/** Detail view: every item paired with its rule, so the client can validate. */
export const SopRunDetailSchema = z
  .object({
    run: SopRunSchema,
    states: z.array(SopRunItemStateSchema),
    template: SopTemplateListItemSchema,
  })
  .openapi('SopRunDetail');

export const SopRunProgressSchema = z
  .object({
    checked: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    criticalRemaining: z.number().int().nonnegative(),
  })
  .openapi('SopRunProgress');

export const SopRunSummarySchema = z
  .object({
    id: z.string().min(1),
    templateId: z.string().min(1),
    templateCode: z.string().min(1),
    templateTitle: z.string().min(1),
    shiftType: SopShiftTypeEnum,
    status: SopRunStatusEnum,
    scheduledDate: DateSchema,
    startedAt: DateTimeSchema,
    completedAt: DateTimeSchema.nullable(),
    progress: SopRunProgressSchema,
  })
  .openapi('SopRunSummary');

/**
 * Deliberately has no `shiftId`: the server resolves the caller's own open
 * shift from attendance, so a payload naming another member's shift cannot
 * attach the run to it. Declaring it here would advertise a field that is
 * ignored.
 */
export const SopStartRunSchema = z
  .object({
    templateId: z.string().min(1),
  })
  .openapi('SopStartRun');

/**
 * Deliberately has no `checkedBy`: the server takes the ticking staff member
 * from the session, so one operator cannot sign another member's work.
 */
export const SopCheckItemSchema = z
  .object({
    isChecked: z.boolean(),
    note: z.string().max(2000).optional().nullable(),
    /** Stocktake measurements land here; the domain keeps it a string. */
    value: z.number().optional().nullable(),
  })
  .openapi('SopCheckItem');

export const SopAbandonRunSchema = z
  .object({
    reason: z.string().min(1).max(500),
  })
  .openapi('SopAbandonRun');

export const SopRunListResponseSchema = z
  .object({ runs: z.array(SopRunSummarySchema), meta: PaginationMetaSchema })
  .openapi('SopRunListResponse');

export const SopTodayResponseSchema = z
  .object({
    /** The template this operator should run now, or null when none applies. */
    suggested: SopTemplateListItemSchema.nullable(),
    /** Why that template was chosen, so the app can explain itself. */
    reason: SopTemplateReasonSchema,
    /** The operator's open shift, or null when they have not clocked in. */
    shift: SopOpenShiftSchema.nullable(),
    /** Every run already started today, so the UI can resume rather than restart. */
    runs: z.array(SopRunSummarySchema),
  })
  .openapi('SopTodayResponse');

// The oversight dashboard and template authoring are admin-only.
export {
  SopCreateTemplateSchema,
  SopMonitorItemSchema,
  SopMonitorResponseSchema,
  SopUpdateTemplateSchema,
} from './sop-admin';
// Conduct breaches and the discipline ladder live apart so the checklist
// surface stays readable on its own.
export {
  SopApplySanctionSchema,
  SopAppealSchema,
  SopRecordViolationSchema,
  SopViolationListResponseSchema,
  SopViolationSchema,
} from './sop-violations';
// Recurring-duty notices — a separate surface from the checklist schemas.
export {
  SopReminderKindEnum,
  SopReminderSchema,
  SopReminderListQuerySchema,
  SopReminderListResponseSchema,
  SopReminderIdParamsSchema,
  SopReminderAcknowledgeResponseSchema,
} from './sop-reminders';
export {
  SopIdParamsSchema,
  SopItemParamsSchema,
  SopRunListQuerySchema,
  SopViolationIdParamsSchema,
  SopViolationListQuerySchema,
} from './sop-params';
// The shift a checklist runs in, and why a template matched.
export { SopOpenShiftSchema, SopTemplateReasonSchema } from './sop-today';
