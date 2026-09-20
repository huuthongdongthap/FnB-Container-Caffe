import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { OrderRoutes } from '../../schemas/orders';
import { formatOrder, fetchOrderItemsAndPayments } from './helpers';
import { calculateOrderSnapshot, canTransition, canActorTransition, toActorRole } from '@aura/domain-order';

const STAFF_ROLES = ['owner', 'manager', 'staff'];

function resolveCustomerId(c: Context<{ Bindings: Env }>, bodyCustomerId: string | null | undefined): string | null {
  const user = c.get('user');
  if (user && STAFF_ROLES.includes(user.role)) {
    return bodyCustomerId || null; // staff can specify customer_id or create anonymous
  }
  if (user?.role === 'customer') {
    return user.id; // customer can only create orders for themselves
  }
  return bodyCustomerId || null; // fallback for unauthenticated (shouldn't reach here due to requireAuth)
}

export function registerOrderWriteHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/orders - Create new order (OpenAPI contract: client sends intent only, server evaluates prices)
  app.openapi(OrderRoutes.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const id = crypto.randomUUID();
    const orderNumber = `ORD-${now.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    // Server-authoritative price evaluation via domain policy
    // Client sends intent (menuItemId, quantity, modifier choice IDs) - NO prices
    const snapshotInput = {
      items: body.items.map((item) => ({
        productId: item.menuItemId,
        quantity: item.quantity,
        modifiers: item.modifiers || [],
      })),
      orderType: body.channel,
      shippingFee: 0,
      discount: 0,
      serviceFee: 0,
      tipAmount: 0,
      now: new Date(),
    };

    const snapshot = await calculateOrderSnapshot(c.env, snapshotInput);

    // Resolve customer_id with ownership enforcement
    const customerId = resolveCustomerId(c, body.customer?.id || null);

    // Insert order with server-evaluated totals
    await db.prepare(
      `INSERT INTO orders (id, order_number, table_id, location_id, customer_id, customer_name, customer_phone, customer_email, customer_loyalty_tier, customer_loyalty_points_earned, customer_locale, items, subtotal, discount_amount, tax_amount, total_amount, status, payment_status, notes, source, channel, happy_hour_applied, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      orderNumber,
      body.tableId || null,
      body.locationId,
      customerId,
      body.customer?.name || null,
      body.customer?.phone || null,
      body.customer?.email || null,
      body.customer?.loyaltyTier || null,
      body.customer?.loyaltyPointsEarned || 0,
      body.customer?.locale || 'vi',
      JSON.stringify(snapshot.itemsJson),
      snapshot.subtotal,
      snapshot.discount,
      snapshot.serviceFee, // using service_fee column for tax
      snapshot.total,
      'pending',
      'unpaid',
      body.notes || null,
      body.source || 'pos',
      body.channel || 'dine_in',
      snapshot.items.some(i => i.price !== undefined && i.price < i.unitPriceCents) ? 1 : 0, // happy_hour_applied flag
      now,
      now
    ).run();

    // Insert order items with server-evaluated prices
    for (const item of snapshot.items) {
      await db.prepare(
        `INSERT INTO order_items (id, order_id, product_id, variant_id, quantity, unit_price, total_price, modifiers, notes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        id,
        item.menuItemId,
        null, // variant_id - not used in new schema
        item.quantity,
        item.unitPriceCents,
        item.subtotalCents,
        JSON.stringify(item.modifiers || []),
        item.notes || null,
        item.status || 'pending',
        now,
        now
      ).run();
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'order_create', 'order', id, JSON.stringify(body), now).run();

    const created = await db.prepare(
      `SELECT o.*, t.name as table_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.id = ?`
    ).bind(id).first();

    const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id);
    return c.json({ success: true, data: formatOrder(created, orderItems, payments) }, 201);
  });

  // PATCH /api/orders/:id - Update order
  app.openapi(OrderRoutes.update, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<{ status: string; customer_id?: string | null }>();
    if (!existing) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // Ownership scope: a customer token may only mutate its own order.
    if (!STAFF_ROLES.includes(user.role) && existing.customer_id !== user.id) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (body.status !== undefined) {
      // Dual gate: structural legality (400) is decided before role authority (403).
      const structural = canTransition(existing.status, body.status);
      if (!structural.ok) {
        return c.json({ success: false, error: structural.error }, 400);
      }
      const authCheck = canActorTransition(toActorRole(user.role), existing.status, body.status);
      if (!authCheck.ok) {
        return c.json({ success: false, error: authCheck.error }, 403);
      }

      updates.push('status = ?');
      params.push(body.status);
      if (body.status === 'served') {
        updates.push('served_at = ?');
        params.push(now);
      } else if (body.status === 'completed') {
        updates.push('completed_at = ?');
        params.push(now);
      } else if (body.status === 'cancelled') {
        updates.push('cancelled_at = ?');
        params.push(now);
      }
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

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'order_update', 'order', id, JSON.stringify(body), now).run();

    const updated = await db.prepare(
      `SELECT o.*, t.name as table_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.id = ?`
    ).bind(id).first();

    const { items, payments } = await fetchOrderItemsAndPayments(db, id);

    return c.json({
      success: true,
      data: formatOrder(updated!, items, payments),
    });
  });

  // POST /api/orders/:id/cancel - Cancel order
  app.openapi(OrderRoutes.cancel, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<{ status: string; customer_id?: string | null }>();
    if (!existing) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // Ownership scope
    if (!STAFF_ROLES.includes(user.role) && existing.customer_id !== user.id) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // Dual gate: structural legality then role authorization
    const structural = canTransition(existing.status, 'cancelled');
    if (!structural.ok) {
      return c.json({ success: false, error: structural.error }, 400);
    }
    const authCheck = canActorTransition(toActorRole(user.role), existing.status, 'cancelled');
    if (!authCheck.ok) {
      return c.json({ success: false, error: authCheck.error }, 403);
    }

    if (['served', 'completed'].includes(existing.status)) {
      return c.json({ success: false, error: 'Cannot cancel order that has been served or completed' }, 409);
    }

    await db.prepare(
      'UPDATE orders SET status = \'cancelled\', cancelled_at = ?, updated_at = ? WHERE id = ?'
    ).bind(now, now, id).run();

    // Cancel order items
    await db.prepare(
      'UPDATE order_items SET status = \'cancelled\', updated_at = ? WHERE order_id = ?'
    ).bind(now, id).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'order_cancel', 'order', id, JSON.stringify({ reason: body.reason || 'User cancelled' }), now).run();

    const updated = await db.prepare(
      `SELECT o.*, t.name as table_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.id = ?`
    ).bind(id).first();

    const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id);
    return c.json({
      success: true,
      data: formatOrder(updated, orderItems, payments),
    });
  });
}
