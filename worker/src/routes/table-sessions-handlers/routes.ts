import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerSessionHandlers } from './session-handlers';
import { registerOrderHandlers } from './order-handlers';

export const tableSessionsRouter = new Hono<{ Bindings: Env }>();

registerSessionHandlers(tableSessionsRouter);
registerOrderHandlers(tableSessionsRouter);

export default tableSessionsRouter;
