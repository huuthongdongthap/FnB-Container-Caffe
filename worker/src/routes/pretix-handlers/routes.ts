import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { registerWebhookHandler } from './webhook-handler';
import { registerEventHandlers } from './event-handlers';
import { registerCheckinHandler } from './checkin-handler';
import { registerGenerateHandler } from './generate-handler';

export const pretixRouter = new Hono();

const pretixStaffAuth = requireAuth(['owner', 'admin', 'manager', 'staff']);
const guardPretixOps: MiddlewareHandler = async (c, next) => {
  const env = (c.env ?? {}) as { ENVIRONMENT?: string; NODE_ENV?: string };
  const isProd = env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production';
  const hasAuthHeader = Boolean(c.req.header('Authorization') || c.req.header('authorization'));
  if (isProd || hasAuthHeader) {
    return pretixStaffAuth(c as any, next);
  }
  await next();
};

pretixRouter.use('/orders', guardPretixOps);
pretixRouter.use('/checkin', guardPretixOps);
pretixRouter.use('/generate', guardPretixOps);

registerWebhookHandler(pretixRouter);
registerEventHandlers(pretixRouter);
registerCheckinHandler(pretixRouter);
registerGenerateHandler(pretixRouter);
