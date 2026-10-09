import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { canTransition, canActorTransition, toActorRole, publishOrderEvent, canAccessOrder } from '@aura/domain-order';
import { getDatabase } from '../../lib/db';
import { fetchOrderItemsAndPayments, formatOrder } from './helpers';

export async function handleCancelOrder(c: Context<{ Bindings: Env }>) {
  const db = getDatabase(c);
  const id = ((c.req as any).valid ? (c.req as any).valid('param') : null)?.id || c.req.param('id');
  const body = ((c.req as any).valid ? (c.req as any).valid('json') : null) || (await c.req.json().catch(() => ({})));
  const user = c.get('user');
  const now = new Date().toISOString();

  const existing = (await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first()) as { id: string; status: string; customer_id?: string | null } | null;
  if (!existing) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  // Ownership scope
  const access = canAccessOrder(user, existing);
  if (!access.allowed) {
    return c.json({ success: false, error: access.reason || 'Forbidden' }, 403);
  }

  // Idempotent cancellation
  if (existing.status === 'cancelled') {
    const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id);
    return c.json({
      success: true,
      message: 'Already cancelled',
      data: formatOrder(existing, orderItems, payments),
    });
  }

  // Dual gate: structural legality then role authorization
  const structural = canTransition(existing.status, 'cancelled');
  if (!structural.ok) {
    return c.json({ success: false, error: structural.error }, 400);
  }
  const authCheck = canActorTransition(toActorRole(user?.role), existing.status, 'cancelled');
  if (!authCheck.ok) {
    return c.json({ success: false, error: authCheck.error }, 403);
  }

  if (['served', 'delivered', 'completed', 'failed', 'expired'].includes(existing.status)) {
    return c.json({ success: false, error: 'Cannot cancel order that has been served or completed' }, 409);
  }

  await db.prepare(
    'UPDATE orders SET status = \'cancelled\', cancelled_at = ?, updated_at = ? WHERE id = ?'
  ).bind(now, now, id).run();

  if (c.env?.AUTH_KV) {
    let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
    try {
      if (c.executionCtx) waitUntilFn = (p) => c.executionCtx.waitUntil(p);
    } catch { /* executionCtx may be absent in testing */ }
    await publishOrderEvent(c.env.AUTH_KV, id, 'cancelled', {
      previousStatus: existing.status,
      waitUntil: waitUntilFn,
    });
  }

  try {
    await db.prepare(
      'UPDATE order_items SET status = \'cancelled\', updated_at = ? WHERE order_id = ?'
    ).bind(now, id).run();
  } catch {
    // Column status/updated_at absent in canonical order_items schema
  }

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user?.id || 'system', 'order_cancel', 'order', id, JSON.stringify({ reason: body.reason || 'User cancelled' }), now).run();

  const updated = await db.prepare(
    `SELECT o.*, COALESCE(t.table_number, t.id) as table_name
     FROM orders o
     LEFT JOIN cafe_tables t ON o.table_id = t.id
     WHERE o.id = ?`
  ).bind(id).first();

  const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id);
  return c.json({
    success: true,
    data: formatOrder(updated, orderItems, payments),
  });
}
