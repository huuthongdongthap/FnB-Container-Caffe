import type { OpenAPIHono } from '@hono/zod-openapi';
import {
  ProductRoutes,
  syncProductToMenuProjection,
  syncProductAvailabilityProjection,
  deleteProductProjection,
} from '@aura/domain-catalog';
import type { Env } from '../../types/env';
import { getDatabase } from '../../lib/db';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import { formatProduct, matchesCatalogTenant, type ProductRow } from './helpers';

export const PRODUCT_WRITE_ROLES = ['owner', 'manager', 'supervisor', 'admin'];

function verifyProductWriteTenant(
  c: any,
  requireConcreteTenant = false
): { ok: true; tenantId: string } | { ok: false; status: 400 | 403; error: string } {
  const user = c.get('user') as { id?: string; role?: string; tenant_id?: string; tenantId?: string } | undefined;
  const candidateOverrides = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return { ok: false, status: 403, error: 'Conflicting tenant overrides denied' };
  }
  const requestedOverride = candidateOverrides[0] || '';

  if (!isHQSuperAdmin(c)) {
    const userTenant = (user?.tenant_id || user?.tenantId || '').trim() || 'default';
    if (userTenant === '*' || userTenant.toLowerCase() === 'hq') {
      return { ok: false, status: 403, error: 'Cross-tenant product write denied' };
    }
    if (
      requestedOverride &&
      (requestedOverride === '*' ||
        requestedOverride.toLowerCase() === 'hq' ||
        requestedOverride !== userTenant)
    ) {
      return { ok: false, status: 403, error: 'Cross-tenant product write denied' };
    }
    const ctxTenant = getTenantId(c).trim() || 'default';
    if (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== userTenant) {
      return { ok: false, status: 403, error: 'Cross-tenant product write denied' };
    }
    return { ok: true, tenantId: userTenant };
  }

  const rawResolved = requestedOverride || getTenantId(c).trim() || (user?.tenant_id || user?.tenantId || '').trim() || 'default';
  const resolved = rawResolved.toLowerCase() === 'hq' ? '*' : rawResolved;
  if (requireConcreteTenant && resolved === '*') {
    return { ok: false, status: 400, error: 'Concrete tenant_id required for product creation' };
  }
  return { ok: true, tenantId: resolved };
}

