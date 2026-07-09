/**
 * Welcome Trigger — detect new customers for welcome campaign
 * Customers created in last 24h who haven't received a welcome message
 */
import { createLogger } from '../../../utils/logger';
import type { CampaignCustomer } from '../types';

const log = createLogger({ route: 'trigger-welcome' });

export async function detectWelcomeCandidates(
  db: import('@cloudflare/workers-types').D1Database
): Promise<CampaignCustomer[]> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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

    log.info('welcome_candidates', { count: results.length });
    return results;
  } catch (err) {
    log.error('detectWelcomeCandidates error', { error: (err as Error).message });
    return [];
  }
}
