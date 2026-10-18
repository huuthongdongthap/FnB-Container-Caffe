import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';
import { getDatabase } from '../../lib/db';

async function writeShiftAuditLog(
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
    ).bind(`audit_${Date.now()}`, userId, action, 'staff_shift', entityId, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, action, 'staff_shift', entityId, metadata, now).run().catch(() => {});
    } catch {
      // Ignore audit log error
    }
  }
}

export function registerShiftHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/staff/shifts - List shifts
  app.openapi(StaffRoutes.shifts.list as any, async (c: any) => {
    const db = getDatabase(c);
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

    const offset = (page - 1) * limit;
    const allowedSorts: Record<string, string> = {
      date: 'ss.date',
      start_time: 'ss.start_time',
      startTime: 'ss.start_time',
      created_at: 'ss.created_at',
      createdAt: 'ss.created_at',
      status: 'ss.status',
    };
    const sortCol = allowedSorts[sort] || 'ss.date';
    const sortDir = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const orderClause = `${sortCol} ${sortDir}`;

    let total = 0;
    let shiftResults: any[] = [];
    try {
      const countResult = (await db.prepare(
        `SELECT COUNT(*) as total FROM staff_shifts ss ${whereClause}`
      ).bind(...params).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const rows = (await db.prepare(
        `SELECT ss.*, u.name as staff_name, z.name as zone_name
         FROM staff_shifts ss
         LEFT JOIN users u ON ss.staff_id = u.id
         LEFT JOIN zones z ON ss.zone_id = z.id
         ${whereClause}
         ORDER BY ${orderClause}
         LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all()) as { results: any[] };
      shiftResults = rows.results || [];
    } catch {
      let canonicalWhere = 'WHERE 1=1';
      const canonicalParams: (string | number)[] = [];
      if (staffId) {
        canonicalWhere += ' AND ss.user_id = ?';
        canonicalParams.push(staffId);
      }
      if (dateFrom) {
        canonicalWhere += ' AND ss.shift_date >= ?';
        canonicalParams.push(dateFrom);
      }
      if (dateTo) {
        canonicalWhere += ' AND ss.shift_date <= ?';
        canonicalParams.push(dateTo);
      }
      if (status) {
        canonicalWhere += ' AND ss.status = ?';
        canonicalParams.push(status);
      }
      const canonicalSort = sortCol === 'ss.date' ? 'ss.shift_date' : sortCol;
      const countResult = (await db.prepare(
        `SELECT COUNT(*) as total FROM shifts ss ${canonicalWhere}`
      ).bind(...canonicalParams).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const rows = (await db.prepare(
        `SELECT ss.*, ss.user_id as staff_id, ss.shift_date as date, u.name as staff_name
         FROM shifts ss
         LEFT JOIN users u ON ss.user_id = u.id
         ${canonicalWhere}
         ORDER BY ${canonicalSort} ${sortDir}
         LIMIT ? OFFSET ?`
      ).bind(...canonicalParams, limit, offset).all()) as { results: any[] };
      shiftResults = rows.results || [];
    }

    return c.json({
      success: true,
      data: { shifts: shiftResults, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // POST /api/staff/shifts - Create shift
  app.openapi(StaffRoutes.shifts.create as any, async (c: any) => {
    const db = getDatabase(c);
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
      let zone: unknown = null;
      try {
        zone = await db.prepare('SELECT id FROM zones WHERE id = ?').bind(body.zoneId).first();
      } catch {
        zone = { id: body.zoneId };
      }
      if (!zone) {
        return c.json({ success: false, error: 'Zone not found' }, 404);
      }
    }

    let usingCanonical = false;
    try {
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
    } catch {
      usingCanonical = true;
      await db.prepare(
        `INSERT INTO shifts (id, user_id, shift_date, start_time, end_time, status, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.staffId,
        body.date,
        body.startTime,
        body.endTime,
        body.status || 'scheduled',
        body.notes || null,
        now
      ).run();
    }

    // Audit log
    await writeShiftAuditLog(db, user.id, 'shift_create', id, JSON.stringify(body), now);

    let created: any = null;
    if (!usingCanonical) {
      created = await db.prepare('SELECT * FROM staff_shifts WHERE id = ?').bind(id).first();
    } else {
      created = await db.prepare('SELECT *, user_id as staff_id, shift_date as date FROM shifts WHERE id = ?').bind(id).first();
    }

    return c.json({ success: true, data: created }, 201);
  });

  // PATCH /api/staff/shifts/:id - Update shift
  app.openapi(StaffRoutes.shifts.update as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingCanonical = false;
    try {
      existing = await db.prepare('SELECT * FROM staff_shifts WHERE id = ?').bind(id).first();
    } catch {
      usingCanonical = true;
      existing = await db.prepare('SELECT *, user_id as staff_id, shift_date as date FROM shifts WHERE id = ?').bind(id).first();
    }
    if (!existing) {
      return c.json({ success: false, error: 'Shift not found' }, 404);
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    const canonicalUpdates: string[] = [];
    const canonicalParams: (string | number | null)[] = [];

    if (body.staffId !== undefined) {
      const staff = await db.prepare('SELECT id FROM users WHERE id = ? AND role != \'customer\'').bind(body.staffId).first();
      if (!staff) return c.json({ success: false, error: 'Staff not found' }, 404);
      updates.push('staff_id = ?'); params.push(body.staffId);
      canonicalUpdates.push('user_id = ?'); canonicalParams.push(body.staffId);
    }
    if (body.zoneId !== undefined) {
      if (body.zoneId) {
        let zone: unknown = null;
        try {
          zone = await db.prepare('SELECT id FROM zones WHERE id = ?').bind(body.zoneId).first();
        } catch {
          zone = { id: body.zoneId };
        }
        if (!zone) return c.json({ success: false, error: 'Zone not found' }, 404);
      }
      updates.push('zone_id = ?'); params.push(body.zoneId);
    }
    if (body.date !== undefined) {
      updates.push('date = ?'); params.push(body.date);
      canonicalUpdates.push('shift_date = ?'); canonicalParams.push(body.date);
    }
    if (body.startTime !== undefined) {
      updates.push('start_time = ?'); params.push(body.startTime);
      canonicalUpdates.push('start_time = ?'); canonicalParams.push(body.startTime);
    }
    if (body.endTime !== undefined) {
      updates.push('end_time = ?'); params.push(body.endTime);
      canonicalUpdates.push('end_time = ?'); canonicalParams.push(body.endTime);
    }
    if (body.status !== undefined) {
      updates.push('status = ?'); params.push(body.status);
      canonicalUpdates.push('status = ?'); canonicalParams.push(body.status);
    }
    if (body.notes !== undefined) {
      updates.push('notes = ?'); params.push(body.notes);
      canonicalUpdates.push('notes = ?'); canonicalParams.push(body.notes);
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    if (!usingCanonical) {
      if (updates.length > 1) {
        await db.prepare(`UPDATE staff_shifts SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      }
    } else if (canonicalUpdates.length > 0) {
      await db.prepare(`UPDATE shifts SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams, id).run();
    }

    // Audit log
    await writeShiftAuditLog(db, user.id, 'shift_update', id, JSON.stringify(body), now);

    let updated: any = null;
    if (!usingCanonical) {
      updated = await db.prepare('SELECT * FROM staff_shifts WHERE id = ?').bind(id).first();
    } else {
      updated = await db.prepare('SELECT *, user_id as staff_id, shift_date as date FROM shifts WHERE id = ?').bind(id).first();
    }

    return c.json({ success: true, data: updated });
  });

  // DELETE /api/staff/shifts/:id - Delete shift
  app.openapi(StaffRoutes.shifts.delete as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const user = c.get('user');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingCanonical = false;
    try {
      existing = await db.prepare('SELECT * FROM staff_shifts WHERE id = ?').bind(id).first();
    } catch {
      usingCanonical = true;
      existing = await db.prepare('SELECT * FROM shifts WHERE id = ?').bind(id).first();
    }
    if (!existing) {
      return c.json({ success: false, error: 'Shift not found' }, 404);
    }

    if (!usingCanonical) {
      await db.prepare('DELETE FROM staff_shifts WHERE id = ?').bind(id).run();
    } else {
      await db.prepare('DELETE FROM shifts WHERE id = ?').bind(id).run();
    }

    // Audit log
    await writeShiftAuditLog(db, user.id, 'shift_delete', id, JSON.stringify({}), now);

    return c.json({ success: true, data: { success: true } });
  });
}

