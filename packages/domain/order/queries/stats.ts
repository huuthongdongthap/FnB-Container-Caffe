/**
 * Orders — Stats handler (today's orders, revenue, top products, 7-day revenue)
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';

const log = createLogger({ route: 'orders' });

export async function getStats(request: Request, env: Record<string, unknown>, tenantId?: string) {
  try {
    const db = (env.AURA_DB ?? (env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
    const url = new URL(request.url);
    const queryTenant = (url.searchParams.get('tenant_id') || url.searchParams.get('tenantId') || '').trim();
    const rawTenantId = typeof tenantId === 'string' && tenantId.trim() ? tenantId.trim() : 'default';
    const effectiveTenantId =
      rawTenantId === '*' || rawTenantId === 'hq'
        ? (queryTenant && queryTenant !== 'hq' ? queryTenant : '*')
        : rawTenantId;
    const hasTenant = effectiveTenantId !== '*';
    const tenantWhere = !hasTenant
      ? ''
      : effectiveTenantId === 'default'
        ? " WHERE (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
        : ' WHERE (tenant_id = ? OR TRIM(tenant_id) = ?1)';
    const tenantAnd1 = !hasTenant
      ? ''
      : effectiveTenantId === 'default'
        ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
        : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?1)';
    const tenantAnd2 = !hasTenant
      ? ''
      : effectiveTenantId === 'default'
        ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
        : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?2)';
    const tenantBinds = hasTenant ? [effectiveTenantId] : [];
    const ictNowMs = Date.now() + 7 * 3600_000;
    const today = new Date(ictNowMs).toISOString().slice(0, 10);
    const todayStartParam = `${today} 00:00:00`;
    const revenueExclusionClause =
      "status != 'cancelled' AND COALESCE(LOWER(TRIM(status)), '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(LOWER(TRIM(payment_status)), '') NOT IN ('refunded', 'failed')";
    const statusOnlyExclusionClause =
      "status != 'cancelled' AND COALESCE(LOWER(TRIM(status)), '') NOT IN ('cancelled', 'refunded', 'failed', 'expired')";

    let ordersTodayResult: { total: number; revenue: number }[] = [];
    try {
      const res = await db.prepare(`
        SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as revenue
        FROM orders
        WHERE created_at >= ? AND ${revenueExclusionClause}${tenantAnd2}
      `).bind(todayStartParam, ...tenantBinds).all<{ total: number; revenue: number }>();
      ordersTodayResult = res.results || [];
    } catch {
      try {
        const res = await db.prepare(`
          SELECT COUNT(*) as total, COALESCE(SUM(COALESCE(total, total_amount, 0)), 0) as revenue
          FROM orders
          WHERE created_at >= ? AND ${revenueExclusionClause}${tenantAnd2}
        `).bind(todayStartParam, ...tenantBinds).all<{ total: number; revenue: number }>();
        ordersTodayResult = res.results || [];
      } catch {
        const res = await db.prepare(`
          SELECT COUNT(*) as total, COALESCE(SUM(COALESCE(total, total_amount, 0)), 0) as revenue
          FROM orders
          WHERE created_at >= ? AND ${statusOnlyExclusionClause}${tenantAnd2}
        `).bind(todayStartParam, ...tenantBinds).all<{ total: number; revenue: number }>();
        ordersTodayResult = res.results || [];
      }
    }

    const statusStmt = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM orders${tenantWhere}
      GROUP BY status
    `);
    const { results: statusResult } = tenantBinds.length > 0
      ? await statusStmt.bind(...tenantBinds).all<{ status: string; count: number }>()
      : await statusStmt.all<{ status: string; count: number }>();

    let topProducts: { items: string; order_count: number }[] = [];
    try {
      const topProductsStmt = db.prepare(`
        SELECT items, COUNT(*) as order_count
        FROM orders
        WHERE ${revenueExclusionClause}${tenantAnd1}
        GROUP BY items
        ORDER BY order_count DESC
        LIMIT 10
      `);
      const res = tenantBinds.length > 0
        ? await topProductsStmt.bind(...tenantBinds).all<{ items: string; order_count: number }>()
        : await topProductsStmt.all<{ items: string; order_count: number }>();
      topProducts = res.results || [];
    } catch {
      const topProductsStmt = db.prepare(`
        SELECT items, COUNT(*) as order_count
        FROM orders
        WHERE ${statusOnlyExclusionClause}${tenantAnd1}
        GROUP BY items
        ORDER BY order_count DESC
        LIMIT 10
      `);
      const res = tenantBinds.length > 0
        ? await topProductsStmt.bind(...tenantBinds).all<{ items: string; order_count: number }>()
        : await topProductsStmt.all<{ items: string; order_count: number }>();
      topProducts = res.results || [];
    }

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

    const weekAgo = new Date(ictNowMs - 7 * 86_400_000).toISOString().slice(0, 10);
    const sevenDaysAgoParam = `${weekAgo} 00:00:00`;

    let revenueResult: { date: string; revenue: number }[] = [];
    try {
      const res = await db.prepare(`
        SELECT DATE(created_at) as date, COALESCE(SUM(total), 0) as revenue
        FROM orders
        WHERE created_at >= ? AND ${revenueExclusionClause}${tenantAnd2}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `).bind(sevenDaysAgoParam, ...tenantBinds).all<{ date: string; revenue: number }>();
      revenueResult = res.results || [];
    } catch {
      try {
        const res = await db.prepare(`
          SELECT DATE(created_at) as date, COALESCE(SUM(COALESCE(total, total_amount, 0)), 0) as revenue
          FROM orders
          WHERE created_at >= ? AND ${revenueExclusionClause}${tenantAnd2}
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `).bind(sevenDaysAgoParam, ...tenantBinds).all<{ date: string; revenue: number }>();
        revenueResult = res.results || [];
      } catch {
        const res = await db.prepare(`
          SELECT DATE(created_at) as date, COALESCE(SUM(COALESCE(total, total_amount, 0)), 0) as revenue
          FROM orders
          WHERE created_at >= ? AND ${statusOnlyExclusionClause}${tenantAnd2}
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `).bind(sevenDaysAgoParam, ...tenantBinds).all<{ date: string; revenue: number }>();
        revenueResult = res.results || [];
      }
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
