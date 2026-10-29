/**
 * Recurring-duty reminder schemas.
 *
 * A reminder is a notice about an obligation, not a record of work — so the
 * response deliberately carries no checklist items and no status a staff member
 * could tick. `runId` is non-null only for the overdue kind, because that is the
 * only one raised about a run that exists.
 */

import { z } from '@hono/zod-openapi';
import { DateTimeSchema } from './common';

export const SopReminderKindEnum = z
  .enum(['upcoming', 'due_no_run', 'overdue'])
  .openapi('SopReminderKind', { description: 'Why this notice was raised' });

export const SopReminderSchema = z
  .object({
    id: z.string().min(1),
    templateId: z.string().min(1),
    kind: SopReminderKindEnum,
    /** The store's calendar day the notice is about, YYYY-MM-DD. */
    dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Null unless kind is `overdue`. */
    runId: z.string().nullable(),
    staffId: z.string().nullable(),
    staffName: z.string().nullable(),
    sentAt: DateTimeSchema,
    acknowledgedAt: DateTimeSchema.nullable(),
  })
  .openapi('SopReminder');

/**
 * All filters optional except as noted.
 *
 * `unread` arrives as a query string, so a plain `z.boolean()` rejects
 * `?unread=true` outright, and `z.coerce.boolean()` would turn `?unread=false`
 * into `true` because every non-empty string coerces to true — silently showing
 * only the open notices when the caller asked for the whole ledger. An enum over
 * the two spellings a client can send keeps both directions honest.
 */
export const SopReminderListQuerySchema = z
  .object({
    kind: SopReminderKindEnum.optional(),
    dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    templateId: z.string().min(1).optional(),
    unread: z.enum(['true', 'false']).optional().openapi({ param: { name: 'unread', in: 'query' } }),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .openapi('SopReminderListQuery');

export const SopReminderListResponseSchema = z
  .object({
    reminders: z.array(SopReminderSchema),
    counts: z.object({
      total: z.number(),
      byKind: z.object({
        upcoming: z.number(),
        due_no_run: z.number(),
        overdue: z.number(),
      }),
    }),
  })
  .openapi('SopReminderListResponse');

export const SopReminderIdParamsSchema = z
  .object({ id: z.string().min(1) })
  .openapi('SopReminderIdParams');

export const SopReminderAcknowledgeResponseSchema = z
  .object({ acknowledged: z.boolean() })
  .openapi('SopReminderAcknowledgeResponse');
