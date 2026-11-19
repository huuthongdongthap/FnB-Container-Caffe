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
  const hasJwtClaimsConfig = c.env.JWT_AUDIENCE !== undefined || c.env.JWT_ISSUER !== undefined;
  const payload = hasJwtClaimsConfig
    ? await verifyJWT(token, c.env.JWT_SECRET, {
        expectedAudience: c.env.JWT_AUDIENCE,
        expectedIssuer: c.env.JWT_ISSUER,
      })
    : await verifyJWT(token, c.env.JWT_SECRET);
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
  const payloadAny = payload as unknown as {
    tenantId?: string;
    tenant_id?: string;
    customerId?: string;
    customer_id?: string;
    userId?: string;
    sub?: string;
  };
  const payloadTenant = String(payloadAny.tenantId ?? payloadAny.tenant_id ?? '').trim();
  if (payloadTenant === '*' || payloadTenant.toLowerCase() === 'hq') {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const queryTenant = String(
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    ''
  ).trim();
  const headerTenant = String(
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  if (queryTenant && headerTenant && queryTenant !== headerTenant) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const reqTenant = queryTenant || headerTenant;
  if (reqTenant === '*' || reqTenant.toLowerCase() === 'hq') {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (hasExplicitPilotTenant && payloadTenant && payloadTenant !== tenantId) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (hasExplicitPilotTenant && reqTenant && reqTenant !== tenantId) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (payloadTenant && reqTenant && reqTenant !== payloadTenant) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const emailBind = payload.email ? String(payload.email) : null;
  const idBind = payloadAny.customerId || payloadAny.customer_id || payload.id || payloadAny.userId || payloadAny.sub || null;
  if (!idBind && !emailBind) {
    return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
  }
  let storedVersion = 1;
  let hasVersionRecord = false;
  if (c.env.AUTH_KV?.get) {
    try {
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
        const rawUserById = await c.env.AUTH_KV.get(`user:${String(idBind)}`);
        if (rawUserById) {
          hasVersionRecord = true;
          try {
            const parsedById = JSON.parse(rawUserById) as { auth_version?: number };
            storedVersion = Math.max(storedVersion, Number(parsedById.auth_version || 1));
          } catch {
            // Ignore malformed KV JSON
          }
        }
        const rawVer = await c.env.AUTH_KV.get(`cust_auth_ver:${String(idBind)}`);
        if (rawVer) {
          hasVersionRecord = true;
          const parsedVer = Number(rawVer);
          if (Number.isFinite(parsedVer) && parsedVer > 0) {
            storedVersion = Math.max(storedVersion, parsedVer);
          }
        }
      }
    } catch {
      return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Dịch vụ xác thực tạm thời gián đoạn' }, 503);
    }
  }
  if (c.env.AURA_DB?.prepare) {
    try {
      let d1User: { id?: string | null; email?: string | null; auth_version?: number | null; is_active?: number | boolean | null; role?: string | null } | null = null;
      if (idBind) {
        d1User = await c.env.AURA_DB.prepare('SELECT id, email, auth_version, is_active, role FROM users WHERE id = ?')
          .bind(String(idBind))
          .first<{ id?: string | null; email?: string | null; auth_version?: number | null; is_active?: number | null; role?: string | null }>()
          .catch(() => null);
        if (d1User?.id && String(d1User.id) !== String(idBind)) {
          d1User = null;
        }
      }
      if (!d1User && emailBind) {
        d1User = await c.env.AURA_DB.prepare('SELECT id, email, auth_version, is_active, role FROM users WHERE lower(email) = lower(?)')
          .bind(emailBind)
          .first<{ id?: string | null; email?: string | null; auth_version?: number | null; is_active?: number | null; role?: string | null }>()
          .catch(() => null);
        if (d1User?.email && String(d1User.email).toLowerCase() !== emailBind.toLowerCase()) {
          d1User = null;
        }
      }
      if (d1User) {
        if (d1User.is_active === 0 || d1User.is_active === false) {
          return c.json({ success: false, code: 'SESSION_REVOKED', error: 'Tài khoản đã bị vô hiệu hóa' }, 401);
        }
        if (d1User.role && isStaffRole(String(d1User.role))) {
          return c.json({ success: false, error: 'Forbidden' }, 403);
        }
        const dbVer = Number(d1User.auth_version || 1);
        if (Number.isFinite(dbVer) && dbVer > 0) {
          hasVersionRecord = true;
          storedVersion = Math.max(storedVersion, dbVer);
        }
      }
    } catch {
      // Optional users table in partial loyalty test schemas
    }
    // Phone-only customers have no users row, so their revocation authority is
    // customers.auth_version in D1 rather than the eventually consistent KV key.
    if (idBind) {
      try {
        const d1Customer = await c.env.AURA_DB.prepare('SELECT auth_version FROM customers WHERE id = ?')
          .bind(String(idBind))
          .first<{ auth_version?: number | null }>();
        const customerVer = Number(d1Customer?.auth_version);
        if (d1Customer && Number.isFinite(customerVer) && customerVer > 0) {
          hasVersionRecord = true;
          storedVersion = Math.max(storedVersion, customerVer);
        }
      } catch {
        // customers.auth_version is absent in partial loyalty test schemas
      }
    }
  }
  const tokenVersion = Number(payload.authVersion || 1);
  if ((hasVersionRecord && storedVersion !== tokenVersion) || (!hasVersionRecord && tokenVersion < 1)) {
    return c.json({ success: false, code: 'SESSION_REVOKED', error: 'Token không hợp lệ' }, 401);
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
      : (payloadTenant || reqTenant || 'default');
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
  if (payloadTenant && normalizedCustomerTenant !== payloadTenant) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (!hasExplicitPilotTenant && reqTenant && normalizedCustomerTenant !== reqTenant) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const dbVerifiedAt = (customer as unknown as { verified_at?: string | null }).verified_at;
  const isUnverifiedPhoneSession = payload.phoneVerified === false && !dbVerifiedAt;
  if (
    isUnverifiedPhoneSession &&
    (relPath === '/spend-cashback' ||
      relPath === '/redeem' ||
      relPath === '/apply' ||
      relPath.startsWith('/referral/apply'))
  ) {
    return c.json({
      success: false,
      code: 'PHONE_VERIFICATION_REQUIRED',
      error: 'Vui lòng xác thực mã OTP để sử dụng ví hoàn tiền và ưu đãi.',
    }, 403);
  }
  (customer as unknown as Record<string, unknown>).phone_verified = !isUnverifiedPhoneSession;
  c.set('customer', customer as unknown as Record<string, unknown>);
  await next();
};

export const authStaff: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = auth.substring(7);
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
  }
  if (!isStaffRole(payload.role)) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (c.env.AUTH_KV && typeof c.env.AUTH_KV.get === 'function') {
    let revoked: string | null = null;
    try {
      revoked = await c.env.AUTH_KV.get(`revoked:${token}`);
    } catch {
      return c.json({ success: false, error: 'Authentication state unavailable' }, 503);
    }
    if (revoked) {
      return c.json({ success: false, error: 'Token đã bị thu hồi' }, 401);
    }
  }
  const tokenVersion = Number((payload as unknown as { authVersion?: number }).authVersion || 1);
  let verifiedLiveStaff = false;
  if (c.env.AURA_DB && typeof c.env.AURA_DB.prepare === 'function' && payload.id) {
    const dbStaff = await c.env.AURA_DB
      .prepare('SELECT is_active, auth_version, role FROM users WHERE id = ? LIMIT 1')
      .bind(payload.id)
      .first<{ is_active?: number | null; auth_version?: number | null; role?: string | null }>()
      .catch(() => null);
    if (dbStaff) {
      verifiedLiveStaff = true;
      if (dbStaff.is_active === 0) {
        return c.json({ success: false, error: 'Tài khoản nhân sự đã bị khóa' }, 403);
      }
      if (dbStaff.role && !isStaffRole(dbStaff.role)) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
      if (Number(dbStaff.auth_version || 1) !== tokenVersion) {
        return c.json({ success: false, error: 'Phiên đăng nhập đã hết hiệu lực' }, 401);
      }
    }
  }
  if (!verifiedLiveStaff && c.env.AUTH_KV && typeof c.env.AUTH_KV.get === 'function') {
    const kvKey = payload.email ? `user:${payload.email}` : payload.id ? `user:${payload.id}` : '';
    if (kvKey) {
      const rawStaff = await c.env.AUTH_KV.get(kvKey).catch(() => null);
      if (rawStaff) {
        try {
          const parsedStaff = JSON.parse(rawStaff) as { is_active?: number | boolean; auth_version?: number; role?: string };
          if (parsedStaff.is_active === 0 || parsedStaff.is_active === false) {
            return c.json({ success: false, error: 'Tài khoản nhân sự đã bị khóa' }, 403);
          }
          if (parsedStaff.role && !isStaffRole(parsedStaff.role)) {
            return c.json({ success: false, error: 'Forbidden' }, 403);
          }
          if (Number(parsedStaff.auth_version || 1) !== tokenVersion) {
            return c.json({ success: false, error: 'Phiên đăng nhập đã hết hiệu lực' }, 401);
          }
        } catch {
          // Ignore malformed auxiliary KV record
        }
      }
    }
  }
  const payloadAny = payload as unknown as { tenantId?: string; tenant_id?: string };
  const rawUserTenant = String(payloadAny.tenantId ?? payloadAny.tenant_id ?? '').trim();
  const role = String(payload.role || '').trim().toLowerCase();
  const isHq = (role === 'owner' || role === 'admin') && (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq');
  const queryTenant = String(
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    ''
  ).trim();
  const headerTenant = String(
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  if (queryTenant && headerTenant && queryTenant !== headerTenant) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const reqTenant = queryTenant || headerTenant;
  if (!isHq) {
    if (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const boundTenant = rawUserTenant || 'default';
    if (reqTenant && (reqTenant === '*' || reqTenant.toLowerCase() === 'hq' || reqTenant !== boundTenant)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    c.set('tenantId', boundTenant);
  } else {
    const resolved = !reqTenant || reqTenant === '*' || reqTenant.toLowerCase() === 'hq' ? '*' : reqTenant;
    c.set('tenantId', resolved);
  }
  c.set('user', payload as unknown as never);
  await next();
};

