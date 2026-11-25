import { createMixpostClient } from '../../lib/mixpost-client';
import { autoPostPeriod, createClaimedAutoPost } from './auto-post-claim';
import { matchesTenantRow, resolvePilotStore } from '../../middleware/tenant';
import type { D1Database } from '@cloudflare/workers-types';
import type { ProductRow } from './types';

async function resolveStoreSocialBrandAndPhone(
  db: D1Database,
  env: Record<string, unknown>,
  tenantId: string
): Promise<{ brandName: string; brandTag: string; phone: string }> {
  let brandName = '';
  let phone = typeof env.STORE_HOTLINE === 'string' ? env.STORE_HOTLINE.trim() : '';

  if (tenantId && tenantId !== '*') {
    try {
      const branding = await db
        .prepare('SELECT display_name, phone FROM tenant_branding WHERE tenant_id = ? LIMIT 1')
        .bind(tenantId)
        .first<{ display_name?: string | null; phone?: string | null }>();
      if (branding?.display_name && branding.display_name.trim()) {
        brandName = branding.display_name.trim();
      }
      if (!phone && branding?.phone && branding.phone.trim()) {
        phone = branding.phone.trim();
      }
    } catch {
      // tenant_branding optional
    }

    if (!brandName) {
      try {
        const tenantRow = await db
          .prepare('SELECT name FROM saas_tenants WHERE id = ? LIMIT 1')
          .bind(tenantId)
          .first<{ name?: string | null }>();
        if (tenantRow?.name && tenantRow.name.trim()) {
          brandName = tenantRow.name.trim();
        }
      } catch {
        // saas_tenants optional
      }
    }

    if (!phone) {
      try {
        const locRow = await db
          .prepare("SELECT phone FROM franchise_locations WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND phone IS NOT NULL AND TRIM(phone) != '' LIMIT 1")
          .bind(tenantId)
          .first<{ phone?: string | null }>();
        if (locRow?.phone && locRow.phone.trim()) {
          phone = locRow.phone.trim();
        }
      } catch {
        // franchise_locations optional
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
    phone,
  };
}

export async function autoPostDailySpecials(env: Record<string, unknown>, tenantOverride?: string, now = new Date()): Promise<{ posted: number }> {
  const job = 'daily-specials';
  const period = autoPostPeriod(job, now);
  if (!period) return { posted: 0 };

  const apiUrl = env.MIXPOST_API_URL as string | undefined;
  const apiToken = env.MIXPOST_API_TOKEN as string | undefined;
  const accountsStr = env.MIXPOST_ACCOUNTS as string | undefined;
  const db = env.AURA_DB as D1Database | undefined;

  if (!apiUrl || !apiToken) {
    return { posted: 0 };
  }
  if (!accountsStr) {
    return { posted: 0 };
  }
  if (!db) {
    return { posted: 0 };
  }

  const tenantId = (tenantOverride || resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0])).trim() || 'default';
  const accounts = accountsStr.split(',').map(Number).filter(n => n > 0);

  let results: ProductRow[] | undefined;
  let scopedOk = false;
  if (tenantId !== '*') {
    try {
      const stmt = db.prepare(
        "SELECT * FROM products WHERE is_available = 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 50"
      );
      const bound = typeof (stmt as unknown as { bind?: (...args: unknown[]) => typeof stmt }).bind === 'function'
        ? stmt.bind(tenantId)
        : stmt;
      const res = await bound.all<ProductRow>();
      results = res.results;
      scopedOk = true;
    } catch {
      scopedOk = false;
    }
  }
  if (!scopedOk) {
    const res = await db.prepare(
      'SELECT * FROM products WHERE is_available = 1 LIMIT 50'
    ).all<ProductRow>();
    results = res.results;
  }
  const products = (results || []).filter((p) => matchesTenantRow(p as unknown as Record<string, unknown>, tenantId)).slice(0, 5);
  if (products.length === 0) {
    return { posted: 0 };
  }

  const { brandName, brandTag, phone } = await resolveStoreSocialBrandAndPhone(db, env, tenantId);
  const names = products.map((p: ProductRow) => p.name).join(', ');
  const hotlineLine = phone ? `\nHotline: ${phone}` : '';
  const content = `Menu Hàng Ngày — ${brandName}: ${names}${hotlineLine}\n#${brandTag} #MenuHangNgay`;

  const client = createMixpostClient(apiUrl, apiToken);
  const posted = await createClaimedAutoPost(
    db, job, tenantId, period, now, () => client.createPost({ accounts, content }),
  );
  return { posted: posted ? 1 : 0 };
}
