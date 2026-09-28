/**
 * View-model mappers for canonical CustomerOrder → UI display.
 *
 * These mappers are display-only (currency formatting, status labels, relative time).
 * They DO NOT recompute monetary totals — `totalAmount` is server-authoritative.
 */
import type { CustomerOrder, CustomerOrderItem, OrderStatus, PaymentStatus } from './order-store-types';

/* ─── Currency Formatting ───────────────────────────────────────────────── */
function formatVndCents(cents: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cents / 100);
}

/* ─── Status Label Mapping ──────────────────────────────────────────────── */
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Sẵn sàng',
  served: 'Đã phục vụ',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  refunded: 'Đã hoàn tiền',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
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

/* ─── Mappers ───────────────────────────────────────────────────────────── */
export function toCustomerOrderViewModel(order: CustomerOrder): CustomerOrderViewModel {
  return {
    ...order,
    displayTotal: formatVndCents(order.totalAmount),
    displaySubtotal: formatVndCents(order.subtotal),
    displayDiscount: formatVndCents(order.discountAmount),
    displayTax: formatVndCents(order.taxAmount),
    displayStatus: ORDER_STATUS_LABELS[order.status] ?? order.status,
    displayPaymentStatus: PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus,
    displayChannel: CHANNEL_LABELS[order.channel] ?? order.channel,
    displayCreatedAt: new Date(order.createdAt).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    displayUpdatedAt: new Date(order.updatedAt).toLocaleDateString('vi-VN', {
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