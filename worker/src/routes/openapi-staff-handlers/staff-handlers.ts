import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';
import { getDatabase, matchesTenantRow } from '../../lib/db';
import { hashPassword } from '../../lib/jwt';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import { loadStaffAccount, SessionUnavailableError } from '../../lib/staff-session';
import { staffManagementDenial, staffMutationGuard } from '../../lib/staff-account-mutation';
import { createStaffIdentity, staffEmailInUse } from '../../lib/staff-login-identity';

import { extractRequestedShiftTenant, shiftScope } from '../../../../packages/domain/shift/commands/shift-access';
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
  now: string,
  tenantId: string = 'default'
): Promise<void> {
  const rawTenant = tenantId ? tenantId.trim() : '';
  const effectiveTenant = !rawTenant || rawTenant === '*' || rawTenant.toLowerCase() === 'hq' ? 'default' : rawTenant;
  const auditId = `audit_${crypto.randomUUID()}`;
  let enrichedMeta = metadata;
  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.tenant_id === undefined) {
      enrichedMeta = JSON.stringify({ ...parsed, tenant_id: effectiveTenant });
    }
  } catch { /* non-JSON metadata */ }
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(auditId, userId, action, entityType, entityId, enrichedMeta, effectiveTenant, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, userId, action, entityType, entityId, entityType, entityId, enrichedMeta, enrichedMeta, effectiveTenant, now).run();
    } catch {
      if (effectiveTenant === 'default') {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(auditId, userId, action, entityType, entityId, enrichedMeta, now).run();
        } catch {
          try {
            await db.prepare(
              `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(userId, userId, userId, action, entityType, entityId, entityType, entityId, enrichedMeta, enrichedMeta, now).run();
          } catch {
            try {
              await db.prepare(
                `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
              ).bind(userId, userId, action, entityType, entityId, enrichedMeta, now).run().catch(() => {});
            } catch {
              // Ignore audit log error
            }
          }
        }
      }
    }
  }
  await db
    .prepare('UPDATE audit_logs SET tenant_id = ? WHERE id = ?')
    .bind(effectiveTenant, auditId)
    .run()
    .catch(() => {});
}

function resolveOpenApiStaffTenant(c: any): {
  ok: true;
  tenantId: string;
  callerTenant: string;
  isHq: boolean;
} | { ok: false } {
  const user = c.get?.('user') as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  const rawCallerTenant =
    (typeof user?.tenantId === 'string' && user.tenantId.trim()) ||
    (typeof user?.tenant_id === 'string' && user.tenant_id.trim()) ||
    '';
  const hasCallerTenant = rawCallerTenant.length > 0;
  const callerTenant = hasCallerTenant ? rawCallerTenant : 'default';
  const isHq = isHQSuperAdmin(user);

  const requestedHeaderOrQuery = extractRequestedShiftTenant(c);
  if (requestedHeaderOrQuery === '__CONFLICT__') {
    return { ok: false };
  }
  const rawCtxTenant = String((c.get?.('tenantId') as string | undefined) || '').trim();
  const ctxTenant = getTenantId(c).trim() || 'default';

  if (!isHq) {
    if (callerTenant === '*' || callerTenant.toLowerCase() === 'hq') {
      return { ok: false };
    }
    if (
      requestedHeaderOrQuery &&
      (requestedHeaderOrQuery === '*' ||
        requestedHeaderOrQuery.toLowerCase() === 'hq' ||
        requestedHeaderOrQuery !== callerTenant)
    ) {
      return { ok: false };
    }
    if (hasCallerTenant && rawCtxTenant && rawCtxTenant !== callerTenant) {
      return { ok: false };
    }
    if (!hasCallerTenant && (rawCtxTenant === '*' || rawCtxTenant.toLowerCase() === 'hq')) {
      return { ok: false };
    }
    return {
      ok: true,
      tenantId: hasCallerTenant ? callerTenant : ctxTenant,
      callerTenant,
      isHq,
    };
  }

  const normalizedCtx = rawCtxTenant === '*' || rawCtxTenant.toLowerCase() === 'hq' ? '' : rawCtxTenant;
  const cleanReq =
    requestedHeaderOrQuery && requestedHeaderOrQuery !== '*' && requestedHeaderOrQuery.toLowerCase() !== 'hq'
      ? requestedHeaderOrQuery
      : '';
  const effective =
    requestedHeaderOrQuery === '*' || requestedHeaderOrQuery.toLowerCase() === 'hq'
      ? '*'
      : cleanReq || normalizedCtx || '*';
  const resolved = effective === '*' || effective.toLowerCase() === 'hq' ? '*' : effective;
  return { ok: true, tenantId: resolved, callerTenant, isHq };
}

