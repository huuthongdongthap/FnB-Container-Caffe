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
import { isHQSuperAdmin, resolvePublicTenantId } from 'worker/src/middleware/tenant';
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
const baseStaffAuth = requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']);
const staffAuth: typeof baseStaffAuth = async (c, next) => {
  const existingUser = c.get('user' as never) as { role?: string } | undefined;
  if (
    existingUser?.role &&
    ['owner', 'manager', 'supervisor', 'staff', 'admin'].includes(existingUser.role) &&
    !c.req.header('Authorization')
  ) {
    return next();
  }
  return baseStaffAuth(c, next);
};

function verifyCategoryReadTenant(c: any): { ok: true; tenantId: string } | { ok: false; status: 403; error: string } {
  const user = c.get('user') as { id?: string; role?: string; tenant_id?: string; tenantId?: string } | undefined;
  const candidateOverrides = [
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return { ok: false, status: 403, error: 'Cross-tenant category read denied' };
  }
  const requestedOverride = candidateOverrides[0] || '';

  if (user && !isHQSuperAdmin(c)) {
    const userTenant = (user.tenant_id || user.tenantId || '').trim() || 'default';
    if (userTenant === '*' || userTenant.toLowerCase() === 'hq') {
      return { ok: false, status: 403, error: 'Cross-tenant category read denied' };
    }
    if (
      requestedOverride &&
      (requestedOverride === '*' ||
        requestedOverride.toLowerCase() === 'hq' ||
        requestedOverride !== userTenant)
    ) {
      return { ok: false, status: 403, error: 'Cross-tenant category read denied' };
    }
    const ctxTenant = getTenantId(c).trim() || 'default';
    if (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== userTenant) {
      return { ok: false, status: 403, error: 'Cross-tenant category read denied' };
    }
    return { ok: true, tenantId: userTenant };
  }
  const explicitCtx = (typeof c.get === 'function' ? (c.get('tenantId') as string | undefined) : undefined)?.trim() || '';
  if (
    !isHQSuperAdmin(c) &&
    ((requestedOverride && (requestedOverride === '*' || requestedOverride.toLowerCase() === 'hq')) ||
      explicitCtx === '*' ||
      explicitCtx.toLowerCase() === 'hq')
  ) {
    return { ok: false, status: 403, error: 'Cross-tenant category read denied' };
  }
  if (isHQSuperAdmin(c)) {
    const cleanReq = requestedOverride && requestedOverride !== '*' && requestedOverride.toLowerCase() !== 'hq' ? requestedOverride : '';
    const pubTenant = resolvePublicTenantId(c);
    const cleanPub = pubTenant && pubTenant !== '*' && pubTenant.toLowerCase() !== 'hq' ? pubTenant : '';
    const hqTenant =
      requestedOverride === '*' || requestedOverride.toLowerCase() === 'hq'
        ? '*'
        : cleanReq || cleanPub || '*';
    return { ok: true, tenantId: hqTenant };
  }
  const pubTenant = resolvePublicTenantId(c);
  return { ok: true, tenantId: pubTenant };
}

