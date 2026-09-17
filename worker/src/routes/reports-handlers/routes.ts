import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerAnalyticsHandlers } from './analytics-handlers';
import { registerReconciliationHandlers } from './reconciliation-handlers';
import { registerExportHandlers } from './export-handlers';

export const reportsRouter = new Hono<{ Bindings: Env }>();

registerAnalyticsHandlers(reportsRouter);
registerReconciliationHandlers(reportsRouter);
registerExportHandlers(reportsRouter);

export default reportsRouter;
