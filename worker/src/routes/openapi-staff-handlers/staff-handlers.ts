import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'aura_salt_' + crypto.randomUUID());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function registerStaffHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/staff - List staff
  app.openapi(StaffRoutes.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
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

    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM users ${whereClause}`
    ).bind(...params).first();
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = await db.prepare(
      `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
       FROM users ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    const staff = rows.results.map(s => ({
      ...s,
      role: s.role,
      locale: s.locale,
      isActive: s.is_active === 1,
      hireDate: s.hire_date,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return c.json({
      success: true,
      data: { staff, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/staff/:id - Get staff by ID
  app.openapi(StaffRoutes.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');

    const staff = await db.prepare(
      `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
       FROM users WHERE id = ? AND role != 'customer'`
    ).bind(id).first();

    if (!staff) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }

    // Get shifts for this staff
    const shifts = await db.prepare(
      'SELECT * FROM staff_shifts WHERE staff_id = ? ORDER BY date DESC, start_time DESC LIMIT 10'
    ).bind(id).all();

    // Get attendance for this staff
    const attendance = await db.prepare(
      'SELECT * FROM staff_attendance WHERE staff_id = ? ORDER BY date DESC LIMIT 10'
    ).bind(id).all();

    return c.json({
      success: true,
      data: {
        ...staff,
        role: staff.role,
        locale: staff.locale,
        isActive: staff.is_active === 1,
        hireDate: staff.hire_date,
        createdAt: staff.created_at,
        updatedAt: staff.updated_at,
        recentShifts: shifts.results,
        recentAttendance: attendance.results,
      },
    });
  });

  // POST /api/staff - Create staff
  app.openapi(StaffRoutes.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    // Check if email exists
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(body.email).first();
    if (existing) {
      return c.json({ success: false, error: 'Email already exists' }, 409);
    }

    const passwordHash = await hashPassword(body.password);
    const id = crypto.randomUUID();

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

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'staff_create', 'user', id, JSON.stringify(body), now).run();

    const created = await db.prepare(
      `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
       FROM users WHERE id = ?`
    ).bind(id).first();

    return c.json({
      success: true,
      data: {
        ...created!,
        role: created!.role,
        locale: created!.locale,
        isActive: created!.is_active === 1,
        hireDate: created!.hire_date,
        createdAt: created!.created_at,
        updatedAt: created!.updated_at,
      },
    }, 201);
  });

  // PATCH /api/staff/:id - Update staff
  app.openapi(StaffRoutes.update, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM users WHERE id = ? AND role != \'customer\'').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.email !== undefined) {
      const emailExists = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(body.email, id).first();
      if (emailExists) {
        return c.json({ success: false, error: 'Email already exists' }, 409);
      }
      updates.push('email = ?'); params.push(body.email);
    }
    if (body.phone !== undefined) { updates.push('phone = ?'); params.push(body.phone); }
    if (body.role !== undefined) { updates.push('role = ?'); params.push(body.role); }
    if (body.locale !== undefined) { updates.push('locale = ?'); params.push(body.locale); }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }
    if (body.avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(body.avatarUrl); }
    if (body.hireDate !== undefined) { updates.push('hire_date = ?'); params.push(body.hireDate); }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    if (updates.length > 1) {
      await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'staff_update', 'user', id, JSON.stringify(body), now).run();

    const updated = await db.prepare(
      `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
       FROM users WHERE id = ?`
    ).bind(id).first();

    return c.json({
      success: true,
      data: {
        ...updated!,
        role: updated!.role,
        locale: updated!.locale,
        isActive: updated!.is_active === 1,
        hireDate: updated!.hire_date,
        createdAt: updated!.created_at,
        updatedAt: updated!.updated_at,
      },
    });
  });

  // DELETE /api/staff/:id - Delete staff (soft delete)
  app.openapi(StaffRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM users WHERE id = ? AND role != \'customer\'').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }

    // Check for related records
    const shifts = await db.prepare('SELECT COUNT(*) as count FROM staff_shifts WHERE staff_id = ?').bind(id).first();
    const attendance = await db.prepare('SELECT COUNT(*) as count FROM staff_attendance WHERE staff_id = ?').bind(id).first();
    const orders = await db.prepare('SELECT COUNT(*) as count FROM orders WHERE created_by = ?').bind(id).first();

    if ((shifts?.count || 0) > 0 || (attendance?.count || 0) > 0 || (orders?.count || 0) > 0) {
      // Soft delete
      await db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').bind(now, id).run();
    } else {
      // Hard delete
      await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'staff_delete', 'user', id, JSON.stringify({ name: existing.name }), now).run();

    return c.json({ success: true, data: { success: true } });
  });
}