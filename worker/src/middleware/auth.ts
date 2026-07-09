/**
 * Auth Middleware
 * JWT verification + role-based access control.
 * Converted from middleware/admin-auth.js.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';
import { verifyJWT, getAuthToken } from '../lib/jwt';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'staff' | 'customer';
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
    customer: Record<string, unknown>;
  }
}

/**
 * Middleware factory: requireAuth(allowedRoles)
 * Usage: app.use('/api/admin/*', requireAuth(['owner', 'staff']))
 */
export function requireAuth(allowedRoles: string[] = ['owner', 'staff']): import('hono').MiddlewareHandler<{ Bindings: Env }> {
  return async(c, next) => {
    if (!(c.env as Env).JWT_SECRET) {
      return c.json({ success: false, error: 'Server misconfiguration: JWT_SECRET not set' }, 500);
    }

    const token = getAuthToken(c.req.raw);

    if (!token) {
      return c.json({ success: false, error: 'Unauthorized — vui lòng đăng nhập' }, 401);
    }

    const payload = await verifyJWT(token, (c.env as Env).JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: 'Token không hợp lệ hoặc đã hết hạn' }, 401);
    }

    const revoked = await (c.env as Env).AUTH_KV.get(`revoked:${token}`);
    if (revoked) {
      return c.json({ success: false, error: 'Token đã bị thu hồi' }, 401);
    }

    const userRole = payload.role || 'customer';
    if (!allowedRoles.includes(userRole)) {
      return c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403);
    }

    c.set('user', {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: userRole as AuthUser['role']
    });

    await next();
  };
}
