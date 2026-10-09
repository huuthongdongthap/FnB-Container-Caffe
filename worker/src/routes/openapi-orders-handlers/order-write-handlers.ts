import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { OrderRoutes } from '../../schemas/orders';
import { formatOrder, fetchOrderItemsAndPayments } from './helpers';
import { calculateOrderSnapshot, canTransition, isTerminal, canActorTransition, toActorRole } from '@aura/domain-order';
import { resolveServerOrderOwnership, canAccessOrder } from '@aura/domain-customer';
import { validateOrderTable } from '@aura/domain-table';
import { getDatabase } from '../../lib/db';
import { handleCancelOrder } from './order-cancel-handlers';

export { handleCancelOrder };

export async function handleOpenApiCreateOrder(c: Context<{ Bindings: Env }>) {
  const db = getDatabase(c);
  const body = ((c.req as any).valid ? (c.req as any).valid('json') : null) || (await c.req.json());
  const user = c.get('user');
  const now = new Date().toISOString();

  const id = crypto.randomUUID();
  const orderNumber = `ORD-${now.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  const snapshotInput = {
    items: (body.items || []).map((item: any) => ({
      productId: item.productId || item.product_id || item.menuItemId || item.id,
      quantity: item.quantity ?? item.qty,
      modifiers: item.modifiers || [],
      notes: item.notes || null,
    })),
    order_type: body.channel,
    shipping_fee: 0,
    discount: 0,
    service_fee: 0,
    tip_amount: 0,
    now: new Date(),
  };

  const snapshot = await calculateOrderSnapshot(db as any, snapshotInput);
  if (snapshot.rejected) {
    return c.json({ success: false, error: snapshot.rejected.message, code: snapshot.rejected.code }, 400);
  }

  if (body.tableId) {
    const tableCheck = await validateOrderTable(db as any, body.tableId);
    if (!tableCheck.ok) {
      return c.json({ success: false, error: 'Table not found', code: 'table_not_found' }, 404);
    }
  }

  const ownership = await resolveServerOrderOwnership({
    actor: user,
    clientSuppliedCustomerId: body.customer?.id || null,
    customerPhone: body.customer?.phone || null,
    db: db as any,
  });
  const customerId = ownership.customerId;

  await db.prepare(
    `INSERT INTO orders (id, order_number, table_id, location_id, customer_id, customer_name, customer_phone, customer_email, customer_loyalty_tier, customer_loyalty_points_earned, customer_locale, items, subtotal, discount_amount, tax_amount, total_amount, status, payment_status, notes, source, channel, happy_hour_applied, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, orderNumber, body.tableId || null, body.locationId, customerId,
    body.customer?.name || null, body.customer?.phone || null, body.customer?.email || null,
    body.customer?.loyaltyTier || null, body.customer?.loyaltyPointsEarned || 0,
    body.customer?.locale || 'vi',
    snapshot.itemsJson,
    snapshot.subtotal, snapshot.discount, snapshot.service_fee, snapshot.total,
    'pending', 'unpaid', body.notes || null, body.source || 'pos', body.channel || 'dine_in',
    snapshot.items.some(i => i.price !== undefined && i.price < i.unitPriceCents) ? 1 : 0,
    now, now
  ).run();

  for (const item of snapshot.items) {
    await db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, quantity, subtotal, modifiers, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), id, item.menuItemId, item.quantity, item.subtotalCents,
      JSON.stringify(item.modifiers || []), now
    ).run();
  }

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user?.id || 'system', 'order_create', 'order', id, JSON.stringify(body), now).run();

  const created = await db.prepare(
    `SELECT o.*, COALESCE(t.table_number, t.id) as table_name
     FROM orders o
     LEFT JOIN cafe_tables t ON o.table_id = t.id
     WHERE o.id = ?`
  ).bind(id).first();

  const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id);
  return c.json({ success: true, data: formatOrder(created, orderItems, payments) }, 201);
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
    if (body.status === 'served') { updates.push('served_at = ?'); params.push(now); }
    else if (body.status === 'completed') { updates.push('completed_at = ?'); params.push(now); }
    else if (body.status === 'cancelled') { updates.push('cancelled_at = ?'); params.push(now); }
  }
  if (body.notes !== undefined) { updates.push('notes = ?'); params.push(body.notes); }
  if (body.customer !== undefined) {
    if (body.customer.name !== undefined) { updates.push('customer_name = ?'); params.push(body.customer.name); }
    if (body.customer.phone !== undefined) { updates.push('customer_phone = ?'); params.push(body.customer.phone); }
    if (body.customer.email !== undefined) { updates.push('customer_email = ?'); params.push(body.customer.email); }
  }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  if (updates.length > 1) {
    await db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user?.id || 'system', 'order_update', 'order', id, JSON.stringify(body), now).run();

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
