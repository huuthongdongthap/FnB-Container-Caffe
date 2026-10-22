/**
 * API versioning — smoke test.
 *
 * Verifies that routes registered on the root app are also reachable
 * under the `/api/v1/...` prefix, and that legacy paths still work.
 */

import { describe, it, expect } from 'vitest';
import { app } from '../../index';

function env() {
  return {
    AURA_DB: { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }) }), run: async () => ({}) }) } as any,
    AUTH_KV: { get: async () => null, put: async () => {}, list: async () => ({ keys: [] }) } as any,
    JWT_SECRET: 'test-jwt-secret-at-least-16-chars',
  } as any;
}

const REQUEST_CTX = { waitUntil: () => {} } as any;

describe('API versioning', () => {
  it('serves /api/version', async() => {
    const res = await app.fetch(new Request('https://test.aura/api/version'), env() as any, { waitUntil: () => {} } as any);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('shortSha');
  });

  it('serves the same route under /api/v1/version', async() => {
    const res = await app.fetch(new Request('https://test.aura/api/v1/version'), env() as any, { waitUntil: () => {} } as any);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('shortSha');
  });

  it('serves /api/health under both prefixes', async() => {
    const legacy = await app.fetch(new Request('https://test.aura/api/health'), env() as any, { waitUntil: () => {} } as any);
    const v1 = await app.fetch(new Request('https://test.aura/api/v1/health'), env() as any, { waitUntil: () => {} } as any);
    expect(legacy.status).toBe(200);
    expect(v1.status).toBe(200);
  });

  it('returns HTTP 503 when readiness probe fails on /api/health?ready=1', async() => {
    const failingEnv = {
      ...env(),
      AURA_DB: {
        prepare: () => ({
          bind: () => ({ first: async () => { throw new Error('DB outage'); } }),
          first: async () => { throw new Error('DB outage'); },
        }),
      },
    };
    const res = await app.fetch(new Request('https://test.aura/api/health?ready=1'), failingEnv as any, { waitUntil: () => {} } as any);
    expect(res.status).toBe(503);
    const body = await res.json() as Record<string, unknown>;
    expect(body.readiness).toBe(false);
  });

  it('returns HTTP 200 when readiness probe succeeds on /api/health?ready=1', async() => {
    const passingEnv = {
      ...env(),
      AURA_DB: {
        prepare: () => ({
          bind: () => ({ first: async () => ({ '1': 1 }) }),
          first: async () => ({ '1': 1 }),
        }),
      },
    };
    const res = await app.fetch(new Request('https://test.aura/api/health?ready=1'), passingEnv as any, REQUEST_CTX);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.readiness).toBe(true);
  });

  // The /api/v1 prefix is a rewrite onto the canonical surface, so guards
  // registered against literal /api/... paths must still run for a v1 request.
  // If the alias ever stops re-entering the root app, a cookie-only write would
  // slip past the KDS auth and the cookie-auth guard both.
  it('still applies the KDS auth guard to a /api/v1 request', async() => {
    const res = await app.fetch(
      new Request('https://test.aura/api/v1/kds/orders', { method: 'POST' }),
      env(),
      REQUEST_CTX
    );
    expect(res.status).toBe(401);
  });

  it('still rejects a cookie-authenticated write on /api/v1', async() => {
    const res = await app.fetch(
      new Request('https://test.aura/api/v1/orders/ORD_1/cancel', {
        method: 'POST',
        headers: { Cookie: 'access_token=not-a-real-token' },
      }),
      env(),
      REQUEST_CTX
    );
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(String(body.error)).toContain('xác thực bằng token');
  });
});