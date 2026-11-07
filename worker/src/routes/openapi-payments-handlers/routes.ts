import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerPaymentReadHandlers } from './read-handlers';
import { registerPaymentMutationHandlers } from './mutation-handlers';
import { registerPaymentWebhookHandlers } from './webhook-handlers';

export const openApiPaymentsRouter = new OpenAPIHono<{ Bindings: Env }>();

const authMiddleware = async (c: any, next: any) => {
  const path = c.req.path;
  if (path.endsWith('/webhook/payos')) {
    return next();
  }
  if (path.endsWith('/refund')) {
    return requireAuth(['owner', 'manager', 'cashier', 'admin'])(c, next);
  }
  if (c.req.method === 'GET' && (path === '/api/payments' || path === '/api/payments/' || path === '/')) {
    return requireAuth(['owner', 'manager', 'supervisor', 'admin', 'cashier'])(c, next);
  }
  return requireAuth()(c, next);
};

// Apply auth middleware to all routes except verified provider webhooks
openApiPaymentsRouter.use('/api/payments', authMiddleware);
openApiPaymentsRouter.use('/api/payments/*', authMiddleware);

registerPaymentReadHandlers(openApiPaymentsRouter);
registerPaymentMutationHandlers(openApiPaymentsRouter);
registerPaymentWebhookHandlers(openApiPaymentsRouter);

export default openApiPaymentsRouter;
