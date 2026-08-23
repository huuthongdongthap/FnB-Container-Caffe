/**
 * Order State Machine — transition guards for the order lifecycle.
 *
 * Extracted from tree/orders/update-order.ts so transitions are unit-testable
 * and reusable (e.g. POS, KDS, kitchen stations) without re-deriving the graph.
 *
 * States are the canonical `orders.status` values. Terminal states (completed,
 * cancelled) have no outgoing transitions — any attempted move is rejected.
 */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'delivered'
  | 'completed'
  | 'cancelled';

/** from -> allowed next states. Terminal states map to an empty array. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'delivered', 'cancelled'],
  served: ['completed'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

/** States that, once reached, block all further status changes. */
export const TERMINAL_STATES: readonly OrderStatus[] = ['completed', 'cancelled'];

export interface TransitionResult {
  ok: boolean;
  error?: string;
}

/**
 * Validate a proposed status transition.
 * @param from current order status
 * @param to proposed new status
 * @returns ok:true on success, or ok:false with a machine-readable error.
 */
export function canTransition(from: string | null | undefined, to: string | null | undefined): TransitionResult {
  if (!to) return { ok: false, error: 'target status is required' };
  if (from === to) return { ok: true };
  const allowed = ORDER_TRANSITIONS[from as OrderStatus];
  if (!allowed) {
    return { ok: false, error: `Unknown current status: ${from}` };
  }
  if (allowed.includes(to as OrderStatus)) return { ok: true };
  return {
    ok: false,
    error: `Invalid transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none (terminal)'}`,
  };
}

/** True when the order is in a state that no longer changes. */
export function isTerminal(status: string | null | undefined): boolean {
  return TERMINAL_STATES.includes(status as OrderStatus);
}

/** States that represent a completed or voided order (used for reporting). */
export function isFinal(status: string | null | undefined): boolean {
  return isTerminal(status);
}
