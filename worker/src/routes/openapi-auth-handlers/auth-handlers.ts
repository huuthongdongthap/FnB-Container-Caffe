import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { AuthRoutes } from '../../schemas/auth';
import { getAuthToken } from '../../lib/jwt';
import { isStaffRole, STAFF_SESSION_MAX_AGE_SECONDS } from '../../lib/staff-session';
import { isHQSuperAdmin, resolvePublicTenantId } from '../../middleware/tenant';
import { hashPassword, verifyPassword, generateToken, writeAuthAuditLog } from './helpers';
import { registerVerificationHandlers } from './verification-handlers';

function extractRequestedAuthTenant(c: any): string {
  const candidates = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidates).size > 1) {
    return '__CONFLICT__';
  }
  return candidates[0] || '';
}

export function registerAuthHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/auth/register - Register new customer
  app.openapi(AuthRoutes.register as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const normalizedEmail = String(body.email || '').trim().toLowerCase();
    const now = new Date().toISOString();
    const requestedTenant = extractRequestedAuthTenant(c);
    if (
      requestedTenant === '__CONFLICT__' ||
      requestedTenant === '*' ||
      requestedTenant.toLowerCase() === 'hq'
    ) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const rawRegisterTenant = (requestedTenant || resolvePublicTenantId(c)).trim();
    const registerTenant =
      rawRegisterTenant && rawRegisterTenant !== '*' && rawRegisterTenant.toLowerCase() !== 'hq'
        ? rawRegisterTenant
        : 'default';

    let existing = await db.prepare('SELECT staff_id AS id FROM staff_login_identities WHERE lower(email) = lower(?)').bind(normalizedEmail).first().catch(() => null);
    if (!existing) {
      existing = await db.prepare(
        "SELECT id FROM users WHERE lower(email) = lower(?) AND (role != 'customer' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      ).bind(normalizedEmail, registerTenant).first().catch(() => null);
    }
    if (!existing && registerTenant === 'default') {
      existing = await db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').bind(normalizedEmail).first().catch(() => null);
    }
    if (!existing && registerTenant === 'default') {
      existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first().catch(() => null);
    }
    if (existing) {
      return c.json({ success: false, error: 'Email already exists' }, 409);
    }

    const passwordHash = await hashPassword(body.password);
    const id = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      await db.prepare(
        `INSERT INTO users (id, name, email, phone, password_hash, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, tenant_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, body.name, normalizedEmail, body.phone || null, passwordHash,
        'customer', body.locale || 'vi', 'bronze', 0, 0, null, registerTenant, now, now
      ).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO users (id, name, email, phone, password_hash, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, body.name, normalizedEmail, body.phone || null, passwordHash,
          'customer', body.locale || 'vi', 'bronze', 0, 0, null, now, now
        ).run();
        await db.prepare('UPDATE users SET tenant_id = ? WHERE id = ?').bind(registerTenant, id).run().catch(() => {});
      } catch {
        await db.prepare(
          `INSERT INTO users (id, name, email, phone, password_hash, role, tenant_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, body.name, normalizedEmail, body.phone || null, passwordHash,
          'customer', registerTenant, now, now
        ).run();
      }
    }

    try {
      await db.prepare(
        'INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)'
      ).bind(id, normalizedEmail, body.name || 'Thành viên', body.phone || '', 'bronze', registerTenant, now, now).run();
    } catch {
      if (registerTenant === 'default') {
        await db.prepare(
          'INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
        ).bind(id, normalizedEmail, body.name || 'Thành viên', body.phone || '', 'bronze', now).run().catch(() => {});
      }
    }

    try {
      await db.prepare(
        `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, is_trusted_device, device_fingerprint, device_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(sessionId, id, accessToken, refreshToken, expiresAt, body.deviceFingerprint ? 1 : 0, body.deviceFingerprint || null, null, now, now).run();
    } catch {
      await db.prepare(
        `INSERT INTO user_sessions (id, user_id, access_token, refresh_token, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(sessionId, id, accessToken, refreshToken, expiresAt, now).run().catch(() => {});
    }

    await writeAuthAuditLog(db, id, 'register', 'user', id, JSON.stringify({ email: normalizedEmail }), now, registerTenant);

    const user = (await db.prepare(
      'SELECT id, name, email, phone, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, tenant_id, created_at, updated_at FROM users WHERE id = ?'
    ).bind(id).first().catch(() => null)) || (await db.prepare(
      'SELECT id, name, email, phone, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at FROM users WHERE id = ?'
    ).bind(id).first().catch(() => null)) || (await db.prepare(
      'SELECT id, name, email, phone, role, tenant_id, created_at, updated_at FROM users WHERE id = ?'
    ).bind(id).first().catch(() => null));

    return c.json({
      success: true,
      data: {
        user: {
          ...user!,
          role: user!.role,
          locale: (user as any)?.locale || body.locale || 'vi',
          loyaltyTier: (user as any)?.loyalty_tier || 'bronze',
          loyaltyPoints: (user as any)?.loyalty_points ?? 0,
          emailVerified: (user as any)?.email_verified === 1,
          tenantId: (user as any)?.tenant_id || registerTenant,
          createdAt: user!.created_at,
          updatedAt: user!.updated_at,
        },
        accessToken,
        refreshToken,
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
  app.openapi(AuthRoutes.login as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const normalizedEmail = String(body.email || '').trim().toLowerCase();
    const now = new Date().toISOString();
    const requestedTenant = extractRequestedAuthTenant(c);
    if (requestedTenant === '__CONFLICT__') {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const rawLoginTenant = (
      requestedTenant && requestedTenant !== '*' && requestedTenant.toLowerCase() !== 'hq'
        ? requestedTenant
        : resolvePublicTenantId(c)
    ).trim();
    const targetTenant =
      rawLoginTenant && rawLoginTenant !== '*' && rawLoginTenant.toLowerCase() !== 'hq'
        ? rawLoginTenant
        : 'default';

    const emailRateKey = `rl:login:email:${normalizedEmail}`;
    let failedAttempts = 0;
    if (c.env?.AUTH_KV?.get) {
      failedAttempts = Number((await c.env.AUTH_KV.get(emailRateKey).catch(() => null)) || 0);
      if (failedAttempts >= 10) {
        return c.json({ success: false, error: 'Too many failed login attempts' }, 429);
      }
    }

    let user = await db.prepare(
      "SELECT * FROM users WHERE lower(email) = lower(?) ORDER BY CASE WHEN COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? THEN 0 ELSE 1 END LIMIT 1"
    ).bind(normalizedEmail, targetTenant).first().catch(() => null);
    if (!user) {
      user = await db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').bind(normalizedEmail).first().catch(() => null);
    }
    if (!user) {
      user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(normalizedEmail).first().catch(() => null);
    }
    if (!user) {
      user = await db.prepare(
        'SELECT u.*, s.email AS identity_email FROM staff_login_identities s JOIN users u ON u.id = s.staff_id WHERE lower(s.email) = lower(?)'
      ).bind(normalizedEmail).first().catch(() => null);
    }
    if (!user || !await verifyPassword(body.password, user.password_hash)) {
      if (c.env?.AUTH_KV?.put) {
        await c.env.AUTH_KV.put(emailRateKey, String(failedAttempts + 1), { expirationTtl: 300 }).catch(() => {});
      }
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }
    if (user.is_active === 0 || user.is_active === false) {
      return c.json({ success: false, error: 'Account is inactive', code: 'STAFF_ACCOUNT_INACTIVE' }, 403);
    }
    const userTenant = String((user as any).tenant_id || '').trim();
    if (
      requestedTenant &&
      !isHQSuperAdmin({ role: String(user.role || ''), tenantId: userTenant })
    ) {
      if (
        requestedTenant === '*' ||
        requestedTenant.toLowerCase() === 'hq' ||
        (userTenant && userTenant !== requestedTenant)
      ) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
    }
    if (failedAttempts > 0 && c.env?.AUTH_KV?.delete) {
      await c.env.AUTH_KV.delete(emailRateKey).catch(() => {});
    }

    const sessionId = crypto.randomUUID();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const ttlMs = isStaffRole(String(user.role || ''))
      ? STAFF_SESSION_MAX_AGE_SECONDS * 1000
      : (body.rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    let isTrustedDevice = false;
    if (body.deviceFingerprint) {
      const device = await db.prepare(
        'SELECT id FROM trusted_devices WHERE user_id = ? AND fingerprint = ? AND is_trusted = 1 AND expires_at > ?'
      ).bind(user.id, body.deviceFingerprint, now).first().catch(() => null);
      isTrustedDevice = !!device;
    }

    await db.prepare(
      `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, is_trusted_device, device_fingerprint, device_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, user.id, accessToken, refreshToken, expiresAt, isTrustedDevice ? 1 : 0, body.deviceFingerprint || null, null, now, now).run().catch(() => {});

    const loginTenant = String(userTenant || targetTenant || 'default').trim() || 'default';
    await writeAuthAuditLog(db, user.id, 'login', 'session', sessionId, JSON.stringify({ rememberMe: body.rememberMe }), now, loginTenant);

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email || user.identity_email || body.email,
          phone: user.phone,
          role: user.role,
          locale: user.locale || 'vi',
          loyaltyTier: user.loyalty_tier || user.tier || 'bronze',
          loyaltyPoints: user.loyalty_points ?? user.total_points ?? 0,
          emailVerified: user.email_verified !== undefined ? user.email_verified === 1 : true,
          avatarUrl: user.avatar_url ?? null,
          tenantId: loginTenant,
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
  app.openapi(AuthRoutes.logout as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');
    const now = new Date().toISOString();
    const requestedTenant = extractRequestedAuthTenant(c);
    if (requestedTenant === '__CONFLICT__') {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    if (requestedTenant && !isHQSuperAdmin(user)) {
      const boundTenant = String(user?.tenantId || user?.tenant_id || 'default').trim() || 'default';
      if (
        requestedTenant === '*' ||
        requestedTenant.toLowerCase() === 'hq' ||
        requestedTenant !== boundTenant
      ) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
    }

    const authHeader = c.req.header('Authorization');
    const token = getAuthToken(c.req.raw) || authHeader?.replace(/^Bearer\s+/i, '');

    if (token) {
      await db.prepare('UPDATE sessions SET expires_at = ? WHERE access_token = ?').bind(now, token).run().catch(() => {});
      if (c.env?.AUTH_KV?.put) {
        try {
          await c.env.AUTH_KV.put('revoked:' + token, '1', { expirationTtl: 604800 });
        } catch {
          return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Authentication state store unavailable', retryable: true }, 503);
        }
      }
    }

    const logoutTenant = String(user?.tenantId || user?.tenant_id || resolvePublicTenantId(c) || 'default').trim() || 'default';
    await writeAuthAuditLog(db, user.id, 'logout', 'session', token || 'unknown', JSON.stringify({}), now, logoutTenant);

    return c.json({ success: true, data: { success: true } });
  });

  registerVerificationHandlers(app);
}
