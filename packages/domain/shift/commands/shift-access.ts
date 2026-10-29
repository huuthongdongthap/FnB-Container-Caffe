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
  const tenantId = resolvePilotStore(env);
  const actor = await requireStaffAccount(env.AURA_DB, user.id);
  if (!actor.tenant_id || actor.tenant_id === '*' || actor.tenant_id !== tenantId) {
    throw new ShiftContractError('Attendance is unavailable for this store', 403);
  }
  return { env, tenantId, actor, canManage: ['owner', 'manager'].includes(actor.role) };
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
  if (account.tenant_id !== scope.tenantId) throw new ShiftContractError('Staff not found', 404);
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
