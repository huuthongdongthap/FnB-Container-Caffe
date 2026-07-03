/**
 * Metrics Collector — ghi metric không đồng bộ (fire-and-forget) vào D1.
 * Tất cả các ghi đều là "fire-and-forget" để không ảnh hưởng tới latency request.
 * Các lỗi được log qua console.error, không bao giờ throw.
 *
 * Metrics Collector — lightweight, non-blocking D1 metrics recorder.
 * All writes are fire-and-forget with zero request-latency impact.
 * Errors are silently logged via console.error, never thrown.
 *
 * Usage:
 *   import { recordMetric, pruneOldMetrics, getMetricSummary } from '../lib/metrics-collector';
 *   recordMetric(c.env.AURA_DB, 'order_created', 1, { payment: 'cod' });
 *   const summary = await getMetricSummary(c.env.AURA_DB, 'request', '24h');
 *   const { deleted } = await pruneOldMetrics(c.env.AURA_DB, 30);
 */

import type { D1Database } from '@cloudflare/workers-types';

// ─── Type Exports ──────────────────────────────────────────────────────────

/**
 * MetricSummary — tổng hợp thống kê cho một metric trong khoảng thời gian.
 * Aggregated statistics for a metric over a time range.
 */
export interface MetricSummary {
  /** Tên metric / Metric name */
  name: string;
  /** Giá trị trung bình / Average value */
  avg: number;
  /** Giá trị lớn nhất / Maximum value */
  max: number;
  /** Giá trị nhỏ nhất / Minimum value */
  min: number;
  /** Số lượng bản ghi / Record count */
  count: number;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Ánh xạ chuỗi range sang số giờ tương ứng.
 * Map range string to number of hours.
 */
const RANGE_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 168,
  '30d': 720,
};

/**
 * Kiểm tra và lấy số giờ từ range string, mặc định 24h.
 * Validate and resolve range string to hours, default 24h.
 */
function resolveRangeHours(range: string): number {
  return RANGE_HOURS[range] ?? 24;
}

// ─── recordMetric ──────────────────────────────────────────────────────────

/**
 * Ghi một metric vào bảng _metrics theo cơ chế fire-and-forget.
 * Hàm không await — D1 write chạy nền, lỗi được log qua console.error.
 * Sử dụng datetime('now') của SQLite làm timestamp.
 *
 * Record a metric into the _metrics table via fire-and-forget.
 * Function does not await — the D1 write runs in background, errors go to console.error.
 * Uses SQLite datetime('now') as the timestamp.
 *
 * @param db        - D1 database binding (ví dụ: c.env.AURA_DB / e.g. c.env.AURA_DB)
 * @param name      - Tên metric / Metric name
 * @param value     - Giá trị số / Numeric value (mặc định/default 1)
 * @param tags      - Tags dạng string key-value (mặc định/default {})
 *
 * @returns void — fire-and-forget, không await / void — fire-and-forget, do not await
 *
 * @example
 *   // Trong route handler / Inside a route handler
 *   recordMetric(c.env.AURA_DB, 'order_created', order.total, { payment: 'cod' });
 *
 *   // Với ctx.waitUntil (giữ worker sống đến khi ghi xong)
 *   // With ctx.waitUntil (keeps worker alive until write completes)
 *   c.executionCtx.waitUntil(
 *     new Promise<void>((resolve) => {
 *       recordMetric(c.env.AURA_DB, 'request', 1, { method: 'GET' });
 *       resolve();
 *     })
 *   );
 */
export function recordMetric(
  db: D1Database,
  name: string,
  value: number = 1,
  tags?: Record<string, string>,
): void {
  db.prepare(
    "INSERT INTO _metrics (name, value, tags, created_at) VALUES (?, ?, ?, datetime('now'))"
  )
    .bind(name, value, JSON.stringify(tags ?? {}))
    .run()
    .catch((err: unknown) => {
      console.error(
        '[metrics-collector] recordMetric failed:',
        err instanceof Error ? err.message : String(err),
      );
    });
}

