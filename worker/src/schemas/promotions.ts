/**
 * Promotion schemas — compatibility barrel
 * Re-exports from ./promotions/ submodules for zero-breaking-imports.
 */
export {
  PromotionTranslationSchema,
  PromotionRuleSchema,
  PromotionScheduleSchema,
  PromotionCreateSchema,
  PromotionUpdateSchema,
  PromotionResponseSchema,
  PromotionListResponseSchema,
  PromotionUsageSchema,
  PromotionUsageListResponseSchema,
  ValidatePromotionSchema,
  ValidatePromotionResponseSchema,
  PromotionSummarySchema,
  PromotionUseRequestSchema,
  type PromotionTranslation,
  type PromotionRule,
  type PromotionSchedule,
  type PromotionCreate,
  type PromotionUpdate,
  type PromotionResponse,
  type PromotionListResponse,
  type PromotionUsage,
  type PromotionUsageListResponse,
  type ValidatePromotion,
  type ValidatePromotionResponse,
  type PromotionSummary,
  type PromotionUseRequest,
} from './promotions/models';

export { PromotionRoutes } from './promotions/routes';
