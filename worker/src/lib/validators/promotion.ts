/**
 * Promotion validators (voucher code apply / redeem)
 */

import { z } from 'zod';

export const validatePromotionSchema = z.object({
  code: z.string().min(1, 'code là bắt buộc'),
  order_total: z.number().optional()
});

export const redeemPromotionSchema = z.object({
  code: z.string().min(1, 'code là bắt buộc'),
  order_id: z.string().min(1, 'order_id là bắt buộc'),
  order_total: z.number()
});