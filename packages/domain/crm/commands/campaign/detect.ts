/**
 * Campaign Trigger Detectors — find candidate customers for each campaign type.
 * Pure-ish: D1 query + filter, returns CampaignCustomer[] ready for send.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { CampaignCustomer } from './types';

function rowMatchesTenant(row: unknown, tenantId?: string): boolean {
  if (!tenantId || tenantId === '*') return true;
  if (!row || typeof row !== 'object' || !('tenant_id' in row)) return true;
  const raw = (row as { tenant_id?: unknown }).tenant_id;
  const normalized = typeof raw === 'string' && raw.trim() ? raw.trim() : 'default';
  return normalized === tenantId;
}

/**
 * Welcome — new customers in last 24h who haven't received welcome message.
 */
export async function detectWelcomeCandidates(db: D1Database, tenantId?: string): Promise<CampaignCustomer[]> {
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
      return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
    } catch {
      // Fallback if tenant_id column is absent
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
  return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
}

/**
 * Birthday — customers whose birth month matches current month, not sent this year.
 */
export async function detectBirthdayCandidates(db: D1Database, tenantId?: string): Promise<CampaignCustomer[]> {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const yearStart = `${now.getFullYear()}-01-01`;
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
      return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
    } catch {
      // Fallback if tenant_id column is absent
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
  return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
}

/**
 * Winback — customers inactive for 30+ days.
 */
export async function detectWinbackCandidates(db: D1Database, tenantId?: string): Promise<CampaignCustomer[]> {
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
      return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
    } catch {
      // Fallback if tenant_id column is absent
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
  return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
}

/**
 * Post-Visit — send review request 24-48h after completed order.
 */
export async function detectPostVisitCandidates(db: D1Database, tenantId?: string): Promise<CampaignCustomer[]> {
  const now = Date.now();
  const since = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const until = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const scoped = Boolean(tenantId && tenantId !== '*');

  if (scoped && tenantId) {
    try {
      const { results } = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.tenant_id,
          o.id as order_id, o.created_at as last_order_date
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.status = 'completed'
          AND o.created_at BETWEEN ? AND ?
          AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
          AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM campaign_logs cl
            WHERE cl.customer_id = c.id
              AND cl.trigger = 'post_visit'
              AND cl.sent_at > ?
              AND COALESCE(NULLIF(TRIM(cl.tenant_id), ''), 'default') = ?
          )
      `).bind(since, until, tenantId, tenantId, since, tenantId).all<CampaignCustomer>();
      return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
    } catch {
      // Fallback if tenant_id column is absent
    }
  }

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
  return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
}

interface ExpiringRow {
  customer_id: string;
  phone: string | null;
  name: string | null;
  total_expiring: number;
  wallet_balance?: number | null;
  tenant_id?: string | null;
}

/**
 * Cashback Expiry — customers with cashback expiring within 7 days.
 */
export async function detectCashbackExpiry(db: D1Database, tenantId?: string): Promise<CampaignCustomer[]> {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const scoped = Boolean(tenantId && tenantId !== '*');

  let results: ExpiringRow[] = [];
  if (scoped && tenantId) {
    try {
      const scopedRes = await db.prepare(`
        SELECT cw.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring, cw.balance as wallet_balance, c.tenant_id as tenant_id
        FROM cashback_transactions ct
        JOIN cashback_wallets cw ON ct.wallet_id = cw.id
        JOIN customers c ON cw.customer_id = c.id
        WHERE ct.type IN ('earn', 'bonus')
          AND ct.expires_at IS NOT NULL
          AND ct.expires_at <= ?
          AND ct.expires_at > datetime('now')
          AND COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?
          AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
        GROUP BY cw.customer_id
      `).bind(sevenDaysFromNow, tenantId, tenantId, sevenDaysAgo).all<ExpiringRow>();
      results = (scopedRes.results || []).filter((r) => rowMatchesTenant(r, tenantId));
      return results
        .map((row) => {
          const cappedAmount = row.wallet_balance != null
            ? Math.max(0, Math.min(Number(row.total_expiring || 0), Number(row.wallet_balance)))
            : row.total_expiring;
          return {
            id: row.customer_id,
            name: row.name || '',
            phone: row.phone || undefined,
            email: undefined,
            loyalty_tier: undefined,
            total_spent: cappedAmount,
            tenant_id: tenantId,
          };
        })
        .filter((c) => (c.total_spent ?? 0) > 0);
    } catch {
      try {
        const scopedFallback = await db.prepare(`
          SELECT cw.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring, c.tenant_id as tenant_id
          FROM cashback_transactions ct
          JOIN cashback_wallets cw ON ct.wallet_id = cw.id
          JOIN customers c ON cw.customer_id = c.id
          WHERE ct.type IN ('earn', 'bonus')
            AND ct.expires_at IS NOT NULL
            AND ct.expires_at <= ?
            AND ct.expires_at > datetime('now')
            AND COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?
            AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          GROUP BY cw.customer_id
        `).bind(sevenDaysFromNow, tenantId, tenantId).all<ExpiringRow>();
        results = (scopedFallback.results || []).filter((r) => rowMatchesTenant(r, tenantId));
        return results.map((row) => ({
          id: row.customer_id,
          name: row.name || '',
          phone: row.phone || undefined,
          email: undefined,
          loyalty_tier: undefined,
          total_spent: row.total_expiring,
          tenant_id: tenantId,
        }));
      } catch {
        // Fall through to default queries
      }
    }
  }
  try {
    const primary = await db.prepare(`
      SELECT ct.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring
      FROM cashback_transactions ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.type IN ('earn', 'bonus')
        AND ct.expires_at IS NOT NULL
        AND ct.expires_at <= ?
        AND ct.expires_at > datetime('now')
        AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
      GROUP BY ct.customer_id
    `).bind(sevenDaysFromNow, sevenDaysAgo).all<ExpiringRow>();
    results = primary.results || [];
  } catch {
    try {
      const fallback = await db.prepare(`
        SELECT cw.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring
        FROM cashback_transactions ct
        JOIN cashback_wallets cw ON ct.wallet_id = cw.id
        JOIN customers c ON cw.customer_id = c.id
        WHERE ct.type IN ('earn', 'bonus')
          AND ct.expires_at IS NOT NULL
          AND ct.expires_at <= ?
          AND ct.expires_at > datetime('now')
        GROUP BY cw.customer_id
      `).bind(sevenDaysFromNow).all<ExpiringRow>();
      results = fallback.results || [];
    } catch {
      results = [];
    }
  }

  return results
    .filter((r) => rowMatchesTenant(r, tenantId))
    .map((row) => ({
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
  tenantId?: string,
): Promise<number> {
  if (customerIds.length === 0) return 0;

  const now = new Date().toISOString();
  if (tenantId && tenantId !== '*') {
    try {
      const scopedStmts = customerIds.map((id) =>
        db.prepare("UPDATE customers SET last_expiry_warning_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(now, id, tenantId)
      );
      await db.batch(scopedStmts);
      return customerIds.length;
    } catch {
      // Fallback if tenant_id or last_expiry_warning_at column is absent
    }
  }
  const stmts = customerIds.map((id) =>
    db.prepare('UPDATE customers SET last_expiry_warning_at = ? WHERE id = ?').bind(now, id)
  );
  try {
    await db.batch(stmts);
  } catch {
    // Graceful fallback when last_expiry_warning_at column is absent
  }
  return customerIds.length;
}
