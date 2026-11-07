/**
 * Analytics — Zone aggregation
 *
 * Groups orders by physical zone (Indoor/Outdoor/VIP/etc.)
 * by joining orders → cafe_tables via table_id.
 * Falls back to 'Mang đi' for orders with no table_id.
 */

import { buildTenantFilter } from './summary';

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
  const normTenant = (tenantId || '').trim() || 'default';
  const { clause: tenantClause, binds: tenantBinds } = buildTenantFilter(tenantId, 'o');
  const binds: Array<number | string> = [days, ...tenantBinds];
  try {
    const tableTenantJoin =
      " AND COALESCE(NULLIF(TRIM(ct.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')";
    let results: ZoneRow[] | undefined;
    try {
      const res = await db.prepare(`  SELECT
    COALESCE(ct.zone, 'Mang đi') AS label,
    COALESCE(SUM(o.total), 0) AS value,
    COUNT(*) AS count
  FROM orders o
  LEFT JOIN cafe_tables ct ON ct.id = o.table_id${tableTenantJoin}
  WHERE o.status != 'cancelled'
    AND o.status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
    AND COALESCE(o.payment_status, '') != 'refunded'
    AND o.created_at >= datetime('now', '-' || ? || ' days')${tenantClause}
  GROUP BY label
  ORDER BY value DESC
 `).bind(...binds).all<ZoneRow>();
      results = res.results;
    } catch {
      try {
        const res = await db.prepare(`  SELECT
    COALESCE(ct.zone, 'Mang đi') AS label,
    COALESCE(SUM(o.total), 0) AS value,
    COUNT(*) AS count
  FROM orders o
  LEFT JOIN cafe_tables ct ON ct.id = o.table_id${tableTenantJoin}
  WHERE o.status != 'cancelled'
    AND o.status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
    AND o.created_at >= datetime('now', '-' || ? || ' days')${tenantClause}
  GROUP BY label
  ORDER BY value DESC
 `).bind(...binds).all<ZoneRow>();
        results = res.results;
      } catch {
        if (normTenant !== 'default') {
          return [];
        }
        const res = await db.prepare(`  SELECT
    COALESCE(ct.zone, 'Mang đi') AS label,
    COALESCE(SUM(o.total), 0) AS value,
    COUNT(*) AS count
  FROM orders o
  LEFT JOIN cafe_tables ct ON ct.id = o.table_id
  WHERE o.status != 'cancelled'
    AND o.status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
    AND o.created_at >= datetime('now', '-' || ? || ' days')${tenantClause}
  GROUP BY label
  ORDER BY value DESC
 `).bind(...binds).all<ZoneRow>();
        results = res.results;
      }
    }

    return results || [];
  } catch {
    if (normTenant !== 'default') {
      return [];
    }
    try {
      const { results } = await db.prepare(`  SELECT
    COALESCE(t.zone, 'Mang đi') AS label,
    COALESCE(SUM(COALESCE(o.total, o.total_amount, 0)), 0) AS value,
    COUNT(*) AS count
  FROM orders o
  LEFT JOIN tables t ON t.id = o.table_id AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
  WHERE o.status != 'cancelled'
    AND o.status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
    AND o.created_at >= datetime('now', '-' || ? || ' days')${tenantClause}
  GROUP BY label
  ORDER BY value DESC
 `).bind(...binds).all<ZoneRow>();

      return results || [];
    } catch {
      if (normTenant !== 'default') {
        return [];
      }
      try {
        const { results } = await db.prepare(`  SELECT
    COALESCE(t.zone, 'Mang đi') AS label,
    COALESCE(SUM(COALESCE(o.total, o.total_amount, 0)), 0) AS value,
    COUNT(*) AS count
  FROM orders o
  LEFT JOIN tables t ON t.id = o.table_id
  WHERE o.status != 'cancelled'
    AND o.status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
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
}
