/**
 * Alert dispatch — reads undelivered alerts from _alerts and sends via Telegram.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { createLogger } from '../../middleware/logger';
import { sendTelegramMessage } from './telegram';
import { formatAlertMessage, type AlertRecord } from './formatters';

const log = createLogger({ route: 'alert-dispatcher' });

/**
 * Đọc tất cả alert chưa gửi từ bảng _alerts và gửi qua Telegram.
 * Sau khi gửi thành công, cập nhật dispatched_at = datetime('now').
 * Nếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID chưa được cấu hình, bỏ qua.
 *
 * Read all undelivered alerts from _alerts and send via Telegram.
 * On success, update dispatched_at = datetime('now').
 * If TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is unconfigured, skip silently.
 *
 * @param env - Cloudflare Worker environment bindings
 * @param locale - Language for message formatting (default: 'vi')
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
      .all<AlertRecord>();

    const alerts = result.results ?? [];
    let dispatched = 0;

    for (const alert of alerts) {
      const text = formatAlertMessage(alert, locale);
      const ok = await sendTelegramMessage(token, chatId, text);

      if (ok) {
        await db
          .prepare(
            'UPDATE _alerts SET dispatched_at = datetime(\'now\') WHERE id = ?'
          )
          .bind(alert.id ?? '')
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