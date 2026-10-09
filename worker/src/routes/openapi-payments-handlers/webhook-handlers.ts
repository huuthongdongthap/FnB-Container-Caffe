import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';
import { getDatabase } from '../../lib/db';
import { verifySignature } from '../webhooks-handlers/helpers';

export function registerPaymentWebhookHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // POST /api/payments/webhook/payos - PayOS webhook
  router.openapi(PaymentRoutes.webhook.payos as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json' as never) as {
      data: {
        orderCode: string | number;
        status: string;
        amount?: number;
        [key: string]: unknown;
      };
      signature?: string;
      [key: string]: unknown;
    };
    const now = new Date().toISOString();

    const signature = body.signature || c.req.header('X-PayOS-Signature');
    if (!signature) {
      return c.json({ success: false, error: 'Missing signature' }, 401);
    }

    if (c.env.PAYOS_CHECKSUM_KEY && body.data) {
      const isValid = await verifySignature(body.data as Record<string, unknown>, signature, c.env.PAYOS_CHECKSUM_KEY);
      if (!isValid) {
        return c.json({ success: false, error: 'Invalid signature' }, 401);
      }
    }

    const orderCode = String(body.data.orderCode);

    // Look up payment in canonical payments table
    const payment = (await db.prepare(
      'SELECT id, order_id, amount, status FROM payments WHERE transaction_id = ?'
    ).bind(orderCode).first()) as {
      id: string;
      order_id: string;
      amount: number;
      status: string;
    } | null;

    if (!payment) {
      return c.json({ success: false, error: 'Payment not found' }, 404);
    }

    // Idempotency: acknowledge completed payment immediately
    if (payment.status === 'completed') {
      return c.json({ success: true, data: { received: true } });
    }

    // Verify amount
    if (body.data.amount && parseInt(String(body.data.amount), 10) !== parseInt(String(payment.amount), 10)) {
      return c.json({ success: false, error: 'Amount mismatch' }, 400);
    }

    // Update payment status based on webhook
    const statusMap: Record<string, string> = {
      'PAID': 'completed',
      'CANCELLED': 'cancelled',
      'EXPIRED': 'expired',
      'FAILED': 'failed',
    };
    const rawStatus = String(body.data.status || '').toUpperCase();
    const newStatus = statusMap[rawStatus] || 'pending';
    const isSuccess = newStatus === 'completed';

    const statusGuard = isSuccess ? 'status != \'completed\'' : 'status = \'pending\'';
    await db.prepare(`UPDATE payments SET status = ?, updated_at = ? WHERE id = ? AND ${statusGuard}`)
      .bind(newStatus, now, payment.id).run();

    // Update order payment status only on success
    if (isSuccess && payment.order_id) {
      await db.prepare('UPDATE orders SET payment_status = \'paid\', updated_at = ? WHERE id = ?')
        .bind(now, payment.order_id).run();
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, 'system', 'payment_webhook', 'payment', payment.id, JSON.stringify({ status: newStatus }), now).run();

    return c.json({ success: true, data: { received: true } });
  });
}
