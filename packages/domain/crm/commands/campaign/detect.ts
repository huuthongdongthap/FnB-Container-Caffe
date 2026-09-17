/**
 * Campaign Trigger Detectors — find candidate customers for each campaign type.
 * Pure-ish: D1 query + filter, returns CampaignCustomer[] ready for send.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { CampaignCustomer } from './types';

/**
 * Welcome — new customers in last 24h who haven't received welcome message.
 */
export async function detectWelcomeCandidates(db: D1Database): Promise<CampaignCustomer[]> {
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
  return results;
}

/**
 * Birthday — customers whose birth month matches current month, not sent this year.
 */
export async function detectBirthdayCandidates(db: D1Database): Promise<CampaignCustomer[]> {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const yearStart = `${now.getFullYear()}-01-01`;

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
  return results;
}

/**
 * Winback — customers inactive for 30+ days.
 */
export async function detectWinbackCandidates(db: D1Database): Promise<CampaignCustomer[]> {
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
  return results;
}

/**
 * Post-Visit — send review request 24-48h after completed order.
 */
export async function detectPostVisitCandidates(db: D1Database): Promise<CampaignCustomer[]> {
  const now = Date.now();
  const since = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const until = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const { results } = await db.prepare(`
    SELECT c.id, c.name, c.phone, c.email,
      o.id as order_id, o.created_at as last_order_date
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE o.status = 'completed'
      AND o.created_at BETWEEN ? AND ?
      AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM campaign_logs cl
        WHERE cl.customer_id = c.id
          AND cl.trigger = 'post_visit'
          AND cl.sent_at > ?
      )
  `).bind(since, until, since).all<CampaignCustomer>();
  return results;
}

interface ExpiringRow {
  customer_id: string;
  phone: string | null;
  name: string | null;
  total_expiring: number;
}

/**
 * Cashback Expiry — customers with cashback expiring within 7 days.
 */
export async function detectCashbackExpiry(db: D1Database): Promise<CampaignCustomer[]> {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
  const now = new Date().toISOString();

  const { results } = await db.prepare(`
    SELECT ct.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring
    FROM cashback_transactions ct
    JOIN customers c ON ct.customer_id = c.id
    WHERE ct.type IN ('earn', 'bonus')
      AND ct.expires_at IS NOT NULL
      AND ct.expires_at <= ?
      AND ct.expires_at > datetime('now')
      AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
    GROUP BY ct.customer_id
  `).bind(sevenDaysFromNow, now).all<ExpiringRow>();

  return results.map((row) => ({
    id: row.customer_id,
    name: row.name || '',
    phone: row.phone || undefined,
    email: undefined,
    loyalty_tier: undefined,
    total_spent: row.total_expiring,
  }));
}

/**
 * Mark customers as notified for expiry warning (idempotent).
 * Returns number updated.
 */
export async function markExpiryNotified(
  db: D1Database,
  customerIds: string[],
): Promise<number> {
  if (customerIds.length === 0) return 0;

  const now = new Date().toISOString();
  const stmts = customerIds.map((id) =>
    db.prepare('UPDATE customers SET last_expiry_warning_at = ? WHERE id = ?').bind(now, id)
  );
  await db.batch(stmts);
  return customerIds.length;
}
