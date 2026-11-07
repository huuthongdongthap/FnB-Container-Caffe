/**
 * Admin Metrics Route — Queryable observability endpoint.
 * Staff-only access. Returns aggregated metrics from D1 _metrics table.
 *
 * GET /api/admin/metrics?range=24h|7d|30d
 */
import { Hono } from 'hono';
import type { Env } from '../types/env';
import { getMetricSummary } from '../lib/metrics-collector';
import { optionalAuth } from '../middleware/auth';
import { getTenantId, isHQSuperAdmin } from '../middleware/tenant';

const adminMetrics = new Hono<{ Bindings: Env }>();

const ADMIN_METRICS_ALLOWED_ROLES = ['owner', 'manager', 'admin'];

const TENANT_METRIC_PREDICATE =
  " AND COALESCE(NULLIF(TRIM(tags ->> '$.tenant_id'), ''), 'default') = ?";

async function queryMetricsFirst<T>(
  db: D1Database,
  baseSql: string,
  baseBinds: unknown[],
  tenantId: string
): Promise<T | null> {
  if (tenantId !== '*') {
    try {
      return await db
        .prepare(`${baseSql}${TENANT_METRIC_PREDICATE}`)
        .bind(...baseBinds, tenantId)
        .first<T>();
    } catch (err) {
      if (tenantId === 'default') throw err;
      return null;
    }
  }
  return db.prepare(baseSql).bind(...baseBinds).first<T>();
}

async function queryMetricsAll<T>(
  db: D1Database,
  baseSql: string,
  tailSql: string,
  baseBinds: unknown[],
  tenantId: string
): Promise<{ results?: T[] }> {
  if (tenantId !== '*') {
    try {
      return await db
        .prepare(`${baseSql}${TENANT_METRIC_PREDICATE}${tailSql ? ` ${tailSql}` : ''}`)
        .bind(...baseBinds, tenantId)
        .all<T>();
    } catch (err) {
      if (tenantId === 'default') throw err;
      return { results: [] };
    }
  }
  return db
    .prepare(`${baseSql}${tailSql ? ` ${tailSql}` : ''}`)
    .bind(...baseBinds)
    .all<T>();
}

interface LatencyRow { duration: number; }
interface TopPathRow { path: string; cnt: number; }

const VALID_RANGES = ['24h', '7d', '30d'] as const;
type Range = typeof VALID_RANGES[number];

function getRangeHours(range: Range): number {
  switch (range) {
  case '24h': return 24;
  case '7d': return 168;
  case '30d': return 720;
  }
}

