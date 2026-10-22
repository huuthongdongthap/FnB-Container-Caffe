import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { getDatabase } from '../../lib/db';
import { getTenantId } from '../../middleware/tenant';

export async function handleGetOrderSummary(c: Context<{ Bindings: Env }>) {
  const db = getDatabase(c);
  const query = ((c.req as any).valid ? (c.req as any).valid('query') : null) || c.req.query();
  const { locationId, dateFrom, dateTo } = query;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];
  const tenantId = getTenantId(c);
  if (tenantId !== '*') { whereClause += ' AND tenant_id = ?'; params.push(tenantId); }

  if (locationId) {
    whereClause += ' AND location_id = ?';
    params.push(locationId);
  }
  if (dateFrom) {
    whereClause += ' AND date(created_at) >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ' AND date(created_at) <= ?';
    params.push(dateTo);
  }

  const [totalResult, revenueResult, statusResult, paymentResult] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as total FROM orders ${whereClause}`).bind(...params).first(),
    (async () => {
      try {
        return await db.prepare(`SELECT SUM(COALESCE(total_amount, total)) as revenue FROM orders ${whereClause} AND status != 'cancelled'`).bind(...params).first();
      } catch {
        return await db.prepare(`SELECT SUM(total) as revenue FROM orders ${whereClause} AND status != 'cancelled'`).bind(...params).first();
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

  const statusCounts: Record<string, number> = {};
  statRows.forEach((row: any) => { statusCounts[row.status] = row.count; });

  const paymentCounts: Record<string, number> = {};
  payRows.forEach((row: any) => { paymentCounts[row.source] = row.count; });

  return c.json({
    success: true,
    data: {
      totalOrders: totalRow?.total || 0,
      totalRevenue: revRow?.revenue || 0,
      averageOrderValue: totalRow?.total ? Math.round((revRow?.revenue || 0) / totalRow.total) : 0,
      ordersByStatus: statusCounts,
      ordersByPaymentMethod: paymentCounts,
    },
  });
}
