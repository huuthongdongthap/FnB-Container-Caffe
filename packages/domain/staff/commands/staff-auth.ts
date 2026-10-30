/**
 * Staff Mobile Auth — AURA Mobile
 * PIN/device-based authentication for staff roles (owner/manager/staff/waiter)
 * Device-centric: each tablet/phone registers once, then PIN unlocks JWT.
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { authenticateRequest } from 'worker/src/lib/staff-session-auth';
import { pinSchema, registerDeviceSchema } from 'worker/src/lib/validators';
import { generateId } from 'worker/src/tree/auth/helpers';
import {
  requireStaffAccount, loadStaffAccount, isAccountActive, isStaffRole, issueStaffSession, staffTenant, staffSessionErrorResponse,
  StaffSessionError, SessionUnavailableError, type StaffSession, type StaffAccount,
} from 'worker/src/lib/staff-session';
import type { Env } from 'worker/src/types/env';
import type { Context } from 'hono';

const log = createLogger({ route: 'staff-auth' });

// ── PIN hashing (PBKDF2, 100k iterations, 8-byte random salt) ──────

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(8));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return `pin$pbkdf2$100000$${saltB64}$${hashB64}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pin') return false;
  const [, , , saltB64] = parts;
  try {
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return btoa(String.fromCharCode(...new Uint8Array(bits))) === parts[4];
  } catch {
    return false;
  }
}

// ── Internal helpers ────────────────────────────────────────────────

type StaffDeviceRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'staff'
  | 'waiter'
  | 'cashier'
  | 'kitchen'
  | 'barista'
  | 'chef';

const MANAGER_MANAGED_ROLES = new Set(['staff', 'waiter', 'cashier', 'kitchen', 'barista', 'chef']);

const VALID_DEVICE_ROLES = new Set<StaffDeviceRole>([
  'owner',
  'admin',
  'manager',
  'staff',
  'waiter',
  'cashier',
  'kitchen',
  'barista',
  'chef',
]);

function normalizeDeviceRole(rawRole: unknown): StaffDeviceRole {
  const roleStr = String(rawRole ?? 'staff').trim().toLowerCase();
  if (VALID_DEVICE_ROLES.has(roleStr as StaffDeviceRole)) {
    return roleStr as StaffDeviceRole;
  }
  return 'staff';
}

async function findDevice(env: { AURA_DB: import('@cloudflare/workers-types').D1Database; AUTH_KV: import('@cloudflare/workers-types').KVNamespace }, token: string) {
  try {
  const row = await env.AURA_DB
    .prepare('SELECT * FROM staff_devices WHERE device_token = ?')
    .bind(token)
    .first<{
      id: string; staff_id: string; device_token: string;
      pin_hash: string; role: StaffDeviceRole;
    }>();
  return row ?? null;
  } catch { throw new SessionUnavailableError(); }
}

async function upsertDevice(env: { AURA_DB: import('@cloudflare/workers-types').D1Database }, data: {
  staff_id: string; device_token: string; device_name?: string;
  role: StaffDeviceRole; pin_hash: string; account: StaffAccount;
}) {
  const now = new Date().toISOString();
  const account = data.account;
  const statement = env.AURA_DB.prepare(
    `INSERT INTO staff_devices (id, staff_id, device_name, device_token, pin_hash, role, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ? FROM users
     WHERE id = ? AND auth_version = ? AND role = ? AND is_active = 1
       AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?
     ON CONFLICT(device_token) DO UPDATE SET pin_hash = excluded.pin_hash,
       role = excluded.role, device_name = COALESCE(excluded.device_name, staff_devices.device_name), updated_at = excluded.updated_at
     WHERE staff_devices.staff_id = excluded.staff_id`,
  ).bind(generateId('DEV_'), data.staff_id, data.device_name ?? null, data.device_token, data.pin_hash, data.role, now, now,
    account.id, account.auth_version, account.role, staffTenant(account));
  let results;
  try {
    results = await env.AURA_DB.batch([statement,
      env.AURA_DB.prepare(`UPDATE users SET auth_version = auth_version + 1, updated_at = ? WHERE id = ? AND auth_version = ?
        AND EXISTS (SELECT 1 FROM staff_devices WHERE device_token = ? AND staff_id = ? AND pin_hash = ?)`)
        .bind(now, account.id, account.auth_version, data.device_token, data.staff_id, data.pin_hash),
    ]);
  } catch { throw new SessionUnavailableError(); }
  if (!results[0]?.meta.changes || !results[1]?.meta.changes) throw new StaffSessionError('SESSION_REVOKED');

}

// ── Handlers (plain async(c, env) — mounted as inline in index.ts) ──

// POST /mobile/login — PIN-based device unlock → JWT
export async function staffMobileLogin(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<Record<string, unknown>>();
    const deviceToken = String(body.device_token ?? '');
    const parsed = pinSchema.safeParse(body.pin);
    if (!deviceToken || !parsed.success) return errorResponse('Thiếu thiết bị hoặc PIN không hợp lệ', 400);
    const kv = c.env.AUTH_KV;
    if (!kv) throw new SessionUnavailableError();
    const key = `pin_lockout:${deviceToken}`;
    let failures = 0;
    try {
      failures = Number(await kv.get(key) || 0);
    } catch {
      throw new SessionUnavailableError();
    }
    if (failures >= 5) return errorResponse('Tạm khóa đăng nhập do nhập sai PIN quá nhiều lần', 429);
    const device = await findDevice(c.env, deviceToken);
    if (!device) return errorResponse('Thiết bị chưa đăng ký', 404);
    if (!await verifyPin(parsed.data, device.pin_hash)) {
      try {
        await kv.put(key, String(failures + 1), { expirationTtl: 900 });
      } catch {
        throw new SessionUnavailableError();
      }
      return failures + 1 >= 5 ? errorResponse('Tạm khóa đăng nhập do nhập sai PIN quá nhiều lần', 429) : errorResponse('PIN không đúng', 401);
    }
    const account = await requireStaffAccount(c.env.AURA_DB, device.staff_id);
    const session = await issueStaffSession(c.env, account, { sessionType: 'staff-mobile', deviceId: device.id });
    await kv.delete(key).catch(() => {});
    const now = new Date().toISOString();
    await c.env.AURA_DB.prepare('UPDATE staff_devices SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(now, now, device.id).run();
    const cookie = `access_token=${session.token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${session.expires_in}`;
    return jsonResponse({ success: true, user: session.user, token: session.token, expires_in: session.expires_in }, 200, { 'Set-Cookie': cookie });
  } catch (error) {
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('staffMobileLogin error', { message: (error as Error).message });
    return errorResponse('Đăng nhập thất bại', 500);
  }
}

// A device identifier never authorizes refresh without its live Bearer session.
export async function staffTokenRefresh(c: Context<{ Bindings: Env }>) {
  try {
    const session = await authenticateRequest(c.req.raw, c.env, { bearerOnly: true });
    if (!session || 'blocked' in session) throw new StaffSessionError('SESSION_EXPIRED');
    const claims = session.payload as StaffSession;
    if (!session.account || claims.sessionType !== 'staff-mobile') throw new StaffSessionError('SESSION_REVOKED');
    const body = await c.req.json<Record<string, unknown>>();
    const deviceToken = String(body.device_token ?? '');
    if (!deviceToken) return errorResponse('Thiếu device_token', 400);
    if (!c.env.AUTH_KV) throw new SessionUnavailableError();
    let lockoutCount = 0;
    try {
      lockoutCount = Number(await c.env.AUTH_KV.get(`pin_lockout:${deviceToken}`) || 0);
    } catch {
      throw new SessionUnavailableError();
    }
    if (lockoutCount >= 5) {
      return errorResponse('Tạm khóa đăng nhập do nhập sai PIN quá nhiều lần', 429);
    }
    const device = await findDevice(c.env, deviceToken);
    if (!device || device.id !== claims.deviceId || device.staff_id !== claims.id) throw new StaffSessionError('DEVICE_REVOKED');
    const next = await issueStaffSession(c.env, session.account, {
      sessionType: 'staff-mobile', deviceId: device.id, authTime: claims.authTime,
    });
    const cookie = `access_token=${next.token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${next.expires_in}`;
    return jsonResponse({ success: true, token: next.token, expires_in: next.expires_in, user: next.user }, 200, { 'Set-Cookie': cookie });
  } catch (error) {
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('staffTokenRefresh error', { message: (error as Error).message });
    return errorResponse('Refresh thất bại', 500);
  }
}

// POST /mobile/devices/register — owner-only: register a device for a staff account
export async function registerStaffDevice(c: Context<{ Bindings: Env }>) {
  try {
    const rawBody = await c.req.json<Record<string, unknown>>();
    const hasExplicitRole = rawBody.role !== undefined;
    const requestedRole = String(rawBody.role ?? 'staff').trim().toLowerCase();
    const isExtendedValidRole = VALID_DEVICE_ROLES.has(requestedRole as StaffDeviceRole);
    const body = {
      ...rawBody,
      role: !hasExplicitRole
        ? undefined
        : isExtendedValidRole
          ? (['owner', 'manager', 'staff', 'waiter'].includes(requestedRole) ? requestedRole : 'staff')
          : rawBody.role,
    };
    const parsed = registerDeviceSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);

    const { device_token, device_name, staff_id, pin } = parsed.data;
    const role: StaffDeviceRole = hasExplicitRole && isExtendedValidRole
      ? normalizeDeviceRole(requestedRole)
      : normalizeDeviceRole(parsed.data.role);

    if (!staff_id) return errorResponse('staff_id là bắt buộc', 400);
    const caller = c.get('user');
    if (!caller) return errorResponse('Vui lòng đăng nhập', 401);
    if (!['owner', 'admin', 'manager'].includes(caller.role)) return errorResponse('Không đủ quyền đăng ký thiết bị', 403);
    const state = await loadStaffAccount(c.env.AURA_DB, staff_id);
    if (!state.ok || !isStaffRole(state.account.role)) return errorResponse('Tài khoản không tồn tại', 404);
    const account = state.account;
    if (!isAccountActive(account)) throw new StaffSessionError('STAFF_ACCOUNT_INACTIVE');
    if (staffTenant(account) !== (caller.tenantId || 'default')) return errorResponse('Không đủ quyền truy cập cửa hàng', 403);
    if ((account.role === 'owner' && caller.role !== 'owner')
      || (caller.role === 'manager' && (!MANAGER_MANAGED_ROLES.has(account.role) || !MANAGER_MANAGED_ROLES.has(role)))) {
      return errorResponse('Không đủ quyền đăng ký thiết bị cho tài khoản này', 403);
    }
    const existing = await findDevice(c.env, device_token);
    if (existing && existing.staff_id !== staff_id) return errorResponse('Thiết bị đã thuộc tài khoản khác', 409);
    const user = { id: account.id, name: account.name || account.id };
    const pinHash = await hashPin(pin);
    await upsertDevice(c.env, {
      staff_id: user.id, device_token, device_name,
      role: role as StaffDeviceRole, pin_hash: pinHash, account,
    });

    return jsonResponse({
      success: true, user: { id: user.id, name: user.name, role },
      message: 'Đăng ký thiết bị thành công',
    }, 201);
  } catch (err) {
    const response = staffSessionErrorResponse(err);
    if (response) return response;
    log.error('registerStaffDevice error', { message: (err as Error).message });
    return errorResponse('Đăng ký thất bại', 500);
  }
}

// DELETE /mobile/devices/:device_id — revoke a staff device
export async function revokeStaffDevice(c: Context<{ Bindings: Env }>) {
  try {
    const deviceId = c.req.param('device_id');
    if (!deviceId) return errorResponse('Thiếu device_id', 400);

    const callerRole = c.get('user')?.role as string | undefined;
    const callerId = c.get('user')?.id as string | undefined;
    if (!callerRole || !callerId) return errorResponse('Vui lòng đăng nhập', 401);

    const device = await c.env.AURA_DB
      .prepare('SELECT id, staff_id, role FROM staff_devices WHERE id = ?')
      .bind(deviceId)
      .first<{ id: string; staff_id: string; role: string }>();
    if (!device) return errorResponse('Thiết bị không tồn tại', 404);

    const canDelete = ['owner', 'admin'].includes(callerRole) || device.staff_id === callerId
      || (callerRole === 'manager' && MANAGER_MANAGED_ROLES.has(device.role));
    if (!canDelete) return errorResponse('Không đủ quyền xóa thiết bị', 403);
    const state = await loadStaffAccount(c.env.AURA_DB, device.staff_id);
    if (!state.ok) return errorResponse('Tài khoản không tồn tại', 404);
    const account = state.account;
    const caller = c.get('user');
    if (staffTenant(account) !== (caller?.tenantId || 'default')) return errorResponse('Không đủ quyền truy cập cửa hàng', 403);
    if ((account.role === 'owner' && callerRole !== 'owner')
      || (callerRole === 'manager' && !MANAGER_MANAGED_ROLES.has(account.role))) return errorResponse('Không đủ quyền xóa thiết bị', 403);
    // The invalidation and removal commit together. Removing this device also
    // invalidates every already-issued session for its account in the pilot.
    try {
      await c.env.AURA_DB.batch([
        c.env.AURA_DB.prepare('UPDATE users SET auth_version = auth_version + 1, updated_at = ? WHERE id = ?')
          .bind(new Date().toISOString(), device.staff_id),
        c.env.AURA_DB.prepare('DELETE FROM staff_devices WHERE id = ? AND staff_id = ?').bind(deviceId, device.staff_id),
      ]);
    } catch { throw new SessionUnavailableError(); }

    return jsonResponse({ success: true, message: 'Đã hủy đăng ký thiết bị' });
  } catch (err) {
    const response = staffSessionErrorResponse(err);
    if (response) return response;
    log.error('revokeStaffDevice error', { message: (err as Error).message });
    return errorResponse('Hủy thất bại', 500);
  }
}

// GET /mobile/devices — list devices
export async function listStaffDevices(c: Context<{ Bindings: Env }>) {
  try {
    const callerRole = c.get('user')?.role as string | undefined;
    const callerId = c.get('user')?.id as string | undefined;
    if (!callerRole || !callerId) return errorResponse('Vui lòng đăng nhập', 401);

    const caller = c.get('user');
    const roleClause = callerRole === 'manager' ? " AND u.role IN ('staff','waiter','cashier','kitchen','barista','chef')"
      : ['owner', 'admin'].includes(callerRole) ? '' : ' AND d.staff_id = ?';
    const values = [caller?.tenantId || 'default', ...(['owner', 'admin', 'manager'].includes(callerRole) ? [] : [callerId])];
    const rows = await c.env.AURA_DB.prepare(`SELECT d.id, d.staff_id, d.device_name, d.role, d.last_login_at, d.created_at
      FROM staff_devices d JOIN users u ON u.id = d.staff_id
      WHERE COALESCE(NULLIF(u.tenant_id, ''), 'default') = ?${roleClause} ORDER BY d.created_at DESC`).bind(...values).all();

    return jsonResponse({
      success: true,
      devices: (rows.results as Array<Record<string, unknown>>).map(r => ({
        id: r.id as string,
        staff_id: (r.staff_id as string | undefined) ?? '',
        device_name: r.device_name as string | null,
        role: r.role as string,
        last_login_at: r.last_login_at as string | null,
        created_at: r.created_at as string,
      })),
    });
  } catch (err) {
    log.error('listStaffDevices error', { message: (err as Error).message });
    return errorResponse('Không thể tải danh sách thiết bị', 500);
  }
}
