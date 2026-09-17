import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerProfileHandlers } from './profile-handlers';
import { registerAdminHandlers } from './admin-handlers';

export const customersRouter = new Hono<{ Bindings: Env }>();

registerProfileHandlers(customersRouter);
registerAdminHandlers(customersRouter);

export default customersRouter;
