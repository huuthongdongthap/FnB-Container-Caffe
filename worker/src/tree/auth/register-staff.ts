// registerStaff handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { hashPassword } from '../../lib/jwt';
import { staffSessionErrorResponse, staffTenant } from '../../lib/staff-session';
import { createStaffIdentity } from '../../lib/staff-login-identity';
import { authenticateRequest } from '../../lib/staff-session-auth';
import type { Env } from '../../types/env';
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
    const session = await authenticateRequest(request, env as unknown as Env);
    if (!session || 'blocked' in session) return errorResponse('Vui lòng đăng nhập', 401);
    if (!session.account || !['owner', 'admin'].includes(session.account.role)) return errorResponse('Không đủ quyền tạo nhân viên', 403);
    const actorTenant = staffTenant(session.account);
    if (tenant_id && tenant_id !== actorTenant) return errorResponse('Không được tạo nhân viên tại cửa hàng khác', 403);


    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const existingUser = await authKV.get(`user:${email}`);
    if (existingUser) {
      return errorResponse('Email đã được đăng ký', 409);
    }

    const hashedPassword = await hashPassword(password);
    const normalizedRoleInput = (role || '').trim().toLowerCase();
    const allowedStaffRoles = new Set([
      'manager',
      'waiter',
      'staff',
      'kitchen',
      'barista',
      'chef',
      'cashier',
      'admin',
    ]);
    const assignedRole = allowedStaffRoles.has(normalizedRoleInput)
      ? normalizedRoleInput
      : 'staff';
    const effectiveTenantId = actorTenant;
    const now = new Date().toISOString();

    const user = {
      id: generateId('USR_'),
      email,
      name: name || '',
      phone: phone || '',
      password: hashedPassword,
      role: assignedRole,
      position: role || assignedRole,
      tenant_id: effectiveTenantId,
      active: true,
      created_at: now,
      updated_at: now
    };

    if (!await createStaffIdentity(env as unknown as Env, user)) return errorResponse('Email đã được đăng ký', 409);
    await authKV.put(`user:${email}`, JSON.stringify(user)).catch(() => {});
    await authKV.put(`user:${user.id}`, JSON.stringify(user)).catch(() => {});

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
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('RegisterStaff error:', { message: (error as Error).message });
    return errorResponse('Tạo tài khoản staff thất bại', 500);
  }
}
