/* eslint-disable no-console */
/**
 * Auth Routes
 * API endpoints cho authentication operations
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';

// Debug logging configuration
const DEBUG = typeof AURA_DEBUG !== 'undefined' && AURA_DEBUG;

// Helper: Generate unique ID
function generateId(prefix = 'ID_') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Helper: Parse JSON body
async function parseJSON(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

// Default JWT TTL (seconds) — overridable via env.JWT_EXPIRY_SECONDS
const JWT_DEFAULT_TTL_SECONDS = 86400 * 7; // 7 days

// Helper: Generate JWT token. ttlSeconds optional (else default 7d)
async function generateJWT(payload, secret, ttlSeconds) {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const ttl = Number.isFinite(Number(ttlSeconds)) && Number(ttlSeconds) > 0
    ? Number(ttlSeconds)
    : JWT_DEFAULT_TTL_SECONDS;

  const headerBase64 = base64UrlEncode(JSON.stringify(header));
  const payloadBase64 = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ttl,
    })
  );

  const signatureInput = `${headerBase64}.${payloadBase64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
  const signatureBase64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

  return `${signatureInput}.${signatureBase64}`;
}

// Helper: Verify JWT token
async function verifyJWT(token, secret) {
  try {
    const encoder = new TextEncoder();
    const parts = token.split('.');
    if (parts.length !== 3) {return null;}

    const [headerBase64, payloadBase64, signatureBase64] = parts;
    const signatureInput = `${headerBase64}.${payloadBase64}`;

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(signatureInput));

    if (!isValid) {return null;}

    const payload = JSON.parse(atob(payloadBase64));

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// Helper: Base64 URL encode
function base64UrlEncode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Legacy SHA-256 (không salt) — chỉ dùng để verify account cũ migrate dần
async function legacyHashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// PBKDF2-SHA256 with random salt — 100k iterations (CF Workers max limit)
// Format lưu trong DB: "pbkdf2$<iter>$<saltHex>$<hashHex>"
async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;
  const keyMat = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMat, 256
  );
  const hex = (buf) => Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2$${iterations}$${hex(salt)}$${hex(bits)}`;
}

// Constant-time verify — supports both new PBKDF2 and legacy SHA-256
async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') { return false; }
  if (stored.startsWith('pbkdf2$')) {
    const [, iterStr, saltHex, hashHex] = stored.split('$');
    const iter = parseInt(iterStr, 10);
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
    const enc = new TextEncoder();
    const keyMat = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
      keyMat, 256
    );
    const computed = Array.from(new Uint8Array(bits))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    // Constant-time compare
    if (computed.length !== hashHex.length) { return false; }
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed.charCodeAt(i) ^ hashHex.charCodeAt(i);
    }
    return diff === 0;
  }
  // Legacy path: plain SHA-256 hex
  const legacy = await legacyHashPassword(password);
  return legacy === stored;
}

// Helper: Get auth token from request header
function getAuthToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Helper: Scan KV for existing owner — returns first owner's safe metadata or null
async function findExistingOwner(env) {
  let cursor;
  let pages = 0;
  const MAX_PAGES = 20;
  do {
    const opts = { prefix: 'user:', limit: 1000 };
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
      } catch (_e) { /* skip malformed */ }
    }
    cursor = page.list_complete ? null : page.cursor;
    pages += 1;
  } while (cursor && pages < MAX_PAGES);
  return null;
}

/**
 * POST /api/auth/register
 * Body: email, password, name, phone
 */
