/**
 * Push notification validators
 */

import { z } from 'zod';

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url('endpoint không hợp lệ'),
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
  actions: z.array(z.object({ action: z.string(), title: z.string() })).optional()
});