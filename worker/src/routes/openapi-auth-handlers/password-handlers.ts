import type { OpenAPIHono } from '@hono/zod-openapi';
import { createLogger } from '../../middleware/logger';
import type { Env } from '../../types/env';
import { requireStaffAccount } from '../../lib/staff-session';
import { changeStaffPassword } from '../../lib/staff-password';
import { findLoginUser } from '../../lib/staff-login-identity';
import { getAuthToken } from '../../lib/jwt';
import { resolvePublicTenantId } from '../../middleware/tenant';
import { AuthRoutes } from '../../schemas/auth';
import { hashPassword, verifyPassword, writeAuthAuditLog } from './helpers';

const fallbackResetVerifyAttempts = new Map<string, number>();

function constantTimeEqualCode(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  const maxLen = Math.max(bufA.length, bufB.length, 1);
  let diff = bufA.length ^ bufB.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return diff === 0;
}

async function resolveResetTargetUser(db: any, env: Env, email: string): Promise<{ id: string; role?: string; tenant_id?: string } | null> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  let user = await db.prepare('SELECT id, role, tenant_id FROM users WHERE lower(email) = lower(?)').bind(normalizedEmail).first().catch(() => null);
  if (!user) {
    user = await db.prepare('SELECT id, role FROM users WHERE lower(email) = lower(?)').bind(normalizedEmail).first().catch(() => null);
  }
  if (!user) {
    user = await db.prepare('SELECT id, role FROM users WHERE email = ?').bind(normalizedEmail).first().catch(() => null);
  }
  if (!user) {
    user = await db.prepare(
      'SELECT u.id, u.role, u.tenant_id FROM staff_login_identities s JOIN users u ON u.id = s.staff_id WHERE lower(s.email) = lower(?)'
    ).bind(normalizedEmail).first().catch(() => null);
  }
  if (!user) {
    user = await db.prepare(
      'SELECT u.id, u.role FROM staff_login_identities s JOIN users u ON u.id = s.staff_id WHERE lower(s.email) = lower(?)'
    ).bind(normalizedEmail).first().catch(() => null);
  }
  if (!user) {
    user = await db.prepare(
      'SELECT staff_id AS id FROM staff_login_identities WHERE lower(email) = lower(?)'
    ).bind(normalizedEmail).first().catch(() => null);
  }
  if (!user && env) {
    const kvOrStaffUser = await findLoginUser(env, normalizedEmail).catch(() => null);
    if (kvOrStaffUser?.id) {
      user = { id: kvOrStaffUser.id, role: kvOrStaffUser.role, tenant_id: (kvOrStaffUser as { tenant_id?: string }).tenant_id };
    }
  }
  return user;
}

async function invalidatePriorPasswordResetCodes(db: any, normalizedEmail: string, userId?: string): Promise<void> {
  if (userId) {
    await db.prepare(
      'UPDATE password_resets SET used = 1 WHERE (user_id = ? OR lower(email) = lower(?)) AND COALESCE(used, 0) = 0'
    ).bind(userId, normalizedEmail).run().catch(() => {
      return db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND COALESCE(used, 0) = 0').bind(userId).run().catch(() => {});
    });
  } else {
    await db.prepare(
      'UPDATE password_resets SET used = 1 WHERE lower(email) = lower(?) AND COALESCE(used, 0) = 0'
    ).bind(normalizedEmail).run().catch(() => {});
  }
  await db.prepare(
    "UPDATE otp_codes SET used = 1 WHERE lower(email) = lower(?) AND purpose = 'password_reset' AND COALESCE(used, 0) = 0"
  ).bind(normalizedEmail).run().catch(() => {});
  await db.prepare(
    "UPDATE email_verifications SET used = 1 WHERE lower(email) = lower(?) AND type = 'password_reset' AND COALESCE(used, 0) = 0"
  ).bind(normalizedEmail).run().catch(() => {});
}

