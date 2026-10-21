/**
 * Unit tests for rate limit middleware.
 */

import { describe, it, expect, vi } from 'vitest';
import { rateLimitMiddleware, throttleByKey, AUTH_RATE_LIMIT, ORDER_RATE_LIMIT, POS_CHECKOUT_RATE_LIMIT } from '../../middleware/rate-limit';
import { createMockKV } from '../test-utils';

describe('AUTH_RATE_LIMIT', () => {
  it('has correct window and max', () => {
    expect(AUTH_RATE_LIMIT.windowSec).toBe(300);
    expect(AUTH_RATE_LIMIT.max).toBe(20);
  });
});

describe('ORDER_RATE_LIMIT', () => {
  it('has correct window and max', () => {
    expect(ORDER_RATE_LIMIT.windowSec).toBe(600);
    expect(ORDER_RATE_LIMIT.max).toBe(5);
  });
});

describe('throttleByKey', () => {
  it('allows request under limit', async() => {
    const kv = createMockKV();
    const allowed = await throttleByKey(kv, 'test-key', 5, 60);
    expect(allowed).toBe(true);
  });

  it('blocks request over limit', async() => {
    const kv = createMockKV();
    for (let i = 0; i < 5; i++) {
      await throttleByKey(kv, 'block-key', 5, 60);
    }
    const allowed = await throttleByKey(kv, 'block-key', 5, 60);
    expect(allowed).toBe(false);
  });

});

