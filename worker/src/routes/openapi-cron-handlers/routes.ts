import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerJobCrudHandlers } from './job-crud-handlers';
import { registerRunHandlers } from './run-handlers';
import { registerSummaryHandlers } from './summary-handlers';

export const openApiCronRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes (owner/manager only for cron management)
openApiCronRouter.use('*', requireAuth(['owner', 'manager']));

// Register sub-handlers
registerJobCrudHandlers(openApiCronRouter);
registerRunHandlers(openApiCronRouter);
registerSummaryHandlers(openApiCronRouter);

export default openApiCronRouter;
