/**
 * Version Route Tests — /api/version
 *
 * Tests for getVersion which returns deployed commit SHA.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect } from 'vitest';
import type { VersionResponse } from '../worker/src/routes/version';

describe('getVersion', () => {
  async function loadModule() {
    const mod = await import('../worker/src/routes/version');
    return mod;
  }

  test('returns SHA from GIT_COMMIT_SHA', async () => {
    const { getVersion } = await loadModule();
    const result = getVersion({ GIT_COMMIT_SHA: 'abc123def456', ENVIRONMENT: 'production' } as any);
    expect(result.shortSha).toBe('abc123de');
    expect(result.fullSha).toBe('abc123def456');
    expect(result.environment).toBe('production');
  });

  test('returns unknown when no SHA configured', async () => {
    const { getVersion } = await loadModule();
    const result = getVersion({} as any);
    expect(result.shortSha).toBe('unknown');
    expect(result.fullSha).toBe('unknown');
    expect(result.environment).toBe('unknown');
  });

  test('falls back to CF_PAGES_COMMIT_SHA', async () => {
    const { getVersion } = await loadModule();
    const result = getVersion({ CF_PAGES_COMMIT_SHA: 'fedcba987654', ENVIRONMENT: 'staging' } as any);
    expect(result.fullSha).toBe('fedcba987654');
    expect(result.shortSha).toBe('fedcba98');
    expect(result.environment).toBe('staging');
  });

  test('handles empty string SHA as unknown (falsy check)', async () => {
    const { getVersion } = await loadModule();
    const result = getVersion({ GIT_COMMIT_SHA: '', ENVIRONMENT: '' } as any);
    // Empty string is falsy, so it falls through to 'unknown' for both
    expect(result.shortSha).toBe('unknown');
    expect(result.environment).toBe('unknown');
  });

  test('return type matches VersionResponse interface', async () => {
    const { getVersion } = await loadModule();
    const result: VersionResponse = getVersion({ GIT_COMMIT_SHA: 'a1b2c3d4e5f6', ENVIRONMENT: 'dev' } as any);
    expect(result).toHaveProperty('shortSha');
    expect(result).toHaveProperty('fullSha');
    expect(result).toHaveProperty('environment');
  });
});
