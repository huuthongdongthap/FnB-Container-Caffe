/**
 * Alert Dispatcher — gửi cảnh báo và bản tin tổng hợp qua Telegram.
 * Đọc cảnh báo từ bảng _alerts, gửi qua Telegram, cập nhật trạng thái đã gửi.
 * Chạy trong cron job, không ảnh hưởng đến request path.
 *
 * Alert Dispatcher — sends alerts and daily digest via Telegram.
 * Reads alerts from _alerts table, sends via Telegram, updates dispatch status.
 * Runs in cron context, never in request path.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import { createMetricsCollector } from './metrics-collector';
import { createLogger } from '../middleware/logger';

const log = createLogger({ route: 'alert-dispatcher' });

// ─── Alert Threshold Definitions ────────────────────────────────────────────
// Danh sách ngưỡng cảnh báo — key, description, severity cho từng loại.
// Threshold definitions — key, description, severity per alert type.

export interface AlertThreshold {
  /** Key định danh ngưỡng / Threshold identifier key */
  key: string;
  /** Mô tả bằng tiếng Anh / English description */
  description: string;
  /** Mức độ nghiêm trọng / Severity level */
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Danh sách các ngưỡng cảnh báo mà hệ thống hỗ trợ.
 * List of alert thresholds supported by the system.
 */
export const ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    key: 'order_stuck',
    description: 'Orders stuck in "preparing" status for more than 15 minutes',
    severity: 'critical'
  },
  {
    key: 'payment_failure',
    description: 'Payment webhook failure detected',
    severity: 'warning'
  },
  {
    key: 'worker_5xx_rate',
    description: 'Worker 5xx error rate exceeds 5%',
    severity: 'warning'
  },
  {
    key: 'd1_latency_high',
    description: 'D1 query latency exceeds 500ms',
    severity: 'info'
  },
  {
    key: 'failed_login_spike',
    description: 'Failed login attempts exceed 10 per minute',
    severity: 'warning'
  },
  {
    key: 'order_volume_anomaly',
    description: 'Order volume exceeds 3x hourly average',
    severity: 'info'
  }
];

// ─── Telegram Helper ────────────────────────────────────────────────────────
// Hàm gửi tin nhắn Telegram dùng chung.
// Shared Telegram message sender.

/**
 * Gửi tin nhắn văn bản qua Telegram Bot API.
 * Send a text message via the Telegram Bot API.
 *
 * @param token  - Telegram bot token (env.TELEGRAM_BOT_TOKEN)
 * @param chatId - Telegram chat ID (env.TELEGRAM_CHAT_ID)
 * @param text   - Nội dung tin nhắn (Markdown format) / Message content
 * @returns true nếu gửi thành công / true if sent successfully
 */
async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        }),
        signal: AbortSignal.timeout(5000)
      }
    );
    return res.ok;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('sendTelegramMessage_failed', { error: errMsg });
    return false;
  }
}

// ─── dispatchAlerts ─────────────────────────────────────────────────────────

/**
 * Đọc tất cả alert chưa gửi từ bảng _alerts và gửi qua Telegram.
 * Sau khi gửi thành công, cập nhật dispatched_at = datetime('now').
 * Nếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID chưa được cấu hình, bỏ qua.
 *
 * Read all undelivered alerts from _alerts and send via Telegram.
 * On success, update dispatched_at = datetime('now').
 * If TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is unconfigured, skip silently.
 *
 * Định dạng tin nhắn: emoji + tiêu đề + mô tả + metrics + timestamp.
 * Message format: emoji + title + description + metrics + timestamp.
 *
 * @param env - Cloudflare Worker environment bindings
 * @returns Số lượng alert đã gửi thành công / Number of alerts dispatched
 */
