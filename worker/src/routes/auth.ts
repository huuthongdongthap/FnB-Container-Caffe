/**
 * Auth Routes
 * Thin re-export file — all handlers extracted to tree/auth/.
 */

export { registerUser } from '../tree/auth/register';
export { registerWithVerification } from '../routes/auth-register';
export { loginUser } from '../tree/auth/login';
export { logoutUser } from '../tree/auth/logout';
export { getCurrentUser } from '../tree/auth/current-user';
export { getAuthSession } from '../routes/auth-session';
export { verifyEmail } from '../routes/auth-verify';
export { requireVerifiedEmail } from '../tree/auth/verified-email-middleware';
export { generateVerifyToken, expiresAtFromNow, isExpired, storeVerifyCode, lookupVerifyCode, deleteVerifyCode } from '../tree/auth/email-verification';
export { registerStaff } from '../tree/auth/register-staff';
export { listStaff } from '../tree/auth/list-staff';
export { bootstrapOwner } from '../tree/auth/bootstrap';
export { resetPassword } from '../tree/auth/reset-password';
export { changePassword } from '../tree/auth/change-password';

// Re-export verifyJWT for backward compatibility with unconverted JS routes
// (customers.js, subscriptions.js, checkin.js import { verifyJWT } from './auth.js')
export { verifyJWT } from '../lib/jwt';
