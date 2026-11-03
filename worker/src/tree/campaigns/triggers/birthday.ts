/**
 * Birthday Trigger — detect customers with birthday this month
 * Sends birthday discount to customers whose birth month matches current month
 * and who haven't been sent birthday campaign this year
 */
import { createLogger } from '../../../utils/logger';
import { matchesTenantRow } from '../../../middleware/tenant';
import type { CampaignCustomer } from '../types';

const log = createLogger({ route: 'trigger-birthday' });

export async function detectBirthdayCandidates(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId?: string
): Promise<CampaignCustomer[]> {
  try {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const yearStart = `${year}-01-01`;

    const scoped = Boolean(tenantId && tenantId !== '*');
    if (scoped && tenantId) {
      try {
        const { results } = await db.prepare(`
          SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth, c.tenant_id
          FROM customers c
          WHERE c.date_of_birth IS NOT NULL
            AND substr(c.date_of_birth, 6, 2) = ?
            AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
            AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
            AND NOT EXISTS (
              SELECT 1 FROM campaign_logs cl
              WHERE cl.customer_id = c.id
                AND cl.trigger = 'birthday'
                AND cl.sent_at >= ?
                AND COALESCE(NULLIF(TRIM(cl.tenant_id), ''), 'default') = ?
            )
        `).bind(month, tenantId, yearStart, tenantId).all<CampaignCustomer>();
        const filtered = (results || []).filter(
          (row) => !('tenant_id' in row) || matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)
        );
        log.info('birthday_candidates', { count: filtered.length, month, tenantId });
        return filtered;
      } catch {
        // Fall through to default queries if tenant_id column is absent
      }
    }

    const { results } = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth
      FROM customers c
      WHERE c.date_of_birth IS NOT NULL
        AND substr(c.date_of_birth, 6, 2) = ?
        AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id
            AND cl.trigger = 'birthday'
            AND cl.sent_at >= ?
        )
    `).bind(month, yearStart).all<CampaignCustomer>();

    const filtered = scoped && tenantId
      ? (results || []).filter((row) => !('tenant_id' in row) || matchesTenantRow(row as unknown as Record<string, unknown>, tenantId))
      : results;
    log.info('birthday_candidates', { count: filtered.length, month });
    return filtered;
  } catch (err) {
    try {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const yearStart = `${year}-01-01`;
      const { results } = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth
        FROM customers c
        WHERE c.date_of_birth IS NOT NULL
          AND substr(c.date_of_birth, 6, 2) = ?
          AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM campaign_logs cl
            WHERE cl.customer_id = c.id
              AND cl.trigger_type = 'birthday'
              AND cl.created_at >= ?
          )
      `).bind(month, yearStart).all<CampaignCustomer>();
      return results;
    } catch {
      log.error('detectBirthdayCandidates error', { error: (err as Error).message });
      return [];
    }
  }
}
