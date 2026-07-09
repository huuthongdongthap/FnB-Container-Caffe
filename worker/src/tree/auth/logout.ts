// logoutUser handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { getAuthToken, verifyJWT } from '../../lib/jwt';

const log = createLogger({ route: 'auth' });

export async function logoutUser(request: Request, env: Record<string, unknown>) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return errorResponse('Không tìm thấy token', 400);
    }

    const payload = await verifyJWT(token, env.JWT_SECRET as string);
    if (payload?.exp) {
      const ttl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
      const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
      await authKV.put(`revoked:${token}`, '1', { expirationTtl: ttl });
    }

    return jsonResponse({
      success: true,
      message: 'Đăng xuất thành công'
    });
  } catch (error) {
    log.error('Logout error:', { message: (error as Error).message });
    return errorResponse(`Đăng xuất thất bại: ${(error as Error).message}`, 500);
  }
}
