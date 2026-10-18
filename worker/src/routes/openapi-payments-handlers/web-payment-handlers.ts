/**
 * Web Payment (Apple Pay / Google Pay) OpenAPI handler registration.
 * Delegates to webPaymentRouter from @aura/domain-payment.
 */

import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';
import { getDatabase } from '../../lib/db';
import { canAccessOrder } from '@aura/domain-order';

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
      const user = c.get('user') as { id?: string; role?: string } | undefined;
      if (!user?.id) {
        return c.json({ success: false, error: 'Authentication required' }, 401);
      }

      const { order_id, payment_token, amount, currency } = body;

      if (!order_id || !payment_token || !amount || amount < 1000) {
        return c.json({ success: false, error: 'Invalid amount' }, 400);
      }

      if (currency !== 'VND') {
        return c.json({ success: false, error: 'Only VND currency supported' }, 400);
      }

      // Fetch order
      const orderRow = (await db.prepare(
        'SELECT id, customer_id, total, payment_status FROM orders WHERE id = ?'
      ).bind(order_id).first()) as { id: string; customer_id?: string | null; total: number; payment_status: string } | null;

      if (!orderRow) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }

      const isStaffOrOwner = user.role === 'owner' || user.role === 'manager' || user.role === 'staff' || user.role === 'admin' || user.role === 'waiter' || user.role === 'cashier';
      if (
        !canAccessOrder(user, orderRow).allowed ||
        (!isStaffOrOwner && (!orderRow.customer_id || orderRow.customer_id !== user.id))
      ) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
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

      if (isApplePay) {
        const paymentData = payment_token.paymentData as Record<string, unknown> | undefined;
        if (
          !paymentData ||
          typeof paymentData.data !== 'string' ||
          !paymentData.data.trim() ||
          typeof paymentData.signature !== 'string' ||
          !paymentData.signature.trim() ||
          typeof payment_token.transactionIdentifier !== 'string' ||
          !payment_token.transactionIdentifier.trim()
        ) {
          return c.json({ success: false, error: 'Invalid payment token structure' }, 400);
        }
      }

      if (isGooglePay) {
        if (
          typeof payment_token.signature !== 'string' ||
          !payment_token.signature.trim() ||
          typeof payment_token.signedMessage !== 'string' ||
          !payment_token.signedMessage.trim()
        ) {
          return c.json({ success: false, error: 'Invalid payment token structure' }, 400);
        }
      }

      // Fail-closed: Apple Pay / Google Pay cryptographic merchant token verification
      // and payment processor settlement are not configured. Never mark an order as paid
      // or insert a completed payment record based solely on client-supplied token fields.
      return c.json(
        {
          success: false,
          error: 'Token verification failed: Apple Pay / Google Pay provider verification is not configured',
          code: 'PAYMENT_VERIFICATION_UNAVAILABLE',
        },
        422
      );
    } catch (err) {
      console.error('Web payment processing error:', (err as Error).message);
      return c.json({ success: false, error: 'Internal error' }, 500);
    }
  });
}
