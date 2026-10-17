/**
 * Unit tests for health route (getHealth)
 */

import { describe, it, expect, vi } from 'vitest';
import { getHealth, type HealthResponse } from '../../routes/health';
import { createMockEnv, createStubDB } from '../test-utils';

describe('getHealth', () => {
  it('returns status ok with timestamp and uptime', async() => {
    const env = { ...createMockEnv() } as unknown as Parameters<typeof getHealth>[0];
    const result = await getHealth(env);

    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(typeof result.timestamp).toBe('string');
    expect(result.uptime).toBeDefined();
    expect(typeof result.uptime).toBe('number');
  });

  it('uptime is a positive number', async() => {
    const env = { ...createMockEnv() } as unknown as Parameters<typeof getHealth>[0];
    const result = await getHealth(env);

    expect(result.uptime).toBeGreaterThan(0);
  });

  it('returns d1: connected when checkDb=true and D1 is healthy', async() => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ '1': 1 })
      }),
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn()
    };
    const env = { ...createMockEnv(), AURA_DB: mockDb } as unknown as Parameters<typeof getHealth>[0];

    const result = await getHealth(env, true);

    expect(result.status).toBe('ok');
    expect(result.d1).toBe('connected');
    expect(mockDb.prepare).toHaveBeenCalledWith('SELECT 1');
    expect(result.error).toBeUndefined();
  });

  it('returns d1: error and status degraded when D1 throws', async() => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockRejectedValue(new Error('DB connection failed'))
      }),
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn()
    };
    const env = { ...createMockEnv(), AURA_DB: mockDb } as unknown as Parameters<typeof getHealth>[0];

    const result = await getHealth(env, true);

    expect(result.status).toBe('degraded');
    expect(result.d1).toBe('error');
    expect(result.error).toBe('DB connection failed');
  });

  it('does not call D1 when checkDb is false (default)', async() => {
    const mockDb = {
      prepare: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn()
    };
    const env = { ...createMockEnv(), AURA_DB: mockDb } as unknown as Parameters<typeof getHealth>[0];

    const result = await getHealth(env);

    expect(result.status).toBe('ok');
    expect(result.d1).toBeUndefined();
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('returns valid ISO timestamp', async() => {
    const env = { ...createMockEnv() } as unknown as Parameters<typeof getHealth>[0];
    const result = await getHealth(env);

    const parsed = new Date(result.timestamp);
    expect(parsed.toISOString()).toBe(result.timestamp);
  });

  it('marks readiness false when D1 fails deep check', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockRejectedValue(new Error('D1 unreachable'))
      }),
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn()
    };
    const env = { ...createMockEnv(), AURA_DB: mockDb } as unknown as Parameters<typeof getHealth>[0];

    const result = await getHealth(env, true);
    expect(result.readiness).toBe(false);
    expect(result.status).toBe('degraded');
  });

  it('sanitizes error message in production environment to prevent internal leakage', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockRejectedValue(new Error('D1 internal fatal syntax or connection error at line 42'))
      }),
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn()
    };
    const env = { ...createMockEnv(), AURA_DB: mockDb, ENVIRONMENT: 'production' } as unknown as Parameters<typeof getHealth>[0];

    const result = await getHealth(env, true);
    expect(result.status).toBe('degraded');
    expect(result.d1).toBe('error');
    expect(result.error).toBe('Database connectivity probe failed');
    expect(result.dependencies?.d1_database.error).toBe('d1_database connectivity probe failed');
  });
});
