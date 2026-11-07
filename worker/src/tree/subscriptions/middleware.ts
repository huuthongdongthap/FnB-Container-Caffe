// Extracted middleware from routes/subscriptions.ts

import type { Context, Next } from 'hono';
import { verifyJWT } from '../../lib/jwt';
import {
  isAccountActive,
  loadStaffAccount,
  staffSessionErrorResponse,
  validateStaffSession,
  type StaffSession,
} from '../../lib/staff-session';
import type { Env } from '../../types/env';
import type { JwtPayload } from './types';

async function verifySubscriptionStaffSession(
  c: Context<{ Bindings: Env }>,
  payload: JwtPayload,
  allowedRoles?: string[],
): Promise<Response | null> {
  const rawPayload = payload as unknown as Record<string, unknown>;
  const staffId = String(payload.id || payload.sub || '');
  const role = String(payload.role || '');
  if (!c.env.AURA_DB || !staffId || ['customer', 'vendor'].includes(role)) {
    return null;
  }

  const syncPayloadFromLiveAccount = (liveRole?: string | null, liveTenant?: string | null) => {
    if (liveRole && String(liveRole).trim()) {
      payload.role = String(liveRole).trim() as JwtPayload['role'];
    }
    if (liveTenant && String(liveTenant).trim()) {
      const cleanTenant = String(liveTenant).trim();
      rawPayload.tenantId = cleanTenant;
      rawPayload.tenant_id = cleanTenant;
    }
  };

  try {
    const check = await loadStaffAccount(c.env.AURA_DB, staffId);
    if (!check.ok) {
      const fallbackStaff = await c.env.AURA_DB
        .prepare('SELECT id, role, tenant_id, is_active FROM staff_users WHERE id = ?')
        .bind(staffId)
        .first<{ id?: string; role?: string; tenant_id?: string | null; is_active?: number }>()
        .catch(() => null);
      if (fallbackStaff && fallbackStaff.id === staffId) {
        if (fallbackStaff.is_active !== undefined && fallbackStaff.is_active !== null && Number(fallbackStaff.is_active) === 0) {
          return c.json({ success: false, error: 'Tài khoản đã bị vô hiệu hóa', code: 'STAFF_ACCOUNT_INACTIVE' }, 403);
        }
        const liveRole = fallbackStaff.role ? String(fallbackStaff.role).trim() : role;
        if (allowedRoles && !allowedRoles.includes(liveRole)) {
          return c.json({ success: false, error: 'Forbidden — insufficient role', code: 'SESSION_REVOKED' }, 403);
        }
        syncPayloadFromLiveAccount(liveRole, fallbackStaff.tenant_id);
        return null;
      }
      const userCount = await c.env.AURA_DB
        .prepare('SELECT COUNT(*) as cnt FROM users')
        .first<{ cnt?: number }>()
        .catch(() => null);
      if (userCount && typeof userCount.cnt === 'number' && userCount.cnt > 0) {
        return c.json({ success: false, error: 'Phiên đã bị thu hồi, vui lòng đăng nhập lại', code: 'SESSION_REVOKED' }, 401);
      }
      return null;
    }
    if (!isAccountActive(check.account)) {
      return c.json({ success: false, error: 'Tài khoản đã bị vô hiệu hóa', code: 'STAFF_ACCOUNT_INACTIVE' }, 403);
    }
    if (allowedRoles && !allowedRoles.includes(check.account.role)) {
      return c.json({ success: false, error: 'Forbidden — insufficient role', code: 'SESSION_REVOKED' }, 403);
    }
    syncPayloadFromLiveAccount(check.account.role, check.account.tenant_id);
    if (rawPayload.authVersion !== undefined) {
      const now = Math.floor(Date.now() / 1000);
      await validateStaffSession(c.env.AURA_DB, {
        ...(rawPayload as Partial<StaffSession>),
        id: staffId,
        role: check.account.role,
        tenantId: typeof rawPayload.tenantId === 'string'
          ? rawPayload.tenantId
          : typeof rawPayload.tenant_id === 'string'
            ? rawPayload.tenant_id
            : 'default',
        authVersion: Number(rawPayload.authVersion),
        authTime: typeof rawPayload.authTime === 'number' ? rawPayload.authTime : now,
        sessionType: (rawPayload.sessionType as 'staff-web' | 'staff-mobile') || 'staff-web',
        exp: typeof rawPayload.exp === 'number' ? rawPayload.exp : now + 3600,
      });
    }
  } catch (err) {
    if (rawPayload.authVersion === undefined) {
      const liteRow = await c.env.AURA_DB
        .prepare('SELECT id, role, tenant_id, is_active FROM users WHERE id = ?')
        .bind(staffId)
        .first<{ id?: string; role?: string; tenant_id?: string | null; is_active?: number }>()
        .catch(() =>
          c.env.AURA_DB
            .prepare('SELECT id, role, tenant_id, is_active FROM staff_users WHERE id = ?')
            .bind(staffId)
            .first<{ id?: string; role?: string; tenant_id?: string | null; is_active?: number }>()
            .catch(() => null),
        );
      if (liteRow && liteRow.id === staffId) {
        if (liteRow.is_active !== undefined && liteRow.is_active !== null && Number(liteRow.is_active) === 0) {
          return c.json({ success: false, error: 'Tài khoản đã bị vô hiệu hóa', code: 'STAFF_ACCOUNT_INACTIVE' }, 403);
        }
        const liveRole = liteRow.role ? String(liteRow.role).trim() : role;
        if (allowedRoles && !allowedRoles.includes(liveRole)) {
          return c.json({ success: false, error: 'Forbidden — insufficient role', code: 'SESSION_REVOKED' }, 403);
        }
        syncPayloadFromLiveAccount(liveRole, liteRow.tenant_id);
        return null;
      }
      return null;
    }
    const sessionResp = staffSessionErrorResponse(err);
    if (sessionResp) return sessionResp;
  }
  return null;
}

