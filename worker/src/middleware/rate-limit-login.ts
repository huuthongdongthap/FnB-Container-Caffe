import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';

// ── Rate Limiter for Login (KV + per-isolate brute-force shield) ──
// Limits: 5 failed login attempts (401) per IP per 5 minutes.
const _loginAttempts = new Map<string, number[]>();
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_WINDOW_TTL_SEC = 300;
const LOGIN_MAX = 5;

export function resetLoginRateLimitMemory(): void {
  _loginAttempts.clear();
}

export function loginRateLimit(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const isProd = c.env?.ENVIRONMENT === 'production';
    const cfIp = c.req.header('cf-connecting-ip')?.trim();
    const fallbackIp = !isProd ? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() : undefined;
    const ip = cfIp || fallbackIp;

    // Without a real client IP in non-production unit tests, skip shared global bucket
    // so parallel password-validation tests do not cross-contaminate.
    if (!ip && !isProd) {
      await next();
      return;
    }

    const effectiveIp = ip || 'unknown-prod-ip';
    const now = Date.now();
    const memKey = `login:${effectiveIp}`;
    const kvKey = `rate:login_fail:${effectiveIp}`;

    // 1. Check distributed KV failure counter first (fail-closed in production)
    let kvFailures = 0;
    if (c.env?.AUTH_KV) {
      try {
        kvFailures = Number((await c.env.AUTH_KV.get(kvKey)) || 0);
      } catch {
        if (isProd) {
          return c.json(
            { ok: false, error: 'Authentication rate-limit service temporarily unavailable.' },
            503
          );
        }
      }
    }

    const recentMem = (_loginAttempts.get(memKey) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
    if (recentMem.length > 0) {
      _loginAttempts.set(memKey, recentMem);
    } else {
      _loginAttempts.delete(memKey);
    }

    if (kvFailures >= LOGIN_MAX || recentMem.length >= LOGIN_MAX) {
      const oldest = recentMem[0] ?? now;
      return c.json(
        {
          ok: false,
          error: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 5 phút.',
          retry_after: Math.max(1, Math.ceil((oldest + LOGIN_WINDOW_MS - now) / 1000)),
        },
        429
      );
    }

    await next();

    if (c.res?.status === 401) {
      const updated = _loginAttempts.get(memKey) || [];
      updated.push(now);
      _loginAttempts.set(memKey, updated);

      if (c.env?.AUTH_KV) {
        try {
          await c.env.AUTH_KV.put(kvKey, String(kvFailures + 1), {
            expirationTtl: LOGIN_WINDOW_TTL_SEC,
          });
        } catch {
          // Best-effort post-response KV write; isolate memory still enforces cap
        }
      }
    } else if (c.res?.status === 200 && kvFailures > 0 && c.env?.AUTH_KV) {
      _loginAttempts.delete(memKey);
      try {
        await c.env.AUTH_KV.delete(kvKey);
      } catch {
        // Ignore cleanup error on successful login
      }
    }
  };
}
