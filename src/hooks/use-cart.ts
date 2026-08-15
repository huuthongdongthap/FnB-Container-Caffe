import { useMemo } from 'react';
import { useCartStore, type CartItem } from '@/hooks/stores/use-cart-store';

/* ═══════════════════════════════════════════════════════════════════
   useCart — Convenience wrapper around Zustand useCartStore.
   Uses individual selectors to avoid unnecessary re-renders.
   Free delivery threshold: 300,000 VND.
   ═══════════════════════════════════════════════════════════════════ */

const FREE_DELIVERY_THRESHOLD = 300_000;

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

  const serviceFee = useMemo(() => Math.round(subtotal * 0.05), [subtotal]);
  const total = useMemo(() => subtotal + serviceFee, [subtotal, serviceFee]);
  const remainingForFreeDelivery = useMemo(
    () => Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal),
    [subtotal],
  );
  const qualifiesForFreeDelivery = useMemo(
    () => subtotal >= FREE_DELIVERY_THRESHOLD,
    [subtotal],
  );

  return {
    items,
    totalItems,
    subtotal,
    serviceFee,
    total,
    remainingForFreeDelivery,
    qualifiesForFreeDelivery,
    FREE_DELIVERY_THRESHOLD,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    hasItems: items.length > 0,
  };
}

export type { CartItem };
