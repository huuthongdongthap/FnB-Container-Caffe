/**
 * Canonical Customer Identity Ladder & Order Ownership Policy
 * Ladder: Anonymous Guest → Customer Identifier → Customer Profile → Member/Loyalty → CRM Profile
 */
import { normalizePhone, isPlausibleVnPhone } from '../helpers';

export type IdentityLadderStage = 'anonymous_guest' | 'customer_identifier' | 'customer_profile' | 'member_loyalty' | 'behavioral_crm';

export interface ActorContext { id?: string; role?: string; }

export interface OrderOwnershipResolution {
  customerId: string | null;
  stage: IdentityLadderStage;
  isGuest: boolean;
  resolvedVia: 'authenticated_user' | 'staff_override' | 'deterministic_identifier' | 'anonymous';
}

export interface ResolveOwnershipInput {
  actor?: ActorContext | null;
  clientSuppliedCustomerId?: string | null;
  customerPhone?: string | null;
  db?: { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: <T = unknown>() => Promise<T | null> } } };
}

export async function findCustomerByIdentifier(
  db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: <T = unknown>() => Promise<T | null> } } },
  phone: string
): Promise<string | null> {
  const digits = normalizePhone(phone);
  if (!isPlausibleVnPhone(digits)) return null;
  try {
    const idRow = await db.prepare(
      "SELECT customer_id FROM customer_identities WHERE identifier_type = 'phone' AND identifier_value = ? LIMIT 1"
    ).bind(digits).first<{ customer_id: string }>();
    if (idRow?.customer_id) return idRow.customer_id;

    const custRow = await db.prepare(
      'SELECT id FROM customers WHERE phone = ? OR phone = ? LIMIT 1'
    ).bind(digits, phone).first<{ id: string }>();
    if (custRow?.id) return custRow.id;
  } catch { /* Fallback for unseeded test DB */ }
  return null;
}

export async function resolveServerOrderOwnership(
  input: ResolveOwnershipInput
): Promise<OrderOwnershipResolution> {
  const { actor, clientSuppliedCustomerId, customerPhone, db } = input;
  const role = actor?.role;

  if (role && ['owner', 'manager', 'staff'].includes(role)) {
    if (clientSuppliedCustomerId) {
      return { customerId: clientSuppliedCustomerId, stage: 'customer_profile', isGuest: false, resolvedVia: 'staff_override' };
    }
    if (customerPhone && db) {
      const existing = await findCustomerByIdentifier(db, customerPhone);
      if (existing) {
        return { customerId: existing, stage: 'customer_profile', isGuest: false, resolvedVia: 'deterministic_identifier' };
      }
    }
    return { customerId: null, stage: 'anonymous_guest', isGuest: true, resolvedVia: 'staff_override' };
  }

  if (role === 'customer' && actor?.id) {
    return { customerId: actor.id, stage: 'member_loyalty', isGuest: false, resolvedVia: 'authenticated_user' };
  }

  if (customerPhone && db) {
    const existing = await findCustomerByIdentifier(db, customerPhone);
    if (existing) {
      return { customerId: existing, stage: 'customer_profile', isGuest: false, resolvedVia: 'deterministic_identifier' };
    }
    return { customerId: null, stage: 'customer_identifier', isGuest: true, resolvedVia: 'anonymous' };
  }

  return { customerId: null, stage: 'anonymous_guest', isGuest: true, resolvedVia: 'anonymous' };
}

export function canAccessOrder(
  actor: ActorContext | null | undefined,
  order: { id: string; customer_id?: string | null }
): { allowed: boolean; reason?: string } {
  const role = actor?.role;
  if (role && ['owner', 'manager', 'staff'].includes(role)) {
    return { allowed: true };
  }
  if (role === 'customer' && actor?.id) {
    if (!order.customer_id || order.customer_id === actor.id) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Unauthorized access to customer order' };
  }
  if (!actor || !actor.id) {
    if (!order.customer_id) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'This order belongs to a registered customer. Please sign in.' };
  }
  return { allowed: false, reason: 'Forbidden' };
}

export interface ClaimGuestOrderInput {
  db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: <T = unknown>() => Promise<T | null>; run: () => Promise<unknown> } } };
  orderId: string;
  actor: ActorContext | null | undefined;
}

export interface ClaimGuestOrderResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  orderId?: string;
  customerId?: string;
  idempotent?: boolean;
}

export async function claimGuestOrder(input: ClaimGuestOrderInput): Promise<ClaimGuestOrderResult> {
  const { db, orderId, actor } = input;
  if (!actor || !actor.id || (actor.role !== 'customer' && !['owner', 'manager', 'staff'].includes(actor.role || ''))) {
    return { success: false, error: 'Unauthorized: authentication required to claim an order', statusCode: 401 };
  }

  const order = await db.prepare(
    'SELECT id, customer_id, total, order_type FROM orders WHERE id = ?'
  ).bind(orderId).first<{ id: string; customer_id?: string | null; total?: number; order_type?: string }>();

  if (!order) {
    return { success: false, error: 'Order not found', statusCode: 404 };
  }

  if (order.customer_id === actor.id) {
    return { success: true, idempotent: true, orderId, customerId: actor.id };
  }

  if (order.customer_id && order.customer_id !== actor.id) {
    return { success: false, error: 'Order already belongs to another registered customer', statusCode: 403 };
  }

  const now = new Date().toISOString();
  await db.prepare('UPDATE orders SET customer_id = ?, updated_at = ? WHERE id = ?').bind(actor.id, now, orderId).run();

  try {
    await db.prepare(
      'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      `cev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      actor.id, 'OrderLinked',
      JSON.stringify({ order_id: orderId, total: order.total ?? null, order_type: order.order_type ?? null }),
      now
    ).run();
  } catch { /* best-effort non-blocking event log */ }

  try {
    await db.prepare(
      'INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      `audit_${Date.now()}`, actor.id, 'order_claimed', 'order', orderId,
      JSON.stringify({ previous_customer_id: null, claimed_by: actor.id }), now
    ).run();
  } catch { /* best-effort non-blocking audit */ }

  return { success: true, orderId, customerId: actor.id };
}