export async function registerUser(request, env) {
  try {
    const body = await parseJSON(request);

    // Validate required fields
    const { email, password, name, phone } = body;
    if (!email || !password) {
      return errorResponse('Email và mật khẩu là bắt buộc', 400);
    }

    if (password.length < 8) {
      return errorResponse('Mật khẩu phải có ít nhất 8 ký tự', 400);
    }
    if (password.length > 128) {
      return errorResponse('Mật khẩu không vượt quá 128 ký tự', 400);
    }

    // Check if user exists
    const existingUser = await env.AUTH_KV.get(`user:${email}`);
    if (existingUser) {
      return errorResponse('Email đã được đăng ký', 409);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user object
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

    // Save to KV
    await env.AUTH_KV.put(`user:${email}`, JSON.stringify(user));

    // Sync to D1 customers table for loyalty tracking
    try {
      const customerId = generateId('CUS_');
      const now = new Date().toISOString();
      await env.AURA_DB.prepare(
        'INSERT OR IGNORE INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, created_at, updated_at) VALUES (?, ?, ?, ?, 0, \'silver\', ?, ?)'
      ).bind(customerId, email, name || '', phone || '', now, now).run();
    } catch (_) { /* non-fatal */ }

    // Generate token (stateless — revocation via denylist on logout)
    const token = await generateJWT(
      { email, name: user.name, id: user.id, role: user.role },
      env.JWT_SECRET,
      env.JWT_EXPIRY_SECONDS
    );

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
      token,
      message: 'Đăng ký thành công',
    }, 201);
  } catch (error) {
    if (DEBUG) {console.error('Register error:', error);}
    return errorResponse('Đăng ký thất bại: ' + error.message, 500);
  }
}

/**
 * POST /api/auth/login
 * Body: email, password
 */
export async function loginUser(request, env) {
  try {
    const body = await parseJSON(request);
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('Vui lòng nhập email và mật khẩu', 400);
    }

    // Get user from KV
    const userStr = await env.AUTH_KV.get(`user:${email}`);
    if (!userStr) {
      return errorResponse('Email hoặc mật khẩu không đúng', 401);
    }

    const user = JSON.parse(userStr);

    // Verify password (PBKDF2 new + SHA-256 legacy fallback)
    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      return errorResponse('Email hoặc mật khẩu không đúng', 401);
    }

    // Auto-migrate: upgrade legacy SHA-256 to PBKDF2 on successful login
    if (!String(user.password).startsWith('pbkdf2$')) {
      user.password = await hashPassword(password);
      await env.AUTH_KV.put(`user:${email}`, JSON.stringify(user));
    }

    // Generate token (stateless — revocation via denylist on logout)
    const token = await generateJWT(
      { email, name: user.name, id: user.id, role: user.role || 'customer' },
      env.JWT_SECRET,
      env.JWT_EXPIRY_SECONDS
    );

    // Update last login
    user.last_login = new Date().toISOString();
    user.updated_at = new Date().toISOString();
    await env.AUTH_KV.put(`user:${email}`, JSON.stringify(user));

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role || 'customer' },
      token,
      message: 'Đăng nhập thành công',
    });
  } catch (error) {
    if (DEBUG) {console.error('Login error:', error);}
    return errorResponse('Đăng nhập thất bại: ' + error.message, 500);
  }
}

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <token>
 */
export async function logoutUser(request, env) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return errorResponse('Không tìm thấy token', 400);
    }

    // Denylist: add token to revocation list until its natural expiry
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (payload?.exp) {
      const ttl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
      await env.AUTH_KV.put(`revoked:${token}`, '1', { expirationTtl: ttl });
    }

    return jsonResponse({
      success: true,
      message: 'Đăng xuất thành công',
    });
  } catch (error) {
    if (DEBUG) {console.error('Logout error:', error);}
    return errorResponse('Đăng xuất thất bại: ' + error.message, 500);
  }
}

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 */
export async function getCurrentUser(request, env) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return errorResponse('Unauthorized', 401);
    }

    // Verify token
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) {
      return errorResponse('Token không hợp lệ hoặc đã hết hạn', 401);
    }

    // Denylist check: reject only if explicitly revoked
    const revoked = await env.AUTH_KV.get(`revoked:${token}`);
    if (revoked) {
      return errorResponse('Token đã bị hủy', 401);
    }

    // Get user data
    const userStr = await env.AUTH_KV.get(`user:${payload.email}`);
    if (!userStr) {
      return errorResponse('User not found', 404);
    }

    const user = JSON.parse(userStr);

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role || 'customer' },
    });
  } catch (error) {
    if (DEBUG) {console.error('GetUser error:', error);}
    return errorResponse('Lỗi server: ' + error.message, 500);
  }
}

