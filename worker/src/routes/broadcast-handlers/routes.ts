import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { optionalAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerSendHandler } from './send-handler';

export const broadcastRouter = new Hono<{ Bindings: Env }>();

const resolveBroadcastAuth: MiddlewareHandler = async (c, next) => {
  const hasAuthHeader = Boolean(c.req.header('Authorization') || c.req.header('authorization'));
  const existingUser = (c as unknown as { get?: (k: string) => unknown }).get?.('user');
  if (hasAuthHeader && !existingUser) {
    const env = (c.env ?? {}) as { JWT_SECRET?: string; STAFF_JWT_SECRET?: string };
    if (!env.JWT_SECRET && env.STAFF_JWT_SECRET && c.env) {
      (c.env as unknown as Record<string, unknown>).JWT_SECRET = env.STAFF_JWT_SECRET;
    }
    return optionalAuth()(c as any, next);
  }
  await next();
};

broadcastRouter.use('*', resolveBroadcastAuth);

registerSendHandler(broadcastRouter);

export default broadcastRouter;
