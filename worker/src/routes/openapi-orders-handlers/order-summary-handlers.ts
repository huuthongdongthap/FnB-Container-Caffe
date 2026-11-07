import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { getDatabase } from '../../lib/db';
import { resolveOpenApiOrdersTenant, isAllowedOrderLocationForTenant } from './helpers';

export async function handleGetOrderSummary(c: Context<{ Bindings: Env }>) {
  const user = c.get('user');
  const allowedSummaryRoles = ['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier'];
  if (!user || !allowedSummaryRoles.includes(String(user.role || ''))) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const tenantCheck = resolveOpenApiOrdersTenant(c, 'read');
  if (!tenantCheck.ok) {
    return tenantCheck.response;
  }
  const rawTenantId = (tenantCheck.tenantId || 'default').trim() || 'default';
  const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
  const db = getDatabase(c);
  const query = ((c.req as any).valid ? (c.req as any).valid('query') : null) || c.req.query();
  const { locationId, date, dateFrom, dateTo } = query;

  if (locationId && !(await isAllowedOrderLocationForTenant(db, locationId, tenantId))) {
    return c.json({
      success: true,
      data: {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        ordersByStatus: {},
        ordersByPaymentMethod: {},
      },
    });
  }

  const vnToday = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];
  if (tenantId !== '*') {
    whereClause += tenantId === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?1)';
    params.push(tenantId);
  }

  if (locationId) {
    whereClause += ' AND location_id = ?';
    params.push(locationId);
  }
  if (date) {
    whereClause += " AND date(created_at, '+7 hours') = ?";
    params.push(date === 'today' ? vnToday : date);
  }
  if (dateFrom) {
    whereClause += " AND date(created_at, '+7 hours') >= ?";
    params.push(dateFrom === 'today' ? vnToday : dateFrom);
  }
  if (dateTo) {
    whereClause += " AND date(created_at, '+7 hours') <= ?";
    params.push(dateTo === 'today' ? vnToday : dateTo);
  }

  const [totalResult, revenueResult, statusResult, paymentResult] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as total FROM orders ${whereClause}`).bind(...params).first(),
    (async () => {
      const nonRevenueFilterWithPayment =
        "AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'failed', 'rejected', 'expired') AND LOWER(COALESCE(status, '')) != 'canceled' AND LOWER(COALESCE(status, '')) != 'refunded' AND LOWER(COALESCE(payment_status, '')) != 'refunded'";
      const nonRevenueFilter =
        "AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'failed', 'rejected', 'expired') AND LOWER(COALESCE(status, '')) != 'canceled' AND LOWER(COALESCE(status, '')) != 'refunded'";
      try {
        const res = await db
          .prepare(
            `SELECT SUM(COALESCE(total_amount, total)) as revenue, COUNT(*) as valid_orders FROM orders ${whereClause} ${nonRevenueFilterWithPayment}`
          )
          .bind(...params)
          .first();
        if (res && typeof res === 'object' && 'revenue' in res) return res;
      } catch {
        // Fallback when payment_status or total_amount column is absent
      }
      try {
        const res = await db
          .prepare(
            `SELECT SUM(total) as revenue, COUNT(*) as valid_orders FROM orders ${whereClause} ${nonRevenueFilterWithPayment}`
          )
          .bind(...params)
          .first();
        if (res && typeof res === 'object' && 'revenue' in res) return res;
      } catch {
        // Fallback when payment_status column is absent
      }
      try {
        const res = await db
          .prepare(
            `SELECT SUM(COALESCE(total_amount, total)) as revenue, COUNT(*) as valid_orders FROM orders ${whereClause} ${nonRevenueFilter}`
          )
          .bind(...params)
          .first();
        if (res && typeof res === 'object' && 'revenue' in res) return res;
      } catch {
        // Fallback when total_amount column is absent
      }
      try {
        const res = await db
          .prepare(
            `SELECT SUM(total) as revenue, COUNT(*) as valid_orders FROM orders ${whereClause} ${nonRevenueFilter}`
          )
          .bind(...params)
          .first();
        if (res && typeof res === 'object' && 'revenue' in res) return res;
      } catch {
        // Fallback to legacy status filter
      }
      try {
        return await db
          .prepare(`SELECT SUM(COALESCE(total_amount, total)) as revenue FROM orders ${whereClause} AND status NOT IN ('cancelled', 'canceled', 'refunded')`)
          .bind(...params)
          .first();
      } catch {
        return await db
          .prepare(`SELECT SUM(total) as revenue FROM orders ${whereClause} AND status NOT IN ('cancelled', 'canceled', 'refunded')`)
          .bind(...params)
          .first();
      }
    })(),
    db.prepare(`SELECT status, COUNT(*) as count FROM orders ${whereClause} GROUP BY status`).bind(...params).all(),
    (async () => {
      try {
        return await db.prepare(`SELECT source, COUNT(*) as count FROM orders ${whereClause} GROUP BY source`).bind(...params).all();
      } catch {
        return await db.prepare(`SELECT COALESCE(order_type, 'dine_in') as source, COUNT(*) as count FROM orders ${whereClause} GROUP BY COALESCE(order_type, 'dine_in')`).bind(...params).all();
      }
    })(),
  ]);

  const totalRow = totalResult as any;
  const revRow = revenueResult as any;
  const statRows = (statusResult as any)?.results || [];
  const payRows = (paymentResult as any)?.results || [];

  const excludedStatuses = new Set(['cancelled', 'canceled', 'failed', 'rejected', 'expired', 'refunded']);
  let excludedOrderCount = 0;
  const statusCounts: Record<string, number> = {};
  statRows.forEach((row: any) => {
    const count = Number(row.count || 0);
    statusCounts[row.status] = count;
    if (excludedStatuses.has(String(row.status || '').trim().toLowerCase())) {
      excludedOrderCount += count;
    }
  });

  const paymentCounts: Record<string, number> = {};
  payRows.forEach((row: any) => { paymentCounts[row.source] = row.count; });

  const totalOrders = Number(totalRow?.total || 0);
  const totalRevenue = Number(revRow?.revenue || 0);
  const validOrderCount =
    typeof revRow?.valid_orders === 'number'
      ? Math.max(0, Number(revRow.valid_orders))
      : Math.max(0, totalOrders - excludedOrderCount);

  return c.json({
    success: true,
    data: {
      totalOrders,
      totalRevenue,
      averageOrderValue: validOrderCount > 0 ? Math.round(totalRevenue / validOrderCount) : 0,
      ordersByStatus: statusCounts,
      ordersByPaymentMethod: paymentCounts,
    },
  });
}
