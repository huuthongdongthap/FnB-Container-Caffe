/**
 * Loyalty program schemas — compatibility barrel
 * Re-exports from ./loyalty/ submodules for zero-breaking-imports.
 */
export {
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
  type LoyaltyTierConfig,
  type LoyaltyTierConfigUpdate,
  type LoyaltyAccount,
  type LoyaltyTransaction,
  type LoyaltyTransactionListResponse,
  type LoyaltyReward,
  type LoyaltyRewardCreate,
  type LoyaltyRewardUpdate,
  type LoyaltyRewardListResponse,
  type RedeemReward,
  type RedeemResponse,
  type LoyaltySummary,
} from './loyalty/models';

export { LoyaltyRoutes } from './loyalty/routes';
