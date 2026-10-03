import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';
import { createLogger } from './logger';

const log = createLogger({ route: 'tenant' });

/**
 * Check if the authenticated user is an HQ Super-Admin.
 * HQ super-admins have role 'owner' and are bound to 'default', 'hq', or unbound.
 */
export function isHQSuperAdmin(user?: { role?: string; tenantId?: string } | null): boolean {
  if (!user) return false;
  return user.role === 'owner' && (!user.tenantId || user.tenantId === 'default' || user.tenantId === 'hq');
}

/**
 * Tenant middleware — resolves tenantId ONLY from the signed JWT
 * (propagated by auth middleware via c.set('user')).
 *
 * Tenant identity is a server-side fact derived from the verified token.
 * If user is an HQ super-admin, allows querying specific franchise tenants
 * via ?tenant_id query param or x-tenant-id header (including '*' for global aggregate).
 * Non-HQ users are strictly confined to user.tenantId, preventing IDOR.
 *
 * If tenantId is missing (staff/legacy users without tenant binding):
 *   - Falls back to 'default' to avoid null pointer issues
 *   - Logs warning for ops visibility
 */

export const tenantMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const user = c.get('user');

  if (!user) {
    // Route is behind requireAuth() in practice; defensive default only.
    c.set('tenantId', 'default');
    return next();
  }

  if (isHQSuperAdmin(user)) {
    const requestedTenant = c.req.query('tenant_id') || c.req.header('x-tenant-id');
    if (requestedTenant) {
      c.set('tenantId', requestedTenant);
      return next();
    }
  }

  if (!user.tenantId) {
    log.warn(`User ${user.id} has no tenant binding — falling back to 'default'`);
  }

  c.set('tenantId', user.tenantId ?? 'default');
  await next();
};

/**
 * Helper to get tenantId from context in route handlers.
 * Usage: const tenantId = getTenantId(c);
 */
export function getTenantId(c: { get: (_key: string) => unknown }): string {
  return (c.get('tenantId') as string) ?? 'default';
}
