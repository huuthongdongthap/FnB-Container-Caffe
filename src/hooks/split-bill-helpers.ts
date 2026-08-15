import type { CartItem } from '@/hooks/stores/use-cart-store';
import { SPLIT_COLORS, SPLIT_NAMES, type SplitResult } from './split-bill-types';

/** Compute per-split results from cart items and assignments. */
export function computeSplits(
  cartItems: CartItem[],
  assignments: Record<string, number>,
  splitCount: number,
): SplitResult[] {
  const result: SplitResult[] = [];
  for (let i = 0; i < splitCount; i++) {
    const assignedItems = cartItems.filter((item) => assignments[item.id] === i);
    const subtotal = assignedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const serviceFee = Math.round(subtotal * 0.05);
    const total = subtotal + serviceFee;
    result.push({
      index: i,
      name: SPLIT_NAMES[i] || `Người ${i + 1}`,
      color: SPLIT_COLORS[i] as string,
      items: assignedItems,
      subtotal,
      serviceFee,
      total,
    });
  }
  return result;
}

/** Build API order payloads for split-bill confirmation. */
export function buildSplitOrders(
  splits: SplitResult[],
  formData: { customer_name: string; customer_phone: string; payment_method: string },
  tableId: string,
) {
  return splits.map((split) => ({
    items: split.items.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    })),
    total: split.total,
    customer_name: `${formData.customer_name} (${split.name})`,
    customer_phone: formData.customer_phone,
    customer_email: '',
    customer_address: `Dine-in - Bàn ${tableId}`,
    payment_method: formData.payment_method,
    notes: `Chia bill - ${split.name}`,
    delivery_time: 'now',
    shipping_fee: 0,
    discount: 0,
    tip: 0,
    table_id: tableId,
  }));
}
