import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/auth';
import { audit } from '../middleware/audit-log';
import { createLogger } from '../middleware/logger';
import type { Env } from '../types/env';
import {
  AuthRoutes,
  RegisterSchema,
  LoginSchema,
  VerifyEmailSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  RegisterStaffSchema,
  BootstrapOwnerSchema,
  AuthResponseSchema,
  SessionResponseSchema,
  StaffResponseSchema,
  StaffListResponseSchema,
  TrustedDeviceSchema,
  IdParamsSchema,
} from '../schemas/auth';
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
} from '../schemas/common';

export const openApiAuthRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to protected routes only
const publicPaths = ['/register', '/login', '/verify-email', '/reset-password', '/bootstrap-owner'];
openApiAuthRouter.use('*', async (c, next) => {
  const path = c.req.path;
  if (publicPaths.some(p => path.endsWith(p))) {
    return next();
  }
  return requireAuth(['owner', 'manager', 'staff'])(c, next);
});

// POST /api/auth/register - Register new customer
openApiAuthRouter.openapi(AuthRoutes.register, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  // Check if email exists
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(body.email).first();
  if (existing) {
    return c.json({ success: false, error: 'Email already exists' }, 409);
  }

  // Hash password (using simple hash for now - should use bcrypt/argon2 in production)
  const passwordHash = await hashPassword(body.password);

  const id = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  await db.prepare(
    `INSERT INTO users (id, name, email, phone, password_hash, role, locale, loyalty_tier, loyalty_points, email_verified, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.name,
    body.email,
    body.phone || null,
    passwordHash,
    'customer',
    body.locale || 'vi',
    'bronze',
    0,
    false,
    null,
    now,
    now
  ).run();

  await db.prepare(
    `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, is_trusted_device, device_fingerprint, device_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    sessionId,
    id,
    accessToken,
    refreshToken,
    expiresAt,
    !!body.deviceFingerprint,
    body.deviceFingerprint || null,
    null,
    now,
    now
  ).run();

  // Audit log
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
openApiAuthRouter.openapi(AuthRoutes.login, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const user = await db.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(body.email).first();

  if (!user || !await verifyPassword(body.password, user.password_hash)) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  const sessionId = crypto.randomUUID();
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const expiresAt = new Date(Date.now() + (body.rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000).toISOString();

  // Check if device is trusted
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
  ).bind(
    sessionId,
    user.id,
    accessToken,
    refreshToken,
    expiresAt,
    isTrustedDevice,
    body.deviceFingerprint || null,
    null,
    now,
    now
  ).run();

  // Audit log
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
openApiAuthRouter.openapi(AuthRoutes.logout, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const user = c.get('user');
  const now = new Date().toISOString();

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE access_token = ?').bind(now, token).run();
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'logout', 'session', token || 'unknown', JSON.stringify({}), now).run();

  return c.json({ success: true, data: { success: true } });
});

