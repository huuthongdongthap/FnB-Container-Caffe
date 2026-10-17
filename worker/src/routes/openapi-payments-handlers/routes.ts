import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerPaymentReadHandlers } from './read-handlers';
import { registerPaymentMutationHandlers } from './mutation-handlers';
import { registerPaymentWebhookHandlers } from './webhook-handlers';
import { registerWebPaymentHandlers } from './web-payment-handlers';

export const openApiPaymentsRouter = new OpenAPIHono<{ Bindings: Env }>();

const authMiddleware = async (c: any, next: any) => {
  const path = c.req.path;
  if (path.endsWith('/webhook/payos')) {
    return next();
  }
  // Listing all payments or processing refunds is restricted to staff & management
  if (path.endsWith('/refund') || (c.req.method === 'GET' && (path === '/api/payments' || path === '/api/payments/'))) {
    return requireAuth(['owner', 'manager', 'staff'])(c, next);
  }
  return requireAuth(['owner', 'manager', 'staff', 'customer'])(c, next);
};

// Apply auth middleware to all routes except verified provider webhooks
openApiPaymentsRouter.use('/api/payments', authMiddleware);
openApiPaymentsRouter.use('/api/payments/*', authMiddleware);

registerPaymentReadHandlers(openApiPaymentsRouter);
registerPaymentMutationHandlers(openApiPaymentsRouter);
registerPaymentWebhookHandlers(openApiPaymentsRouter);
registerWebPaymentHandlers(openApiPaymentsRouter);

export default openApiPaymentsRouter;
