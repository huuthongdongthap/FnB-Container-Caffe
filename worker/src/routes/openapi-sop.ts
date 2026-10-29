/**
 * SOP OpenAPI routes barrel re-export
 * Split into worker/src/routes/openapi-sop-handlers/
 * - routes.ts: Hono route router and middleware
 * - sop-admin-read-handlers.ts: oversight dashboard, run history, violation register
 * - sop-admin-write-handlers.ts: template authoring and the violation ladder
 * - index.ts: Barrel export
 */

import { openApiSopRouter } from './openapi-sop-handlers';

export { openApiSopRouter } from './openapi-sop-handlers';
export default openApiSopRouter;
