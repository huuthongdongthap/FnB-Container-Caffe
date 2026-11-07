/**
 * Alert dispatch — reads undelivered alerts from _alerts and sends via Telegram.
 */

import type { D1Database as _D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { createLogger } from '../../middleware/logger';
import { resolvePilotStore } from '../pilot-store';
import { sendTelegramMessage } from './telegram';
import { formatAlertMessage, type AlertRecord } from './formatters';

const log = createLogger({ route: 'alert-dispatcher' });

function resolveAlertTenant(env: Env, tenantId?: string): string | null {
  const normalized = typeof tenantId === 'string' && tenantId.trim() ? tenantId.trim() : '';
  if (normalized) {
    return normalized === '*' ? null : normalized;
  }
  const envRec = env as unknown as Record<string, unknown>;
  if (envRec.PILOT_TENANT_ID || envRec.PILOT_STORE || envRec.PILOT_STORE_ID) {
    try {
      const resolved = resolvePilotStore({
        ...envRec,
        PILOT_TENANT_ID: envRec.PILOT_TENANT_ID ?? envRec.PILOT_STORE ?? envRec.PILOT_STORE_ID,
      });
      return resolved && resolved !== '*' ? resolved : null;
    } catch {
      return null;
    }
  }
  return null;
}

function matchesAlertKeyTenant(alertKey: string, tenantId: string): boolean {
  if (!alertKey) return tenantId === 'default';
  if (alertKey.startsWith(`${tenantId}:`) || alertKey.endsWith(`:${tenantId}`)) {
    return true;
  }
  if (tenantId === 'default' && !alertKey.includes(':')) {
    return true;
  }
  return false;
}

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
 * @param localeOrTenantId - Language ('vi' | 'en') or tenantId override
 * @param tenantId - Optional explicit tenant scope
 * @returns Số lượng alert đã gửi thành công / Number of alerts dispatched
 */
export async function dispatchAlerts(
  env: Env,
  localeOrTenantId: 'vi' | 'en' | string = 'vi',
  tenantId?: string
): Promise<{ dispatched: number }> {
  const db = env.AURA_DB;
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    log.warn('telegram_not_configured', { hasToken: !!token, hasChatId: !!chatId });
    return { dispatched: 0 };
  }

  const locale: 'vi' | 'en' =
    localeOrTenantId === 'vi' || localeOrTenantId === 'en' ? localeOrTenantId : 'vi';
  const explicitTenant =
    localeOrTenantId !== 'vi' && localeOrTenantId !== 'en' ? localeOrTenantId : tenantId;
  const scopedTenant = resolveAlertTenant(env, explicitTenant);

  try {
    let rawAlerts: AlertRecord[] = [];
    if (scopedTenant) {
      try {
        if (scopedTenant === 'default') {
          const result = await db
            .prepare(
              "SELECT id, alert_key, message, severity, created_at FROM _alerts WHERE dispatched_at IS NULL AND (alert_key LIKE ? OR alert_key LIKE ? OR instr(alert_key, ':') = 0) ORDER BY created_at ASC"
            )
            .bind('default:%', '%:default')
            .all<AlertRecord>();
          rawAlerts = result.results ?? [];
        } else {
          const result = await db
            .prepare(
              'SELECT id, alert_key, message, severity, created_at FROM _alerts WHERE dispatched_at IS NULL AND (alert_key LIKE ? OR alert_key LIKE ?) ORDER BY created_at ASC'
            )
            .bind(`${scopedTenant}:%`, `%:${scopedTenant}`)
            .all<AlertRecord>();
          rawAlerts = result.results ?? [];
        }
      } catch {
        const fallback = await db
          .prepare(
            'SELECT id, alert_key, message, severity, created_at FROM _alerts WHERE dispatched_at IS NULL ORDER BY created_at ASC'
          )
          .all<AlertRecord>();
        rawAlerts = fallback.results ?? [];
      }
    } else {
      const result = await db
        .prepare(
          'SELECT id, alert_key, message, severity, created_at FROM _alerts WHERE dispatched_at IS NULL ORDER BY created_at ASC'
        )
        .all<AlertRecord>();
      rawAlerts = result.results ?? [];
    }

    const alerts = scopedTenant
      ? rawAlerts.filter((row) => matchesAlertKeyTenant(String(row.alert_key ?? ''), scopedTenant))
      : rawAlerts;
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
