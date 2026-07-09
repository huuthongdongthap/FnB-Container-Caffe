import { describe, it, expect } from 'vitest';
import { generateId, parseJSON, findExistingOwner } from '../../../tree/auth/helpers.js';
import { createMockEnv, createMockKV } from '../../test-utils';

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------
describe('generateId', () => {
  it('returns a string containing the default prefix "ID_"', () => {
    const result = generateId();
    expect(typeof result).toBe('string');
    expect(result.startsWith('ID_')).toBe(true);
  });

  it('returns a string longer than the prefix length', () => {
    const result = generateId();
    expect(result.length).toBeGreaterThan('ID_'.length);
  });

  it('accepts a custom prefix', () => {
    const result = generateId('usr_');
    expect(result.startsWith('usr_')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseJSON
// ---------------------------------------------------------------------------
describe('parseJSON', () => {
  it('parses a valid JSON body', async() => {
    const body = { email: 'test@example.com', name: 'Tester' };
    const req = new Request('https://test.aura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await parseJSON(req);
    expect(result).toEqual(body);
  });

  it('throws "Invalid JSON body" on malformed JSON', async() => {
    const req = new Request('https://test.aura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json'
    });
    await expect(parseJSON(req)).rejects.toThrow('Invalid JSON body');
  });
});

// ---------------------------------------------------------------------------
// findExistingOwner
// ---------------------------------------------------------------------------
describe('findExistingOwner', () => {
  it('returns owner user when present in KV', async() => {
    const kv = createMockKV({
      'user:1': JSON.stringify({ email: 'owner@example.com', name: 'Owner Name', role: 'owner', created_at: '2026-01-01T00:00:00Z' })
    });

    // Determine a cursor beyond the first list call so pagination kicks in.
    // The mock list() returns all filtered keys (limit 1000), then a non-complete
    // result on the second call when paginationCursor reaches 1.
    const listMethod = (kv as Record<string, unknown>).list as (opts?: { prefix?: string; limit?: number; cursor?: string }) => Promise<{ keys: { name: string }[]; list_complete: boolean; cursor: string }>;
    const firstResult = await listMethod({ prefix: 'user:', limit: 1000 });
    if (firstResult.list_complete) {
      // Only one key; manually trigger one empty page to test pagination logic.
      (kv as unknown as { paginationCursor: number }).paginationCursor = 1;
    }

    const env = createMockEnv({ AUTH_KV: kv });
    const result = await findExistingOwner(env as { AUTH_KV: typeof kv });

    expect(result).not.toBeNull();
    expect(result).toEqual({
      email: 'owner@example.com',
      name: 'Owner Name',
      created_at: '2026-01-01T00:00:00Z'
    });
  });

  it('returns null when no owner exists in KV', async() => {
    // Only users, none with role 'owner'
    const kv = createMockKV({
      'user:1': JSON.stringify({ email: 'staff@example.com', role: 'staff' }),
      'user:2': JSON.stringify({ email: 'admin@example.com', role: 'admin' })
    });

    const env = createMockEnv({ AUTH_KV: kv });
    const result = await findExistingOwner(env as { AUTH_KV: typeof kv });

    expect(result).toBeNull();
  });

  it('returns null when KV is empty', async() => {
    const kv = createMockKV();
    const env = createMockEnv({ AUTH_KV: kv });
    const result = await findExistingOwner(env as { AUTH_KV: typeof kv });
    expect(result).toBeNull();
  });

  it('handles malformed JSON entries gracefully and continues scanning', async() => {
    // One valid non-owner entry and one malformed entry after it.
    // The function must skip the bad entry and not throw.
    const kv = createMockKV({
      'user:1': JSON.stringify({ email: 'staff@example.com', role: 'staff' }),
      'user:2': 'not-valid-json',
      'user:3': JSON.stringify({ email: 'owner@example.com', role: 'owner' })
    });

    const env = createMockEnv({ AUTH_KV: kv });
    const result = await findExistingOwner(env as { AUTH_KV: typeof kv });

    // Should still find the owner despite the malformed entry
    expect(result).not.toBeNull();
    expect(result!.email).toBe('owner@example.com');
  });

  it('skips entries missing the role field', async() => {
    const kv = createMockKV({
      'user:1': JSON.stringify({ email: 'incomplete@example.com' })
    });

    const env = createMockEnv({ AUTH_KV: kv });
    const result = await findExistingOwner(env as { AUTH_KV: typeof kv });

    expect(result).toBeNull();
  });

  it('defaults created_at to null when missing', async() => {
    const kv = createMockKV({
      'user:1': JSON.stringify({ email: 'owner@example.com', name: 'Owner', role: 'owner' })
    });

    const env = createMockEnv({ AUTH_KV: kv });
    const result = await findExistingOwner(env as { AUTH_KV: typeof kv });

    expect(result).not.toBeNull();
    expect(result!.email).toBe('owner@example.com');
    expect(result!.name).toBe('Owner');
    expect(result!.created_at).toBeNull();
  });
});
