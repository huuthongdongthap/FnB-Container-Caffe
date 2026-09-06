import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/auth';
import { audit } from '../middleware/audit-log';
import type { Env } from '../types/env';
import {
  CategoryRoutes,
  CategoryCreateSchema,
  CategoryUpdateSchema,
  CategoryReorderSchema,
  CategoryTreeQuerySchema,
  CategoryListResponseSchema,
  CategoryResponseSchema,
  CategoryTreeResponseSchema,
  IdParamsSchema,
} from '../schemas/categories';
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
} from '../schemas/common';

export const openApiCategoriesRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiCategoriesRouter.use('*', requireAuth(['owner', 'manager', 'staff']));

// GET /api/categories - List categories with pagination and tree support
openApiCategoriesRouter.openapi(CategoryRoutes.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid('query');
  const { page = 1, limit = 20, sort = 'sort_order', order = 'asc', search, parentId, isActive, locale = 'vi' } = query;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (search) {
    whereClause += ' AND (c.name LIKE ? OR c.slug LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (parentId) {
    whereClause += ' AND c.parent_id = ?';
    params.push(parentId);
  } else if (parentId === null) {
    whereClause += ' AND c.parent_id IS NULL';
  }
  if (isActive !== undefined) {
    whereClause += ' AND c.is_active = ?';
    params.push(isActive ? 1 : 0);
  }

  // Get total count
  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM categories c ${whereClause}`
  ).bind(...params).first();
  const total = countResult?.total || 0;

  // Get categories with translations
  const offset = (page - 1) * limit;
  const orderClause = `${sort} ${order.toUpperCase()}`;
  const rows = await db.prepare(
    `SELECT c.*, ct.name as translation_name, ct.description as translation_description
     FROM categories c
     LEFT JOIN category_translations ct ON c.id = ct.category_id AND ct.locale = ?
     ${whereClause}
     ORDER BY ${orderClause}
     LIMIT ? OFFSET ?`
  ).bind(locale, ...params, limit, offset).all();

  // Build tree structure if requested (flat list for now, tree in separate endpoint)
  const categories = rows.results.map((row) => ({
    ...row,
    translations: row.translation_name ? [{
      locale,
      name: row.translation_name,
      description: row.translation_description,
    }] : [],
    parent_id: row.parent_id,
    children: [],
    location: row.location_id ? { id: row.location_id } : null,
  }));

  return c.json({
    success: true,
    data: { categories, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /api/categories/tree - Get category tree
openApiCategoriesRouter.openapi(CategoryRoutes.tree, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid('query');
  const { locale = 'vi', locationId, includeInactive } = query;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [locale];

  if (locationId) {
    whereClause += ' AND c.location_id = ?';
    params.push(locationId);
  }
  if (!includeInactive) {
    whereClause += ' AND c.is_active = 1';
  }

  const rows = await db.prepare(
    `SELECT c.*, ct.name as translation_name, ct.description as translation_description
     FROM categories c
     LEFT JOIN category_translations ct ON c.id = ct.category_id AND ct.locale = ?
     ${whereClause}
     ORDER BY c.sort_order ASC, c.name ASC`
  ).bind(...params).all();

  // Build tree
  const categoryMap = new Map();
  const roots = [];

  for (const row of rows.results) {
    const cat = {
      ...row,
      translations: row.translation_name ? [{
        locale,
        name: row.translation_name,
        description: row.translation_description,
      }] : [],
      parent_id: row.parent_id,
      children: [],
      location: row.location_id ? { id: row.location_id } : null,
    };
    categoryMap.set(row.id, cat);
  }

  for (const cat of categoryMap.values()) {
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      categoryMap.get(cat.parent_id).children.push(cat);
    } else {
      roots.push(cat);
    }
  }

  return c.json({
    success: true,
    data: roots,
  });
});

// GET /api/categories/:id - Get category by ID
openApiCategoriesRouter.openapi(CategoryRoutes.get, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid('param');
  const locale = c.req.query('locale') || 'vi';

  const row = await db.prepare(
    `SELECT c.*, ct.name as translation_name, ct.description as translation_description
     FROM categories c
     LEFT JOIN category_translations ct ON c.id = ct.category_id AND ct.locale = ?
     WHERE c.id = ?`
  ).bind(locale, id).first();

  if (!row) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }

  return c.json({
    success: true,
    data: {
      ...row,
      translations: row.translation_name ? [{
        locale,
        name: row.translation_name,
        description: row.translation_description,
      }] : [],
      parent_id: row.parent_id,
      location: row.location_id ? { id: row.location_id } : null,
    },
  });
});

// POST /api/categories - Create category
openApiCategoriesRouter.openapi(CategoryRoutes.create, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid('json');
  const user = c.get('user');

  const id = `cat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO categories (id, name, slug, description, parent_id, sort_order, image_url, is_active, location_id, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.name,
    body.slug || '',
    body.description || null,
    body.parentId || null,
    body.sortOrder || 0,
    body.imageUrl || null,
    body.isActive !== false ? 1 : 0,
    body.locationIds?.[0] || null,
    JSON.stringify(body.metadata || {}),
    now,
    now
  ).run();

  // Insert translations if provided
  if (body.translations?.length) {
    for (const t of body.translations) {
      await db.prepare(
        'INSERT INTO category_translations (category_id, locale, name, description) VALUES (?, ?, ?, ?)'
      ).bind(id, t.locale, t.name, t.description || '').run();
    }
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'category_create', 'category', id, JSON.stringify(body), now).run();

  const created = await db.prepare(
    `SELECT c.*, ct.name as translation_name, ct.description as translation_description
     FROM categories c
     LEFT JOIN category_translations ct ON c.id = ct.category_id AND ct.locale = ?
     WHERE c.id = ?`
  ).bind('vi', id).first();

  return c.json({ success: true, data: created }, 201);
});

