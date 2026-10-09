import type { OpenAPIHono } from '@hono/zod-openapi';
import {
  ProductRoutes,
  syncProductToMenuProjection,
  syncProductAvailabilityProjection,
  deleteProductProjection,
} from '@aura/domain-catalog';
import type { Env } from '../../types/env';
import { getDatabase } from '../../lib/db';
import { formatProduct, type ProductRow } from './helpers';

export function registerProductMutationHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // POST /api/products - Create product
  router.openapi(ProductRoutes.create as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json' as never) as {
      slug: string;
      categoryId: string;
      basePrice: number;
      price?: number;
      status?: string;
      images?: Array<{ url: string }>;
      imageUrl?: string;
      tags?: string[];
      translations?: Array<{ locale: string; name: string; description?: string }>;
    };
    const user = c.get('user') as { id: string };
    const now = new Date().toISOString();

    const id = crypto.randomUUID();
    const name = body.translations?.[0]?.name || body.slug;
    const description = body.translations?.[0]?.description || null;
    const price = body.basePrice ?? body.price ?? 0;
    const imageUrl = body.images?.[0]?.url || body.imageUrl || null;
    const tags = JSON.stringify(body.tags || []);
    const isAvailable = body.status === 'inactive' ? 0 : 1;

    // Check slug uniqueness
    if (body.slug) {
      const existing = await db.prepare('SELECT id FROM products WHERE slug = ?').bind(body.slug).first();
      if (existing) {
        return c.json({ success: false, error: 'Slug already exists' }, 409);
      }
    }

    await db.prepare(
      `INSERT INTO products (id, category_id, name, slug, price, compare_at_price, description, image_url, tags, is_available, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.categoryId,
      name,
      body.slug || id,
      price,
      null,
      description,
      imageUrl,
      tags,
      isAvailable,
      0,
      now,
      now
    ).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'product_create', 'product', id, JSON.stringify(body), now).run();

    await syncProductToMenuProjection(db, id);

    const created = (await db.prepare(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`
    ).bind(id).first()) as ProductRow | null;

    return c.json({ success: true, data: created ? formatProduct(created) : null }, 201);
  });

  // PATCH /api/products/:id - Update product
  router.openapi(ProductRoutes.update as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as {
      slug?: string;
      categoryId?: string;
      basePrice?: number;
      price?: number;
      status?: string;
      images?: Array<{ url: string }>;
      tags?: string[];
      translations?: Array<{ locale: string; name: string; description?: string }>;
    };
    const user = c.get('user') as { id: string };
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (body.slug !== undefined) {
      const slugExists = await db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').bind(body.slug, id).first();
      if (slugExists) {
        return c.json({ success: false, error: 'Slug already exists' }, 409);
      }
      updates.push('slug = ?');
      params.push(body.slug);
    }
    if (body.categoryId !== undefined) { updates.push('category_id = ?'); params.push(body.categoryId); }
    if (body.basePrice !== undefined || body.price !== undefined) {
      updates.push('price = ?');
      params.push(body.basePrice ?? body.price ?? 0);
    }
    if (body.status !== undefined) {
      updates.push('is_available = ?');
      params.push(body.status === 'inactive' ? 0 : 1);
    }
    if (body.tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(body.tags)); }
    if (body.images !== undefined && body.images.length) {
      updates.push('image_url = ?');
      params.push(body.images[0]?.url || null);
    }
    if (body.translations?.length && body.translations[0]?.name) {
      updates.push('name = ?');
      params.push(body.translations[0].name);
      if (body.translations[0].description !== undefined) {
        updates.push('description = ?');
        params.push(body.translations[0].description);
      }
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    if (updates.length > 1) {
      await db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      await syncProductToMenuProjection(db, id);
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'product_update', 'product', id, JSON.stringify(body), now).run();

    const updated = (await db.prepare(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`
    ).bind(id).first()) as ProductRow | null;

    return c.json({ success: true, data: updated ? formatProduct(updated) : null });
  });

  // DELETE /api/products/:id - Delete product
  router.openapi(ProductRoutes.delete as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const user = c.get('user') as { id: string };
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()) as { name?: string; slug?: string } | null;
    if (!existing) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    // Check for order items referencing this product
    const orderItems = (await db.prepare('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?').bind(id).first()) as { count: number } | null;
    if (orderItems && orderItems.count > 0) {
      // Soft delete by setting is_available = 0
      await db.prepare('UPDATE products SET is_available = 0, updated_at = ? WHERE id = ?').bind(now, id).run();
      await syncProductAvailabilityProjection(db, id, 0);
    } else {
      await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
      await deleteProductProjection(db, id);
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'product_delete', 'product', id, JSON.stringify({ name: existing.name || existing.slug }), now).run();

    return c.json({ success: true, data: { success: true } });
  });
}
