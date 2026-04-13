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

// Helper: Generate JWT token
async function generateJWT(payload, secret) {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };

  const headerBase64 = base64UrlEncode(JSON.stringify(header));
  const payloadBase64 = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
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

// Helper: Hash password using SHA-256
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Get auth token from request header
function getAuthToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
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

    if (password.length < 6) {
      return errorResponse('Mật khẩu phải có ít nhất 6 ký tự', 400);
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to KV
    await env.AUTH_KV.put(`user:${email}`, JSON.stringify(user));

    // Generate token
    const token = await generateJWT(
      { email, name: user.name, id: user.id },
      env.JWT_SECRET
    );

    // Save token to KV (for invalidation)
    await env.AUTH_KV.put(`token:${token}`, email, { expirationTtl: 86400 * 7 }); // 7 days

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

    // Verify password
    const hashedPassword = await hashPassword(password);
    if (user.password !== hashedPassword) {
      return errorResponse('Email hoặc mật khẩu không đúng', 401);
    }

    // Generate token
    const token = await generateJWT(
      { email, name: user.name, id: user.id },
      env.JWT_SECRET
    );

    // Save token to KV
    await env.AUTH_KV.put(`token:${token}`, email, { expirationTtl: 86400 * 7 });

    // Update last login
    user.last_login = new Date().toISOString();
    user.updated_at = new Date().toISOString();
    await env.AUTH_KV.put(`user:${email}`, JSON.stringify(user));

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
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

    // Delete token from KV (invalidate)
    await env.AUTH_KV.delete(`token:${token}`);

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

    // Check if token is invalidated
    const tokenEmail = await env.AUTH_KV.get(`token:${token}`);
    if (!tokenEmail) {
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
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
    });
  } catch (error) {
    if (DEBUG) {console.error('GetUser error:', error);}
    return errorResponse('Lỗi server: ' + error.message, 500);
  }
}

// Export helpers for use in index.js
export { generateJWT, verifyJWT, hashPassword, getAuthToken };
