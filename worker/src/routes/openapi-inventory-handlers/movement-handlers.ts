import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';
import { getDatabase } from '../../lib/db';

function mapToCanonicalTxType(type: string, quantity: number): string {
  if (type === 'in' || type === 'out' || type === 'waste' || type === 'reserve' || type === 'release') {
    return type;
  }
  if (type === 'adjustment' || type === 'adjust') {
    return 'adjust';
  }
  if (type === 'transfer') {
    return quantity < 0 ? 'out' : 'in';
  }
  return quantity >= 0 ? 'in' : 'adjust';
}

function mapToCanonicalRefType(refType?: string | null): string | null {
  if (!refType) return null;
  if (refType === 'order' || refType === 'purchase' || refType === 'adjustment' || refType === 'waste_report' || refType === 'sync') {
    return refType;
  }
  if (refType === 'sale') return 'order';
  if (refType === 'purchase_order') return 'purchase';
  if (refType === 'waste') return 'waste_report';
  if (refType === 'manual' || refType === 'audit' || refType === 'transfer' || refType === 'production') return 'adjustment';
  return null;
}

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
    }

    if (!usingCanonical && total > 0) {
      try {
        const aliasWhere = whereClause
          ? whereClause.replace(/ingredient_id/g, 'sm.ingredient_id').replace(/created_at/g, 'sm.created_at').replace(/\btype =/g, 'sm.type =')
          : '';
        const items = (await db.prepare(
          `SELECT sm.*, COALESCE(i.name, ii.name) as ingredient_name, COALESCE(i.sku, ii.sku, ii.id) as ingredient_sku, COALESCE(i.unit, ii.unit) as ingredient_unit
           FROM stock_movements sm
           LEFT JOIN ingredients i ON sm.ingredient_id = i.id
           LEFT JOIN inventory_items ii ON sm.ingredient_id = ii.id
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
    }

    if (usingCanonical || itemsResults.length === 0) {
      const canonicalParams = params.map((p) => (p === 'adjustment' ? 'adjust' : p));
      const canonicalWhere = whereClause.replace(/ingredient_id/g, 'item_id');
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM inventory_transactions ${canonicalWhere}`).bind(...canonicalParams).first().catch(() => null)) as { total: number } | null;
      const fallbackTotal = countResult?.total || 0;
      if (usingCanonical || fallbackTotal > 0) {
        total = fallbackTotal;
        try {
          const aliasWhere = whereClause
            ? whereClause.replace(/ingredient_id/g, 'sm.item_id').replace(/created_at/g, 'sm.created_at').replace(/\btype =/g, 'sm.type =')
            : '';
          const items = (await db.prepare(
            `SELECT sm.*, sm.item_id as ingredient_id, CASE WHEN sm.type = 'adjust' THEN 'adjustment' ELSE sm.type END as type, i.name as ingredient_name, COALESCE(i.sku, i.id) as ingredient_sku, i.unit as ingredient_unit
             FROM inventory_transactions sm
             LEFT JOIN inventory_items i ON sm.item_id = i.id
             ${aliasWhere}
             ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`
          ).bind(...canonicalParams, limit, offset).all()) as { results: any[] };
          itemsResults = items.results || [];
        } catch {
          itemsResults = [];
        }
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
    }
    if (!ingredient) {
      ingredient = await db.prepare('SELECT * FROM inventory_items WHERE id = ?').bind(body.ingredientId).first().catch(() => null);
      if (ingredient) {
        usingCanonical = true;
      }
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
    const canonicalTxType = mapToCanonicalTxType(body.type, body.quantity);
    const canonicalRefType = mapToCanonicalRefType(body.referenceType);

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

      await db.prepare('UPDATE inventory_items SET current_stock = ?, updated_at = ? WHERE id = ?')
        .bind(newStock, now, body.ingredientId).run().catch(() => {});

      await db.prepare(
        `INSERT OR IGNORE INTO inventory_transactions (
          id, item_id, type, quantity, reference_type, reference_id, notes, created_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM inventory_items WHERE id = ?)`
      ).bind(
        id,
        body.ingredientId,
        canonicalTxType,
        body.quantity,
        canonicalRefType,
        body.referenceId || null,
        body.notes || body.type || null,
        now,
        body.ingredientId
      ).run().catch(() => {});
    } else {
      await db.prepare(
        `INSERT INTO inventory_transactions (
          id, item_id, type, quantity, reference_type, reference_id, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.ingredientId,
        canonicalTxType,
        body.quantity,
        canonicalRefType,
        body.referenceId || null,
        body.notes || body.type || null,
        now
      ).run();

      await db.prepare('UPDATE inventory_items SET current_stock = ?, updated_at = ? WHERE id = ?')
        .bind(newStock, now, body.ingredientId).run();
    }

    const metaStr = JSON.stringify(body);
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(user.id, user.id, user.id, 'stock_movement_create', 'stock_movement', id, 'stock_movement', id, metaStr, metaStr, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(`audit_${Date.now()}`, user.id, 'stock_movement_create', 'stock_movement', id, metaStr, now).run();
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
      movement = await db.prepare('SELECT *, item_id as ingredient_id FROM inventory_transactions WHERE id = ?').bind(id).first();
    }
    return c.json({ success: true, data: movement }, 201);
  });
}
