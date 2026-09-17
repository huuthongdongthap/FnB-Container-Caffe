import { z } from 'zod';

// ───── Validation Schemas ─────

export const topProductsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const peakHoursSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const exportSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start must be YYYY-MM-DD'),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end must be YYYY-MM-DD'),
});

export const summarySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  compare: z.coerce.boolean().optional(),
  group: z.enum(['hour', 'day', 'category', 'payment']).optional(),
});

export const zoneSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

// ───── KV Cache Helpers ─────

export const CACHE_TTL = 300; // 5 minutes
export const SUMMARY_CACHE_TTL = 30; // 30 seconds (for the / endpoint)

export function buildCacheKey(path: string, params: Record<string, string | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `analytics:${path}${qs ? `?${qs}` : ''}`;
}

export async function getCached<T>(
  kv: import('@cloudflare/workers-types').KVNamespace,
  key: string
): Promise<{ data: T; hit: boolean } | null> {
  const raw = await kv.get(key);
  if (raw) {
    try {
      return { data: JSON.parse(raw) as T, hit: true };
    } catch {
      /* stale */
    }
  }
  return null;
}

export async function setCache(
  kv: import('@cloudflare/workers-types').KVNamespace,
  key: string,
  data: unknown
): Promise<void> {
  await kv.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
}

export async function setCacheWithTtl(
  kv: import('@cloudflare/workers-types').KVNamespace,
  key: string,
  data: unknown,
  ttl: number
): Promise<void> {
  await kv.put(key, JSON.stringify(data), { expirationTtl: ttl });
}