export function registerForgotPasswordHandler(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/auth/forgot-password - Request password reset with client-IP and email rate limiting
  app.post('/api/auth/forgot-password', async (c: any) => {
    const db = c.env.AURA_DB;
    const data = (await c.req.json().catch(() => ({}))) as { email?: string };
    const normalizedEmail = String(data.email || '').trim().toLowerCase();
    const clientIp =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For') ||
      normalizedEmail ||
      'ip';

    if (c.env?.AUTH_KV) {
      const rlKey = `rate:forgot-password:${clientIp}`;
      const emailRlKey = normalizedEmail ? `rate:forgot-password:email:${normalizedEmail}` : null;
      const count = Number((await c.env.AUTH_KV.get(rlKey)) || 0);
      const emailCount = emailRlKey ? Number((await c.env.AUTH_KV.get(emailRlKey)) || 0) : 0;
      if (count >= 5 || emailCount >= 5) {
        return c.json({ success: false, error: 'Too many password reset requests' }, 429);
      }
      await c.env.AUTH_KV.put(rlKey, String(count + 1), { expirationTtl: 300 });
      if (emailRlKey) {
        await c.env.AUTH_KV.put(emailRlKey, String(emailCount + 1), { expirationTtl: 300 });
      }
    }

    if (!normalizedEmail) {
      return c.json({ success: false, error: 'Email is required' }, 400);
    }

    const user = await resolveResetTargetUser(db, c.env, normalizedEmail);
    if (!user) {
      return c.json({ success: true, data: { success: true } });
    }

    await invalidatePriorPasswordResetCodes(db, normalizedEmail);

    const randomBuf = new Uint32Array(1);
    crypto.getRandomValues(randomBuf);
    const code = (100000 + (randomBuf[0] % 900000)).toString();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const resetId = crypto.randomUUID();

    await db.prepare(
      `INSERT INTO email_verifications (id, email, code, type, expires_at, used, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(resetId, normalizedEmail, code, 'password_reset', expiresAt, 0, now).run();

    await db.prepare(
      `INSERT INTO otp_codes (id, email, code, purpose, expires_at, used, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), normalizedEmail, code, 'password_reset', expiresAt, 0, now).run().catch(() => {});

    return c.json({ success: true, data: { success: true } });
  });
}

