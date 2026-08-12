import type { MiddlewareHandler } from 'hono';

export type Tier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

const TIER_ORDER: Record<Tier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};

export function tierRank(tier: string): number {
  return TIER_ORDER[tier as Tier] ?? -1;
}

export function requiresTier(minTier: Tier): MiddlewareHandler {
  return async (c, next) => {
    const raw = (c.get('userTier') as string | undefined) ?? 'BASIC';
    if (tierRank(raw) < tierRank(minTier)) {
      return c.json({ ok: false, error: 'upgrade_required' } as const, 403);
    }
    await next();
  };
}
