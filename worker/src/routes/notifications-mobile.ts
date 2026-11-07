import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { matchesTenantRow, isHQSuperAdmin } from '../middleware/tenant';
import type { Env } from '../types/env';
import type { Context } from 'hono';

const log = createLogger({ route: 'notifications-mobile' });

function readExplicitTenant(c: Context<{ Bindings: Env }>): string {
  const fromContext = c.get('tenantId') as string | undefined;
  if (typeof fromContext === 'string' && fromContext.trim()) {
    return fromContext.trim();
  }
  const fromRaw =
    c.req?.raw?.headers?.get?.('X-Tenant-ID') ??
    c.req?.raw?.headers?.get?.('x-tenant-id') ??
    c.req?.raw?.headers?.get?.('X-Store-ID') ??
    c.req?.raw?.headers?.get?.('x-store-id');
  if (typeof fromRaw === 'string' && fromRaw.trim()) {
    return fromRaw.trim();
  }
  const fromHeader =
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id');
  if (typeof fromHeader === 'string' && fromHeader.trim() && fromHeader !== 'Mozilla/5.0') {
    return fromHeader.trim();
  }
  return '';
}

function readQueryTenantOverride(c: Context<{ Bindings: Env }>): string {
  const candidates: string[] = [];
  if (typeof c.req?.query === 'function') {
    for (const k of ['tenant_id', 'tenantId', 'store_id', 'storeId']) {
      const v = c.req.query(k);
      if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
    }
  }
  const rawReq = (c.req as { raw?: Request } | undefined)?.raw;
  if (rawReq) {
    try {
      const url = new URL(rawReq.url);
      for (const k of ['tenant_id', 'tenantId', 'store_id', 'storeId']) {
        const v = url.searchParams.get(k);
        if (v && v.trim()) candidates.push(v.trim());
      }
    } catch {
      // ignore invalid URL
    }
  }
  const unique = Array.from(new Set(candidates));
  if (unique.length > 1) return '__CONFLICT__';
  return unique[0] || '';
}

function readStoreHeaderOverride(c: Context<{ Bindings: Env }>): string {
  const storeHdrs = [
    c.req?.raw?.headers?.get?.('X-Store-ID'),
    c.req?.raw?.headers?.get?.('x-store-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' && v !== 'Mozilla/5.0' ? v.trim() : ''))
    .filter(Boolean);
  const rawTenantHdr =
    c.req?.raw?.headers?.get?.('X-Tenant-ID') ??
    c.req?.raw?.headers?.get?.('x-tenant-id') ??
    c.req?.header?.('X-Tenant-ID') ??
    c.req?.header?.('x-tenant-id') ??
    '';
  const trimmedTenantHdr = typeof rawTenantHdr === 'string' && rawTenantHdr !== 'Mozilla/5.0' ? rawTenantHdr.trim() : '';
  const user = c.get('user') as { role?: string } | undefined;
  const effectiveTenantHdr =
    trimmedTenantHdr.toLowerCase() === 'hq' || ((user?.role === 'owner' || user?.role === 'admin') && trimmedTenantHdr)
      ? trimmedTenantHdr
      : '';
  const unique = Array.from(new Set([...storeHdrs, ...(effectiveTenantHdr ? [effectiveTenantHdr] : [])]));
  if (unique.length > 1) return '__CONFLICT__';
  return unique[0] || '';
}

function hasDisallowedQueryTenantOverride(c: Context<{ Bindings: Env }>): boolean {
  const qOverride = readQueryTenantOverride(c);
  const hOverride = readStoreHeaderOverride(c);
  if (qOverride === '__CONFLICT__' || hOverride === '__CONFLICT__') return true;
  if (qOverride && hOverride && qOverride !== hOverride) return true;
  const queryTenant = qOverride || hOverride;
  if (!queryTenant) return false;
  const user = c.get('user') as { tenantId?: string; tenant_id?: string; role?: string } | undefined;
  if (isHQSuperAdmin(user)) return false;
  const rawUserTenant = user?.tenantId ?? user?.tenant_id;
  const userTenant = typeof rawUserTenant === 'string' ? rawUserTenant.trim() : '';
  const boundTenant = userTenant && userTenant !== '*' && userTenant.toLowerCase() !== 'hq' ? userTenant : 'default';
  return queryTenant === '*' || queryTenant.toLowerCase() === 'hq' || queryTenant !== boundTenant;
}

function resolveMobileStaffTenant(c: Context<{ Bindings: Env }>, allowWildcard = false): string {
  const user = c.get('user') as { tenantId?: string; tenant_id?: string; role?: string } | undefined;
  const rawUserTenant = user?.tenantId ?? user?.tenant_id;
  const userTenant = typeof rawUserTenant === 'string' ? rawUserTenant.trim() : '';

  // Staff bound to a concrete store tenant cannot override it via request headers or context.
  if (userTenant && userTenant !== '*' && userTenant.toLowerCase() !== 'hq') {
    return userTenant;
  }

  if (!isHQSuperAdmin(user)) {
    return 'default';
  }

  const explicit = readQueryTenantOverride(c) || readExplicitTenant(c);
  const candidate = explicit || userTenant || 'default';
  if (candidate === '*' || candidate.toLowerCase() === 'hq') {
    return allowWildcard ? '*' : 'default';
  }
  return candidate;
}

