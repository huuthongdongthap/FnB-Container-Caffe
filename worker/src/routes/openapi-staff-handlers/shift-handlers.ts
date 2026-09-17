import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';

export function registerShiftHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/staff/shifts - List shifts
  app.openapi(StaffRoutes.shifts.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'date', order = 'desc', staffId, zoneId, dateFrom, dateTo, status } = query;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (staffId) {
      whereClause += ' AND ss.staff_id = ?';
      params.push(staffId);
    }
    if (zoneId) {
      whereClause += ' AND ss.zone_id = ?';
      params.push(zoneId);
    }
    if (dateFrom) {
      whereClause += ' AND ss.date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClause += ' AND ss.date <= ?';
      params.push(dateTo);
    }
    if (status) {
      whereClause += ' AND ss.status = ?';
      params.push(status);
    }

    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM staff_shifts ss ${whereClause}`
    ).bind(...params).first();
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = await db.prepare(
      `SELECT ss.*, u.name as staff_name, z.name as zone_name
       FROM staff_shifts ss
       LEFT JOIN users u ON ss.staff_id = u.id
       LEFT JOIN zones z ON ss.zone_id = z.id
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return c.json({
      success: true,
      data: { shifts: rows.results, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // POST /api/staff/shifts - Create shift
  app.openapi(StaffRoutes.shifts.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const id = crypto.randomUUID();

    // Check staff exists
    const staff = await db.prepare('SELECT id FROM users WHERE id = ? AND role != \'customer\'').bind(body.staffId).first();
    if (!staff) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }

    // Check zone if provided
    if (body.zoneId) {
      const zone = await db.prepare('SELECT id FROM zones WHERE id = ?').bind(body.zoneId).first();
      if (!zone) {
        return c.json({ success: false, error: 'Zone not found' }, 404);
      }
    }

    await db.prepare(
      `INSERT INTO staff_shifts (id, staff_id, zone_id, date, start_time, end_time, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.staffId,
      body.zoneId || null,
      body.date,
      body.startTime,
      body.endTime,
      body.status || 'scheduled',
      body.notes || null,
      now,
      now
    ).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'shift_create', 'staff_shift', id, JSON.stringify(body), now).run();

    const created = await db.prepare('SELECT * FROM staff_shifts WHERE id = ?').bind(id).first();

    return c.json({ success: true, data: created }, 201);
  });

  // PATCH /api/staff/shifts/:id - Update shift
  app.openapi(StaffRoutes.shifts.update, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM staff_shifts WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Shift not found' }, 404);
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (body.staffId !== undefined) {
      const staff = await db.prepare('SELECT id FROM users WHERE id = ? AND role != \'customer\'').bind(body.staffId).first();
      if (!staff) return c.json({ success: false, error: 'Staff not found' }, 404);
      updates.push('staff_id = ?'); params.push(body.staffId);
    }
    if (body.zoneId !== undefined) {
      if (body.zoneId) {
        const zone = await db.prepare('SELECT id FROM zones WHERE id = ?').bind(body.zoneId).first();
        if (!zone) return c.json({ success: false, error: 'Zone not found' }, 404);
      }
      updates.push('zone_id = ?'); params.push(body.zoneId);
    }
    if (body.date !== undefined) { updates.push('date = ?'); params.push(body.date); }
    if (body.startTime !== undefined) { updates.push('start_time = ?'); params.push(body.startTime); }
    if (body.endTime !== undefined) { updates.push('end_time = ?'); params.push(body.endTime); }
    if (body.status !== undefined) { updates.push('status = ?'); params.push(body.status); }
    if (body.notes !== undefined) { updates.push('notes = ?'); params.push(body.notes); }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    if (updates.length > 1) {
      await db.prepare(`UPDATE staff_shifts SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'shift_update', 'staff_shift', id, JSON.stringify(body), now).run();

    const updated = await db.prepare('SELECT * FROM staff_shifts WHERE id = ?').bind(id).first();

    return c.json({ success: true, data: updated });
  });

  // DELETE /api/staff/shifts/:id - Delete shift
  app.openapi(StaffRoutes.shifts.delete, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM staff_shifts WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Shift not found' }, 404);
    }

    await db.prepare('DELETE FROM staff_shifts WHERE id = ?').bind(id).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'shift_delete', 'staff_shift', id, JSON.stringify({}), now).run();

    return c.json({ success: true, data: { success: true } });
  });
}