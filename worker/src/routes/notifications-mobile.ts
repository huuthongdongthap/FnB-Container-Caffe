import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { requireStaff } from '../middleware/staff-auth';
import { hasPermission, ROLE_PERMISSIONS } from '../lib/staff-roles';
import { sendPushToUser } from '../lib/push-notifier';
import type { Env } from '../types/env';
import type { Context } from 'hono';

const log = createLogger({ route: 'notifications-mobile' });

/**
 * GET /mobile/notifications
 * List recent notifications for the logged-in staff user.
 */
export async function getNotifications(c: Context<{ Bindings: Env }>) {
  const user = c.get('user');
  const userId = (user?.id as string | undefined);
  if (!userId) return errorResponse('Vui lòng đăng nhập', 401);

  try {
    const { results } = await c.env.AURA_DB
      .prepare(
        `SELECT id, type, title_vi, title_en, body_vi, body_en,
                data, read_at, created_at
           FROM notifications
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 50`
      )
      .bind(userId)
      .all<{
        id: string;
        type: string;
        title_vi: string;
        title_en: string;
        body_vi: string | null;
        body_en: string | null;
        data: string;
        read_at: string | null;
        created_at: string;
      }>();

    const list = (results ?? []).map(row => ({
      id: row.id,
      type: row.type,
      title_vi: row.title_vi,
      title_en: row.title_en,
      body_vi: row.body_vi,
      body_en: row.body_en,
      data: parseData(row.data),
      read_at: row.read_at,
      created_at: row.created_at,
    }));

    return jsonResponse({ success: true, notifications: list });
  } catch (err) {
    log.error('list_notifications_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Không thể tải thông báo', 500);
  }
}

/**
 * POST /mobile/notifications/:id/read
 * Mark a single notification as read, scoped to the current user.
 */
export async function markNotificationRead(c: Context<{ Bindings: Env }>) {
  const user = c.get('user');
  const userId = (user?.id as string | undefined);
  const notifId = c.req.param('id');
  if (!userId || !notifId) return errorResponse('Thiếu tham số', 400);

  try {
    const now = new Date().toISOString();
    await c.env.AURA_DB
      .prepare(
        `UPDATE notifications
            SET read_at = ?
          WHERE id = ?
            AND user_id = ?
            AND read_at IS NULL`
      )
      .bind(now, notifId, userId)
      .run();

    return jsonResponse({ success: true });
  } catch (err) {
    log.error('mark_read_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Không thể cập nhật trạng thái', 500);
  }
}

/**
 * POST /mobile/notifications/subscribe
 * Register a Web Push subscription for the current staff user.
 * Matches the column naming used by push_subscriptions (auth_key, p256dh_key).
 */
export async function subscribePush(c: Context<{ Bindings: Env }>) {
  const user = c.get('user');
  const userId = (user?.id as string | undefined);
  const role = ((user?.role as string) || 'staff');
  if (!userId) return errorResponse('Vui lòng đăng nhập', 401);

  let body: {
    endpoint: string;
    keys?: Record<string, string>;
    user_agent?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return errorResponse('Payload không hợp lệ', 400);
  }

  const endpoint = body?.endpoint;
  if (!endpoint || typeof endpoint !== 'string') {
    return errorResponse('Thiếu endpoint', 400);
  }

  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const p256dh = body.keys?.p256dh ?? '';
    const auth = body.keys?.auth ?? '';
    const userAgent = body.user_agent ?? c.req.header('User-Agent') ?? '';

    await c.env.AURA_DB
      .prepare(
        `INSERT INTO push_subscriptions
             (id, user_id, endpoint, auth_key, p256dh_key, role, user_agent, last_used_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET
             user_id     = excluded.user_id,
             auth_key    = excluded.auth_key,
             p256dh_key  = excluded.p256dh_key,
             role        = excluded.role,
             user_agent  = excluded.user_agent,
             last_used_at= excluded.last_used_at,
             updated_at  = excluded.updated_at`
      )
      .bind(id, userId, endpoint, auth, p256dh, role, userAgent, now, now, now)
      .run();

    return jsonResponse({ success: true, message: 'Đăng ký push thành công' }, 201);
  } catch (err) {
    log.error('subscribe_push_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Không thể đăng ký push', 500);
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseData(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
