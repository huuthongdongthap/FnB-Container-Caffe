import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';
import { getDatabase } from '../../lib/db';

export function registerAttendanceHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/staff/attendance/check-in - Check in
  app.openapi(StaffRoutes.attendance.checkIn as any, async (c: any) => {
    const db = getDatabase(c);
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
    const shift = (await db.prepare(
      'SELECT * FROM staff_shifts WHERE staff_id = ? AND date = ?'
    ).bind(body.staffId, today).first()) as any;

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
  app.openapi(StaffRoutes.attendance.checkOut as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const currentTime = now.slice(11, 19);

    // Find active check-in
    const active = (await db.prepare(
      'SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ? AND check_out IS NULL'
    ).bind(body.staffId, today).first()) as any;

    if (!active) {
      return c.json({ success: false, error: 'No active check-in found' }, 404);
    }

    // Calculate total hours
    const checkInTime = active.check_in as string;
    const [inHours = 0, inMinutes = 0, inSeconds = 0] = checkInTime.split(':').map(Number);
    const [outHours = 0, outMinutes = 0, outSeconds = 0] = currentTime.split(':').map(Number);

    const inTotalSeconds = (inHours || 0) * 3600 + (inMinutes || 0) * 60 + (inSeconds || 0);
    const outTotalSeconds = (outHours || 0) * 3600 + (outMinutes || 0) * 60 + (outSeconds || 0);
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
  app.openapi(StaffRoutes.attendance.list as any, async (c: any) => {
    const db = getDatabase(c);
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

    const countResult = (await db.prepare(
      `SELECT COUNT(*) as total FROM staff_attendance sa ${whereClause}`
    ).bind(...params).first()) as { total: number } | null;
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = (await db.prepare(
      `SELECT sa.*, u.name as staff_name, ss.start_time as scheduled_start, ss.end_time as scheduled_end
       FROM staff_attendance sa
       LEFT JOIN users u ON sa.staff_id = u.id
       LEFT JOIN staff_shifts ss ON sa.shift_id = ss.id
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all()) as { results: any[] };

    return c.json({
      success: true,
      data: { attendance: rows.results || [], meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });
}

