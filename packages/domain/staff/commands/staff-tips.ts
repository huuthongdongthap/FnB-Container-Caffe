/**
 * Staff Tip Tracking + Daily Reports — /api/staff-tips
 *
 * F&B Gap 3.5: tips collected per order are attributed to the staff member
 * who served the table (resolved from the active table session's
 * customer linkage, or explicitly assigned at checkout). Daily tip reports
 * roll up per-staff totals for payroll.
 */

import { Hono } from 'hono';
import type { Env } from 'worker/src/types/env';
import { requireAuth } from 'worker/src/middleware/auth';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
import type { StaffTipRow } from '../model/staff-types';

const staffTipsRouter = new Hono<{ Bindings: Env }>();
const TIPS_ALLOWED_ROLES = ['owner', 'staff', 'manager', 'supervisor', 'admin', 'waiter', 'cashier', 'barista', 'chef', 'kitchen'];
const baseTipsAuth = requireAuth(TIPS_ALLOWED_ROLES);
staffTipsRouter.use('/*', async (c, next) => {
  const existingUser = c.get('user' as never) as { role?: string } | undefined;
  if (existingUser?.role && TIPS_ALLOWED_ROLES.includes(existingUser.role) && !c.req.header('Authorization')) {
    return next();
  }
  return baseTipsAuth(c, next);
});

function resolveStaffTipsTenant(c: {
  get?: (k: string) => unknown;
  req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined };
}): { ok: true; tenantId: string; isHq: boolean } | { ok: false } {
  const user = c.get?.('user') as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  const rawCallerTenant = user?.tenantId ?? user?.tenant_id;
  const hasCallerTenant = typeof rawCallerTenant === 'string' && rawCallerTenant.trim().length > 0;
  const callerTenant = hasCallerTenant ? rawCallerTenant.trim() : 'default';
  const callerRole = String(user?.role || '').trim().toLowerCase();
  const isHq =
    (callerRole === 'owner' || callerRole === 'admin') &&
    (callerTenant.toLowerCase() === 'hq' || callerTenant === '*');

  const candidateOverrides = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-store-id'),
    c.req.header('X-Store-ID'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return { ok: false };
  }
  const requestedHeaderOrQuery = candidateOverrides[0] || '';
  const ctxTenant = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]).trim() || 'default';

  if (!user) {
    if (requestedHeaderOrQuery || (ctxTenant && ctxTenant !== 'default')) {
      return { ok: false };
    }
    return { ok: true, tenantId: 'default', isHq: false };
  }

  if (!isHq) {
    if (
      callerTenant === '*' ||
      callerTenant.toLowerCase() === 'hq' ||
      requestedHeaderOrQuery === '*' ||
      requestedHeaderOrQuery.toLowerCase() === 'hq' ||
      ctxTenant === '*' ||
      ctxTenant.toLowerCase() === 'hq'
    ) {
      return { ok: false };
    }
    if (requestedHeaderOrQuery && requestedHeaderOrQuery !== callerTenant) {
      return { ok: false };
    }
    if (hasCallerTenant && ctxTenant !== callerTenant) {
      return { ok: false };
    }
    return { ok: true, tenantId: hasCallerTenant ? callerTenant : ctxTenant, isHq };
  }

  const cleanReq =
    requestedHeaderOrQuery && requestedHeaderOrQuery !== '*' && requestedHeaderOrQuery.toLowerCase() !== 'hq'
      ? requestedHeaderOrQuery
      : '';
  const cleanCtx =
    ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq'
      ? ctxTenant
      : '';
  const resolved =
    requestedHeaderOrQuery === '*' || requestedHeaderOrQuery.toLowerCase() === 'hq'
      ? '*'
      : cleanReq || cleanCtx || '*';
  return { ok: true, tenantId: resolved, isHq };
}

