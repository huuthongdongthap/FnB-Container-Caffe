/**
 * Staff Mobile Auth Middleware — AURA Mobile (JS version)
 * requireStaff(roles?) — JWT verify + role gate for /mobile/* routes.
 */

import { verifyJWT, getAuthToken } from '../routes/auth.js';

const ALL_STAFF_ROLES = ['owner', 'manager', 'staff', 'waiter'];

export function requireStaff(allowedRoles = ALL_STAFF_ROLES) {
  return async (c, next) => {
    if (!c.env.JWT_SECRET) {
      return c.json({ success: false, error: 'Server misconfiguration: JWT_SECRET not set' }, 501);
    }

    const token = getAuthToken(c.req.raw);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized — vui lòng đăng nhập' }, 401);
    }

    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: 'Token không hợp lệ hoặc đã hết hạn' }, 401);
    }

    // Denylist check — only touch KV when logout happened
    const revoked = await c.env.AUTH_KV.get(`revoked:${token}`);
    if (revoked) {
      return c.json({ success: false, error: 'Token đã bị thu hồi' }, 401);
    }

    const userRole = payload.role || 'customer';

    // Reject customer-level tokens for staff routes
    if (userRole === 'customer') {
      return c.json({ success: false, error: 'Không có quyền truy cập khu vực nhân viên' }, 403);
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return c.json(
        { success: false, error: `Vai trò "${userRole}" không được phép truy cập tài nguyên này` },
        403
      );
    }

    c.set('user', {
      id: payload.id,
      email: payload.email || '',
      name: payload.name || '',
      role: userRole,
    });

    await next();
  };
}
