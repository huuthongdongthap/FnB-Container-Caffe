import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { authenticateRequest } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import type { DailyReport, SummaryReport } from './types';

const REPORT_ANALYTICS_ROLES = ['owner', 'manager', 'supervisor', 'admin'];
const VALID_REVENUE_ORDER_SQL =
  "COALESCE(status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(payment_status, '') NOT IN ('refunded', 'failed') AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired') AND LOWER(COALESCE(payment_status, '')) NOT IN ('refunded', 'failed')";

export function isStrictHQReportAdmin(role: string, userTenant: string): boolean {
  const normTenant = (userTenant || '').trim().toLowerCase();
  return (role === 'owner' || role === 'admin') && (normTenant === '*' || normTenant === 'hq');
}

export async function verifyReportAnalyticsAccess(
  c: any,
  options?: { allowUnauthenticatedDefaultInTest?: boolean }
): Promise<Response | null> {
  let user = (typeof c.get === 'function' ? c.get('user') : undefined) as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  const hasAuthHeader = Boolean(c.req?.header?.('Authorization') || c.req?.header?.('authorization'));
  if (!user && c.req?.raw && c.env?.JWT_SECRET && hasAuthHeader) {
    const session = await authenticateRequest(c.req.raw, c.env, { optional: true }).catch(() => null);
    if (session && 'payload' in session) {
      user = {
        id: session.payload.id,
        role: session.payload.role,
        tenantId: session.payload.tenantId,
      };
      c.set?.('user', user);
    }
  }
  const reqCandidates = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  const hasConflictingReqTenant = new Set(reqCandidates).size > 1;
  const reqTenant = hasConflictingReqTenant ? '__CONFLICT__' : (reqCandidates[0] || '');
  const ctxTenant = (typeof c.get === 'function' ? (c.get('tenantId') as string | undefined) : undefined)?.trim() || '';
  const role = user?.role ? String(user.role).toLowerCase() : '';
  if (!user || !role) {
    if (
      options?.allowUnauthenticatedDefaultInTest &&
      !hasAuthHeader &&
      c.env?.ENVIRONMENT !== 'production' &&
      !reqTenant &&
      (!ctxTenant || ctxTenant === 'default')
    ) {
      return null;
    }
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }
  if (!REPORT_ANALYTICS_ROLES.includes(role)) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }
  if (hasConflictingReqTenant) {
    return c.json({ success: false, error: 'Cross-tenant report access denied' }, 403);
  }
  const userTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
  const hqAdmin = isStrictHQReportAdmin(role, userTenant);
  const boundTenant = userTenant || 'default';
  const resolvedTenant = getTenantId(c).trim() || 'default';

  if (!hqAdmin) {
    if (
      boundTenant === '*' ||
      boundTenant.toLowerCase() === 'hq' ||
      reqTenant === '*' ||
      reqTenant.toLowerCase() === 'hq' ||
      (reqTenant && reqTenant !== boundTenant) ||
      (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== boundTenant)) ||
      resolvedTenant !== boundTenant
    ) {
      return c.json({ success: false, error: 'Cross-tenant report access denied' }, 403);
    }
  } else {
    const hqTarget = reqTenant
      ? (reqTenant.toLowerCase() === 'hq' ? '*' : reqTenant)
      : (resolvedTenant.toLowerCase() === 'hq' ? '*' : resolvedTenant);
    c.set?.('tenantId', hqTarget);
  }
  return null;
}

export function validateDateRangeWindow(from: string, to: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return 'Invalid date format. Expected YYYY-MM-DD';
  }
  const startMs = Date.parse(`${from}T00:00:00.000Z`);
  const endMs = Date.parse(`${to}T00:00:00.000Z`);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    new Date(startMs).toISOString().slice(0, 10) !== from ||
    new Date(endMs).toISOString().slice(0, 10) !== to ||
    startMs > endMs
  ) {
    return 'Invalid date range';
  }
  const daySpan = Math.floor((endMs - startMs) / 86400000) + 1;
  if (daySpan > 366) {
    return 'Date range cannot exceed 366 days';
  }
  return null;
}

