import { z } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  LoyaltyTierEnum,
} from '../common';
import {
  LoyaltyTierConfigSchema,
  LoyaltyTierConfigUpdateSchema,
  LoyaltyAccountSchema,
  LoyaltyTransactionSchema,
  LoyaltyTransactionListResponseSchema,
  LoyaltyRewardSchema,
  LoyaltyRewardCreateSchema,
  LoyaltyRewardUpdateSchema,
  LoyaltyRewardListResponseSchema,
  RedeemRewardSchema,
  RedeemResponseSchema,
  LoyaltySummarySchema,
} from './models';

export const LoyaltyRoutes = {
  tiers: {
    list: {
      method: 'get' as const,
      path: '/api/loyalty/tiers',
      summary: 'List all loyalty tier configurations',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Tier configs', content: { 'application/json': { schema: SuccessResponseSchema(z.array(LoyaltyTierConfigSchema)) } } },
      },
    },
    get: {
      method: 'get' as const,
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
      method: 'patch' as const,
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
      method: 'get' as const,
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
      method: 'get' as const,
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
      method: 'post' as const,
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
      method: 'get' as const,
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
      method: 'get' as const,
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
      method: 'post' as const,
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
      method: 'patch' as const,
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
      method: 'post' as const,
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
      method: 'get' as const,
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
      method: 'get' as const,
      path: '/api/loyalty/admin/summary',
      summary: 'Get loyalty program summary (admin)',
      tags: ['Loyalty'],
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Summary', content: { 'application/json': { schema: SuccessResponseSchema(LoyaltySummarySchema) } } },
      },
    },
    adjustPoints: {
      method: 'post' as const,
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
