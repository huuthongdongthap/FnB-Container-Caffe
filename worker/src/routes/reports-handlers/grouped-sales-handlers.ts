import type { Context, Hono } from 'hono';
import type { Env } from '../../types/env';
import { authenticateRequest } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import {
  NET_ORDER_TOTAL_SQL,
  VALID_REVENUE_ORDER_ALIAS_SQL,
  VALID_REVENUE_ORDER_SQL,
  buildTenantClause,
  isStrictHQReportAdmin,
  validateDateRangeWindow,
  verifyReportAnalyticsAccess,
} from './analytics-handlers';
import type { GroupedSalesGroup, RevenueOverviewData } from './types';

const ICT_OFFSET_MS = 7 * 3600_000;

function defaultToDate(nowMs = Date.now()): string {
  return new Date(nowMs + ICT_OFFSET_MS).toISOString().slice(0, 10);
}

function defaultFromDate(daysBack = 30, nowMs = Date.now()): string {
  return new Date(nowMs + ICT_OFFSET_MS - daysBack * 86400_000).toISOString().slice(0, 10);
}

function isCallerStrictHQ(c?: Context<{ Bindings: Env }>): boolean {
  if (!c) return false;
  const user = (c as unknown as { get: (k: string) => { role?: string; tenantId?: string; tenant_id?: string } | undefined }).get('user');
  const role = String(user?.role || '').toLowerCase();
  const userTenant = String(user?.tenantId ?? user?.tenant_id ?? '').trim();
  return isStrictHQReportAdmin(role, userTenant);
}

function buildTenantFilter(tenantId: string, alias?: string, c?: Context<{ Bindings: Env }>): { clause: string; binds: string[] } {
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant === '*') {
    if (!c || isCallerStrictHQ(c)) {
      return { clause: '', binds: [] };
    }
    const col = alias ? `${alias}.tenant_id` : 'tenant_id';
    return { clause: ` AND (${col} = ? OR ${col} IS NULL OR TRIM(${col}) = '')`, binds: ['default'] };
  }
  const col = alias ? `${alias}.tenant_id` : 'tenant_id';
  if (normTenant === 'default') {
    return { clause: ` AND (${col} = ? OR ${col} IS NULL OR TRIM(${col}) = '')`, binds: [normTenant] };
  }
  const { and, binds } = buildTenantClause(normTenant, alias);
  return { clause: and, binds };
}

const NON_REVENUE_STATUS_SQL = VALID_REVENUE_ORDER_SQL;
const NON_REVENUE_STATUS_FALLBACK_SQL =
  "LOWER(TRIM(COALESCE(status, ''))) IN ('completed', 'paid', 'delivered', 'served')";
const NON_REVENUE_ORDER_ALIAS_STATUS_SQL = VALID_REVENUE_ORDER_ALIAS_SQL;
const NON_REVENUE_ORDER_ALIAS_STATUS_FALLBACK_SQL =
  "LOWER(TRIM(COALESCE(o.status, ''))) IN ('completed', 'paid', 'delivered', 'served')";

