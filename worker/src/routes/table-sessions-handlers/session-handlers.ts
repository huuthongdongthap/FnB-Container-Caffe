import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import {
  type TableSession,
  SESSION_STATUSES,
  makeSessionId
} from './types';

function matchesTenantRow(row: Record<string, unknown> | null | undefined, tenantId: string): boolean {
  if (!row) return false;
  if (!('tenant_id' in row) || row.tenant_id === undefined) return true;
  const rowTenant = typeof row.tenant_id === 'string' && row.tenant_id.trim() ? row.tenant_id.trim() : 'default';
  return rowTenant === tenantId;
}

async function isTableAccessibleByTenant(db: D1Database, tableId: string, tenantId: string): Promise<boolean> {
  try {
    const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(tableId).first<Record<string, unknown>>();
    if (!table) return true;
    return matchesTenantRow(table, tenantId);
  } catch {
    return true;
  }
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

    const baseQuery = query;
    query += ' ORDER BY opened_at DESC';
    let results: TableSession[] = [];
    try {
      const stmt = params.length ? db.prepare(query).bind(...params) : db.prepare(query);
      const res = await stmt.all<TableSession>();
      results = res.results || [];
    } catch {
      try {
        const fallbackQuery = `${baseQuery} ORDER BY started_at DESC`;
        const stmt = params.length ? db.prepare(fallbackQuery).bind(...params) : db.prepare(fallbackQuery);
        const res = await stmt.all<TableSession>();
        results = res.results || [];
      } catch {
        results = [];
      }
    }
    const tenantId = getTenantId(c);
    try {
      const tablesRes = await db.prepare('SELECT * FROM cafe_tables').all<Record<string, unknown>>();
      const foreignTableIds = new Set(
        (tablesRes.results || [])
          .filter((t) => !matchesTenantRow(t, tenantId))
          .map((t) => String(t.id))
      );
      if (foreignTableIds.size > 0) {
        results = results.filter((s) => !foreignTableIds.has(String(s.table_id)));
      }
    } catch {
      // Optional cafe_tables table
    }
    return c.json({ success: true, data: results });
  });

  // GET /api/table-sessions/:id
  router.get('/:id', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c);
    const id = c.req.param('id');
    let session: TableSession | null = null;
    try {
      session = await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ?'
      ).bind(id).first<TableSession>();
    } catch {
      session = null;
    }
    if (!session || !(await isTableAccessibleByTenant(db, session.table_id, tenantId))) {
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

    // Refuse to open a second active session on the same table.
    let existing: { id: string } | null = null;
    try {
      existing = await db.prepare(
        'SELECT id FROM table_sessions WHERE table_id = ? AND status = \'active\''
      ).bind(tableId).first<{ id: string }>();
    } catch {
      existing = null;
    }
    if (existing) {
      return c.json(
        { success: false, error: `Table ${tableId} already has an active session (${existing.id}). Close it first.` },
        409
      );
    }

    // Verify the table exists and belongs to the current tenant.
    const tenantId = getTenantId(c);
    const table = await db.prepare(
      'SELECT * FROM cafe_tables WHERE id = ?'
    ).bind(tableId).first<Record<string, unknown>>();
    if (!matchesTenantRow(table, tenantId)) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }

    const id = makeSessionId();
    const now = new Date().toISOString();

    try {
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
    await db.prepare(
      'UPDATE cafe_tables SET status = ? WHERE id = ?'
    ).bind('Occupied', tableId).run();

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
    const tenantId = getTenantId(c);
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
    if (!session || !(await isTableAccessibleByTenant(db, session.table_id, tenantId))) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }

    const nextStatus = String(body.status || '').trim();
    if (nextStatus && !(SESSION_STATUSES as readonly string[]).includes(nextStatus)) {
      return c.json(
        { success: false, error: `Invalid status. Expected one of: ${SESSION_STATUSES.join(', ')}` },
        400
      );
    }

    const now = new Date().toISOString();
    const closedAt = (nextStatus === 'closed' || nextStatus === 'no_show') ? now : session.closed_at;

    try {
      await db.prepare(
        `UPDATE table_sessions
         SET status = COALESCE(?, status),
             closed_at = COALESCE(?, closed_at),
             notes = COALESCE(?, notes),
             updated_at = ?
         WHERE id = ?`
      ).bind(nextStatus || null, closedAt, body.notes || null, now, id).run();
    } catch {
      await db.prepare(
        `UPDATE table_sessions
         SET status = COALESCE(?, status),
             ended_at = COALESCE(?, ended_at)
         WHERE id = ?`
      ).bind(nextStatus || null, closedAt, id).run();
    }

    // Free the table when the session ends.
    if (nextStatus === 'closed' || nextStatus === 'no_show') {
      await db.prepare(
        'UPDATE cafe_tables SET status = ? WHERE id = ?'
      ).bind('Available', session.table_id).run();
    }

    const updated = await db.prepare(
      'SELECT * FROM table_sessions WHERE id = ?'
    ).bind(id).first<TableSession>();
    return c.json({ success: true, data: updated });
  });
}
