import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import { usePaymentStore } from '@/hooks/stores/use-payment-store';
import { CheckoutForm } from '@/components/order/checkout-form';
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
            <div className="sticky top-24 rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 backdrop-blur-sm">
              <h3 className="mb-4 font-display text-lg font-semibold text-chrome-bright">
                Đơn hàng ({totalItems} món)
              </h3>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-chrome-light/70">
                      {item.name}
                      <span className="ml-1 text-chrome-light/40">x{item.quantity}</span>
                    </span>
                    <span className="tabular-nums text-chrome-light/90">
                      {new Intl.NumberFormat('vi-VN').format(item.price * item.quantity) + '₫'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t border-chrome-light/10 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-chrome-light/60">Tạm tính</span>
                  <span className="text-chrome-light/90">{new Intl.NumberFormat('vi-VN').format(subtotal) + '₫'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-chrome-light/60">Phí phục vụ (5%)</span>
                  <span className="text-chrome-light/90">{new Intl.NumberFormat('vi-VN').format(serviceFee) + '₫'}</span>
                </div>
                <div className="flex justify-between border-t border-chrome-light/10 pt-2 text-base font-bold">
                  <span className="text-chrome-bright">Tổng cộng</span>
                  <span className="text-chrome-bright">{new Intl.NumberFormat('vi-VN').format(total) + '₫'}</span>
                </div>
              </div>

              {!qualifiesForFreeDelivery && subtotal > 0 && (
                <p className="mt-4 rounded-lg bg-chrome-mid/10 p-3 text-center text-xs text-chrome-light/60">
                  🚚 Thêm {new Intl.NumberFormat('vi-VN').format(remainingForFreeDelivery) + '₫'} để miễn phí giao hàng
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