export async function resolveReportScope(
  c: Context<{ Bindings: Env }>
): Promise<{ tenantId: string; forbidden: boolean }> {
  let user = (c as unknown as { get: (k: string) => { id?: string; role?: string; tenantId?: string } | undefined }).get('user');
  if (!user && c.req?.raw && c.env?.JWT_SECRET && (c.req.header('Authorization') || c.req.header('authorization'))) {
    const session = await authenticateRequest(c.req.raw, c.env, { optional: true }).catch(() => null);
    if (session && 'payload' in session) {
      user = {
        id: session.payload.id,
        role: session.payload.role,
        tenantId: session.payload.tenantId,
      };
      (c as unknown as { set?: (k: string, v: unknown) => void }).set?.('user', user);
    }
  }

  const role = (user?.role || '').toLowerCase();
  const userTenant = String(user?.tenantId ?? (user as { tenant_id?: string } | undefined)?.tenant_id ?? '').trim();
  const hqAdmin = isStrictHQReportAdmin(role, userTenant);
  const boundTenant = !userTenant || (!hqAdmin && (userTenant === '*' || userTenant.toLowerCase() === 'hq')) ? 'default' : userTenant;
  const reqCandidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(reqCandidates).size > 1) {
    return { tenantId: boundTenant, forbidden: true };
  }
  const reqTenant = reqCandidates[0] || '';
  const ctxTenant =
    ((c as unknown as { get: (k: string) => string | undefined }).get('tenantId') || '').trim();
  const resolved = getTenantId(c).trim() || 'default';

  if (user) {
    if (!hqAdmin) {
      if (
        userTenant === '*' ||
        userTenant.toLowerCase() === 'hq' ||
        reqTenant === '*' ||
        reqTenant.toLowerCase() === 'hq' ||
        (reqTenant && reqTenant !== boundTenant) ||
        (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== boundTenant)) ||
        resolved !== boundTenant
      ) {
        return { tenantId: boundTenant, forbidden: true };
      }
      return { tenantId: boundTenant, forbidden: false };
    }
    const hqTarget = reqTenant || ctxTenant || resolved || '*';
    return { tenantId: hqTarget.toLowerCase() === 'hq' ? '*' : hqTarget, forbidden: false };
  }

  return { tenantId: resolved, forbidden: false };
}

export async function handleOverview(c: Context<{ Bindings: Env }>) {
  const authErr = await verifyReportAnalyticsAccess(c, { allowUnauthenticatedDefaultInTest: true });
  if (authErr) return authErr;
  const db = c.env.AURA_DB;
  const scope = await resolveReportScope(c);
  if (scope.forbidden) {
    return c.json({ success: false, error: 'Cross-tenant report access denied' }, 403);
  }
  const tenantId = scope.tenantId;
  const { clause: tenantClause, binds: tenantBinds } = buildTenantFilter(tenantId, undefined, c);
  const todayStr = defaultToDate();
  const from = c.req.query('from') || todayStr;
  const to = c.req.query('to') || todayStr;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
  }
  const rangeErr = validateDateRangeWindow(from, to);
  if (rangeErr) {
    return c.json({ success: false, error: rangeErr }, 400);
  }

  const startMs = Date.parse(`${from}T00:00:00.000Z`);
  const endMs = Date.parse(`${to}T00:00:00.000Z`);
  const diffDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);

  const prevStart = new Date(startMs - diffDays * 86400000).toISOString().slice(0, 10);
  const prevEnd = new Date(startMs - 86400000).toISOString().slice(0, 10);

  let current: { revenue: number; orders_count: number } | null = null;
  let previous: { revenue: number; orders_count: number } | null = null;
  try {
    [current, previous] = await Promise.all([
      db.prepare(`
        SELECT COALESCE(SUM(${NET_ORDER_TOTAL_SQL}), 0) as revenue, COUNT(*) as orders_count
        FROM orders
        WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
      `).bind(from, to, ...tenantBinds).first<{ revenue: number; orders_count: number }>(),
      db.prepare(`
        SELECT COALESCE(SUM(${NET_ORDER_TOTAL_SQL}), 0) as revenue, COUNT(*) as orders_count
        FROM orders
        WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
      `).bind(prevStart, prevEnd, ...tenantBinds).first<{ revenue: number; orders_count: number }>(),
    ]);
  } catch {
    try {
      [current, previous] = await Promise.all([
        db.prepare(`
          SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders_count
          FROM orders
          WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
        `).bind(from, to, ...tenantBinds).first<{ revenue: number; orders_count: number }>(),
        db.prepare(`
          SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders_count
          FROM orders
          WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
        `).bind(prevStart, prevEnd, ...tenantBinds).first<{ revenue: number; orders_count: number }>(),
      ]);
    } catch {
      [current, previous] = await Promise.all([
        db.prepare(`
          SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders_count
          FROM orders
          WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_FALLBACK_SQL}${tenantClause}
        `).bind(from, to, ...tenantBinds).first<{ revenue: number; orders_count: number }>(),
        db.prepare(`
          SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders_count
          FROM orders
          WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_FALLBACK_SQL}${tenantClause}
        `).bind(prevStart, prevEnd, ...tenantBinds).first<{ revenue: number; orders_count: number }>(),
      ]);
    }
  }

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
    periodRevenue: todayRevenue,
    previousPeriodRevenue: yesterdayRevenue,
    periodOrders: todayOrders,
    previousPeriodOrders: yesterdayOrders,
    range: {
      from,
      to,
      prevFrom: prevStart,
      prevTo: prevEnd,
      days: diffDays,
    },
  };

  return c.json({ success: true, data });
}

