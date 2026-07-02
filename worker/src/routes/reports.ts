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

// GET /api/reports/top-products — top selling products by quantity in date range
reportsRouter.get('/top-products', async (c) => {
  const db = c.env.AURA_DB;
  const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

  const { results } = await db.prepare(
    `SELECT items FROM orders
     WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'`
  ).bind(from, to).all<{ items: string }>();

  // Aggregate by product name (parse JSON in JS for safety)
  const productMap = new Map<string, { qty: number; revenue: number }>();
  for (const row of results || []) {
    try {
      const items = JSON.parse(row.items || '[]');
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const name = item.name || item.product_name || 'Unknown';
        const qty = item.qty || item.quantity || 1;
        const price = item.price || item.unit_price || 0;
        const existing = productMap.get(name) || { qty: 0, revenue: 0 };
        existing.qty += qty;
        existing.revenue += price * qty;
        productMap.set(name, existing);
      }
    } catch {
      // Skip malformed JSON
    }
  }

  const limit = parseInt(c.req.query('limit') || '10', 10);
  const topProducts = [...productMap.entries()]
    .map(([name, data]) => ({ name, qty: data.qty, revenue: data.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);

  return c.json({ success: true, data: topProducts });
});

// GET /api/reports/peak-hours — hourly order distribution, zero-filled
reportsRouter.get('/peak-hours', async (c) => {
  const db = c.env.AURA_DB;
  const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

  const { results } = await db.prepare(
    `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour,
            COUNT(*) as order_count,
            COALESCE(SUM(total), 0) as revenue
     FROM orders
     WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
     GROUP BY hour ORDER BY hour`
  ).bind(from, to).all<{ hour: number; order_count: number; revenue: number }>();

  // Build zero-filled 24-hour array
  const peakHours: { hour: number; order_count: number; revenue: number }[] = [];
  const resultMap = new Map((results || []).map(r => [r.hour, r]));
  for (let h = 0; h < 24; h++) {
    const existing = resultMap.get(h);
    peakHours.push({
      hour: h,
      order_count: existing?.order_count || 0,
      revenue: existing?.revenue || 0,
    });
  }

  return c.json({ success: true, data: peakHours });
});

// GET /api/reports/customer-metrics — aggregate customer KPIs
reportsRouter.get('/customer-metrics', async (c) => {
  const db = c.env.AURA_DB;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    totalCustomers,
    newCustomers30d,
    repeatCustomers,
    totalRevenue,
    totalOrders,
    orderCustomers,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE created_at >= ?')
      .bind(thirtyDaysAgo).first<{ count: number }>(),
    db.prepare(
      'SELECT COUNT(*) as count FROM (SELECT customer_id FROM orders GROUP BY customer_id HAVING COUNT(*) > 1)'
    ).first<{ count: number }>(),
    db.prepare(
      "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status != 'cancelled'"
    ).first<{ total: number }>(),
    db.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'"
    ).first<{ count: number }>(),
    db.prepare(
      "SELECT COUNT(DISTINCT customer_id) as count FROM orders WHERE status != 'cancelled'"
    ).first<{ count: number }>(),
  ]);

  const totalCust = totalCustomers?.count || 0;
  const newCust = newCustomers30d?.count || 0;
  const repeatCust = repeatCustomers?.count || 0;
  const rev = totalRevenue?.total || 0;
  const ord = totalOrders?.count || 0;
  const custWithOrders = orderCustomers?.count || 0;

  const metrics = {
    total_customers: totalCust,
    new_customers_30d: newCust,
    repeat_customers: repeatCust,
    repeat_rate: totalCust > 0 ? Math.round((repeatCust / totalCust) * 100) / 100 : 0,
    avg_spend_per_customer: custWithOrders > 0 ? Math.round((rev / custWithOrders) * 100) / 100 : 0,
    avg_orders_per_customer: custWithOrders > 0 ? Math.round((ord / custWithOrders) * 100) / 100 : 0,
  };

  return c.json({ success: true, data: metrics });
});

