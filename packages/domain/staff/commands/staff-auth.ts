/**
 * Staff Mobile Auth — AURA Mobile
 * PIN/device-based authentication for staff roles (owner/manager/staff/waiter)
 * Device-centric: each tablet/phone registers once, then PIN unlocks JWT.
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { generateJWT, hashPassword } from 'worker/src/lib/jwt';
import { staffRoleSchema, pinSchema, registerDeviceSchema } from 'worker/src/lib/validators';
import { generateId } from 'worker/src/tree/auth/helpers';
import type { Env } from 'worker/src/types/env';
import type { JwtPayload } from 'worker/src/types/api';
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

async function findDevice(env: { AURA_DB: import('@cloudflare/workers-types').D1Database; AUTH_KV: import('@cloudflare/workers-types').KVNamespace }, token: string) {
  const row = await env.AURA_DB
    .prepare('SELECT * FROM staff_devices WHERE device_token = ?')
    .bind(token)
    .first<{
      id: string; staff_id: string; device_token: string;
      pin_hash: string; role: 'owner' | 'manager' | 'staff' | 'waiter';
    }>();
  return row ?? null;
}

async function upsertDevice(env: { AURA_DB: import('@cloudflare/workers-types').D1Database }, data: {
  staff_id: string; device_token: string; device_name?: string;
  role: 'owner' | 'manager' | 'staff' | 'waiter'; pin_hash: string;
}) {
  const now = new Date().toISOString();
  await env.AURA_DB
    .prepare(
      `INSERT INTO staff_devices (id, staff_id, device_name, device_token, pin_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_token) DO UPDATE SET
         staff_id = excluded.staff_id,
         pin_hash = excluded.pin_hash,
         role = excluded.role,
         device_name = COALESCE(excluded.device_name, staff_devices.device_name),
         updated_at = excluded.updated_at`
    )
    .bind(generateId('DEV_'), data.staff_id, data.device_name ?? null,
          data.device_token, data.pin_hash, data.role, now, now)
    .run();
}

// ── Handlers (plain async(c, env) — mounted as inline in index.ts) ──

// POST /mobile/login — PIN-based device unlock → JWT
export async function staffMobileLogin(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<Record<string, unknown>>();
    const deviceToken = String(body.device_token ?? '');
    const pin = String(body.pin ?? '');

    if (!deviceToken) return errorResponse('Thiếu device_token', 400);

    const parsedPin = pinSchema.safeParse(pin);
    if (!parsedPin.success) return errorResponse(parsedPin.error.issues[0].message, 400);

    const lockoutKey = `pin_lockout:${deviceToken}`;
    const authKV = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    let failedAttempts = 0;
    try {
      if (authKV) {
        failedAttempts = parseInt((await authKV.get(lockoutKey)) || '0', 10);
      }
    } catch {
      // Ignore KV transient error
    }
    if (failedAttempts >= 5) {
      return errorResponse('Tạm khóa đăng nhập do nhập sai PIN quá nhiều lần', 429);
    }

    const device = await findDevice(c.env, deviceToken);
    if (!device) return errorResponse('Thiết bị chưa đăng ký', 404);

    const ok = await verifyPin(pin, device.pin_hash);
    if (!ok) {
      const nextAttempts = failedAttempts + 1;
      try {
        await authKV?.put(lockoutKey, String(nextAttempts), { expirationTtl: 300 });
      } catch {
        // Ignore KV transient error
      }
      log.warn('Staff PIN mismatch', { device_id: device.id, staff_id: device.staff_id, attempts: nextAttempts });
      if (nextAttempts >= 5) {
        return errorResponse('Tạm khóa đăng nhập do nhập sai PIN quá nhiều lần', 429);
      }
      return errorResponse('PIN không đúng', 401);
    }

    try {
      await authKV?.delete?.(lockoutKey);
    } catch {
      // Ignore cleanup error
    }

    // Fire-and-forget last_login update
    void c.env.AURA_DB
      .prepare('UPDATE staff_devices SET last_login_at = ?, updated_at = ? WHERE device_token = ?')
      .bind(new Date().toISOString(), new Date().toISOString(), deviceToken)
      .run();

    let staffEmail = '';
    let staffName = '';
    try {
      const staffRaw = await authKV?.get(`user:${device.staff_id}`);
      if (staffRaw) {
        const parsedStaff = JSON.parse(staffRaw) as { email?: string; name?: string };
        staffEmail = parsedStaff.email || '';
        staffName = parsedStaff.name || '';
      }
    } catch {
      // Ignore KV lookup error
    }

    const token = await generateJWT(
      { email: staffEmail, name: staffName, id: device.staff_id, role: device.role },
      c.env.JWT_SECRET, c.env.JWT_EXPIRY_SECONDS
    );

    return jsonResponse({
      success: true,
      user: { id: device.staff_id, email: staffEmail, name: staffName, role: device.role, device_id: device.id },
      token,
      expires_in: Number(c.env.JWT_EXPIRY_SECONDS ?? 604800),
    });
  } catch (err) {
    log.error('staffMobileLogin error', { message: (err as Error).message });
    return errorResponse('Đăng nhập thất bại', 500);
  }
}

// POST /mobile/refresh — rotate JWT using valid device_token
export async function staffTokenRefresh(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<Record<string, unknown>>();
    const deviceToken = String(body.device_token ?? '');
    if (!deviceToken) return errorResponse('Thiếu device_token', 400);

    const authKV = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    try {
      const failedAttempts = parseInt((await authKV?.get(`pin_lockout:${deviceToken}`)) || '0', 10);
      if (failedAttempts >= 5) {
        return errorResponse('Tạm khóa đăng nhập do nhập sai PIN quá nhiều lần', 429);
      }
    } catch {
      // Ignore KV transient error
    }

    const device = await findDevice(c.env, deviceToken);
    if (!device) return errorResponse('Thiết bị không hợp lệ', 401);

    let staffEmail = '';
    let staffName = '';
    try {
      const staffRaw = await authKV?.get(`user:${device.staff_id}`);
      if (staffRaw) {
        const parsedStaff = JSON.parse(staffRaw) as { email?: string; name?: string };
        staffEmail = parsedStaff.email || '';
        staffName = parsedStaff.name || '';
      }
    } catch {
      // Ignore KV lookup error
    }

    const newToken = await generateJWT(
      { email: staffEmail, name: staffName, id: device.staff_id, role: device.role },
      c.env.JWT_SECRET, c.env.JWT_EXPIRY_SECONDS
    );

    return jsonResponse({
      success: true, token: newToken,
      expires_in: Number(c.env.JWT_EXPIRY_SECONDS ?? 604800),
    });
  } catch (err) {
    log.error('staffTokenRefresh error', { message: (err as Error).message });
    return errorResponse('Refresh thất bại', 500);
  }
}

// POST /mobile/devices/register — owner-only: register a device for a staff account
export async function registerStaffDevice(c: Context<{ Bindings: Env }>) {
  try {
    const rawBody = await c.req.json<Record<string, unknown>>();
    const body = {
      ...rawBody,
      role: rawBody.role === 'kitchen' ? 'staff' : rawBody.role,
    };
    const parsed = registerDeviceSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);

    const { device_token, device_name, staff_id, role, pin } = parsed.data;

    const authKV = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    if (!staff_id) return errorResponse('staff_id là bắt buộc', 400);

    const userStr = authKV ? await authKV.get(`user:${staff_id}`) : null;
    let user: { id: string; name: string } | null = userStr
      ? (JSON.parse(userStr) as { id: string; name: string })
      : null;
    if (!user && c.env.AURA_DB) {
      try {
        const d1User = await c.env.AURA_DB
          .prepare('SELECT id, name FROM users WHERE id = ?')
          .bind(staff_id)
          .first<{ id: string; name: string }>();
        if (d1User?.id) {
          user = { id: d1User.id, name: d1User.name || d1User.id };
        }
      } catch {
        // Fallback to 404 if D1 lookup fails
      }
    }
    if (!user) return errorResponse('staff_id không khớp tài khoản nào trong hệ thống', 404);

    const callerRole = c.get('user')?.role as string | undefined;
    if (!callerRole) return errorResponse('Vui lòng đăng nhập', 401);

    if (callerRole === 'manager' && !['staff', 'waiter'].includes(role)) {
      return errorResponse('Manager chỉ đăng ký được bếp/phục vụ', 403);
    } else if (!['owner', 'manager'].includes(callerRole)) {
      return errorResponse('Chỉ owner hoặc manager đăng ký thiết bị', 403);
    }

    const pinHash = await hashPin(pin);
    await upsertDevice(c.env, {
      staff_id: user.id, device_token, device_name,
      role: role as 'owner' | 'manager' | 'staff' | 'waiter', pin_hash: pinHash,
    });

    return jsonResponse({
      success: true, user: { id: user.id, name: user.name, role },
      message: 'Đăng ký thiết bị thành công',
    }, 201);
  } catch (err) {
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

    const canDelete =
      callerRole === 'owner' ||
      device.staff_id === callerId ||
      (callerRole === 'manager' && ['staff', 'waiter'].includes(device.role));
    if (!canDelete) return errorResponse('Không đủ quyền xóa thiết bị', 403);

    await c.env.AURA_DB
      .prepare('DELETE FROM staff_devices WHERE id = ?')
      .bind(deviceId)
      .run();

    return jsonResponse({ success: true, message: 'Đã hủy đăng ký thiết bị' });
  } catch (err) {
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

    let rows;
    if (callerRole === 'owner') {
      rows = await c.env.AURA_DB
        .prepare('SELECT id, staff_id, device_name, role, last_login_at, created_at FROM staff_devices ORDER BY created_at DESC')
        .all();
    } else if (callerRole === 'manager') {
      rows = await c.env.AURA_DB
        .prepare('SELECT id, staff_id, device_name, role, last_login_at, created_at FROM staff_devices WHERE role IN ("staff","waiter") ORDER BY created_at DESC')
        .all();
    } else {
      rows = await c.env.AURA_DB
        .prepare('SELECT id, staff_id, device_name, role, last_login_at, created_at FROM staff_devices WHERE staff_id = ? ORDER BY created_at DESC')
        .bind(callerId)
        .all();
    }

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
