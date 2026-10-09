/**
 * Canonical Customer Order Payload & Authorization Policy
 *
 * Rules:
 * 1. SPACE reads canonical Order state only.
 * 2. Customer-safe projection: allowlist only; no internal staff notes, admin phone, supplier data.
 * 3. Strict IDOR protection: customers only access their own orders; guests only access guest orders.
 * 4. Zero Catalog lookups: reads purely from frozen snapshot items.
 */

import { isTerminal, type OrderStatus } from '../model/order-state-machine';
import { canAccessOrder } from '../../customer/policies/order-ownership-policy';
export { canAccessOrder };

export interface CustomerOrderItemPayload {
  id?: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  modifiers?: Array<{ name: string; priceAdjustment: number }>;
  notes?: string | null;
  status?: string;
}

export interface CustomerOrderPayload {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  channel: string;
  table: { id: string; name: string } | null;
  items: CustomerOrderItemPayload[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Parses items safely from JSON string or array without Catalog lookups.
 */
function parseSnapshotItems(itemsRaw: unknown): CustomerOrderItemPayload[] {
  let list: unknown[] = [];
  if (Array.isArray(itemsRaw)) {
    list = itemsRaw;
  } else if (typeof itemsRaw === 'string') {
    try {
      const parsed = JSON.parse(itemsRaw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }

  return list.map((raw) => {
    const it = raw as Record<string, unknown>;
    const qty = Math.max(1, Number(it.quantity ?? it.qty ?? 1));
    const unitPrice = Number(it.unitPriceCents ?? it.unit_price ?? it.price ?? 0);
    const subtotal = Number(it.subtotalCents ?? it.subtotal ?? it.total_price ?? (unitPrice * qty));
    const modifiers = Array.isArray(it.modifiers)
      ? (it.modifiers as Array<Record<string, unknown>>).map((m) => ({
          name: String(m.name || ''),
          priceAdjustment: Number(m.priceAdjustment ?? m.price ?? 0),
        }))
      : undefined;

    return {
      id: it.id ? String(it.id) : undefined,
      name: String(it.name || it.product_name || 'Item'),
      quantity: qty,
      unitPriceCents: unitPrice,
      subtotalCents: subtotal,
      modifiers,
      notes: typeof it.notes === 'string' ? it.notes : null,
      status: typeof it.status === 'string' ? it.status : undefined,
    };
  });
}

/**
 * Projects raw database order record to customer-safe allowlist payload.
 * Eliminates all internal staff notes, phone, supplier, payment secret data.
 */
export function projectCustomerOrderPayload(
  order: Record<string, unknown>,
  itemsOverride?: unknown[]
): CustomerOrderPayload {
  const items = itemsOverride && itemsOverride.length > 0
    ? parseSnapshotItems(itemsOverride)
    : parseSnapshotItems(order.items);

  let table: { id: string; name: string } | null = null;
  if (order.table && typeof order.table === 'object') {
    const t = order.table as { id?: string; name?: string };
    table = { id: String(t.id || ''), name: String(t.name || t.id || '') };
  } else if (order.table_id) {
    const tableId = String(order.table_id);
    const tableName = String(order.table_name || order.table_number || tableId);
    table = { id: tableId, name: tableName };
  }

  return {
    id: String(order.id || ''),
    orderNumber: String(order.order_number || order.orderNumber || order.id || ''),
    status: String(order.status || 'pending'),
    paymentStatus: String(order.payment_status || order.paymentStatus || 'pending'),
    channel: String(order.order_type || order.channel || 'dine_in'),
    table,
    items,
    subtotal: Number(order.subtotal ?? 0),
    discountAmount: Number(order.discount_amount ?? order.discountAmount ?? 0),
    taxAmount: Number(order.tax_amount ?? order.taxAmount ?? 0),
    totalAmount: Number(order.total_amount ?? order.total ?? order.totalAmount ?? 0),
    notes: typeof order.notes === 'string' ? order.notes : null,
    createdAt: String(order.created_at || order.createdAt || new Date().toISOString()),
    updatedAt: String(order.updated_at || order.updatedAt || order.created_at || new Date().toISOString()),
  };
}

/**
 * Publishes order event to KV namespace for fast SSE delivery.
 */
export async function publishOrderEvent(
  kv: { put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<unknown> } | null | undefined,
  orderId: string,
  status: string,
  options?: { previousStatus?: string; waitUntil?: (p: Promise<unknown>) => void }
): Promise<void> {
  if (!kv || !orderId) return;
  const payload = JSON.stringify({
    orderId,
    status,
    previous_status: options?.previousStatus,
    timestamp: new Date().toISOString(),
  });
  const promise = kv.put(`order_event:${orderId}`, payload, { expirationTtl: 60 }).catch(() => {});
  if (options?.waitUntil) {
    options.waitUntil(promise);
  } else {
    await promise;
  }
}
