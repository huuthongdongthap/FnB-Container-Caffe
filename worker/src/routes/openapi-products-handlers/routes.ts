import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerProductReadHandlers } from './read-handlers';
import { registerProductMutationHandlers } from './mutation-handlers';

export const openApiProductsRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiProductsRouter.use('*', requireAuth(['owner', 'manager', 'staff']));

registerProductReadHandlers(openApiProductsRouter);
registerProductMutationHandlers(openApiProductsRouter);

export default openApiProductsRouter;
