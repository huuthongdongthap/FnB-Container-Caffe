/**
 * Campaign Trigger Detectors — find candidate customers for each campaign type.
 * Pure-ish: D1 query + filter, returns CampaignCustomer[] ready for send.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { CampaignCustomer } from './types';

function normalizeCampaignTenant(tenantId?: string): string | undefined {
  if (!tenantId || !tenantId.trim()) return undefined;
  const trimmed = tenantId.trim();
  return trimmed === '*' || trimmed.toLowerCase() === 'hq' ? '*' : trimmed;
}

function rowMatchesTenant(row: unknown, tenantId?: string): boolean {
  const normTenant = normalizeCampaignTenant(tenantId);
  if (!normTenant || normTenant === '*') return true;
  if (!row || typeof row !== 'object' || !('tenant_id' in row) || (row as { tenant_id?: unknown }).tenant_id === undefined) {
    return normTenant === 'default';
  }
  const raw = (row as { tenant_id?: unknown }).tenant_id;
  const normalized = typeof raw === 'string' && raw.trim() ? raw.trim() : 'default';
  return normalized === normTenant;
}

/**
 * Welcome — new customers in last 24h who haven't received welcome message.
 */
export async function detectWelcomeCandidates(db: D1Database, tenantId?: string): Promise<CampaignCustomer[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const normTenant = normalizeCampaignTenant(tenantId);
  const scoped = Boolean(normTenant && normTenant !== '*');
  if (scoped && normTenant) {
    tenantId = normTenant;
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
        return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
      } catch {
        if (tenantId !== 'default') {
          return [];
        }
      }
    }
  }
  let results: CampaignCustomer[] | undefined;
  try {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.created_at, c.tenant_id
      FROM customers c
      WHERE c.created_at > ?
        AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id AND cl.trigger = 'welcome'
        )
    `).bind(cutoff).all<CampaignCustomer>();
    results = res.results;
  } catch {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.created_at
      FROM customers c
      WHERE c.created_at > ?
        AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id AND cl.trigger = 'welcome'
        )
    `).bind(cutoff).all<CampaignCustomer>();
    results = res.results;
  }
  return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
}

/**
 * Birthday — customers whose birth month matches current month, not sent this year.
 */
export async function detectBirthdayCandidates(db: D1Database, tenantId?: string): Promise<CampaignCustomer[]> {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const yearStart = `${now.getFullYear()}-01-01`;
  const normTenant = normalizeCampaignTenant(tenantId);
  const scoped = Boolean(normTenant && normTenant !== '*');

  if (scoped && normTenant) {
    tenantId = normTenant;
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
            )
        `).bind(month, tenantId, yearStart).all<CampaignCustomer>();
        return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
      } catch {
        if (tenantId !== 'default') {
          return [];
        }
      }
    }
  }

  let results: CampaignCustomer[] | undefined;
  try {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth, c.tenant_id
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
    results = res.results;
  } catch {
    const res = await db.prepare(`
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
    results = res.results;
  }
  return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
}

/**
 * Winback — customers inactive for 30+ days.
 */
export async function detectWinbackCandidates(
  db: D1Database,
  tenantIdOrDays?: string | number,
  maybeTenantId?: string,
): Promise<CampaignCustomer[]> {
  const inactiveDays = typeof tenantIdOrDays === 'number' ? tenantIdOrDays : 30;
  const rawTenantId = typeof tenantIdOrDays === 'string' ? tenantIdOrDays : maybeTenantId;
  let tenantId = normalizeCampaignTenant(rawTenantId);
  const cutoff = new Date(Date.now() - inactiveDays * 86400000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
  const scoped = Boolean(tenantId && tenantId !== '*');

  const validOrderClause =
    "AND LOWER(COALESCE(o.status, '')) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded') AND LOWER(COALESCE(o.payment_status, '')) NOT IN ('failed', 'expired', 'cancelled', 'canceled', 'refunded')";
  if (scoped && tenantId) {
    try {
      const { results } = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.tenant_id,
          (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause} AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?) as last_order_date
        FROM customers c
        WHERE c.phone IS NOT NULL
          AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          AND (
            SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause} AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
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
            )
        `).bind(tenantId, tenantId, tenantId, cutoff, sixtyDaysAgo).all<CampaignCustomer>();
        return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
      } catch {
        try {
          const { results } = await db.prepare(`
            SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.tenant_id,
              (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date
            FROM customers c
            WHERE c.phone IS NOT NULL
              AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
              AND (
                SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id
              ) < ?
              AND NOT EXISTS (
                SELECT 1 FROM campaign_logs cl
                WHERE cl.customer_id = c.id
                  AND cl.trigger = 'winback'
                  AND cl.sent_at > ?
              )
          `).bind(tenantId, cutoff, sixtyDaysAgo).all<CampaignCustomer>();
          return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
        } catch {
          if (tenantId !== 'default') {
            return [];
          }
        }
      }
    }
  }

  let results: CampaignCustomer[] | undefined;
  try {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.tenant_id,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause}) as last_order_date
      FROM customers c
      WHERE c.phone IS NOT NULL
        AND (
          SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause}
        ) < ?
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id
            AND cl.trigger = 'winback'
            AND cl.sent_at > ?
        )
    `).bind(cutoff, sixtyDaysAgo).all<CampaignCustomer>();
    results = res.results;
  } catch {
    try {
      const res = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier,
          (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause}) as last_order_date
        FROM customers c
        WHERE c.phone IS NOT NULL
          AND (
            SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause}
          ) < ?
          AND NOT EXISTS (
            SELECT 1 FROM campaign_logs cl
            WHERE cl.customer_id = c.id
              AND cl.trigger = 'winback'
              AND cl.sent_at > ?
          )
      `).bind(cutoff, sixtyDaysAgo).all<CampaignCustomer>();
      results = res.results;
    } catch {
      const res = await db.prepare(`
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
      results = res.results;
    }
  }
  return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
}

