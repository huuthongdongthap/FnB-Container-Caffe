/**
 * Apple Pay / Google Pay Web Payment Handler
 * Processes payment tokens from browser Payment Request API.
 * Validates token, records transaction, updates order payment_status = 'paid'.
 */

import { Hono } from 'hono';
import { requireAuth } from 'worker/src/middleware/auth';
import { createLogger } from 'worker/src/middleware/logger';
import { getDatabase } from 'worker/src/lib/db';
import { createMetricsCollector } from 'worker/src/lib/metrics-collector';
import type { Env } from 'worker/src/types/env';

const log = createLogger({ route: 'web-payment' });
export const webPaymentRouter = new Hono<{ Bindings: Env }>();

interface WebPaymentRequest {
  order_id: string;
  payment_token: Record<string, unknown>;
  amount: number;
  currency: string;
}

interface ApplePayToken {
  paymentData: {
    data: string;
    signature: string;
    version: string;
    header: {
      ephemeralPublicKey: string;
      publicKeyHash: string;
      transactionId: string;
    };
  };
  paymentMethod: {
    displayName: string;
    network: string;
    type: string;
  };
  transactionIdentifier: string;
}

interface GooglePayToken {
  signature: string;
  protocolVersion: string;
  signedMessage: string;
  intermediateSigningKey: {
    signedKey: string;
    signatures: string[];
  };
}

webPaymentRouter.post('/payment-request', async (c) => {
  const db = getDatabase(c);
  const mc = createMetricsCollector(db);
  const locale = (c.req.query('locale') || 'vi') as 'vi' | 'en';

  const errMsg = {
    order_not_found: { vi: 'Không tìm thấy đơn hàng', en: 'Order not found' },
    already_paid: { vi: 'Đơn hàng đã được thanh toán', en: 'Order already paid' },
    invalid_amount: { vi: 'Số tiền không hợp lệ', en: 'Invalid amount' },
    invalid_token: { vi: 'Token thanh toán không hợp lệ', en: 'Invalid payment token' },
    token_verification_failed: { vi: 'Xác thực token thất bại', en: 'Token verification failed' },
    internal_error: { vi: 'Lỗi hệ thống', en: 'Internal error' },
  };

  try {
    const body = await c.req.json() as WebPaymentRequest;
    const { order_id, payment_token, amount, currency } = body;

    if (!order_id || !payment_token || !amount || amount < 1000) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('web_payment_failed', 1, { reason: 'validation_error' }));
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: errMsg.invalid_amount[locale] }, 400);
    }

    // Validate currency
    if (currency !== 'VND') {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('web_payment_failed', 1, { reason: 'invalid_currency' }));
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: errMsg.invalid_amount[locale] }, 400);
    }

    // Fetch order
    const orderRow = await db.prepare(
      'SELECT id, total, payment_status, customer_id FROM orders WHERE id = ?'
    ).bind(order_id).first<{ id: string; total: number; payment_status: string; customer_id: string | null }>();

    if (!orderRow) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('web_payment_failed', 1, { reason: 'order_not_found' }));
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: errMsg.order_not_found[locale] }, 404);
    }

    // Check if already paid
    if (orderRow.payment_status === 'paid') {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('web_payment_failed', 1, { reason: 'already_paid' }));
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: errMsg.already_paid[locale] }, 409);
    }

    // Verify amount matches order total
    const orderTotal = parseInt(String(orderRow.total), 10);
    if (amount !== orderTotal) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('web_payment_failed', 1, { reason: 'amount_mismatch' }));
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: errMsg.invalid_amount[locale] }, 400);
    }

    // Verify payment token structure
    const isApplePay = 'paymentData' in payment_token && 'transactionIdentifier' in payment_token;
    const isGooglePay = 'signature' in payment_token && 'signedMessage' in payment_token;

    if (!isApplePay && !isGooglePay) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('web_payment_failed', 1, { reason: 'invalid_token_structure' }));
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: errMsg.invalid_token[locale] }, 400);
    }

    // For Apple Pay, verify the token has required fields
    if (isApplePay) {
      const token = payment_token as unknown as ApplePayToken;
      if (!token.paymentData?.data || !token.paymentData?.signature || !token.transactionIdentifier) {
        try {
          c.executionCtx?.waitUntil(mc.recordMetric('web_payment_failed', 1, { reason: 'apple_pay_incomplete_token' }));
        } catch { /* executionCtx unavailable */ }
        return c.json({ success: false, error: errMsg.invalid_token[locale] }, 400);
      }
      log.info('Apple Pay token received', { transactionId: token.transactionIdentifier });
    }

    // For Google Pay, verify the token has required fields
    if (isGooglePay) {
      const token = payment_token as unknown as GooglePayToken;
      if (!token.signature || !token.signedMessage) {
        try {
          c.executionCtx?.waitUntil(mc.recordMetric('web_payment_failed', 1, { reason: 'google_pay_incomplete_token' }));
        } catch { /* executionCtx unavailable */ }
        return c.json({ success: false, error: errMsg.invalid_token[locale] }, 400);
      }
      log.info('Google Pay token received');
    }

    // In production, you would verify the payment token with Apple/Google payment processors
    // For now, we'll accept validly structured tokens and process the payment
    // TODO: Implement actual token verification with Apple Pay / Google Pay merchant verification

    const paymentId = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    // Record payment
    await db.prepare(`
      INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_token, created_at)
      VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)
    `).bind(
      paymentId,
      order_id,
      isApplePay ? 'apple_pay' : 'google_pay',
      amount,
      transactionId,
      JSON.stringify(payment_token),
      now
    ).run();

    // Update order status
    await db.prepare(`
      UPDATE orders
      SET status = 'completed', payment_status = 'paid', paid_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(now, now, order_id).run();

    // Record success metric
    try {
      c.executionCtx?.waitUntil(mc.recordMetric('web_payment_success', amount, {
        payment_method: isApplePay ? 'apple_pay' : 'google_pay',
        amount: String(amount),
      }));
    } catch { /* executionCtx unavailable */ }

    return c.json({
      success: true,
      data: {
        transaction_id: transactionId,
        status: 'succeeded',
        payment_method: isApplePay ? 'apple_pay' : 'google_pay',
        amount,
        currency,
      },
    });
  } catch (err) {
    log.error('Web payment processing error:', { message: (err as Error).message });
    try {
      c.executionCtx?.waitUntil(mc.recordMetric('web_payment_failed', 1, { reason: 'internal_error' }));
    } catch { /* executionCtx unavailable */ }
    return c.json({ success: false, error: errMsg.internal_error[locale] }, 500);
  }
});

export function registerWebPaymentHandlers(router: Hono<{ Bindings: Env }>): void {
  router.route('/', webPaymentRouter);
}