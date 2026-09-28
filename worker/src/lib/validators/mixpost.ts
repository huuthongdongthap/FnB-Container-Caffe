/**
 * Mixpost social publishing validators
 */

import { z } from 'zod';

export const mixpostCreatePostSchema = z.object({
  content: z.string().min(1, 'content là bắt buộc'),
  accounts: z.array(z.number()).min(1, 'accounts là bắt buộc'),
  media_urls: z.array(z.string().url()).optional(),
  scheduled_at: z.string().optional()
});

export const mixpostGenerateSchema = z.object({
  source: z.enum(['promotion', 'menu']),
  id: z.string().optional(),
  category: z.number().optional()
});