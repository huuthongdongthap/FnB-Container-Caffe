import { createMixpostClient } from '../../lib/mixpost-client';
import { matchesTenantRow, resolvePilotStore } from '../../middleware/tenant';
import type { D1Database } from '@cloudflare/workers-types';
import type { PromotionRow } from './types';

export async function autoPostNewPromotions(env: Record<string, unknown>, tenantOverride?: string): Promise<{ posted: number }> {
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

  const { results } = await db.prepare(
    'SELECT * FROM promotions WHERE is_active = 1'
  ).all<PromotionRow>();
  const promotions = (results || []).filter((p) => matchesTenantRow(p as unknown as Record<string, unknown>, tenantId));
  if (promotions.length === 0) {
    return { posted: 0 };
  }

  let posted = 0;
  const client = createMixpostClient(apiUrl, apiToken);

  for (const promo of promotions) {
    try {
      const content = `🔥 Khuyen Mai ${promo.code}: Giam ${promo.percent}% — Aura Cafe\n#AuraCafe #KhuyenMai`;
      await client.createPost({ accounts, content });
      posted++;
    } catch {
      // skip failed posts
    }
  }

  return { posted };
}
