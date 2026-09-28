/**
 * Subscriptions & billing validators
 */

import { z } from 'zod';

// ══════════════════════════════════════════════
// SUBSCRIPTIONS — plans
// ══════════════════════════════════════════════

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Tên gói không được để trống'),
  price: z.number().nonnegative(),
  billing_cycle: z.string().optional(),
  features: z.string().optional(),
  description: z.string().optional()
});

export const updatePlanSchema = createPlanSchema.partial();

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
