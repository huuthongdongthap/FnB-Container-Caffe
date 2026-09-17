import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerCategoryReadHandlers } from './read-handlers';
import { registerCategoryMutationHandlers } from './mutation-handlers';

export const openApiCategoriesRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiCategoriesRouter.use('*', requireAuth(['owner', 'manager', 'staff']));

registerCategoryReadHandlers(openApiCategoriesRouter);
registerCategoryMutationHandlers(openApiCategoriesRouter);

export default openApiCategoriesRouter;