// ─── pruneOldMetrics ───────────────────────────────────────────────────────

/**
 * Xoá các metric cũ hơn số ngày lưu giữ (retentionDays).
 * Thường được gọi từ cron job để dọn dẹp bảng _metrics.
 *
 * Delete metrics older than the given retention period.
 * Typically called from a cron job to clean up the _metrics table.
 *
 * @param db            - D1 database binding (ví dụ: c.env.AURA_DB / e.g. c.env.AURA_DB)
 * @param retentionDays - Số ngày lưu giữ (mặc định 30) / Retention days (default 30)
 *
 * @returns Số dòng đã xoá / Number of deleted rows
 *
 * @example
 *   const { deleted } = await pruneOldMetrics(c.env.AURA_DB, 30);
 *   console.log(`Đã xoá ${deleted} metric cũ / Pruned ${deleted} old metrics`);
 */
export async function pruneOldMetrics(
  db: D1Database,
  retentionDays: number = 30,
): Promise<{ deleted: number }> {
  try {
    const result = await db.prepare(
      "DELETE FROM _metrics WHERE created_at < datetime('now', ?)"
    )
      .bind(`-${retentionDays} days`)
      .run();

    return { deleted: result.meta?.changes ?? 0 };
  } catch (err: unknown) {
    console.error(
      '[metrics-collector] pruneOldMetrics failed:',
      err instanceof Error ? err.message : String(err),
    );
    return { deleted: 0 };
  }
}

// ─── getMetricSummary ──────────────────────────────────────────────────────

/**
 * Lấy tổng hợp thống kê (AVG, MAX, MIN, COUNT) cho một metric
 * trong khoảng thời gian chỉ định.
 *
 * Get aggregated statistics (AVG, MAX, MIN, COUNT) for a metric
 * within the specified time range.
 *
 * @param db    - D1 database binding (ví dụ: c.env.AURA_DB / e.g. c.env.AURA_DB)
 * @param name  - Tên metric cần truy vấn / Metric name to query
 * @param range - Khoảng thời gian: '24h' | '7d' | '30d' (mặc định '24h')
 *                Time range: '24h' | '7d' | '30d' (default '24h')
 *
 * @returns MetricSummary nếu có dữ liệu, null nếu không có bản ghi nào
 *          MetricSummary if data exists, null if no records found
 *
 * @example
 *   const summary = await getMetricSummary(c.env.AURA_DB, 'request', '24h');
 *   if (summary) {
 *     console.log(`Requests: ${summary.count}, avg duration: ${summary.avg}ms`);
 *   }
 */
