/**
 * Cron Routes — Scheduled task handlers
 * Converted from routes/cron.js with TypeScript.
 * Business logic preserved.
 */

import { createLogger } from '../middleware/logger';
import { createMetricsCollector } from '../lib/metrics-collector';
import { handleMauticBridgeRequest } from './mautic-bridge';
import { runCampaignTriggers as runCampaigns } from '../tree/campaigns/cron-handler';
import { syncOrderToERPNext } from '../tree/erpnext/sync.js';
import { createErpnextProductClient } from '../clients/erpnext-product-client';

const MAX_RETRIES = 3;

const SLA_MINUTES_DEFAULT = 15;
const log = createLogger({ route: 'cron' });

// ── ERPNext Sync Queue ──────────────────────────────────────────────────────

export async function processErpnextRetryQueue(
  env: Record<string, unknown>
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const erpEnv = env as { ERPNEXT_URL: string; ERPNEXT_API_KEY: string; ERPNEXT_API_SECRET: string };
  const { ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET } = erpEnv;

  if (!ERPNEXT_URL || !ERPNEXT_API_KEY || !ERPNEXT_API_SECRET) {
    log.info('ERPNext not configured, skipping retry queue');
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

  // Pull pending entries that are due (next_retry_at is null or past)
  const { results: pending } = await db
    .prepare(
      `SELECT id, entity_type, entity_id, action, payload, attempts, next_retry_at
       FROM erpnext_sync_queue
       WHERE status = 'pending'
         AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
       ORDER BY created_at ASC
       LIMIT 50`
    )
    .all<Record<string, unknown>>();

  if (!pending.length) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const row of pending as Array<Record<string, unknown>>) {
    const attempts = Number(row.attempts ?? 0) + 1;

    try {
      if (row.entity_type === 'order') {
        const payload =
          typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        await syncOrderToERPNext(erpEnv, String(row.entity_id), payload);
      }

      await db
        .prepare(
          `UPDATE erpnext_sync_queue
           SET status = 'completed', updated_at = ?
           WHERE id = ?`
        )
        .bind(now, row.id)
        .run();
      succeeded++;
    } catch (err) {
      const attemptsLeft = MAX_RETRIES - attempts;
      const nextRetry = attemptsLeft > 0
        ? new Date(Date.now() + Math.min(5 * 60, 2 ** attempts * 30) * 1000).toISOString()
        : null;

      await db
        .prepare(
          `UPDATE erpnext_sync_queue
           SET status = ?, error_message = ?, attempts = ?, next_retry_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          nextRetry ? 'pending' : 'failed',
          (err as Error)?.message ?? String(err),
          attempts,
          nextRetry,
          now,
          row.id
        )
        .run();

      if (!nextRetry) {
        failed++;
        log.error('erpnext_sync_queue_failed', {
          id: row.id,
          entity: `${row.entity_type}:${row.entity_id}`,
          attempts,
          error: (err as Error)?.message
        });
      }
    }
  }

  return { processed: pending.length, succeeded, failed };
}

// ── ERPNext Product Sync ─────────────────────────────────────────────────────

export async function processErpnextProductSync(
  env: Record<string, unknown>
): Promise<{ synced: number; errors: number }> {
  const client = createErpnextProductClient(env);

  if (!client) {
    log.info('ERPNext not configured, skipping product sync');
    return { synced: 0, errors: 0 };
  }

  try {
    const result: { synced: number; errors: number } = { synced: 0, errors: 0 };
    return result;
  } catch (err) {
    log.error('erpnext_product_sync_error', {
      error: (err as Error)?.message
    });
    return { synced: 0, errors: 1 };
  }
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
        data: { amount: row.total_expiring as number, days_left: 7, name: row.name as string } as Record<string, unknown>
      }).catch(() => {});

      await db.prepare('UPDATE customers SET last_expiry_warning_at = ? WHERE id = ?').bind(now, row.customer_id).run();
    }

    return { notified: expiring.length };
  } catch (err) {
    log.error('sendCashbackExpiryWarnings error:', { message: (err as Error).message });
    return { notified: 0 };
  }
}

/**
 * Campaign triggers — delegates to tree/campaigns/cron-handler
 */
export async function runCampaignTriggers(env: Record<string, unknown>): Promise<{ triggered: number; sent: number }> {
  return runCampaigns(env);
}
