import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { registerSessionHandlers } from './session-handlers';
import { registerOrderHandlers } from './order-handlers';

const STAFF_SESSION_ROLES = [
  'owner',
  'manager',
  'supervisor',
  'staff',
  'waiter',
  'cashier',
  'admin',
  'barista',
  'chef',
  'kitchen',
] as const;

export const tableSessionsRouter = new Hono<{ Bindings: Env }>();
tableSessionsRouter.use('*', async (c, next) => {
  const existingUser = c.get('user' as any) as { role?: string } | undefined;
  if (existingUser) {
    if (!existingUser.role || !(STAFF_SESSION_ROLES as readonly string[]).includes(existingUser.role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    await next();
    return;
  }
  if (c.req.header('Authorization') || c.env?.ENVIRONMENT === 'production') {
    return requireAuth([...STAFF_SESSION_ROLES])(c, next);
  }
  await next();
});

registerSessionHandlers(tableSessionsRouter);
registerOrderHandlers(tableSessionsRouter);

export default tableSessionsRouter;
