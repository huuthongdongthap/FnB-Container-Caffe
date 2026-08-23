/**
 * Table Sessions Routes — /api/table-sessions
 *
 * Dine-in session lifecycle: open when guests seat, accumulate orders,
 * close when the bill is paid. This is the F&B unit of truth for table
 * turnover, seated-guest counts, and bill merging.
 *
 * Sessions are independent of the `orders` rows — an order links to a
 * session via `session_id`, so a session can accumulate many orders and
 * still roll up a single bill.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { zodErrorResponse } from '../lib/validators';

export interface TableSession {
  id: string;
  table_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: 'active' | 'ordering' | 'paid' | 'closed' | 'no_show';
  opened_at: string;
  closed_at: string | null;
  order_count: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenSessionInput {
  table_id: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
}

export interface CloseSessionInput {
  status?: 'closed' | 'no_show';
  notes?: string;
}

const SESSION_STATUSES = ['active', 'ordering', 'paid', 'closed', 'no_show'] as const;

function makeSessionId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return (`SES-${Date.now().toString(36)}${rand}`).toUpperCase();
}

export const tableSessionsRouter = new Hono<{ Bindings: Env }>();

// GET /api/table-sessions — list sessions, filterable by table / status
tableSessionsRouter.get('/', async (c) => {
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
tableSessionsRouter.get('/:id', async (c) => {
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
tableSessionsRouter.post('/', async (c) => {
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
tableSessionsRouter.patch('/:id', async (c) => {
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

// POST /api/table-sessions/:id/orders — attach an order to a session (bill merge)
tableSessionsRouter.post('/:id/orders', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const orderId = String(body.order_id || '').trim();
  if (!orderId) {
    return c.json({ success: false, error: 'order_id is required' }, 400);
  }

  const session = await db.prepare(
    'SELECT * FROM table_sessions WHERE id = ? AND status != \'closed\''
  ).bind(id).first<TableSession>();
  if (!session) {
    return c.json({ success: false, error: 'Session not found or already closed' }, 404);
  }

  const order = await db.prepare(
    'SELECT id, total, status FROM orders WHERE id = ?'
  ).bind(orderId).first<{ id: string; total: number; status: string }>();
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  await db.prepare(
    'UPDATE orders SET table_id = ?, updated_at = ? WHERE id = ?'
  ).bind(session.table_id, new Date().toISOString(), orderId).run();

  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE table_sessions
     SET order_count = order_count + 1,
         total_amount = total_amount + ?,
         status = 'ordering',
         updated_at = ?
     WHERE id = ?`
  ).bind(order.total, now, id).run();

  const updated = await db.prepare(
    'SELECT * FROM table_sessions WHERE id = ?'
  ).bind(id).first<TableSession>();
  return c.json({ success: true, data: updated });
});

// GET /api/table-sessions/:id/orders — list orders attached to a session
tableSessionsRouter.get('/:id/orders', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const session = await db.prepare(
    'SELECT id FROM table_sessions WHERE id = ?'
  ).bind(id).first<{ id: string }>();
  if (!session) {
    return c.json({ success: false, error: 'Session not found' }, 404);
  }

  const { results } = await db.prepare(
    'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) ORDER BY created_at DESC'
  ).bind(id).all();
  return c.json({ success: true, data: results });
});
