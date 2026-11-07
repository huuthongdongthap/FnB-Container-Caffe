/**
 * Analytics Summary — D1 queries for aggregate metrics, period comparison,
 * and grouped aggregation (hour / day / category / payment).
 *
 * Used by GET /api/analytics with ?compare=&group= query params.
 */

import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';

// ───── Types ─────

export interface SummaryMetrics {
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  total_customers: number;
}

export interface GroupRow {
  label: string;
  value: number;
  count: number;
}

export type GroupBy = 'hour' | 'day' | 'category' | 'payment';

/**
 * Resolve and validate analytics tenant scope against the authenticated user.
 * Non-HQ users cannot override their bound tenant via headers/query or query '*'.
 */
export function resolveAnalyticsTenant(c: {
  get?: (_key: string) => unknown;
  env?: unknown;
  req?: { method?: string; path?: string; query?: (_k: string) => string | undefined; header?: (_k: string) => string | undefined };
}): { tenantId: string; forbidden: boolean } {
  const user = (typeof c?.get === 'function' ? c.get('user') : undefined) as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  const userTenant = String(user?.tenantId ?? user?.tenant_id ?? '').trim();
  const hqAdmin = isHQSuperAdmin(user ? { ...user, tenantId: userTenant || user.tenantId } : undefined);
  const candidates = [
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
  if (new Set(candidates).size > 1) {
    return { tenantId: userTenant || 'default', forbidden: true };
  }
  const headerOrQueryTenant = candidates[0] || '';
  const ctxTenant = (typeof c?.get === 'function' ? (c.get('tenantId') as string | undefined) : undefined)?.trim() || '';

  if (user && !hqAdmin) {
    const boundTenant = !userTenant || userTenant === '*' || userTenant.toLowerCase() === 'hq' ? 'default' : userTenant;
    if (userTenant === '*' || userTenant.toLowerCase() === 'hq') {
      return { tenantId: boundTenant, forbidden: true };
    }
    if (
      headerOrQueryTenant &&
      (headerOrQueryTenant === '*' || headerOrQueryTenant.toLowerCase() === 'hq' || headerOrQueryTenant !== boundTenant)
    ) {
      return { tenantId: boundTenant, forbidden: true };
    }
    if (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== boundTenant)) {
      return { tenantId: boundTenant, forbidden: true };
    }
    return { tenantId: boundTenant, forbidden: false };
  }

  if (!user) {
    if (headerOrQueryTenant && headerOrQueryTenant !== 'default') {
      return { tenantId: 'default', forbidden: true };
    }
    if (ctxTenant && ctxTenant !== 'default' && (Boolean(c.req) || ctxTenant !== '*')) {
      return { tenantId: 'default', forbidden: true };
    }
    return { tenantId: 'default', forbidden: false };
  }

  let resolved = (hqAdmin && headerOrQueryTenant ? headerOrQueryTenant : getTenantId(c)).trim() || 'default';
  if (hqAdmin && resolved.toLowerCase() === 'hq') {
    resolved = '*';
  }
  if ((resolved === '*' || resolved.toLowerCase() === 'hq') && !hqAdmin) {
    resolved = userTenant || 'default';
  }
  return { tenantId: resolved, forbidden: false };
}

// ───── Queries ─────

export function buildTenantFilter(
  tenantId?: string,
  tableAlias?: string,
  prefix: 'AND' | 'WHERE' = 'AND'
): { clause: string; binds: string[] } {
  if (!tenantId || tenantId === '*') {
    return { clause: '', binds: [] };
  }
  const col = tableAlias ? `${tableAlias}.tenant_id` : 'tenant_id';
  if (tenantId === 'default') {
    return { clause: ` ${prefix} (${col} = ? OR ${col} IS NULL OR ${col} = '' OR TRIM(${col}) = '')`, binds: [tenantId] };
  }
  return { clause: ` ${prefix} TRIM(${col}) = ?`, binds: [tenantId] };
}

const VALID_ORDER_WHERE = `status != 'cancelled'
    AND status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
    AND COALESCE(payment_status, '') != 'refunded'`;

