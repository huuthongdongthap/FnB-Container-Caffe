import { createLogger } from '../../middleware/logger';
import { createMetricsCollector } from '../../lib/metrics-collector';

const SLA_MINUTES_DEFAULT = 15;
const log = createLogger({ route: 'cron' });

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

    // Metrics: record order_stuck count + raise a Telegram-dispatchable alert.
    // The alert pipeline (cron-admin dispatchAlerts) delivers via Telegram when
    // TELEGRAM_BOT_TOKEN/CHAT_ID are configured; cooldown prevents repeat noise
    // for the same ongoing breach.
    const mc = createMetricsCollector(db);
    await mc.recordMetric('order_stuck', overdue.length).catch(() => {});
    await mc.recordAlert(
      'kds_sla_breach',
      `${overdue.length} đơn vượt SLA ${slaMinutes} phút — kiểm tra KDS`,
      { severity: 'warning', cooldownMinutes: 30 }
    ).catch(() => {});

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
