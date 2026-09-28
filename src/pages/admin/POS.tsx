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
import type { POSNewMenuItem, POSNewCartItem } from '@/components/stitch/StitchPOSNew-types';

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
        const result = await checkoutMutation.mutateAsync({
          items: cart.map((ci) => ({
            id: ci.id,
            name: ci.name,
            price: ci.price,
            quantity: ci.quantity,
          })),
          total,
          customer_name: customer?.name || t('adminPOS.customerDefaultName'),
          customer_phone: customer?.phone || '0900000000',
          customer_id: customer?.id,
          customer_email: undefined,
          customer_address: t('adminPOS.customerDefaultAddress'),
          payment_method: paymentMethod,
          shipping_fee: 0,
          discount: 0,
          tip: 0,
          ...(resolvedTableId ? { table_id: resolvedTableId } : {}),
        });

        if (result.success) {
          if (
            paymentMethod === 'payos' &&
            (result.payment_url || result.checkout_url)
          ) {
            const url = result.payment_url || result.checkout_url;
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
        } else {
          setCheckoutError(
            result.message || t('adminPOS.createOrderError'),
          );
        }
      } catch (err) {
        setCheckoutError(
          err instanceof Error ? err.message : t('adminPOS.createOrderError'),
        );
      } finally {
        setIsCompleting(false);
      }
    },
    [paymentMethod, checkoutMutation.mutateAsync, isCompleting, customer, selectedTableId, t, navigate],
  );

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen">
      <StitchPOSNew
        menuItems={stitchMenuItems}
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

      {/* ── PayOS Payment Link Banner (replaces window.open) ─────────── */}
      {paymentUrl && checkoutSuccess && (
        <div
          className="fixed top-32 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 px-5 py-4 rounded-lg shadow-lg max-w-sm w-full text-center"
          style={{ backgroundColor: 'rgba(10,26,46,0.97)', border: '1px solid rgba(201,214,223,0.3)', color: '#fff' }}
        >
          <span className="text-xs font-semibold text-[#C9D6DF] uppercase tracking-wider">Thanh toán PayOS</span>
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
      )}
    </div>
  );
}
