import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerPaymentReadHandlers } from './read-handlers';
import { registerPaymentMutationHandlers } from './mutation-handlers';
import { registerPaymentWebhookHandlers } from './webhook-handlers';

export const openApiPaymentsRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes except webhook
openApiPaymentsRouter.use('*', async (c, next) => {
  const path = c.req.path;
  if (path.endsWith('/webhook/payos')) {
    return next();
  }
  return requireAuth(['owner', 'manager', 'staff'])(c, next);
});

registerPaymentReadHandlers(openApiPaymentsRouter);
registerPaymentMutationHandlers(openApiPaymentsRouter);
registerPaymentWebhookHandlers(openApiPaymentsRouter);

export default openApiPaymentsRouter;
