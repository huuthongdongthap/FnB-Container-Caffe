/**
 * Rate limiter helpers
 * KV-based rate limiting for auth and order creation.
 * Converted from middleware/rate-limit-login.js.
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types/env';

export interface RateLimitConfig {
  max: number;
  windowSec: number;
  keyPrefix: string;
  errorMessage: string;
}

export const AUTH_RATE_LIMIT: RateLimitConfig = {
  max: 20,
  windowSec: 300,
  keyPrefix: 'rate:auth',
  errorMessage: 'Too many requests. Try again in 5 minutes.'
};

export const ORDER_RATE_LIMIT: RateLimitConfig = {
  max: 5,
  windowSec: 600,
  keyPrefix: 'rate:order',
  errorMessage: 'Quá nhiều đơn hàng. Vui lòng thử lại sau 10 phút.'
};

export const RECRUITMENT_RATE_LIMIT: RateLimitConfig = {
  max: 5,
  windowSec: 600,
  keyPrefix: 'rate:recruitment',
  errorMessage: 'Quá nhiều lần gửi hồ sơ. Vui lòng thử lại sau 10 phút.'
};

export const CLIENT_ERROR_RATE_LIMIT: RateLimitConfig = {
  max: 20,
  windowSec: 60,
  keyPrefix: 'rate:client-error',
  errorMessage: 'Too many error reports. Please try again later.'
};

export async function checkRateLimit(
  c: Context<{ Bindings: Env }>,
  config: RateLimitConfig
): Promise<boolean> {
  // Bypass in test environment or when KV is not configured (test benches)
  if ((c.env as Record<string, unknown>).NODE_ENV === 'test') return true;
  if (!c.env.AUTH_KV) return true;
  const isProd = (c.env as Record<string, unknown>)?.ENVIRONMENT === 'production' || (c.env as Record<string, unknown>)?.NODE_ENV === 'production';
  const origin = c.req.header('origin') || c.req.header('referer') || '';
  if (!isProd && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return true;
  }
  const isTestBypass = !isProd && c.req.header('x-playwright-test') === 'true';
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  if (!isProd && (ip === '127.0.0.1' || ip === 'localhost' || isTestBypass)) {
    return true;
  }
  const key = `${config.keyPrefix}:${ip}`;
  const count = Number(await c.env.AUTH_KV.get(key) || 0);
  if (count >= config.max) {
    return false;
  }
  await c.env.AUTH_KV.put(key, String(count + 1), { expirationTtl: config.windowSec });
  return true;
}

export function rateLimitMiddleware(config: RateLimitConfig) {
  return async(c: Context<{ Bindings: Env }>, next: Next) => {
    const allowed = await checkRateLimit(c, config);
    if (!allowed) {
      return c.json({ ok: false, error: config.errorMessage }, 429);
    }
    await next();
  };
}

export async function throttleByKey(
  kv: import('@cloudflare/workers-types').KVNamespace,
  key: string,
  max: number,
  windowSec: number
): Promise<boolean> {
  const cur = parseInt(await kv.get(key) || '0', 10);
  if (cur >= max) {
    return false;
  }
  await kv.put(key, String(cur + 1), { expirationTtl: windowSec });
  return true;
}
