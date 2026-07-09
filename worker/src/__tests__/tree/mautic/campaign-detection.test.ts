/**
 * Unit tests for src/tree/mautic/campaign-detection.ts
 * Tests: detectWinbackCandidates, detectBirthdayCandidates — DB query,
 * Mautic client calls, enrollment tracking.
 * Mock strategy: vi.doMock for client-factory + enrollment-tracker + logger,
 * then lazy-import campaign-detection (non-hoisted mocks must precede import).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers (must be defined before vi.doMock calls)
// ---------------------------------------------------------------------------

type PreparedStub = {
  bind: (..._args: unknown[]) => PreparedStub;
  all: () => Promise<{ results: Array<Record<string, unknown>>; success: boolean }>;
};

function makePreparedStub<T>(rows: T[]): PreparedStub {
  return {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: rows, success: true })
  };
}

function makeD1Stub(rows: Array<Record<string, unknown>> = []): Record<string, unknown> {
  const q = makePreparedStub(rows);
  return {
    prepare: vi.fn(() => q as never)
  };
}

function makeStubClient(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    createOrUpdateContact: vi.fn().mockResolvedValue(42),
    addContactToCampaign: vi.fn().mockResolvedValue(true),
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

function makeCustomerRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'cust-1',
    name: 'Nguyen Van A',
    phone: '0912345678',
    email: 'ven.van@example.com',
    loyalty_tier: 'silver',
    last_order_date: new Date(Date.now() - 40 * 86400000).toISOString(),
    date_of_birth: '1990-03-15',
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Tests: detectWinbackCandidates
// ---------------------------------------------------------------------------

describe('detectWinbackCandidates', () => {
  beforeEach(() => vi.resetModules());

  async function loadMod(
    clientStub: Record<string, unknown>,
    clientFactoryReturns: Record<string, unknown> | null,
    trackImpl: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined)
  ) {
    vi.doMock('../../../tree/mautic/client-factory', () => ({
      getMauticClient: vi.fn(() => clientFactoryReturns ?? clientStub)
    }));
    vi.doMock('../../../tree/mautic/enrollment-tracker', () => ({
      trackEnrollment: trackImpl
    }));
    vi.doMock('../../../utils/logger', () => ({
      createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
    }));
    return await import('../../../tree/mautic/campaign-detection.js');
  }

  it('returns 0 when MAUTIC_CAMPAIGN_WINBACK env is undefined', async() => {
    const mod = await loadMod(makeStubClient(), null);
    const result = await mod.detectWinbackCandidates({ ...makeEnv(makeStubClient(), makeD1Stub()), MAUTIC_CAMPAIGN_WINBACK: undefined });
    expect(result).toEqual({ detected: 0, enrolled: 0 });
  });

  it('returns 0 when AURA_DB is absent', async() => {
    const mod = await loadMod(makeStubClient(), makeStubClient());
    const result = await mod.detectWinbackCandidates({
      MAUTIC_CAMPAIGN_WINBACK: '10',
      MAUTIC_BASE_URL: 'x',
      MAUTIC_CLIENT_ID: 'x',
      MAUTIC_CLIENT_SECRET: 'x'
    });
    expect(result).toEqual({ detected: 0, enrolled: 0 });
  });

  it('returns 0 when client factory yields null', async() => {
    const mod = await loadMod(makeStubClient(), null);
    const env = makeEnv(makeStubClient(), makeD1Stub(), { MAUTIC_CAMPAIGN_WINBACK: '10' });
    const result = await mod.detectWinbackCandidates(env);
    expect(result).toEqual({ detected: 0, enrolled: 0 });
  });

  it('detects and enrolls winback candidates', async() => {
    const client = makeStubClient();
    const rows = [
      makeCustomerRow({ id: 'c1', last_order_date: '2026-06-01' }),
      makeCustomerRow({ id: 'c2', last_order_date: '2026-05-01' })
    ];
    const db = makeD1Stub(rows);
    const mod = await loadMod(client, client);
    const env = makeEnv(client, db, { MAUTIC_CAMPAIGN_WINBACK: '10' });
    const result = await mod.detectWinbackCandidates(env);
    expect(result.detected).toBe(2);
    expect(result.enrolled).toBe(2);
    expect(client.createOrUpdateContact).toHaveBeenCalledTimes(2);
    expect(client.addContactToCampaign).toHaveBeenCalledTimes(2);
  });

  it('skips enrollment on Mautic error (catch block)', async() => {
    const errClient: Record<string, unknown> = {
      createOrUpdateContact: vi.fn()
        .mockResolvedValueOnce(101)
        .mockRejectedValueOnce(new Error('Mautic 500')),
      addContactToCampaign: vi.fn().mockResolvedValue(true)
    };
    const rows = [makeCustomerRow({ id: 'c1' }), makeCustomerRow({ id: 'c2' })];
    const db = makeD1Stub(rows);
    const mod = await loadMod(errClient, errClient);
    const env = makeEnv(errClient, db, { MAUTIC_CAMPAIGN_WINBACK: '10' });
    const result = await mod.detectWinbackCandidates(env);
    expect(result.detected).toBe(2);
    expect(result.enrolled).toBe(1);
  });

});

// ---------------------------------------------------------------------------
// Tests: detectBirthdayCandidates
// ---------------------------------------------------------------------------

describe('detectBirthdayCandidates', () => {
  beforeEach(() => vi.resetModules());

  async function loadMod(clientStub: Record<string, unknown>, trackImpl?: ReturnType<typeof vi.fn>) {
    const trackPromise = trackImpl ?? vi.fn().mockResolvedValue(undefined);
    vi.doMock('../../../tree/mautic/client-factory', () => ({
      getMauticClient: vi.fn(() => clientStub)
    }));
    vi.doMock('../../../tree/mautic/enrollment-tracker', () => ({
      trackEnrollment: trackPromise
    }));
    vi.doMock('../../../utils/logger', () => ({
      createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
    }));
    return await import('../../../tree/mautic/campaign-detection.js');
  }

  it('returns 0 when MAUTIC_CAMPAIGN_BIRTHDAY env is undefined', async() => {
    const mod = await loadMod(makeStubClient());
    const result = await mod.detectBirthdayCandidates({ ...makeEnv(makeStubClient(), makeD1Stub()), MAUTIC_CAMPAIGN_BIRTHDAY: undefined });
    expect(result).toEqual({ detected: 0, enrolled: 0 });
  });

  it('returns 0 when AURA_DB is absent', async() => {
    const mod = await loadMod(makeStubClient());
    const result = await mod.detectBirthdayCandidates({
      MAUTIC_CAMPAIGN_BIRTHDAY: '20',
      MAUTIC_BASE_URL: 'x',
      MAUTIC_CLIENT_ID: 'x',
      MAUTIC_CLIENT_SECRET: 'x'
    });
    expect(result).toEqual({ detected: 0, enrolled: 0 });
  });

  it('detects and enrolls birthday customers in current month', async() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const client = makeStubClient();
    const rows = [
      makeCustomerRow({ id: 'c1', date_of_birth: `1990-${mm}-10` }),
      makeCustomerRow({ id: 'c2', date_of_birth: `1985-${mm}-25` })
    ];
    const db = makeD1Stub(rows);
    const mod = await loadMod(client);
    const env = makeEnv(client, db, { MAUTIC_CAMPAIGN_BIRTHDAY: '20' });
    const result = await mod.detectBirthdayCandidates(env);
    expect(result.detected).toBe(2);
    expect(result.enrolled).toBe(2);
    expect(client.addContactToCampaign).toHaveBeenCalledTimes(2);
  });

  it('does not error when DB returns no birthday matches (empty result set)', async() => {
    const client = makeStubClient();
    const db = makeD1Stub([]); // no birthday matches
    const mod = await loadMod(client);
    const env = makeEnv(client, db, { MAUTIC_CAMPAIGN_BIRTHDAY: '20' });
    const result = await mod.detectBirthdayCandidates(env);
    expect(result).toEqual({ detected: 0, enrolled: 0 });
  });

  it('skips enrollment silently when addContactToCampaign throws', async() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const failClient: Record<string, unknown> = {
      createOrUpdateContact: vi.fn().mockResolvedValue(1),
      addContactToCampaign: vi.fn().mockRejectedValue(new Error('network error'))
    };
    const rows = [makeCustomerRow({ id: 'c1', date_of_birth: `1990-${mm}-10` })];
    const db = makeD1Stub(rows);
    const mod = await loadMod(failClient);
    const env = makeEnv(failClient, db, { MAUTIC_CAMPAIGN_BIRTHDAY: '20' });
    const result = await mod.detectBirthdayCandidates(env);
    expect(result.detected).toBe(1);
    expect(result.enrolled).toBe(0);
  });

});
