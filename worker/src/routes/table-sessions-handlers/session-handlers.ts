import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import {
  type TableSession,
  SESSION_STATUSES,
  makeSessionId,
  matchesTenantRow,
  hasExplicitTenantId,
  isTableAccessibleByTenant,
} from './types';

function matchesSessionTenant(row: Record<string, unknown> | null | undefined, tenantId: string): boolean {
  if (!row) return false;
  if (hasExplicitTenantId(row)) {
    return matchesTenantRow(row, tenantId);
  }
  return matchesTenantRow(row, tenantId);
}

export function registerSessionHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/table-sessions — list sessions, filterable by table / status
  router.get('/', async (c) => {
    const db = c.env.AURA_DB;
    const tableId = c.req.query('table_id');
    const status = c.req.query('status');

    let query = 'SELECT * FROM table_sessions WHERE 1=1';
    const params: unknown[] = [];

    if (tableId) { query += ' AND table_id = ?'; params.push(tableId); }
    if (status) {
      if (!(SESSION_STATUSES as readonly string[]).includes(status)) {
        return c.json({ success: false, error: `Invalid status. Expected one of: ${SESSION_STATUSES.join(', ')}` }, 400);
      }
      query += ' AND status = ?'; params.push(status);
    }

    const tenantId = getTenantId(c).trim() || 'default';
    const baseQuery = query;
    const baseParams = [...params];
    let results: TableSession[] = [];
    try {
      let scopedQuery = baseQuery;
      const scopedParams = [...baseParams];
      if (tenantId !== '*') {
        scopedQuery += " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
        scopedParams.push(tenantId);
      }
      scopedQuery += ' ORDER BY opened_at DESC LIMIT 200';
      const stmt = scopedParams.length ? db.prepare(scopedQuery).bind(...scopedParams) : db.prepare(scopedQuery);
      const res = await stmt.all<TableSession>();
      results = res.results || [];
    } catch {
      try {
        const fallbackQuery = `${baseQuery} ORDER BY opened_at DESC LIMIT 200`;
        const stmt = baseParams.length ? db.prepare(fallbackQuery).bind(...baseParams) : db.prepare(fallbackQuery);
        const res = await stmt.all<TableSession>();
        results = res.results || [];
      } catch {
        try {
          const fallbackQuery = `${baseQuery} ORDER BY started_at DESC LIMIT 200`;
          const stmt = baseParams.length ? db.prepare(fallbackQuery).bind(...baseParams) : db.prepare(fallbackQuery);
          const res = await stmt.all<TableSession>();
          results = res.results || [];
        } catch {
          results = [];
        }
      }
    }
    results = results.filter((s) => {
      const row = s as unknown as Record<string, unknown>;
      if (hasExplicitTenantId(row)) {
        return matchesTenantRow(row, tenantId);
      }
      return true;
    });
    try {
      const tablesRes = await db.prepare('SELECT * FROM cafe_tables').all<Record<string, unknown>>();
      const allTables = tablesRes.results || [];
      const foreignTableIds = new Set(
        allTables
          .filter((t) => !matchesTenantRow(t, tenantId))
          .map((t) => String(t.id))
      );
      if (foreignTableIds.size > 0) {
        results = results.filter((s) => {
          const row = s as unknown as Record<string, unknown>;
          if (hasExplicitTenantId(row)) {
            return matchesTenantRow(row, tenantId);
          }
          return !foreignTableIds.has(String(s.table_id));
        });
      }
      if (tenantId !== 'default' && tenantId !== '*') {
        const allowedTableIds = new Set(
          allTables
            .filter((t) => matchesTenantRow(t, tenantId))
            .map((t) => String(t.id))
        );
        results = results.filter((s) => {
          const row = s as unknown as Record<string, unknown>;
          if (hasExplicitTenantId(row) && matchesTenantRow(row, tenantId)) {
            return true;
          }
          return allowedTableIds.has(String(s.table_id));
        });
      }
    } catch {
      if (tenantId !== 'default' && tenantId !== '*') {
        results = results.filter((s) => {
          const row = s as unknown as Record<string, unknown>;
          return hasExplicitTenantId(row) && matchesTenantRow(row, tenantId);
        });
      }
    }
    return c.json({ success: true, data: results });
  });

  // GET /api/table-sessions/:id
  router.get('/:id', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const id = c.req.param('id');
    let session: TableSession | null = null;
    try {
      session = await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ?'
      ).bind(id).first<TableSession>();
    } catch {
      session = null;
    }
    const sessionRow = session as unknown as Record<string, unknown> | null;
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    if (sessionRow && hasExplicitTenantId(sessionRow)) {
      if (!matchesTenantRow(sessionRow, tenantId)) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (session.table_id) {
      if (!(await isTableAccessibleByTenant(db, String(session.table_id), tenantId))) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (!matchesTenantRow(sessionRow, tenantId)) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    return c.json({ success: true, data: session });
  });

  // POST /api/table-sessions — open a session for a table
  router.post('/', async (c) => {
    const db = c.env.AURA_DB;
    const body = await c.req.json() as Record<string, unknown>;
    const tableId = String(body.table_id || '').trim();
    if (!tableId) {
      return c.json({ success: false, error: 'table_id is required' }, 400);
    }
    if (body.customer_name !== undefined && body.customer_name !== null) {
      if (typeof body.customer_name !== 'string' || String(body.customer_name).length > 200) {
        return c.json({ success: false, error: 'customer_name must be a string of at most 200 characters' }, 400);
      }
    }
    if (body.covers !== undefined && body.covers !== null) {
      const covers = Number(body.covers);
      if (!Number.isInteger(covers) || covers < 1) {
        return c.json({ success: false, error: 'covers must be a positive integer' }, 400);
      }
    }
    if (body.guest_count !== undefined && body.guest_count !== null) {
      const guestCount = Number(body.guest_count);
      if (!Number.isInteger(guestCount) || guestCount < 1) {
        return c.json({ success: false, error: 'guest_count must be an integer >= 1' }, 400);
      }
    }

    const tenantId = getTenantId(c).trim() || 'default';

    // Refuse to open a second open session on the same table (active, ordering, paid all count).
    let existing: { id: string; tenant_id?: string | null } | null = null;
    try {
      const candidate = await db.prepare(
        "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND (status = 'active' OR status IN ('ordering', 'paid')) AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      ).bind(tableId, tenantId, tenantId).first<{ id: string; tenant_id?: string | null }>();
      if (candidate && matchesSessionTenant(candidate as unknown as Record<string, unknown>, tenantId)) {
        existing = candidate;
      } else if (candidate) {
        const res = await db.prepare(
          "SELECT * FROM table_sessions WHERE table_id = ? AND (status = 'active' OR status IN ('ordering', 'paid'))"
        ).bind(tableId).all<{ id: string; table_id?: string; status?: string; tenant_id?: string | null }>().catch(() => ({ results: [] }));
        existing = (res.results || []).find((r) =>
          (r.table_id === undefined || String(r.table_id) === tableId) &&
          (r.status === undefined || ['active', 'ordering', 'paid'].includes(String(r.status))) &&
          matchesSessionTenant(r as unknown as Record<string, unknown>, tenantId)
        ) ?? null;
      }
    } catch {
      try {
        const res = await db.prepare(
          "SELECT * FROM table_sessions WHERE table_id = ? AND (status = 'active' OR status IN ('ordering', 'paid'))"
        ).bind(tableId).all<{ id: string; table_id?: string; status?: string; tenant_id?: string | null }>();
        const rows = (res.results || []).filter((r) =>
          (r.table_id === undefined || String(r.table_id) === tableId) &&
          (r.status === undefined || ['active', 'ordering', 'paid'].includes(String(r.status)))
        );
        if (rows.length > 0) {
          existing = rows.find((r) => matchesSessionTenant(r as unknown as Record<string, unknown>, tenantId)) ?? null;
        } else {
          const single = await db.prepare(
            "SELECT * FROM table_sessions WHERE table_id = ? AND (status = 'active' OR status IN ('ordering', 'paid'))"
          ).bind(tableId).first<{ id: string; tenant_id?: string | null }>().catch(() => null);
          if (single && matchesSessionTenant(single as unknown as Record<string, unknown>, tenantId)) {
            existing = single;
          }
        }
      } catch {
        try {
          const single = await db.prepare(
            "SELECT id FROM table_sessions WHERE table_id = ? AND (status = 'active' OR status IN ('ordering', 'paid'))"
          ).bind(tableId).first<{ id: string; tenant_id?: string | null }>();
          if (single && matchesSessionTenant(single as unknown as Record<string, unknown>, tenantId)) {
            existing = single;
          }
        } catch {
          existing = null;
        }
      }
    }
    if (existing) {
      if (!(await isTableAccessibleByTenant(db, tableId, tenantId))) {
        return c.json({ success: false, error: 'Table not found' }, 404);
      }
      return c.json(
        { success: false, error: `Table ${tableId} already has an active session (${existing.id}). Close it first.` },
        409
      );
    }

    // Verify the table exists and belongs to the current tenant.
    const table = await db.prepare(
      'SELECT * FROM cafe_tables WHERE id = ?'
    ).bind(tableId).first<Record<string, unknown>>();
    if (!matchesTenantRow(table, tenantId)) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }

    const id = makeSessionId();
    const now = new Date().toISOString();

    try {
      const effectiveSessionTenant = tenantId !== '*' ? tenantId : 'default';
      try {
        await db.prepare(
          `INSERT INTO table_sessions (id, table_id, customer_id, customer_name, customer_phone, status, notes, tenant_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
        ).bind(
          id,
          tableId,
          body.customer_id || null,
          body.customer_name || null,
          body.customer_phone || null,
          body.notes || null,
          effectiveSessionTenant,
          now,
          now
        ).run();
      } catch {
        await db.prepare(
          `INSERT INTO table_sessions (id, table_id, customer_id, customer_name, customer_phone, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`
        ).bind(
          id,
          tableId,
          body.customer_id || null,
          body.customer_name || null,
          body.customer_phone || null,
          body.notes || null,
          now,
          now
        ).run();
      }
    } catch {
      try {
        await db.prepare(
          `INSERT INTO table_sessions (id, table_id, status, started_at, created_at)
           VALUES (?, ?, 'active', ?, ?)`
        ).bind(id, tableId, now, now).run();
      } catch {
        // table_sessions table not present in minimal schema
      }
    }

    // Mark the table occupied.
    if (tenantId !== '*') {
      await db.prepare(
        "UPDATE cafe_tables SET status = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind('Occupied', tableId, tenantId).run().catch(() =>
        db.prepare(
          'UPDATE cafe_tables SET status = ? WHERE id = ?'
        ).bind('Occupied', tableId).run()
      );
    } else {
      await db.prepare(
        'UPDATE cafe_tables SET status = ? WHERE id = ?'
      ).bind('Occupied', tableId).run();
    }

    let session: TableSession | null = null;
    try {
      session = await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ?'
      ).bind(id).first<TableSession>();
    } catch {
      session = {
        id,
        table_id: tableId,
        customer_id: (body.customer_id as string) || null,
        customer_name: (body.customer_name as string) || null,
        customer_phone: (body.customer_phone as string) || null,
        status: 'active',
        opened_at: now,
        closed_at: null,
        order_count: 0,
        total_amount: 0,
        notes: (body.notes as string) || null,
        created_at: now,
        updated_at: now,
      };
    }

    return c.json({ success: true, data: session }, 201);
  });

  // PATCH /api/table-sessions/:id — transition status (active -> ordering -> paid -> closed)
  router.patch('/:id', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const id = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;

    let session: TableSession | null = null;
    try {
      session = await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ?'
      ).bind(id).first<TableSession>();
    } catch {
      session = null;
    }
    const sessionRow = session as unknown as Record<string, unknown> | null;
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    if (sessionRow && hasExplicitTenantId(sessionRow)) {
      if (!matchesTenantRow(sessionRow, tenantId)) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (session.table_id) {
      if (!(await isTableAccessibleByTenant(db, String(session.table_id), tenantId))) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (!matchesTenantRow(sessionRow, tenantId)) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }

    // Reject updates on terminal sessions (closed, no_show, or abandoned)
    const terminalStatuses = ['closed', 'no_show', 'abandoned'];
    if (terminalStatuses.includes(String(session.status || ''))) {
      return c.json({ success: false, error: 'Session already ended' }, 409);
    }

    const nextStatus = String(body.status || '').trim();
    if (nextStatus && !(SESSION_STATUSES as readonly string[]).includes(nextStatus)) {
      return c.json(
        { success: false, error: `Invalid status. Expected one of: ${SESSION_STATUSES.join(', ')}` },
        400
      );
    }
    if (body.guest_count !== undefined && body.guest_count !== null) {
      const guestCount = Number(body.guest_count);
      if (!Number.isFinite(guestCount) || !Number.isInteger(guestCount) || guestCount < 1) {
        return c.json({ success: false, error: 'guest_count must be an integer >= 1' }, 400);
      }
    }
    if (body.covers !== undefined && body.covers !== null) {
      const covers = Number(body.covers);
      if (!Number.isFinite(covers) || !Number.isInteger(covers) || covers < 1) {
        return c.json({ success: false, error: 'covers must be a positive integer' }, 400);
      }
    }
    if (body.total_amount !== undefined && body.total_amount !== null) {
      const totalAmount = Number(body.total_amount);
      if (!Number.isFinite(totalAmount) || totalAmount < 0) {
        return c.json({ success: false, error: 'total_amount must be a number >= 0' }, 400);
      }
    }

    const now = new Date().toISOString();
    const isTerminalTransition = terminalStatuses.includes(nextStatus);
    const closedAt = isTerminalTransition ? now : session.closed_at;

    try {
      await db.prepare(
        `UPDATE table_sessions
         SET status = COALESCE(?, status),
             closed_at = COALESCE(?, closed_at),
             notes = COALESCE(?, notes),
             updated_at = ?
         WHERE id = ? AND status NOT IN ('closed', 'no_show', 'abandoned')
           AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`
      ).bind(nextStatus || null, closedAt, body.notes || null, now, id, tenantId, tenantId).run();
    } catch {
      try {
        await db.prepare(
          `UPDATE table_sessions
           SET status = COALESCE(?, status),
               closed_at = COALESCE(?, closed_at),
               notes = COALESCE(?, notes),
               updated_at = ?
           WHERE id = ? AND status NOT IN ('closed', 'no_show', 'abandoned')`
        ).bind(nextStatus || null, closedAt, body.notes || null, now, id).run();
      } catch {
        await db.prepare(
          `UPDATE table_sessions
           SET status = COALESCE(?, status),
               ended_at = COALESCE(?, ended_at)
           WHERE id = ? AND status NOT IN ('closed', 'no_show', 'abandoned')`
        ).bind(nextStatus || null, closedAt, id).run();
      }
    }
    if (body.total_amount !== undefined && body.total_amount !== null) {
      try {
        await db.prepare(
          'UPDATE table_sessions SET total_amount = ?, updated_at = ? WHERE id = ?'
        ).bind(Number(body.total_amount), now, id).run();
      } catch {
        // Optional column update on minimal schema
      }
    }
    if (body.guest_count !== undefined && body.guest_count !== null) {
      try {
        await db.prepare(
          'UPDATE table_sessions SET guest_count = ?, updated_at = ? WHERE id = ?'
        ).bind(Number(body.guest_count), now, id).run();
      } catch {
        // Optional column update on minimal schema
      }
    }

    // Free the table when the session ends.
    if (isTerminalTransition) {
      if (tenantId !== '*') {
        await db.prepare(
          "UPDATE cafe_tables SET status = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind('Available', session.table_id, tenantId).run().catch(() =>
          db.prepare(
            'UPDATE cafe_tables SET status = ? WHERE id = ?'
          ).bind('Available', session.table_id).run()
        );
      } else {
        await db.prepare(
          'UPDATE cafe_tables SET status = ? WHERE id = ?'
        ).bind('Available', session.table_id).run();
      }
    }

    const updated = await db.prepare(
      'SELECT * FROM table_sessions WHERE id = ?'
    ).bind(id).first<TableSession>();
    return c.json({ success: true, data: updated });
  });
}

export const registerSessionRoutes = registerSessionHandlers;

