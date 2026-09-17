import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerSummaryHandlers } from './summary-handlers';
import { registerMetricsHandlers } from './metrics-handlers';
import { registerExportHandlers } from './export-handlers';

export const analyticsRouter = new Hono<{ Bindings: Env }>();

registerSummaryHandlers(analyticsRouter);
registerMetricsHandlers(analyticsRouter);
registerExportHandlers(analyticsRouter);

export default analyticsRouter;
