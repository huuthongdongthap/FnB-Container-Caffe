import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types/env';
import { InventoryRoutes } from '../schemas/inventory';

const openApiInventoryRouter = new OpenAPIHono<{ Bindings: Env }>();

// Auth middleware for all inventory routes
openApiInventoryRouter.use('*', requireAuth);

// ============ INGREDIENTS ROUTES ============

// GET /api/inventory/ingredients - List ingredients
openApiInventoryRouter.openapi(InventoryRoutes.ingredients.list, async (c) => {
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
openApiInventoryRouter.openapi(InventoryRoutes.ingredients.get, async (c) => {
  const db = c.env.DB;
  const { id } = c.req.valid('param');

  const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();

  if (!ingredient) {
    return c.json({ success: false, error: 'Ingredient not found' }, 404);
  }

  return c.json({ success: true, data: ingredient });
});

// POST /api/inventory/ingredients - Create ingredient
openApiInventoryRouter.openapi(InventoryRoutes.ingredients.create, async (c) => {
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
openApiInventoryRouter.openapi(InventoryRoutes.ingredients.update, async (c) => {
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
openApiInventoryRouter.openapi(InventoryRoutes.ingredients.delete, async (c) => {
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

// ============ STOCK MOVEMENTS ROUTES ============

// GET /api/inventory/movements - List stock movements
openApiInventoryRouter.openapi(InventoryRoutes.movements.list, async (c) => {
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
openApiInventoryRouter.openapi(InventoryRoutes.movements.create, async (c) => {
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

// ============ SUPPLIERS ROUTES ============

// GET /api/inventory/suppliers - List suppliers
openApiInventoryRouter.openapi(InventoryRoutes.suppliers.list, async (c) => {
  const db = c.env.DB;
  const query = c.req.valid('query');

  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params: (string | number)[] = [];

  if (query.search) {
    whereClause += 'WHERE (name LIKE ? OR contact_person LIKE ? OR email LIKE ?) ';
    params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`);
  }

  if (query.isActive !== undefined) {
    whereClause += whereClause ? 'AND is_active = ? ' : 'WHERE is_active = ? ';
    params.push(query.isActive ? 1 : 0);
  }

  const countResult = await db.prepare(`SELECT COUNT(*) as total FROM suppliers ${whereClause}`).bind(...params).first();
  const total = countResult?.total || 0;

  const items = await db.prepare(
    `SELECT * FROM suppliers ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({
    success: true,
    data: items.results,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/inventory/suppliers/{id} - Get supplier by ID
openApiInventoryRouter.openapi(InventoryRoutes.suppliers.get, async (c) => {
  const db = c.env.DB;
  const { id } = c.req.valid('param');

  const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();

  if (!supplier) {
    return c.json({ success: false, error: 'Supplier not found' }, 404);
  }

  return c.json({ success: true, data: supplier });
});

// POST /api/inventory/suppliers - Create supplier
openApiInventoryRouter.openapi(InventoryRoutes.suppliers.create, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const id = `sup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await db.prepare(
    `INSERT INTO suppliers (id, name, contact_person, phone, email, address, payment_terms, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.name,
    body.contactPerson || null,
    body.phone || null,
    body.email || null,
    body.address || null,
    body.paymentTerms || 30,
    body.isActive !== false ? 1 : 0,
    now,
    now
  ).run();

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'supplier_create', 'supplier', id, JSON.stringify(body), now).run();

  const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: supplier }, 201);
});

// PATCH /api/inventory/suppliers/{id} - Update supplier
openApiInventoryRouter.openapi(InventoryRoutes.suppliers.update, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const existing = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: 'Supplier not found' }, 404);
  }

  const updates: string[] = [];
  const params: (string | number | boolean)[] = [];

  if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
  if (body.contactPerson !== undefined) { updates.push('contact_person = ?'); params.push(body.contactPerson); }
  if (body.phone !== undefined) { updates.push('phone = ?'); params.push(body.phone); }
  if (body.email !== undefined) { updates.push('email = ?'); params.push(body.email); }
  if (body.address !== undefined) { updates.push('address = ?'); params.push(body.address); }
  if (body.paymentTerms !== undefined) { updates.push('payment_terms = ?'); params.push(body.paymentTerms); }
  if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }

  if (updates.length === 0) {
    return c.json({ success: true, data: existing });
  }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  await db.prepare(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'supplier_update', 'supplier', id, JSON.stringify(body), now).run();

  const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: supplier });
});

// ============ PURCHASE ORDERS ROUTES ============

// GET /api/inventory/purchase-orders - List purchase orders
openApiInventoryRouter.openapi(InventoryRoutes.purchaseOrders.list, async (c) => {
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
openApiInventoryRouter.openapi(InventoryRoutes.purchaseOrders.get, async (c) => {
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
openApiInventoryRouter.openapi(InventoryRoutes.purchaseOrders.create, async (c) => {
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
openApiInventoryRouter.openapi(InventoryRoutes.purchaseOrders.update, async (c) => {
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
openApiInventoryRouter.openapi(InventoryRoutes.purchaseOrders.receive, async (c) => {
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

export default openApiInventoryRouter;
