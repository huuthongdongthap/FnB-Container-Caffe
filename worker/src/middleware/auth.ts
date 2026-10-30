/** JWT + D1 Staff session verification and role-based access control. */
import type { Env } from '../types/env';
import { authenticateRequest } from '../lib/staff-session-auth';
import { StaffSessionError } from '../lib/staff-session';
import { getAuthToken } from '../lib/jwt';

export { authenticateRequest };

export interface AuthUser {
  id: string; email: string; name: string;
  role: 'customer' | 'staff' | 'waiter' | 'manager' | 'owner' | 'admin' | 'cashier' | 'kitchen' | 'barista' | 'chef';
  tenantId?: string; tier?: string;
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
function toUser(payload: { id: string; email: string; name: string; role: string; tenantId?: string; tier?: string }): AuthUser {
  return { id: payload.id, email: payload.email || '', name: payload.name || '',
    role: (payload.role || 'customer') as AuthUser['role'], tenantId: payload.tenantId, tier: payload.tier };
}
export function requireAuth(allowedRoles: string[] = ['owner', 'staff']): import('hono').MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const env = c.env as Env;
    const isProd = env?.ENVIRONMENT === 'production' || (env as Record<string, unknown>)?.NODE_ENV === 'production';
    const allowTestHarness = !isProd && (
      (env as Record<string, unknown>)?.ALLOW_PLAYWRIGHT_TEST_HEADER === 'true' ||
      env?.ENVIRONMENT === 'development' ||
      env?.ENVIRONMENT === 'test'
    );
    const testHeader = (typeof c?.req?.header === 'function' ? c.req.header('x-playwright-test') : null)
      ?? (c?.req?.raw?.headers?.get?.('x-playwright-test') ?? null);
    const isPlaywright = allowTestHarness && testHeader === 'true' && allowedRoles.includes('staff');

    if (isPlaywright) {
      c.set('user', {
        id: 'staff-e2e-smoke',
        email: 'smoke@auraspace.cafe',
        name: 'Smoke Test Staff',
        role: 'staff',
        tenantId: 'default'
      });
      return next();
    }

    if (!env.JWT_SECRET) return c.json({ success: false, error: 'Server misconfiguration: JWT_SECRET not set' }, 500);
    if (!getAuthToken(c.req.raw)) return c.json({ success: false, error: 'Unauthorized — vui lòng đăng nhập', code: 'SESSION_EXPIRED' }, 401);
    try {
      const session = await authenticateRequest(c.req.raw, env);
      if (!session) return c.json({ success: false, error: 'Unauthorized — vui lòng đăng nhập' }, 401);
      if ('blocked' in session) return c.json({ success: false, error: session.blocked }, 403);
      const user = toUser(session.payload);
      if (!allowedRoles.includes(user.role)) return c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403);
      c.set('user', user);
    } catch (error) {
      if (error instanceof StaffSessionError) return c.json({ success: false, error: error.message, code: error.code }, error.status);
      return c.json({ success: false, error: 'Authentication unavailable' }, 503);
    }
    await next();
  };
}
/** Missing credentials allow a guest; a rejected presented session never becomes a guest. */
export function optionalAuth(): import('hono').MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    try {
      const session = await authenticateRequest(c.req.raw, c.env, { optional: true });
      if (session && 'blocked' in session) return c.json({ success: false, error: session.blocked }, 403);
      if (session && 'payload' in session) c.set('user', toUser(session.payload));
    } catch (error) {
      if (error instanceof StaffSessionError) return c.json({ success: false, error: error.message, code: error.code }, error.status);
      return c.json({ success: false, error: 'Authentication unavailable' }, 503);
    }
    await next();
  };
}
