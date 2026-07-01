// resetPassword handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { generateJWT, hashPassword } from '../../lib/jwt';
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
    if (providedKey !== env.RESET_KEY) {
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
    const userStr = await authKV.get(`user:${email}`);
    if (!userStr) {
      return jsonResponse({
        success: true,
        message: 'Nếu email tồn tại, mật khẩu đã được reset. Vui lòng kiểm tra email của bạn.',
      });
    }

    const user = JSON.parse(userStr);
    user.password = await hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    await authKV.put(`user:${email}`, JSON.stringify(user));

    const token = await generateJWT(
      { email, name: user.name, id: user.id, role: user.role || 'customer' },
      env.JWT_SECRET as string,
      env.JWT_EXPIRY_SECONDS as string
    );

    return jsonResponse({
      success: true,
      message: 'Mật khẩu đã được reset',
      user: { id: user.id, email: user.email, name: user.name, role: user.role || 'customer' },
      token,
    });
  } catch (error) {
    log.error('ResetPassword error:', { message: (error as Error).message });
    return errorResponse('Reset mật khẩu thất bại: ' + (error as Error).message, 500);
  }
}
