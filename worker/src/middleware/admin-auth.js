/**
 * Admin Auth Middleware
 * Protects /api/admin/* routes with JWT + role check
 */

import { verifyJWT, getAuthToken } from '../routes/auth.js';

/**
 * Hono middleware factory: requireAuth(allowedRoles)
 * Usage: app.use('/api/admin/*', requireAuth(['owner', 'staff']))
 */
export function requireAuth(allowedRoles = ['owner', 'staff']) {
  return async (c, next) => {
    const token = getAuthToken(c.req.raw);

    if (!token) {
      return c.json({ success: false, error: 'Unauthorized — vui lòng đăng nhập' }, 401);
    }

    // Verify JWT signature + expiry
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: 'Token không hợp lệ hoặc đã hết hạn' }, 401);
    }

    // Check token not revoked
    const tokenEmail = await c.env.AUTH_KV.get(`token:${token}`);
    if (!tokenEmail) {
      return c.json({ success: false, error: 'Token đã bị thu hồi' }, 401);
    }

    // Check role
    const userRole = payload.role || 'customer';
    if (!allowedRoles.includes(userRole)) {
      return c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403);
    }

    // Attach user info to context for downstream handlers
    c.set('user', {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: userRole,
    });

    await next();
  };
}