/**
 * POST /api/auth/register-staff
 * Owner-only: creates a staff account
 * Body: email, password, name, phone, role?
 */
export async function registerStaff(request, env) {
  try {
    const body = await parseJSON(request);
    const { email, password, name, phone, role } = body;

    if (!email || !password) {
      return errorResponse('Email và mật khẩu là bắt buộc', 400);
    }

    if (password.length < 8) {
      return errorResponse('Mật khẩu phải có ít nhất 8 ký tự', 400);
    }
    if (password.length > 128) {
      return errorResponse('Mật khẩu không vượt quá 128 ký tự', 400);
    }

    const existingUser = await env.AUTH_KV.get(`user:${email}`);
    if (existingUser) {
      return errorResponse('Email đã được đăng ký', 409);
    }

    const hashedPassword = await hashPassword(password);

    // Allow owner role only when explicitly requested by an existing owner
    const requestedRole = role === 'owner' ? 'owner' : 'staff';

    const user = {
      id: generateId('USR_'),
      email,
      name: name || '',
      phone: phone || '',
      password: hashedPassword,
      role: requestedRole,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await env.AUTH_KV.put(`user:${email}`, JSON.stringify(user));

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      message: `Tạo tài khoản ${requestedRole} thành công`,
    }, 201);
  } catch (error) {
    if (DEBUG) { console.error('RegisterStaff error:', error); }
    return errorResponse('Tạo tài khoản staff thất bại: ' + error.message, 500);
  }
}

/**
 * GET /api/auth/staff
 * Owner-only: list all staff/owner accounts (scan KV by prefix `user:`)
 *
 * Response: { success, users: [{ id, email, name, phone, role, active, created_at, last_login }] }
 *
 * Auth: requireAuth(['owner']) middleware should be attached at route level.
 */
export async function listStaff(request, env) {
  try {
    if (!env.AUTH_KV) {
      return errorResponse('AUTH_KV binding chưa cấu hình', 500);
    }

    const users = [];
    let cursor = undefined;
    // Defensive: cap iterations to prevent unbounded scans
    let pages = 0;
    const MAX_PAGES = 20;

    do {
      const opts = { prefix: 'user:', limit: 1000 };
      if (cursor) { opts.cursor = cursor; }
      const page = await env.AUTH_KV.list(opts);

      for (const key of page.keys) {
        const userStr = await env.AUTH_KV.get(key.name);
        if (!userStr) { continue; }
        try {
          const u = JSON.parse(userStr);
          // Filter: only staff/owner — skip customer accounts
          if (u.role === 'staff' || u.role === 'owner') {
            users.push({
              id: u.id,
              email: u.email,
              name: u.name || '',
              phone: u.phone || '',
              role: u.role,
              active: u.active !== false, // default true if undefined
              created_at: u.created_at || null,
              last_login: u.last_login || null,
            });
          }
        } catch (_e) { /* skip malformed entries */ }
      }

      cursor = page.list_complete ? null : page.cursor;
      pages += 1;
    } while (cursor && pages < MAX_PAGES);

    // Sort by created_at desc (newest first); fallback to email
    users.sort((a, b) => {
      const ta = a.created_at || '';
      const tb = b.created_at || '';
      if (tb !== ta) { return tb.localeCompare(ta); }
      return (a.email || '').localeCompare(b.email || '');
    });

    return jsonResponse({ success: true, users });
  } catch (error) {
    if (DEBUG) { console.error('ListStaff error:', error); }
    return errorResponse('Lỗi tải danh sách staff: ' + error.message, 500);
  }
}

/**
 * POST /api/auth/bootstrap-owner
 * PUBLIC endpoint — idempotent (safe to leave deployed):
 *   - If NO owner exists yet → creates first owner with provided credentials, returns token
 *   - If owner already exists → returns 409 with the existing owner's email (no password leaked)
 *
 * After first owner is bootstrapped, this endpoint becomes a permanent 409 — cannot escalate privileges.
 *
 * Body: { email, password, name? }
 */