describe('rateLimitMiddleware', () => {
  it('passes request under limit', async() => {
    const kv = createMockKV();
    const c = {
      env: { AUTH_KV: kv },
      req: { header: () => '127.0.0.1' },
      json: vi.fn().mockReturnValue(new Response(''))
    } as any;
    const next = vi.fn();
    const middleware = rateLimitMiddleware({ max: 10, windowSec: 60, keyPrefix: 'test', errorMessage: 'Too many' });
    await middleware(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks request over limit', async() => {
    const kv = createMockKV();
    const c = {
      env: { AUTH_KV: kv },
      req: { raw: new Request('https://test.com'), header: () => '1.2.3.4' },
      json: vi.fn().mockReturnValue(new Response(''))
    } as any;
    const next = vi.fn();

    for (let i = 0; i < 10; i++) {
      await rateLimitMiddleware({ max: 10, windowSec: 60, keyPrefix: 'test', errorMessage: 'Too many' })({ ...c, req: { ...c.req } } as any, vi.fn());
    }
    await rateLimitMiddleware({ max: 10, windowSec: 60, keyPrefix: 'test', errorMessage: 'Too many' })(c, next);

    expect(c.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects spoofed localhost Origin and x-playwright-test bypass headers in production', async() => {
    const kv = createMockKV();
    const headers: Record<string, string> = {
      origin: 'http://localhost:5173',
      'x-playwright-test': 'true',
      'cf-connecting-ip': '203.0.113.50'
    };
    const c = {
      env: { AUTH_KV: kv, ENVIRONMENT: 'production' },
      req: {
        raw: new Request('https://auraspace.cafe/api/recruitment/apply'),
        header: (name: string) => headers[name.toLowerCase()]
      },
      json: vi.fn().mockReturnValue(new Response('', { status: 429 }))
    } as any;
    const next = vi.fn();
    const config = { max: 2, windowSec: 60, keyPrefix: 'prod-test', errorMessage: 'Rate limited' };

    await rateLimitMiddleware(config)(c, vi.fn());
    await rateLimitMiddleware(config)(c, vi.fn());
    await rateLimitMiddleware(config)(c, next);

    expect(c.json).toHaveBeenCalledWith({ ok: false, error: 'Rate limited' }, 429);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets X-RateLimit and Retry-After headers on the blocked response', async () => {
    const blockedResponse = new Response('', { status: 429 });
    const c = {
      env: { AUTH_KV: createMockKV(), ENVIRONMENT: 'production' },
      req: {
        raw: new Request('https://auraspace.cafe/api/recruitment/apply'),
        header: () => '203.0.113.90'
      },
      json: vi.fn().mockReturnValue(blockedResponse)
    } as any;
    const config = { max: 1, windowSec: 120, keyPrefix: 'hdr-test', errorMessage: 'Rate limited' };

    await rateLimitMiddleware(config)(c, vi.fn());
    const response = await rateLimitMiddleware(config)(c, vi.fn());

    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toMatch(/^\d+$/);
    expect(response.headers.get('Retry-After')).toBe('120');
  });
});

describe('rate limit key scoping', () => {
  const config = { max: 2, windowSec: 60, keyPrefix: 'scope-test', errorMessage: 'Rate limited' };

  // One KV store stands in for the single shared AUTH_KV binding every request sees.
  const kv = createMockKV();

  function makeContext(opts: { ip: string; user?: { id: string }; tenantId?: string }) {
    return {
      env: { AUTH_KV: kv, ENVIRONMENT: 'production' },
      req: {
        raw: new Request('https://auraspace.cafe/api/recruitment/apply'),
        header: () => opts.ip
      },
      get: (key: string) => (key === 'user' ? opts.user : opts.tenantId),
      json: vi.fn().mockReturnValue(new Response('', { status: 429 }))
    } as any;
  }

  /** Sends three requests and returns how many the limit let through. */
  async function exhaust(context: Record<string, unknown>) {
    const next = vi.fn();
    for (let i = 0; i < 3; i++) {
      await rateLimitMiddleware(config)(context as any, next);
    }
    return next.mock.calls.length;
  }

  it('scopes the budget per authenticated user, so one shared NAT does not lock out colleagues', async () => {
    const ip = '198.51.100.7';
    const first = await exhaust(makeContext({ ip, user: { id: 'user-a' } }));
    const second = await exhaust(makeContext({ ip, user: { id: 'user-b' } }));

    // Each user burns their own budget of 2 and is cut off by the third request.
    expect(first).toBe(2);
    expect(second).toBe(2);
  });

  it('scopes guest budgets per tenant', async () => {
    const ip = '198.51.100.8';
    const first = await exhaust(makeContext({ ip, tenantId: 'tenant-a' }));
    const second = await exhaust(makeContext({ ip, tenantId: 'tenant-b' }));

    expect(first).toBe(2);
    expect(second).toBe(2);
  });

  it('shares one budget across anonymous callers from the same IP', async () => {
    const ip = '198.51.100.9';
    const first = await exhaust(makeContext({ ip }));
    const second = await exhaust(makeContext({ ip }));

    // The first anonymous caller spends the only budget the IP has.
    expect(first).toBe(2);
    // The second one never gets in — this is the NAT lockout the key hierarchy
    // exists to prevent for callers that do have an identity.
    expect(second).toBe(0);
  });

  it('keeps the default tenant separate from an explicit tenant', async () => {
    const ip = '198.51.100.10';
    const fallback = await exhaust(makeContext({ ip, tenantId: 'default' }));
    const explicit = await exhaust(makeContext({ ip, tenantId: 'tenant-c' }));

    // 'default' is not a real tenant, so it shares the IP bucket; 'tenant-c' gets its own.
    expect(fallback).toBe(2);
    expect(explicit).toBe(2);
  });
});

describe('POS_CHECKOUT_RATE_LIMIT', () => {
  it('allows more throughput than the customer order limit', () => {
    expect(POS_CHECKOUT_RATE_LIMIT.max).toBeGreaterThan(ORDER_RATE_LIMIT.max);
  });

  it('resets on a short window so a stuck till recovers quickly', () => {
    expect(POS_CHECKOUT_RATE_LIMIT.windowSec).toBeLessThanOrEqual(ORDER_RATE_LIMIT.windowSec);
  });

  it('uses a key prefix distinct from customer orders', () => {
    expect(POS_CHECKOUT_RATE_LIMIT.keyPrefix).not.toBe(ORDER_RATE_LIMIT.keyPrefix);
  });
});
