/**
 * PayOS webhook validators
 */

import { z } from 'zod';

export const payOSCreateLinkSchema = z.preprocess((val: unknown) => {
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return {
      order_id: obj.order_id ?? obj.orderId,
      description: obj.description,
      customer_name: obj.customer_name ?? obj.customerName,
      amount: obj.amount ?? obj.total,
      return_url: obj.return_url ?? obj.returnUrl,
      cancel_url: obj.cancel_url ?? obj.cancelUrl,
    };
  }
  return val;
}, z.object({
  order_id: z.string().min(1, 'Thiếu mã đơn hàng'),
  description: z.string().optional(),
  customer_name: z.string().optional(),
  amount: z.number().optional(),
  return_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
}));

export type PayOSCreateLinkInput = z.infer<typeof payOSCreateLinkSchema>;

export const payosWebhookSchema = z.object({
  success: z.boolean(),
  data: z.object({
    orderCode: z.number(),
    amount: z.number(),
    description: z.string()
  }).passthrough()
});
