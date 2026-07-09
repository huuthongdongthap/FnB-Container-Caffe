/**
 * Birthday Trigger — detect customers with birthday this month
 * Sends birthday discount to customers whose birth month matches current month
 * and who haven't been sent birthday campaign this year
 */
import { createLogger } from '../../../utils/logger';
import type { CampaignCustomer } from '../types';

const log = createLogger({ route: 'trigger-birthday' });

export async function detectBirthdayCandidates(
  db: import('@cloudflare/workers-types').D1Database
): Promise<CampaignCustomer[]> {
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
            AND cl.trigger = 'birthday'
            AND cl.sent_at >= ?
        )
    `).bind(month, yearStart).all<CampaignCustomer>();

    log.info('birthday_candidates', { count: results.length, month });
    return results;
  } catch (err) {
    log.error('detectBirthdayCandidates error', { error: (err as Error).message });
    return [];
  }
}
