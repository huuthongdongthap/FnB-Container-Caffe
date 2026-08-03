import type { Env } from '../types/env';
import { createLogger } from '../middleware/logger';

const log = createLogger({ route: 'saas-pricing' });

export type PricingTier = {
 id: string;
 slug: string;
 nameVi: string;
 nameEn: string;
 descriptionVi: string | null;
 descriptionEn: string | null;
 priceVnd: number;
 priceUsd: number | null;
 currency: string;
 billingPeriod: string;
 sortOrder: number;
 isRecommended: boolean;
 featuresVi: string[];
 featuresEn: string[];
 ctaTextVi: string;
 ctaTextEn: string;
 ctaLink: string;
};

function mapRow(r: Record<string, unknown>): PricingTier {
 return {
   id: String(r.id),
   slug: String(r.slug),
   nameVi: String(r.name_vi),
   nameEn: String(r.name_en),
   descriptionVi: (r.description_vi as string) ?? null,
   descriptionEn: (r.description_en as string) ?? null,
   priceVnd: Number(r.price_vnd),
   priceUsd: r.price_usd != null ? Number(r.price_usd) : null,
   currency: String(r.currency ?? 'VND'),
   billingPeriod: String(r.billing_period ?? 'monthly'),
   sortOrder: Number(r.sort_order ?? 0),
   isRecommended: Boolean(r.is_recommended),
   featuresVi: JSON.parse(String(r.features_vi ?? '[]')),
   featuresEn: JSON.parse(String(r.features_en ?? '[]')),
   ctaTextVi: String(r.cta_text_vi ?? 'Bắt đầu'),
   ctaTextEn: String(r.cta_text_en ?? 'Get Started'),
   ctaLink: String(r.cta_link ?? '/register'),
 };
}

export async function getPricing(c: { env: Env; req: { header: (k: string) => string | null } }): Promise<Response> {
 const db = c.env.AURA_DB as unknown as D1Database;
 const lang = (c.req.header('Accept-Language') || 'vi').startsWith('en') ? 'en' : 'vi';

 try {
   const { results } = await db
   .prepare(
     'SELECT * FROM saas_pricing WHERE active = 1 ORDER BY sort_order ASC, created_at ASC'
   )
   .all<PricingTier & Record<string, unknown>>();

   const tiers = (results ?? []).map(mapRow);
   return c.json({ ok: true, data: tiers, lang });
 } catch (err) {
   log.error('pricing DB error', { cause: (err as any).cause, name: (err as any).name, message: (err as any).message });
   return c.json({ ok: false, error: 'Failed to load pricing' }, 500);
 }
}
