/**
 * Analytics — Zone aggregation
 *
 * Groups orders by physical zone (Indoor/Outdoor/VIP/etc.)
 * by joining orders → cafe_tables via table_id.
 * Falls back to 'Mang đi' for orders with no table_id.
 */

export interface ZoneRow {
  label: string;
  value: number; // total revenue (VND)
  count: number; // order count
}

export async function getZoneStats(
  db: import('@cloudflare/workers-types').D1Database,
  days: number
): Promise<ZoneRow[]> {
  const { results } = await db.prepare(`  SELECT
    COALESCE(ct.zone, 'Mang đi') AS label,
    COALESCE(SUM(o.total), 0) AS value,
    COUNT(*) AS count
  FROM orders o
  LEFT JOIN cafe_tables ct ON ct.id = o.table_id
  WHERE o.status != 'cancelled'
    AND o.created_at >= datetime('now', '-' || ? || ' days')
  GROUP BY label
  ORDER BY value DESC
 `).bind(days).all<ZoneRow>();

  return results || [];
}
