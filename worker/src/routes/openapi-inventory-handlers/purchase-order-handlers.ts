import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';
import { getDatabase } from '../../lib/db';

async function writePoAuditLog(
  db: any,
  userId: string,
  action: string,
  entityId: string,
  metadata: string,
  now: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, userId, action, 'purchase_order', entityId, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, action, 'purchase_order', entityId, metadata, now).run().catch(() => {});
    } catch {
      // Ignore audit log error
    }
  }
}

export function registerPurchaseOrderHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/purchase-orders - List purchase orders
  app.openapi(InventoryRoutes.purchaseOrders.list as any, async (c: any) => {
    const db = getDatabase(c);
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

    let total = 0;
    try {
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM purchase_orders ${whereClause}`).bind(...params).first()) as { total: number } | null;
      total = countResult?.total || 0;
    } catch {
      total = 0;
    }

    let itemsResults: any[] = [];
    try {
      const aliasWhere = whereClause
        ? whereClause.replace(/supplier_id/g, 'po.supplier_id').replace(/status/g, 'po.status')
        : '';
      const items = (await db.prepare(
        `SELECT po.*, s.name as supplier_name
         FROM purchase_orders po
         LEFT JOIN suppliers s ON po.supplier_id = s.id
         ${aliasWhere}
         ORDER BY po.created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all()) as { results: any[] };
      itemsResults = items.results || [];
    } catch {
      try {
        const items = (await db.prepare(
          `SELECT * FROM purchase_orders ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset).all()) as { results: any[] };
        itemsResults = items.results || [];
      } catch {
        itemsResults = [];
      }
    }

    return c.json({
      success: true,
      data: itemsResults,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/inventory/purchase-orders/{id} - Get purchase order by ID
  app.openapi(InventoryRoutes.purchaseOrders.get as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');

    let po: any = null;
    try {
      po = await db.prepare(
        `SELECT po.*, s.name as supplier_name
         FROM purchase_orders po
         LEFT JOIN suppliers s ON po.supplier_id = s.id
         WHERE po.id = ?`
      ).bind(id).first();
    } catch {
      po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first().catch(() => null);
    }

    if (!po) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    let items: any[] = [];
    try {
      const res = await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all();
      items = res.results || [];
    } catch {
      try {
        const res = await db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').bind(id).all();
        items = res.results || [];
      } catch {
        items = [];
      }
    }
    po.items = items.map((it: any) => ({
      ...it,
      unitCost: it.unit_cost ?? it.unit_price ?? 0,
      unit_cost: it.unit_cost ?? it.unit_price ?? 0,
    }));

    return c.json({ success: true, data: po });
  });

  // POST /api/inventory/purchase-orders - Create purchase order
  app.openapi(InventoryRoutes.purchaseOrders.create as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    let supplier: any = null;
    try {
      supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(body.supplierId).first();
    } catch {
      supplier = { id: body.supplierId, name: body.supplierId };
    }
    if (!supplier) {
      return c.json({ success: false, error: 'Supplier not found' }, 404);
    }

    const id = `po_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const poNumber = `PO-${Date.now()}`;
    const expectedDate = body.expectedDate || null;
    let totalAmount = 0;
    for (const item of body.items) {
      totalAmount += (item.quantity || 1) * (item.unitCost || 0);
    }

    try {
      await db.prepare(
        `INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, expected_date, expected_delivery_date, status, total_amount, notes, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        poNumber,
        body.supplierId,
        body.orderDate || now.split('T')[0],
        expectedDate,
        expectedDate,
        'draft',
        totalAmount,
        body.notes || null,
        user.id,
        now,
        now
      ).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO purchase_orders (id, supplier_id, order_date, expected_date, status, notes, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.supplierId,
          body.orderDate || now.split('T')[0],
          expectedDate,
          'draft',
          body.notes || null,
          user.id,
          now,
          now
        ).run();
      } catch {
        // Fallback for minimal schema
      }
    }

    for (const item of body.items) {
      let ingredient: any = null;
      try {
        ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
      } catch {
        ingredient = await db.prepare('SELECT *, unit_cost as cost_per_unit FROM inventory_items WHERE id = ?').bind(item.ingredientId).first().catch(() => null);
      }
      if (!ingredient) {
        return c.json({ success: false, error: `Ingredient ${item.ingredientId} not found` }, 400);
      }
      const unitCost = item.unitCost || ingredient.cost_per_unit || ingredient.costPerUnit || 0;
      const itemTotal = (item.quantity || 1) * unitCost;
      const itemId = `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        await db.prepare(
          `INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity, unit_cost, unit_price, total_price, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(itemId, id, id, item.ingredientId, item.quantity, unitCost, unitCost, itemTotal, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_cost, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(itemId, id, item.ingredientId, item.quantity, unitCost, now).run();
        } catch {
          // Fallback
        }
      }
    }

    await writePoAuditLog(db, user.id, 'purchase_order_create', id, JSON.stringify(body), now);

    let po: any = null;
    try {
      po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first();
      const items = (await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all()) as { results: any[] };
      if (po) po.items = items.results;
    } catch {
      po = {
        id,
        po_number: poNumber,
        supplier_id: body.supplierId,
        order_date: body.orderDate || now.split('T')[0],
        expected_date: expectedDate,
        status: 'draft',
        total_amount: totalAmount,
        notes: body.notes || null,
        items: body.items,
        created_at: now,
        updated_at: now,
      };
    }

    return c.json({ success: true, data: po }, 201);
  });

  // PATCH /api/inventory/purchase-orders/{id} - Update purchase order
  app.openapi(InventoryRoutes.purchaseOrders.update as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first().catch(() => null)) as any;
    if (!existing) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    if (existing.status === 'received') {
      return c.json({ success: false, error: 'Cannot update received purchase order' }, 409);
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (body.supplierId !== undefined) {
      let supplier: any = null;
      try {
        supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(body.supplierId).first();
      } catch {
        supplier = { id: body.supplierId };
      }
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
        let ingredient: any = null;
        try {
          ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
        } catch {
          ingredient = await db.prepare('SELECT *, unit_cost as cost_per_unit FROM inventory_items WHERE id = ?').bind(item.ingredientId).first().catch(() => null);
        }
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

    await writePoAuditLog(db, user.id, 'purchase_order_update', id, JSON.stringify(body), now);

    const po = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first()) as any;
    const items = (await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all()) as { results: any[] };
    if (po) po.items = items.results;

    return c.json({ success: true, data: po });
  });

  // POST /api/inventory/purchase-orders/{id}/receive - Receive purchase order items
  app.openapi(InventoryRoutes.purchaseOrders.receive as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first().catch(() => null)) as any;
    if (!existing) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    if (existing.status === 'received') {
      return c.json({ success: false, error: 'Purchase order already received' }, 409);
    }

    for (const item of body.items) {
      let ingredient: any = null;
      let usingCanonical = false;
      try {
        ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
      } catch {
        usingCanonical = true;
        ingredient = await db.prepare('SELECT * FROM inventory_items WHERE id = ?').bind(item.ingredientId).first().catch(() => null);
      }
      if (!ingredient) {
        return c.json({ success: false, error: `Ingredient ${item.ingredientId} not found` }, 400);
      }

      const previousStock = Number(ingredient.current_stock || 0);
      const newStock = previousStock + item.receivedQuantity;
      if (!usingCanonical) {
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
      } else {
        await db.prepare('UPDATE inventory_items SET current_stock = ?, last_restocked_at = ?, updated_at = ? WHERE id = ?')
          .bind(newStock, now, now, item.ingredientId).run();

        await db.prepare(
          `INSERT INTO inventory_transactions (id, item_id, type, quantity, previous_stock, new_stock, unit_cost, reason, performed_by, created_at)
           VALUES (?, ?, 'restock', ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          item.ingredientId,
          item.receivedQuantity,
          previousStock,
          newStock,
          ingredient.unit_cost || 0,
          `Received from PO ${id}`,
          user.id,
          now
        ).run();
      }
    }

    await db.prepare('UPDATE purchase_orders SET status = \'received\', updated_at = ? WHERE id = ?')
      .bind(now, id).run();

    await writePoAuditLog(db, user.id, 'purchase_order_receive', id, JSON.stringify(body), now);

    const po = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first()) as any;
    const items = (await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all()) as { results: any[] };
    if (po) po.items = items.results;

    return c.json({ success: true, data: po });
  });
}

