// resetPassword handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { generateJWT, hashPassword, timingSafeEqualString } from '../../lib/jwt';
import { requireStaffAccount, issueStaffSession, staffSessionErrorResponse, SessionUnavailableError } from '../../lib/staff-session';
import { changeStaffPassword } from '../../lib/staff-password';
import { findLoginUser } from '../../lib/staff-login-identity';
import type { Env } from '../../types/env';
import { resetPasswordSchema } from '../../lib/validators';
import { parseJSON } from './helpers';

const log = createLogger({ route: 'auth' });

export async function resetPassword(request: Request, env: Record<string, unknown>) {
  try {
    if (!env.RESET_KEY) {
      return errorResponse(
        'RESET_KEY chưa cấu hình. Chạy `wrangler secret put RESET_KEY` rồi deploy lại.',
        503
      );
    }

    const providedKey = request.headers.get('X-Reset-Key') || '';
    const expectedKey = String(env.RESET_KEY || '');
    if (!providedKey || !expectedKey || !timingSafeEqualString(providedKey, expectedKey)) {
      return errorResponse('Reset key không hợp lệ', 401);
    }

    const body = await parseJSON(request);
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }
    const { email, newPassword } = parsed.data;

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const user = await findLoginUser(env as unknown as Env, email);
    if (!user) {
      return jsonResponse({
        success: true,
        message: 'Nếu email tồn tại, mật khẩu đã được reset. Vui lòng kiểm tra email của bạn.'
      });
    }

    user.password = await hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    let token: string;
    let responseUser = { id: user.id, email: user.email, name: user.name, role: user.role || 'customer' };
    if (user.role && user.role !== 'customer') {
      const account = await requireStaffAccount((env as unknown as Env).AURA_DB, user.id);
      await changeStaffPassword((env as unknown as Env).AURA_DB, account, user.password);
      const updated = await requireStaffAccount((env as unknown as Env).AURA_DB, user.id);
      const session = await issueStaffSession(env as unknown as Env, updated, { email, sessionType: 'staff-web' });
      token = session.token; responseUser = session.user;
      await authKV.put(`user:${email}`, JSON.stringify(user)).catch(() => {});
    } else {
      let nextVersion = Number(user.auth_version || 1) + 1;
      try {
        if (user.id && authKV?.get) {
          const rawCustVer = await authKV.get(`cust_auth_ver:${user.id}`);
          if (rawCustVer) {
            const currentCustVer = Number(rawCustVer);
            if (Number.isFinite(currentCustVer) && currentCustVer >= nextVersion) {
              nextVersion = currentCustVer + 1;
            }
          }
        }
        user.auth_version = nextVersion;
        await authKV.put(`user:${email}`, JSON.stringify(user));
        if (user.id) {
          await authKV.put(`cust_auth_ver:${user.id}`, String(nextVersion));
          const existingById = await authKV.get(`user:${user.id}`);
          if (existingById) {
            await authKV.put(`user:${user.id}`, JSON.stringify(user));
          }
        }
      } catch {
        throw new SessionUnavailableError();
      }
      let resolvedCustomerTenant = String(user.tenant_id || '').trim() || undefined;
      if (user.id) {
        if (env.AURA_DB) {
          const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
          await db
            .prepare('UPDATE users SET password_hash = ?, auth_version = ?, updated_at = ? WHERE id = ?')
            .bind(user.password, nextVersion, user.updated_at, user.id)
            .run()
            .catch(() => {});
          if (!resolvedCustomerTenant) {
            const custRow = await db
              .prepare('SELECT tenant_id FROM customers WHERE id = ? OR lower(email) = lower(?) LIMIT 1')
              .bind(user.id, email)
              .first<{ tenant_id?: string | null }>()
              .catch(() => null);
            if (custRow?.tenant_id && String(custRow.tenant_id).trim()) {
              resolvedCustomerTenant = String(custRow.tenant_id).trim();
            }
          }
          await db
            .prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?')
            .bind(user.updated_at, user.id)
            .run()
            .catch(() => {});
        }
      }
      if (!resolvedCustomerTenant) {
        const pilotTenant = typeof env.PILOT_TENANT_ID === 'string' && env.PILOT_TENANT_ID.trim() && env.PILOT_TENANT_ID.trim() !== '*'
          ? env.PILOT_TENANT_ID.trim()
          : 'default';
        resolvedCustomerTenant = pilotTenant;
      }
      token = await generateJWT(
        { email, name: user.name, id: user.id, role: 'customer', tenantId: resolvedCustomerTenant, authVersion: user.auth_version },
        env.JWT_SECRET as string,
        env.JWT_EXPIRY_SECONDS as string
      );
    }

    return jsonResponse({
      success: true,
      message: 'Mật khẩu đã được reset',
      user: responseUser,
      token
    });
  } catch (error) {
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('ResetPassword error:', { message: (error as Error).message });
    return errorResponse('Reset mật khẩu thất bại', 500);
  }
}
