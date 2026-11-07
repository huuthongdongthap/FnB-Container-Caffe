/**
 * Push notification role vocabulary.
 *
 * The subscribe path stores whatever role the client declares, and the send
 * paths query push_subscriptions with an exact-match role literal. Those two
 * strings are written in different files: when they drift, the query runs,
 * matches nothing, and returns `{ sent: 0, failed: 0 }` — no error, no log
 * line, no visible failure. One constant shared by both sides removes that
 * class of drift.
 */

/** Role a KDS/staff device subscribes with and the new-order send queries by. */
export const STAFF_PUSH_ROLE = 'staff-kitchen';

/** Role stored when a caller declares none, so the row still reads as staff. */
export const DEFAULT_STAFF_PUSH_ROLE = 'staff';

/** Roles that must never receive a staff-targeted send. */
export const CUSTOMER_PUSH_ROLE = 'customer';

/**
 * Rank of each staff role for subscription self-assignment checks. A caller
 * may only subscribe with a role at or below their own rank, so a `waiter`
 * cannot push-subscribe as `owner` and receive owner-only notifications.
 */
const STAFF_PUSH_ROLE_RANK: Record<string, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  supervisor: 40,
  staff: 20,
  waiter: 10,
  cashier: 15,
  kitchen: 10,
  [STAFF_PUSH_ROLE]: 10,
  barista: 10,
  chef: 20,
};

export function isStaffPushRole(role: string): boolean {
  return Object.prototype.hasOwnProperty.call(STAFF_PUSH_ROLE_RANK, role);
}

export function staffPushRoleRank(role: string): number {
  return STAFF_PUSH_ROLE_RANK[role] ?? 0;
}

/**
 * Resolve the role a staff subscription may store. Non-privileged callers are
 * confined to their own role or the generic `staff`; privileged callers
 * (owner/admin) may self-assign any role down to their own rank.
 */
export function resolveStaffPushRequestedRole(
  requestedRole: string | undefined,
  callerRole: string | undefined
): { ok: true; role: string } | { ok: false; error: string } {
  const caller = String(callerRole || '').trim().toLowerCase();
  const requested = String(requestedRole || '').trim().toLowerCase();
  if (!isStaffPushRole(caller)) {
    return { ok: false, error: 'Forbidden: staff role required for staff push subscriptions' };
  }
  if (!requested || requested === CUSTOMER_PUSH_ROLE) {
    return { ok: true, role: caller };
  }
  if (!isStaffPushRole(requested)) {
    return { ok: false, error: 'Forbidden: unknown staff push role' };
  }
  const isPrivileged = caller === 'owner' || caller === 'admin' || caller === 'manager' || caller === 'supervisor';
  if (!isPrivileged) {
    if (requested !== caller && requested !== DEFAULT_STAFF_PUSH_ROLE) {
      return { ok: false, error: 'Forbidden: staff cannot subscribe with an elevated role' };
    }
    return { ok: true, role: requested };
  }
  if (staffPushRoleRank(requested) > staffPushRoleRank(caller)) {
    return { ok: false, error: 'Forbidden: requested push role exceeds caller role' };
  }
  return { ok: true, role: requested };
}
