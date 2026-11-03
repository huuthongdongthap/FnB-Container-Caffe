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
import { optionalAuth, requireAuth } from 'worker/src/middleware/auth';
import { audit } from 'worker/src/middleware/audit-log';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
import { resolvePublicTenantId } from 'worker/src/middleware/tenant';
import type { Env } from 'worker/src/types/env';
import type { Product } from '../model/catalog-types';
import {
  syncProductToMenuProjection,
  syncProductAvailabilityProjection,
  deleteProductProjection,
} from '../policies/menu-projection';

export const productsRouter = new Hono<{ Bindings: Env }>();
productsRouter.use('*', async (c, next) => {
  if (!c.get('user' as never) && c.req.header('Authorization')) {
    return optionalAuth()(c, next);
  }
  await next();
});
const staffAuth = requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']);

async function findSlugMatchForTenant(
  db: Env['AURA_DB'],
  sql: string,
  slug: string,
  tenantId: string,
  excludeId?: string
): Promise<Product | null> {
  const stmt = excludeId !== undefined ? db.prepare(sql).bind(slug, excludeId) : db.prepare(sql).bind(slug);
  let candidates: Record<string, unknown>[] = [];
  if (typeof stmt.all === 'function') {
    const res = await stmt.all<Record<string, unknown>>().catch(() => null);
    if (res && Array.isArray(res.results) && res.results.length > 0) {
      candidates = res.results;
    }
  }
  if (candidates.length === 0 && typeof stmt.first === 'function') {
    const first = await stmt.first<Record<string, unknown>>().catch(() => null);
    if (first) candidates = [first];
  }
  const match = candidates.find(
    (r) =>
      (!excludeId || r.id !== excludeId) &&
      (r.slug === undefined || r.slug === slug) &&
      matchesTenantRow(r, tenantId)
  );
  return (match as unknown as Product) ?? null;
}

function generateProductId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `prod_${Date.now().toString(36)}${rand}`;
}

// ── 1. Static / Literal Prefix Routes (MUST PRECEDENCE OVER /:id) ──
productsRouter.get('/slug/:slug', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolvePublicTenantId(c);
  const slug = c.req.param('slug');
  const row = await findSlugMatchForTenant(
    db,
    'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ?',
    slug,
    tenantId
  );
  if (!row) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

// ── 2. Base Collection Routes ──
productsRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolvePublicTenantId(c);
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
    const parsedMin = Number(minPrice);
    if (Number.isFinite(parsedMin)) {
      query += ' AND p.price >= ?';
      params.push(parsedMin);
    }
  }
  if (maxPrice !== undefined && maxPrice !== '') {
    const parsedMax = Number(maxPrice);
    if (Number.isFinite(parsedMax)) {
      query += ' AND p.price <= ?';
      params.push(parsedMax);
    }
  }
  if (tags) {
    query += ' AND p.tags LIKE ?';
    params.push(`%${tags}%`);
  }

  query += ' ORDER BY c.sort_order ASC, p.name ASC';
  const stmt = params.length ? db.prepare(query).bind(...params) : db.prepare(query);
  const { results } = await stmt.all<Product>();
  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  return c.json({ success: true, data: filtered });
});

async function isCrossTenantCategory(db: Env['AURA_DB'], categoryId: string | undefined, tenantId: string): Promise<boolean> {
  if (!categoryId || tenantId === '*') return false;
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(categoryId).first<Record<string, unknown>>().catch(() => null);
  if (row) {
    return !matchesTenantRow(row, tenantId);
  }
  const allRes = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(categoryId).all<Record<string, unknown>>().catch(() => null);
  const matchedById = (allRes?.results || []).find((r: Record<string, unknown>) => String(r.id ?? '') === categoryId);
  if (matchedById) {
    return !matchesTenantRow(matchedById, tenantId);
  }
  return false;
}

