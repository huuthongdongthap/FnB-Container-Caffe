// changePassword handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { getAuthToken, verifyJWT, verifyPassword, hashPassword } from '../../lib/jwt';
import { changePasswordSchema } from '../../lib/validators';
import { parseJSON } from './helpers';

const log = createLogger({ route: 'auth' });

export async function changePassword(request: Request, env: Record<string, unknown>) {
  try {
    const body = await parseJSON(request);
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }
    const { currentPassword, newPassword } = parsed.data;

    const token = getAuthToken(request);
    if (!token) {
      return errorResponse('Unauthorized', 401);
    }

    const payload = await verifyJWT(token, env.JWT_SECRET as string);
    if (!payload) {
      return errorResponse('Token không hợp lệ', 401);
    }

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const userStr = await authKV.get(`user:${payload.email}`);
    if (!userStr) {
      return errorResponse('User không tồn tại', 404);
    }

    const user = JSON.parse(userStr);
    const ok = await verifyPassword(currentPassword, user.password);
    if (!ok) {
      const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
      const mc = createMetricsCollector(db);
      mc.recordMetric('login_failed', 1, { reason: 'change_password_wrong' }).catch(() => {});
      return errorResponse('Mật khẩu hiện tại không đúng', 400);
    }

    user.password = await hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    await authKV.put(`user:${payload.email}`, JSON.stringify(user));

    return jsonResponse({
      success: true,
      message: 'Mật khẩu đã được thay đổi',
    });
  } catch (error) {
    log.error('ChangePassword error:', { message: (error as Error).message });
    return errorResponse('Đổi mật khẩu thất bại: ' + (error as Error).message, 500);
  }
}
