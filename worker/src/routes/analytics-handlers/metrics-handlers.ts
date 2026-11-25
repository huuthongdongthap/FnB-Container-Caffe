import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { createLogger } from '../../middleware/logger';
import { getTopProducts } from '../../tree/analytics/top-products';
import { getPeakHours } from '../../tree/analytics/peak-hours';
import { getCustomerMetrics } from '../../tree/analytics/customer-metrics';
import { getZoneStats } from '../../tree/analytics/zone-analytics';
import { buildTenantFilter, resolveAnalyticsTenant } from '../../tree/analytics/summary';
import { topProductsSchema, peakHoursSchema, zoneSchema, buildCacheKey, getCached, setCache } from './helpers';

export { resolveAnalyticsTenant };

const log = createLogger({ route: 'analytics-metrics' });

export function registerMetricsHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/analytics/top-products
  router.get('/top-products', async (c) => {
    const { tenantId, forbidden } = resolveAnalyticsTenant(c);
    if (forbidden) {
      return c.json({ success: false, error: 'Cross-tenant analytics access denied' }, 403);
    }
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
    const cacheKey = buildCacheKey('top-products', { tenant: tenantId, limit: String(limit) });

    // Try cache first
    if (kv) {
      const cached = await getCached<unknown[]>(kv, cacheKey);
      if (cached) {
        return c.json({ success: true, data: cached.data, cached: true });
      }
    }

    const data = await getTopProducts(c.env.AURA_DB, limit, tenantId);

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
    const { tenantId, forbidden } = resolveAnalyticsTenant(c);
    if (forbidden) {
      return c.json({ success: false, error: 'Cross-tenant analytics access denied' }, 403);
    }
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
    const cacheKey = buildCacheKey('peak-hours', { tenant: tenantId, days: String(days) });

    // Try cache first
    if (kv) {
      const cached = await getCached<unknown[]>(kv, cacheKey);
      if (cached) {
        return c.json({ success: true, data: cached.data, cached: true });
      }
    }

    const data = await getPeakHours(c.env.AURA_DB, days, tenantId);

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
    const { tenantId, forbidden } = resolveAnalyticsTenant(c);
    if (forbidden) {
      return c.json({ success: false, error: 'Cross-tenant analytics access denied' }, 403);
    }
    const data = await getCustomerMetrics(c.env.AURA_DB, tenantId);
    return c.json({ success: true, data });
  });

  // GET /api/analytics/zones?days=30 — orders grouped by physical zone (Indoor/Outdoor/VIP/etc.)
  router.get('/zones', async (c) => {
    const { tenantId, forbidden } = resolveAnalyticsTenant(c);
    if (forbidden) {
      return c.json({ success: false, error: 'Cross-tenant analytics access denied' }, 403);
    }
    const parsed = zoneSchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid query parameters' },
        400
      );
    }
    const { days } = parsed.data;
    const kv = c.env.AUTH_KV;
    const cacheKey = buildCacheKey('zones', { tenant: tenantId, days: String(days) });
    if (kv) {
      const cached = await getCached<unknown[]>(kv, cacheKey);
      if (cached) return c.json({ success: true, data: cached.data, cached: true });
    }
    const data = await getZoneStats(c.env.AURA_DB, days, tenantId);
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
    const { tenantId, forbidden } = resolveAnalyticsTenant(c);
    if (forbidden) {
      return c.json({ success: false, error: 'Cross-tenant analytics access denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const { clause: tenantWhere, binds: tenantBinds } = buildTenantFilter(tenantId, undefined, 'WHERE');
    const runFirst = <T>(sql: string) => {
      const stmt = db.prepare(sql);
      return tenantBinds.length > 0 ? stmt.bind(...tenantBinds).first<T>() : stmt.first<T>();
    };
    const activeOrderStatusSql =
      "LOWER(TRIM(COALESCE(status, ''))) IN ('pending', 'paid', 'confirmed', 'preparing', 'ready', 'served', 'delivering', 'delivered', 'completed')";
    const settledPaymentStatusSql =
      "LOWER(TRIM(COALESCE(payment_status, ''))) IN ('paid', 'completed', 'partially_refunded')";
    const partialRefundSubquerySql =
      "COALESCE((SELECT SUM(COALESCE(p.refund_amount, 0)) FROM payments p WHERE p.order_id = orders.id AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(orders.tenant_id), ''), 'default')), 0)";
    const netOrderExprSql =
      `MAX(0, COALESCE(total, 0) - CASE WHEN LOWER(TRIM(COALESCE(payment_status, ''))) = 'partially_refunded' THEN ${partialRefundSubquerySql} ELSE 0 END)`;
    try {
      let row: { cod_total: number; payos_total: number; refunded_total: number; net_total?: number; total_orders: number } | null = null;
      try {
        row = await runFirst<{ cod_total: number; payos_total: number; refunded_total: number; net_total?: number; total_orders: number }>(`SELECT
          COALESCE(SUM(CASE WHEN (COALESCE(is_cod, 0) = 1 OR LOWER(TRIM(COALESCE(payment_method, ''))) IN ('cash', 'cod')) AND ${settledPaymentStatusSql} AND ${activeOrderStatusSql} THEN ${netOrderExprSql} ELSE 0 END), 0) AS cod_total,
          COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_method, ''))) = 'payos' AND ${settledPaymentStatusSql} AND ${activeOrderStatusSql} THEN ${netOrderExprSql} ELSE 0 END), 0) AS payos_total,
          COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'refunded' OR COALESCE(payment_status, '') = 'refunded' THEN COALESCE(total, 0) WHEN LOWER(TRIM(COALESCE(payment_status, ''))) = 'partially_refunded' THEN ${partialRefundSubquerySql} ELSE 0 END), 0) AS refunded_total,
          (
            COALESCE(SUM(CASE WHEN (COALESCE(is_cod, 0) = 1 OR LOWER(TRIM(COALESCE(payment_method, ''))) IN ('cash', 'cod')) AND ${settledPaymentStatusSql} AND ${activeOrderStatusSql} THEN ${netOrderExprSql} ELSE 0 END), 0) +
            COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_method, ''))) = 'payos' AND ${settledPaymentStatusSql} AND ${activeOrderStatusSql} THEN ${netOrderExprSql} ELSE 0 END), 0)
          ) AS net_total,
          COALESCE(SUM(CASE WHEN ${activeOrderStatusSql} AND ${settledPaymentStatusSql} AND NOT (COALESCE(total, 0) = 0 AND (COALESCE(customer_name, '') = 'Khách QR - cho don mon' OR COALESCE(items, '') IN ('', '[]'))) THEN 1 ELSE 0 END), 0) AS total_orders
          FROM orders${tenantWhere}`);
      } catch (queryErr) {
        const errMsg = String((queryErr as Error)?.message || '');
        if (errMsg.includes('column') || errMsg.includes('no such table')) {
          try {
            row = await runFirst<{ cod_total: number; payos_total: number; refunded_total: number; net_total?: number; total_orders: number }>(`SELECT
              COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_method, ''))) IN ('cash', 'cod') AND ${settledPaymentStatusSql} AND ${activeOrderStatusSql} THEN COALESCE(total, 0) ELSE 0 END), 0) AS cod_total,
              COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_method, ''))) = 'payos' AND ${settledPaymentStatusSql} AND ${activeOrderStatusSql} THEN COALESCE(total, 0) ELSE 0 END), 0) AS payos_total,
              COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'refunded' OR COALESCE(payment_status, '') = 'refunded' THEN COALESCE(total, 0) ELSE 0 END), 0) AS refunded_total,
              (
                COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_method, ''))) IN ('cash', 'cod') AND ${settledPaymentStatusSql} AND ${activeOrderStatusSql} THEN COALESCE(total, 0) ELSE 0 END), 0) +
                COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_method, ''))) = 'payos' AND ${settledPaymentStatusSql} AND ${activeOrderStatusSql} THEN COALESCE(total, 0) ELSE 0 END), 0)
              ) AS net_total,
              COALESCE(SUM(CASE WHEN ${activeOrderStatusSql} AND ${settledPaymentStatusSql} THEN 1 ELSE 0 END), 0) AS total_orders
              FROM orders${tenantWhere}`);
          } catch (fbErr) {
            if (/no such column:\s*payment_status|no column named\s*payment_status/i.test(String((fbErr as Error)?.message || ''))) {
              row = await runFirst<{ cod_total: number; payos_total: number; refunded_total: number; net_total?: number; total_orders: number }>(`SELECT
                COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_method, ''))) IN ('cash', 'cod') AND LOWER(TRIM(COALESCE(status, ''))) IN ('paid', 'completed', 'delivered', 'served') THEN COALESCE(total, 0) ELSE 0 END), 0) AS cod_total,
                COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_method, ''))) = 'payos' AND LOWER(TRIM(COALESCE(status, ''))) IN ('paid', 'completed', 'delivered', 'served') THEN COALESCE(total, 0) ELSE 0 END), 0) AS payos_total,
                COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'refunded' THEN COALESCE(total, 0) ELSE 0 END), 0) AS refunded_total,
                (
                  COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_method, ''))) IN ('cash', 'cod') AND LOWER(TRIM(COALESCE(status, ''))) IN ('paid', 'completed', 'delivered', 'served') THEN COALESCE(total, 0) ELSE 0 END), 0) +
                  COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_method, ''))) = 'payos' AND LOWER(TRIM(COALESCE(status, ''))) IN ('paid', 'completed', 'delivered', 'served') THEN COALESCE(total, 0) ELSE 0 END), 0)
                ) AS net_total,
                COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) IN ('paid', 'completed', 'delivered', 'served') THEN 1 ELSE 0 END), 0) AS total_orders
                FROM orders${tenantWhere}`);
            } else {
              throw fbErr;
            }
          }
        } else {
          throw queryErr;
        }
      }

      const net = typeof row?.net_total === 'number'
        ? row.net_total
        : (row?.cod_total || 0) + (row?.payos_total || 0) - (row?.refunded_total || 0);
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
      log.error('Analytics payout query error:', { message: (err as Error).message });
      return c.json({ success: false, error: 'Failed to retrieve payout analytics' }, 500);
    }
  });
}
