import type { Env } from 'worker/src/types/env';
import type { AuthUser } from 'worker/src/middleware/auth';
import { requireStaffAccount, type StaffAccount } from 'worker/src/lib/staff-session';
import { resolvePilotStore } from 'worker/src/lib/pilot-store';

export class ShiftContractError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 | 503) { super(message); }
}
export interface ShiftScope { env: Env; tenantId: string; actor: StaffAccount; canManage: boolean }
export async function shiftScope(env: Env, user: AuthUser | undefined): Promise<ShiftScope> {
  if (!user) throw new ShiftContractError('Staff authentication required', 403);
  const hasExplicitPilot = env.PILOT_TENANT_ID !== undefined || env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production';
  const pilotTenant = hasExplicitPilot ? resolvePilotStore(env) : undefined;
  const actor = await requireStaffAccount(env.AURA_DB, user.id);
  const actorTenant = typeof actor.tenant_id === 'string' ? actor.tenant_id.trim() : '';
  if (
    !actorTenant ||
    actorTenant === '*' ||
    actorTenant === 'hq' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(actorTenant) ||
    (pilotTenant !== undefined && actorTenant !== pilotTenant)
  ) {
    throw new ShiftContractError('Attendance is unavailable for this store', 403);
  }
  const tenantId = pilotTenant ?? actorTenant;
  const allowedRoles = hasExplicitPilot
    ? ['owner', 'manager', 'supervisor']
    : ['owner', 'manager', 'supervisor', 'admin'];
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
  const accountTenant = (typeof account.tenant_id === 'string' ? account.tenant_id.trim() : '') || 'default';
  if (accountTenant !== scope.tenantId) throw new ShiftContractError('Staff not found', 404);
  return account;
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
