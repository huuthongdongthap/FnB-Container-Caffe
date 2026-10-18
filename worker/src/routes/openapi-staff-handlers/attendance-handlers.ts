import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';
import { getDatabase } from '../../lib/db';

async function writeAttendanceAuditLog(
  db: any,
  userId: string,
  action: string,
  entityId: string,
  metadata: string,
  now: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, userId, action, 'staff_attendance', entityId, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, action, 'staff_attendance', entityId, metadata, now).run().catch(() => {});
    } catch {
      // Ignore audit log error
    }
  }
}

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
    let existing: any = null;
    let usingCanonical = false;
    try {
      existing = await db.prepare(
        'SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ? AND check_in IS NOT NULL AND check_out IS NULL'
      ).bind(body.staffId, today).first();
    } catch {
      usingCanonical = true;
      existing = await db.prepare(
        'SELECT * FROM shifts WHERE user_id = ? AND shift_date = ? AND actual_start IS NOT NULL AND actual_end IS NULL'
      ).bind(body.staffId, today).first().catch(() => null);
    }

    if (existing) {
      return c.json({ success: false, error: 'Already checked in' }, 409);
    }

    // Determine status (on_time, late) based on scheduled shift
    let status = 'on_time';
    let shift: any = null;
    try {
      shift = await db.prepare(
        'SELECT * FROM staff_shifts WHERE staff_id = ? AND date = ?'
      ).bind(body.staffId, today).first();
    } catch {
      shift = await db.prepare(
        'SELECT * FROM shifts WHERE user_id = ? AND shift_date = ?'
      ).bind(body.staffId, today).first().catch(() => null);
    }

    if (shift && typeof shift.start_time === 'string') {
      const shiftStart = shift.start_time;
      if (currentTime > shiftStart) {
        status = 'late';
      }
    }

    const id = shift?.id && usingCanonical ? shift.id : crypto.randomUUID();

    if (!usingCanonical) {
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
    } else if (shift?.id) {
      await db.prepare(
        'UPDATE shifts SET actual_start = ?, status = \'active\', notes = COALESCE(?, notes) WHERE id = ?'
      ).bind(currentTime, body.notes || null, shift.id).run();
    } else {
      await db.prepare(
        `INSERT INTO shifts (id, user_id, shift_date, start_time, end_time, actual_start, status, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
      ).bind(id, body.staffId, today, currentTime, '23:59:00', currentTime, body.notes || null, now).run();
    }

    // Audit log
    await writeAttendanceAuditLog(db, user.id, 'attendance_check_in', id, JSON.stringify({ staffId: body.staffId, status }), now);

    let created: any = null;
    if (!usingCanonical) {
      created = await db.prepare('SELECT * FROM staff_attendance WHERE id = ?').bind(id).first();
    } else {
      created = await db.prepare(
        'SELECT id, user_id as staff_id, id as shift_id, shift_date as date, actual_start as check_in, actual_end as check_out, status, notes, created_at FROM shifts WHERE id = ?'
      ).bind(id).first();
      if (created) {
        created = { ...created, status };
      }
    }

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
    let active: any = null;
    let usingCanonical = false;
    try {
      active = await db.prepare(
        'SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ? AND check_out IS NULL'
      ).bind(body.staffId, today).first();
    } catch {
      usingCanonical = true;
      active = await db.prepare(
        'SELECT id, user_id as staff_id, shift_date as date, actual_start as check_in, actual_end as check_out, notes FROM shifts WHERE user_id = ? AND shift_date = ? AND actual_start IS NOT NULL AND actual_end IS NULL'
      ).bind(body.staffId, today).first();
    }

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

    if (!usingCanonical) {
      await db.prepare(
        `UPDATE staff_attendance
         SET check_out = ?, total_hours = ?, notes = ?, updated_at = ?
         WHERE id = ?`
      ).bind(currentTime, Math.round(totalHours * 100) / 100, notes, now, active.id).run();
    } else {
      await db.prepare(
        'UPDATE shifts SET actual_end = ?, status = \'completed\', notes = ? WHERE id = ?'
      ).bind(currentTime, notes, active.id).run();
    }

    // Audit log
    await writeAttendanceAuditLog(db, user.id, 'attendance_check_out', active.id, JSON.stringify({ staffId: body.staffId, totalHours }), now);

    let updated: any = null;
    if (!usingCanonical) {
      updated = await db.prepare('SELECT * FROM staff_attendance WHERE id = ?').bind(active.id).first();
    } else {
      updated = await db.prepare(
        'SELECT id, user_id as staff_id, id as shift_id, shift_date as date, actual_start as check_in, actual_end as check_out, status, notes, created_at FROM shifts WHERE id = ?'
      ).bind(active.id).first();
      if (updated) {
        updated = { ...updated, total_hours: Math.round(totalHours * 100) / 100 };
      }
    }

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

    const offset = (page - 1) * limit;
    const allowedSorts: Record<string, string> = {
      date: 'sa.date',
      check_in: 'sa.check_in',
      checkIn: 'sa.check_in',
      created_at: 'sa.created_at',
      createdAt: 'sa.created_at',
      status: 'sa.status',
    };
    const sortCol = allowedSorts[sort] || 'sa.date';
    const sortDir = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const orderClause = `${sortCol} ${sortDir}`;

    let total = 0;
    let attendanceResults: any[] = [];
    try {
      const countResult = (await db.prepare(
        `SELECT COUNT(*) as total FROM staff_attendance sa ${whereClause}`
      ).bind(...params).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const rows = (await db.prepare(
        `SELECT sa.*, u.name as staff_name, ss.start_time as scheduled_start, ss.end_time as scheduled_end
         FROM staff_attendance sa
         LEFT JOIN users u ON sa.staff_id = u.id
         LEFT JOIN staff_shifts ss ON sa.shift_id = ss.id
         ${whereClause}
         ORDER BY ${orderClause}
         LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all()) as { results: any[] };
      attendanceResults = rows.results || [];
    } catch {
      let canonicalWhere = 'WHERE sa.actual_start IS NOT NULL';
      const canonicalParams: (string | number)[] = [];
      if (staffId) {
        canonicalWhere += ' AND sa.user_id = ?';
        canonicalParams.push(staffId);
      }
      if (dateFrom) {
        canonicalWhere += ' AND sa.shift_date >= ?';
        canonicalParams.push(dateFrom);
      }
      if (dateTo) {
        canonicalWhere += ' AND sa.shift_date <= ?';
        canonicalParams.push(dateTo);
      }
      if (status) {
        canonicalWhere += ' AND sa.status = ?';
        canonicalParams.push(status);
      }
      const countResult = (await db.prepare(
        `SELECT COUNT(*) as total FROM shifts sa ${canonicalWhere}`
      ).bind(...canonicalParams).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const rows = (await db.prepare(
        `SELECT sa.id, sa.user_id as staff_id, sa.id as shift_id, sa.shift_date as date, sa.actual_start as check_in, sa.actual_end as check_out, sa.status, sa.notes, sa.created_at, u.name as staff_name, sa.start_time as scheduled_start, sa.end_time as scheduled_end
         FROM shifts sa
         LEFT JOIN users u ON sa.user_id = u.id
         ${canonicalWhere}
         ORDER BY sa.shift_date ${sortDir}
         LIMIT ? OFFSET ?`
      ).bind(...canonicalParams, limit, offset).all()) as { results: any[] };
      attendanceResults = rows.results || [];
    }

    return c.json({
      success: true,
      data: { attendance: attendanceResults, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });
}

