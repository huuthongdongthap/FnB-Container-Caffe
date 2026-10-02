/**
 * Web Payment (Apple Pay / Google Pay) OpenAPI handler registration.
 * Delegates to webPaymentRouter from @aura/domain-payment.
 */

import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';
import { getDatabase } from '../../lib/db';

export function registerWebPaymentHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // POST /api/payments/payment-request — Apple Pay / Google Pay
  router.openapi(PaymentRoutes.paymentRequest as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json' as never) as {
      order_id: string;
      payment_token: Record<string, unknown>;
      amount: number;
      currency: string;
    };

    try {
      const { order_id, payment_token, amount, currency } = body;

      if (!order_id || !payment_token || !amount || amount < 1000) {
        return c.json({ success: false, error: 'Invalid amount' }, 400);
      }

      if (currency !== 'VND') {
        return c.json({ success: false, error: 'Only VND currency supported' }, 400);
      }

      // Fetch order
      const orderRow = (await db.prepare(
        'SELECT id, total, payment_status FROM orders WHERE id = ?'
      ).bind(order_id).first()) as { id: string; total: number; payment_status: string } | null;

      if (!orderRow) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }

      // Check if already paid
      if (orderRow.payment_status === 'paid') {
        return c.json({ success: false, error: 'Order already paid' }, 409);
      }

      // Verify amount matches order total
      const orderTotal = parseInt(String(orderRow.total), 10);
      if (amount !== orderTotal) {
        return c.json({ success: false, error: 'Amount does not match order total' }, 400);
      }

      // Verify payment token structure
      const isApplePay = 'paymentData' in payment_token && 'transactionIdentifier' in payment_token;
      const isGooglePay = 'signature' in payment_token && 'signedMessage' in payment_token;

      if (!isApplePay && !isGooglePay) {
        return c.json({ success: false, error: 'Invalid payment token structure' }, 400);
      }

      // In production, verify the token with Apple/Google payment processors here.
      // TODO: Implement actual merchant verification for Apple Pay / Google Pay

      const paymentId = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();

      // Record payment
      await db.prepare(`
        INSERT INTO order_payments (id, order_id, payment_number, method, amount, status, provider, provider_reference, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)
      `).bind(
        paymentId,
        order_id,
        transactionId,
        isApplePay ? 'apple_pay' : 'google_pay',
        amount,
        isApplePay ? 'apple' : 'google',
        transactionId,
        JSON.stringify(payment_token),
        now,
        now
      ).run();

      // Update order status
      await db.prepare(`
        UPDATE orders
        SET payment_status = 'paid', paid_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(now, now, order_id).run();

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
      console.error('Web payment processing error:', (err as Error).message);
      return c.json({ success: false, error: 'Internal error' }, 500);
    }
  });
}
