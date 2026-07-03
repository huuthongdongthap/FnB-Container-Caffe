// loginUser handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { generateJWT, verifyPassword, hashPassword } from '../../lib/jwt';
import { loginSchema } from '../../lib/validators';
import { parseJSON } from './helpers';

const log = createLogger({ route: 'auth' });

export async function loginUser(request: Request, env: Record<string, unknown>, ctx?: { waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const body = await parseJSON(request);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }
    const { email, password } = parsed.data;

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const userStr = await authKV.get(`user:${email}`);
    if (!userStr) {
      const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
      const mc = createMetricsCollector(db);
      ctx?.waitUntil?.(mc.recordMetric('login_failed', 1, { reason: 'user_not_found' }));
      return errorResponse('Email hoặc mật khẩu không đúng', 401);
    }

    const user = JSON.parse(userStr);

    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
      const mc = createMetricsCollector(db);
      ctx?.waitUntil?.(mc.recordMetric('login_failed', 1, { reason: 'wrong_password' }));
      return errorResponse('Email hoặc mật khẩu không đúng', 401);
    }

    if (!String(user.password).startsWith('pbkdf2$')) {
      user.password = await hashPassword(password);
      await authKV.put(`user:${email}`, JSON.stringify(user));
    }

    const token = await generateJWT(
      { email, name: user.name, id: user.id, role: user.role || 'customer' },
      env.JWT_SECRET as string,
      env.JWT_EXPIRY_SECONDS as string
    );

    user.last_login = new Date().toISOString();
    user.updated_at = new Date().toISOString();
    await authKV.put(`user:${email}`, JSON.stringify(user));

    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const mc = createMetricsCollector(db);
    ctx?.waitUntil?.(mc.recordMetric('login_success', 1));

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role || 'customer' },
      token,
      message: 'Đăng nhập thành công',
    });
  } catch (error) {
    log.error('Login error:', { message: (error as Error).message });
    return errorResponse('Đăng nhập thất bại: ' + (error as Error).message, 500);
  }
}
