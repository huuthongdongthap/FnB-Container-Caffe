// getCurrentUser handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { getAuthToken, verifyJWT } from '../../lib/jwt';

const log = createLogger({ route: 'auth' });

export async function getCurrentUser(request: Request, env: Record<string, unknown>) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return errorResponse('Unauthorized: thiếu Authorization header', 401);
    }

    const payload = await verifyJWT(token, env.JWT_SECRET as string);
    if (!payload) {
      return errorResponse('Token verify thất bại — signature/expiry/format invalid', 401);
    }

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const revoked = await authKV.get(`revoked:${token}`);
    if (revoked) {
      return errorResponse('Token đã bị thu hồi (logout)', 401);
    }

    const userStr = await authKV.get(`user:${payload.email}`);
    if (!userStr) {
      return errorResponse(`User '${payload.email}' không tồn tại trong KV`, 404);
    }

    const user = JSON.parse(userStr);

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role || 'customer' },
    });
  } catch (error) {
    log.error('GetUser error:', { message: (error as Error).message });
    return errorResponse('Lỗi server: ' + (error as Error).message, 500);
  }
}
