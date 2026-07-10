/**
 * Staff Mobile Auth Middleware — AURA Mobile
 * requireStaff(roles?) — JWT verification + role gate for /mobile/* routes.
 * Reuses requireAuth's JWT flow but supports the expanded 4-role enum.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';
import { verifyJWT, getAuthToken } from '../lib/jwt';
import { ROLE_LABELS } from '../lib/staff-roles';
import type { AuthUser } from './auth';

/**
 * Middleware factory: requireStaff(allowedRoles?)
 * Defaults to all 4 staff roles being accepted (no gate by default).
 * @param allowedRoles — subset of ['owner','manager','staff','waiter']; omit or pass [] to accept all.
 */
export function requireStaff(
  allowedRoles: string[] = ['owner', 'manager', 'staff', 'waiter']
): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
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

    // Reject customers entirely — staff routes should never be reached by a customer token
    if (userRole === 'customer') {
      return c.json({ success: false, error: 'Không có quyền truy cập khu vực nhân viên' }, 403);
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      const label = ROLE_LABELS[userRole as keyof typeof ROLE_LABELS]?.vi ?? userRole;
      return c.json(
        {
          success: false,
          error: `Vai trò "${label}" không được phép truy cập tài nguyên này`,
        },
        403
      );
    }

    c.set('user', {
      id: payload.id,
      email: payload.email || '',
      name: payload.name || '',
      role: userRole as StaffUser['role'],
    });

    await next();
  };
}
