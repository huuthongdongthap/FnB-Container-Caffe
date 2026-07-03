/**
 * Customer Metrics — D1 query for customer analytics aggregate
 *
 * GET /api/analytics/customer-metrics
 * Returns: total_customers, new_30d, repeat_rate, avg_order_value
 */

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
): Promise<CustomerMetrics> {
  const [totalRow, newRow, repeatRow, avgRow] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS total_customers FROM customers').first<{ total_customers: number }>(),
    db.prepare(
      "SELECT COUNT(*) AS new_30d FROM customers WHERE created_at >= datetime('now', '-30 days')",
    ).first<{ new_30d: number }>(),
    db.prepare(`
      WITH customer_orders AS (
        SELECT customer_phone, COUNT(*) AS cnt
        FROM orders
        WHERE status != 'cancelled' AND customer_phone IS NOT NULL
        GROUP BY customer_phone
      )
      SELECT
        CASE WHEN COUNT(*) > 0
          THEN CAST(SUM(CASE WHEN cnt > 1 THEN 1 ELSE 0 END) AS REAL) / CAST(COUNT(*) AS REAL)
          ELSE 0
        END AS repeat_rate
      FROM customer_orders
    `).first<{ repeat_rate: number }>(),
    db.prepare(
      "SELECT AVG(total) AS avg_order_value FROM orders WHERE status != 'cancelled'",
    ).first<{ avg_order_value: number }>(),
  ]);

  return {
    total_customers: totalRow?.total_customers ?? 0,
    new_30d: newRow?.new_30d ?? 0,
    repeat_rate: repeatRow?.repeat_rate ?? 0,
    avg_order_value: avgRow?.avg_order_value ?? 0,
  };
}
