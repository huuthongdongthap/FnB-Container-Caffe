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
    const { email, password, name, phone, role, tenant_id } = parsed.data;

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const existingUser = await authKV.get(`user:${email}`);
    if (existingUser) {
      return errorResponse('Email đã được đăng ký', 409);
    }

    const hashedPassword = await hashPassword(password);
    const normalizedRoleInput = (role || '').trim().toLowerCase();
    const assignedRole =
      normalizedRoleInput === 'manager' || normalizedRoleInput === 'waiter' || normalizedRoleInput === 'staff'
        ? normalizedRoleInput
        : 'staff';
    const effectiveTenantId = tenant_id || 'default';
    const now = new Date().toISOString();

    const user = {
      id: generateId('USR_'),
      email,
      name: name || '',
      phone: phone || '',
      password: hashedPassword,
      role: assignedRole,
      position: role || assignedRole,
      tenant_id: tenant_id || undefined,
      active: true,
      created_at: now,
      updated_at: now
    };

    await authKV.put(`user:${email}`, JSON.stringify(user));

    // Always mirror into D1 users so D1-backed staff/shift/attendance/tips routes
    // and tenant claim resolution stay consistent with AUTH_KV.
    const dbx = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
    if (dbx) {
      try {
        await dbx.prepare(
          `INSERT OR IGNORE INTO users (id, email, name, role, phone, password_hash, is_active, tenant_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
        ).bind(user.id, user.email, user.name, user.role, user.phone, hashedPassword, effectiveTenantId, now, now).run();
      } catch {
        try {
          await dbx.prepare(
            'INSERT OR IGNORE INTO users (id, name, role, phone, tenant_id) VALUES (?, ?, ?, ?, ?)'
          ).bind(user.id, user.name, user.role, user.phone, effectiveTenantId).run();
        } catch (dbError) {
          log.warn('RegisterStaff D1 mirror failed:', { message: (dbError as Error).message });
        }
      }
    }

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        position: user.position,
        isActive: true,
        startedAt: user.created_at
      },
      message: `Tạo tài khoản ${assignedRole} thành công`
    }, 201);
  } catch (error) {
    log.error('RegisterStaff error:', { message: (error as Error).message });
    return errorResponse('Tạo tài khoản staff thất bại', 500);
  }
}
