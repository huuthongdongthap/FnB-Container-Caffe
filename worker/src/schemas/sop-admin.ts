/**
 * Admin-only SOP schemas — the oversight dashboard and template authoring.
 *
 * Only the `/api/sop/admin/*` group uses these. They live apart from `sop.ts`
 * so the mobile checklist surface stays readable on its own.
 */

import { z } from '@hono/zod-openapi';
import { DateTimeSchema, StaffRoleEnum } from './common';
import {
  SopRunStatusEnum,
  SopShiftTypeEnum,
  SopSourceEnum,
  SopTemplateItemSchema,
} from './sop-enums';
import { SopRunProgressSchema } from './sop';

export const SopMonitorItemSchema = z
  .object({
    id: z.string().min(1),
    staffId: z.string().min(1),
    staffName: z.string().nullable(),
    templateCode: z.string().min(1),
    templateTitle: z.string().min(1),
    shiftType: SopShiftTypeEnum,
    status: SopRunStatusEnum,
    startedAt: DateTimeSchema,
    progress: SopRunProgressSchema,
    /** Past the window its shift allows; escalated to the shift leader. */
    isOverdue: z.boolean(),
  })
  .openapi('SopMonitorItem');

export const SopMonitorResponseSchema = z
  .object({
    runs: z.array(SopMonitorItemSchema),
    completedToday: z.number().int().nonnegative(),
    inProgressToday: z.number().int().nonnegative(),
    overdueToday: z.number().int().nonnegative(),
  })
  .openapi('SopMonitorResponse');

export const SopCreateTemplateSchema = z
  .object({
    code: z.string().min(1).max(64),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    source: SopSourceEnum,
    shiftType: SopShiftTypeEnum,
    applicableRoles: z.array(StaffRoleEnum).min(1),
    items: z.array(SopTemplateItemSchema.omit({ id: true })).min(1),
  })
  .openapi('SopCreateTemplate');

/**
 * Every field optional, but one that is present must carry a value: a PATCH that
 * clears a field is expressed with `null`, so `undefined` means "leave alone".
 */
export const SopUpdateTemplateSchema = SopCreateTemplateSchema.partial().openapi('SopUpdateTemplate');
