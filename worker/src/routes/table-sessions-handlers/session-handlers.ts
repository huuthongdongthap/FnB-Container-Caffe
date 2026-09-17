import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import {
  type TableSession,
  SESSION_STATUSES,
  makeSessionId
} from './types';

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

    query += ' ORDER BY opened_at DESC';
    const stmt = params.length ? db.prepare(query).bind(...params) : db.prepare(query);
    const { results } = await stmt.all<TableSession>();
    return c.json({ success: true, data: results });
  });

  // GET /api/table-sessions/:id
  router.get('/:id', async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const session = await db.prepare(
      'SELECT * FROM table_sessions WHERE id = ?'
    ).bind(id).first<TableSession>();
    if (!session) {
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
    const existing = await db.prepare(
      'SELECT id FROM table_sessions WHERE table_id = ? AND status = \'active\''
    ).bind(tableId).first<{ id: string }>();
    if (existing) {
      return c.json(
        { success: false, error: `Table ${tableId} already has an active session (${existing.id}). Close it first.` },
        409
      );
    }

    // Verify the table exists.
    const table = await db.prepare(
      'SELECT id, table_number, zone, status FROM cafe_tables WHERE id = ?'
    ).bind(tableId).first<{ id: string; table_number: number; zone: string; status: string }>();
    if (!table) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }

    const id = makeSessionId();
    const now = new Date().toISOString();

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

    // Mark the table occupied.
    await db.prepare(
      'UPDATE cafe_tables SET status = ?, updated_at = ? WHERE id = ?'
    ).bind('Occupied', now, tableId).run();

    const session = await db.prepare(
      'SELECT * FROM table_sessions WHERE id = ?'
    ).bind(id).first<TableSession>();

    return c.json({ success: true, data: session }, 201);
  });

  // PATCH /api/table-sessions/:id — transition status (active -> ordering -> paid -> closed)
  router.patch('/:id', async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;

    const session = await db.prepare(
      'SELECT * FROM table_sessions WHERE id = ?'
    ).bind(id).first<TableSession>();
    if (!session) {
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

    await db.prepare(
      `UPDATE table_sessions
       SET status = COALESCE(?, status),
           closed_at = COALESCE(?, closed_at),
           notes = COALESCE(?, notes),
           updated_at = ?
       WHERE id = ?`
    ).bind(nextStatus || null, closedAt, body.notes || null, now, id).run();

    // Free the table when the session ends.
    if (nextStatus === 'closed' || nextStatus === 'no_show') {
      await db.prepare(
        'UPDATE cafe_tables SET status = ?, updated_at = ? WHERE id = ?'
      ).bind('Available', now, session.table_id).run();
    }

    const updated = await db.prepare(
      'SELECT * FROM table_sessions WHERE id = ?'
    ).bind(id).first<TableSession>();
    return c.json({ success: true, data: updated });
  });
}
