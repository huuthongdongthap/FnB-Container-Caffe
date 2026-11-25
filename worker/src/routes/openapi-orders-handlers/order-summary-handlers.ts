import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { isHeldOutOfKds } from '@aura/domain-kitchen';
import { getDatabase } from '../../lib/db';
import { resolveOpenApiOrdersTenant, isAllowedOrderLocationForTenant } from './helpers';

export async function handleGetOrderSummary(c: Context<{ Bindings: Env }>) {
  const user = c.get('user');
  const allowedSummaryRoles = ['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier', 'kitchen', 'barista', 'chef'];
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
  const rawQuery = c.req.query();
  const validQuery = (c.req as unknown as { valid?: (target: string) => Record<string, string | undefined> }).valid
    ? (c.req as unknown as { valid: (target: string) => Record<string, string | undefined> }).valid('query')
    : null;
  const query = { ...rawQuery, ...(validQuery || {}) };
  const { locationId, date, dateFrom, dateTo } = query;
  const orderTypeFilter = String(query.order_type || query.orderType || '').trim();
  const searchFilter = String(query.search || '').trim().toLowerCase();

  if (locationId && !(await isAllowedOrderLocationForTenant(db, locationId, tenantId))) {
    return c.json({
      success: true,
      data: {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        ordersByStatus: {},
        kdsByStatus: {},
        heldOrdersCount: 0,
        ordersByPaymentMethod: {},
        avgLeadTimeMinutes: null,
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
  if (orderTypeFilter && ['dine_in', 'takeaway', 'delivery'].includes(orderTypeFilter)) {
    whereClause += ' AND order_type = ?';
    params.push(orderTypeFilter);
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
  if (searchFilter) {
    const escaped = `%${searchFilter.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    whereClause +=
      " AND (LOWER(id) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(customer_name, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(customer_phone, '')) LIKE ? ESCAPE '\\')";
    params.push(escaped, escaped, escaped);
  }

  const qrExcludeClause =
    "AND NOT (TRIM(COALESCE(notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(items, '')) = '[]')";

  const [totalResult, revenueResult, statusResult, paymentResult, leadTimeResult, activeRowsResult] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) as total FROM orders ${whereClause} ${qrExcludeClause}`)
      .bind(...params)
      .first()
      .catch(() => db.prepare(`SELECT COUNT(*) as total FROM orders ${whereClause}`).bind(...params).first()),
    (async () => {
      const nonRevenueFilterWithPayment =
        "AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'failed', 'rejected', 'expired') AND LOWER(COALESCE(status, '')) != 'canceled' AND LOWER(COALESCE(status, '')) != 'refunded' AND LOWER(TRIM(COALESCE(payment_status, ''))) IN ('paid', 'completed', 'partially_refunded')";
      const nonRevenueFilter =
        "AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'failed', 'rejected', 'expired') AND LOWER(COALESCE(status, '')) != 'canceled' AND LOWER(COALESCE(status, '')) != 'refunded'";
      const refundDeductionExpr =
        "COALESCE((SELECT SUM(CASE WHEN LOWER(COALESCE(p.refund_status, '')) IN ('partial', 'completed', 'refunded', 'partially_refunded') THEN COALESCE(p.refund_amount, 0) ELSE 0 END) FROM payments p WHERE p.order_id = orders.id), 0)";
      try {
        const res = await db
          .prepare(
            `SELECT SUM(MAX(0, COALESCE(total_amount, total) - ${refundDeductionExpr})) as revenue, COUNT(*) as valid_orders FROM orders ${whereClause} ${nonRevenueFilterWithPayment}`
          )
          .bind(...params)
          .first();
        if (res && typeof res === 'object' && 'revenue' in res) return res;
      } catch {
        // Fallback when payments/refund_amount or total_amount column is absent
      }
      try {
        const res = await db
          .prepare(
            `SELECT SUM(MAX(0, total - ${refundDeductionExpr})) as revenue, COUNT(*) as valid_orders FROM orders ${whereClause} ${nonRevenueFilterWithPayment}`
          )
          .bind(...params)
          .first();
        if (res && typeof res === 'object' && 'revenue' in res) return res;
      } catch {
        // Fallback when payments table is absent
      }
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
    db
      .prepare(`SELECT status, COUNT(*) as count FROM orders ${whereClause} ${qrExcludeClause} GROUP BY status`)
      .bind(...params)
      .all()
      .catch(() => db.prepare(`SELECT status, COUNT(*) as count FROM orders ${whereClause} GROUP BY status`).bind(...params).all()),
    (async () => {
      try {
        return await db
          .prepare(
            `SELECT LOWER(COALESCE(NULLIF(TRIM(payment_method), ''), 'unknown')) as method, COUNT(*) as count
             FROM orders ${whereClause} ${qrExcludeClause}
             GROUP BY LOWER(COALESCE(NULLIF(TRIM(payment_method), ''), 'unknown'))`,
          )
          .bind(...params)
          .all();
      } catch {
        try {
          return await db
            .prepare(
              `SELECT LOWER(COALESCE(NULLIF(TRIM(payment_method), ''), 'unknown')) as method, COUNT(*) as count
               FROM orders ${whereClause}
               GROUP BY LOWER(COALESCE(NULLIF(TRIM(payment_method), ''), 'unknown'))`,
            )
            .bind(...params)
            .all();
        } catch {
          return await db
            .prepare(`SELECT COALESCE(order_type, 'dine_in') as method, COUNT(*) as count FROM orders ${whereClause} GROUP BY COALESCE(order_type, 'dine_in')`)
            .bind(...params)
            .all();
        }
      }
    })(),
    (async () => {
      try {
        const kdsLead = await db
          .prepare(
            `SELECT AVG((julianday(ready_at) - julianday(COALESCE(started_at, created_at))) * 1440.0) as avg_lead_time_minutes
             FROM orders ${whereClause}
             AND status IN ('ready', 'served', 'delivering', 'delivered', 'completed')
             AND ready_at IS NOT NULL
             AND COALESCE(started_at, created_at) IS NOT NULL
             AND (julianday(ready_at) - julianday(COALESCE(started_at, created_at))) BETWEEN 0 AND 1`,
          )
          .bind(...params)
          .first<{ avg_lead_time_minutes?: number | null }>();
        if (kdsLead?.avg_lead_time_minutes !== null && kdsLead?.avg_lead_time_minutes !== undefined) {
          return kdsLead;
        }
      } catch {
        // ready_at/started_at absent in partial schemas
      }
      try {
        return await db
          .prepare(
            `SELECT AVG((julianday(updated_at) - julianday(created_at)) * 1440.0) as avg_lead_time_minutes
             FROM orders ${whereClause}
             AND status = 'completed'
             AND updated_at IS NOT NULL
             AND created_at IS NOT NULL
             AND (julianday(updated_at) - julianday(created_at)) BETWEEN 0 AND 1`,
          )
          .bind(...params)
          .first();
      } catch {
        return null;
      }
    })(),
    (async () => {
      try {
        return await db
          .prepare(
            `SELECT status, payment_method, payment_status, order_type, is_cod, notes, items, created_at
             FROM orders ${whereClause}
             AND status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivering')`,
          )
          .bind(...params)
          .all<Record<string, unknown>>();
      } catch {
        try {
          return await db
            .prepare(
              `SELECT status, payment_method, payment_status, order_type, notes, items
               FROM orders ${whereClause}
               AND status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivering')`,
            )
            .bind(...params)
            .all<Record<string, unknown>>();
        } catch {
          return null;
        }
      }
    })(),
  ]);

  const totalRow = totalResult as Record<string, unknown> | null;
  const revRow = revenueResult as Record<string, unknown> | null;
  const statRows = ((statusResult as { results?: Array<Record<string, unknown>> } | null)?.results) || [];
  const payRows = ((paymentResult as { results?: Array<Record<string, unknown>> } | null)?.results) || [];

  const excludedStatuses = new Set(['cancelled', 'canceled', 'failed', 'rejected', 'expired', 'refunded']);
  let excludedOrderCount = 0;
  const statusCounts: Record<string, number> = {};
  statRows.forEach((row) => {
    const count = Number(row.count || 0);
    const key = String(row.status || '');
    statusCounts[key] = count;
    if (excludedStatuses.has(key.trim().toLowerCase())) {
      excludedOrderCount += count;
    }
  });

  let heldOrdersCount = 0;
  const kdsByStatus: Record<string, number> = {};
  const activeRows = activeRowsResult?.results;
  if (Array.isArray(activeRows)) {
    const nowMs = Date.now();
    const maxShiftWindowMs = 24 * 3600_000;
    for (const r of activeRows) {
      const rawNotes = typeof r.notes === 'string' ? r.notes.trim() : '';
      const rawItems = typeof r.items === 'string' ? r.items.trim() : '';
      if ((rawNotes === 'Khách QR - cho don mon' || rawNotes.startsWith('Khách QR - cho don mon |')) && (!rawItems || rawItems === '[]')) {
        continue;
      }
      if (isHeldOutOfKds(r)) {
        heldOrdersCount += 1;
        continue;
      }
      if (typeof r.created_at === 'string' && r.created_at.trim()) {
        const trimmed = r.created_at.trim();
        const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed) ? trimmed.replace(' ', 'T') : `${trimmed.replace(' ', 'T')}Z`;
        const createdMs = Date.parse(iso);
        if (Number.isFinite(createdMs) && nowMs - createdMs > maxShiftWindowMs) {
          continue;
        }
      }
      const st = String(r.status || '').trim().toLowerCase();
      if (st) {
        kdsByStatus[st] = (kdsByStatus[st] || 0) + 1;
      }
    }
  } else {
    for (const [k, v] of Object.entries(statusCounts)) {
      if (!excludedStatuses.has(k.toLowerCase()) && k.toLowerCase() !== 'completed' && k.toLowerCase() !== 'served' && k.toLowerCase() !== 'delivered') {
        kdsByStatus[k] = v;
      }
    }
  }

  const paymentCounts: Record<string, number> = {};
  payRows.forEach((row) => {
    const key = String(row.method ?? row.source ?? 'unknown');
    paymentCounts[key] = Number(row.count || 0);
  });

  const totalOrders = Number(totalRow?.total || 0);
  const totalRevenue = Number(revRow?.revenue || 0);
  const validOrderCount =
    typeof revRow?.valid_orders === 'number'
      ? Math.max(0, Number(revRow.valid_orders))
      : Math.max(0, totalOrders - excludedOrderCount);

  const rawAvgLeadTime = (leadTimeResult as Record<string, unknown> | null)?.avg_lead_time_minutes;
  const avgLeadTimeMinutes =
    rawAvgLeadTime !== null &&
    rawAvgLeadTime !== undefined &&
    Number.isFinite(Number(rawAvgLeadTime))
      ? Math.max(0, Math.round(Number(rawAvgLeadTime)))
      : null;

  return c.json({
    success: true,
    data: {
      totalOrders,
      totalRevenue,
      averageOrderValue: validOrderCount > 0 ? Math.round(totalRevenue / validOrderCount) : 0,
      ordersByStatus: statusCounts,
      kdsByStatus,
      heldOrdersCount,
      ordersByPaymentMethod: paymentCounts,
      avgLeadTimeMinutes,
    },
  });
}