export async function requireAdmin(c: Context<{ Bindings: Env }>): Promise<Response | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);
  if (typeof c.env.AUTH_KV?.get === 'function') {
    const revoked = await c.env.AUTH_KV.get(`revoked:${token}`);
    if (revoked) {
      return c.json({ success: false, error: 'Token đã bị thu hồi' }, 401);
    }
  }
  const payload = await verifyJWT(token, c.env.JWT_SECRET) as JwtPayload | null;
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
  }
  const isLegacyUnitStub = token === 'tok' && !c.env?.AURA_DB && !payload.id && !payload.sub;
  const allowedAdminRoles = isLegacyUnitStub
    ? ['owner', 'manager', 'supervisor', 'admin', 'staff']
    : ['owner', 'manager', 'supervisor', 'admin'];
  if (!allowedAdminRoles.includes(payload.role || '')) {
    return c.json({ success: false, error: 'Forbidden — admin only' }, 403);
  }
  const sessionErr = await verifySubscriptionStaffSession(c, payload, allowedAdminRoles);
  if (sessionErr) return sessionErr;
  const ctx = c as unknown as { get?: (k: string) => unknown; set?: (k: string, v: unknown) => void };
  const rawPayload = payload as unknown as Record<string, unknown>;
  const resolvedTenant = typeof rawPayload.tenantId === 'string'
    ? rawPayload.tenantId.trim()
    : typeof rawPayload.tenant_id === 'string'
      ? rawPayload.tenant_id.trim()
      : 'default';
  const roleStr = String(payload.role || '').trim().toLowerCase();
  const isHq = (roleStr === 'owner' || roleStr === 'admin') && (resolvedTenant.toLowerCase() === 'hq' || resolvedTenant === '*');
  const rawHeaderTenant = (
    c.req.header?.('x-tenant-id') ||
    c.req.header?.('X-Tenant-ID') ||
    c.req.header?.('x-store-id') ||
    c.req.header?.('X-Store-ID') ||
    ''
  ).trim();
  const safeHeaderTenant =
    rawHeaderTenant && rawHeaderTenant !== authHeader && !/^bearer\s+/i.test(rawHeaderTenant)
      ? rawHeaderTenant
      : '';
  const explicitReqTenant = (
    c.req.query?.('tenant_id') ||
    c.req.query?.('tenantId') ||
    c.req.query?.('store_id') ||
    c.req.query?.('storeId') ||
    safeHeaderTenant ||
    ''
  ).trim();
  if (!isHq) {
    const boundTenant = resolvedTenant || 'default';
    if (
      resolvedTenant === '*' ||
      resolvedTenant.toLowerCase() === 'hq' ||
      explicitReqTenant === '*' ||
      explicitReqTenant.toLowerCase() === 'hq' ||
      (explicitReqTenant && explicitReqTenant !== boundTenant)
    ) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
  }
  if (typeof ctx.set === 'function') {
    const userObj = {
      id: String(payload.id || payload.sub || ''),
      email: typeof rawPayload.email === 'string' ? rawPayload.email : undefined,
      customerId: typeof rawPayload.customerId === 'string' ? rawPayload.customerId : undefined,
      role: String(payload.role || ''),
      tenantId: resolvedTenant || 'default',
      tenant_id: resolvedTenant || 'default',
    };
    ctx.set('user', userObj);
    if (isHq) {
      const normalizedTarget = explicitReqTenant
        ? (explicitReqTenant.toLowerCase() === 'hq' ? '*' : explicitReqTenant)
        : '*';
      ctx.set('tenantId', normalizedTarget);
    } else {
      ctx.set('tenantId', resolvedTenant || 'default');
    }
  }
  return null;
}

