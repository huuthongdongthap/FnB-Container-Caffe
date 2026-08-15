import { useState, useCallback, useMemo } from 'react';
import { useCartStore, type CartItem } from '@/hooks/stores/use-cart-store';
import { API_BASE } from '@/lib/api-client';
import { type SplitResult, type SplitConfirmPayload } from './split-bill-types';
import { computeSplits, buildSplitOrders } from './split-bill-helpers';

// Re-export types for backward compatibility
export { SPLIT_COLORS, SPLIT_NAMES, type SplitResult, type SplitConfirmPayload } from './split-bill-types';

/* ═══════════════════════════════════════════════════════════════════
   useSplitBill — Split bill state management for dine-in group orders.
   Each cart item is assigned to exactly one split person.
   2-4 splits supported.
   ═══════════════════════════════════════════════════════════════════ */

interface SplitAssignment {
  [itemId: string]: number; // itemId -> split index
}

export function useSplitBill() {
  const cartItems = useCartStore((s) => s.items);
  const tableId = useCartStore((s) => s.tableId);
  const clearCart = useCartStore((s) => s.clearCart);

  const [splitCount, setSplitCountState] = useState(2);
  const [assignments, setAssignments] = useState<SplitAssignment>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setSplitCount = useCallback((count: number) => {
    setSplitCountState(Math.max(2, Math.min(4, count)));
    setError(null);
  }, []);

  /** Toggle item assignment to a split. If already assigned to same split, unassign it. */
  const toggleItem = useCallback((itemId: string, splitIndex: number) => {
    setAssignments((prev) => {
      if (prev[itemId] === splitIndex) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: splitIndex };
    });
    setError(null);
  }, []);

  /** Auto-assign all unassigned items round-robin across splits. */
  const autoAssign = useCallback(() => {
    setAssignments((prev) => {
      const next = { ...prev };
      const unassigned = cartItems.filter((item) => next[item.id] === undefined);
      if (unassigned.length === 0) return prev;

      const counts = new Array(splitCount).fill(0);
      for (const id of Object.values(next)) {
        if (typeof id === 'number' && id >= 0 && id < splitCount) {
          counts[id]++;
        }
      }

      unassigned.forEach((item) => {
        let minIdx = 0;
        for (let i = 1; i < splitCount; i++) {
          if (counts[i] < counts[minIdx]) minIdx = i;
        }
        next[item.id] = minIdx;
        counts[minIdx]++;
      });

      return next;
    });
    setError(null);
  }, [cartItems, splitCount]);

  /** Compute per-split results. */
  const splits: SplitResult[] = useMemo(
    () => computeSplits(cartItems, assignments, splitCount),
    [cartItems, assignments, splitCount],
  );

  /** Items not assigned to any split. */
  const unassignedItems: CartItem[] = useMemo(
    () => cartItems.filter((item) => assignments[item.id] === undefined),
    [cartItems, assignments],
  );

  const allAssigned = unassignedItems.length === 0;

  /** Confirm split — create multiple orders via backend. */
  const confirmSplit = useCallback(
    async (formData: SplitConfirmPayload): Promise<{ orders: Array<Record<string, unknown>> } | null> => {
      if (!allAssigned) {
        setError('Vui lòng phân công tất cả món ăn trước khi xác nhận');
        return null;
      }
      if (!tableId) {
        setError('Không tìm thấy thông tin bàn');
        return null;
      }
      if (splits.length < 2) {
        setError('Cần ít nhất 2 người để chia bill');
        return null;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const orders = buildSplitOrders(splits, formData, tableId);

        const res = await fetch(`${API_BASE}/api/orders/split`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders, table_id: tableId }),
        });

        const body = await res.json();

        if (!res.ok || !body.success) {
          setError(body.error || 'Không thể tạo đơn chia bill');
          setIsSubmitting(false);
          return null;
        }

        clearCart();
        setIsSubmitting(false);
        return body;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
        setIsSubmitting(false);
        return null;
      }
    },
    [allAssigned, tableId, splits, clearCart],
  );

  return {
    cartItems,
    splitCount,
    setSplitCount,
    assignments,
    splits,
    unassignedItems,
    allAssigned,
    toggleItem,
    autoAssign,
    error,
    isSubmitting,
    confirmSplit,
    tableId,
  };
}
