import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerCrudHandlers } from './crud-handlers';
import { registerValidationHandlers } from './validation-handlers';
import { registerUsageHandlers } from './usage-handlers';

export const openApiPromotionsRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiPromotionsRouter.use('/api/promotions', requireAuth(['owner', 'manager', 'staff', 'admin', 'waiter', 'cashier']));
openApiPromotionsRouter.use('/api/promotions/*', async (c: any, next: any) => {
  const path = c.req.path;
  if (path.endsWith('/validate') || path.endsWith('/use')) {
    return requireAuth(['owner', 'manager', 'staff', 'admin', 'waiter', 'cashier', 'customer'])(c, next);
  }
  return requireAuth(['owner', 'manager', 'staff', 'admin', 'waiter', 'cashier'])(c, next);
});

// Register handlers
registerCrudHandlers(openApiPromotionsRouter);
registerValidationHandlers(openApiPromotionsRouter);
registerUsageHandlers(openApiPromotionsRouter);

export default openApiPromotionsRouter;