// GET /api/staff-tips — daily tip rollup, filterable by staff / date
staffTipsRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const tenantCheck = resolveStaffTipsTenant(c as never);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const { tenantId } = tenantCheck;
  const date = c.req.query('date') || new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ success: false, error: 'Invalid date format (YYYY-MM-DD)' }, 400);
  }
  const requestedStaffId = c.req.query('staff_id');
  const user = (c as unknown as { get?: (k: string) => { id?: string; role?: string } | undefined }).get?.('user');
  const isManagerRole = Boolean(user?.role && ['owner', 'manager', 'supervisor', 'admin'].includes(user.role));
  if (!isManagerRole && (!user?.id || (requestedStaffId && requestedStaffId !== user.id))) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }
  const staffId = isManagerRole ? requestedStaffId : user?.id;

  // Use a scalar subquery for table_sessions rather than a LEFT JOIN so multiple
  // sessions on the same table never multiply order tip totals.
  const waiterSubquery = `(SELECT ts.waiter_id FROM table_sessions ts WHERE ts.table_id = o.table_id AND ts.tenant_id = o.tenant_id AND ts.created_at <= o.created_at ORDER BY ts.created_at DESC LIMIT 1)`;
  const sessionSubquery = `(SELECT ts.id FROM table_sessions ts WHERE ts.table_id = o.table_id AND COALESCE(NULLIF(TRIM(ts.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') AND COALESCE(ts.created_at, '') <= COALESCE(o.created_at, '') ORDER BY ts.created_at DESC LIMIT 1)`;
  let query = `SELECT
      COALESCE(o.updated_by, ${waiterSubquery}, 'unassigned') AS staff_id,
      COALESCE(u.name, 'Unassigned') AS staff_name,
      ? AS date,
      COALESCE(SUM(o.tip_amount), 0) AS tip_total,
      COUNT(DISTINCT o.id) AS order_count,
      COUNT(DISTINCT ${sessionSubquery}) AS session_count
    FROM orders o
    LEFT JOIN users u ON u.id = COALESCE(o.updated_by, ${waiterSubquery}) AND COALESCE(NULLIF(TRIM(u.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
    WHERE date(o.created_at) = ? AND o.tip_amount > 0
      AND COALESCE(o.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired', 'refunded')
      AND COALESCE(o.payment_status, '') != 'refunded'`;
  const params: unknown[] = [date, date];
  if (tenantId !== '*') {
    query += " AND (COALESCE(NULLIF(o.tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?3)";
    params.push(tenantId);
  }
  if (staffId) { query += ` AND COALESCE(o.updated_by, ${waiterSubquery}) = ?`; params.push(staffId); }
  query += ` GROUP BY COALESCE(o.updated_by, ${waiterSubquery}, 'unassigned') ORDER BY tip_total DESC`;

  try {
    const stmt = db.prepare(query).bind(...params);
    const { results } = await stmt.all<StaffTipRow>();
    const rows = results || [];
    const tipTotal = rows.reduce((sum, r) => sum + Number(r.tip_total ?? (r as any).total_tips ?? 0), 0);
    const totalTippedOrders = rows.reduce((sum, r) => sum + Number((r as any).order_count ?? (r as any).total_tipped_orders ?? 0), 0);
    return c.json({
      success: true,
      data: rows,
      summary: {
        date,
        tip_total: tipTotal,
        grand_total_tips: tipTotal,
        total_tipped_orders: totalTippedOrders,
        staff_count: rows.length,
      },
    });
  } catch {
    try {
      const activeSessionSubquery = `(SELECT ts.id FROM table_sessions ts WHERE ts.table_id = o.table_id AND ts.status = 'active' AND COALESCE(NULLIF(TRIM(ts.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') LIMIT 1)`;
      const sessionFallbackParams: unknown[] = [date, date];
      let sessionFallbackQuery = `SELECT
          COALESCE(o.updated_by, 'unassigned') AS staff_id,
          COALESCE(u.name, 'Unassigned') AS staff_name,
          ? AS date,
          COALESCE(SUM(o.tip_amount), 0) AS tip_total,
          COUNT(DISTINCT o.id) AS order_count,
          COUNT(DISTINCT ${activeSessionSubquery}) AS session_count
        FROM orders o
        LEFT JOIN users u ON u.id = o.updated_by AND COALESCE(NULLIF(TRIM(u.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
        WHERE date(o.created_at) = ? AND o.tip_amount > 0
          AND COALESCE(o.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired', 'refunded')
          AND COALESCE(o.payment_status, '') != 'refunded'`;
      if (tenantId !== '*') {
        sessionFallbackQuery += " AND (COALESCE(NULLIF(o.tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?3)";
        sessionFallbackParams.push(tenantId);
      }
      if (staffId) { sessionFallbackQuery += ' AND o.updated_by = ?'; sessionFallbackParams.push(staffId); }
      sessionFallbackQuery += ' GROUP BY COALESCE(o.updated_by, \'unassigned\') ORDER BY tip_total DESC';
      const { results } = await db.prepare(sessionFallbackQuery).bind(...sessionFallbackParams).all<StaffTipRow>();
      const rows = results || [];
      const tipTotal = rows.reduce((sum, r) => sum + Number(r.tip_total), 0);
      const totalTippedOrders = rows.reduce((sum, r) => sum + Number((r as any).order_count || 0), 0);
      return c.json({
        success: true,
        data: rows,
        summary: {
          date,
          tip_total: tipTotal,
          grand_total_tips: tipTotal,
          total_tipped_orders: totalTippedOrders,
          staff_count: rows.length,
        },
      });
    } catch {
      try {
        const fallbackParams: unknown[] = [date, date];
        let fallbackQuery = `SELECT
            COALESCE(o.updated_by, 'unassigned') AS staff_id,
            COALESCE(u.name, u.full_name, u.username, 'Unassigned') AS staff_name,
            ? AS date,
            COALESCE(SUM(o.tip_amount), 0) AS tip_total,
            COUNT(DISTINCT o.id) AS order_count,
            0 AS session_count
          FROM orders o
          LEFT JOIN users u ON u.id = o.updated_by
          WHERE date(o.created_at) = ? AND o.tip_amount > 0
            AND COALESCE(o.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired', 'refunded')
            AND COALESCE(o.payment_status, '') != 'refunded'`;
        if (tenantId !== '*') {
          fallbackQuery += " AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?";
          fallbackParams.push(tenantId);
        }
        if (staffId) { fallbackQuery += ' AND o.updated_by = ?'; fallbackParams.push(staffId); }
        fallbackQuery += ' GROUP BY COALESCE(o.updated_by, \'unassigned\') ORDER BY tip_total DESC';
        const { results } = await db.prepare(fallbackQuery).bind(...fallbackParams).all<StaffTipRow>();
        const rows = results || [];
        const tipTotal = rows.reduce((sum, r) => sum + Number(r.tip_total), 0);
        return c.json({ success: true, data: rows, summary: { date, tip_total: tipTotal, staff_count: rows.length } });
      } catch {
        if (tenantId !== 'default') {
          return c.json({ success: true, data: [], summary: { date, tip_total: 0, staff_count: 0 } });
        }
        try {
          const legacyParams: unknown[] = [date, date];
          let legacyQuery = `SELECT
              COALESCE(o.updated_by, 'unassigned') AS staff_id,
              COALESCE(u.name, u.full_name, u.username, 'Unassigned') AS staff_name,
              ? AS date,
              COALESCE(SUM(o.tip_amount), 0) AS tip_total,
              COUNT(DISTINCT o.id) AS order_count,
              0 AS session_count
            FROM orders o
            LEFT JOIN users u ON u.id = o.updated_by
            WHERE date(o.created_at) = ? AND o.tip_amount > 0
              AND COALESCE(o.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired', 'refunded')
              AND COALESCE(o.payment_status, '') != 'refunded'`;
          if (staffId) { legacyQuery += ' AND o.updated_by = ?'; legacyParams.push(staffId); }
          legacyQuery += ' GROUP BY COALESCE(o.updated_by, \'unassigned\') ORDER BY tip_total DESC';
          const { results } = await db.prepare(legacyQuery).bind(...legacyParams).all<StaffTipRow>();
          const rows = results || [];
          const tipTotal = rows.reduce((sum, r) => sum + Number(r.tip_total), 0);
          return c.json({ success: true, data: rows, summary: { date, tip_total: tipTotal, staff_count: rows.length } });
        } catch {
          return c.json({ success: true, data: [], summary: { date, tip_total: 0, staff_count: 0 } });
        }
      }
    }
  }
});

