import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';
import { getDatabase } from '../../lib/db';

async function writeIngredientAuditLog(
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
    ).bind(`audit_${Date.now()}`, userId, action, 'ingredient', entityId, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, userId, action, 'ingredient', entityId, 'ingredient', entityId, metadata, metadata, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, userId, action, 'ingredient', entityId, metadata, now).run().catch(() => {});
      } catch {
        // Ignore audit log error
      }
    }
  }
}

export function registerIngredientHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/ingredients - List ingredients
  app.openapi(InventoryRoutes.ingredients.list as any, async (c: any) => {
    const db = getDatabase(c);
    const query = c.req.valid('query');

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
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

    let total = 0;
    let itemResults: any[] = [];
    try {
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM ingredients ${whereClause}`).bind(...params).first()) as { total?: number } | null;
      total = Number(countResult?.total || 0);

      const items = await db.prepare(
        `SELECT * FROM ingredients ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all();
      itemResults = items.results || [];
    } catch {
      let invWhere = '';
      const invParams: (string | number)[] = [];
      if (query.search) {
        invWhere += 'WHERE (name LIKE ? OR id LIKE ?) ';
        invParams.push(`%${query.search}%`, `%${query.search}%`);
      }
      if (query.category) {
        invWhere += invWhere ? 'AND category = ? ' : 'WHERE category = ? ';
        invParams.push(query.category);
      }
      if (query.isActive !== undefined) {
        invWhere += invWhere ? 'AND is_active = ? ' : 'WHERE is_active = ? ';
        invParams.push(query.isActive ? 1 : 0);
      }
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM inventory_items ${invWhere}`).bind(...invParams).first()) as { total?: number } | null;
      total = Number(countResult?.total || 0);

      const items = await db.prepare(
        `SELECT *, id as sku, unit_cost as cost_per_unit FROM inventory_items ${invWhere} ORDER BY name ASC LIMIT ? OFFSET ?`
      ).bind(...invParams, limit, offset).all();
      itemResults = items.results || [];
    }

    return c.json({
      success: true,
      data: itemResults,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/inventory/ingredients/{id} - Get ingredient by ID
  app.openapi(InventoryRoutes.ingredients.get as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');

    let ingredient: any = null;
    try {
      ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    } catch {
      ingredient = await db.prepare('SELECT *, id as sku, unit_cost as cost_per_unit FROM inventory_items WHERE id = ?').bind(id).first();
    }

    if (!ingredient) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }

    return c.json({ success: true, data: ingredient });
  });

  // POST /api/inventory/ingredients - Create ingredient
  app.openapi(InventoryRoutes.ingredients.create as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    // Check SKU uniqueness
    let existing: unknown = null;
    let usingCanonical = false;
    try {
      existing = await db.prepare('SELECT id FROM ingredients WHERE sku = ?').bind(body.sku).first();
    } catch {
      usingCanonical = true;
      existing = await db.prepare('SELECT id FROM inventory_items WHERE id = ? OR name = ?').bind(body.sku, body.name).first().catch(() => null);
    }
    if (existing) {
      return c.json({ success: false, error: 'SKU already exists' }, 409);
    }

    const id = `ing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!usingCanonical) {
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
    } else {
      await db.prepare(
        `INSERT INTO inventory_items (id, name, unit, category, current_stock, min_stock, max_stock, unit_cost, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.name,
        body.unit,
        body.category || 'general',
        body.currentStock || 0,
        body.minStock || 0,
        body.maxStock || 0,
        body.costPerUnit || 0,
        body.isActive !== false ? 1 : 0,
        now,
        now
      ).run();
    }

    await writeIngredientAuditLog(db, user.id, 'ingredient_create', id, JSON.stringify(body), now);

    let ingredient: any = null;
    if (!usingCanonical) {
      ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    } else {
      ingredient = await db.prepare('SELECT *, id as sku, unit_cost as cost_per_unit FROM inventory_items WHERE id = ?').bind(id).first();
      if (ingredient) {
        ingredient = { ...ingredient, sku: body.sku };
      }
    }
    return c.json({ success: true, data: ingredient }, 201);
  });

  // PATCH /api/inventory/ingredients/{id} - Update ingredient
  app.openapi(InventoryRoutes.ingredients.update as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingCanonical = false;
    try {
      existing = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    } catch {
      usingCanonical = true;
      existing = await db.prepare('SELECT *, id as sku, unit_cost as cost_per_unit FROM inventory_items WHERE id = ?').bind(id).first();
    }
    if (!existing) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }

    // Check SKU uniqueness if changing
    if (body.sku && body.sku !== existing.sku && !usingCanonical) {
      const skuExists = await db.prepare('SELECT id FROM ingredients WHERE sku = ? AND id != ?').bind(body.sku, id).first();
      if (skuExists) {
        return c.json({ success: false, error: 'SKU already exists' }, 409);
      }
    }

    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];
    const canonicalUpdates: string[] = [];
    const canonicalParams: (string | number | boolean)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?'); params.push(body.name);
      canonicalUpdates.push('name = ?'); canonicalParams.push(body.name);
    }
    if (body.sku !== undefined) { updates.push('sku = ?'); params.push(body.sku); }
    if (body.category !== undefined) {
      updates.push('category = ?'); params.push(body.category);
      canonicalUpdates.push('category = ?'); canonicalParams.push(body.category);
    }
    if (body.unit !== undefined) {
      updates.push('unit = ?'); params.push(body.unit);
      canonicalUpdates.push('unit = ?'); canonicalParams.push(body.unit);
    }
    if (body.costPerUnit !== undefined) {
      updates.push('cost_per_unit = ?'); params.push(body.costPerUnit);
      canonicalUpdates.push('unit_cost = ?'); canonicalParams.push(body.costPerUnit);
    }
    if (body.currentStock !== undefined) {
      updates.push('current_stock = ?'); params.push(body.currentStock);
      canonicalUpdates.push('current_stock = ?'); canonicalParams.push(body.currentStock);
    }
    if (body.minStock !== undefined) {
      updates.push('min_stock = ?'); params.push(body.minStock);
      canonicalUpdates.push('min_stock = ?'); canonicalParams.push(body.minStock);
    }
    if (body.maxStock !== undefined) {
      updates.push('max_stock = ?'); params.push(body.maxStock);
      canonicalUpdates.push('max_stock = ?'); canonicalParams.push(body.maxStock);
    }
    if (body.isActive !== undefined) {
      updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0);
      canonicalUpdates.push('is_active = ?'); canonicalParams.push(body.isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return c.json({ success: true, data: existing });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    canonicalUpdates.push('updated_at = ?');
    canonicalParams.push(now);
    canonicalParams.push(id);

    if (!usingCanonical) {
      await db.prepare(`UPDATE ingredients SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    } else if (canonicalUpdates.length > 1) {
      await db.prepare(`UPDATE inventory_items SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams).run();
    }

    await writeIngredientAuditLog(db, user.id, 'ingredient_update', id, JSON.stringify(body), now);

    let ingredient: any = null;
    if (!usingCanonical) {
      ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    } else {
      ingredient = await db.prepare('SELECT *, id as sku, unit_cost as cost_per_unit FROM inventory_items WHERE id = ?').bind(id).first();
    }
    return c.json({ success: true, data: ingredient });
  });

  // DELETE /api/inventory/ingredients/{id} - Delete ingredient
  app.openapi(InventoryRoutes.ingredients.delete as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingCanonical = false;
    try {
      existing = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    } catch {
      usingCanonical = true;
      existing = await db.prepare('SELECT * FROM inventory_items WHERE id = ?').bind(id).first();
    }
    if (!existing) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }

    // Check if ingredient is used in recipes or purchase orders
    let usedInRecipe = null;
    try {
      usedInRecipe = await db.prepare('SELECT 1 FROM recipe_items WHERE ingredient_id = ? LIMIT 1').bind(id).first();
    } catch {
      try {
        usedInRecipe = await db.prepare('SELECT 1 FROM recipe_ingredients WHERE ingredient_id = ? LIMIT 1').bind(id).first();
      } catch {
        usedInRecipe = await db.prepare('SELECT 1 FROM recipes WHERE item_id = ? LIMIT 1').bind(id).first().catch(() => null);
      }
    }
    if (usedInRecipe) {
      return c.json({ success: false, error: 'Cannot delete ingredient used in recipes' }, 409);
    }

    let usedInPO = null;
    try {
      usedInPO = await db.prepare('SELECT 1 FROM purchase_order_items WHERE ingredient_id = ? LIMIT 1').bind(id).first();
    } catch {
      usedInPO = null;
    }
    if (usedInPO) {
      return c.json({ success: false, error: 'Cannot delete ingredient used in purchase orders' }, 409);
    }

    if (!usingCanonical) {
      await db.prepare('DELETE FROM ingredients WHERE id = ?').bind(id).run();
    } else {
      await db.prepare('DELETE FROM inventory_items WHERE id = ?').bind(id).run();
    }

    await writeIngredientAuditLog(db, user.id, 'ingredient_delete', id, JSON.stringify({}), now);

    return c.json({ success: true, data: { id, deleted: true } });
  });
}
