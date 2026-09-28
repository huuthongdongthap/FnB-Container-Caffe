import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerPaymentReadHandlers } from './read-handlers';
import { registerPaymentMutationHandlers } from './mutation-handlers';
import { registerPaymentWebhookHandlers } from './webhook-handlers';
import { registerWebPaymentHandlers } from './web-payment-handlers';

export const openApiPaymentsRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes except webhook and guest payment-request
openApiPaymentsRouter.use('/api/payments/*', async (c, next) => {
  const path = c.req.path;
  if (path.endsWith('/webhook/payos') || path.endsWith('/payment-request')) {
    return next();
  }
  return requireAuth(['owner', 'manager', 'staff'])(c, next);
});

registerPaymentReadHandlers(openApiPaymentsRouter);
registerPaymentMutationHandlers(openApiPaymentsRouter);
registerPaymentWebhookHandlers(openApiPaymentsRouter);
registerWebPaymentHandlers(openApiPaymentsRouter);

export default openApiPaymentsRouter;
