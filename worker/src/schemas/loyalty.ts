import { z } from 'zod';
import { openapi } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  LocaleEnum,
  DateTimeSchema,
  MoneySchema,
  LoyaltyTierEnum,
  ReferenceSchema,
} from './common';

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
  metadata: z.record(z.unknown()).nullable(),
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

// OpenAPI route definitions
export const LoyaltyRoutes = {
  tiers: {
    list: {
      method: 'get',
      path: '/api/loyalty/tiers',
      summary: 'List all loyalty tier configurations',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Tier configs', content: { 'application/json': { schema: SuccessResponseSchema(z.array(LoyaltyTierConfigSchema)) } } },
      },
    },
    get: {
      method: 'get',
      path: '/api/loyalty/tiers/{tier}',
      summary: 'Get loyalty tier config by tier',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      request: { params: z.object({ tier: LoyaltyTierEnum }) },
      responses: {
        200: { description: 'Tier config', content: { 'application/json': { schema: SuccessResponseSchema(LoyaltyTierConfigSchema) } } },
        404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
    update: {
      method: 'patch',
      path: '/api/loyalty/tiers/{tier}',
      summary: 'Update loyalty tier config',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      request: { params: z.object({ tier: LoyaltyTierEnum }), body: { content: { 'application/json': { schema: LoyaltyTierConfigUpdateSchema } } } },
      responses: {
        200: { description: 'Updated', content: { 'application/json': { schema: SuccessResponseSchema(LoyaltyTierConfigSchema) } } },
        404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
  },
  account: {
    get: {
      method: 'get',
      path: '/api/loyalty/account',
      summary: 'Get current user\'s loyalty account',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Loyalty account', content: { 'application/json': { schema: SuccessResponseSchema(LoyaltyAccountSchema) } } },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
        404: { description: 'Account not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
    transactions: {
      method: 'get',
      path: '/api/loyalty/account/transactions',
      summary: 'Get loyalty transactions for current user',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      request: { query: PaginationQuerySchema.extend({ type: z.enum(['earn', 'redeem', 'expire', 'adjust', 'bonus', 'referral']).optional() }) },
      responses: {
        200: { description: 'Transactions', content: { 'application/json': { schema: SuccessResponseSchema(LoyaltyTransactionListResponseSchema) } } },
      },
    },
    claimBirthdayBonus: {
      method: 'post',
      path: '/api/loyalty/account/birthday-bonus',
      summary: 'Claim birthday bonus points',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      request: { body: { content: { 'application/json': { schema: z.object({ idempotencyKey: z.string().uuid() }) } } } },
      responses: {
        200: { description: 'Bonus claimed', content: { 'application/json': { schema: SuccessResponseSchema(z.object({ points: z.number().int().positive(), newBalance: z.number().int().nonnegative() })) } } },
        400: { description: 'Already claimed or not birthday month', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
  },
  rewards: {
    list: {
      method: 'get',
      path: '/api/loyalty/rewards',
      summary: 'List available rewards',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      request: { query: PaginationQuerySchema.extend({ isActive: z.coerce.boolean().optional(), type: z.enum(['discount', 'free_item', 'upgrade', 'experience', 'merchandise']).optional() }) },
      responses: {
        200: { description: 'Rewards list', content: { 'application/json': { schema: SuccessResponseSchema(LoyaltyRewardListResponseSchema) } } },
      },
    },
    get: {
      method: 'get',
      path: '/api/loyalty/rewards/{id}',
      summary: 'Get reward by ID',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      request: { params: IdParamsSchema },
      responses: {
        200: { description: 'Reward details', content: { 'application/json': { schema: SuccessResponseSchema(LoyaltyRewardSchema) } } },
        404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
    create: {
      method: 'post',
      path: '/api/loyalty/rewards',
      summary: 'Create new reward (admin)',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      request: { body: { content: { 'application/json': { schema: LoyaltyRewardCreateSchema } } } },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: SuccessResponseSchema(LoyaltyRewardSchema) } } },
        400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
    update: {
      method: 'patch',
      path: '/api/loyalty/rewards/{id}',
      summary: 'Update reward (admin)',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      request: { params: IdParamsSchema, body: { content: { 'application/json': { schema: LoyaltyRewardUpdateSchema } } } },
      responses: {
        200: { description: 'Updated', content: { 'application/json': { schema: SuccessResponseSchema(LoyaltyRewardSchema) } } },
        404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
    redeem: {
      method: 'post',
      path: '/api/loyalty/rewards/redeem',
      summary: 'Redeem reward',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      request: { body: { content: { 'application/json': { schema: RedeemRewardSchema } } } },
      responses: {
        200: { description: 'Redeemed', content: { 'application/json': { schema: SuccessResponseSchema(RedeemResponseSchema) } } },
        400: { description: 'Insufficient points or invalid reward', content: { 'application/json': { schema: ErrorResponseSchema } } },
        404: { description: 'Reward not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
        409: { description: 'Reward max redemptions reached', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
  },
  admin: {
    accounts: {
      method: 'get',
      path: '/api/loyalty/admin/accounts',
      summary: 'List all loyalty accounts (admin)',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      request: { query: PaginationQuerySchema.extend({ tier: LoyaltyTierEnum.optional(), search: z.string().optional() }) },
      responses: {
        200: { description: 'Accounts list', content: { 'application/json': { schema: SuccessResponseSchema(z.array(LoyaltyAccountSchema)) } } },
      },
    },
    summary: {
      method: 'get',
      path: '/api/loyalty/admin/summary',
      summary: 'Get loyalty program summary (admin)',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Summary', content: { 'application/json': { schema: SuccessResponseSchema(LoyaltySummarySchema) } } },
      },
    },
    adjustPoints: {
      method: 'post',
      path: '/api/loyalty/admin/adjust-points',
      summary: 'Adjust customer points (admin)',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      request: { body: { content: { 'application/json': { schema: z.object({ customerId: z.string().uuid(), points: z.number().int(), reason: z.string().max(200), idempotencyKey: z.string().uuid() }) } } } },
      responses: {
        200: { description: 'Adjusted', content: { 'application/json': { schema: SuccessResponseSchema(LoyaltyTransactionSchema) } } },
        400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
  },
};
