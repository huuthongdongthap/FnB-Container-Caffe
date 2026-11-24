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
    const host = parsed.hostname
      .replace(/^\[|\]$/g, '')
      .replace(/\.+$/, '')
      .toLowerCase();
    if (
      !host ||
      host.includes(':') ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    if (
      /^0\./.test(host) ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host)
    ) {
      return false;
    }
    const octets = host.split('.');
    if (octets.length === 4 && octets.every((o) => /^\d+$/.test(o))) {
      const a = Number(octets[0]);
      const b = Number(octets[1]);
      const c = Number(octets[2]);
      const d = Number(octets[3]);
      if ([a, b, c, d].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
        return false;
      }
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      ) {
        return false;
      }
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
