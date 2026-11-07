/**
 * Daily digest — 24h summary dispatched via Telegram.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { createLogger } from '../../middleware/logger';
import { resolvePilotStore } from '../pilot-store';
import { sendTelegramMessage } from './telegram';
import {
  formatBilingualDigestMessage,
  formatLegacyDigestMessage,
  type DigestStats
} from './formatters';

const log = createLogger({ route: 'alert-dispatcher' });

/**
 * Lấy thống kê 24 giờ qua / Fetch 24h rolling statistics.
 */
async function fetchDigestStats(db: D1Database, tenantId?: string): Promise<DigestStats> {
  const since = 'datetime(\'now\', \'-24 hours\')';
  const scopedTenant = typeof tenantId === 'string' && tenantId.trim() && tenantId.trim() !== '*'
    ? tenantId.trim()
    : null;

  if (scopedTenant) {
    const tenantClause = 'AND COALESCE(NULLIF(TRIM(json_extract(tags, \'$.tenant_id\')), \'\'), \'default\') = ?';
    const [orders, revenue, errors, totalReqs] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) as c FROM _metrics WHERE name = 'order_created' AND created_at >= ${since} ${tenantClause}`
        )
        .bind(scopedTenant)
        .first<{ c: number }>(),
      db
        .prepare(
          `SELECT COALESCE(SUM(value), 0) as s FROM _metrics WHERE name = 'revenue' AND created_at >= ${since} ${tenantClause}`
        )
        .bind(scopedTenant)
        .first<{ s: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as c FROM _metrics WHERE name = 'request' AND CAST(json_extract(tags, '$.status') AS INTEGER) >= 400 AND created_at >= ${since} ${tenantClause}`
        )
        .bind(scopedTenant)
        .first<{ c: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as c FROM _metrics WHERE name = 'request' AND created_at >= ${since} ${tenantClause}`
        )
        .bind(scopedTenant)
        .first<{ c: number }>()
    ]);

    return {
      orderCount: orders?.c ?? 0,
      revenueTotal: revenue?.s ?? 0,
      errorCount: errors?.c ?? 0,
      totalCount: totalReqs?.c ?? 1,
    };
  }

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

  return { orderCount, revenueTotal, errorCount, totalCount };
}

/**
 * Gửi bản tin tổng hợp trong 24 giờ qua qua Telegram.
 * Nội dung song ngữ Việt-Anh: số đơn hàng, doanh thu, tỷ lệ thành công, lỗi.
 *
 * Send a bilingual Vietnamese-English daily digest via Telegram.
 * Content: order count, revenue, success rate, error count for last 24 hours.
 *
 * @param env - Cloudflare Worker environment bindings
 */
export async function dispatchDigest(
  env: Env,
  _locale: 'vi' | 'en' | string = 'vi',
  tenantId?: string
): Promise<void> {
  const db = env.AURA_DB;
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return;
  }

  const rawTenant =
    _locale !== 'vi' && _locale !== 'en' ? _locale : tenantId;
  let effectiveTenant =
    typeof rawTenant === 'string' && rawTenant.trim() && rawTenant.trim() !== '*'
      ? rawTenant.trim()
      : null;
  if (!effectiveTenant) {
    const envRec = env as unknown as Record<string, unknown>;
    if (envRec.PILOT_TENANT_ID || envRec.PILOT_STORE || envRec.PILOT_STORE_ID) {
      try {
        const resolved = resolvePilotStore({
          ...envRec,
          PILOT_TENANT_ID: envRec.PILOT_TENANT_ID ?? envRec.PILOT_STORE ?? envRec.PILOT_STORE_ID,
        });
        if (resolved && resolved !== '*') {
          effectiveTenant = resolved;
        }
      } catch {
        // Ignore invalid pilot store config
      }
    }
  }

  try {
    const stats = await fetchDigestStats(db, effectiveTenant ?? undefined);
    const successRate = ((1 - stats.errorCount / stats.totalCount) * 100).toFixed(1);

    const dateStr = new Date().toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    await sendTelegramMessage(
      token,
      chatId,
      formatBilingualDigestMessage({ ...stats, successRate }, dateStr)
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('dispatchDigest_failed', { error: errMsg });
  }
}

/**
 * Digest nội bộ cho createAlertDispatcher — nhận sendTelegram callback từ caller.
 * Internal digest variant used by createAlertDispatcher — accepts a caller-supplied
 * sendTelegram callback instead of reading env.
 */
export async function dispatchDigestViaCallback(
  db: D1Database | null,
  sendTelegram: (msg: string) => Promise<void>,
  locale: 'vi' | 'en' = 'vi',
  tenantId?: string
): Promise<void> {
  if (!db) {
    return;
  }

  const stats = await fetchDigestStats(db, tenantId);
  await sendTelegram(formatLegacyDigestMessage(stats, locale));
}
