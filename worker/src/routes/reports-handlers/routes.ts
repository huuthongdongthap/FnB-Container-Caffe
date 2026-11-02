import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { optionalAuth } from '../../middleware/auth';
import { registerAnalyticsHandlers } from './analytics-handlers';
import { registerReconciliationHandlers } from './reconciliation-handlers';
import { registerExportHandlers } from './export-handlers';
import { registerGroupedSalesHandlers } from './grouped-sales-handlers';

export const reportsRouter = new Hono<{ Bindings: Env }>();

reportsRouter.use('*', async (c, next) => {
  if (!c.get('user' as never)) {
    return optionalAuth()(c, next);
  }
  await next();
});

registerAnalyticsHandlers(reportsRouter);
registerReconciliationHandlers(reportsRouter);
registerExportHandlers(reportsRouter);
registerGroupedSalesHandlers(reportsRouter);

export default reportsRouter;

