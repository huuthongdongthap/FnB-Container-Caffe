import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { AuthRoutes } from '../../schemas/auth';
import { getAuthToken, timingSafeEqualString } from '../../lib/jwt';
import { isHQSuperAdmin, resolvePublicTenantId } from '../../middleware/tenant';
import { generateToken, writeAuthAuditLog } from './helpers';
import { registerForgotPasswordHandler } from './password-handlers';

function extractRequestedVerificationTenant(c: any): string {
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

export function registerVerificationHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/auth/me - Get current user profile
  app.openapi(AuthRoutes.me as any, async (c: any) => {
    const db = c.env.AURA_DB;
    let user = c.get('user');
    if (!user?.id) {
      const authHeader = c.req.header('Authorization');
      const token = getAuthToken(c.req.raw) || authHeader?.replace(/^Bearer\s+/i, '');
      if (token) {
        const sess = (
          (await db.prepare('SELECT user_id FROM sessions WHERE access_token = ? LIMIT 1').bind(token).first().catch(() => null)) ||
          (await db.prepare('SELECT user_id FROM user_sessions WHERE access_token = ? LIMIT 1').bind(token).first().catch(() => null))
        ) as { user_id?: string } | null;
        if (sess?.user_id) {
          user = { id: sess.user_id };
        }
      }
    }
    if (!user?.id) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    const requestedTenant = extractRequestedVerificationTenant(c);
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

    let fullUser = (await db.prepare(
      'SELECT id, name, email, phone, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, tenant_id, created_at, updated_at FROM users WHERE id = ?'
    ).bind(user.id).first().catch(() => null)) || (await db.prepare(
      'SELECT id, name, email, phone, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at FROM users WHERE id = ?'
    ).bind(user.id).first().catch(() => null));
    if (!fullUser) {
      const minimal = (await db.prepare(
        'SELECT u.id, u.name, COALESCE(u.email, s.email) AS email, u.phone, u.role, u.tenant_id, u.created_at, u.updated_at FROM users u LEFT JOIN staff_login_identities s ON s.staff_id = u.id WHERE u.id = ?'
      ).bind(user.id).first().catch(() => null)) || (await db.prepare(
        'SELECT u.id, u.name, s.email AS email, u.phone, u.role, u.created_at, u.updated_at FROM users u LEFT JOIN staff_login_identities s ON s.staff_id = u.id WHERE u.id = ?'
      ).bind(user.id).first().catch(() => null));
      if (minimal) {
        fullUser = {
          ...minimal,
          email: minimal.email || user.email || '',
          locale: 'vi',
          loyalty_tier: 'bronze',
          loyalty_points: 0,
          email_verified: 1,
          avatar_url: null,
        };
      }
    }

    if (!fullUser) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const resolvedTenant =
      String((fullUser as any).tenant_id || user?.tenantId || user?.tenant_id || 'default').trim() || 'default';

    const userPayload = {
      ...fullUser,
      role: fullUser.role,
      locale: fullUser.locale || 'vi',
      loyaltyTier: fullUser.loyalty_tier || 'bronze',
      loyaltyPoints: fullUser.loyalty_points ?? 0,
      emailVerified: fullUser.email_verified === 1,
      tenantId: resolvedTenant,
      createdAt: fullUser.created_at,
      updatedAt: fullUser.updated_at,
    };

    return c.json({
      success: true,
      data: {
        ...userPayload,
        user: userPayload,
      },
    });
  });

  // GET /api/auth/session - Get current session
  app.openapi(AuthRoutes.session as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');
    const now = new Date().toISOString();
    const requestedTenant = extractRequestedVerificationTenant(c);
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

    const session = await db.prepare(
      'SELECT id, expires_at, is_trusted_device, device_name, last_used_at FROM sessions WHERE access_token = ? AND user_id = ? AND expires_at > ?'
    ).bind(token, user.id, now).first();

    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }

    const fullUser = (await db.prepare(
      'SELECT id, name, email, phone, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, tenant_id FROM users WHERE id = ?'
    ).bind(user.id).first().catch(() => null)) || (await db.prepare(
      'SELECT id, name, email, phone, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url FROM users WHERE id = ?'
    ).bind(user.id).first());
    if (!fullUser) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const resolvedTenant =
      String((fullUser as any).tenant_id || user?.tenantId || user?.tenant_id || 'default').trim() || 'default';

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
          tenantId: resolvedTenant,
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
  app.openapi(AuthRoutes.verifyEmail as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const now = new Date().toISOString();
    const normalizedEmail = String(body.email || '').trim().toLowerCase();
    const requestedTenant = extractRequestedVerificationTenant(c);
    if (
      requestedTenant === '__CONFLICT__' ||
      requestedTenant === '*' ||
      requestedTenant.toLowerCase() === 'hq'
    ) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const rawVerifyTenant = (requestedTenant || resolvePublicTenantId(c)).trim();
    const targetTenant =
      rawVerifyTenant && rawVerifyTenant !== '*' && rawVerifyTenant.toLowerCase() !== 'hq'
        ? rawVerifyTenant
        : 'default';
    const attemptsKey = `verify_attempts:${normalizedEmail}`;

    if (c.env?.AUTH_KV?.get) {
      const priorAttempts = Number((await c.env.AUTH_KV.get(attemptsKey).catch(() => null)) || 0);
      if (priorAttempts >= 5) {
        return c.json({ success: false, error: 'Too many verification attempts' }, 429);
      }
    }

    let verification: any = null;
    try {
      verification = await db.prepare(
        "SELECT * FROM email_verifications WHERE lower(email) = lower(?) AND expires_at > ? AND COALESCE(used, 0) = 0 AND COALESCE(type, 'email_verification') != 'password_reset' ORDER BY created_at DESC LIMIT 1"
      ).bind(body.email, now).first();
    } catch {
      verification = await db.prepare(
        'SELECT * FROM email_verifications WHERE lower(email) = lower(?) AND expires_at > ? ORDER BY created_at DESC LIMIT 1'
      ).bind(body.email, now).first().catch(() => null);
    }
    if (verification && (verification.type === 'password_reset' || Number(verification.used || 0) === 1)) {
      verification = null;
    }

    const storedCode = String(verification?.code ?? verification?.token ?? '');
    if (!verification || !storedCode || !timingSafeEqualString(storedCode, String(body.code || ''))) {
      let attempts = 1;
      if (c.env?.AUTH_KV?.get && c.env?.AUTH_KV?.put) {
        const prev = Number((await c.env.AUTH_KV.get(attemptsKey).catch(() => null)) || 0);
        attempts = prev + 1;
        await c.env.AUTH_KV.put(attemptsKey, String(attempts), { expirationTtl: 900 }).catch(() => {});
      }
      if (attempts >= 5) {
        if (verification?.id) {
          await db.prepare('UPDATE email_verifications SET used = 1 WHERE id = ?').bind(verification.id).run().catch(() => {});
        }
        return c.json({ success: false, error: 'Too many verification attempts' }, 429);
      }
      return c.json({ success: false, error: 'Invalid or expired code' }, 400);
    }

    const user = (await db.prepare(
      "SELECT * FROM users WHERE lower(email) = lower(?) ORDER BY CASE WHEN COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? THEN 0 ELSE 1 END LIMIT 1"
    ).bind(body.email, targetTenant).first().catch(() => null)) || (await db.prepare(
      'SELECT * FROM users WHERE lower(email) = lower(?)'
    ).bind(body.email).first());
    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }
    if (user.is_active === 0 || user.is_active === false) {
      return c.json({ success: false, error: 'Account is inactive' }, 403);
    }
    const existingUserTenant = String((user as any).tenant_id || '').trim();
    if (requestedTenant && existingUserTenant && existingUserTenant !== requestedTenant) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }

    if (c.env?.AUTH_KV?.delete) {
      await c.env.AUTH_KV.delete(attemptsKey).catch(() => {});
    }
    await db.prepare('UPDATE email_verifications SET used = 1, verified_at = ? WHERE id = ?').bind(now, verification.id).run();
    await db.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').bind(now, user.id).run();

    const sessionId = crypto.randomUUID();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare(
      `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, is_trusted_device, device_fingerprint, device_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, user.id, accessToken, refreshToken, expiresAt, 0, null, null, now, now).run();

    const userTenant = String(existingUserTenant || targetTenant || 'default').trim() || 'default';
    await writeAuthAuditLog(db, user.id, 'verify_email', 'user', user.id, JSON.stringify({}), now, userTenant);

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, locale: user.locale,
          loyaltyTier: user.loyalty_tier, loyaltyPoints: user.loyalty_points, emailVerified: true,
          avatarUrl: user.avatar_url, tenantId: userTenant, createdAt: user.created_at, updatedAt: user.updated_at,
        },
        session: { id: sessionId, accessToken, refreshToken, expiresAt, isTrustedDevice: false },
      },
    });
  });

  registerForgotPasswordHandler(app);
}
