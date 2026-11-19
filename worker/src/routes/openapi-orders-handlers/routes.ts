import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerOrderReadHandlers } from './order-read-handlers';
import { registerOrderWriteHandlers } from './order-write-handlers';

export const openApiOrdersRouter = new OpenAPIHono<{ Bindings: Env }>();

const ORDER_DETAIL_ROLES = ['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier', 'kitchen', 'barista', 'chef', 'shipper', 'customer'];

// Scoped auth middleware for OpenAPI schema documentation / endpoints
openApiOrdersRouter.use('/api/orders/summary', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier']));
openApiOrdersRouter.use('/api/orders', async (c, next) => {
  // Allow unauthenticated order creation (POS guest / QR table diners)
  if (c.req.method === 'POST') {
    return next();
  }
  return requireAuth(ORDER_DETAIL_ROLES)(c, next);
});
openApiOrdersRouter.use('/api/orders/:id', async (c, next) => {
  if (c.req.method === 'GET') {
    const hasOrderToken = Boolean(
      (c.req.header('X-Order-Token') || c.req.header('x-order-token') || c.req.query('order_token') || '').trim()
    );
    if (hasOrderToken) {
      return optionalAuth()(c, next);
    }
  }
  return requireAuth(ORDER_DETAIL_ROLES)(c, next);
});
openApiOrdersRouter.use('/api/orders/:id/*', requireAuth(ORDER_DETAIL_ROLES));

registerOrderReadHandlers(openApiOrdersRouter);
registerOrderWriteHandlers(openApiOrdersRouter);

export default openApiOrdersRouter;
