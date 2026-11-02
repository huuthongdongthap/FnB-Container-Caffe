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
  days: number,
  tenantId?: string
): Promise<ZoneRow[]> {
  const hasTenant = Boolean(tenantId && tenantId !== '*');
  const tenantClause = !hasTenant
    ? ''
    : tenantId === 'default'
      ? " AND (o.tenant_id = ? OR o.tenant_id IS NULL OR o.tenant_id = '')"
      : ' AND o.tenant_id = ?';
  const binds: Array<number | string> = hasTenant && tenantId ? [days, tenantId] : [days];
  try {
    const { results } = await db.prepare(`  SELECT
    COALESCE(ct.zone, 'Mang đi') AS label,
    COALESCE(SUM(o.total), 0) AS value,
    COUNT(*) AS count
  FROM orders o
  LEFT JOIN cafe_tables ct ON ct.id = o.table_id
  WHERE o.status != 'cancelled'
    AND o.created_at >= datetime('now', '-' || ? || ' days')${tenantClause}
  GROUP BY label
  ORDER BY value DESC
 `).bind(...binds).all<ZoneRow>();

    return results || [];
  } catch {
    try {
      const { results } = await db.prepare(`  SELECT
    COALESCE(t.zone, 'Mang đi') AS label,
    COALESCE(SUM(COALESCE(o.total, o.total_amount, 0)), 0) AS value,
    COUNT(*) AS count
  FROM orders o
  LEFT JOIN tables t ON t.id = o.table_id
  WHERE o.status != 'cancelled'
    AND o.created_at >= datetime('now', '-' || ? || ' days')${tenantClause}
  GROUP BY label
  ORDER BY value DESC
 `).bind(...binds).all<ZoneRow>();

      return results || [];
    } catch {
      return [];
    }
  }
}
