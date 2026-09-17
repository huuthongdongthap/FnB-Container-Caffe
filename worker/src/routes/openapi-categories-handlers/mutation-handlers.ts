import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { CategoryRoutes } from '@aura/domain-catalog';
import type { Env } from '../../types/env';

export function registerCategoryMutationHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // POST /api/categories - Create category
  router.openapi(CategoryRoutes.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json' as never) as {
      name: string;
      slug?: string;
      description?: string;
      parentId?: string | null;
      sortOrder?: number;
      imageUrl?: string | null;
      isActive?: boolean;
      locationIds?: string[];
      metadata?: Record<string, unknown>;
      translations?: Array<{ locale: string; name: string; description?: string }>;
    };
    const user = c.get('user') as { id: string };

    const id = `cat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await db.prepare(
      `INSERT INTO categories (id, name, slug, description, parent_id, sort_order, image_url, is_active, location_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.name,
      body.slug || '',
      body.description || null,
      body.parentId || null,
      body.sortOrder || 0,
      body.imageUrl || null,
      body.isActive !== false ? 1 : 0,
      body.locationIds?.[0] || null,
      JSON.stringify(body.metadata || {}),
      now,
      now
    ).run();

    // Insert translations if provided
    if (body.translations?.length) {
      for (const t of body.translations) {
        await db.prepare(
          'INSERT INTO category_translations (category_id, locale, name, description) VALUES (?, ?, ?, ?)'
        ).bind(id, t.locale, t.name, t.description || '').run();
      }
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'category_create', 'category', id, JSON.stringify(body), now).run();

    const created = await db.prepare(
      `SELECT c.*, ct.name as translation_name, ct.description as translation_description
       FROM categories c
       LEFT JOIN category_translations ct ON c.id = ct.category_id AND ct.locale = ?
       WHERE c.id = ?`
    ).bind('vi', id).first();

    return c.json({ success: true, data: created }, 201);
  });

  // PATCH /api/categories/:id - Update category
  router.openapi(CategoryRoutes.update, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as {
      name?: string;
      slug?: string;
      description?: string;
      parentId?: string | null;
      sortOrder?: number;
      imageUrl?: string | null;
      isActive?: boolean;
      locationIds?: string[];
      metadata?: Record<string, unknown>;
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
    if (body.parentId !== undefined) { updates.push('parent_id = ?'); params.push(body.parentId); }
    if (body.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(body.sortOrder); }
    if (body.imageUrl !== undefined) { updates.push('image_url = ?'); params.push(body.imageUrl); }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }
    if (body.locationIds !== undefined) { updates.push('location_id = ?'); params.push(body.locationIds[0] || null); }
    if (body.metadata !== undefined) { updates.push('metadata = ?'); params.push(JSON.stringify(body.metadata)); }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    if (updates.length > 1) {
      await db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    }

    // Update translations
    if (body.translations?.length) {
      for (const t of body.translations) {
        await db.prepare(
          `INSERT INTO category_translations (category_id, locale, name, description)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(category_id, locale) DO UPDATE SET name = ?, description = ?`
        ).bind(id, t.locale, t.name, t.description || '', t.name, t.description || '').run();
      }
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'category_update', 'category', id, JSON.stringify(body), now).run();

    const updated = await db.prepare(
      `SELECT c.*, ct.name as translation_name, ct.description as translation_description
       FROM categories c
       LEFT JOIN category_translations ct ON c.id = ct.category_id AND ct.locale = ?
       WHERE c.id = ?`
    ).bind('vi', id).first();

    return c.json({ success: true, data: updated });
  });

  // DELETE /api/categories/:id - Delete category
  router.openapi(CategoryRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param' as never) as { id: string };
    const user = c.get('user') as { id: string };
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<{ name: string }>();
    if (!existing) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }

    // Check for children
    const children = await db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').bind(id).first<{ count: number }>();
    if (children && children.count > 0) {
      return c.json({ success: false, error: 'Cannot delete category with children' }, 409);
    }

    // Check for products
    const products = await db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').bind(id).first<{ count: number }>();
    if (products && products.count > 0) {
      return c.json({ success: false, error: 'Cannot delete category with products' }, 409);
    }

    await db.prepare('DELETE FROM category_translations WHERE category_id = ?').bind(id).run();
    await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'category_delete', 'category', id, JSON.stringify({ name: existing.name }), now).run();

    return c.json({ success: true, data: { success: true } });
  });

  // POST /api/categories/reorder - Reorder categories
  router.openapi(CategoryRoutes.reorder, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json' as never) as {
      items: Array<{ id: string; sortOrder: number; parentId?: string | null }>;
    };
    const user = c.get('user') as { id: string };
    const now = new Date().toISOString();

    const { items } = body;

    for (const item of items) {
      await db.prepare(
        'UPDATE categories SET sort_order = ?, parent_id = ?, updated_at = ? WHERE id = ?'
      ).bind(item.sortOrder, item.parentId || null, now, item.id).run();
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'category_reorder', 'category', 'multiple', JSON.stringify({ items }), now).run();

    return c.json({ success: true, data: { success: true } });
  });
}
