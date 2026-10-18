// Extracted middleware from routes/subscriptions.ts

import type { Context } from 'hono';
import { verifyJWT } from '../../lib/jwt';
import type { Env } from '../../types/env';
import type { JwtPayload } from './types';

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
  if (!['owner', 'manager', 'admin', 'staff'].includes(payload.role || '')) {
    return c.json({ success: false, error: 'Forbidden — admin only' }, 403);
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
  if (!['owner', 'manager', 'admin', 'staff', 'vendor', 'customer'].includes(payload.role || '')) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  return null;
}
