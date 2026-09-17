import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';

export function registerMovementHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/movements - List stock movements
  app.openapi(InventoryRoutes.movements.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
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

    const countResult = await db.prepare(`SELECT COUNT(*) as total FROM stock_movements ${whereClause}`).bind(...params).first();
    const total = countResult?.total || 0;

    const items = await db.prepare(
      `SELECT * FROM stock_movements ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return c.json({
      success: true,
      data: items.results,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // POST /api/inventory/movements - Create stock movement (adjustment)
  app.openapi(InventoryRoutes.movements.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(body.ingredientId).first();
    if (!ingredient) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }

    const newStock = ingredient.current_stock + body.quantity;
    if (newStock < 0) {
      return c.json({ success: false, error: 'Insufficient stock' }, 400);
    }

    const id = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'stock_movement_create', 'stock_movement', id, JSON.stringify(body), now).run();

    const movement = await db.prepare('SELECT * FROM stock_movements WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: movement }, 201);
  });
}
