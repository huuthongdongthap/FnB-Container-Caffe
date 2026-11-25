import type { Hono } from 'hono';
import type { MixpostEnv } from '../../types/env';
import { getTenantId, matchesTenantRow } from '../../middleware/tenant';
import { mixpostGenerateSchema, zodErrorResponse } from '../../lib/validators';
import type { PromotionRow, ProductRow } from '../../tree/mixpost/types';

async function resolveTenantSocialBrand(
  db: import('@cloudflare/workers-types').D1Database | undefined,
  tenantId: string
): Promise<{ brandName: string; brandTag: string }> {
  let brandName = '';
  if (db && typeof db.prepare === 'function' && tenantId && tenantId !== 'default' && tenantId !== '*') {
    try {
      const branding = await db
        .prepare('SELECT display_name FROM tenant_branding WHERE tenant_id = ? LIMIT 1')
        .bind(tenantId)
        .first<{ display_name?: string | null }>();
      if (branding?.display_name && branding.display_name.trim()) {
        brandName = branding.display_name.trim();
      }
    } catch {
      // tenant_branding optional
    }
    if (!brandName) {
      try {
        const tenantRow = await db
          .prepare('SELECT name FROM saas_tenants WHERE id = ? OR slug = ? LIMIT 1')
          .bind(tenantId, tenantId)
          .first<{ name?: string | null }>();
        if (tenantRow?.name && tenantRow.name.trim()) {
          brandName = tenantRow.name.trim();
        }
      } catch {
        // saas_tenants optional
      }
    }
  }
  const finalBrand = brandName || 'Aura Cafe';
  const normalizedTag = finalBrand
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^A-Za-z0-9]+/g, '');
  return {
    brandName: finalBrand,
    brandTag: normalizedTag || 'AuraCafe',
  };
}

export function registerGenerateHandler(router: Hono<{ Bindings: MixpostEnv }>): void {
  // POST /generate — generate social content from source
  router.post('/generate', async (c) => {
    const env = c.env as unknown as MixpostEnv;
    const db = env.AURA_DB;
    const rawTenant = (getTenantId(c as unknown as Parameters<typeof getTenantId>[0]) || 'default').trim() || 'default';
    const tenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;

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
      let scopedOk = false;
      if (tenantId !== '*') {
        try {
          const { results: scopedResults } = await db.prepare(
            "SELECT * FROM promotions WHERE code = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 10"
          ).bind(promoId, tenantId).all<PromotionRow>();
          scopedOk = true;
          promos = (scopedResults || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
        } catch {
          promos = [];
        }
      }
      if (promos.length === 0 && (tenantId === '*' || (!scopedOk && tenantId === 'default'))) {
        const { results } = await db.prepare(
          'SELECT * FROM promotions WHERE code = ?'
        ).bind(promoId).all<PromotionRow>();
        promos = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
      }
      if (promos.length === 0) {
        return c.json({ success: false, error: 'Promotion not found' }, 404);
      }

      const promo = promos[0] as PromotionRow;
      const discountPercent = promo.percent ?? promo.discount_value ?? promo.value ?? 0;
      const rawDiscountType = String(promo.discount_type ?? promo.type ?? '').trim().toLowerCase();
      const isFixedDiscount =
        rawDiscountType === 'fixed' ||
        rawDiscountType === 'fixed_amount' ||
        rawDiscountType === 'amount';
      const rawDiscountValue = Number(promo.discount_value ?? promo.value ?? discountPercent);
      const discountLabel = isFixedDiscount
        ? `${Math.round(rawDiscountValue).toLocaleString('vi-VN')}đ`
        : `${discountPercent}%`;
      const effectiveBrandTenant =
        tenantId === '*'
          ? (typeof (promo as unknown as Record<string, unknown>).tenant_id === 'string'
              ? String((promo as unknown as Record<string, unknown>).tenant_id).trim()
              : 'default')
          : tenantId;
      const { brandName, brandTag } = await resolveTenantSocialBrand(db, effectiveBrandTenant);
      const content = `${promo.code}: Giảm ${discountLabel} — ${brandName}\n#${brandTag} #KhuyenMai`;
      return c.json({
        success: true,
        data: { content, hashtags: [brandTag, 'KhuyenMai'] }
      });
    }

    if (source === 'menu') {
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const categoryId = data.category as number | undefined;
      let products: ProductRow[] = [];
      let scopedOk = false;
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
          scopedOk = true;
          products = (scopedResults || [])
            .filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId))
            .slice(0, 5);
        } catch {
          products = [];
        }
      }
      if (products.length === 0 && (tenantId === '*' || (!scopedOk && tenantId === 'default'))) {
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

      const { brandName, brandTag } = await resolveTenantSocialBrand(
        db,
        tenantId === '*' ? 'default' : tenantId
      );

      if (products.length === 0) {
        const content = `${brandName} — Hien chua co mon nao hom nay\n#${brandTag} #MenuHangNgay`;
        return c.json({
          success: true,
          data: { content, hashtags: [brandTag, 'MenuHangNgay'] }
        });
      }

      const names = products.map((p: ProductRow) => p.name).join(', ');
      const content = `${brandName} Menu Hom Nay: ${names}\n#${brandTag} #MenuHangNgay`;
      return c.json({
        success: true,
        data: { content, hashtags: [brandTag, 'MenuHangNgay'] }
      });
    }

    return c.json({ success: false, error: 'Unknown source' }, 400);
  });
}