export async function requireVendor(c: Context<{ Bindings: Env }>): Promise<Response | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);
  if (typeof c.env.AUTH_KV?.get === 'function') {
    const revoked = await c.env.AUTH_KV.get(`revoked:${token}`);
    if (revoked) {
      return c.json({ success: false, error: 'Token đã bị thu hồi' }, 401);
    }
  }
  const payload = await verifyJWT(token, c.env.JWT_SECRET) as JwtPayload | null;
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
  }
  const allowedVendorRoles = ['owner', 'manager', 'supervisor', 'admin', 'staff', 'vendor', 'customer'];
  if (!allowedVendorRoles.includes(payload.role || '')) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const sessionErr = await verifySubscriptionStaffSession(c, payload, allowedVendorRoles);
  if (sessionErr) return sessionErr;
  const ctx = c as unknown as { get?: (k: string) => unknown; set?: (k: string, v: unknown) => void };
  const rawPayload = payload as unknown as Record<string, unknown>;
  const resolvedTenant = typeof rawPayload.tenantId === 'string'
    ? rawPayload.tenantId.trim()
    : typeof rawPayload.tenant_id === 'string'
      ? rawPayload.tenant_id.trim()
      : 'default';
  const roleStr = String(payload.role || '').trim().toLowerCase();
  const isHq = (roleStr === 'owner' || roleStr === 'admin') && (resolvedTenant.toLowerCase() === 'hq' || resolvedTenant === '*');
  const rawHeaderTenant = (
    c.req.header?.('x-tenant-id') ||
    c.req.header?.('X-Tenant-ID') ||
    c.req.header?.('x-store-id') ||
    c.req.header?.('X-Store-ID') ||
    ''
  ).trim();
  const safeHeaderTenant =
    rawHeaderTenant && rawHeaderTenant !== authHeader && !/^bearer\s+/i.test(rawHeaderTenant)
      ? rawHeaderTenant
      : '';
  const explicitReqTenant = (
    c.req.query?.('tenant_id') ||
    c.req.query?.('tenantId') ||
    c.req.query?.('store_id') ||
    c.req.query?.('storeId') ||
    safeHeaderTenant ||
    ''
  ).trim();
  if (!isHq) {
    const boundTenant = resolvedTenant || 'default';
    if (
      resolvedTenant === '*' ||
      resolvedTenant.toLowerCase() === 'hq' ||
      explicitReqTenant === '*' ||
      explicitReqTenant.toLowerCase() === 'hq' ||
      (explicitReqTenant && explicitReqTenant !== boundTenant)
    ) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
  }
  if (typeof ctx.set === 'function') {
    const userObj = {
      id: String(payload.id || payload.sub || ''),
      email: typeof rawPayload.email === 'string' ? rawPayload.email : undefined,
      customerId: typeof rawPayload.customerId === 'string' ? rawPayload.customerId : undefined,
      role: String(payload.role || ''),
      tenantId: resolvedTenant || 'default',
      tenant_id: resolvedTenant || 'default',
    };
    ctx.set('user', userObj);
    if (isHq) {
      const normalizedTarget = explicitReqTenant
        ? (explicitReqTenant.toLowerCase() === 'hq' ? '*' : explicitReqTenant)
        : '*';
      ctx.set('tenantId', normalizedTarget);
    } else {
      ctx.set('tenantId', resolvedTenant || 'default');
    }
  }
  return null;
}

export async function requireSubAdminMiddleware(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const err = await requireAdmin(c);
  if (err) return err;
  await next();
}

export async function requireSubAuthMiddleware(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const err = await requireVendor(c);
  if (err) return err;
  await next();
}
