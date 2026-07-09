/**
 * Win-back Trigger — detect customers inactive for 30+ days
 */
import { createLogger } from '../../../utils/logger';
import type { CampaignCustomer } from '../types';

const log = createLogger({ route: 'trigger-winback' });

export async function detectWinbackCandidates(
  db: import('@cloudflare/workers-types').D1Database
): Promise<CampaignCustomer[]> {
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
            AND cl.trigger = 'winback'
            AND cl.sent_at > ?
        )
    `).bind(cutoff, sixtyDaysAgo).all<CampaignCustomer>();

    log.info('winback_candidates', { count: results.length });
    return results;
  } catch (err) {
    log.error('detectWinbackCandidates error', { error: (err as Error).message });
    return [];
  }
}
