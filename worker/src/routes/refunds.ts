/**
 * Refund Routes — PayOS Refund Integration
 *
 * POST /api/payments/refund          — Create a refund via PayOS
 * GET  /api/payments/refunds/:id     — Get refund status for a payment
 *
 * Error responses are bilingual VN+EN for client-facing use.
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { createLogger } from '../middleware/logger';
import { createMetricsCollector } from '../lib/metrics-collector';
import { z } from 'zod';
import type { Env } from '../types/env';

const log = createLogger({ route: 'refund' });
export const refundRouter = new Hono<{ Bindings: Env }>();

const PAYOS_API = 'https://api-merchant.payos.vn/v2/payment-requests';

// ── Zod validation ──

const refundRequestSchema = z.object({
  paymentId: z.union([z.string(), z.number()]),
  amount: z.number().positive('Số tiền hoàn phải lớn hơn 0 / Amount must be positive'),
  reason: z.string().min(1, 'Lý do hoàn tiền là bắt buộc / Reason is required')
});

// ── Bilingual error responses ──

const ERRORS = {
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

function payosApiError(msg: string) {
  return {
    success: false as const,
    error: `Lỗi từ PayOS: ${msg} / PayOS error: ${msg}`,
    retryable: true
  };
}

// ── POST /api/payments/refund ──

refundRouter.post('/refund', requireAuth(['owner', 'staff']), async(c) => {
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
      id: string; order_id: string; method: string; amount: number;
      status: string; transaction_id: string | null;
      refund_status: string | null; refund_amount: number | null;
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

    // ── Deduct loyalty points / cashback (non-blocking) ──
    try {
      const order = await db.prepare(
        'SELECT customer_id, cashback_earned, points_earned FROM orders WHERE id = ?'
      ).bind(payment.order_id).first<{ customer_id: string | null; cashback_earned: number | null; points_earned: number | null }>();

      if (order?.customer_id) {
        const pointsToReverse = order.points_earned || 0;
        const cashbackToReverse = order.cashback_earned || 0;

        if (pointsToReverse > 0) {
          const cust = await db.prepare(
            'SELECT loyalty_points, lifetime_points FROM customers WHERE id = ?'
          ).bind(order.customer_id).first<{ loyalty_points: number; lifetime_points: number }>();

          if (cust) {
            const newPoints = Math.max(0, cust.loyalty_points - pointsToReverse);
            const newLifetime = Math.max(0, cust.lifetime_points - pointsToReverse);

            await db.prepare(
              'UPDATE customers SET loyalty_points = ?, lifetime_points = ?, updated_at = ? WHERE id = ?'
            ).bind(newPoints, newLifetime, now, order.customer_id).run();

            await db.prepare(
              `INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              `lpl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
              order.customer_id,
              -pointsToReverse,
              'refund',
              newPoints,
              `Hoàn tiền đơn hàng #${payment.order_id}: ${reason}`,
              now
            ).run();
          }
        }

        if (cashbackToReverse > 0) {
          const wallet = await db.prepare(
            'SELECT id, balance FROM cashback_wallets WHERE customer_id = ?'
          ).bind(order.customer_id).first<{ id: string; balance: number }>();

          if (wallet && wallet.balance > 0) {
            const deductAmount = Math.min(cashbackToReverse, wallet.balance);
            const newBal = wallet.balance - deductAmount;

            await db.prepare(
              'UPDATE cashback_wallets SET balance = ?, updated_at = ? WHERE id = ?'
            ).bind(newBal, now, wallet.id).run();

            await db.prepare(
              `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, description, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              `cbt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
              wallet.id, order.customer_id, payment.order_id,
              'debit', deductAmount, newBal,
              `Hoàn tiền đơn hàng #${payment.order_id}: ${reason}`,
              now
            ).run();
          }
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

// ── GET /api/payments/refunds/:paymentId ──

refundRouter.get('/refunds/:paymentId', requireAuth(['owner', 'staff']), async(c) => {
  const db = c.env.AURA_DB;
  const paymentId = c.req.param('paymentId');

  try {
    const payment = await db.prepare(
      `SELECT id, order_id, method, amount, status, transaction_id,
              refund_status, refund_amount, refund_reason, created_at, updated_at
       FROM payments WHERE id = ?`
    ).bind(paymentId).first<{
      id: string; order_id: string; method: string; amount: number;
      status: string; transaction_id: string | null;
      refund_status: string | null; refund_amount: number | null;
      refund_reason: string | null; created_at: string; updated_at: string;
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
