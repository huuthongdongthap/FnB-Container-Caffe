import { Hono } from 'hono';
import type { Context } from 'hono';
import { createCategorySchema, updateCategorySchema } from '../lib/validators';
import type { Env } from '../types/env';

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  image_url: string | null;
}

export const categoriesRouter = new Hono();

categoriesRouter.get('/', async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { results } = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
  return c.json({ success: true, data: results });
});

categoriesRouter.get('/:id', async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(c.req.param('id')).first();
  if (!row) return c.json({ success: false, error: 'Category not found' }, 404);
  return c.json({ success: true, data: row });
});

categoriesRouter.post('/', async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const data = parsed.data;
  const id = 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await db.prepare(
    'INSERT INTO categories (id, name, slug, sort_order, image_url) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, data.name, data.slug || '', data.sort_order || 0, data.image_url || '').run();
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row }, 201);
});

categoriesRouter.put('/:id', async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const id = c.req.param('id');
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const data = parsed.data;
  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ success: false, error: 'Category not found' }, 404);
  await db.prepare(
    'UPDATE categories SET name=?, slug=?, sort_order=?, image_url=? WHERE id=?'
  ).bind(data.name ?? existing.name, data.slug ?? existing.slug, data.sort_order ?? existing.sort_order, data.image_url ?? existing.image_url, id).run();
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row });
});

categoriesRouter.delete('/:id', async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ success: false, error: 'Category not found' }, 404);
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: 'Category deleted' });
});
