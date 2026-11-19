// logoutUser handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { getAuthToken, verifyJWT, cookieWriteBlockReason } from '../../lib/jwt';

const log = createLogger({ route: 'auth' });
const CLEAR_COOKIE = 'access_token=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0';

/**
 * KV blacklist writes propagate with a delay, so D1 is also made authoritative:
 * open sessions are marked revoked and the account's auth_version is bumped so
 * any token minted before logout fails the version check on its next request.
 * D1 failures are logged, not thrown, so the KV revocation and cookie clearing
 * still complete.
 */
async function revokeSessionInD1(env: Record<string, unknown>, payload: Record<string, unknown>): Promise<void> {
  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database | undefined;
  const accountId = typeof payload.id === 'string' ? payload.id : typeof payload.sub === 'string' ? payload.sub : '';
  if (!db?.prepare || !accountId) return;
  const isCustomer = payload.role === 'customer';
  const run = async (label: string, sql: string) => {
    try {
      await db.prepare(sql).bind(accountId).run();
    } catch (error) {
      log.warn(`Logout D1 ${label} failed:`, { message: (error as Error).message });
    }
  };
  if (!isCustomer) {
    await run('session revoke', "UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL");
  }
  await run(
    'auth_version bump',
    isCustomer
      ? 'UPDATE customers SET auth_version = COALESCE(auth_version, 1) + 1 WHERE id = ?'
      : 'UPDATE users SET auth_version = COALESCE(auth_version, 1) + 1 WHERE id = ?'
  );
  if (isCustomer) {
    const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    if (kv?.put) {
      try {
        const row = await db
          .prepare('SELECT auth_version FROM customers WHERE id = ? LIMIT 1')
          .bind(accountId)
          .first<{ auth_version?: number | null }>()
          .catch(() => null);
        const nextVer = Number(row?.auth_version) > 1
          ? Number(row?.auth_version)
          : Math.max(2, Number(payload.authVersion || 1) + 1);
        await kv.put(`cust_auth_ver:${accountId}`, String(nextVer));
      } catch (kvErr) {
        log.warn('Logout KV cust_auth_ver sync failed:', { message: (kvErr as Error).message });
      }
    }
  }
}

export async function logoutUser(request: Request, env: Record<string, unknown>) {
  try {
    const blockReason = cookieWriteBlockReason(request.method, request);
    if (blockReason) {
      return errorResponse(blockReason, 403);
    }

    const token = getAuthToken(request);
    if (!token) {
      return jsonResponse({ success: false, error: 'Không tìm thấy token' }, 400, {
        'Set-Cookie': CLEAR_COOKIE,
      });
    }

    const payload = await verifyJWT(token, env.JWT_SECRET as string);
    if (payload?.exp) {
      const ttl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
      const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
      await authKV.put(`revoked:${token}`, '1', { expirationTtl: ttl });
    }
    if (payload) await revokeSessionInD1(env, payload as unknown as Record<string, unknown>);

    // Clear the session cookie set at login (Max-Age=0 expires it immediately).
    return jsonResponse({
      success: true,
      message: 'Đăng xuất thành công'
    }, 200, { 'Set-Cookie': CLEAR_COOKIE });
  } catch (error) {
    log.error('Logout error:', { message: (error as Error).message });
    return jsonResponse({ success: false, error: 'Đăng xuất thất bại' }, 500, {
      'Set-Cookie': CLEAR_COOKIE,
    });
  }
}
