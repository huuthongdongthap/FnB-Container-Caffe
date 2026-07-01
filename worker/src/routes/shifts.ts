/**
 * Shifts Routes — /api/shifts
 * Staff clock-in/out tracking.
 */

import { Hono } from 'hono';
import { clockInSchema, clockOutSchema } from '../lib/validators';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth.js';

interface ShiftRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  date: string;
  notes: string | null;
}

export const shiftsRouter = new Hono<{ Bindings: Env }>();

// POST /api/shifts/clock-in
shiftsRouter.post('/clock-in', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = clockInSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const data = parsed.data;
  const id = 'shift_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Check if already clocked in today
  const existing = await db.prepare(
    'SELECT id FROM shifts WHERE staff_id = ? AND date = ? AND clock_out IS NULL'
  ).bind(data.staff_id, today).first<{ id: string }>();

  if (existing) {
    return c.json({ success: false, error: 'Already clocked in today' }, 400);
  }

  await db.prepare(
    'INSERT INTO shifts (id, staff_id, staff_name, clock_in, date, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, data.staff_id, data.staff_name || '', now, today, data.notes || '').run();

  const row = await db.prepare('SELECT * FROM shifts WHERE id = ?').bind(id).first<ShiftRecord>();
  return c.json({ success: true, data: row }, 201);
});

// POST /api/shifts/clock-out
shiftsRouter.post('/clock-out', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = clockOutSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const data = parsed.data;
  const today = new Date().toISOString().slice(0, 10);

  const shift = await db.prepare(
    'SELECT * FROM shifts WHERE staff_id = ? AND date = ? AND clock_out IS NULL'
  ).bind(data.staff_id, today).first<ShiftRecord>();

  if (!shift) {
    return c.json({ success: false, error: 'No active shift found' }, 404);
  }

  const now = new Date().toISOString();
  const clockInTime = new Date(shift.clock_in).getTime();
  const hoursWorked = Math.round((Date.now() - clockInTime) / 3600000 * 100) / 100;

  await db.prepare(
    'UPDATE shifts SET clock_out = ?, hours_worked = ? WHERE id = ?'
  ).bind(now, hoursWorked, shift.id).run();

  const row = await db.prepare('SELECT * FROM shifts WHERE id = ?').bind(shift.id).first<ShiftRecord>();
  return c.json({ success: true, data: row });
});

// GET /api/shifts — list shifts
shiftsRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const dateFrom = c.req.query('from');
  const dateTo = c.req.query('to');
  const staffId = c.req.query('staff_id');

  let query = 'SELECT * FROM shifts WHERE 1=1';
  const params: unknown[] = [];

  if (dateFrom) { query += ' AND date >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND date <= ?'; params.push(dateTo); }
  if (staffId) { query += ' AND staff_id = ?'; params.push(staffId); }
  query += ' ORDER BY date DESC, clock_in DESC LIMIT 100';

  const { results } = await db.prepare(query).bind(...params).all<ShiftRecord>();
  return c.json({ success: true, data: results || [] });
});
