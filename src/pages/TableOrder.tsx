'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StitchMobileOrderNew } from '@/components/stitch';
import { useOrderStoreWithOfflineFlush } from '@/hooks/stores/use-order-store';
import { isTableIdValid, validateCustomerForm } from './TableOrder-utils';
import {
  InvalidQRPage,
  GuestInfoForm,
  OfflineIndicator,
} from './TableOrder-components';
import { useHandleViewCart } from './TableOrder-hooks';

export type { CartItem } from '@/components/stitch';

/* ═══════════════════════════════════════════════════════════════════
 * TableOrder — FnB Guest Ordering Page (Phase 3)
 *
 * 1. ?table=<id> required; missing/malformed → invalid-QR error page.
 * 2. Collect guest name + phone.
 * 3. POST /api/orders/guest-checkin to reserve the table.
 * 4. createOrder (auto-queues to IndexedDB if offline).
 * 5. On success → navigate /order-success?order_id=<id>.
 * ═══════════════════════════════════════════════════════════════════ */

export function TableOrder(): ReactNode {
  const { t } = useTranslation('order');
  const [searchParams] = useSearchParams();
  const rawTable = searchParams.get('table');
  const tableId = rawTable?.trim() ?? '';
  const hasValidTable = isTableIdValid(rawTable);

  const { queuedOffline } = useOrderStoreWithOfflineFlush(
    (s) => ({ queuedOffline: s.queuedOffline }),
  );

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasValidTable) {
      setSubmitError(
        t('invalidQR', {
          defaultValue:
            'Mã QR không hợp lệ. Vui lòng quét lại hoặc liên hệ nhân viên.',
        }),
      );
    }
  }, [hasValidTable, t]);

  const handleViewCart = useHandleViewCart({
    tableId, hasValidTable, guestName, guestPhone,
    isSubmitting, queuedOffline, submitError, setIsSubmitting, setSubmitError,
    validateCustomerForm: () => {
      const result = validateCustomerForm(guestName, guestPhone, t);
      if (!result.valid) setSubmitError(result.error ?? null);
      return result.valid;
    },
  });

  const clearError = useCallback(() => {
    if (submitError) setSubmitError(null);
  }, [submitError]);

  if (!hasValidTable) return <InvalidQRPage submitError={submitError} />;

  return (
    <>
      <HelmetHead
        title={t('seoTitle', { defaultValue: 'Đặt Món — AURA CAFE' })}
        description={t('seoDescription', {
          defaultValue: 'Đặt món trực tiếp tại bàn của bạn.',
        })}
        canonical={`/order?table=${encodeURIComponent(tableId)}`}
      />
      <GuestInfoForm
        guestName={guestName}
        guestPhone={guestPhone}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onNameChange={(v) => { setGuestName(v); clearError(); }}
        onPhoneChange={(v) => { setGuestPhone(v); clearError(); }}
      />
      <div style={{ height: '6.5rem' }} aria-hidden="true" />
      {queuedOffline && <OfflineIndicator />}
      <StitchMobileOrderNew
        tableId={tableId ?? undefined}
        onViewCart={handleViewCart}
      />
    </>
  );
}

export default TableOrder;
