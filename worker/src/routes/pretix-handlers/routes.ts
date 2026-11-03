import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { registerWebhookHandler } from './webhook-handler';
import { registerEventHandlers } from './event-handlers';
import { registerCheckinHandler } from './checkin-handler';
import { registerGenerateHandler } from './generate-handler';

export const pretixRouter = new Hono();

const pretixStaffAuth = requireAuth(['owner', 'admin', 'manager', 'supervisor', 'staff']);
const guardPretixOps: MiddlewareHandler = async (c, next) => {
  const env = (c.env ?? {}) as {
    ENVIRONMENT?: string;
    NODE_ENV?: string;
    JWT_SECRET?: string;
    STAFF_JWT_SECRET?: string;
  };
  const isProd = env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production';
  const hasAuthHeader = Boolean(c.req.header('Authorization') || c.req.header('authorization'));
  const hasJwtSecret = Boolean(env.JWT_SECRET || env.STAFF_JWT_SECRET);
  if (isProd || hasAuthHeader || hasJwtSecret) {
    if (!env.JWT_SECRET && env.STAFF_JWT_SECRET && c.env) {
      (c.env as Record<string, unknown>).JWT_SECRET = env.STAFF_JWT_SECRET;
    }
    return pretixStaffAuth(c as any, next);
  }
  await next();
};

pretixRouter.use('/events', optionalAuth());
pretixRouter.use('/orders', guardPretixOps);
pretixRouter.use('/checkin', guardPretixOps);
pretixRouter.use('/generate', guardPretixOps);

registerWebhookHandler(pretixRouter);
registerEventHandlers(pretixRouter);
registerCheckinHandler(pretixRouter);
registerGenerateHandler(pretixRouter);
