/**
 * Direct Auth Router
 * Handles user login, registration, verification, staff management, and password flows.
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { requireAuth } from '../middleware/auth';
import { loginRateLimit } from '../middleware/rate-limit-login';
import { audit } from '../middleware/audit-log';
import {
  loginUser, logoutUser, getCurrentUser, registerStaff, listStaff,
  bootstrapOwner, resetPassword, changePassword
} from './auth';
import { registerWithVerification } from './auth-register';
import { getAuthSession } from './auth-session';
import { verifyEmail } from './auth-verify';
import type { Env } from '../types/env';

export const authEndpointsRouter = new Hono<{ Bindings: Env }>();

function createAuthRateLimit(
  scope: string,
  opts?: { allowWriteDegradation?: boolean; onlyFailures?: boolean }
): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const isProd = c.env?.ENVIRONMENT === 'production';
    let key: string | null = null;
    let count = 0;
    try {
      if (c.env?.AUTH_KV) {
        const cfIp = c.req.header('cf-connecting-ip')?.trim();
        const forwarded = !isProd ? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() : undefined;
        const ip = cfIp || forwarded || 'unknown';
        key = `rate:auth:${scope}:${ip}`;
        count = Number((await c.env.AUTH_KV.get(key)) || 0);
        if (count >= 20) {
          return c.json({ ok: false, error: 'Too many requests. Try again in 5 minutes.' }, 429);
        }
        if (!opts?.onlyFailures) {
          try {
            await c.env.AUTH_KV.put(key, String(count + 1), { expirationTtl: 300 });
          } catch (putErr) {
            if (!opts?.allowWriteDegradation) {
              throw putErr;
            }
          }
        }
      } else if (isProd) {
        return c.json({ ok: false, error: 'Authentication protection unavailable.' }, 503);
      }
    } catch {
      if (isProd) {
        return c.json({ ok: false, error: 'Authentication protection temporarily unavailable.' }, 503);
      }
    }
    await next();
    if (opts?.onlyFailures && key && c.env?.AUTH_KV && (c.res?.status ?? 500) >= 400) {
      try {
        await c.env.AUTH_KV.put(key, String(count + 1), { expirationTtl: 300 });
      } catch {
        // Post-response best-effort counter increment on failed attempts
      }
    }
  };
}

const registerRateLimit = createAuthRateLimit('register', { allowWriteDegradation: true });
const loginAttemptRateLimit = createAuthRateLimit('login', { allowWriteDegradation: true, onlyFailures: true });
const verifyEmailRateLimit = createAuthRateLimit('verify-email', { allowWriteDegradation: true });
const bootstrapOwnerRateLimit = createAuthRateLimit('bootstrap-owner', { allowWriteDegradation: true });
const operatorResetRateLimit = createAuthRateLimit('operator-reset-password', { allowWriteDegradation: true });
const passwordRotationRateLimit = createAuthRateLimit('change-password', { allowWriteDegradation: true });

authEndpointsRouter.post('/register', registerRateLimit, (c) => registerWithVerification(c.req.raw, c.env));
authEndpointsRouter.post('/login', loginAttemptRateLimit, loginRateLimit(), (c) => {
  let execCtx: { waitUntil?: (p: Promise<unknown>) => void } | undefined;
  try {
    execCtx = c.executionCtx;
  } catch {
    execCtx = undefined;
  }
  return loginUser(c.req.raw, c.env, execCtx);
});
authEndpointsRouter.post('/logout', (c) => logoutUser(c.req.raw, c.env));
authEndpointsRouter.get('/me', (c) => getCurrentUser(c.req.raw, c.env));
authEndpointsRouter.get('/session', (c) => getAuthSession(c.req.raw, c.env));
authEndpointsRouter.post('/verify-email', verifyEmailRateLimit, (c) => verifyEmail(c.req.raw, c.env));
authEndpointsRouter.post('/register-staff', requireAuth(['owner', 'admin']), audit('register_staff'), (c) => registerStaff(c.req.raw, c.env));
authEndpointsRouter.get('/staff', requireAuth(['owner', 'manager', 'supervisor', 'admin']), audit('list_staff'), (c) => listStaff(c.req.raw, c.env));
authEndpointsRouter.post('/bootstrap-owner', bootstrapOwnerRateLimit, (c) => bootstrapOwner(c.req.raw, c.env));
// Operator password reset (requires X-Reset-Key); self-service /forgot-password & /reset-password live on openApiAuthRouter
authEndpointsRouter.post('/operator-reset-password', operatorResetRateLimit, (c) => resetPassword(c.req.raw, c.env));
authEndpointsRouter.post('/change-password', passwordRotationRateLimit, (c) => changePassword(c.req.raw, c.env));
