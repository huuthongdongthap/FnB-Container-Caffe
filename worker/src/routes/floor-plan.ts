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
import { getTenantId, matchesTenantRow } from '../middleware/tenant';

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

const floorPlanRouter = new Hono<{ Bindings: Env }>();
floorPlanRouter.use('/*', requireAuth(['owner', 'staff', 'manager', 'supervisor', 'admin', 'waiter', 'cashier']));

// GET /api/floor-plan — live floor plan with active session linkage
floorPlanRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c);
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
         ON s.table_id = t.id AND (s.status = 'active' OR s.status IN ('ordering', 'paying', 'paid'))
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
           ON s.table_id = t.id AND (s.status = 'active' OR s.status IN ('ordering', 'paying', 'paid'))
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
             ON s.table_id = t.id AND (s.status = 'active' OR s.status IN ('ordering', 'paying', 'paid'))
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
          const minimalQuery = 'SELECT t.* FROM cafe_tables t ORDER BY t.table_number';
          const res = await db.prepare(minimalQuery).all<Record<string, unknown>>();
          results = res.results || [];
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
    const rSessionTenantMatches = !('session_tenant_id' in r) || r.session_tenant_id === undefined || tenantId === '*'
      ? true
      : ((typeof r.session_tenant_id === 'string' && r.session_tenant_id.trim() ? r.session_tenant_id.trim() : 'default') === tenantId);
    const existingSessionTenantMatches = !('session_tenant_id' in existing) || existing.session_tenant_id === undefined || tenantId === '*'
      ? true
      : ((typeof existing.session_tenant_id === 'string' && existing.session_tenant_id.trim() ? existing.session_tenant_id.trim() : 'default') === tenantId);
    const rHasValidSession = r.session_id != null && rSessionTenantMatches;
    const existingHasValidSession = existing.session_id != null && existingSessionTenantMatches;
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
    const sessionTenantMatches = !('session_tenant_id' in r) || r.session_tenant_id === undefined || tenantId === '*'
      ? true
      : ((typeof r.session_tenant_id === 'string' && r.session_tenant_id.trim() ? r.session_tenant_id.trim() : 'default') === tenantId);
    const hasSession = r.session_id != null && sessionTenantMatches;
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

  return c.json({ success: true, data: tables, summary });
});