/**
 * GET /mobile/notifications
 * List recent notifications for the logged-in staff user.
 */
export async function getNotifications(c: Context<{ Bindings: Env }>) {
  const user = c.get('user');
  const userId = (user?.id as string | undefined);
  if (!userId) return errorResponse('Vui lòng đăng nhập', 401);
  if (hasDisallowedQueryTenantOverride(c)) {
    return errorResponse('Forbidden: tenant mismatch', 403);
  }

  try {
    type NotifRow = {
      id: string;
      type: string;
      title_vi: string;
      title_en: string;
      body_vi: string | null;
      body_en: string | null;
      data: string;
      read_at: string | null;
      created_at: string;
      tenant_id?: string | null;
    };
    const tenantId = resolveMobileStaffTenant(c, true);
    let results: NotifRow[] | undefined;
    try {
      const res = await c.env.AURA_DB
        .prepare(
          `SELECT id, type, title_vi, title_en, body_vi, body_en,
                  data, read_at, created_at, tenant_id
             FROM notifications
            WHERE user_id = ?
              AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
            ORDER BY created_at DESC
            LIMIT 50`
        )
        .bind(userId, tenantId, tenantId)
        .all<NotifRow>();
      results = res.results;
    } catch (innerErr) {
      const innerMsg = innerErr instanceof Error ? innerErr.message : String(innerErr);
      if (innerMsg.includes('no such column')) {
        const res = await c.env.AURA_DB
          .prepare(
            `SELECT id, type, title_vi, title_en, body_vi, body_en,
                    data, read_at, created_at
               FROM notifications
              WHERE user_id = ?
              ORDER BY created_at DESC
              LIMIT 50`
          )
          .bind(userId)
          .all<NotifRow>();
        results = res.results;
      } else {
        throw innerErr;
      }
    }

    const list = (results ?? [])
      .filter(row => matchesTenantRow(row as unknown as Record<string, unknown>, tenantId))
      .map(row => ({
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

    return jsonResponse({ success: true, notifications: list, data: { items: list, unreadCount: list.filter(n => !n.read_at).length } });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('no such table')) {
      return jsonResponse({ success: true, notifications: [], data: { items: [], unreadCount: 0 } });
    }
    log.error('list_notifications_failed', {
      error: errMsg,
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
  if (hasDisallowedQueryTenantOverride(c)) {
    return errorResponse('Forbidden: tenant mismatch', 403);
  }

  try {
    const now = new Date().toISOString();
    const tenantId = resolveMobileStaffTenant(c, false);
    await c.env.AURA_DB
      .prepare(
        `UPDATE notifications
            SET read_at = ?
          WHERE id = ?
            AND user_id = ?
            AND read_at IS NULL
            AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      )
      .bind(now, notifId, userId, tenantId)
      .run()
      .catch((err) => {
        if (tenantId !== 'default') {
          throw err;
        }
        return c.env.AURA_DB
          .prepare(
            `UPDATE notifications
                SET read_at = ?
              WHERE id = ?
                AND user_id = ?
                AND read_at IS NULL`
          )
          .bind(now, notifId, userId)
          .run();
      });

    return jsonResponse({ success: true });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('no such table')) {
      return jsonResponse({ success: true });
    }
    log.error('mark_read_failed', {
      error: errMsg,
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
  if (hasDisallowedQueryTenantOverride(c)) {
    return errorResponse('Forbidden: tenant mismatch', 403);
  }

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
    const parsedEndpoint = new URL(endpoint);
    const rawHost = parsedEndpoint.hostname.toLowerCase();
    const host = rawHost.replace(/^\[|\]$/g, '').replace(/\.+$/, '');
    if (
      parsedEndpoint.protocol !== 'https:' ||
      !host ||
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '::' ||
      rawHost === '[::]' ||
      /^(0+:){7}0*[01]$/.test(host) ||
      host.startsWith('fc00:') ||
      host.startsWith('fd00:') ||
      /^f[cd][0-9a-f]{2}:/.test(host) ||
      host.startsWith('fe80:') ||
      /^fe[89ab][0-9a-f]:/.test(host) ||
      host.startsWith('::ffff:') ||
      host.startsWith('0:0:0:0:0:ffff:') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return errorResponse('Endpoint push phải dùng HTTPS và host công khai', 400);
    }
  } catch {
    return errorResponse('Endpoint push không hợp lệ', 400);
  }

  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : '';
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth.trim() : '';
  if (!p256dh || !auth) {
    return errorResponse('Thiếu khóa mã hóa push (p256dh, auth)', 400);
  }

  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const userAgent = body.user_agent ?? c.req.header('User-Agent') ?? '';
    const rawTenant = resolveMobileStaffTenant(c, false);
    const tenantId = rawTenant === '*' ? 'default' : rawTenant;

    // Verify an existing push subscription for this endpoint does not belong to another tenant or user.
    try {
      const checkStmt = c.env.AURA_DB.prepare(
        `SELECT user_id, tenant_id
           FROM push_subscriptions
          WHERE endpoint = ? AND (? != '')
          LIMIT 1`
      );
      if (typeof (checkStmt as { first?: unknown }).first === 'function') {
        const boundCheck = checkStmt.bind(endpoint, tenantId);
        if (typeof (boundCheck as { first?: unknown }).first === 'function') {
          const existing = await boundCheck.first<{ user_id?: string | null; tenant_id?: string | null }>();
          if (existing) {
            const existingTenant =
              typeof existing.tenant_id === 'string' && existing.tenant_id.trim()
                ? existing.tenant_id.trim()
                : 'default';
            const existingUser = typeof existing.user_id === 'string' ? existing.user_id.trim() : '';
            if (existingTenant !== tenantId || (existingUser && existingUser !== userId)) {
              return errorResponse('Endpoint push đã thuộc về tài khoản hoặc cửa hàng khác', 409);
            }
          }
        }
      }
    } catch {
      // Proceed to guarded upsert if schema lacks tenant_id/user_id columns.
    }

    try {
      const upsertRes = await c.env.AURA_DB
        .prepare(
          `INSERT INTO push_subscriptions
               (id, user_id, endpoint, auth_key, p256dh_key, role, user_agent, last_used_at, created_at, updated_at, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(endpoint) DO UPDATE SET
               user_id     = excluded.user_id,
               auth_key    = excluded.auth_key,
               p256dh_key  = excluded.p256dh_key,
               role        = excluded.role,
               user_agent  = excluded.user_agent,
               last_used_at= excluded.last_used_at,
               updated_at  = excluded.updated_at,
               tenant_id   = excluded.tenant_id
           WHERE COALESCE(NULLIF(TRIM(push_subscriptions.tenant_id), ''), 'default') = excluded.tenant_id
             AND COALESCE(push_subscriptions.user_id, '') = COALESCE(excluded.user_id, '')`
        )
        .bind(id, userId, endpoint, auth, p256dh, role, userAgent, now, now, now, tenantId)
        .run();
      const changes = (upsertRes as { meta?: { changes?: number }; changes?: number } | undefined)?.meta?.changes
        ?? (upsertRes as { changes?: number } | undefined)?.changes;
      if (changes === 0) {
        return errorResponse('Endpoint push đã thuộc về tài khoản hoặc cửa hàng khác', 409);
      }
    } catch (firstErr) {
      const firstErrMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      if (tenantId !== 'default') {
        throw firstErr;
      }
      if (/tenant_id/i.test(firstErrMsg)) {
        try {
          const fallbackRes = await c.env.AURA_DB
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
                   updated_at  = excluded.updated_at
               WHERE COALESCE(push_subscriptions.user_id, '') = COALESCE(excluded.user_id, '')`
            )
            .bind(id, userId, endpoint, auth, p256dh, role, userAgent, now, now, now)
            .run();
          const changes = (fallbackRes as { meta?: { changes?: number }; changes?: number } | undefined)?.meta?.changes
            ?? (fallbackRes as { changes?: number } | undefined)?.changes;
          if (changes === 0) {
            return errorResponse('Endpoint push đã thuộc về tài khoản khác', 409);
          }
        } catch {
          await c.env.AURA_DB
            .prepare(
              `INSERT INTO push_subscriptions
                   (id, customer_id, endpoint, auth_key, p256dh_key, role, user_agent, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(endpoint) DO UPDATE SET
                   customer_id = excluded.customer_id,
                   auth_key    = excluded.auth_key,
                   p256dh_key  = excluded.p256dh_key,
                   role        = excluded.role,
                   user_agent  = excluded.user_agent,
                   updated_at  = excluded.updated_at
               WHERE COALESCE(push_subscriptions.customer_id, '') = COALESCE(excluded.customer_id, '')`
            )
            .bind(id, userId, endpoint, auth, p256dh, role, userAgent, now, now)
            .run();
        }
      } else {
        await c.env.AURA_DB
          .prepare(
            `INSERT INTO push_subscriptions
                 (id, customer_id, endpoint, auth_key, p256dh_key, role, user_agent, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(endpoint) DO UPDATE SET
                 customer_id = excluded.customer_id,
                 auth_key    = excluded.auth_key,
                 p256dh_key  = excluded.p256dh_key,
                 role        = excluded.role,
                 user_agent  = excluded.user_agent,
                 updated_at  = excluded.updated_at
             WHERE COALESCE(push_subscriptions.customer_id, '') = COALESCE(excluded.customer_id, '')`
          )
          .bind(id, userId, endpoint, auth, p256dh, role, userAgent, now, now)
          .run();
      }
    }

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
