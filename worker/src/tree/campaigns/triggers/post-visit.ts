/**
 * Post-Visit Trigger — send review request 24h after completed order
 * Detects orders completed 24-48h ago that haven't had a follow-up sent
 */
import { createLogger } from '../../../utils/logger';
import type { CampaignCustomer } from '../types';

const log = createLogger({ route: 'trigger-post-visit' });

export async function detectPostVisitCandidates(
  db: import('@cloudflare/workers-types').D1Database,
): Promise<CampaignCustomer[]> {
  try {
    const now = Date.now();
    const since = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const until = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const { results } = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email,
        o.id as order_id, o.created_at as last_order_date
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.status = 'completed'
        AND o.updated_at BETWEEN ? AND ?
        AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id
            AND cl.trigger = 'post_visit'
            AND cl.sent_at > ?
        )
    `).bind(since, until, since).all<CampaignCustomer>();

    log.info('post_visit_candidates', { count: results.length });
    return results;
  } catch (err) {
    log.error('detectPostVisitCandidates error', { error: (err as Error).message });
    return [];
  }
}
