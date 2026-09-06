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
    const { email, password, name, phone, tenant_id } = parsed.data;

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
      tenant_id: tenant_id || undefined,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await authKV.put(`user:${email}`, JSON.stringify(user));

    // Mirror into D1 users so login can resolve the tenant claim and the
    // staff-tips join keeps working. Best-effort: KV remains source of truth.
    if (tenant_id) {
      try {
        const dbx = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
        await dbx.prepare(
          'INSERT OR IGNORE INTO users (id, name, role, phone, tenant_id) VALUES (?, ?, ?, ?, ?)'
        ).bind(user.id, user.name, user.role, user.phone, tenant_id).run();
      } catch (dbError) {
        log.warn('RegisterStaff D1 mirror failed:', { message: (dbError as Error).message });
      }
    }

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      message: `Tạo tài khoản ${assignedRole} thành công`
    }, 201);
  } catch (error) {
    log.error('RegisterStaff error:', { message: (error as Error).message });
    return errorResponse(`Tạo tài khoản staff thất bại: ${(error as Error).message}`, 500);
  }
}
