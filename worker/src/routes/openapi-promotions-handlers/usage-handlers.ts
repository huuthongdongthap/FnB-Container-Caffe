import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PromotionRoutes } from '../../schemas/promotions';
import { getDatabase } from '../../lib/db';
import { getTenantId } from '../../middleware/tenant';

const PROMO_ADMIN_ROLES = ['owner', 'manager', 'supervisor', 'admin'];

function matchesTenantRow(row: Record<string, unknown>, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
    return rowTenant === tenantId;
  }
  return tenantId === 'default';
}

export function registerUsageHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/promotions/use - Record promotion usage
  app.openapi(PromotionRoutes.use as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = getTenantId(c);
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const promotion = (await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(body.promotionId).first()) as any;

    if (!promotion || !matchesTenantRow(promotion, tenantId)) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    if (!promotion.is_active) {
      return c.json({ success: false, error: 'Promotion is not active' }, 400);
    }

    const nowDate = new Date(now);
    const validFrom = promotion.valid_from ? new Date(promotion.valid_from) : null;
    const validToRaw = promotion.valid_to ?? promotion.expires_at ?? null;
    const validTo = validToRaw ? new Date(validToRaw) : null;
    if (validFrom && validFrom > nowDate) {
      return c.json({ success: false, error: 'Promotion not yet valid' }, 400);
    }
    if (validTo && validTo < nowDate) {
      return c.json({ success: false, error: 'Promotion has expired' }, 400);
    }

    const maxUses = Number(promotion.max_uses ?? promotion.usage_limit ?? 0);
    const currentUses = Number(promotion.current_uses ?? promotion.used_count ?? promotion.usage_count ?? 0);
    if (maxUses > 0 && currentUses >= maxUses) {
      return c.json({ success: false, error: 'Promotion usage limit reached' }, 400);
    }

    const callerCustomerId = String(user?.customerId || user?.id || '');
    const perCustomerLimit = Number(
      promotion.usage_limit_per_customer ?? promotion.per_customer_limit ?? promotion.max_uses_per_customer ?? 0
    );
    if (perCustomerLimit > 0 && callerCustomerId) {
      const custUsage = await db
        .prepare('SELECT COUNT(*) as cnt FROM promotion_usages WHERE promotion_id = ? AND customer_id = ?')
        .bind(body.promotionId, callerCustomerId)
        .first<{ cnt: number }>()
        .catch(() => null);
      if (Number(custUsage?.cnt ?? 0) >= perCustomerLimit) {
        return c.json({ success: false, error: 'Per-customer promotion usage limit reached' }, 400);
      }
    }

    let orderRow: Record<string, unknown> | null = null;
    if (body.orderId) {
      try {
        orderRow = await db.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1').bind(body.orderId).first<Record<string, unknown>>();
        if (orderRow && orderRow.id) {
          if (!matchesTenantRow(orderRow, tenantId)) {
            return c.json({ success: false, error: 'Order not found' }, 404);
          }
          if (user?.role === 'customer') {
            const ordCustId = orderRow.customer_id !== undefined && orderRow.customer_id !== null
              ? String(orderRow.customer_id).trim()
              : '';
            if (!ordCustId || (ordCustId !== callerCustomerId && ordCustId !== String(user.id))) {
              return c.json({ success: false, error: 'Order not found' }, 404);
            }
          }
          if (typeof orderRow.status === 'string' && ['cancelled', 'failed'].includes(orderRow.status.toLowerCase())) {
            return c.json({ success: false, error: 'Cannot apply promotion to a cancelled order' }, 409);
          }
        } else if (user?.role === 'customer' || (tenantId !== 'default' && tenantId !== '*')) {
          return c.json({ success: false, error: 'Order not found' }, 404);
        }
      } catch {
        if (user?.role === 'customer' || (tenantId !== 'default' && tenantId !== '*')) {
          return c.json({ success: false, error: 'Order not found' }, 404);
        }
      }
    }

    const orderBaseAmount = orderRow && orderRow.id
      ? Number(orderRow.subtotal ?? orderRow.total_amount ?? orderRow.total ?? 0)
      : 0;
    const minOrderValue = Number(promotion.min_order_value ?? promotion.min_order_amount ?? promotion.min_order ?? 0);
    if (orderRow && orderRow.id && minOrderValue > 0 && orderBaseAmount < minOrderValue) {
      return c.json({ success: false, error: 'Order does not meet promotion minimum value' }, 400);
    }

    const rawDiscountType = String(promotion.discount_type ?? promotion.type ?? '').toLowerCase();
    const promoDiscountVal = Number(promotion.discount_value ?? promotion.value ?? promotion.percent ?? 0);
    const maxDiscountCap = Number(
      promotion.max_discount_value ?? promotion.max_discount_amount ?? promotion.max_discount ?? 0
    );
    if (promoDiscountVal > 0) {
      let maxAllowedDiscount = Infinity;
      if (rawDiscountType === 'fixed' || rawDiscountType === 'fixed_amount' || rawDiscountType === 'amount') {
        maxAllowedDiscount = promoDiscountVal;
      } else if (rawDiscountType === 'percentage' || rawDiscountType === 'percent') {
        if (orderRow && orderRow.id && orderBaseAmount > 0) {
          maxAllowedDiscount = Math.round((orderBaseAmount * promoDiscountVal) / 100);
        } else if (maxDiscountCap > 0) {
          maxAllowedDiscount = maxDiscountCap;
        }
      }
      if (maxDiscountCap > 0 && maxDiscountCap < maxAllowedDiscount) {
        maxAllowedDiscount = maxDiscountCap;
      }
      if (orderRow && orderRow.id && orderBaseAmount > 0 && orderBaseAmount < maxAllowedDiscount) {
        maxAllowedDiscount = orderBaseAmount;
      }
      if (Number.isFinite(maxAllowedDiscount) && Number(body.discountAmount) > maxAllowedDiscount) {
        return c.json({ success: false, error: 'Discount amount exceeds promotion allowance' }, 400);
      }
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
    if (body.orderId) {
      const existingOrderUsage = await db.prepare(
        'SELECT id FROM promotion_usages WHERE order_id = ? AND promotion_id = ? LIMIT 1'
      ).bind(body.orderId, body.promotionId).first().catch(() => null);
      if (existingOrderUsage) {
        return c.json({ success: false, error: 'Duplicate usage request' }, 409);
      }
    }

    const usageId = crypto.randomUUID();

    const usageUpdate = await db.prepare(
      'UPDATE promotions SET current_uses = COALESCE(current_uses, 0) + 1, usage_count = COALESCE(usage_count, 0) + 1, updated_at = ? WHERE id = ? AND COALESCE(is_active, 1) = 1 AND (max_uses IS NULL OR max_uses = 0 OR COALESCE(current_uses, 0) < max_uses)'
    ).bind(now, body.promotionId).run();
    if ((usageUpdate?.meta?.changes ?? 1) === 0) {
      return c.json({ success: false, error: 'Promotion usage limit reached' }, 409);
    }

    await db.prepare(
      `INSERT INTO promotion_usages (id, promotion_id, order_id, customer_id, discount_amount, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(usageId, body.promotionId, body.orderId, user.customerId || user.id, body.discountAmount, body.idempotencyKey || null, now).run();

    const auditMeta = JSON.stringify({ discountAmount: body.discountAmount, orderId: body.orderId });
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${crypto.randomUUID()}`, user.id, 'promotion_use', 'promotion', body.promotionId, auditMeta, now).run();
    } catch {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(user.id, user.id, user.id, 'promotion_use', 'promotion', body.promotionId, 'promotion', body.promotionId, auditMeta, auditMeta, now).run().catch(() => {});
    }

    const updatedPromotion = (await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(body.promotionId).first()) as any;

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
  app.openapi(PromotionRoutes.summary as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = getTenantId(c);
    const user = c.get('user');

    // Verify admin role
    if (!user || !PROMO_ADMIN_ROLES.includes(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }

    if (tenantId !== '*') {
      const allPromosRes = (await db
        .prepare('SELECT * FROM promotions')
        .all()
        .catch(() => ({ results: [] }))) as { results?: any[] };
      const allPromos = allPromosRes?.results || [];
      if (tenantId !== 'default' || allPromos.some((p: any) => p && typeof p === 'object' && 'tenant_id' in p)) {
        const scopedPromos = allPromos.filter((p: any) => matchesTenantRow(p, tenantId));
        const scopedPromoIds = new Set(scopedPromos.map((p: any) => String(p.id)));
        const allUsagesRes = (await db
          .prepare('SELECT * FROM promotion_usages')
          .all()
          .catch(() => ({ results: [] }))) as { results?: any[] };
        const scopedUsages = (allUsagesRes?.results || []).filter((u: any) =>
          scopedPromoIds.has(String(u.promotion_id))
        );

        const byTypeMap: Record<string, number> = {};
        const byDiscountTypeMap: Record<string, number> = {};
        for (const p of scopedPromos) {
          const t = String(p.type ?? (p.discount_type === 'percent' ? 'percentage' : (p.discount_type || 'percentage')));
          const dt = String(p.discount_type || 'percentage');
          byTypeMap[t] = (byTypeMap[t] || 0) + 1;
          byDiscountTypeMap[dt] = (byDiscountTypeMap[dt] || 0) + 1;
        }

        const usageStatsByPromo = new Map<string, { count: number; discount: number }>();
        let totalDiscountGiven = 0;
        const nowDate = new Date();
        const startOfMonthIso = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1))
          .toISOString()
          .slice(0, 10);
        let monthCount = 0;
        let monthDiscount = 0;

        for (const u of scopedUsages) {
          const pid = String(u.promotion_id);
          const amt = Number(u.discount_amount || 0);
          totalDiscountGiven += amt;
          const prev = usageStatsByPromo.get(pid) || { count: 0, discount: 0 };
          usageStatsByPromo.set(pid, { count: prev.count + 1, discount: prev.discount + amt });
          if (String(u.created_at || '') >= startOfMonthIso) {
            monthCount += 1;
            monthDiscount += amt;
          }
        }

        const topScoped = scopedPromos
          .map((p: any) => {
            const st = usageStatsByPromo.get(String(p.id)) || { count: 0, discount: 0 };
            return {
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
              totalDiscount: st.discount,
              usageCount: st.count,
            };
          })
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, 10);

        return c.json({
          success: true,
          data: {
            totalPromotions: scopedPromos.length,
            activePromotions: scopedPromos.filter((p: any) => Number(p.is_active ?? 0) === 1).length,
            totalDiscountGiven,
            byType: byTypeMap,
            byDiscountType: byDiscountTypeMap,
            topPromotions: topScoped,
            thisMonth: {
              usageCount: monthCount,
              totalDiscount: monthDiscount,
            },
          },
        });
      }
    }

    // Total promotions
    const totalPromotions = (await db.prepare('SELECT COUNT(*) as total FROM promotions').first()) as { total: number } | null;

    // Active promotions
    const activePromotions = (await db.prepare('SELECT COUNT(*) as total FROM promotions WHERE is_active = 1').first()) as { total: number } | null;

    // By type
    const byType = (await db.prepare(
      'SELECT type, COUNT(*) as count FROM promotions GROUP BY type'
    ).all()) as { results: Array<{ type: string; count: number }> };

    // By discount type
    const byDiscountType = (await db.prepare(
      'SELECT discount_type, COUNT(*) as count FROM promotions GROUP BY discount_type'
    ).all()) as { results: Array<{ discount_type: string; count: number }> };

    // Top promotions by usage
    const topPromotions = (await db.prepare(
      `SELECT p.*,
        COALESCE(SUM(pu.discount_amount), 0) as total_discount,
        COUNT(pu.id) as usage_count
       FROM promotions p
       LEFT JOIN promotion_usages pu ON p.id = pu.promotion_id
       GROUP BY p.id
       ORDER BY usage_count DESC
       LIMIT 10`
    ).all()) as { results: any[] };

    // Total discount given
    const totalDiscount = (await db.prepare(
      'SELECT COALESCE(SUM(discount_amount), 0) as total FROM promotion_usages'
    ).first()) as { total: number } | null;

    // Usage this month
    const thisMonthUsage = (await db.prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(discount_amount), 0) as total_discount
       FROM promotion_usages
       WHERE created_at >= datetime('now', 'start of month')`
    ).first()) as { count: number; total_discount: number } | null;

    return c.json({
      success: true,
      data: {
        totalPromotions: totalPromotions?.total || 0,
        activePromotions: activePromotions?.total || 0,
        totalDiscountGiven: totalDiscount?.total || 0,
        byType: (byType.results || []).reduce((acc: Record<string, number>, row: { type: string; count: number }) => {
          acc[row.type] = row.count;
          return acc;
        }, {}),
        byDiscountType: (byDiscountType.results || []).reduce((acc: Record<string, number>, row: { discount_type: string; count: number }) => {
          acc[row.discount_type] = row.count;
          return acc;
        }, {}),
        topPromotions: (topPromotions.results || []).map((p: any) => ({
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
