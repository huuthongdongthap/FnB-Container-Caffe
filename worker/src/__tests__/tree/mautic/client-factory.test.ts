/**
 * Unit tests for src/tree/mautic/client-factory.ts
 * Tests: getMauticClient — null on missing env, non-null stub on full env,
 * env values passed through unchanged, re-invocation per call.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.mock — inline factory (no top-level var refs — hoisting safe).
// The mock mirrors createMauticClient behaviour: returns null when any of the
// three required fields is missing, else returns { baseUrl, clientId }.
// ---------------------------------------------------------------------------

vi.mock('../../../lib/mautic-client', () => {
  const fn = vi.fn().mockImplementation((env: unknown) => {
    const e = typeof env === 'object' && env !== null
      ? (env as Record<string, string>)
      : {};
    if (!e.MAUTIC_BASE_URL || !e.MAUTIC_CLIENT_ID || !e.MAUTIC_CLIENT_SECRET) {
      return null;
    }
    return { baseUrl: e.MAUTIC_BASE_URL, clientId: e.MAUTIC_CLIENT_ID } as never;
  });
  return { createMauticClient: fn, MauticClient: class MockMC {} };
});

import { getMauticClient } from '../../../tree/mautic/client-factory.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    MAUTIC_BASE_URL: 'https://m.example.com',
    MAUTIC_CLIENT_ID: 'cid',
    MAUTIC_CLIENT_SECRET: 'csec',
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getMauticClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('returns null when MAUTIC_BASE_URL is missing', () => {
    const client = getMauticClient(makeEnv({ MAUTIC_BASE_URL: undefined }) as never);
    expect(client).toBeNull();
  });

  it('returns null when MAUTIC_CLIENT_ID is missing', () => {
    const client = getMauticClient(makeEnv({ MAUTIC_CLIENT_ID: undefined }) as never);
    expect(client).toBeNull();
  });

  it('returns null when MAUTIC_CLIENT_SECRET is missing', () => {
    const client = getMauticClient(makeEnv({ MAUTIC_CLIENT_SECRET: undefined }) as never);
    expect(client).toBeNull();
  });

  it('returns null when all three fields are empty strings', () => {
    const client = getMauticClient(
      { MAUTIC_BASE_URL: '', MAUTIC_CLIENT_ID: '', MAUTIC_CLIENT_SECRET: '' } as never
    );
    expect(client).toBeNull();
  });

  it('returns a MauticClient stub when all env fields are present', () => {
    const client = getMauticClient(makeEnv() as never);
    expect(client).not.toBeNull();
    expect(client).toHaveProperty('baseUrl');
  });

  it('passes through the exact string values without transformation', () => {
    const env = makeEnv({
      MAUTIC_BASE_URL: 'https://mautic.local',
      MAUTIC_CLIENT_ID: 'my-client',
      MAUTIC_CLIENT_SECRET: 'my-secret'
    });
    const client = getMauticClient(env as never) as { baseUrl: string; clientId: string };
    expect(client.baseUrl).toBe('https://mautic.local');
    expect(client.clientId).toBe('my-client');
  });

  it('each call to getMauticClient re-invokes the factory', () => {
    const a = getMauticClient(
      makeEnv({ MAUTIC_BASE_URL: 'https://a', MAUTIC_CLIENT_ID: 'a', MAUTIC_CLIENT_SECRET: 'a' }) as never
    ) as { baseUrl: string };
    const b = getMauticClient(
      makeEnv({ MAUTIC_BASE_URL: 'https://b', MAUTIC_CLIENT_ID: 'b', MAUTIC_CLIENT_SECRET: 'b' }) as never
    ) as { baseUrl: string };
    expect(a.baseUrl).toBe('https://a');
    expect(b.baseUrl).toBe('https://b');
  });
});
