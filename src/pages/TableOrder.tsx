'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StitchMobileOrderNew, type CartItem } from '@/components/stitch';
import {
  useOrderStoreWithOfflineFlush,
} from '@/hooks/stores/use-order-store';
import { API_BASE } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
 * TableOrder — FnB Guest Ordering Page (Phase 3)
 *
 * Behavior
 *  1. ?table=<id> is required; missing/malformed → invalid-QR error page.
 *  2. Collect guest name + phone.
 *  3. POST /api/orders/guest-checkin to reserve the table.
 *     Maps: missing table → 404; occupied → 409.
 *  4. createOrder (store auto-queues to IndexedDB if offline).
 *  5. On success → navigate /order-success?order_id=<id>.
 *
 * Offline
 *  useOrderStoreWithOfflineFlush() queues to IndexedDB via offlineDb
 *  and auto-flushes once connectivity is restored.
 *
 * Stack
 *  - react-i18next (project standard) instead of next-intl
 *    (Next.js-App-Router-specific; this is Vite + React Router).
 * ═══════════════════════════════════════════════════════════════════ */

/* ── Helpers ─────────────────────────────────────────────────────── */

const TABLE_SLUG_RE = /^[a-zA-Z0-9_-]+$/;

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function isTableIdValid(raw: string | null): raw is string {
  return Boolean(raw && TABLE_SLUG_RE.test(raw.trim()));
}

/* ── Component ───────────────────────────────────────────────────── */

