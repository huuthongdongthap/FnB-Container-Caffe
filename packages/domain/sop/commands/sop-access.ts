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
  'staff',
  'waiter',
  'cashier',
  'kitchen',
  'barista',
  'chef',
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
function sessionTenantId(user: AuthUser | undefined): string {
  const claimed = typeof user?.tenantId === 'string' ? user.tenantId.trim() : '';
  return claimed.length > 0 ? claimed : 'default';
}

export function sopScope(env: Env, user: AuthUser | undefined): SopScope {
  if (!user?.id) throw new SopAccessError('Staff authentication required', 401);

  const configured = (env as { SOP_TENANT_ID?: string }).SOP_TENANT_ID?.trim();
  const tenantId = configured && configured.length > 0 ? configured : sessionTenantId(user);
  const role = String(user.role ?? '');

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
