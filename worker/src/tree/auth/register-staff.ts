// registerStaff handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { hashPassword } from '../../lib/jwt';
import { resolvePilotStore } from '../../lib/pilot-store';
import { staffSessionErrorResponse, staffTenant } from '../../lib/staff-session';
import { createStaffIdentity } from '../../lib/staff-login-identity';
import { authenticateRequest } from '../../lib/staff-session-auth';
import type { Env } from '../../types/env';
import { registerStaffSchema } from '../../lib/validators';
import { generateId, parseJSON } from './helpers';

const log = createLogger({ route: 'auth' });

export async function registerStaff(
  requestOrContext: Request | { req: { raw: Request }; env: Record<string, unknown> },
  rawEnv?: Record<string, unknown>
) {
  const isContext = Boolean(requestOrContext && 'req' in requestOrContext && requestOrContext.req?.raw);
  const request = isContext ? (requestOrContext as { req: { raw: Request } }).req.raw : (requestOrContext as Request);
  const env = (isContext ? (requestOrContext as { env: Record<string, unknown> }).env : rawEnv) || {};
  try {
    const body = await parseJSON(request);
    const parsed = registerStaffSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }
    const { email, password, name, phone, role, tenant_id } = parsed.data;
    const rawBodyObj = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const bodyStoreOverride = String(
      tenant_id ||
        rawBodyObj.tenantId ||
        rawBodyObj.store_id ||
        rawBodyObj.storeId ||
        ''
    ).trim();
    const session = await authenticateRequest(request, env as unknown as Env);
    if (!session || 'blocked' in session) return errorResponse('Vui lòng đăng nhập', 401);
    if (!session.account || !['owner', 'admin'].includes(session.account.role)) return errorResponse('Không đủ quyền tạo nhân viên', 403);
    const rawActorTenant = typeof session.account.tenant_id === 'string' ? session.account.tenant_id.trim() : '';
    const isHqAdmin =
      (session.account.role === 'owner' || session.account.role === 'admin') &&
      (rawActorTenant.toLowerCase() === 'hq' || rawActorTenant === '*');
    const actorTenant = staffTenant(session.account);
    const headerTenant = (
      request.headers.get('X-Tenant-ID') ||
      request.headers.get('x-tenant-id') ||
      request.headers.get('X-Store-ID') ||
      request.headers.get('x-store-id') ||
      ''
    ).trim();
    const queryTenant = (() => {
      try {
        const sp = new URL(request.url).searchParams;
        return (
          sp.get('tenant_id') ||
          sp.get('tenantId') ||
          sp.get('store_id') ||
          sp.get('storeId') ||
          ''
        ).trim();
      } catch {
        return '';
      }
    })();
    const requestedTenant = bodyStoreOverride || headerTenant || queryTenant;
    if (!isHqAdmin) {
      if (
        actorTenant === '*' ||
        actorTenant.toLowerCase() === 'hq' ||
        requestedTenant === '*' ||
        requestedTenant.toLowerCase() === 'hq' ||
        (requestedTenant && requestedTenant !== actorTenant)
      ) {
        return errorResponse('Không được tạo nhân viên tại cửa hàng khác', 403);
      }
    }

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const existingUser = authKV ? await authKV.get(`user:${email}`) : null;
    if (existingUser) {
      return errorResponse('Email đã được đăng ký', 409);
    }

    const hashedPassword = await hashPassword(password);
    const normalizedRoleInput = (role || '').trim().toLowerCase();
    const allowedStaffRoles = new Set([
      'manager',
      'supervisor',
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
    if (assignedRole === 'admin' && session.account.role !== 'admin') {
      return errorResponse('Không đủ quyền tạo tài khoản admin', 403);
    }
    const rawEffectiveTenant = isHqAdmin ? (requestedTenant || rawActorTenant) : actorTenant;
    const effectiveTenantId =
      !rawEffectiveTenant || rawEffectiveTenant === '*' || rawEffectiveTenant.toLowerCase() === 'hq'
        ? resolvePilotStore(env as unknown as Env)
        : rawEffectiveTenant;
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

    const typedEnv = env as unknown as Env;
    try {
      if (!await createStaffIdentity(typedEnv, user)) return errorResponse('Email đã được đăng ký', 409);
      await typedEnv.AURA_DB.prepare('UPDATE users SET email = ? WHERE id = ?').bind(user.email, user.id).run().catch(() => {});
    } catch (err) {
      let hasIdentitiesTable = true;
      try {
        await typedEnv.AURA_DB.prepare('SELECT 1 FROM staff_login_identities LIMIT 1').first();
      } catch (tableErr) {
        if (/no such table:\s*staff_login_identities/i.test(String(tableErr))) {
          hasIdentitiesTable = false;
        }
      }
      if (!hasIdentitiesTable && typedEnv.AURA_DB) {
        const dup = await typedEnv.AURA_DB.prepare('SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?')
          .bind(user.email, user.id)
          .first()
          .catch(() => null);
        if (dup) {
          await typedEnv.AURA_DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run().catch(() => {});
          return errorResponse('Email đã được đăng ký', 409);
        }
        const inserted = await typedEnv.AURA_DB.prepare('SELECT id FROM users WHERE id = ?').bind(user.id).first().catch(() => null);
        if (inserted) {
          await typedEnv.AURA_DB.prepare('UPDATE users SET email = ? WHERE id = ?').bind(user.email, user.id).run().catch(() => {});
        } else {
          await typedEnv.AURA_DB.prepare(
            `INSERT INTO users (id, name, email, phone, password_hash, role, tenant_id, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
          ).bind(user.id, user.name, user.email, user.phone, user.password, user.role, user.tenant_id, now, now).run();
        }
      } else {
        throw err;
      }
    }
    if (authKV) {
      await authKV.put(`user:${email}`, JSON.stringify(user)).catch(() => {});
      await authKV.put(`user:${user.id}`, JSON.stringify(user)).catch(() => {});
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
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('RegisterStaff error:', { message: (error as Error).message });
    return errorResponse('Tạo tài khoản staff thất bại', 500);
  }
}
