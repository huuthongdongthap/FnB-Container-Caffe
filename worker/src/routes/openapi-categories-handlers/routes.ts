import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerCategoryReadHandlers } from './read-handlers';
import { registerCategoryMutationHandlers } from './mutation-handlers';

export const openApiCategoriesRouter = new OpenAPIHono<{ Bindings: Env }>();

const staffAuth = requireAuth(['owner', 'manager', 'staff']);

// Apply auth middleware to mutations only (keeping public GET routes unauthenticated)
openApiCategoriesRouter.use('/api/categories', async (c, next) => {
  if (c.req.method !== 'GET') {
    return staffAuth(c, next);
  }
  return next();
});

openApiCategoriesRouter.use('/api/categories/*', async (c, next) => {
  if (c.req.method !== 'GET') {
    return staffAuth(c, next);
  }
  return next();
});

registerCategoryReadHandlers(openApiCategoriesRouter);
registerCategoryMutationHandlers(openApiCategoriesRouter);

export default openApiCategoriesRouter;
