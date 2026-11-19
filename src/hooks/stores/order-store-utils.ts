import type { CustomerOrder, CustomerOrderItem } from './order-store-types';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
export function firstOrDefault<K extends string>(
  key: K,
  source: Record<string, unknown>,
  fallback?: string,
): string {
  return typeof source[key] === 'string' ? source[key] as string : (fallback ?? '');
}

function toNumber(val: unknown): number {
  return typeof val === 'number' ? val : Number(val ?? 0);
}

function toIsoTimestamp(primary: unknown, secondary: unknown): string {
  for (const candidate of [primary, secondary]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return new Date(candidate).toISOString();
    }
  }
  return new Date().toISOString();
}

/* ─── Map SSE event data (camelCase or snake_case broadcast payload) to CustomerOrder ─── */
export function mapSseEventToOrder(orderData: Record<string, unknown>): CustomerOrder {
  const rawItems = (orderData.items as Array<Record<string, unknown>>) || [];
  const rawPaymentStatus =
    typeof orderData.paymentStatus === 'string' && orderData.paymentStatus.trim()
      ? orderData.paymentStatus.trim()
      : typeof orderData.payment_status === 'string' && orderData.payment_status.trim()
        ? orderData.payment_status.trim()
        : 'unpaid';
  const rawEstimated =
    typeof orderData.estimatedMinutes === 'number'
      ? orderData.estimatedMinutes
      : typeof orderData.estimated_minutes === 'number'
        ? orderData.estimated_minutes
        : undefined;

  return {
    id: firstOrDefault('id', orderData, firstOrDefault('orderId', orderData, firstOrDefault('order_id', orderData, ''))),
    orderNumber: firstOrDefault('orderNumber', orderData, firstOrDefault('order_number', orderData, '')),
    table: orderData.table
      ? {
          id: firstOrDefault('id', orderData.table as Record<string, unknown>, ''),
          name: firstOrDefault('name', orderData.table as Record<string, unknown>, ''),
        }
      : typeof orderData.table_id === 'string' && orderData.table_id.trim()
        ? { id: orderData.table_id.trim(), name: orderData.table_id.trim() }
        : null,
    items: rawItems.map(mapSseEventToOrderItem),
    channel: ((orderData.channel ?? orderData.order_type) as CustomerOrder['channel']) ?? 'dine_in',
    subtotal: toNumber(orderData.subtotal),
    discountAmount: toNumber(orderData.discountAmount ?? orderData.discount_amount ?? orderData.discount),
    taxAmount: toNumber(orderData.taxAmount ?? orderData.tax_amount ?? orderData.tax),
    totalAmount: toNumber(orderData.totalAmount ?? orderData.total_amount ?? orderData.total),
    status: (orderData.status as CustomerOrder['status']) ?? 'pending',
    // A row written before the column gained its default can arrive null;
    // 'unpaid' is what the column defaults to, whereas 'pending' would claim a
    // payment attempt is in flight.
    paymentStatus: rawPaymentStatus as CustomerOrder['paymentStatus'],
    paymentMethod: firstOrDefault('paymentMethod', orderData, firstOrDefault('payment_method', orderData)) || undefined,
    estimatedMinutes: rawEstimated,
    notes: typeof orderData.notes === 'string' ? orderData.notes : null,
    createdAt: toIsoTimestamp(orderData.createdAt, orderData.created_at),
    updatedAt: toIsoTimestamp(orderData.updatedAt, orderData.updated_at),
  };
}

function mapSseEventToOrderItem(itemData: Record<string, unknown>): CustomerOrderItem {
  const rawModifiers = (itemData.modifiers as Array<Record<string, unknown>>) || [];

  return {
    name: firstOrDefault('name', itemData, ''),
    quantity: toNumber(itemData.quantity),
    unitPriceCents: toNumber(itemData.unitPriceCents ?? itemData.unit_price_cents ?? itemData.price ?? itemData.unit_price),
    subtotalCents: toNumber(itemData.subtotalCents ?? itemData.subtotal_cents ?? itemData.subtotal),
    modifiers: rawModifiers.length
      ? rawModifiers.map((m) => ({
          name: firstOrDefault('name', m, ''),
          priceAdjustment: toNumber(m.priceAdjustment),
        }))
      : undefined,
    notes: typeof itemData.notes === 'string' ? itemData.notes : null,
    status: (itemData.status as CustomerOrderItem['status']) ?? 'pending',
  };
}
