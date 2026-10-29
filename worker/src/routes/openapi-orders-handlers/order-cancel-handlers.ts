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

  // Reverse loyalty accrual, referral reward, and promotion redemption usage on cancellation
  try {
    const earnRow = await db.prepare(
      "SELECT customer_id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1"
    ).bind(id).first<{ customer_id?: string }>();
    if (earnRow?.customer_id) {
      const { loadPolicy, reverseAccrual } = await import('@aura/domain-crm');
      const policy = await loadPolicy(db).catch(() => null);
      if (policy) {
        const totalVnd = Number((existing as Record<string, unknown>).total ?? (existing as Record<string, unknown>).total_amount ?? 0);
        await reverseAccrual(db, policy, {
          orderId: id,
          customerId: earnRow.customer_id,
          refundAmountVnd: totalVnd,
          reason: body.reason || 'order_cancelled',
        }).catch(() => {});
      }
    }
  } catch {
    // Optional loyalty tables in partial schemas
  }

  try {
    const refRow = await db.prepare(
      "SELECT id FROM referrals WHERE first_order_id = ? AND status = 'completed' LIMIT 1"
    ).bind(id).first<{ id?: string }>();
    if (refRow?.id) {
      const { reverseReferralCashback } = await import('@aura/domain-crm');
      await reverseReferralCashback(db, refRow.id).catch(() => {});
    }
  } catch {
    // Optional referrals table in partial schemas
  }

  try {
    const redRow = await db.prepare(
      'SELECT promotion_id, code FROM promotion_redemptions WHERE order_id = ? LIMIT 1'
    ).bind(id).first<{ promotion_id?: string; code?: string }>();
    if (redRow && (redRow.promotion_id || redRow.code)) {
      await db.prepare(
        'UPDATE promotions SET usage_count = CASE WHEN usage_count > 0 THEN usage_count - 1 ELSE 0 END WHERE id = ? OR code = ?'
      ).bind(redRow.promotion_id ?? '', redRow.code ?? '').run().catch(() => {});
      await db.prepare('DELETE FROM promotion_redemptions WHERE order_id = ?').bind(id).run().catch(() => {});
    }
  } catch {
    // Optional promotion_redemptions table in partial schemas
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