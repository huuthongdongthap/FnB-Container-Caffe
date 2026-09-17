/**
 * OpenAPI Payments routes barrel re-export
 * Split into worker/src/routes/openapi-payments-handlers/
 * - read-handlers.ts: List and get payment handlers
 * - mutation-handlers.ts: Create and refund payment handlers
 * - webhook-handlers.ts: PayOS webhook handler
 * - routes.ts: Router initialization and auth middleware
 * - index.ts: Barrel export
 */

import { openApiPaymentsRouter } from './openapi-payments-handlers';

export { openApiPaymentsRouter } from './openapi-payments-handlers';
export default openApiPaymentsRouter;
