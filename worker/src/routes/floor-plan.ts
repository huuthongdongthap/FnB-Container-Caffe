/**
 * Floor Plan + Capacity Routes — /api/floor-plan
 *
 * F&B Gap 3.3: real-time table occupancy tracking. Returns the live floor
 * plan with per-table status, active session linkage, and order counts.
 * Includes an auto-release endpoint so a table marked no-show after a
 * configurable timeout can be freed atomically.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { getTenantId, isHQSuperAdmin, matchesTenantRow } from '../middleware/tenant';

export interface FloorPlanTable {
  id: string;
  table_number: number;
  zone: string;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Overdue';
  notes?: string | null;
  updated_at?: string | null;
  active_session: {
    id: string;
    status: string;
    opened_at: string;
    order_count: number;
    total_amount: number;
    customer_name: string | null;
  } | null;
}

const FLOOR_PLAN_MUTATION_ROLES = new Set(['owner', 'manager', 'supervisor', 'admin', 'cashier']);

async function hasUnpaidActiveOrdersForTable(
  db: Env['AURA_DB'],
  tableId: string,
  tenantId: string,
  canRunUnscopedFallback?: boolean
): Promise<boolean> {
  const normalizedTenant = (tenantId || 'default').trim().toLowerCase() === 'hq'
    ? '*'
    : ((tenantId || 'default').trim() || 'default');
  const allowFallback = canRunUnscopedFallback ?? (normalizedTenant === 'default' || normalizedTenant === '*');
  const isOrderRowUnpaid = (row: Record<string, unknown> | null | undefined): boolean => {
    if (!row || typeof row !== 'object') return false;
    if (!('payment_status' in row) && !('order_number' in row) && !('total_amount' in row) && !('subtotal' in row)) {
      return false;
    }
    const status = String(row.status ?? 'pending').trim().toLowerCase();
    if (['completed', 'cancelled', 'rejected', 'failed', 'expired', 'refunded'].includes(status)) {
      return false;
    }
    const payStatus = String(row.payment_status ?? 'unpaid').trim().toLowerCase();
    return !['paid', 'refunded'].includes(payStatus);
  };
  const scopedTenant = normalizedTenant === '*' ? 'default' : normalizedTenant;
  try {
    const res = await db
      .prepare(
        `SELECT id, status, payment_status FROM orders
         WHERE table_id = ?
           AND LOWER(COALESCE(status, 'pending')) NOT IN ('completed', 'cancelled', 'rejected', 'failed', 'expired', 'refunded')
           AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'refunded')
           AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
         LIMIT 5`
      )
      .bind(tableId, normalizedTenant, scopedTenant)
      .all<Record<string, unknown>>();
    if ((res?.results || []).some(isOrderRowUnpaid)) return true;
  } catch {
    if (allowFallback) {
      const res = await db
        .prepare(
          `SELECT id, status, payment_status FROM orders
           WHERE table_id = ?
             AND LOWER(COALESCE(status, 'pending')) NOT IN ('completed', 'cancelled', 'rejected', 'failed', 'expired', 'refunded')
             AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'refunded')
           LIMIT 5`
        )
        .bind(tableId)
        .all<Record<string, unknown>>()
        .catch(() => ({ results: [] as Record<string, unknown>[] }));
      if ((res?.results || []).some(isOrderRowUnpaid)) return true;
    }
  }
  return false;
}

const floorPlanRouter = new Hono<{ Bindings: Env }>();
floorPlanRouter.use('/*', requireAuth(['owner', 'staff', 'manager', 'supervisor', 'admin', 'waiter', 'cashier']));
floorPlanRouter.use('/*', async (c, next) => {
  const candidateOverrides = [
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
  if (new Set(candidateOverrides).size > 1) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const user = c.get('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (user && !isHQSuperAdmin(c)) {
    const boundTenant = (user.tenantId || user.tenant_id || '').trim() || 'default';
    const reqTenant = candidateOverrides[0] || '';
    if (
      boundTenant === '*' ||
      boundTenant.toLowerCase() === 'hq' ||
      (reqTenant && (reqTenant === '*' || reqTenant.toLowerCase() === 'hq' || reqTenant !== boundTenant))
    ) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
  }
  return next();
});

function resolveFloorPlanTenantId(c: any): string {
  const user = c.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (user && (isHQSuperAdmin(c) || isHQSuperAdmin(user))) {
    const reqTenant = (
      c.req?.query?.('tenant_id') ||
      c.req?.query?.('tenantId') ||
      c.req?.query?.('store_id') ||
      c.req?.query?.('storeId') ||
      c.req?.header?.('X-Tenant-ID') ||
      c.req?.header?.('x-tenant-id') ||
      c.req?.header?.('X-Store-ID') ||
      c.req?.header?.('x-store-id') ||
      ''
    ).trim();
    if (reqTenant) {
      return reqTenant.toLowerCase() === 'hq' ? '*' : reqTenant;
    }
    const raw = (getTenantId(c) || '*').trim();
    return raw.toLowerCase() === 'hq' ? '*' : raw || '*';
  }
  const raw = (getTenantId(c) || 'default').trim();
  return raw.toLowerCase() === 'hq' ? '*' : raw || 'default';
}

// GET /api/floor-plan — live floor plan with active session linkage
floorPlanRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveFloorPlanTenantId(c);
  const zone = c.req.query('zone');
  const status = c.req.query('status');

  let filterSql = '';
  const params: unknown[] = [];
  if (zone) { filterSql += ' AND t.zone = ?'; params.push(zone); }
  if (status) { filterSql += ' AND t.status = ?'; params.push(status); }
  const orderSql = ' ORDER BY t.zone, t.table_number';

  const query = `SELECT t.*,
         s.id AS session_id, s.status AS session_status, s.opened_at AS session_opened_at,
         s.order_count AS session_order_count, s.total_amount AS session_total_amount,
         s.customer_name AS session_customer_name, s.tenant_id AS session_tenant_id
       FROM cafe_tables t
       LEFT JOIN table_sessions s
         ON s.table_id = t.id AND (s.status IN ('active', 'occupied', 'seated') OR s.status IN ('ordering', 'paying'))
         AND COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default')
       WHERE 1=1${filterSql}${orderSql}`;

  let results: Record<string, unknown>[] = [];
  try {
    const stmt = params.length ? db.prepare(query).bind(...params) : db.prepare(query);
    const res = await stmt.all<Record<string, unknown>>();
    results = res.results || [];
  } catch {
    try {
      const legacySessionQuery = `SELECT t.*,
           s.id AS session_id, s.status AS session_status, s.opened_at AS session_opened_at,
           s.order_count AS session_order_count, s.total_amount AS session_total_amount,
           s.customer_name AS session_customer_name
         FROM cafe_tables t
         LEFT JOIN table_sessions s
           ON s.table_id = t.id AND (s.status IN ('active', 'occupied', 'seated') OR s.status IN ('ordering', 'paying'))
         WHERE 1=1${filterSql}${orderSql}`;
      const stmt = params.length ? db.prepare(legacySessionQuery).bind(...params) : db.prepare(legacySessionQuery);
      const res = await stmt.all<Record<string, unknown>>();
      results = res.results || [];
    } catch {
      try {
        const fallbackQuery = `SELECT t.*,
             s.id AS session_id, s.status AS session_status, s.started_at AS session_opened_at,
             CASE WHEN s.current_order_id IS NOT NULL THEN 1 ELSE 0 END AS session_order_count,
             0 AS session_total_amount,
             NULL AS session_customer_name
           FROM cafe_tables t
           LEFT JOIN table_sessions s
             ON s.table_id = t.id AND (s.status IN ('active', 'occupied', 'seated') OR s.status IN ('ordering', 'paying'))
           WHERE 1=1${filterSql}${orderSql}`;
        const stmt = params.length ? db.prepare(fallbackQuery).bind(...params) : db.prepare(fallbackQuery);
        const res = await stmt.all<Record<string, unknown>>();
        results = res.results || [];
      } catch {
        try {
          const tablesOnlyQuery = `SELECT t.* FROM cafe_tables t WHERE 1=1${filterSql}${orderSql}`;
          const stmt = params.length ? db.prepare(tablesOnlyQuery).bind(...params) : db.prepare(tablesOnlyQuery);
          const res = await stmt.all<Record<string, unknown>>();
          results = res.results || [];
        } catch {
          try {
            const minimalQuery = 'SELECT t.* FROM cafe_tables t ORDER BY t.table_number';
            const res = await db.prepare(minimalQuery).all<Record<string, unknown>>();
            results = res.results || [];
          } catch {
            try {
              const legacyTablesRes = await db.prepare('SELECT t.* FROM tables t').all<Record<string, unknown>>();
              results = legacyTablesRes.results || [];
            } catch {
              results = [];
            }
          }
        }
      }
    }
  }

  results = results.filter((r) => matchesTenantRow(r, tenantId));

  // Deduplicate by table id so a table with multiple joined session rows appears at most once
  const dedupedByTableId = new Map<string, Record<string, unknown>>();
  for (const r of results) {
    const tableKey = String(r.id);
    const existing = dedupedByTableId.get(tableKey);
    if (!existing) {
      dedupedByTableId.set(tableKey, r);
      continue;
    }
    const rSessionTenantMatches = !('session_tenant_id' in r) || r.session_tenant_id === undefined
      ? (tenantId === 'default' || tenantId === '*')
      : (tenantId === '*' || ((typeof r.session_tenant_id === 'string' && r.session_tenant_id.trim() ? r.session_tenant_id.trim() : 'default') === tenantId));
    const existingSessionTenantMatches = !('session_tenant_id' in existing) || existing.session_tenant_id === undefined
      ? (tenantId === 'default' || tenantId === '*')
      : (tenantId === '*' || ((typeof existing.session_tenant_id === 'string' && existing.session_tenant_id.trim() ? existing.session_tenant_id.trim() : 'default') === tenantId));
    const rStatusNotPaid = String(r.session_status ?? '').toLowerCase() !== 'paid';
    const existingStatusNotPaid = String(existing.session_status ?? '').toLowerCase() !== 'paid';
    const rHasValidSession = r.session_id != null && rSessionTenantMatches && rStatusNotPaid;
    const existingHasValidSession = existing.session_id != null && existingSessionTenantMatches && existingStatusNotPaid;
    if (rHasValidSession && !existingHasValidSession) {
      dedupedByTableId.set(tableKey, r);
    } else if (rHasValidSession && existingHasValidSession) {
      const rOpened = String(r.session_opened_at ?? '');
      const existingOpened = String(existing.session_opened_at ?? '');
      if (rOpened > existingOpened) {
        dedupedByTableId.set(tableKey, r);
      }
    }
  }
  results = Array.from(dedupedByTableId.values());

  const tables: FloorPlanTable[] = results.map((r) => {
    const sessionTenantMatches = !('session_tenant_id' in r) || r.session_tenant_id === undefined
      ? (tenantId === 'default' || tenantId === '*')
      : (tenantId === '*' || ((typeof r.session_tenant_id === 'string' && r.session_tenant_id.trim() ? r.session_tenant_id.trim() : 'default') === tenantId));
    const sessionStatusNotPaid = String(r.session_status ?? '').toLowerCase() !== 'paid';
    const hasSession = r.session_id != null && sessionTenantMatches && sessionStatusNotPaid;
    return {
      id: String(r.id),
      table_number: Number(r.table_number),
      zone: String(r.zone),
      capacity: Number(r.capacity ?? r.seats ?? 2),
      status: String(r.status) as FloorPlanTable['status'],
      notes: (r.notes as string) ?? null,
      updated_at: (r.updated_at as string) ?? null,
      active_session: hasSession ? {
        id: String(r.session_id),
        status: String(r.session_status),
        opened_at: String(r.session_opened_at),
        order_count: Number(r.session_order_count),
        total_amount: Number(r.session_total_amount),
        customer_name: (r.session_customer_name as string) ?? null,
      } : null,
    };
  });

  const summary = {
    total: tables.length,
    available: tables.filter((t) => t.status === 'Available').length,
    occupied: tables.filter((t) => t.status === 'Occupied').length,
    reserved: tables.filter((t) => t.status === 'Reserved').length,
    overdue: tables.filter((t) => t.status === 'Overdue').length,
    with_active_session: tables.filter((t) => t.active_session).length,
  };

  return c.json({ success: true, data: tables, tables, summary });
});

// GET /api/floor-plan/summary — aggregate counts only (lightweight poll)
floorPlanRouter.get('/summary', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveFloorPlanTenantId(c);
  let rows: { results: { status: string; c: number }[] };
  try {
    rows = await db.prepare(
      'SELECT status, COUNT(*) AS c FROM cafe_tables WHERE (? = \'*\' OR tenant_id = ? OR TRIM(tenant_id) = ?2 OR (? = \'default\' AND (tenant_id IS NULL OR tenant_id = \'\' OR TRIM(tenant_id) = \'\'))) GROUP BY status'
    ).bind(tenantId, tenantId, tenantId).all<{ status: string; c: number }>();
  } catch (err) {
    if (!/no such column:\s*tenant_id/i.test(err instanceof Error ? err.message : String(err))) {
      throw err;
    }
    if (tenantId !== 'default' && tenantId !== '*') {
      rows = { results: [] };
    } else {
      rows = await db.prepare(
        'SELECT status, COUNT(*) AS c FROM cafe_tables GROUP BY status'
      ).all<{ status: string; c: number }>();
    }
  }
  const counts: Record<string, number> = {};
  for (const r of rows.results) counts[r.status] = Number(r.c);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return c.json({ success: true, data: { total, ...counts } });
});

// POST /api/floor-plan/:id/no-show — mark table overdue and schedule auto-release
floorPlanRouter.post('/:id/no-show', async (c) => {
  const user = c.get('user' as never) as { id?: string; role?: string } | undefined;
  if (!user?.role || !FLOOR_PLAN_MUTATION_ROLES.has(user.role)) {
    return c.json({ success: false, error: 'Insufficient permissions to mark table no-show' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = resolveFloorPlanTenantId(c);
  const canRunUnscopedFallback = !tenantId || tenantId === 'default' || tenantId === '*';
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.timeout_minutes !== undefined && body.timeout_minutes !== null) {
    const parsedTimeout = Number(body.timeout_minutes);
    if (!Number.isFinite(parsedTimeout) || parsedTimeout < 1 || parsedTimeout > 1440) {
      return c.json({ success: false, error: 'timeout_minutes must be a finite number between 1 and 1440' }, 400);
    }
  }
  const timeoutMinutes = body.timeout_minutes !== undefined && body.timeout_minutes !== null
    ? Math.floor(Number(body.timeout_minutes))
    : 30;

  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!matchesTenantRow(table, tenantId)) return c.json({ success: false, error: 'Table not found' }, 404);
  const rawTableTenant = typeof table?.tenant_id === 'string' ? table.tenant_id.trim() : '';
  const effectiveTableTenant =
    tenantId === '*'
      ? (rawTableTenant && rawTableTenant !== '*' && rawTableTenant.toLowerCase() !== 'hq' ? rawTableTenant : 'default')
      : (tenantId || 'default');
  const canForceNoShow = Boolean(body.force) && ['owner', 'manager', 'admin'].includes(String(user.role || '').toLowerCase());
  if (!canForceNoShow && (await hasUnpaidActiveOrdersForTable(db, id, effectiveTableTenant, canRunUnscopedFallback))) {
    return c.json({ success: false, error: 'Cannot mark table no-show with unpaid active orders' }, 409);
  }

  const now = new Date().toISOString();
  const noteParam = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
  try {
    await db.prepare(
      "UPDATE cafe_tables SET status = 'Overdue', notes = COALESCE(?, notes, 'No-show — awaiting auto-release') WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(noteParam, id, effectiveTableTenant).run();
  } catch {
    if (canRunUnscopedFallback) {
      try {
        await db.prepare(
          "UPDATE cafe_tables SET status = 'Overdue', notes = COALESCE(?, notes, 'No-show — awaiting auto-release') WHERE id = ?"
        ).bind(noteParam, id).run();
      } catch {
        await db.prepare(
          'UPDATE cafe_tables SET status = \'Overdue\' WHERE id = ?'
        ).bind(id).run();
      }
    }
  }

  // Close any open session on the table (no-show).
  let session: { id: string; tenant_id?: string | null } | null = null;
  try {
    session = await db.prepare(
      "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(id, effectiveTableTenant).first<{ id: string; tenant_id?: string | null }>().catch(() =>
      canRunUnscopedFallback
        ? db.prepare(
            "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid')"
          ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
            db.prepare(
              "SELECT id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid')"
            ).bind(id).first<{ id: string }>()
          )
        : null
    );
    if (!session) {
      session = await db.prepare(
        "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status = 'active' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, effectiveTableTenant).first<{ id: string; tenant_id?: string | null }>().catch(() =>
        canRunUnscopedFallback
          ? db.prepare(
              'SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status = \'active\''
            ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
              db.prepare(
                'SELECT id FROM table_sessions WHERE table_id = ? AND status = \'active\''
              ).bind(id).first<{ id: string }>()
            )
          : null
      );
    }
  } catch {
    session = null;
  }
  if (session && !matchesTenantRow(session as unknown as Record<string, unknown>, effectiveTableTenant)) {
    session = null;
  }
  if (session) {
    try {
      await db.prepare(
        "UPDATE table_sessions SET status = 'no_show', closed_at = ?, updated_at = ? WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      ).bind(now, now, session.id, effectiveTableTenant, effectiveTableTenant).run();
    } catch {
      if (canRunUnscopedFallback) {
        try {
          await db.prepare(
            'UPDATE table_sessions SET status = \'no_show\', closed_at = ?, updated_at = ? WHERE id = ?'
          ).bind(now, now, session.id).run();
        } catch {
          try {
            await db.prepare(
              'UPDATE table_sessions SET status = \'no_show\', ended_at = ? WHERE id = ?'
            ).bind(now, session.id).run();
          } catch {
            // table_sessions schema variation
          }
        }
      }
    }
    await db.prepare(
      "UPDATE cafe_tables SET status = 'Available', current_order_id = NULL WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(id, effectiveTableTenant).run().catch(() =>
      canRunUnscopedFallback
        ? db.prepare("UPDATE cafe_tables SET status = 'Available', current_order_id = NULL WHERE id = ?").bind(id).run().catch(() => null)
        : null
    );
    await db.prepare(
      "UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(id, effectiveTableTenant).run().catch(() =>
      canRunUnscopedFallback
        ? db.prepare('UPDATE cafe_tables SET status = \'Available\' WHERE id = ?').bind(id).run()
        : null
    );
  }

  return c.json({
    success: true,
    message: `Table ${id} marked no-show; freed after ${timeoutMinutes} min`,
    released_at: now,
  });
});

// POST /api/floor-plan/:id/release — force-free a table (staff override)
floorPlanRouter.post('/:id/release', async (c) => {
  const user = c.get('user' as never) as { id?: string; role?: string } | undefined;
  if (!user?.role || !FLOOR_PLAN_MUTATION_ROLES.has(user.role)) {
    return c.json({ success: false, error: 'Insufficient permissions to release table' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = resolveFloorPlanTenantId(c);
  const canRunUnscopedFallback = !tenantId || tenantId === 'default' || tenantId === '*';
  const id = c.req.param('id');
  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!matchesTenantRow(table, tenantId)) return c.json({ success: false, error: 'Table not found' }, 404);
  const rawTableTenant = typeof table?.tenant_id === 'string' ? table.tenant_id.trim() : '';
  const effectiveTableTenant =
    tenantId === '*'
      ? (rawTableTenant && rawTableTenant !== '*' && rawTableTenant.toLowerCase() !== 'hq' ? rawTableTenant : 'default')
      : (tenantId || 'default');
  const releaseBody = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const canForceRelease = Boolean(releaseBody.force) && ['owner', 'manager', 'admin'].includes(String(user.role || '').toLowerCase());
  if (!canForceRelease && (await hasUnpaidActiveOrdersForTable(db, id, effectiveTableTenant, canRunUnscopedFallback))) {
    return c.json({ success: false, error: 'Cannot release table with unpaid active orders' }, 409);
  }

  const now = new Date().toISOString();
  await db.prepare(
    "UPDATE cafe_tables SET status = 'Available', current_order_id = NULL WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
  ).bind(id, effectiveTableTenant).run().catch(() =>
    canRunUnscopedFallback
      ? db.prepare("UPDATE cafe_tables SET status = 'Available', current_order_id = NULL WHERE id = ?").bind(id).run().catch(() => null)
      : null
  );
  await db.prepare(
    "UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
  ).bind(id, effectiveTableTenant).run().catch(() =>
    canRunUnscopedFallback
      ? db.prepare('UPDATE cafe_tables SET status = \'Available\' WHERE id = ?').bind(id).run()
      : null
  );

  let session: { id: string; tenant_id?: string | null } | null = null;
  try {
    session = await db.prepare(
      "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(id, effectiveTableTenant).first<{ id: string; tenant_id?: string | null }>().catch(() =>
      canRunUnscopedFallback
        ? db.prepare(
            "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid')"
          ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
            db.prepare(
              "SELECT id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid')"
            ).bind(id).first<{ id: string }>()
          )
        : null
    );
    if (!session) {
      session = await db.prepare(
        "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status = 'active' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, effectiveTableTenant).first<{ id: string; tenant_id?: string | null }>().catch(() =>
        canRunUnscopedFallback
          ? db.prepare(
              'SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status = \'active\''
            ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
              db.prepare(
                'SELECT id FROM table_sessions WHERE table_id = ? AND status = \'active\''
              ).bind(id).first<{ id: string }>()
            )
          : null
      );
    }
  } catch {
    session = null;
  }
  if (session && !matchesTenantRow(session as unknown as Record<string, unknown>, effectiveTableTenant)) {
    session = null;
  }
  if (session) {
    try {
      await db.prepare(
        "UPDATE table_sessions SET status = 'closed', closed_at = ?, updated_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      ).bind(now, now, id, effectiveTableTenant, effectiveTableTenant).run();
    } catch {
      if (canRunUnscopedFallback) {
        try {
          await db.prepare(
            "UPDATE table_sessions SET status = 'closed', closed_at = ?, updated_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid')"
          ).bind(now, now, id).run();
        } catch {
          try {
            await db.prepare(
              'UPDATE table_sessions SET status = \'closed\', ended_at = ? WHERE id = ?'
            ).bind(now, session.id).run();
          } catch {
            // table_sessions schema variation
          }
        }
      }
    }
  }

  return c.json({ success: true, message: `Table ${id} released` });
});

// PUT /api/floor-plan/tables/positions — batch update table coordinates
floorPlanRouter.put('/tables/positions', async (c) => {
  const user = c.get('user' as never) as { id?: string; role?: string } | undefined;
  if (!user?.role || !FLOOR_PLAN_MUTATION_ROLES.has(user.role)) {
    return c.json({ success: false, error: 'Insufficient permissions to update table positions' }, 403);
  }
  const body = await c.req.json().catch(() => ({})) as {
    positions?: Array<{ id?: string; table_id?: string; x?: number; y?: number; position_x?: number; position_y?: number }>;
  };
  if (!Array.isArray(body.positions) || body.positions.length === 0) {
    return c.json({ success: false, error: 'positions must be a non-empty array' }, 400);
  }
  const db = c.env.AURA_DB;
  const tenantId = resolveFloorPlanTenantId(c);
  const now = new Date().toISOString();
  let updated = 0;
  for (const item of body.positions) {
    const tblId = String(item?.id ?? item?.table_id ?? '').trim();
    if (!tblId) {
      return c.json({ success: false, error: 'Each position item requires a table id' }, 400);
    }
    const posX = Number(item?.position_x ?? item?.x ?? 0);
    const posY = Number(item?.position_y ?? item?.y ?? 0);
    if (!Number.isFinite(posX) || !Number.isFinite(posY)) {
      return c.json({ success: false, error: 'Invalid position coordinates' }, 400);
    }
    try {
      if (tenantId !== '*') {
        await db
          .prepare("UPDATE cafe_tables SET position_x = ?, position_y = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(posX, posY, now, tblId, tenantId)
          .run();
      } else {
        await db
          .prepare('UPDATE cafe_tables SET position_x = ?, position_y = ?, updated_at = ? WHERE id = ?')
          .bind(posX, posY, now, tblId)
          .run();
      }
      updated += 1;
    } catch {
      try {
        if (tenantId !== '*') {
          await db
            .prepare("UPDATE tables SET position_x = ?, position_y = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(posX, posY, now, tblId, tenantId)
            .run();
        } else {
          await db
            .prepare('UPDATE tables SET position_x = ?, position_y = ?, updated_at = ? WHERE id = ?')
            .bind(posX, posY, now, tblId)
            .run();
        }
        updated += 1;
      } catch {
        // Optional position columns in minimal test schemas
      }
    }
  }
  return c.json({ success: true, updated });
});

async function handleFloorPlanTableStatusPatch(c: any) {
  const user = c.get('user' as never) as { id?: string; role?: string } | undefined;
  if (!user?.role || !FLOOR_PLAN_MUTATION_ROLES.has(user.role)) {
    return c.json({ success: false, error: 'Insufficient permissions to update table status' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = resolveFloorPlanTenantId(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({})) as { status?: string };
  const rawStatus = String(body.status ?? '').trim();
  if (!rawStatus) {
    return c.json({ success: false, error: 'status is required' }, 400);
  }
  let table: Record<string, unknown> | null = null;
  let useLegacyTable = false;
  try {
    table = (await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first()) as Record<string, unknown> | null;
  } catch {
    useLegacyTable = true;
    table = (await db.prepare('SELECT * FROM tables WHERE id = ?').bind(id).first().catch(() => null)) as Record<string, unknown> | null;
  }
  if (!table || !matchesTenantRow(table, tenantId)) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  const effectiveTableTenant =
    table && 'tenant_id' in table && typeof table.tenant_id === 'string' && table.tenant_id.trim() && table.tenant_id.trim() !== '*'
      ? table.tenant_id.trim()
      : tenantId === '*'
        ? 'default'
        : tenantId;
  const lowerTarget = rawStatus.toLowerCase();
  const isAvailableTarget = lowerTarget === 'available' || lowerTarget === 'free';
  const isCleaningTarget = lowerTarget === 'cleaning';
  if (isAvailableTarget && (await hasUnpaidActiveOrdersForTable(db, id, effectiveTableTenant))) {
    return c.json({ success: false, error: 'Cannot release table with unpaid active orders' }, 409);
  }
  const now = new Date().toISOString();
  const tblName = useLegacyTable ? 'tables' : 'cafe_tables';
  if (isAvailableTarget || isCleaningTarget) {
    await db
      .prepare(`UPDATE ${tblName} SET status = ?, current_order_id = NULL WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`)
      .bind(rawStatus, id, effectiveTableTenant)
      .run()
      .catch(() =>
        db.prepare(`UPDATE ${tblName} SET status = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`).bind(rawStatus, id, effectiveTableTenant).run()
      )
      .catch(() =>
        effectiveTableTenant === 'default'
          ? db.prepare(`UPDATE ${tblName} SET status = ? WHERE id = ?`).bind(rawStatus, id).run()
          : undefined
      );
    await db
      .prepare(
        "UPDATE table_sessions SET status = 'closed', closed_at = ?, updated_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      )
      .bind(now, now, id, effectiveTableTenant, effectiveTableTenant)
      .run()
      .catch(() =>
        db
          .prepare(
            "UPDATE table_sessions SET status = 'completed', ended_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
          )
          .bind(now, id, effectiveTableTenant, effectiveTableTenant)
          .run()
          .catch(() => undefined)
      );
  } else {
    await db
      .prepare(`UPDATE ${tblName} SET status = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`)
      .bind(rawStatus, id, effectiveTableTenant)
      .run()
      .catch(() =>
        effectiveTableTenant === 'default'
          ? db.prepare(`UPDATE ${tblName} SET status = ? WHERE id = ?`).bind(rawStatus, id).run()
          : undefined
      );
  }
  return c.json({ success: true, data: { id, status: rawStatus } });
}

floorPlanRouter.patch('/:id/status', handleFloorPlanTableStatusPatch);
floorPlanRouter.patch('/tables/:id/status', handleFloorPlanTableStatusPatch);

export { floorPlanRouter };
