/**
 * Shifts Routes — /api/shifts
 * Staff clock-in/out tracking.
 */

import { Hono } from 'hono';
import { clockInSchema, clockOutSchema } from 'worker/src/lib/validators';
import type { Env } from 'worker/src/types/env';
import { requireAuth } from 'worker/src/middleware/auth';
import type { ShiftRecord } from '../model/shift-types';

export const shiftsRouter = new Hono<{ Bindings: Env }>();

const shiftStaffAuth = requireAuth([
  'owner',
  'manager',
  'staff',
  'admin',
  'waiter',
  'cashier',
  'kitchen',
  'barista',
  'chef',
]);

// POST /api/shifts/clock-in
shiftsRouter.post('/clock-in', shiftStaffAuth, async (c) => {
  try {
    const db = c.env.AURA_DB;
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = clockInSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    }
    const data = parsed.data;
    const id = 'shift_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // Check if already clocked in today
    let existing: { id: string } | null = null;
    try {
      existing = await db.prepare(
        'SELECT id FROM shifts WHERE staff_id = ? AND date = ? AND clock_out IS NULL'
      ).bind(data.staff_id, today).first<{ id: string }>();
    } catch {
      existing = await db.prepare(
        'SELECT id FROM shifts WHERE staff_id = ? AND date = ? AND actual_end IS NULL'
      ).bind(data.staff_id, today).first<{ id: string }>();
    }

    if (existing) {
      return c.json({ success: false, error: 'Already clocked in today' }, 400);
    }

    try {
      await db.prepare(
        'INSERT INTO shifts (id, staff_id, staff_name, clock_in, date, notes) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, data.staff_id, data.staff_name || '', now, today, data.notes || '').run();
    } catch {
      await db.prepare(
        `INSERT INTO shifts (id, staff_id, staff_name, date, start_time, end_time, actual_start, status, notes)
         VALUES (?, ?, ?, ?, ?, '23:59', ?, 'active', ?)`
      ).bind(id, data.staff_id, data.staff_name || '', today, now.slice(11, 16), now, data.notes || '').run();
    }

    const row = await db.prepare('SELECT * FROM shifts WHERE id = ?').bind(id).first<ShiftRecord>();
    return c.json({ success: true, data: row }, 201);
  } catch {
    return c.json({ success: false, error: 'Clock-in failed' }, 500);
  }
});

// POST /api/shifts/clock-out
shiftsRouter.post('/clock-out', shiftStaffAuth, async (c) => {
  try {
    const db = c.env.AURA_DB;
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = clockOutSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    }
    const data = parsed.data;
    const today = new Date().toISOString().slice(0, 10);

    let shift: ShiftRecord | null = null;
    try {
      shift = await db.prepare(
        'SELECT * FROM shifts WHERE staff_id = ? AND date = ? AND clock_out IS NULL'
      ).bind(data.staff_id, today).first<ShiftRecord>();

      if (!shift) {
        shift = await db.prepare(
          'SELECT * FROM shifts WHERE staff_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1'
        ).bind(data.staff_id).first<ShiftRecord>();
      }
    } catch {
      shift = await db.prepare(
        'SELECT *, COALESCE(actual_start, start_time) AS clock_in, actual_end AS clock_out FROM shifts WHERE staff_id = ? AND date = ? AND actual_end IS NULL'
      ).bind(data.staff_id, today).first<ShiftRecord>();

      if (!shift) {
        shift = await db.prepare(
          'SELECT *, COALESCE(actual_start, start_time) AS clock_in, actual_end AS clock_out FROM shifts WHERE staff_id = ? AND actual_end IS NULL ORDER BY actual_start DESC LIMIT 1'
        ).bind(data.staff_id).first<ShiftRecord>();
      }
    }

    if (!shift) {
      return c.json({ success: false, error: 'No active shift found' }, 404);
    }

    const now = new Date().toISOString();
    const rawClockIn = shift.clock_in || ((shift as unknown as Record<string, unknown>).actual_start as string) || now;
    const clockInTime = new Date(rawClockIn).getTime();
    const rawHours = Math.round((Date.now() - clockInTime) / 3600000 * 100) / 100;
    const hoursWorked = Math.min(24, Math.max(0, rawHours));

    try {
      await db.prepare(
        'UPDATE shifts SET clock_out = ?, hours_worked = ? WHERE id = ?'
      ).bind(now, hoursWorked, shift.id).run();
    } catch {
      await db.prepare(
        "UPDATE shifts SET actual_end = ?, status = 'completed' WHERE id = ?"
      ).bind(now, shift.id).run();
    }

    const row = await db.prepare('SELECT * FROM shifts WHERE id = ?').bind(shift.id).first<ShiftRecord>();
    return c.json({ success: true, data: row });
  } catch {
    return c.json({ success: false, error: 'Clock-out failed' }, 500);
  }
});

// GET /api/shifts/today — today's shifts
shiftsRouter.get('/today', shiftStaffAuth, async (c) => {
  try {
    const db = c.env.AURA_DB;
    const today = new Date().toISOString().slice(0, 10);

    let results: ShiftRecord[] = [];
    try {
      const res = await db.prepare(
        'SELECT * FROM shifts WHERE date = ? ORDER BY clock_in DESC'
      ).bind(today).all<ShiftRecord>();
      results = res.results || [];
    } catch {
      const res = await db.prepare(
        'SELECT *, COALESCE(actual_start, start_time) AS clock_in, actual_end AS clock_out FROM shifts WHERE date = ? ORDER BY COALESCE(actual_start, start_time) DESC'
      ).bind(today).all<ShiftRecord>();
      results = res.results || [];
    }

    return c.json({ success: true, data: results });
  } catch {
    return c.json({ success: false, error: 'Failed to load shifts' }, 500);
  }
});

// GET /api/shifts — list shifts
shiftsRouter.get('/', shiftStaffAuth, async (c) => {
  try {
    const db = c.env.AURA_DB;
    const dateFrom = c.req.query('from');
    const dateTo = c.req.query('to');
    const staffId = c.req.query('staff_id');

    let whereClause = ' WHERE 1=1';
    const params: unknown[] = [];

    if (dateFrom) {
      whereClause += ' AND date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClause += ' AND date <= ?';
      params.push(dateTo);
    }
    if (staffId) {
      whereClause += ' AND staff_id = ?';
      params.push(staffId);
    }

    let results: ShiftRecord[] = [];
    try {
      const query = `SELECT * FROM shifts${whereClause} ORDER BY date DESC, clock_in DESC LIMIT 100`;
      const res = await db.prepare(query).bind(...params).all<ShiftRecord>();
      results = res.results || [];
    } catch {
      const fallbackQuery = `SELECT *, COALESCE(actual_start, start_time) AS clock_in, actual_end AS clock_out FROM shifts${whereClause} ORDER BY date DESC, COALESCE(actual_start, start_time) DESC LIMIT 100`;
      const res = await db.prepare(fallbackQuery).bind(...params).all<ShiftRecord>();
      results = res.results || [];
    }

    return c.json({ success: true, data: results });
  } catch {
    return c.json({ success: false, error: 'Failed to load shifts' }, 500);
  }
});
