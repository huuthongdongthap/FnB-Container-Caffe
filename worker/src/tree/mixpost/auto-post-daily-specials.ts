import { createMixpostClient } from '../../lib/mixpost-client';
import { matchesTenantRow, resolvePilotStore } from '../../middleware/tenant';
import type { D1Database } from '@cloudflare/workers-types';
import type { ProductRow } from './types';

export async function autoPostDailySpecials(env: Record<string, unknown>, tenantOverride?: string): Promise<{ posted: number }> {
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
    'SELECT * FROM products WHERE is_available = 1 LIMIT 50'
  ).all<ProductRow>();
  const products = (results || []).filter((p) => matchesTenantRow(p as unknown as Record<string, unknown>, tenantId)).slice(0, 5);
  if (products.length === 0) {
    return { posted: 0 };
  }

  const names = products.map((p: ProductRow) => p.name).join(', ');
  const content = `☕ Menu Hang Ngay — Aura Cafe: ${names}\n📞 1900 1234\n#AuraCafe #MenuHangNgay`;

  const client = createMixpostClient(apiUrl, apiToken);
  await client.createPost({ accounts, content });
  return { posted: 1 };
}
