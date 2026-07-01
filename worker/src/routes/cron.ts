/**
 * Cron Routes — Scheduled task handlers
 * Converted from routes/cron.js with TypeScript.
 * Business logic preserved.
 */

import { createLogger } from '../middleware/logger';
import { createMetricsCollector } from '../lib/metrics-collector';
import { handleMauticBridgeRequest } from './mautic-bridge';

const SLA_MINUTES_DEFAULT = 15;
const log = createLogger({ route: 'cron' });

export async function processErpnextRetryQueue(env: Record<string, unknown>): Promise<{ processed: number; succeeded: number; failed: number }> {
  log.info('ERPNext not configured, skipping retry queue');
  return { processed: 0, succeeded: 0, failed: 0 };
}

export async function processErpnextProductSync(env: Record<string, unknown>): Promise<{ synced: number; errors: number }> {
  log.info('ERPNext not configured, skipping product sync');
  return { synced: 0, errors: 0 };
}

// Re-export from mautic-bridge (converted to TS)
export { syncMauticContacts, detectWinbackCandidates, detectBirthdayCandidates } from './mautic-bridge';

export async function checkOverdueOrders(env: Record<string, unknown>): Promise<void> {
  const slaMinutes = Number.isFinite(Number(env.SLA_THRESHOLD_MINUTES)) && Number(env.SLA_THRESHOLD_MINUTES) > 0
    ? Number(env.SLA_THRESHOLD_MINUTES)
    : SLA_MINUTES_DEFAULT;

  log.info('Checking overdue orders (SLA threshold:', { minutes: slaMinutes });

  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const cutoff = new Date(Date.now() - slaMinutes * 60 * 1000).toISOString();

    const { results: overdue } = await db.prepare(`
      SELECT id, customer_name, status, created_at
      FROM orders
      WHERE status IN ('Bep tiep nhan', 'Dang pha che')
        AND created_at < ?
    `).bind(cutoff).all<Record<string, unknown>>();

    if (!overdue.length) {
      log.info('No overdue orders found.');
      return;
    }

    log.info('Found overdue orders', { count: overdue.length });

    // Metrics: record order_stuck count
    const mc = createMetricsCollector(db);
    await mc.recordMetric('order_stuck', overdue.length).catch(() => {});

    const now = new Date().toISOString();
    const stmts = overdue.map(order =>
      db.prepare('UPDATE orders SET notes = CASE WHEN notes IS NULL OR notes = \'\' THEN ? ELSE notes || \' | \' || ? END, updated_at = ? WHERE id = ?')
        .bind('[OVERDUE]', '[OVERDUE]', now, order.id)
    );
    await db.batch(stmts);
  } catch (err) {
    log.error('checkOverdueOrders error:', { message: (err as Error).message });
  }
}

export async function sendCashbackExpiryWarnings(env: Record<string, unknown>) {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
    const now = new Date().toISOString();

    const { results: expiring } = await db.prepare(`
      SELECT ct.customer_id, c.phone, c.name, c.zalo, SUM(ct.amount) as total_expiring
      FROM cashback_transactions ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.type IN ('earn', 'bonus')
        AND ct.expires_at IS NOT NULL
        AND ct.expires_at <= ?
        AND ct.expires_at > datetime('now')
        AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
      GROUP BY ct.customer_id
    `).bind(sevenDaysFromNow, now).all<Record<string, unknown>>();

    for (const row of expiring) {
      const { notifyMember } = await import('./zalo.js');
      notifyMember(env, {
        customer_id: row.customer_id as string,
        template_key: 'cashback_expiring',
        data: { amount: row.total_expiring as number, days_left: 7, name: row.name as string } as Record<string, unknown>,
      }).catch(() => {});

      await db.prepare('UPDATE customers SET last_expiry_warning_at = ? WHERE id = ?').bind(now, row.customer_id).run();
    }

    return { notified: expiring.length };
  } catch (err) {
    log.error('sendCashbackExpiryWarnings error:', { message: (err as Error).message });
    return { notified: 0 };
  }
}