export function registerGroupedSalesHandlers(app: Hono<{ Bindings: Env }>) {
  app.get('/overview', handleOverview);

  app.get('/sales-by-hour', async (c) => {
    const authErr = await verifyReportAnalyticsAccess(c, { allowUnauthenticatedDefaultInTest: true });
    if (authErr) return authErr;
    const db = c.env.AURA_DB;
    const scope = await resolveReportScope(c);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant report access denied' }, 403);
    }
    const tenantId = scope.tenantId;
    const { clause: tenantClause, binds: tenantBinds } = buildTenantFilter(tenantId, undefined, c);
    const todayStr = defaultToDate();
    const from = c.req.query('from') || todayStr;
    const to = c.req.query('to') || todayStr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
    }
    const hourRangeErr = validateDateRangeWindow(from, to);
    if (hourRangeErr) {
      return c.json({ success: false, error: hourRangeErr }, 400);
    }

    let results: Array<{ hour: number; value: number; count: number }> = [];
    try {
      const res = await db.prepare(`
        SELECT CAST(strftime('%H', datetime(created_at, '+7 hours')) AS INTEGER) as hour,
               COALESCE(SUM(${NET_ORDER_TOTAL_SQL}), 0) as value,
               COUNT(*) as count
        FROM orders
        WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
        GROUP BY hour ORDER BY hour
      `).bind(from, to, ...tenantBinds).all<{ hour: number; value: number; count: number }>();
      results = res.results || [];
    } catch {
      try {
        const res = await db.prepare(`
          SELECT CAST(strftime('%H', datetime(created_at, '+7 hours')) AS INTEGER) as hour,
                 COALESCE(SUM(total), 0) as value,
                 COUNT(*) as count
          FROM orders
          WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
          GROUP BY hour ORDER BY hour
        `).bind(from, to, ...tenantBinds).all<{ hour: number; value: number; count: number }>();
        results = res.results || [];
      } catch {
        const res = await db.prepare(`
          SELECT CAST(strftime('%H', datetime(created_at, '+7 hours')) AS INTEGER) as hour,
                 COALESCE(SUM(total), 0) as value,
                 COUNT(*) as count
          FROM orders
          WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_FALLBACK_SQL}${tenantClause}
          GROUP BY hour ORDER BY hour
        `).bind(from, to, ...tenantBinds).all<{ hour: number; value: number; count: number }>();
        results = res.results || [];
      }
    }

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
    const authErr = await verifyReportAnalyticsAccess(c, { allowUnauthenticatedDefaultInTest: true });
    if (authErr) return authErr;
    const db = c.env.AURA_DB;
    const scope = await resolveReportScope(c);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant report access denied' }, 403);
    }
    const tenantId = scope.tenantId;
    const { clause: tenantClause, binds: tenantBinds } = buildTenantFilter(tenantId, undefined, c);
    const from = c.req.query('from') || defaultFromDate(30);
    const to = c.req.query('to') || defaultToDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
    }
    const rangeErr = validateDateRangeWindow(from, to);
    if (rangeErr) {
      return c.json({ success: false, error: rangeErr }, 400);
    }

    let results: GroupedSalesGroup[] = [];
    try {
      const res = await db.prepare(`
        SELECT DATE(datetime(created_at, '+7 hours')) as label,
               COALESCE(SUM(${NET_ORDER_TOTAL_SQL}), 0) as value,
               COUNT(*) as count
        FROM orders
        WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
        GROUP BY label ORDER BY label
      `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();
      results = res.results || [];
    } catch {
      try {
        const res = await db.prepare(`
          SELECT DATE(datetime(created_at, '+7 hours')) as label,
                 COALESCE(SUM(total), 0) as value,
                 COUNT(*) as count
          FROM orders
          WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
          GROUP BY label ORDER BY label
        `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();
        results = res.results || [];
      } catch {
        const res = await db.prepare(`
          SELECT DATE(datetime(created_at, '+7 hours')) as label,
                 COALESCE(SUM(total), 0) as value,
                 COUNT(*) as count
          FROM orders
          WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_FALLBACK_SQL}${tenantClause}
          GROUP BY label ORDER BY label
        `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();
        results = res.results || [];
      }
    }

    return c.json({ success: true, data: { groups: results || [] } });
  });

  app.get('/sales-by-category', async (c) => {
    const authErr = await verifyReportAnalyticsAccess(c, { allowUnauthenticatedDefaultInTest: true });
    if (authErr) return authErr;
    const db = c.env.AURA_DB;
    const scope = await resolveReportScope(c);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant report access denied' }, 403);
    }
    const tenantId = scope.tenantId;
    const { clause: tenantOrderClause } = buildTenantFilter(tenantId, 'o', c);
    const { clause: tenantClause, binds: tenantBinds } = buildTenantFilter(tenantId, undefined, c);
    const from = c.req.query('from') || defaultFromDate(30);
    const to = c.req.query('to') || defaultToDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
    }
    const catRangeErr = validateDateRangeWindow(from, to);
    if (catRangeErr) {
      return c.json({ success: false, error: catRangeErr }, 400);
    }

    let results: GroupedSalesGroup[] = [];
    try {
      const res = await db.prepare(`
        SELECT COALESCE(c.name, 'Món khác') as label,
               COALESCE(SUM(oi.subtotal), 0) as value,
               SUM(oi.quantity) as count,
               COUNT(DISTINCT oi.order_id) as orderCount,
               SUM(oi.quantity) as itemsCount
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
        LEFT JOIN categories c ON c.id = p.category_id AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
        WHERE ${NON_REVENUE_ORDER_ALIAS_STATUS_SQL} AND DATE(datetime(o.created_at, '+7 hours')) BETWEEN ? AND ?${tenantOrderClause}
        GROUP BY COALESCE(c.name, 'Món khác') ORDER BY value DESC
      `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();
      results = res.results || [];
    } catch {
      try {
        const res = await db.prepare(`
          SELECT COALESCE(c.name, 'Món khác') as label,
                 COALESCE(SUM(oi.subtotal), 0) as value,
                 SUM(oi.quantity) as count,
                 COUNT(DISTINCT oi.order_id) as orderCount,
                 SUM(oi.quantity) as itemsCount
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          LEFT JOIN products p ON p.id = oi.product_id AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
          LEFT JOIN categories c ON c.id = p.category_id AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
          WHERE ${NON_REVENUE_ORDER_ALIAS_STATUS_FALLBACK_SQL} AND DATE(datetime(o.created_at, '+7 hours')) BETWEEN ? AND ?${tenantOrderClause}
          GROUP BY COALESCE(c.name, 'Món khác') ORDER BY value DESC
        `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();
        results = res.results || [];
      } catch {
        if (tenantId === 'default' || tenantId === '*') {
          try {
            const res = await db.prepare(`
              SELECT COALESCE(c.name, 'Món khác') as label,
                     COALESCE(SUM(oi.subtotal), 0) as value,
                     SUM(oi.quantity) as count,
                     COUNT(DISTINCT oi.order_id) as orderCount,
                     SUM(oi.quantity) as itemsCount
              FROM order_items oi
              JOIN orders o ON o.id = oi.order_id
              LEFT JOIN products p ON p.id = oi.product_id
              LEFT JOIN categories c ON c.id = p.category_id
              WHERE ${NON_REVENUE_ORDER_ALIAS_STATUS_FALLBACK_SQL} AND DATE(datetime(o.created_at, '+7 hours')) BETWEEN ? AND ?${tenantOrderClause}
              GROUP BY COALESCE(c.name, 'Món khác') ORDER BY value DESC
            `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();
            results = res.results || [];
          } catch {
            results = [];
          }
        }
      }
    }

    if (results && results.length > 0) {
      return c.json({ success: true, data: { groups: results, unit: 'items' } });
    }

    let rawOrders: Array<{ items: string }> = [];
    try {
      const res = await db.prepare(`
        SELECT items FROM orders
        WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
        ORDER BY created_at DESC LIMIT 2000
      `).bind(from, to, ...tenantBinds).all<{ items: string }>();
      rawOrders = res.results || [];
    } catch {
      const res = await db.prepare(`
        SELECT items FROM orders
        WHERE DATE(created_at) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_FALLBACK_SQL}${tenantClause}
        ORDER BY created_at DESC LIMIT 2000
      `).bind(from, to, ...tenantBinds).all<{ items: string }>();
      rawOrders = res.results || [];
    }

    const parsedOrderItems: Array<Array<{
      category?: string;
      category_name?: string;
      product_id?: string;
      id?: string;
      quantity?: number;
      qty?: number;
      price?: number;
      unit_price?: number;
    }>> = [];
    let needsCatalogLookup = false;

    for (const row of rawOrders || []) {
      try {
        const items = JSON.parse(row.items || '[]');
        if (Array.isArray(items)) {
          parsedOrderItems.push(items);
          for (const it of items) {
            if (!it.category && !it.category_name && (it.product_id || it.id)) {
              needsCatalogLookup = true;
            }
          }
        }
      } catch {
        // Skip malformed
      }
    }

    const productCategoryMap = new Map<string, string>();
    if (needsCatalogLookup) {
      try {
        const prodRes = tenantId === '*'
          ? await db.prepare(`SELECT id, category_id FROM products`).all<{ id: string; category_id: string }>()
          : await db.prepare(
              `SELECT id, category_id FROM products WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(tenantId).all<{ id: string; category_id: string }>();
        const catRes = tenantId === '*'
          ? await db.prepare(`SELECT id, name FROM categories`).all<{ id: string; name: string }>()
          : await db.prepare(
              `SELECT id, name FROM categories WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(tenantId).all<{ id: string; name: string }>();
        const catNameById = new Map((catRes.results || []).map((cat) => [String(cat.id), cat.name]));
        for (const p of prodRes.results || []) {
          const cName = catNameById.get(String(p.category_id));
          if (cName) productCategoryMap.set(String(p.id), cName);
        }
      } catch {
        if (tenantId === 'default' || tenantId === '*') {
          try {
            const prodRes = await db.prepare(`SELECT id, category_id FROM products`).all<{ id: string; category_id: string }>();
            const catRes = await db.prepare(`SELECT id, name FROM categories`).all<{ id: string; name: string }>();
            const catNameById = new Map((catRes.results || []).map((cat) => [String(cat.id), cat.name]));
            for (const p of prodRes.results || []) {
              const cName = catNameById.get(String(p.category_id));
              if (cName) productCategoryMap.set(String(p.id), cName);
            }
          } catch {
            // Ignore missing catalog tables in legacy default fallback
          }
        }
      }
    }

    const catMap = new Map<string, { value: number; count: number; orderCount: number }>();
    for (const items of parsedOrderItems) {
      const seenCategoriesInOrder = new Set<string>();
      for (const it of items) {
        const pid = String(it.product_id || it.id || '');
        const resolvedCat = it.category || it.category_name || (pid ? productCategoryMap.get(pid) : undefined);
        const cat = String(resolvedCat || 'Món khác');
        const rawQty = it.quantity ?? it.qty;
        const qtyNum = rawQty !== undefined && rawQty !== null ? Number(rawQty) : 1;
        const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
        if (qty <= 0) continue;
        const rawPrice = Number(it.price ?? it.unit_price ?? 0);
        const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
        const cur = catMap.get(cat) || { value: 0, count: 0, orderCount: 0 };
        cur.value += price * qty;
        cur.count += qty;
        if (!seenCategoriesInOrder.has(cat)) {
          cur.orderCount += 1;
          seenCategoriesInOrder.add(cat);
        }
        catMap.set(cat, cur);
      }
    }

    const groups: GroupedSalesGroup[] = [...catMap.entries()]
      .map(([label, d]) => ({
        label,
        value: d.value,
        count: d.count,
        orderCount: d.orderCount,
        itemsCount: d.count,
      }))
      .sort((a, b) => b.value - a.value);

    return c.json({ success: true, data: { groups, unit: 'items' } });
  });

  app.get('/sales-by-payment', async (c) => {
    const authErr = await verifyReportAnalyticsAccess(c, { allowUnauthenticatedDefaultInTest: true });
    if (authErr) return authErr;
    const db = c.env.AURA_DB;
    const scope = await resolveReportScope(c);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant report access denied' }, 403);
    }
    const tenantId = scope.tenantId;
    const { clause: tenantClause, binds: tenantBinds } = buildTenantFilter(tenantId, undefined, c);
    const from = c.req.query('from') || defaultFromDate(30);
    const to = c.req.query('to') || defaultToDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' }, 400);
    }
    const rangeErr = validateDateRangeWindow(from, to);
    if (rangeErr) {
      return c.json({ success: false, error: rangeErr }, 400);
    }

    let results: GroupedSalesGroup[] = [];
    try {
      const res = await db.prepare(`
        SELECT LOWER(TRIM(COALESCE(NULLIF(TRIM(payment_method), ''), 'other'))) as label,
               COALESCE(SUM(${NET_ORDER_TOTAL_SQL}), 0) as value,
               COUNT(*) as count
        FROM orders
        WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
        GROUP BY LOWER(TRIM(COALESCE(NULLIF(TRIM(payment_method), ''), 'other'))) ORDER BY value DESC
      `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();
      results = res.results || [];
    } catch {
      try {
        const res = await db.prepare(`
          SELECT LOWER(TRIM(COALESCE(NULLIF(TRIM(payment_method), ''), 'other'))) as label,
                 COALESCE(SUM(total), 0) as value,
                 COUNT(*) as count
          FROM orders
          WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_SQL}${tenantClause}
          GROUP BY LOWER(TRIM(COALESCE(NULLIF(TRIM(payment_method), ''), 'other'))) ORDER BY value DESC
        `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();
        results = res.results || [];
      } catch {
        const res = await db.prepare(`
          SELECT LOWER(TRIM(COALESCE(NULLIF(TRIM(payment_method), ''), 'other'))) as label,
                 COALESCE(SUM(total), 0) as value,
                 COUNT(*) as count
          FROM orders
          WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${NON_REVENUE_STATUS_FALLBACK_SQL}${tenantClause}
          GROUP BY LOWER(TRIM(COALESCE(NULLIF(TRIM(payment_method), ''), 'other'))) ORDER BY value DESC
        `).bind(from, to, ...tenantBinds).all<GroupedSalesGroup>();
        results = res.results || [];
      }
    }

    return c.json({ success: true, data: { groups: results || [] } });
  });
}
