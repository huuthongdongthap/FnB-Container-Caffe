import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StitchCheckoutNew, type CheckoutNewFormData, type CheckoutNewSummary } from '@/components/stitch/StitchCheckoutNew';
import { useCart } from '@/hooks/use-cart';
import { useOrderStore, useOrderStoreWithOfflineFlush } from '@/hooks/stores/use-order-store';
import { usePaymentStore } from '@/hooks/stores/use-payment-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';
import { clearCheckoutIntent, resolveCheckoutOrder } from './checkout-intent';

function checkoutIdentity(): string {
  const user = useAuthStore.getState().user;
  return JSON.stringify([API_BASE, user?.tenantId ?? 'default', user?.id ?? 'guest']);
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [payosError, setPayosError] = useState<string | null>(null);
  const [payosRetrying, setPayosRetrying] = useState(false);
  const submittingRef = useRef(false);
  const retryCreatePaymentLink = usePaymentStore((s) => s.retryCreatePaymentLink);
  const clearPaymentError = usePaymentStore((s) => s.clearPaymentError);
  const { t } = useTranslation('checkout');

  // Activate offline flush (no-op on online, flushes queued orders on reconnect)
  useOrderStoreWithOfflineFlush();

  const {
    items,
    totalItems,
    subtotal,
    deliveryFee,
    qualifiesForFreeDelivery,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  /* ── Handle redirect from checkout.html (PayOS return URL bridge) ── */
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const cancelled = searchParams.get('cancelled');
    const orderId = searchParams.get('order_id');

    if ((paymentStatus === 'pending' || paymentStatus === 'success') && orderId) {
      navigate(`/order-success?order_id=${orderId}`, { replace: true });
    }
    if (paymentStatus === 'failure' && orderId) {
      navigate(`/order-failure?order_id=${orderId}`, { replace: true });
    }
    if (cancelled === 'true') {
      setPayosError(t('paymentCancelled', 'Giao dịch chuyển khoản đã huỷ. Giỏ hàng vẫn được giữ nguyên, bạn có thể thử lại hoặc đổi sang Tiền mặt.'));
    }
  }, [searchParams, navigate, t]);

  /* ── Build CheckoutNewSummary from cart store ── */
  const summary: CheckoutNewSummary = useMemo(() => ({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      variant: item.modifiers?.join(' • ') || t('variantStandard'),
      quantity: item.quantity,
      price: item.price,
      imageUrl: item.image || '',
    })),
    subtotal,
    tax: 0,
    taxLabel: undefined,
    deliveryFee,
    deliveryLabel: qualifiesForFreeDelivery
      ? t('deliveryFree', 'Miễn phí giao hàng (từ 2 ly)')
      : t('deliveryFee', 'Phí giao hàng'),
    total: subtotal + deliveryFee,
  }), [items, subtotal, deliveryFee, qualifiesForFreeDelivery, t]);

  /* ── Place Order Handler ── */
  const handlePlaceOrder = useCallback(async (formData: CheckoutNewFormData) => {
    // Double-submit guard
    if (submittingRef.current) return;
    submittingRef.current = true;

    setPayosError(null);
    clearPaymentError();

    // Parse numeric table number (1-12) from inputs like "Bàn 5", "5", "AURA-5", "DEMO-6678"
    const rawTable = formData.tableNumber?.trim() || '';
    const numMatch = rawTable.match(/\b([1-9]|1[0-2])\b/);
    const validTableNumber = numMatch ? numMatch[1] : null;

    // Dine-in invariant: backend requires table_id to resolve to an actual cafe_tables table_number (1-12).
    // If user has a booking code like DEMO-6678 (no direct 1-12 table mapped),
    // we preserve the booking code in customer_address & notes, and use takeaway or a valid mapped table.
    const isRealDineIn = formData.orderType === 'dine_in' && Boolean(validTableNumber);
    const effectiveOrderType: 'dine_in' | 'takeaway' | 'delivery' = formData.orderType === 'dine_in'
      ? (validTableNumber ? 'dine_in' : 'takeaway')
      : (formData.orderType || 'delivery');

    const effectiveShippingFee = effectiveOrderType === 'delivery'
      ? (totalItems >= 2 ? 0 : 15_000)
      : 0;
    const appliedDiscount = Math.max(0, Number(formData.discount || 0));
    const effectiveTotal = Math.max(0, subtotal + effectiveShippingFee - appliedDiscount);
    const normalizedPromoCode = formData.promoCode?.trim().toUpperCase() || undefined;

    const payload = {
      items: items.map((i) => {
        const baseProductId = (i.productId || i.id || '').trim();
        return {
          id: i.id,
          product_id: baseProductId,
          productId: baseProductId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          notes: [
            i.notes,
            Array.isArray(i.modifiers) && i.modifiers.length > 0 ? `Tùy chọn: ${i.modifiers.join(', ')}` : '',
          ].filter(Boolean).join(' | '),
        };
      }),
      total: effectiveTotal,
      customer_name: formData.fullName,
      customer_phone: formData.phone,
      customer_email: '',
      customer_address: effectiveOrderType === 'delivery'
        ? formData.address
        : (isRealDineIn ? `Bàn ${validTableNumber}` : (rawTable ? `Đặt trước: ${rawTable}` : 'Nhận tại quầy bar AURA')),
      order_type: effectiveOrderType,
      ...(isRealDineIn && validTableNumber ? { table_id: validTableNumber } : {}),
      payment_method: formData.paymentMethod,
      notes: formData.notes,
      delivery_time: 'now',
      shipping_fee: effectiveShippingFee,
      service_fee: 0,
      discount: appliedDiscount,
      ...(normalizedPromoCode ? { promo_code: normalizedPromoCode } : {}),
      tip: 0,
    };

    try {
      const { intent, order, identity, alreadyPaid } = await resolveCheckoutOrder({ payload, identity: checkoutIdentity,
        createOrder: useOrderStore.getState().createOrder,
        creationError: () => useOrderStore.getState().error || t('failedToCreateOrder'),
      });
      const { id: orderId, total: serverTotal } = order;

      // Handle PayOS redirect with internal retry
      if (formData.paymentMethod === 'payos' && !alreadyPaid) {
        setPayosRetrying(true);
        const url = await retryCreatePaymentLink(orderId, serverTotal);
        setPayosRetrying(false);
        if (checkoutIdentity() !== identity) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
        if (url) {
          window.location.href = url;
          return;
        }
        submittingRef.current = false;
        throw new Error(usePaymentStore.getState().error || t('paymentLinkFailed'));
      }

      // Acknowledge COD or an already settled retry, then show its confirmation.
      clearCheckoutIntent(intent.key);
      try {
        localStorage.removeItem('aura_checkout_form');
      } catch { /* storage unavailable */ }
      clearCart();
      navigate(`/order-success?order_id=${orderId}`);
    } catch (err) {
      setPayosRetrying(false);
      submittingRef.current = false;
      throw err; // StitchCheckout catches and displays the error
    }
  }, [items, subtotal, totalItems, clearCart, clearPaymentError, navigate, retryCreatePaymentLink, t]);

  const isRedirecting = Boolean(searchParams.get('payment') && searchParams.get('order_id'));

  return (
    <>
      <HelmetHead
        title={t('checkoutSeoTitle', 'Thanh Toán — AURA CAFE')}
        description={t('checkoutSeoDescription', 'Thanh toán đơn hàng tại AURA CAFE')}
        canonical="/checkout"
      />
      <StitchCheckoutNew
        summary={summary}
        isLoading={payosRetrying || isRedirecting}
        isProcessing={payosRetrying}
        error={payosError}
        onPlaceOrder={handlePlaceOrder}
        locale="vi"
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onClearCart={() => { clearCheckoutIntent(); clearCart(); }}
      />
    </>
  );
}

export default CheckoutPage;
