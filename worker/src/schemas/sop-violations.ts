/**
 * Conduct-breach and discipline schemas.
 *
 * The ladder is: a shift leader records, a manager confirms, an owner applies
 * the sanction, and the staff member may explain themselves before the file is
 * closed. Splitting this from `sop.ts` keeps the checklist surface readable on
 * its own — only the appeal is reachable from the mobile app, and it lives on
 * its own route rather than under the admin guard.
 */

import { z } from '@hono/zod-openapi';
import { DateTimeSchema, PaginationMetaSchema } from './common';
import {
  SopDisciplineStepEnum,
  SopViolationCategoryEnum,
  SopViolationStatusEnum,
} from './sop-enums';

export const SopViolationSchema = z
  .object({
    id: z.string().min(1),
    staffId: z.string().min(1),
    category: SopViolationCategoryEnum,
    isSerious: z.boolean(),
    note: z.string().min(1),
    occurredAt: DateTimeSchema,
    recordedBy: z.string().min(1),
    status: SopViolationStatusEnum,
    disciplineStep: SopDisciplineStepEnum,
    confirmedBy: z.string().nullable(),
    appliedBy: z.string().nullable(),
    appealExplanation: z.string().nullable(),
    closedAt: DateTimeSchema.nullable(),
    sanctionNote: z.string().nullable(),
    createdAt: DateTimeSchema,
  })
  .openapi('SopViolation');

/**
 * No `isSerious` field on purpose: the category decides seriousness server-side,
 * so the request has nothing to say about it. A breach SOP 09 §2 marks as
 * dismissible cannot be filed as a lesser one by omitting a tick box that no
 * longer exists.
 */
export const SopRecordViolationSchema = z
  .object({
    staffId: z.string().min(1),
    category: SopViolationCategoryEnum,
    note: z.string().min(1).max(2000),
    occurredAt: DateTimeSchema.optional(),
  })
  .openapi('SopRecordViolation');

export const SopApplySanctionSchema = z
  .object({
    step: SopDisciplineStepEnum,
    sanctionNote: z.string().max(2000).optional(),
  })
  .openapi('SopApplySanction');

/** The staff member's right of reply, recorded before the file is closed. */
export const SopAppealSchema = z
  .object({
    appealExplanation: z.string().max(2000).optional().nullable(),
  })
  .openapi('SopAppeal');

export const SopViolationListResponseSchema = z
  .object({ violations: z.array(SopViolationSchema), meta: PaginationMetaSchema })
  .openapi('SopViolationListResponse');
