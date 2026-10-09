import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';
import { getDatabase } from '../../lib/db';

export function registerPaymentMutationHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // POST /api/payments - Create payment
  router.openapi(PaymentRoutes.create as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json' as never) as {
      orderId: string;
      method: string;
      amount: number;
      provider?: string;
      providerReference?: string;
      metadata?: Record<string, unknown>;
    };
    const user = c.get('user') as { id: string } | undefined;
    const now = new Date().toISOString();

    // Verify order exists
    const order = (await db.prepare('SELECT id, total, payment_status FROM orders WHERE id = ?').bind(body.orderId).first()) as {
      id: string;
      total: number;
      payment_status: string;
    } | null;

    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    if (order.payment_status === 'paid') {
      return c.json({ success: false, error: 'Order already paid' }, 409);
    }

    // Server-authoritative amount validation
    const serverTotal = parseInt(String(order.total), 10);
    if (body.amount !== undefined && body.amount !== serverTotal) {
      return c.json({ success: false, error: 'Tampered amount: does not match order total' }, 400);
    }

    // Idempotency: return existing pending payment if already created
    const existing = (await db.prepare(
      'SELECT id, payment_url, status FROM payments WHERE order_id = ? AND method = ? AND status IN (\'pending\', \'completed\') ORDER BY created_at DESC LIMIT 1'
    ).bind(body.orderId, body.method).first()) as { id: string; payment_url: string | null; status: string } | null;

    if (existing) {
      if (existing.status === 'completed') {
        return c.json({ success: false, error: 'Order already paid' }, 409);
      }
      return c.json({
        success: true,
        data: {
          paymentId: existing.id,
          paymentUrl: existing.payment_url,
          qrCodeUrl: null,
          deeplink: null,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          status: 'pending',
        },
      }, 201);
    }

    const id = crypto.randomUUID();
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Create payment record in canonical payments table
    await db.prepare(
      `INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, NULL, ?, ?)`
    ).bind(
      id,
      body.orderId,
      body.method,
      serverTotal,
      transactionId,
      now,
      now
    ).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user?.id || 'system', 'payment_create', 'payment', id, JSON.stringify({ orderId: body.orderId, amount: serverTotal }), now).run();

    return c.json({
      success: true,
      data: {
        paymentId: id,
        paymentUrl: null,
        qrCodeUrl: null,
        deeplink: null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        status: 'pending',
      },
    }, 201);
  });

  // POST /api/payments/refund - Refund payment
  router.openapi(PaymentRoutes.refund as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json' as never) as { paymentId?: string; amount?: number; reason?: string };
    const user = c.get('user') as { id: string } | undefined;
    const now = new Date().toISOString();
    const targetId = body.paymentId || c.req.param?.('id');

    if (!targetId) {
      return c.json({ success: false, error: 'Missing paymentId' }, 400);
    }

    const payment = (await db.prepare('SELECT id, order_id, amount, status, method FROM payments WHERE id = ?').bind(targetId).first()) as {
      id: string;
      order_id: string;
      amount: number;
      status: string;
      method: string;
    } | null;

    if (!payment) {
      return c.json({ success: false, error: 'Payment not found' }, 404);
    }

    if (payment.status !== 'completed') {
      return c.json({ success: false, error: 'Can only refund completed payments' }, 409);
    }

    const refundAmount = body.amount || payment.amount;

    // Update canonical payment status
    await db.prepare('UPDATE payments SET status = \'refunded\', updated_at = ? WHERE id = ?').bind(now, payment.id).run();

    // Update canonical order payment status
    await db.prepare('UPDATE orders SET payment_status = \'refunded\', updated_at = ? WHERE id = ?').bind(now, payment.order_id).run();

    // Audit log
    const refundId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user?.id || 'system', 'payment_refund', 'payment', refundId, JSON.stringify({ originalPaymentId: payment.id, reason: body.reason }), now).run();

    return c.json({
      success: true,
      data: {
        id: refundId,
        paymentId: payment.id,
        amount: refundAmount,
        reason: body.reason || null,
        status: 'completed',
        processedAt: now,
        createdAt: now,
      },
    });
  });
}

