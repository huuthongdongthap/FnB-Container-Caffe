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

    let userStr = payload.email ? await authKV.get(`user:${payload.email}`) : null;
    if (!userStr && payload.id) {
      userStr = await authKV.get(`user:${payload.id}`);
    }
    if (!userStr && !payload.email && payload.id) {
      const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
      if (db) {
        try {
          const d1User = await db
            .prepare('SELECT id, email, name, phone, role FROM users WHERE id = ?')
            .bind(payload.id)
            .first<{ id: string; email?: string; name?: string; phone?: string; role?: string }>();
          if (d1User?.id) {
            return jsonResponse({
              success: true,
              user: {
                id: d1User.id,
                email: d1User.email || '',
                name: d1User.name || payload.name || d1User.id,
                phone: d1User.phone || '',
                role: d1User.role || payload.role || 'staff',
              },
            });
          }
        } catch {
          // Fall through to token payload claims
        }
      }
      return jsonResponse({
        success: true,
        user: {
          id: payload.id,
          email: '',
          name: payload.name || payload.id,
          role: payload.role || 'staff',
        },
      });
    }
    if (!userStr) {
      return errorResponse(`User '${payload.email}' không tồn tại trong KV`, 404);
    }

    const user = JSON.parse(userStr);

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role || 'customer' }
    });
  } catch (error) {
    log.error('GetUser error:', { message: (error as Error).message });
    return errorResponse('Lỗi server', 500);
  }
}
