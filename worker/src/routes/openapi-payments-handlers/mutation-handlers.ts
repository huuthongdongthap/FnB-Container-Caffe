import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';
import { getDatabase } from '../../lib/db';
import { canAccessPaymentOrder } from '../../../../packages/domain/payment/policies/payment-access';
import { handleCreateLink } from '../../../../packages/domain/payment/commands/payos-create-link';
import { handleRefund } from '../refunds-handlers/mutation-handlers';

export function registerPaymentMutationHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  router.openapi(PaymentRoutes.create as any, async (c: any) => {
    const body = c.req.valid('json' as never) as { orderId: string; method: string; amount?: number };
    if (body.method === 'payos') return handleCreateLink(c, { order_id: body.orderId, amount: body.amount }, true);
    const db = getDatabase(c);
    const order = await db.prepare('SELECT id, customer_id, tenant_id, total, payment_status, payment_method FROM orders WHERE id = ?')
      .bind(body.orderId).first<{ id: string; customer_id: string | null; tenant_id: string | null; total: number; payment_status: string; payment_method: string }>();
    if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
    if (!canAccessPaymentOrder(c, order)) return c.json({ success: false, error: 'Forbidden' }, 403);
    if (body.method !== 'cod' || order.payment_method !== 'cod') return c.json({ success: false, error: 'Payment method does not match the order' }, 409);
    if (['paid', 'refunded'].includes(order.payment_status)) return c.json({ success: false, error: 'Order already paid' }, 409);
    const amount = Number(order.total);
    if (!Number.isSafeInteger(amount) || amount < 0 || (body.amount !== undefined && body.amount !== amount)) {
      return c.json({ success: false, error: 'Tampered amount: does not match order total' }, 400);
    }
    const now = new Date().toISOString();
    const id = `cod:${order.id}`;
    await db.prepare(`INSERT OR IGNORE INTO payments (id, order_id, method, amount, status, created_at, updated_at)
      SELECT ?, ?, 'cod', ?, 'pending', ?, ? WHERE NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND method = 'cod')`)
      .bind(id, order.id, amount, now, now, order.id).run();
    const payment = await db.prepare("SELECT id, status FROM payments WHERE order_id = ? AND method = 'cod' ORDER BY created_at ASC LIMIT 1")
      .bind(order.id).first<{ id: string; status: string }>();
    if (!payment || payment.status !== 'pending') return c.json({ success: false, error: 'Payment state changed; refresh the order' }, 409);
    return c.json({ success: true, data: { paymentId: payment.id, paymentUrl: null, qrCodeUrl: null, deeplink: null,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), status: 'pending' } }, 201);
  });

  // No separate database-only refund path: an acknowledgment requires the canonical provider flow.
  router.openapi(PaymentRoutes.refund as any, (c: any) => handleRefund(c, true));
}
