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
  try {
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
  } catch {
    try {
      const { results: orderRows } = await db.prepare(`
        SELECT items FROM orders WHERE status != 'cancelled'
      `).all<{ items: string }>();
      const productMap = new Map<string, { total_qty: number; revenue: number }>();
      for (const r of orderRows || []) {
        try {
          const parsed = JSON.parse(r.items || '[]');
          if (!Array.isArray(parsed)) continue;
          for (const item of parsed) {
            const name = String(item.name || item.product_name || 'Unknown');
            const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
            const price = Number(item.price ?? item.unit_price ?? 0) || 0;
            const subtotal = Number(item.subtotal ?? price * qty) || 0;
            const cur = productMap.get(name) || { total_qty: 0, revenue: 0 };
            cur.total_qty += qty;
            cur.revenue += subtotal;
            productMap.set(name, cur);
          }
        } catch {
          // Skip invalid JSON
        }
      }
      return Array.from(productMap.entries())
        .map(([product_name, v]) => ({
          product_name,
          total_qty: v.total_qty,
          revenue: v.revenue,
        }))
        .sort((a, b) => b.total_qty - a.total_qty)
        .slice(0, limit);
    } catch {
      return [];
    }
  }
}
