import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { AuthRoutes } from '../../schemas/auth';
import { hashPassword, generateToken, writeAuthAuditLog } from './helpers';
import { getTenantId, isHQSuperAdmin, resolvePilotStore, resolvePublicTenantId } from '../../middleware/tenant';
import { findExistingOwner } from '../../tree/auth/helpers';

const STAFF_LIST_ROLES = ['owner', 'admin', 'manager', 'supervisor'];
const ALLOWED_STAFF_SORTS: Record<string, string> = {
  name: 'name', email: 'email', role: 'role', created_at: 'created_at', updated_at: 'updated_at',
};

function verifyStaffCallerTenant(c: any, user: any): { ok: true; tenantId: string } | { ok: false } {
  const userTenant = String(user?.tenantId || user?.tenant_id || '').trim();
  const resolvedTenant = String(getTenantId(c) || userTenant || 'default').trim() || 'default';
  const headerOverride = String(
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  if (!isHQSuperAdmin(user)) {
    const effectiveUserTenant = userTenant || resolvedTenant;
    if (
      userTenant === '*' ||
      userTenant.toLowerCase() === 'hq' ||
      headerOverride === '*' ||
      headerOverride.toLowerCase() === 'hq' ||
      resolvedTenant === '*' ||
      resolvedTenant.toLowerCase() === 'hq' ||
      (headerOverride && headerOverride !== effectiveUserTenant) ||
      (userTenant && resolvedTenant !== userTenant)
    ) {
      return { ok: false };
    }
    return { ok: true, tenantId: effectiveUserTenant };
  }
  const effectiveHqTenant =
    headerOverride && headerOverride.toLowerCase() !== 'hq'
      ? headerOverride
      : resolvedTenant.toLowerCase() === 'hq' || resolvedTenant === '*'
        ? '*'
        : resolvedTenant;
  return { ok: true, tenantId: effectiveHqTenant };
}

export function registerStaffHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/auth/register-staff - Register staff (owner only)
  app.openapi(AuthRoutes.registerStaff as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const rawBody = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const body = c.req.valid('json');
    const normalizedEmail = String(body.email || '').trim().toLowerCase();
    const user = c.get('user');
    const now = new Date().toISOString();

    if (user.role !== 'owner' && user.role !== 'admin') return c.json({ success: false, error: 'Only owners can register staff' }, 403);
    if (body.role === 'admin' && user.role !== 'admin') return c.json({ success: false, error: 'Only admins can register admin accounts' }, 403);

    const tenantCheck = verifyStaffCallerTenant(c, user);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant staff registration denied' }, 403);
    }
    const bodyTenant = String(
      rawBody.tenant_id || rawBody.tenantId || rawBody.store_id || rawBody.storeId || ''
    ).trim();
    if (!isHQSuperAdmin(user) && bodyTenant && (bodyTenant === '*' || bodyTenant.toLowerCase() === 'hq' || bodyTenant !== tenantCheck.tenantId)) {
      return c.json({ success: false, error: 'Cross-tenant staff registration denied' }, 403);
    }
    const rawTenantId = isHQSuperAdmin(user) && bodyTenant ? bodyTenant : tenantCheck.tenantId;
    const tenantId =
      !rawTenantId || rawTenantId === '*' || rawTenantId.toLowerCase() === 'hq'
        ? resolvePilotStore(c.env)
        : rawTenantId;

    let existing = await db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').bind(normalizedEmail).first().catch(() => null);
    if (!existing) {
      existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first().catch(() => null);
    }
    if (!existing) {
      existing = await db.prepare('SELECT staff_id AS id FROM staff_login_identities WHERE lower(email) = lower(?)').bind(normalizedEmail).first().catch(() => null);
    }
    if (existing) return c.json({ success: false, error: 'Email already exists' }, 409);

    const passwordHash = await hashPassword(body.password);
    const id = crypto.randomUUID();

    try {
      await db.prepare(
        `INSERT INTO users (id, name, email, phone, password_hash, role, tenant_id, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, body.name, normalizedEmail, body.phone || null, passwordHash, body.role, tenantId, body.locale || 'vi', 'bronze', 0, 1, null, now, now).run();
    } catch {
      if (tenantId === 'default') {
        try {
          await db.prepare(
            `INSERT INTO users (id, name, email, phone, password_hash, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(id, body.name, normalizedEmail, body.phone || null, passwordHash, body.role, body.locale || 'vi', 'bronze', 0, 1, null, now, now).run();
        } catch {
          await db.prepare(
            `INSERT INTO users (id, name, phone, password_hash, role, tenant_id, is_active, auth_version, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`
          ).bind(id, body.name, body.phone || null, passwordHash, body.role, tenantId, now, now).run();
        }
      } else {
        await db.prepare(
          `INSERT INTO users (id, name, phone, password_hash, role, tenant_id, is_active, auth_version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`
        ).bind(id, body.name, body.phone || null, passwordHash, body.role, tenantId, now, now).run();
      }
    }

    await db.prepare(
      `INSERT INTO staff_login_identities (email, staff_id) VALUES (lower(?), ?)
       ON CONFLICT(staff_id) DO UPDATE SET email = excluded.email`
    ).bind(normalizedEmail, id).run().catch(() => {});

    await writeAuthAuditLog(db, user.id, 'register_staff', 'user', id, JSON.stringify({ role: body.role }), now, tenantId);

    let staff = await db.prepare(
      'SELECT id, name, email, phone, role, locale, is_active, avatar_url, created_at, updated_at FROM users WHERE id = ?'
    ).bind(id).first().catch(() => null);
    if (!staff) {
      const minimal = await db.prepare('SELECT id, name, phone, role, is_active, created_at, updated_at FROM users WHERE id = ?').bind(id).first();
      staff = minimal ? { ...minimal, email: normalizedEmail, locale: body.locale || 'vi', avatar_url: null } : null;
    }

    return c.json({
      success: true,
      data: {
        ...staff!, email: staff!.email || normalizedEmail, role: staff!.role,
        locale: staff!.locale || body.locale || 'vi', isActive: staff!.is_active === 1,
        createdAt: staff!.created_at, updatedAt: staff!.updated_at,
      },
    }, 201);
  });

  // GET /api/auth/staff - List staff (owner only)
  app.openapi(AuthRoutes.listStaff as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'name', order = 'asc', role, isActive } = query;

    if (!STAFF_LIST_ROLES.includes(user.role)) return c.json({ success: false, error: 'Only owners can list staff' }, 403);

    const tenantCheck = verifyStaffCallerTenant(c, user);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant staff listing denied' }, 403);
    }
    const tenantId = tenantCheck.tenantId;
    let whereClause = 'WHERE role != \'customer\'';
    const params: (string | number)[] = [];
    if (tenantId !== '*') {
      whereClause += ' AND COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?';
      params.push(tenantId);
    }
    if (role) { whereClause += ' AND role = ?'; params.push(role); }
    if (isActive !== undefined) { whereClause += ' AND is_active = ?'; params.push(isActive ? 1 : 0); }

    const countResult = await db.prepare(`SELECT COUNT(*) as total FROM users ${whereClause}`).bind(...params).first();
    const total = (countResult as { total?: number })?.total || 0;

    const offset = (Number(page) - 1) * Number(limit);
    const safeSort = ALLOWED_STAFF_SORTS[sort] || 'name';
    const safeDirection = (order?.toLowerCase() === 'desc') ? 'DESC' : 'ASC';
    const orderClause = `${safeSort} ${safeDirection}`;
    let rows: { results: Array<Record<string, unknown>> };
    try {
      rows = await db.prepare(
        `SELECT id, name, email, phone, role, locale, is_active, avatar_url, created_at, updated_at
         FROM users ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all();
    } catch {
      const canonicalWhere = whereClause
        .replace(/\brole\b/g, 'u.role')
        .replace(/\bis_active\b/g, 'u.is_active')
        .replace(/\btenant_id\b/g, 'u.tenant_id');
      const canonicalOrder = safeSort === 'email' ? `s.email ${safeDirection}` : `u.${safeSort} ${safeDirection}`;
      rows = await db.prepare(
        `SELECT u.id, u.name, s.email AS email, u.phone, u.role, u.is_active, u.created_at, u.updated_at
         FROM users u LEFT JOIN staff_login_identities s ON s.staff_id = u.id
         ${canonicalWhere} ORDER BY ${canonicalOrder} LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all();
    }

    const canViewFullPii = user.role === 'owner' || user.role === 'admin';
    const staff = rows.results.map((row: Record<string, unknown>) => {
      const isSelf = String(row.id) === String(user.id);
      const showPii = canViewFullPii || isSelf;
      return {
        ...row,
        email: showPii ? (row.email || '') : null,
        phone: showPii ? (row.phone ?? null) : null,
        role: row.role,
        locale: row.locale || 'vi',
        avatar_url: row.avatar_url ?? null,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return c.json({
      success: true,
      data: { staff, meta: { page: Number(page), limit: Number(limit), total: Number(total), totalPages: Math.ceil(Number(total) / Number(limit)) } },
    });
  });

  // POST /api/auth/bootstrap-owner - Bootstrap first owner
  app.openapi(AuthRoutes.bootstrapOwner as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const normalizedEmail = String(body.email || '').trim().toLowerCase();
    const now = new Date().toISOString();

    let existingOwner = await db.prepare('SELECT id FROM users WHERE role = \'owner\'').first().catch(() => null);
    if (!existingOwner) {
      existingOwner = await db.prepare('SELECT id FROM staff_accounts WHERE role = \'owner\'').first().catch(() => null);
    }
    if (!existingOwner && c.env?.AUTH_KV) {
      const kvOwner = await findExistingOwner(c.env).catch(() => null);
      if (kvOwner) existingOwner = { id: (kvOwner as { id?: string }).id || kvOwner.email || 'owner' };
    }
    if (existingOwner) return c.json({ success: false, error: 'Owner already exists' }, 409);

    const passwordHash = await hashPassword(body.password);
    const id = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const pilotTenant = resolvePilotStore(c.env).trim();
    const rawBootstrapTenant = (pilotTenant && pilotTenant !== '*' ? pilotTenant : resolvePublicTenantId(c).trim());
    const bootstrapTenant = rawBootstrapTenant && rawBootstrapTenant !== '*' ? rawBootstrapTenant : 'default';

    try {
      await db.prepare(
        `INSERT INTO users (id, name, email, phone, password_hash, role, tenant_id, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, body.name, normalizedEmail, body.phone || null, passwordHash, 'owner', bootstrapTenant, body.locale || 'vi', 'diamond', 0, 1, null, now, now).run();
    } catch {
      if (bootstrapTenant === 'default') {
        try {
          await db.prepare(
            `INSERT INTO users (id, name, email, phone, password_hash, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(id, body.name, normalizedEmail, body.phone || null, passwordHash, 'owner', body.locale || 'vi', 'diamond', 0, 1, null, now, now).run();
        } catch {
          await db.prepare(
            `INSERT INTO users (id, name, phone, password_hash, role, tenant_id, is_active, auth_version, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'owner', ?, 1, 1, ?, ?)`
          ).bind(id, body.name, body.phone || null, passwordHash, bootstrapTenant, now, now).run();
        }
      } else {
        await db.prepare(
          `INSERT INTO users (id, name, phone, password_hash, role, tenant_id, is_active, auth_version, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'owner', ?, 1, 1, ?, ?)`
        ).bind(id, body.name, body.phone || null, passwordHash, bootstrapTenant, now, now).run();
      }
    }

    await db.prepare(
      `INSERT INTO staff_login_identities (email, staff_id) VALUES (lower(?), ?)
       ON CONFLICT(staff_id) DO UPDATE SET email = excluded.email`
    ).bind(normalizedEmail, id).run().catch(() => {});

    await db.prepare(
      `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, is_trusted_device, device_fingerprint, device_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, id, accessToken, refreshToken, expiresAt, 1, null, 'Bootstrap Device', now, now).run().catch(() => {});

    await writeAuthAuditLog(db, id, 'bootstrap_owner', 'user', id, '{}', now, bootstrapTenant);

    const owner = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    return c.json({
      success: true,
      data: {
        user: {
          id: owner!.id, name: owner!.name, email: owner!.email || body.email, phone: owner!.phone,
          role: owner!.role, locale: owner!.locale || body.locale || 'vi',
          loyaltyTier: owner!.loyalty_tier || owner!.tier || 'diamond',
          loyaltyPoints: owner!.loyalty_points ?? owner!.total_points ?? 0,
          emailVerified: owner!.email_verified !== undefined ? owner!.email_verified === 1 : true,
          avatarUrl: owner!.avatar_url ?? null, createdAt: owner!.created_at, updatedAt: owner!.updated_at,
        },
        session: { id: sessionId, accessToken, refreshToken, expiresAt, isTrustedDevice: true },
      },
    }, 201);
  });
}
