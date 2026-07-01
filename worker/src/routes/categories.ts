import { Hono } from 'hono';

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  image_url: string | null;
}

export const categoriesRouter = new Hono();

categoriesRouter.get('/', async (c: any) => {
  const db = c.env.AURA_DB;
  const { results } = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
  return c.json({ success: true, data: results });
});

categoriesRouter.get('/:id', async (c: any) => {
  const db = c.env.AURA_DB;
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(c.req.param('id')).first();
  if (!row) return c.json({ success: false, error: 'Category not found' }, 404);
  return c.json({ success: true, data: row });
});

categoriesRouter.post('/', async (c: any) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const id = 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await db.prepare(
    'INSERT INTO categories (id, name, slug, sort_order, image_url) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, body.name, body.slug || '', body.sort_order || 0, body.image_url || '').run();
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row }, 201);
});

categoriesRouter.put('/:id', async (c: any) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ success: false, error: 'Category not found' }, 404);
  await db.prepare(
    'UPDATE categories SET name=?, slug=?, sort_order=?, image_url=? WHERE id=?'
  ).bind(body.name ?? existing.name, body.slug ?? existing.slug, body.sort_order ?? existing.sort_order, body.image_url ?? existing.image_url, id).run();
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row });
});

categoriesRouter.delete('/:id', async (c: any) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ success: false, error: 'Category not found' }, 404);
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: 'Category deleted' });
});
