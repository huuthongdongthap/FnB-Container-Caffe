// auth-session.ts — return current session from Bearer token

import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { verifyJWT } from '../lib/jwt';

const log = createLogger({ route: 'auth-session' });

export async function getAuthSession(request: Request, env: Record<string, unknown>) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Chưa đăng nhập', 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET as string);

    if (!payload) {
      return errorResponse('Phiên đăng nhập hết hạn', 401);
    }

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const userStr = await authKV.get(`user:${payload.email}`);
    if (!userStr) {
      return errorResponse('Tài khoản không tồn tại', 404);
    }

    const user = JSON.parse(userStr);
    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role || 'customer',
        email_verified: user.email_verified === true || user.email_verified === 1
      }
    });
  } catch (error) {
    log.error('Session error:', { message: (error as Error).message });
    return errorResponse('Lỗi phiên làm việc', 500);
  }
}