export async function bootstrapOwner(request, env) {
  try {
    if (!env.AUTH_KV) {
      return errorResponse('AUTH_KV binding chưa cấu hình', 500);
    }

    // 1. Check if any owner already exists
    const existingOwner = await findExistingOwner(env);
    if (existingOwner) {
      return jsonResponse({
        success: false,
        error: 'Owner đã tồn tại — bootstrap chỉ chạy được khi chưa có owner nào.',
        existing_owner: existingOwner,
        hint: 'Login với owner hiện có. Nếu quên mật khẩu, đặt RESET_KEY secret rồi gọi /api/auth/reset-password',
      }, 409);
    }

    // 2. Validate body
    const body = await parseJSON(request);
    const { email, password, name } = body;

    if (!email || !password) {
      return errorResponse('Email và mật khẩu là bắt buộc', 400);
    }
    if (password.length < 8) {
      return errorResponse('Mật khẩu phải có ít nhất 8 ký tự', 400);
    }
    if (password.length > 128) {
      return errorResponse('Mật khẩu không vượt quá 128 ký tự', 400);
    }

    // 3. Check if email is already used (e.g., as customer)
    const existingUser = await env.AUTH_KV.get(`user:${email}`);
    if (existingUser) {
      return errorResponse(
        'Email này đã đăng ký với role khác (customer/staff). Dùng email khác hoặc xoá account cũ qua wrangler kv.',
        409
      );
    }

    // 4. Create owner
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

    await env.AUTH_KV.put(`user:${email}`, JSON.stringify(user));

    // 5. Issue token immediately so caller can login right away
    const token = await generateJWT(
      { email, name: user.name, id: user.id, role: 'owner' },
      env.JWT_SECRET,
      env.JWT_EXPIRY_SECONDS
    );

    return jsonResponse({
      success: true,
      message: 'Owner đầu tiên đã tạo. Endpoint này sẽ từ chối các request sau.',
      user: { id: user.id, email: user.email, name: user.name, role: 'owner' },
      token,
    }, 201);
  } catch (error) {
    if (DEBUG) { console.error('BootstrapOwner error:', error); }
    return errorResponse('Bootstrap owner thất bại: ' + error.message, 500);
  }
}

/**
 * POST /api/auth/reset-password
 * Protected by `X-Reset-Key` header matching `env.RESET_KEY` secret.
 * Set the secret first via: `wrangler secret put RESET_KEY`
 * After use, optionally remove via: `wrangler secret delete RESET_KEY`
 *
 * Body: { email, newPassword }
 *
 * Behavior:
 *   - If email not found → 404
 *   - Otherwise: replace password hash, revoke nothing (existing tokens still valid until natural expiry)
 *   - Returns a fresh token for convenience
 */
export async function resetPassword(request, env) {
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
    const { email, newPassword } = body;

    if (!email || !newPassword) {
      return errorResponse('Email và newPassword là bắt buộc', 400);
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return errorResponse('Mật khẩu mới phải 8–128 ký tự', 400);
    }

    const userStr = await env.AUTH_KV.get(`user:${email}`);
    if (!userStr) {
      return errorResponse('Không tìm thấy user với email này', 404);
    }

    const user = JSON.parse(userStr);
    user.password = await hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    await env.AUTH_KV.put(`user:${email}`, JSON.stringify(user));

    // Issue new token for convenience (caller may want to login immediately)
    const token = await generateJWT(
      { email, name: user.name, id: user.id, role: user.role || 'customer' },
      env.JWT_SECRET,
      env.JWT_EXPIRY_SECONDS
    );

    return jsonResponse({
      success: true,
      message: 'Mật khẩu đã được reset',
      user: { id: user.id, email: user.email, name: user.name, role: user.role || 'customer' },
      token,
    });
  } catch (error) {
    if (DEBUG) { console.error('ResetPassword error:', error); }
    return errorResponse('Reset mật khẩu thất bại: ' + error.message, 500);
  }
}

// Export helpers for use in index.js
export { generateJWT, verifyJWT, hashPassword, verifyPassword, getAuthToken };
