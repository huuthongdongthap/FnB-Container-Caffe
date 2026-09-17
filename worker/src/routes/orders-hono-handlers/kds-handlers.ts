import type { Hono } from 'hono';
import { updateOrderStatusSchema, zodErrorResponse } from '../../lib/validators';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../middleware/audit-log';
import { buildOrderTail } from '@aura/domain-order';
import { ALLOWED_KDS_STATUSES, type OrderRecord, type OrderItem, type KdsOrder } from './types';

export function registerKdsHandlers(app: Hono<{ Bindings: Env }>) {
  // GET /api/orders/kds — Kitchen Display System dashboard
  // Intent: show the requested status PLUS 'preparing' (so staff see in-flight + next-up orders).
  // Invalid status values fall back to 'pending'.
  app.get('/kds', requireAuth(['owner', 'staff']), async(c) => {
    const db = c.env.AURA_DB;
    const raw = c.req.query('status') || 'pending';
    const status = ALLOWED_KDS_STATUSES.includes(raw as typeof ALLOWED_KDS_STATUSES[number]) ? raw : 'pending';

    const { results } = await db.prepare(
      `SELECT * FROM orders WHERE status IN (?, 'preparing')${buildOrderTail({ sort: 'created_at', order: 'ASC', limit: 50 })}`
    ).bind(status).all<OrderRecord>();

    const kdsOrders: KdsOrder[] = (results || []).map(order => {
      let items: OrderItem[] = [];
      try {
        items = JSON.parse(order.items);
      } catch { /* keep empty */ }

      const elapsed = Math.round(
        (Date.now() - new Date(order.created_at).getTime()) / 60000
      );

      return {
        id: order.id,
        customer_name: order.customer_name,
        table_id: order.table_id,
        items,
        status: order.status,
        elapsed_minutes: elapsed,
        created_at: order.created_at
      };
    });

    return c.json({ success: true, data: kdsOrders });
  });

  // PATCH /api/orders/:id/status — update order status
  app.patch('/:id/status', requireAuth(['owner', 'staff']), audit('order_status_change'), async(c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = updateOrderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const { status } = parsed.data;

    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRecord>();
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    await db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, id).run();

    // Broadcast order status change via KV for SSE subscribers
    if (c.env.AUTH_KV) {
      try {
        c.executionCtx?.waitUntil(
          c.env.AUTH_KV.put(`order_event:${id}`, JSON.stringify({
            orderId: id,
            status,
            timestamp: new Date().toISOString()
          }), { expirationTtl: 60 })
        );
      } catch { /* executionCtx unavailable */ }
    }

    return c.json({ success: true, message: `Order ${id} → ${status}` });
  });

  // PATCH /api/orders/:id/mark-cod-paid — owner taps "Đã thu tiền" (idempotent)
  app.patch('/:id/mark-cod-paid', requireAuth(['owner']), audit('order_cod_paid'), async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    if (!id) return c.json({ success: false, error: 'Missing order id' }, 400);

    const order = await db.prepare(
      'SELECT total, status, payment_status, is_cod FROM orders WHERE id = ?'
    ).bind(id).first<{ total: number; status: string; payment_status: string; is_cod: number }>();

    if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
    if (order.status === 'cancelled') return c.json({ success: false, error: 'Cannot mark cancelled order as paid' }, 409);
    if ((order.is_cod ?? 0) !== 1 && order.payment_status !== 'cod_pending') {
      return c.json({ success: false, error: 'Not a COD order' }, 409);
    }
    if (order.payment_status === 'paid') {
      return c.json({ success: true, message: 'Already paid', order_id: id });
    }

    const now = new Date().toISOString();
    await db.prepare(
      'UPDATE orders SET status = \'completed\', payment_status = \'paid\', cod_paid_at = ?, updated_at = ? WHERE id = ?'
    ).bind(now, now, id).run();
    return c.json({ success: true, message: 'Marked as paid', order_id: id });
  });
}
