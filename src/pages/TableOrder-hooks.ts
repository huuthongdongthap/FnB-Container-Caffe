import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CartItem } from '@/components/stitch';
import {
  useOrderStore,
  useOrderStoreWithOfflineFlush,
} from '@/hooks/stores/use-order-store';
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
  const createOrder = useOrderStoreWithOfflineFlush((s) => s.createOrder);
  const flushQueuedOrders = useOrderStoreWithOfflineFlush((s) => s.flushQueuedOrders);

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
          order_type: (hasValidTable && tableId ? 'dine_in' : 'takeaway') as 'dine_in' | 'takeaway',
          payment_method: 'cod' as const,
          table_id: hasValidTable && tableId ? tableId : undefined,
        };

        const order = await createOrder(payload);
        const resolvedOrder = (order as unknown as { order?: { id?: string }; data?: { id?: string } })?.order
          ?? (order as unknown as { data?: { id?: string } })?.data
          ?? order;

        if (resolvedOrder?.id) {
          try {
            await flushQueuedOrders();
          } catch {
            /* non-fatal */
          }
          navigate(
            `/order-success?order_id=${encodeURIComponent(resolvedOrder.id)}`,
          );
        } else if (useOrderStore.getState().queuedOffline) {
          setSubmitError(
            t('offlineQueued', {
              defaultValue:
                'Bạn đang offline. Đơn hàng sẽ được lưu và gửi khi có mạng.',
            }),
          );
        } else {
          const storeError = useOrderStore.getState().error;
          throw new Error(
            storeError ||
              t('noOrderId', {
                defaultValue: 'Không nhận được mã đơn hàng.',
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