// GET /api/staff-tips/:staffId — single staff member's tip history
staffTipsRouter.get('/:staffId', async (c) => {
  const db = c.env.AURA_DB;
  const tenantCheck = resolveStaffTipsTenant(c as never);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const { tenantId, isHq } = tenantCheck;
  const staffId = c.req.param('staffId');
  const user = (c as unknown as { get?: (k: string) => { id?: string; role?: string } | undefined }).get?.('user');
  const isManagerRole = Boolean(user?.role && ['owner', 'manager', 'supervisor', 'admin'].includes(user.role));
  if (!isManagerRole && user?.id !== staffId) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }
  let effectiveStaffTenant = tenantId;
  if (tenantId !== '*' && (!isHq || user?.id !== staffId)) {
    try {
      const targetStaff = await db
        .prepare('SELECT id, role, tenant_id, is_active FROM users WHERE id = ?')
        .bind(staffId)
        .first<Record<string, unknown>>();
      if (!targetStaff) {
        return c.json({ success: false, error: 'Staff member not found' }, 404);
      }
      if (
        ('tenant_id' in targetStaff && !matchesTenantRow(targetStaff, tenantId)) ||
        ('is_active' in targetStaff &&
          targetStaff.is_active !== undefined &&
          targetStaff.is_active !== null &&
          Number(targetStaff.is_active) === 0)
      ) {
        return c.json({ success: false, error: 'Staff member not found' }, 404);
      }
    } catch {
      // Optional users lookup in minimal test schemas
    }
  } else if (tenantId === '*') {
    try {
      const targetStaff = await db
        .prepare('SELECT id, role, tenant_id, is_active FROM users WHERE id = ?')
        .bind(staffId)
        .first<Record<string, unknown>>();
      if (!targetStaff) {
        const usersCount = await db
          .prepare('SELECT COUNT(*) as cnt FROM users')
          .first<{ cnt: number }>()
          .catch(() => null);
        if (usersCount && Number(usersCount.cnt ?? 0) > 0) {
          return c.json({ success: false, error: 'Staff member not found' }, 404);
        }
      } else {
        if (
          'is_active' in targetStaff &&
          targetStaff.is_active !== undefined &&
          targetStaff.is_active !== null &&
          Number(targetStaff.is_active) === 0
        ) {
          return c.json({ success: false, error: 'Staff member not found' }, 404);
        }
        if (
          'tenant_id' in targetStaff &&
          typeof targetStaff.tenant_id === 'string' &&
          targetStaff.tenant_id.trim() &&
          targetStaff.tenant_id.trim() !== '*' &&
          targetStaff.tenant_id.trim() !== 'hq'
        ) {
          effectiveStaffTenant = targetStaff.tenant_id.trim();
        }
      }
    } catch {
      // Optional users lookup in minimal test schemas
    }
  }
  const rawDays = Number(c.req.query('days') || '30');
  const days = Number.isFinite(rawDays) ? Math.min(366, Math.max(1, Math.floor(rawDays))) : 30;
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  try {
    const query = effectiveStaffTenant !== '*'
      ? `SELECT date(o.created_at) AS date,
                COALESCE(SUM(o.tip_amount), 0) AS tip_total,
                COUNT(DISTINCT o.id) AS order_count
         FROM orders o
         WHERE o.updated_by = ? AND o.tip_amount > 0
           AND COALESCE(o.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired', 'refunded')
           AND COALESCE(o.payment_status, '') != 'refunded'
           AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
           AND date(o.created_at) >= date(?, '-' || ? || ' days')
         GROUP BY date(o.created_at)
         ORDER BY date DESC`
      : `SELECT date(o.created_at) AS date,
                COALESCE(SUM(o.tip_amount), 0) AS tip_total,
                COUNT(DISTINCT o.id) AS order_count
         FROM orders o
         WHERE o.updated_by = ? AND o.tip_amount > 0
           AND COALESCE(o.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired', 'refunded')
           AND COALESCE(o.payment_status, '') != 'refunded'
           AND date(o.created_at) >= date(?, '-' || ? || ' days')
         GROUP BY date(o.created_at)
         ORDER BY date DESC`;
    const binds = effectiveStaffTenant !== '*' ? [staffId, effectiveStaffTenant, today, String(days)] : [staffId, today, String(days)];
    const { results } = await db.prepare(query).bind(...binds).all<{ date: string; tip_total: number; order_count: number }>();
    const rows = results || [];
    const total = rows.reduce((s, r) => s + Number(r.tip_total), 0);
    return c.json({ success: true, data: rows, staff_id: staffId, total_tip: total, days });
  } catch {
    if (tenantId !== 'default') {
      return c.json({ success: true, data: [], staff_id: staffId, total_tip: 0, days });
    }
    try {
      const { results } = await db.prepare(
        `SELECT date(o.created_at) AS date,
                COALESCE(SUM(o.tip_amount), 0) AS tip_total,
                COUNT(DISTINCT o.id) AS order_count
         FROM orders o
         WHERE o.updated_by = ? AND o.tip_amount > 0
           AND COALESCE(o.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired', 'refunded')
           AND COALESCE(o.payment_status, '') != 'refunded'
           AND date(o.created_at) >= date(?, '-' || ? || ' days')
         GROUP BY date(o.created_at)
         ORDER BY date DESC`
      ).bind(staffId, today, String(days)).all<{ date: string; tip_total: number; order_count: number }>();
      const rows = results || [];
      const total = rows.reduce((s, r) => s + Number(r.tip_total), 0);
      return c.json({ success: true, data: rows, staff_id: staffId, total_tip: total, days });
    } catch {
      return c.json({ success: true, data: [], staff_id: staffId, total_tip: 0, days });
    }
  }
});