const VALID_ORDER_FALLBACK_WHERE = `status != 'cancelled'
    AND status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')`;

const VALID_CUSTOMER_PHONE_EXPR =
  "CASE WHEN TRIM(COALESCE(customer_phone, '')) NOT IN ('', '0', '000000000', '0000000000', '00000000000', 'guest', 'walk-in', 'pos') THEN customer_phone END";

const AGGREGATE_SQL = `
  SELECT
    COUNT(*) AS total_orders,
    COALESCE(SUM(total), 0) AS total_revenue,
    CASE WHEN COUNT(*) > 0 THEN SUM(total) / COUNT(*) ELSE 0 END AS avg_order_value,
    COUNT(DISTINCT ${VALID_CUSTOMER_PHONE_EXPR}) AS total_customers
  FROM orders
  WHERE ${VALID_ORDER_WHERE}
    AND created_at >= datetime('now', '-' || ? || ' days')
`;

const AGGREGATE_FALLBACK_SQL = `
  SELECT
    COUNT(*) AS total_orders,
    COALESCE(SUM(total), 0) AS total_revenue,
    CASE WHEN COUNT(*) > 0 THEN SUM(total) / COUNT(*) ELSE 0 END AS avg_order_value,
    COUNT(DISTINCT ${VALID_CUSTOMER_PHONE_EXPR}) AS total_customers
  FROM orders
  WHERE ${VALID_ORDER_FALLBACK_WHERE}
    AND created_at >= datetime('now', '-' || ? || ' days')
`;

/**
 * Get aggregate summary metrics for the last N days.
 */
export async function getSummary(
  db: import('@cloudflare/workers-types').D1Database,
  days: number,
  tenantId?: string
): Promise<SummaryMetrics> {
  const tf = buildTenantFilter(tenantId);
  let row: SummaryMetrics | null = null;
  try {
    row = await db.prepare(`${AGGREGATE_SQL}${tf.clause}`).bind(days, ...tf.binds).first<SummaryMetrics>();
  } catch {
    row = await db.prepare(`${AGGREGATE_FALLBACK_SQL}${tf.clause}`).bind(days, ...tf.binds).first<SummaryMetrics>();
  }
  return {
    total_orders: row?.total_orders ?? 0,
    total_revenue: row?.total_revenue ?? 0,
    avg_order_value: row?.avg_order_value ?? 0,
    total_customers: row?.total_customers ?? 0
  };
}

/**
 * Get summary metrics for two consecutive periods of equal length
 * (current = last N days, previous = N days before that).
 * Returns { current, previous } for overlay / comparison charts.
 */
export async function getSummaryCompare(
  db: import('@cloudflare/workers-types').D1Database,
  days: number,
  tenantId?: string
): Promise<{ current: SummaryMetrics; previous: SummaryMetrics }> {
  const tf = buildTenantFilter(tenantId);
  let current: SummaryMetrics | null = null;
  let previous: SummaryMetrics | null = null;
  try {
    [current, previous] = await Promise.all([
      db.prepare(`${AGGREGATE_SQL}${tf.clause}`).bind(days, ...tf.binds).first<SummaryMetrics>(),
      db.prepare(`
        SELECT
          COUNT(*) AS total_orders,
          COALESCE(SUM(total), 0) AS total_revenue,
          CASE WHEN COUNT(*) > 0 THEN SUM(total) / COUNT(*) ELSE 0 END AS avg_order_value,
          COUNT(DISTINCT ${VALID_CUSTOMER_PHONE_EXPR}) AS total_customers
        FROM orders
        WHERE ${VALID_ORDER_WHERE}
          AND created_at >= datetime('now', '-' || ? || ' days')
          AND created_at < datetime('now', '-' || ? || ' days')${tf.clause}
      `).bind(days * 2, days, ...tf.binds).first<SummaryMetrics>()
    ]);
  } catch {
    [current, previous] = await Promise.all([
      db.prepare(`${AGGREGATE_FALLBACK_SQL}${tf.clause}`).bind(days, ...tf.binds).first<SummaryMetrics>(),
      db.prepare(`
        SELECT
          COUNT(*) AS total_orders,
          COALESCE(SUM(total), 0) AS total_revenue,
          CASE WHEN COUNT(*) > 0 THEN SUM(total) / COUNT(*) ELSE 0 END AS avg_order_value,
          COUNT(DISTINCT ${VALID_CUSTOMER_PHONE_EXPR}) AS total_customers
        FROM orders
        WHERE ${VALID_ORDER_FALLBACK_WHERE}
          AND created_at >= datetime('now', '-' || ? || ' days')
          AND created_at < datetime('now', '-' || ? || ' days')${tf.clause}
      `).bind(days * 2, days, ...tf.binds).first<SummaryMetrics>()
    ]);
  }

  return {
    current: {
      total_orders: current?.total_orders ?? 0,
      total_revenue: current?.total_revenue ?? 0,
      avg_order_value: current?.avg_order_value ?? 0,
      total_customers: current?.total_customers ?? 0
    },
    previous: {
      total_orders: previous?.total_orders ?? 0,
      total_revenue: previous?.total_revenue ?? 0,
      avg_order_value: previous?.avg_order_value ?? 0,
      total_customers: previous?.total_customers ?? 0
    }
  };
}

