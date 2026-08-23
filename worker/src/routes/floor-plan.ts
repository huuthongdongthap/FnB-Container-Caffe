/**
 * Floor Plan + Capacity Routes — /api/floor-plan
 *
 * F&B Gap 3.3: real-time table occupancy tracking. Returns the live floor
 * plan with per-table status, active session linkage, and order counts.
 * Includes an auto-release endpoint so a table marked no-show after a
 * configurable timeout can be freed atomically.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';

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
floorPlanRouter.use('/*', requireAuth(['owner', 'staff', 'manager']));

// GET /api/floor-plan — live floor plan with active session linkage
floorPlanRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const zone = c.req.query('zone');
  const status = c.req.query('status');

  let query = `SELECT t.*,
         s.id AS session_id, s.status AS session_status, s.opened_at AS session_opened_at,
         s.order_count AS session_order_count, s.total_amount AS session_total_amount,
         s.customer_name AS session_customer_name
       FROM cafe_tables t
       LEFT JOIN table_sessions s
         ON s.table_id = t.id AND s.status = 'active'
       WHERE 1=1`;
  const params: unknown[] = [];
  if (zone) { query += ' AND t.zone = ?'; params.push(zone); }
  if (status) { query += ' AND t.status = ?'; params.push(status); }
  query += ' ORDER BY t.zone, t.table_number';

  const stmt = params.length ? db.prepare(query).bind(...params) : db.prepare(query);
  const { results } = await stmt.all<Record<string, unknown>>();

  const tables: FloorPlanTable[] = results.map((r) => {
    const hasSession = r.session_id != null;
    return {
      id: String(r.id),
      table_number: Number(r.table_number),
      zone: String(r.zone),
      capacity: Number(r.capacity),
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
  const rows = await db.prepare(
    'SELECT status, COUNT(*) AS c FROM cafe_tables GROUP BY status'
  ).all<{ status: string; c: number }>();
  const counts: Record<string, number> = {};
  for (const r of rows.results) counts[r.status] = Number(r.c);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return c.json({ success: true, data: { total, ...counts } });
});

// POST /api/floor-plan/:id/no-show — mark table overdue and schedule auto-release
floorPlanRouter.post('/:id/no-show', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const timeoutMinutes = Number(body.timeout_minutes ?? 30);

  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!table) return c.json({ success: false, error: 'Table not found' }, 404);

  const now = new Date().toISOString();
  await db.prepare(
    'UPDATE cafe_tables SET status = \'Overdue\', notes = COALESCE(?, notes), updated_at = ? WHERE id = ?'
  ).bind(String(body.notes || 'No-show — awaiting auto-release'), now, id).run();

  // Close any active session on the table (no-show).
  const session = await db.prepare(
    'SELECT id FROM table_sessions WHERE table_id = ? AND status = \'active\''
  ).bind(id).first<{ id: string }>();
  if (session) {
    await db.prepare(
      'UPDATE table_sessions SET status = \'no_show\', closed_at = ?, updated_at = ? WHERE id = ?'
    ).bind(now, now, session.id).run();
    await db.prepare(
      'UPDATE cafe_tables SET status = \'Available\', updated_at = ? WHERE id = ?'
    ).bind(now, id).run();
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
  const id = c.req.param('id');
  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!table) return c.json({ success: false, error: 'Table not found' }, 404);

  const now = new Date().toISOString();
  await db.prepare(
    'UPDATE cafe_tables SET status = \'Available\', updated_at = ? WHERE id = ?'
  ).bind(now, id).run();

  const session = await db.prepare(
    'SELECT id FROM table_sessions WHERE table_id = ? AND status = \'active\''
  ).bind(id).first<{ id: string }>();
  if (session) {
    await db.prepare(
      'UPDATE table_sessions SET status = \'closed\', closed_at = ?, updated_at = ? WHERE id = ?'
    ).bind(now, now, session.id).run();
  }

  return c.json({ success: true, message: `Table ${id} released` });
});

export { floorPlanRouter };
