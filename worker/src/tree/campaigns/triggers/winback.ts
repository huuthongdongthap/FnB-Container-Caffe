/**
 * Win-back Trigger — detect customers inactive for 30+ days
 */
import { createLogger } from '../../../utils/logger';
import { matchesTenantRow } from '../../../middleware/tenant';
import type { CampaignCustomer } from '../types';

const log = createLogger({ route: 'trigger-winback' });

export async function detectWinbackCandidates(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId?: string
): Promise<CampaignCustomer[]> {
  try {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

    const scoped = Boolean(tenantId && tenantId !== '*');
    if (scoped && tenantId) {
      try {
        const { results } = await db.prepare(`
          SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.tenant_id,
            (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?) as last_order_date
          FROM customers c
          WHERE c.phone IS NOT NULL
            AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
            AND (
              SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
            ) < ?
            AND NOT EXISTS (
              SELECT 1 FROM campaign_logs cl
              WHERE cl.customer_id = c.id
                AND cl.trigger = 'winback'
                AND cl.sent_at > ?
                AND COALESCE(NULLIF(TRIM(cl.tenant_id), ''), 'default') = ?
            )
        `).bind(tenantId, tenantId, tenantId, cutoff, sixtyDaysAgo, tenantId).all<CampaignCustomer>();
        const filtered = (results || []).filter(
          (row) => !('tenant_id' in row) || matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)
        );
        log.info('winback_candidates', { count: filtered.length, tenantId });
        return filtered;
      } catch {
        // Fall through to default queries if tenant_id column is absent
      }
    }

    const { results } = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date
      FROM customers c
      WHERE c.phone IS NOT NULL
        AND (
          SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id
        ) < ?
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id
            AND cl.trigger = 'winback'
            AND cl.sent_at > ?
        )
    `).bind(cutoff, sixtyDaysAgo).all<CampaignCustomer>();

    const filtered = scoped && tenantId
      ? (results || []).filter((row) => !('tenant_id' in row) || matchesTenantRow(row as unknown as Record<string, unknown>, tenantId))
      : results;
    log.info('winback_candidates', { count: filtered.length });
    return filtered;
  } catch (err) {
    try {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
      const { results } = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier,
          (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date
        FROM customers c
        WHERE c.phone IS NOT NULL
          AND (
            SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id
          ) < ?
          AND NOT EXISTS (
            SELECT 1 FROM campaign_logs cl
            WHERE cl.customer_id = c.id
              AND cl.trigger_type = 'winback'
              AND cl.created_at > ?
          )
      `).bind(cutoff, sixtyDaysAgo).all<CampaignCustomer>();
      return results;
    } catch {
      log.error('detectWinbackCandidates error', { error: (err as Error).message });
      return [];
    }
  }
}