export function TableOrder(): ReactNode {
  const { t } = useTranslation('order');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawTable = searchParams.get('table');
  const tableId = rawTable?.trim() ?? '';
  const hasValidTable = isTableIdValid(rawTable);

  // useOrderStoreWithOfflineFlush auto-flushes IndexedDB queue on
  // reconnect; selector keeps the render surface area minimal.
  const { createOrder, queuedOffline, flushQueuedOrders } =
    useOrderStoreWithOfflineFlush((s) => ({
      createOrder: s.createOrder,
      queuedOffline: s.queuedOffline,
      flushQueuedOrders: s.flushQueuedOrders,
    }));

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Surface a meaningful error when the QR param is bad.
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

  const validateCustomerForm = useCallback((): boolean => {
    if (!guestName.trim()) {
      setSubmitError(
        t('missingName', {
          defaultValue: 'Vui lòng nhập tên của bạn',
        }),
      );
      return false;
    }
    const digits = normalizePhone(guestPhone);
    if (digits.length < 8) {
      setSubmitError(
        t('invalidPhone', {
          defaultValue:
            'Vui lòng nhập số điện thoại hợp lệ (ít nhất 8 chữ số)',
        }),
      );
      return false;
    }
    setSubmitError(null);
    return true;
  }, [guestName, guestPhone, t]);

  const handleViewCart = useCallback(
    async (cart: CartItem[]): Promise<void> => {
      if (isSubmitting) return;

      if (queuedOffline) {
        setSubmitError(
          t('offlineQueued', {
            defaultValue:
              'Bạn đang offline. Đơn hàng sẽ được lưu và gửi khi có mạng.',
          }),
        );
      } else {
        setSubmitError(null);
      }

      if (!validateCustomerForm()) return;

      setIsSubmitting(true);
      try {
        // 1 — Reserve the table.
        if (hasValidTable && tableId) {
          let checkinOk = false;
          try {
            const checkinRes = await fetch(
              `${API_BASE}/api/orders/guest-checkin`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customer_name: guestName.trim(),
                  customer_phone: normalizePhone(guestPhone).trim(),
                  table_id: tableId,
                }),
              },
            );
            if (checkinRes.status === 404) {
              setSubmitError(
                t('invalidQR', {
                  defaultValue: 'Mã QR này không hợp lệ.',
                }),
              );
              setIsSubmitting(false);
              return;
            }
            if (checkinRes.status === 409) {
              setSubmitError(
                t('tableOccupied', {
                  defaultValue:
                    'Bàn này đang được sử dụng. Vui lòng chọn bàn khác.',
                }),
              );
              setIsSubmitting(false);
              return;
            }
            checkinOk = checkinRes.ok;
            if (!checkinOk) {
              let bodyMsg: string | undefined;
              try {
                const parsed = (await checkinRes.json()) as Record<
                  string,
                  unknown
                >;
                if (typeof parsed.message === 'string') bodyMsg = parsed.message;
              } catch {
                // ignore malformed body
              }
              throw new Error(
                bodyMsg ??
                  t('checkinFailed', {
                    defaultValue: `Lỗi xác nhận bàn (${checkinRes.status})`,
                  }),
              );
            }
          } catch (err) {
            if (err instanceof TypeError) {
              // Network error surfaced immediately
              setSubmitError(
                t('checkinNetworkError', {
                  defaultValue: 'Không thể kết nối đến máy chủ.',
                }),
              );
              setIsSubmitting(false);
              return;
            }
            throw err;
          }
        }

        // 2 — Submit the order.
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
          customer_address: undefined,
          payment_method: 'cod',
          table_id: hasValidTable && tableId ? tableId : undefined,
        };

        const order = await createOrder(payload);

        if (order?.id) {
          // Flush any queued offline orders from IndexedDB before
          // redirecting so the operator sees the full sequence.
          try { await flushQueuedOrders(); } catch { /* non-fatal */ }
          navigate(`/order-success?order_id=${encodeURIComponent(order.id)}`);
        } else {
          throw new Error(
            t('noOrderId', {
              defaultValue:
                'Không nhận được mã đơn hàng. Vui lòng thử lại.',
            }),
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : t('genericError', {
                defaultValue: 'Lỗi tạo đơn hàng. Vui lòng thử lại.',
              });
        setSubmitError(msg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      tableId,
      hasValidTable,
      guestName,
      guestPhone,
      isSubmitting,
      queuedOffline,
      createOrder,
      flushQueuedOrders,
      navigate,
      t,
      validateCustomerForm,
    ],
  );

  // ── Guard: invalid / missing QR ───────────────────────────────────
  if (!hasValidTable) {
    return (
      <div className="min-h-screen bg-[color:var(--aura-noir-deep)] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div
            className="rounded-2xl p-6 mb-5"
            style={{
              background: 'rgba(255,100,100,0.08)',
              border: '1px solid rgba(255,100,100,0.25)',
            }}
          >
            <p className="text-[13px] font-body text-[var(--aura-chrome-bright)] uppercase tracking-widest">
              {t('invalidQRLabel', { defaultValue: 'Lỗi' })}
            </p>
            <p className="mt-3 text-[15px] font-body text-[#ffb4ab]">
              {submitError ??
                t('invalidQR', { defaultValue: 'Mã QR không hợp lệ.' })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-full px-6 py-3 text-[13px] font-body font-semibold uppercase tracking-wider bg-[var(--aura-chrome-mid)] text-white active:scale-95 transition-transform"
          >
            {t('backHome', { defaultValue: 'Về trang chủ' })}
          </button>
        </div>
      </div>
    );
  }

  // ── Full ordering flow ────────────────────────────────────────────
  return (
    <>
      <HelmetHead
        title={t('seoTitle', { defaultValue: 'Đặt Món — AURA CAFE' })}
        description={t('seoDescription', {
          defaultValue: 'Đặt món trực tiếp tại bàn của bạn.',
        })}
        canonical={`/order?table=${encodeURIComponent(tableId)}`}
      />

      {/* Guest info form — table mode only */}
      <div
        className="fixed left-0 right-0 z-40 px-5 pt-3 pb-3"
        style={{
          top: '3rem',
          background: 'rgba(10,26,46,0.7)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '0.5px solid rgba(229,228,226,0.15)',
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
            placeholder={t('guestName', { defaultValue: 'Tên của bạn' })}
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
            placeholder={t('guestPhone', { defaultValue: 'Số điện thoại' })}
            disabled={isSubmitting}
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[13px] font-body bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[var(--aura-text-primary, #e8e8e8)] placeholder:text-[var(--aura-text-secondary, #a0a8b0)] focus:outline-none focus:border-[rgba(198,198,199,0.3)] focus:ring-1 focus:ring-[rgba(198,198,199,0.1)] transition-all disabled:opacity-50"
          />
        </div>

        {submitError && (
          <p
            className="mt-2 text-[12px] text-[#ffb4ab] font-body"
            role="alert"
          >
            {submitError}
          </p>
        )}
      </div>

      {/* Spacer — prevents Stitch content hiding behind fixed bar. */}
      <div style={{ height: '6.5rem' }} aria-hidden="true" />

      {/* Offline indicator */}
      {queuedOffline && (
        <div
          className="fixed bottom-24 left-4 right-4 z-40 rounded-xl px-4 py-3 text-center text-[12px] font-body"
          style={{
            background: 'rgba(255,183,77,0.15)',
            border: '1px solid rgba(255,183,77,0.4)',
            color: '#ffb74d',
          }}
          role="status"
        >
          {t('offlineIndicator', {
            defaultValue:
              'Đang offline — đơn hàng sẽ tự động gửi khi có mạng.',
          })}
        </div>
      )}

      {/* Menu → cart → checkout (Stitch) */}
      <StitchMobileOrderNew
        tableId={tableId ?? undefined}
        onViewCart={handleViewCart}
      />
    </>
  );
}

export default TableOrder;
