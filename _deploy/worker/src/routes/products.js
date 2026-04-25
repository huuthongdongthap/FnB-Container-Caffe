/**
 * Products Routes — /api/products
 */

import { Hono } from 'hono';

export const productsRouter = new Hono();

// GET /api/products?category_id=&available=1
productsRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const categoryId = c.req.query('category_id');
  const available = c.req.query('available');

  let query = `
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (categoryId) {
    query += ' AND p.category_id = ?';
    params.push(categoryId);
  }
  if (available !== undefined && available !== null) {
    query += ' AND p.is_available = ?';
    params.push(available === '0' ? 0 : 1);
  }
  query += ' ORDER BY c.name ASC, p.name ASC';

  const stmt = params.length
    ? db.prepare(query).bind(...params)
    : db.prepare(query);

  const { results } = await stmt.all();
  return c.json({ success: true, data: results });
});

// GET /api/products/:id
productsRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const row = await db.prepare(`
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).bind(id).first();
  if (!row) {return c.json({ success: false, error: 'Product not found' }, 404);}
  return c.json({ success: true, data: row });
});
