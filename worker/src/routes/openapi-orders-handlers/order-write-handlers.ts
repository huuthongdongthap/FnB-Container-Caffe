import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { OrderRoutes } from '../../schemas/orders';
import { formatOrder, fetchOrderItemsAndPayments } from './helpers';
import { canTransition, isTerminal, canActorTransition, toActorRole, publishOrderEvent } from '@aura/domain-order';
import { canAccessOrder } from '@aura/domain-customer';
import { createOrderFromAlias } from '../../../../packages/domain/order/commands/create-order-alias';
import { getDatabase } from '../../lib/db';
import { handleCancelOrder } from './order-cancel-handlers';

export { handleCancelOrder };

export async function handleOpenApiCreateOrder(c: Context<{ Bindings: Env }>) {
  const body = ((c.req as any).valid ? (c.req as any).valid('json') : null) || (await c.req.json());
  let ctx: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
  try { ctx = c.executionCtx; } catch { /* Unit callers may omit execution context. */ }
  const response = await createOrderFromAlias(c.req.raw, c.env, {
    items: body.items,
    total: body.total ?? body.totalAmount ?? 1000,
    customer_name: body.customer?.name || 'Khách tại quán',
    customer_phone: body.customer?.phone || '0000000000',
    customer_email: body.customer?.email || '',
    customer_address: body.customer?.address || '',
    customer_id: body.customer?.id,
    payment_method: body.paymentMethod || 'cod',
    table_id: body.tableId,
    order_type: body.channel || (body.tableId ? 'dine_in' : 'takeaway'),
    notes: body.notes,
  }, ctx, c.get('user'));
  if (!response.ok) return response;
  const accepted = await response.json() as { data: Record<string, any> & { id: string } };
  const db = getDatabase(c);
  let created: any = accepted.data;
  let details: { items: any[]; payments: any[] } = { items: [], payments: [] };
  try {
    created = await db.prepare(`SELECT o.*, COALESCE(t.table_number, t.id) as table_name
      FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id WHERE o.id = ?`)
      .bind(accepted.data.id).first() || accepted.data;
    details = await fetchOrderItemsAndPayments(db, accepted.data.id);
  } catch { /* An optional read projection must not turn a committed order into a retryable failure. */ }
  return c.json({ success: true, data: formatOrder(created, details.items, details.payments) }, response.status as 200 | 201,
    response.headers.get('X-Cache') ? { 'X-Cache': 'HIT' } : undefined);
}

export async function handleOpenApiUpdateOrder(c: Context<{ Bindings: Env }>) {
  const db = getDatabase(c);
  const id = ((c.req as any).valid ? (c.req as any).valid('param') : null)?.id || c.req.param('id');
  const body = ((c.req as any).valid ? (c.req as any).valid('json') : null) || (await c.req.json());
  const user = c.get('user');
  const now = new Date().toISOString();

  const existing = (await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first()) as { id: string; status: string; customer_id?: string | null } | null;
  if (!existing) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }
  const access = canAccessOrder(user, existing);
  if (!access.allowed) {
    return c.json({ success: false, error: access.reason || 'Forbidden' }, 403);
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];
  const canonicalUpdates: string[] = [];
  const canonicalParams: (string | number | null)[] = [];

  if (body.status !== undefined) {
    if (existing.status !== body.status) {
      if (isTerminal(existing.status)) {
        return c.json({ success: false, error: `Cannot transition terminal order (${existing.status})` }, 400);
      }
      const structural = canTransition(existing.status, body.status);
      if (!structural.ok) return c.json({ success: false, error: structural.error }, 400);
      const authCheck = canActorTransition(toActorRole(user?.role), existing.status, body.status);
      if (!authCheck.ok) return c.json({ success: false, error: authCheck.error }, 403);
    }

    updates.push('status = ?');
    params.push(body.status);
    canonicalUpdates.push('status = ?');
    canonicalParams.push(body.status);
    if (body.status === 'served') { updates.push('served_at = ?'); params.push(now); }
    else if (body.status === 'completed') { updates.push('completed_at = ?'); params.push(now); }
    else if (body.status === 'cancelled') { updates.push('cancelled_at = ?'); params.push(now); }
  }
  if (body.notes !== undefined) {
    updates.push('notes = ?');
    params.push(body.notes);
    canonicalUpdates.push('notes = ?');
    canonicalParams.push(body.notes);
  }
  if (body.customer !== undefined) {
    if (body.customer.name !== undefined) {
      updates.push('customer_name = ?');
      params.push(body.customer.name);
      canonicalUpdates.push('customer_name = ?');
      canonicalParams.push(body.customer.name);
    }
    if (body.customer.phone !== undefined) {
      updates.push('customer_phone = ?');
      params.push(body.customer.phone);
      canonicalUpdates.push('customer_phone = ?');
      canonicalParams.push(body.customer.phone);
    }
    if (body.customer.email !== undefined) { updates.push('customer_email = ?'); params.push(body.customer.email); }
  }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  canonicalUpdates.push('updated_at = ?');
  canonicalParams.push(now);
  canonicalParams.push(id);

  if (updates.length > 1) {
    try {
      await db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    } catch {
      if (canonicalUpdates.length > 1) {
        await db.prepare(`UPDATE orders SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams).run();
      }
    }
    if (c.env?.AUTH_KV) {
      let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
      try {
        if (c.executionCtx) waitUntilFn = (p) => c.executionCtx.waitUntil(p);
      } catch { /* executionCtx may be absent in testing */ }
      await publishOrderEvent(c.env.AUTH_KV, id, body.status ?? existing.status, {
        previousStatus: existing.status,
        waitUntil: waitUntilFn,
      });
    }
  }

  const actorId = user?.id || 'system';
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, actorId, 'order_update', 'order', id, JSON.stringify(body), now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(actorId, actorId, 'order_update', 'order', id, JSON.stringify(body), now).run().catch(() => {});
    } catch {
      // Ignore audit log error
    }
  }

  const updated = await db.prepare(
    `SELECT o.*, COALESCE(t.table_number, t.id) as table_name
     FROM orders o
     LEFT JOIN cafe_tables t ON o.table_id = t.id
     WHERE o.id = ?`
  ).bind(id).first();

  const { items, payments } = await fetchOrderItemsAndPayments(db, id);
  return c.json({ success: true, data: formatOrder(updated!, items, payments) });
}

export function registerOrderWriteHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(OrderRoutes.create as any, handleOpenApiCreateOrder as any);
  app.openapi(OrderRoutes.update as any, handleOpenApiUpdateOrder as any);
  app.openapi(OrderRoutes.cancel as any, handleCancelOrder as any);
}
