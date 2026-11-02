/**
 * Pretix event ticketing validators
 */

import { z } from 'zod';

export const PRETIX_IDENTIFIER_RE = /^[A-Za-z0-9._-]{1,128}$/;

export const pretixWebhookBodySchema = z.object({
  notification_id: z.number().optional(),
  organizer: z.string().min(1).max(128).regex(PRETIX_IDENTIFIER_RE, 'organizer không hợp lệ'),
  event: z.string().min(1).max(128).regex(PRETIX_IDENTIFIER_RE, 'event không hợp lệ'),
  code: z.string().min(1).max(128).regex(PRETIX_IDENTIFIER_RE, 'code không hợp lệ'),
  action: z.string().min(1).max(128)
});

export const pretixCheckinSchema = z.object({
  secret: z.string().min(1, 'secret là bắt buộc').max(128).regex(PRETIX_IDENTIFIER_RE, 'secret không hợp lệ'),
  event: z.string().max(128).regex(PRETIX_IDENTIFIER_RE, 'event không hợp lệ').optional(),
  listId: z.number().optional()
});

export const pretixGenerateSchema = z.object({
  source: z.literal('event'),
  slug: z.string().min(1, 'slug là bắt buộc').max(128).regex(PRETIX_IDENTIFIER_RE, 'slug không hợp lệ')
});
