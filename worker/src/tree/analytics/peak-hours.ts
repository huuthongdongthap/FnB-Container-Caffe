/**
 * Peak Hours — D1 query for orders grouped by hour of day
 *
 * GET /api/analytics/peak-hours?days=30
 */

export interface PeakHourRow {
  hour: number;
  order_count: number;
  revenue: number;
}

/**
 * Get order distribution by hour of day for the last N days.
 * Returns a zero-filled 24-element array for consistent charting.
 */
export async function getPeakHours(
  db: import('@cloudflare/workers-types').D1Database,
  days: number
): Promise<PeakHourRow[]> {
  const { results } = await db.prepare(`
    SELECT
      CAST(strftime('%H', o.created_at) AS INTEGER) AS hour,
      COUNT(*) AS order_count,
      COALESCE(SUM(o.total), 0) AS revenue
    FROM orders o
    WHERE o.created_at >= datetime('now', '-' || ? || ' days')
      AND o.status != 'cancelled'
    GROUP BY hour
    ORDER BY hour
  `).bind(days).all<PeakHourRow>();

  const rows = results || [];

  // Build zero-filled 24-hour array
  const hourMap = new Map<number, PeakHourRow>();
  for (const row of rows) {
    hourMap.set(row.hour, row);
  }

  const peakHours: PeakHourRow[] = [];
  for (let h = 0; h < 24; h++) {
    const existing = hourMap.get(h);
    peakHours.push({
      hour: h,
      order_count: existing?.order_count ?? 0,
      revenue: existing?.revenue ?? 0
    });
  }

  return peakHours;
}
