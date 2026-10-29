import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';
import { getDatabase } from '../../lib/db';
import { hashPassword } from '../../lib/jwt';
import { loadStaffAccount, SessionUnavailableError } from '../../lib/staff-session';
import { staffManagementDenial, staffMutationGuard } from '../../lib/staff-account-mutation';
import { createStaffIdentity, staffEmailInUse } from '../../lib/staff-login-identity';

import { shiftScope } from '../../../../packages/domain/shift/commands/shift-access';
import { listShifts } from '../../../../packages/domain/shift/commands/shift-repository';
import { shiftDto, attendanceDto } from '../../../../packages/domain/shift/model/shift-types';

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
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, userId, action, entityType, entityId, entityType, entityId, metadata, metadata, now).run();
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
}

export function registerStaffHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/staff - List staff
  app.openapi(StaffRoutes.list as any, async (c: any) => {
    const db = getDatabase(c);
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'name', order = 'asc', role, isActive, search } = query;

    let whereClause = "WHERE role != 'customer' AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?";
    const params: (string | number)[] = [c.get('user')?.tenantId || 'default'];

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
      let canonicalWhere = "WHERE role != 'customer' AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?";
      const canonicalParams: (string | number)[] = [c.get('user')?.tenantId || 'default'];
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
    const account = await loadStaffAccount(db, id);
    if (!account.ok || (account.account.tenant_id || 'default') !== (c.get('user')?.tenantId || 'default')) return c.json({ success: false, error: 'Staff not found' }, 404);


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

    const scope = await shiftScope(c.env, c.get('user'));
    const shifts = await listShifts(scope, { staffId: id, limit: 10 });
    const attendance = await listShifts(scope, { staffId: id, attendanceOnly: true, limit: 10 });
    const shiftResults = shifts.rows.map(shiftDto);
    const attendanceResults = attendance.rows.map(attendanceDto);

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
    if (user?.role === 'manager' && ['owner', 'admin', 'manager'].includes(body.role)) {
      return c.json({ success: false, error: 'Manager không được tạo tài khoản quản lý' }, 403);
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

    if (!await createStaffIdentity(c.env, { id, name: body.name, email: body.email,
      phone: body.phone || '', role: body.role, tenant_id: user.tenantId || 'default',
      password: passwordHash, active: body.isActive !== false })) {
      return c.json({ success: false, error: 'Email already exists' }, 409);
    }
    if (c.env.AUTH_KV) {
      const credential = JSON.stringify({ id, name: body.name, email: body.email, role: body.role,
        phone: body.phone || '', password: passwordHash, tenant_id: user.tenantId || 'default', active: body.isActive !== false });
      await c.env.AUTH_KV.put(`user:${body.email}`, credential).catch(() => {});
      await c.env.AUTH_KV.put(`user:${id}`, credential).catch(() => {});
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
    const authority = await loadStaffAccount(db, id);
    if (!authority.ok) return c.json({ success: false, error: 'Staff not found' }, 404);
    const denied = staffManagementDenial(user, authority.account, body.role);
    if (denied) return c.json({ success: false, error: denied }, 403);

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
      if (await staffEmailInUse(c.env, body.email, id)) return c.json({ success: false, error: 'Email already exists' }, 409);
      const identity = await db.prepare('SELECT staff_id FROM staff_login_identities WHERE email = ? AND staff_id != ?')
        .bind(body.email, id).first();
      if (identity) return c.json({ success: false, error: 'Email already exists' }, 409);
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

    const invalidatesSession = body.role !== undefined || body.isActive !== undefined || body.email !== undefined;
    if (invalidatesSession) {
      updates.push('auth_version = auth_version + 1');
      canonicalUpdates.push('auth_version = auth_version + 1');
    }
    const guard = staffMutationGuard(authority.account,
      body.isActive === false || (body.role !== undefined && body.role !== 'owner'));
    updates.push('updated_at = ?'); params.push(now, ...guard.values);
    canonicalUpdates.push('updated_at = ?'); canonicalParams.push(now, ...guard.values);
    const saveAccount = async (sql: string, values: (string | number | null)[]) => {
      const update = db.prepare(sql).bind(...values);
      if (body.email === undefined) return update.run();
      // Both statements use the same account/version/tenant guard and execute
      // in one D1 batch. The directory runs first so a stale write cannot rename
      // credentials after a competing account mutation advances the version.
      const identity = db.prepare(`INSERT INTO staff_login_identities (email, staff_id)
        SELECT ?, id FROM users WHERE ${guard.sql}
        ON CONFLICT(staff_id) DO UPDATE SET email = excluded.email`).bind(body.email, ...guard.values);
      const results = await db.batch([identity, update]);
      return results[1];
    };
    let saved;
    try {
      saved = await saveAccount(`UPDATE users SET ${updates.join(', ')} WHERE ${guard.sql}`, params);
    } catch {
      try {
        saved = await saveAccount(`UPDATE users SET ${canonicalUpdates.join(', ')} WHERE ${guard.sql}`, canonicalParams);
      } catch { throw new SessionUnavailableError(); }
    }
    if (!saved.meta.changes) return c.json({ success: false, error: 'Không thể thay đổi owner cuối cùng hoặc trạng thái đã đổi; vui lòng tải lại' }, 409);

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
    const authority = await loadStaffAccount(db, id);
    if (!authority.ok) return c.json({ success: false, error: 'Staff not found' }, 404);
    const denied = staffManagementDenial(user, authority.account, undefined);
    if (denied) return c.json({ success: false, error: denied }, 403);

    if (existing.role === 'owner' && user?.role !== 'owner') {
      return c.json({ success: false, error: 'Only owners can delete owner accounts' }, 403);
    }

    // Preserve historical references; disabling also revokes every old session.
    const guard = staffMutationGuard(authority.account, true);
    let result;
    try {
      result = await db.prepare(`UPDATE users SET is_active = 0, auth_version = auth_version + 1, updated_at = ? WHERE ${guard.sql}`)
        .bind(now, ...guard.values).run();
    } catch { throw new SessionUnavailableError(); }
    if (!result.meta.changes) return c.json({ success: false, error: 'Không thể vô hiệu hóa owner cuối cùng hoặc trạng thái đã đổi' }, 409);

    // Audit log
    await writeStaffAuditLog(db, user.id, 'staff_delete', 'user', id, JSON.stringify({ name: existing.name }), now);

    return c.json({ success: true, data: { success: true } });
  });
}

