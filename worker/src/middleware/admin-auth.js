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
    // Guard: JWT_SECRET must be configured
    if (!c.env.JWT_SECRET) {
      return c.json({ success: false, error: 'Server misconfiguration: JWT_SECRET not set' }, 500);
    }

    const token = getAuthToken(c.req.raw);

    if (!token) {
      return c.json({ success: false, error: 'Unauthorized \u2014 vui l\u00f2ng \u0111\u0103ng nh\u1eadp' }, 401);
    }

    // Verify JWT signature + expiry (stateless — no allowlist KV read)
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: 'Token kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c \u0111\u00e3 h\u1ebft h\u1ea1n' }, 401);
    }

    // Denylist check — only hit KV when a logout has occurred for this token
    const revoked = await c.env.AUTH_KV.get(`revoked:${token}`);
    if (revoked) {
      return c.json({ success: false, error: 'Token \u0111\u00e3 b\u1ecb thu h\u1ed3i' }, 401);
    }

    // Check role
    const userRole = payload.role || 'customer';
    if (!allowedRoles.includes(userRole)) {
      return c.json({ success: false, error: 'Kh\u00f4ng \u0111\u1ee7 quy\u1ec1n truy c\u1eadp' }, 403);
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
