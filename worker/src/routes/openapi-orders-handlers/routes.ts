import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerOrderReadHandlers } from './order-read-handlers';
import { registerOrderWriteHandlers } from './order-write-handlers';

export const openApiOrdersRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiOrdersRouter.use('*', requireAuth(['owner', 'manager', 'staff']));

registerOrderReadHandlers(openApiOrdersRouter);
registerOrderWriteHandlers(openApiOrdersRouter);

export default openApiOrdersRouter;
