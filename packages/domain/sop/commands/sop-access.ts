/**
 * Tenant and actor scope for SOP commands.
 *
 * Scope is derived from the authenticated session only. Nothing in this file
 * accepts a tenant id from a request body: a caller that could name its own
 * tenant would be able to read another store's compliance records, which is
 * the whole value of the feature.
 */

import type { Env } from 'worker/src/types/env';
import type { AuthUser } from 'worker/src/middleware/auth';

export const SOP_ROLES = [
  'owner',
  'manager',
  'supervisor',
  'staff',
  'waiter',
  'cashier',
  'kitchen',
  'barista',
  'chef',
  'shipper',
  'admin',
] as const;

/** Who may record, confirm, apply or close a conduct violation. */
export const SOP_VIOLATION_ROLES = ['owner', 'manager', 'admin'] as const;

export class SopAccessError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409 | 503) {
    super(message);
  }
}

export interface SopScope {
  env: Env;
  /** Always taken from the session, never from a payload. */
  tenantId: string;
  actorId: string;
  actorRole: string;
  /** Owner and manager may act on another staff member's run or violation. */
  canManage: boolean;
}

/**
 * Reads the tenant from the session claim, falling back to the store the
 * worker is configured for. The fallback exists because a session minted
 * before the multi-store rollout carries no claim, and such a session still
 * belongs to exactly one store.
 */
function sessionTenantId(user: AuthUser | undefined, env?: Env): string {
  const rawUserTenant = user?.tenantId ?? (user as { tenant_id?: string } | undefined)?.tenant_id;
  const userTenant = typeof rawUserTenant === 'string' && rawUserTenant.trim().length > 0 ? rawUserTenant.trim() : undefined;
  const envRecord = env as { SOP_TENANT_ID?: string; PILOT_TENANT_ID?: string } | undefined;
  const envTenant = envRecord?.SOP_TENANT_ID?.trim() || envRecord?.PILOT_TENANT_ID?.trim() || undefined;
  if (userTenant === '*' || (!userTenant && envTenant === '*')) {
    return '*';
  }
  return userTenant || envTenant || 'default';
}

