import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { PromotionRoutes } from '../../schemas/promotions';

export function registerUsageHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/promotions/use - Record promotion usage
  app.openapi(PromotionRoutes.use, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const promotion = await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(body.promotionId).first();

    if (!promotion) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    if (!promotion.is_active) {
      return c.json({ success: false, error: 'Promotion is not active' }, 400);
    }

    if (promotion.max_uses && promotion.current_uses >= promotion.max_uses) {
      return c.json({ success: false, error: 'Promotion usage limit reached' }, 400);
    }

    // Check idempotency
    if (body.idempotencyKey) {
      const existing = await db.prepare(
        'SELECT * FROM promotion_usages WHERE idempotency_key = ?'
      ).bind(body.idempotencyKey).first();
      if (existing) {
        return c.json({ success: false, error: 'Duplicate usage request' }, 409);
      }
    }

    const usageId = crypto.randomUUID();

    await db.prepare(
      `INSERT INTO promotion_usages (id, promotion_id, order_id, customer_id, discount_amount, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(usageId, body.promotionId, body.orderId, user.customerId || user.id, body.discountAmount, body.idempotencyKey || null, now).run();

    await db.prepare(
      'UPDATE promotions SET current_uses = current_uses + 1, updated_at = ? WHERE id = ?'
    ).bind(now, body.promotionId).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'promotion_use', 'promotion', body.promotionId, JSON.stringify({ discountAmount: body.discountAmount, orderId: body.orderId }), now).run();

    const updatedPromotion = await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(body.promotionId).first();

    return c.json({
      success: true,
      data: {
        usageId,
        promotion: {
          ...updatedPromotion!,
          discountValue: updatedPromotion!.discount_value,
          discountType: updatedPromotion!.discount_type,
          maxUses: updatedPromotion!.max_uses,
          currentUses: updatedPromotion!.current_uses,
          minOrderValue: updatedPromotion!.min_order_value,
          maxDiscountValue: updatedPromotion!.max_discount_value,
          validFrom: updatedPromotion!.valid_from,
          validTo: updatedPromotion!.valid_to,
          isActive: updatedPromotion!.is_active,
          applicableItems: updatedPromotion!.applicable_items ? JSON.parse(updatedPromotion!.applicable_items) : null,
          excludedItems: updatedPromotion!.excluded_items ? JSON.parse(updatedPromotion!.excluded_items) : null,
          createdAt: updatedPromotion!.created_at,
          updatedAt: updatedPromotion!.updated_at,
        },
        discountAmount: body.discountAmount,
        remainingUses: updatedPromotion!.max_uses ? updatedPromotion!.max_uses - updatedPromotion!.current_uses : null,
      },
    });
  });

  // GET /api/promotions/summary - Get promotion summary
  app.openapi(PromotionRoutes.summary, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');

    // Verify admin role
    if (user.role !== 'owner' && user.role !== 'manager') {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }

    // Total promotions
    const totalPromotions = await db.prepare('SELECT COUNT(*) as total FROM promotions').first();

    // Active promotions
    const activePromotions = await db.prepare('SELECT COUNT(*) as total FROM promotions WHERE is_active = 1').first();

    // By type
    const byType = await db.prepare(
      'SELECT type, COUNT(*) as count FROM promotions GROUP BY type'
    ).all();

    // By discount type
    const byDiscountType = await db.prepare(
      'SELECT discount_type, COUNT(*) as count FROM promotions GROUP BY discount_type'
    ).all();

    // Top promotions by usage
    const topPromotions = await db.prepare(
      `SELECT p.*,
        COALESCE(SUM(pu.discount_amount), 0) as total_discount,
        COUNT(pu.id) as usage_count
       FROM promotions p
       LEFT JOIN promotion_usages pu ON p.id = pu.promotion_id
       GROUP BY p.id
       ORDER BY usage_count DESC
       LIMIT 10`
    ).all();

    // Total discount given
    const totalDiscount = await db.prepare(
      'SELECT COALESCE(SUM(discount_amount), 0) as total FROM promotion_usages'
    ).first();

    // Usage this month
    const thisMonthUsage = await db.prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(discount_amount), 0) as total_discount
       FROM promotion_usages
       WHERE created_at >= datetime('now', 'start of month')`
    ).first();

    return c.json({
      success: true,
      data: {
        totalPromotions: totalPromotions?.total || 0,
        activePromotions: activePromotions?.total || 0,
        totalDiscountGiven: totalDiscount?.total || 0,
        byType: byType.results.reduce((acc, row) => {
          acc[row.type] = row.count;
          return acc;
        }, {} as Record<string, number>),
        byDiscountType: byDiscountType.results.reduce((acc, row) => {
          acc[row.discount_type] = row.count;
          return acc;
        }, {} as Record<string, number>),
        topPromotions: topPromotions.results.map(p => ({
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
          totalDiscount: p.total_discount,
          usageCount: p.usage_count,
        })),
        thisMonth: {
          usageCount: thisMonthUsage?.count || 0,
          totalDiscount: thisMonthUsage?.total_discount || 0,
        },
      },
    });
  });
}