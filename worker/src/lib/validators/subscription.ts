/**
 * Subscriptions & billing validators
 */

import { z } from 'zod';

// ══════════════════════════════════════════════
// SUBSCRIPTIONS — plans
// ══════════════════════════════════════════════

const planBaseSchema = z.object({
  name: z.string().min(1, 'Tên gói không được để trống'),
  slug: z.string().optional(),
  price: z.number().nonnegative().optional(),
  monthly_price_vnd: z.number().nonnegative().optional(),
  deposit_vnd: z.number().nonnegative().optional(),
  container_size: z.string().optional(),
  max_occupants: z.number().int().positive().optional(),
  is_popular: z.boolean().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  billing_cycle: z.string().optional(),
  features: z.union([z.string(), z.array(z.string()).transform((arr) => JSON.stringify(arr))]).optional(),
  description: z.string().optional()
});

export const createPlanSchema = planBaseSchema
  .refine((data) => data.price !== undefined || data.monthly_price_vnd !== undefined, {
    message: 'price hoặc monthly_price_vnd là bắt buộc',
    path: ['price']
  })
  .transform((data) => ({
    ...data,
    price: data.price ?? data.monthly_price_vnd ?? 0,
    monthly_price_vnd: data.monthly_price_vnd ?? data.price ?? 0
  }));

export const updatePlanSchema = planBaseSchema.partial();

// ══════════════════════════════════════════════
// SUBSCRIPTIONS — lifecycle
// ══════════════════════════════════════════════

export const createSubscriptionSchema = z.object({
  plan_id: z.string().min(1, 'plan_id là bắt buộc'),
  customer_name: z.string().optional(),
  customer_email: z.string().optional(),
  customer_phone: z.string().optional()
});

export const upgradeSubscriptionSchema = z.object({
  new_plan_id: z.string().min(1, 'new_plan_id là bắt buộc')
});

export const downgradeSubscriptionSchema = z.object({
  new_plan_id: z.string().min(1, 'new_plan_id là bắt buộc')
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().optional()
});

export const pauseSubscriptionSchema = z.object({
  until_date: z.string().optional()
});

export const resumeSubscriptionSchema = z.object({});

export const updateSubscriptionSchema = z.object({
  customer_name: z.string().max(100).optional(),
  customer_phone: z.string().max(20).optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  container_number: z.string().optional(),
  zone: z.string().optional(),
  deposit_vnd: z.number().nonnegative().optional(),
  deposit_paid: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional()
});

export const payInvoiceSchema = z.object({
  payment_method: z.string().max(50).optional(),
  payment_ref: z.string().max(200).optional()
});
