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
});