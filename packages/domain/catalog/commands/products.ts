/**
 * Product Commands — /api/products
 * Single Authoritative Runtime Owner for /api/products.
 * Enforces strict route precedence: static literal routes precede parameterized paths.
 * Hono CRUD over the products table. Zod validation stays in
 * worker/src/lib/validators (shared HTTP contract); the Product
 * row shape lives in the domain model.
 */

import { Hono } from 'hono';
import { createProductSchema, updateProductSchema, zodErrorResponse } from 'worker/src/lib/validators';
import { requireAuth } from 'worker/src/middleware/auth';
import { audit } from 'worker/src/middleware/audit-log';
import type { Env } from 'worker/src/types/env';
import type { Product } from '../model/catalog-types';
import {
  syncProductToMenuProjection,
  syncProductAvailabilityProjection,
  deleteProductProjection,
} from '../policies/menu-projection';

export const productsRouter = new Hono<{ Bindings: Env }>();
const staffAuth = requireAuth(['owner', 'manager', 'staff']);

// ── 1. Static / Literal Prefix Routes (MUST PRECEDENCE OVER /:id) ──
productsRouter.get('/slug/:slug', async (c) => {
  const db = c.env.AURA_DB;
  const slug = c.req.param('slug');
  const row = (await db.prepare(
    'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ?'
  ).bind(slug).first()) as Product | null;
  if (!row) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

// ── 2. Base Collection Routes ──
productsRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const category = c.req.query('category') || c.req.query('categoryId');
  const available = c.req.query('available');
  const status = c.req.query('status');
  const search = c.req.query('search');
  const minPrice = c.req.query('minPrice');
  const maxPrice = c.req.query('maxPrice');
  const tags = c.req.query('tags');

  let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1';
  const params: (string | number)[] = [];
  if (category) {
    query += ' AND p.category_id = ?'; params.push(category);
  }
  if (available === '1' || status === 'active') {
    query += ' AND p.is_available = 1';
  } else if (available === '0' || status === 'inactive') {
    query += ' AND p.is_available = 0';
  }
  if (search) {
    query += ' AND (p.name LIKE ? OR p.slug LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (minPrice !== undefined && minPrice !== '') {
    query += ' AND p.price >= ?';
    params.push(Number(minPrice));
  }
  if (maxPrice !== undefined && maxPrice !== '') {
    query += ' AND p.price <= ?';
    params.push(Number(maxPrice));
  }
  if (tags) {
    query += ' AND p.tags LIKE ?';
    params.push(`%${tags}%`);
  }

  query += ' ORDER BY c.sort_order ASC, p.name ASC';
  const stmt = params.length ? db.prepare(query).bind(...params) : db.prepare(query);
  const { results } = await stmt.all<Product>();
  return c.json({ success: true, data: results });
});

productsRouter.post('/', staffAuth, audit('product_create'), async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;
  if (data.slug) {
    const existingSlug = await db.prepare('SELECT id FROM products WHERE slug = ?').bind(data.slug).first();
    if (existingSlug) {
      return c.json({ success: false, error: 'Slug already exists' }, 409);
    }
  }
  const id = `prod_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare(
    'INSERT INTO products (id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, data.name, data.slug || '', data.description || '', data.price, data.compare_at_price ?? null, data.category_id || '', data.image_url || '', data.is_available !== false ? 1 : 0, data.sort_order || 0).run();
  await syncProductToMenuProjection(db, id);
  const row = (await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?').bind(id).first()) as Product | null;
  return c.json({ success: true, data: row }, 201);
});

// ── 3. Parameterized Record Routes (/:id) ──
productsRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const row = (await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?').bind(c.req.param('id')).first()) as Product | null;
  if (!row) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

const handleUpdateProduct = async (c: any) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const id = c.req.param('id');
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;
  const existing = (await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()) as Product | null;
  if (!existing) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  await db.prepare(
    'UPDATE products SET name=?, slug=?, description=?, price=?, compare_at_price=?, category_id=?, image_url=?, is_available=?, sort_order=? WHERE id=?'
  ).bind(data.name ?? existing.name, data.slug ?? existing.slug, data.description ?? existing.description, data.price ?? existing.price, data.compare_at_price ?? existing.compare_at_price, data.category_id ?? existing.category_id, data.image_url ?? existing.image_url, data.is_available !== undefined ? (data.is_available ? 1 : 0) : existing.is_available, data.sort_order ?? existing.sort_order, id).run();
  await syncProductToMenuProjection(db, id);
  const row = (await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?').bind(id).first()) as Product | null;
  return c.json({ success: true, data: row });
};

productsRouter.put('/:id', staffAuth, audit('product_update'), handleUpdateProduct);
productsRouter.patch('/:id', staffAuth, audit('product_update'), handleUpdateProduct);

productsRouter.delete('/:id', staffAuth, audit('product_delete'), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const existing = (await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()) as Product | null;
  if (!existing) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  const orderItems = (await db.prepare('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?').bind(id).first()) as { count: number } | null;
  if (orderItems && orderItems.count > 0) {
    await db.prepare("UPDATE products SET is_available = 0, updated_at = datetime('now') WHERE id = ?").bind(id).run();
    await syncProductAvailabilityProjection(db, id, 0);
  } else {
    await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
    await deleteProductProjection(db, id);
  }
  return c.json({ success: true, message: 'Product deleted' });
});
