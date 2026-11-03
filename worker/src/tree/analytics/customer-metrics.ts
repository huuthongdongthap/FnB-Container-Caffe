/**
 * Customer Metrics — D1 query for customer analytics aggregate
 *
 * GET /api/analytics/customer-metrics
 * Returns: total_customers, new_30d, repeat_rate, avg_order_value
 */

import { buildTenantFilter } from './summary';

export interface CustomerMetrics {
  total_customers: number;
  new_30d: number;
  repeat_rate: number;
  avg_order_value: number;
}

/**
 * Get aggregate customer metrics from D1.
 * Runs four independent aggregation queries and combines results.
 */
export async function getCustomerMetrics(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId?: string
): Promise<CustomerMetrics> {
  const { clause: tenantWhere, binds: tenantBinds } = buildTenantFilter(tenantId, undefined, 'WHERE');
  const { clause: tenantAnd } = buildTenantFilter(tenantId, undefined, 'AND');
  const runFirst = <T>(sql: string) => {
    const stmt = db.prepare(sql);
    return tenantBinds.length > 0 ? stmt.bind(...tenantBinds).first<T>() : stmt.first<T>();
  };

  const [totalRow, newRow, repeatRow, avgRow] = await Promise.all([
    runFirst<{ total_customers: number }>(`SELECT COUNT(*) AS total_customers FROM customers${tenantWhere}`),
    runFirst<{ new_30d: number }>(
      `SELECT COUNT(*) AS new_30d FROM customers WHERE created_at >= datetime('now', '-30 days')${tenantAnd}`
    ),
    runFirst<{ repeat_rate: number }>(`
      WITH customer_orders AS (
        SELECT customer_phone, COUNT(*) AS cnt
        FROM orders
        WHERE status != 'cancelled' AND customer_phone IS NOT NULL${tenantAnd}
        GROUP BY customer_phone
      )
      SELECT
        CASE WHEN COUNT(*) > 0
          THEN CAST(SUM(CASE WHEN cnt > 1 THEN 1 ELSE 0 END) AS REAL) / CAST(COUNT(*) AS REAL)
          ELSE 0
        END AS repeat_rate
      FROM customer_orders
    `),
    runFirst<{ avg_order_value: number }>(
      `SELECT AVG(total) AS avg_order_value FROM orders WHERE status != 'cancelled'${tenantAnd}`
    )
  ]);

  return {
    total_customers: totalRow?.total_customers ?? 0,
    new_30d: newRow?.new_30d ?? 0,
    repeat_rate: repeatRow?.repeat_rate ?? 0,
    avg_order_value: avgRow?.avg_order_value ?? 0
  };
}
