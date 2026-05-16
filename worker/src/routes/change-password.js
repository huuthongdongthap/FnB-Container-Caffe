/* eslint-disable no-console */
/**
 * Change Password Endpoint
 * Allows logged-in users (any role) to change their own password.
 *
 * POST /api/auth/change-password
 * Header: Authorization: Bearer <token>
 * Body: { oldPassword, newPassword }
 *
 * Flow:
 *   1. Verify JWT → get email from payload
 *   2. Verify oldPassword against stored hash
 *   3. Hash newPassword (PBKDF2-100k)
 *   4. Update KV (revoke old token by adding to denylist, return fresh token)
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import {
  verifyJWT,
  hashPassword,
  verifyPassword,
  generateJWT,
  getAuthToken,
} from './auth.js';

const DEBUG = typeof AURA_DEBUG !== 'undefined' && AURA_DEBUG;

async function parseJSON(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

/**
 * POST /api/auth/change-password
 */
export async function changePassword(request, env) {
  try {
    // 1. Extract + verify token
    const token = getAuthToken(request);
    if (!token) {
      return errorResponse('Unauthorized: thiếu Authorization header', 401);
    }

    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) {
      return errorResponse('Token verify thất bại — signature/expiry/format invalid', 401);
    }

    // Denylist check
    const revoked = await env.AUTH_KV.get(`revoked:${token}`);
    if (revoked) {
      return errorResponse('Token đã bị thu hồi (logout)', 401);
    }

    // 2. Parse body
    const body = await parseJSON(request);
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return errorResponse('oldPassword và newPassword là bắt buộc', 400);
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return errorResponse('Mật khẩu mới phải 8–128 ký tự', 400);
    }
    if (oldPassword === newPassword) {
      return errorResponse('Mật khẩu mới phải khác mật khẩu cũ', 400);
    }

    // 3. Get user from KV
    const userStr = await env.AUTH_KV.get(`user:${payload.email}`);
    if (!userStr) {
      return errorResponse(`User '${payload.email}' không tồn tại trong KV`, 404);
    }

    const user = JSON.parse(userStr);

    // 4. Verify old password
    const ok = await verifyPassword(oldPassword, user.password);
    if (!ok) {
      return errorResponse('Mật khẩu cũ không đúng', 401);
    }

    // 5. Hash new password + update KV
    user.password = await hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    user.password_changed_at = new Date().toISOString();
    await env.AUTH_KV.put(`user:${payload.email}`, JSON.stringify(user));

    // 6. Revoke old token (denylist until natural expiry)
    if (payload.exp) {
      const ttl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
      await env.AUTH_KV.put(`revoked:${token}`, '1', { expirationTtl: ttl });
    }

    // 7. Issue fresh token so caller stays logged in
    const newToken = await generateJWT(
      { email: user.email, name: user.name, id: user.id, role: user.role || 'customer' },
      env.JWT_SECRET,
      env.JWT_EXPIRY_SECONDS
    );

    return jsonResponse({
      success: true,
      message: 'Mật khẩu đã được đổi thành công',
      user: { id: user.id, email: user.email, name: user.name, role: user.role || 'customer' },
      token: newToken,
    });
  } catch (error) {
    if (DEBUG) { console.error('ChangePassword error:', error); }
    return errorResponse('Đổi mật khẩu thất bại: ' + error.message, 500);
  }
}
