import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTopProducts } from '../../tree/analytics/top-products';
import { getPeakHours } from '../../tree/analytics/peak-hours';
import { getCustomerMetrics } from '../../tree/analytics/customer-metrics';
import { getZoneStats } from '../../tree/analytics/zone-analytics';
import { topProductsSchema, peakHoursSchema, zoneSchema, CACHE_TTL, buildCacheKey, getCached, setCache } from './helpers';

export function registerMetricsHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/analytics/top-products
  router.get('/top-products', async (c) => {
    const parsed = topProductsSchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid query parameters',
        },
        400
      );
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
  router.get('/peak-hours', async (c) => {
    const parsed = peakHoursSchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid query parameters',
        },
        400
      );
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
  router.get('/customer-metrics', async (c) => {
    const data = await getCustomerMetrics(c.env.AURA_DB);
    return c.json({ success: true, data });
  });

  // GET /api/analytics/zones?days=30 — orders grouped by physical zone (Indoor/Outdoor/VIP/etc.)
  router.get('/zones', async (c) => {
    const parsed = zoneSchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid query parameters' },
        400
      );
    }
    const { days } = parsed.data;
    const kv = c.env.AUTH_KV;
    const cacheKey = buildCacheKey('zones', { days: String(days) });
    if (kv) {
      const cached = await getCached<unknown[]>(kv, cacheKey);
      if (cached) return c.json({ success: true, data: cached.data, cached: true });
    }
    const data = await getZoneStats(c.env.AURA_DB, days);
    if (kv) {
      const p = setCache(kv, cacheKey, data);
      try {
        c.executionCtx.waitUntil(p);
      } catch {
        await p;
      }
    }
    return c.json({ success: true, data, cached: false });
  });

  // GET /api/analytics/payout - owner only: COD + PayOS net payout summary
  router.get('/payout', requireAuth(['owner']), async (c) => {
    const db = c.env.AURA_DB;
    try {
      const row = await db.prepare(`SELECT
        COALESCE(SUM(CASE WHEN is_cod = 1 AND payment_status = 'paid' AND status = 'completed' THEN total ELSE 0 END), 0) AS cod_total,
        COALESCE(SUM(CASE WHEN payment_method = 'payos' AND payment_status = 'paid' AND status = 'paid' THEN total ELSE 0 END), 0) AS payos_total,
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN total ELSE 0 END), 0) AS refunded_total,
        COUNT(*) AS total_orders
        FROM orders`).first<{ cod_total: number; payos_total: number; refunded_total: number; total_orders: number }>();

      const net = (row?.cod_total || 0) + (row?.payos_total || 0) - (row?.refunded_total || 0);
      return c.json({
        success: true,
        data: {
          cod: row?.cod_total || 0,
          payos: row?.payos_total || 0,
          refunded: row?.refunded_total || 0,
          net,
          total_orders: row?.total_orders || 0,
        },
      });
    } catch (err) {
      return c.json({ success: false, error: (err as Error).message }, 500);
    }
  });
}