adminMetrics.get('/', async(c) => {
  const range = c.req.query('range') || '24h';
  const filter = c.req.query('filter');
  if (!VALID_RANGES.includes(range as Range)) {
    return c.json({ error: 'Invalid range. Use: 24h, 7d, 30d' }, 400);
  }
  if (filter !== undefined && (filter.length === 0 || filter.length > 100 || !/^[A-Za-z0-9_.*:-]+$/.test(filter))) {
    return c.json({ error: 'Invalid filter parameter' }, 400);
  }

  if (!c.get('user' as any) && c.req.header('Authorization') && typeof optionalAuth === 'function') {
    await optionalAuth()(c, async() => {});
  }
  const user = c.get('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (!user?.role) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }
  const roleLower = String(user.role).toLowerCase();
  const isAuthBearerStaff = roleLower === 'staff' && Boolean(c.req.header('Authorization') || c.req.header('authorization'));
  if (!ADMIN_METRICS_ALLOWED_ROLES.includes(roleLower) && !isAuthBearerStaff) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }

  const rawUserTenant = user.tenantId ?? user.tenant_id;
  const userTenant = typeof rawUserTenant === 'string' && rawUserTenant.trim() ? rawUserTenant.trim() : 'default';
  const normalizedUser = { ...user, role: String(user.role).toLowerCase(), tenantId: userTenant };
  (c as unknown as { set?: (k: string, v: unknown) => void }).set?.('user', normalizedUser);
  const rawTenantId = getTenantId(c as Parameters<typeof getTenantId>[0]);
  const requestedTenant = (
    c.req.query('tenant_id') ||
    c.req.query('tenantId') ||
    c.req.query('store_id') ||
    c.req.query('storeId') ||
    c.req.header('x-tenant-id') ||
    c.req.header('X-Tenant-ID') ||
    c.req.header('x-store-id') ||
    c.req.header('X-Store-ID') ||
    ''
  ).trim();
  const isHq = isHQSuperAdmin(normalizedUser as any);
  if (!isHq) {
    if (
      userTenant === '*' ||
      userTenant.toLowerCase() === 'hq' ||
      rawTenantId === '*' ||
      rawTenantId.toLowerCase() === 'hq' ||
      requestedTenant === '*' ||
      requestedTenant.toLowerCase() === 'hq' ||
      userTenant !== rawTenantId ||
      (requestedTenant && requestedTenant !== userTenant)
    ) {
      return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
    }
  }
  const hqTarget = requestedTenant || rawTenantId || '*';
  const tenantId = isHq ? (hqTarget.toLowerCase() === 'hq' ? '*' : hqTarget) : userTenant;

  const hours = getRangeHours(range as Range);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as D1Database;
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  // If filter param is provided, query by metric name prefix using getMetricSummary
  if (filter) {
    try {
      const likePattern = filter.includes('*') ? filter.replace(/\*/g, '%') : `${filter}%`;
      const nameRows = await queryMetricsAll<{ name: string }>(
        db,
        'SELECT DISTINCT name FROM _metrics WHERE name LIKE ? AND created_at >= ?',
        'ORDER BY name',
        [likePattern, since],
        tenantId
      );

      const names = (nameRows.results || []).map(r => r.name);
      const summaries = await Promise.all(
        names.map(name => getMetricSummary(db, name, range, tenantId))
      );

      const filtered = summaries.filter(Boolean);

      if (filter.startsWith('web_vital')) {
        const vitalRows = await queryMetricsAll<{ name: string; rating: string | null; cnt: number }>(
          db,
          'SELECT name, json_extract(tags, \'$.rating\') as rating, COUNT(*) as cnt FROM _metrics WHERE name LIKE ? AND created_at >= ?',
          'GROUP BY name, rating',
          [likePattern, since],
          tenantId
        );

        const vitals: Record<string, { good: number; needsImprovement: number; poor: number }> = {};
        for (const row of vitalRows.results || []) {
          const metricName = String(row.name || '').replace(/^web_vital_/, '');
          if (!metricName) continue;
          if (!vitals[metricName]) {
            vitals[metricName] = { good: 0, needsImprovement: 0, poor: 0 };
          }
          const count = Number(row.cnt ?? 0);
          if (row.rating === 'good') {
            vitals[metricName].good += count;
          } else if (row.rating === 'needs-improvement' || row.rating === 'needsImprovement') {
            vitals[metricName].needsImprovement += count;
          } else if (row.rating === 'poor') {
            vitals[metricName].poor += count;
          }
        }

        const targets: Record<string, { good: number; poor: number }> = {
          CLS: { good: 0.1, poor: 0.25 },
          FCP: { good: 1800, poor: 3000 },
          LCP: { good: 2500, poor: 4000 },
          INP: { good: 200, poor: 500 },
          TTFB: { good: 800, poor: 1800 },
        };

        return c.json({
          range,
          filter,
          generated_at: new Date().toISOString(),
          vitals,
          targets,
          metrics: filtered,
          total: filtered.length
        });
      }

      if (filter === 'request_duration_ms') {
        const durationRows = await queryMetricsAll<LatencyRow>(
          db,
          'SELECT COALESCE(CAST(json_extract(tags, \'$.duration\') AS REAL), value) as duration FROM _metrics WHERE name IN (\'request\', \'request_duration_ms\') AND created_at >= ?',
          'ORDER BY duration LIMIT 5000',
          [since],
          tenantId
        );

        const durations = (durationRows.results || [])
          .map((r) => Number(r.duration))
          .filter((d) => Number.isFinite(d) && d >= 0)
          .sort((a, b) => a - b);

        const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
        const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
        const p99 = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0;

        const dailyRows = await queryMetricsAll<{ date: string; count: number }>(
          db,
          'SELECT substr(created_at, 1, 10) as date, COUNT(*) as count FROM _metrics WHERE name IN (\'request\', \'request_duration_ms\') AND created_at >= ?',
          'GROUP BY substr(created_at, 1, 10) ORDER BY date DESC LIMIT 30',
          [since],
          tenantId
        );

        return c.json({
          range,
          filter,
          generated_at: new Date().toISOString(),
          p50,
          p95,
          p99,
          requestCounts: (dailyRows.results || []).map((r) => ({
            date: String(r.date || ''),
            count: Number(r.count ?? 0),
          })),
          metrics: filtered,
          total: filtered.length
        });
      }

      return c.json({
        range,
        filter,
        generated_at: new Date().toISOString(),
        metrics: filtered,
        total: filtered.length
      });
    } catch {
      return c.json({ error: 'Failed to query metrics' }, 500);
    }
  }

  try {
    const [reqRow, errRow, orderRow, revenueRow] = await Promise.all([
      queryMetricsFirst<{ total: number }>(db, 'SELECT COUNT(*) as total FROM _metrics WHERE name = \'request\' AND created_at >= ?', [since], tenantId),
      queryMetricsFirst<{ total: number }>(db, 'SELECT COUNT(*) as total FROM _metrics WHERE name = \'request\' AND CAST(json_extract(tags, \'$.status\') AS INTEGER) >= 400 AND created_at >= ?', [since], tenantId),
      queryMetricsFirst<{ total: number }>(db, 'SELECT COUNT(*) as total FROM _metrics WHERE name = \'order_created\' AND created_at >= ?', [since], tenantId),
      queryMetricsFirst<{ total: number }>(db, 'SELECT COALESCE(SUM(value), 0) as total FROM _metrics WHERE name = \'revenue\' AND created_at >= ?', [since], tenantId)
    ]);

    // Latency: get all durations for p50/p95 calculation
    const latencyRows = await queryMetricsAll<LatencyRow>(
      db,
      'SELECT CAST(json_extract(tags, \'$.duration\') AS REAL) as duration FROM _metrics WHERE name = \'request\' AND created_at >= ? AND json_extract(tags, \'$.duration\') IS NOT NULL',
      'ORDER BY duration LIMIT 5000',
      [since],
      tenantId
    );

    const durations = (latencyRows.results || [])
      .map((r) => r.duration)
      .filter((d) => typeof d === 'number' && !isNaN(d))
      .sort((a, b) => a - b);

    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;

    // Top paths
    const topPathRows = await queryMetricsAll<TopPathRow>(
      db,
      'SELECT json_extract(tags, \'$.path\') as path, COUNT(*) as cnt FROM _metrics WHERE name = \'request\' AND created_at >= ?',
      'GROUP BY path ORDER BY cnt DESC LIMIT 10',
      [since],
      tenantId
    );

    const metrics = {
      range,
      since,
      generated_at: new Date().toISOString(),
      requests: { total: reqRow?.total ?? 0 },
      errors: { total: errRow?.total ?? 0 },
      orders: { total: orderRow?.total ?? 0 },
      revenue: { total: revenueRow?.total ?? 0 },
      latency: { p50, p95 },
      topPaths: (topPathRows.results || []).map((r) => ({
        path: r.path || 'unknown',
        count: r.cnt || 0
      }))
    };

    return c.json(metrics);
  } catch {
    return c.json({ error: 'Failed to query metrics' }, 500);
  }
});

export default adminMetrics;
