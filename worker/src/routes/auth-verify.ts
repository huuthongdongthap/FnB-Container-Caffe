// auth-verify.ts — email verification

import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
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

const db = env.AURA_DB as unknown as { prepare(sql: string): { bind(...a: unknown[]): { run(): Promise<{rowCount:number}>; first<T=Record<string, unknown>>(): Promise<T|null> } } };
    const record = await lookupVerifyCode(db, email);

    if (!record) {
      return errorResponse('Không tìm thấy mã xác thực', 404);
    }

    if (isExpired(record.expires_at)) {
      await deleteVerifyCode(db, record.id);
      return errorResponse('Mã đã hết hạn', 410);
    }

    if (record.code !== code) {
      return errorResponse('Mã xác thực không đúng', 401);
    }

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
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
    const token = await generateJWT(
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
    log.error('Verify error:', { message: (error as Error).message });
    return errorResponse(`Xác thực thất bại: ${(error as Error).message}`, 500);
  }
}
