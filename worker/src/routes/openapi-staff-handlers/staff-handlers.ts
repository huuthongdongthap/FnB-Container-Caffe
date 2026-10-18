import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';
import { getDatabase } from '../../lib/db';
import { hashPassword } from '../../lib/jwt';

export { hashPassword };

async function writeStaffAuditLog(
  db: any,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: string,
  now: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, userId, action, entityType, entityId, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, action, entityType, entityId, metadata, now).run().catch(() => {});
    } catch {
      // Ignore audit log error
    }
  }
}

export function registerStaffHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/staff - List staff
  app.openapi(StaffRoutes.list as any, async (c: any) => {
    const db = getDatabase(c);
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'name', order = 'asc', role, isActive, search } = query;

    let whereClause = 'WHERE role != \'customer\'';
    const params: (string | number)[] = [];

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }
    if (isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(isActive ? 1 : 0);
    }
    if (search) {
      whereClause += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const offset = (page - 1) * limit;
    const allowedSorts: Record<string, string> = {
      name: 'name',
      email: 'email',
      role: 'role',
      hire_date: 'hire_date',
      hireDate: 'hire_date',
      created_at: 'created_at',
      createdAt: 'created_at',
    };
    const sortCol = allowedSorts[sort] || 'name';
    const sortDir = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderClause = `${sortCol} ${sortDir}`;

    let total = 0;
    let rawRows: any[] = [];
    try {
      const countResult = (await db.prepare(
        `SELECT COUNT(*) as total FROM users ${whereClause}`
      ).bind(...params).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const rows = (await db.prepare(
        `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
         FROM users ${whereClause}
         ORDER BY ${orderClause}
         LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all()) as { results: any[] };
      rawRows = rows.results || [];
    } catch {
      let canonicalWhere = 'WHERE role != \'customer\'';
      const canonicalParams: (string | number)[] = [];
      if (role) {
        canonicalWhere += ' AND role = ?';
        canonicalParams.push(role);
      }
      if (isActive !== undefined) {
        canonicalWhere += ' AND is_active = ?';
        canonicalParams.push(isActive ? 1 : 0);
      }
      if (search) {
        canonicalWhere += ' AND (name LIKE ? OR phone LIKE ?)';
        canonicalParams.push(`%${search}%`, `%${search}%`);
      }
      const canonicalSort = ['name', 'role', 'created_at'].includes(sortCol) ? sortCol : 'name';
      const countResult = (await db.prepare(
        `SELECT COUNT(*) as total FROM users ${canonicalWhere}`
      ).bind(...canonicalParams).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const rows = (await db.prepare(
        `SELECT id, phone, name, role, is_active, created_at, updated_at
         FROM users ${canonicalWhere}
         ORDER BY ${canonicalSort} ${sortDir}
         LIMIT ? OFFSET ?`
      ).bind(...canonicalParams, limit, offset).all()) as { results: any[] };
      rawRows = rows.results || [];
    }

    const staff = rawRows.map((s: any) => ({
      ...s,
      role: s.role,
      locale: s.locale ?? 'vi',
      isActive: s.is_active === 1,
      hireDate: s.hire_date ?? null,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return c.json({
      success: true,
      data: { staff, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/staff/:id - Get staff by ID
  app.openapi(StaffRoutes.get as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');

    let staff: any = null;
    try {
      staff = await db.prepare(
        `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
         FROM users WHERE id = ? AND role != 'customer'`
      ).bind(id).first();
    } catch {
      staff = await db.prepare(
        `SELECT id, phone, name, role, is_active, created_at, updated_at
         FROM users WHERE id = ? AND role != 'customer'`
      ).bind(id).first();
    }

    if (!staff) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }

    // Get shifts for this staff
    let shiftResults: any[] = [];
    try {
      const shifts = (await db.prepare(
        'SELECT * FROM staff_shifts WHERE staff_id = ? ORDER BY date DESC, start_time DESC LIMIT 10'
      ).bind(id).all()) as { results: any[] };
      shiftResults = shifts.results || [];
    } catch {
      try {
        const shifts = (await db.prepare(
          'SELECT *, user_id as staff_id, shift_date as date FROM shifts WHERE user_id = ? ORDER BY shift_date DESC, start_time DESC LIMIT 10'
        ).bind(id).all()) as { results: any[] };
        shiftResults = shifts.results || [];
      } catch {
        shiftResults = [];
      }
    }

    // Get attendance for this staff
    let attendanceResults: any[] = [];
    try {
      const attendance = (await db.prepare(
        'SELECT * FROM staff_attendance WHERE staff_id = ? ORDER BY date DESC LIMIT 10'
      ).bind(id).all()) as { results: any[] };
      attendanceResults = attendance.results || [];
    } catch {
      try {
        const attendance = (await db.prepare(
          'SELECT id, user_id as staff_id, id as shift_id, shift_date as date, actual_start as check_in, actual_end as check_out, status, notes, created_at FROM shifts WHERE user_id = ? AND actual_start IS NOT NULL ORDER BY shift_date DESC LIMIT 10'
        ).bind(id).all()) as { results: any[] };
        attendanceResults = attendance.results || [];
      } catch {
        attendanceResults = [];
      }
    }

    return c.json({
      success: true,
      data: {
        ...staff,
        role: staff.role,
        locale: staff.locale ?? 'vi',
        isActive: staff.is_active === 1,
        hireDate: staff.hire_date ?? null,
        createdAt: staff.created_at,
        updatedAt: staff.updated_at,
        recentShifts: shiftResults,
        recentAttendance: attendanceResults,
      },
    });
  });

  // POST /api/staff - Create staff
  app.openapi(StaffRoutes.create as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    if (body.role === 'owner' && user?.role !== 'owner') {
      return c.json({ success: false, error: 'Only owners can create owner accounts' }, 403);
    }

    // Check if email exists
    let existing: unknown = null;
    try {
      existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(body.email).first();
    } catch {
      if (body.phone) {
        existing = await db.prepare('SELECT id FROM users WHERE phone = ?').bind(body.phone).first().catch(() => null);
      }
    }
    if (existing) {
      return c.json({ success: false, error: 'Email already exists' }, 409);
    }

    const passwordHash = await hashPassword(body.password);
    const id = crypto.randomUUID();

    try {
      await db.prepare(
        `INSERT INTO users (id, name, email, phone, password_hash, role, locale, is_active, avatar_url, hire_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.name,
        body.email,
        body.phone || null,
        passwordHash,
        body.role,
        body.locale || 'vi',
        body.isActive !== false ? 1 : 0,
        null,
        body.hireDate || now.slice(0, 10),
        now,
        now
      ).run();
    } catch {
      await db.prepare(
        `INSERT INTO users (id, phone, name, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.phone || body.email || id,
        body.name,
        body.role,
        body.isActive !== false ? 1 : 0,
        now,
        now
      ).run();
    }

    // Audit log (redact password)
    const { password: _redactedPassword, ...auditCreateBody } = body;
    await writeStaffAuditLog(db, user.id, 'staff_create', 'user', id, JSON.stringify(auditCreateBody), now);

    let created: any = null;
    try {
      created = await db.prepare(
        `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
         FROM users WHERE id = ?`
      ).bind(id).first();
    } catch {
      created = await db.prepare(
        `SELECT id, phone, name, role, is_active, created_at, updated_at
         FROM users WHERE id = ?`
      ).bind(id).first();
    }

    return c.json({
      success: true,
      data: {
        ...created!,
        email: created?.email ?? body.email,
        role: created!.role,
        locale: created?.locale ?? body.locale ?? 'vi',
        isActive: created!.is_active === 1,
        hireDate: created?.hire_date ?? body.hireDate ?? now.slice(0, 10),
        createdAt: created!.created_at,
        updatedAt: created!.updated_at,
      },
    }, 201);
  });

  // PATCH /api/staff/:id - Update staff
  app.openapi(StaffRoutes.update as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM users WHERE id = ? AND role != \'customer\'').bind(id).first()) as any;
    if (!existing) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }

    if ((existing.role === 'owner' || body.role === 'owner') && user?.role !== 'owner') {
      return c.json({ success: false, error: 'Only owners can modify or assign owner accounts' }, 403);
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    const canonicalUpdates: string[] = [];
    const canonicalParams: (string | number | null)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      params.push(body.name);
      canonicalUpdates.push('name = ?');
      canonicalParams.push(body.name);
    }
    if (body.email !== undefined) {
      let emailExists: unknown = null;
      try {
        emailExists = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(body.email, id).first();
      } catch {
        emailExists = null;
      }
      if (emailExists) {
        return c.json({ success: false, error: 'Email already exists' }, 409);
      }
      updates.push('email = ?'); params.push(body.email);
    }
    if (body.phone !== undefined) {
      updates.push('phone = ?');
      params.push(body.phone);
      canonicalUpdates.push('phone = ?');
      canonicalParams.push(body.phone);
    }
    if (body.role !== undefined) {
      updates.push('role = ?');
      params.push(body.role);
      canonicalUpdates.push('role = ?');
      canonicalParams.push(body.role);
    }
    if (body.locale !== undefined) { updates.push('locale = ?'); params.push(body.locale); }
    if (body.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(body.isActive ? 1 : 0);
      canonicalUpdates.push('is_active = ?');
      canonicalParams.push(body.isActive ? 1 : 0);
    }
    if (body.avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(body.avatarUrl); }
    if (body.hireDate !== undefined) { updates.push('hire_date = ?'); params.push(body.hireDate); }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    canonicalUpdates.push('updated_at = ?');
    canonicalParams.push(now);
    canonicalParams.push(id);

    if (updates.length > 1) {
      try {
        await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      } catch {
        if (canonicalUpdates.length > 1) {
          await db.prepare(`UPDATE users SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams).run();
        }
      }
    }

    // Sync with staff_users table if present
    try {
      const staffUpdates: string[] = [];
      const staffParams: (string | number | null)[] = [];
      if (body.name !== undefined) { staffUpdates.push('name = ?'); staffParams.push(body.name); }
      if (body.email !== undefined) { staffUpdates.push('email = ?'); staffParams.push(body.email); }
      if (body.phone !== undefined) { staffUpdates.push('phone = ?'); staffParams.push(body.phone); }
      if (body.role !== undefined) { staffUpdates.push('role = ?'); staffParams.push(body.role); }
      if (body.isActive !== undefined) { staffUpdates.push('is_active = ?'); staffParams.push(body.isActive ? 1 : 0); }
      staffUpdates.push('updated_at = ?');
      staffParams.push(now);
      staffParams.push(id);
      if (staffUpdates.length > 1) {
        await db.prepare(`UPDATE staff_users SET ${staffUpdates.join(', ')} WHERE id = ?`).bind(...staffParams).run();
      }
    } catch {
      // staff_users table optional
    }

    // Dual-store sync: update AUTH_KV cached user record if bound
    if (c.env.AUTH_KV) {
      try {
        const oldEmail = existing.email;
        const newEmail = body.email || oldEmail;
        const kvKey = `user:${oldEmail}`;
        const raw = await c.env.AUTH_KV.get(kvKey);
        let kvUser: any = raw ? JSON.parse(raw) : null;
        if (!kvUser) {
          const rawById = await c.env.AUTH_KV.get(`user:${id}`);
          if (rawById) kvUser = JSON.parse(rawById);
        }
        if (kvUser) {
          const updatedKv = {
            ...kvUser,
            name: body.name !== undefined ? body.name : kvUser.name,
            phone: body.phone !== undefined ? body.phone : kvUser.phone,
            role: body.role !== undefined ? body.role : kvUser.role,
            position: body.role !== undefined ? body.role : (kvUser.position || kvUser.role),
            active: body.isActive !== undefined ? body.isActive : (kvUser.active ?? kvUser.isActive),
            isActive: body.isActive !== undefined ? body.isActive : (kvUser.isActive ?? kvUser.active),
            email: newEmail,
            updated_at: now,
          };
          if (newEmail !== oldEmail) {
            await c.env.AUTH_KV.delete(kvKey);
          }
          await c.env.AUTH_KV.put(`user:${newEmail}`, JSON.stringify(updatedKv));
          await c.env.AUTH_KV.put(`user:${id}`, JSON.stringify(updatedKv)).catch(() => {});
        }
      } catch {
        // Non-blocking KV sync failure
      }
    }

    // Audit log (redact password if present)
    const { password: _redactedUpdatePw, ...auditUpdateBody } = body;
    await writeStaffAuditLog(db, user.id, 'staff_update', 'user', id, JSON.stringify(auditUpdateBody), now);

    let updated: any = null;
    try {
      updated = await db.prepare(
        `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
         FROM users WHERE id = ?`
      ).bind(id).first();
    } catch {
      updated = await db.prepare(
        `SELECT id, phone, name, role, is_active, created_at, updated_at
         FROM users WHERE id = ?`
      ).bind(id).first();
    }

    return c.json({
      success: true,
      data: {
        ...updated!,
        role: updated!.role,
        locale: updated?.locale ?? 'vi',
        isActive: updated!.is_active === 1,
        hireDate: updated?.hire_date ?? null,
        createdAt: updated!.created_at,
        updatedAt: updated!.updated_at,
      },
    });
  });

  // DELETE /api/staff/:id - Delete staff (soft delete)
  app.openapi(StaffRoutes.delete as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM users WHERE id = ? AND role != \'customer\'').bind(id).first()) as any;
    if (!existing) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }

    if (existing.role === 'owner' && user?.role !== 'owner') {
      return c.json({ success: false, error: 'Only owners can delete owner accounts' }, 403);
    }

    // Check for related records
    let shifts: { count: number } | null = null;
    try {
      shifts = (await db.prepare('SELECT COUNT(*) as count FROM staff_shifts WHERE staff_id = ?').bind(id).first()) as { count: number } | null;
    } catch {
      shifts = (await db.prepare('SELECT COUNT(*) as count FROM shifts WHERE user_id = ?').bind(id).first().catch(() => null)) as { count: number } | null;
    }
    let attendance: { count: number } | null = null;
    try {
      attendance = (await db.prepare('SELECT COUNT(*) as count FROM staff_attendance WHERE staff_id = ?').bind(id).first()) as { count: number } | null;
    } catch {
      attendance = null;
    }
    let orders: { count: number } | null = null;
    try {
      orders = (await db.prepare('SELECT COUNT(*) as count FROM orders WHERE created_by = ?').bind(id).first()) as { count: number } | null;
    } catch {
      orders = null;
    }

    if ((shifts?.count || 0) > 0 || (attendance?.count || 0) > 0 || (orders?.count || 0) > 0) {
      // Soft delete
      await db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').bind(now, id).run();
    } else {
      // Hard delete
      await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    }

    // Audit log
    await writeStaffAuditLog(db, user.id, 'staff_delete', 'user', id, JSON.stringify({ name: existing.name }), now);

    return c.json({ success: true, data: { success: true } });
  });
}