export function buildTenantClause(tenantId: string, alias?: string): { where: string; and: string; binds: string[] } {
  if (!tenantId || tenantId === '*') {
    return { where: '', and: '', binds: [] };
  }
  const col = alias ? `${alias}.tenant_id` : 'tenant_id';
  if (tenantId === 'default') {
    return {
      where: ` WHERE (${col} = ? OR ${col} IS NULL OR ${col} = '' OR TRIM(${col}) = '')`,
      and: ` AND (${col} = ? OR ${col} IS NULL OR ${col} = '' OR TRIM(${col}) = '')`,
      binds: [tenantId],
    };
  }
  return {
    where: ` WHERE ${col} = ?`,
    and: ` AND ${col} = ?`,
    binds: [tenantId],
  };
}

export function buildCustomerJoinTenantClause(tenantId: string): { join: string; and: string; binds: string[] } {
  if (!tenantId || tenantId === '*') {
    return { join: '', and: '', binds: [] };
  }
  if (tenantId === 'default') {
    return {
      join: ' LEFT JOIN customers c ON c.id = t.customer_id',
      and: " AND (c.tenant_id = ? OR c.tenant_id IS NULL OR c.tenant_id = '' OR TRIM(c.tenant_id) = '')",
      binds: [tenantId],
    };
  }
  return {
    join: ' JOIN customers c ON c.id = t.customer_id',
    and: ' AND c.tenant_id = ?',
    binds: [tenantId],
  };
}

