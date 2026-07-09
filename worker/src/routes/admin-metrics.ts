/**
 * Admin Metrics Route — Queryable observability endpoint.
 * Staff-only access. Returns aggregated metrics from D1 _metrics table.
 *
 * GET /api/admin/metrics?range=24h|7d|30d
 */
import { Hono } from 'hono';
import type { Env } from '../types/env';
import { getMetricSummary } from '../lib/metrics-collector';

const adminMetrics = new Hono<{ Bindings: Env }>();

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

  const hours = getRangeHours(range as Range);
  const db = c.env.AURA_DB;
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  // If filter param is provided, query by metric name prefix using getMetricSummary
  if (filter) {
    try {
      const nameRows = await db.prepare(
        'SELECT DISTINCT name FROM _metrics WHERE name LIKE ? AND created_at >= ? ORDER BY name'
      ).bind(`${filter}%`, since).all<{ name: string }>();

      const names = (nameRows.results || []).map(r => r.name);
      const summaries = await Promise.all(
        names.map(name => getMetricSummary(db, name, range))
      );

      const filtered = summaries.filter(Boolean);
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
      db.prepare('SELECT COUNT(*) as total FROM _metrics WHERE name = \'request\' AND created_at >= ?').bind(since).first<{ total: number }>(),
      db.prepare('SELECT COUNT(*) as total FROM _metrics WHERE name = \'request\' AND CAST(json_extract(tags, \'$.status\') AS INTEGER) >= 400 AND created_at >= ?').bind(since).first<{ total: number }>(),
      db.prepare('SELECT COUNT(*) as total FROM _metrics WHERE name = \'order_created\' AND created_at >= ?').bind(since).first<{ total: number }>(),
      db.prepare('SELECT COALESCE(SUM(value), 0) as total FROM _metrics WHERE name = \'revenue\' AND created_at >= ?').bind(since).first<{ total: number }>()
    ]);

    // Latency: get all durations for p50/p95 calculation
    const latencyRows = await db.prepare(
      'SELECT CAST(json_extract(tags, \'$.duration\') AS REAL) as duration FROM _metrics WHERE name = \'request\' AND created_at >= ? AND json_extract(tags, \'$.duration\') IS NOT NULL ORDER BY duration'
    ).bind(since).all<LatencyRow>();

    const durations = (latencyRows.results || [])
      .map((r) => r.duration)
      .filter((d) => typeof d === 'number' && !isNaN(d))
      .sort((a, b) => a - b);

    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;

    // Top paths
    const topPathRows = await db.prepare(
      'SELECT json_extract(tags, \'$.path\') as path, COUNT(*) as cnt FROM _metrics WHERE name = \'request\' AND created_at >= ? GROUP BY path ORDER BY cnt DESC LIMIT 10'
    ).bind(since).all<TopPathRow>();

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