function verifyCategoryWriteTenant(
  c: any,
  requireConcreteTenant = false
): { ok: true; tenantId: string } | { ok: false; status: 400 | 403; error: string } {
  const user = c.get('user') as { id?: string; role?: string; tenant_id?: string; tenantId?: string } | undefined;
  const candidateOverrides = [
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return { ok: false, status: 403, error: 'Cross-tenant category write denied' };
  }
  const requestedOverride = candidateOverrides[0] || '';

  if (!isHQSuperAdmin(c)) {
    const userTenant = (user?.tenant_id || user?.tenantId || '').trim() || 'default';
    if (userTenant === '*' || userTenant.toLowerCase() === 'hq') {
      return { ok: false, status: 403, error: 'Cross-tenant category write denied' };
    }
    if (
      requestedOverride &&
      (requestedOverride === '*' ||
        requestedOverride.toLowerCase() === 'hq' ||
        requestedOverride !== userTenant)
    ) {
      return { ok: false, status: 403, error: 'Cross-tenant category write denied' };
    }
    const ctxTenant = getTenantId(c).trim() || 'default';
    if (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== userTenant) {
      return { ok: false, status: 403, error: 'Cross-tenant category write denied' };
    }
    return { ok: true, tenantId: userTenant };
  }

  const cleanReq = requestedOverride && requestedOverride !== '*' && requestedOverride.toLowerCase() !== 'hq' ? requestedOverride : '';
  const ctxVal = getTenantId(c).trim();
  const cleanCtx = ctxVal && ctxVal !== '*' && ctxVal.toLowerCase() !== 'hq' ? ctxVal : '';
  const userVal = (user?.tenant_id || user?.tenantId || '').trim();
  const cleanUser = userVal && userVal !== '*' && userVal.toLowerCase() !== 'hq' ? userVal : '';
  const resolved =
    requestedOverride === '*' || requestedOverride.toLowerCase() === 'hq'
      ? '*'
      : cleanReq || cleanCtx || cleanUser || '*';
  if (requireConcreteTenant && resolved === '*') {
    return { ok: false, status: 400, error: 'Concrete tenant_id required for category creation' };
  }
  return { ok: true, tenantId: resolved };
}

function generateCategoryId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `cat_${Date.now().toString(36)}${rand}`;
}

// ── 1. Static Literal Routes (MUST PRECEDENCE OVER /:id) ──
categoriesRouter.get('/tree', async (c) => {
  const tenantCheck = verifyCategoryReadTenant(c);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const { results } = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all<Category>();
  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  return c.json({ success: true, data: filtered, categories: filtered });
});

categoriesRouter.post('/reorder', staffAuth, async (c) => {
  const tenantCheck = verifyCategoryWriteTenant(c, false);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const body = (await c.req.json()) as {
    items?: Array<{ id: string; sort_order?: number; sortOrder?: number; displayOrder?: number }>;
    order?: Array<{ id: string; sort_order?: number; sortOrder?: number; displayOrder?: number }>;
  };
  const items = Array.isArray(body?.items) ? body.items : Array.isArray(body?.order) ? body.order : [];
  const itemTenants = new Map<string, string>();
  for (const item of items) {
    const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(item.id).first<Record<string, unknown>>().catch(() => null);
    if (!existing || (tenantId !== '*' && !matchesTenantRow(existing, tenantId))) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }
    const rawT = existing && typeof existing.tenant_id === 'string' && existing.tenant_id.trim()
      ? existing.tenant_id.trim()
      : 'default';
    itemTenants.set(item.id, tenantId === '*' ? rawT : tenantId);
  }
  for (const item of items) {
    const sortOrder = item.sort_order ?? item.sortOrder ?? item.displayOrder ?? 0;
    const itemTenant = itemTenants.get(item.id) || (tenantId === '*' ? 'default' : tenantId);
    try {
      await db.prepare(
        "UPDATE categories SET sort_order = ? WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      ).bind(sortOrder, item.id, itemTenant, itemTenant).run();
    } catch (err) {
      if (itemTenant !== 'default') throw err;
      await db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').bind(sortOrder, item.id).run();
    }
  }
  return c.json({ success: true, data: { success: true } });
});

// ── 2. Base Collection Routes ──
categoriesRouter.get('/', async (c) => {
  const tenantCheck = verifyCategoryReadTenant(c);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const { results } = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all<Category>();
  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  return c.json({ success: true, data: filtered });
});

