/**
 * Staff Mobile Auth — AURA Mobile (JS version for wrangler deploy)
 * PIN/device-based authentication for staff roles (owner/manager/staff/waiter)
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { generateJWT } from '../lib/jwt.js';

// ── Zod schemas (mirrors src/lib/validators.ts) ──────────────────────
const ALLOWED_ROLES = ['owner', 'manager', 'staff', 'waiter'];

const staffRoleSchema = {
  safeParse(role) {
    if (typeof role !== 'string') {
      return { success: false, error: { issues: [{ message: 'Vai trò không hợp lệ' }] } };
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return { success: false, error: { issues: [{ message: `Vai trò "${role}" không hợp lệ` }] } };
    }
    return { success: true, data: role };
  },
};

const pinSchema = {
  safeParse(pin) {
    if (typeof pin !== 'string') {
      return { success: false, error: { issues: [{ message: 'PIN phải là chuỗi số' }] } };
    }
    if (!/^\d{4,6}$/.test(pin)) {
      return { success: false, error: { issues: [{ message: 'PIN phải có 4–6 chữ số' }] } };
    }
    return { success: true, data: pin };
  },
};

const registerDeviceSchema = {
  safeParse(body) {
    if (!body || typeof body !== 'object') {
      return { success: false, error: { issues: [{ message: 'Body không hợp lệ' }] } };
    }
    const errors = [];
    if (typeof body.device_token !== 'string' || body.device_token.length < 4) {
      errors.push({ message: 'device_token là bắt buộc (ít nhất 4 ký tự)' });
    }
    if (typeof body.device_name !== 'string' || body.device_name.length < 2) {
      errors.push({ message: 'device_name là bắt buộc (ít nhất 2 ký tự)' });
    }
    if (!staffRoleSchema.safeParse(body.role).success) {
      errors.push({ message: 'role không hợp lệ' });
    }
    if (typeof body.pin !== 'string' || !/^\d{4,6}$/.test(body.pin)) {
      errors.push({ message: 'PIN phải có 4–6 chữ số' });
    }
    if (typeof body.staff_id !== 'string' || body.staff_id.length < 2) {
      errors.push({ message: 'staff_id là bắt buộc' });
    }
    if (errors.length > 0) {
      return { success: false, error: { issues: errors } };
    }
    return { success: true, data: body };
  },
};

// ── PIN hashing (PBKDF2, 100k iterations, 8-byte random salt) ──────

async function hashPin(pin) {
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

async function verifyPin(pin, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pin') return false;
  const saltB64 = parts[3];
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

async function findDevice(db, token) {
  const row = await db
    .prepare('SELECT * FROM staff_devices WHERE device_token = ?')
    .bind(token)
    .first();
  return row || null;
}

async function upsertDevice(db, data) {
  const now = new Date().toISOString();
  await db
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
    .bind(
      'DEV_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      data.staff_id, data.device_name || null, data.device_token, data.pin_hash, data.role, now, now
    )
    .run();
}

// ── Handlers (plain async(c) — env via c.env, mounted inline in index.js) ──

// POST /mobile/login — PIN-based device unlock → JWT
export async function staffMobileLogin(c) {
  try {
    const body = await c.req.json();
    const deviceToken = String(body.device_token ?? '');
    const pin = String(body.pin ?? '');
    const env = c.env;

    if (!deviceToken) return errorResponse('Thiếu device_token', 400);

    const parsedPin = pinSchema.safeParse(pin);
    if (!parsedPin.success) return errorResponse(parsedPin.error.issues[0].message, 400);

    const device = await findDevice(env.AURA_DB, deviceToken);
    if (!device) return errorResponse('Thiết bị chưa đăng ký', 404);

    const ok = await verifyPin(pin, device.pin_hash);
    if (!ok) {
      return errorResponse('PIN không đúng', 401);
    }

    // Fire-and-forget last_login update
    void env.AURA_DB
      .prepare('UPDATE staff_devices SET last_login_at = ?, updated_at = ? WHERE device_token = ?')
      .bind(new Date().toISOString(), new Date().toISOString(), deviceToken)
      .run();

    const token = await generateJWT(
      { email: '', name: '', id: device.staff_id, role: device.role },
      env.JWT_SECRET, env.JWT_EXPIRY_SECONDS
    );

    return jsonResponse({
      success: true,
      user: { id: device.staff_id, email: '', name: '', role: device.role, device_id: device.id },
      token,
      expires_in: Number(env.JWT_EXPIRY_SECONDS ?? 604800),
    });
  } catch (err) {
    return errorResponse(`Đăng nhập thất bại: ${err.message}`, 500);
  }
}

// POST /mobile/refresh — rotate JWT using valid device_token
export async function staffTokenRefresh(c) {
  try {
    const body = await c.req.json();
    const deviceToken = String(body.device_token ?? '');
    const env = c.env;
    if (!deviceToken) return errorResponse('Thiếu device_token', 400);

    const device = await findDevice(env.AURA_DB, deviceToken);
    if (!device) return errorResponse('Thiết bị không hợp lệ', 401);

    const newToken = await generateJWT(
      { email: '', name: '', id: device.staff_id, role: device.role },
      env.JWT_SECRET, env.JWT_EXPIRY_SECONDS
    );

    return jsonResponse({
      success: true,
      token: newToken,
      expires_in: Number(env.JWT_EXPIRY_SECONDS ?? 604800),
    });
  } catch (err) {
    return errorResponse(`Refresh thất bại: ${err.message}`, 500);
  }
}

// POST /mobile/devices/register — owner-only: register a device for a staff account
export async function registerStaffDevice(c) {
  try {
    const body = await c.req.json();
    const parsed = registerDeviceSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);

    const { device_token, device_name, staff_id, role, pin } = parsed.data;
    const env = c.env;

    const userStr = await env.AUTH_KV.get(`user:${staff_id}`);
    if (!userStr) return errorResponse('staff_id không khớp tài khoản nào trong hệ thống', 404);

    const user = c.get('user') || {};
    const callerRole = user.role;
    if (!callerRole) return errorResponse('Vui lòng đăng nhập', 401);

    if (callerRole === 'manager' && !['staff', 'waiter'].includes(role)) {
      return errorResponse('Manager chỉ đăng ký được bếp/phục vụ', 403);
    } else if (!['owner', 'manager'].includes(callerRole)) {
      return errorResponse('Chỉ owner hoặc manager đăng ký thiết bị', 403);
    }

    const pinHash = await hashPin(pin);
    const userObj = JSON.parse(userStr);
    await upsertDevice(env.AURA_DB, {
      staff_id: userObj.id,
      device_token,
      device_name,
      role,
      pin_hash: pinHash,
    });

    return jsonResponse({
      success: true,
      user: { id: userObj.id, name: userObj.name, role },
      message: 'Đăng ký thiết bị thành công',
    }, 201);
  } catch (err) {
    return errorResponse(`Đăng ký thất bại: ${err.message}`, 500);
  }
}

// DELETE /mobile/devices/:device_id — revoke a staff device
export async function revokeStaffDevice(c) {
  try {
    const deviceId = c.req.param('device_id');
    if (!deviceId) return errorResponse('Thiếu device_id', 400);

    const user = c.get('user') || {};
    const callerRole = user.role;
    const callerId = user.id;
    const env = c.env;
    if (!callerRole || !callerId) return errorResponse('Vui lòng đăng nhập', 401);

    const device = await env.AURA_DB
      .prepare('SELECT id, staff_id, role FROM staff_devices WHERE id = ?')
      .bind(deviceId)
      .first();

    if (!device) return errorResponse('Thiết bị không tồn tại', 404);

    const canDelete =
      callerRole === 'owner' ||
      device.staff_id === callerId ||
      (callerRole === 'manager' && ['staff', 'waiter'].includes(device.role));

    if (!canDelete) return errorResponse('Không đủ quyền xóa thiết bị', 403);

    await env.AURA_DB
      .prepare('DELETE FROM staff_devices WHERE id = ?')
      .bind(deviceId)
      .run();

    return jsonResponse({ success: true, message: 'Đã hủy đăng ký thiết bị' });
  } catch (err) {
    return errorResponse(`Hủy thất bại: ${err.message}`, 500);
  }
}

// GET /mobile/devices — list devices
export async function listStaffDevices(c) {
  try {
    const user = c.get('user') || {};
    const callerRole = user.role;
    const callerId = user.id;
    const env = c.env;
    if (!callerRole || !callerId) return errorResponse('Vui lòng đăng nhập', 401);

    let rows;
    if (callerRole === 'owner') {
      rows = await env.AURA_DB
        .prepare('SELECT id, staff_id, device_name, role, last_login_at, created_at FROM staff_devices ORDER BY created_at DESC')
        .all();
    } else if (callerRole === 'manager') {
      rows = await env.AURA_DB
        .prepare('SELECT id, staff_id, device_name, role, last_login_at, created_at FROM staff_devices WHERE role IN ("staff","waiter") ORDER BY created_at DESC')
        .all();
    } else {
      rows = await env.AURA_DB
        .prepare('SELECT id, staff_id, device_name, role, last_login_at, created_at FROM staff_devices WHERE staff_id = ? ORDER BY created_at DESC')
        .bind(callerId)
        .all();
    }

    return jsonResponse({
      success: true,
      devices: rows.results.map(r => ({
        id: r.id,
        device_name: r.device_name || null,
        role: r.role,
        last_login_at: r.last_login_at || null,
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    return errorResponse(`Lỗi: ${err.message}`, 500);
  }
}
