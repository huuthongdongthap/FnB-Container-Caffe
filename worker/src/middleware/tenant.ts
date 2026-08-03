import type { MiddlewareHandler } from 'hono';

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

export const tenantMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user') as { id: string; email: string; role: string; tenantId?: string } | undefined;

  if (!user) {
    // Should not happen — auth middleware runs before this
    c.set('tenantId', 'default');
    return next();
  }

  const tenantId = user.tenantId ?? 'default';

  if (tenantId === 'default' && user.role === 'owner') {
    console.warn(`[tenant] User ${user.id} has no tenantId — defaulting to 'default'. Run tenant backfill.`);
  }

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
