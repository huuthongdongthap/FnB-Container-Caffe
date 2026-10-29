import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';
import { getDatabase } from '../../lib/db';

export function registerMovementHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/movements - List stock movements
  app.openapi(InventoryRoutes.movements.list as any, async (c: any) => {
    const db = getDatabase(c);
    const query = c.req.valid('query');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: (string | number)[] = [];

    if (query.ingredientId) {
      whereClause += 'WHERE ingredient_id = ? ';
      params.push(query.ingredientId);
    }

    if (query.type) {
      whereClause += whereClause ? 'AND type = ? ' : 'WHERE type = ? ';
      params.push(query.type);
    }

    if (query.dateFrom) {
      whereClause += whereClause ? 'AND created_at >= ? ' : 'WHERE created_at >= ? ';
      params.push(query.dateFrom);
    }

    if (query.dateTo) {
      whereClause += whereClause ? 'AND created_at <= ? ' : 'WHERE created_at <= ? ';
      params.push(query.dateTo);
    }

    let total = 0;
    let itemsResults: any[] = [];
    let usingCanonical = false;
    try {
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM stock_movements ${whereClause}`).bind(...params).first()) as { total: number } | null;
      total = countResult?.total || 0;
    } catch {
      usingCanonical = true;
      const canonicalWhere = whereClause.replace(/ingredient_id/g, 'item_id');
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM inventory_transactions ${canonicalWhere}`).bind(...params).first().catch(() => null)) as { total: number } | null;
      total = countResult?.total || 0;
    }

    if (!usingCanonical) {
      try {
        const aliasWhere = whereClause
          ? whereClause.replace(/ingredient_id/g, 'sm.ingredient_id').replace(/created_at/g, 'sm.created_at').replace(/\btype =/g, 'sm.type =')
          : '';
        const items = (await db.prepare(
          `SELECT sm.*, i.name as ingredient_name, i.sku as ingredient_sku, i.unit as ingredient_unit
           FROM stock_movements sm
           LEFT JOIN ingredients i ON sm.ingredient_id = i.id
           ${aliasWhere}
           ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset).all()) as { results: any[] };
        itemsResults = items.results || [];
      } catch {
        try {
          const items = (await db.prepare(
            `SELECT * FROM stock_movements ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
          ).bind(...params, limit, offset).all()) as { results: any[] };
          itemsResults = items.results || [];
        } catch {
          itemsResults = [];
        }
      }
    } else {
      try {
        const aliasWhere = whereClause
          ? whereClause.replace(/ingredient_id/g, 'sm.item_id').replace(/created_at/g, 'sm.created_at').replace(/\btype =/g, 'sm.type =')
          : '';
        const items = (await db.prepare(
          `SELECT sm.*, sm.item_id as ingredient_id, sm.reason as notes, sm.performed_by as created_by, i.name as ingredient_name, i.id as ingredient_sku, i.unit as ingredient_unit
           FROM inventory_transactions sm
           LEFT JOIN inventory_items i ON sm.item_id = i.id
           ${aliasWhere}
           ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`
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

  // POST /api/inventory/movements - Create stock movement (adjustment)
  app.openapi(InventoryRoutes.movements.create as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    let ingredient: any = null;
    let usingCanonical = false;
    try {
      ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(body.ingredientId).first();
    } catch {
      usingCanonical = true;
      ingredient = await db.prepare('SELECT * FROM inventory_items WHERE id = ?').bind(body.ingredientId).first();
    }
    if (!ingredient) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }

    const previousStock = Number(ingredient.current_stock || 0);
    const newStock = previousStock + body.quantity;
    if (newStock < 0) {
      return c.json({ success: false, error: 'Insufficient stock' }, 400);
    }

    const id = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!usingCanonical) {
      await db.prepare(
        `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.ingredientId,
        body.type,
        body.quantity,
        body.referenceId || null,
        body.referenceType || null,
        body.notes || null,
        user.id,
        now
      ).run();

      await db.prepare('UPDATE ingredients SET current_stock = ?, updated_at = ? WHERE id = ?')
        .bind(newStock, now, body.ingredientId).run();
    } else {
      const txType = body.quantity >= 0 ? 'restock' : 'adjustment';
      await db.prepare(
        `INSERT INTO inventory_transactions (id, item_id, type, quantity, previous_stock, new_stock, unit_cost, reason, performed_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.ingredientId,
        txType,
        body.quantity,
        previousStock,
        newStock,
        ingredient.unit_cost || 0,
        body.notes || body.type || null,
        user.id,
        now
      ).run();

      await db.prepare('UPDATE inventory_items SET current_stock = ?, updated_at = ? WHERE id = ?')
        .bind(newStock, now, body.ingredientId).run();
    }

    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${Date.now()}`, user.id, 'stock_movement_create', 'stock_movement', id, JSON.stringify(body), now).run();
    } catch {
      const metaStr = JSON.stringify(body);
      try {
        await db.prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(user.id, user.id, user.id, 'stock_movement_create', 'stock_movement', id, 'stock_movement', id, metaStr, metaStr, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(user.id, user.id, 'stock_movement_create', 'stock_movement', id, metaStr, now).run().catch(() => {});
        } catch {
          // Ignore audit log error
        }
      }
    }

    let movement: any = null;
    if (!usingCanonical) {
      movement = await db.prepare('SELECT * FROM stock_movements WHERE id = ?').bind(id).first();
    } else {
      movement = await db.prepare('SELECT *, item_id as ingredient_id, reason as notes, performed_by as created_by FROM inventory_transactions WHERE id = ?').bind(id).first();
    }
    return c.json({ success: true, data: movement }, 201);
  });
}
