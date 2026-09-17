/**
 * Promotions Routes — /api/promotions barrel re-export
 * Split into worker/src/routes/promotions-handlers/
 * - types.ts: PromotionCode, ValidateResult, RedeemInput, CreatePromotionInput
 * - admin-handlers.ts: List, get, create, update, delete promotion handlers
 * - validation-handlers.ts: Validate and redeem promotion handlers
 * - routes.ts: Router initialization and route composition
 * - index.ts: Barrel export
 */

import { promotionsRouter } from './promotions-handlers';

export { promotionsRouter } from './promotions-handlers';
export default promotionsRouter;
export type * from './promotions-handlers/types';
