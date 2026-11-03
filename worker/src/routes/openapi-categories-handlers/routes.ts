import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerCategoryReadHandlers } from './read-handlers';
import { registerCategoryMutationHandlers } from './mutation-handlers';

export const openApiCategoriesRouter = new OpenAPIHono<{ Bindings: Env }>();

const staffAuth = requireAuth(['owner', 'manager', 'supervisor', 'admin']);

// Apply auth middleware to mutations only (keeping public GET routes unauthenticated)
openApiCategoriesRouter.use('/api/categories', async (c, next) => {
  if (c.req.method !== 'GET') {
    return staffAuth(c, next);
  }
  if (!c.get('user' as never) && (c.req.header('Authorization') || c.req.header('authorization'))) {
    return optionalAuth()(c, next);
  }
  return next();
});

openApiCategoriesRouter.use('/api/categories/*', async (c, next) => {
  if (c.req.method !== 'GET') {
    return staffAuth(c, next);
  }
  if (!c.get('user' as never) && (c.req.header('Authorization') || c.req.header('authorization'))) {
    return optionalAuth()(c, next);
  }
  return next();
});

registerCategoryReadHandlers(openApiCategoriesRouter);
registerCategoryMutationHandlers(openApiCategoriesRouter);

export default openApiCategoriesRouter;
