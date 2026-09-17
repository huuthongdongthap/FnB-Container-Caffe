import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { AuthRoutes } from '../../schemas/auth';
import { hashPassword, verifyPassword, generateToken } from './helpers';

export function registerAuthHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/auth/register - Register new customer
  app.openapi(AuthRoutes.register, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(body.email).first();
    if (existing) {
      return c.json({ success: false, error: 'Email already exists' }, 409);
    }

    const passwordHash = await hashPassword(body.password);
    const id = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare(
      `INSERT INTO users (id, name, email, phone, password_hash, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, body.name, body.email, body.phone || null, passwordHash,
      'customer', body.locale || 'vi', 'bronze', 0, false, null, now, now
    ).run();

    await db.prepare(
      `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, is_trusted_device, device_fingerprint, device_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, id, accessToken, refreshToken, expiresAt, !!body.deviceFingerprint, body.deviceFingerprint || null, null, now, now).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, id, 'register', 'user', id, JSON.stringify({ email: body.email }), now).run();

    const user = await db.prepare(
      'SELECT id, name, email, phone, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at FROM users WHERE id = ?'
    ).bind(id).first();

    return c.json({
      success: true,
      data: {
        user: {
          ...user!,
          role: user!.role,
          locale: user!.locale,
          loyaltyTier: user!.loyalty_tier,
          loyaltyPoints: user!.loyalty_points,
          emailVerified: user!.email_verified === 1,
          createdAt: user!.created_at,
          updatedAt: user!.updated_at,
        },
        session: {
          id: sessionId,
          accessToken,
          refreshToken,
          expiresAt,
          isTrustedDevice: !!body.deviceFingerprint,
        },
      },
    }, 201);
  });

  // POST /api/auth/login - Login
  app.openapi(AuthRoutes.login, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(body.email).first();
    if (!user || !await verifyPassword(body.password, user.password_hash)) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    const sessionId = crypto.randomUUID();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresAt = new Date(Date.now() + (body.rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000).toISOString();

    let isTrustedDevice = false;
    if (body.deviceFingerprint) {
      const device = await db.prepare(
        'SELECT id FROM trusted_devices WHERE user_id = ? AND fingerprint = ? AND is_trusted = 1 AND expires_at > ?'
      ).bind(user.id, body.deviceFingerprint, now).first();
      isTrustedDevice = !!device;
    }

    await db.prepare(
      `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, is_trusted_device, device_fingerprint, device_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, user.id, accessToken, refreshToken, expiresAt, isTrustedDevice, body.deviceFingerprint || null, null, now, now).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'login', 'session', sessionId, JSON.stringify({ rememberMe: body.rememberMe }), now).run();

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          locale: user.locale,
          loyaltyTier: user.loyalty_tier,
          loyaltyPoints: user.loyalty_points,
          emailVerified: user.email_verified === 1,
          avatarUrl: user.avatar_url,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
        session: {
          id: sessionId,
          accessToken,
          refreshToken,
          expiresAt,
          isTrustedDevice,
        },
      },
    });
  });

  // POST /api/auth/logout - Logout
  app.openapi(AuthRoutes.logout, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');
    const now = new Date().toISOString();

    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token) {
      await db.prepare('UPDATE sessions SET expires_at = ? WHERE access_token = ?').bind(now, token).run();
    }

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'logout', 'session', token || 'unknown', JSON.stringify({}), now).run();

    return c.json({ success: true, data: { success: true } });
  });

  // GET /api/auth/me - Get current user profile
  app.openapi(AuthRoutes.me, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');

    const fullUser = await db.prepare(
      'SELECT id, name, email, phone, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at FROM users WHERE id = ?'
    ).bind(user.id).first();

    if (!fullUser) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        user: {
          ...fullUser,
          role: fullUser.role,
          locale: fullUser.locale,
          loyaltyTier: fullUser.loyalty_tier,
          loyaltyPoints: fullUser.loyalty_points,
          emailVerified: fullUser.email_verified === 1,
          createdAt: fullUser.created_at,
          updatedAt: fullUser.updated_at,
        },
      },
    });
  });

  // GET /api/auth/session - Get current session
  app.openapi(AuthRoutes.session, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');

    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const session = await db.prepare(
      'SELECT id, expires_at, is_trusted_device, device_name, last_used_at FROM sessions WHERE access_token = ?'
    ).bind(token).first();

    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }

    const fullUser = await db.prepare(
      'SELECT id, name, email, phone, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url FROM users WHERE id = ?'
    ).bind(user.id).first();

    return c.json({
      success: true,
      data: {
        user: {
          ...fullUser!,
          role: fullUser!.role,
          locale: fullUser!.locale,
          loyaltyTier: fullUser!.loyalty_tier,
          loyaltyPoints: fullUser!.loyalty_points,
          emailVerified: fullUser!.email_verified === 1,
        },
        session: {
          id: session.id,
          expiresAt: session.expires_at,
          isTrustedDevice: session.is_trusted_device === 1,
          deviceName: session.device_name,
          lastUsedAt: session.last_used_at,
        },
      },
    });
  });

  // POST /api/auth/verify-email - Verify email
  app.openapi(AuthRoutes.verifyEmail, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const verification = await db.prepare(
      'SELECT * FROM email_verifications WHERE email = ? AND code = ? AND expires_at > ? AND used = 0'
    ).bind(body.email, body.code, now).first();

    if (!verification) {
      return c.json({ success: false, error: 'Invalid or expired code' }, 400);
    }

    await db.prepare('UPDATE email_verifications SET used = 1, verified_at = ? WHERE id = ?').bind(now, verification.id).run();
    await db.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE email = ?').bind(now, body.email).run();

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(body.email).first();
    const sessionId = crypto.randomUUID();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare(
      `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, is_trusted_device, device_fingerprint, device_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, user!.id, accessToken, refreshToken, expiresAt, false, null, null, now, now).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user!.id, 'verify_email', 'user', user!.id, JSON.stringify({}), now).run();

    return c.json({
      success: true,
      data: {
        user: {
          id: user!.id,
          name: user!.name,
          email: user!.email,
          phone: user!.phone,
          role: user!.role,
          locale: user!.locale,
          loyaltyTier: user!.loyalty_tier,
          loyaltyPoints: user!.loyalty_points,
          emailVerified: true,
          avatarUrl: user!.avatar_url,
          createdAt: user!.created_at,
          updatedAt: user!.updated_at,
        },
        session: {
          id: sessionId,
          accessToken,
          refreshToken,
          expiresAt,
          isTrustedDevice: false,
        },
      },
    });
  });
}
