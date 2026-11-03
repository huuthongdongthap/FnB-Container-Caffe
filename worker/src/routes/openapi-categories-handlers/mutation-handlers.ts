import type { OpenAPIHono } from '@hono/zod-openapi';
import { CategoryRoutes } from '@aura/domain-catalog';
import type { Env } from '../../types/env';
import { getDatabase } from '../../lib/db';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import { formatCategory, matchesCatalogTenant, type CategoryRow } from './helpers';

const CATEGORY_WRITE_ROLES = ['owner', 'manager', 'supervisor', 'admin'];

function resolveCategoryWriteTenantId(c: any): string {
  const raw = getTenantId(c).trim() || 'default';
  return raw === '*' && !isHQSuperAdmin(c) ? 'default' : raw;
}

async function writeCategoryAuditLog(
  db: any,
  userId: string,
  action: string,
  entityId: string,
  metadata: string,
  now: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'category', entityId, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, userId, action, 'category', entityId, 'category', entityId, metadata, metadata, now).run();
    } catch {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, action, 'category', entityId, metadata, now).run().catch(() => {});
    }
  }
}

export function registerCategoryMutationHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // POST /api/categories - Create category
  router.openapi(CategoryRoutes.create as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json' as never) as {
      name: string;
      slug?: string;
      description?: string;
      sortOrder?: number;
      displayOrder?: number;
      imageUrl?: string | null;
      translations?: Array<{ locale: string; name: string; description?: string }>;
    };
    const user = c.get('user') as { id: string; role?: string } | undefined;
    if (!user?.id || (user.role && !CATEGORY_WRITE_ROLES.includes(user.role))) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const rawTenant = getTenantId(c).trim() || 'default';
    const targetTenant = rawTenant === '*' ? 'default' : rawTenant;

    if (body.slug) {
      const existingSlugRes = await db.prepare('SELECT * FROM categories WHERE slug = ?')
        .bind(body.slug)
        .all<Record<string, unknown>>()
        .catch(() => ({ results: [] as Record<string, unknown>[] }));
      if ((existingSlugRes.results || []).some((r) => matchesCatalogTenant(r, targetTenant))) {
        return c.json({ success: false, error: 'Category slug already exists' }, 409);
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const sortOrder = body.sortOrder ?? body.displayOrder ?? 0;
    const viName = body.translations?.find((t) => t.locale === 'vi')?.name || body.name;
    const enName = body.translations?.find((t) => t.locale === 'en')?.name || null;

    try {
      await db.prepare(
        `INSERT INTO categories (id, name, slug, description, sort_order, image_url, display_name_vi, display_name_en, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, body.name, body.slug || id, body.description || null, sortOrder, body.imageUrl || null, viName, enName, now, now).run();
    } catch {
      await db.prepare(
        `INSERT INTO categories (id, name, description, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(id, body.name, body.description || null, sortOrder, now).run();
    }

    if (targetTenant !== 'default') {
      await db.prepare('UPDATE categories SET tenant_id = ? WHERE id = ?').bind(targetTenant, id).run().catch(() => {});
    }

    await writeCategoryAuditLog(db, user.id, 'category_create', id, JSON.stringify(body), now);

    const created = (await db.prepare('SELECT c.* FROM categories c WHERE c.id = ?').bind(id).first()) as CategoryRow | null;
    return c.json({ success: true, data: created ? formatCategory(created) : null }, 201);
  });

  // PATCH /api/categories/:id - Update category
  router.openapi(CategoryRoutes.update as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = resolveCategoryWriteTenantId(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as {
      name?: string; slug?: string; description?: string; sortOrder?: number; displayOrder?: number;
      imageUrl?: string | null; translations?: Array<{ locale: string; name: string; description?: string }>;
    };
    const user = c.get('user') as { id: string; role?: string } | undefined;
    if (!user?.id || (user.role && !CATEGORY_WRITE_ROLES.includes(user.role))) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first()) as { slug?: string | null; tenant_id?: string | null } | null;
    if (!existing || !matchesCatalogTenant(existing, tenantId)) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }

    const effectiveTenant = tenantId === '*'
      ? ((typeof existing.tenant_id === 'string' && existing.tenant_id.trim()) || 'default')
      : tenantId;
    const oldSlug = typeof existing.slug === 'string' && existing.slug.trim() ? existing.slug.trim() : null;

    if (body.slug !== undefined) {
      const slugRes = await db.prepare('SELECT * FROM categories WHERE slug = ? AND id != ?')
        .bind(body.slug, id)
        .all<Record<string, unknown>>()
        .catch(() => ({ results: [] as Record<string, unknown>[] }));
      if ((slugRes.results || []).some((r) => matchesCatalogTenant(r, effectiveTenant))) {
        return c.json({ success: false, error: 'Category slug already exists' }, 409);
      }
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.slug !== undefined) { updates.push('slug = ?'); params.push(body.slug); }
    if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
    if (body.sortOrder !== undefined || body.displayOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(body.sortOrder ?? body.displayOrder ?? 0);
    }
    if (body.imageUrl !== undefined) { updates.push('image_url = ?'); params.push(body.imageUrl); }

    if (body.translations?.length) {
      const vi = body.translations.find((t) => t.locale === 'vi');
      if (vi) { updates.push('display_name_vi = ?'); params.push(vi.name); }
      const en = body.translations.find((t) => t.locale === 'en');
      if (en) { updates.push('display_name_en = ?'); params.push(en.name); }
    }

    updates.push('updated_at = ?');
    params.push(now);

    if (updates.length > 1) {
      if (tenantId !== '*') {
        try {
          await db.prepare(
            `UPDATE categories SET ${updates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          ).bind(...params, id, tenantId).run();
        } catch {
          const fallbackUpdates: string[] = [];
          const fallbackParams: (string | number | null)[] = [];
          if (body.name !== undefined) { fallbackUpdates.push('name = ?'); fallbackParams.push(body.name); }
          if (body.description !== undefined) { fallbackUpdates.push('description = ?'); fallbackParams.push(body.description); }
          if (body.sortOrder !== undefined || body.displayOrder !== undefined) {
            fallbackUpdates.push('sort_order = ?');
            fallbackParams.push(body.sortOrder ?? body.displayOrder ?? 0);
          }
          if (fallbackUpdates.length > 0) {
            try {
              await db.prepare(
                `UPDATE categories SET ${fallbackUpdates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
              ).bind(...fallbackParams, id, tenantId).run();
            } catch {
              if (tenantId === 'default') {
                await db.prepare(`UPDATE categories SET ${fallbackUpdates.join(', ')} WHERE id = ?`).bind(...fallbackParams, id).run();
              }
            }
          }
        }
      } else {
        try {
          await db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).bind(...params, id).run();
        } catch {
          const fallbackUpdates: string[] = [];
          const fallbackParams: (string | number | null)[] = [];
          if (body.name !== undefined) { fallbackUpdates.push('name = ?'); fallbackParams.push(body.name); }
          if (body.description !== undefined) { fallbackUpdates.push('description = ?'); fallbackParams.push(body.description); }
          if (body.sortOrder !== undefined || body.displayOrder !== undefined) {
            fallbackUpdates.push('sort_order = ?');
            fallbackParams.push(body.sortOrder ?? body.displayOrder ?? 0);
          }
          if (fallbackUpdates.length > 0) {
            await db.prepare(`UPDATE categories SET ${fallbackUpdates.join(', ')} WHERE id = ?`).bind(...fallbackParams, id).run();
          }
        }
      }

      if (body.slug && oldSlug && body.slug !== oldSlug) {
        await db.prepare(
          "UPDATE menu_items SET category = ? WHERE category = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(body.slug, oldSlug, effectiveTenant).run().catch(async () => {
          if (effectiveTenant === 'default') {
            await db.prepare('UPDATE menu_items SET category = ? WHERE category = ?').bind(body.slug, oldSlug).run().catch(() => {});
          }
        });
        await db.prepare(
          "UPDATE products SET category = ? WHERE category = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(body.slug, oldSlug, effectiveTenant).run().catch(async () => {
          if (effectiveTenant === 'default') {
            await db.prepare('UPDATE products SET category = ? WHERE category = ?').bind(body.slug, oldSlug).run().catch(() => {});
          }
        });
      }
    }

    await writeCategoryAuditLog(db, user.id, 'category_update', id, JSON.stringify(body), now);

    const updated = (await db.prepare('SELECT c.* FROM categories c WHERE c.id = ?').bind(id).first()) as CategoryRow | null;
    return c.json({ success: true, data: updated ? formatCategory(updated) : null });
  });

  // DELETE /api/categories/:id - Delete category
  router.openapi(CategoryRoutes.delete as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = resolveCategoryWriteTenantId(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const user = c.get('user') as { id: string; role?: string } | undefined;
    if (!user?.id || (user.role && !CATEGORY_WRITE_ROLES.includes(user.role))) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first()) as { name: string; tenant_id?: string | null } | null;
    if (!existing || !matchesCatalogTenant(existing, tenantId)) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }

    const products = (await db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').bind(id).first()) as { count: number } | null;
    let hasTenantProducts = Boolean(products && products.count > 0);
    if (hasTenantProducts && tenantId !== '*') {
      const prodRowsRes = await db.prepare('SELECT * FROM products WHERE category_id = ?').bind(id).all<Record<string, unknown>>().catch(() => null);
      if (prodRowsRes && Array.isArray(prodRowsRes.results) && prodRowsRes.results.length > 0) {
        hasTenantProducts = prodRowsRes.results.some((p) => matchesCatalogTenant(p, tenantId));
      }
    }
    if (hasTenantProducts) return c.json({ success: false, error: 'Cannot delete category with products' }, 409);

    if (tenantId !== '*') {
      await db.prepare(
        "DELETE FROM categories WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, tenantId).run().catch(async () => {
        if (tenantId === 'default') {
          await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
        }
      });
    } else {
      await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
    }
    await writeCategoryAuditLog(db, user.id, 'category_delete', id, JSON.stringify({ name: existing.name }), now);

    return c.json({ success: true, data: { success: true } });
  });

  // POST /api/categories/reorder - Reorder categories
  router.openapi(CategoryRoutes.reorder as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = resolveCategoryWriteTenantId(c);
    const body = c.req.valid('json' as never) as { items: Array<{ id: string; sortOrder: number }> };
    const user = c.get('user') as { id: string; role?: string } | undefined;
    if (!user?.id || (user.role && !CATEGORY_WRITE_ROLES.includes(user.role))) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const now = new Date().toISOString();
    const { items } = body;

    for (const item of items) {
      const catRow = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(item.id).first().catch(() => null);
      if (!catRow || (tenantId !== '*' && !matchesCatalogTenant(catRow, tenantId))) {
        return c.json({ success: false, error: 'Category not found' }, 404);
      }
    }
    for (const item of items) {
      if (tenantId !== '*') {
        try {
          await db.prepare(
            "UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(item.sortOrder, now, item.id, tenantId).run();
        } catch {
          try {
            await db.prepare(
              "UPDATE categories SET sort_order = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(item.sortOrder, item.id, tenantId).run();
          } catch {
            if (tenantId === 'default') {
              await db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').bind(item.sortOrder, item.id).run();
            }
          }
        }
      } else {
        try {
          await db.prepare('UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?').bind(item.sortOrder, now, item.id).run();
        } catch {
          await db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').bind(item.sortOrder, item.id).run();
        }
      }
    }

    await writeCategoryAuditLog(db, user.id, 'category_reorder', 'multiple', JSON.stringify({ items }), now);
    return c.json({ success: true, data: { success: true } });
  });
}
