/**
 * Alert Dispatcher — threshold-based alerting with cooldown deduplication.
 * Runs in cron context (not request path). Queries D1 _metrics for threshold
 * breaches, deduplicates via _alerts cooldown, dispatches to Telegram.
 *
 * Usage:
 *   const ad = createAlertDispatcher(c.env.AURA_DB);
 *   const fired = await ad.dispatchAlerts(async (msg, severity) => {
 *     await sendTelegram(msg);
 *   });
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createMetricsCollector } from './metrics-collector';

interface AlertConfig {
  key: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  cooldownMinutes: number;
  threshold: number;
  query: string;
}

const ALERT_DEFINITIONS: AlertConfig[] = [
  {
    key: 'revenue:5xx_spike',
    description: '🚨 5xx errors exceed threshold (5/min)',
    severity: 'critical',
    cooldownMinutes: 5,
    threshold: 5,
    query: "SELECT COUNT(*) as value FROM _metrics WHERE name = 'request' AND CAST(json_extract(tags, '$.status') AS INTEGER) >= 500 AND created_at >= datetime('now', '-5 minutes')",
  },
  {
    key: 'revenue:payment_failure_rate',
    description: '⚠️ Payment failure rate exceeds 10%',
    severity: 'critical',
    cooldownMinutes: 5,
    threshold: 10,
    query: `SELECT CASE WHEN (s + f) = 0 THEN 0 ELSE CAST(f AS REAL) * 100.0 / (s + f) END as value FROM (
      SELECT
        COALESCE((SELECT COUNT(*) FROM _metrics WHERE name = 'payment_success' AND created_at >= datetime('now', '-30 minutes')), 0) as s,
        COALESCE((SELECT COUNT(*) FROM _metrics WHERE name = 'payment_failed' AND created_at >= datetime('now', '-30 minutes')), 0) as f
    )`,
  },
  {
    key: 'infra:d1_latency_high',
    description: '🐢 D1 query latency exceeds 500ms',
    severity: 'warning',
    cooldownMinutes: 15,
    threshold: 500,
    query: "SELECT COALESCE(MAX(CAST(json_extract(tags, '$.duration') AS REAL)), 0) as value FROM _metrics WHERE name = 'request' AND created_at >= datetime('now', '-5 minutes')",
  },
  {
    key: 'security:failed_login_spike',
    description: '🔐 Failed login attempts exceed 10/min',
    severity: 'warning',
    cooldownMinutes: 10,
    threshold: 10,
    query: "SELECT COUNT(*) as value FROM _metrics WHERE name = 'login_failed' AND created_at >= datetime('now', '-1 minutes')",
  },
  {
    key: 'revenue:order_stuck',
    description: '📦 Orders stuck in pending >10 min',
    severity: 'critical',
    cooldownMinutes: 5,
    threshold: 1,
    query: "SELECT COUNT(*) as value FROM _metrics WHERE name = 'order_stuck' AND created_at >= datetime('now', '-10 minutes')",
  },
];

export function createAlertDispatcher(db: D1Database | null) {
  const metrics = createMetricsCollector(db);

  async function dispatchAlerts(
    sendTelegram: (msg: string, severity: string) => Promise<void>
  ): Promise<string[]> {
    if (!db) return [];
    const fired: string[] = [];

    for (const alert of ALERT_DEFINITIONS) {
      try {
        const row = await db.prepare(alert.query).first<{ value: number }>();
        const value = row?.value ?? 0;

        if (value >= alert.threshold) {
          const alertId = await metrics.recordAlert(
            alert.key,
            `${alert.description}\nValue: ${value} (threshold: ${alert.threshold})`,
            { severity: alert.severity, cooldownMinutes: alert.cooldownMinutes }
          );
          if (alertId !== null) {
            await sendTelegram(
              `${alert.description}\n📊 Current: ${value} / Threshold: ${alert.threshold}`,
              alert.severity
            );
            await metrics.markAlertDispatched(alertId);
            fired.push(alert.key);
          }
        }
      } catch {
        // Alert check failure must not crash the dispatcher
      }
    }

    return fired;
  }

  async function dispatchDigest(
    sendTelegram: (msg: string) => Promise<void>
  ): Promise<void> {
    if (!db) return;

    const since = "datetime('now', '-24 hours')";

    const [orders, revenue, errors, totalReqs] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as c FROM _metrics WHERE name = 'order_created' AND created_at >= ${since}`).first<{ c: number }>(),
      db.prepare(`SELECT COALESCE(SUM(value), 0) as s FROM _metrics WHERE name = 'revenue' AND created_at >= ${since}`).first<{ s: number }>(),
      db.prepare(`SELECT COUNT(*) as c FROM _metrics WHERE name = 'request' AND CAST(json_extract(tags, '$.status') AS INTEGER) >= 400 AND created_at >= ${since}`).first<{ c: number }>(),
      db.prepare(`SELECT COUNT(*) as c FROM _metrics WHERE name = 'request' AND created_at >= ${since}`).first<{ c: number }>(),
    ]);

    const orderCount = orders?.c ?? 0;
    const revenueTotal = revenue?.s ?? 0;
    const errorCount = errors?.c ?? 0;
    const totalCount = totalReqs?.c ?? 1;

    const msg = [
      '📊 *AURA CAFE Daily Digest*',
      `📅 ${new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
      '',
      `🛒 Orders: ${orderCount}`,
      `💰 Revenue: ${new Intl.NumberFormat('vi-VN').format(revenueTotal)} VND`,
      `✅ Success Rate: ${((1 - errorCount / totalCount) * 100).toFixed(1)}%`,
      `❌ Errors: ${errorCount}`,
      '',
      '_— AURA CAFE Observability_',
    ].join('\n');

    await sendTelegram(msg);
  }

  return { dispatchAlerts, dispatchDigest };
}
