import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useCart } from '@/hooks/use-cart';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import { usePaymentStore } from '@/hooks/stores/use-payment-store';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import { CheckoutForm } from '@/components/order/checkout-form';
import { OrderSummarySidebar } from '@/components/order/order-summary-sidebar';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import type { CheckoutFormData } from '@/lib/validators';

/* ═══════════════════════════════════════════════════════════════════
   Checkout Page
   Handles checkout.html redirect (supports /checkout and /checkout.html).
   ═══════════════════════════════════════════════════════════════════ */

export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payosError, setPayosError] = useState<string | null>(null);
  const [payosRetrying, setPayosRetrying] = useState(false);
  const submittingRef = useRef(false);
  const retryCreatePaymentLink = usePaymentStore((s) => s.retryCreatePaymentLink);
  const clearPaymentError = usePaymentStore((s) => s.clearPaymentError);

  const tableId = useCartStore((s) => s.tableId);

  const {
    items,
    totalItems,
    subtotal,
    serviceFee,
    total,
    qualifiesForFreeDelivery,
    remainingForFreeDelivery,
    clearCart,
  } = useCart();

  // Handle redirect from checkout.html (PayOS return URL bridge)
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

  // Redirect to menu if cart is empty (on mount)
  useEffect(() => {
    if (items.length === 0) {
      const timeout = setTimeout(() => navigate('/menu'), 200);
      return () => clearTimeout(timeout);
    }
  }, [items.length, navigate]);

  const retryPayOS = useCallback(async (orderId: string, amount: number) => {
    clearPaymentError();
    setPayosError(null);
    setPayosRetrying(true);
    const url = await retryCreatePaymentLink(orderId, amount);
    setPayosRetrying(false);
    if (url) {
      clearCart();
      window.location.href = url;
    } else {
      setPayosError(usePaymentStore.getState().error || 'Không thể tạo liên kết thanh toán');
    }
  }, [clearCart, clearPaymentError, retryCreatePaymentLink]);

  const handleSubmit = async (formData: CheckoutFormData) => {
    // Double-submit guard
    if (submittingRef.current) return;
    submittingRef.current = true;

    const totalWithTip = total + (formData.tip ?? 0);

    const payload = {
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      total: totalWithTip,
      customer_name: formData.fullName,
      customer_phone: formData.phone,
      customer_email: formData.email || '',
      customer_address: formData.address,
      payment_method: formData.paymentMethod,
      notes: formData.notes || '',
      delivery_time: formData.deliveryTime,
      shipping_fee: 0,
      discount: 0,
      tip: formData.tip ?? 0,
      ...(tableId ? { table_id: tableId } : {}),
    };

    setIsSubmitting(true);
    setPayosError(null);

    try {
      // Step 1: Create order
      const order = await useOrderStore.getState().createOrder(payload);
      if (!order) {
        setIsSubmitting(false);
        submittingRef.current = false;
        return;
      }

      // Save order info for success page
      const orderData = {
        id: order.id,
        total: order.total,
        payment_method: order.payment_method,
        items: order.items,
        customer_name: formData.fullName,
        ...(tableId ? { table_id: tableId } : {}),
      };
      try {
        localStorage.setItem('pendingOrder', JSON.stringify(orderData));
      } catch { /* storage unavailable */ }

      // Handle PayOS redirect with retry
      if (formData.paymentMethod === 'payos') {
        setPayosRetrying(true);
        const url = await retryCreatePaymentLink(order.id, totalWithTip);
        setPayosRetrying(false);
        if (url) {
          clearCart();
          window.location.href = url;
          return;
        }
        // Payment link failed after retries — show error with retry button
        setPayosError(usePaymentStore.getState().error || 'Không thể tạo liên kết thanh toán');
        setIsSubmitting(false);
        submittingRef.current = false;
        return;
      }

      // COD: clear cart and go to success
      clearCart();
      navigate(`/order-success?order_id=${order.id}`);
    } catch {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gradient-to-b from-[#050D1A] to-[#0F172A]">
        <div className="text-center">
          <p className="mb-4 text-chrome-light/60">Giỏ hàng trống</p>
          <Link to="/menu">
            <Button variant="primary">
              Quay lại Menu
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <HelmetHead
        title="Thanh toán"
        description="Thanh toán đơn hàng tại AURA CAFE — Hỗ trợ COD và PayOS QR. An toàn, nhanh chóng."
        canonical="/checkout"
      />
    <div className="min-h-screen bg-gradient-to-b from-[#050D1A] via-[#0A1A2E] to-[#0F172A]">
      {/* Header */}
      <div className="border-b border-chrome-light/10 bg-[#0A1A2E]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <Link to="/menu" className="flex items-center gap-2 text-sm text-chrome-light/60 hover:text-chrome-bright transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Quay lại Menu
          </Link>
          <h1 className="font-display text-xl font-bold text-chrome-bright">
            Thanh toán
          </h1>
          {tableId && (
            <span className="ml-auto rounded-full border border-amber-400/30 px-2.5 py-1 text-xs text-amber-400/70">
              Dùng bàn: {tableId}
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Form */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 backdrop-blur-sm">
              <CheckoutForm
                cartItems={items}
                subtotal={subtotal}
                serviceFee={serviceFee}
                total={total}
                qualifiesForFreeDelivery={qualifiesForFreeDelivery}
                remainingForFreeDelivery={remainingForFreeDelivery}
                isSubmitting={isSubmitting || payosRetrying}
                onSubmit={handleSubmit}
                isDineIn={tableId != null}
                tableId={tableId}
              />

              {/* PayOS Error + Retry */}
              {payosError && !payosRetrying && (
                <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-center">
                  <p className="mb-2 text-sm text-red-800">{payosError}</p>
                  <Button
                    onClick={() => {
                      const pendingOrder = useOrderStore.getState().currentOrder;
                      if (pendingOrder) {
                        retryPayOS(pendingOrder.id, pendingOrder.total);
                      }
                    }}
                    variant="secondary"
                  >
                    &#128260; Thử lại
                  </Button>
                  <p className="mt-2 text-xs text-red-600">
                    Hoặc liên hệ hỗ trợ nếu vẫn thất bại
                  </p>
                </div>
              )}

              {/* Retrying indicator */}
              {payosRetrying && (
                <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-center">
                  <div className="mb-2 flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                    <span className="text-sm text-amber-800">
                      Đang thử lại... ({usePaymentStore.getState().retryCount}/3)
                    </span>
                  </div>
                  <p className="text-xs text-amber-600">Vui lòng không đóng trang này</p>
                </div>
              )}
            </div>
          </div>

          {/* Summary sidebar (desktop) */}
          <div className="hidden lg:block">
            <OrderSummarySidebar
              items={items}
              totalItems={totalItems}
              subtotal={subtotal}
              serviceFee={serviceFee}
              total={total}
              qualifiesForFreeDelivery={qualifiesForFreeDelivery}
              remainingForFreeDelivery={remainingForFreeDelivery}
            />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
