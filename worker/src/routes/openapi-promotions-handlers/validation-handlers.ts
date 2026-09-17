import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { PromotionRoutes } from '../../schemas/promotions';

export function registerValidationHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/promotions/validate - Validate promotion code
  app.openapi(PromotionRoutes.validate, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const body = c.req.valid('json');

    const promotion = await db.prepare(
      `SELECT * FROM promotions WHERE code = ? AND is_active = 1`
    ).bind(body.code.toUpperCase()).first();

    if (!promotion) {
      return c.json({ success: false, error: 'Invalid or expired promotion code' }, 404);
    }

    const now = new Date();
    const validFrom = promotion.valid_from ? new Date(promotion.valid_from) : null;
    const validTo = promotion.valid_to ? new Date(promotion.valid_to) : null;

    if (validFrom && validFrom > now) {
      return c.json({ success: false, error: 'Promotion not yet valid' }, 400);
    }

    if (validTo && validTo < now) {
      return c.json({ success: false, error: 'Promotion has expired' }, 400);
    }

    if (promotion.max_uses && promotion.current_uses >= promotion.max_uses) {
      return c.json({ success: false, error: 'Promotion usage limit reached' }, 400);
    }

    // Check minimum order value
    if (promotion.min_order_value && body.orderValue < promotion.min_order_value) {
      return c.json({
        success: false,
        error: `Minimum order value of ${promotion.min_order_value} VND required`,
      }, 400);
    }

    // Check item applicability
    if (promotion.applicable_items) {
      const applicableItems = JSON.parse(promotion.applicable_items);
      const hasApplicableItem = body.items.some((item: { menuItemId: string }) =>
        applicableItems.includes(item.menuItemId)
      );
      if (!hasApplicableItem) {
        return c.json({ success: false, error: 'No applicable items in order for this promotion' }, 400);
      }
    }

    // Check excluded items
    if (promotion.excluded_items) {
      const excludedItems = JSON.parse(promotion.excluded_items);
      const hasExcludedItem = body.items.some((item: { menuItemId: string }) =>
        excludedItems.includes(item.menuItemId)
      );
      if (hasExcludedItem) {
        return c.json({ success: false, error: 'Order contains items excluded from this promotion' }, 400);
      }
    }

    // Calculate discount
    let discount = 0;
    const subtotal = body.items.reduce((sum: number, item: { price: number; quantity: number }) =>
      sum + item.price * item.quantity, 0);

    if (promotion.discount_type === 'percentage') {
      discount = Math.floor(subtotal * promotion.discount_value / 100);
    } else if (promotion.discount_type === 'fixed') {
      discount = promotion.discount_value;
    } else if (promotion.discount_type === 'buy_x_get_y') {
      // Simplified BOGO logic
      discount = 0; // Would need specific implementation
    }

    // Cap at max discount value
    if (promotion.max_discount_value && discount > promotion.max_discount_value) {
      discount = promotion.max_discount_value;
    }

    return c.json({
      success: true,
      data: {
        promotion: {
          id: promotion.id,
          name: promotion.name,
          code: promotion.code,
          type: promotion.type,
          discountValue: promotion.discount_value,
          discountType: promotion.discount_type,
        },
        discount,
        subtotal,
        finalTotal: subtotal - discount,
        applicable: true,
      },
    });
  });
}