export function registerAnalyticsHandlers(app: Hono<{ Bindings: Env }>) {
  // GET /api/reports/daily — daily metrics for date range
  app.get('/daily', async (c) => {
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format (YYYY-MM-DD required)' }, 400);
    }
    const rangeErr = validateDateRangeWindow(from, to);
    if (rangeErr) {
      return c.json({ success: false, error: rangeErr }, 400);
    }

    const authErr = await verifyReportAnalyticsAccess(c);
    if (authErr) return authErr;

    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c);
    const tf = buildTenantClause(tenantId);
    const cjf = buildCustomerJoinTenantClause(tenantId);

    // Signups by day
    const { results: signups } = await db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM customers WHERE DATE(created_at) BETWEEN ? AND ?${tf.and}
       GROUP BY DATE(created_at) ORDER BY date`
    ).bind(from, to, ...tf.binds).all<{ date: string; count: number }>();

    // Orders by day
    const { results: orders } = await db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
       FROM orders WHERE DATE(created_at) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
       GROUP BY DATE(created_at) ORDER BY date`
    ).bind(from, to, ...tf.binds).all<{ date: string; count: number; revenue: number }>();

    // Cashback earned by day
    let cashbackEarned: { date: string; amount: number }[] = [];
    try {
      const res = await db.prepare(
        `SELECT DATE(t.created_at) as date, COALESCE(SUM(t.reward_amount), 0) as amount
         FROM checkins t${cjf.join}
         WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.status = 'approved'${cjf.and}
         GROUP BY DATE(t.created_at) ORDER BY date`
      ).bind(from, to, ...cjf.binds).all<{ date: string; amount: number }>();
      cashbackEarned = res.results || [];
    } catch {
      try {
        const res = await db.prepare(
          `SELECT DATE(t.created_at) as date, COALESCE(SUM(t.amount), 0) as amount
           FROM cashback_transactions t${cjf.join}
           WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.type = 'earn'${cjf.and}
           GROUP BY DATE(t.created_at) ORDER BY date`
        ).bind(from, to, ...cjf.binds).all<{ date: string; amount: number }>();
        cashbackEarned = res.results || [];
      } catch {
        cashbackEarned = [];
      }
    }

    // Cashback redeemed by day
    let cashbackRedeemed: { date: string; amount: number }[] = [];
    const promoJoin = !tenantId || tenantId === '*'
      ? ''
      : ' LEFT JOIN orders o ON o.id = t.order_id LEFT JOIN customers c ON c.id = t.customer_id';
    const promoAndWithTenantCol = !tenantId || tenantId === '*'
      ? ''
      : " AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), NULLIF(TRIM(o.tenant_id), ''), NULLIF(TRIM(c.tenant_id), ''), 'default') = ?";
    const promoAndJoinOnly = !tenantId || tenantId === '*'
      ? ''
      : " AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), NULLIF(TRIM(c.tenant_id), ''), 'default') = ?";
    const promoBinds = !tenantId || tenantId === '*' ? [] : [tenantId];
    try {
      const res = await db.prepare(
        `SELECT DATE(COALESCE(t.redeemed_at, t.created_at)) as date, COALESCE(SUM(t.discount_amount), 0) as amount
         FROM promotion_redemptions t${promoJoin}
         WHERE DATE(COALESCE(t.redeemed_at, t.created_at)) BETWEEN ? AND ?${promoAndWithTenantCol}
         GROUP BY DATE(COALESCE(t.redeemed_at, t.created_at)) ORDER BY date`
      ).bind(from, to, ...promoBinds).all<{ date: string; amount: number }>();
      cashbackRedeemed = res.results || [];
    } catch {
      try {
        const res = await db.prepare(
          `SELECT DATE(t.redeemed_at) as date, COALESCE(SUM(t.discount_amount), 0) as amount
           FROM promotion_redemptions t${promoJoin}
           WHERE DATE(t.redeemed_at) BETWEEN ? AND ?${promoAndWithTenantCol}
           GROUP BY DATE(t.redeemed_at) ORDER BY date`
        ).bind(from, to, ...promoBinds).all<{ date: string; amount: number }>();
        cashbackRedeemed = res.results || [];
      } catch {
        try {
          const res = await db.prepare(
            `SELECT DATE(t.redeemed_at) as date, COALESCE(SUM(t.discount_amount), 0) as amount
             FROM promotion_redemptions t${promoJoin}
             WHERE DATE(t.redeemed_at) BETWEEN ? AND ?${promoAndJoinOnly}
             GROUP BY DATE(t.redeemed_at) ORDER BY date`
          ).bind(from, to, ...promoBinds).all<{ date: string; amount: number }>();
          cashbackRedeemed = res.results || [];
        } catch {
          try {
            const res = await db.prepare(
              `SELECT DATE(t.created_at) as date, COALESCE(SUM(t.discount_amount), 0) as amount
               FROM promotion_redemptions t${promoJoin}
               WHERE DATE(t.created_at) BETWEEN ? AND ?${promoAndJoinOnly}
               GROUP BY DATE(t.created_at) ORDER BY date`
            ).bind(from, to, ...promoBinds).all<{ date: string; amount: number }>();
            cashbackRedeemed = res.results || [];
          } catch {
            try {
              const res = await db.prepare(
                `SELECT DATE(t.created_at) as date, COALESCE(SUM(ABS(t.amount)), 0) as amount
                 FROM cashback_transactions t${cjf.join}
                 WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.type = 'spend'${cjf.and}
                 GROUP BY DATE(t.created_at) ORDER BY date`
              ).bind(from, to, ...cjf.binds).all<{ date: string; amount: number }>();
              cashbackRedeemed = res.results || [];
            } catch {
              cashbackRedeemed = [];
            }
          }
        }
      }
    }

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
        avg_order_value: orderData.count > 0 ? Math.round(orderData.revenue / orderData.count) : 0
      });
    }

    return c.json({ success: true, data: reports });
  });

  // GET /api/reports/summary — overall summary KPIs
  app.get('/summary', async (c) => {
    const authErr = await verifyReportAnalyticsAccess(c);
    if (authErr) return authErr;

    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c);
    const tf = buildTenantClause(tenantId);
    const cjf = buildCustomerJoinTenantClause(tenantId);
    const runFirst = <T>(sql: string, extraBinds: unknown[] = []) => {
      const stmt = db.prepare(sql);
      const allBinds = [...extraBinds, ...tf.binds];
      return allBinds.length > 0 ? stmt.bind(...allBinds).first<T>() : stmt.first<T>();
    };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [
      totalCustomers,
      totalRevenue,
      totalOrders,
      totalCashback,
      active30d,
      totalActive
    ] = await Promise.all([
      runFirst<{ count: number }>(`SELECT COUNT(*) as count FROM customers${tf.where}`),
      runFirst<{ total: number }>(
        `SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE ${VALID_REVENUE_ORDER_SQL}${tf.and}`
      ),
      runFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM orders WHERE ${VALID_REVENUE_ORDER_SQL}${tf.and}`
      ),
      (async () => {
        try {
          const stmt = db.prepare(
            `SELECT COALESCE(SUM(t.reward_amount), 0) as total FROM checkins t${cjf.join} WHERE t.status = 'approved'${cjf.and}`
          );
          return cjf.binds.length > 0 ? await stmt.bind(...cjf.binds).first<{ total: number }>() : await stmt.first<{ total: number }>();
        } catch {
          try {
            const stmt = db.prepare(
              `SELECT COALESCE(SUM(t.amount), 0) as total FROM cashback_transactions t${cjf.join} WHERE t.type = 'earn'${cjf.and}`
            );
            return cjf.binds.length > 0 ? await stmt.bind(...cjf.binds).first<{ total: number }>() : await stmt.first<{ total: number }>();
          } catch {
            return { total: 0 };
          }
        }
      })(),
      runFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM customers WHERE updated_at >= ?${tf.and}`,
        [thirtyDaysAgo]
      ).catch(() =>
        runFirst<{ count: number }>(
          `SELECT COUNT(*) as count FROM customers WHERE created_at >= ?${tf.and}`,
          [thirtyDaysAgo]
        ).catch(() => ({ count: 0 }))
      ),
      runFirst<{ count: number }>(`SELECT COUNT(*) as count FROM customers${tf.where}`)
    ]);

    const activeCount = active30d?.count || 0;
    const totalCount = totalActive?.count || 1;

    const summary: SummaryReport = {
      total_customers: totalCustomers?.count || 0,
      total_revenue: totalRevenue?.total || 0,
      total_orders: totalOrders?.count || 0,
      total_cashback_issued: totalCashback?.total || 0,
      active_customers_30d: activeCount,
      churn_rate_30d: Math.round(((totalCount - activeCount) / totalCount) * 1000) / 10
    };

    return c.json({ success: true, data: summary });
  });

  // GET /api/reports/orders — order metrics
  app.get('/orders', async (c) => {
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
    }
    const rangeErr = validateDateRangeWindow(from, to);
    if (rangeErr) {
      return c.json({ success: false, error: rangeErr }, 400);
    }

    const authErr = await verifyReportAnalyticsAccess(c);
    if (authErr) return authErr;

    const db = c.env.AURA_DB;
    const tf = buildTenantClause(getTenantId(c));

    const { results } = await db.prepare(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
       FROM orders WHERE DATE(created_at) BETWEEN ? AND ?${tf.and}
       GROUP BY status ORDER BY revenue DESC`
    ).bind(from, to, ...tf.binds).all<{ status: string; count: number; revenue: number }>();

    return c.json({ success: true, data: results || [] });
  });

  // GET /api/reports/top-products — top selling products by quantity in date range
  app.get('/top-products', async (c) => {
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
    }
    const rangeErr = validateDateRangeWindow(from, to);
    if (rangeErr) {
      return c.json({ success: false, error: rangeErr }, 400);
    }

    const authErr = await verifyReportAnalyticsAccess(c);
    if (authErr) return authErr;

    const db = c.env.AURA_DB;
    const tf = buildTenantClause(getTenantId(c));

    const { results } = await db.prepare(
      `SELECT items FROM orders
       WHERE DATE(created_at) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
       ORDER BY created_at DESC`
    ).bind(from, to, ...tf.binds).all<{ items: string }>();

    // Aggregate by product name (parse JSON in JS for safety)
    const productMap = new Map<string, { qty: number; revenue: number }>();
    for (const row of results || []) {
      try {
        const items = JSON.parse(row.items || '[]');
        if (!Array.isArray(items)) {
          continue;
        }
        for (const item of items) {
          const name = item.name || item.product_name || 'Unknown';
          const qty = Number(item.qty ?? item.quantity ?? 1);
          const price = Number(item.price ?? item.unit_price ?? 0);
          if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) continue;
          const existing = productMap.get(name) || { qty: 0, revenue: 0 };
          existing.qty += qty;
          existing.revenue += price * qty;
          productMap.set(name, existing);
        }
      } catch {
        // Skip malformed JSON
      }
    }

    const rawLimit = parseInt(c.req.query('limit') || '10', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10;
    const topProducts = [...productMap.entries()]
      .map(([name, data]) => ({ name, qty: data.qty, revenue: data.revenue }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit);

    return c.json({ success: true, data: topProducts });
  });

  // GET /api/reports/peak-hours — hourly order distribution, zero-filled
  app.get('/peak-hours', async (c) => {
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
    }
    const rangeErr = validateDateRangeWindow(from, to);
    if (rangeErr) {
      return c.json({ success: false, error: rangeErr }, 400);
    }

    const authErr = await verifyReportAnalyticsAccess(c);
    if (authErr) return authErr;

    const db = c.env.AURA_DB;
    const tf = buildTenantClause(getTenantId(c));

    let results: { hour: number; order_count: number; revenue: number }[] | undefined;
    try {
      const res = await db.prepare(
        `SELECT CAST(strftime('%H', datetime(created_at, '+7 hours')) AS INTEGER) as hour,
                COUNT(*) as order_count,
                COALESCE(SUM(total), 0) as revenue
         FROM orders
         WHERE DATE(created_at) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
         GROUP BY hour ORDER BY hour`
      ).bind(from, to, ...tf.binds).all<{ hour: number; order_count: number; revenue: number }>();
      results = res.results;
    } catch {
      const res = await db.prepare(
        `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour,
                COUNT(*) as order_count,
                COALESCE(SUM(total), 0) as revenue
         FROM orders
         WHERE DATE(created_at) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
         GROUP BY hour ORDER BY hour`
      ).bind(from, to, ...tf.binds).all<{ hour: number; order_count: number; revenue: number }>();
      results = res.results;
    }

    // Build zero-filled 24-hour array
    const peakHours: { hour: number; order_count: number; revenue: number }[] = [];
    const resultMap = new Map((results || []).map(r => [r.hour, r]));
    for (let h = 0; h < 24; h++) {
      const existing = resultMap.get(h);
      peakHours.push({
        hour: h,
        order_count: existing?.order_count || 0,
        revenue: existing?.revenue || 0
      });
    }

    return c.json({ success: true, data: peakHours });
  });

  // GET /api/reports/customer-metrics — aggregate customer KPIs
  app.get('/customer-metrics', async (c) => {
    const authErr = await verifyReportAnalyticsAccess(c);
    if (authErr) return authErr;

    const db = c.env.AURA_DB;
    const tf = buildTenantClause(getTenantId(c));
    const runFirst = <T>(sql: string, extraBinds: unknown[] = []) => {
      const stmt = db.prepare(sql);
      const allBinds = [...extraBinds, ...tf.binds];
      return allBinds.length > 0 ? stmt.bind(...allBinds).first<T>() : stmt.first<T>();
    };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [
      totalCustomers,
      newCustomers30d,
      repeatCustomers,
      totalRevenue,
      totalOrders,
      orderCustomers
    ] = await Promise.all([
      runFirst<{ count: number }>(`SELECT COUNT(*) as count FROM customers${tf.where}`),
      runFirst<{ count: number }>(`SELECT COUNT(*) as count FROM customers WHERE created_at >= ?${tf.and}`, [thirtyDaysAgo]),
      runFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL AND TRIM(COALESCE(customer_id, '')) NOT IN ('', 'guest', 'walk-in', 'pos') AND ${VALID_REVENUE_ORDER_SQL}${tf.and} GROUP BY customer_id, COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') HAVING COUNT(*) > 1)`
      ),
      runFirst<{ total: number }>(
        `SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE ${VALID_REVENUE_ORDER_SQL}${tf.and}`
      ),
      runFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM orders WHERE ${VALID_REVENUE_ORDER_SQL}${tf.and}`
      ),
      runFirst<{ count: number }>(
        `SELECT COUNT(DISTINCT CASE WHEN TRIM(COALESCE(customer_id, '')) NOT IN ('', 'guest', 'walk-in', 'pos') THEN customer_id END) as count FROM orders WHERE ${VALID_REVENUE_ORDER_SQL}${tf.and}`
      )
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
      avg_orders_per_customer: custWithOrders > 0 ? Math.round((ord / custWithOrders) * 100) / 100 : 0
    };

    return c.json({ success: true, data: metrics });
  });
}
