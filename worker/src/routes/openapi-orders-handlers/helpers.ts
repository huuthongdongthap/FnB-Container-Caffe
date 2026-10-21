import type { D1Database } from '@cloudflare/workers-types';
import type { OrderItem, CustomerOrderItem } from '../../schemas/orders';

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
  const qty = Number(item.quantity) || 1;
  const subtotal = Number(item.total_price ?? item.subtotal ?? 0);
  const unitPrice = item.unit_price !== undefined && item.unit_price !== null
    ? Number(item.unit_price)
    : Math.round(subtotal / qty);

  return {
    id: item.id,
    menuItemId: item.product_id ?? item.menu_item_id,
    name: item.product_name ?? item.name ?? '',
    quantity: qty,
    unitPriceCents: unitPrice,
    subtotalCents: subtotal,
    modifiers: parseModifiers(item.modifiers) as OrderItem['modifiers'],
    notes: item.notes ?? null,
    status: item.status ?? 'pending',
  };
}

/**
 * Customer-safe line-item projection. Drops product identifiers and modifier
 * option ids so a guest response never carries procurement-side references.
 */
export function formatCustomerOrderItem(item: Row): CustomerOrderItem {
  const qty = Number(item.quantity) || 1;
  const subtotal = Number(item.total_price ?? item.subtotal ?? 0);
  const unitPrice = item.unit_price !== undefined && item.unit_price !== null
    ? Number(item.unit_price)
    : Math.round(subtotal / qty);
  const modifiers = parseModifiers(item.modifiers) as Array<Row>;
  const includeCatalogRef =
    item.menu_item_id !== undefined ||
    item.menuItemId !== undefined ||
    item.product_slug !== undefined;
  const resolvedProductId = item.product_id ?? item.menu_item_id ?? item.menuItemId ?? item.id ?? null;

  return {
    ...(includeCatalogRef
      ? {
          menuItemId: item.product_id ?? item.menu_item_id ?? item.id ?? null,
          product_id: resolvedProductId,
        }
      : {}),
    name: item.product_name ?? item.name ?? '',
    quantity: qty,
    unitPriceCents: unitPrice,
    subtotalCents: subtotal,
    modifiers: modifiers.length
      ? modifiers.map((m) => ({
          name: m.optionName ?? m.option_name ?? m.modifierName ?? m.name ?? '',
          priceAdjustment: m.priceAdjustment ?? m.price_adjustment ?? m.price_delta ?? 0,
        }))
      : undefined,
    notes: item.notes ?? null,
    status: item.status ?? 'pending',
  };
}

/**
 * Staff-facing order projection: full snapshot plus staff/audit metadata.
 */
export function formatOrder(order: Row, items: Row[], payments: Row[]) {
  let fallbackItems: any[] = [];
  if (items.length === 0 && order.items) {
    try {
      fallbackItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    } catch {
      fallbackItems = [];
    }
  }
  return {
    ...order,
    table: order.table_id ? { id: order.table_id, name: order.table_name } : null,
    items: items.length > 0 ? items.map(formatOrderItem) : fallbackItems,
    payments,
    channel: order.channel ?? 'dine_in',
    happyHourApplied: Boolean(order.happy_hour_applied),
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    totalAmount: order.total_amount ?? order.total,
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
  let fallbackItems: any[] = [];
  if (items.length === 0 && order.items) {
    try {
      fallbackItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    } catch {
      fallbackItems = [];
    }
  }
  return {
    id: order.id,
    orderNumber: order.order_number,
    table: order.table_id ? { id: order.table_id, name: order.table_name } : null,
    items: items.length > 0 ? items.map(formatCustomerOrderItem) : fallbackItems,
    channel: order.channel ?? 'dine_in',
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    totalAmount: order.total_amount ?? order.total,
    status: order.status,
    paymentStatus: order.payment_status,
    notes: order.notes ?? null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function fetchOrderItemsAndPayments(db: D1Database, orderId: string) {
  try {
    const fetchItems = async () => {
      try {
        return await db.prepare(
          `SELECT oi.*, COALESCE(p.name, mi.name) as product_name, p.slug as product_slug, oi.product_id as menu_item_id
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           LEFT JOIN menu_items mi ON oi.product_id = mi.id
           WHERE oi.order_id = ?`
        ).bind(orderId).all();
      } catch {
        return await db.prepare(
          `SELECT oi.*, p.name as product_name, p.slug as product_slug, oi.product_id as menu_item_id
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?`
        ).bind(orderId).all().catch(() => ({ results: [] }));
      }
    };

    const fetchPayments = async () => {
      try {
        const txRows = await db.prepare(
          'SELECT * FROM payment_transactions WHERE order_id = ?'
        ).bind(orderId).all();
        if (txRows?.results?.length) {
          return txRows;
        }
      } catch {
        // Fallback to legacy payments table when payment_transactions is unavailable
      }
      return await db.prepare(
        'SELECT * FROM payments WHERE order_id = ?'
      ).bind(orderId).all().catch(() => ({ results: [] }));
    };

    const [items, payments] = await Promise.all([
      fetchItems(),
      fetchPayments(),
    ]);

    return {
      items: items.results || [],
      payments: payments.results || [],
    };
  } catch {
    return {
      items: [],
      payments: [],
    };
  }
}
