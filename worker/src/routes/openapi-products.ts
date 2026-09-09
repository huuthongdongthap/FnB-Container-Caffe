import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types/env';
import { ProductRoutes } from '../schemas/products';

export const openApiProductsRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiProductsRouter.use('*', requireAuth(['owner', 'manager', 'staff']));

// GET /api/products - List products with pagination, filtering, and search
openApiProductsRouter.openapi(ProductRoutes.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid('query');
  const { page = 1, limit = 20, sort = 'name', order = 'asc', search, categoryId, status, locale = 'vi', minPrice, maxPrice, tags } = query;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (search) {
    whereClause += ' AND (p.name LIKE ? OR p.slug LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (categoryId) {
    whereClause += ' AND p.category_id = ?';
    params.push(categoryId);
  }
  if (status) {
    whereClause += ' AND p.status = ?';
    params.push(status);
  }
  if (minPrice !== undefined) {
    whereClause += ' AND p.base_price >= ?';
    params.push(minPrice);
  }
  if (maxPrice !== undefined) {
    whereClause += ' AND p.base_price <= ?';
    params.push(maxPrice);
  }
  if (tags) {
    whereClause += ' AND p.tags LIKE ?';
    params.push(`%${tags}%`);
  }

  // Get total count
  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM products p ${whereClause}`
  ).bind(...params).first();
  const total = countResult?.total || 0;

  // Get products with translations
  const offset = (page - 1) * limit;
  const orderClause = `${sort} ${order.toUpperCase()}`;
  const rows = await db.prepare(
    `SELECT p.*, pt.name as translation_name, pt.description as translation_description, pt.ingredients as translation_ingredients, pt.allergens as translation_allergens, pt.story as translation_story
     FROM products p
     LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.locale = ?
     ${whereClause}
     ORDER BY ${orderClause}
     LIMIT ? OFFSET ?`
  ).bind(locale, ...params, limit, offset).all();

  const products = rows.results.map((row) => ({
    ...row,
    translations: row.translation_name ? [{
      locale,
      name: row.translation_name,
      description: row.translation_description,
      ingredients: row.translation_ingredients,
      allergens: row.translation_allergens ? JSON.parse(row.translation_allergens) : [],
      story: row.translation_story,
    }] : [],
    category: row.category_id ? { id: row.category_id } : null,
    variants: row.variants ? JSON.parse(row.variants) : [],
    modifiers: row.modifiers ? JSON.parse(row.modifiers) : [],
    images: row.images ? JSON.parse(row.images) : [],
    nutritionInfo: row.nutrition_info ? JSON.parse(row.nutrition_info) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    tags: row.tags ? JSON.parse(row.tags) : [],
  }));

  return c.json({
    success: true,
    data: { products, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /api/products/:id - Get product by ID
openApiProductsRouter.openapi(ProductRoutes.get, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid('param');
  const locale = c.req.query('locale') || 'vi';

  const row = await db.prepare(
    `SELECT p.*, pt.name as translation_name, pt.description as translation_description, pt.ingredients as translation_ingredients, pt.allergens as translation_allergens, pt.story as translation_story
     FROM products p
     LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.locale = ?
     WHERE p.id = ?`
  ).bind(locale, id).first();

  if (!row) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }

  return c.json({
    success: true,
    data: {
      ...row,
      translations: row.translation_name ? [{
        locale,
        name: row.translation_name,
        description: row.translation_description,
        ingredients: row.translation_ingredients,
        allergens: row.translation_allergens ? JSON.parse(row.translation_allergens) : [],
        story: row.translation_story,
      }] : [],
      category: row.category_id ? { id: row.category_id } : null,
      variants: row.variants ? JSON.parse(row.variants) : [],
      modifiers: row.modifiers ? JSON.parse(row.modifiers) : [],
      images: row.images ? JSON.parse(row.images) : [],
      nutritionInfo: row.nutrition_info ? JSON.parse(row.nutrition_info) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      tags: row.tags ? JSON.parse(row.tags) : [],
    },
  });
});

// GET /api/products/slug/:slug - Get product by slug
openApiProductsRouter.openapi(ProductRoutes.getBySlug, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { slug } = c.req.valid('param');
  const locale = c.req.query('locale') || 'vi';

  const row = await db.prepare(
    `SELECT p.*, pt.name as translation_name, pt.description as translation_description, pt.ingredients as translation_ingredients, pt.allergens as translation_allergens, pt.story as translation_story
     FROM products p
     LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.locale = ?
     WHERE p.slug = ?`
  ).bind(locale, slug).first();

  if (!row) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }

  return c.json({
    success: true,
    data: {
      ...row,
      translations: row.translation_name ? [{
        locale,
        name: row.translation_name,
        description: row.translation_description,
        ingredients: row.translation_ingredients,
        allergens: row.translation_allergens ? JSON.parse(row.translation_allergens) : [],
        story: row.translation_story,
      }] : [],
      category: row.category_id ? { id: row.category_id } : null,
      variants: row.variants ? JSON.parse(row.variants) : [],
      modifiers: row.modifiers ? JSON.parse(row.modifiers) : [],
      images: row.images ? JSON.parse(row.images) : [],
      nutritionInfo: row.nutrition_info ? JSON.parse(row.nutrition_info) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      tags: row.tags ? JSON.parse(row.tags) : [],
    },
  });
});

// POST /api/products - Create product
openApiProductsRouter.openapi(ProductRoutes.create, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid('json');
  const user = c.get('user');
  const now = new Date().toISOString();

  const id = crypto.randomUUID();

  // Check slug uniqueness
  const existing = await db.prepare('SELECT id FROM products WHERE slug = ?').bind(body.slug).first();
  if (existing) {
    return c.json({ success: false, error: 'Slug already exists' }, 409);
  }

  await db.prepare(
    `INSERT INTO products (id, slug, category_id, base_price, status, variants, modifiers, images, preparation_time_minutes, calories, nutrition_info, tags, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.slug,
    body.categoryId,
    body.basePrice,
    body.status || 'active',
    JSON.stringify(body.variants || []),
    JSON.stringify(body.modifiers || []),
    JSON.stringify(body.images || []),
    body.preparationTimeMinutes || 5,
    body.calories || null,
    JSON.stringify(body.nutritionInfo || {}),
    JSON.stringify(body.tags || []),
    JSON.stringify(body.metadata || {}),
    now,
    now
  ).run();

  // Insert translations
  if (body.translations?.length) {
    for (const t of body.translations) {
      await db.prepare(
        'INSERT INTO product_translations (product_id, locale, name, description, ingredients, allergens, story) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, t.locale, t.name, t.description || '', t.ingredients || '', JSON.stringify(t.allergens || []), t.story || '').run();
    }
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'product_create', 'product', id, JSON.stringify(body), now).run();

  const created = await db.prepare(
    `SELECT p.*, pt.name as translation_name, pt.description as translation_description, pt.ingredients as translation_ingredients, pt.allergens as translation_allergens, pt.story as translation_story
     FROM products p
     LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.locale = ?
     WHERE p.id = ?`
  ).bind('vi', id).first();

  return c.json({ success: true, data: created }, 201);
});

