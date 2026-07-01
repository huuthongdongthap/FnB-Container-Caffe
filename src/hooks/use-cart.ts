import { useCartStore, type CartItem } from '@/hooks/stores/use-cart-store';

/* ═══════════════════════════════════════════════════════════════════
   useCart — Convenience wrapper around Zustand useCartStore.
   Adds derived helpers: total, hasItems, freeDeliveryInfo.
   Free delivery threshold: 300,000 VND.
   ═══════════════════════════════════════════════════════════════════ */

const FREE_DELIVERY_THRESHOLD = 300_000;
const DELIVERY_FEE = 0; // Currently free — backend doesn't enforce delivery fee.

export function useCart() {
  const store = useCartStore();
  const items = store.items;

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const serviceFee = Math.round(subtotal * 0.05); // 5% service fee (legacy behavior)
  const total = subtotal + serviceFee;

  const remainingForFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const qualifiesForFreeDelivery = subtotal >= FREE_DELIVERY_THRESHOLD;

  return {
    items,
    totalItems,
    subtotal,
    serviceFee,
    total,
    remainingForFreeDelivery,
    qualifiesForFreeDelivery,
    FREE_DELIVERY_THRESHOLD,
    addItem: (item: Omit<CartItem, 'quantity'>) => store.addItem(item),
    removeItem: (id: string) => store.removeItem(id),
    updateQuantity: (id: string, qty: number) => store.updateQuantity(id, qty),
    clearCart: () => store.clearCart(),
    hasItems: items.length > 0,
  };
}

export type { CartItem };
