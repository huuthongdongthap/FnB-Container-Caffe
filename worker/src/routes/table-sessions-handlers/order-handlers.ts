import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import type { TableSession } from './types';

export function registerOrderHandlers(router: Hono<{ Bindings: Env }>): void {
  // POST /api/table-sessions/:id/orders — attach an order to a session (bill merge)
  router.post('/:id/orders', async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;
    const orderId = String(body.order_id || '').trim();
    if (!orderId) {
      return c.json({ success: false, error: 'order_id is required' }, 400);
    }

    const session = await db.prepare(
      'SELECT * FROM table_sessions WHERE id = ? AND status != \'closed\''
    ).bind(id).first<TableSession>();
    if (!session) {
      return c.json({ success: false, error: 'Session not found or already closed' }, 404);
    }

    const order = await db.prepare(
      'SELECT id, total, status, table_id FROM orders WHERE id = ?'
    ).bind(orderId).first<{ id: string; total: number; status: string; table_id?: string | null }>();
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }
    if (order.status === 'cancelled') {
      return c.json({ success: false, error: 'Cannot attach cancelled order to session' }, 409);
    }
    if (order.table_id && order.table_id === session.table_id) {
      return c.json({ success: true, data: session, idempotent: true });
    }

    const now = new Date().toISOString();
    await db.prepare(
      'UPDATE orders SET table_id = ?, updated_at = ? WHERE id = ?'
    ).bind(session.table_id, now, orderId).run();

    try {
      await db.prepare(
        `UPDATE table_sessions
         SET order_count = order_count + 1,
             total_amount = total_amount + ?,
             status = 'ordering',
             updated_at = ?
         WHERE id = ?`
      ).bind(order.total, now, id).run();
    } catch {
      await db.prepare(
        `UPDATE table_sessions
         SET current_order_id = ?,
             status = 'ordering'
         WHERE id = ?`
      ).bind(orderId, id).run();
    }

    if (c.env?.AUTH_KV) {
      await Promise.all([
        c.env.AUTH_KV.put('latest_order_ts', String(Date.now())).catch(() => {}),
        c.env.AUTH_KV.put('orders:latest_updated_at', now).catch(() => {}),
      ]);
    }

    const updated = await db.prepare(
      'SELECT * FROM table_sessions WHERE id = ?'
    ).bind(id).first<TableSession>();
    return c.json({ success: true, data: updated });
  });

  // GET /api/table-sessions/:id/orders — list orders attached to a session
  router.get('/:id/orders', async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const session = await db.prepare(
      'SELECT id FROM table_sessions WHERE id = ?'
    ).bind(id).first<{ id: string }>();
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }

    const { results } = await db.prepare(
      'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) ORDER BY created_at DESC'
    ).bind(id).all();
    return c.json({ success: true, data: results });
  });
}
