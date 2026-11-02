// loginUser handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { generateJWT, verifyPassword, hashPassword } from '../../lib/jwt';
import type { Env } from '../../types/env';
import { loadStaffAccount, issueStaffSession, StaffSessionError, staffSessionErrorResponse } from '../../lib/staff-session';
import { verifyStaffPassword } from '../../lib/staff-password';
import { findLoginUser } from '../../lib/staff-login-identity';
import { loginSchema } from '../../lib/validators';
import { parseJSON } from './helpers';

const log = createLogger({ route: 'auth' });

export async function loginUser(request: Request, env: Record<string, unknown>, ctx?: { waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const body = await parseJSON(request);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }
    const { email, password } = parsed.data;

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const emailRateKey = `rl:login:email:${email.toLowerCase()}`;
    let failedAttempts = 0;
    try {
      if (authKV?.get) {
        failedAttempts = Number((await authKV.get(emailRateKey)) || 0);
        if (failedAttempts >= 10) {
          return errorResponse('Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau 5 phút.', 429);
        }
      }
    } catch {
      // Allow login check to proceed if KV rate-limit read is degraded
    }

    const recordEmailFailure = async () => {
      try {
        await authKV?.put?.(emailRateKey, String(failedAttempts + 1), { expirationTtl: 300 });
      } catch {
        // Ignore transient KV write failure
      }
    };

    const user = await findLoginUser(env as unknown as Env, email);
    const failedPassword = async () => {
      await recordEmailFailure();
      ctx?.waitUntil?.(createMetricsCollector(env.AURA_DB as Env['AURA_DB']).recordMetric('login_failed', 1, { reason: 'wrong_password' }));
      return errorResponse('Email hoặc mật khẩu không đúng', 401);
    };
    if (!user) {
      await recordEmailFailure();
      const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
      const mc = createMetricsCollector(db);
      ctx?.waitUntil?.(mc.recordMetric('login_failed', 1, { reason: 'user_not_found' }));
      return errorResponse('Email hoặc mật khẩu không đúng', 401);
    }

    let token: string;
    let sessionUser: Record<string, unknown>;
    let maxAge = Number(env.JWT_EXPIRY_SECONDS as string) || 86400;
    if (user.role && user.role !== 'customer') {
      const db = (env as unknown as Env).AURA_DB;
      const state = await loadStaffAccount(db, user.id);
      if (!state.ok) throw new StaffSessionError('SESSION_REVOKED');
      if (!await verifyStaffPassword(db, state.account, password, user.password)) return failedPassword();
      const session = await issueStaffSession(env as unknown as Env, state.account, { email, sessionType: 'staff-web' });
      token = session.token;
      sessionUser = session.user;
      maxAge = session.expires_in;
      user.role = state.account.role;
      user.name = state.account.name || state.account.id;
      user.tenant_id = state.account.tenant_id;
    } else {
      if (!await verifyPassword(password, user.password)) return failedPassword();
      if (!String(user.password).startsWith('pbkdf2$')) {
        user.password = await hashPassword(password);
        await authKV.put(`user:${email}`, JSON.stringify(user));
      }
      let tenantId: string | undefined;
      let tier: string | undefined;
      try {
        const db = (env as unknown as Env).AURA_DB;
        const row = await db.prepare('SELECT tenant_id FROM users WHERE id = ?').bind(user.id).first<{ tenant_id: string | null }>().catch(() => null);
        tenantId = row?.tenant_id || undefined;
        if (!tenantId) {
          const tenant = await db.prepare('SELECT id, tier FROM saas_tenants WHERE owner_user_id = ?').bind(user.id).first<{ id: string; tier: string }>().catch(() => null);
          tenantId = tenant?.id; tier = tenant?.tier;
        }
        const defaultPilotTenant = typeof env.PILOT_TENANT_ID === 'string' && env.PILOT_TENANT_ID.trim() && env.PILOT_TENANT_ID.trim() !== '*'
          ? env.PILOT_TENANT_ID.trim()
          : 'default';
        if (!tenantId) {
          tenantId = (user.tenant_id && !String(user.tenant_id).startsWith('tenant_')) ? String(user.tenant_id) : defaultPilotTenant;
        }
        if (db?.prepare) {
          const existingCust = await db.prepare(
            'SELECT id, tenant_id FROM customers WHERE id = ? OR lower(email) = lower(?) OR (? != \'\' AND phone = ?) LIMIT 1'
          ).bind(user.id, email, user.phone || '', user.phone || '').first<{ id: string; tenant_id?: string | null }>().catch(() => null);
          if (existingCust?.id) {
            user.id = existingCust.id;
            if (existingCust.tenant_id && String(existingCust.tenant_id).trim()) {
              tenantId = String(existingCust.tenant_id).trim();
            }
          } else {
            const nowIso = new Date().toISOString();
            try {
              await db.prepare(
                'INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)'
              ).bind(user.id, email, user.name || 'Thành viên', user.phone || '', 'bronze', tenantId || defaultPilotTenant, nowIso, nowIso).run();
            } catch {
              await db.prepare(
                'INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
              ).bind(user.id, email, user.name || 'Thành viên', user.phone || '', 'bronze', nowIso).run().catch(() => {});
            }
            const walletId = `wal_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            await db.prepare(
              'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?, ?)'
            ).bind(walletId, user.id, tenantId || defaultPilotTenant, nowIso, nowIso).run().catch(async () => {
              await db.prepare(
                'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
              ).bind(walletId, user.id, nowIso, nowIso).run().catch(() => {});
            });
          }
        }
      } catch { /* Customer enrichment keeps its pre-existing optional contract. */ }
      const authVersion = Number(user.auth_version || 1);
      user.auth_version = authVersion;
      token = await generateJWT({ email, name: user.name, id: user.id, role: 'customer', tenantId, tier, sessionId: crypto.randomUUID(), authVersion, emailVerified: Boolean(user.email_verified) }, env.JWT_SECRET as string, env.JWT_EXPIRY_SECONDS as string);
      sessionUser = { id: user.id, email: user.email, name: user.name, phone: user.phone, role: 'customer', tenantId };
    }

    user.last_login = new Date().toISOString();
    user.updated_at = new Date().toISOString();
    if (failedAttempts > 0) {
      try {
        await authKV?.delete?.(emailRateKey);
      } catch {
        // Ignore transient cleanup failure
      }
    }
    if (user.role && user.role !== 'customer') await authKV.put(`user:${email}`, JSON.stringify(user)).catch(() => {});
    else await authKV.put(`user:${email}`, JSON.stringify(user));

    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const mc = createMetricsCollector(db);
    ctx?.waitUntil?.(mc.recordMetric('login_success', 1));

    // Session cookie — FE EventSource (SSE) cannot set Authorization headers,
    // so the web client relies on this cookie; getAuthToken() reads it as fallback.
    // SameSite=None + Secure required for cross-origin cookie (FE domain ≠ workers.dev).
    const sessionCookie = `access_token=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}`;

    return jsonResponse({
      success: true,
      user: sessionUser,
      token,
      message: 'Đăng nhập thành công'
    }, 200, { 'Set-Cookie': sessionCookie });
  } catch (error) {
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('Login error:', { message: (error as Error).message });
    return errorResponse('Đăng nhập thất bại', 500);
  }
}