categoriesRouter.post('/', staffAuth, async (c) => {
  const tenantCheck = verifyCategoryWriteTenant(c, true);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
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
  } catch (err) {
    if (tenantId !== 'default') throw err;
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
  const tenantCheck = verifyCategoryReadTenant(c);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(c.req.param('id')).first<Category>();
  if (!row || !matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

const handleUpdateCategory = async (c: any) => {
  const tenantCheck = verifyCategoryWriteTenant(c, false);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
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
  const existingRec = existing as unknown as Record<string, unknown>;
  const effectiveTenant: string = tenantId === '*'
    ? ((typeof existingRec.tenant_id === 'string' && existingRec.tenant_id.trim()) || 'default')
    : tenantId;
  const oldSlug = typeof existing.slug === 'string' && existing.slug.trim() ? existing.slug.trim() : null;
  if (data.slug !== undefined && data.slug !== '') {
    const slugRes = await db.prepare('SELECT * FROM categories WHERE slug = ? AND id != ?')
      .bind(data.slug, id)
      .all()
      .catch(() => ({ results: [] as Record<string, unknown>[] }));
    if ((slugRes.results || []).some((r: Record<string, unknown>) => matchesTenantRow(r, effectiveTenant))) {
      return c.json({ success: false, error: 'Category slug already exists' }, 409);
    }
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
      "UPDATE categories SET name=?, slug=?, sort_order=?, image_url=? WHERE id=? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
    ).bind(nextName, nextSlug, data.sort_order ?? existing.sort_order, data.image_url ?? existing.image_url, id, effectiveTenant, effectiveTenant).run();
  } catch (err) {
    if (effectiveTenant !== 'default') throw err;
    try {
      await db.prepare(
        'UPDATE categories SET name=?, slug=?, sort_order=?, image_url=? WHERE id=?'
      ).bind(nextName, nextSlug, data.sort_order ?? existing.sort_order, data.image_url ?? existing.image_url, id).run();
    } catch {
      await db.prepare(
        'UPDATE categories SET name=?, slug=?, sort_order=? WHERE id=?'
      ).bind(nextName, nextSlug, data.sort_order ?? existing.sort_order, id).run();
    }
  }
  if (data.slug && oldSlug && data.slug !== oldSlug) {
    await db.prepare(
      "UPDATE menu_items SET category = ? WHERE category = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND (NOT EXISTS (SELECT 1 FROM products WHERE products.category_id = ?) OR id IN (SELECT id FROM products WHERE category_id = ?))"
    ).bind(data.slug, oldSlug, effectiveTenant, id, id).run().catch(async () => {
      await db.prepare(
        "UPDATE menu_items SET category = ? WHERE category = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(data.slug, oldSlug, effectiveTenant).run().catch(async () => {
        if (effectiveTenant === 'default') {
          await db.prepare('UPDATE menu_items SET category = ? WHERE category = ?').bind(data.slug, oldSlug).run().catch(() => {});
        }
      });
    });
    await db.prepare(
      "UPDATE products SET category = ? WHERE (category_id = ? OR (category_id IS NULL AND category = ?)) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(data.slug, id, oldSlug, effectiveTenant).run().catch(async () => {
      await db.prepare(
        "UPDATE products SET category = ? WHERE category = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(data.slug, oldSlug, effectiveTenant).run().catch(async () => {
        if (effectiveTenant === 'default') {
          await db.prepare('UPDATE products SET category = ? WHERE category = ?').bind(data.slug, oldSlug).run().catch(() => {});
        }
      });
    });
  }
  if (data.slug && data.slug !== existing.slug) {
    await syncCategorySlugToMenuProjection(db, id, data.slug, effectiveTenant);
  }
  const row = (await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first()) as Category | null;
  return c.json({ success: true, data: row });
};

categoriesRouter.put('/:id', staffAuth, handleUpdateCategory);
categoriesRouter.patch('/:id', staffAuth, handleUpdateCategory);

categoriesRouter.delete('/:id', staffAuth, async (c) => {
  const tenantCheck = verifyCategoryWriteTenant(c, false);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
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
  try {
    await db.prepare(
      "DELETE FROM categories WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
    ).bind(id, targetTenant, targetTenant).run();
  } catch (err) {
    if (targetTenant !== 'default') throw err;
    await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  }
  return c.json({ success: true, message: 'Category deleted' });
});
