/**
 * Categories Routes — /api/categories
 */

import { Hono } from 'hono';

export const categoriesRouter = new Hono();

// GET /api/categories
categoriesRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const { results } = await db.prepare(
    'SELECT * FROM categories ORDER BY name ASC'
  ).all();
  return c.json({ success: true, data: results });
});

// GET /api/categories/:id
categoriesRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const row = await db.prepare(
    'SELECT * FROM categories WHERE id = ?'
  ).bind(id).first();
  if (!row) return c.json({ success: false, error: 'Category not found' }, 404);
  return c.json({ success: true, data: row });
});
