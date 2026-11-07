import { createLogger } from '../../middleware/logger';
import { resolvePilotStore, matchesTenantRow } from '../../middleware/tenant';

const log = createLogger({ route: 'cron' });

export async function sendCashbackExpiryWarnings(env: Record<string, unknown>, tenantOverride?: string): Promise<{ notified: number }> {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const rawOverride = typeof tenantOverride === 'string' ? tenantOverride.trim() : '';
    const normalizedOverride = rawOverride.toLowerCase() === 'hq' ? '*' : rawOverride;
    const rawTenant = normalizedOverride || resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
    const tenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const now = new Date().toISOString();
    const scoped = Boolean(tenantId && tenantId !== '*');

    let expiring: Array<Record<string, unknown>> = [];
    if (scoped && tenantId) {
      let scopedSucceeded = false;
      try {
        const res = await db.prepare(`
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
        `).bind(sevenDaysFromNow, tenantId, tenantId, sevenDaysAgo).all<Record<string, unknown>>();
        expiring = res.results || [];
        scopedSucceeded = true;
      } catch {
        try {
          const canonicalScoped = await db.prepare(`
            SELECT cw.customer_id as customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring, cw.balance as wallet_balance, c.tenant_id as tenant_id
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
          `).bind(sevenDaysFromNow, tenantId, tenantId, sevenDaysAgo).all<Record<string, unknown>>();
          expiring = canonicalScoped.results || [];
          scopedSucceeded = true;
        } catch {
          try {
            const canonicalScoped = await db.prepare(`
              SELECT cw.customer_id as customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring, cw.balance as wallet_balance, c.tenant_id as tenant_id
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
            `).bind(sevenDaysFromNow, tenantId, tenantId).all<Record<string, unknown>>();
            expiring = canonicalScoped.results || [];
            scopedSucceeded = true;
          } catch {
            // Fall through if tenant_id column is absent
          }
        }
      }
      if (!scopedSucceeded) {
        if (tenantId === 'default') {
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
            `).bind(sevenDaysFromNow, sevenDaysAgo).all<Record<string, unknown>>();
            expiring = res.results || [];
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
              `).bind(sevenDaysFromNow, sevenDaysAgo).all<Record<string, unknown>>();
              expiring = fallback.results || [];
            } catch {
              const canonicalFallback = await db.prepare(`
                SELECT cw.customer_id as customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring
                FROM cashback_transactions ct
                JOIN cashback_wallets cw ON cw.id = ct.wallet_id
                JOIN customers c ON cw.customer_id = c.id
                WHERE ct.type IN ('earn', 'bonus')
                  AND ct.expires_at IS NOT NULL
                  AND ct.expires_at <= ?
                  AND ct.expires_at > datetime('now')
                GROUP BY cw.customer_id
              `).bind(sevenDaysFromNow).all<Record<string, unknown>>().catch(() => ({ results: [] }));
              expiring = canonicalFallback.results || [];
            }
          }
        } else {
          expiring = [];
        }
      } else {
        expiring = expiring.map((row) =>
          !('tenant_id' in row) && 'earliest_expiry' in row ? { ...row, tenant_id: tenantId } : row
        );
      }
      expiring = expiring.filter((row) => matchesTenantRow(row, tenantId));
    } else {
      try {
        const res = await db.prepare(`
          SELECT cw.customer_id as customer_id, c.phone, c.name, c.zalo, SUM(ct.amount) as total_expiring, cw.balance as wallet_balance, c.tenant_id as tenant_id
          FROM cashback_transactions ct
          JOIN cashback_wallets cw ON cw.id = ct.wallet_id
          JOIN customers c ON cw.customer_id = c.id
          WHERE ct.type IN ('earn', 'bonus')
            AND ct.expires_at IS NOT NULL
            AND ct.expires_at <= ?
            AND ct.expires_at > datetime('now')
            AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
          GROUP BY cw.customer_id
        `).bind(sevenDaysFromNow, sevenDaysAgo).all<Record<string, unknown>>();
        expiring = res.results || [];
      } catch {
        try {
          const withWalletAndTenant = await db.prepare(`
            SELECT cw.customer_id as customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring, cw.balance as wallet_balance, c.tenant_id as tenant_id
            FROM cashback_transactions ct
            JOIN cashback_wallets cw ON cw.id = ct.wallet_id
            JOIN customers c ON cw.customer_id = c.id
            WHERE ct.type IN ('earn', 'bonus')
              AND ct.expires_at IS NOT NULL
              AND ct.expires_at <= ?
              AND ct.expires_at > datetime('now')
            GROUP BY cw.customer_id
          `).bind(sevenDaysFromNow).all<Record<string, unknown>>();
          expiring = withWalletAndTenant.results || [];
        } catch {
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
            `).bind(sevenDaysFromNow, sevenDaysAgo).all<Record<string, unknown>>();
            expiring = res.results || [];
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
              `).bind(sevenDaysFromNow, sevenDaysAgo).all<Record<string, unknown>>();
              expiring = fallback.results || [];
            } catch {
              const canonicalFallback = await db.prepare(`
                SELECT cw.customer_id as customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring
                FROM cashback_transactions ct
                JOIN cashback_wallets cw ON cw.id = ct.wallet_id
                JOIN customers c ON cw.customer_id = c.id
                WHERE ct.type IN ('earn', 'bonus')
                  AND ct.expires_at IS NOT NULL
                  AND ct.expires_at <= ?
                  AND ct.expires_at > datetime('now')
                GROUP BY cw.customer_id
              `).bind(sevenDaysFromNow).all<Record<string, unknown>>();
              expiring = canonicalFallback.results || [];
            }
          }
        }
      }
    }

    let notifiedCount = 0;
    for (const row of expiring) {
      const rawExpiring = Number(row.total_expiring ?? 0);
      const amount = row.wallet_balance != null
        ? Math.max(0, Math.min(rawExpiring, Number(row.wallet_balance)))
        : rawExpiring;
      if (amount <= 0) continue;
      notifiedCount++;
      const rawRowTenant = typeof row.tenant_id === 'string' ? row.tenant_id.trim() : '';
      const rowTenant = rawRowTenant && rawRowTenant !== '*' && rawRowTenant.toLowerCase() !== 'hq'
        ? rawRowTenant
        : (tenantId && tenantId !== '*' ? tenantId : 'default');
      const { notifyMember } = await import('../zalo.js');
      await notifyMember(env, {
        customer_id: row.customer_id as string,
        template_key: 'cashback_expiring',
        data: { amount, days_left: 7, name: row.name as string } as Record<string, unknown>
      }, rowTenant).catch(() => {});

      try {
        await db.prepare("UPDATE customers SET last_expiry_warning_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(now, row.customer_id, rowTenant).run()
          .catch(() => {
            if (rowTenant === 'default') {
              return db.prepare('UPDATE customers SET last_expiry_warning_at = ? WHERE id = ?').bind(now, row.customer_id).run();
            }
          });
      } catch {
        // last_expiry_warning_at optional in canonical D1 customers schema
      }
    }

    return { notified: notifiedCount };
  } catch (err) {
    log.error('sendCashbackExpiryWarnings error:', { message: (err as Error).message });
    return { notified: 0 };
  }
}
