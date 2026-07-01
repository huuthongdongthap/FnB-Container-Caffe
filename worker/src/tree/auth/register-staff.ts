// registerStaff handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { hashPassword } from '../../lib/jwt';
import { registerStaffSchema } from '../../lib/validators';
import { generateId, parseJSON } from './helpers';

const log = createLogger({ route: 'auth' });

export async function registerStaff(request: Request, env: Record<string, unknown>) {
  try {
    const body = await parseJSON(request);
    const parsed = registerStaffSchema.safeParse(body);
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
    const assignedRole = 'staff';

    const user = {
      id: generateId('USR_'),
      email,
      name: name || '',
      phone: phone || '',
      password: hashedPassword,
      role: assignedRole,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await authKV.put(`user:${email}`, JSON.stringify(user));

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      message: `Tạo tài khoản ${assignedRole} thành công`,
    }, 201);
  } catch (error) {
    log.error('RegisterStaff error:', { message: (error as Error).message });
    return errorResponse('Tạo tài khoản staff thất bại: ' + (error as Error).message, 500);
  }
}