// GET /api/floor-plan/summary — aggregate counts only (lightweight poll)
floorPlanRouter.get('/summary', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c);
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
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c);
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const timeoutMinutes = Number(body.timeout_minutes ?? 30);

  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!matchesTenantRow(table, tenantId)) return c.json({ success: false, error: 'Table not found' }, 404);

  const now = new Date().toISOString();
  const noteParam = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
  try {
    if (tenantId && tenantId !== '*') {
      await db.prepare(
        "UPDATE cafe_tables SET status = 'Overdue', notes = COALESCE(?, notes, 'No-show — awaiting auto-release') WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(noteParam, id, tenantId).run();
    } else {
      await db.prepare(
        "UPDATE cafe_tables SET status = 'Overdue', notes = COALESCE(?, notes, 'No-show — awaiting auto-release') WHERE id = ?"
      ).bind(noteParam, id).run();
    }
  } catch {
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

  // Close any open session on the table (no-show).
  let session: { id: string; tenant_id?: string | null } | null = null;
  try {
    if (tenantId && tenantId !== '*') {
      session = await db.prepare(
        "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'ordering', 'paying', 'paid') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, tenantId).first<{ id: string; tenant_id?: string | null }>().catch(() =>
        db.prepare(
          "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'ordering', 'paying', 'paid')"
        ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
          db.prepare(
            "SELECT id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'ordering', 'paying', 'paid')"
          ).bind(id).first<{ id: string }>()
        )
      );
      if (!session) {
        session = await db.prepare(
          "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status = 'active' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(id, tenantId).first<{ id: string; tenant_id?: string | null }>().catch(() =>
          db.prepare(
            'SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status = \'active\''
          ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
            db.prepare(
              'SELECT id FROM table_sessions WHERE table_id = ? AND status = \'active\''
            ).bind(id).first<{ id: string }>()
          )
        );
      }
    } else {
      session = await db.prepare(
        "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'ordering', 'paying', 'paid')"
      ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
        db.prepare(
          "SELECT id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'ordering', 'paying', 'paid')"
        ).bind(id).first<{ id: string }>()
      );
      if (!session) {
        session = await db.prepare(
          'SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status = \'active\''
        ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
          db.prepare(
            'SELECT id FROM table_sessions WHERE table_id = ? AND status = \'active\''
          ).bind(id).first<{ id: string }>()
        );
      }
    }
  } catch {
    session = null;
  }
  if (session && !matchesTenantRow(session as unknown as Record<string, unknown>, tenantId)) {
    session = null;
  }
  if (session) {
    try {
      await db.prepare(
        "UPDATE table_sessions SET status = 'no_show', closed_at = ?, updated_at = ? WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      ).bind(now, now, session.id, tenantId, tenantId).run();
    } catch {
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
    if (tenantId && tenantId !== '*') {
      await db.prepare(
        "UPDATE cafe_tables SET status = 'Available', current_order_id = NULL WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, tenantId).run().catch(() =>
        db.prepare("UPDATE cafe_tables SET status = 'Available', current_order_id = NULL WHERE id = ?").bind(id).run().catch(() => null)
      );
      await db.prepare(
        "UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, tenantId).run().catch(() =>
        db.prepare('UPDATE cafe_tables SET status = \'Available\' WHERE id = ?').bind(id).run()
      );
    } else {
      await db.prepare(
        "UPDATE cafe_tables SET status = 'Available', current_order_id = NULL WHERE id = ?"
      ).bind(id).run().catch(() => null);
      await db.prepare(
        'UPDATE cafe_tables SET status = \'Available\' WHERE id = ?'
      ).bind(id).run();
    }
  }

  return c.json({
    success: true,
    message: `Table ${id} marked no-show; freed after ${timeoutMinutes} min`,
    released_at: now,
  });
});

// POST /api/floor-plan/:id/release — force-free a table (staff override)
floorPlanRouter.post('/:id/release', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c);
  const id = c.req.param('id');
  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!matchesTenantRow(table, tenantId)) return c.json({ success: false, error: 'Table not found' }, 404);

  const now = new Date().toISOString();
  if (tenantId && tenantId !== '*') {
    await db.prepare(
      "UPDATE cafe_tables SET status = 'Available', current_order_id = NULL WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(id, tenantId).run().catch(() =>
      db.prepare("UPDATE cafe_tables SET status = 'Available', current_order_id = NULL WHERE id = ?").bind(id).run().catch(() => null)
    );
    await db.prepare(
      "UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(id, tenantId).run().catch(() =>
      db.prepare('UPDATE cafe_tables SET status = \'Available\' WHERE id = ?').bind(id).run()
    );
  } else {
    await db.prepare(
      "UPDATE cafe_tables SET status = 'Available', current_order_id = NULL WHERE id = ?"
    ).bind(id).run().catch(() => null);
    await db.prepare(
      'UPDATE cafe_tables SET status = \'Available\' WHERE id = ?'
    ).bind(id).run();
  }

  let session: { id: string; tenant_id?: string | null } | null = null;
  try {
    if (tenantId && tenantId !== '*') {
      session = await db.prepare(
        "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'ordering', 'paying', 'paid') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, tenantId).first<{ id: string; tenant_id?: string | null }>().catch(() =>
        db.prepare(
          "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'ordering', 'paying', 'paid')"
        ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
          db.prepare(
            "SELECT id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'ordering', 'paying', 'paid')"
          ).bind(id).first<{ id: string }>()
        )
      );
      if (!session) {
        session = await db.prepare(
          "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status = 'active' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(id, tenantId).first<{ id: string; tenant_id?: string | null }>().catch(() =>
          db.prepare(
            'SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status = \'active\''
          ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
            db.prepare(
              'SELECT id FROM table_sessions WHERE table_id = ? AND status = \'active\''
            ).bind(id).first<{ id: string }>()
          )
        );
      }
    } else {
      session = await db.prepare(
        "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'ordering', 'paying', 'paid')"
      ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
        db.prepare(
          "SELECT id FROM table_sessions WHERE table_id = ? AND status IN ('active', 'ordering', 'paying', 'paid')"
        ).bind(id).first<{ id: string }>()
      );
      if (!session) {
        session = await db.prepare(
          'SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND status = \'active\''
        ).bind(id).first<{ id: string; tenant_id?: string | null }>().catch(() =>
          db.prepare(
            'SELECT id FROM table_sessions WHERE table_id = ? AND status = \'active\''
          ).bind(id).first<{ id: string }>()
        );
      }
    }
  } catch {
    session = null;
  }
  if (session && !matchesTenantRow(session as unknown as Record<string, unknown>, tenantId)) {
    session = null;
  }
  if (session) {
    try {
      await db.prepare(
        "UPDATE table_sessions SET status = 'closed', closed_at = ?, updated_at = ? WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      ).bind(now, now, session.id, tenantId, tenantId).run();
    } catch {
      try {
        await db.prepare(
          'UPDATE table_sessions SET status = \'closed\', closed_at = ?, updated_at = ? WHERE id = ?'
        ).bind(now, now, session.id).run();
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

  return c.json({ success: true, message: `Table ${id} released` });
});

export { floorPlanRouter };
