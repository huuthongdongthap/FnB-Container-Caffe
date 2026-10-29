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

async function logProductAudit(
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
    ).bind(`audit_${Date.now()}`, userId, action, 'product', entityId, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, userId, action, 'product', entityId, 'product', entityId, metadata, metadata, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, userId, action, 'product', entityId, metadata, now).run().catch(() => {});
      } catch {
        // Ignore audit log failure
      }
    }
  }
}

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
      let existing: unknown = null;
      try {
        existing = await db.prepare('SELECT id FROM products WHERE slug = ?').bind(body.slug).first();
      } catch {
        existing = null;
      }
      if (existing) {
        return c.json({ success: false, error: 'Slug already exists' }, 409);
      }
    }

    try {
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
    } catch {
      await db.prepare(
        `INSERT INTO products (id, name, description, price, category_id, image_url, is_available, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        name,
        description,
        price,
        body.categoryId,
        imageUrl,
        isAvailable,
        now,
        now
      ).run();
    }

    // Audit log
    await logProductAudit(db, user.id, 'product_create', id, JSON.stringify(body), now);

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
    const canonicalUpdates: string[] = [];
    const canonicalParams: (string | number | null)[] = [];

    if (body.slug !== undefined) {
      let slugExists: unknown = null;
      try {
        slugExists = await db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').bind(body.slug, id).first();
      } catch {
        slugExists = null;
      }
      if (slugExists) {
        return c.json({ success: false, error: 'Slug already exists' }, 409);
      }
      updates.push('slug = ?');
      params.push(body.slug);
    }
    if (body.categoryId !== undefined) {
      updates.push('category_id = ?');
      params.push(body.categoryId);
      canonicalUpdates.push('category_id = ?');
      canonicalParams.push(body.categoryId);
    }
    if (body.basePrice !== undefined || body.price !== undefined) {
      const nextPrice = body.basePrice ?? body.price ?? 0;
      updates.push('price = ?');
      params.push(nextPrice);
      canonicalUpdates.push('price = ?');
      canonicalParams.push(nextPrice);
    }
    if (body.status !== undefined) {
      const avail = body.status === 'inactive' ? 0 : 1;
      updates.push('is_available = ?');
      params.push(avail);
      canonicalUpdates.push('is_available = ?');
      canonicalParams.push(avail);
    }
    if (body.tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(body.tags)); }
    if (body.images !== undefined && body.images.length) {
      const imgUrl = body.images[0]?.url || null;
      updates.push('image_url = ?');
      params.push(imgUrl);
      canonicalUpdates.push('image_url = ?');
      canonicalParams.push(imgUrl);
    }
    if (body.translations?.length && body.translations[0]?.name) {
      updates.push('name = ?');
      params.push(body.translations[0].name);
      canonicalUpdates.push('name = ?');
      canonicalParams.push(body.translations[0].name);
      if (body.translations[0].description !== undefined) {
        updates.push('description = ?');
        params.push(body.translations[0].description);
        canonicalUpdates.push('description = ?');
        canonicalParams.push(body.translations[0].description);
      }
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    canonicalUpdates.push('updated_at = ?');
    canonicalParams.push(now);
    canonicalParams.push(id);

    if (updates.length > 1) {
      try {
        await db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      } catch {
        if (canonicalUpdates.length > 1) {
          await db.prepare(`UPDATE products SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams).run();
        }
      }
      await syncProductToMenuProjection(db, id);
    }

    // Audit log
    await logProductAudit(db, user.id, 'product_update', id, JSON.stringify(body), now);

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
    let orderItems: { count: number } | null = null;
    try {
      orderItems = (await db.prepare('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?').bind(id).first()) as { count: number } | null;
    } catch {
      orderItems = null;
    }
    if (orderItems && orderItems.count > 0) {
      // Soft delete by setting is_available = 0
      await db.prepare('UPDATE products SET is_available = 0, updated_at = ? WHERE id = ?').bind(now, id).run();
      await syncProductAvailabilityProjection(db, id, 0);
    } else {
      await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
      await deleteProductProjection(db, id);
    }

    // Audit log
    await logProductAudit(db, user.id, 'product_delete', id, JSON.stringify({ name: existing.name || existing.slug }), now);

    return c.json({ success: true, data: { success: true } });
  });
}
