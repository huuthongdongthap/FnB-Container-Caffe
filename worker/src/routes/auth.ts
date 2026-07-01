/**
 * Auth Routes
 * Converted from routes/auth.js with TypeScript + Zod validation.
 * Business logic preserved exactly.
 */

import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { generateJWT, verifyJWT, getAuthToken, verifyPassword, hashPassword } from '../lib/jwt';
import { registerSchema, loginSchema, registerStaffSchema, bootstrapOwnerSchema, resetPasswordSchema, changePasswordSchema } from '../lib/validators';

const log = createLogger({ route: 'auth' });

function generateId(prefix = 'ID_') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function parseJSON(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

async function findExistingOwner(env: { AUTH_KV: import('@cloudflare/workers-types').KVNamespace }) {
  let cursor: string | undefined;
  let pages = 0;
  const MAX_PAGES = 20;
  do {
    const opts: { prefix: string; limit: number; cursor?: string } = { prefix: 'user:', limit: 1000 };
    if (cursor) { opts.cursor = cursor; }
    const page = await env.AUTH_KV.list(opts);
    for (const key of page.keys) {
      const userStr = await env.AUTH_KV.get(key.name);
      if (!userStr) { continue; }
      try {
        const u = JSON.parse(userStr);
        if (u.role === 'owner') {
          return { email: u.email, name: u.name || '', created_at: u.created_at || null };
        }
      } catch { /* skip malformed */ }
    }
    cursor = page.list_complete ? undefined : page.cursor;
    pages += 1;
  } while (cursor && pages < MAX_PAGES);
  return null;
}

export async function registerUser(request: Request, env: Record<string, unknown>) {
  try {
    const body = await parseJSON(request);
    const parsed = registerSchema.safeParse(body);
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

    const user = {
      id: generateId('USR_'),
      email,
      name: name || '',
      phone: phone || '',
      password: hashedPassword,
      role: 'customer',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await authKV.put(`user:${email}`, JSON.stringify(user));

    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    try {
      const customerId = generateId('CUS_');
      const now = new Date().toISOString();
      await db.prepare(
        'INSERT OR IGNORE INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, created_at, updated_at) VALUES (?, ?, ?, ?, 0, \'bronze\', ?, ?)'
      ).bind(customerId, email, name || '', phone || '', now, now).run();
    } catch { /* non-fatal */ }

    const token = await generateJWT(
      { email, name: user.name, id: user.id, role: user.role },
      env.JWT_SECRET as string,
      env.JWT_EXPIRY_SECONDS as string
    );

    if (email) {
      const { sendEmail } = await import('../lib/email.js');
      const { renderWelcome } = await import('../templates/welcome.js');
      sendEmail(env as Record<string, unknown>, {
        to: email,
        subject: 'Chào mừng đến với AURA CAFE!',
        html: renderWelcome({ name: name || email.split('@')[0], loyalty_tier: 'bronze' as any }),
      }).catch(() => {});
    }

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
      token,
      message: 'Đăng ký thành công',
    }, 201);
  } catch (error) {
    log.error('Register error:', { message: (error as Error).message });
    return errorResponse('Đăng ký thất bại: ' + (error as Error).message, 500);
  }
}

export async function loginUser(request: Request, env: Record<string, unknown>) {
  try {
    const body = await parseJSON(request);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }
    const { email, password } = parsed.data;

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const userStr = await authKV.get(`user:${email}`);
    if (!userStr) {
      return errorResponse('Email hoặc mật khẩu không đúng', 401);
    }

    const user = JSON.parse(userStr);

    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      return errorResponse('Email hoặc mật khẩu không đúng', 401);
    }

    if (!String(user.password).startsWith('pbkdf2$')) {
      user.password = await hashPassword(password);
      await authKV.put(`user:${email}`, JSON.stringify(user));
    }

    const token = await generateJWT(
      { email, name: user.name, id: user.id, role: user.role || 'customer' },
      env.JWT_SECRET as string,
      env.JWT_EXPIRY_SECONDS as string
    );

    user.last_login = new Date().toISOString();
    user.updated_at = new Date().toISOString();
    await authKV.put(`user:${email}`, JSON.stringify(user));

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role || 'customer' },
      token,
      message: 'Đăng nhập thành công',
    });
  } catch (error) {
    log.error('Login error:', { message: (error as Error).message });
    return errorResponse('Đăng nhập thất bại: ' + (error as Error).message, 500);
  }
}

export async function logoutUser(request: Request, env: Record<string, unknown>) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return errorResponse('Không tìm thấy token', 400);
    }

    const payload = await verifyJWT(token, env.JWT_SECRET as string);
    if (payload?.exp) {
      const ttl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
      const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
      await authKV.put(`revoked:${token}`, '1', { expirationTtl: ttl });
    }

    return jsonResponse({
      success: true,
      message: 'Đăng xuất thành công',
    });
  } catch (error) {
    log.error('Logout error:', { message: (error as Error).message });
    return errorResponse('Đăng xuất thất bại: ' + (error as Error).message, 500);
  }
}

