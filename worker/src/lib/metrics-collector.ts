/**
 * Metrics Collector — lightweight, non-blocking D1 metrics recorder.
 * All writes use ctx.waitUntil() for zero request-latency impact.
 * Null-DB guard prevents crashes in local dev without D1 binding.
 *
 * Usage:
 *   const mc = createMetricsCollector(c.env.AURA_DB);
 *   c.executionCtx.waitUntil(mc.recordMetric('order_created', 1, { payment_method: 'cod' }));
 */
import type { D1Database } from '@cloudflare/workers-types';

export interface MetricTags { [key: string]: string | number | boolean; }

export interface AlertOptions {
  severity?: 'info' | 'warning' | 'critical';
  cooldownMinutes?: number;
}

export function createMetricsCollector(db: D1Database | null) {
  async function recordMetric(name: string, value: number = 1, tags: MetricTags = {}): Promise<void> {
    if (!db) return;
    try {
      await db.prepare(
        'INSERT INTO _metrics (name, value, tags, created_at) VALUES (?, ?, ?, ?)'
      ).bind(name, value, JSON.stringify(tags), new Date().toISOString()).run();
    } catch { /* silently drop — metrics must never crash the request */ }
  }

  /**
   * Record an alert event with cooldown deduplication.
   * Returns alert row ID if queued (should be dispatched), or null if in cooldown.
   * Caller must call markAlertDispatched(id) after successful dispatch.
   */
  async function recordAlert(key: string, message: string, opts: AlertOptions = {}): Promise<number | null> {
    if (!db) return null;
    const { severity = 'warning', cooldownMinutes = 30 } = opts;
    const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();

    try {
      const recent = await db.prepare(
        "SELECT id FROM _alerts WHERE alert_key = ? AND created_at > ? AND dispatched = 1"
      ).bind(key, cutoff).first<{ id: number }>();
      if (recent) return null; // still in cooldown

      const result = await db.prepare(
        'INSERT INTO _alerts (alert_key, message, severity, dispatched, created_at) VALUES (?, ?, ?, 0, ?)'
      ).bind(key, message, severity, new Date().toISOString()).run();
      return result.meta?.last_row_id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Mark an alert as successfully dispatched. Enables cooldown for subsequent checks.
   */
  async function markAlertDispatched(alertId: number): Promise<void> {
    if (!db) return;
    try {
      await db.prepare(
        'UPDATE _alerts SET dispatched = 1 WHERE id = ?'
      ).bind(alertId).run();
    } catch { /* silently drop */ }
  }

  /**
   * Purge metrics older than retention period. Called by cron.
   * Returns number of rows deleted.
   */
  async function pruneOldMetrics(daysRetention: number = 30): Promise<number> {
    if (!db) return 0;
    try {
      const cutoff = new Date(Date.now() - daysRetention * 86400000).toISOString();
      const result = await db.prepare(
        'DELETE FROM _metrics WHERE created_at < ?'
      ).bind(cutoff).run();
      return result.meta?.changes ?? 0;
    } catch {
      return 0;
    }
  }

  return { recordMetric, recordAlert, pruneOldMetrics, markAlertDispatched };
}
