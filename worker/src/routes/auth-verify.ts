// auth-verify.ts — email verification

import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { requireStaffAccount, issueStaffSession, staffSessionErrorResponse } from '../lib/staff-session';
import type { Env } from '../types/env';
import { generateJWT, timingSafeEqualString } from '../lib/jwt';
import { lookupVerifyCode, deleteVerifyCode, isExpired } from '../tree/auth/email-verification';

const log = createLogger({ route: 'auth-verify' });

export async function verifyEmail(request: Request, env: Record<string, unknown>) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
const email = String((body as Record<string, unknown>).email ?? '').trim().toLowerCase();
const code = String((body as Record<string, unknown>).code ?? '').trim();

    if (!email || !code) {
      return errorResponse('Thiếu email hoặc mã xác thực', 400);
    }

const db = env.AURA_DB as unknown as { prepare(_sql: string): { bind(..._a: unknown[]): { run(): Promise<{rowCount:number}>; first<T=Record<string, unknown>>(): Promise<T|null> } } };
    const record = await lookupVerifyCode(db, email);

    if (!record) {
      return errorResponse('Không tìm thấy mã xác thực', 404);
    }

    if (isExpired(record.expires_at)) {
      await deleteVerifyCode(db, record.id);
      return errorResponse('Mã đã hết hạn', 410);
    }

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const attemptsKey = `verify_attempts:${email}`;

    if (!timingSafeEqualString(String(record.code || ''), code)) {
      let attempts = 1;
      try {
        if (authKV) {
          const prev = parseInt((await authKV.get(attemptsKey)) || '0', 10);
          attempts = prev + 1;
          await authKV.put(attemptsKey, String(attempts), { expirationTtl: 600 });
        }
      } catch {
        // Ignore KV transient error on attempt tracking
      }
      if (attempts >= 5) {
        await deleteVerifyCode(db, record.id);
        return errorResponse('Quá nhiều lần thử sai. Vui lòng yêu cầu mã mới.', 429);
      }
      return errorResponse('Mã xác thực không đúng', 401);
    }

    try {
      await authKV?.delete?.(attemptsKey);
    } catch {
      // Ignore cleanup failure
    }
    const userStr = await authKV.get(`user:${email}`);
    if (!userStr) {
      return errorResponse('Không tìm thấy tài khoản', 404);
    }

    const user = JSON.parse(userStr);
    const now = new Date().toISOString();
    const defaultTenant = typeof env.PILOT_TENANT_ID === 'string' && env.PILOT_TENANT_ID.trim() && env.PILOT_TENANT_ID.trim() !== '*'
      ? env.PILOT_TENANT_ID.trim()
      : 'default';
    const isLegacyGeneratedTenant = (val: unknown) => /^tenant_[a-z0-9]{7,}_[a-z0-9]+$/i.test(String(val || ''));
    const tenantId = (!user.role || user.role === 'customer')
      ? (user.tenant_id && !isLegacyGeneratedTenant(user.tenant_id) ? String(user.tenant_id).trim() : defaultTenant)
      : (user.tenant_id || defaultTenant);

    if ((!user.role || user.role === 'customer') && db?.prepare) {
      try {
        let existingCustomer: { id: string; email?: string | null; tenant_id?: string | null } | null = null;
        try {
          existingCustomer = await db.prepare(
            `SELECT id, email, tenant_id FROM customers
             WHERE (id = ? OR lower(email) = lower(?))
               AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             LIMIT 1`
          ).bind(user.id, email, tenantId).first<{ id: string; email?: string | null; tenant_id?: string | null }>();
        } catch {
          if (tenantId === 'default') {
            existingCustomer = await db.prepare(
              'SELECT id, email FROM customers WHERE id = ? OR lower(email) = lower(?) LIMIT 1'
            ).bind(user.id, email).first<{ id: string; email?: string | null }>().catch(() => null);
          }
        }
        const existingTenant = String(existingCustomer?.tenant_id || '').trim() || tenantId;
        const existingEmail = String(existingCustomer?.email || '').trim().toLowerCase();
        const canBindCustomer = Boolean(
          existingCustomer?.id &&
          existingTenant === tenantId &&
          (!existingEmail || existingEmail === email)
        );
        if (canBindCustomer && existingCustomer) {
          user.id = existingCustomer.id;
          try {
            await db.prepare(
              `UPDATE customers
               SET email = COALESCE(NULLIF(email, ''), ?),
                   verified_at = COALESCE(verified_at, ?),
                   updated_at = ?
               WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(email, now, now, user.id, tenantId).run();
          } catch {
            if (tenantId === 'default') {
              await db.prepare(
                'UPDATE customers SET email = COALESCE(NULLIF(email, \'\'), ?), verified_at = COALESCE(verified_at, ?), updated_at = ? WHERE id = ?'
              ).bind(email, now, now, user.id).run().catch(() => {});
            }
          }
        } else {
          try {
            await db.prepare(
              'INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, tenant_id, verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)'
            ).bind(user.id, email, user.name || 'Thành viên', user.phone || '', 'bronze', tenantId, now, now, now).run();
          } catch {
            if (tenantId === 'default') {
              await db.prepare(
                'INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
              ).bind(user.id, email, user.name || 'Thành viên', user.phone || '', 'bronze', now).run().catch(() => {});
            }
          }
          const walletId = `wal_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          await db.prepare(
            'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?, ?)'
          ).bind(walletId, user.id, tenantId, now, now).run().catch(async () => {
            if (tenantId === 'default') {
              await db.prepare(
                'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
              ).bind(walletId, user.id, now, now).run().catch(() => {});
            }
          });
        }
      } catch {
        // Optional D1 customer provisioning on email verification
      }
    }

    user.email_verified = true;
    user.tenant_id = tenantId;
    user.updated_at = now;
    await authKV.put(`user:${email}`, JSON.stringify(user));

    await deleteVerifyCode(db, record.id);

    const token = user.role && user.role !== 'customer'
      ? (await issueStaffSession(env as unknown as Env, await requireStaffAccount((env as unknown as Env).AURA_DB, user.id), { email: user.email, sessionType: 'staff-web' })).token
      : await generateJWT(
      { email: user.email, name: user.name, id: user.id, role: user.role || 'customer', tenantId, tier: 'BASIC', emailVerified: true, email_verified: true, authVersion: Number(user.auth_version || 1) } as unknown as Parameters<typeof generateJWT>[0],
      env.JWT_SECRET as string,
      env.JWT_EXPIRY_SECONDS as string
    );

    log.info('Email verified', { userId: user.id, email });
    return jsonResponse({
      success: true,
      message: 'Xác thực email thành công!',
      token,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role || 'customer', email_verified: true }
    });
  } catch (error) {
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('Verify error:', { message: (error as Error).message });
    return errorResponse('Xác thực thất bại', 500);
  }
}
