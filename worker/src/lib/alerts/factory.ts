/**
 * Legacy AlertDispatcher factory for backward compatibility.
 * Provides threshold checking, cooldown dedup, and custom sender callbacks.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createMetricsCollector } from '../metrics-collector';
import { ALERT_THRESHOLDS } from './types';
import { formatThresholdAlert } from './formatters';
import { dispatchDigestViaCallback } from './digest';

/**
 * Tạo đối tượng AlertDispatcher tương thích ngược.
 * Các phương thức delegate xuống các standalone functions,
 * nhưng nhận sendTelegram callback từ caller thay vì env.
 *
 * Create a backward-compatible AlertDispatcher object.
 * Methods delegate to standalone functions but accept
 * a sendTelegram callback from the caller instead of env.
 *
 * @param db - D1 database binding (c.env.AURA_DB)
 * @returns AlertDispatcher với dispatchAlerts và dispatchDigest
 *
 * @example
 *   const ad = createAlertDispatcher(c.env.AURA_DB);
 *   const fired = await ad.dispatchAlerts(async (msg) => { ... });
 */
export function createAlertDispatcher(db: D1Database | null) {
  const metrics = createMetricsCollector(db);

  async function dispatchAlertsInner(
    // eslint-disable-next-line no-unused-vars
    sendTelegram: (msg: string, severity: string) => Promise<void>,
    locale: 'vi' | 'en' = 'vi'
  ): Promise<string[]> {
    if (!db) {
      return [];
    }
    const fired: string[] = [];

    for (const alert of ALERT_THRESHOLDS) {
      // Threshold-based alerting queries _metrics and uses
      // recordAlert/markAlertDispatched for cooldown dedup.
      try {
        let query = '';
        let thresholdValue = 0;

        switch (alert.key) {
        case 'order_stuck':
          query =
              'SELECT COUNT(*) as value FROM _metrics WHERE name = \'order_stuck\' AND created_at >= datetime(\'now\', \'-15 minutes\')';
          thresholdValue = 1;
          break;
        case 'payment_failure':
          query =
              'SELECT COUNT(*) as value FROM _metrics WHERE name = \'payment_failed\' AND created_at >= datetime(\'now\', \'-30 minutes\')';
          thresholdValue = 1;
          break;
        case 'worker_5xx_rate': {
          query = `SELECT CASE WHEN total = 0 THEN 0 ELSE CAST(err AS REAL) * 100.0 / total END as value FROM (
              SELECT
                COALESCE((SELECT COUNT(*) FROM _metrics WHERE name = 'request' AND CAST(json_extract(tags, '$.status') AS INTEGER) >= 500 AND created_at >= datetime('now', '-5 minutes')), 0) as err,
                COALESCE((SELECT COUNT(*) FROM _metrics WHERE name = 'request' AND created_at >= datetime('now', '-5 minutes')), 0) as total
            )`;
          thresholdValue = 5;
          break;
        }
        case 'd1_latency_high':
          query =
              'SELECT COALESCE(MAX(CAST(json_extract(tags, \'$.duration\') AS REAL)), 0) as value FROM _metrics WHERE name = \'request\' AND created_at >= datetime(\'now\', \'-5 minutes\')';
          thresholdValue = 500;
          break;
        case 'failed_login_spike':
          query =
              'SELECT COUNT(*) as value FROM _metrics WHERE name = \'login_failed\' AND created_at >= datetime(\'now\', \'-1 minutes\')';
          thresholdValue = 10;
          break;
        case 'order_volume_anomaly':
          query =
              'SELECT COUNT(*) as value FROM _metrics WHERE name = \'order_created\' AND created_at >= datetime(\'now\', \'-5 minutes\')';
          thresholdValue =
              3; // placeholder — real anomaly detection compares to hourly avg
          break;
        default:
          continue;
        }

        const row = await db
          .prepare(query)
          .first<{ value: number }>();
        const value = row?.value ?? 0;

        if (value >= thresholdValue) {
          const alertId = await metrics.recordAlert(
            alert.key,
            `${alert.description}\nValue: ${value} (threshold: ${thresholdValue})`,
            {
              severity: alert.severity,
              cooldownMinutes: 5
            }
          );
          if (alertId !== null) {
            await sendTelegram(
              formatThresholdAlert(alert.description, value, thresholdValue, locale),
              alert.severity
            );
            await metrics.markAlertDispatched(alertId);
            fired.push(alert.key);
          }
        }
      } catch {
        // Lỗi kiểm tra alert không được làm crash dispatcher
        // Alert check failure must not crash the dispatcher
      }
    }

    return fired;
  }

  async function dispatchDigestInner(
    // eslint-disable-next-line no-unused-vars
    sendTelegram: (msg: string) => Promise<void>,
    locale: 'vi' | 'en' = 'vi'
  ): Promise<void> {
    return dispatchDigestViaCallback(db, sendTelegram, locale);
  }

  return { dispatchAlerts: dispatchAlertsInner, dispatchDigest: dispatchDigestInner };
}
