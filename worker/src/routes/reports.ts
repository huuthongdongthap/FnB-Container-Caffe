/**
 * Reports Routes — /api/reports
 * D+1 analytics: signups, cashback, orders, summary.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';

interface DailyReport {
  date: string;
  signups: number;
  orders: number;
  revenue: number;
  cashback_earned: number;
  cashback_redeemed: number;
  avg_order_value: number;
}

interface SummaryReport {
  total_customers: number;
  total_revenue: number;
  total_orders: number;
  total_cashback_issued: number;
  active_customers_30d: number;
  churn_rate_30d: number;
}

export const reportsRouter = new Hono<{ Bindings: Env }>();

// GET /api/reports/daily — daily metrics for date range
reportsRouter.get('/daily', async (c) => {
  const db = c.env.AURA_DB;
  const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

  // Signups by day
  const { results: signups } = await db.prepare(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM customers WHERE DATE(created_at) BETWEEN ? AND ?
     GROUP BY DATE(created_at) ORDER BY date`
  ).bind(from, to).all<{ date: string; count: number }>();

  // Orders by day
  const { results: orders } = await db.prepare(
    `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
     FROM orders WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
     GROUP BY DATE(created_at) ORDER BY date`
  ).bind(from, to).all<{ date: string; count: number; revenue: number }>();

  // Cashback earned by day
  const { results: cashbackEarned } = await db.prepare(
    `SELECT DATE(created_at) as date, COALESCE(SUM(reward_amount), 0) as amount
     FROM checkins WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'approved'
     GROUP BY DATE(created_at) ORDER BY date`
  ).bind(from, to).all<{ date: string; amount: number }>();

  // Cashback redeemed by day
  const { results: cashbackRedeemed } = await db.prepare(
    `SELECT DATE(created_at) as date, COALESCE(SUM(discount_amount), 0) as amount
     FROM promotion_redemptions WHERE DATE(created_at) BETWEEN ? AND ?
     GROUP BY DATE(created_at) ORDER BY date`
  ).bind(from, to).all<{ date: string; amount: number }>();

  // Merge into daily reports
  const signupMap = new Map((signups || []).map(s => [s.date, s.count]));
  const orderMap = new Map((orders || []).map(o => [o.date, { count: o.count, revenue: o.revenue }]));
  const earnedMap = new Map((cashbackEarned || []).map(c => [c.date, c.amount]));
  const redeemedMap = new Map((cashbackRedeemed || []).map(c => [c.date, c.amount]));

  // Generate date range
  const reports: DailyReport[] = [];
  const start = new Date(from);
  const end = new Date(to);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const orderData = orderMap.get(dateStr) || { count: 0, revenue: 0 };

    reports.push({
      date: dateStr,
      signups: signupMap.get(dateStr) || 0,
      orders: orderData.count,
      revenue: orderData.revenue,
      cashback_earned: earnedMap.get(dateStr) || 0,
      cashback_redeemed: redeemedMap.get(dateStr) || 0,
      avg_order_value: orderData.count > 0 ? Math.round(orderData.revenue / orderData.count) : 0,
    });
  }

  return c.json({ success: true, data: reports });
});

// GET /api/reports/summary — overall summary KPIs
reportsRouter.get('/summary', async (c) => {
  const db = c.env.AURA_DB;

  const [
    totalCustomers,
    totalRevenue,
    totalOrders,
    totalCashback,
    active30d,
    totalActive,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>(),
    db.prepare(
      "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status != 'cancelled'"
    ).first<{ total: number }>(),
    db.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'"
    ).first<{ count: number }>(),
    db.prepare(
      "SELECT COALESCE(SUM(reward_amount), 0) as total FROM checkins WHERE status = 'approved'"
    ).first<{ total: number }>(),
    db.prepare(
      'SELECT COUNT(*) as count FROM customers WHERE updated_at >= ?'
    ).bind(new Date(Date.now() - 30 * 86400000).toISOString()).first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>(),
  ]);

  const activeCount = active30d?.count || 0;
  const totalCount = totalActive?.count || 1;

  const summary: SummaryReport = {
    total_customers: totalCustomers?.count || 0,
    total_revenue: totalRevenue?.total || 0,
    total_orders: totalOrders?.count || 0,
    total_cashback_issued: totalCashback?.total || 0,
    active_customers_30d: activeCount,
    churn_rate_30d: Math.round(((totalCount - activeCount) / totalCount) * 1000) / 10,
  };

  return c.json({ success: true, data: summary });
});

// GET /api/reports/orders — order metrics
reportsRouter.get('/orders', async (c) => {
  const db = c.env.AURA_DB;
  const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

  const { results } = await db.prepare(
    `SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
     FROM orders WHERE DATE(created_at) BETWEEN ? AND ?
     GROUP BY status ORDER BY revenue DESC`
  ).bind(from, to).all<{ status: string; count: number; revenue: number }>();

  return c.json({ success: true, data: results || [] });
});
