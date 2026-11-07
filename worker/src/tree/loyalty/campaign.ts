// Campaign helpers extracted from routes/loyalty.ts

import { matchesTenantRow } from '../../middleware/tenant';
import { nowSqlTimestamp } from './helpers';
import type { BonusCampaign } from '../../types/models';

export async function getActiveCampaign(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string = 'default'
): Promise<BonusCampaign | null> {
  const now = nowSqlTimestamp();
  const normalizedTenant = (tenantId && tenantId.trim()) || 'default';
  if (normalizedTenant !== '*' && normalizedTenant !== 'default') {
    try {
      const scoped = await db.prepare(
        "SELECT * FROM bonus_campaigns WHERE active = 1 AND start_date <= ? AND end_date >= ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY id DESC LIMIT 1"
      ).bind(now, now, normalizedTenant).first<BonusCampaign & { tenant_id?: string | null }>();
      if (!scoped) {
        return null;
      }
      if (!matchesTenantRow(scoped, normalizedTenant)) {
        return null;
      }
      return scoped;
    } catch {
      // Fallback if tenant_id column is absent
    }
  }
  const row = await db.prepare(
    'SELECT * FROM bonus_campaigns WHERE active = 1 AND start_date <= ? AND end_date >= ? ORDER BY id DESC LIMIT 1'
  ).bind(now, now).first<BonusCampaign & { tenant_id?: string | null }>() || null;
  if (row && !matchesTenantRow(row, normalizedTenant)) {
    if (normalizedTenant !== '*') {
      try {
        const scoped = await db.prepare(
          "SELECT * FROM bonus_campaigns WHERE active = 1 AND start_date <= ? AND end_date >= ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY id DESC LIMIT 1"
        ).bind(now, now, normalizedTenant).first<BonusCampaign & { tenant_id?: string | null }>();
        if (scoped && matchesTenantRow(scoped, normalizedTenant)) {
          return scoped;
        }
        return null;
      } catch {
        return null;
      }
    }
    return null;
  }
  return row;
}

export function calcExpiresAt(tier: { expiry_days?: number | null } | null): string | null {
  if (!tier || !tier.expiry_days) {
    return null;
  }
  return new Date(Date.now() + tier.expiry_days * 86400000).toISOString();
}
