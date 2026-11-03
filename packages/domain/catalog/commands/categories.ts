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
import { optionalAuth, requireAuth } from 'worker/src/middleware/auth';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
import { resolvePublicTenantId } from 'worker/src/middleware/tenant';
import type { Env } from 'worker/src/types/env';
import type { Category } from '../model/catalog-types';
import { syncCategorySlugToMenuProjection } from '../policies/menu-projection';

export const categoriesRouter = new Hono<{ Bindings: Env }>();
categoriesRouter.use('*', async (c, next) => {
  if (!c.get('user' as never) && c.req.header('Authorization')) {
    return optionalAuth()(c, next);
  }
  await next();
});
const staffAuth = requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']);

function generateCategoryId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `cat_${Date.now().toString(36)}${rand}`;
}

// ── 1. Static Literal Routes (MUST PRECEDENCE OVER /:id) ──
categoriesRouter.get('/tree', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolvePublicTenantId(c);
  const { results } = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all<Category>();
  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  return c.json({ success: true, data: filtered, categories: filtered });
});

categoriesRouter.post('/reorder', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const body = (await c.req.json()) as {
    items?: Array<{ id: string; sort_order?: number; sortOrder?: number; displayOrder?: number }>;
    order?: Array<{ id: string; sort_order?: number; sortOrder?: number; displayOrder?: number }>;
  };
  const items = Array.isArray(body?.items) ? body.items : Array.isArray(body?.order) ? body.order : [];
  for (const item of items) {
    const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(item.id).first<Record<string, unknown>>().catch(() => null);
    if (!existing || (tenantId !== '*' && !matchesTenantRow(existing, tenantId))) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }
  }
  for (const item of items) {
    const sortOrder = item.sort_order ?? item.sortOrder ?? item.displayOrder ?? 0;
    await db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').bind(sortOrder, item.id).run();
  }
  return c.json({ success: true, data: { success: true } });
});

// ── 2. Base Collection Routes ──
categoriesRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolvePublicTenantId(c);
  const { results } = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all<Category>();
  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  return c.json({ success: true, data: filtered });
});

categoriesRouter.post('/', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
  const rawTenantId = getTenantId(c).trim() || 'default';
  const tenantId = rawTenantId === '*' ? 'default' : rawTenantId;
  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }, 400);
  }
  const data = parsed.data;
  const id = generateCategoryId();
  const resolvedSlug =
    data.slug ||
    data.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    id;
  try {
    await db.prepare(
      'INSERT INTO categories (id, name, slug, sort_order, image_url, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, data.name, resolvedSlug, data.sort_order || 0, data.image_url || '', tenantId).run();
  } catch {
    try {
      await db.prepare(
        'INSERT INTO categories (id, name, slug, sort_order, image_url) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, data.name, resolvedSlug, data.sort_order || 0, data.image_url || '').run();
    } catch {
      await db.prepare(
        'INSERT INTO categories (id, name, slug, sort_order) VALUES (?, ?, ?, ?)'
      ).bind(id, data.name, resolvedSlug, data.sort_order || 0).run();
    }
  }
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<Category>();
  return c.json({ success: true, data: row }, 201);
});

// ── 3. Parameterized Record Routes (/:id) ──
categoriesRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolvePublicTenantId(c);
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(c.req.param('id')).first<Category>();
  if (!row || !matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

const handleUpdateCategory = async (c: any) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const body = await c.req.json();
  const id = c.req.param('id');
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }, 400);
  }
  const data = parsed.data;
  const existing = (await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first()) as Category | null;
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  const nextName = data.name ?? existing.name;
  const nextSlug =
    (data.slug !== undefined && data.slug !== '' ? data.slug : existing.slug) ||
    nextName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    id;
  try {
    await db.prepare(
      'UPDATE categories SET name=?, slug=?, sort_order=?, image_url=? WHERE id=?'
    ).bind(nextName, nextSlug, data.sort_order ?? existing.sort_order, data.image_url ?? existing.image_url, id).run();
  } catch {
    await db.prepare(
      'UPDATE categories SET name=?, slug=?, sort_order=? WHERE id=?'
    ).bind(nextName, nextSlug, data.sort_order ?? existing.sort_order, id).run();
  }
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
  const tenantId = getTenantId(c).trim() || 'default';
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<Category>();
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  const existingRec = existing as unknown as Record<string, unknown>;
  const targetTenant = existingRec.tenant_id && String(existingRec.tenant_id).trim()
    ? String(existingRec.tenant_id).trim()
    : (tenantId === '*' ? 'default' : tenantId);
  const prodCount = (await db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').bind(id).first()) as { count: number } | null;
  let hasTenantProducts = Boolean(prodCount && prodCount.count > 0);
  if (hasTenantProducts && targetTenant !== '*') {
    const prodRowsRes = await db.prepare('SELECT * FROM products WHERE category_id = ?').bind(id).all<Record<string, unknown>>().catch(() => null);
    if (prodRowsRes && Array.isArray(prodRowsRes.results) && prodRowsRes.results.length > 0) {
      hasTenantProducts = prodRowsRes.results.some((p) => matchesTenantRow(p, targetTenant));
    }
  }
  if (hasTenantProducts) {
    return c.json({ success: false, error: 'Cannot delete category with products' }, 409);
  }
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: 'Category deleted' });
});
