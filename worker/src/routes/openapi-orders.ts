import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types/env';
import { OrderRoutes } from '../schemas/orders';

export const openApiOrdersRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiOrdersRouter.use('*', requireAuth(['owner', 'manager', 'staff']));

// GET /api/orders - List orders with pagination and filtering
openApiOrdersRouter.openapi(OrderRoutes.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid('query');
  const { page = 1, limit = 20, sort = 'created_at', order = 'desc', tableId, locationId, status, paymentStatus, dateFrom, dateTo, customerId } = query;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (tableId) {
    whereClause += ' AND o.table_id = ?';
    params.push(tableId);
  }
  if (locationId) {
    whereClause += ' AND o.location_id = ?';
    params.push(locationId);
  }
  if (status) {
    whereClause += ' AND o.status = ?';
    params.push(status);
  }
  if (paymentStatus) {
    whereClause += ' AND o.payment_status = ?';
    params.push(paymentStatus);
  }
  if (dateFrom) {
    whereClause += ' AND date(o.created_at) >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ' AND date(o.created_at) <= ?';
    params.push(dateTo);
  }
  if (customerId) {
    whereClause += ' AND o.customer_id = ?';
    params.push(customerId);
  }

  // Get total count
  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM orders o ${whereClause}`
  ).bind(...params).first();
  const total = countResult?.total || 0;

  // Get orders with items and payments
  const offset = (page - 1) * limit;
  const orderClause = `${sort} ${order.toUpperCase()}`;
  const rows = await db.prepare(
    `SELECT o.*, t.name as table_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     ${whereClause}
     ORDER BY ${orderClause}
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  // For each order, fetch items and payments
  const orders = await Promise.all(rows.results.map(async (_order) => {
    const items = await db.prepare(
      `SELECT oi.*, p.name as product_name, p.slug as product_slug
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`
    ).bind(_order.id).all();

    const payments = await db.prepare(
      'SELECT * FROM order_payments WHERE order_id = ?'
    ).bind(_order.id).all();

    return {
      ..._order,
      table: _order.table_id ? { id: _order.table_id, name: _order.table_name } : null,
      items: items.results.map(item => ({
        ...item,
        modifiers: item.modifiers ? JSON.parse(item.modifiers) : [],
      })),
      payments: payments.results,
      subtotal: _order.subtotal,
      discountAmount: _order.discount_amount,
      taxAmount: _order.tax_amount,
      totalAmount: _order.total_amount,
      orderNumber: _order.order_number,
      paymentStatus: _order.payment_status,
      servedAt: _order.served_at,
      completedAt: _order.completed_at,
      cancelledAt: _order.cancelled_at,
      createdAt: _order.created_at,
      updatedAt: _order.updated_at,
    };
  }));

  return c.json({
    success: true,
    data: { orders, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /api/orders/:id - Get order by ID
openApiOrdersRouter.openapi(OrderRoutes.get, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid('param');

  const order = await db.prepare(
    `SELECT o.*, t.name as table_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     WHERE o.id = ?`
  ).bind(id).first();

  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  const items = await db.prepare(
    `SELECT oi.*, p.name as product_name, p.slug as product_slug
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?`
  ).bind(id).all();

  const payments = await db.prepare(
    'SELECT * FROM order_payments WHERE order_id = ?'
  ).bind(id).all();

  return c.json({
    success: true,
    data: {
      ...order,
      table: order.table_id ? { id: order.table_id, name: order.table_name } : null,
      items: items.results.map(item => ({
        ...item,
        modifiers: item.modifiers ? JSON.parse(item.modifiers) : [],
      })),
      payments: payments.results,
      subtotal: order.subtotal,
      discountAmount: order.discount_amount,
      taxAmount: order.tax_amount,
      totalAmount: order.total_amount,
      orderNumber: order.order_number,
      paymentStatus: order.payment_status,
      servedAt: order.served_at,
      completedAt: order.completed_at,
      cancelledAt: order.cancelled_at,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    },
  });
});

// POST /api/orders - Create new order
openApiOrdersRouter.openapi(OrderRoutes.create, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid('json');
  const user = c.get('user');
  const now = new Date().toISOString();

  const id = crypto.randomUUID();
  const orderNumber = `ORD-${now.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  // Calculate totals
  const items = body.items;
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = 0; // TODO: apply promotions
  const taxAmount = Math.round(subtotal * 0.1); // 10% VAT
  const totalAmount = subtotal - discountAmount + taxAmount;

  // Insert order
  await db.prepare(
    `INSERT INTO orders (id, order_number, table_id, location_id, customer_id, customer_name, customer_phone, customer_email, customer_loyalty_tier, customer_loyalty_points_earned, customer_locale, items, subtotal, discount_amount, tax_amount, total_amount, status, payment_status, notes, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    orderNumber,
    body.tableId || null,
    body.locationId,
    body.customer?.id || null,
    body.customer?.name || null,
    body.customer?.phone || null,
    body.customer?.email || null,
    body.customer?.loyaltyTier || null,
    body.customer?.loyaltyPointsEarned || 0,
    body.customer?.locale || 'vi',
    JSON.stringify(items),
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount,
    'pending',
    'unpaid',
    body.notes || null,
    body.source || 'pos',
    now,
    now
  ).run();

  // Insert order items
  for (const item of items) {
    await db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, variant_id, quantity, unit_price, total_price, modifiers, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      id,
      item.productId,
      item.variantId || null,
      item.quantity,
      item.unitPrice,
      item.totalPrice,
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

  return c.json({ success: true, data: created }, 201);
});

// PATCH /api/orders/:id - Update order
openApiOrdersRouter.openapi(OrderRoutes.update, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const user = c.get('user');
  const now = new Date().toISOString();

  const existing = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (body.status !== undefined) {
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

  const items = await db.prepare(
    `SELECT oi.*, p.name as product_name, p.slug as product_slug
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?`
  ).bind(id).all();

  const payments = await db.prepare(
    'SELECT * FROM order_payments WHERE order_id = ?'
  ).bind(id).all();

  return c.json({
    success: true,
    data: {
      ...updated,
      table: updated?.table_id ? { id: updated.table_id, name: updated.table_name } : null,
      items: items.results.map(item => ({
        ...item,
        modifiers: item.modifiers ? JSON.parse(item.modifiers) : [],
      })),
      payments: payments.results,
      subtotal: updated?.subtotal,
      discountAmount: updated?.discount_amount,
      taxAmount: updated?.tax_amount,
      totalAmount: updated?.total_amount,
      orderNumber: updated?.order_number,
      paymentStatus: updated?.payment_status,
      servedAt: updated?.served_at,
      completedAt: updated?.completed_at,
      cancelledAt: updated?.cancelled_at,
      createdAt: updated?.created_at,
      updatedAt: updated?.updated_at,
    },
  });
});

// POST /api/orders/:id/cancel - Cancel order
openApiOrdersRouter.openapi(OrderRoutes.cancel, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const user = c.get('user');
  const now = new Date().toISOString();

  const existing = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: 'Order not found' }, 404);
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

  return c.json({
    success: true,
    data: {
      ...updated,
      table: updated?.table_id ? { id: updated.table_id, name: updated.table_name } : null,
      status: 'cancelled',
      cancelledAt: now,
    },
  });
});

