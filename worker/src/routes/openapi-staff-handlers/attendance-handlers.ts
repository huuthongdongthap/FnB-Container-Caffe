import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';

export function registerAttendanceHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/staff/attendance/check-in - Check in
  app.openapi(StaffRoutes.attendance.checkIn, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const currentTime = now.slice(11, 19);

    // Check if staff exists
    const staff = await db.prepare('SELECT id FROM users WHERE id = ? AND role != \'customer\'').bind(body.staffId).first();
    if (!staff) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }

    // Check for existing check-in today
    const existing = await db.prepare(
      'SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ? AND check_in IS NOT NULL AND check_out IS NULL'
    ).bind(body.staffId, today).first();

    if (existing) {
      return c.json({ success: false, error: 'Already checked in' }, 409);
    }

    // Determine status (on_time, late) based on scheduled shift
    let status = 'on_time';
    const shift = await db.prepare(
      'SELECT * FROM staff_shifts WHERE staff_id = ? AND date = ?'
    ).bind(body.staffId, today).first();

    if (shift && typeof shift.start_time === 'string') {
      const shiftStart = shift.start_time;
      if (currentTime > shiftStart) {
        status = 'late';
      }
    }

    const id = crypto.randomUUID();

    await db.prepare(
      `INSERT INTO staff_attendance (id, staff_id, shift_id, date, check_in, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.staffId,
      shift?.id || null,
      today,
      currentTime,
      status,
      body.notes || null,
      now,
      now
    ).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'attendance_check_in', 'staff_attendance', id, JSON.stringify({ staffId: body.staffId, status }), now).run();

    const created = await db.prepare('SELECT * FROM staff_attendance WHERE id = ?').bind(id).first();

    return c.json({ success: true, data: created }, 201);
  });

  // POST /api/staff/attendance/check-out - Check out
  app.openapi(StaffRoutes.attendance.checkOut, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const currentTime = now.slice(11, 19);

    // Find active check-in
    const active = await db.prepare(
      'SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ? AND check_out IS NULL'
    ).bind(body.staffId, today).first();

    if (!active) {
      return c.json({ success: false, error: 'No active check-in found' }, 404);
    }

    // Calculate total hours
    const checkInTime = active.check_in as string;
    const [inHours, inMinutes, inSeconds = '0'] = checkInTime.split(':').map(Number);
    const [outHours, outMinutes, outSeconds = '0'] = currentTime.split(':').map(Number);

    const inTotalSeconds = inHours * 3600 + inMinutes * 60 + inSeconds;
    const outTotalSeconds = outHours * 3600 + outMinutes * 60 + outSeconds;
    const totalHours = Math.max(0, (outTotalSeconds - inTotalSeconds) / 3600);

    const notes = body.notes ? (active.notes ? `${active.notes}; ${body.notes}` : body.notes) : active.notes;

    await db.prepare(
      `UPDATE staff_attendance
       SET check_out = ?, total_hours = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    ).bind(currentTime, Math.round(totalHours * 100) / 100, notes, now, active.id).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'attendance_check_out', 'staff_attendance', active.id, JSON.stringify({ staffId: body.staffId, totalHours }), now).run();

    const updated = await db.prepare('SELECT * FROM staff_attendance WHERE id = ?').bind(active.id).first();

    return c.json({ success: true, data: updated });
  });

  // GET /api/staff/attendance - List attendance
  app.openapi(StaffRoutes.attendance.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'date', order = 'desc', staffId, dateFrom, dateTo, status } = query;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (staffId) {
      whereClause += ' AND sa.staff_id = ?';
      params.push(staffId);
    }
    if (dateFrom) {
      whereClause += ' AND sa.date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClause += ' AND sa.date <= ?';
      params.push(dateTo);
    }
    if (status) {
      whereClause += ' AND sa.status = ?';
      params.push(status);
    }

    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM staff_attendance sa ${whereClause}`
    ).bind(...params).first();
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = await db.prepare(
      `SELECT sa.*, u.name as staff_name, ss.start_time as scheduled_start, ss.end_time as scheduled_end
       FROM staff_attendance sa
       LEFT JOIN users u ON sa.staff_id = u.id
       LEFT JOIN staff_shifts ss ON sa.shift_id = ss.id
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return c.json({
      success: true,
      data: { attendance: rows.results, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });
}