export async function dispatchAlerts(
  env: Env,
  locale: 'vi' | 'en' = 'vi'
): Promise<{ dispatched: number }> {
  const db = env.AURA_DB;
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    log.warn('telegram_not_configured', { hasToken: !!token, hasChatId: !!chatId });
    return { dispatched: 0 };
  }

  try {
    const result = await db
      .prepare(
        'SELECT id, alert_key, message, severity, created_at FROM _alerts WHERE dispatched_at IS NULL ORDER BY created_at ASC'
      )
      .all<{
        id: number;
        alert_key: string;
        message: string;
        severity: string;
        created_at: string;
      }>();

    const alerts = result.results ?? [];
    let dispatched = 0;

    for (const alert of alerts) {
      // Chọn emoji theo mức độ nghiêm trọng / Pick emoji by severity level
      const emoji =
        alert.severity === 'critical'
          ? '🚨'
          : alert.severity === 'warning'
            ? '⚠️'
            : 'ℹ️';

      // Định dạng: emoji + tiêu đề + mô tả + metrics + timestamp
      // Format: emoji + title + description + metrics + timestamp
      const text = locale === 'vi'
        ? [
          `${emoji} *AURA CAFE Cảnh báo: ${alert.alert_key}*`,
          '',
          `📝 ${alert.message}`,
          `🔴 Mức độ: ${alert.severity === 'critical' ? 'NGHIÊM TRỌNG' : alert.severity === 'warning' ? 'CẢNH BÁO' : 'THÔNG TIN'}`,
          `🕐 ${alert.created_at}`,
          '',
          '_— AURA CAFE Giám sát —_'
        ].join('\n')
        : [
          `${emoji} *AURA CAFE Alert: ${alert.alert_key}*`,
          '',
          `📝 ${alert.message}`,
          `🔴 Severity: ${alert.severity.toUpperCase()}`,
          `🕐 ${alert.created_at}`,
          '',
          '_— AURA CAFE Observability_'
        ].join('\n');

      const ok = await sendTelegramMessage(token, chatId, text);

      if (ok) {
        await db
          .prepare(
            'UPDATE _alerts SET dispatched_at = datetime(\'now\') WHERE id = ?'
          )
          .bind(alert.id)
          .run();
        dispatched++;
      }
    }

    return { dispatched };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('dispatchAlerts_failed', { error: errMsg });
    return { dispatched: 0 };
  }
}

// ─── dispatchDigest ─────────────────────────────────────────────────────────

/**
 * Gửi bản tin tổng hợp trong 24 giờ qua qua Telegram.
 * Nội dung song ngữ Việt-Anh: số đơn hàng, doanh thu, tỷ lệ thành công, lỗi.
 *
 * Send a bilingual Vietnamese-English daily digest via Telegram.
 * Content: order count, revenue, success rate, error count for last 24 hours.
 *
 * @param env - Cloudflare Worker environment bindings
 */