export async function getCurrentUser(request: Request, env: Record<string, unknown>) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return errorResponse('Unauthorized: thiếu Authorization header', 401);
    }

    const payload = await verifyJWT(token, env.JWT_SECRET as string);
    if (!payload) {
      return errorResponse('Token verify thất bại — signature/expiry/format invalid', 401);
    }

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const revoked = await authKV.get(`revoked:${token}`);
    if (revoked) {
      return errorResponse('Token đã bị thu hồi (logout)', 401);
    }

    const userStr = await authKV.get(`user:${payload.email}`);
    if (!userStr) {
      return errorResponse(`User '${payload.email}' không tồn tại trong KV`, 404);
    }

    const user = JSON.parse(userStr);

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role || 'customer' },
    });
  } catch (error) {
    log.error('GetUser error:', { message: (error as Error).message });
    return errorResponse('Lỗi server: ' + (error as Error).message, 500);
  }
}

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

export async function listStaff(request: Request, env: Record<string, unknown>) {
  try {
    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    if (!authKV) {
      return errorResponse('AUTH_KV binding chưa cấu hình', 500);
    }

    const users: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    let pages = 0;
    const MAX_PAGES = 20;

    do {
      const opts: { prefix: string; limit: number; cursor?: string } = { prefix: 'user:', limit: 1000 };
      if (cursor) { opts.cursor = cursor; }
      const page = await authKV.list(opts);

      for (const key of page.keys) {
        const userStr = await authKV.get(key.name);
        if (!userStr) { continue; }
        try {
          const u = JSON.parse(userStr);
          if (u.role === 'staff' || u.role === 'owner') {
            users.push({
              id: u.id,
              email: u.email,
              name: u.name || '',
              phone: u.phone || '',
              role: u.role,
              active: u.active !== false,
              created_at: u.created_at || null,
              last_login: u.last_login || null,
            });
          }
        } catch { /* skip malformed */ }
      }

      cursor = page.list_complete ? undefined : page.cursor;
      pages += 1;
    } while (cursor && pages < MAX_PAGES);

    users.sort((a, b) => {
      const ta = String(a.created_at || '');
      const tb = String(b.created_at || '');
      if (tb !== ta) { return tb.localeCompare(ta); }
      return String(a.email || '').localeCompare(String(b.email || ''));
    });

    return jsonResponse({ success: true, users });
  } catch (error) {
    log.error('ListStaff error:', { message: (error as Error).message });
    return errorResponse('Lỗi tải danh sách staff: ' + (error as Error).message, 500);
  }
}

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

export async function resetPassword(request: Request, env: Record<string, unknown>) {
  try {
    if (!env.RESET_KEY) {
      return errorResponse(
        'RESET_KEY chưa cấu hình. Chạy `wrangler secret put RESET_KEY` rồi deploy lại.',
        503
      );
    }

    const providedKey = request.headers.get('X-Reset-Key') || '';
    if (providedKey !== env.RESET_KEY) {
      return errorResponse('Reset key không hợp lệ', 401);
    }

    const body = await parseJSON(request);
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }
    const { email, newPassword } = parsed.data;

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const userStr = await authKV.get(`user:${email}`);
    if (!userStr) {
      return jsonResponse({
        success: true,
        message: 'Nếu email tồn tại, mật khẩu đã được reset. Vui lòng kiểm tra email của bạn.',
      });
    }

    const user = JSON.parse(userStr);
    user.password = await hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    await authKV.put(`user:${email}`, JSON.stringify(user));

    const token = await generateJWT(
      { email, name: user.name, id: user.id, role: user.role || 'customer' },
      env.JWT_SECRET as string,
      env.JWT_EXPIRY_SECONDS as string
    );

    return jsonResponse({
      success: true,
      message: 'Mật khẩu đã được reset',
      user: { id: user.id, email: user.email, name: user.name, role: user.role || 'customer' },
      token,
    });
  } catch (error) {
    log.error('ResetPassword error:', { message: (error as Error).message });
    return errorResponse('Reset mật khẩu thất bại: ' + (error as Error).message, 500);
  }
}

export async function changePassword(request: Request, env: Record<string, unknown>) {
  try {
    const body = await parseJSON(request);
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(first.message, 400);
    }
    const { currentPassword, newPassword } = parsed.data;

    const token = getAuthToken(request);
    if (!token) {
      return errorResponse('Unauthorized', 401);
    }

    const payload = await verifyJWT(token, env.JWT_SECRET as string);
    if (!payload) {
      return errorResponse('Token không hợp lệ', 401);
    }

    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const userStr = await authKV.get(`user:${payload.email}`);
    if (!userStr) {
      return errorResponse('User không tồn tại', 404);
    }

    const user = JSON.parse(userStr);
    const ok = await verifyPassword(currentPassword, user.password);
    if (!ok) {
      return errorResponse('Mật khẩu hiện tại không đúng', 400);
    }

    user.password = await hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    await authKV.put(`user:${payload.email}`, JSON.stringify(user));

    return jsonResponse({
      success: true,
      message: 'Mật khẩu đã được thay đổi',
    });
  } catch (error) {
    log.error('ChangePassword error:', { message: (error as Error).message });
    return errorResponse('Đổi mật khẩu thất bại: ' + (error as Error).message, 500);
  }
}

// Re-export verifyJWT for backward compatibility with unconverted JS routes
// (customers.js, subscriptions.js, checkin.js import { verifyJWT } from './auth.js')
export { verifyJWT } from '../lib/jwt';
