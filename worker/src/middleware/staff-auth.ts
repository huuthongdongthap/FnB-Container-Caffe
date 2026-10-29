/** Staff mobile uses the same CSRF, JWT, account and revocation gate as web. */
import { requireAuth } from './auth';
import { STAFF_SESSION_ROLES } from '../lib/staff-session';

export function requireStaff(allowedRoles: string[] = STAFF_SESSION_ROLES) {
  return requireAuth(allowedRoles.length ? allowedRoles : STAFF_SESSION_ROLES);
}
