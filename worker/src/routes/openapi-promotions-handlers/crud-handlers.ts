import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { PromotionRoutes } from '../../schemas/promotions';

export function registerCrudHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/promotions - List promotions
  app.openapi(PromotionRoutes.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
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

    const countResult = await db.prepare(`SELECT COUNT(*) as total FROM promotions ${whereClause}`).bind(...params).first();
    const total = countResult?.total || 0;

    const promotions = await db.prepare(
      `SELECT * FROM promotions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return c.json({
      success: true,
      data: {
        promotions: promotions.results.map(p => ({
          ...p,
          discountValue: p.discount_value,
          discountType: p.discount_type,
          maxUses: p.max_uses,
          currentUses: p.current_uses,
          minOrderValue: p.min_order_value,
          maxDiscountValue: p.max_discount_value,
          validFrom: p.valid_from,
          validTo: p.valid_to,
          isActive: p.is_active,
          applicableItems: p.applicable_items ? JSON.parse(p.applicable_items) : null,
          excludedItems: p.excluded_items ? JSON.parse(p.excluded_items) : null,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  });

  // GET /api/promotions/{id} - Get promotion by ID
  app.openapi(PromotionRoutes.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const { id } = c.req.valid('param');

    const promotion = await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first();

    if (!promotion) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...promotion,
        discountValue: promotion.discount_value,
        discountType: promotion.discount_type,
        maxUses: promotion.max_uses,
        currentUses: promotion.current_uses,
        minOrderValue: promotion.min_order_value,
        maxDiscountValue: promotion.max_discount_value,
        validFrom: promotion.valid_from,
        validTo: promotion.valid_to,
        isActive: promotion.is_active,
        applicableItems: promotion.applicable_items ? JSON.parse(promotion.applicable_items) : null,
        excludedItems: promotion.excluded_items ? JSON.parse(promotion.excluded_items) : null,
        createdAt: promotion.created_at,
        updatedAt: promotion.updated_at,
      },
    });
  });

  // POST /api/promotions - Create promotion
  app.openapi(PromotionRoutes.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const id = crypto.randomUUID();

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

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'promotion_create', 'promotion', id, JSON.stringify(body), now).run();

    const promotion = await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first();

    return c.json({
      success: true,
      data: {
        ...promotion!,
        discountValue: promotion!.discount_value,
        discountType: promotion!.discount_type,
        maxUses: promotion!.max_uses,
        currentUses: promotion!.current_uses,
        minOrderValue: promotion!.min_order_value,
        maxDiscountValue: promotion!.max_discount_value,
        validFrom: promotion!.valid_from,
        validTo: promotion!.valid_to,
        isActive: promotion!.is_active,
        applicableItems: promotion!.applicable_items ? JSON.parse(promotion!.applicable_items) : null,
        excludedItems: promotion!.excluded_items ? JSON.parse(promotion!.excluded_items) : null,
        createdAt: promotion!.created_at,
        updatedAt: promotion!.updated_at,
      },
    }, 201);
  });

  // PATCH /api/promotions/{id} - Update promotion
  app.openapi(PromotionRoutes.update, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];

    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
    if (body.code !== undefined) { updates.push('code = ?'); params.push(body.code.toUpperCase()); }
    if (body.type !== undefined) { updates.push('type = ?'); params.push(body.type); }
    if (body.discountValue !== undefined) { updates.push('discount_value = ?'); params.push(body.discountValue); }
    if (body.discountType !== undefined) { updates.push('discount_type = ?'); params.push(body.discountType); }
    if (body.maxUses !== undefined) { updates.push('max_uses = ?'); params.push(body.maxUses); }
    if (body.minOrderValue !== undefined) { updates.push('min_order_value = ?'); params.push(body.minOrderValue); }
    if (body.maxDiscountValue !== undefined) { updates.push('max_discount_value = ?'); params.push(body.maxDiscountValue); }
    if (body.validFrom !== undefined) { updates.push('valid_from = ?'); params.push(body.validFrom); }
    if (body.validTo !== undefined) { updates.push('valid_to = ?'); params.push(body.validTo); }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }
    if (body.applicableItems !== undefined) { updates.push('applicable_items = ?'); params.push(body.applicableItems ? JSON.stringify(body.applicableItems) : null); }
    if (body.excludedItems !== undefined) { updates.push('excluded_items = ?'); params.push(body.excludedItems ? JSON.stringify(body.excludedItems) : null); }

    if (updates.length === 0) {
      return c.json({
        success: true,
        data: {
          ...existing,
          discountValue: existing.discount_value,
          discountType: existing.discount_type,
          maxUses: existing.max_uses,
          currentUses: existing.current_uses,
          minOrderValue: existing.min_order_value,
          maxDiscountValue: existing.max_discount_value,
          validFrom: existing.valid_from,
          validTo: existing.valid_to,
          isActive: existing.is_active,
          applicableItems: existing.applicable_items ? JSON.parse(existing.applicable_items) : null,
          excludedItems: existing.excluded_items ? JSON.parse(existing.excluded_items) : null,
          createdAt: existing.created_at,
          updatedAt: existing.updated_at,
        },
      });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await db.prepare(`UPDATE promotions SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'promotion_update', 'promotion', id, JSON.stringify(body), now).run();

    const promotion = await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first();

    return c.json({
      success: true,
      data: {
        ...promotion!,
        discountValue: promotion!.discount_value,
        discountType: promotion!.discount_type,
        maxUses: promotion!.max_uses,
        currentUses: promotion!.current_uses,
        minOrderValue: promotion!.min_order_value,
        maxDiscountValue: promotion!.max_discount_value,
        validFrom: promotion!.valid_from,
        validTo: promotion!.valid_to,
        isActive: promotion!.is_active,
        applicableItems: promotion!.applicable_items ? JSON.parse(promotion!.applicable_items) : null,
        excludedItems: promotion!.excluded_items ? JSON.parse(promotion!.excluded_items) : null,
        createdAt: promotion!.created_at,
        updatedAt: promotion!.updated_at,
      },
    });
  });

  // DELETE /api/promotions/{id} - Delete promotion
  app.openapi(PromotionRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const { id } = c.req.valid('param');

    const existing = await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    await db.prepare('DELETE FROM promotions WHERE id = ?').bind(id).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'promotion_delete', 'promotion', id, JSON.stringify({ name: existing.name }), new Date().toISOString()).run();

    return c.json({ success: true, message: 'Promotion deleted successfully' });
  });
}