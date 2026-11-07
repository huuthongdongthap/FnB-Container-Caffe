import type { Context, Next } from 'hono';
import type { Env } from '../../types/env';
import { isHQSuperAdmin } from '../../middleware/tenant';
import {
  requireAdmin as baseRequireAdmin,
  requireVendor as baseRequireVendor,
} from './middleware';

export function getSubscriptionTenantCandidates(c: Context<{ Bindings: Env }>): {
  headerCandidates: string[];
  queryCandidates: string[];
  allCandidates: string[];
} {
  const authHeader = c.req?.header?.('Authorization') || c.req?.header?.('authorization') || '';
  const headerCandidates = [
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => Boolean(v && v !== authHeader && !/^bearer\s+/i.test(v)));
  const queryCandidates = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  const allCandidates = [...headerCandidates, ...queryCandidates];
  return { headerCandidates, queryCandidates, allCandidates };
}

export function hasConflictingSubscriptionTenantOverride(c: Context<{ Bindings: Env }>): boolean {
  const { allCandidates } = getSubscriptionTenantCandidates(c);
  return new Set(allCandidates).size > 1;
}

export function hasForbiddenCatalogTenantOverride(c: Context<{ Bindings: Env }>): boolean {
  if (hasConflictingSubscriptionTenantOverride(c)) {
    return true;
  }
  const user = (typeof c.get === 'function' ? c.get('user' as never) : undefined) as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  if (!user) {
    return false;
  }
  if (isHQSuperAdmin(user)) {
    return false;
  }
  const rawUserTenant = (user.tenantId ?? user.tenant_id ?? '').trim();
  if (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq') {
    return true;
  }
  const boundTenant = rawUserTenant || 'default';
  const { allCandidates } = getSubscriptionTenantCandidates(c);
  const reqOverride = allCandidates[0] || '';
  if (!reqOverride) {
    return false;
  }
  if (reqOverride === '*' || reqOverride.toLowerCase() === 'hq') {
    return true;
  }
  return reqOverride !== boundTenant;
}

export async function requireAdmin(c: Context<{ Bindings: Env }>): Promise<Response | null> {
  if (hasConflictingSubscriptionTenantOverride(c)) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  return baseRequireAdmin(c);
}

export async function requireVendor(c: Context<{ Bindings: Env }>): Promise<Response | null> {
  if (hasConflictingSubscriptionTenantOverride(c)) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  return baseRequireVendor(c);
}

export async function requireSubAdminMiddleware(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const err = await requireAdmin(c);
  if (err) return err;
  await next();
}

export async function requireSubAuthMiddleware(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const err = await requireVendor(c);
  if (err) return err;
  await next();
}
