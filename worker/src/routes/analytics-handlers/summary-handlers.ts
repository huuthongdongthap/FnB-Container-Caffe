import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import {
  getSummary,
  getSummaryCompare,
  getGrouped,
  type GroupBy,
} from '../../tree/analytics/summary';
import { SUMMARY_CACHE_TTL, getCached, setCacheWithTtl, summarySchema } from './helpers';

export function registerSummaryHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/analytics (root — summary with optional compare & group)
  router.get('/', async (c) => {
    const parsed = summarySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid query parameters',
        },
        400
      );
    }

    const { days, compare, group } = parsed.data;
    const db = c.env.AURA_DB;
    const kv = c.env.AUTH_KV;
    const cacheKey = `analytics:summary:${days}:${compare ?? false}:${group ?? 'none'}`;

    // KV cache (30s TTL for the summary endpoint)
    if (kv) {
      const cached = await getCached<unknown>(kv, cacheKey);
      if (cached) {
        return c.json({ success: true, data: cached.data, cached: true });
      }
    }

    let data: unknown;

    // compare=true — current + previous period
    if (compare) {
      data = await getSummaryCompare(db, days);

      // Write cache
      if (kv) {
        const cachePromise = setCacheWithTtl(kv, cacheKey, data, SUMMARY_CACHE_TTL);
        try {
          c.executionCtx.waitUntil(cachePromise);
        } catch {
          await cachePromise;
        }
      }

      return c.json({ success: true, data, cached: false });
    }

    // group=hour|day|category|payment — grouped aggregation
    if (group) {
      data = await getGrouped(db, group as GroupBy, days);

      // Write cache
      if (kv) {
        const cachePromise = setCacheWithTtl(kv, cacheKey, data, SUMMARY_CACHE_TTL);
        try {
          c.executionCtx.waitUntil(cachePromise);
        } catch {
          await cachePromise;
        }
      }

      return c.json({ success: true, data: { groups: data }, cached: false });
    }

    // Default: plain aggregate for the period
    data = await getSummary(db, days);

    // Write cache
    if (kv) {
      const cachePromise = setCacheWithTtl(kv, cacheKey, data, SUMMARY_CACHE_TTL);
      try {
        c.executionCtx.waitUntil(cachePromise);
      } catch {
        await cachePromise;
      }
    }

    return c.json({ success: true, data, cached: false });
  });
}
