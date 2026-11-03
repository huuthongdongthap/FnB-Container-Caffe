import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PromotionRoutes } from '../../schemas/promotions';
import { getDatabase } from '../../lib/db';
import { getTenantId, matchesTenantRow } from '../../middleware/tenant';

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

    const rawItems: Array<{ menuItemId: string; quantity: number; price: number }> = Array.isArray(body.items) ? body.items : [];
    const items: Array<{ menuItemId: string; quantity: number; price: number; unverifiedCatalogItem?: boolean }> = [];
    let hasCatalogProducts: boolean | null = null;
    for (const item of rawItems) {
      const qty = Math.max(0, Number(item.quantity ?? 0));
      let unitPrice = Math.max(0, Number(item.price ?? 0));
      let unverifiedCatalogItem = false;
      if (item.menuItemId) {
        const prod = (await db.prepare('SELECT id, price, tenant_id FROM products WHERE id = ?').bind(item.menuItemId).first().catch(() => null)) as Record<string, unknown> | null;
        if (prod) {
          if (!matchesTenantRow(prod, tenantId)) {
            return c.json({ success: false, error: 'Product not found in active tenant' }, 400);
          }
          const dbPrice = Number(prod.price);
          if (Number.isFinite(dbPrice) && dbPrice >= 0) {
            unitPrice = dbPrice;
          }
        } else {
          if (hasCatalogProducts === null) {
            let prodRows: Array<Record<string, unknown>> = [];
            try {
              const stmt = db.prepare('SELECT id, tenant_id FROM products LIMIT 10');
              const bound = typeof stmt.bind === 'function' ? stmt.bind() : stmt;
              if (typeof bound.all === 'function') {
                const allRes = await bound.all();
                prodRows = (allRes?.results || []) as Array<Record<string, unknown>>;
              } else if (typeof stmt.all === 'function') {
                const allRes = await stmt.all();
                prodRows = (allRes?.results || []) as Array<Record<string, unknown>>;
              }
            } catch {
              try {
                const stmt = db.prepare('SELECT id, tenant_id FROM products LIMIT 1');
                const bound = typeof stmt.bind === 'function' ? stmt.bind() : stmt;
                const firstProd = await bound.first();
                if (firstProd) prodRows = [firstProd as Record<string, unknown>];
              } catch {
                prodRows = [];
              }
            }
            hasCatalogProducts = prodRows.some((r) => matchesTenantRow(r, tenantId));
          }
          if (hasCatalogProducts) {
            unitPrice = 0;
            unverifiedCatalogItem = true;
          }
        }
      }
      items.push({ menuItemId: item.menuItemId, quantity: qty, price: unitPrice, unverifiedCatalogItem });
    }

    const itemsSubtotal = items.reduce((sum: number, item: { price: number; quantity: number }) =>
      sum + item.price * item.quantity, 0);
    const subtotal = items.length > 0 ? itemsSubtotal : Math.max(0, Number(body.orderValue ?? body.orderAmount ?? 0));
    const effectiveOrderValue = items.length > 0 ? itemsSubtotal : subtotal;

    // Check minimum order value
    if (minOrderValue && effectiveOrderValue < minOrderValue) {
      return c.json({
        success: false,
        error: `Minimum order value of ${minOrderValue} VND required`,
      }, 400);
    }

    if (items.length > 0 && items.every((item) => item.unverifiedCatalogItem)) {
      return c.json({ success: false, error: 'Product not found in active tenant' }, 400);
    }

    const applicableItems: string[] | null = promotion.applicable_items ? JSON.parse(promotion.applicable_items) : null;
    const excludedItems: string[] | null = promotion.excluded_items ? JSON.parse(promotion.excluded_items) : null;

    // Check item applicability
    if (Array.isArray(applicableItems) && applicableItems.length > 0) {
      const hasApplicableItem = items.some(
        (item: { menuItemId: string; quantity: number; unverifiedCatalogItem?: boolean }) =>
          Number(item.quantity) > 0 && !item.unverifiedCatalogItem && applicableItems.includes(item.menuItemId)
      );
      if (!hasApplicableItem) {
        return c.json({ success: false, error: 'No applicable items in order for this promotion' }, 400);
      }
    }

    // Check excluded items
    if (Array.isArray(excludedItems) && excludedItems.length > 0) {
      const positiveItems = items.filter((item: { quantity: number }) => Number(item.quantity) > 0);
      if (positiveItems.length === 0) {
        return c.json({ success: false, error: 'Order items are required to validate item exclusions for this promotion' }, 400);
      }
      const hasExcludedItem = positiveItems.some((item: { menuItemId: string }) =>
        excludedItems.includes(item.menuItemId)
      );
      if (hasExcludedItem) {
        return c.json({ success: false, error: 'Order contains items excluded from this promotion' }, 400);
      }
    }

    const eligibleSubtotal = items.length > 0
      ? items
          .filter(
            (item) =>
              (!Array.isArray(applicableItems) || applicableItems.length === 0 || applicableItems.includes(item.menuItemId)) &&
              (!Array.isArray(excludedItems) || excludedItems.length === 0 || !excludedItems.includes(item.menuItemId))
          )
          .reduce((sum, item) => sum + item.price * item.quantity, 0)
      : subtotal;

    // Calculate discount
    let discount = 0;

    if (discountType === 'percentage' || discountType === 'percent') {
      discount = Math.round(eligibleSubtotal * discountRate / 100);
    } else if (discountType === 'fixed') {
      discount = discountRate;
    } else if (discountType === 'buy_x_get_y') {
      // Simplified BOGO logic
      discount = 0; // Would need specific implementation
    }

    // Cap at max discount value, eligible subtotal, and order subtotal
    if (maxDiscountValue && discount > maxDiscountValue) {
      discount = maxDiscountValue;
    }
    discount = Math.max(0, Math.min(discount, eligibleSubtotal, subtotal));

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