// ───── Group queries ─────

const GROUP_QUERIES: Record<GroupBy, string> = {
  hour: `
    SELECT
      CAST(strftime('%H', datetime(created_at, '+7 hours')) AS INTEGER) AS label,
      COALESCE(SUM(total), 0) AS value,
      COUNT(*) AS count
    FROM orders
    WHERE ${VALID_ORDER_WHERE}
      AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY label
    ORDER BY label
  `,
  day: `
    SELECT
      date(datetime(created_at, '+7 hours')) AS label,
      COALESCE(SUM(total), 0) AS value,
      COUNT(*) AS count
    FROM orders
    WHERE ${VALID_ORDER_WHERE}
      AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY label
    ORDER BY label
  `,
  category: `
    SELECT
      c.name AS label,
      COALESCE(SUM(oi.subtotal), 0) AS value,
      SUM(oi.quantity) AS count
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
      AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
    JOIN categories c ON c.id = p.category_id
      AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
    WHERE o.status != 'cancelled'
      AND o.status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
      AND COALESCE(o.payment_status, '') != 'refunded'
      AND o.created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY c.name
    ORDER BY value DESC
  `,
  payment: `
    SELECT
      payment_method AS label,
      COALESCE(SUM(total), 0) AS value,
      COUNT(*) AS count
    FROM orders
    WHERE ${VALID_ORDER_WHERE}
      AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY payment_method
    ORDER BY value DESC
  `
};

/**
 * Get grouped aggregation (hour / day / category / payment) for the last N days.
 * For hour grouping, returns a zero-filled 24-element array.
 */
