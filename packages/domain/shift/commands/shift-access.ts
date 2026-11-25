import type { Env } from 'worker/src/types/env';
import type { AuthUser } from 'worker/src/middleware/auth';
import { isStaffRole, loadStaffAccount, requireStaffAccount, type StaffAccount } from 'worker/src/lib/staff-session';

export class ShiftContractError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 503,
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export interface ShiftScope { env: Env; tenantId: string; actor: StaffAccount; canManage: boolean }

export interface ShiftRequestContextLike {
  req?: {
    query?: (key: string) => string | undefined;
    header?: (key: string) => string | undefined;
  };
}

export function extractRequestedShiftTenant(c: ShiftRequestContextLike | null | undefined): string {
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

/**
 * Multi-tenant shifts are enabled for every valid concrete store regardless of PILOT_TENANT_ID,
 * unless explicitly opted out via SHIFTS_DISABLED_TENANTS / ATTENDANCE_DISABLED_TENANTS or per-tenant settings.
 */
export async function isTenantShiftsOptedOut(
  env: Env | Record<string, unknown> | undefined,
  db: Env['AURA_DB'] | undefined,
  tenantId: string,
): Promise<boolean> {
  if (!tenantId || tenantId === '*' || tenantId.toLowerCase() === 'hq') return false;
  const envRecord = env as Record<string, unknown> | undefined;
  const rawDisabled = `${String(envRecord?.SHIFTS_DISABLED_TENANTS ?? '')},${String(envRecord?.ATTENDANCE_DISABLED_TENANTS ?? '')}`;
  const disabledTenants = rawDisabled
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (disabledTenants.includes(tenantId)) return true;

  if (!db) return false;
  try {
    const res = await db
      .prepare(
        `SELECT value FROM settings
         WHERE key IN ('shifts_enabled', 'attendance_enabled')
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') IN (?, 'default')
         ORDER BY CASE WHEN COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? THEN 0 ELSE 1 END
         LIMIT 1`,
      )
      .bind(tenantId, tenantId)
      .all<{ value: string }>();
    const resolved = res.results?.[0]?.value;
    if (resolved !== undefined && ['false', '0'].includes(String(resolved).trim().toLowerCase())) {
      return true;
    }
  } catch {
    // settings table absent or unreadable in minimal schemas → default enabled
  }
  return false;
}

export async function shiftScope(env: Env, user: AuthUser | undefined, requestedTenant?: string): Promise<ShiftScope> {
  if (!user) throw new ShiftContractError('Staff authentication required', 403);
  const cleanRequested = typeof requestedTenant === 'string' ? requestedTenant.trim() : '';
  if (cleanRequested === '__CONFLICT__') {
    throw new ShiftContractError('Cross-tenant shift access denied', 403);
  }
  const actor = await requireStaffAccount(env.AURA_DB, user.id);
  const rawActorTenant = typeof actor.tenant_id === 'string' ? actor.tenant_id.trim() : '';
  const isHqAdmin = (actor.role === 'owner' || actor.role === 'admin') && (rawActorTenant.toLowerCase() === 'hq' || rawActorTenant === '*');
  const normalizedActorTenant = rawActorTenant || 'default';
  if (!isHqAdmin && cleanRequested && (cleanRequested === '*' || cleanRequested.toLowerCase() === 'hq' || cleanRequested !== normalizedActorTenant)) {
    throw new ShiftContractError('Cross-tenant shift access denied', 403);
  }
  if (isHqAdmin) {
    if (cleanRequested && cleanRequested !== '*' && cleanRequested.toLowerCase() !== 'hq') {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(cleanRequested)) {
        throw new ShiftContractError('Attendance is unavailable for this store', 403);
      }
      if (await isTenantShiftsOptedOut(env, env.AURA_DB, cleanRequested)) {
        throw new ShiftContractError('Attendance is unavailable for this store', 403, 'TENANT_SHIFTS_DISABLED');
      }
      return { env, tenantId: cleanRequested, actor, canManage: true };
    }
    return { env, tenantId: '*', actor, canManage: true };
  }
  const actorTenant = normalizedActorTenant;
  if (
    !actorTenant ||
    actorTenant === '*' ||
    actorTenant.toLowerCase() === 'hq' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(actorTenant) ||
    (await isTenantShiftsOptedOut(env, env.AURA_DB, actorTenant))
  ) {
    throw new ShiftContractError('Attendance is unavailable for this store', 403);
  }
  const allowedRoles = SHIFT_MANAGERS;
  return { env, tenantId: actorTenant, actor, canManage: allowedRoles.includes(actor.role) };
}
export function managerScope(scope: ShiftScope) {
  if (!scope.canManage) throw new ShiftContractError('Owner or manager required', 403);
}
export async function shiftTarget(
  scope: ShiftScope,
  requested?: string,
  options?: { allowInactiveTarget?: boolean },
): Promise<StaffAccount> {
  const id = requested || scope.actor.id;
  if (id === '*' || (id !== scope.actor.id && !scope.canManage)) {
    throw new ShiftContractError('Only your own attendance is allowed', 403);
  }
  let account: StaffAccount;
  if (options?.allowInactiveTarget && scope.canManage) {
    const loaded = await loadStaffAccount(scope.env.AURA_DB, id);
    if (!loaded.ok || !isStaffRole(loaded.account.role)) {
      throw new ShiftContractError('Staff not found', 404);
    }
    account = loaded.account;
  } else {
    account = await requireStaffAccount(scope.env.AURA_DB, id);
  }
  const rawAccountTenant = typeof account.tenant_id === 'string' ? account.tenant_id.trim() : '';
  const isHqAccount =
    (account.role === 'owner' || account.role === 'admin') &&
    (rawAccountTenant === '*' || rawAccountTenant.toLowerCase() === 'hq');
  if (isHqAccount && account.id === scope.actor.id) {
    const effectiveHqTenant = scope.tenantId && scope.tenantId !== '*' ? scope.tenantId : 'default';
    return { ...account, tenant_id: effectiveHqTenant };
  }
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
export function shiftCalendarDateOffset(dateStr: string, offsetDays: number): string {
  const [yStr, mStr, dStr] = dateStr.split('-');
  const dt = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr) + offsetDays));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
export function shiftId(id: string): string {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new ShiftContractError('Invalid shift ID', 400);
  return id;
}
