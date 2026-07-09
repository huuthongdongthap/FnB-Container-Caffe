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

export async function checkRateLimit(
  c: Context<{ Bindings: Env }>,
  config: RateLimitConfig
): Promise<boolean> {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  if (ip === '127.0.0.1' || ip === 'localhost') {
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
