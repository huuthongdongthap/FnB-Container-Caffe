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
  tenantId?: string;
}

export async function findCustomerByIdentifier(
  db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: <T = unknown>() => Promise<T | null> } } },
  phone: string,
  tenantId?: string,
): Promise<string | null> {
  const digits = normalizePhone(phone);
  if (!isPlausibleVnPhone(digits)) return null;
  const scopedTenant = tenantId !== undefined && tenantId !== '*' ? (String(tenantId).trim() || 'default') : null;
  try {
    if (!scopedTenant) {
      const idRow = await db.prepare(
        "SELECT customer_id FROM customer_identities WHERE identifier_type = 'phone' AND identifier_value = ? LIMIT 1"
      ).bind(digits).first<{ customer_id: string }>();
      if (idRow?.customer_id) return idRow.customer_id;
    } else {
      try {
        const idRow = await db.prepare(
          "SELECT ci.customer_id FROM customer_identities ci JOIN customers c ON c.id = ci.customer_id WHERE ci.identifier_type = 'phone' AND ci.identifier_value = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(digits, scopedTenant).first<{ customer_id: string }>();
        if (idRow?.customer_id) return idRow.customer_id;
      } catch {
        const idRow = await db.prepare(
          "SELECT customer_id FROM customer_identities WHERE identifier_type = 'phone' AND identifier_value = ? LIMIT 1"
        ).bind(digits).first<{ customer_id: string }>();
        if (idRow?.customer_id) return idRow.customer_id;
      }
    }

    if (scopedTenant) {
      try {
        const custRow = await db.prepare(
          "SELECT id FROM customers WHERE (phone = ? OR phone = ?) AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
        ).bind(digits, phone, scopedTenant, scopedTenant).first<{ id: string }>();
        return custRow?.id ?? null;
      } catch { /* Fallback when customers lacks tenant_id */ }
    }
    const custRow = await db.prepare(
      'SELECT id FROM customers WHERE phone = ? OR phone = ? LIMIT 1'
    ).bind(digits, phone).first<{ id: string }>();
    if (custRow?.id) return custRow.id;
  } catch { /* Fallback for unseeded test DB */ }
  return null;
}

const PRIVILEGED_STAFF_ROLES = [
  'owner',
  'manager',
  'supervisor',
  'staff',
  'admin',
  'cashier',
  'waiter',
  'kitchen',
  'barista',
  'chef',
  'shipper',
];

export async function resolveServerOrderOwnership(
  input: ResolveOwnershipInput
): Promise<OrderOwnershipResolution> {
  const { actor, clientSuppliedCustomerId, customerPhone, db, tenantId } = input;
  const role = actor?.role;

  if (role && PRIVILEGED_STAFF_ROLES.includes(role)) {
    if (clientSuppliedCustomerId) {
      return { customerId: clientSuppliedCustomerId, stage: 'customer_profile', isGuest: false, resolvedVia: 'staff_override' };
    }
    if (customerPhone && db) {
      const existing = await findCustomerByIdentifier(db, customerPhone, tenantId);
      if (existing) {
        return { customerId: existing, stage: 'customer_profile', isGuest: false, resolvedVia: 'deterministic_identifier' };
      }
    }
    return { customerId: null, stage: 'anonymous_guest', isGuest: true, resolvedVia: 'staff_override' };
  }

  if (role === 'customer' && actor?.id) {
    return { customerId: actor.id, stage: 'member_loyalty', isGuest: false, resolvedVia: 'authenticated_user' };
  }

  // A public phone number is CRM input, not proof of account ownership.
  // Keep guest checkout payable without granting access to that phone owner's account.
  if (customerPhone) {
    return { customerId: null, stage: 'customer_identifier', isGuest: true, resolvedVia: 'anonymous' };
  }

  return { customerId: null, stage: 'anonymous_guest', isGuest: true, resolvedVia: 'anonymous' };
}

export function canAccessOrder(
  actor: ActorContext | null | undefined,
  order: { id: string; customer_id?: string | null }
): { allowed: boolean; reason?: string } {
  const role = actor?.role;
  if (role && PRIVILEGED_STAFF_ROLES.includes(role)) {
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

const PLACEHOLDER_PHONES = new Set([
  '',
  '0',
  '000000000',
  '0000000000',
  '00000000000',
  'guest',
  'anonymous',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  'walk-in',
  'walkin',
  'pos',
]);

function isNonPlaceholderPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const trimmed = String(phone).trim();
  if (!trimmed || PLACEHOLDER_PHONES.has(trimmed.toLowerCase())) return false;
  const digits = normalizePhone(trimmed);
  if (!digits || /^0+$/.test(digits) || PLACEHOLDER_PHONES.has(digits)) return false;
  return true;
}

export interface ClaimGuestOrderInput {
  db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: <T = unknown>() => Promise<T | null>; run: () => Promise<unknown> } } };
  orderId: string;
  actor: ActorContext | null | undefined;
  tenantId?: string;
  verificationType?: 'phone' | 'table' | string;
  verificationValue?: string | null;
}

