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
      'SELECT id, total, status FROM orders WHERE id = ?'
    ).bind(orderId).first<{ id: string; total: number; status: string }>();
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    await db.prepare(
      'UPDATE orders SET table_id = ?, updated_at = ? WHERE id = ?'
    ).bind(session.table_id, new Date().toISOString(), orderId).run();

    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE table_sessions
       SET order_count = order_count + 1,
           total_amount = total_amount + ?,
           status = 'ordering',
           updated_at = ?
       WHERE id = ?`
    ).bind(order.total, now, id).run();

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