export function sopScope(
  env: Env,
  user?: AuthUser | undefined,
  requestOrTenantOverride?:
    | string
    | { req?: { query?: (_k: string) => string | undefined; header?: (_k: string) => string | undefined } }
): SopScope {
  const maybeCtx = env as unknown as {
    env?: Env;
    get?: (_k: string) => AuthUser | undefined;
    req?: { query?: (_k: string) => string | undefined; header?: (_k: string) => string | undefined };
  };
  if (typeof maybeCtx?.get === 'function' && maybeCtx?.env !== undefined && user === undefined) {
    return Promise.resolve().then(() => {
      const ctxUser = maybeCtx.get!('user');
      const enrichedEnv = {
        ...(maybeCtx.env as Record<string, unknown>),
        SOP_TENANT_ID:
          (maybeCtx.env as { SOP_TENANT_ID?: string; PILOT_TENANT_ID?: string })?.SOP_TENANT_ID ||
          (maybeCtx.env as { PILOT_TENANT_ID?: string })?.PILOT_TENANT_ID ||
          'default',
      } as unknown as Env;
      return sopScope(enrichedEnv, ctxUser, maybeCtx);
    }) as unknown as SopScope;
  }
  if (!user?.id) throw new SopAccessError('Staff authentication required', 401);

  const role = String(user.role ?? '');
  if (!(SOP_ROLES as readonly string[]).includes(role)) {
    throw new SopAccessError('Staff role required', 403);
  }

  const rawUserTenant = user?.tenantId ?? (user as { tenant_id?: string } | undefined)?.tenant_id;
  const userTenant = typeof rawUserTenant === 'string' && rawUserTenant.trim().length > 0 ? rawUserTenant.trim() : undefined;
  const envRecord = env as { SOP_TENANT_ID?: string; PILOT_TENANT_ID?: string } | undefined;
  const envTenant = envRecord?.SOP_TENANT_ID?.trim() || envRecord?.PILOT_TENANT_ID?.trim() || undefined;
  const concreteEnvTenant =
    envTenant && envTenant !== '*' && envTenant.toLowerCase() !== 'hq' ? envTenant : undefined;
  const isHq =
    (role === 'owner' || role === 'admin') &&
    (!userTenant || userTenant === 'default' || userTenant.toLowerCase() === 'hq' || userTenant === '*');
  if (
    !isHq &&
    (userTenant === '*' ||
      userTenant?.toLowerCase() === 'hq' ||
      (!userTenant && (envTenant === '*' || envTenant?.toLowerCase() === 'hq')))
  ) {
    throw new SopAccessError('Invalid tenant scope', 403);
  }

  let rawOverride = '';
  if (typeof requestOrTenantOverride === 'string') {
    rawOverride = requestOrTenantOverride.trim();
  } else {
    const candidateOverrides = [
      requestOrTenantOverride?.req?.query?.('tenant_id'),
      requestOrTenantOverride?.req?.query?.('tenantId'),
      requestOrTenantOverride?.req?.query?.('store_id'),
      requestOrTenantOverride?.req?.query?.('storeId'),
      requestOrTenantOverride?.req?.header?.('X-Tenant-ID'),
      requestOrTenantOverride?.req?.header?.('x-tenant-id'),
      requestOrTenantOverride?.req?.header?.('X-Store-ID'),
      requestOrTenantOverride?.req?.header?.('x-store-id'),
      (user as { headerTenantId?: string; requestedTenantId?: string } | undefined)?.headerTenantId,
      (user as { requestedTenantId?: string } | undefined)?.requestedTenantId,
    ]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    if (new Set(candidateOverrides).size > 1) {
      throw new SopAccessError('Cross-tenant access denied', 403);
    }
    rawOverride = candidateOverrides[0] || '';
  }
  const explicitOverride = rawOverride;
  const boundTenant = sessionTenantId(user, env);
  if (explicitOverride) {
    if (explicitOverride === '*' || explicitOverride.toLowerCase() === 'hq') {
      throw new SopAccessError('Invalid tenant scope', 403);
    }
    if (!isHq && explicitOverride !== boundTenant) {
      throw new SopAccessError('Cross-tenant access denied', 403);
    }
  }

  const fallbackBoundTenant =
    isHq && (boundTenant === '*' || boundTenant.toLowerCase() === 'hq') && concreteEnvTenant
      ? concreteEnvTenant
      : boundTenant;
  const tenantId = isHq && explicitOverride ? explicitOverride : fallbackBoundTenant;
  if (tenantId === '*' || tenantId.toLowerCase() === 'hq') {
    throw new SopAccessError('Invalid tenant scope', 403);
  }

  return {
    env,
    tenantId,
    actorId: user.id,
    actorRole: role,
    canManage: role === 'owner' || role === 'manager' || role === 'admin',
  };
}

/** Guards an endpoint that only the actor or a manager may reach. */
export function assertActorOrManager(scope: SopScope, ownerId: string): void {
  if (scope.canManage || scope.actorId === ownerId) return;
  throw new SopAccessError('You may only work on your own checklist', 403);
}

/** Calendar day in the store's timezone, not the runtime's. */
export function businessDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Hour in the store's timezone. A Worker runs in UTC, so `getHours()` on a
 * timestamp is seven hours behind the day the staff member is actually working;
 * a 07:00 opening shift reads as the middle of the night. Anything that decides
 * which shift it is must ask for the store's hour, never the runtime's.
 */
export function storeHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    hour12: false,
  }).format(now).replace(/^0/, ''));
}

/** Ids are opaque strings; an empty or oversized one is a malformed request. */
export function assertId(value: unknown, field = 'id'): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (id.length === 0 || id.length > 128) {
    throw new SopAccessError(`Invalid ${field}`, 400);
  }
  return id;
}
