import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerOrderReadHandlers } from './order-read-handlers';
import { registerOrderWriteHandlers } from './order-write-handlers';

export const openApiOrdersRouter = new OpenAPIHono<{ Bindings: Env }>();

// Scoped auth middleware for OpenAPI schema documentation / endpoints
openApiOrdersRouter.use('/api/orders/summary', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier']));
openApiOrdersRouter.use('/api/orders', async (c, next) => {
  // Allow unauthenticated order creation (POS guest / QR table diners)
  if (c.req.method === 'POST') {
    return next();
  }
  return requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier', 'kitchen', 'barista', 'chef', 'shipper', 'customer'])(c, next);
});
openApiOrdersRouter.use('/api/orders/:id', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier', 'kitchen', 'barista', 'chef', 'shipper', 'customer']));
openApiOrdersRouter.use('/api/orders/:id/*', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier', 'kitchen', 'barista', 'chef', 'shipper', 'customer']));

registerOrderReadHandlers(openApiOrdersRouter);
registerOrderWriteHandlers(openApiOrdersRouter);

export default openApiOrdersRouter;