export function registerStaffHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/staff - List staff
  app.openapi(StaffRoutes.list as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantCheck = resolveOpenApiStaffTenant(c);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const { tenantId } = tenantCheck;
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'name', order = 'asc', role, isActive, search } = query;

    let whereClause = "WHERE role != 'customer'";
    const params: (string | number)[] = [];
    if (tenantId !== '*') {
      whereClause += " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
      params.push(tenantId);
    }

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
      let canonicalWhere = "WHERE role != 'customer'";
      const canonicalParams: (string | number)[] = [];
      if (tenantId !== '*') {
        canonicalWhere += " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
        canonicalParams.push(tenantId);
      }
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

    const caller = c.get('user');
    const canViewUnmaskedPii = Boolean(
      caller?.role && ['owner', 'admin', 'manager'].includes(String(caller.role).toLowerCase())
    );
    const staff = rawRows.map((s: any) => ({
      ...s,
      email: canViewUnmaskedPii || s.id === caller?.id ? (s.email ?? null) : null,
      phone: canViewUnmaskedPii || s.id === caller?.id ? (s.phone ?? null) : null,
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
    const tenantCheck = resolveOpenApiStaffTenant(c);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const { tenantId } = tenantCheck;
    const { id } = c.req.valid('param');
    const account = await loadStaffAccount(db, id);
    if (!account.ok || (tenantId !== '*' && ((account.account.tenant_id || '').trim() || 'default') !== tenantId)) return c.json({ success: false, error: 'Staff not found' }, 404);


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

    const targetStaffTenant = (account.account.tenant_id || '').trim() || 'default';
    const scope = await shiftScope(c.env, c.get('user'), tenantId === '*' ? targetStaffTenant : tenantId);
    const shifts = await listShifts(scope, { staffId: id, limit: 10 });
    const attendance = await listShifts(scope, { staffId: id, attendanceOnly: true, limit: 10 });
    const shiftResults = shifts.rows.map(shiftDto);
    const attendanceResults = attendance.rows.map(attendanceDto);

    const caller = c.get('user');
    const canViewUnmaskedPii = Boolean(
      caller?.role && ['owner', 'admin', 'manager'].includes(String(caller.role).toLowerCase())
    );
    return c.json({
      success: true,
      data: {
        ...staff,
        email: canViewUnmaskedPii || staff.id === caller?.id ? (staff.email ?? null) : null,
        phone: canViewUnmaskedPii || staff.id === caller?.id ? (staff.phone ?? null) : null,
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

    if (!['owner', 'manager', 'admin'].includes(user?.role)) {
      return c.json({ success: false, error: 'Không đủ quyền tạo tài khoản nhân viên' }, 403);
    }
    if (body.role === 'owner' && user?.role !== 'owner' && user?.role !== 'admin') {
      return c.json({ success: false, error: 'Only owners can create owner accounts' }, 403);
    }
    if (body.role === 'admin' && user?.role !== 'admin') {
      return c.json({ success: false, error: 'Only admins can create admin accounts' }, 403);
    }
    if (user?.role === 'manager' && ['owner', 'admin', 'manager'].includes(body.role)) {
      return c.json({ success: false, error: 'Manager không được tạo tài khoản quản lý' }, 403);
    }

    const tenantCheck = resolveOpenApiStaffTenant(c);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    let rawPayload: Record<string, any> = {};
    try {
      rawPayload = (await c.req?.json?.()) || {};
    } catch {
      rawPayload = {};
    }
    const bodyTenantCandidates = [
      typeof body.locationId === 'string' ? body.locationId.trim() : '',
      typeof (body as any).tenant_id === 'string' ? (body as any).tenant_id.trim() : '',
      typeof (body as any).tenantId === 'string' ? (body as any).tenantId.trim() : '',
      typeof rawPayload?.locationId === 'string' ? rawPayload.locationId.trim() : '',
      typeof rawPayload?.tenant_id === 'string' ? rawPayload.tenant_id.trim() : '',
      typeof rawPayload?.tenantId === 'string' ? rawPayload.tenantId.trim() : '',
      typeof rawPayload?.store_id === 'string' ? rawPayload.store_id.trim() : '',
      typeof rawPayload?.storeId === 'string' ? rawPayload.storeId.trim() : '',
    ].filter(Boolean);
    if (new Set(bodyTenantCandidates).size > 1) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const rawBodyTenant = bodyTenantCandidates[0] || '';
    if (rawBodyTenant) {
      if (!tenantCheck.isHq) {
        if (
          rawBodyTenant === '*' ||
          rawBodyTenant.toLowerCase() === 'hq' ||
          rawBodyTenant !== tenantCheck.callerTenant
        ) {
          return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
        }
      } else if (
        tenantCheck.tenantId !== '*' &&
        rawBodyTenant !== '*' &&
        rawBodyTenant.toLowerCase() !== 'hq' &&
        rawBodyTenant !== tenantCheck.tenantId
      ) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
    }
    const cleanBodyTenant =
      rawBodyTenant && rawBodyTenant !== '*' && rawBodyTenant.toLowerCase() !== 'hq'
        ? rawBodyTenant
        : '';
    const rawTenantId = tenantCheck.tenantId;
    const staffTenant = tenantCheck.isHq
      ? (rawTenantId === '*' ? (cleanBodyTenant || 'default') : rawTenantId)
      : tenantCheck.callerTenant;

    // Check if email exists within the target tenant
    let existing: Record<string, unknown> | null = null;
    try {
      existing = await db
        .prepare(
          "SELECT id, tenant_id FROM users WHERE email = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        )
        .bind(body.email, staffTenant)
        .first<Record<string, unknown>>();
    } catch {
      if (staffTenant === 'default') {
        try {
          const unscopedEmail = await db
            .prepare('SELECT id, tenant_id FROM users WHERE email = ?')
            .bind(body.email)
            .first<Record<string, unknown>>();
          if (unscopedEmail && matchesTenantRow(unscopedEmail, staffTenant)) {
            existing = unscopedEmail;
          }
        } catch {
          try {
            const legacyEmail = await db
              .prepare('SELECT id FROM users WHERE email = ?')
              .bind(body.email)
              .first<Record<string, unknown>>();
            if (legacyEmail && matchesTenantRow(legacyEmail, staffTenant)) {
              existing = legacyEmail;
            }
          } catch {
            if (body.phone) {
              const fallbackPhone = await db
                .prepare('SELECT id FROM users WHERE phone = ?')
                .bind(body.phone)
                .first<Record<string, unknown>>()
                .catch(() => null);
              if (fallbackPhone && matchesTenantRow(fallbackPhone, staffTenant)) {
                existing = fallbackPhone;
              }
            }
          }
        }
      }
    }
    if (existing && matchesTenantRow(existing, staffTenant)) {
      return c.json({ success: false, error: 'Email already exists' }, 409);
    }
    if (body.phone && String(body.phone).trim() !== '') {
      const normalizedPhone = String(body.phone).trim();
      let existingPhone: Record<string, unknown> | null = null;
      try {
        existingPhone = await db
          .prepare(
            "SELECT id, tenant_id FROM users WHERE phone = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(normalizedPhone, staffTenant)
          .first<Record<string, unknown>>();
      } catch {
        if (staffTenant === 'default') {
          try {
            const unscopedPhone = await db
              .prepare('SELECT id, tenant_id FROM users WHERE phone = ?')
              .bind(normalizedPhone)
              .first<Record<string, unknown>>();
            if (unscopedPhone && matchesTenantRow(unscopedPhone, staffTenant)) {
              existingPhone = unscopedPhone;
            }
          } catch {
            const legacyPhone = await db
              .prepare('SELECT id FROM users WHERE phone = ?')
              .bind(normalizedPhone)
              .first<Record<string, unknown>>()
              .catch(() => null);
            if (legacyPhone && matchesTenantRow(legacyPhone, staffTenant)) {
              existingPhone = legacyPhone;
            }
          }
        }
      }
      if (existingPhone && matchesTenantRow(existingPhone, staffTenant)) {
        return c.json({ success: false, error: 'Phone number already exists' }, 409);
      }
    }

    const passwordHash = await hashPassword(body.password);
    const id = crypto.randomUUID();

    if (!await createStaffIdentity(c.env, { id, name: body.name, email: body.email,
      phone: body.phone || '', role: body.role, tenant_id: staffTenant,
      password: passwordHash, active: body.isActive !== false })) {
      return c.json({ success: false, error: 'Email already exists' }, 409);
    }
    if (c.env.AUTH_KV) {
      const credential = JSON.stringify({ id, name: body.name, email: body.email, role: body.role,
        phone: body.phone || '', password: passwordHash, tenant_id: staffTenant, active: body.isActive !== false, auth_version: 1 });
      await c.env.AUTH_KV.put(`user:${body.email}`, credential).catch(() => {});
      await c.env.AUTH_KV.put(`user:${id}`, credential).catch(() => {});
    }

    // Audit log (redact password)
    const { password: _redactedPassword, ...auditCreateBody } = body;
    await writeStaffAuditLog(db, user.id, 'staff_create', 'user', id, JSON.stringify(auditCreateBody), now, staffTenant);

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
        id,
        name: body.name,
        email: created?.email ?? body.email,
        phone: created?.phone ?? body.phone ?? null,
        role: created?.role ?? body.role,
        tenant_id: staffTenant,
        locale: created?.locale ?? body.locale ?? 'vi',
        isActive: created ? (created.is_active === 1 || created.isActive === true) : true,
        hireDate: created?.hire_date ?? body.hireDate ?? now.slice(0, 10),
        createdAt: created?.created_at ?? now,
        updatedAt: created?.updated_at ?? now,
        ...created,
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

    const tenantCheck = resolveOpenApiStaffTenant(c);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const { tenantId } = tenantCheck;
    const authority = await loadStaffAccount(db, id);
    if (!authority.ok) return c.json({ success: false, error: 'Staff not found' }, 404);
    const denied = staffManagementDenial(user, authority.account, body.role);
    if (denied) return c.json({ success: false, error: denied }, 403);
    let existing: any = null;
    if (tenantId !== '*') {
      try {
        existing = await db
          .prepare(
            "SELECT * FROM users WHERE id = ? AND role != 'customer' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(id, tenantId)
          .first();
      } catch {
        existing = null;
      }
    }
    if (!existing && (tenantId === '*' || tenantId === 'default')) {
      existing = await db.prepare("SELECT * FROM users WHERE id = ? AND role != 'customer'").bind(id).first().catch(() => null);
    }
    if (!existing) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }
    const targetAccountTenant =
      (authority.account.tenant_id ? String(authority.account.tenant_id).trim() : '') ||
      (existing.tenant_id ? String(existing.tenant_id).trim() : '') ||
      'default';
    if (!matchesTenantRow(existing as Record<string, unknown>, tenantId) || (tenantId !== '*' && targetAccountTenant !== tenantId)) {
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
      if (await staffEmailInUse(c.env, body.email, id)) return c.json({ success: false, error: 'Email already exists' }, 409);
      const identity = await db.prepare('SELECT staff_id FROM staff_login_identities WHERE email = ? AND staff_id != ?')
        .bind(body.email, id).first().catch(() => null);
      if (identity) return c.json({ success: false, error: 'Email already exists' }, 409);
      let emailExists: Record<string, unknown> | null = null;
      try {
        emailExists = await db
          .prepare(
            "SELECT id, tenant_id FROM users WHERE email = ? AND id != ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(body.email, id, targetAccountTenant)
          .first<Record<string, unknown>>();
      } catch {
        if (targetAccountTenant === 'default') {
          try {
            const unscopedEmail = await db
              .prepare('SELECT id, tenant_id FROM users WHERE email = ? AND id != ?')
              .bind(body.email, id)
              .first<Record<string, unknown>>();
            if (unscopedEmail && matchesTenantRow(unscopedEmail, targetAccountTenant)) {
              emailExists = unscopedEmail;
            }
          } catch {
            const legacyEmail = await db
              .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
              .bind(body.email, id)
              .first<Record<string, unknown>>()
              .catch(() => null);
            if (legacyEmail && matchesTenantRow(legacyEmail, targetAccountTenant)) {
              emailExists = legacyEmail;
            }
          }
        }
      }
      if (emailExists && matchesTenantRow(emailExists, targetAccountTenant)) {
        return c.json({ success: false, error: 'Email already exists' }, 409);
      }
      updates.push('email = ?'); params.push(body.email);
    }
    if (body.phone !== undefined) {
      if (String(body.phone).trim() !== '') {
        const normalizedPhone = String(body.phone).trim();
        let phoneExists: Record<string, unknown> | null = null;
        try {
          phoneExists = await db
            .prepare(
              "SELECT id, tenant_id FROM users WHERE phone = ? AND id != ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            )
            .bind(normalizedPhone, id, targetAccountTenant)
            .first<Record<string, unknown>>();
        } catch {
          if (targetAccountTenant === 'default') {
            try {
              const unscopedPhone = await db
                .prepare('SELECT id, tenant_id FROM users WHERE phone = ? AND id != ?')
                .bind(normalizedPhone, id)
                .first<Record<string, unknown>>();
              if (unscopedPhone && matchesTenantRow(unscopedPhone, targetAccountTenant)) {
                phoneExists = unscopedPhone;
              }
            } catch {
              const legacyPhone = await db
                .prepare('SELECT id FROM users WHERE phone = ? AND id != ?')
                .bind(normalizedPhone, id)
                .first<Record<string, unknown>>()
                .catch(() => null);
              if (legacyPhone && matchesTenantRow(legacyPhone, targetAccountTenant)) {
                phoneExists = legacyPhone;
              }
            }
          }
        }
        if (phoneExists && matchesTenantRow(phoneExists, targetAccountTenant)) {
          return c.json({ success: false, error: 'Phone number already exists' }, 409);
        }
      }
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
    } catch (err) {
      if (/UNIQUE constraint failed/i.test(String((err as Error)?.message || err))) {
        return c.json({ success: false, error: 'Phone or email already exists' }, 409);
      }
      try {
        saved = await saveAccount(`UPDATE users SET ${canonicalUpdates.join(', ')} WHERE ${guard.sql}`, canonicalParams);
      } catch (innerErr) {
        if (/UNIQUE constraint failed/i.test(String((innerErr as Error)?.message || innerErr))) {
          return c.json({ success: false, error: 'Phone or email already exists' }, 409);
        }
        throw new SessionUnavailableError();
      }
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
        const targetStaffTenant = targetAccountTenant;
        try {
          await db.prepare(
            `UPDATE staff_users SET ${staffUpdates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          ).bind(...staffParams, targetStaffTenant).run();
        } catch {
          if (targetStaffTenant === 'default') {
            await db.prepare(`UPDATE staff_users SET ${staffUpdates.join(', ')} WHERE id = ?`).bind(...staffParams).run();
          }
        }
      }
    } catch {
      // staff_users table optional
    }

    // Dual-store sync: update AUTH_KV cached user record if bound
    if (c.env.AUTH_KV) {
      try {
        let oldEmail = existing.email ? String(existing.email).trim() : '';
        if (!oldEmail) {
          try {
            const identityRow = await db
              .prepare('SELECT email FROM staff_login_identities WHERE staff_id = ? LIMIT 1')
              .bind(id)
              .first<{ email?: string | null }>();
            if (identityRow?.email && String(identityRow.email).trim()) {
              oldEmail = String(identityRow.email).trim();
            }
          } catch {
            // staff_login_identities optional
          }
        }
        const newEmail = body.email || oldEmail;
        const kvKey = oldEmail ? `user:${oldEmail}` : '';
        const raw = kvKey ? await c.env.AUTH_KV.get(kvKey) : null;
        let kvUser: any = raw ? JSON.parse(raw) : null;
        if (!kvUser) {
          const rawById = await c.env.AUTH_KV.get(`user:${id}`);
          if (rawById) kvUser = JSON.parse(rawById);
        }
        if (kvUser) {
          const nextAuthVersion = invalidatesSession
            ? Number(kvUser.auth_version ?? existing.auth_version ?? 1) + 1
            : Number(kvUser.auth_version ?? existing.auth_version ?? 1);
          const updatedKv = {
            ...kvUser,
            name: body.name !== undefined ? body.name : kvUser.name,
            phone: body.phone !== undefined ? body.phone : kvUser.phone,
            role: body.role !== undefined ? body.role : kvUser.role,
            position: body.role !== undefined ? body.role : (kvUser.position || kvUser.role),
            active: body.isActive !== undefined ? body.isActive : (kvUser.active ?? kvUser.isActive),
            isActive: body.isActive !== undefined ? body.isActive : (kvUser.isActive ?? kvUser.active),
            email: newEmail,
            auth_version: nextAuthVersion,
            updated_at: now,
          };
          if (kvKey && newEmail !== oldEmail) {
            await c.env.AUTH_KV.delete(kvKey);
          }
          if (newEmail) {
            await c.env.AUTH_KV.put(`user:${newEmail}`, JSON.stringify(updatedKv));
          }
          await c.env.AUTH_KV.put(`user:${id}`, JSON.stringify(updatedKv)).catch(() => {});
        }
      } catch {
        // Non-blocking KV sync failure
      }
    }

    // Audit log (redact password if present)
    const { password: _redactedUpdatePw, ...auditUpdateBody } = body;
    const updateAuditTenant =
      (authority.account.tenant_id ? String(authority.account.tenant_id).trim() : '') ||
      (existing.tenant_id ? String(existing.tenant_id).trim() : '') ||
      getTenantId(c).trim() ||
      'default';
    await writeStaffAuditLog(db, user.id, 'staff_update', 'user', id, JSON.stringify(auditUpdateBody), now, updateAuditTenant);

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

    const tenantCheck = resolveOpenApiStaffTenant(c);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const { tenantId } = tenantCheck;
    let existing: any = null;
    if (tenantId !== '*') {
      try {
        existing = await db
          .prepare(
            "SELECT * FROM users WHERE id = ? AND role != 'customer' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(id, tenantId)
          .first();
      } catch {
        existing = null;
      }
    }
    if (!existing && (tenantId === '*' || tenantId === 'default')) {
      existing = await db.prepare("SELECT * FROM users WHERE id = ? AND role != 'customer'").bind(id).first();
    }
    if (!existing) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }
    const authority = await loadStaffAccount(db, id);
    if (!authority.ok) return c.json({ success: false, error: 'Staff not found' }, 404);
    const denied = staffManagementDenial(user, authority.account, undefined);
    if (denied) return c.json({ success: false, error: denied }, 403);
    const targetAccountTenant =
      (authority.account.tenant_id ? String(authority.account.tenant_id).trim() : '') ||
      (existing.tenant_id ? String(existing.tenant_id).trim() : '') ||
      'default';
    if (!matchesTenantRow(existing as Record<string, unknown>, tenantId) || (tenantId !== '*' && targetAccountTenant !== tenantId)) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }

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

    try {
      const targetStaffTenant = targetAccountTenant;
      try {
        await db.prepare(
          "UPDATE staff_users SET is_active = 0, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(now, id, targetStaffTenant).run();
      } catch {
        if (targetStaffTenant === 'default') {
          await db.prepare('UPDATE staff_users SET is_active = 0, updated_at = ? WHERE id = ?').bind(now, id).run();
        }
      }
    } catch {
      // staff_users table optional
    }

    if (c.env.AUTH_KV) {
      try {
        let resolvedDeleteEmail = existing.email ? String(existing.email).trim() : '';
        if (!resolvedDeleteEmail) {
          try {
            const identityRow = await db
              .prepare('SELECT email FROM staff_login_identities WHERE staff_id = ? LIMIT 1')
              .bind(id)
              .first<{ email?: string | null }>();
            if (identityRow?.email && String(identityRow.email).trim()) {
              resolvedDeleteEmail = String(identityRow.email).trim();
            }
          } catch {
            // staff_login_identities optional
          }
        }
        const emailKey = resolvedDeleteEmail ? `user:${resolvedDeleteEmail}` : null;
        const rawByEmail = emailKey ? await c.env.AUTH_KV.get(emailKey) : null;
        const rawById = await c.env.AUTH_KV.get(`user:${id}`);
        const baseKv = rawByEmail ? JSON.parse(rawByEmail) : (rawById ? JSON.parse(rawById) : existing);
        const disabledKv = JSON.stringify({
          ...baseKv,
          id,
          active: false,
          isActive: false,
          is_active: 0,
          auth_version: Number(baseKv?.auth_version ?? existing.auth_version ?? 1) + 1,
          updated_at: now,
        });
        if (emailKey) {
          await c.env.AUTH_KV.put(emailKey, disabledKv).catch(() => {});
        }
        await c.env.AUTH_KV.put(`user:${id}`, disabledKv).catch(() => {});
      } catch {
        // Non-blocking KV sync failure
      }
    }

    // Audit log
    const deleteAuditTenant =
      (authority.account.tenant_id ? String(authority.account.tenant_id).trim() : '') ||
      (existing.tenant_id ? String(existing.tenant_id).trim() : '') ||
      getTenantId(c).trim() ||
      'default';
    await writeStaffAuditLog(db, user.id, 'staff_delete', 'user', id, JSON.stringify({ name: existing.name }), now, deleteAuditTenant);

    return c.json({ success: true, data: { success: true } });
  });
}

