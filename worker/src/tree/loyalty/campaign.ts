// Campaign helpers extracted from routes/loyalty.ts

import { nowSqlTimestamp } from './helpers';
import type { BonusCampaign } from '../../types/models';

export async function getActiveCampaign(db: import('@cloudflare/workers-types').D1Database): Promise<BonusCampaign | null> {
  const now = nowSqlTimestamp();
  return await db.prepare(
    'SELECT * FROM bonus_campaigns WHERE active = 1 AND start_date <= ? AND end_date >= ? ORDER BY id DESC LIMIT 1'
  ).bind(now, now).first<BonusCampaign>() || null;
}

export function calcExpiresAt(tier: { expiry_days?: number | null } | null): string | null {
  if (!tier || !tier.expiry_days) { return null; }
  return new Date(Date.now() + tier.expiry_days * 86400000).toISOString();
}
