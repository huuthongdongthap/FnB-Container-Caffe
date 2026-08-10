import { Hono } from 'hono';
import type { Context } from 'hono';
import { createProductSchema, updateProductSchema, zodErrorResponse } from '../lib/validators';
import type { Env } from '../types/env';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  category_id: string;
  image_url: string;
  is_available: number;
  sort_order: number;
  category_name?: string;
}

export const productsRouter = new Hono();

productsRouter.get('/', async(c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const category = c.req.query('category');
  const available = c.req.query('available');
  let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1';
  const params: string[] = [];
  if (category) {
    query += ' AND p.category_id = ?'; params.push(category);
  }
  if (available === '1') {
    query += ' AND p.is_available = 1';
  }
  query += ' ORDER BY c.sort_order ASC, p.name ASC';
  const stmt = params.length ? db.prepare(query).bind(...params) : db.prepare(query);
  const { results } = await stmt.all();
  return c.json({ success: true, data: results });
});

productsRouter.get('/:id', async(c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const row = await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?').bind(c.req.param('id')).first();
  if (!row) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

productsRouter.post('/', async(c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;
  const id = `prod_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare(
    'INSERT INTO products (id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, data.name, data.slug || '', data.description || '', data.price, data.compare_at_price ?? null, data.category_id, data.image_url || '', data.is_available !== false ? 1 : 0, data.sort_order || 0).run();
  const row = await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?').bind(id).first();
  return c.json({ success: true, data: row }, 201);
});

productsRouter.put('/:id', async(c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const id = c.req.param('id');
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;
  const existing = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  await db.prepare(
    'UPDATE products SET name=?, slug=?, description=?, price=?, compare_at_price=?, category_id=?, image_url=?, is_available=?, sort_order=? WHERE id=?'
  ).bind(data.name ?? existing.name, data.slug ?? existing.slug, data.description ?? existing.description, data.price ?? existing.price, data.compare_at_price ?? existing.compare_at_price, data.category_id ?? existing.category_id, data.image_url ?? existing.image_url, data.is_available !== undefined ? (data.is_available ? 1 : 0) : existing.is_available, data.sort_order ?? existing.sort_order, id).run();
  const row = await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?').bind(id).first();
  return c.json({ success: true, data: row });
});

productsRouter.delete('/:id', async(c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: 'Product deleted' });
});
