/**
 * Category Commands — /api/categories
 * Hono CRUD over the categories table. Zod validation stays in
 * worker/src/lib/validators (shared HTTP contract); the Category
 * row shape lives in the domain model.
 */

import { Hono } from 'hono';
import { createCategorySchema, updateCategorySchema } from 'worker/src/lib/validators';
import type { Env } from 'worker/src/types/env';
import type { Category } from '../model/catalog-types';

export const categoriesRouter = new Hono<{ Bindings: Env }>();

categoriesRouter.get('/', async(c) => {
  const db = c.env.AURA_DB;
  const { results } = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all<Category>();
  return c.json({ success: true, data: results });
});

categoriesRouter.get('/:id', async(c) => {
  const db = c.env.AURA_DB;
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(c.req.param('id')).first<Category>();
  if (!row) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

categoriesRouter.post('/', async(c) => {
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

categoriesRouter.put('/:id', async(c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const id = c.req.param('id');
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }, 400);
  }
  const data = parsed.data;
  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<Category>();
  if (!existing) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  await db.prepare(
    'UPDATE categories SET name=?, slug=?, sort_order=?, image_url=? WHERE id=?'
  ).bind(data.name ?? existing.name, data.slug ?? existing.slug, data.sort_order ?? existing.sort_order, data.image_url ?? existing.image_url, id).run();
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<Category>();
  return c.json({ success: true, data: row });
});

categoriesRouter.delete('/:id', async(c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<Category>();
  if (!existing) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: 'Category deleted' });
});
