// auth-register.ts — self-service registration with email verification

// Transitive module imports resolved via barrel exports at build-time
import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { generateJWT, hashPassword } from '../lib/jwt';
import { registerSchema } from '../lib/validators';
import { generateId } from '../tree/auth/helpers';
import { generateVerifyToken, expiresAtFromNow, storeVerifyCode } from '../tree/auth/email-verification';

const log = createLogger({ route: 'auth-register' });

export async function registerWithVerification(request: Request, env: Record<string, unknown>) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }

    const { email, password, name, phone } = parsed.data;

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const existingUser = await authKV.get(`user:${email}`);
    if (existingUser) {
      return errorResponse('Email đã được đăng ký', 409);
    }

    const hashedPassword = await hashPassword(password);
    const userId = generateId('USR_');
    const now = new Date().toISOString();

    const user = {
      id: userId,
      email,
      name: name || '',
      phone: phone || '',
      password: hashedPassword,
      role: 'customer',
      email_verified: false,
      created_at: now,
      updated_at: now
    };

    await authKV.put(`user:${email}`, JSON.stringify(user));

    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const verifyId = generateId('EV_');
    const code = generateVerifyToken();
    const expiresAt = expiresAtFromNow();
    await storeVerifyCode(db as unknown as Parameters<typeof storeVerifyCode>[0], verifyId, email, code, expiresAt);

    const { sendEmail } = await import('../lib/email');
    const verifyUrl = `${env.APP_URL || 'http://localhost:3000'}/verify-email?email=${encodeURIComponent(email)}&code=${code}`;

    const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2>Xác thực email — AURA CAFE</h2>
      <p>Chào ${name || 'bạn'},</p>
      <p>Mã xác thực của bạn: <strong style="font-size:24px">${code}</strong></p>
      <p>Nhập mã này trong vòng 10 phút. Hoặc nhấn:<br><a href="${verifyUrl}">Xác thực ngay</a></p>
      <hr/>
      <p style="font-size:12px;color:#888">AURA CAFE — F&B Container Caffe SaaS</p>
    </div>`;
    const text = `Mã xác thực AURA CAFE: ${code}. Hết hạn sau 10 phút. ${verifyUrl}`;

    sendEmail(env as Record<string, unknown>, {
      to: email,
      subject: 'Xác thực email — AURA CAFE',
      html,
      text
    }).catch((err: unknown) => log.warn('Verification email failed', { error: String(err) }));

    return jsonResponse({
      success: true,
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực.',
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone }
    }, 201);
  } catch (error) {
    log.error('Register error:', { message: (error as Error).message });
    return errorResponse(`Đăng ký thất bại: ${(error as Error).message}`, 500);
  }
}
