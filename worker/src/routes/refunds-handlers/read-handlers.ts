import type { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { log } from './helpers';

export function registerRefundReadHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/payments/refunds/:paymentId
  router.get('/refunds/:paymentId', requireAuth(['owner', 'staff']), async (c) => {
    const db = c.env.AURA_DB;
    const paymentId = c.req.param('paymentId');

    try {
      const payment = await db.prepare(
        `SELECT id, order_id, method, amount, status, transaction_id,
                refund_status, refund_amount, refund_reason, created_at, updated_at
         FROM payments WHERE id = ?`
      ).bind(paymentId).first<{
        id: string;
        order_id: string;
        method: string;
        amount: number;
        status: string;
        transaction_id: string | null;
        refund_status: string | null;
        refund_amount: number | null;
        refund_reason: string | null;
        created_at: string;
        updated_at: string;
      }>();

      if (!payment) {
        return c.json({ success: false, error: 'Không tìm thấy thanh toán / Payment not found' }, 404);
      }

      return c.json({
        success: true,
        data: {
          id: payment.id,
          orderId: payment.order_id,
          method: payment.method,
          amount: payment.amount,
          status: payment.status,
          refundStatus: payment.refund_status,
          refundAmount: payment.refund_amount,
          refundReason: payment.refund_reason,
          createdAt: payment.created_at,
          updatedAt: payment.updated_at
        }
      });
    } catch (err) {
      log.error('Get refund status error:', { message: (err as Error).message });
      return c.json({ success: false, error: 'Lỗi nội bộ / Internal error' }, 500);
    }
  });
}
