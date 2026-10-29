// resetPassword handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { generateJWT, hashPassword, timingSafeEqualString } from '../../lib/jwt';
import { requireStaffAccount, issueStaffSession, staffSessionErrorResponse } from '../../lib/staff-session';
import { changeStaffPassword } from '../../lib/staff-password';
import { findLoginUser } from '../../lib/staff-login-identity';
import type { Env } from '../../types/env';
import { resetPasswordSchema } from '../../lib/validators';
import { parseJSON } from './helpers';

const log = createLogger({ route: 'auth' });

export async function resetPassword(request: Request, env: Record<string, unknown>) {
  try {
    if (!env.RESET_KEY) {
      return errorResponse(
        'RESET_KEY chưa cấu hình. Chạy `wrangler secret put RESET_KEY` rồi deploy lại.',
        503
      );
    }

    const providedKey = request.headers.get('X-Reset-Key') || '';
    const expectedKey = String(env.RESET_KEY || '');
    if (!providedKey || !expectedKey || !timingSafeEqualString(providedKey, expectedKey)) {
      return errorResponse('Reset key không hợp lệ', 401);
    }

    const body = await parseJSON(request);
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }
    const { email, newPassword } = parsed.data;

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const user = await findLoginUser(env as unknown as Env, email);
    if (!user) {
      return jsonResponse({
        success: true,
        message: 'Nếu email tồn tại, mật khẩu đã được reset. Vui lòng kiểm tra email của bạn.'
      });
    }

    user.password = await hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    let token: string;
    let responseUser = { id: user.id, email: user.email, name: user.name, role: user.role || 'customer' };
    if (user.role && user.role !== 'customer') {
      const account = await requireStaffAccount((env as unknown as Env).AURA_DB, user.id);
      await changeStaffPassword((env as unknown as Env).AURA_DB, account, user.password);
      const updated = await requireStaffAccount((env as unknown as Env).AURA_DB, user.id);
      const session = await issueStaffSession(env as unknown as Env, updated, { email, sessionType: 'staff-web' });
      token = session.token; responseUser = session.user;
      await authKV.put(`user:${email}`, JSON.stringify(user)).catch(() => {});
    } else {
      await authKV.put(`user:${email}`, JSON.stringify(user));
      token = await generateJWT({ email, name: user.name, id: user.id, role: 'customer' }, env.JWT_SECRET as string, env.JWT_EXPIRY_SECONDS as string);
    }

    return jsonResponse({
      success: true,
      message: 'Mật khẩu đã được reset',
      user: responseUser,
      token
    });
  } catch (error) {
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('ResetPassword error:', { message: (error as Error).message });
    return errorResponse('Reset mật khẩu thất bại', 500);
  }
}
