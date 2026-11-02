import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PromotionRoutes } from '../../schemas/promotions';
import { getDatabase } from '../../lib/db';
import { getTenantId } from '../../middleware/tenant';

function matchesTenantRow(row: Record<string, unknown>, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
    return rowTenant === tenantId;
  }
  return tenantId === 'default';
}

export function registerValidationHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/promotions/validate - Validate promotion code
  app.openapi(PromotionRoutes.validate as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = getTenantId(c);
    const body = c.req.valid('json');

    const promoRows = (await db.prepare(
      'SELECT * FROM promotions WHERE UPPER(code) = ? AND is_active = 1'
    ).bind(body.code.toUpperCase()).all().catch(() => ({ results: [] }))) as { results?: any[] };
    const promotion = (promoRows.results || []).find((p: any) => matchesTenantRow(p, tenantId)) ?? null;

    if (!promotion) {
      return c.json({ success: false, error: 'Invalid or expired promotion code' }, 404);
    }

    const isWelcome = body.code.toUpperCase() === 'WELCOME';
    const now = new Date();
    const validFrom = promotion.valid_from ? new Date(promotion.valid_from) : null;
    const validToRaw = promotion.valid_to ?? promotion.expires_at ?? null;
    const validTo = validToRaw ? new Date(validToRaw) : null;
    const maxUses = promotion.max_uses ?? promotion.usage_limit ?? null;
    const currentUses = Number(promotion.current_uses ?? promotion.used_count ?? promotion.usage_count ?? 0);
    const minOrderValue = promotion.min_order_value ?? promotion.min_order ?? null;
    const maxDiscountValue = promotion.max_discount_value ?? promotion.max_discount ?? null;
    const discountType = promotion.discount_type === 'percent' ? 'percentage' : (promotion.discount_type ?? 'percentage');
    const discountRate = Number(promotion.discount_value ?? promotion.percent ?? 0);

    if (validFrom && validFrom > now) {
      return c.json({ success: false, error: 'Promotion not yet valid' }, 400);
    }

    if (!isWelcome && validTo && validTo < now) {
      return c.json({ success: false, error: 'Promotion has expired' }, 400);
    }

    if (!isWelcome && maxUses && currentUses >= maxUses) {
      return c.json({ success: false, error: 'Promotion usage limit reached' }, 400);
    }

    const items: Array<{ menuItemId: string; quantity: number; price: number }> = Array.isArray(body.items) ? body.items : [];
    const itemsSubtotal = items.reduce((sum: number, item: { price: number; quantity: number }) =>
      sum + item.price * item.quantity, 0);
    const subtotal = items.length > 0 ? itemsSubtotal : Number(body.orderValue ?? body.orderAmount ?? 0);
    const effectiveOrderValue = Number(body.orderValue ?? body.orderAmount ?? subtotal);

    // Check minimum order value
    if (minOrderValue && effectiveOrderValue < minOrderValue) {
      return c.json({
        success: false,
        error: `Minimum order value of ${minOrderValue} VND required`,
      }, 400);
    }

    // Check item applicability
    if (promotion.applicable_items) {
      const applicableItems = JSON.parse(promotion.applicable_items);
      const hasApplicableItem = items.some((item: { menuItemId: string }) =>
        applicableItems.includes(item.menuItemId)
      );
      if (!hasApplicableItem) {
        return c.json({ success: false, error: 'No applicable items in order for this promotion' }, 400);
      }
    }

    // Check excluded items
    if (promotion.excluded_items) {
      const excludedItems = JSON.parse(promotion.excluded_items);
      const hasExcludedItem = items.some((item: { menuItemId: string }) =>
        excludedItems.includes(item.menuItemId)
      );
      if (hasExcludedItem) {
        return c.json({ success: false, error: 'Order contains items excluded from this promotion' }, 400);
      }
    }

    // Calculate discount
    let discount = 0;

    if (discountType === 'percentage' || discountType === 'percent') {
      discount = Math.round(subtotal * discountRate / 100);
    } else if (discountType === 'fixed') {
      discount = discountRate;
    } else if (discountType === 'buy_x_get_y') {
      // Simplified BOGO logic
      discount = 0; // Would need specific implementation
    }

    // Cap at max discount value and order subtotal
    if (maxDiscountValue && discount > maxDiscountValue) {
      discount = maxDiscountValue;
    }
    discount = Math.max(0, Math.min(discount, subtotal));

    return c.json({
      success: true,
      data: {
        promotion: {
          id: promotion.id,
          name: promotion.name,
          code: promotion.code,
          type: promotion.type ?? discountType,
          discountValue: discountRate,
          discountType,
        },
        discount,
        subtotal,
        finalTotal: subtotal - discount,
        applicable: true,
      },
    });
  });
}