export async function getMetricSummary(
  db: D1Database,
  name: string,
  range: string = '24h',
): Promise<MetricSummary | null> {
  try {
    const hours = resolveRangeHours(range);

    const row = await db.prepare(
      `SELECT
         AVG(value) AS avg,
         MAX(value) AS max,
         MIN(value) AS min,
         COUNT(*)   AS count
       FROM _metrics
       WHERE name = ? AND created_at > datetime('now', ?)`
    )
      .bind(name, `-${hours} hours`)
      .first<{ avg: number | null; max: number | null; min: number | null; count: number }>();

    if (!row || row.count === 0) {
      return null;
    }

    return {
      name,
      avg: row.avg ?? 0,
      max: row.max ?? 0,
      min: row.min ?? 0,
      count: row.count,
    };
  } catch (err: unknown) {
    console.error(
      '[metrics-collector] getMetricSummary failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ─── Backward Compatible Factory ──────────────────────────────────────────
// Các module cũ dùng createMetricsCollector(db) — giữ tương thích.
// Legacy modules use createMetricsCollector(db) — kept for compatibility.

/**
 * Giao diện tags cho metric (tương thích ngược).
 * MetricTags interface (backward compatible).
 */
export interface MetricTags {
  [key: string]: string | number | boolean;
}

/**
 * Tuỳ chọn cảnh báo (tương thích ngược).
 * Alert options (backward compatible).
 */
export interface AlertOptions {
  severity?: 'info' | 'warning' | 'critical';
  cooldownMinutes?: number;
}

export interface MetricsCollector {
  recordMetric(name: string, value?: number, tags?: MetricTags): Promise<void>;
  recordAlert(key: string, message: string, opts?: AlertOptions): Promise<number | null>;
  markAlertDispatched(alertId: number): Promise<void>;
  pruneOldMetrics(daysRetention?: number): Promise<number>;
}

/**
 * Tạo đối tượng MetricsCollector tương thích ngược.
 * Tất cả các phương thức delegate tới các standalone functions.
 * Các lỗi được log qua console.error và không throw.
 *
 * Create a backward-compatible MetricsCollector object.
 * All methods delegate to the standalone functions above.
 * Errors are logged via console.error and never thrown.
 *
 * @param db - D1 database binding (c.env.AURA_DB)
 * @returns MetricsCollector với các phương thức recordMetric, recordAlert, markAlertDispatched, pruneOldMetrics
 *
 * @example
 *   const mc = createMetricsCollector(c.env.AURA_DB);
 *   c.executionCtx.waitUntil(mc.recordMetric('order_created', 1));
 *   await mc.recordAlert('high_error_rate', 'Too many 500s', { severity: 'critical' });
 */
export function createMetricsCollector(db: D1Database | null): MetricsCollector {
  return {
    async recordMetric(name: string, value: number = 1, tags: MetricTags = {}): Promise<void> {
      if (!db) return;
      try {
        await db.prepare(
          "INSERT INTO _metrics (name, value, tags, created_at) VALUES (?, ?, ?, datetime('now'))"
        ).bind(name, value, JSON.stringify(tags)).run();
      } catch (err: unknown) {
        console.error(
          '[metrics-collector] recordMetric failed:',
          err instanceof Error ? err.message : String(err),
        );
      }
    },

    async recordAlert(key: string, message: string, opts: AlertOptions = {}): Promise<number | null> {
      if (!db) return null;
      const { severity = 'warning', cooldownMinutes = 30 } = opts;
      const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();

      try {
        const recent = await db.prepare(
          'SELECT id FROM _alerts WHERE alert_key = ? AND created_at > ? AND dispatched = 1'
        ).bind(key, cutoff).first<{ id: number }>();
        if (recent) return null;

        const result = await db.prepare(
          'INSERT INTO _alerts (alert_key, message, severity, dispatched, created_at) VALUES (?, ?, ?, 0, ?)'
        ).bind(key, message, severity, new Date().toISOString()).run();
        return result.meta?.last_row_id ?? null;
      } catch (err: unknown) {
        console.error(
          '[metrics-collector] recordAlert failed:',
          err instanceof Error ? err.message : String(err),
        );
        return null;
      }
    },

    async markAlertDispatched(alertId: number): Promise<void> {
      if (!db) return;
      try {
        await db.prepare(
          'UPDATE _alerts SET dispatched = 1 WHERE id = ?'
        ).bind(alertId).run();
      } catch (err: unknown) {
        console.error(
          '[metrics-collector] markAlertDispatched failed:',
          err instanceof Error ? err.message : String(err),
        );
      }
    },

    async pruneOldMetrics(daysRetention: number = 30): Promise<number> {
      if (!db) return 0;
      try {
        const result = await db.prepare(
          "DELETE FROM _metrics WHERE created_at < datetime('now', ?)"
        ).bind(`-${daysRetention} days`).run();
        return result.meta?.changes ?? 0;
      } catch (err: unknown) {
        console.error(
          '[metrics-collector] pruneOldMetrics failed:',
          err instanceof Error ? err.message : String(err),
        );
        return 0;
      }
    },
  };
}
