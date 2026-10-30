/**
 * Push notification validators
 */

import { z } from 'zod';

const ALLOWED_WEBPUSH_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
  'push.example.com',
];

function isSafeWebPushEndpoint(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return ALLOWED_WEBPUSH_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

export const pushSubscribeSchema = z.object({
  endpoint: z
    .string()
    .url('endpoint không hợp lệ')
    .refine(isSafeWebPushEndpoint, 'endpoint phải là HTTPS WebPush hợp lệ'),
  auth_key: z.string().min(1, 'auth_key là bắt buộc'),
  p256dh_key: z.string().min(1, 'p256dh_key là bắt buộc'),
  customer_id: z.string().optional(),
  user_agent: z.string().optional(),
  role: z.string().optional()
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().min(1, 'endpoint là bắt buộc')
});

export const pushSendStaffSchema = z.object({
  title: z.string().min(1, 'title là bắt buộc'),
  body: z.string().min(1, 'body là bắt buộc'),
  role: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  actions: z.array(z.object({ action: z.string(), title: z.string() })).max(10).optional()
});
