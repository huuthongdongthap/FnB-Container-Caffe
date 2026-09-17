import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';

export function registerPaymentWebhookHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // POST /api/payments/webhook/payos - PayOS webhook
  router.openapi(PaymentRoutes.webhook.payos, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json' as never) as {
      data: {
        orderCode: string | number;
        status: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    const now = new Date().toISOString();

    // Verify webhook signature (simplified - should use PayOS SDK)
    const signature = c.req.header('X-PayOS-Signature');
    if (!signature) {
      return c.json({ success: false, error: 'Missing signature' }, 401);
    }

    // Check idempotency
    const existing = await db.prepare(
      'SELECT id FROM order_payments WHERE provider_reference = ?'
    ).bind(body.data.orderCode).first();
    if (existing) {
      return c.json({ success: true, data: { received: true } });
    }

    // Find payment by order code
    const payment = await db.prepare(
      'SELECT * FROM order_payments WHERE provider_reference = ?'
    ).bind(body.data.orderCode).first<{
      id: string;
      order_id: string;
      metadata: string | null;
      [key: string]: unknown;
    }>();

    if (!payment) {
      return c.json({ success: false, error: 'Payment not found' }, 404);
    }

    // Update payment status based on webhook
    const statusMap: Record<string, string> = {
      'PAID': 'completed',
      'CANCELLED': 'cancelled',
      'EXPIRED': 'expired',
      'FAILED': 'failed',
    };
    const newStatus = statusMap[body.data.status] || 'pending';

    await db.prepare('UPDATE order_payments SET status = ?, metadata = ?, updated_at = ? WHERE id = ?')
      .bind(newStatus, JSON.stringify({ ...JSON.parse(payment.metadata || '{}'), webhookData: body }), now, payment.id).run();

    // Update order payment status
    if (newStatus === 'completed') {
      const totalPaid = await db.prepare(
        'SELECT SUM(amount) as total FROM order_payments WHERE order_id = ? AND status = \'completed\' AND amount > 0'
      ).bind(payment.order_id).first<{ total: number }>();

      const order = await db.prepare('SELECT total_amount FROM orders WHERE id = ?').bind(payment.order_id).first<{ total_amount: number }>();
      let orderPaymentStatus = 'unpaid';
      if (totalPaid && totalPaid.total >= (order?.total_amount || 0)) {
        orderPaymentStatus = 'paid';
      } else if (totalPaid && totalPaid.total > 0) {
        orderPaymentStatus = 'partial';
      }

      await db.prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?').bind(orderPaymentStatus, now, payment.order_id).run();
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, 'system', 'payment_webhook', 'payment', payment.id, JSON.stringify({ status: newStatus }), now).run();

    return c.json({ success: true, data: { received: true } });
  });
}
