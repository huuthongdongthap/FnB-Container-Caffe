/**
 * Analytics Routes — /api/analytics
 *
 * D1-backed analytics endpoints with Zod validation and KV caching (5-min TTL).
 * - GET /top-products?limit=10     — top N products by order count + revenue
 * - GET /peak-hours?days=30        — orders grouped by hour of day
 * - GET /customer-metrics          — aggregate customer stats
 * - GET /export?start=&end=        — CSV export of all order data
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { getTopProducts } from '../tree/analytics/top-products';
import { getPeakHours } from '../tree/analytics/peak-hours';
import { getCustomerMetrics } from '../tree/analytics/customer-metrics';
import { getOrdersInRange, formatCsvRows } from '../tree/analytics/csv-export';

export const analyticsRouter = new Hono<{ Bindings: Env }>();

// ───── Validation Schemas ─────

const topProductsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const peakHoursSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const exportSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start must be YYYY-MM-DD'),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end must be YYYY-MM-DD'),
});

// ───── KV Cache Helpers ─────

const CACHE_TTL = 300; // 5 minutes

function buildCacheKey(path: string, params: Record<string, string | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `analytics:${path}${qs ? '?' + qs : ''}`;
}

async function getCached<T>(
  kv: import('@cloudflare/workers-types').KVNamespace,
  key: string,
): Promise<{ data: T; hit: boolean } | null> {
  const raw = await kv.get(key);
  if (raw) {
    try { return { data: JSON.parse(raw) as T, hit: true }; } catch { /* stale */ }
  }
  return null;
}

async function setCache(
  kv: import('@cloudflare/workers-types').KVNamespace,
  key: string,
  data: unknown,
): Promise<void> {
  await kv.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
}

// ───── Routes ─────

// GET /api/analytics/top-products
analyticsRouter.get('/top-products', async (c) => {
  const parsed = topProductsSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid query parameters',
    }, 400);
  }

  const { limit } = parsed.data;
  const kv = c.env.AUTH_KV;
  const cacheKey = buildCacheKey('top-products', { limit: String(limit) });

  // Try cache first
  if (kv) {
    const cached = await getCached<unknown[]>(kv, cacheKey);
    if (cached) {
      return c.json({ success: true, data: cached.data, cached: true });
    }
  }

  const data = await getTopProducts(c.env.AURA_DB, limit);

  // Write cache
  if (kv) {
    const cachePromise = setCache(kv, cacheKey, data);
    try {
      c.executionCtx.waitUntil(cachePromise);
    } catch {
      // No execution context (e.g. test environment) — await inline
      await cachePromise;
    }
  }

  return c.json({ success: true, data, cached: false });
});

// GET /api/analytics/peak-hours
analyticsRouter.get('/peak-hours', async (c) => {
  const parsed = peakHoursSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid query parameters',
    }, 400);
  }

  const { days } = parsed.data;
  const kv = c.env.AUTH_KV;
  const cacheKey = buildCacheKey('peak-hours', { days: String(days) });

  // Try cache first
  if (kv) {
    const cached = await getCached<unknown[]>(kv, cacheKey);
    if (cached) {
      return c.json({ success: true, data: cached.data, cached: true });
    }
  }

  const data = await getPeakHours(c.env.AURA_DB, days);

  // Write cache
  if (kv) {
    const cachePromise = setCache(kv, cacheKey, data);
    try {
      c.executionCtx.waitUntil(cachePromise);
    } catch {
      // No execution context (e.g. test environment) — await inline
      await cachePromise;
    }
  }

  return c.json({ success: true, data, cached: false });
});

// GET /api/analytics/customer-metrics
analyticsRouter.get('/customer-metrics', async (c) => {
  const data = await getCustomerMetrics(c.env.AURA_DB);
  return c.json({ success: true, data });
});

// GET /api/analytics/export?start=YYYY-MM-DD&end=YYYY-MM-DD
analyticsRouter.get('/export', async (c) => {
  const parsed = exportSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid query parameters',
    }, 400);
  }

  const { start, end } = parsed.data;
  const rows = await getOrdersInRange(c.env.AURA_DB, start, end);
  const csv = formatCsvRows(rows);

  return c.newResponse(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="orders-export-${start}-to-${end}.csv"`,
  });
});
