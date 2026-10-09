/**
 * Category Commands — /api/categories
 * Single Authoritative Runtime Owner for /api/categories.
 * Enforces strict route precedence: static literal routes precede parameterized paths.
 * Hono CRUD over the categories table. Zod validation stays in
 * worker/src/lib/validators (shared HTTP contract); the Category
 * row shape lives in the domain model.
 */

import { Hono } from 'hono';
import { createCategorySchema, updateCategorySchema } from 'worker/src/lib/validators';
import { requireAuth } from 'worker/src/middleware/auth';
import type { Env } from 'worker/src/types/env';
import type { Category } from '../model/catalog-types';
import { syncCategorySlugToMenuProjection } from '../policies/menu-projection';

export const categoriesRouter = new Hono<{ Bindings: Env }>();
const staffAuth = requireAuth(['owner', 'manager', 'staff']);

// ── 1. Static Literal Routes (MUST PRECEDENCE OVER /:id) ──
categoriesRouter.get('/tree', async (c) => {
  const db = c.env.AURA_DB;
  const { results } = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all<Category>();
  return c.json({ success: true, data: results || [], categories: results || [] });
});

categoriesRouter.post('/reorder', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
  const body = (await c.req.json()) as { items?: Array<{ id: string; sort_order?: number; sortOrder?: number; displayOrder?: number }> };
  const items = Array.isArray(body?.items) ? body.items : [];
  for (const item of items) {
    const sortOrder = item.sort_order ?? item.sortOrder ?? item.displayOrder ?? 0;
    await db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').bind(sortOrder, item.id).run();
  }
  return c.json({ success: true, data: { success: true } });
});

// ── 2. Base Collection Routes ──
categoriesRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const { results } = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all<Category>();
  return c.json({ success: true, data: results || [] });
});

categoriesRouter.post('/', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }, 400);
  }
  const data = parsed.data;
  const id = `cat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare(
    'INSERT INTO categories (id, name, slug, sort_order, image_url) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, data.name, data.slug || '', data.sort_order || 0, data.image_url || '').run();
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<Category>();
  return c.json({ success: true, data: row }, 201);
});

// ── 3. Parameterized Record Routes (/:id) ──
categoriesRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(c.req.param('id')).first<Category>();
  if (!row) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

const handleUpdateCategory = async (c: any) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const id = c.req.param('id');
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }, 400);
  }
  const data = parsed.data;
  const existing = (await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first()) as Category | null;
  if (!existing) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  await db.prepare(
    'UPDATE categories SET name=?, slug=?, sort_order=?, image_url=? WHERE id=?'
  ).bind(data.name ?? existing.name, data.slug ?? existing.slug, data.sort_order ?? existing.sort_order, data.image_url ?? existing.image_url, id).run();
  if (data.slug && data.slug !== existing.slug) {
    await syncCategorySlugToMenuProjection(db, id, data.slug);
  }
  const row = (await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first()) as Category | null;
  return c.json({ success: true, data: row });
};

categoriesRouter.put('/:id', staffAuth, handleUpdateCategory);
categoriesRouter.patch('/:id', staffAuth, handleUpdateCategory);

categoriesRouter.delete('/:id', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<Category>();
  if (!existing) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  const prodCount = (await db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').bind(id).first()) as { count: number } | null;
  if (prodCount && prodCount.count > 0) {
    return c.json({ success: false, error: 'Cannot delete category with products' }, 409);
  }
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: 'Category deleted' });
});