export interface ClaimGuestOrderResult {
  success: boolean;
  ok?: boolean;
  error?: string;
  statusCode?: number;
  status?: number;
  orderId?: string;
  customerId?: string;
  idempotent?: boolean;
}

export async function claimGuestOrder(input: ClaimGuestOrderInput): Promise<ClaimGuestOrderResult> {
  const { db, orderId, actor, tenantId } = input;
  if (!actor || !actor.id || (actor.role !== 'customer' && !PRIVILEGED_STAFF_ROLES.includes(actor.role || ''))) {
    return { success: false, ok: false, error: 'Unauthorized: authentication required to claim an order', statusCode: 401, status: 401 };
  }

  type ClaimOrderRow = {
    id: string;
    customer_id?: string | null;
    customer_phone?: string | null;
    table_id?: string | null;
    total?: number;
    order_type?: string;
    tenant_id?: string | null;
  };
  let order: ClaimOrderRow | null = null;
  try {
    order = await db.prepare(
      'SELECT id, customer_id, customer_phone, table_id, total, order_type, tenant_id FROM orders WHERE id = ?'
    ).bind(orderId).first<ClaimOrderRow>();
  } catch {
    order = null;
  }
  if (!order) {
    try {
      order = await db.prepare(
        'SELECT id, customer_id, customer_phone, total, order_type FROM orders WHERE id = ?'
      ).bind(orderId).first<ClaimOrderRow>();
    } catch {
      order = null;
    }
  }
  if (!order) {
    order = await db.prepare(
      'SELECT id, customer_id, total, order_type FROM orders WHERE id = ?'
    ).bind(orderId).first<ClaimOrderRow>().catch(() => null);
  }

  if (!order) {
    return { success: false, ok: false, error: 'Order not found', statusCode: 404, status: 404 };
  }

  const effectiveTenant = tenantId !== undefined && tenantId !== '*' ? (String(tenantId).trim() || 'default') : null;
  if (effectiveTenant) {
    try {
      const tenantRow = 'tenant_id' in order && order.tenant_id !== undefined
        ? order
        : await db.prepare('SELECT tenant_id FROM orders WHERE id = ?').bind(orderId).first<{ tenant_id?: string | null }>();
      if (tenantRow && 'tenant_id' in tenantRow && tenantRow.tenant_id !== undefined) {
        const rowTenant = typeof tenantRow.tenant_id === 'string' && tenantRow.tenant_id.trim()
          ? tenantRow.tenant_id.trim()
          : 'default';
        if (rowTenant !== effectiveTenant) {
          return { success: false, ok: false, error: 'Order not found', statusCode: 404, status: 404 };
        }
      }
    } catch {
      // Allow fallback when minimal schema omits tenant_id
    }
  }

  if (order.customer_id === actor.id) {
    return { success: true, ok: true, status: 200, statusCode: 200, idempotent: true, orderId, customerId: actor.id };
  }

  if (order.customer_id && order.customer_id !== actor.id) {
    return { success: false, ok: false, error: 'Order already belongs to another registered customer', statusCode: 403, status: 403 };
  }

  if (actor.role === 'customer' && isNonPlaceholderPhone(order.customer_phone)) {
    const orderPhoneNorm = normalizePhone(String(order.customer_phone).trim());
    let customerPhoneNorm: string | null = null;
    try {
      const custRow = effectiveTenant
        ? await db.prepare(
            "SELECT phone FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
          ).bind(actor.id, effectiveTenant).first<{ phone?: string | null }>().catch(() =>
            db.prepare('SELECT phone FROM customers WHERE id = ? LIMIT 1').bind(actor.id).first<{ phone?: string | null }>().catch(() => null)
          )
        : await db.prepare('SELECT phone FROM customers WHERE id = ? LIMIT 1').bind(actor.id).first<{ phone?: string | null }>().catch(() => null);
      if (custRow && isNonPlaceholderPhone(custRow.phone)) {
        customerPhoneNorm = normalizePhone(String(custRow.phone).trim());
      }
    } catch {
      // Allow fallback when customers table is absent in minimal test schemas
    }

    if (customerPhoneNorm && customerPhoneNorm !== orderPhoneNorm) {
      return { success: false, ok: false, status: 403, statusCode: 403, error: 'Order phone does not match customer profile' };
    }

    const hasExplicitVerification = input.verificationType !== undefined || input.verificationValue !== undefined;
    if (hasExplicitVerification) {
      if (
        input.verificationType !== 'phone' ||
        !input.verificationValue?.trim() ||
        normalizePhone(input.verificationValue.trim()) !== orderPhoneNorm
      ) {
        return { success: false, ok: false, status: 403, statusCode: 403, error: 'Phone verification is required to claim this order' };
      }
    } else if (!customerPhoneNorm) {
      return { success: false, ok: false, status: 403, statusCode: 403, error: 'Phone verification is required to claim this order' };
    }
  }

  const now = new Date().toISOString();
  let updateResult: { meta?: { changes?: number }; rowCount?: number } | undefined;
  if (effectiveTenant) {
    try {
      updateResult = await db.prepare(
        "UPDATE orders SET customer_id = ?, updated_at = ? WHERE id = ? AND customer_id IS NULL AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(actor.id, now, orderId, effectiveTenant).run() as { meta?: { changes?: number }; rowCount?: number } | undefined;
    } catch {
      updateResult = await db.prepare(
        'UPDATE orders SET customer_id = ?, updated_at = ? WHERE id = ? AND customer_id IS NULL'
      ).bind(actor.id, now, orderId).run() as { meta?: { changes?: number }; rowCount?: number } | undefined;
    }
  } else {
    updateResult = await db.prepare(
      'UPDATE orders SET customer_id = ?, updated_at = ? WHERE id = ? AND customer_id IS NULL'
    ).bind(actor.id, now, orderId).run() as { meta?: { changes?: number }; rowCount?: number } | undefined;
  }
  const changes = updateResult?.meta?.changes ?? updateResult?.rowCount ?? 1;
  if (Number(changes) === 0) {
    const latest = await db.prepare('SELECT customer_id FROM orders WHERE id = ?').bind(orderId).first<{ customer_id?: string | null }>();
    if (latest?.customer_id === actor.id) {
      return { success: true, ok: true, status: 200, statusCode: 200, idempotent: true, orderId, customerId: actor.id };
    }
    return { success: false, ok: false, error: 'Order already belongs to another registered customer', statusCode: 409, status: 409 };
  }

  const eventId = `cev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const eventPayload = JSON.stringify({ order_id: orderId, total: order.total ?? null, order_type: order.order_type ?? null });
  const eventTenant = effectiveTenant || (typeof order.tenant_id === 'string' && order.tenant_id.trim() ? order.tenant_id.trim() : 'default');
  try {
    await db.prepare(
      'INSERT INTO customer_events (id, customer_id, event_type, payload, tenant_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      eventId,
      actor.id, 'OrderLinked',
      eventPayload,
      eventTenant,
      now
    ).run();
  } catch {
    try {
      await db.prepare(
        'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        eventId,
        actor.id, 'OrderLinked',
        eventPayload,
        now
      ).run();
    } catch { /* best-effort non-blocking event log */ }
  }

  const auditMeta = JSON.stringify({ previous_customer_id: null, claimed_by: actor.id });
  try {
    await db.prepare(
      'INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      `audit_${Date.now()}`, actor.id, 'order_claimed', 'order', orderId,
      auditMeta, now
    ).run();
  } catch {
    try {
      await db.prepare(
        'INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        actor.id, actor.id, actor.id, 'order_claimed', 'order', orderId, 'order', orderId,
        auditMeta, auditMeta, now
      ).run();
    } catch { /* best-effort non-blocking audit */ }
  }

  return { success: true, orderId, customerId: actor.id };
}
