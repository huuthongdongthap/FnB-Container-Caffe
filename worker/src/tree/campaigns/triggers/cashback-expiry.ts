/**
 * Cashback Expiry Trigger — detect expiring cashback and warn customers
 * Refactored from routes/cron.ts:sendCashbackExpiryWarnings
 * Sends warning 7 days before cashback expires
 */
import { createLogger } from '../../../utils/logger';
import { matchesTenantRow } from '../../../middleware/tenant';
import type { CampaignCustomer } from '../types';

const log = createLogger({ route: 'trigger-cashback-expiry' });

interface ExpiringRow {
  customer_id: string;
  phone: string | null;
  name: string | null;
  zalo: string | null;
  total_expiring: number;
  wallet_balance?: number | null;
  tenant_id?: string | null;
}

export async function detectCashbackExpiry(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId?: string
): Promise<CampaignCustomer[]> {
  try {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const scoped = Boolean(tenantId && tenantId !== '*');

    let results: ExpiringRow[] = [];
    if (scoped && tenantId) {
      let scopedSucceeded = false;
      try {
        const scopedRes = await db.prepare(`
          SELECT cw.customer_id as customer_id, c.phone, c.name, c.zalo, SUM(ct.amount) as total_expiring, cw.balance as wallet_balance, c.tenant_id as tenant_id
          FROM cashback_transactions ct
          JOIN cashback_wallets cw ON cw.id = ct.wallet_id
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
        results = scopedRes.results || [];
        scopedSucceeded = true;
      } catch {
        try {
          const scopedFallback = await db.prepare(`
            SELECT cw.customer_id as customer_id, c.phone, c.name, NULL as zalo, SUM(ct.amount) as total_expiring, c.tenant_id as tenant_id
            FROM cashback_transactions ct
            JOIN cashback_wallets cw ON cw.id = ct.wallet_id
            JOIN customers c ON cw.customer_id = c.id
            WHERE ct.type IN ('earn', 'bonus')
              AND ct.expires_at IS NOT NULL
              AND ct.expires_at <= ?
              AND ct.expires_at > datetime('now')
              AND COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?
              AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
            GROUP BY cw.customer_id
          `).bind(sevenDaysFromNow, tenantId, tenantId).all<ExpiringRow>();
          results = scopedFallback.results || [];
          scopedSucceeded = true;
        } catch {
          // Fall through to default queries if tenant_id column is absent
        }
      }
      if (scopedSucceeded) {
        const filtered = results.filter(
          (row) => !('tenant_id' in row) || matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)
        );
        const customers: CampaignCustomer[] = filtered
          .map(row => {
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
          .filter(c => (c.total_spent ?? 0) > 0);
        log.info('cashback_expiry_candidates', { count: customers.length, tenantId });
        return customers;
      }
    }

    try {
      const res = await db.prepare(`
        SELECT cw.customer_id as customer_id, c.phone, c.name, c.zalo, SUM(ct.amount) as total_expiring
        FROM cashback_transactions ct
        JOIN cashback_wallets cw ON cw.id = ct.wallet_id
        JOIN customers c ON cw.customer_id = c.id
        WHERE ct.type IN ('earn', 'bonus')
          AND ct.expires_at IS NOT NULL
          AND ct.expires_at <= ?
          AND ct.expires_at > datetime('now')
          AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
        GROUP BY cw.customer_id
      `).bind(sevenDaysFromNow, sevenDaysAgo).all<ExpiringRow>();
      results = res.results || [];
    } catch {
      try {
        const fallback = await db.prepare(`
          SELECT ct.customer_id, c.phone, c.name, c.zalo, SUM(ct.amount) as total_expiring
          FROM cashback_transactions ct
          JOIN customers c ON ct.customer_id = c.id
          WHERE ct.type IN ('earn', 'bonus')
            AND ct.expires_at IS NOT NULL
            AND ct.expires_at <= ?
            AND ct.expires_at > datetime('now')
            AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
          GROUP BY ct.customer_id
        `).bind(sevenDaysFromNow, sevenDaysAgo).all<ExpiringRow>();
        results = fallback.results || [];
      } catch {
        const canonical = await db.prepare(`
          SELECT cw.customer_id as customer_id, c.phone, c.name, NULL as zalo, SUM(ct.amount) as total_expiring
          FROM cashback_transactions ct
          JOIN cashback_wallets cw ON cw.id = ct.wallet_id
          JOIN customers c ON cw.customer_id = c.id
          WHERE ct.type IN ('earn', 'bonus')
            AND ct.expires_at IS NOT NULL
            AND ct.expires_at <= ?
            AND ct.expires_at > datetime('now')
          GROUP BY cw.customer_id
        `).bind(sevenDaysFromNow).all<ExpiringRow>();
        results = canonical.results || [];
      }
    }

    const filtered = scoped && tenantId
      ? results.filter((row) => !('tenant_id' in row) || matchesTenantRow(row as unknown as Record<string, unknown>, tenantId))
      : results;

    const customers: CampaignCustomer[] = filtered.map(row => ({
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
  customerIds: string[],
  tenantId?: string
): Promise<number> {
  if (!customerIds.length) {
    return 0;
  }

  try {
    const now = new Date().toISOString();
    if (tenantId && tenantId !== '*') {
      try {
        const scopedStmts = customerIds.map(id =>
          db.prepare("UPDATE customers SET last_expiry_warning_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(now, id, tenantId)
        );
        await db.batch(scopedStmts);
        return customerIds.length;
      } catch {
        // Fall through if tenant_id column is absent
      }
    }
    const stmts = customerIds.map(id =>
      db.prepare('UPDATE customers SET last_expiry_warning_at = ? WHERE id = ?').bind(now, id)
    );
    await db.batch(stmts);
    return customerIds.length;
  } catch (err) {
    const msg = String((err as Error)?.message || '');
    if (msg.includes('column')) {
      return customerIds.length;
    }
    log.error('markExpiryNotified error', { error: (err as Error).message });
    return 0;
  }
}
