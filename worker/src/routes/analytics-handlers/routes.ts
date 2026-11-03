import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { registerSummaryHandlers } from './summary-handlers';
import { registerMetricsHandlers } from './metrics-handlers';
import { registerExportHandlers } from './export-handlers';

export const analyticsRouter = new Hono<{ Bindings: Env }>();

// Auth enforced by features-router; this gate ensures direct-mount safety.
analyticsRouter.use('*', requireAuth(['owner', 'manager', 'supervisor', 'admin']));

registerSummaryHandlers(analyticsRouter);
registerMetricsHandlers(analyticsRouter);
registerExportHandlers(analyticsRouter);

export default analyticsRouter;
