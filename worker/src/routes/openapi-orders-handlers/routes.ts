import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerOrderReadHandlers } from './order-read-handlers';
import { registerOrderWriteHandlers } from './order-write-handlers';

export const openApiOrdersRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
// 'customer' is required here: guests authenticate with their own token and the
// read handlers scope every query to the caller's own customer_id.
openApiOrdersRouter.use('/api/orders', requireAuth(['owner', 'manager', 'staff', 'customer']));
openApiOrdersRouter.use('/api/orders/*', requireAuth(['owner', 'manager', 'staff', 'customer']));

registerOrderReadHandlers(openApiOrdersRouter);
registerOrderWriteHandlers(openApiOrdersRouter);

export default openApiOrdersRouter;
