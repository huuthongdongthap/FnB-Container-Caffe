import type { OpenAPIHono } from '@hono/zod-openapi';
import { createLogger } from '../../middleware/logger';
import type { Env } from '../../types/env';
import { requireStaffAccount } from '../../lib/staff-session';
import { changeStaffPassword } from '../../lib/staff-password';
import { findLoginUser } from '../../lib/staff-login-identity';
import { getAuthToken } from '../../lib/jwt';
import { getClientIdentifier } from '../../middleware/rate-limit';
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

function isErasedOrInactiveRecord(record: Record<string, unknown> | null | undefined): boolean {
  if (!record || typeof record !== 'object') return false;
  if (record.is_active === 0 || record.is_active === false) return true;
  if (record.anonymized_at) return true;
  if (record.name === '[ERASED]') return true;
  if (typeof record.phone === 'string' && record.phone.startsWith('erased_')) return true;
  return false;
}

async function isUserErasedOrInactive(db: any, userId: string): Promise<boolean> {
  if (!db?.prepare || !userId) return false;
  const userState = await db
    .prepare('SELECT id, is_active, name, phone FROM users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first()
    .catch(() => null);
  if (userState && String((userState as { id?: unknown }).id || userId) === userId && isErasedOrInactiveRecord(userState as Record<string, unknown>)) {
    return true;
  }
  const custState = await db
    .prepare('SELECT id, name, phone, anonymized_at FROM customers WHERE id = ? LIMIT 1')
    .bind(userId)
    .first()
    .catch(() =>
      db
        .prepare('SELECT id, name, phone FROM customers WHERE id = ? LIMIT 1')
        .bind(userId)
        .first()
        .catch(() => null)
    );
  if (custState && String((custState as { id?: unknown }).id || userId) === userId && isErasedOrInactiveRecord(custState as Record<string, unknown>)) {
    return true;
  }
  const eraseEvent = await db
    .prepare("SELECT event_type FROM customer_events WHERE customer_id = ? AND event_type = 'CustomerDataErased' LIMIT 1")
    .bind(userId)
    .first()
    .catch(() => null);
  if (eraseEvent && (eraseEvent as { event_type?: unknown }).event_type === 'CustomerDataErased') {
    return true;
  }
  return false;
}

async function resolveResetTargetUser(
  db: any,
  env: Env,
  email: string,
  requestedTenant?: string
): Promise<{ id: string; role?: string; tenant_id?: string } | null> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  const cleanTenant = typeof requestedTenant === 'string' && requestedTenant.trim() && requestedTenant.trim() !== '*'
    ? requestedTenant.trim()
    : '';
  let user: { id: string; role?: string; tenant_id?: string } | null = null;
  if (cleanTenant) {
    user = await db
      .prepare("SELECT id, role, tenant_id FROM users WHERE lower(email) = lower(?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(normalizedEmail, cleanTenant)
      .first()
      .catch(() => null);
    if (!user) {
      user = await db
        .prepare(
          "SELECT u.id, u.role, u.tenant_id FROM staff_login_identities s JOIN users u ON u.id = s.staff_id WHERE lower(s.email) = lower(?) AND COALESCE(NULLIF(TRIM(u.tenant_id), ''), 'default') = ?"
        )
        .bind(normalizedEmail, cleanTenant)
        .first()
        .catch(() => null);
    }
    if (!user) {
      user = await db
        .prepare("SELECT id, 'customer' AS role, tenant_id FROM customers WHERE lower(email) = lower(?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(normalizedEmail, cleanTenant)
        .first()
        .catch(() => null);
    }
  }
  if (!user && (!cleanTenant || cleanTenant === 'default')) {
    user = await db.prepare('SELECT id, role, tenant_id FROM users WHERE lower(email) = lower(?)').bind(normalizedEmail).first().catch(() => null);
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
    if (!user) {
      user = await db.prepare("SELECT id, 'customer' AS role, tenant_id FROM customers WHERE lower(email) = lower(?)").bind(normalizedEmail).first().catch(() => null);
    }
    if (!user) {
      user = await db.prepare("SELECT id, 'customer' AS role FROM customers WHERE lower(email) = lower(?)").bind(normalizedEmail).first().catch(() => null);
    }
  }
  if (!user && env) {
    const kvOrStaffUser = await findLoginUser(env, normalizedEmail).catch(() => null);
    if (kvOrStaffUser?.id && !isErasedOrInactiveRecord(kvOrStaffUser as Record<string, unknown>)) {
      const kvTenant = String((kvOrStaffUser as { tenant_id?: string; tenantId?: string }).tenant_id || (kvOrStaffUser as { tenantId?: string }).tenantId || 'default').trim() || 'default';
      if (!cleanTenant || kvTenant === cleanTenant) {
        user = { id: kvOrStaffUser.id, role: kvOrStaffUser.role, tenant_id: (kvOrStaffUser as { tenant_id?: string }).tenant_id };
      }
    }
  }
  if (user && (isErasedOrInactiveRecord(user as unknown as Record<string, unknown>) || (await isUserErasedOrInactive(db, user.id)))) {
    return null;
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

async function storeEmailVerificationResetCode(
  db: any,
  resetId: string,
  normalizedEmail: string,
  code: string,
  expiresAt: string,
  now: string
): Promise<void> {
  const isConflictTargetMissing = (msg: string) =>
    msg.includes('on conflict') || msg.includes('unique constraint') || msg.includes('primary key');

  try {
    await db.prepare(
      `INSERT INTO email_verifications (id, email, code, type, expires_at, used, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         id = excluded.id,
         code = excluded.code,
         type = excluded.type,
         expires_at = excluded.expires_at,
         used = 0,
         attempts = 0,
         created_at = excluded.created_at`
    ).bind(resetId, normalizedEmail, code, 'password_reset', expiresAt, 0, now).run();
    return;
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (msg.includes('attempts')) {
      try {
        await db.prepare(
          `INSERT INTO email_verifications (id, email, code, type, expires_at, used, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET
             id = excluded.id,
             code = excluded.code,
             type = excluded.type,
             expires_at = excluded.expires_at,
             used = 0,
             created_at = excluded.created_at`
        ).bind(resetId, normalizedEmail, code, 'password_reset', expiresAt, 0, now).run();
        return;
      } catch (retryErr: unknown) {
        const retryMsg = (retryErr instanceof Error ? retryErr.message : String(retryErr)).toLowerCase();
        if (!isConflictTargetMissing(retryMsg)) {
          throw retryErr;
        }
      }
    } else if (!isConflictTargetMissing(msg)) {
      throw err;
    }
  }

  await db.prepare(
    `INSERT INTO email_verifications (id, email, code, type, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(resetId, normalizedEmail, code, 'password_reset', expiresAt, 0, now).run();
}

export function registerForgotPasswordHandler(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/auth/forgot-password - Request password reset with client-IP and email rate limiting
  app.post('/api/auth/forgot-password', async (c: any) => {
    const db = c.env.AURA_DB;
    const data = (await c.req.json().catch(() => ({}))) as { email?: string };
    const normalizedEmail = String(data.email || '').trim().toLowerCase();
    const rawClientIp = getClientIdentifier(c);
    const clientIp = rawClientIp !== 'unknown' ? rawClientIp : normalizedEmail || 'ip';

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

    const requestedForgotTenant = String(resolvePublicTenantId(c) || '').trim();
    const user = await resolveResetTargetUser(db, c.env, normalizedEmail, requestedForgotTenant);
    if (!user) {
      return c.json({ success: true, data: { success: true } });
    }

    await invalidatePriorPasswordResetCodes(db, normalizedEmail, user.id);

    const randomBuf = new Uint32Array(1);
    crypto.getRandomValues(randomBuf);
    const code = (100000 + (randomBuf[0] % 900000)).toString();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const resetId = crypto.randomUUID();

    await storeEmailVerificationResetCode(db, resetId, normalizedEmail, code, expiresAt, now);

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
    const rawClientIp = getClientIdentifier(c);
    const clientIp = rawClientIp !== 'unknown' ? rawClientIp : normalizedEmail || 'ip';

    const requestedResetTenant = String(resolvePublicTenantId(c) || '').trim();
    if (submittedCode && submittedNewPassword) {
      if (submittedNewPassword.length < 8 || submittedNewPassword.length > 128) {
        return c.json(
          { success: false, error: 'Mật khẩu mới phải có từ 8 đến 128 ký tự' },
          400
        );
      }
      const targetUser = await resolveResetTargetUser(db, c.env, normalizedEmail, requestedResetTenant);
      const resetTenant = String(targetUser?.tenant_id || requestedResetTenant || 'default').trim() || 'default';
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
        const currentCustomerRow = (await db.prepare('SELECT auth_version FROM customers WHERE id = ?').bind(targetUser.id).first().catch(() => null)) as { auth_version?: number } | null;
        if (currentCustomerRow && Number.isFinite(Number(currentCustomerRow.auth_version))) {
          nextVersion = Math.max(nextVersion, Number(currentCustomerRow.auth_version) + 1);
        }
        await db.prepare(
          "UPDATE users SET password_hash = ?, auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(role), ''), 'customer') = 'customer' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(passwordHash, now, targetUser.id, resetTenant).run().catch(async () => {
          if (resetTenant === 'default') {
            await db.prepare(
              'UPDATE users SET password_hash = ?, auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ?'
            ).bind(passwordHash, now, targetUser.id).run().catch(async () => {
              await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(passwordHash, now, targetUser.id).run().catch(() => {});
            });
          }
        });
        await db.prepare(
          "UPDATE customers SET password_hash = ?, auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(passwordHash, now, targetUser.id, resetTenant).run().catch(async () => {
          if (resetTenant === 'default') {
            await db.prepare(
              'UPDATE customers SET password_hash = ?, auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ?'
            ).bind(passwordHash, now, targetUser.id).run().catch(async () => {
              await db.prepare('UPDATE customers SET password_hash = ?, updated_at = ? WHERE id = ?').bind(passwordHash, now, targetUser.id).run().catch(() => {});
            });
          }
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

    const user = await resolveResetTargetUser(db, c.env, normalizedEmail, requestedResetTenant);
    if (!user) {
      return c.json({ success: true, data: { success: true } });
    }

    await invalidatePriorPasswordResetCodes(db, normalizedEmail, user.id);

    const randomBuf = new Uint32Array(1);
    crypto.getRandomValues(randomBuf);
    const code = (100000 + (randomBuf[0] % 900000)).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const resetId = crypto.randomUUID();

    await storeEmailVerificationResetCode(db, resetId, normalizedEmail, code, expiresAt, now);

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

    if (user?.id && (await isUserErasedOrInactive(db, user.id))) {
      return c.json({ success: false, error: 'Account is inactive or erased' }, 403);
    }

    let userRecord = await db
      .prepare('SELECT password_hash, tenant_id, auth_version FROM users WHERE id = ?')
      .bind(user.id)
      .first()
      .catch(async () => {
        return db
          .prepare('SELECT password_hash, tenant_id FROM users WHERE id = ?')
          .bind(user.id)
          .first()
          .catch(async () => {
            return db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first().catch(() => null);
          });
      });
    if ((!userRecord || !userRecord.password_hash) && user?.role === 'customer') {
      userRecord = await db
        .prepare('SELECT password_hash, tenant_id, auth_version FROM customers WHERE id = ?')
        .bind(user.id)
        .first()
        .catch(async () => {
          return db
            .prepare('SELECT password_hash, tenant_id FROM customers WHERE id = ?')
            .bind(user.id)
            .first()
            .catch(async () => {
              return db.prepare('SELECT password_hash FROM customers WHERE id = ?').bind(user.id).first().catch(() => null);
            });
        });
      if ((!userRecord || !userRecord.password_hash) && c.env?.AUTH_KV) {
        const rawKv = (user.email ? await c.env.AUTH_KV.get(`user:${user.email}`).catch(() => null) : null)
          || (user.id ? await c.env.AUTH_KV.get(`user:${user.id}`).catch(() => null) : null);
        if (rawKv) {
          try {
            const parsedKv = JSON.parse(rawKv) as { password_hash?: string; password?: string; tenant_id?: string; auth_version?: number };
            const kvHash = parsedKv.password_hash || parsedKv.password;
            if (kvHash) {
              userRecord = {
                password_hash: kvHash,
                tenant_id: parsedKv.tenant_id,
                auth_version: parsedKv.auth_version,
              };
            }
          } catch {
            // ignore malformed cached entry
          }
        }
      }
    }
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
      const customerTenant = String(user?.tenantId || user?.tenant_id || (userRecord as any)?.tenant_id || resolvePublicTenantId(c) || 'default').trim() || 'default';
      try {
        await db.prepare(
          "UPDATE users SET password_hash = ?, auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(role), ''), 'customer') = 'customer' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(passwordHash, now, user.id, customerTenant).run();
        const refreshed = await db.prepare('SELECT auth_version FROM users WHERE id = ?').bind(user.id).first().catch(() => null);
        if (refreshed && Number.isFinite(Number((refreshed as any).auth_version))) {
          dbNextVersion = Math.max(dbNextVersion, Number((refreshed as any).auth_version));
        }
      } catch {
        if (customerTenant === 'default') {
          await db.prepare('UPDATE users SET password_hash = ?, auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ?').bind(passwordHash, now, user.id).run().catch(async () => {
            await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(passwordHash, now, user.id).run().catch(() => {});
          });
        }
      }
      try {
        await db.prepare(
          "UPDATE customers SET password_hash = ?, auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(passwordHash, now, user.id, customerTenant).run();
        const refreshedCust = await db.prepare('SELECT auth_version FROM customers WHERE id = ?').bind(user.id).first().catch(() => null);
        if (refreshedCust && Number.isFinite(Number((refreshedCust as any).auth_version))) {
          dbNextVersion = Math.max(dbNextVersion, Number((refreshedCust as any).auth_version));
        }
      } catch {
        if (customerTenant === 'default') {
          await db.prepare('UPDATE customers SET password_hash = ?, auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ?').bind(passwordHash, now, user.id).run().catch(async () => {
            await db.prepare('UPDATE customers SET password_hash = ?, updated_at = ? WHERE id = ?').bind(passwordHash, now, user.id).run().catch(() => {});
          });
        }
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
