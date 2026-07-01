/**
 * Orders — Stats handler (today's orders, revenue, top products, 7-day revenue)
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'orders' });

export async function getStats(request: Request, env: Record<string, unknown>) {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { results: ordersTodayResult } = await db.prepare(`
      SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= ?
    `).bind(todayStart.toISOString()).all<{ total: number; revenue: number }>();

    const { results: statusResult } = await db.prepare(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `).all<{ status: string; count: number }>();

    const { results: topProducts } = await db.prepare(`
      SELECT items, COUNT(*) as order_count
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY items
      ORDER BY order_count DESC
      LIMIT 10
    `).all<{ items: string; order_count: number }>();

    const productStats: Record<string, number> = {};
    topProducts.forEach(row => {
      try {
        const items = JSON.parse(row.items) as Array<{ name: string; quantity?: number }>;
        items.forEach((item: { name: string; quantity?: number }) => {
          const name = item.name || 'Unknown';
          productStats[name] = (productStats[name] || 0) + (item.quantity || 1);
        });
      } catch { /* skip invalid JSON */ }
    });

    const topProductsList = Object.entries(productStats)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { results: revenueResult } = await db.prepare(`
      SELECT DATE(created_at) as date, COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= ? AND status != 'cancelled'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).bind(sevenDaysAgo.toISOString()).all<{ date: string; revenue: number }>();

    return jsonResponse({
      success: true,
      stats: {
        orders_today: ordersTodayResult[0]?.total || 0,
        revenue_today: ordersTodayResult[0]?.revenue || 0,
        orders_by_status: statusResult.reduce((acc: Record<string, number>, row) => {
          acc[row.status] = row.count;
          return acc;
        }, {}),
        top_products: topProductsList,
        revenue_7days: revenueResult.map(row => ({
          date: row.date,
          revenue: row.revenue,
        })),
      },
    });
  } catch (error) {
    log.error('GetStats error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch stats: ' + (error as Error).message, 500);
  }
}
