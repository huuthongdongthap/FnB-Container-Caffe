import { z } from 'zod';
import { createLogger } from '../../middleware/logger';

export const log = createLogger({ route: 'refund' });

export const PAYOS_API = 'https://api-merchant.payos.vn/v2/payment-requests';

export const refundRequestSchema = z.object({
  paymentId: z.union([z.string().trim().min(1, 'paymentId is required'), z.number()]).optional(),
  orderId: z.string().trim().min(1, 'orderId is required').optional(),
  amount: z.number().int('amount must be integer VND').positive('Số tiền hoàn phải lớn hơn 0 / Amount must be positive').optional(),
  reason: z.string().trim().min(1, 'reason is required').max(500),
}).refine((data) => data.paymentId !== undefined || data.orderId !== undefined, {
  message: 'orderId is required',
  path: ['orderId'],
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
