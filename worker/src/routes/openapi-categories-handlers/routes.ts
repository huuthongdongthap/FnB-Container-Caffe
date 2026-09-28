import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerCategoryReadHandlers } from './read-handlers';
import { registerCategoryMutationHandlers } from './mutation-handlers';

export const openApiCategoriesRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to this domain's routes only (sub-router is mounted at root)
openApiCategoriesRouter.use('/api/categories/*', requireAuth(['owner', 'manager', 'staff']));

registerCategoryReadHandlers(openApiCategoriesRouter);
registerCategoryMutationHandlers(openApiCategoriesRouter);

export default openApiCategoriesRouter;
