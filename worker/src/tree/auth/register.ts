// registerUser handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { generateJWT, hashPassword } from '../../lib/jwt';
import { registerSchema } from '../../lib/validators';
import { generateId, parseJSON } from './helpers';

const log = createLogger({ route: 'auth' });

export async function registerUser(request: Request, env: Record<string, unknown>) {
  try {
    const body = await parseJSON(request);
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

    const user = {
      id: generateId('USR_'),
      email,
      name: name || '',
      phone: phone || '',
      password: hashedPassword,
      role: 'customer',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await authKV.put(`user:${email}`, JSON.stringify(user));

    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    try {
      const customerId = generateId('CUS_');
      const now = new Date().toISOString();
      await db.prepare(
        'INSERT OR IGNORE INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, created_at, updated_at) VALUES (?, ?, ?, ?, 0, \'bronze\', ?, ?)'
      ).bind(customerId, email, name || '', phone || '', now, now).run();
    } catch { /* non-fatal */ }

    const token = await generateJWT(
      { email, name: user.name, id: user.id, role: user.role },
      env.JWT_SECRET as string,
      env.JWT_EXPIRY_SECONDS as string
    );

    if (email) {
      const { sendEmail } = await import('../../lib/email.js');
      const { renderWelcome } = await import('../../templates/welcome.js');
      sendEmail(env as Record<string, unknown>, {
        to: email,
        subject: 'Chào mừng đến với AURA CAFE!',
        html: renderWelcome({ name: name || email.split('@')[0], loyalty_tier: 'bronze' })
      }).catch(() => {});
    }

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
      token,
      message: 'Đăng ký thành công'
    }, 201);
  } catch (error) {
    log.error('Register error:', { message: (error as Error).message });
    return errorResponse(`Đăng ký thất bại: ${(error as Error).message}`, 500);
  }
}
