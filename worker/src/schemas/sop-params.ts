/**
 * Route parameters and list queries shared by the SOP routers.
 *
 * Kept apart from the entity schemas so `sop.ts` stays about the shapes the
 * policy speaks and this file stays about what a URL carries.
 */

import { z } from '@hono/zod-openapi';
import { PaginationQuerySchema } from './common';
import { SopRunStatusEnum, SopViolationStatusEnum } from './sop-enums';

export const SopIdParamsSchema = z
  .object({ id: z.string().min(1).openapi({ example: 'run_3f6b1c22-9d4e-4a71-8f0c-1b2d3e4f5a6b' }) })
  .openapi('SopIdParams');

export const SopItemParamsSchema = z
  .object({
    id: z.string().min(1),
    /** The template item id, which stays stable across template versions. */
    itemId: z.string().min(1),
  })
  .openapi('SopItemParams');

export const SopViolationIdParamsSchema = z
  .object({ id: z.string().min(1) })
  .openapi('SopViolationIdParams');

export const SopRunListQuerySchema = PaginationQuerySchema.extend({
  status: SopRunStatusEnum.optional(),
  templateId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
}).openapi('SopRunListQuery');

export const SopViolationListQuerySchema = PaginationQuerySchema.extend({
  status: SopViolationStatusEnum.optional(),
  /** Calendar month as `YYYY-MM`; the ladder counts confirmed offences in it. */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  staffId: z.string().min(1).optional(),
}).openapi('SopViolationListQuery');
