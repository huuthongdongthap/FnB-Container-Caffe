/**
 * Reports Routes — /api/reports barrel re-export
 * Split into worker/src/routes/reports-handlers/
 * - routes.ts: Hono route router and sub-handler registration
 * - types.ts: Report interfaces
 * - analytics-handlers.ts: Daily, summary, orders, top-products, peak-hours, customer metrics
 * - reconciliation-handlers.ts: Shift and daily reconciliation
 * - export-handlers.ts: CSV exports
 * - index.ts: Barrel export
 */

import { reportsRouter } from './reports-handlers';

export { reportsRouter } from './reports-handlers';
export * from './reports-handlers/types';
export default reportsRouter;
