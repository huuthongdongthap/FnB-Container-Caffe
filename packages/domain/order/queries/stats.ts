/**
 * Orders — Stats handler (today's orders, revenue, top products, 7-day revenue)
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';

const log = createLogger({ route: 'orders' });

export async function getStats(request: Request, env: Record<string, unknown>) {
  try {
    const db = (env.AURA_DB ?? (env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartParam = todayStart.toISOString().slice(0, 10) + ' 00:00:00';

    let ordersTodayResult: { total: number; revenue: number }[] = [];
    try {
      const res = await db.prepare(`
        SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as revenue
        FROM orders
        WHERE created_at >= ? AND status != 'cancelled'
      `).bind(todayStartParam).all<{ total: number; revenue: number }>();
      ordersTodayResult = res.results || [];
    } catch {
      const res = await db.prepare(`
        SELECT COUNT(*) as total, COALESCE(SUM(COALESCE(total, total_amount, 0)), 0) as revenue
        FROM orders
        WHERE created_at >= ? AND status != 'cancelled'
      `).bind(todayStartParam).all<{ total: number; revenue: number }>();
      ordersTodayResult = res.results || [];
    }

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
        const orderMultiplier = Number(row.order_count) || 1;
        items.forEach((item: { name: string; quantity?: number; qty?: number }) => {
          const name = item.name || 'Unknown';
          const itemQty = Number(item.quantity ?? item.qty ?? 1) || 1;
          productStats[name] = (productStats[name] || 0) + itemQty * orderMultiplier;
        });
      } catch { /* skip invalid JSON */ }
    });

    const topProductsList = Object.entries(productStats)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const sevenDaysAgoParam = sevenDaysAgo.toISOString().slice(0, 10) + ' 00:00:00';

    let revenueResult: { date: string; revenue: number }[] = [];
    try {
      const res = await db.prepare(`
        SELECT DATE(created_at) as date, COALESCE(SUM(total), 0) as revenue
        FROM orders
        WHERE created_at >= ? AND status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `).bind(sevenDaysAgoParam).all<{ date: string; revenue: number }>();
      revenueResult = res.results || [];
    } catch {
      const res = await db.prepare(`
        SELECT DATE(created_at) as date, COALESCE(SUM(COALESCE(total, total_amount, 0)), 0) as revenue
        FROM orders
        WHERE created_at >= ? AND status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `).bind(sevenDaysAgoParam).all<{ date: string; revenue: number }>();
      revenueResult = res.results || [];
    }

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
          revenue: row.revenue
        }))
      }
    });
  } catch (error) {
    log.error('GetStats error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch stats', 500);
  }
}
