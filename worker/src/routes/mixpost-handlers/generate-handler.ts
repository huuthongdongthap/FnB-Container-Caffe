import type { Hono } from 'hono';
import type { MixpostEnv } from '../../types/env';
import { getTenantId, matchesTenantRow } from '../../middleware/tenant';
import { mixpostGenerateSchema, zodErrorResponse } from '../../lib/validators';
import type { PromotionRow, ProductRow } from '../../tree/mixpost/types';

export function registerGenerateHandler(router: Hono<{ Bindings: MixpostEnv }>): void {
  // POST /generate — generate social content from source
  router.post('/generate', async (c) => {
    const env = c.env as unknown as MixpostEnv;
    const db = env.AURA_DB;
    const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);

    let rawBody: Record<string, unknown>;
    try {
      rawBody = await c.req.json<Record<string, unknown>>();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON' }, 400);
    }
    const parsed = mixpostGenerateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const data = parsed.data;
    const source = data.source;

    if (source === 'promotion') {
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const promoId = data.id as string;
      let promos: PromotionRow[] = [];
      if (tenantId !== '*') {
        try {
          const { results: scopedResults } = await db.prepare(
            "SELECT * FROM promotions WHERE code = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 10"
          ).bind(promoId, tenantId).all<PromotionRow>();
          promos = (scopedResults || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
        } catch {
          promos = [];
        }
      }
      if (promos.length === 0) {
        const { results } = await db.prepare(
          'SELECT * FROM promotions WHERE code = ?'
        ).bind(promoId).all<PromotionRow>();
        promos = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
      }
      if (promos.length === 0) {
        return c.json({ success: false, error: 'Promotion not found' }, 404);
      }

      const promo = promos[0] as PromotionRow & { discount_value?: number; value?: number };
      const discountPercent = promo.percent ?? promo.discount_value ?? promo.value ?? 0;
      const content = `🔥 ${promo.code}: Giảm ${discountPercent}% — Aura Cafe\n#AuraCafe #KhuyenMai`;
      return c.json({
        success: true,
        data: { content, hashtags: ['AuraCafe', 'KhuyenMai'] }
      });
    }

    if (source === 'menu') {
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const categoryId = data.category as number | undefined;
      let products: ProductRow[] = [];
      if (tenantId !== '*') {
        try {
          let scopedQuery = 'SELECT * FROM products WHERE is_available = 1';
          const scopedParams: unknown[] = [];
          if (categoryId) {
            scopedQuery += ' AND category_id = ?';
            scopedParams.push(categoryId);
          }
          scopedQuery += " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 50";
          scopedParams.push(tenantId);
          const { results: scopedResults } = await db.prepare(scopedQuery).bind(...scopedParams).all<ProductRow>();
          products = (scopedResults || [])
            .filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId))
            .slice(0, 5);
        } catch {
          products = [];
        }
      }
      if (products.length === 0) {
        let query = 'SELECT * FROM products WHERE is_available = 1';
        const params: unknown[] = [];
        if (categoryId) {
          query += ' AND category_id = ?';
          params.push(categoryId);
        }
        query += ' LIMIT 50';

        const { results } = await db.prepare(query).bind(...params).all<ProductRow>();
        products = (results || [])
          .filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId))
          .slice(0, 5);
      }

      if (products.length === 0) {
        const content = '☕ Aura Cafe — Hien chua co mon nao hom nay\n#AuraCafe #MenuHangNgay';
        return c.json({
          success: true,
          data: { content, hashtags: ['AuraCafe', 'MenuHangNgay'] }
        });
      }

      const names = products.map((p: ProductRow) => p.name).join(', ');
      const content = `☕ Aura Cafe Menu Hom Nay: ${names}\n#AuraCafe #MenuHangNgay`;
      return c.json({
        success: true,
        data: { content, hashtags: ['AuraCafe', 'MenuHangNgay'] }
      });
    }

    return c.json({ success: false, error: 'Unknown source' }, 400);
  });
}
