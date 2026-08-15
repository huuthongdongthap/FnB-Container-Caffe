import type { Order, OrderItem } from './order-store-types';

export function firstOrDefault<K extends string>(
  key: K,
  source: Record<string, unknown>,
  fallback?: string,
): string {
  return typeof source[key] === 'string' ? source[key] as string : (fallback ?? '');
}

export function mapSseEventToOrder(orderData: Record<string, unknown>): Order {
  return {
    id: firstOrDefault('orderId', orderData) || firstOrDefault('id', orderData, ''),
    status: firstOrDefault('status', orderData),
    total: Number(firstOrDefault('total', orderData) || 0),
    payment_status: firstOrDefault('payment_status', orderData),
    payment_method: firstOrDefault('payment_method', orderData),
    customer_name: firstOrDefault('customer_name', orderData),
    customer_phone: firstOrDefault('customer_phone', orderData),
    customer_address: firstOrDefault('customer_address', orderData) || undefined,
    items: (orderData.items as OrderItem[]) || [],
    created_at: firstOrDefault('created_at', orderData),
  };
}
