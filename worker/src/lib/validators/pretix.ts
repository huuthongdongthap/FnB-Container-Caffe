/**
 * Pretix event ticketing validators
 */

import { z } from 'zod';

export const pretixWebhookBodySchema = z.object({
  notification_id: z.number().optional(),
  organizer: z.string().min(1),
  event: z.string().min(1),
  code: z.string().min(1),
  action: z.string().min(1)
});

export const pretixCheckinSchema = z.object({
  secret: z.string().min(1, 'secret là bắt buộc'),
  event: z.string().optional(),
  listId: z.number().optional()
});

export const pretixGenerateSchema = z.object({
  source: z.literal('event'),
  slug: z.string().min(1, 'slug là bắt buộc')
});