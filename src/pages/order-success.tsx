/**
 * OrderSuccessPage — Order confirmation screen for AURA CAFE
 *
 * Stitch design: nocturnal nebula WebGL background, dark navy glassmorphism,
 * chrome/silver + warm bronze accent colors.
 *
 * Source: stitch-exports/order-success/design.html
 *
 * Features:
 * - Full-screen WebGL nebula shader background (from Stitch design)
 * - Animated success checkmark with pulse ring
 * - Glass card with order summary (ID, total, payment, status)
 * - Status progress tracker (pending -> confirmed -> preparing -> ready -> delivered)
 * - Next steps list
 * - SSE subscription with polling fallback (10 min timeout)
 * - Loading, error, empty states
 * - Contact links (phone, Zalo, SMS)
 * - Mobile-first responsive
 */

'use client';

import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useOrderStoreWithOfflineFlush } from '@/hooks/stores/use-order-store';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import { useToast } from '@/components/ui/toast';
import { StitchOrderSuccessNew, type OrderSuccessNewData } from '@/components/stitch/StitchOrderSuccessNew';

/* ---- Types --------------------------------------------------------- */

export interface OrderSuccessPageProps {
  locale?: string;
}

/* ---- Inline components removed: StitchOrderSuccessNew provides its own loading/error/empty states ---- */

/* =====================================================================
   Main Component — delegates rendering to StitchOrderSuccessNew
   ===================================================================== */

export function OrderSuccessPage(_props: Readonly<OrderSuccessPageProps>) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

  const { currentOrder, loading, error, fetchOrder, subscribeToOrder, unsubscribeFromOrder } =
    useOrderStoreWithOfflineFlush();

  const [pendingOrder, setPendingOrder] = useState<{
    id?: string;
    status?: string;
    total?: number;
    payment_method?: string;
    points_earned?: number;
    cashback_earned?: number;
  } | null>(null);

  // Load cached pending order from localStorage and clean up state
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pendingOrder');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        setPendingOrder({
          id: String(parsed.id ?? ''),
          status: String(parsed.status ?? ''),
          total: Number(parsed.total ?? 0),
          payment_method: String(parsed.payment_method ?? ''),
          points_earned: Number(parsed.points_earned ?? 0) || undefined,
          cashback_earned: Number(parsed.cashback_earned ?? 0) || undefined,
        });
      }
    } catch {
      /* ignore */
    } finally {
      localStorage.removeItem('pendingOrder');
    }
    // Ensure cart is cleared after completed order checkout
    useCartStore.getState().clearCart();
  }, []);

  // Subscribe to SSE for real-time updates
  useEffect(() => {
    if (!orderId) return;

    fetchOrder(orderId);
    subscribeToOrder(orderId);

    const timeout = setTimeout(() => {
      unsubscribeFromOrder();
    }, POLL_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
      unsubscribeFromOrder();
    };
  }, [orderId, fetchOrder, subscribeToOrder, unsubscribeFromOrder]);

  const handleRetry = useCallback(() => {
    if (orderId) {
      fetchOrder(orderId);
      subscribeToOrder(orderId);
    }
  }, [orderId, fetchOrder, subscribeToOrder]);

  // Navigation callbacks for StitchOrderSuccessNew
  const handleBack = useCallback(() => {
    navigate('/menu');
  }, [navigate]);

  const handleAccount = useCallback(() => {
    navigate('/account');
  }, [navigate]);

  const handleTrackOrder = useCallback(() => {
    if (orderId) {
      navigate(`/track-order?id=${orderId}`);
    }
  }, [navigate, orderId]);

  // Quick Reorder: load previous order items into cart and go to menu
  const { clearCart, addItem } = useCartStore.getState();
  const { showToast } = useToast();
  const handleReorder = useCallback(() => {
    if (!currentOrder?.items?.length) return;
    clearCart();
    currentOrder.items.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        addItem({ id: item.name, name: item.name, price: item.unitPriceCents });
      }
    });
    showToast('Đã thêm lại vào giỏ hàng', 'success');
    navigate('/menu');
  }, [currentOrder, clearCart, addItem, showToast, navigate]);

  // Map canonical CustomerOrder to the presentation view model.
  // Money is stored in cents server-side; convert once at this boundary.
  const orderSuccessData: OrderSuccessNewData | null = useMemo(() => {
    if (currentOrder) {
      return {
        orderId: currentOrder.orderNumber || currentOrder.id || '---',
        items: currentOrder.items.map((item, index) => ({
          id: `${currentOrder.id}-${index}`,
          name: item.name,
          quantity: item.quantity,
          price: item.unitPriceCents,
        })),
        total: currentOrder.totalAmount,
        estimatedMinutes: 10,
        locationName: 'AURA CAFE',
        customerName: '',
        table: currentOrder.table?.name,
      };
    }
    if (pendingOrder) {
      return {
        orderId: pendingOrder.id || '---',
        items: [],
        total: pendingOrder.total || 0,
        estimatedMinutes: 10,
        locationName: 'AURA CAFE',
        customerName: '',
        pointsEarned: pendingOrder.points_earned,
        cashbackEarned: pendingOrder.cashback_earned,
      };
    }
    return null;
  }, [currentOrder, pendingOrder]);

  return (
    <>
      <HelmetHead
        title="Order Success — AURA CAFE"
        description="Your order has been placed successfully! Don hang cua ban da duoc dat thanh cong!"
      />
      <StitchOrderSuccessNew
        order={orderSuccessData}
        isLoading={loading && !currentOrder && !pendingOrder}
        error={error && !currentOrder && !pendingOrder ? error : null}
        onBack={handleBack}
        onAccount={handleAccount}
        onTrackOrder={handleTrackOrder}
        onRefresh={handleRetry}
        onReorder={handleReorder}
      />
    </>
  );
}

export default OrderSuccessPage;
