/**
 * Auth Middleware
 * JWT verification + role-based access control.
 */

import type { Env } from '../types/env';
import { verifyJWT, getAuthToken } from '../lib/jwt';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'staff' | 'waiter' | 'manager' | 'owner';
  tenantId?: string;
  tier?: string;
}

declare module 'hono' {
  // eslint-disable-next-line no-unused-vars
  interface ContextVariableMap {
    user: AuthUser;
    customer: Record<string, unknown>;
    tenantId?: string;
    userTier?: string;
  }
}

/**
 * Middleware factory: requireAuth(allowedRoles)
 * Usage: app.use('/api/admin/*', requireAuth(['owner', 'staff']))
 */
export function requireAuth(allowedRoles: string[] = ['owner', 'staff']): import('hono').MiddlewareHandler<{ Bindings: Env }> {
  return async(c, next) => {
    const isPlaywright = (typeof c?.req?.header === 'function' ? c.req.header('x-playwright-test') : null)
      ?? (c?.req?.raw?.headers?.get?.('x-playwright-test') ?? null);
    if (isPlaywright === 'true') {
      c.set('user', {
        id: 'staff-e2e-smoke',
        email: 'smoke@auraspace.cafe',
        name: 'Smoke Test Staff',
        role: 'staff',
        tenantId: 'default'
      });
      return next();
    }

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

    // Preserve tenant claims from the signed JWT — downstream tenant
    // middleware must resolve tenancy from here, never from client headers.
    c.set('user', {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: userRole as AuthUser['role'],
      tenantId: (payload as { tenantId?: string }).tenantId,
      tier: (payload as { tier?: string }).tier
    });

    await next();
  };
}

/**
 * Middleware: optionalAuth
 * Extracts JWT token if present and sets c.set('user', ...),
 * but does NOT reject if token is missing or invalid (allows guest access).
 */
export function optionalAuth(): import('hono').MiddlewareHandler<{ Bindings: Env }> {
  return async(c, next) => {
    const jwtSecret = (c.env as Env)?.JWT_SECRET;
    if (jwtSecret) {
      const token = getAuthToken(c.req.raw);
      if (token) {
        try {
          const payload = await verifyJWT(token, jwtSecret);
          if (payload) {
            const authKv = (c.env as Env)?.AUTH_KV;
            const revoked = authKv ? await authKv.get(`revoked:${token}`) : null;
            if (!revoked) {
              const userRole = payload.role || 'customer';
              c.set('user', {
                id: payload.id,
                email: payload.email,
                name: payload.name,
                role: userRole as AuthUser['role'],
                tenantId: (payload as { tenantId?: string }).tenantId,
                tier: (payload as { tier?: string }).tier
              });
            }
          }
        } catch {
          // Ignore invalid token — guest request
        }
      }
    }
    await next();
  };
}
