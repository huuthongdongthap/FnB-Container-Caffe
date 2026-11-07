/**
 * Top Products — D1 query for top N products by order count + revenue
 *
 * GET /api/analytics/top-products?limit=10
 */

import { buildTenantFilter } from './summary';

export interface TopProductRow {
  product_name: string;
  total_qty: number;
  revenue: number;
}

/**
 * Get top N products by total quantity sold (excluding cancelled orders).
 * Joins order_items with products to get names and aggregates quantity + revenue.
 */
export async function getTopProducts(
  db: import('@cloudflare/workers-types').D1Database,
  limit: number,
  tenantId?: string
): Promise<TopProductRow[]> {
  const normTenant = (tenantId || '').trim() || 'default';
  const { clause: orderAliasClause, binds: tenantBinds } = buildTenantFilter(tenantId, 'o');
  const { clause: orderClause } = buildTenantFilter(tenantId);
  try {
    const productTenantJoin =
      " AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')";
    let results: TopProductRow[] | undefined;
    try {
      const res = await db.prepare(`
      SELECT
        p.name AS product_name,
        SUM(oi.quantity) AS total_qty,
        SUM(oi.subtotal) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id${productTenantJoin}
      WHERE o.status != 'cancelled'
        AND o.status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
        AND COALESCE(o.payment_status, '') != 'refunded'${orderAliasClause}
      GROUP BY oi.product_id, p.name
      ORDER BY total_qty DESC
      LIMIT ?
    `).bind(...tenantBinds, limit).all<TopProductRow>();
      results = res.results;
    } catch {
      try {
        const res = await db.prepare(`
        SELECT
          p.name AS product_name,
          SUM(oi.quantity) AS total_qty,
          SUM(oi.subtotal) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id${productTenantJoin}
        WHERE o.status != 'cancelled'
          AND o.status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')${orderAliasClause}
        GROUP BY oi.product_id, p.name
        ORDER BY total_qty DESC
        LIMIT ?
      `).bind(...tenantBinds, limit).all<TopProductRow>();
        results = res.results;
      } catch {
        if (normTenant !== 'default') {
          throw new Error('Cross-tenant unscoped product join disabled');
        }
        const res = await db.prepare(`
        SELECT
          p.name AS product_name,
          SUM(oi.quantity) AS total_qty,
          SUM(oi.subtotal) AS revenue
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled'
          AND o.status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')${orderAliasClause}
        GROUP BY oi.product_id, p.name
        ORDER BY total_qty DESC
        LIMIT ?
      `).bind(...tenantBinds, limit).all<TopProductRow>();
        results = res.results;
      }
    }

    return results || [];
  } catch {
    try {
      let orderRows: Array<{ items: string; tenant_id?: string | null }> | undefined;
      try {
        const stmt = db.prepare(`
          SELECT items, tenant_id FROM orders
          WHERE status != 'cancelled'
            AND status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')${orderClause}
          ORDER BY created_at DESC
          LIMIT 2000
        `);
        const res = tenantBinds.length > 0
          ? await stmt.bind(...tenantBinds).all<{ items: string; tenant_id?: string | null }>()
          : await stmt.all<{ items: string; tenant_id?: string | null }>();
        orderRows = res.results;
      } catch {
        const stmt = db.prepare(`
          SELECT items FROM orders
          WHERE status != 'cancelled'
            AND status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')${orderClause}
          ORDER BY created_at DESC
          LIMIT 2000
        `);
        const res = tenantBinds.length > 0
          ? await stmt.bind(...tenantBinds).all<{ items: string }>()
          : await stmt.all<{ items: string }>();
        orderRows = res.results;
      }

      const parsedRows: Array<{
        orderTenant: string;
        items: Array<{
          name?: string;
          product_name?: string;
          product_id?: string;
          id?: string;
          quantity?: number;
          qty?: number;
          price?: number;
          unit_price?: number;
          subtotal?: number;
        }>;
      }> = [];
      let needsProductLookup = false;
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
            if (!item.name && !item.product_name && (item.product_id || item.id)) {
              needsProductLookup = true;
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }

      const productNameMap = new Map<string, string>();
      if (needsProductLookup) {
        if (normTenant === '*') {
          try {
            const prodRes = await db.prepare(
              `SELECT id, name, tenant_id FROM products`
            ).all<{ id: string; name: string; tenant_id?: string | null }>();
            for (const p of prodRes.results || []) {
              const pRaw = typeof p.tenant_id === 'string' ? p.tenant_id.trim() : '';
              const pTenant = pRaw && pRaw !== '*' && pRaw.toLowerCase() !== 'hq' ? pRaw : 'default';
              if (p.name) productNameMap.set(`${pTenant}::${String(p.id)}`, p.name);
            }
          } catch {
            // Ignore missing products table
          }
        } else {
          try {
            const prodRes = await db.prepare(
              `SELECT id, name, category_id FROM products WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(normTenant).all<{ id: string; name: string; category_id?: string }>();
            for (const p of prodRes.results || []) {
              if (p.name) productNameMap.set(`${normTenant}::${String(p.id)}`, p.name);
            }
          } catch {
            if (normTenant === 'default') {
              try {
                const prodRes = await db.prepare(
                  `SELECT id, name, category_id FROM products`
                ).all<{ id: string; name: string; category_id?: string }>();
                for (const p of prodRes.results || []) {
                  if (p.name) productNameMap.set(`default::${String(p.id)}`, p.name);
                }
              } catch {
                // Ignore missing products table in legacy default fallback
              }
            }
          }
        }
      }

      const productMap = new Map<string, { total_qty: number; revenue: number }>();
      for (const { orderTenant, items } of parsedRows) {
        for (const item of items) {
          const pid = String(item.product_id || item.id || '');
          const resolvedName =
            item.name ||
            item.product_name ||
            (pid ? productNameMap.get(`${orderTenant}::${pid}`) : undefined);
          const name = String(resolvedName || 'Unknown');
          const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
          const price = Number(item.price ?? item.unit_price ?? 0) || 0;
          const subtotal = Number(item.subtotal ?? price * qty) || 0;
          const cur = productMap.get(name) || { total_qty: 0, revenue: 0 };
          cur.total_qty += qty;
          cur.revenue += subtotal;
          productMap.set(name, cur);
        }
      }
      return Array.from(productMap.entries())
        .map(([product_name, v]) => ({
          product_name,
          total_qty: v.total_qty,
          revenue: v.revenue,
        }))
        .sort((a, b) => b.total_qty - a.total_qty)
        .slice(0, limit);
    } catch {
      return [];
    }
  }
}
