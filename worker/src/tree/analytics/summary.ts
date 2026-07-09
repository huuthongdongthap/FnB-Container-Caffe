/**
 * Analytics Summary — D1 queries for aggregate metrics, period comparison,
 * and grouped aggregation (hour / day / category / payment).
 *
 * Used by GET /api/analytics with ?compare=&group= query params.
 */

// ───── Types ─────

export interface SummaryMetrics {
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  total_customers: number;
}

export interface GroupRow {
  label: string;
  value: number;
  count: number;
}

export type GroupBy = 'hour' | 'day' | 'category' | 'payment';

// ───── Queries ─────

const AGGREGATE_SQL = `
  SELECT
    COUNT(*) AS total_orders,
    COALESCE(SUM(total), 0) AS total_revenue,
    CASE WHEN COUNT(*) > 0 THEN SUM(total) / COUNT(*) ELSE 0 END AS avg_order_value,
    COUNT(DISTINCT customer_phone) AS total_customers
  FROM orders
  WHERE status != 'cancelled'
    AND created_at >= datetime('now', '-' || ? || ' days')
`;

/**
 * Get aggregate summary metrics for the last N days.
 */
export async function getSummary(
  db: import('@cloudflare/workers-types').D1Database,
  days: number
): Promise<SummaryMetrics> {
  const row = await db.prepare(AGGREGATE_SQL).bind(days).first<SummaryMetrics>();
  return {
    total_orders: row?.total_orders ?? 0,
    total_revenue: row?.total_revenue ?? 0,
    avg_order_value: row?.avg_order_value ?? 0,
    total_customers: row?.total_customers ?? 0
  };
}

/**
 * Get summary metrics for two consecutive periods of equal length
 * (current = last N days, previous = N days before that).
 * Returns { current, previous } for overlay / comparison charts.
 */
export async function getSummaryCompare(
  db: import('@cloudflare/workers-types').D1Database,
  days: number
): Promise<{ current: SummaryMetrics; previous: SummaryMetrics }> {
  const [current, previous] = await Promise.all([
    db.prepare(AGGREGATE_SQL).bind(days).first<SummaryMetrics>(),
    db.prepare(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total), 0) AS total_revenue,
        CASE WHEN COUNT(*) > 0 THEN SUM(total) / COUNT(*) ELSE 0 END AS avg_order_value,
        COUNT(DISTINCT customer_phone) AS total_customers
      FROM orders
      WHERE status != 'cancelled'
        AND created_at >= datetime('now', '-' || ? || ' days')
        AND created_at < datetime('now', '-' || ? || ' days')
    `).bind(days * 2, days).first<SummaryMetrics>()
  ]);

  return {
    current: {
      total_orders: current?.total_orders ?? 0,
      total_revenue: current?.total_revenue ?? 0,
      avg_order_value: current?.avg_order_value ?? 0,
      total_customers: current?.total_customers ?? 0
    },
    previous: {
      total_orders: previous?.total_orders ?? 0,
      total_revenue: previous?.total_revenue ?? 0,
      avg_order_value: previous?.avg_order_value ?? 0,
      total_customers: previous?.total_customers ?? 0
    }
  };
}

// ───── Group queries ─────

const GROUP_QUERIES: Record<GroupBy, string> = {
  hour: `
    SELECT
      CAST(strftime('%H', created_at) AS INTEGER) AS label,
      COALESCE(SUM(total), 0) AS value,
      COUNT(*) AS count
    FROM orders
    WHERE status != 'cancelled'
      AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY label
    ORDER BY label
  `,
  day: `
    SELECT
      date(created_at) AS label,
      COALESCE(SUM(total), 0) AS value,
      COUNT(*) AS count
    FROM orders
    WHERE status != 'cancelled'
      AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY label
    ORDER BY label
  `,
  category: `
    SELECT
      c.name AS label,
      COALESCE(SUM(oi.subtotal), 0) AS value,
      SUM(oi.quantity) AS count
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN categories c ON c.id = p.category_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled'
      AND o.created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY c.name
    ORDER BY value DESC
  `,
  payment: `
    SELECT
      payment_method AS label,
      COALESCE(SUM(total), 0) AS value,
      COUNT(*) AS count
    FROM orders
    WHERE status != 'cancelled'
      AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY payment_method
    ORDER BY value DESC
  `
};

/**
 * Get grouped aggregation (hour / day / category / payment) for the last N days.
 * For hour grouping, returns a zero-filled 24-element array.
 */
export async function getGrouped(
  db: import('@cloudflare/workers-types').D1Database,
  groupBy: GroupBy,
  days: number
): Promise<GroupRow[]> {
  const sql = GROUP_QUERIES[groupBy];
  if (!sql) {
    throw new Error(`Unknown group: ${groupBy}`);
  }

  const { results } = await db.prepare(sql).bind(days).all<GroupRow>();
  const rows = results || [];

  // Zero-fill hour groups for consistent charting
  if (groupBy === 'hour') {
    const map = new Map<number, GroupRow>();
    for (const row of rows) {
      map.set(Number(row.label), row);
    }
    const filled: GroupRow[] = [];
    for (let h = 0; h < 24; h++) {
      const existing = map.get(h);
      filled.push({
        label: String(h),
        value: existing?.value ?? 0,
        count: existing?.count ?? 0
      });
    }
    return filled;
  }

  return rows;
}
