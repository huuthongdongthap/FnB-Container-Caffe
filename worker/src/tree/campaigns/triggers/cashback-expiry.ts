/**
 * Cashback Expiry Trigger — detect expiring cashback and warn customers
 * Refactored from routes/cron.ts:sendCashbackExpiryWarnings
 * Sends warning 7 days before cashback expires
 */
import { createLogger } from '../../../utils/logger';
import type { CampaignCustomer } from '../types';

const log = createLogger({ route: 'trigger-cashback-expiry' });

interface ExpiringRow {
  customer_id: string;
  phone: string | null;
  name: string | null;
  zalo: string | null;
  total_expiring: number;
}

export async function detectCashbackExpiry(
  db: import('@cloudflare/workers-types').D1Database
): Promise<CampaignCustomer[]> {
  try {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
    const now = new Date().toISOString();

    const { results } = await db.prepare(`
      SELECT ct.customer_id, c.phone, c.name, c.zalo, SUM(ct.amount) as total_expiring
      FROM cashback_transactions ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.type IN ('earn', 'bonus')
        AND ct.expires_at IS NOT NULL
        AND ct.expires_at <= ?
        AND ct.expires_at > datetime('now')
        AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
      GROUP BY ct.customer_id
    `).bind(sevenDaysFromNow, now).all<ExpiringRow>();

    const customers: CampaignCustomer[] = results.map(row => ({
      id: row.customer_id,
      name: row.name || '',
      phone: row.phone || undefined,
      email: undefined,
      loyalty_tier: undefined,
      total_spent: row.total_expiring
    }));

    log.info('cashback_expiry_candidates', { count: customers.length });
    return customers;
  } catch (err) {
    log.error('detectCashbackExpiry error', { error: (err as Error).message });
    return [];
  }
}

/**
 * Mark customers as notified so expiry warning is sent only once.
 * Returns number of customers updated.
 */
export async function markExpiryNotified(
  db: import('@cloudflare/workers-types').D1Database,
  customerIds: string[]
): Promise<number> {
  if (!customerIds.length) {
    return 0;
  }

  try {
    const now = new Date().toISOString();
    const stmts = customerIds.map(id =>
      db.prepare('UPDATE customers SET last_expiry_warning_at = ? WHERE id = ?').bind(now, id)
    );
    await db.batch(stmts);
    return customerIds.length;
  } catch (err) {
    log.error('markExpiryNotified error', { error: (err as Error).message });
    return 0;
  }
}
