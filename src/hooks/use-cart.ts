import { useMemo } from 'react';
import { useCartStore, type CartItem } from '@/hooks/stores/use-cart-store';

/* ═══════════════════════════════════════════════════════════════════
   useCart — Convenience wrapper around Zustand useCartStore.
   Uses individual selectors to avoid unnecessary re-renders.
   Free delivery threshold: 300,000 VND.
   ═══════════════════════════════════════════════════════════════════ */

// Policy: Miễn phí giao hàng nội ô Sa Đéc từ 2 ly trở lên
const FREE_DELIVERY_MIN_ITEMS = 2;
const STANDARD_DELIVERY_FEE = 15_000;

export function useCart() {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items],
  );

  // Bỏ phí phục vụ (0đ)
  const serviceFee = 0;
  const total = subtotal;

  const qualifiesForFreeDelivery = useMemo(
    () => totalItems >= FREE_DELIVERY_MIN_ITEMS,
    [totalItems],
  );

  const remainingForFreeDelivery = useMemo(
    () => Math.max(0, FREE_DELIVERY_MIN_ITEMS - totalItems),
    [totalItems],
  );

  const deliveryFee = useMemo(
    () => (totalItems > 0 && !qualifiesForFreeDelivery ? STANDARD_DELIVERY_FEE : 0),
    [totalItems, qualifiesForFreeDelivery],
  );

  return {
    items,
    totalItems,
    subtotal,
    serviceFee,
    total,
    deliveryFee,
    remainingForFreeDelivery,
    qualifiesForFreeDelivery,
    FREE_DELIVERY_MIN_ITEMS,
    FREE_DELIVERY_THRESHOLD: FREE_DELIVERY_MIN_ITEMS,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    hasItems: items.length > 0,
  };
}

export type { CartItem };