// GET /api/auth/me - Get current user profile
openApiAuthRouter.openapi(AuthRoutes.me, async (c: Context<{ Bindings: Env }>) => {
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
openApiAuthRouter.openapi(AuthRoutes.session, async (c: Context<{ Bindings: Env }>) => {
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
openApiAuthRouter.openapi(AuthRoutes.verifyEmail, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  // Check verification code (stored in email_verifications table)
  const verification = await db.prepare(
    'SELECT * FROM email_verifications WHERE email = ? AND code = ? AND expires_at > ? AND used = 0'
  ).bind(body.email, body.code, now).first();

  if (!verification) {
    return c.json({ success: false, error: 'Invalid or expired code' }, 400);
  }

  // Mark verification as used
  await db.prepare('UPDATE email_verifications SET used = 1, verified_at = ? WHERE id = ?').bind(now, verification.id).run();

  // Update user email_verified
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

  // Audit log
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

// POST /api/auth/register-staff - Register staff (owner only)
openApiAuthRouter.openapi(AuthRoutes.registerStaff, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid('json');
  const user = c.get('user');
  const now = new Date().toISOString();

  // Check if user is owner
  if (user.role !== 'owner') {
    return c.json({ success: false, error: 'Only owners can register staff' }, 403);
  }

  // Check if email exists
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
    id,
    body.name,
    body.email,
    body.phone || null,
    passwordHash,
    body.role,
    body.locale || 'vi',
    'bronze',
    0,
    true,
    null,
    now,
    now
  ).run();

  // Audit log
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
openApiAuthRouter.openapi(AuthRoutes.listStaff, async (c: Context<{ Bindings: Env }>) => {
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
openApiAuthRouter.openapi(AuthRoutes.bootstrapOwner, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  // Check if owner already exists
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
    id,
    body.name,
    body.email,
    body.phone || null,
    passwordHash,
    'owner',
    body.locale || 'vi',
    'diamond',
    0,
    true,
    null,
    now,
    now
  ).run();

  await db.prepare(
    `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, is_trusted_device, device_fingerprint, device_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(sessionId, id, accessToken, refreshToken, expiresAt, true, null, 'Bootstrap Device', now, now).run();

  // Audit log
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

// POST /api/auth/reset-password - Request password reset
openApiAuthRouter.openapi(AuthRoutes.resetPassword, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(body.email).first();
  if (!user) {
    // Don't reveal if email exists
    return c.json({ success: true, data: { success: true } });
  }

  // Generate reset token (6 digit code)
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

  await db.prepare(
    `INSERT INTO email_verifications (id, email, code, type, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), body.email, code, 'password_reset', expiresAt, 0, now).run();

  // TODO: Send email with reset code
  const log = createLogger({ route: 'auth.reset-password' });
  log.info('password_reset_code_generated', { email: body.email, code });

  return c.json({ success: true, data: { success: true } });
});

// POST /api/auth/change-password - Change password
openApiAuthRouter.openapi(AuthRoutes.changePassword, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid('json');
  const user = c.get('user');
  const now = new Date().toISOString();

  const userRecord = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
  if (!userRecord || !await verifyPassword(body.currentPassword, userRecord.password_hash)) {
    return c.json({ success: false, error: 'Invalid current password' }, 401);
  }

  const passwordHash = await hashPassword(body.newPassword);
  await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(passwordHash, now, user.id).run();

  // Invalidate all sessions
  await db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').bind(now, user.id).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'change_password', 'user', user.id, JSON.stringify({}), now).run();

  return c.json({ success: true, data: { success: true } });
});

// GET /api/auth/devices - List trusted devices
openApiAuthRouter.openapi(AuthRoutes.trustedDevices.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const user = c.get('user');

  const devices = await db.prepare(
    `SELECT id, fingerprint, name, platform, browser, ip, is_trusted, last_used_at, created_at, expires_at
     FROM trusted_devices WHERE user_id = ? ORDER BY created_at DESC`
  ).bind(user.id).all();

  return c.json({
    success: true,
    data: devices.results.map(d => ({
      ...d,
      isTrusted: d.is_trusted === 1,
      platform: d.platform,
      browser: d.browser,
      lastUsedAt: d.last_used_at,
      createdAt: d.created_at,
      expiresAt: d.expires_at,
    })),
  });
});

// DELETE /api/auth/devices/{id} - Revoke trusted device
openApiAuthRouter.openapi(AuthRoutes.trustedDevices.revoke, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const user = c.get('user');
  const { id } = c.req.valid('param');
  const now = new Date().toISOString();

  const device = await db.prepare('SELECT * FROM trusted_devices WHERE id = ? AND user_id = ?').bind(id, user.id).first();
  if (!device) {
    return c.json({ success: false, error: 'Device not found' }, 404);
  }

  await db.prepare('DELETE FROM trusted_devices WHERE id = ?').bind(id).run();
  await db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ? AND device_fingerprint = ?').bind(now, user.id, device.fingerprint).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'revoke_device', 'trusted_device', id, JSON.stringify({ name: device.name }), now).run();

  return c.json({ success: true, data: { success: true } });
});

// DELETE /api/auth/devices - Revoke all trusted devices
openApiAuthRouter.openapi(AuthRoutes.trustedDevices.revokeAll, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const user = c.get('user');
  const now = new Date().toISOString();

  await db.prepare('DELETE FROM trusted_devices WHERE user_id = ?').bind(user.id).run();
  await db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').bind(now, user.id).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'revoke_all_devices', 'trusted_device', user.id, JSON.stringify({}), now).run();

  return c.json({ success: true, data: { success: true } });
});

// Helper functions
async function hashPassword(password: string): Promise<string> {
  // In production, use bcrypt or argon2
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'aura_salt_' + crypto.randomUUID());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // In production, use bcrypt.compare or argon2.verify
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'aura_salt_' + hash.slice(0, 36)); // Simplified - extract salt from hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHash === hash;
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

export default openApiAuthRouter;
