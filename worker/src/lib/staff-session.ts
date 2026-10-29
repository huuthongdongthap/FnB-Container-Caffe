/** D1 account authority shared by Staff login, refresh, HTTP and streams. */
import type { D1Database } from '@cloudflare/workers-types';
import type { JwtPayload } from '../types/api';
import { generateJWT } from './jwt';

export const STAFF_SESSION_MAX_AGE_SECONDS = 28_800;
// The domain's UI role list has four entries; operational sessions support all nine.
export const STAFF_SESSION_ROLES = ['owner', 'admin', 'manager', 'staff', 'waiter', 'cashier', 'kitchen', 'barista', 'chef'];
export const isStaffRole = (role: unknown): role is string => typeof role === 'string' && STAFF_SESSION_ROLES.includes(role);
export const isStaffIdentity = (claims: Partial<StaffSession>) => claims.role !== 'customer' || Boolean(claims.sessionType);

export interface StaffAccount {
  id: string; name: string; phone: string | null; role: string;
  tenant_id: string | null; is_active: number; auth_version: number;
}
export interface StaffSessionClaims {
  authVersion: number; authTime: number;
  sessionType: 'staff-web' | 'staff-mobile'; deviceId?: string; sessionId?: string;
}
export type StaffSession = JwtPayload & StaffSessionClaims;
export type StaffSessionCode = 'SESSION_EXPIRED' | 'SESSION_REVOKED' | 'DEVICE_REVOKED' | 'STAFF_ACCOUNT_INACTIVE' | 'AUTH_STATE_UNAVAILABLE';
export type SessionCheckResult = { ok: true; account: StaffAccount } | { ok: false; reason: 'missing' };
const messages: Record<StaffSessionCode, string> = {
  SESSION_EXPIRED: 'Phiên đã hết hạn, vui lòng đăng nhập lại',
  SESSION_REVOKED: 'Phiên đã bị thu hồi, vui lòng đăng nhập lại',
  DEVICE_REVOKED: 'Thiết bị đã bị thu hồi',
  STAFF_ACCOUNT_INACTIVE: 'Tài khoản đã bị vô hiệu hóa',
  AUTH_STATE_UNAVAILABLE: 'Không kiểm tra được trạng thái tài khoản',
};
export class StaffSessionError extends Error {
  readonly status: 401 | 403 | 503;
  constructor(readonly code: StaffSessionCode) {
    super(messages[code]);
    this.status = code === 'AUTH_STATE_UNAVAILABLE' ? 503 : code === 'STAFF_ACCOUNT_INACTIVE' ? 403 : 401;
  }
}
export class SessionUnavailableError extends StaffSessionError {
  constructor(_detail?: string) { super('AUTH_STATE_UNAVAILABLE'); }
}
export function staffSessionErrorResponse(error: unknown): Response | null {
  return error instanceof StaffSessionError
    ? Response.json({ success: false, error: error.message, code: error.code }, { status: error.status }) : null;
}
export const isAccountActive = (account: StaffAccount) => account.is_active === 1;
export const staffTenant = (account: StaffAccount) => account.tenant_id || 'default';

