import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerProductReadHandlers } from './read-handlers';
import { registerProductMutationHandlers } from './mutation-handlers';

export const openApiProductsRouter = new OpenAPIHono<{ Bindings: Env }>();

const staffAuth = requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']);

// Apply auth middleware to mutations only (keeping public GET routes unauthenticated)
openApiProductsRouter.use('/api/products', async (c, next) => {
  if (c.req.method !== 'GET') {
    return staffAuth(c, next);
  }
  if (!c.get('user' as never) && (c.req.header('Authorization') || c.req.header('authorization'))) {
    return optionalAuth()(c, next);
  }
  return next();
});

openApiProductsRouter.use('/api/products/*', async (c, next) => {
  if (c.req.method !== 'GET') {
    return staffAuth(c, next);
  }
  if (!c.get('user' as never) && (c.req.header('Authorization') || c.req.header('authorization'))) {
    return optionalAuth()(c, next);
  }
  return next();
});

registerProductReadHandlers(openApiProductsRouter);
registerProductMutationHandlers(openApiProductsRouter);

export default openApiProductsRouter;
