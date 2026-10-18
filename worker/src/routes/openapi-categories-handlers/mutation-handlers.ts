import type { OpenAPIHono } from '@hono/zod-openapi';
import { CategoryRoutes } from '@aura/domain-catalog';
import type { Env } from '../../types/env';
import { getDatabase } from '../../lib/db';
import { formatCategory, type CategoryRow } from './helpers';

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
    const user = c.get('user') as { id: string };

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const sortOrder = body.sortOrder ?? body.displayOrder ?? 0;
    const viName = body.translations?.find((t) => t.locale === 'vi')?.name || body.name;
    const enName = body.translations?.find((t) => t.locale === 'en')?.name || null;

    try {
      await db.prepare(
        `INSERT INTO categories (id, name, slug, description, sort_order, image_url, display_name_vi, display_name_en, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.name,
        body.slug || id,
        body.description || null,
        sortOrder,
        body.imageUrl || null,
        viName,
        enName,
        now,
        now
      ).run();
    } catch {
      await db.prepare(
        `INSERT INTO categories (id, name, description, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(id, body.name, body.description || null, sortOrder, now).run();
    }

    // Audit log
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${Date.now()}`, user.id, 'category_create', 'category', id, JSON.stringify(body), now).run();
    } catch {
      await db.prepare(
        `INSERT INTO audit_logs (id, action, actor, resource, resource_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${Date.now()}`, 'category_create', user.id, 'category', id, JSON.stringify(body), now).run().catch(() => {});
    }

    const created = (await db.prepare(
      'SELECT c.* FROM categories c WHERE c.id = ?'
    ).bind(id).first()) as CategoryRow | null;

    return c.json({ success: true, data: created ? formatCategory(created) : null }, 201);
  });

  // PATCH /api/categories/:id - Update category
  router.openapi(CategoryRoutes.update as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as {
      name?: string;
      slug?: string;
      description?: string;
      sortOrder?: number;
      displayOrder?: number;
      imageUrl?: string | null;
      translations?: Array<{ locale: string; name: string; description?: string }>;
    };
    const user = c.get('user') as { id: string };
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Category not found' }, 404);
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
    params.push(id);

    if (updates.length > 1) {
      try {
        await db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
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
          fallbackParams.push(id);
          await db.prepare(`UPDATE categories SET ${fallbackUpdates.join(', ')} WHERE id = ?`).bind(...fallbackParams).run();
        }
      }
    }

    // Audit log
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${Date.now()}`, user.id, 'category_update', 'category', id, JSON.stringify(body), now).run();
    } catch {
      await db.prepare(
        `INSERT INTO audit_logs (id, action, actor, resource, resource_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${Date.now()}`, 'category_update', user.id, 'category', id, JSON.stringify(body), now).run().catch(() => {});
    }

    const updated = (await db.prepare(
      'SELECT c.* FROM categories c WHERE c.id = ?'
    ).bind(id).first()) as CategoryRow | null;

    return c.json({ success: true, data: updated ? formatCategory(updated) : null });
  });

  // DELETE /api/categories/:id - Delete category
  router.openapi(CategoryRoutes.delete as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const user = c.get('user') as { id: string };
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first()) as { name: string } | null;
    if (!existing) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }

    // Check for products
    const products = (await db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').bind(id).first()) as { count: number } | null;
    if (products && products.count > 0) {
      return c.json({ success: false, error: 'Cannot delete category with products' }, 409);
    }

    await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();

    // Audit log
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${Date.now()}`, user.id, 'category_delete', 'category', id, JSON.stringify({ name: existing.name }), now).run();
    } catch {
      await db.prepare(
        `INSERT INTO audit_logs (id, action, actor, resource, resource_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${Date.now()}`, 'category_delete', user.id, 'category', id, JSON.stringify({ name: existing.name }), now).run().catch(() => {});
    }

    return c.json({ success: true, data: { success: true } });
  });

  // POST /api/categories/reorder - Reorder categories
  router.openapi(CategoryRoutes.reorder as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json' as never) as {
      items: Array<{ id: string; sortOrder: number }>;
    };
    const user = c.get('user') as { id: string };
    const now = new Date().toISOString();
    const { items } = body;

    for (const item of items) {
      try {
        await db.prepare(
          'UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?'
        ).bind(item.sortOrder, now, item.id).run();
      } catch {
        await db.prepare(
          'UPDATE categories SET sort_order = ? WHERE id = ?'
        ).bind(item.sortOrder, item.id).run();
      }
    }

    // Audit log
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${Date.now()}`, user.id, 'category_reorder', 'category', 'multiple', JSON.stringify({ items }), now).run();
    } catch {
      await db.prepare(
        `INSERT INTO audit_logs (id, action, actor, resource, resource_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${Date.now()}`, 'category_reorder', user.id, 'category', 'multiple', JSON.stringify({ items }), now).run().catch(() => {});
    }

    return c.json({ success: true, data: { success: true } });
  });
}