async function logProductAudit(
  db: any,
  userId: string,
  action: string,
  entityId: string,
  metadata: string,
  now: string,
  tenantId: string = 'default'
): Promise<void> {
  const writeTenant = tenantId && tenantId.trim() && tenantId.trim() !== '*' ? tenantId.trim() : 'default';
  let enrichedMeta = metadata;
  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.tenant_id === undefined) {
      enrichedMeta = JSON.stringify({ ...parsed, tenant_id: writeTenant });
    }
  } catch { /* non-JSON metadata */ }
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'product', entityId, enrichedMeta, writeTenant, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, userId, action, 'product', entityId, 'product', entityId, enrichedMeta, enrichedMeta, writeTenant, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'product', entityId, enrichedMeta, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, userId, userId, action, 'product', entityId, 'product', entityId, enrichedMeta, enrichedMeta, now).run();
        } catch {
          await db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, userId, action, 'product', entityId, enrichedMeta, now).run().catch(() => {});
        }
      }
    }
  }
  await db
    .prepare('UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = ? AND created_at = ?')
    .bind(writeTenant, entityId, entityId, action, now)
    .run()
    .catch(() => {});
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
    const user = c.get('user') as { id: string; role?: string } | undefined;
    if (!user?.id || (user.role && !PRODUCT_WRITE_ROLES.includes(user.role))) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const tenantCheck = verifyProductWriteTenant(c, false);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
    }
    const resolvedTenant = tenantCheck.tenantId;
    let writeTenant = resolvedTenant === '*' ? '' : resolvedTenant;
    const now = new Date().toISOString();

    const id = crypto.randomUUID();
    const name = body.translations?.[0]?.name || body.slug;
    const description = body.translations?.[0]?.description || null;
    const price = body.basePrice ?? body.price ?? 0;
    const imageUrl = body.images?.[0]?.url || body.imageUrl || null;
    const tags = JSON.stringify(body.tags || []);
    const isAvailable = body.status === 'inactive' ? 0 : 1;

    // Verify category belongs to same tenant when present, and inherit concrete category tenant under wildcard scope
    if (body.categoryId) {
      const catRow =
        typeof db?.prepare === 'function'
          ? await db.prepare('SELECT * FROM categories WHERE id = ?').bind(body.categoryId).first().catch(() => null)
          : null;
      if (catRow && resolvedTenant === '*') {
        const rawCatTenant = typeof (catRow as Record<string, unknown>).tenant_id === 'string'
          ? String((catRow as Record<string, unknown>).tenant_id).trim()
          : '';
        writeTenant =
          rawCatTenant && rawCatTenant !== '*' && rawCatTenant.toLowerCase() !== 'hq'
            ? rawCatTenant
            : 'default';
      }
      if (catRow && writeTenant && !matchesCatalogTenant(catRow, writeTenant)) {
        return c.json({ success: false, error: 'Category not found' }, 404);
      }
    }
    if (!writeTenant || writeTenant === '*') {
      return c.json({ success: false, error: 'Concrete tenant_id required for product creation' }, 400);
    }
    const targetTenant = writeTenant;

    // Check slug uniqueness within tenant
    if (body.slug) {
      let hasSlugConflict = false;
      try {
        const allRes = await db.prepare('SELECT * FROM products WHERE slug = ?').bind(body.slug).all<Record<string, unknown>>().catch(() => null);
        if (allRes && Array.isArray(allRes.results) && allRes.results.length > 0) {
          hasSlugConflict = allRes.results.some((r) => matchesCatalogTenant(r, targetTenant));
        } else {
          const existing = await db.prepare('SELECT * FROM products WHERE slug = ?').bind(body.slug).first();
          hasSlugConflict = Boolean(existing && matchesCatalogTenant(existing, targetTenant));
        }
      } catch {
        hasSlugConflict = false;
      }
      if (hasSlugConflict) {
        return c.json({ success: false, error: 'Slug already exists' }, 409);
      }
    }

    try {
      await db.prepare(
        `INSERT INTO products (id, category_id, name, slug, price, compare_at_price, description, image_url, tags, is_available, sort_order, tenant_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        writeTenant,
        now,
        now
      ).run();
    } catch (err) {
      if (writeTenant !== 'default') throw err;
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
      await db.prepare('UPDATE products SET tenant_id = ? WHERE id = ?').bind(writeTenant, id).run().catch(() => {});
    }

    // Audit log
    await logProductAudit(db, user.id, 'product_create', id, JSON.stringify(body), now, writeTenant);

    await syncProductToMenuProjection(db, id, writeTenant);

    let created: ProductRow | null = null;
    try {
      created = (await db.prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
           AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
         WHERE p.id = ?`
      ).bind(id).first()) as ProductRow | null;
    } catch (err) {
      if (writeTenant !== 'default') throw err;
      created = (await db.prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      ).bind(id).first()) as ProductRow | null;
    }

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
    const user = c.get('user') as { id: string; role?: string } | undefined;
    if (!user?.id || (user.role && !PRODUCT_WRITE_ROLES.includes(user.role))) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const tenantCheck = verifyProductWriteTenant(c, false);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
    }
    const tenantId = tenantCheck.tenantId;
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first() as { tenant_id?: string | null } | null;
    if (!existing || !matchesCatalogTenant(existing, tenantId)) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    const rawExistingProdTenant = typeof existing.tenant_id === 'string' ? existing.tenant_id.trim() : '';
    const effectiveTenant = tenantId === '*'
      ? ((rawExistingProdTenant && rawExistingProdTenant !== '*' && rawExistingProdTenant.toLowerCase() !== 'hq' ? rawExistingProdTenant : '') || 'default')
      : tenantId;

    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    const canonicalUpdates: string[] = [];
    const canonicalParams: (string | number | null)[] = [];

    if (body.slug !== undefined) {
      let hasSlugConflict = false;
      try {
        const allRes = await db.prepare('SELECT * FROM products WHERE slug = ? AND id != ?').bind(body.slug, id).all<Record<string, unknown>>().catch(() => null);
        if (allRes && Array.isArray(allRes.results) && allRes.results.length > 0) {
          hasSlugConflict = allRes.results.some((r) => matchesCatalogTenant(r, effectiveTenant));
        } else {
          const slugExists = await db.prepare('SELECT * FROM products WHERE slug = ? AND id != ?').bind(body.slug, id).first();
          hasSlugConflict = Boolean(slugExists && matchesCatalogTenant(slugExists, effectiveTenant));
        }
      } catch {
        hasSlugConflict = false;
      }
      if (hasSlugConflict) {
        return c.json({ success: false, error: 'Slug already exists' }, 409);
      }
      updates.push('slug = ?');
      params.push(body.slug);
    }
    if (body.categoryId !== undefined) {
      const catRow = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(body.categoryId).first().catch(() => null);
      if (catRow && !matchesCatalogTenant(catRow, effectiveTenant)) {
        return c.json({ success: false, error: 'Category not found' }, 404);
      }
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

    canonicalUpdates.push('updated_at = ?');
    canonicalParams.push(now);

    if (updates.length > 1) {
      try {
        await db.prepare(
          `UPDATE products SET ${updates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        ).bind(...params, id, effectiveTenant).run();
      } catch {
        if (canonicalUpdates.length > 1) {
          try {
            await db.prepare(
              `UPDATE products SET ${canonicalUpdates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(...canonicalParams, id, effectiveTenant).run();
          } catch {
            if (effectiveTenant === 'default') {
              await db.prepare(`UPDATE products SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams, id).run();
            }
          }
        } else if (effectiveTenant === 'default') {
          await db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).bind(...params, id).run();
        }
      }
      await syncProductToMenuProjection(db, id, effectiveTenant);
    }

    // Audit log
    await logProductAudit(db, user.id, 'product_update', id, JSON.stringify(body), now, effectiveTenant);

    let updated: ProductRow | null = null;
    try {
      updated = (await db.prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
           AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
         WHERE p.id = ?`
      ).bind(id).first()) as ProductRow | null;
    } catch (err) {
      if (effectiveTenant !== 'default') throw err;
      updated = (await db.prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      ).bind(id).first()) as ProductRow | null;
    }

    return c.json({ success: true, data: updated ? formatProduct(updated) : null });
  });

  // DELETE /api/products/:id - Delete product
  router.openapi(ProductRoutes.delete as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const user = c.get('user') as { id: string; role?: string } | undefined;
    if (!user?.id || (user.role && !PRODUCT_WRITE_ROLES.includes(user.role))) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const tenantCheck = verifyProductWriteTenant(c, false);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
    }
    const tenantId = tenantCheck.tenantId;
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()) as { name?: string; slug?: string; tenant_id?: string | null } | null;
    if (!existing || !matchesCatalogTenant(existing, tenantId)) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }
    const rawExistingProdTenant = typeof existing.tenant_id === 'string' ? existing.tenant_id.trim() : '';
    const effectiveTenant = tenantId === '*'
      ? ((rawExistingProdTenant && rawExistingProdTenant !== '*' && rawExistingProdTenant.toLowerCase() !== 'hq' ? rawExistingProdTenant : '') || 'default')
      : tenantId;

    // Check for order items referencing this product within effectiveTenant
    let orderItems: { count: number } | null = null;
    try {
      orderItems = (await db.prepare('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?').bind(id).first()) as { count: number } | null;
    } catch {
      orderItems = null;
    }
    let hasTenantOrderItems = Boolean(orderItems && orderItems.count > 0);
    if (hasTenantOrderItems) {
      const oiRowsRes = await db.prepare('SELECT * FROM order_items WHERE product_id = ?').bind(id).all<Record<string, unknown>>().catch(() => null);
      if (oiRowsRes && Array.isArray(oiRowsRes.results) && oiRowsRes.results.length > 0) {
        hasTenantOrderItems = oiRowsRes.results.some((oi) => matchesCatalogTenant(oi, effectiveTenant));
      }
    }
    if (hasTenantOrderItems) {
      // Soft delete by setting is_available = 0
      const softDeleteSql = effectiveTenant === 'default'
        ? "UPDATE products SET is_available = 0, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'"
        : "UPDATE products SET is_available = 0, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
      const softDeleteArgs = effectiveTenant === 'default' ? [now, id] : [now, id, effectiveTenant];
      await db.prepare(softDeleteSql).bind(...softDeleteArgs).run().catch(async () => {
        if (effectiveTenant === 'default') {
          await db.prepare('UPDATE products SET is_available = 0, updated_at = ? WHERE id = ?').bind(now, id).run();
        }
      });
      await syncProductAvailabilityProjection(db, id, 0, effectiveTenant);
    } else {
      await db.prepare(
        "DELETE FROM products WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, effectiveTenant).run().catch(async () => {
        if (effectiveTenant === 'default') {
          await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
        }
      });
      await deleteProductProjection(db, id, effectiveTenant);
    }

    // Audit log
    await logProductAudit(db, user.id, 'product_delete', id, JSON.stringify({ name: existing.name || existing.slug }), now, effectiveTenant);

    return c.json({ success: true, data: { success: true } });
  });
}