export async function dispatchDigest(env: Env, locale: 'vi' | 'en' = 'vi'): Promise<void> {
  const db = env.AURA_DB;
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return;
  }

  try {
    const since = 'datetime(\'now\', \'-24 hours\')';

    // Lấy thống kê song song / Fetch all metrics in parallel
    const [orders, revenue, errors, totalReqs] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) as c FROM _metrics WHERE name = 'order_created' AND created_at >= ${since}`
        )
        .first<{ c: number }>(),
      db
        .prepare(
          `SELECT COALESCE(SUM(value), 0) as s FROM _metrics WHERE name = 'revenue' AND created_at >= ${since}`
        )
        .first<{ s: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as c FROM _metrics WHERE name = 'request' AND CAST(json_extract(tags, '$.status') AS INTEGER) >= 400 AND created_at >= ${since}`
        )
        .first<{ c: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as c FROM _metrics WHERE name = 'request' AND created_at >= ${since}`
        )
        .first<{ c: number }>()
    ]);

    const orderCount = orders?.c ?? 0;
    const revenueTotal = revenue?.s ?? 0;
    const errorCount = errors?.c ?? 0;
    const totalCount = totalReqs?.c ?? 1;
    const successRate = ((1 - errorCount / totalCount) * 100).toFixed(1);

    const dateStr = new Date().toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Song ngữ Việt-Anh với emoji / Bilingual with emoji
    const msg = [
      '📊 *AURA CAFE Daily Digest / Bản tin hàng ngày*',
      `📅 ${dateStr}`,
      '',
      `🛒 *Đơn hàng / Orders:* ${orderCount}`,
      `💰 *Doanh thu / Revenue:* ${new Intl.NumberFormat('vi-VN').format(
        revenueTotal
      )} VND`,
      `✅ *Tỷ lệ thành công / Success Rate:* ${successRate}%`,
      `❌ *Lỗi / Errors:* ${errorCount}`,
      '',
      '_— AURA CAFE Observability —_'
    ].join('\n');

    await sendTelegramMessage(token, chatId, msg);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('dispatchDigest_failed', { error: errMsg });
  }
}

// ─── Legacy Factory (Backward Compatible) ───────────────────────────────────
// Các module cũ dùng createAlertDispatcher(db) — giữ tương thích.
// Legacy modules use createAlertDispatcher(db) — kept for compat.

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

  async function dispatchAlerts(
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
        // Each threshold needs a specific query to detect its breach.
        // The queries below mirror the original alert definitions.
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
              locale === 'vi'
                ? `${alert.description}\n📊 Giá trị hiện tại: ${value} / Ngưỡng: ${thresholdValue}`
                : `${alert.description}\n📊 Current: ${value} / Threshold: ${thresholdValue}`,
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

  async function dispatchDigest(
    sendTelegram: (msg: string) => Promise<void>,
    locale: 'vi' | 'en' = 'vi'
  ): Promise<void> {
    if (!db) {
      return;
    }

    const since = 'datetime(\'now\', \'-24 hours\')';

    const [orders, revenue, errors, totalReqs] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) as c FROM _metrics WHERE name = 'order_created' AND created_at >= ${since}`
        )
        .first<{ c: number }>(),
      db
        .prepare(
          `SELECT COALESCE(SUM(value), 0) as s FROM _metrics WHERE name = 'revenue' AND created_at >= ${since}`
        )
        .first<{ s: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as c FROM _metrics WHERE name = 'request' AND CAST(json_extract(tags, '$.status') AS INTEGER) >= 400 AND created_at >= ${since}`
        )
        .first<{ c: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as c FROM _metrics WHERE name = 'request' AND created_at >= ${since}`
        )
        .first<{ c: number }>()
    ]);

    const orderCount = orders?.c ?? 0;
    const revenueTotal = revenue?.s ?? 0;
    const errorCount = errors?.c ?? 0;
    const totalCount = totalReqs?.c ?? 1;

    const msg = locale === 'vi'
      ? [
        '📊 *AURA CAFE Bản tin hàng ngày*',
        `📅 ${new Date().toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh'
        })}`,
        '',
        `🛒 Đơn hàng: ${orderCount}`,
        `💰 Doanh thu: ${new Intl.NumberFormat('vi-VN').format(revenueTotal)} VND`,
        `✅ Tỷ lệ thành công: ${((1 - errorCount / totalCount) * 100).toFixed(1)}%`,
        `❌ Lỗi: ${errorCount}`,
        '',
        '_— AURA CAFE Giám sát —_'
      ].join('\n')
      : [
        '📊 *AURA CAFE Daily Digest*',
        `📅 ${new Date().toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh'
        })}`,
        '',
        `🛒 Orders: ${orderCount}`,
        `💰 Revenue: ${new Intl.NumberFormat('vi-VN').format(revenueTotal)} VND`,
        `✅ Success Rate: ${((1 - errorCount / totalCount) * 100).toFixed(1)}%`,
        `❌ Errors: ${errorCount}`,
        '',
        '_— AURA CAFE Observability_'
      ].join('\n');

    await sendTelegram(msg);
  }

  return { dispatchAlerts, dispatchDigest };
}
