/**
 * Categories OpenAPI routes barrel re-export
 * Split into worker/src/routes/openapi-categories-handlers/
 * - helpers.ts: CategoryRow types and format helpers
 * - read-handlers.ts: List, tree, and get category handlers
 * - mutation-handlers.ts: Create, update, delete, and reorder category handlers
 * - routes.ts: Router initialization and auth middleware
 * - index.ts: Barrel export
 */

import { openApiCategoriesRouter } from './openapi-categories-handlers';

export { openApiCategoriesRouter } from './openapi-categories-handlers';
export default openApiCategoriesRouter;
