/**
 * Direct Auth Router
 * Handles user login, registration, verification, staff management, and password flows.
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { requireAuth } from '../middleware/auth';
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

const authRateLimit: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const key = `rate:auth:${ip}`;
  const count = Number(await c.env.AUTH_KV.get(key) || 0);
  if (count >= 20) {
    return c.json({ ok: false, error: 'Too many requests. Try again in 5 minutes.' }, 429);
  }
  await c.env.AUTH_KV.put(key, String(count + 1), { expirationTtl: 300 });
  await next();
};

authEndpointsRouter.post('/register', authRateLimit, (c) => registerWithVerification(c.req.raw, c.env));
authEndpointsRouter.post('/login', authRateLimit, (c) => loginUser(c.req.raw, c.env, c.executionCtx));
authEndpointsRouter.post('/logout', (c) => logoutUser(c.req.raw, c.env));
authEndpointsRouter.get('/me', (c) => getCurrentUser(c.req.raw, c.env));
authEndpointsRouter.get('/session', (c) => getAuthSession(c.req.raw, c.env));
authEndpointsRouter.post('/verify-email', authRateLimit, (c) => verifyEmail(c.req.raw, c.env));
authEndpointsRouter.post('/register-staff', requireAuth(['owner']), audit('register_staff'), (c) => registerStaff(c.req.raw, c.env));
authEndpointsRouter.get('/staff', requireAuth(['owner']), audit('list_staff'), (c) => listStaff(c.req.raw, c.env));
authEndpointsRouter.post('/bootstrap-owner', (c) => bootstrapOwner(c.req.raw, c.env));
authEndpointsRouter.post('/reset-password', authRateLimit, (c) => resetPassword(c.req.raw, c.env));
authEndpointsRouter.post('/change-password', authRateLimit, (c) => changePassword(c.req.raw, c.env));
