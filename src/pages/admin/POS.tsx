/**
 * AURA CAFE — Point of Sale Terminal (Stitch Wrapper)
 *
 * Wraps the StitchPOSNew component with business logic hooks:
 * useMenu(), useCheckout(), useProcessPayOS() and payment/checkout state.
 * Overlays success/error status banners on top of the component.
 *
 * States: loading (delegated to StitchPOSNew), error (delegated to StitchPOSNew),
 *         empty (delegated to StitchPOSNew), populated
 */
'use client';

import { useState, useCallback } from 'react';
import type { POSCustomer } from '@/hooks/use-pos-customer';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMenu } from '@/hooks/use-menu';
import { useCheckout, useProcessPayOS } from '@/hooks/use-checkout';
import { CheckCircle2, AlertCircle, X, ExternalLink } from 'lucide-react';
import type { PaymentMethod } from '@/lib/validators';
import { brandConfig } from '@/config/brand-types';
import { StitchPOSNew } from '@/components/stitch/StitchPOSNew';
import type { POSNewMenuItem, POSNewCartItem, POSNewAddOn } from '@/components/stitch/StitchPOSNew-types';

const VND_POS_ADDONS: POSNewAddOn[] = [
  { id: 'a1', name: 'Oat Milk', price: 10000 },
  { id: 'a2', name: 'Double Shot', price: 15000 },
  { id: 'a3', name: 'Vanilla Bean', price: 10000 },
];

