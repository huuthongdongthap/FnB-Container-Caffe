import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { executeKdsStatusTransition } from '@aura/domain-kitchen';
import { getTenantId } from '../../middleware/tenant';
import { getDatabase } from '../../lib/db';
import { fetchOrderItemsAndPayments, formatOrder } from './helpers';

export async function handleCancelOrder(c: Context<{ Bindings: Env }>) {
  const db = getDatabase(c);
  const id = ((c.req as any).valid ? (c.req as any).valid('param') : null)?.id || c.req.param('id');
  const body = ((c.req as any).valid ? (c.req as any).valid('json') : null) || (await c.req.json().catch(() => ({})));
  const user = c.get('user');
  const now = new Date().toISOString();

  const tenantId = getTenantId(c);
  const customer = user?.role === 'customer';
  const clause = customer ? ' AND customer_id = ?' : tenantId === '*' ? '' : ' AND tenant_id = ?';
  const scope = customer ? [user.id] : tenantId === '*' ? [] : [tenantId];
  const existing = (await db.prepare(`SELECT * FROM orders WHERE id = ?${clause}`).bind(id, ...scope).first()) as {
    id: string; status: string; customer_id?: string | null; tenant_id?: string;
  } | null;
  if (!existing) {
    return c.json({ success: false, error: 'Order not found' }, 404);
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

  // All aliases share tenant confinement, role/state validation and compare-and-set.
  const transition = await executeKdsStatusTransition(db, id, 'cancelled', user?.role, {
    tenantId: customer ? existing.tenant_id || 'default' : tenantId,
    kv: c.env.AUTH_KV,
    env: c.env as unknown as Record<string, unknown>,
  });
  if (!transition.success) return c.json({ success: false, error: transition.error }, (transition.statusCode || 400) as any);

  try {
    await db.prepare(
      'UPDATE order_items SET status = \'cancelled\', updated_at = ? WHERE order_id = ?'
    ).bind(now, id).run();
  } catch {
    // Column status/updated_at absent in canonical order_items schema
  }

  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user?.id || 'system', 'order_cancel', 'order', id, JSON.stringify({ reason: body.reason || 'User cancelled' }), now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(user?.id || 'system', user?.id || 'system', 'order_cancel', 'order', id, JSON.stringify({ reason: body.reason || 'User cancelled' }), now).run().catch(() => {});
    } catch {
      // Ignore audit log insert error if schema differs
    }
  }

  const updated = await db.prepare(
    `SELECT o.*, COALESCE(t.table_number, t.id) as table_name
       FROM orders o
       LEFT JOIN cafe_tables t ON o.table_id = t.id
       WHERE o.id = ?`
  ).bind(id).first();

  if (!updated) {
    return c.json({ success: false, error: 'Order not found after cancellation' }, 404);
  }

  const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id);
  return c.json({
    success: true,
    data: formatOrder(updated, orderItems, payments),
  });
}