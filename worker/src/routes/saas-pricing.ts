import type { Env } from '../types/env';
import type { Context } from 'hono';
import { optionalAuth } from '../middleware/auth';
import { createLogger } from '../middleware/logger';
import { matchesTenantRow } from '../lib/db';
import { resolvePublicTenantId } from '../middleware/tenant';

const log = createLogger({ route: 'saas-pricing' });

function safeParseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item));
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

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
   featuresVi: safeParseJsonArray(r.features_vi),
   featuresEn: safeParseJsonArray(r.features_en),
   ctaTextVi: String(r.cta_text_vi ?? 'Bắt đầu'),
   ctaTextEn: String(r.cta_text_en ?? 'Get Started'),
   ctaLink: String(r.cta_link ?? '/register'),
 };
}

export async function getPricing(c: Context<{ Bindings: Env }>): Promise<Response> {
 const db = c.env.AURA_DB as unknown as D1Database;
 const lang = (c.req.header('Accept-Language') || 'vi')?.startsWith('en') ? 'en' : 'vi';
 const authHeader = c.req.header('Authorization') || c.req.header('authorization') || '';
 if (!c.get?.('user' as never) && authHeader.toLowerCase().startsWith('bearer ')) {
   try {
     await optionalAuth()(c as never, async () => {});
   } catch {
     // Ignore optionalAuth errors on public pricing endpoint
   }
 }
 const tenantId = resolvePublicTenantId(c);

 try {
   const { results } = await db
   .prepare(
     'SELECT * FROM saas_pricing WHERE active = 1 ORDER BY sort_order ASC, created_at ASC'
   )
   .all<PricingTier & Record<string, unknown>>();

   const allRows = results ?? [];
   const tenantRows = allRows.filter((row) => matchesTenantRow(row, tenantId));
   const effectiveRows =
     tenantRows.length > 0 || tenantId === 'default' || tenantId === '*'
       ? tenantRows
       : [];
   const tiers = effectiveRows.map(mapRow);
   return c.json({ ok: true, data: tiers, lang });
 } catch (err) {
   const e = err as { cause?: unknown; name?: string; message?: string };
   log.error('pricing DB error', { cause: e.cause, name: e.name, message: e.message });
   return c.json({ ok: false, error: 'Failed to load pricing' }, 500);
 }
}