// PATCH /api/products/:id - Update product
openApiProductsRouter.openapi(ProductRoutes.update, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const user = c.get('user');
  const now = new Date().toISOString();

  const existing = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (body.slug !== undefined) {
    const slugExists = await db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').bind(body.slug, id).first();
    if (slugExists) {
      return c.json({ success: false, error: 'Slug already exists' }, 409);
    }
    updates.push('slug = ?');
    params.push(body.slug);
  }
  if (body.categoryId !== undefined) { updates.push('category_id = ?'); params.push(body.categoryId); }
  if (body.basePrice !== undefined) { updates.push('base_price = ?'); params.push(body.basePrice); }
  if (body.status !== undefined) { updates.push('status = ?'); params.push(body.status); }
  if (body.variants !== undefined) { updates.push('variants = ?'); params.push(JSON.stringify(body.variants)); }
  if (body.modifiers !== undefined) { updates.push('modifiers = ?'); params.push(JSON.stringify(body.modifiers)); }
  if (body.images !== undefined) { updates.push('images = ?'); params.push(JSON.stringify(body.images)); }
  if (body.preparationTimeMinutes !== undefined) { updates.push('preparation_time_minutes = ?'); params.push(body.preparationTimeMinutes); }
  if (body.calories !== undefined) { updates.push('calories = ?'); params.push(body.calories); }
  if (body.nutritionInfo !== undefined) { updates.push('nutrition_info = ?'); params.push(JSON.stringify(body.nutritionInfo)); }
  if (body.tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(body.tags)); }
  if (body.metadata !== undefined) { updates.push('metadata = ?'); params.push(JSON.stringify(body.metadata)); }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  if (updates.length > 1) {
    await db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  // Update translations
  if (body.translations?.length) {
    for (const t of body.translations) {
      await db.prepare(
        `INSERT INTO product_translations (product_id, locale, name, description, ingredients, allergens, story)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(product_id, locale) DO UPDATE SET name = ?, description = ?, ingredients = ?, allergens = ?, story = ?`
      ).bind(id, t.locale, t.name, t.description || '', t.ingredients || '', JSON.stringify(t.allergens || []), t.story || '', t.name, t.description || '', t.ingredients || '', JSON.stringify(t.allergens || []), t.story || '').run();
    }
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'product_update', 'product', id, JSON.stringify(body), now).run();

  const updated = await db.prepare(
    `SELECT p.*, pt.name as translation_name, pt.description as translation_description, pt.ingredients as translation_ingredients, pt.allergens as translation_allergens, pt.story as translation_story
     FROM products p
     LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.locale = ?
     WHERE p.id = ?`
  ).bind('vi', id).first();

  return c.json({ success: true, data: updated });
});

// DELETE /api/products/:id - Delete product (soft delete)
openApiProductsRouter.openapi(ProductRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid('param');
  const user = c.get('user');
  const now = new Date().toISOString();

  const existing = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }

  // Check for order items referencing this product
  const orderItems = await db.prepare('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?').bind(id).first();
  if (orderItems && orderItems.count > 0) {
    // Soft delete - just mark as deleted
    await db.prepare('UPDATE products SET status = \'deleted\', updated_at = ? WHERE id = ?').bind(now, id).run();
  } else {
    // Hard delete if no order items
    await db.prepare('DELETE FROM product_translations WHERE product_id = ?').bind(id).run();
    await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'product_delete', 'product', id, JSON.stringify({ name: existing.slug }), now).run();

  return c.json({ success: true, data: { success: true } });
});

export default openApiProductsRouter;