// PATCH /api/categories/:id - Update category
openApiCategoriesRouter.openapi(CategoryRoutes.update, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const user = c.get('user');
  const now = new Date().toISOString();

  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
  if (body.slug !== undefined) { updates.push('slug = ?'); params.push(body.slug); }
  if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
  if (body.parentId !== undefined) { updates.push('parent_id = ?'); params.push(body.parentId); }
  if (body.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(body.sortOrder); }
  if (body.imageUrl !== undefined) { updates.push('image_url = ?'); params.push(body.imageUrl); }
  if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }
  if (body.locationIds !== undefined) { updates.push('location_id = ?'); params.push(body.locationIds[0] || null); }
  if (body.metadata !== undefined) { updates.push('metadata = ?'); params.push(JSON.stringify(body.metadata)); }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  if (updates.length > 1) {
    await db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  // Update translations
  if (body.translations?.length) {
    for (const t of body.translations) {
      await db.prepare(
        `INSERT INTO category_translations (category_id, locale, name, description)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(category_id, locale) DO UPDATE SET name = ?, description = ?`
      ).bind(id, t.locale, t.name, t.description || '', t.name, t.description || '').run();
    }
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'category_update', 'category', id, JSON.stringify(body), now).run();

  const updated = await db.prepare(
    `SELECT c.*, ct.name as translation_name, ct.description as translation_description
     FROM categories c
     LEFT JOIN category_translations ct ON c.id = ct.category_id AND ct.locale = ?
     WHERE c.id = ?`
  ).bind('vi', id).first();

  return c.json({ success: true, data: updated });
});

// DELETE /api/categories/:id - Delete category
openApiCategoriesRouter.openapi(CategoryRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid('param');
  const user = c.get('user');
  const now = new Date().toISOString();

  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }

  // Check for children
  const children = await db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').bind(id).first();
  if (children && children.count > 0) {
    return c.json({ success: false, error: 'Cannot delete category with children' }, 409);
  }

  // Check for products
  const products = await db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').bind(id).first();
  if (products && products.count > 0) {
    return c.json({ success: false, error: 'Cannot delete category with products' }, 409);
  }

  await db.prepare('DELETE FROM category_translations WHERE category_id = ?').bind(id).run();
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'category_delete', 'category', id, JSON.stringify({ name: existing.name }), now).run();

  return c.json({ success: true, data: { success: true } });
});

// POST /api/categories/reorder - Reorder categories
openApiCategoriesRouter.openapi(CategoryRoutes.reorder, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid('json');
  const user = c.get('user');
  const now = new Date().toISOString();

  const { items } = body;

  for (const item of items) {
    await db.prepare(
      'UPDATE categories SET sort_order = ?, parent_id = ?, updated_at = ? WHERE id = ?'
    ).bind(item.sortOrder, item.parentId || null, now, item.id).run();
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'category_reorder', 'category', 'multiple', JSON.stringify({ items }), now).run();

  return c.json({ success: true, data: { success: true } });
});

export default openApiCategoriesRouter;
