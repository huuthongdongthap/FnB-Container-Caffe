import type { Env } from 'worker/src/types/env';
import type { AuthUser } from 'worker/src/middleware/auth';
import { requireStaffAccount, type StaffAccount } from 'worker/src/lib/staff-session';
import { resolvePilotStore } from 'worker/src/lib/pilot-store';

export class ShiftContractError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 | 503) { super(message); }
}
export interface ShiftScope { env: Env; tenantId: string; actor: StaffAccount; canManage: boolean }

export function extractRequestedShiftTenant(c: any): string {
  const candidates = [
    c?.req?.query?.('tenant_id'),
    c?.req?.query?.('tenantId'),
    c?.req?.query?.('store_id'),
    c?.req?.query?.('storeId'),
    c?.req?.header?.('X-Tenant-ID'),
    c?.req?.header?.('x-tenant-id'),
    c?.req?.header?.('X-Store-ID'),
    c?.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidates).size > 1) {
    return '__CONFLICT__';
  }
  return candidates[0] || '';
}

export const SHIFT_MANAGERS = ['owner', 'manager', 'supervisor', 'admin'];
export const MANAGER_ROLES = SHIFT_MANAGERS;

export async function shiftScope(env: Env, user: AuthUser | undefined, requestedTenant?: string): Promise<ShiftScope> {
  if (!user) throw new ShiftContractError('Staff authentication required', 403);
  const cleanRequested = typeof requestedTenant === 'string' ? requestedTenant.trim() : '';
  if (cleanRequested === '__CONFLICT__') {
    throw new ShiftContractError('Cross-tenant shift access denied', 403);
  }
  const hasExplicitPilot = env.PILOT_TENANT_ID !== undefined || env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production';
  const pilotTenant = hasExplicitPilot ? resolvePilotStore(env) : undefined;
  const actor = await requireStaffAccount(env.AURA_DB, user.id);
  const rawActorTenant = typeof actor.tenant_id === 'string' ? actor.tenant_id.trim() : '';
  const isHqAdmin = (actor.role === 'owner' || actor.role === 'admin') && (rawActorTenant.toLowerCase() === 'hq' || rawActorTenant === '*');
  if (!isHqAdmin && cleanRequested && (cleanRequested === '*' || cleanRequested.toLowerCase() === 'hq' || cleanRequested !== rawActorTenant)) {
    throw new ShiftContractError('Cross-tenant shift access denied', 403);
  }
  if (isHqAdmin) {
    if (cleanRequested && cleanRequested !== '*' && cleanRequested.toLowerCase() !== 'hq') {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(cleanRequested)) {
        throw new ShiftContractError('Attendance is unavailable for this store', 403);
      }
      return { env, tenantId: cleanRequested, actor, canManage: true };
    }
    return { env, tenantId: '*', actor, canManage: true };
  }
  const actorTenant = rawActorTenant;
  if (
    !actorTenant ||
    actorTenant === '*' ||
    actorTenant.toLowerCase() === 'hq' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(actorTenant) ||
    (pilotTenant !== undefined && actorTenant !== pilotTenant)
  ) {
    throw new ShiftContractError('Attendance is unavailable for this store', 403);
  }
  const tenantId = pilotTenant ?? actorTenant;
  const allowedRoles = hasExplicitPilot ? ['owner', 'manager', 'supervisor'] : SHIFT_MANAGERS;
  return { env, tenantId, actor, canManage: allowedRoles.includes(actor.role) };
}
export function managerScope(scope: ShiftScope) {
  if (!scope.canManage) throw new ShiftContractError('Owner or manager required', 403);
}
export async function shiftTarget(scope: ShiftScope, requested?: string): Promise<StaffAccount> {
  const id = requested || scope.actor.id;
  if (id === '*' || (id !== scope.actor.id && !scope.canManage)) {
    throw new ShiftContractError('Only your own attendance is allowed', 403);
  }
  const account = await requireStaffAccount(scope.env.AURA_DB, id);
  const rawAccountTenant = typeof account.tenant_id === 'string' ? account.tenant_id.trim() : '';
  const accountTenant = !rawAccountTenant || rawAccountTenant === '*' || rawAccountTenant.toLowerCase() === 'hq' ? 'default' : rawAccountTenant;
  if (scope.tenantId !== '*' && accountTenant !== scope.tenantId) throw new ShiftContractError('Staff not found', 404);
  return { ...account, tenant_id: accountTenant };
}
export function shiftStaffFilter(scope: ShiftScope, requested?: string): string | undefined {
  if (requested === '*' || (!scope.canManage && requested && requested !== scope.actor.id)) {
    throw new ShiftContractError('Only your own attendance is allowed', 403);
  }
  return requested || (scope.canManage ? undefined : scope.actor.id);
}
export function businessDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function shiftId(id: string): string {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new ShiftContractError('Invalid shift ID', 400);
  return id;
}
