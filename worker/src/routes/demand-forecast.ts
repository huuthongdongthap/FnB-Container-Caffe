/**
 * Edge Demand & Sales Forecasting Router
 * Day-of-week seasonality, 7-day rolling sales projections, and peak rush windows.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { getTenantId } from '../middleware/tenant';

export const demandForecastRouter = new Hono<{ Bindings: Env }>();

demandForecastRouter.use('/*', requireAuth(['owner', 'manager']));

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

// GET /api/admin/metrics/forecast
demandForecastRouter.get('/forecast', async (c) => {
  const tenantId = c.req.query('tenant_id') || getTenantId(c);
  const forecastDays = Math.max(1, Math.min(14, parseInt(c.req.query('days') || '7', 10)));
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000).toISOString();

  // Query order history over past 28 days
  const { results: orders } = await db.prepare(`
    SELECT total, created_at,
           strftime('%w', created_at) as dow,
           strftime('%H', created_at) as hour
    FROM orders
    WHERE tenant_id = ? AND status != 'cancelled' AND created_at >= ?
    ORDER BY created_at ASC
  `).bind(tenantId, fourWeeksAgo).all<{ total: number; created_at: string; dow: string; hour: string }>();

  const dowRevenue = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  const dowOccurrences = [4, 4, 4, 4, 4, 4, 4];
  let morningOrders = 0;
  let eveningOrders = 0;
  let totalRevenue = 0;
  const totalOrders = orders?.length || 0;

  for (const o of orders || []) {
    const d = parseInt(o.dow, 10);
    const h = parseInt(o.hour, 10);
    const amt = Number(o.total || 0);

    if (!isNaN(d) && d >= 0 && d <= 6) {
      dowRevenue[d] += amt;
      dowCounts[d] += 1;
    }
    if (h >= 7 && h <= 9) morningOrders++;
    if (h >= 17 && h <= 20) eveningOrders++;
    totalRevenue += amt;
  }

  const baseDailyAvgOrders = totalOrders > 0 ? totalOrders / 28 : 20;
  const baseDailyAvgRevenue = totalOrders > 0 ? totalRevenue / 28 : 1200000;

  // Seasonality multiplier (Sa Đéc weekend surge default: 1.35x for Sat/Sun)
  const multipliers = dowCounts.map((count, d) => {
    const avgForDay = count / dowOccurrences[d];
    if (baseDailyAvgOrders === 0 || avgForDay === 0) {
      return d === 0 || d === 6 ? 1.35 : 0.90;
    }
    return Math.max(0.6, Math.min(2.0, avgForDay / baseDailyAvgOrders));
  });

  const dailyProjections = [];
  let projectedTotalRevenue = 0;
  let projectedTotalOrders = 0;

  for (let i = 1; i <= forecastDays; i++) {
    const targetDate = new Date(Date.now() + i * 86400000);
    const dow = targetDate.getDay();
    const mult = multipliers[dow];
    const estOrders = Math.max(5, Math.round(baseDailyAvgOrders * mult));
    const estRevenue = Math.max(250000, Math.round(baseDailyAvgRevenue * mult));

    dailyProjections.push({
      date: targetDate.toISOString().slice(0, 10),
      day_of_week: DAY_NAMES[dow],
      projected_orders: estOrders,
      projected_revenue: estRevenue,
      seasonality_index: Math.round(mult * 100) / 100,
      is_weekend: dow === 0 || dow === 6
    });

    projectedTotalRevenue += estRevenue;
    projectedTotalOrders += estOrders;
  }

  const morningPct = totalOrders > 0 ? Math.round((morningOrders / totalOrders) * 100) : 42;
  const eveningPct = totalOrders > 0 ? Math.round((eveningOrders / totalOrders) * 100) : 38;

  return c.json({
    success: true,
    data: {
      tenant_id: tenantId,
      forecast_horizon_days: forecastDays,
      projected_total_orders: projectedTotalOrders,
      projected_total_revenue: projectedTotalRevenue,
      historical_sample_orders: totalOrders,
      daily_projections: dailyProjections,
      peak_windows: {
        morning_rush: { hours: '07:00 - 09:30', share_percentage: morningPct, suggested_prep: 'Cà phê phin, Bánh mì' },
        evening_social: { hours: '17:00 - 20:30', share_percentage: eveningPct, suggested_prep: 'Trà sen Sa Đéc, Đá xay' }
      },
      staffing_advice: 'Dự báo cao điểm cuối tuần (T7, CN) tăng 35-45% lượng khách du lịch tại Sa Đéc. Bố trí 2-3 barista.'
    }
  });
});

// GET /api/admin/metrics/forecast/hourly
demandForecastRouter.get('/forecast/hourly', async (c) => {
  const tenantId = c.req.query('tenant_id') || getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { results: hourRows } = await db.prepare(`
    SELECT strftime('%H', created_at) as hour, COUNT(*) as orders_count
    FROM orders
    WHERE tenant_id = ? AND status != 'cancelled' AND created_at >= ?
    GROUP BY hour
    ORDER BY hour ASC
  `).bind(tenantId, thirtyDaysAgo).all<{ hour: string; orders_count: number }>();

  const hourlyMap: Record<string, number> = {};
  for (let h = 0; h < 24; h++) {
    const key = String(h).padStart(2, '0');
    hourlyMap[key] = 0;
  }
  for (const row of hourRows || []) {
    if (row.hour) hourlyMap[row.hour] = Number(row.orders_count || 0);
  }

  return c.json({ success: true, data: { tenant_id: tenantId, hourly_distribution: hourlyMap } });
});
