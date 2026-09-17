import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { AuthRoutes } from '../../schemas/auth';
import { hashPassword, generateToken } from './helpers';

export function registerStaffHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/auth/register-staff - Register staff (owner only)
  app.openapi(AuthRoutes.registerStaff, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    if (user.role !== 'owner') {
      return c.json({ success: false, error: 'Only owners can register staff' }, 403);
    }

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(body.email).first();
    if (existing) {
      return c.json({ success: false, error: 'Email already exists' }, 409);
    }

    const passwordHash = await hashPassword(body.password);
    const id = crypto.randomUUID();

    await db.prepare(
      `INSERT INTO users (id, name, email, phone, password_hash, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, body.name, body.email, body.phone || null, passwordHash,
      body.role, body.locale || 'vi', 'bronze', 0, true, null, now, now
    ).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'register_staff', 'user', id, JSON.stringify({ role: body.role }), now).run();

    const staff = await db.prepare(
      'SELECT id, name, email, phone, role, locale, is_active, avatar_url, created_at, updated_at FROM users WHERE id = ?'
    ).bind(id).first();

    return c.json({
      success: true,
      data: {
        ...staff!,
        role: staff!.role,
        locale: staff!.locale,
        isActive: staff!.is_active === 1,
        createdAt: staff!.created_at,
        updatedAt: staff!.updated_at,
      },
    }, 201);
  });

  // GET /api/auth/staff - List staff (owner only)
  app.openapi(AuthRoutes.listStaff, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'name', order = 'asc', role, isActive } = query;

    if (user.role !== 'owner') {
      return c.json({ success: false, error: 'Only owners can list staff' }, 403);
    }

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

    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM users ${whereClause}`
    ).bind(...params).first();
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = await db.prepare(
      `SELECT id, name, email, phone, role, locale, is_active, avatar_url, created_at, updated_at
       FROM users ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    const staff = rows.results.map(row => ({
      ...row,
      role: row.role,
      locale: row.locale,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return c.json({
      success: true,
      data: { staff, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // POST /api/auth/bootstrap-owner - Bootstrap first owner
  app.openapi(AuthRoutes.bootstrapOwner, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existingOwner = await db.prepare('SELECT id FROM users WHERE role = \'owner\'').first();
    if (existingOwner) {
      return c.json({ success: false, error: 'Owner already exists' }, 409);
    }

    const passwordHash = await hashPassword(body.password);
    const id = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare(
      `INSERT INTO users (id, name, email, phone, password_hash, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, body.name, body.email, body.phone || null, passwordHash,
      'owner', body.locale || 'vi', 'diamond', 0, true, null, now, now
    ).run();

    await db.prepare(
      `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, is_trusted_device, device_fingerprint, device_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, id, accessToken, refreshToken, expiresAt, true, null, 'Bootstrap Device', now, now).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, id, 'bootstrap_owner', 'user', id, JSON.stringify({}), now).run();

    const owner = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();

    return c.json({
      success: true,
      data: {
        user: {
          id: owner!.id,
          name: owner!.name,
          email: owner!.email,
          phone: owner!.phone,
          role: owner!.role,
          locale: owner!.locale,
          loyaltyTier: owner!.loyalty_tier,
          loyaltyPoints: owner!.loyalty_points,
          emailVerified: owner!.email_verified === 1,
          avatarUrl: owner!.avatar_url,
          createdAt: owner!.created_at,
          updatedAt: owner!.updated_at,
        },
        session: {
          id: sessionId,
          accessToken,
          refreshToken,
          expiresAt,
          isTrustedDevice: true,
        },
      },
    }, 201);
  });
}
