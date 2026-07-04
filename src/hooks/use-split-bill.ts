import { useState, useCallback, useMemo } from 'react';
import { useCartStore, type CartItem } from '@/hooks/stores/use-cart-store';
import { API_BASE } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   useSplitBill — Split bill state management for dine-in group orders.
   Each cart item is assigned to exactly one split person.
   2-4 splits supported.
   ═══════════════════════════════════════════════════════════════════ */


export const SPLIT_COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981'] as const;
export const SPLIT_NAMES = ['Người 1', 'Người 2', 'Người 3', 'Người 4'] as const;

export interface SplitResult {
  index: number;
  name: string;
  color: string;
  items: CartItem[];
  subtotal: number;
  serviceFee: number;
  total: number;
}

interface SplitAssignment {
  [itemId: string]: number; // itemId -> split index
}

interface SplitConfirmPayload {
  customer_name: string;
  customer_phone: string;
  payment_method: string;
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
  const splits: SplitResult[] = useMemo(() => {
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
  }, [cartItems, assignments, splitCount]);

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
        const orders = splits.map((split) => ({
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