export function registerPasswordHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/auth/reset-password - Request or complete password reset
  app.openapi(AuthRoutes.resetPassword as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const rawBody = (await c.req.json().catch(() => ({}))) as {
      email?: string;
      code?: string;
      otp?: string;
      newPassword?: string;
      new_password?: string;
      password?: string;
    };
    const body = c.req.valid('json');
    const now = new Date().toISOString();
    const normalizedEmail = String(rawBody.email || body.email || '').trim().toLowerCase();
    const submittedCode = String(rawBody.code || rawBody.otp || '').trim();
    const submittedNewPassword = String(rawBody.newPassword || rawBody.new_password || rawBody.password || '');
    const clientIp =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For') ||
      normalizedEmail ||
      'ip';

    if (submittedCode && submittedNewPassword) {
      const targetUser = await resolveResetTargetUser(db, c.env, normalizedEmail);
      const resetTenant = String(targetUser?.tenant_id || resolvePublicTenantId(c) || 'default').trim() || 'default';
      const attemptKey = `rate:reset-password:attempts:${normalizedEmail || clientIp}`;
      const ipVerifyKey = `rate:reset-password:verify:${clientIp}`;
      let failedAttempts = 0;
      if (c.env?.AUTH_KV) {
        const ipVerifyCount = Number((await c.env.AUTH_KV.get(ipVerifyKey).catch(() => null)) || 0);
        if (ipVerifyCount >= 15) {
          return c.json({ success: false, error: 'Too many password reset requests' }, 429);
        }
        await c.env.AUTH_KV.put(ipVerifyKey, String(ipVerifyCount + 1), { expirationTtl: 300 }).catch(() => {});
        failedAttempts = Number((await c.env.AUTH_KV.get(attemptKey).catch(() => null)) || 0);
      } else {
        failedAttempts = fallbackResetVerifyAttempts.get(attemptKey) || 0;
      }

      if (failedAttempts >= 5) {
        await invalidatePriorPasswordResetCodes(db, normalizedEmail, targetUser?.id);
        await writeAuthAuditLog(
          db,
          targetUser?.id || 'anonymous',
          'PASSWORD_RESET_FAILED',
          'user',
          targetUser?.id || normalizedEmail || 'unknown',
          JSON.stringify({ email: normalizedEmail, reason: 'locked_out', attempts: failedAttempts }),
          now,
          resetTenant
        );
        return c.json({ success: false, error: 'Too many failed password reset attempts' }, 429);
      }

      const latestPasswordReset = await db.prepare(
        `SELECT id, code, used, expires_at FROM password_resets
         WHERE (user_id = ? OR lower(email) = lower(?)) AND COALESCE(used, 0) = 0 AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`
      ).bind(targetUser?.id || '', normalizedEmail, now).first().catch(async () => {
        return db.prepare(
          `SELECT id, code, used, expires_at FROM password_resets
           WHERE user_id = ? AND COALESCE(used, 0) = 0 AND expires_at > ?
           ORDER BY created_at DESC LIMIT 1`
        ).bind(targetUser?.id || '', now).first().catch(() => null);
      });
      const latestOtp = await db.prepare(
        `SELECT id, code, used, expires_at FROM otp_codes
         WHERE lower(email) = lower(?) AND purpose = 'password_reset' AND COALESCE(used, 0) = 0 AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`
      ).bind(normalizedEmail, now).first().catch(() => null);
      const latestEmailVer = await db.prepare(
        `SELECT id, code, used, expires_at FROM email_verifications
         WHERE lower(email) = lower(?) AND type = 'password_reset' AND COALESCE(used, 0) = 0 AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`
      ).bind(normalizedEmail, now).first().catch(() => null);

      const passwordResetMatches =
        latestPasswordReset &&
        Number((latestPasswordReset as any).used ?? 0) === 0 &&
        constantTimeEqualCode(String((latestPasswordReset as any).code || ''), submittedCode);
      const otpMatches =
        latestOtp &&
        Number((latestOtp as any).used ?? 0) === 0 &&
        constantTimeEqualCode(String((latestOtp as any).code || ''), submittedCode);
      const emailVerMatches =
        latestEmailVer &&
        Number((latestEmailVer as any).used ?? 0) === 0 &&
        constantTimeEqualCode(String((latestEmailVer as any).code || ''), submittedCode);

      if ((!passwordResetMatches && !otpMatches && !emailVerMatches) || !targetUser) {
        const nextAttempts = failedAttempts + 1;
        if (c.env?.AUTH_KV) {
          await c.env.AUTH_KV.put(attemptKey, String(nextAttempts), { expirationTtl: 900 }).catch(() => {});
        } else {
          fallbackResetVerifyAttempts.set(attemptKey, nextAttempts);
        }
        if (nextAttempts >= 5) {
          await invalidatePriorPasswordResetCodes(db, normalizedEmail, targetUser?.id);
          await writeAuthAuditLog(
            db,
            targetUser?.id || 'anonymous',
            'PASSWORD_RESET_FAILED',
            'user',
            targetUser?.id || normalizedEmail || 'unknown',
            JSON.stringify({ email: normalizedEmail, attempts: nextAttempts, lockedOut: true }),
            now,
            resetTenant
          );
          return c.json({ success: false, error: 'Too many failed password reset attempts' }, 429);
        }
        await writeAuthAuditLog(
          db,
          targetUser?.id || 'anonymous',
          'PASSWORD_RESET_FAILED',
          'user',
          targetUser?.id || normalizedEmail || 'unknown',
          JSON.stringify({ email: normalizedEmail, attempts: nextAttempts }),
          now,
          resetTenant
        );
        return c.json({ success: false, error: 'Invalid or expired reset code' }, 400);
      }

      if (c.env?.AUTH_KV) {
        await c.env.AUTH_KV.delete?.(attemptKey)?.catch?.(() => {});
      } else {
        fallbackResetVerifyAttempts.delete(attemptKey);
      }

      await invalidatePriorPasswordResetCodes(db, normalizedEmail, targetUser.id);

      const passwordHash = await hashPassword(submittedNewPassword);
      if (targetUser.role && targetUser.role !== 'customer') {
        await changeStaffPassword(db, await requireStaffAccount(db, targetUser.id), passwordHash);
      } else {
        let nextVersion = 2;
        const currentRow = (await db.prepare('SELECT auth_version FROM users WHERE id = ?').bind(targetUser.id).first().catch(() => null)) as { auth_version?: number } | null;
        if (currentRow && Number.isFinite(Number(currentRow.auth_version))) {
          nextVersion = Math.max(nextVersion, Number(currentRow.auth_version) + 1);
        }
        await db.prepare(
          'UPDATE users SET password_hash = ?, auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ?'
        ).bind(passwordHash, now, targetUser.id).run().catch(async () => {
          await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(passwordHash, now, targetUser.id).run().catch(() => {});
        });
        if (c.env?.AUTH_KV) {
          try {
            if (normalizedEmail) {
              const rawUser = await c.env.AUTH_KV.get(`user:${normalizedEmail}`);
              if (rawUser) {
                const parsed = JSON.parse(rawUser) as Record<string, unknown>;
                const currentVer = Number(parsed.auth_version || 1);
                nextVersion = Math.max(nextVersion, currentVer + 1);
                parsed.auth_version = nextVersion;
                parsed.password_hash = passwordHash;
                parsed.password = passwordHash;
                parsed.updated_at = now;
                await c.env.AUTH_KV.put(`user:${normalizedEmail}`, JSON.stringify(parsed));
              }
            }
            if (targetUser.id) {
              const rawCustVer = await c.env.AUTH_KV.get(`cust_auth_ver:${targetUser.id}`);
              if (rawCustVer) {
                const currentCustVer = Number(rawCustVer);
                if (Number.isFinite(currentCustVer) && currentCustVer >= nextVersion) {
                  nextVersion = currentCustVer + 1;
                }
              }
              await c.env.AUTH_KV.put(`cust_auth_ver:${targetUser.id}`, String(nextVersion));
              const rawById = await c.env.AUTH_KV.get(`user:${targetUser.id}`);
              if (rawById) {
                const parsedById = JSON.parse(rawById) as Record<string, unknown>;
                parsedById.auth_version = nextVersion;
                parsedById.password_hash = passwordHash;
                parsedById.password = passwordHash;
                parsedById.updated_at = now;
                await c.env.AUTH_KV.put(`user:${targetUser.id}`, JSON.stringify(parsedById));
              }
            }
          } catch {
            return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Authentication state store unavailable', retryable: true }, 503);
          }
        }
      }
      await db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').bind(now, targetUser.id).run().catch(() => {});
      await writeAuthAuditLog(
        db,
        targetUser.id,
        'PASSWORD_RESET_SUCCESS',
        'user',
        targetUser.id,
        JSON.stringify({ email: normalizedEmail }),
        now,
        resetTenant
      );
      return c.json({ success: true, data: { success: true } });
    }

    if (c.env?.AUTH_KV) {
      const rlKey = `rate:reset-password:${clientIp}`;
      const emailRlKey = normalizedEmail ? `rate:reset-password:email:${normalizedEmail}` : null;
      const count = Number((await c.env.AUTH_KV.get(rlKey).catch(() => null)) || 0);
      const emailCount = emailRlKey ? Number((await c.env.AUTH_KV.get(emailRlKey)) || 0) : 0;
      if (count >= 5 || emailCount >= 5) {
        return c.json({ success: false, error: 'Too many password reset requests' }, 429);
      }
      await c.env.AUTH_KV.put(rlKey, String(count + 1), { expirationTtl: 300 }).catch(() => {});
      if (emailRlKey) {
        await c.env.AUTH_KV.put(emailRlKey, String(emailCount + 1), { expirationTtl: 300 }).catch(() => {});
      }
    }

    const user = await resolveResetTargetUser(db, c.env, normalizedEmail);
    if (!user) {
      return c.json({ success: true, data: { success: true } });
    }

    await invalidatePriorPasswordResetCodes(db, normalizedEmail);

    const randomBuf = new Uint32Array(1);
    crypto.getRandomValues(randomBuf);
    const code = (100000 + (randomBuf[0] % 900000)).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await db.prepare(
      `INSERT INTO email_verifications (id, email, code, type, expires_at, used, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), normalizedEmail, code, 'password_reset', expiresAt, 0, now).run();

    await db.prepare(
      `INSERT INTO otp_codes (id, email, code, purpose, expires_at, used, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), normalizedEmail, code, 'password_reset', expiresAt, 0, now).run().catch(() => {});

    const log = createLogger({ route: 'auth.reset-password' });
    log.info('password_reset_code_generated', { email: normalizedEmail });

    return c.json({ success: true, data: { success: true } });
  });

  // POST /api/auth/change-password - Change password
  app.openapi(AuthRoutes.changePassword as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const userRecord = await db
      .prepare('SELECT password_hash, tenant_id, auth_version FROM users WHERE id = ?')
      .bind(user.id)
      .first()
      .catch(async () => {
        return db
          .prepare('SELECT password_hash, tenant_id FROM users WHERE id = ?')
          .bind(user.id)
          .first()
          .catch(async () => {
            return db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
          });
      });
    if (!userRecord || !await verifyPassword(body.currentPassword, userRecord.password_hash)) {
      return c.json({ success: false, error: 'Invalid current password' }, 401);
    }

    const passwordHash = await hashPassword(body.newPassword);
    let dbNextVersion = Math.max(
      Number(user.authVersion ?? user.auth_version ?? 1),
      Number((userRecord as any)?.auth_version || 1)
    ) + 1;
    if (user.role !== 'customer') await changeStaffPassword(db, await requireStaffAccount(db, user.id), passwordHash);
    else {
      try {
        await db.prepare('UPDATE users SET password_hash = ?, auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ?').bind(passwordHash, now, user.id).run();
        const refreshed = await db.prepare('SELECT auth_version FROM users WHERE id = ?').bind(user.id).first().catch(() => null);
        if (refreshed && Number.isFinite(Number((refreshed as any).auth_version))) {
          dbNextVersion = Math.max(dbNextVersion, Number((refreshed as any).auth_version));
        }
      } catch {
        await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(passwordHash, now, user.id).run();
      }
    }
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').bind(now, user.id).run().catch(() => {});
    if (c.env.AUTH_KV) {
      try {
        let nextVersion = dbNextVersion;
        if (user.email) {
          const rawUser = await c.env.AUTH_KV.get(`user:${user.email}`);
          if (rawUser) {
            const parsed = JSON.parse(rawUser) as Record<string, unknown>;
            const currentVer = Number(parsed.auth_version || 1);
            nextVersion = Math.max(nextVersion, currentVer + 1);
            parsed.auth_version = nextVersion;
            parsed.password_hash = passwordHash;
            parsed.password = passwordHash;
            parsed.updated_at = now;
            await c.env.AUTH_KV.put(`user:${user.email}`, JSON.stringify(parsed));
          }
        }
        if (user.id) {
          const rawCustVer = await c.env.AUTH_KV.get(`cust_auth_ver:${user.id}`);
          if (rawCustVer) {
            const currentCustVer = Number(rawCustVer);
            if (Number.isFinite(currentCustVer) && currentCustVer >= nextVersion) {
              nextVersion = currentCustVer + 1;
            }
          }
          await c.env.AUTH_KV.put(`cust_auth_ver:${user.id}`, String(nextVersion));
          const rawById = await c.env.AUTH_KV.get(`user:${user.id}`);
          if (rawById) {
            const parsedById = JSON.parse(rawById) as Record<string, unknown>;
            parsedById.auth_version = nextVersion;
            parsedById.password_hash = passwordHash;
            parsedById.password = passwordHash;
            parsedById.updated_at = now;
            await c.env.AUTH_KV.put(`user:${user.id}`, JSON.stringify(parsedById));
          }
        }
      } catch {
        if (user.role === 'customer') {
          return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Authentication state store unavailable', retryable: true }, 503);
        }
      }
    }
    const token = getAuthToken(c.req.raw);
    if (token && c.env.AUTH_KV) {
      try {
        await c.env.AUTH_KV.put('revoked:' + token, '1', { expirationTtl: 604800 });
      } catch {
        if (user.role === 'customer') {
          return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Authentication state store unavailable', retryable: true }, 503);
        }
      }
    }

    const changeTenant = String(user?.tenantId || user?.tenant_id || (userRecord as any)?.tenant_id || resolvePublicTenantId(c) || 'default').trim() || 'default';
    await writeAuthAuditLog(db, user.id, 'change_password', 'user', user.id, JSON.stringify({}), now, changeTenant);

    return c.json({ success: true, data: { success: true } });
  });
}
