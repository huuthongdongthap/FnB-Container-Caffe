import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CartItem } from '@/components/stitch';
import {
  useOrderStoreWithOfflineFlush,
} from '@/hooks/stores/use-order-store';
import { API_BASE } from '@/lib/api-client';
import { normalizePhone } from './TableOrder-utils';

interface UseHandleViewCartArgs {
  tableId: string;
  hasValidTable: boolean;
  guestName: string;
  guestPhone: string;
  isSubmitting: boolean;
  queuedOffline: boolean;
  submitError: string | null;
  setIsSubmitting: (v: boolean) => void;
  setSubmitError: (msg: string | null) => void;
  validateCustomerForm: () => boolean;
}

export function useHandleViewCart({
  tableId,
  hasValidTable,
  guestName,
  guestPhone,
  isSubmitting,
  queuedOffline,
  setIsSubmitting,
  setSubmitError,
  validateCustomerForm,
}: UseHandleViewCartArgs) {
  const navigate = useNavigate();
  const { t } = useTranslation('order');
  const { createOrder, flushQueuedOrders } =
    useOrderStoreWithOfflineFlush((s) => ({
      createOrder: s.createOrder,
      flushQueuedOrders: s.flushQueuedOrders,
    }));

  return useCallback(
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
        if (hasValidTable && tableId) {
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
                t('invalidQR', { defaultValue: 'Mã QR này không hợp lệ.' }),
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
            if (!checkinRes.ok) {
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
          payment_method: 'cod',
          table_id: hasValidTable && tableId ? tableId : undefined,
        };

        const order = await createOrder(payload);

        if (order?.id) {
          try {
            await flushQueuedOrders();
          } catch {
            /* non-fatal */
          }
          navigate(
            `/order-success?order_id=${encodeURIComponent(order.id)}`,
          );
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
      setIsSubmitting,
      setSubmitError,
    ],
  );
}