productsRouter.post('/', staffAuth, audit('product_create'), async (c) => {
  const db = c.env.AURA_DB;
  const rawTenantId = getTenantId(c).trim() || 'default';
  const tenantId = rawTenantId === '*' ? 'default' : rawTenantId;
  const body = await c.req.json();
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;
  if (data.category_id && await isCrossTenantCategory(db, data.category_id, tenantId)) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  if (data.slug) {
    const existingSlug = await findSlugMatchForTenant(
      db,
      'SELECT * FROM products WHERE slug = ?',
      data.slug,
      tenantId
    );
    if (existingSlug) {
      return c.json({ success: false, error: 'Slug already exists' }, 409);
    }
  }
  const id = generateProductId();
  const rawBody = body as Record<string, unknown>;
  const tagsVal = rawBody.tags !== undefined
    ? (typeof rawBody.tags === 'string' ? rawBody.tags : JSON.stringify(rawBody.tags))
    : undefined;
  const badgeVal = typeof rawBody.badge === 'string' ? rawBody.badge : undefined;

  try {
    if (tagsVal !== undefined || badgeVal !== undefined) {
      await db.prepare(
        'INSERT INTO products (id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order, tags, badge, tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(id, data.name, data.slug || '', data.description || '', data.price, data.compare_at_price ?? null, data.category_id || '', data.image_url || '', data.is_available !== false ? 1 : 0, data.sort_order || 0, tagsVal ?? null, badgeVal ?? null, tenantId).run();
    } else {
      await db.prepare(
        'INSERT INTO products (id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order, tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(id, data.name, data.slug || '', data.description || '', data.price, data.compare_at_price ?? null, data.category_id || '', data.image_url || '', data.is_available !== false ? 1 : 0, data.sort_order || 0, tenantId).run();
    }
  } catch {
    try {
      if (tagsVal !== undefined || badgeVal !== undefined) {
        await db.prepare(
          'INSERT INTO products (id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order, tags, badge) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(id, data.name, data.slug || '', data.description || '', data.price, data.compare_at_price ?? null, data.category_id || '', data.image_url || '', data.is_available !== false ? 1 : 0, data.sort_order || 0, tagsVal ?? null, badgeVal ?? null).run();
      } else {
        await db.prepare(
          'INSERT INTO products (id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)'
        ).bind(id, data.name, data.slug || '', data.description || '', data.price, data.compare_at_price ?? null, data.category_id || '', data.image_url || '', data.is_available !== false ? 1 : 0, data.sort_order || 0).run();
      }
    } catch {
      await db.prepare(
        'INSERT INTO products (id, name, description, price, category_id, image_url, is_available) VALUES (?,?,?,?,?,?,?)'
      ).bind(id, data.name, data.description || '', data.price, data.category_id || '', data.image_url || '', data.is_available !== false ? 1 : 0).run();
    }
  }
  await syncProductToMenuProjection(db, id);
  const row = (await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?').bind(id).first()) as Product | null;
  return c.json({ success: true, data: row }, 201);
});

// ── 3. Parameterized Record Routes (/:id) ──
productsRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolvePublicTenantId(c);
  const row = (await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?').bind(c.req.param('id')).first()) as Product | null;
  if (!row || !matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

const handleUpdateProduct = async (c: any) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const body = await c.req.json();
  const id = c.req.param('id');
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;
  const existing = (await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()) as Product | null;
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  const existingRec = existing as unknown as Record<string, unknown>;
  const targetTenant = existingRec.tenant_id && String(existingRec.tenant_id).trim()
    ? String(existingRec.tenant_id).trim()
    : (tenantId === '*' ? 'default' : tenantId);
  if (data.category_id && await isCrossTenantCategory(db, data.category_id, targetTenant)) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  if (data.slug && data.slug !== existing.slug) {
    try {
      const slugConflict = await findSlugMatchForTenant(
        db,
        'SELECT * FROM products WHERE slug = ? AND id != ?',
        data.slug,
        targetTenant,
        id
      );
      if (slugConflict && slugConflict.id !== id) {
        return c.json({ success: false, error: 'Slug already exists' }, 409);
      }
    } catch {
      // Ignore if slug column is absent on legacy schema
    }
  }
  const rawBody = body as Record<string, unknown>;
  const hasTagsOrBadge = rawBody.tags !== undefined || rawBody.badge !== undefined;
  const nextTags = rawBody.tags !== undefined
    ? (typeof rawBody.tags === 'string' ? rawBody.tags : JSON.stringify(rawBody.tags))
    : (existing.tags ?? null);
  const nextBadge = rawBody.badge !== undefined
    ? (typeof rawBody.badge === 'string' ? rawBody.badge : null)
    : (existing.badge ?? null);
  const nextAvailable = data.is_available !== undefined ? (data.is_available ? 1 : 0) : existing.is_available;

  try {
    if (hasTagsOrBadge) {
      await db.prepare(
        'UPDATE products SET name=?, slug=?, description=?, price=?, compare_at_price=?, category_id=?, image_url=?, is_available=?, sort_order=?, tags=?, badge=? WHERE id=?'
      ).bind(data.name ?? existing.name, data.slug ?? existing.slug, data.description ?? existing.description, data.price ?? existing.price, data.compare_at_price ?? existing.compare_at_price, data.category_id ?? existing.category_id, data.image_url ?? existing.image_url, nextAvailable, data.sort_order ?? existing.sort_order, nextTags, nextBadge, id).run();
    } else {
      await db.prepare(
        'UPDATE products SET name=?, slug=?, description=?, price=?, compare_at_price=?, category_id=?, image_url=?, is_available=?, sort_order=? WHERE id=?'
      ).bind(data.name ?? existing.name, data.slug ?? existing.slug, data.description ?? existing.description, data.price ?? existing.price, data.compare_at_price ?? existing.compare_at_price, data.category_id ?? existing.category_id, data.image_url ?? existing.image_url, nextAvailable, data.sort_order ?? existing.sort_order, id).run();
    }
  } catch (updateErr) {
    const errMsg = String((updateErr as Error)?.message || '');
    if (errMsg.includes('UNIQUE') && errMsg.includes('slug')) {
      return c.json({ success: false, error: 'Slug already exists' }, 409);
    }
    try {
      await db.prepare(
        'UPDATE products SET name=?, slug=?, description=?, price=?, compare_at_price=?, category_id=?, image_url=?, is_available=?, sort_order=? WHERE id=?'
      ).bind(data.name ?? existing.name, data.slug ?? existing.slug, data.description ?? existing.description, data.price ?? existing.price, data.compare_at_price ?? existing.compare_at_price, data.category_id ?? existing.category_id, data.image_url ?? existing.image_url, nextAvailable, data.sort_order ?? existing.sort_order, id).run();
    } catch {
      await db.prepare(
        'UPDATE products SET name=?, description=?, price=?, category_id=?, image_url=?, is_available=? WHERE id=?'
      ).bind(data.name ?? existing.name, data.description ?? existing.description, data.price ?? existing.price, data.category_id ?? existing.category_id, data.image_url ?? existing.image_url, nextAvailable, id).run();
    }
  }
  await syncProductToMenuProjection(db, id);
  const row = (await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?').bind(id).first()) as Product | null;
  return c.json({ success: true, data: row });
};

productsRouter.put('/:id', staffAuth, audit('product_update'), handleUpdateProduct);
productsRouter.patch('/:id', staffAuth, audit('product_update'), handleUpdateProduct);

productsRouter.delete('/:id', staffAuth, audit('product_delete'), async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const id = c.req.param('id');
  const existing = (await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()) as Product | null;
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  const orderItems = (await db.prepare('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?').bind(id).first()) as { count: number } | null;
  if (orderItems && orderItems.count > 0) {
    try {
      await db.prepare("UPDATE products SET is_available = 0, updated_at = datetime('now') WHERE id = ?").bind(id).run();
    } catch {
      await db.prepare('UPDATE products SET is_available = 0 WHERE id = ?').bind(id).run();
    }
    await syncProductAvailabilityProjection(db, id, 0);
  } else {
    await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
    await deleteProductProjection(db, id);
  }
  return c.json({ success: true, message: 'Product deleted' });
});
