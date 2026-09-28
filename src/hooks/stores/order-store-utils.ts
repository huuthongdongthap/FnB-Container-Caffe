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

/* ─── Map SSE event data (already in canonical camelCase from server) to CustomerOrder ─── */
export function mapSseEventToOrder(orderData: Record<string, unknown>): CustomerOrder {
  const rawItems = (orderData.items as Array<Record<string, unknown>>) || [];

  return {
    id: firstOrDefault('id', orderData, ''),
    orderNumber: firstOrDefault('orderNumber', orderData, ''),
    table: orderData.table
      ? {
          id: firstOrDefault('id', orderData.table as Record<string, unknown>, ''),
          name: firstOrDefault('name', orderData.table as Record<string, unknown>, ''),
        }
      : null,
    items: rawItems.map(mapSseEventToOrderItem),
    channel: (orderData.channel as CustomerOrder['channel']) ?? 'dine_in',
    subtotal: toNumber(orderData.subtotal),
    discountAmount: toNumber(orderData.discountAmount),
    taxAmount: toNumber(orderData.taxAmount),
    totalAmount: toNumber(orderData.totalAmount),
    status: (orderData.status as CustomerOrder['status']) ?? 'pending',
    paymentStatus: (orderData.paymentStatus as CustomerOrder['paymentStatus']) ?? 'pending',
    notes: typeof orderData.notes === 'string' ? orderData.notes : null,
    createdAt: firstOrDefault('createdAt', orderData, new Date().toISOString()),
    updatedAt: firstOrDefault('updatedAt', orderData, new Date().toISOString()),
  };
}

function mapSseEventToOrderItem(itemData: Record<string, unknown>): CustomerOrderItem {
  const rawModifiers = (itemData.modifiers as Array<Record<string, unknown>>) || [];

  return {
    name: firstOrDefault('name', itemData, ''),
    quantity: toNumber(itemData.quantity),
    unitPriceCents: toNumber(itemData.unitPriceCents),
    subtotalCents: toNumber(itemData.subtotalCents),
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