// Helper: create CSV response with UTF-8 BOM bytes for Excel compatibility
function createCsvResponse(csvString: string, filename: string): Response {
  const encoder = new TextEncoder();
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
  const encoded = encoder.encode(csvString);
  const body = new Uint8Array(bom.length + encoded.length);
  body.set(bom);
  body.set(encoded, bom.length);

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// GET /api/reports/export — CSV export for orders, revenue, or customers
reportsRouter.get('/export', async (c) => {
  const db = c.env.AURA_DB;
  const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') || new Date().toISOString().slice(0, 10);
  const type = c.req.query('type') || 'orders';

  if (type === 'orders') {
    const { results } = await db.prepare(
      `SELECT id, customer_name, customer_phone, total, status, payment_method, created_at
       FROM orders WHERE DATE(created_at) BETWEEN ? AND ? ORDER BY created_at`
    ).bind(from, to).all<any>();

    const headers = ['id', 'customer_name', 'customer_phone', 'total', 'status', 'payment_method', 'created_at'];
    const rows = (results || []).map((r: any) => [
      r.id || '',
      r.customer_name || '',
      r.customer_phone || '',
      r.total ?? 0,
      r.status || '',
      r.payment_method || '',
      (r.created_at || '').slice(0, 10),
    ]);

    return createCsvResponse(
      headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n'),
      `orders-report-${from}-${to}.csv`,
    );
  }

  if (type === 'revenue') {
    const { results } = await db.prepare(
      `SELECT DATE(created_at) as date,
              COUNT(*) as orders,
              COALESCE(SUM(total), 0) as revenue,
              CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(total), 0) / COUNT(*) ELSE 0 END as avg_order_value
       FROM orders
       WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
       GROUP BY DATE(created_at) ORDER BY date`
    ).bind(from, to).all<{ date: string; orders: number; revenue: number; avg_order_value: number }>();

    // Get cashback earned per day separately
    const { results: cashbackResults } = await db.prepare(
      `SELECT DATE(created_at) as date, COALESCE(SUM(reward_amount), 0) as amount
       FROM checkins WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'approved'
       GROUP BY DATE(created_at)`
    ).bind(from, to).all<{ date: string; amount: number }>();

    const cashbackMap = new Map((cashbackResults || []).map(c => [c.date, c.amount]));

    const headers = ['date', 'orders', 'revenue', 'avg_order_value', 'cashback_earned'];
    const rows = (results || []).map((r: any) => [
      r.date || '',
      r.orders ?? 0,
      r.revenue ?? 0,
      r.avg_order_value ?? 0,
      cashbackMap.get(r.date) || 0,
    ]);

    return createCsvResponse(
      headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n'),
      `revenue-report-${from}-${to}.csv`,
    );
  }

  if (type === 'customers') {
    const { results } = await db.prepare(
      `SELECT c.id, c.name, c.email, c.phone, c.loyalty_tier, c.created_at,
              COALESCE(SUM(o.total), 0) as total_spent,
              COUNT(o.id) as order_count
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id AND o.status != 'cancelled'
       GROUP BY c.id ORDER BY c.created_at`
    ).all<{ id: string; name: string; email: string; phone: string; loyalty_tier: string; created_at: string; total_spent: number; order_count: number }>();

    const headers = ['id', 'name', 'email', 'phone', 'total_spent', 'order_count', 'loyalty_tier', 'created_at'];
    const rows = (results || []).map((r: any) => [
      r.id || '',
      r.name || '',
      r.email || '',
      r.phone || '',
      r.total_spent ?? 0,
      r.order_count ?? 0,
      r.loyalty_tier || '',
      (r.created_at || '').slice(0, 10),
    ]);

    return createCsvResponse(
      headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n'),
      `customers-report-${from}-${to}.csv`,
    );
  }

  return c.json({ success: false, error: `Invalid export type: ${type}. Use orders, revenue, or customers.` }, 400);
});
