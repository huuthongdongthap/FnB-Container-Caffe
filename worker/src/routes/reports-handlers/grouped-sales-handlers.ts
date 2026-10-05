import type { Context, Hono } from 'hono';
import type { Env } from '../../types/env';
import type { GroupedSalesGroup, RevenueOverviewData } from './types';

export async function handleOverview(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const from = c.req.query('from') || todayStr;
  const to = c.req.query('to') || todayStr;

  const startDate = new Date(from);
  const endDate = new Date(to);
  const diffDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);

  const prevStart = new Date(startDate.getTime() - diffDays * 86400000).toISOString().slice(0, 10);
  const prevEnd = new Date(startDate.getTime() - 86400000).toISOString().slice(0, 10);

  const [current, previous] = await Promise.all([
    db.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders_count
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
    `).bind(from, to).first<{ revenue: number; orders_count: number }>(),
    db.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders_count
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
    `).bind(prevStart, prevEnd).first<{ revenue: number; orders_count: number }>(),
  ]);

  const todayRevenue = current?.revenue || 0;
  const yesterdayRevenue = previous?.revenue || 0;
  const todayOrders = current?.orders_count || 0;
  const yesterdayOrders = previous?.orders_count || 0;
  const avgOrderValue = todayOrders > 0 ? Math.round(todayRevenue / todayOrders) : 0;
  const changePercent = yesterdayRevenue > 0
    ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 1000) / 10
    : (todayRevenue > 0 ? 100 : 0);

  const data: RevenueOverviewData = {
    todayRevenue,
    yesterdayRevenue,
    changePercent,
    todayOrders,
    yesterdayOrders,
    avgOrderValue,
  };

  return c.json({ success: true, data });
}

export function registerGroupedSalesHandlers(app: Hono<{ Bindings: Env }>) {
  app.get('/overview', handleOverview);

  app.get('/sales-by-hour', async (c) => {
    const db = c.env.AURA_DB;
    const from = c.req.query('from') || new Date().toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

    const { results } = await db.prepare(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour,
             COALESCE(SUM(total), 0) as value,
             COUNT(*) as count
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
      GROUP BY hour ORDER BY hour
    `).bind(from, to).all<{ hour: number; value: number; count: number }>();

    const resultMap = new Map((results || []).map((r) => [r.hour, r]));
    const groups: GroupedSalesGroup[] = [];
    for (let h = 0; h < 24; h++) {
      const match = resultMap.get(h);
      groups.push({
        label: `${String(h).padStart(2, '0')}:00`,
        value: match?.value ?? 0,
        count: match?.count ?? 0,
      });
    }

    return c.json({ success: true, data: { groups } });
  });

  app.get('/sales-by-day', async (c) => {
    const db = c.env.AURA_DB;
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

    const { results } = await db.prepare(`
      SELECT DATE(created_at) as label,
             COALESCE(SUM(total), 0) as value,
             COUNT(*) as count
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
      GROUP BY label ORDER BY label
    `).bind(from, to).all<GroupedSalesGroup>();

    return c.json({ success: true, data: { groups: results || [] } });
  });

  app.get('/sales-by-category', async (c) => {
    const db = c.env.AURA_DB;
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

    const { results } = await db.prepare(`
      SELECT c.name as label,
             COALESCE(SUM(oi.subtotal), 0) as value,
             SUM(oi.quantity) as count
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN categories c ON c.id = p.category_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status != 'cancelled' AND DATE(o.created_at) BETWEEN ? AND ?
      GROUP BY c.name ORDER BY value DESC
    `).bind(from, to).all<GroupedSalesGroup>();

    if (results && results.length > 0) {
      return c.json({ success: true, data: { groups: results } });
    }

    const { results: rawOrders } = await db.prepare(`
      SELECT items FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
    `).bind(from, to).all<{ items: string }>();

    const catMap = new Map<string, { value: number; count: number }>();
    for (const row of rawOrders || []) {
      try {
        const items = JSON.parse(row.items || '[]');
        if (Array.isArray(items)) {
          for (const it of items) {
            const cat = it.category || 'Món khác';
            const qty = it.quantity || it.qty || 1;
            const price = it.price || it.unit_price || 0;
            const cur = catMap.get(cat) || { value: 0, count: 0 };
            cur.value += price * qty;
            cur.count += qty;
            catMap.set(cat, cur);
          }
        }
      } catch {
        // Skip malformed
      }
    }

    const groups: GroupedSalesGroup[] = [...catMap.entries()]
      .map(([label, d]) => ({ label, value: d.value, count: d.count }))
      .sort((a, b) => b.value - a.value);

    return c.json({ success: true, data: { groups } });
  });

  app.get('/sales-by-payment', async (c) => {
    const db = c.env.AURA_DB;
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

    const { results } = await db.prepare(`
      SELECT COALESCE(payment_method, 'other') as label,
             COALESCE(SUM(total), 0) as value,
             COUNT(*) as count
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
      GROUP BY payment_method ORDER BY value DESC
    `).bind(from, to).all<GroupedSalesGroup>();

    return c.json({ success: true, data: { groups: results || [] } });
  });
}