export async function getGrouped(
  db: import('@cloudflare/workers-types').D1Database,
  groupBy: GroupBy,
  days: number,
  tenantId?: string
): Promise<GroupRow[]> {
  const baseSql = GROUP_QUERIES[groupBy];
  if (!baseSql) {
    throw new Error(`Unknown group: ${groupBy}`);
  }
  const normTenant = (tenantId || '').trim() || 'default';
  const tf = buildTenantFilter(tenantId, groupBy === 'category' ? 'o' : undefined);
  const sql = tf.clause ? baseSql.replace(/GROUP BY/, `${tf.clause}\n    GROUP BY`) : baseSql;

  let rows: GroupRow[] = [];
  try {
    const { results } = await db.prepare(sql).bind(days, ...tf.binds).all<GroupRow>();
    rows = results || [];
  } catch {
    if (groupBy === 'category') {
      try {
        const scopedCatSql = `
          SELECT
            c.name AS label,
            COALESCE(SUM(oi.subtotal), 0) AS value,
            SUM(oi.quantity) AS count
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          JOIN products p ON p.id = oi.product_id
            AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
          JOIN categories c ON c.id = p.category_id
            AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
          WHERE o.status != 'cancelled'
            AND o.status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
            AND o.created_at >= datetime('now', '-' || ? || ' days')${tf.clause}
          GROUP BY c.name
          ORDER BY value DESC
        `;
        const { results } = await db.prepare(scopedCatSql).bind(days, ...tf.binds).all<GroupRow>();
        rows = results || [];
      } catch {
        try {
          if (normTenant !== 'default') {
            throw new Error('Cross-tenant unscoped category join disabled');
          }
          const fallbackCatSql = `
            SELECT
              c.name AS label,
              COALESCE(SUM(oi.subtotal), 0) AS value,
              SUM(oi.quantity) AS count
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            JOIN categories c ON c.id = p.category_id
            JOIN orders o ON o.id = oi.order_id
            WHERE o.status != 'cancelled'
              AND o.status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
              AND o.created_at >= datetime('now', '-' || ? || ' days')${tf.clause}
            GROUP BY c.name
            ORDER BY value DESC
          `;
          const { results } = await db.prepare(fallbackCatSql).bind(days, ...tf.binds).all<GroupRow>();
          rows = results || [];
        } catch {
          try {
            const orderTf = buildTenantFilter(tenantId);
            let orderRows: Array<{ items: string; tenant_id?: string | null }> | undefined;
            try {
              const res = await db.prepare(`
                SELECT items, tenant_id FROM orders
                WHERE ${VALID_ORDER_FALLBACK_WHERE}
                  AND created_at >= datetime('now', '-' || ? || ' days')${orderTf.clause}
                ORDER BY created_at DESC
                LIMIT 2000
              `).bind(days, ...orderTf.binds).all<{ items: string; tenant_id?: string | null }>();
              orderRows = res.results;
            } catch {
              const res = await db.prepare(`
                SELECT items FROM orders
                WHERE ${VALID_ORDER_FALLBACK_WHERE}
                  AND created_at >= datetime('now', '-' || ? || ' days')${orderTf.clause}
                ORDER BY created_at DESC
                LIMIT 2000
              `).bind(days, ...orderTf.binds).all<{ items: string }>();
              orderRows = res.results;
            }

            const parsedRows: Array<{
              orderTenant: string;
              items: Array<{
                category?: string;
                category_name?: string;
                product_id?: string;
                id?: string;
                quantity?: number;
                qty?: number;
                price?: number;
                unit_price?: number;
                subtotal?: number;
              }>;
            }> = [];
            let needsCatalogLookup = false;
            for (const r of orderRows || []) {
              try {
                const parsed = JSON.parse(r.items || '[]');
                if (!Array.isArray(parsed)) continue;
                const rawOrderTenant = typeof r.tenant_id === 'string' ? r.tenant_id.trim() : '';
                const orderTenant =
                  normTenant === '*'
                    ? (rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq' ? rawOrderTenant : 'default')
                    : normTenant;
                parsedRows.push({ orderTenant, items: parsed });
                for (const item of parsed) {
                  if (!item.category && !item.category_name && (item.product_id || item.id)) {
                    needsCatalogLookup = true;
                  }
                }
              } catch {
                // Skip invalid JSON
              }
            }

            const productCategoryMap = new Map<string, string>();
            if (needsCatalogLookup) {
              if (normTenant === '*') {
                try {
                  const prodRes = await db.prepare(
                    `SELECT id, category_id, tenant_id FROM products`
                  ).all<{ id: string; category_id: string; tenant_id?: string | null }>();
                  const catRes = await db.prepare(
                    `SELECT id, name, tenant_id FROM categories`
                  ).all<{ id: string; name: string; tenant_id?: string | null }>();
                  const catNameByTenantId = new Map<string, string>();
                  for (const cat of catRes.results || []) {
                    const cRaw = typeof cat.tenant_id === 'string' ? cat.tenant_id.trim() : '';
                    const cTenant = cRaw && cRaw !== '*' && cRaw.toLowerCase() !== 'hq' ? cRaw : 'default';
                    catNameByTenantId.set(`${cTenant}::${String(cat.id)}`, cat.name);
                  }
                  for (const p of prodRes.results || []) {
                    const pRaw = typeof p.tenant_id === 'string' ? p.tenant_id.trim() : '';
                    const pTenant = pRaw && pRaw !== '*' && pRaw.toLowerCase() !== 'hq' ? pRaw : 'default';
                    const cName = catNameByTenantId.get(`${pTenant}::${String(p.category_id)}`);
                    if (cName) productCategoryMap.set(`${pTenant}::${String(p.id)}`, cName);
                  }
                } catch {
                  // Ignore missing catalog tables
                }
              } else {
                try {
                  const prodRes = await db.prepare(
                    `SELECT id, category_id FROM products WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
                  ).bind(normTenant).all<{ id: string; category_id: string }>();
                  const catRes = await db.prepare(
                    `SELECT id, name FROM categories WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
                  ).bind(normTenant).all<{ id: string; name: string }>();
                  const catNameById = new Map((catRes.results || []).map((cat) => [String(cat.id), cat.name]));
                  for (const p of prodRes.results || []) {
                    const cName = catNameById.get(String(p.category_id));
                    if (cName) productCategoryMap.set(`${normTenant}::${String(p.id)}`, cName);
                  }
                } catch {
                  if (normTenant === 'default') {
                    try {
                      const prodRes = await db.prepare(`SELECT id, category_id FROM products`).all<{ id: string; category_id: string }>();
                      const catRes = await db.prepare(`SELECT id, name FROM categories`).all<{ id: string; name: string }>();
                      const catNameById = new Map((catRes.results || []).map((cat) => [String(cat.id), cat.name]));
                      for (const p of prodRes.results || []) {
                        const cName = catNameById.get(String(p.category_id));
                        if (cName) productCategoryMap.set(`default::${String(p.id)}`, cName);
                      }
                    } catch {
                      // Ignore missing catalog tables in legacy default fallback
                    }
                  }
                }
              }
            }

            const catMap = new Map<string, { value: number; count: number }>();
            for (const { orderTenant, items } of parsedRows) {
              for (const item of items) {
                const pid = String(item.product_id || item.id || '');
                const resolvedCat =
                  item.category ||
                  item.category_name ||
                  (pid ? productCategoryMap.get(`${orderTenant}::${pid}`) : undefined);
                const label = String(resolvedCat || 'Uncategorized');
                const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
                const price = Number(item.price ?? item.unit_price ?? 0) || 0;
                const subtotal = Number(item.subtotal ?? price * qty) || 0;
                const cur = catMap.get(label) || { value: 0, count: 0 };
                cur.value += subtotal;
                cur.count += qty;
                catMap.set(label, cur);
              }
            }
            rows = Array.from(catMap.entries())
              .map(([label, v]) => ({ label, value: v.value, count: v.count }))
              .sort((a, b) => b.value - a.value);
          } catch {
            rows = [];
          }
        }
      }
    } else {
      try {
        const fallbackSql = sql.replace(/\s*AND COALESCE\(payment_status, ''\) != 'refunded'/g, '');
        const { results } = await db.prepare(fallbackSql).bind(days, ...tf.binds).all<GroupRow>();
        rows = results || [];
      } catch {
        try {
          const legacySql = sql
            .replace(/\s*AND COALESCE\(payment_status, ''\) != 'refunded'/g, '')
            .replace(/datetime\(created_at, '\+7 hours'\)/g, 'created_at');
          const { results } = await db.prepare(legacySql).bind(days, ...tf.binds).all<GroupRow>();
          rows = results || [];
        } catch {
          rows = [];
        }
      }
    }
  }

  // Zero-fill hour groups for consistent charting
  if (groupBy === 'hour') {
    const map = new Map<number, GroupRow>();
    for (const row of rows) {
      map.set(Number(row.label), row);
    }
    const filled: GroupRow[] = [];
    for (let h = 0; h < 24; h++) {
      const existing = map.get(h);
      filled.push({
        label: String(h),
        value: existing?.value ?? 0,
        count: existing?.count ?? 0
      });
    }
    return filled;
  }

  return rows;
}
