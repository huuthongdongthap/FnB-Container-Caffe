// Extracted middleware from routes/subscriptions.ts

import type { Context, Next } from 'hono';
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
  if (!['owner', 'manager', 'supervisor', 'admin', 'staff'].includes(payload.role || '')) {
    return c.json({ success: false, error: 'Forbidden — admin only' }, 403);
  }
  const ctx = c as unknown as { get?: (k: string) => unknown; set?: (k: string, v: unknown) => void };
  if (!ctx.get?.('user') && typeof ctx.set === 'function') {
    const rawPayload = payload as unknown as Record<string, unknown>;
    ctx.set('user', {
      id: String(payload.id || payload.sub || ''),
      email: typeof rawPayload.email === 'string' ? rawPayload.email : undefined,
      customerId: typeof rawPayload.customerId === 'string' ? rawPayload.customerId : undefined,
      role: String(payload.role || ''),
      tenantId: typeof rawPayload.tenantId === 'string'
        ? rawPayload.tenantId
        : typeof rawPayload.tenant_id === 'string'
          ? rawPayload.tenant_id
          : 'default',
    });
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
  if (!['owner', 'manager', 'supervisor', 'admin', 'staff', 'vendor', 'customer'].includes(payload.role || '')) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const ctx = c as unknown as { get?: (k: string) => unknown; set?: (k: string, v: unknown) => void };
  if (!ctx.get?.('user') && typeof ctx.set === 'function') {
    const rawPayload = payload as unknown as Record<string, unknown>;
    ctx.set('user', {
      id: String(payload.id || payload.sub || ''),
      email: typeof rawPayload.email === 'string' ? rawPayload.email : undefined,
      customerId: typeof rawPayload.customerId === 'string' ? rawPayload.customerId : undefined,
      role: String(payload.role || ''),
      tenantId: typeof rawPayload.tenantId === 'string'
        ? rawPayload.tenantId
        : typeof rawPayload.tenant_id === 'string'
          ? rawPayload.tenant_id
          : 'default',
    });
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
