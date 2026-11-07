/**
 * Mixpost social publishing validators
 */

import { z } from 'zod';

export function isSafePublicMediaUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const isSafeMixpostMediaUrl = isSafePublicMediaUrl;

const safeMediaUrlArray = z
  .array(z.string().url().refine(isSafePublicMediaUrl, 'Media URL must use a public host'))
  .max(10)
  .optional();

export const mixpostCreatePostSchema = z.object({
  content: z.string().min(1, 'content là bắt buộc').max(5000),
  accounts: z.array(z.number().int().positive()).min(1, 'accounts là bắt buộc').max(20),
  media_urls: safeMediaUrlArray,
  mediaUrls: safeMediaUrlArray,
  scheduled_at: z.string().optional(),
  scheduledAt: z.string().optional()
});

export const mixpostGenerateSchema = z.object({
  source: z.enum(['promotion', 'menu']),
  id: z.string().optional(),
  category: z.number().optional()
});
