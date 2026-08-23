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
import { useMenu } from '@/hooks/use-menu';
import { useCheckout, useProcessPayOS } from '@/hooks/use-checkout';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
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

  /* ── Local State ──────────────────────────────────────────────────── */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('payos');
  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  /* ── Derived Menu Data for StitchPOSNew ───────────────────────────── */
  const stitchMenuItems: POSNewMenuItem[] | undefined = menuData?.items?.map(
    (item) => ({
      id: String(item.id),
      name: item.name,
      price: item.price,
      category: item.category,
      image: item.image,
    }),
  );

  /* ── Payment Handler ──────────────────────────────────────────────── */
  const handlePayment = useCallback((method: 'payos' | 'cod') => {
    setPaymentMethod(method);
  }, []);

  /* ── Checkout Handler ─────────────────────────────────────────────── */
  const handleCompleteOrder = useCallback(
    async (cart: POSNewCartItem[], total: number) => {
      if (isCompleting) return;

      setIsCompleting(true);
      setCheckoutError(null);
      setCheckoutSuccess(false);

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
        });

        if (result.success) {
          if (
            paymentMethod === 'payos' &&
            (result.payment_url || result.checkout_url)
          ) {
            const url = result.payment_url || result.checkout_url;
            window.open(url, '_blank');
          }

          setCheckoutSuccess(true);
          setTimeout(() => setCheckoutSuccess(false), 3000);
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
    [paymentMethod, checkoutMutation.mutateAsync, isCompleting, customer, t],
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
    </div>
  );
}
