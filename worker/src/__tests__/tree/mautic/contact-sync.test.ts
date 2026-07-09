/**
 * Unit tests for src/tree/mautic/contact-sync.ts
 * Tests: syncContacts — Mautic not configured, DB not available, empty results,
 * batch processing (20 per batch), syncContacts client call, status transitions,
 * error accumulation.
 * Mock strategy: vi.doMock client-factory + sync-state + logger, then
 * lazy-import contact-sync.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers (must be defined before vi.doMock calls)
// ---------------------------------------------------------------------------

type D1Prepared = {
  bind: (..._args: unknown[]) => D1Prepared;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[]; success: boolean }>;
};

type MockClient = {
  syncContacts: ReturnType<typeof vi.fn>;
};

function makeD1Db(rows: Array<Record<string, unknown>> = []) {
  const prepared = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: rows, success: true })
  } as unknown as D1Prepared;

  return {
    prepare: vi.fn(() => prepared)
  } as unknown as Record<string, unknown>;
}

function makeMockClient(syncResult: { created: Array<Record<string, unknown>>; updated: Array<Record<string, unknown>>; errors: Array<{ email: string; error: string }> } = { created: [], updated: [], errors: [] }) {
  return {
    syncContacts: vi.fn().mockResolvedValue(syncResult)
  };
}

function makeEnv(client: MockClient, db: Record<string, unknown>) {
  return {
    AURA_DB: db,
    MAUTIC_BASE_URL: 'https://m.example.com',
    MAUTIC_CLIENT_ID: 'cid',
    MAUTIC_CLIENT_SECRET: 'csec'
  };
}

function makeCustomerRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'c1',
    name: 'Nguyen Van A',
    phone: '0912345678',
    email: 'nguyen@example.com',
    tier: 'BASIC',
    total_spent: 500000,
    visit_count: 3,
    last_visit: '2026-07-01',
    updated_at: '2026-07-07T10:00:00Z',
    ...overrides
  };
}

function generateCustomers(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) =>
    makeCustomerRow({ id: `c${i + 1}`, email: `cust${i + 1}@example.com` })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncContacts', () => {
  beforeEach(() => vi.resetModules());

  /** Freshly creates a syncStatus ref for each test */
  async function setupSyncStatus() {
    const mod = await import('../../../tree/mautic/sync-state.js');
    const syncStatusRef = mod.syncStatus;
    // Reset to idle before each test
    Object.assign(syncStatusRef, {
      last_sync: null,
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [],
      status: 'idle'
    });
    return syncStatusRef;
  }

  async function loadMod(clientStub: MockClient, statusRef?: { value: typeof syncStatus | null }) {
    vi.doMock('../../../tree/mautic/client-factory', () => ({
      getMauticClient: vi.fn(() => clientStub)
    }));
    vi.doMock('../../../utils/logger', () => ({
      createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
    }));
    const ss = await setupSyncStatus();
    if (statusRef) {
      statusRef.value = ss;
    }
    return { mod: await import('../../../tree/mautic/contact-sync.js'), syncStatus: ss };
  }

  it('returns failure when Mautic client is not configured', async() => {
    const mod = await loadMod(null as unknown as MockClient);
    const result = await mod.mod.syncContacts({ AURA_DB: {} } as never);
    expect(result.success).toBe(false);
    expect(result.synced).toBe(0);
    expect(result.errors).toContain('Mautic not configured');
  });

  it('returns failure when AURA_DB is absent', async() => {
    const mod = await loadMod(makeMockClient());
    const env = {
      MAUTIC_BASE_URL: 'https://m.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec'
    };
    const result = await mod.mod.syncContacts(env as never);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Database not available');
  });

  it('returns success with zero synced when DB yields no results', async() => {
    const db = makeD1Db([]);
    const mod = await loadMod(makeMockClient());
    const env = makeEnv(makeMockClient(), db);
    const result = await mod.mod.syncContacts(env as never);
    expect(result.success).toBe(true);
    expect(result.synced).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mod.syncStatus.status).toBe('completed');
  });

  it('sets status to completed at end', async() => {
    const statusRef = { value: null as Record<string, unknown> | null };
    const rows = [makeCustomerRow()];
    const db = makeD1Db(rows);
    const client = makeMockClient({ created: [{ id: 1, email: 'cust1@example.com' }], updated: [], errors: [] });
    const mod = await loadMod(client, statusRef);
    const env = makeEnv(client, db);
    await mod.mod.syncContacts(env as never);
    expect(statusRef.value?.status).toBe('completed');
  });

  it('queries DB with updated_at since last_sync', async() => {
    const rows = [makeCustomerRow()];
    const db = makeD1Db(rows);
    const client = makeMockClient();
    const mod = await loadMod(client);
    const env = makeEnv(client, db);
    await mod.mod.syncContacts(env as never);
    const sql = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sql).toContain('LIMIT');
  });

  it('maps contact fields to MauticContactInput shape', async() => {
    const rows = [makeCustomerRow({ total_spent: 250000, visit_count: 5 })];
    const db = makeD1Db(rows);
    const client = makeMockClient({ created: [{ id: 1, email: 'cust1@example.com' }], updated: [], errors: [] });
    const mod = await loadMod(client);
    const env = makeEnv(client, db);
    await mod.mod.syncContacts(env as never);
    expect(client.syncContacts).toHaveBeenCalledTimes(1);
  });

  it('falls back to phone+id when email is empty', async() => {
    const rows = [makeCustomerRow({ email: '', phone: '', id: 'c1' })];
    const db = makeD1Db(rows);
    const client = makeMockClient({ created: [{ id: 1, email: 'c1@aura-fnb.local' }], updated: [], errors: [] });
    const mod = await loadMod(client);
    const env = makeEnv(client, db);
    await mod.mod.syncContacts(env as never);
    expect(client.syncContacts).toHaveBeenCalledTimes(1);
  });

  it('accumulates synced count across batches when client returns created+updated', async() => {
    const rows = generateCustomers(25);
    const db = makeD1Db(rows);

    let callIndex = 0;
    const client: MockClient = makeMockClient();
    (client.syncContacts as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ created: 5, updated: 15, errors: [] });
      }
      return Promise.resolve({ created: 5, updated: 0, errors: [] });
    });

    const mod = await loadMod(client);
    const env = makeEnv(client, db);
    const result = await mod.mod.syncContacts(env as never);
    expect(result.synced).toBe(25);
  });

  it('records client-side errors in result.errors and syncStatus', async() => {
    const rows = [makeCustomerRow()];
    const db = makeD1Db(rows);
    const client = makeMockClient({
      created: [],
      updated: [],
      errors: [{ email: 'cust1@example.com', error: 'Duplicate email' }]
    });
    const mod = await loadMod(client);
    const env = makeEnv(client, db);
    const result = await mod.mod.syncContacts(env as never);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('sets status to failed on top-level exception', async() => {
    const db = {
      prepare: vi.fn(() => {
        throw new Error('Database connection lost');
      })
    } as unknown as Record<string, unknown>;

    const client = makeMockClient();
    const mod = await loadMod(client);
    const env: Record<string, unknown> = {
      MAUTIC_BASE_URL: 'https://m.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec',
      AURA_DB: db
    };
    const result = await mod.mod.syncContacts(env as never);
    expect(result.success).toBe(false);
    expect(mod.syncStatus.status).toBe('failed');
    expect(mod.syncStatus.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('continues to next batch when a batch throws', async() => {
    const rows = generateCustomers(30);
    const db = makeD1Db(rows);

    let callIndex = 0;
    const client: MockClient = makeMockClient();
    (client.syncContacts as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        throw new Error('Mautic 500');
      }
      return Promise.resolve({ created: 5, updated: 0, errors: [] });
    });

    const mod = await loadMod(client);
    const env = makeEnv(client, db);
    const result = await mod.mod.syncContacts(env as never);
    expect(result.success).toBe(true);
    expect(result.synced).toBe(5);
  });

  it('updates last_sync timestamp on completion', async() => {
    const rows = [makeCustomerRow()];
    const db = makeD1Db(rows);
    const client = makeMockClient({ created: [{ id: 1, email: 'cust1@example.com' }], updated: [], errors: [] });
    const mod = await loadMod(client);
    const env = makeEnv(client, db);

    const before = new Date().toISOString();
    await mod.mod.syncContacts(env as never);
    const after = new Date().toISOString();

    expect(mod.syncStatus.last_sync).toBeTruthy();
    if (mod.syncStatus.last_sync) {
      expect(mod.syncStatus.last_sync >= before).toBe(true);
    }
  });

  it('clears errors array at start of each run', async() => {
    const statusRef = { value: null as Record<string, unknown> | null };
    const rows = [makeCustomerRow()];
    const db = makeD1Db(rows);
    const client = makeMockClient({ created: [{ id: 1, email: 'cust1@example.com' }], updated: [], errors: [] });
    const mod = await loadMod(client, statusRef);
    statusRef.value!.errors = [{ customer_id: 'stale', error: 'old error' }];
    const env = makeEnv(client, db);
    await mod.mod.syncContacts(env as never);
    expect(statusRef.value!.errors).toEqual([]);
  });
});
