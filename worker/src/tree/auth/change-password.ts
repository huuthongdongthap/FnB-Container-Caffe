// changePassword handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { verifyPassword, hashPassword, getAuthToken } from '../../lib/jwt';
import { authenticateRequest } from '../../lib/staff-session-auth';
import { staffSessionErrorResponse } from '../../lib/staff-session';
import { verifyStaffPassword, changeStaffPassword } from '../../lib/staff-password';
import type { Env } from '../../types/env';
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

    const session = await authenticateRequest(request, env as unknown as Env);
    if (!session) return errorResponse('Unauthorized', 401);
    if ('blocked' in session) return errorResponse(session.blocked, 403);
    const { payload, account } = session;
    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const userStr = payload.email ? await authKV.get(`user:${payload.email}`) : null;
    if (!userStr && !account) {
      return errorResponse('User không tồn tại', 404);
    }

    const user = userStr ? JSON.parse(userStr) : { id: account!.id, name: account!.name, role: account!.role, password: '' };
    const ok = account
      ? await verifyStaffPassword((env as unknown as Env).AURA_DB, account, currentPassword, user.password)
      : await verifyPassword(currentPassword, user.password);
    if (!ok) {
      const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
      const mc = createMetricsCollector(db);
      mc.recordMetric('login_failed', 1, { reason: 'change_password_wrong' }).catch(() => {});
      return errorResponse('Mật khẩu hiện tại không đúng', 400);
    }

    user.password = await hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    user.auth_version = Number(user.auth_version || 1) + 1;
    if (account) {
      await changeStaffPassword((env as unknown as Env).AURA_DB, account, user.password);
      if (payload.email) await authKV.put(`user:${payload.email}`, JSON.stringify(user)).catch(() => {});
    } else {
      await authKV.put(`user:${payload.email}`, JSON.stringify(user));
    }
    const rawToken = getAuthToken(request);
    if (rawToken && authKV) {
      await authKV.put(`revoked:${rawToken}`, '1', { expirationTtl: 604800 }).catch(() => {});
    }
    if (env.AURA_DB && payload.id) {
      await (env.AURA_DB as import('@cloudflare/workers-types').D1Database)
        .prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?')
        .bind(user.updated_at, payload.id)
        .run()
        .catch(() => {});
    }

    return jsonResponse({
      success: true,
      message: 'Mật khẩu đã được thay đổi'
    });
  } catch (error) {
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('ChangePassword error:', { message: (error as Error).message });
    return errorResponse('Đổi mật khẩu thất bại', 500);
  }
}
