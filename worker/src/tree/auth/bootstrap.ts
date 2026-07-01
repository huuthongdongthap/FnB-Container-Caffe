// bootstrapOwner handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { generateJWT, hashPassword } from '../../lib/jwt';
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
        existing_owner: existingOwner,
        hint: 'Login với owner hiện có. Nếu quên mật khẩu, đặt RESET_KEY secret rồi gọi /api/auth/reset-password',
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
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await authKV.put(`user:${email}`, JSON.stringify(user));

    const token = await generateJWT(
      { email, name: user.name, id: user.id, role: 'owner' },
      env.JWT_SECRET as string,
      env.JWT_EXPIRY_SECONDS as string
    );

    return jsonResponse({
      success: true,
      message: 'Owner đầu tiên đã tạo. Endpoint này sẽ từ chối các request sau.',
      user: { id: user.id, email: user.email, name: user.name, role: 'owner' },
      token,
    }, 201);
  } catch (error) {
    log.error('BootstrapOwner error:', { message: (error as Error).message });
    return errorResponse('Bootstrap owner thất bại: ' + (error as Error).message, 500);
  }
}
