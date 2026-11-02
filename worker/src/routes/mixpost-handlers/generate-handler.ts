import type { Hono } from 'hono';
import type { MixpostEnv } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import { mixpostGenerateSchema, zodErrorResponse } from '../../lib/validators';
import type { PromotionRow, ProductRow } from '../../tree/mixpost/types';

function matchesTenantRow(row: Record<string, unknown>, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
    return String(row.tenant_id).trim() === tenantId;
  }
  return tenantId === 'default';
}

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
      const { results } = await db.prepare(
        'SELECT * FROM promotions WHERE code = ?'
      ).bind(promoId).all<PromotionRow>();

      const promos = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
      if (promos.length === 0) {
        return c.json({ success: false, error: 'Promotion not found' }, 404);
      }

      const promo = promos[0] as PromotionRow & { discount_value?: number };
      const discountPercent = promo.percent ?? promo.discount_value ?? 0;
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
      let query = 'SELECT * FROM products WHERE is_available = 1';
      const params: unknown[] = [];
      if (categoryId) {
        query += ' AND category_id = ?';
        params.push(categoryId);
      }
      query += ' LIMIT 50';

      const { results } = await db.prepare(query).bind(...params).all<ProductRow>();
      const products = (results || [])
        .filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId))
        .slice(0, 5);

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