/* ─── Main Page Component ────────────────────────────────────────────────── */
export default function AdminPOSPage() {
  /* ── Data Hooks ───────────────────────────────────────────────────── */
  const {
    data: menuData,
    isLoading: menuLoading,
    isError: menuIsError,
    error: menuError,
  } = useMenu({ available: true, limit: 100 });

  const checkoutMutation = useCheckout();
  const payOSMutation = useProcessPayOS();
  const { t } = useTranslation();
  const navigate = useNavigate();

  /* ── Local State ──────────────────────────────────────────────────── */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('payos');
  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>(undefined);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  /* ── Derived Menu Data for StitchPOSNew ───────────────────────────── */
  const stitchMenuItems: POSNewMenuItem[] | undefined = menuData?.items?.map(
    (item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      image: item.image_url,
    }),
  );

  /* ── Payment Handler ──────────────────────────────────────────────── */
  const handlePayment = useCallback((method: 'payos' | 'cod') => {
    setPaymentMethod(method);
  }, []);

  /* ── Checkout Handler ─────────────────────────────────────────────── */
  const handleCompleteOrder = useCallback(
    async (cart: POSNewCartItem[], total: number, tableId?: string) => {
      if (isCompleting) return;

      setIsCompleting(true);
      setCheckoutError(null);
      setCheckoutSuccess(false);
      setPaymentUrl(null);

      // Use tableId from POS component if provided, else fall back to state
      const resolvedTableId = tableId ?? selectedTableId;

      try {
        const subtotal = cart.reduce((acc, ci) => acc + ci.price * ci.quantity, 0);
        const serviceFee = Math.max(0, Math.round(total - subtotal));
        const result = await checkoutMutation.mutateAsync({
          items: cart.map((ci) => ({
            id: ci.id,
            name: ci.name,
            price: ci.price,
            quantity: ci.quantity,
          })),
          total: Math.round(total),
          customer_name: customer?.name || t('adminPOS.customerDefaultName'),
          customer_phone: customer?.phone || '0900000000',
          customer_id: customer?.id,
          customer_email: undefined,
          customer_address: t('adminPOS.customerDefaultAddress'),
          payment_method: paymentMethod,
          shipping_fee: 0,
          service_fee: serviceFee,
          discount: 0,
          tip: 0,
          ...(resolvedTableId ? { table_id: resolvedTableId } : {}),
        });

        if (result.success) {
          let resolvedUrl = result.payment_url || result.checkout_url;
          const createdOrderId = result.order_id || result.order?.id;
          if (paymentMethod === 'payos' && !resolvedUrl && createdOrderId) {
            try {
              const payRes = await payOSMutation.mutateAsync({
                order_id: createdOrderId,
                total: Math.round(total),
                cancel_url: window.location.href,
                return_url: window.location.href,
                description: `POS #${createdOrderId.slice(0, 8)}`,
              });
              resolvedUrl = payRes.payment_url || payRes.checkout_url || payRes.checkoutUrl;
            } catch {
              // Non-fatal: order created, staff can retry payment link
            }
          }
          if (paymentMethod === 'payos' && resolvedUrl) {
            const url = resolvedUrl;
            // Use React Router navigate instead of window.open (blocked on tablets)
            // Store URL for in-app iframe / link fallback
            setPaymentUrl(url ?? null);
            // Attempt soft redirect — if same-origin, navigate; else show link banner
            try {
              const parsed = new URL(url ?? '');
              if (parsed.origin === window.location.origin) {
                navigate(parsed.pathname + parsed.search);
              } else {
                // Cross-origin PayOS — show clickable banner instead of window.open
                setPaymentUrl(url ?? null);
              }
            } catch {
              setPaymentUrl(url ?? null);
            }
          }

          setCheckoutSuccess(true);
          setTimeout(() => setCheckoutSuccess(false), 5000);
          return true;
        } else {
          setCheckoutError(
            result.message || t('adminPOS.createOrderError'),
          );
          return false;
        }
      } catch (err) {
        setCheckoutError(
          err instanceof Error ? err.message : t('adminPOS.createOrderError'),
        );
        return false;
      } finally {
        setIsCompleting(false);
      }
    },
    [paymentMethod, checkoutMutation.mutateAsync, payOSMutation.mutateAsync, isCompleting, customer, selectedTableId, t, navigate],
  );

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen">
      <StitchPOSNew
        menuItems={stitchMenuItems}
        addOns={VND_POS_ADDONS}
        paymentMethod={paymentMethod === 'cod' ? 'cod' : 'payos'}
        loading={menuLoading}
        error={
          menuIsError
            ? menuError instanceof Error
              ? menuError.message
              : 'Failed to load menu. Check server connection.'
            : null
        }
        brandName={brandConfig.brand.nameShort}
        onCompleteOrder={handleCompleteOrder}
        onPayment={handlePayment}
        customer={customer}
        onCustomerFound={setCustomer}
        onClearCustomer={() => setCustomer(null)}
        onOpenSchedule={() => navigate('/admin/staff')}
        onEndShift={() => navigate('/admin/staff')}
      />

      {/* ── Success Banner Overlay ─────────────────────────────────────── */}
      {checkoutSuccess && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-lg shadow-lg"
          style={{
            backgroundColor: 'rgba(76,175,80,0.95)',
            color: '#fff',
          }}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">Order created successfully!</span>
        </div>
      )}

      {/* ── Error Banner Overlay ────────────────────────────────────────── */}
      {checkoutError && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-lg shadow-lg"
          style={{
            backgroundColor: 'rgba(220,53,69,0.95)',
            color: '#fff',
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm flex-1">{checkoutError}</span>
          <button
            type="button"
            onClick={() => setCheckoutError(null)}
            className="shrink-0 ml-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── PayOS Payment Link Modal (replaces window.open) ─────────── */}
      {paymentUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Thanh toán PayOS"
        >
          <div
            className="flex flex-col items-center gap-3 px-6 py-5 rounded-xl shadow-2xl max-w-sm w-full text-center"
            style={{ backgroundColor: 'rgba(10,26,46,0.98)', border: '1px solid rgba(201,214,223,0.3)', color: '#fff' }}
          >
            <span className="text-xs font-semibold text-[#C9D6DF] uppercase tracking-wider">Thanh toán PayOS</span>
            <div className="rounded-lg bg-white p-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(paymentUrl)}`}
                alt="PayOS QR Code"
                className="h-44 w-44 object-contain"
              />
            </div>
            <p className="text-xs text-[#C9D6DF] break-all">{paymentUrl}</p>
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mt-1 px-4 py-2 rounded-full bg-[#6B9FB8] text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" /> Mở trang thanh toán
            </a>
            <button
              type="button"
              onClick={() => setPaymentUrl(null)}
              className="text-xs text-[#8898A4] hover:text-white mt-1 cursor-pointer transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
