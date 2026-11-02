import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { optionalAuth } from '../../middleware/auth';
import { registerSessionHandlers } from './session-handlers';
import { registerOrderHandlers } from './order-handlers';

export const tableSessionsRouter = new Hono<{ Bindings: Env }>();
tableSessionsRouter.use('*', async (c, next) => {
  if (!c.get('user' as any) && c.req.header('Authorization')) {
    return optionalAuth()(c, next);
  }
  await next();
});

registerSessionHandlers(tableSessionsRouter);
registerOrderHandlers(tableSessionsRouter);

export default tableSessionsRouter;
