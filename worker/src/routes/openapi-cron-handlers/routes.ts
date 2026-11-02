import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerJobCrudHandlers } from './job-crud-handlers';
import { registerRunHandlers } from './run-handlers';
import { registerSummaryHandlers } from './summary-handlers';

export const openApiCronRouter = new OpenAPIHono<{ Bindings: Env }>();

const readCronAuth = requireAuth(['owner', 'manager', 'supervisor', 'admin']);
const mutateCronAuth = requireAuth(['owner', 'manager', 'admin']);

// Apply auth middleware to all routes (supervisor read-only; owner/manager/admin for mutations)
openApiCronRouter.use('/api/cron', async (c, next) => {
  if (c.req.method === 'GET') {
    return readCronAuth(c, next);
  }
  return mutateCronAuth(c, next);
});
openApiCronRouter.use('/api/cron/*', async (c, next) => {
  if (c.req.method === 'GET') {
    return readCronAuth(c, next);
  }
  return mutateCronAuth(c, next);
});

// Register sub-handlers
registerJobCrudHandlers(openApiCronRouter);
registerRunHandlers(openApiCronRouter);
registerSummaryHandlers(openApiCronRouter);

export default openApiCronRouter;
