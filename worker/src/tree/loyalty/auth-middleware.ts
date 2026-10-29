// Auth middleware for loyalty routes — extracted from routes/loyalty.ts

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../types/env';
import { verifyJWT } from '../../lib/jwt';
import { isStaffRole } from '../../lib/staff-session';
import { resolvePilotStore, PilotStoreError } from '../../lib/pilot-store';
import type { Customer } from '../../types/models';

export const authCustomer: MiddlewareHandler<{ Bindings: Env }> = async(c, next) => {
  const pubPaths = ['/phone-auth', '/tiers', '/active-campaign', '/lookup'];
  const pathSegments = c.req.path.split('/').filter(Boolean);
  const relPath = `/${pathSegments.slice(2).join('/')}`;
  if (pubPaths.includes(relPath)) {
    await next();
    return;
  }
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = auth.substring(7);
  if (c.env.AUTH_KV) {
    try {
      const revoked = await c.env.AUTH_KV.get(`revoked:${token}`);
      if (revoked) {
        return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
      }
    } catch {
      return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Dịch vụ xác thực tạm thời gián đoạn' }, 503);
    }
  }
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
  }
  const rawClaims = payload as unknown as { sessionType?: string };
  if (isStaffRole(payload.role) || Boolean(rawClaims.sessionType) || (payload.role && payload.role !== 'customer')) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  let tenantId = 'default';
  try {
    tenantId = resolvePilotStore(c.env);
  } catch (err) {
    if (err instanceof PilotStoreError) {
      return c.json({ success: false, code: err.code, error: err.message }, 503);
    }
    throw err;
  }
  if (payload.tenantId && payload.tenantId !== tenantId) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const emailBind = payload.email ? String(payload.email) : null;
  const idBind = payload.id || (payload as unknown as Record<string, unknown>).sub || null;
  let customer: Customer | null = null;
  if (idBind) {
    try {
      customer = await c.env.AURA_DB.prepare(
        'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE id = ?'
      ).bind(idBind).first<Customer>();
    } catch {
      customer = await c.env.AURA_DB.prepare(
        'SELECT id, email, name, phone, loyalty_points, loyalty_points AS lifetime_points, loyalty_tier, created_at FROM customers WHERE id = ?'
      ).bind(idBind).first<Customer>();
    }
  } else if (emailBind) {
    try {
      customer = await c.env.AURA_DB.prepare(
        'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE email = ?'
      ).bind(emailBind).first<Customer>();
    } catch {
      customer = await c.env.AURA_DB.prepare(
        'SELECT id, email, name, phone, loyalty_points, loyalty_points AS lifetime_points, loyalty_tier, created_at FROM customers WHERE email = ?'
      ).bind(emailBind).first<Customer>();
    }
  }
  if (!customer) {
    return c.json({ success: false, error: 'Customer not found' }, 404);
  }
  c.set('customer', customer as unknown as Record<string, unknown>);
  await next();
};
