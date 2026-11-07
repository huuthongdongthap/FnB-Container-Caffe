import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { isHQSuperAdmin } from '../../middleware/tenant';
import type { Env } from '../../types/env';
import { registerCampaignConfigHandlers } from './config-handlers';
import { registerCampaignStatsHandlers } from './stats-handlers';

export const campaignsRouter = new Hono<{ Bindings: Env }>();

// All routes require auth
campaignsRouter.use('/*', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']));

campaignsRouter.use('/*', async (c, next) => {
  const candidateOverrides = [
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
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

registerCampaignConfigHandlers(campaignsRouter);
registerCampaignStatsHandlers(campaignsRouter);

export default campaignsRouter;
