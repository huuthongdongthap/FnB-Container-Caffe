import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';
import { createLogger } from './logger';

const log = createLogger({ route: 'tenant' });

/**
 * Tenant middleware — resolves tenantId ONLY from the signed JWT
 * (propagated by auth middleware via c.set('user')).
 *
 * Tenant identity is a server-side fact derived from the verified token.
 * Client-supplied headers (e.g. X-Tenant-Id) are never trusted: any logged-in
 * user could otherwise spoof another tenant and read its data.
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
export function getTenantId(c: { get: (key: string) => unknown }): string {
  return (c.get('tenantId') as string) ?? 'default';
}
