import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';

export function registerIngredientHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/ingredients - List ingredients
  app.openapi(InventoryRoutes.ingredients.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const query = c.req.valid('query');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: (string | number)[] = [];

    if (query.search) {
      whereClause += 'WHERE (name LIKE ? OR sku LIKE ?) ';
      params.push(`%${query.search}%`, `%${query.search}%`);
    }

    if (query.category) {
      whereClause += whereClause ? 'AND category = ? ' : 'WHERE category = ? ';
      params.push(query.category);
    }

    if (query.isActive !== undefined) {
      whereClause += whereClause ? 'AND is_active = ? ' : 'WHERE is_active = ? ';
      params.push(query.isActive ? 1 : 0);
    }

    const countResult = await db.prepare(`SELECT COUNT(*) as total FROM ingredients ${whereClause}`).bind(...params).first();
    const total = countResult?.total || 0;

    const items = await db.prepare(
      `SELECT * FROM ingredients ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return c.json({
      success: true,
      data: items.results,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/inventory/ingredients/{id} - Get ingredient by ID
  app.openapi(InventoryRoutes.ingredients.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const { id } = c.req.valid('param');

    const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();

    if (!ingredient) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }

    return c.json({ success: true, data: ingredient });
  });

  // POST /api/inventory/ingredients - Create ingredient
  app.openapi(InventoryRoutes.ingredients.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    // Check SKU uniqueness
    const existing = await db.prepare('SELECT id FROM ingredients WHERE sku = ?').bind(body.sku).first();
    if (existing) {
      return c.json({ success: false, error: 'SKU already exists' }, 409);
    }

    const id = `ing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.prepare(
      `INSERT INTO ingredients (id, name, sku, category, unit, cost_per_unit, current_stock, min_stock, max_stock, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.name,
      body.sku,
      body.category,
      body.unit,
      body.costPerUnit,
      body.currentStock || 0,
      body.minStock || 0,
      body.maxStock || 0,
      body.isActive !== false ? 1 : 0,
      now,
      now
    ).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'ingredient_create', 'ingredient', id, JSON.stringify(body), now).run();

    const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: ingredient }, 201);
  });

  // PATCH /api/inventory/ingredients/{id} - Update ingredient
  app.openapi(InventoryRoutes.ingredients.update, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }

    // Check SKU uniqueness if changing
    if (body.sku && body.sku !== existing.sku) {
      const skuExists = await db.prepare('SELECT id FROM ingredients WHERE sku = ? AND id != ?').bind(body.sku, id).first();
      if (skuExists) {
        return c.json({ success: false, error: 'SKU already exists' }, 409);
      }
    }

    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];

    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.sku !== undefined) { updates.push('sku = ?'); params.push(body.sku); }
    if (body.category !== undefined) { updates.push('category = ?'); params.push(body.category); }
    if (body.unit !== undefined) { updates.push('unit = ?'); params.push(body.unit); }
    if (body.costPerUnit !== undefined) { updates.push('cost_per_unit = ?'); params.push(body.costPerUnit); }
    if (body.currentStock !== undefined) { updates.push('current_stock = ?'); params.push(body.currentStock); }
    if (body.minStock !== undefined) { updates.push('min_stock = ?'); params.push(body.minStock); }
    if (body.maxStock !== undefined) { updates.push('max_stock = ?'); params.push(body.maxStock); }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }

    if (updates.length === 0) {
      return c.json({ success: true, data: existing });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await db.prepare(`UPDATE ingredients SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'ingredient_update', 'ingredient', id, JSON.stringify(body), now).run();

    const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: ingredient });
  });

  // DELETE /api/inventory/ingredients/{id} - Delete ingredient
  app.openapi(InventoryRoutes.ingredients.delete, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }

    // Check if ingredient is used in recipes or purchase orders
    const usedInRecipe = await db.prepare('SELECT 1 FROM recipe_ingredients WHERE ingredient_id = ? LIMIT 1').bind(id).first();
    if (usedInRecipe) {
      return c.json({ success: false, error: 'Cannot delete ingredient used in recipes' }, 409);
    }

    const usedInPO = await db.prepare('SELECT 1 FROM purchase_order_items WHERE ingredient_id = ? LIMIT 1').bind(id).first();
    if (usedInPO) {
      return c.json({ success: false, error: 'Cannot delete ingredient used in purchase orders' }, 409);
    }

    await db.prepare('DELETE FROM ingredients WHERE id = ?').bind(id).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'ingredient_delete', 'ingredient', id, JSON.stringify({}), now).run();

    return c.json({ success: true, data: { id, deleted: true } });
  });
}
