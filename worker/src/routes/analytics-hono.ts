/**
 * Analytics Routes — /api/analytics barrel re-export
 * Split into worker/src/routes/analytics-handlers/
 * - helpers.ts: Zod validation schemas and KV cache helpers
 * - summary-handlers.ts: Summary metrics with optional compare & group
 * - metrics-handlers.ts: Top products, peak hours, customer metrics, zones, payout
 * - export-handlers.ts: CSV export of order data
 * - routes.ts: Router initialization and route composition
 * - index.ts: Barrel export
 */

import { analyticsRouter } from './analytics-handlers';

export { analyticsRouter } from './analytics-handlers';
export default analyticsRouter;
