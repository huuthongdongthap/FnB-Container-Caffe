import type { D1Database } from '@cloudflare/workers-types';
import type { OrderItem, CustomerOrderItem } from '../../schemas/orders';

/** Order statuses from which no further lifecycle movement is possible. */
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'refunded']);

type Row = Record<string, any>;

function parseModifiers(raw: unknown): unknown[] {
  if (!raw) return [];
  if (typeof raw !== 'string') return Array.isArray(raw) ? raw : [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Maps a persisted `order_items` row to the evaluated line-item snapshot shape.
 * `unit_price` / `total_price` are already server-evaluated at creation time;
 * this only renames them onto the snapshot contract.
 */
export function formatOrderItem(item: Row): OrderItem {
  return {
    id: item.id,
    menuItemId: item.product_id ?? item.menu_item_id,
    name: item.product_name ?? item.name ?? '',
    quantity: item.quantity,
    unitPriceCents: item.unit_price,
    subtotalCents: item.total_price,
    modifiers: parseModifiers(item.modifiers) as OrderItem['modifiers'],
    notes: item.notes ?? null,
    status: item.status,
  };
}

/**
 * Customer-safe line-item projection. Drops product identifiers and modifier
 * option ids so a guest response never carries procurement-side references.
 */
export function formatCustomerOrderItem(item: Row): CustomerOrderItem {
  const modifiers = parseModifiers(item.modifiers) as Array<Row>;
  return {
    name: item.product_name ?? item.name ?? '',
    quantity: item.quantity,
    unitPriceCents: item.unit_price,
    subtotalCents: item.total_price,
    modifiers: modifiers.length
      ? modifiers.map((m) => ({
          name: m.optionName ?? m.option_name ?? m.modifierName ?? m.name ?? '',
          priceAdjustment: m.priceAdjustment ?? m.price_adjustment ?? 0,
        }))
      : undefined,
    notes: item.notes ?? null,
    status: item.status,
  };
}

/**
 * Staff-facing order projection: full snapshot plus staff/audit metadata.
 */
export function formatOrder(order: Row, items: Row[], payments: Row[]) {
  return {
    ...order,
    table: order.table_id ? { id: order.table_id, name: order.table_name } : null,
    items: items.map(formatOrderItem),
    payments,
    channel: order.channel ?? 'dine_in',
    happyHourApplied: Boolean(order.happy_hour_applied),
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    totalAmount: order.total_amount,
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    servedAt: order.served_at,
    completedAt: order.completed_at,
    cancelledAt: order.cancelled_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

/**
 * Customer-facing order projection. Allowlist-only: deliberately omits
 * `source`, `payments`, `locationId`, `tableId` and every staff field.
 * Callers must not spread the raw row into this object.
 */
export function formatCustomerOrder(order: Row, items: Row[]) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    table: order.table_id ? { id: order.table_id, name: order.table_name } : null,
    items: items.map(formatCustomerOrderItem),
    channel: order.channel ?? 'dine_in',
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    totalAmount: order.total_amount,
    status: order.status,
    paymentStatus: order.payment_status,
    notes: order.notes ?? null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function fetchOrderItemsAndPayments(db: D1Database, orderId: string) {
  const [items, payments] = await Promise.all([
    db.prepare(
      `SELECT oi.*, p.name as product_name, p.slug as product_slug
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`
    ).bind(orderId).all(),
    db.prepare(
      'SELECT * FROM order_payments WHERE order_id = ?'
    ).bind(orderId).all(),
  ]);

  return {
    items: items.results || [],
    payments: payments.results || [],
  };
}

export { TERMINAL_STATUSES };
