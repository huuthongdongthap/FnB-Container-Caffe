import type { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../middleware/audit-log';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { loadPolicy, reverseAccrual } from '@aura/domain-crm';
import type { Env } from '../../types/env';
import {
  log,
  PAYOS_API,
  refundRequestSchema,
  ERRORS,
  payosApiError
} from './helpers';

export function registerRefundMutationHandlers(router: Hono<{ Bindings: Env }>): void {
  // POST /api/payments/refund
  router.post('/refund', requireAuth(['owner', 'staff']), audit('refund_create'), async (c) => {
    const db = c.env.AURA_DB;
    const mc = createMetricsCollector(db);

    try {
      const body = await c.req.json();
      const parsed = refundRequestSchema.safeParse(body);
      if (!parsed.success) {
        try {
          c.executionCtx?.waitUntil(mc.recordMetric('refund_failed', 1, { reason: 'validation_error' }));
        } catch { /* executionCtx unavailable */ }
        return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
      }

      const { paymentId, amount, reason } = parsed.data;
      const paymentIdStr = String(paymentId);

      // ── Look up the payment ──
      const payment = await db.prepare(
        `SELECT id, order_id, method, amount, status, transaction_id, refund_status, refund_amount
         FROM payments WHERE id = ?`
      ).bind(paymentIdStr).first<{
        id: string;
        order_id: string;
        method: string;
        amount: number;
        status: string;
        transaction_id: string | null;
        refund_status: string | null;
        refund_amount: number | null;
      }>();

      if (!payment) {
        try {
          c.executionCtx?.waitUntil(mc.recordMetric('refund_failed', 1, { reason: 'payment_not_found' }));
        } catch { /* executionCtx unavailable */ }
        return c.json(ERRORS.PAYMENT_NOT_FOUND, 404);
      }

      // ── Payment must be confirmed as paid ──
      if (payment.status !== 'paid') {
        try {
          c.executionCtx?.waitUntil(mc.recordMetric('refund_failed', 1, { reason: 'not_paid' }));
        } catch { /* executionCtx unavailable */ }
        return c.json(ERRORS.PAYMENT_NOT_PAID, 400);
      }

      // ── Must not be a duplicate refund ──
      if (payment.refund_status === 'refunded' || payment.refund_status === 'partial') {
        try {
          c.executionCtx?.waitUntil(mc.recordMetric('refund_failed', 1, { reason: 'already_refunded' }));
        } catch { /* executionCtx unavailable */ }
        return c.json(ERRORS.PAYMENT_ALREADY_REFUNDED, 409);
      }

      // ── Refund amount must not exceed original payment ──
      if (amount > payment.amount) {
        try {
          c.executionCtx?.waitUntil(mc.recordMetric('refund_failed', 1, { reason: 'amount_exceeds' }));
        } catch { /* executionCtx unavailable */ }
        return c.json(ERRORS.AMOUNT_EXCEEDS_PAYMENT, 400);
      }

      // ── Verify PayOS is configured ──
      const clientId = c.env.PAYOS_CLIENT_ID;
      const apiKey = c.env.PAYOS_API_KEY;
      if (!clientId || !apiKey) {
        try {
          c.executionCtx?.waitUntil(mc.recordMetric('refund_failed', 1, { reason: 'payos_not_configured' }));
        } catch { /* executionCtx unavailable */ }
        return c.json({ success: false, error: 'PayOS env vars not configured' }, 500);
      }

      // ── Call PayOS refund API ──
      const orderCode = payment.transaction_id ? parseInt(payment.transaction_id, 10) : 0;
      const payosRes = await fetch(`${PAYOS_API}/${orderCode}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId,
          'x-api-key': apiKey
        },
        body: JSON.stringify({ orderCode, amount, reason })
      });

      const payosData = await payosRes.json() as { code: string; desc?: string; data?: Record<string, unknown> };
      if (payosData.code !== '00') {
        log.error('PayOS refund failed:', { response: JSON.stringify(payosData) });
        try {
          c.executionCtx?.waitUntil(mc.recordMetric('refund_failed', 1, { reason: 'payos_api_error' }));
        } catch { /* executionCtx unavailable */ }
        return c.json(payosApiError(payosData.desc || 'Unknown error'), 502);
      }

      const now = new Date().toISOString();
      const refundStatus = amount >= payment.amount ? 'refunded' : 'partial';

      // ── Reverse loyalty accrual (proportional for partial refunds) — non-blocking ──
      try {
        const orderRow = await db.prepare(
          'SELECT customer_id FROM orders WHERE id = ?'
        ).bind(payment.order_id).first<{ customer_id: string | null }>();

        if (orderRow?.customer_id) {
          const policy = await loadPolicy(db).catch(() => null);
          if (policy) {
            await reverseAccrual(db, policy, {
              orderId: payment.order_id,
              customerId: orderRow.customer_id,
              refundAmountVnd: amount,
            });
          }
        }
      } catch (loyaltyErr) {
        log.error('Failed to reverse loyalty on refund:', { message: (loyaltyErr as Error).message, paymentId });
        // Non-blocking — refund already submitted to PayOS
      }

      // ── Update payment refund fields ──
      await db.prepare(
        'UPDATE payments SET refund_status = ?, refund_amount = ?, refund_reason = ?, updated_at = ? WHERE id = ?'
      ).bind(refundStatus, amount, reason, now, payment.id).run();

      try {
        c.executionCtx?.waitUntil(mc.recordMetric('refund_success', amount, {
          payment_id: payment.id,
          refund_status: refundStatus
        }));
      } catch { /* executionCtx unavailable */ }

      return c.json({
        success: true,
        data: {
          paymentId: payment.id,
          orderId: payment.order_id,
          amount,
          reason,
          refundStatus,
          payosResponse: payosData.data || null
        }
      });
    } catch (err) {
      log.error('Refund error:', { message: (err as Error).message });
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('refund_failed', 1, { reason: 'internal_error' }));
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: 'Lỗi nội bộ / Internal error' }, 500);
    }
  });
}
