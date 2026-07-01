/**
 * Unit tests for rate limit middleware.
 */

import { describe, it, expect, vi } from 'vitest';
import { rateLimitMiddleware, throttleByKey, AUTH_RATE_LIMIT, ORDER_RATE_LIMIT } from '../../middleware/rate-limit';
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
  it('allows request under limit', async () => {
    const kv = createMockKV();
    const allowed = await throttleByKey(kv, 'test-key', 5, 60);
    expect(allowed).toBe(true);
  });

  it('blocks request over limit', async () => {
    const kv = createMockKV();
    for (let i = 0; i < 5; i++) {
      await throttleByKey(kv, 'block-key', 5, 60);
    }
    const allowed = await throttleByKey(kv, 'block-key', 5, 60);
    expect(allowed).toBe(false);
  });

});

describe('rateLimitMiddleware', () => {
  it('passes request under limit', async () => {
    const kv = createMockKV();
    const c = {
      env: { AUTH_KV: kv },
      req: { header: () => '127.0.0.1' },
      json: vi.fn().mockReturnValue(new Response('')),
    } as any;
    const next = vi.fn();
    const middleware = rateLimitMiddleware({ max: 10, windowSec: 60, keyPrefix: 'test', errorMessage: 'Too many' });
    await middleware(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks request over limit', async () => {
    const kv = createMockKV();
    const c = {
      env: { AUTH_KV: kv },
      req: { raw: new Request('https://test.com'), header: () => '1.2.3.4' },
      json: vi.fn().mockReturnValue(new Response('')),
    } as any;
    const next = vi.fn();

    for (let i = 0; i < 10; i++) {
      await rateLimitMiddleware({ max: 10, windowSec: 60, keyPrefix: 'test', errorMessage: 'Too many' })({ ...c, req: { ...c.req } } as any, vi.fn());
    }
    await rateLimitMiddleware({ max: 10, windowSec: 60, keyPrefix: 'test', errorMessage: 'Too many' })(c, next);

    expect(c.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
