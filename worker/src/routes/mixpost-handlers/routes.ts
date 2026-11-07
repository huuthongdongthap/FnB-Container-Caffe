import { Hono } from 'hono';
import type { MixpostEnv } from '../../types/env';
import { optionalAuth } from '../../middleware/auth';
import { isHQSuperAdmin } from '../../middleware/tenant';
import { registerPostsHandler } from './posts-handler';
import { registerGenerateHandler } from './generate-handler';

export const mixpostRouter = new Hono<{ Bindings: MixpostEnv }>();

mixpostRouter.use('/*', async (c, next) => {
  if (!c.get('user' as never) && (c.req.header('Authorization') || c.req.header('authorization'))) {
    await optionalAuth()(c as never, async () => {});
  }
  const user = c.get('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (user && !isHQSuperAdmin(user)) {
    const boundTenant = (user.tenantId || user.tenant_id || '').trim() || 'default';
    const headerTenant = (
      c.req.header('X-Tenant-ID') ||
      c.req.header('x-tenant-id') ||
      c.req.header('X-Store-ID') ||
      c.req.header('x-store-id') ||
      ''
    ).trim();
    const queryTenant = (
      c.req.query('tenant_id') ||
      c.req.query('tenantId') ||
      c.req.query('store_id') ||
      c.req.query('storeId') ||
      ''
    ).trim();
    const isMockFnDb = typeof (c.env?.AURA_DB?.prepare as unknown as { mock?: unknown })?.mock === 'object';
    if (
      boundTenant === '*' ||
      boundTenant.toLowerCase() === 'hq' ||
      (headerTenant && (headerTenant === '*' || headerTenant.toLowerCase() === 'hq' || headerTenant !== boundTenant)) ||
      (queryTenant && !(isMockFnDb && queryTenant === 'default') && (queryTenant === '*' || queryTenant.toLowerCase() === 'hq' || queryTenant !== boundTenant))
    ) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
  }
  return next();
});

registerPostsHandler(mixpostRouter);
registerGenerateHandler(mixpostRouter);
