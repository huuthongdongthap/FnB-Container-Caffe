/**
 * Marketing, Zalo, and broadcast campaign validators
 */

import { z } from 'zod';

// ══════════════════════════════════════════════
// ZALO ZNS
// ══════════════════════════════════════════════

export const zaloSendSchema = z.object({
  phone: z.string().optional(),
  customer_id: z.string().optional(),
  template_key: z.string().min(1, 'template_key là bắt buộc'),
  data: z.record(z.string(), z.unknown())
});

// ══════════════════════════════════════════════
// BROADCAST
// ══════════════════════════════════════════════

export const broadcastSendSchema = z.object({
  segment: z
    .enum(['all', 'loyalty_bronze', 'loyalty_silver', 'loyalty_gold', 'loyalty_platinum', 'active_30d', 'inactive_90d', 'birthday_this_month'])
    .optional()
    .default('all'),
  channel: z.enum(['zns', 'sms', 'email', 'all']),
  title: z.string().max(200).optional(),
  message: z.string().min(1, 'message là bắt buộc').max(5000)
});

// ══════════════════════════════════════════════
// CAMPAIGNS
// ══════════════════════════════════════════════

export const campaignConfigSchema = z.object({
  is_active: z.coerce.number().int().min(0).max(1).optional(),
  channels: z.union([z.string(), z.array(z.string())]).optional(),
  timing: z.string().max(200).optional().or(z.literal(''))
});

export type CampaignConfigBody = z.infer<typeof campaignConfigSchema>;
export type BroadcastSendBody = z.infer<typeof broadcastSendSchema>;
