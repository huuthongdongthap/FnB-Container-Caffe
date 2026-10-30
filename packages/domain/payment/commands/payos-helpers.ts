/**
 * PayOS Helper utilities
 * Signature generation and order validation. Provider attempts are reserved before fetching.
 */

export const PAYOS_API = 'https://api-merchant.payos.vn/v2/payment-requests';

export const PAYOS_ERROR_MESSAGES = {
  order_not_found: { vi: 'Không tìm thấy đơn hàng', en: 'Order not found' },
  forbidden: { vi: 'Từ chối — không phải đơn hàng của bạn', en: 'Forbidden — not your order' },
  already_paid: { vi: 'Đơn hàng đã được thanh toán', en: 'Order already paid' },
  invalid_total: { vi: 'Tổng tiền không hợp lệ', en: 'Invalid order total' },
  payos_not_configured: { vi: 'PayOS chưa được cấu hình', en: 'PayOS env vars not configured' },
  payos_error: { vi: 'Lỗi PayOS', en: 'PayOS error' },
  insert_failed: { vi: 'Không thể tạo thanh toán sau 3 lần thử', en: 'Failed to create payment after 3 retries' },
  internal_error: { vi: 'Lỗi hệ thống', en: 'Internal error' },
};

export interface PayOSSignatureParams {
  amount: number;
  cancelUrl: string;
  description: string;
  orderCode: number;
  returnUrl: string;
}

export async function buildPayOSSignature(
  params: PayOSSignatureParams,
  checksumKey: string
): Promise<string> {
  const canonical = [
    `amount=${params.amount}`,
    `cancelUrl=${params.cancelUrl}`,
    `description=${params.description}`,
    `orderCode=${params.orderCode}`,
    `returnUrl=${params.returnUrl}`
  ].join('&');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(checksumKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
  return Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateOrderCode(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (Date.now() * 1000) + (buf[0] % 1000);
}

export interface PayOSOrderValidation {
  id: string;
  total: number;
  payment_status: string;
  customer_id: string | null;
  is_cod?: number;
}

export function validatePayOSAccess(
  orderRow: PayOSOrderValidation,
  customerId: string | null,
  role?: string
): { allowed: boolean; reason?: 'forbidden' | 'already_paid' | 'invalid_total' } {
  const isStaffOrOwner =
    role === 'owner' ||
    role === 'manager' ||
    role === 'supervisor' ||
    role === 'staff' ||
    role === 'admin' ||
    role === 'cashier' ||
    role === 'waiter';
  if (orderRow.customer_id && (!customerId || orderRow.customer_id !== customerId) && !isStaffOrOwner) {
    return { allowed: false, reason: 'forbidden' };
  }
  if (orderRow.payment_status === 'paid') {
    return { allowed: false, reason: 'already_paid' };
  }
  const amount = parseInt(String(orderRow.total), 10);
  if (!Number.isFinite(amount) || amount < 1000) {
    return { allowed: false, reason: 'invalid_total' };
  }
  return { allowed: true };
}
