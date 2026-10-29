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
  return { payload, token, account } as const;
}
