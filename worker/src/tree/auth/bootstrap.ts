// bootstrapOwner handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { hashPassword } from '../../lib/jwt';
import { requireStaffAccount, issueStaffSession, staffSessionErrorResponse } from '../../lib/staff-session';
import { createStaffIdentity } from '../../lib/staff-login-identity';
import type { Env } from '../../types/env';
import { bootstrapOwnerSchema } from '../../lib/validators';
import { generateId, parseJSON, findExistingOwner } from './helpers';

const log = createLogger({ route: 'auth' });

export async function bootstrapOwner(request: Request, env: Record<string, unknown>) {
  try {
    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    if (!authKV) {
      return errorResponse('AUTH_KV binding chưa cấu hình', 500);
    }

    const existingOwner = await findExistingOwner(env as { AUTH_KV: import('@cloudflare/workers-types').KVNamespace });
    if (existingOwner) {
      return jsonResponse({
        success: false,
        error: 'Owner đã tồn tại — bootstrap chỉ chạy được khi chưa có owner nào.',
        hint: 'Login với owner hiện có. Nếu quên mật khẩu, đặt RESET_KEY secret rồi gọi /api/auth/reset-password'
      }, 409);
    }

    const body = await parseJSON(request);
    const parsed = bootstrapOwnerSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }
    const { email, password, name } = parsed.data;

    const existingUser = await authKV.get(`user:${email}`);
    if (existingUser) {
      return errorResponse(
        'Email này đã đăng ký với role khác (customer/staff). Dùng email khác hoặc xoá account cũ qua wrangler kv.',
        409
      );
    }

    const hashedPassword = await hashPassword(password);
    const user = {
      id: generateId('USR_'),
      email,
      name: name || 'AURA Owner',
      phone: '',
      password: hashedPassword,
      role: 'owner',
      tenant_id: 'default',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const db = (env as unknown as Env).AURA_DB;
    if (!await createStaffIdentity(env as unknown as Env, user, true)) return errorResponse('Owner hoặc email đã tồn tại', 409);
    await authKV.put(`user:${email}`, JSON.stringify(user)).catch(() => {});
    await authKV.put(`user:${user.id}`, JSON.stringify(user)).catch(() => {});
    const session = await issueStaffSession(env as unknown as Env, await requireStaffAccount(db, user.id), { email, sessionType: 'staff-web' });
    const token = session.token;

    return jsonResponse({
      success: true,
      message: 'Owner đầu tiên đã tạo. Endpoint này sẽ từ chối các request sau.',
      user: session.user,
      token
    }, 201);
  } catch (error) {
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('BootstrapOwner error:', { message: (error as Error).message });
    return errorResponse('Bootstrap owner thất bại', 500);
  }
}
