import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';

/**
 * Tenant middleware — injects tenantId into context from authenticated user.
 *
 * Expected user payload (set by auth middleware):
 *   { id, email, role, tenantId?: string }
 *
 * If tenantId is missing (legacy users, migration in progress):
 *   - Sets tenantId to 'default' to avoid null pointer issues
 *   - Logs warning for ops visibility
 */

export const tenantMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  // Header-first resolution: frontend sends X-Tenant-Id after tenant creation
  const hdr = c.req.header('X-Tenant-Id');
  if (hdr) {
    c.set('tenantId', hdr);
    return next();
  }

  const user = c.get('user') as { id: string; email: string; role: string; tenantId?: string } | undefined;

  if (!user) {
    c.set('tenantId', 'default');
    return next();
  }

  const tenantId = user.tenantId ?? 'default';
  c.set('tenantId', tenantId);
  await next();
};

/**
 * Helper to get tenantId from context in route handlers.
 * Usage: const tenantId = getTenantId(c);
 */
export function getTenantId(c: { get: (key: string) => unknown }): string {
  return (c.get('tenantId') as string) ?? 'default';
}
