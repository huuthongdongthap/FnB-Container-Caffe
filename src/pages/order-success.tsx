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
import { useEffect, useCallback, useMemo } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useOrderStoreWithOfflineFlush } from '@/hooks/stores/use-order-store';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import { useToast } from '@/components/ui/toast';
import { StitchOrderSuccessNew, type OrderSuccessNewData } from '@/components/stitch/StitchOrderSuccessNew';
import { acknowledgeCheckoutOrder } from './checkout-intent';

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

  useEffect(() => {
    if (orderId && currentOrder?.id === orderId
      && ['paid', 'completed', 'refunded', 'partially_refunded'].includes(currentOrder.paymentStatus)) {
      acknowledgeCheckoutOrder(orderId);
    }
  }, [orderId, currentOrder?.id, currentOrder?.paymentStatus]);

  // Remove legacy order caches; confirmation details always come from the order API.
  useEffect(() => {
    try {
      localStorage.removeItem('pendingOrder');
      localStorage.removeItem('aura_active_booking');
      localStorage.removeItem('aura_checkout_form');
      sessionStorage.removeItem('aura_last_order');
    } catch { /* storage unavailable */ }
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
    acknowledgeCheckoutOrder(currentOrder.id);
    clearCart();
    currentOrder.items.forEach((item) => {
      const rawItem = item as unknown as Record<string, unknown>;
      const resolvedProductId = String(rawItem.product_id ?? rawItem.productId ?? rawItem.id ?? item.name);
      for (let i = 0; i < item.quantity; i++) {
        addItem({
          id: resolvedProductId,
          productId: resolvedProductId,
          name: item.name,
          price: item.unitPriceCents ?? Number(rawItem.price ?? rawItem.unit_price ?? 0),
        });
      }
    });
    showToast('Đã thêm lại vào giỏ hàng', 'success');
    navigate('/menu');
  }, [currentOrder, clearCart, addItem, showToast, navigate]);

  const orderForDisplay = currentOrder?.id === orderId && currentOrder.items.length > 0
    ? currentOrder
    : null;
  const missingOrderItems = Boolean(
    orderId && currentOrder?.id === orderId && currentOrder.items.length === 0 && !loading
  );
  const orderLoadError = error || (missingOrderItems
    ? 'Không tải được chi tiết món trong đơn. Vui lòng thử lại.'
    : null);

  // Map canonical CustomerOrder to the presentation view model.
  // Money is stored in cents server-side; convert once at this boundary.
  const orderSuccessData: OrderSuccessNewData | null = useMemo(() => {
    if (orderForDisplay) {
      return {
        orderId: orderForDisplay.orderNumber || orderForDisplay.id || '---',
        items: orderForDisplay.items.map((item, index) => ({
          id: `${orderForDisplay.id}-${index}`,
          name: item.name,
          quantity: item.quantity,
          price: item.unitPriceCents ?? (item as unknown as { price?: number }).price ?? 0,
        })),
        total: orderForDisplay.totalAmount ?? (orderForDisplay as unknown as { total?: number }).total ?? 0,
        estimatedMinutes: orderForDisplay.estimatedMinutes,
        status: orderForDisplay.status,
        paymentStatus: orderForDisplay.paymentStatus,
        paymentMethod: orderForDisplay.paymentMethod,
        locationName: 'AURA CAFE',
        customerName: '',
        table: orderForDisplay.table?.name,
      };
    }
    return null;
  }, [orderForDisplay]);

  return (
    <>
      <HelmetHead
        title="Order Success — AURA CAFE"
        description="Your order has been placed successfully! Don hang cua ban da duoc dat thanh cong!"
      />
      <StitchOrderSuccessNew
        order={orderSuccessData}
        isLoading={Boolean(orderId) && !orderSuccessData && !orderLoadError}
        error={orderSuccessData ? null : orderLoadError}
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
