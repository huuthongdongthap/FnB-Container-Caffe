// Auth middleware for loyalty routes — extracted from routes/loyalty.ts

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../types/env';
import { verifyJWT } from '../../lib/jwt';
import { isStaffRole } from '../../lib/staff-session';
import { resolvePilotStore, PilotStoreError } from '../../lib/pilot-store';
import type { Customer } from '../../types/models';

export const authCustomer: MiddlewareHandler<{ Bindings: Env }> = async(c, next) => {
  const pubPaths = ['/phone-auth', '/phone-otp/request', '/tiers', '/active-campaign', '/lookup'];
  const pathSegments = c.req.path.split('/').filter(Boolean);
  const relPath = pathSegments[0] === 'api' && pathSegments[1] === 'loyalty'
    ? `/${pathSegments.slice(2).join('/')}`
    : `/${pathSegments.join('/')}`;
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
  const hasExplicitPilotTenant = c.env.PILOT_TENANT_ID !== undefined;
  if (hasExplicitPilotTenant && payload.tenantId && payload.tenantId !== tenantId) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const emailBind = payload.email ? String(payload.email) : null;
  const idBind = payload.id || (payload as unknown as Record<string, unknown>).sub || null;
  if (c.env.AUTH_KV?.get) {
    try {
      let storedVersion = 1;
      let hasVersionRecord = false;
      if (emailBind) {
        const rawUser = await c.env.AUTH_KV.get(`user:${emailBind}`);
        if (rawUser) {
          hasVersionRecord = true;
          try {
            const parsed = JSON.parse(rawUser) as { auth_version?: number };
            storedVersion = Math.max(storedVersion, Number(parsed.auth_version || 1));
          } catch {
            // Ignore malformed KV JSON
          }
        }
      }
      if (idBind) {
        const rawVer = await c.env.AUTH_KV.get(`cust_auth_ver:${String(idBind)}`);
        if (rawVer) {
          hasVersionRecord = true;
          const parsedVer = Number(rawVer);
          if (Number.isFinite(parsedVer) && parsedVer > 0) {
            storedVersion = Math.max(storedVersion, parsedVer);
          }
        }
      }
      if (hasVersionRecord) {
        const tokenVersion = Number(payload.authVersion || 1);
        if (storedVersion !== tokenVersion) {
          return c.json({ success: false, code: 'SESSION_REVOKED', error: 'Token không hợp lệ' }, 401);
        }
      }
    } catch {
      return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Dịch vụ xác thực tạm thời gián đoạn' }, 503);
    }
  }
  let customer: Customer | null = null;
  if (idBind) {
    try {
      customer = await c.env.AURA_DB.prepare(
        'SELECT *, COALESCE(lifetime_points, loyalty_points, 0) AS lifetime_points FROM customers WHERE id = ?'
      ).bind(idBind).first<Customer>();
    } catch {
      customer = await c.env.AURA_DB.prepare(
        'SELECT *, loyalty_points AS lifetime_points FROM customers WHERE id = ?'
      ).bind(idBind).first<Customer>();
    }
  }
  if (!customer && emailBind) {
    const expectedTenant = hasExplicitPilotTenant
      ? tenantId
      : ((payload.tenantId && String(payload.tenantId).trim()) || c.req.header('X-Tenant-ID')?.trim() || 'default');
    try {
      customer = await c.env.AURA_DB.prepare(
        "SELECT *, COALESCE(lifetime_points, loyalty_points, 0) AS lifetime_points FROM customers WHERE email = ? ORDER BY CASE WHEN COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? THEN 0 ELSE 1 END"
      ).bind(emailBind, expectedTenant).first<Customer>();
    } catch {
      try {
        customer = await c.env.AURA_DB.prepare(
          'SELECT *, COALESCE(lifetime_points, loyalty_points, 0) AS lifetime_points FROM customers WHERE email = ?'
        ).bind(emailBind).first<Customer>();
      } catch {
        customer = await c.env.AURA_DB.prepare(
          'SELECT *, loyalty_points AS lifetime_points FROM customers WHERE email = ?'
        ).bind(emailBind).first<Customer>();
      }
    }
  }
  if (!customer) {
    return c.json({ success: false, error: 'Customer not found' }, 404);
  }
  const customerTenant = (customer as unknown as { tenant_id?: string | null }).tenant_id;
  const normalizedCustomerTenant = customerTenant && String(customerTenant).trim() ? String(customerTenant).trim() : 'default';
  if (hasExplicitPilotTenant && normalizedCustomerTenant !== tenantId) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (payload.tenantId && payload.tenantId.trim() && normalizedCustomerTenant !== payload.tenantId.trim()) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const hdrTenant = c.req.header('X-Tenant-ID')?.trim();
  if (!hasExplicitPilotTenant && hdrTenant && normalizedCustomerTenant !== hdrTenant) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  c.set('customer', customer as unknown as Record<string, unknown>);
  await next();
};
