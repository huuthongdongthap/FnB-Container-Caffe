/**
 * Tables OpenAPI routes barrel re-export
 * Split into worker/src/routes/openapi-tables-handlers/
 * - routes.ts: Hono route router and middleware
 * - table-crud-handlers.ts: CRUD operations for tables
 * - zone-crud-handlers.ts: CRUD operations for table zones
 * - helpers.ts: Format helpers for table/zone responses
 * - index.ts: Barrel export
 */

import { openApiTablesRouter } from './openapi-tables-handlers';

export { openApiTablesRouter } from './openapi-tables-handlers';
export default openApiTablesRouter;
