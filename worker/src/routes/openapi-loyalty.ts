/**
 * Loyalty OpenAPI routes barrel re-export
 * Split into worker/src/routes/openapi-loyalty-handlers/
 * - routes.ts: Hono route router and middleware
 * - tier-handlers.ts: CRUD for loyalty tiers
 * - account-handlers.ts: Current user loyalty account, transactions, birthday bonus
 * - reward-handlers.ts: Rewards CRUD and redemption
 * - admin-handlers.ts: Admin points adjustment, account list, summary
 * - index.ts: Barrel export
 */

import { openApiLoyaltyRouter } from './openapi-loyalty-handlers';

export { openApiLoyaltyRouter } from './openapi-loyalty-handlers';
export default openApiLoyaltyRouter;