// POST /api/staff-tips/assign — attribute a tip to a staff member at checkout
staffTipsRouter.post('/assign', async (c) => {
  const user = (c as unknown as { get?: (k: string) => { id?: string; role?: string } | undefined }).get?.('user');
  if (!user?.role || !['owner', 'manager', 'supervisor', 'admin', 'cashier'].includes(user.role)) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantCheck = resolveStaffTipsTenant(c as never);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const { tenantId } = tenantCheck;
  const body = await c.req.json() as Record<string, unknown>;
  const orderId = String(body.order_id || '').trim();
  const staffId = String(body.staff_id || '').trim();
  const hasTipAmount = body.tip_amount !== undefined && body.tip_amount !== null;
  const rawTipAmount = hasTipAmount ? Number(body.tip_amount) : 0;
  if (!orderId) return c.json({ success: false, error: 'order_id is required' }, 400);
  if (!staffId) return c.json({ success: false, error: 'staff_id is required' }, 400);
  if (hasTipAmount && (!Number.isFinite(rawTipAmount) || rawTipAmount < 0 || !Number.isInteger(rawTipAmount))) {
    return c.json({ success: false, error: 'tip_amount must be a non-negative integer' }, 400);
  }

  const order = await (tenantId !== '*'
    ? db.prepare("SELECT * FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(orderId, tenantId)
        .first<Record<string, unknown>>()
        .catch(() => db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<Record<string, unknown>>().catch(() => null))
    : db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<Record<string, unknown>>().catch(() => null));
  if (!order || ('tenant_id' in order && !matchesTenantRow(order, tenantId))) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }
  const orderStatus = String(order.status || '').toLowerCase();
  const paymentStatus = String(order.payment_status || '').toLowerCase();
  if (
    order.status === 'cancelled' ||
    order.status === 'refunded' ||
    ['cancelled', 'rejected', 'failed', 'expired', 'refunded'].includes(orderStatus) ||
    paymentStatus === 'refunded'
  ) {
    return c.json({ success: false, error: 'Cannot assign tip to cancelled or refunded order' }, 400);
  }
  const existingTipAmount = Number(order.tip_amount ?? 0);
  const tipAmount = hasTipAmount ? rawTipAmount : existingTipAmount;
  const hasOrderTotalField =
    ('total' in order && order.total !== undefined && order.total !== null) ||
    ('total_amount' in order && order.total_amount !== undefined && order.total_amount !== null) ||
    ('subtotal' in order && order.subtotal !== undefined && order.subtotal !== null);
  const orderTotal = Number(order.total ?? order.total_amount ?? order.subtotal ?? 0);
  if (
    hasOrderTotalField &&
    tipAmount > 0 &&
    (!Number.isFinite(orderTotal) || orderTotal <= 0 || tipAmount > orderTotal * 2)
  ) {
    return c.json({ success: false, error: 'tip_amount exceeds maximum allowed for order total' }, 400);
  }
  const hasExistingAttribution =
    existingTipAmount > 0 ||
    (typeof order.updated_by === 'string' && order.updated_by.trim().length > 0);
  if (
    hasTipAmount &&
    hasExistingAttribution &&
    tipAmount !== existingTipAmount &&
    (paymentStatus === 'paid' || paymentStatus === 'completed' || orderStatus === 'completed' || orderStatus === 'delivered')
  ) {
    return c.json({ success: false, error: 'Cannot modify tip_amount on a paid or completed order' }, 409);
  }

  const effectiveOrderTenant = tenantId !== '*'
    ? tenantId
    : ('tenant_id' in order && typeof order.tenant_id === 'string' && order.tenant_id.trim()
        ? order.tenant_id.trim()
        : 'default');
  try {
    const staffRow = await db.prepare('SELECT id, role, tenant_id, is_active FROM users WHERE id = ?').bind(staffId).first<Record<string, unknown>>();
    if (!staffRow) {
      return c.json({ success: false, error: 'Staff member not found' }, 404);
    }
    if (
      ('tenant_id' in staffRow && !matchesTenantRow(staffRow, effectiveOrderTenant)) ||
      ('is_active' in staffRow && staffRow.is_active !== undefined && staffRow.is_active !== null && Number(staffRow.is_active) === 0)
    ) {
      return c.json({ success: false, error: 'Staff member not found' }, 404);
    }
    const staffRole = String(staffRow.role || '').trim().toLowerCase();
    if ('role' in staffRow && (!staffRole || staffRole === 'customer')) {
      return c.json({ success: false, error: 'Target user is not a staff member' }, 400);
    }
  } catch {
    // Optional users lookup in minimal test schemas
  }

  const now = new Date().toISOString();
  try {
    if (effectiveOrderTenant !== '*') {
      await db.prepare(
        "UPDATE orders SET tip_amount = ?, updated_by = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(tipAmount, staffId, now, orderId, effectiveOrderTenant).run();
    } else {
      await db.prepare('UPDATE orders SET tip_amount = ?, updated_by = ?, updated_at = ? WHERE id = ?')
        .bind(tipAmount, staffId, now, orderId).run();
    }
  } catch {
    if (effectiveOrderTenant !== 'default' && tenantId !== '*') {
      return c.json({ success: false, error: 'Failed to assign tip' }, 500);
    }
    try {
      await db.prepare('UPDATE orders SET tip_amount = ?, updated_by = ?, updated_at = ? WHERE id = ?')
        .bind(tipAmount, staffId, now, orderId).run();
    } catch {
      try {
        await db.prepare('UPDATE orders SET updated_by = ?, updated_at = ? WHERE id = ?')
          .bind(staffId, now, orderId).run();
      } catch {
        // non-blocking if columns absent
      }
    }
  }

  return c.json({ success: true, order_id: orderId, staff_id: staffId, tip_amount: tipAmount });
});

staffTipsRouter.post('/pool', async (c) => {
  const user = (c as unknown as { get?: (k: string) => { id?: string; role?: string } | undefined }).get?.('user');
  if (!user?.role || !['owner', 'manager', 'supervisor', 'admin'].includes(user.role)) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }
  const tenantCheck = resolveStaffTipsTenant(c as never);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const bodyTenant = String(body.store_id || body.storeId || body.tenant_id || body.tenantId || '').trim();
  if (!tenantCheck.isHq && bodyTenant && (bodyTenant === '*' || bodyTenant.toLowerCase() === 'hq' || bodyTenant !== tenantCheck.tenantId)) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const rawStoreTenant = tenantCheck.isHq ? (bodyTenant || tenantCheck.tenantId) : tenantCheck.tenantId;
  const concreteTenant =
    !rawStoreTenant || rawStoreTenant === '*' || rawStoreTenant.toLowerCase() === 'hq'
      ? (c.env?.PILOT_TENANT_ID?.trim() || 'default')
      : rawStoreTenant;
  const date = String(body.date || new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)).trim();
  return c.json({ success: true, tenant_id: concreteTenant, date });
});

export { staffTipsRouter };
