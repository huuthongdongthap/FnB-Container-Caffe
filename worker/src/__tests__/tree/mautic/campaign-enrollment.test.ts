/**
 * Unit tests for src/tree/mautic/campaign-enrollment.ts
 * Tests: enrollCampaigns — null client, no DB, MASTER enrollment, phone
 * fallback, error accumulation, new-customer welcome-series, top-level failure.
 *
 * Mock strategy: vi.doMock in beforeEach (non-hoisted).  Both `client-factory`
 * and `campaign-enrollment` are lazy-imported AFTER their mocks are set up,
 * so the mock factory is picked up during module evaluation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers (must be defined before vi.doMock calls)
// ---------------------------------------------------------------------------

type PreparedStub = {
  bind: (..._args: unknown[]) => PreparedStub;
  all: <T>() => Promise<{ results: T[]; success: boolean }>;
};

function makePreparedStub<T>(rows: T[]): PreparedStub {
  return {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: rows, success: true })
  };
}

function makeD1Stub(
  masterRows: Array<Record<string, unknown>>,
  newRows: Array<Record<string, unknown>> = []
): Record<string, unknown> {
  const masterQ = makePreparedStub(masterRows);
  const newQ = makePreparedStub(newRows);
  return {
    prepare: vi.fn((_sql: string) => {
      if (_sql.includes('tier = \'MASTER\'')) {
        return masterQ as never;
      }
      return newQ as never;
    })
  };
}

function makeStubClient(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    addToCampaign: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function makeEnv(
  client: Record<string, unknown>,
  db: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    AURA_DB: db,
    MAUTIC_BASE_URL: 'https://m.example.com',
    MAUTIC_CLIENT_ID: 'cid',
    MAUTIC_CLIENT_SECRET: 'csec',
    ...overrides
  };
}

function makeCustomerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'c1',
    name: 'Nguyen Van A',
    phone: '0912345678',
    email: 'nguyen@example.com',
    loyalty_tier: 'MASTER',
    created_at: '2026-07-01T10:00:00Z',
    birthday: '1990-03-15',
    last_order_date: '2026-06-01',
    total_orders: 42,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Tests — each test does its own vi.doMock + eager lazy-import
// ---------------------------------------------------------------------------

describe('enrollCampaigns', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function loadEnroll(clientStub: Record<string, unknown>, logStub = true) {
    vi.doMock('../../../tree/mautic/client-factory', () => ({
      getMauticClient: vi.fn(() => clientStub)
    }));
    if (logStub) {
      vi.doMock('../../../utils/logger', () => ({
        createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
      }));
    }
    return await import('../../../tree/mautic/campaign-enrollment.js');
  }

  it('returns error when Mautic client creation returns null', async() => {
    const mod = await loadEnroll(null as unknown as Record<string, unknown>);
    const env = {
      AURA_DB: makeD1Stub([]),
      MAUTIC_BASE_URL: 'https://m.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec'
    } as never;
    const result = await mod.enrollCampaigns(env);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Mautic not configured');
  });

  it('returns error when AURA_DB is absent', async() => {
    const mod = await loadEnroll(makeStubClient());
    const env: Record<string, unknown> = {
      MAUTIC_BASE_URL: 'https://m.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec'
    };
    const result = await mod.enrollCampaigns(env as never);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Database not available');
  });

  it('enrolls all MASTER tier customers in vip-master campaign', async() => {
    const db = makeD1Stub([
      makeCustomerRow({ id: 'c1', email: 'master@example.com' }),
      makeCustomerRow({ id: 'c2', email: 'master2@example.com' })
    ]);
    const client = makeStubClient();
    const mod = await loadEnroll(client);
    const env = makeEnv(client, db);
    const result = await mod.enrollCampaigns(env as never);
    expect(result.success).toBe(true);
    expect(result.enrolled).toBeGreaterThanOrEqual(2);
  });

  it('uses phone fallback when email is empty for MASTER customers', async() => {
    const db = makeD1Stub([
      makeCustomerRow({ id: 'c3', email: '', phone: '0912345678' })
    ]);
    const client = makeStubClient();
    const mod = await loadEnroll(client);
    const env = makeEnv(client, db);
    await mod.enrollCampaigns(env as never);
    expect(client.addToCampaign).toHaveBeenCalledWith('0912345678', 'vip-master');
  });

  it('collects errors without aborting the whole batch', async() => {
    const db = makeD1Stub([
      makeCustomerRow({ id: 'c1', email: 'ok@example.com' }),
      makeCustomerRow({ id: 'c2', email: 'fail@example.com' })
    ]);
    const client = {
      addToCampaign: vi.fn()
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Mautic 500'))
    };
    const mod = await loadEnroll(client);
    const env = makeEnv(client, db);
    const result = await mod.enrollCampaigns(env as never);
    expect(result.success).toBe(true);
    expect(result.enrolled).toBe(1);
  });

  it('enrolls new customers in welcome-series', async() => {
    const db = makeD1Stub(
      [],
      [makeCustomerRow({ id: 'c4', email: 'new@example.com' })]
    );
    const client = makeStubClient();
    const mod = await loadEnroll(client);
    const env = makeEnv(client, db);
    const result = await mod.enrollCampaigns(env as never);
    expect(result.success).toBe(true);
    expect(result.enrolled).toBeGreaterThanOrEqual(1);
    expect(client.addToCampaign).toHaveBeenCalledWith('new@example.com', 'welcome-series');
  });

  it('returns failure on top-level exception', async() => {
    const failingDb = {
      prepare: vi.fn(() => {
        throw new Error('DB connection failed');
      })
    } as unknown as Record<string, unknown>;
    const mod = await loadEnroll(makeStubClient());
    const env = makeEnv(makeStubClient(), failingDb);
    const result = await mod.enrollCampaigns(env as never);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });
});
