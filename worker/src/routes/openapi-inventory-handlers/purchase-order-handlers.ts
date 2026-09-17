import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';

export function registerPurchaseOrderHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/purchase-orders - List purchase orders
  app.openapi(InventoryRoutes.purchaseOrders.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const query = c.req.valid('query');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: (string | number)[] = [];

    if (query.status) {
      whereClause += 'WHERE status = ? ';
      params.push(query.status);
    }

    if (query.supplierId) {
      whereClause += whereClause ? 'AND supplier_id = ? ' : 'WHERE supplier_id = ? ';
      params.push(query.supplierId);
    }

    if (query.dateFrom) {
      whereClause += whereClause ? 'AND order_date >= ? ' : 'WHERE order_date >= ? ';
      params.push(query.dateFrom);
    }

    if (query.dateTo) {
      whereClause += whereClause ? 'AND order_date <= ? ' : 'WHERE order_date <= ? ';
      params.push(query.dateTo);
    }

    const countResult = await db.prepare(`SELECT COUNT(*) as total FROM purchase_orders ${whereClause}`).bind(...params).first();
    const total = countResult?.total || 0;

    const items = await db.prepare(
      `SELECT * FROM purchase_orders ${whereClause} ORDER BY order_date DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return c.json({
      success: true,
      data: items.results,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/inventory/purchase-orders/{id} - Get purchase order by ID
  app.openapi(InventoryRoutes.purchaseOrders.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const { id } = c.req.valid('param');

    const po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first();

    if (!po) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    const items = await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all();
    po.items = items.results;

    return c.json({ success: true, data: po });
  });

  // POST /api/inventory/purchase-orders - Create purchase order
  app.openapi(InventoryRoutes.purchaseOrders.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(body.supplierId).first();
    if (!supplier) {
      return c.json({ success: false, error: 'Supplier not found' }, 404);
    }

    const id = `po_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.prepare(
      `INSERT INTO purchase_orders (id, supplier_id, order_date, expected_date, status, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.supplierId,
      body.orderDate || now.split('T')[0],
      body.expectedDate || null,
      'draft',
      body.notes || null,
      user.id,
      now,
      now
    ).run();

    for (const item of body.items) {
      const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
      if (!ingredient) {
        return c.json({ success: false, error: `Ingredient ${item.ingredientId} not found` }, 400);
      }

      await db.prepare(
        `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        id,
        item.ingredientId,
        item.quantity,
        item.unitCost || ingredient.cost_per_unit,
        now
      ).run();
    }

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'purchase_order_create', 'purchase_order', id, JSON.stringify(body), now).run();

    const po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first();
    const items = await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all();
    if (po) po.items = items.results;

    return c.json({ success: true, data: po }, 201);
  });

  // PATCH /api/inventory/purchase-orders/{id} - Update purchase order
  app.openapi(InventoryRoutes.purchaseOrders.update, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    if (existing.status === 'received') {
      return c.json({ success: false, error: 'Cannot update received purchase order' }, 409);
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (body.supplierId !== undefined) {
      const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(body.supplierId).first();
      if (!supplier) {
        return c.json({ success: false, error: 'Supplier not found' }, 404);
      }
      updates.push('supplier_id = ?');
      params.push(body.supplierId);
    }
    if (body.expectedDate !== undefined) { updates.push('expected_date = ?'); params.push(body.expectedDate); }
    if (body.status !== undefined) { updates.push('status = ?'); params.push(body.status); }
    if (body.notes !== undefined) { updates.push('notes = ?'); params.push(body.notes); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);

      await db.prepare(`UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    }

    if (body.items) {
      await db.prepare('DELETE FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).run();

      for (const item of body.items) {
        const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
        if (!ingredient) {
          return c.json({ success: false, error: `Ingredient ${item.ingredientId} not found` }, 400);
        }

        await db.prepare(
          `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_cost, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          id,
          item.ingredientId,
          item.quantity,
          item.unitCost || ingredient.cost_per_unit,
          now
        ).run();
      }
    }

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'purchase_order_update', 'purchase_order', id, JSON.stringify(body), now).run();

    const po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first();
    const items = await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all();
    if (po) po.items = items.results;

    return c.json({ success: true, data: po });
  });

  // POST /api/inventory/purchase-orders/{id}/receive - Receive purchase order items
  app.openapi(InventoryRoutes.purchaseOrders.receive, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    if (existing.status === 'received') {
      return c.json({ success: false, error: 'Purchase order already received' }, 409);
    }

    for (const item of body.items) {
      const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
      if (!ingredient) {
        return c.json({ success: false, error: `Ingredient ${item.ingredientId} not found` }, 400);
      }

      const newStock = ingredient.current_stock + item.receivedQuantity;
      await db.prepare('UPDATE ingredients SET current_stock = ?, updated_at = ? WHERE id = ?')
        .bind(newStock, now, item.ingredientId).run();

      await db.prepare(
        `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        item.ingredientId,
        'purchase_receipt',
        item.receivedQuantity,
        id,
        'purchase_order',
        `Received from PO ${id}`,
        user.id,
        now
      ).run();
    }

    await db.prepare('UPDATE purchase_orders SET status = \'received\', updated_at = ? WHERE id = ?')
      .bind(now, id).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'purchase_order_receive', 'purchase_order', id, JSON.stringify(body), now).run();

    const po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first();
    const items = await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all();
    if (po) po.items = items.results;

    return c.json({ success: true, data: po });
  });
}
