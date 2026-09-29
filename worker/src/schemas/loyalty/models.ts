import { z } from '@hono/zod-openapi';
import {
  PaginationMetaSchema,
  DateTimeSchema,
  MoneySchema,
  LoyaltyTierEnum,
  ReferenceSchema,
} from '../common';

/**
 * Loyalty program schemas
 */

export const LoyaltyTierConfigSchema = z.object({
  tier: LoyaltyTierEnum,
  name: z.string().min(1).max(50),
  minPoints: z.number().int().nonnegative(),
  maxPoints: z.number().int().nonnegative().nullable(),
  pointMultiplier: z.number().positive().default(1),
  discountPercent: z.number().int().min(0).max(100).default(0),
  birthdayBonus: z.number().int().nonnegative().default(0),
  freeShipping: z.boolean().default(false),
  prioritySupport: z.boolean().default(false),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
  benefits: z.array(z.string()).optional(),
}).openapi('LoyaltyTierConfig');

export const LoyaltyTierConfigUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  minPoints: z.number().int().nonnegative().optional(),
  maxPoints: z.number().int().nonnegative().nullable().optional(),
  pointMultiplier: z.number().positive().optional(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  birthdayBonus: z.number().int().nonnegative().optional(),
  freeShipping: z.boolean().optional(),
  prioritySupport: z.boolean().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
  benefits: z.array(z.string()).optional(),
}).openapi('LoyaltyTierConfigUpdate');

export const LoyaltyAccountSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customer: ReferenceSchema.nullable().optional(),
  currentPoints: z.number().int().nonnegative(),
  lifetimePoints: z.number().int().nonnegative(),
  tier: LoyaltyTierEnum,
  tierProgress: z.number().min(0).max(100).default(0),
  pointsToNextTier: z.number().int().nonnegative().nullable(),
  totalSpent: MoneySchema,
  orderCount: z.number().int().nonnegative(),
  lastOrderAt: DateTimeSchema.nullable(),
  birthdayBonusClaimed: z.boolean().default(false),
  referralCode: z.string().min(6).max(20),
  referredBy: z.string().uuid().nullable(),
  referralCount: z.number().int().nonnegative().default(0),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('LoyaltyAccount');

export const LoyaltyTransactionSchema = z.object({
  id: z.string().uuid(),
  loyaltyAccountId: z.string().uuid(),
  type: z.enum(['earn', 'redeem', 'expire', 'adjust', 'bonus', 'referral']),
  points: z.number().int(),
  balanceAfter: z.number().int().nonnegative(),
  orderId: z.string().uuid().nullable(),
  description: z.string().max(200),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: DateTimeSchema,
}).openapi('LoyaltyTransaction');

export const LoyaltyTransactionListResponseSchema = z.object({
  transactions: z.array(LoyaltyTransactionSchema),
  meta: PaginationMetaSchema,
}).openapi('LoyaltyTransactionListResponse');

export const LoyaltyRewardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  pointsCost: z.number().int().positive(),
  type: z.enum(['discount', 'free_item', 'upgrade', 'experience', 'merchandise']),
  value: z.number().positive(),
  maxRedemptions: z.number().int().positive().nullable(),
  currentRedemptions: z.number().int().nonnegative().default(0),
  validFrom: z.string().date().nullable(),
  validTo: z.string().date().nullable(),
  isActive: z.boolean().default(true),
  imageUrl: z.string().url().nullable(),
  terms: z.string().max(1000).optional(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('LoyaltyReward');

export const LoyaltyRewardCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  pointsCost: z.number().int().positive(),
  type: z.enum(['discount', 'free_item', 'upgrade', 'experience', 'merchandise']),
  value: z.number().positive(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  validFrom: z.string().date().optional(),
  validTo: z.string().date().optional(),
  isActive: z.boolean().default(true),
  imageUrl: z.string().url().optional(),
  terms: z.string().max(1000).optional(),
}).openapi('LoyaltyRewardCreate');

export const LoyaltyRewardUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  pointsCost: z.number().int().positive().optional(),
  type: z.enum(['discount', 'free_item', 'upgrade', 'experience', 'merchandise']).optional(),
  value: z.number().positive().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  validFrom: z.string().date().nullable().optional(),
  validTo: z.string().date().nullable().optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional(),
  terms: z.string().max(1000).optional(),
}).openapi('LoyaltyRewardUpdate');

export const LoyaltyRewardListResponseSchema = z.object({
  rewards: z.array(LoyaltyRewardSchema),
  meta: PaginationMetaSchema,
}).openapi('LoyaltyRewardListResponse');

export const RedeemRewardSchema = z.object({
  rewardId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  idempotencyKey: z.string().uuid(),
}).openapi('RedeemReward');

export const RedeemResponseSchema = z.object({
  transactionId: z.string().uuid(),
  reward: LoyaltyRewardSchema,
  newBalance: z.number().int().nonnegative(),
  expiresAt: DateTimeSchema.nullable(),
}).openapi('RedeemResponse');

export const LoyaltySummarySchema = z.object({
  totalMembers: z.number().int().nonnegative(),
  activeMembers: z.number().int().nonnegative(),
  totalPointsIssued: z.number().int().nonnegative(),
  totalPointsRedeemed: z.number().int().nonnegative(),
  totalPointsExpired: z.number().int().nonnegative(),
  byTier: z.record(LoyaltyTierEnum, z.object({
    count: z.number().int().nonnegative(),
    avgPoints: z.number().nonnegative(),
  })),
  redemptionRate: z.number().min(0).max(100),
  avgPointsPerMember: z.number().nonnegative(),
}).openapi('LoyaltySummary');

// Export types
export type LoyaltyTierConfig = z.infer<typeof LoyaltyTierConfigSchema>;
export type LoyaltyTierConfigUpdate = z.infer<typeof LoyaltyTierConfigUpdateSchema>;
export type LoyaltyAccount = z.infer<typeof LoyaltyAccountSchema>;
export type LoyaltyTransaction = z.infer<typeof LoyaltyTransactionSchema>;
export type LoyaltyTransactionListResponse = z.infer<typeof LoyaltyTransactionListResponseSchema>;
export type LoyaltyReward = z.infer<typeof LoyaltyRewardSchema>;
export type LoyaltyRewardCreate = z.infer<typeof LoyaltyRewardCreateSchema>;
export type LoyaltyRewardUpdate = z.infer<typeof LoyaltyRewardUpdateSchema>;
export type LoyaltyRewardListResponse = z.infer<typeof LoyaltyRewardListResponseSchema>;
export type RedeemReward = z.infer<typeof RedeemRewardSchema>;
export type RedeemResponse = z.infer<typeof RedeemResponseSchema>;
export type LoyaltySummary = z.infer<typeof LoyaltySummarySchema>;