/** No KV or legacy-column fallback: missing auth schema is an outage, not a guest. */
export async function loadStaffAccount(db: D1Database, staffId: string): Promise<SessionCheckResult> {
  try {
    const row = await db.prepare('SELECT id, name, phone, role, tenant_id, is_active, auth_version FROM users WHERE id = ?')
      .bind(staffId).first<StaffAccount>();
    if (!row || row.id !== staffId) return { ok: false, reason: 'missing' };
    if (!Number.isSafeInteger(row.auth_version) || row.auth_version < 1 || ![0, 1].includes(row.is_active)) {
      throw new SessionUnavailableError();
    }
    return { ok: true, account: row };
  } catch { throw new SessionUnavailableError(); }
}
export async function requireStaffAccount(db: D1Database, id: string): Promise<StaffAccount> {
  const result = await loadStaffAccount(db, id);
  if (!result.ok || !isStaffRole(result.account.role)) throw new StaffSessionError('SESSION_REVOKED');
  if (!isAccountActive(result.account)) throw new StaffSessionError('STAFF_ACCOUNT_INACTIVE');
  return result.account;
}
export function remainingStaffTtl(authTime: number, now = Math.floor(Date.now() / 1000)): number {
  return Math.max(0, authTime + STAFF_SESSION_MAX_AGE_SECONDS - now);
}
export function evaluateStaffSession(
  claims: Partial<StaffSession>, account: StaffAccount, now = Math.floor(Date.now() / 1000),
): { valid: true; remainingSeconds: number } | { valid: false; code: StaffSessionCode } {
  if (!isAccountActive(account)) return { valid: false, code: 'STAFF_ACCOUNT_INACTIVE' };
  if (!isStaffRole(account.role) || claims.id !== account.id || claims.role !== account.role
    || (claims.tenantId || 'default') !== staffTenant(account) || !Number.isSafeInteger(claims.authVersion)
    || claims.authVersion !== account.auth_version || !Number.isSafeInteger(claims.authTime)
    || claims.authTime! > now || claims.authTime! < 0
    || !['staff-web', 'staff-mobile'].includes(claims.sessionType || '')
    || (claims.sessionType === 'staff-mobile' && !claims.deviceId)
    || !Number.isSafeInteger(claims.exp) || claims.exp! > claims.authTime! + STAFF_SESSION_MAX_AGE_SECONDS) {
    return { valid: false, code: 'SESSION_REVOKED' };
  }
  const remainingSeconds = remainingStaffTtl(claims.authTime!, now);
  if (claims.exp! <= now || remainingSeconds <= 0) return { valid: false, code: 'SESSION_EXPIRED' };
  return { valid: true, remainingSeconds };
}
export async function validateStaffSession(db: D1Database, claims: Partial<StaffSession>): Promise<StaffAccount> {
  const account = await requireStaffAccount(db, String(claims.id || ''));
  const result = evaluateStaffSession(claims, account);
  if (!result.valid) throw new StaffSessionError(result.code);
  if (claims.sessionType === 'staff-mobile') {
    let device;
    try {
      device = await db.prepare('SELECT id, staff_id FROM staff_devices WHERE id = ?').bind(claims.deviceId).first<{ staff_id: string }>();
    } catch { throw new SessionUnavailableError(); }
    if (!device || device.staff_id !== account.id) throw new StaffSessionError('DEVICE_REVOKED');
  }
  return account;
}
export function buildStaffClaims(params: JwtPayload & StaffSessionClaims): StaffSession { return { ...params }; }
export async function issueStaffSession(
  env: { JWT_SECRET: string; JWT_AUDIENCE?: string; JWT_ISSUER?: string }, account: StaffAccount,
  options: { email?: string; authTime?: number; sessionType: StaffSessionClaims['sessionType']; deviceId?: string },
) {
  const now = Math.floor(Date.now() / 1000);
  const authTime = options.authTime ?? now;
  if (!isStaffRole(account.role)) throw new StaffSessionError('SESSION_REVOKED');
  if (!isAccountActive(account)) throw new StaffSessionError('STAFF_ACCOUNT_INACTIVE');
  const ttl = remainingStaffTtl(authTime, now);
  if (!Number.isSafeInteger(authTime) || authTime > now || ttl <= 0) throw new StaffSessionError('SESSION_EXPIRED');
  const claims = buildStaffClaims({
    id: account.id, name: account.name || account.id, email: options.email || '', role: account.role,
    tenantId: staffTenant(account), authTime, authVersion: account.auth_version,
    sessionType: options.sessionType, sessionId: crypto.randomUUID(), ...(options.deviceId ? { deviceId: options.deviceId } : {}),
    ...(env.JWT_AUDIENCE ? { aud: env.JWT_AUDIENCE } : {}), ...(env.JWT_ISSUER ? { iss: env.JWT_ISSUER } : {}),
    iat: now, exp: authTime + STAFF_SESSION_MAX_AGE_SECONDS,
  });
  const token = await generateJWT(claims, env.JWT_SECRET, ttl, now);
  return { token, expires_in: ttl, claims, user: {
    id: account.id, name: claims.name, email: claims.email, phone: account.phone || '',
    role: account.role, tenantId: claims.tenantId, ...(options.deviceId ? { device_id: options.deviceId } : {}),
  } };
}
