/**
 * Top Products — D1 query for top N products by order count + revenue
 *
 * GET /api/analytics/top-products?limit=10
 */

export interface TopProductRow {
  product_name: string;
  total_qty: number;
  revenue: number;
}

/**
 * Get top N products by total quantity sold (excluding cancelled orders).
 * Joins order_items with products to get names and aggregates quantity + revenue.
 */
export async function getTopProducts(
  db: import('@cloudflare/workers-types').D1Database,
  limit: number
): Promise<TopProductRow[]> {
  const { results } = await db.prepare(`
    SELECT
      p.name AS product_name,
      SUM(oi.quantity) AS total_qty,
      SUM(oi.subtotal) AS revenue
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled'
    GROUP BY oi.product_id, p.name
    ORDER BY total_qty DESC
    LIMIT ?
  `).bind(limit).all<TopProductRow>();

  return results || [];
}
