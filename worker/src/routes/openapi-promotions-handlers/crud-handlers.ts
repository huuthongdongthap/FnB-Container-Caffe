import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PromotionRoutes } from '../../schemas/promotions';
import { getDatabase } from '../../lib/db';
import { matchesTenantRow } from '../../middleware/tenant';
import {
  PROMO_READ_ROLES,
   findOpenApiPromotionById,
  mapPromotionRow,
  resolveOpenApiPromoReadTenantId,
  resolveOpenApiPromoWriteTenantId,
  verifyOpenApiPromoTenant,
  writePromotionAuditLog,
} from './helpers';

const PROMO_WRITE_ROLES = ['owner', 'manager', 'admin'];

async function insertPromotionForTenant(
  db: any,
  id: string,
  upperCode: string,
  body: any,
  tenantId: string,
  now: string,
): Promise<boolean> {
  const isActive = body.isActive !== false ? 1 : 0;
  const appItems = body.applicableItems ? JSON.stringify(body.applicableItems) : null;
  const excItems = body.excludedItems ? JSON.stringify(body.excludedItems) : null;
  const canonicalDiscountType = body.discountType === 'percentage' ? 'percent' : (body.discountType || 'fixed');

  try {
    await db
      .prepare(
        `INSERT INTO promotions (id, name, description, code, type, discount_value, discount_type, max_uses, current_uses, min_order_value, max_discount_value, valid_from, valid_to, is_active, applicable_items, excluded_items, tenant_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id, body.name, body.description || null, upperCode, body.type, body.discountValue, body.discountType,
        body.maxUses || null, 0, body.minOrderValue || null, body.maxDiscountValue || null,
        body.validFrom || null, body.validTo || null, isActive, appItems, excItems, tenantId, now, now
      )
      .run();
    return true;
  } catch {
    try {
      await db
        .prepare(
          `INSERT INTO promotions (id, code, name, description, discount_type, discount_value, min_order, max_discount, usage_limit, used_count, is_active, expires_at, tenant_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
        )
        .bind(
          id, upperCode, body.name, body.description || null, canonicalDiscountType, body.discountValue,
          body.minOrderValue || 0, body.maxDiscountValue || null, body.maxUses || null,
          isActive, body.validTo || null, tenantId, now
        )
        .run();
      return true;
    } catch {
      try {
        await db
          .prepare(
            `INSERT INTO promotions (id, code, name, description, type, value, min_order, max_discount, usage_limit, usage_count, start_date, end_date, is_active, tenant_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id, upperCode, body.name, body.description || null, body.type || canonicalDiscountType, body.discountValue ?? 0,
            body.minOrderValue || 0, body.maxDiscountValue || null, body.maxUses || null,
            body.validFrom || now, body.validTo || now, isActive, tenantId, now, now
          )
          .run();
        return true;
      } catch {
        if (tenantId !== 'default') {
          return false;
        }
      }
    }
  }

  try {
    await db
      .prepare(
        `INSERT INTO promotions (id, name, description, code, type, discount_value, discount_type, max_uses, current_uses, min_order_value, max_discount_value, valid_from, valid_to, is_active, applicable_items, excluded_items, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id, body.name, body.description || null, upperCode, body.type, body.discountValue, body.discountType,
        body.maxUses || null, 0, body.minOrderValue || null, body.maxDiscountValue || null,
        body.validFrom || null, body.validTo || null, isActive, appItems, excItems, now, now
      )
      .run();
    return true;
  } catch {
    try {
      await db
        .prepare(
          `INSERT INTO promotions (id, code, name, description, discount_type, discount_value, min_order, max_discount, usage_limit, used_count, is_active, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
        )
        .bind(
          id, upperCode, body.name, body.description || null, canonicalDiscountType, body.discountValue,
          body.minOrderValue || 0, body.maxDiscountValue || null, body.maxUses || null,
          isActive, body.validTo || null, now
        )
        .run();
      return true;
    } catch {
      await db
        .prepare(
          `INSERT INTO promotions (code, percent, max_discount, min_order, usage_limit, usage_count, expires_at, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
        )
        .bind(
          upperCode, body.discountValue ?? 0, body.maxDiscountValue || 0,
          body.minOrderValue || 0, body.maxUses || 100, body.validTo || null, isActive, now
        )
        .run();
      return true;
    }
  }
}

export function registerCrudHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/promotions - List promotions
  app.openapi(PromotionRoutes.list as any, async (c: any) => {
    const authErr = verifyOpenApiPromoTenant(c, PROMO_READ_ROLES, false);
    if (authErr) return authErr;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiPromoReadTenantId(c);
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
    if (tenantId !== '*') {
      const scopedWhere = `${whereClause} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`;
      const scopedParams = [...params, tenantId];
      let allRows: any[] = [];
      try {
        const promotions = (await db
          .prepare(`SELECT * FROM promotions ${scopedWhere} ORDER BY created_at DESC`)
          .bind(...scopedParams)
          .all()) as { results: any[] };
        allRows = promotions.results || [];
      } catch {
        const canonicalWhere = scopedWhere.replace('AND type = ?', 'AND discount_type = ?');
        try {
          const promotions = (await db
            .prepare(`SELECT * FROM promotions ${canonicalWhere} ORDER BY created_at DESC`)
            .bind(...scopedParams)
            .all()) as { results: any[] };
          allRows = promotions.results || [];
        } catch {
          if (tenantId === 'default') {
            const fallbackWhere = whereClause.replace('AND type = ?', 'AND discount_type = ?');
            const promotions = (await db
              .prepare(`SELECT * FROM promotions ${fallbackWhere} ORDER BY created_at DESC`)
              .bind(...params)
              .all()
              .catch(() => ({ results: [] }))) as { results: any[] };
            allRows = promotions.results || [];
          }
        }
      }
      const filtered = allRows.filter((p) => matchesTenantRow(p, tenantId));
      total = filtered.length;
      promotionResults = filtered.slice(offset, offset + limit);
    } else {
      try {
        const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM promotions ${whereClause}`).bind(...params).first()) as { total: number } | null;
        total = countResult?.total || 0;
        const promotions = (await db
          .prepare(`SELECT * FROM promotions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
          .bind(...params, limit, offset)
          .all()) as { results: any[] };
        promotionResults = promotions.results || [];
      } catch {
        const canonicalWhere = whereClause.replace('AND type = ?', 'AND discount_type = ?');
        const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM promotions ${canonicalWhere}`).bind(...params).first().catch(() => null)) as { total: number } | null;
        total = countResult?.total || 0;
        const promotions = (await db
          .prepare(`SELECT * FROM promotions ${canonicalWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
          .bind(...params, limit, offset)
          .all()
          .catch(() => ({ results: [] }))) as { results: any[] };
        promotionResults = promotions.results || [];
      }
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
    const authErr = verifyOpenApiPromoTenant(c, PROMO_READ_ROLES, false);
    if (authErr) return authErr;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiPromoReadTenantId(c);
    const { id } = c.req.valid('param');

    const promotion = await findOpenApiPromotionById(db, id, tenantId);
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
    const authErr = verifyOpenApiPromoTenant(c, PROMO_WRITE_ROLES, true);
    if (authErr) return authErr;

    const db = getDatabase(c);
    const rawTenantId = resolveOpenApiPromoWriteTenantId(c);
    const tenantId = rawTenantId === '*' ? 'default' : rawTenantId;
    const user = c.get('user');
    const body = c.req.valid('json');
    const upperCode = body.code.trim().toUpperCase();
    const now = new Date().toISOString();

    const scopedDup = await db
      .prepare("SELECT * FROM promotions WHERE UPPER(code) = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(upperCode, tenantId)
      .all<Record<string, unknown>>()
      .catch(() => null);
    const existingRes = scopedDup ?? (await db
      .prepare('SELECT * FROM promotions WHERE UPPER(code) = ?')
      .bind(upperCode)
      .all<Record<string, unknown>>()
      .catch(() => ({ results: [] as Record<string, unknown>[] })));
    if ((existingRes.results || []).some((row) => matchesTenantRow(row, tenantId))) {
      return c.json({ success: false, error: 'Promotion code already exists' }, 409);
    }

    const id = crypto.randomUUID();
    const inserted = await insertPromotionForTenant(db, id, upperCode, body, tenantId, now);
    if (!inserted) {
      return c.json({ success: false, error: 'Failed to create promotion' }, 500);
    }

    await writePromotionAuditLog(db, user.id, 'promotion_create', id, JSON.stringify(body), now, tenantId);
    const promotion = await findOpenApiPromotionById(db, id, tenantId);

    return c.json(
      {
        success: true,
        data: mapPromotionRow(promotion!),
      },
      201,
    );
  });

  // PATCH /api/promotions/{id} - Update promotion
  app.openapi(PromotionRoutes.update as any, async (c: any) => {
    const authErr = verifyOpenApiPromoTenant(c, PROMO_WRITE_ROLES, true);
    if (authErr) return authErr;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiPromoWriteTenantId(c);
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = await findOpenApiPromotionById(db, id, tenantId);
    if (!existing) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    const effectiveTenant =
      tenantId === '*'
        ? (typeof existing.tenant_id === 'string' && existing.tenant_id.trim()) || 'default'
        : tenantId;
    const targetId = String(existing.id || id);

    if (body.code !== undefined) {
      const upperCode = body.code.trim().toUpperCase();
      const dupRes = await db
        .prepare("SELECT * FROM promotions WHERE UPPER(code) = ? AND id != ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(upperCode, targetId, effectiveTenant)
        .all<Record<string, unknown>>()
        .catch(() =>
          db
            .prepare('SELECT * FROM promotions WHERE UPPER(code) = ? AND id != ?')
            .bind(upperCode, targetId)
            .all<Record<string, unknown>>()
            .catch(() => ({ results: [] as Record<string, unknown>[] }))
        );
      if ((dupRes.results || []).some((row) => matchesTenantRow(row, effectiveTenant))) {
        return c.json({ success: false, error: 'Promotion code already exists' }, 409);
      }
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
      const upperCode = body.code.trim().toUpperCase();
      updates.push('code = ?'); params.push(upperCode);
      canonicalUpdates.push('code = ?'); canonicalParams.push(upperCode);
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
    if (body.applicableItems !== undefined) {
      updates.push('applicable_items = ?');
      params.push(body.applicableItems ? JSON.stringify(body.applicableItems) : null);
    }
    if (body.excludedItems !== undefined) {
      updates.push('excluded_items = ?');
      params.push(body.excludedItems ? JSON.stringify(body.excludedItems) : null);
    }

    if (updates.length === 0) {
      return c.json({
        success: true,
        data: mapPromotionRow(existing),
      });
    }

    updates.push('updated_at = ?');
    params.push(now);

    try {
      await db
        .prepare(
          `UPDATE promotions SET ${updates.join(', ')} WHERE (id = ? OR code = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        )
        .bind(...params, targetId, id, effectiveTenant)
        .run();
    } catch {
      if (canonicalUpdates.length > 0) {
        try {
          await db
            .prepare(
              `UPDATE promotions SET ${canonicalUpdates.join(', ')} WHERE (id = ? OR code = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            )
            .bind(...canonicalParams, targetId, id, effectiveTenant)
            .run();
        } catch {
          if (effectiveTenant === 'default') {
            await db
              .prepare(`UPDATE promotions SET ${canonicalUpdates.join(', ')} WHERE (id = ? OR code = ?)`)
              .bind(...canonicalParams, targetId, id)
              .run();
          }
        }
      } else if (effectiveTenant === 'default') {
        await db
          .prepare(`UPDATE promotions SET ${updates.join(', ')} WHERE (id = ? OR code = ?)`)
          .bind(...params, targetId, id)
          .run();
      }
    }

    await writePromotionAuditLog(db, user.id, 'promotion_update', targetId, JSON.stringify(body), now, effectiveTenant);
    const promotion = await findOpenApiPromotionById(db, targetId, effectiveTenant);

    return c.json({
      success: true,
      data: mapPromotionRow(promotion!),
    });
  });

  // DELETE /api/promotions/{id} - Delete promotion
  app.openapi(PromotionRoutes.delete as any, async (c: any) => {
    const authErr = verifyOpenApiPromoTenant(c, PROMO_WRITE_ROLES, true);
    if (authErr) return authErr;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiPromoWriteTenantId(c);
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const now = new Date().toISOString();

    const existing = await findOpenApiPromotionById(db, id, tenantId);
    if (!existing) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    const effectiveTenant =
      tenantId === '*'
        ? (typeof existing.tenant_id === 'string' && existing.tenant_id.trim()) || 'default'
        : tenantId;
    const targetId = String(existing.id || id);

    await db
      .prepare(
        "DELETE FROM promotions WHERE (id = ? OR code = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      )
      .bind(targetId, id, effectiveTenant)
      .run()
      .catch(async () => {
        if (effectiveTenant === 'default') {
          await db.prepare('DELETE FROM promotions WHERE (id = ? OR code = ?)').bind(targetId, id).run();
        }
      });

    await writePromotionAuditLog(db, user.id, 'promotion_delete', targetId, JSON.stringify({ name: existing.name }), now, effectiveTenant);

    return c.json({ success: true, message: 'Promotion deleted successfully' });
  });
}
