import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PromotionRoutes } from '../../schemas/promotions';
import { getDatabase } from '../../lib/db';

async function writePromotionAuditLog(
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
    ).bind(`audit_${Date.now()}`, userId, action, 'promotion', entityId, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, userId, action, 'promotion', entityId, 'promotion', entityId, metadata, metadata, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, userId, action, 'promotion', entityId, metadata, now).run().catch(() => {});
      } catch {
        // Ignore audit log error
      }
    }
  }
}

function mapPromotionRow(p: any) {
  const rawDiscountType = p.discount_type === 'percent' ? 'percentage' : (p.discount_type ?? 'percentage');
  const discountValue = Number(p.discount_value ?? p.percent ?? 0);
  return {
    ...p,
    type: p.type ?? rawDiscountType,
    discountValue,
    discountType: rawDiscountType,
    maxUses: p.max_uses ?? p.usage_limit ?? null,
    currentUses: p.current_uses ?? p.used_count ?? p.usage_count ?? 0,
    minOrderValue: p.min_order_value ?? p.min_order ?? null,
    maxDiscountValue: p.max_discount_value ?? p.max_discount ?? null,
    validFrom: p.valid_from ?? null,
    validTo: p.valid_to ?? p.expires_at ?? null,
    isActive: p.is_active,
    applicableItems: p.applicable_items ? JSON.parse(p.applicable_items) : null,
    excludedItems: p.excluded_items ? JSON.parse(p.excluded_items) : null,
    createdAt: p.created_at,
    updatedAt: p.updated_at ?? p.created_at,
  };
}

