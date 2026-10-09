/**
 * Order Transition Authorization — role-based guard layered on the state machine.
 *
 * `canTransition()` answers "is this move legal?". This module answers the
 * second question: "is this actor allowed to make it?".
 *
 * Roles are derived from the authenticated principal on the request. Guests
 * with no token act as `customer`; staff without an explicit role act as
 * `staff` (operational baseline).
 */

import { canTransition } from '../model/order-state-machine';
import type { TransitionResult } from '../model/order-state-machine';

export const ACTOR_ROLES = [
  'customer',
  'staff',
  'kitchen',
  'rider',
  'manager',
  'admin',
] as const;

export type ActorRole = (typeof ACTOR_ROLES)[number];

/** Operational moves staff/kitchen may perform, keyed by origin state. */
const STAFF_TARGETS: Record<string, readonly string[]> = {
  pending: ['confirmed'],
  confirmed: ['preparing'],
  preparing: ['ready'],
  ready: ['served'],
  served: ['completed'],
};

/** Fulfilment moves a rider owns once the order has left the kitchen. */
const RIDER_TARGETS: Record<string, readonly string[]> = {
  ready: ['delivered'],
  delivered: ['completed'],
};

/** Kitchen stations only move work forward through prep, never billing states. */
const KITCHEN_TARGETS: Record<string, readonly string[]> = {
  confirmed: ['preparing'],
  preparing: ['ready'],
};

/**
 * Target states that void the order. Only the customer itself (before the
 * kitchen accepts the work) and privileged operators may reach them.
 */
const CANCELLED = 'cancelled';

function matches(table: Record<string, readonly string[]>, from: string, to: string): boolean {
  return (table[from] ?? []).includes(to);
}

/**
 * Decide whether `actorRole` may move an order from `from` to `to`.
 *
 * Structural legality is checked first, so a role can never authorize a
 * transition the state machine forbids.
 */
export function canActorTransition(
  actorRole: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
): TransitionResult {
  const structural = canTransition(from, to);
  if (!structural.ok) return structural;

  // No-op updates are always permitted; they change nothing.
  if (from === to) return { ok: true };

  const role = actorRole as ActorRole;
  const origin = from as string;
  const target = to as string;

  switch (role) {
    case 'admin':
    case 'manager':
      // Full operational override. Terminal states are already blocked above.
      return { ok: true };

    case 'staff':
      if (matches(STAFF_TARGETS, origin, target)) return { ok: true };
      if (target === CANCELLED && origin !== 'served' && origin !== 'delivered') {
        return { ok: true };
      }
      if ((target === 'failed' || target === 'expired') && origin !== 'served' && origin !== 'delivered') {
        return { ok: true };
      }
      return deny(role, origin, target);

    case 'kitchen':
      if (matches(KITCHEN_TARGETS, origin, target)) return { ok: true };
      if (target === CANCELLED && (origin === 'confirmed' || origin === 'preparing')) {
        return { ok: true };
      }
      return deny(role, origin, target);

    case 'rider':
      if (matches(RIDER_TARGETS, origin, target)) return { ok: true };
      return deny(role, origin, target);

    case 'customer':
    default:
      // A customer may only withdraw an order the kitchen has not started.
      if (target === CANCELLED && origin === 'pending') return { ok: true };
      return deny('customer', origin, target);
  }
}

function deny(role: ActorRole, from: string, to: string): TransitionResult {
  return { ok: false, error: `Role '${role}' may not transition ${from} → ${to}` };
}

/**
 * Aliases used elsewhere in the platform that map onto order-domain roles.
 * `owner` carries operator-level override; `waiter` is floor staff.
 */
const ROLE_ALIASES: Record<string, ActorRole> = {
  system: 'admin',
  owner: 'admin',
  waiter: 'staff',
  cashier: 'staff',
  barista: 'kitchen',
  chef: 'kitchen',
  driver: 'rider',
  delivery: 'rider',
};

/**
 * Narrow an arbitrary request-supplied string to a known actor role.
 *
 * Unknown or missing values fall back to `customer`, the least-privileged role,
 * so an unrecognized claim can never widen access.
 */
export function toActorRole(value: string | null | undefined): ActorRole {
  if (!value) return 'customer';
  const normalized = String(value).trim().toLowerCase();
  if (ACTOR_ROLES.includes(normalized as ActorRole)) return normalized as ActorRole;
  return ROLE_ALIASES[normalized] ?? 'customer';
}
