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

webPaymentRouter.post('/payment-request', requireAuth(['owner', 'manager', 'staff', 'admin', 'cashier', 'waiter', 'customer']) as any, async (c) => {
  const db = getDatabase(c);
  const mc = createMetricsCollector(db);
  const locale = (c.req.query('locale') || 'vi') as 'vi' | 'en';

  const errMsg = {
    unauthorized: { vi: 'Yêu cầu đăng nhập', en: 'Authentication required' },
    order_not_found: { vi: 'Không tìm thấy đơn hàng', en: 'Order not found' },
    forbidden: { vi: 'Từ chối — không phải đơn hàng của bạn', en: 'Forbidden' },
    already_paid: { vi: 'Đơn hàng đã được thanh toán', en: 'Order already paid' },
    invalid_amount: { vi: 'Số tiền không hợp lệ', en: 'Invalid amount' },
    invalid_token: { vi: 'Token thanh toán không hợp lệ', en: 'Invalid payment token' },
    token_verification_failed: { vi: 'Xác thực token thất bại', en: 'Token verification failed' },
    internal_error: { vi: 'Lỗi hệ thống', en: 'Internal error' },
  };

  try {
    const user = (c.get as any)('user') as { id?: string; role?: string } | undefined;
    if (!user?.id) {
      return c.json({ success: false, error: errMsg.unauthorized[locale] }, 401);
    }

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

    const isStaffOrOwner =
      user.role === 'owner' ||
      user.role === 'manager' ||
      user.role === 'staff' ||
      user.role === 'admin' ||
      user.role === 'cashier' ||
      user.role === 'waiter';
    if (!isStaffOrOwner && (!orderRow.customer_id || orderRow.customer_id !== user.id)) {
      return c.json({ success: false, error: errMsg.forbidden[locale] }, 403);
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

    // Fail-closed: cryptographic merchant token verification and payment processor
    // settlement for Apple Pay / Google Pay are not configured. Never mark an order as paid
    // or insert a completed payment row based solely on client-supplied token fields.
    try {
      c.executionCtx?.waitUntil(mc.recordMetric('web_payment_failed', 1, { reason: 'token_verification_failed' }));
    } catch { /* executionCtx unavailable */ }
    return c.json(
      {
        success: false,
        error: errMsg.token_verification_failed[locale],
        code: 'PAYMENT_VERIFICATION_UNAVAILABLE',
      },
      422
    );
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