export function registerCrudHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/promotions - List promotions
  app.openapi(PromotionRoutes.list as any, async (c: any) => {
    const db = getDatabase(c);
    const query = c.req.valid('query');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: (string | number | boolean)[] = [];

    if (query.isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(query.isActive ? 1 : 0);
    }

    if (query.type) {
      whereClause += ' AND type = ?';
      params.push(query.type);
    }

    if (query.search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ? OR code LIKE ?)';
      const searchParam = `%${query.search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    let total = 0;
    let promotionResults: any[] = [];
    try {
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM promotions ${whereClause}`).bind(...params).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const promotions = (await db.prepare(
        `SELECT * FROM promotions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all()) as { results: any[] };
      promotionResults = promotions.results || [];
    } catch {
      const canonicalWhere = whereClause.replace('AND type = ?', 'AND discount_type = ?');
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM promotions ${canonicalWhere}`).bind(...params).first().catch(() => null)) as { total: number } | null;
      total = countResult?.total || 0;

      const promotions = (await db.prepare(
        `SELECT * FROM promotions ${canonicalWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all().catch(() => ({ results: [] }))) as { results: any[] };
      promotionResults = promotions.results || [];
    }

    return c.json({
      success: true,
      data: {
        promotions: promotionResults.map(mapPromotionRow),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  });

  // GET /api/promotions/{id} - Get promotion by ID
  app.openapi(PromotionRoutes.get as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');

    const promotion = (await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first()) as any;

    if (!promotion) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    return c.json({
      success: true,
      data: mapPromotionRow(promotion),
    });
  });

  // POST /api/promotions - Create promotion
  app.openapi(PromotionRoutes.create as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    if (user?.role === 'customer' || (user?.role && !['owner', 'manager', 'admin', 'staff'].includes(user.role))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const id = crypto.randomUUID();

    try {
      await db.prepare(
        `INSERT INTO promotions (id, name, description, code, type, discount_value, discount_type, max_uses, current_uses, min_order_value, max_discount_value, valid_from, valid_to, is_active, applicable_items, excluded_items, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.name,
        body.description || null,
        body.code.toUpperCase(),
        body.type,
        body.discountValue,
        body.discountType,
        body.maxUses || null,
        0,
        body.minOrderValue || null,
        body.maxDiscountValue || null,
        body.validFrom || null,
        body.validTo || null,
        body.isActive !== false ? 1 : 0,
        body.applicableItems ? JSON.stringify(body.applicableItems) : null,
        body.excludedItems ? JSON.stringify(body.excludedItems) : null,
        now,
        now
      ).run();
    } catch {
      const canonicalDiscountType = body.discountType === 'percentage' ? 'percent' : (body.discountType || 'fixed');
      try {
        await db.prepare(
          `INSERT INTO promotions (id, code, name, description, discount_type, discount_value, min_order, max_discount, usage_limit, used_count, is_active, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
        ).bind(
          id,
          body.code.toUpperCase(),
          body.name,
          body.description || null,
          canonicalDiscountType,
          body.discountValue,
          body.minOrderValue || 0,
          body.maxDiscountValue || null,
          body.maxUses || null,
          body.isActive !== false ? 1 : 0,
          body.validTo || null,
          now
        ).run();
      } catch {
        await db.prepare(
          `INSERT INTO promotions (code, percent, max_discount, min_order, usage_limit, usage_count, expires_at, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
        ).bind(
          body.code.toUpperCase(),
          body.discountValue ?? 0,
          body.maxDiscountValue || 0,
          body.minOrderValue || 0,
          body.maxUses || 100,
          body.validTo || null,
          body.isActive !== false ? 1 : 0,
          now
        ).run();
      }
    }

    await writePromotionAuditLog(db, user.id, 'promotion_create', id, JSON.stringify(body), now);

    const promotion = (await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first()) as any;

    return c.json({
      success: true,
      data: mapPromotionRow(promotion!),
    }, 201);
  });

  // PATCH /api/promotions/{id} - Update promotion
  app.openapi(PromotionRoutes.update as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    if (user?.role === 'customer' || (user?.role && !['owner', 'manager', 'admin', 'staff'].includes(user.role))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first()) as any;
    if (!existing) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    const canonicalUpdates: string[] = [];
    const canonicalParams: (string | number | boolean | null)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?'); params.push(body.name);
      canonicalUpdates.push('name = ?'); canonicalParams.push(body.name);
    }
    if (body.description !== undefined) {
      updates.push('description = ?'); params.push(body.description);
      canonicalUpdates.push('description = ?'); canonicalParams.push(body.description);
    }
    if (body.code !== undefined) {
      updates.push('code = ?'); params.push(body.code.toUpperCase());
      canonicalUpdates.push('code = ?'); canonicalParams.push(body.code.toUpperCase());
    }
    if (body.type !== undefined) { updates.push('type = ?'); params.push(body.type); }
    if (body.discountValue !== undefined) {
      updates.push('discount_value = ?'); params.push(body.discountValue);
      canonicalUpdates.push('discount_value = ?'); canonicalParams.push(body.discountValue);
    }
    if (body.discountType !== undefined) {
      updates.push('discount_type = ?'); params.push(body.discountType);
      canonicalUpdates.push('discount_type = ?');
      canonicalParams.push(body.discountType === 'percentage' ? 'percent' : body.discountType);
    }
    if (body.maxUses !== undefined) {
      updates.push('max_uses = ?'); params.push(body.maxUses);
      canonicalUpdates.push('usage_limit = ?'); canonicalParams.push(body.maxUses);
    }
    if (body.minOrderValue !== undefined) {
      updates.push('min_order_value = ?'); params.push(body.minOrderValue);
      canonicalUpdates.push('min_order = ?'); canonicalParams.push(body.minOrderValue);
    }
    if (body.maxDiscountValue !== undefined) {
      updates.push('max_discount_value = ?'); params.push(body.maxDiscountValue);
      canonicalUpdates.push('max_discount = ?'); canonicalParams.push(body.maxDiscountValue);
    }
    if (body.validFrom !== undefined) { updates.push('valid_from = ?'); params.push(body.validFrom); }
    if (body.validTo !== undefined) {
      updates.push('valid_to = ?'); params.push(body.validTo);
      canonicalUpdates.push('expires_at = ?'); canonicalParams.push(body.validTo);
    }
    if (body.isActive !== undefined) {
      updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0);
      canonicalUpdates.push('is_active = ?'); canonicalParams.push(body.isActive ? 1 : 0);
    }
    if (body.applicableItems !== undefined) { updates.push('applicable_items = ?'); params.push(body.applicableItems ? JSON.stringify(body.applicableItems) : null); }
    if (body.excludedItems !== undefined) { updates.push('excluded_items = ?'); params.push(body.excludedItems ? JSON.stringify(body.excludedItems) : null); }

    if (updates.length === 0) {
      return c.json({
        success: true,
        data: mapPromotionRow(existing),
      });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    try {
      await db.prepare(`UPDATE promotions SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    } catch {
      if (canonicalUpdates.length > 0) {
        await db.prepare(`UPDATE promotions SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams, id).run();
      }
    }

    await writePromotionAuditLog(db, user.id, 'promotion_update', id, JSON.stringify(body), now);

    const promotion = (await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first()) as any;

    return c.json({
      success: true,
      data: mapPromotionRow(promotion!),
    });
  });

  // DELETE /api/promotions/{id} - Delete promotion
  app.openapi(PromotionRoutes.delete as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    if (user?.role === 'customer' || (user?.role && !['owner', 'manager', 'admin', 'staff'].includes(user.role))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const { id } = c.req.valid('param');
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first()) as any;
    if (!existing) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    await db.prepare('DELETE FROM promotions WHERE id = ?').bind(id).run();

    await writePromotionAuditLog(db, user.id, 'promotion_delete', id, JSON.stringify({ name: existing.name }), now);

    return c.json({ success: true, message: 'Promotion deleted successfully' });
  });
}

