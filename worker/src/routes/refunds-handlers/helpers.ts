import { z } from 'zod';
import { createLogger } from '../../middleware/logger';

export const log = createLogger({ route: 'refund' });

export const PAYOS_API = 'https://api-merchant.payos.vn/v2/payment-requests';

export const refundRequestSchema = z.object({
  paymentId: z.union([z.string(), z.number()]),
  amount: z.number().positive('Số tiền hoàn phải lớn hơn 0 / Amount must be positive'),
  reason: z.string().min(1, 'Lý do hoàn tiền là bắt buộc / Reason is required')
});

export const ERRORS = {
  PAYMENT_NOT_FOUND: {
    success: false as const,
    error: 'Không tìm thấy thanh toán / Payment not found'
  },
  PAYMENT_NOT_PAID: {
    success: false as const,
    error: 'Thanh toán chưa được xác nhận / Payment not yet confirmed'
  },
  PAYMENT_ALREADY_REFUNDED: {
    success: false as const,
    error: 'Đơn hàng đã được hoàn tiền trước đó / Payment already refunded'
  },
  AMOUNT_EXCEEDS_PAYMENT: {
    success: false as const,
    error: 'Số tiền hoàn vượt quá số tiền đã thanh toán / Amount exceeds payment amount'
  }
};

export function payosApiError(msg: string) {
  return {
    success: false as const,
    error: `Lỗi từ PayOS: ${msg} / PayOS error: ${msg}`,
    retryable: true
  };
}
