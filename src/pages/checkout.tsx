import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StitchCheckoutNew, type CheckoutNewFormData, type CheckoutNewSummary } from '@/components/stitch/StitchCheckoutNew';
import { useCart } from '@/hooks/use-cart';
import { useOrderStore, useOrderStoreWithOfflineFlush } from '@/hooks/stores/use-order-store';
import { usePaymentStore } from '@/hooks/stores/use-payment-store';
import { API_BASE } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Checkout Page — Production page using StitchCheckout component.
   Matches Stitch AI design pixel-perfect with store integration.
   ═══════════════════════════════════════════════════════════════════ */

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
    subtotal,
    serviceFee,
    total,
    clearCart,
  } = useCart();

  /* ── Handle redirect from checkout.html (PayOS return URL bridge) ── */
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const orderId = searchParams.get('order_id');

    if ((paymentStatus === 'pending' || paymentStatus === 'success') && orderId) {
      navigate(`/order-success?order_id=${orderId}`, { replace: true });
    }
    if (paymentStatus === 'failure' && orderId) {
      navigate(`/order-failure?order_id=${orderId}`, { replace: true });
    }
  }, [searchParams, navigate]);

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
    tax: serviceFee,
    taxLabel: t('luxuryTax'),
    deliveryFee: 0,
    deliveryLabel: t('deliveryFee'),
    total,
  }), [items, subtotal, serviceFee, total, t]);

  /* ── Place Order Handler ── */
  const handlePlaceOrder = useCallback(async (formData: CheckoutNewFormData) => {
    // Double-submit guard
    if (submittingRef.current) return;
    submittingRef.current = true;

    setPayosError(null);
    clearPaymentError();

    const payload = {
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      total,
      customer_name: formData.fullName,
      customer_phone: formData.phone,
      customer_email: '',
      customer_address: formData.address,
      payment_method: formData.paymentMethod,
      notes: formData.notes,
      delivery_time: 'now',
      shipping_fee: 0,
      discount: 0,
      tip: 0,
    };

    // Apple Pay / Google Pay — use Payment Request API
    if (formData.paymentMethod === 'apple_pay' || formData.paymentMethod === 'google_pay') {
      try {
        const supportedMethods = formData.paymentMethod === 'apple_pay'
          ? [{ supportedMethods: 'https://apple.com/apple-pay', data: { version: 3, merchantIdentifier: 'merchant.com.auracafe', merchantCapabilities: ['supports3DS'], supportedNetworks: ['visa', 'masterCard', 'amex'], countryCode: 'VN' } }]
          : [{ supportedMethods: 'https://google.com/pay', data: { apiVersion: 2, apiVersionMinor: 0 } }];

        const pr = new PaymentRequest(supportedMethods, {
          total: { label: 'AURA CAFE', amount: { currency: 'VND', value: String(total) } },
        });

        const canPay = await pr.canMakePayment();
        if (!canPay) {
          submittingRef.current = false;
          setPayosError(t('paymentNotAvailable', 'Thanh toán không khả dụng trên thiết bị này'));
          return;
        }

        const response = await pr.show();
        // Create order first, then process payment token
        const order = await useOrderStore.getState().createOrder(payload);
        if (!order) {
          await response.complete('fail');
          submittingRef.current = false;
          setPayosError(useOrderStore.getState().error || t('failedToCreateOrder'));
          return;
        }

        // Send payment token to backend
        const res = await fetch(`${API_BASE}/api/payments/payment-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: order.id,
            payment_token: response.details,
            amount: total,
            currency: 'VND',
          }),
        });
        const result = await res.json();

        if (result.success) {
          await response.complete('success');
          try { localStorage.setItem('pendingOrder', JSON.stringify({ id: order.id, total: order.total, payment_method: formData.paymentMethod, items: order.items, customer_name: formData.fullName })); } catch { /* */ }
          clearCart();
          navigate(`/order-success?order_id=${order.id}`);
        } else {
          await response.complete('fail');
          submittingRef.current = false;
          setPayosError(result.error || t('paymentFailed', 'Thanh toán thất bại'));
        }
      } catch (err) {
        submittingRef.current = false;
        if (err instanceof Error && err.name !== 'AbortError') {
          setPayosError(err.message || t('paymentError', 'Lỗi thanh toán'));
        }
      }
      return;
    }

    try {
      // Step 1: Create order via API
      const order = await useOrderStore.getState().createOrder(payload);
      if (!order) {
        submittingRef.current = false;
        throw new Error(useOrderStore.getState().error || t('failedToCreateOrder'));
      }

      // Save order info for success page
      try {
        localStorage.setItem('pendingOrder', JSON.stringify({
          id: order.id,
          total: order.total,
          payment_method: order.payment_method,
          items: order.items,
          customer_name: formData.fullName,
        }));
      } catch { /* storage unavailable */ }

      // Handle PayOS redirect with internal retry
      if (formData.paymentMethod === 'payos') {
        setPayosRetrying(true);
        const url = await retryCreatePaymentLink(order.id, total);
        setPayosRetrying(false);
        if (url) {
          clearCart();
          window.location.href = url;
          return;
        }
        submittingRef.current = false;
        throw new Error(usePaymentStore.getState().error || t('paymentLinkFailed'));
      }

      // COD: clear cart and navigate to success
      clearCart();
      navigate(`/order-success?order_id=${order.id}`);
    } catch (err) {
      submittingRef.current = false;
      throw err; // StitchCheckout catches and displays the error
    }
  }, [items, total, clearCart, clearPaymentError, navigate, retryCreatePaymentLink, t]);

  return (
    <>
      <HelmetHead
        title={t('checkoutSeoTitle', 'Thanh Toán — AURA CAFE')}
        description={t('checkoutSeoDescription', 'Thanh toán đơn hàng tại AURA CAFE')}
        canonical="/checkout"
      />
      <StitchCheckoutNew
      summary={summary}
      isProcessing={payosRetrying}
      error={payosError}
      onPlaceOrder={handlePlaceOrder}
      locale="vi"
    />
    </>
  );
}

export default CheckoutPage;
