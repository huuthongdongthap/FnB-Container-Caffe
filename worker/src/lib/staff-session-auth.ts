/** Request authentication shared by middleware and the legacy/raw auth routes. */
import type { Env } from '../types/env';
import type { JwtPayload } from '../types/api';
import { cookieWriteBlockReason, getAuthToken, verifyJWT } from './jwt';
import { isStaffIdentity, validateStaffSession, StaffSessionError, SessionUnavailableError, type StaffSession, type StaffAccount } from './staff-session';

export async function authenticateRequest(
  request: Request, env: Pick<Env, 'JWT_SECRET' | 'JWT_AUDIENCE' | 'JWT_ISSUER' | 'AURA_DB' | 'AUTH_KV'>,
  options: { optional?: boolean; bearerOnly?: boolean } = {},
): Promise<{ payload: JwtPayload; token: string; account: StaffAccount | null } | { blocked: string } | null> {
  const bearer = request.headers.get('Authorization');
  const token = options.bearerOnly ? (bearer?.startsWith('Bearer ') ? bearer.slice(7) : null) : getAuthToken(request);
  if (!token) {
    if (options.optional) return null;
    throw new StaffSessionError('SESSION_EXPIRED');
  }
  const block = cookieWriteBlockReason(request.method, request);
  if (block) return { blocked: block } as const;
  const verified = await verifyJWT(token, env.JWT_SECRET, { expectedAudience: env.JWT_AUDIENCE, expectedIssuer: env.JWT_ISSUER });
  if (!verified) throw new StaffSessionError('SESSION_EXPIRED');
  // Preserve the existing signed `sub` alias and default customer role contract.
  const payload = { ...verified, id: verified.id || (verified as { sub?: string }).sub || '', role: verified.role || 'customer' };
  const claims = payload as StaffSession;
  let revoked;
  try { revoked = await env.AUTH_KV?.get(`revoked:${token}`); }
  catch { throw new SessionUnavailableError(); }
  if (revoked) throw new StaffSessionError('SESSION_REVOKED');
  const account = isStaffIdentity(claims) ? await validateStaffSession(env.AURA_DB, claims) : null;
  if (!account) {
    if (!payload.id && !payload.email) {
      throw new StaffSessionError('SESSION_EXPIRED');
    }
    const rawPayloadTenant = String(
      payload.tenantId || (payload as { tenant_id?: string }).tenant_id || ''
    ).trim();
    let customerTenant = rawPayloadTenant || 'default';
    let storedVersion = 1;
    let hasVersionRecord = false;
    if (env.AUTH_KV?.get) {
      let rawCustomer: string | null = null;
      let rawCustomerById: string | null = null;
      let rawCustVer: string | null = null;
      try {
        if (payload.email) rawCustomer = await env.AUTH_KV.get(`user:${payload.email}`);
        if (payload.id) {
          rawCustomerById = await env.AUTH_KV.get(`user:${payload.id}`);
          rawCustVer = await env.AUTH_KV.get(`cust_auth_ver:${payload.id}`);
        }
      } catch {
        throw new SessionUnavailableError();
      }
      for (const raw of [rawCustomer, rawCustomerById]) {
        if (raw) {
          hasVersionRecord = true;
          try {
            const storedCustomer = JSON.parse(raw) as {
              auth_version?: number;
              is_active?: number | boolean;
              tenant_id?: string;
              tenantId?: string;
            };
            const storedTenant = String(storedCustomer.tenant_id || storedCustomer.tenantId || '').trim();
            if (storedTenant && !rawPayloadTenant) {
              customerTenant = storedTenant;
            }
            if (storedTenant && rawPayloadTenant && storedTenant !== rawPayloadTenant) {
              continue;
            }
            if (storedCustomer.is_active === 0 || storedCustomer.is_active === false) {
              throw new StaffSessionError('SESSION_REVOKED');
            }
            storedVersion = Math.max(storedVersion, Number(storedCustomer.auth_version || 1));
          } catch (err) {
            if (err instanceof StaffSessionError) throw err;
          }
        }
      }
      if (rawCustVer) {
        hasVersionRecord = true;
        const parsedVer = Number(rawCustVer);
        if (Number.isFinite(parsedVer) && parsedVer > 0) {
          storedVersion = Math.max(storedVersion, parsedVer);
        }
      }
    }
    if (env.AURA_DB?.prepare) {
      try {
        if (payload.id) {
          const custRecord = await env.AURA_DB.prepare('SELECT id, tenant_id FROM customers WHERE id = ? LIMIT 1')
            .bind(payload.id)
            .first<{ id?: string | null; tenant_id?: string | null }>()
            .catch(() => null);
          if (custRecord && 'tenant_id' in custRecord && custRecord.tenant_id !== undefined) {
            const dbCustTenant = (custRecord.tenant_id && String(custRecord.tenant_id).trim()) || 'default';
            customerTenant = dbCustTenant;
          }
        }
        let d1User: {
          id?: string | null;
          email?: string | null;
          auth_version?: number | null;
          is_active?: number | boolean | null;
          tenant_id?: string | null;
        } | null = null;
        if (payload.id) {
          d1User = await env.AURA_DB.prepare(
            'SELECT id, email, auth_version, is_active, tenant_id FROM users WHERE id = ?'
          )
            .bind(payload.id)
            .first<{
              id?: string | null;
              email?: string | null;
              auth_version?: number | null;
              is_active?: number | boolean | null;
              tenant_id?: string | null;
            }>()
            .catch(() =>
              customerTenant === 'default'
                ? env.AURA_DB.prepare('SELECT id, email, auth_version, is_active FROM users WHERE id = ?')
                    .bind(payload.id)
                    .first<{
                      id?: string | null;
                      email?: string | null;
                      auth_version?: number | null;
                      is_active?: number | boolean | null;
                    }>()
                    .catch(() => null)
                : null
            );
          if (d1User?.id && String(d1User.id) !== String(payload.id)) {
            d1User = null;
          }
          if (d1User && 'tenant_id' in d1User && d1User.tenant_id !== undefined && d1User.tenant_id !== null) {
            const userTenant = String(d1User.tenant_id).trim() || 'default';
            if (userTenant !== customerTenant) {
              d1User = null;
            }
          }
        }
        if (!d1User && payload.email) {
          d1User = await env.AURA_DB.prepare(
            "SELECT id, email, auth_version, is_active, tenant_id FROM users WHERE lower(email) = lower(?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
            .bind(payload.email, customerTenant)
            .first<{
              id?: string | null;
              email?: string | null;
              auth_version?: number | null;
              is_active?: number | boolean | null;
              tenant_id?: string | null;
            }>()
            .catch(() =>
              customerTenant === 'default'
                ? env.AURA_DB.prepare('SELECT id, email, auth_version, is_active FROM users WHERE lower(email) = lower(?)')
                    .bind(payload.email)
                    .first<{
                      id?: string | null;
                      email?: string | null;
                      auth_version?: number | null;
                      is_active?: number | boolean | null;
                    }>()
                    .catch(() => null)
                : null
            );
          if (d1User?.email && String(d1User.email).toLowerCase() !== String(payload.email).toLowerCase()) {
            d1User = null;
          }
          if (d1User && 'tenant_id' in d1User && d1User.tenant_id !== undefined && d1User.tenant_id !== null) {
            const userTenant = String(d1User.tenant_id).trim() || 'default';
            if (userTenant !== customerTenant) {
              d1User = null;
            }
          }
        }
        if (d1User) {
          if (d1User.is_active === 0 || d1User.is_active === false) {
            throw new StaffSessionError('SESSION_REVOKED');
          }
          const dbVer = Number(d1User.auth_version || 1);
          if (Number.isFinite(dbVer) && dbVer > 0) {
            hasVersionRecord = true;
            storedVersion = Math.max(storedVersion, dbVer);
          }
        }
      } catch (err) {
        if (err instanceof StaffSessionError) throw err;
      }
    }
    const tokenVersion = Number(payload.authVersion || 1);
    if ((hasVersionRecord && storedVersion !== tokenVersion) || (!hasVersionRecord && tokenVersion < 1)) {
      throw new StaffSessionError('SESSION_REVOKED');
    }
  }
  return { payload, token, account } as const;
}

export const authenticateCustomerSession = authenticateRequest;
