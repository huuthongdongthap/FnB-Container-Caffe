import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerCrudHandlers } from './crud-handlers';
import { registerValidationHandlers } from './validation-handlers';
import { registerUsageHandlers } from './usage-handlers';

export const openApiPromotionsRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiPromotionsRouter.use('*', requireAuth(['owner', 'manager', 'staff']));

// Register handlers
registerCrudHandlers(openApiPromotionsRouter);
registerValidationHandlers(openApiPromotionsRouter);
registerUsageHandlers(openApiPromotionsRouter);

export default openApiPromotionsRouter;
