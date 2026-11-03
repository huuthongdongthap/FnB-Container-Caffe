import type { Context, Hono } from 'hono';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import { buildTenantClause } from './analytics-handlers';
import type { GroupedSalesGroup, RevenueOverviewData } from './types';

function buildTenantFilter(tenantId: string, alias?: string): { clause: string; binds: string[] } {
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant === '*') {
    return { clause: '', binds: [] };
  }
  const col = alias ? `${alias}.tenant_id` : 'tenant_id';
  if (normTenant === 'default') {
    return { clause: ` AND (${col} = ? OR ${col} IS NULL OR TRIM(${col}) = '')`, binds: [normTenant] };
  }
  const { and, binds } = buildTenantClause(normTenant, alias);
  return { clause: and, binds };
}

const NON_REVENUE_STATUS_SQL =
  "LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'failed', 'rejected', 'expired')";
const NON_REVENUE_ORDER_ALIAS_STATUS_SQL =
  "LOWER(COALESCE(o.status, '')) NOT IN ('cancelled', 'failed', 'rejected', 'expired')";

export async function handleOverview(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const { clause: tenantClause, binds: tenantBinds } = buildTenantFilter(tenantId);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const from = c.req.query('from') || todayStr;
  const to = c.req.query('to') || todayStr;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
  }

  const startDate = new Date(from);
  const endDate = new Date(to);
  const diffDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);

  const prevStart = new Date(startDate.getTime() - diffDays * 86400000).toISOString().slice(0, 10);
  const prevEnd = new Date(startDate.getTime() - 86400000).toISOString().slice(0, 10);

  const [current, previous] = await Promise.all([
    db.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders_count
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
    `).bind(from, to, ...tenantBinds).first<{ revenue: number; orders_count: number }>(),
    db.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders_count
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
    `).bind(prevStart, prevEnd, ...tenantBinds).first<{ revenue: number; orders_count: number }>(),
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
    const tenantId = getTenantId(c).trim() || 'default';
    const { clause: tenantClause, binds: tenantBinds } = buildTenantFilter(tenantId);
    const from = c.req.query('from') || new Date().toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
    }

    const { results } = await db.prepare(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour,
             COALESCE(SUM(total), 0) as value,
             COUNT(*) as count
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
      GROUP BY hour ORDER BY hour
    `).bind(from, to, ...tenantBinds).all<{ hour: number; value: number; count: number }>();

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
    const tenantId = getTenantId(c).trim() || 'default';
    const { clause: tenantClause, binds: tenantBinds } = buildTenantFilter(tenantId);
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
    }

    const { results } = await db.prepare(`
      SELECT DATE(created_at) as label,
             COALESCE(SUM(total), 0) as value,
             COUNT(*) as count
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
      GROUP BY label ORDER BY label
    `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();

    return c.json({ success: true, data: { groups: results || [] } });
  });

  app.get('/sales-by-category', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const { clause: tenantOrderClause } = buildTenantFilter(tenantId, 'o');
    const { clause: tenantClause, binds: tenantBinds } = buildTenantFilter(tenantId);
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
    }

    let results: GroupedSalesGroup[] = [];
    try {
      const res = await db.prepare(`
        SELECT c.name as label,
               COALESCE(SUM(oi.subtotal), 0) as value,
               SUM(oi.quantity) as count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
        JOIN categories c ON c.id = p.category_id AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
        WHERE ${NON_REVENUE_ORDER_ALIAS_STATUS_SQL} AND DATE(o.created_at) BETWEEN ? AND ?${tenantOrderClause}
        GROUP BY c.name ORDER BY value DESC
      `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();
      results = res.results || [];
    } catch {
      try {
        const res = await db.prepare(`
          SELECT c.name as label,
                 COALESCE(SUM(oi.subtotal), 0) as value,
                 SUM(oi.quantity) as count
          FROM order_items oi
          JOIN products p ON p.id = oi.product_id
          JOIN categories c ON c.id = p.category_id
          JOIN orders o ON o.id = oi.order_id
          WHERE ${NON_REVENUE_ORDER_ALIAS_STATUS_SQL} AND DATE(o.created_at) BETWEEN ? AND ?${tenantOrderClause}
          GROUP BY c.name ORDER BY value DESC
        `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();
        results = res.results || [];
      } catch {
        results = [];
      }
    }

    if (results && results.length > 0) {
      return c.json({ success: true, data: { groups: results } });
    }

    const { results: rawOrders } = await db.prepare(`
      SELECT items FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
    `).bind(from, to, ...tenantBinds).all<{ items: string }>();

    const catMap = new Map<string, { value: number; count: number }>();
    for (const row of rawOrders || []) {
      try {
        const items = JSON.parse(row.items || '[]');
        if (Array.isArray(items)) {
          for (const it of items) {
            const cat = String(it.category || 'Món khác');
            const rawQty = it.quantity ?? it.qty;
            const qtyNum = rawQty !== undefined && rawQty !== null ? Number(rawQty) : 1;
            const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
            if (qty <= 0) continue;
            const rawPrice = Number(it.price ?? it.unit_price ?? 0);
            const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
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
    const tenantId = getTenantId(c).trim() || 'default';
    const { clause: tenantClause, binds: tenantBinds } = buildTenantFilter(tenantId);
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
    }

    const { results } = await db.prepare(`
      SELECT COALESCE(payment_method, 'other') as label,
             COALESCE(SUM(total), 0) as value,
             COUNT(*) as count
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
      GROUP BY payment_method ORDER BY value DESC
    `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();

    return c.json({ success: true, data: { groups: results || [] } });
  });
}
