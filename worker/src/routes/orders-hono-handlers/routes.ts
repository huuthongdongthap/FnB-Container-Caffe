import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerKdsHandlers } from './kds-handlers';
import { registerCheckoutHandlers } from './checkout-handlers';
import { registerGuestHandlers } from './guest-handlers';
import { registerQueryHandlers } from './query-handlers';

export const ordersRouter = new Hono<{ Bindings: Env }>();

registerKdsHandlers(ordersRouter);
registerCheckoutHandlers(ordersRouter);
registerGuestHandlers(ordersRouter);
registerQueryHandlers(ordersRouter);

export default ordersRouter;
