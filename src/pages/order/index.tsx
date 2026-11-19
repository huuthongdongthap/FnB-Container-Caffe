import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StitchMobileOrderNew, type CartItem } from '@/components/stitch';
import { useOrderStore } from '@/hooks/stores/use-order-store';

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function OrderPage() {
  const { t } = useTranslation(['stitch', 'order']);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableParam = searchParams.get('table');
  const tableId = tableParam ?? 'Takeaway';
  const isTableMode = Boolean(tableParam);

  const { createOrder } = useOrderStore();
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateCustomerForm = useCallback((): boolean => {
    if (!guestName.trim()) {
      setSubmitError('Vui lòng nhập tên của bạn');
      return false;
    }
    const digits = normalizePhone(guestPhone);
    if (digits.length < 8) {
      setSubmitError('Vui lòng nhập số điện thoại hợp lệ (ít nhất 8 chữ số)');
      return false;
    }
    setSubmitError(null);
    return true;
  }, [guestName, guestPhone]);

  const handleViewCart = useCallback(
    async (cart: CartItem[]) => {
      setSubmitError(null);

      if (!validateCustomerForm()) {
        return;
      }

      setIsSubmitting(true);

      try {
        const total = cart.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );
        const payload = {
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          total,
          customer_name: guestName.trim(),
          customer_phone: normalizePhone(guestPhone).trim(),
          customer_address: '',
          order_type: (isTableMode ? 'dine_in' : 'takeaway') as 'dine_in' | 'takeaway',
          payment_method: 'payos' as const,
          table_id: isTableMode ? tableId : undefined,
        };

        const raw = await createOrder(payload);
        const order =
          (raw as { order?: { id?: string }; data?: { id?: string }; id?: string } | null)?.order ??
          (raw as { data?: { id?: string }; id?: string } | null)?.data ??
          raw;
        if (order?.id) {
          navigate(`/order-success?order_id=${encodeURIComponent(order.id)}`);
        } else if (useOrderStore.getState().queuedOffline) {
          setSubmitError('Bạn đang offline. Đơn hàng sẽ được lưu và gửi khi có mạng.');
        } else {
          throw new Error(useOrderStore.getState().error || 'Không nhận được mã đơn hàng');
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Lỗi tạo đơn hàng';
        setSubmitError(msg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isTableMode,
      tableId,
      guestName,
      guestPhone,
      validateCustomerForm,
      createOrder,
      navigate,
    ],
  );

  return (
    <>
      <HelmetHead
        title={t('order:seoTitle')}
        description={t('order:seoDescription')}
        canonical="/order"
      />

      {/* Guest info form — rendered only when a QR table param is present */}
      {isTableMode && (
        <div
          className="fixed left-0 right-0 z-40 px-5 pt-3 pb-3"
          style={{
            top: '3rem',
            background: 'rgba(10, 26, 46, 0.7)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '0.5px solid rgba(229, 228, 226, 0.15)',
          }}
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                if (submitError) setSubmitError(null);
              }}
              placeholder="Tên của bạn"
              disabled={isSubmitting}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[13px] font-body bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[var(--aura-text-primary, #e8e8e8)] placeholder:text-[var(--aura-text-secondary, #a0a8b0)] focus:outline-none focus:border-[rgba(198,198,199,0.3)] focus:ring-1 focus:ring-[rgba(198,198,199,0.1)] transition-all disabled:opacity-50"
            />
            <input
              type="tel"
              inputMode="numeric"
              value={guestPhone}
              onChange={(e) => {
                setGuestPhone(e.target.value);
                if (submitError) setSubmitError(null);
              }}
              placeholder="Số điện thoại"
              disabled={isSubmitting}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[13px] font-body bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[var(--aura-text-primary, #e8e8e8)] placeholder:text-[var(--aura-text-secondary, #a0a8b0)] focus:outline-none focus:border-[rgba(198,198,199,0.3)] focus:ring-1 focus:ring-[rgba(198,198,199,0.1)] transition-all disabled:opacity-50"
            />
          </div>

          {/* Inline field-level or submission error */}
          {submitError && (
            <p
              className="mt-2 text-[12px] text-[#ffb4ab] font-body"
              role="alert"
            >
              {submitError}
            </p>
          )}
        </div>
      )}

      {/* Spacer — avoids Stitch's main content (pt-16) disappearing behind the
      fixed header + optional guest-info form when a QR table is present. */}
      {isTableMode && <div style={{ height: '6.5rem' }} aria-hidden="true" />}

      <StitchMobileOrderNew tableId={tableId} onViewCart={handleViewCart} />
    </>
  );
}
