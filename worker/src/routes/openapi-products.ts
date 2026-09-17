/**
 * Products OpenAPI routes barrel re-export
 * Split into worker/src/routes/openapi-products-handlers/
 * - helpers.ts: ProductRow types and format helpers
 * - read-handlers.ts: List, get by id, and get by slug product handlers
 * - mutation-handlers.ts: Create, update, and delete product handlers
 * - routes.ts: Router initialization and auth middleware
 * - index.ts: Barrel export
 */

import { openApiProductsRouter } from './openapi-products-handlers';

export { openApiProductsRouter } from './openapi-products-handlers';
export default openApiProductsRouter;
