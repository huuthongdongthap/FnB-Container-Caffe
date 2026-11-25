/**
 * View-model mappers for canonical CustomerOrder → UI display.
 *
 * These mappers are display-only (currency formatting, status labels, relative time).
 * They DO NOT recompute monetary totals — `totalAmount` is server-authoritative.
 */
import type { CustomerOrder, CustomerOrderItem, OrderStatus, PaymentStatus } from './order-store-types';

/* ─── Currency Formatting ───────────────────────────────────────────────── */
function formatVndCents(cents: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cents);
}

/* ─── Status Label Mapping ──────────────────────────────────────────────── */
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Sẵn sàng',
  delivering: 'Đang giao',
  served: 'Đã phục vụ',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  failed: 'Giao thất bại',
  expired: 'Hết hạn',
  refunded: 'Đã hoàn tiền',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  cod_pending: 'COD — chưa thu tiền',
  pending: 'Chờ thanh toán',
  processing: 'Đang xử lý',
  completed: 'Đã thanh toán',
  failed: 'Thất bại',
  cancelled: 'Đã huỷ',
  refunded: 'Đã hoàn tiền',
  partially_refunded: 'Hoàn tiền một phần',
};

/* ─── Channel Label Mapping ─────────────────────────────────────────────── */
const CHANNEL_LABELS: Record<CustomerOrder['channel'], string> = {
  dine_in: 'Tại chỗ',
  takeaway: 'Mang đi',
  delivery: 'Giao hàng',
};

/* ─── Display View Model ────────────────────────────────────────────────── */
export interface CustomerOrderViewModel extends CustomerOrder {
  displayTotal: string;
  displaySubtotal: string;
  displayDiscount: string;
  displayTax: string;
  displayStatus: string;
  displayPaymentStatus: string;
  displayChannel: string;
  displayCreatedAt: string;
  displayUpdatedAt: string;
  items: CustomerOrderItemViewModel[];
}

export interface CustomerOrderItemViewModel extends CustomerOrderItem {
  displayUnitPrice: string;
  displaySubtotal: string;
  displayStatus: string;
}

export function parseOrderUtcDate(raw: string): Date {
  if (!raw) return new Date(NaN);
  const trimmed = raw.trim();
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : `${trimmed.replace(' ', 'T')}Z`;
  return new Date(iso);
}

/* ─── Mappers ───────────────────────────────────────────────────────────── */
export function toCustomerOrderViewModel(order: CustomerOrder): CustomerOrderViewModel {
  const createdDate = parseOrderUtcDate(order.createdAt);
  const updatedDate = parseOrderUtcDate(order.updatedAt);
  return {
    ...order,
    displayTotal: formatVndCents(order.totalAmount),
    displaySubtotal: formatVndCents(order.subtotal),
    displayDiscount: formatVndCents(order.discountAmount),
    displayTax: formatVndCents(order.taxAmount),
    displayStatus: ORDER_STATUS_LABELS[order.status] ?? order.status,
    displayPaymentStatus: PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus,
    displayChannel: CHANNEL_LABELS[order.channel] ?? order.channel,
    displayCreatedAt: Number.isNaN(createdDate.getTime())
      ? order.createdAt
      : createdDate.toLocaleDateString('vi-VN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
    displayUpdatedAt: Number.isNaN(updatedDate.getTime())
      ? order.updatedAt
      : updatedDate.toLocaleDateString('vi-VN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
    items: order.items.map(toCustomerOrderItemViewModel),
  };
}

export function toCustomerOrderItemViewModel(item: CustomerOrderItem): CustomerOrderItemViewModel {
  return {
    ...item,
    displayUnitPrice: formatVndCents(item.unitPriceCents),
    displaySubtotal: formatVndCents(item.subtotalCents),
    displayStatus: ORDER_STATUS_LABELS[item.status] ?? item.status,
  };
}