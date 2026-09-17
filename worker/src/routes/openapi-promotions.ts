/**
 * Promotions OpenAPI routes barrel re-export
 * Split into worker/src/routes/openapi-promotions-handlers/
 * - routes.ts: Hono route router and middleware
 * - crud-handlers.ts: CRUD for promotions (list, get, create, update, delete)
 * - validation-handlers.ts: Promotion code validation and discount calculation
 * - usage-handlers.ts: Promotion usage recording and summary
 * - index.ts: Barrel export
 */

import { openApiPromotionsRouter } from './openapi-promotions-handlers';

export { openApiPromotionsRouter } from './openapi-promotions-handlers';
export default openApiPromotionsRouter;