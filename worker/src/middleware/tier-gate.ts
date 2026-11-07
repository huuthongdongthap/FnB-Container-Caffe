import type { MiddlewareHandler } from 'hono';
import { getTenantId, isHQSuperAdmin } from './tenant';

export type Tier =
  | 'BASIC'
  | 'PREMIUM'
  | 'ENTERPRISE'
  | 'MASTER'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond';

const TIER_ORDER: Record<string, number> = {
  BASIC: 0,
  BRONZE: 0,
  PREMIUM: 1,
  SILVER: 1,
  ENTERPRISE: 2,
  GOLD: 2,
  MASTER: 3,
  PLATINUM: 3,
  DIAMOND: 4,
};

export function tierRank(tier: string): number {
  return TIER_ORDER[String(tier || '').trim().toUpperCase()] ?? -1;
}

export function requiresTier(minTier: Tier | string): MiddlewareHandler {
  return async (c, next) => {
    const candidates = [
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
    if (new Set(candidates).size > 1) {
      return c.json({ ok: false, success: false, error: 'Cross-tenant access denied' } as const, 403);
    }
    const user = c.get('user' as never) as
      | { role?: string; tier?: string; tenantId?: string; tenant_id?: string }
      | undefined;
    if (user && !isHQSuperAdmin(c as never)) {
      const rawUserTenant = (user.tenantId ?? user.tenant_id ?? '').trim();
      if (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq') {
        return c.json({ ok: false, success: false, error: 'Cross-tenant access denied' } as const, 403);
      }
      const userTenant = rawUserTenant || 'default';
      const reqOverride = candidates[0] || '';
      const ctxTenant = ((c.get('tenantId' as never) as string | undefined) ?? '').trim();
      const resolvedTenant = getTenantId(c as never).trim() || 'default';
      if (
        (reqOverride && (reqOverride === '*' || reqOverride.toLowerCase() === 'hq' || reqOverride !== userTenant)) ||
        (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== userTenant)) ||
        resolvedTenant !== userTenant
      ) {
        return c.json({ ok: false, success: false, error: 'Cross-tenant access denied' } as const, 403);
      }
    }
    const raw =
      (c.get('userTier') as string | undefined) ??
      user?.tier ??
      'BASIC';
    if (tierRank(String(raw)) < tierRank(String(minTier))) {
      return c.json({ ok: false, error: 'upgrade_required' } as const, 403);
    }
    await next();
  };
}
