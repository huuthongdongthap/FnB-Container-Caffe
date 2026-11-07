/**
 * Welcome Trigger — detect new customers for welcome campaign
 * Customers created in last 24h who haven't received a welcome message
 */
import { createLogger } from '../../../utils/logger';
import { matchesTenantRow } from '../../../middleware/tenant';
import type { CampaignCustomer } from '../types';

const log = createLogger({ route: 'trigger-welcome' });

export async function detectWelcomeCandidates(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId?: string
): Promise<CampaignCustomer[]> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const scoped = Boolean(tenantId && tenantId !== '*');

    if (scoped && tenantId) {
      try {
        const { results } = await db.prepare(`
          SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.created_at, c.tenant_id
          FROM customers c
          WHERE c.created_at > ?
            AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
            AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
            AND NOT EXISTS (
              SELECT 1 FROM campaign_logs cl
              WHERE cl.customer_id = c.id AND cl.trigger = 'welcome'
                AND COALESCE(NULLIF(TRIM(cl.tenant_id), ''), 'default') = ?
            )
        `).bind(cutoff, tenantId, tenantId).all<CampaignCustomer>();
        const filtered = (results || []).filter(
          (r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId)
        );
        log.info('welcome_candidates', { count: filtered.length, tenantId });
        return filtered;
      } catch {
        try {
          const { results } = await db.prepare(`
            SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.created_at, c.tenant_id
            FROM customers c
            WHERE c.created_at > ?
              AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
              AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
              AND NOT EXISTS (
                SELECT 1 FROM campaign_logs cl
                WHERE cl.customer_id = c.id AND cl.trigger = 'welcome'
              )
          `).bind(cutoff, tenantId).all<CampaignCustomer>();
          const filtered = (results || []).filter(
            (r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId)
          );
          log.info('welcome_candidates', { count: filtered.length, tenantId });
          return filtered;
        } catch {
          if (tenantId !== 'default') {
            return [];
          }
        }
      }
    }

    const { results } = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.created_at
      FROM customers c
      WHERE c.created_at > ?
        AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id AND cl.trigger = 'welcome'
        )
    `).bind(cutoff).all<CampaignCustomer>();

    const filtered = (results || []).filter(
      (r) => !scoped || !tenantId || matchesTenantRow(r as unknown as Record<string, unknown>, tenantId)
    );
    log.info('welcome_candidates', { count: filtered.length });
    return filtered;
  } catch (err) {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { results } = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.created_at
        FROM customers c
        WHERE c.created_at > ?
          AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM campaign_logs cl
            WHERE cl.customer_id = c.id AND cl.trigger_type = 'welcome'
          )
      `).bind(cutoff).all<CampaignCustomer>();
      return results;
    } catch {
      log.error('detectWelcomeCandidates error', { error: (err as Error).message });
      return [];
    }
  }
}
