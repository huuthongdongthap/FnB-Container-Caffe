// logoutUser handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { getAuthToken, verifyJWT, cookieWriteBlockReason } from '../../lib/jwt';

const log = createLogger({ route: 'auth' });
const CLEAR_COOKIE = 'access_token=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0';

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
