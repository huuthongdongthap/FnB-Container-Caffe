// changePassword handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { verifyPassword, hashPassword, getAuthToken, cookieWriteBlockReason } from '../../lib/jwt';
import { authenticateRequest } from '../../lib/staff-session-auth';
import { staffSessionErrorResponse, SessionUnavailableError } from '../../lib/staff-session';
import { verifyStaffPassword, changeStaffPassword } from '../../lib/staff-password';
import type { Env } from '../../types/env';
import { changePasswordSchema } from '../../lib/validators';
import { parseJSON } from './helpers';

const log = createLogger({ route: 'auth' });

export async function changePassword(request: Request, env: Record<string, unknown>) {
  try {
    const csrfBlock = cookieWriteBlockReason(request.method, request);
    if (csrfBlock) return errorResponse(csrfBlock, 403);
    const body = await parseJSON(request);
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }
    const { currentPassword, newPassword } = parsed.data;

    const session = await authenticateRequest(request, env as unknown as Env);
    if (!session) return errorResponse('Unauthorized', 401);
    if ('blocked' in session) return errorResponse(session.blocked, 403);
    const { payload, account } = session;
    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    let userStr = payload.email ? await authKV.get(`user:${payload.email}`) : null;
    if (!userStr && payload.id) {
      userStr = await authKV.get(`user:${payload.id}`);
    }
    if (!userStr && !account) {
      return errorResponse('User không tồn tại', 404);
    }

    const user = userStr ? JSON.parse(userStr) : { id: account!.id, name: account!.name, role: account!.role, password: '' };
    if (!account) {
      if (user.role && user.role !== 'customer') {
        return errorResponse('Forbidden: Invalid account role', 403);
      }
      if (payload.id && user.id && String(user.id) !== String(payload.id)) {
        return errorResponse('Forbidden: Account identity mismatch', 403);
      }
      const rawUserTenant = String((user as { tenant_id?: string; tenantId?: string }).tenant_id || (user as { tenantId?: string }).tenantId || '').trim();
      const rawTokenTenant = String((payload as { tenantId?: string; tenant_id?: string }).tenantId || (payload as { tenant_id?: string }).tenant_id || '').trim();
      if (rawUserTenant && rawTokenTenant && rawUserTenant !== rawTokenTenant) {
        return errorResponse('Forbidden: Cross-tenant password change denied', 403);
      }
    }
    const ok = account
      ? await verifyStaffPassword((env as unknown as Env).AURA_DB, account, currentPassword, user.password)
      : await verifyPassword(currentPassword, user.password);
    if (!ok) {
      const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
      const mc = createMetricsCollector(db);
      const actorTenant = String(
        (account as { tenant_id?: string } | undefined)?.tenant_id ||
          (payload as { tenant_id?: string }).tenant_id ||
          (user as { tenant_id?: string })?.tenant_id ||
          'default'
      ).trim() || 'default';
      mc.recordMetric('login_failed', 1, { reason: 'change_password_wrong', tenant_id: actorTenant }).catch(() => {});
      return errorResponse('Mật khẩu hiện tại không đúng', 400);
    }

    user.password = await hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    const custId = String(user.id || payload.id || '');
    let nextVersion = Math.max(
      Number(user.auth_version || 1),
      Number((payload as { authVersion?: number; auth_version?: number }).authVersion ?? (payload as { auth_version?: number }).auth_version ?? 1),
      Number((account as { auth_version?: number } | undefined)?.auth_version || 1)
    ) + 1;
    if (account) {
      await changeStaffPassword((env as unknown as Env).AURA_DB, account, user.password);
      user.auth_version = nextVersion;
      if (payload.email) await authKV.put(`user:${payload.email}`, JSON.stringify(user)).catch(() => {});
    } else {
      if (env.AURA_DB) {
        const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
        const dbRow = (await db
          .prepare('SELECT auth_version FROM users WHERE id = ? OR email = ?')
          .bind(custId || null, payload.email || null)
          .first<{ auth_version?: number }>()
          .catch(() => null));
        if (dbRow && Number.isFinite(Number(dbRow.auth_version))) {
          nextVersion = Math.max(nextVersion, Number(dbRow.auth_version) + 1);
        }
      }
      try {
        if (custId && authKV) {
          const rawCustVer = await authKV.get(`cust_auth_ver:${custId}`);
          if (rawCustVer) {
            const currentCustVer = Number(rawCustVer);
            if (Number.isFinite(currentCustVer) && currentCustVer >= nextVersion) {
              nextVersion = currentCustVer + 1;
            }
          }
        }
        const existingById = payload.id ? await authKV.get(`user:${payload.id}`) : null;
        if (existingById) {
          try {
            const parsedById = JSON.parse(existingById) as { auth_version?: number };
            if (Number.isFinite(Number(parsedById.auth_version)) && Number(parsedById.auth_version) >= nextVersion) {
              nextVersion = Number(parsedById.auth_version) + 1;
            }
          } catch {
            // Ignore malformed cached record
          }
        }
        user.auth_version = nextVersion;
        if (payload.email) {
          await authKV.put(`user:${payload.email}`, JSON.stringify(user));
        }
        if (payload.id && (existingById || !payload.email)) {
          await authKV.put(`user:${payload.id}`, JSON.stringify(user));
        }
        if (custId && authKV) {
          await authKV.put(`cust_auth_ver:${custId}`, String(user.auth_version));
        }
      } catch {
        throw new SessionUnavailableError();
      }
      if (env.AURA_DB) {
        const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
        const customerTenant = String(
          (payload as { tenantId?: string; tenant_id?: string }).tenantId ||
            (payload as { tenant_id?: string }).tenant_id ||
            (user as { tenant_id?: string; tenantId?: string }).tenant_id ||
            (user as { tenantId?: string }).tenantId ||
            (typeof env.PILOT_TENANT_ID === 'string' && env.PILOT_TENANT_ID.trim() && env.PILOT_TENANT_ID.trim() !== '*'
              ? env.PILOT_TENANT_ID.trim()
              : '') ||
            'default'
        ).trim() || 'default';
        await db
          .prepare(
            "UPDATE users SET password_hash = ?, auth_version = MAX(COALESCE(auth_version, 1) + 1, ?), updated_at = datetime('now') WHERE (id = ? OR email = ?) AND COALESCE(NULLIF(TRIM(role), ''), 'customer') = 'customer' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(user.password, nextVersion, custId || null, payload.email || null, customerTenant)
          .run()
          .catch(async () => {
            if (customerTenant === 'default') {
              await db
                .prepare("UPDATE users SET password_hash = ?, auth_version = COALESCE(auth_version, 1) + 1, updated_at = datetime('now') WHERE id = ? OR email = ?")
                .bind(user.password, custId || null, payload.email || null)
                .run()
                .catch(() => {});
            }
          });
      }
    }
    const rawToken = getAuthToken(request);
    if (rawToken && authKV) {
      if (account) {
        await authKV.put(`revoked:${rawToken}`, '1', { expirationTtl: 604800 }).catch(() => {});
      } else {
        try {
          await authKV.put(`revoked:${rawToken}`, '1', { expirationTtl: 604800 });
        } catch {
          throw new SessionUnavailableError();
        }
      }
    }
    if (env.AURA_DB && payload.id) {
      await (env.AURA_DB as import('@cloudflare/workers-types').D1Database)
        .prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?')
        .bind(user.updated_at, payload.id)
        .run()
        .catch(() => {});
    }

    return jsonResponse({
      success: true,
      message: 'Mật khẩu đã được thay đổi'
    });
  } catch (error) {
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('ChangePassword error:', { message: (error as Error).message });
    return errorResponse('Đổi mật khẩu thất bại', 500);
  }
}