/**
 * Post-Visit — send review request 24-48h after completed order.
 */
export async function detectPostVisitCandidates(db: D1Database, tenantId?: string): Promise<CampaignCustomer[]> {
  const now = Date.now();
  const since = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const until = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const normTenant = normalizeCampaignTenant(tenantId);
  const scoped = Boolean(normTenant && normTenant !== '*');

  if (scoped && normTenant) {
    tenantId = normTenant;
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
            )
        `).bind(since, until, tenantId, tenantId, since).all<CampaignCustomer>();
        return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
      } catch {
        try {
          const { results } = await db.prepare(`
            SELECT c.id, c.name, c.phone, c.email, c.tenant_id,
              o.id as order_id, o.created_at as last_order_date
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE o.status = 'completed'
              AND o.created_at BETWEEN ? AND ?
              AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
              AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
              AND NOT EXISTS (
                SELECT 1 FROM campaign_logs cl
                WHERE cl.customer_id = c.id
                  AND cl.trigger = 'post_visit'
                  AND cl.sent_at > ?
              )
          `).bind(since, until, tenantId, since).all<CampaignCustomer>();
          return (results || []).filter((r) => rowMatchesTenant(r, tenantId));
        } catch {
          if (tenantId !== 'default') {
            return [];
          }
        }
      }
    }
  }

  let results: CampaignCustomer[] | undefined;
  try {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.tenant_id,
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
    results = res.results;
  } catch {
    const res = await db.prepare(`
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
    results = res.results;
  }
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
  const normTenant = normalizeCampaignTenant(tenantId);
  const scoped = Boolean(normTenant && normTenant !== '*');

  let results: ExpiringRow[] = [];
  if (scoped && normTenant) {
    tenantId = normTenant;
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
          const resolvedTenant = (row.tenant_id && String(row.tenant_id).trim()) || tenantId;
          return {
            id: row.customer_id,
            name: row.name || '',
            phone: row.phone || undefined,
            email: undefined,
            loyalty_tier: undefined,
            total_spent: cappedAmount,
            tenant_id: resolvedTenant,
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
          tenant_id: (row.tenant_id && String(row.tenant_id).trim()) || tenantId,
        }));
      } catch {
        if (tenantId !== 'default') {
          return [];
        }
      }
    }
  }
  try {
    const primary = await db.prepare(`
      SELECT ct.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring, c.tenant_id as tenant_id
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
      const primaryLegacy = await db.prepare(`
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
      results = primaryLegacy.results || [];
    } catch {
      try {
        const fallback = await db.prepare(`
          SELECT cw.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring, c.tenant_id as tenant_id
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
        try {
          const fallbackLegacy = await db.prepare(`
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
          results = fallbackLegacy.results || [];
        } catch {
          results = [];
        }
      }
    }
  }

  return results
    .filter((r) => rowMatchesTenant(r, normTenant))
    .map((row) => ({
      id: row.customer_id,
      name: row.name || '',
      phone: row.phone || undefined,
      email: undefined,
      loyalty_tier: undefined,
      total_spent: row.total_expiring,
      tenant_id: (row.tenant_id && String(row.tenant_id).trim()) || (normTenant && normTenant !== '*' ? normTenant : 'default'),
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
  const normTenant = normalizeCampaignTenant(tenantId);
  if (normTenant && normTenant !== '*') {
    try {
      const scopedStmts = customerIds.map((id) =>
        db.prepare("UPDATE customers SET last_expiry_warning_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(now, id, normTenant)
      );
      await db.batch(scopedStmts);
      return customerIds.length;
    } catch {
      if (normTenant !== 'default') {
        return 0;
      }
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
