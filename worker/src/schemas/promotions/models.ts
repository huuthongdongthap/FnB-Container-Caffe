import { z } from '@hono/zod-openapi';
import {
  PaginationMetaSchema,
  LocaleEnum,
  DateTimeSchema,
  MoneySchema,
  ReferenceSchema,
  SlugSchema,
} from '../common';

export const PromotionTranslationSchema = z.object({
  locale: LocaleEnum,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  terms: z.string().max(2000).optional(),
});

export const PromotionRuleSchema = z.object({
  type: z.enum([
    'percentage',
    'fixed_amount',
    'buy_x_get_y',
    'free_shipping',
    'free_item',
    'tier_discount',
  ]),
  value: z.number().positive(),
  minOrderAmount: MoneySchema.optional(),
  maxDiscount: MoneySchema.optional(),
  buyQuantity: z.number().int().positive().optional(),
  getQuantity: z.number().int().positive().optional(),
  applicableProductIds: z.array(z.string().uuid()).optional(),
  applicableCategoryIds: z.array(z.string().uuid()).optional(),
  excludedProductIds: z.array(z.string().uuid()).optional(),
  excludedCategoryIds: z.array(z.string().uuid()).optional(),
  customerTier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
  maxUsesPerCustomer: z.number().int().positive().optional(),
});

export const PromotionScheduleSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  timezone: z.string().default('Asia/Ho_Chi_Minh'),
  recurrence: z
    .enum(['none', 'daily', 'weekly', 'monthly', 'yearly'])
    .default('none'),
  recurrenceDays: z.array(z.number().int().min(0).max(6)).optional(),
  recurrenceTime: z.string().time().optional(),
});

export const PromotionCreateSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['code', 'auto', 'loyalty', 'referral']),
  status: z.enum(['draft', 'scheduled', 'active', 'paused', 'expired']).default('draft'),
  rule: PromotionRuleSchema,
  schedule: PromotionScheduleSchema,
  usageLimit: z.number().int().positive().nullable().optional(),
  usageLimitPerCustomer: z.number().int().positive().default(1),
  code: z.string().min(3).max(50).regex(/^[A-Z0-9-_]+$/).optional(),
  stackable: z.boolean().default(false),
  priority: z.number().int().default(0),
  locationIds: z.array(z.string().uuid()).optional(),
  translations: z.array(PromotionTranslationSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('PromotionCreate');

export const PromotionUpdateSchema = z.object({
  slug: SlugSchema.optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  type: z.enum(['code', 'auto', 'loyalty', 'referral']).optional(),
  status: z.enum(['draft', 'scheduled', 'active', 'paused', 'expired']).optional(),
  rule: PromotionRuleSchema.optional(),
  schedule: PromotionScheduleSchema.optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  usageLimitPerCustomer: z.number().int().positive().optional(),
  code: z.string().min(3).max(50).regex(/^[A-Z0-9-_]+$/).optional(),
  stackable: z.boolean().optional(),
  priority: z.number().int().optional(),
  locationIds: z.array(z.string().uuid()).optional(),
  translations: z.array(PromotionTranslationSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('PromotionUpdate');

export const PromotionResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.enum(['code', 'auto', 'loyalty', 'referral']),
  status: z.enum(['draft', 'scheduled', 'active', 'paused', 'expired']),
  rule: PromotionRuleSchema,
  schedule: PromotionScheduleSchema,
  usageLimit: z.number().int().positive().nullable(),
  usageCount: z.number().int().nonnegative().default(0),
  usageLimitPerCustomer: z.number().int().positive().default(1),
  code: z.string().nullable(),
  stackable: z.boolean().default(false),
  priority: z.number().int().default(0),
  locationIds: z.array(z.string().uuid()),
  locations: z.array(ReferenceSchema).optional(),
  translations: z.array(PromotionTranslationSchema),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('Promotion');

export const PromotionListResponseSchema = z.object({
  promotions: z.array(PromotionResponseSchema),
  meta: PaginationMetaSchema,
}).openapi('PromotionListResponse');

export const PromotionUsageSchema = z.object({
  id: z.string().uuid(),
  promotionId: z.string().uuid(),
  customerId: z.string().uuid(),
  orderId: z.string().uuid(),
  discountAmount: MoneySchema,
  usedAt: DateTimeSchema,
}).openapi('PromotionUsage');

export const PromotionUsageListResponseSchema = z.object({
  usages: z.array(PromotionUsageSchema),
  meta: PaginationMetaSchema,
}).openapi('PromotionUsageListResponse');

export const ValidatePromotionSchema = z.object({
  code: z.string().min(3).max(50),
  orderAmount: MoneySchema,
  productIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  customerId: z.string().uuid().optional(),
  loyaltyTier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
  locationId: z.string().uuid().optional(),
}).openapi('ValidatePromotion');

export const ValidatePromotionResponseSchema = z.object({
  valid: z.boolean(),
  promotion: PromotionResponseSchema.nullable(),
  discountAmount: MoneySchema,
  appliedRule: PromotionRuleSchema.nullable(),
  message: z.string().nullable(),
}).openapi('ValidatePromotionResponse');

export const PromotionSummarySchema = z.object({
  totalPromotions: z.number().int().nonnegative(),
  activePromotions: z.number().int().nonnegative(),
  totalUsage: z.number().int().nonnegative(),
  totalDiscountGiven: MoneySchema,
  byType: z.record(
    z.enum(['code', 'auto', 'loyalty', 'referral']),
    z.object({
      count: z.number().int().nonnegative(),
      usage: z.number().int().nonnegative(),
      discount: MoneySchema,
    })
  ),
  byStatus: z.record(
    z.enum(['draft', 'scheduled', 'active', 'paused', 'expired']),
    z.number().int().nonnegative()
  ),
  topPromotions: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      usage: z.number().int().nonnegative(),
      discount: MoneySchema,
    })
  ),
}).openapi('PromotionSummary');

export const PromotionUseRequestSchema = z.object({
  promotionId: z.string().uuid(),
  orderId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  discountAmount: MoneySchema,
  locationId: z.string().uuid().optional(),
}).openapi('PromotionUseRequest');

// Export types
export type PromotionTranslation = z.infer<typeof PromotionTranslationSchema>;
export type PromotionRule = z.infer<typeof PromotionRuleSchema>;
export type PromotionSchedule = z.infer<typeof PromotionScheduleSchema>;
export type PromotionCreate = z.infer<typeof PromotionCreateSchema>;
export type PromotionUpdate = z.infer<typeof PromotionUpdateSchema>;
export type PromotionResponse = z.infer<typeof PromotionResponseSchema>;
export type PromotionListResponse = z.infer<typeof PromotionListResponseSchema>;
export type PromotionUsage = z.infer<typeof PromotionUsageSchema>;
export type PromotionUsageListResponse = z.infer<typeof PromotionUsageListResponseSchema>;
export type ValidatePromotion = z.infer<typeof ValidatePromotionSchema>;
export type ValidatePromotionResponse = z.infer<typeof ValidatePromotionResponseSchema>;
export type PromotionSummary = z.infer<typeof PromotionSummarySchema>;
export type PromotionUseRequest = z.infer<typeof PromotionUseRequestSchema>;