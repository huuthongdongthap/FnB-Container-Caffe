// auth-verify.ts — email verification

import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { requireStaffAccount, issueStaffSession, staffSessionErrorResponse } from '../lib/staff-session';
import type { Env } from '../types/env';
import { generateJWT } from '../lib/jwt';
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

    if (record.code !== code) {
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
    user.email_verified = true;
    user.updated_at = new Date().toISOString();
    await authKV.put(`user:${email}`, JSON.stringify(user));

    await deleteVerifyCode(db, record.id);

    const tenantId = `tenant_${user.id}`;
    const token = user.role && user.role !== 'customer'
      ? (await issueStaffSession(env as unknown as Env, await requireStaffAccount((env as unknown as Env).AURA_DB, user.id), { email: user.email, sessionType: 'staff-web' })).token
      : await generateJWT(
      { email: user.email, name: user.name, id: user.id, role: user.role || 'customer', tenantId, tier: 'BASIC', email_verified: true } as unknown as Parameters<typeof generateJWT>[0],
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