// GET /api/orders/summary - Get order summary statistics
openApiOrdersRouter.openapi(OrderRoutes.summary, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid('query');
  const { locationId, dateFrom, dateTo } = query;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (locationId) {
    whereClause += ' AND location_id = ?';
    params.push(locationId);
  }
  if (dateFrom) {
    whereClause += ' AND date(created_at) >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ' AND date(created_at) <= ?';
    params.push(dateTo);
  }

  const [totalResult, revenueResult, statusResult, paymentResult] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as total FROM orders ${whereClause}`).bind(...params).first(),
    db.prepare(`SELECT SUM(total_amount) as revenue FROM orders ${whereClause} AND status != 'cancelled'`).bind(...params).first(),
    db.prepare(`SELECT status, COUNT(*) as count FROM orders ${whereClause} GROUP BY status`).bind(...params).all(),
    db.prepare(`SELECT source, COUNT(*) as count FROM orders ${whereClause} GROUP BY source`).bind(...params).all(),
  ]);

  const statusCounts: Record<string, number> = {};
  statusResult.results.forEach(row => { statusCounts[row.status] = row.count; });

  const paymentCounts: Record<string, number> = {};
  paymentResult.results.forEach(row => { paymentCounts[row.source] = row.count; });

  return c.json({
    success: true,
    data: {
      totalOrders: totalResult?.total || 0,
      totalRevenue: revenueResult?.revenue || 0,
      averageOrderValue: totalResult?.total ? Math.round((revenueResult?.revenue || 0) / totalResult.total) : 0,
      ordersByStatus: statusCounts,
      ordersByPaymentMethod: paymentCounts,
    },
  });
});

export default openApiOrdersRouter;
