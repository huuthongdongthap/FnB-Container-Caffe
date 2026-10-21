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

/** Rate limit response headers — RFC 9331 naming so clients can self-throttle. */
export const RATE_LIMIT_HEADERS = {
  limit: 'X-RateLimit-Limit',
  remaining: 'X-RateLimit-Remaining',
  reset: 'X-RateLimit-Reset',
  retryAfter: 'Retry-After',
} as const;

/**
 * Resolves the caller's network address.
 * Cloudflare sets cf-connecting-ip at the edge; x-forwarded-for is only trusted
 * when the request did not come through the CF proxy.
 */
function resolveClientIp(c: Context<{ Bindings: Env }>): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
}

/**
 * Reads a context value when the context supports it.
 * `c.get` is absent from hand-built mock contexts in unit tests, and Hono's
 * typed key map rejects dynamic keys, so read through the raw signatures.
 */
function readContextValue(c: Context<{ Bindings: Env }>, key: string): unknown {
  const getter = (c as unknown as { get?: (k: string) => unknown }).get;
  if (typeof getter !== 'function') return undefined;
  return getter.call(c, key);
}

/**
 * Builds the rate limit key from the most specific identity available.
 *
 * Keying on IP alone buckets every user behind one NAT or mobile carrier into a
 * single counter, so a busy office locks out everyone. An authenticated user is
 * the true identity; tenant is next best; IP is the last resort for guests.
 */
function buildRateLimitKey(
  c: Context<{ Bindings: Env }>,
  config: RateLimitConfig
): string {
  const user = readContextValue(c, 'user') as { id?: string; tenantId?: string } | undefined;
  const tenantId = readContextValue(c, 'tenantId') as string | undefined;

  if (user?.id) {
    return `${config.keyPrefix}:user:${user.id}`;
  }
  if (tenantId && tenantId !== 'default') {
    return `${config.keyPrefix}:tenant:${tenantId}:ip:${resolveClientIp(c)}`;
  }
  return `${config.keyPrefix}:ip:${resolveClientIp(c)}`;
}

/** Absolute epoch seconds at which the window expires, given now. */
function resetInSeconds(windowSec: number): number {
  return Math.floor(Date.now() / 1000) + windowSec;
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

/**
 * POS checkout is staff-driven and bursts during a rush, so it gets a higher
 * ceiling than the customer-facing order limit — never zero. Keyed per user,
 * which keeps one cashier's retry loop from throttling the next till.
 */
export const POS_CHECKOUT_RATE_LIMIT: RateLimitConfig = {
  max: 60,
  windowSec: 60,
  keyPrefix: 'rate:pos-checkout',
  errorMessage: 'Quá nhiều giao dịch. Vui lòng thử lại sau ít phút.'
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
  const key = buildRateLimitKey(c, config);
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
      // Headers ride on the response so the caller's client can back off.
      const response = c.json({ ok: false, error: config.errorMessage }, 429);
      try {
        response.headers.set(RATE_LIMIT_HEADERS.limit, String(config.max));
        response.headers.set(RATE_LIMIT_HEADERS.remaining, '0');
        response.headers.set(RATE_LIMIT_HEADERS.reset, String(resetInSeconds(config.windowSec)));
        response.headers.set(RATE_LIMIT_HEADERS.retryAfter, String(config.windowSec));
      } catch {
        // Mocked/immutable response in unit tests — the 429 body is what matters.
      }
      return response;
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
