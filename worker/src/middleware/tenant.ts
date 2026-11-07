import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';
import { createLogger } from './logger';
import { writeTenantOverrideAudit } from './audit-log';
import { resolvePilotStore as resolveStrictPilotStore } from '../lib/pilot-store';
export { matchesTenantRow } from '../lib/db';

export function resolvePilotStore(env?: { [key: string]: unknown } | Env | null): string {
  if (!env) return 'default';
  try {
    return resolveStrictPilotStore(env as unknown as { [key: string]: unknown });
  } catch {
    const raw = typeof (env as Record<string, unknown>).PILOT_TENANT_ID === 'string'
      ? String((env as Record<string, unknown>).PILOT_TENANT_ID).trim()
      : '';
    return raw && raw !== '*' && raw !== 'hq' ? raw : 'default';
  }
}

const log = createLogger({ route: 'tenant' });

/**
 * Check if the authenticated user is an HQ Super-Admin.
 * HQ super-admins have role 'owner' or 'admin' and are explicitly bound to 'hq' or '*'.
 */
export function isHQSuperAdmin(user?: { role?: string; tenantId?: string; tenant_id?: string; get?: (_k: string) => unknown } | null): boolean {
  const resolved = typeof user?.get === 'function'
    ? (user.get('user') as { role?: string; tenantId?: string; tenant_id?: string } | null | undefined)
    : user;
  if (!resolved) return false;
  const role = (resolved.role || '').trim().toLowerCase();
  if (role !== 'owner' && role !== 'admin') return false;
  const rawTenant =
    (typeof resolved.tenantId === 'string' && resolved.tenantId.trim())
      ? resolved.tenantId
      : resolved.tenant_id;
  const userTenant = typeof rawTenant === 'string' ? rawTenant.trim().toLowerCase() : '';
  return userTenant === 'hq' || userTenant === '*';
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

  const rawUserTenant = (user as { tenantId?: string; tenant_id?: string }).tenantId ?? (user as { tenantId?: string; tenant_id?: string }).tenant_id;
  const userTenant = (typeof rawUserTenant === 'string' ? rawUserTenant.trim() : '') || 'default';
  if (isHQSuperAdmin(user)) {
    const requestedTenant = (
      c.req.query('tenant_id') ||
      c.req.query('tenantId') ||
      c.req.query('store_id') ||
      c.req.query('storeId') ||
      c.req.header('x-tenant-id') ||
      c.req.header('X-Tenant-ID') ||
      c.req.header('x-store-id') ||
      c.req.header('X-Store-ID') ||
      ''
    ).trim() || undefined;
    if (requestedTenant && requestedTenant.toLowerCase() !== userTenant.toLowerCase()) {
      // Privileged cross-tenant read — leave a durable trail before scoping.
      const normalizedTarget = requestedTenant.toLowerCase() === 'hq' ? '*' : requestedTenant;
      writeTenantOverrideAudit(c, user, rawUserTenant, normalizedTarget);
      c.set('tenantId', normalizedTarget);
      return next();
    }
    c.set('tenantId', userTenant.toLowerCase() === 'hq' ? '*' : userTenant);
    return next();
  }

  if (!rawUserTenant?.trim()) {
    log.warn(`User ${user.id} has no tenant binding — falling back to 'default'`);
  }

  c.set('tenantId', userTenant);
  await next();
};

/**
 * Helper to get tenantId from context in route handlers.
 * Enforces JWT tenant confinement when c.get('user') is present:
 * only HQ super-admins may override tenancy via ?tenant_id or x-tenant-id.
 * Usage: const tenantId = getTenantId(c);
 */
export function getTenantId(c: {
  get?: (_key: string) => unknown;
  env?: unknown;
  req?: { method?: string; path?: string; query?: (_k: string) => string | undefined; header?: (_k: string) => string | undefined };
}): string {
  if (typeof c?.get !== 'function') {
    return 'default';
  }
  const explicitTenant = (c.get('tenantId') as string | undefined)?.trim();
  if (explicitTenant) {
    if (
      (explicitTenant === '*' || explicitTenant.toLowerCase() === 'hq') &&
      isHQSuperAdmin(c as unknown as Parameters<typeof isHQSuperAdmin>[0])
    ) {
      const requestedOverride = (
        c.req?.query?.('tenant_id') ||
        c.req?.query?.('tenantId') ||
        c.req?.query?.('store_id') ||
        c.req?.query?.('storeId') ||
        c.req?.header?.('x-tenant-id') ||
        c.req?.header?.('X-Tenant-ID') ||
        c.req?.header?.('x-store-id') ||
        c.req?.header?.('X-Store-ID') ||
        ''
      ).trim();
      if (requestedOverride && requestedOverride !== '*' && requestedOverride.toLowerCase() !== 'hq') {
        return requestedOverride;
      }
      return '*';
    }
    return explicitTenant;
  }

  const user = c.get('user') as { id?: string; name?: string; email?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (user) {
    const rawUserTenant = user.tenantId ?? user.tenant_id;
    const userTenant = (typeof rawUserTenant === 'string' ? rawUserTenant.trim() : '') || 'default';
    if (isHQSuperAdmin(user)) {
      const requestedTenant = (
        c.req?.query?.('tenant_id') ||
        c.req?.query?.('tenantId') ||
        c.req?.query?.('store_id') ||
        c.req?.query?.('storeId') ||
        c.req?.header?.('x-tenant-id') ||
        c.req?.header?.('X-Tenant-ID') ||
        c.req?.header?.('x-store-id') ||
        c.req?.header?.('X-Store-ID') ||
        ''
      ).trim() || undefined;
      if (requestedTenant && requestedTenant.toLowerCase() !== userTenant.toLowerCase()) {
        const normalizedTarget = requestedTenant.toLowerCase() === 'hq' ? '*' : requestedTenant;
        writeTenantOverrideAudit(c as Parameters<typeof writeTenantOverrideAudit>[0], user, rawUserTenant, normalizedTarget);
        return normalizedTarget;
      }
      return userTenant.toLowerCase() === 'hq' ? '*' : userTenant;
    }
    return userTenant;
  }

  return 'default';
}

/**
 * Resolves tenantId for public/guest-accessible routes that support optional staff auth.
 * Authenticated users use getTenantId(c); unauthenticated guests resolve from
 * explicit context tenantId, ?tenant_id query, X-Tenant-ID header, or PILOT_TENANT_ID.
 */
export function resolvePublicTenantId(c: Parameters<typeof getTenantId>[0]): string {
  if (c.get?.('user')) {
    return getTenantId(c);
  }
  const explicitCtx = c.get?.('tenantId') as string | undefined;
  if (explicitCtx && explicitCtx.trim() && explicitCtx.trim() !== '*' && explicitCtx.trim().toLowerCase() !== 'hq') {
    return explicitCtx.trim();
  }
  const raw = (
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  if (!raw || raw === '*' || raw.toLowerCase() === 'hq') {
    return resolvePilotStore(((c as unknown as { env?: Env }).env ?? {}) as Env);
  }
  return raw;
}

