import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { registerConfigHandlers } from './config-handlers';
import { registerCartHandlers } from './cart-handlers';
import { registerCheckoutHandlers } from './checkout-handlers';

export const dindinRouter = new Hono<{ Bindings: Env }>();

// All endpoints protected by admin auth
dindinRouter.use('*', requireAuth(['owner', 'staff']));

registerConfigHandlers(dindinRouter);
registerCartHandlers(dindinRouter);
registerCheckoutHandlers(dindinRouter);

export default dindinRouter;
