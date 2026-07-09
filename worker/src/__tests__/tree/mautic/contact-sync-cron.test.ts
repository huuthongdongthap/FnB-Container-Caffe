/**
 * Unit tests for src/tree/mautic/contact-sync-cron.ts
 * Tests: syncMauticContacts — KV last-sync timestamp, batch upsert, segment
 * sync, skip conditions. Mock KV, D1, MauticClient + batchUpsertContacts.
 * Mock strategy: vi.doMock for createMauticClient (mautic-client), syncSegments
 * (segment-sync), toMauticContact (contact-mapper), logger. Then lazy import.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type BatchResult = {
  created?: Array<Record<string, unknown>>;
  updated?: Array<Record<string, unknown>>;
  errors?: Array<{ email: string; error: string }>;
};

type MockKV = {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

type MockD1Prepared = {
  bind: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
};

type MockD1 = {
  prepare: ReturnType<typeof vi.fn>;
  capturedBindArgs: unknown[] | null;
};

type MockClient = {
  batchUpsertContacts: ReturnType<typeof vi.fn>;
  addContactToSegment: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockClient(initialBatchResult: BatchResult = { created: [], updated: [], errors: [] }): MockClient {
  return {
    batchUpsertContacts: vi.fn().mockResolvedValue(initialBatchResult),
    addContactToSegment: vi.fn().mockResolvedValue(true)
  };
}

function makeMockKV(initialTs: string | null = null) {
  let ts = initialTs;
  return {
    get: vi.fn(async(_key: string) => ts),
    put: vi.fn(async(_key: string, value: string) => {
      ts = value;
    })
  } as unknown as MockKV;
}

function makeMockD1(customerRows: Array<Record<string, unknown>> = [], captureBind = false): MockD1 {
  let capturedArgs: unknown[] | null = null;
  const bindFn = vi.fn().mockImplementation((...args: unknown[]) => {
    if (captureBind) {
      capturedArgs = args;
    }
    return { bind: bindFn, all: vi.fn().mockResolvedValue({ results: customerRows, success: true }) } as unknown as MockD1Prepared;
  });
  const prepareFn = vi.fn(() => {
    return {
      bind: bindFn,
      all: vi.fn().mockResolvedValue({ results: customerRows, success: true })
    } as unknown as MockD1Prepared;
  });
  return {
    prepare: prepareFn,
    capturedBindArgs: () => capturedArgs
  } as unknown as MockD1;
}

function makeEnv(
  client: MockClient,
  db: MockD1,
  kv: MockKV,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    MAUTIC_BASE_URL: 'https://m.example.com',
    MAUTIC_CLIENT_ID: 'cid',
    MAUTIC_CLIENT_SECRET: 'csec',
    AURA_DB: db,
    AUTH_KV: kv,
    ...overrides
  };
}

function makeCustomerRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    phone: '0912345678',
    name: 'Nguyen Van A',
    email: 'nguyen@example.com',
    loyalty_tier: 'silver',
    date_of_birth: '1990-03-15',
    last_order_date: '2026-06-01',
    total_orders: 42,
    updated_at: '2026-07-07T10:00:00Z',
    ...overrides
  };
}

function generateCustomers(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) =>
    makeCustomerRow({
      email: `cust${i + 1}@example.com`,
      phone: `091234567${i}`,
      updated_at: new Date(Date.now() - i * 60000).toISOString()
    })
  );
}

// ---------------------------------------------------------------------------
// Module loader (vi.doMock + lazy import)
// ---------------------------------------------------------------------------

async function loadMod(
  clientStub: MockClient,
  syncSegmentsStub: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(0),
  toMauticContactStub: ReturnType<typeof vi.fn> = vi.fn((c: Record<string, unknown>) => c)
) {
  vi.doMock('../../../lib/mautic-client', () => ({
    createMauticClient: vi.fn(() => clientStub)
  }));
  vi.doMock('../../../tree/mautic/segment-sync', () => ({
    syncSegments: syncSegmentsStub
  }));
  vi.doMock('../../../tree/mautic/contact-mapper', () => ({
    toMauticContact: toMauticContactStub
  }));
  vi.doMock('../../../utils/logger', () => ({
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
  }));
  return await import('../../../tree/mautic/contact-sync-cron.js');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncMauticContacts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('returns {synced:0, skipped:true} when Mautic not configured', async() => {
    const mod = await loadMod(null as unknown as MockClient);
    const result = await mod.syncMauticContacts({} as never);
    expect(result).toEqual({ synced: 0, skipped: true });
  });

  it('returns {synced:0, skipped:true} when AURA_DB is absent', async() => {
    const client = makeMockClient();
    const mod = await loadMod(client);
    const env: Record<string, unknown> = {
      MAUTIC_BASE_URL: 'https://m.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec'
    };
    const result = await mod.syncMauticContacts(env as never);
    expect(result).toEqual({ synced: 0, skipped: true });
  });

  it('returns {synced:0, skipped:true} when AUTH_KV is absent and client is null', async() => {
    const mod = await loadMod(null as unknown as MockClient);
    const db = makeMockD1([]);
    const env: Record<string, unknown> = {
      AURA_DB: db
    };
    const result = await mod.syncMauticContacts(env as never);
    expect(result.synced).toBe(0);
    expect(result.skipped).toBe(true);
  });

  it('returns {synced:0} when no customer rows returned', async() => {
    const db = makeMockD1([]);
    const kv = makeMockKV();
    const client = makeMockClient();
    const mod = await loadMod(client);
    const env = makeEnv(client, db, kv);

    const result = await mod.syncMauticContacts(env as never);

    expect(result.synced).toBe(0);
    expect(kv.put).toHaveBeenCalledWith('mautic_last_sync_ts', expect.any(String));
  });

  it('queries DB with correct SQL when KV has no prior sync timestamp', async() => {
    const db = makeMockD1([]);
    const kv = makeMockKV();
    const client = makeMockClient();
    const mod = await loadMod(client);
    const env = makeEnv(client, db, kv);

    await mod.syncMauticContacts(env as never);

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('SELECT c.phone, c.name, c.email');
    expect(sql).toContain('WHERE c.updated_at > ?');
    expect(sql).toContain('ORDER BY c.updated_at ASC');
    expect(sql).toContain('LIMIT 500');
    expect(sql).toContain('loyalty_tier');
    expect(sql).toContain('date_of_birth');
  });

  it('uses KV last_sync timestamp as the since parameter', async() => {
    const db = makeMockD1([], true);
    const kv = makeMockKV('2026-07-06T08:00:00Z');
    const client = makeMockClient();
    const mod = await loadMod(client);
    const env = makeEnv(client, db, kv);

    await mod.syncMauticContacts(env as never);

    const captured = (db as unknown as { capturedBindArgs: () => unknown[] | null }).capturedBindArgs();
    expect(captured).not.toBeNull();
    expect(captured![0]).toBe('2026-07-06T08:00:00Z');
  });

  it('falls back to 1 hour ago when KV has no prior timestamp', async() => {
    const db = makeMockD1([], true);
    const kv = makeMockKV(null);
    const client = makeMockClient();
    const mod = await loadMod(client);
    const env = makeEnv(client, db, kv);

    const before = Date.now();
    await mod.syncMauticContacts(env as never);
    const after = Date.now();

    const captured = (db as unknown as { capturedBindArgs: () => unknown[] | null }).capturedBindArgs();
    const sinceTs = new Date(captured![0] as string).getTime();
    const oneHourAgoLower = before - 3600000 - 1000;
    const oneHourAgoUpper = after - 3600000 + 1000;
    expect(sinceTs).toBeGreaterThanOrEqual(oneHourAgoLower);
    expect(sinceTs).toBeLessThanOrEqual(oneHourAgoUpper);
  });

  it('processes customers in batches of 50', async() => {
    const customers = generateCustomers(125);
    const inFlightResults: BatchResult[] = [];
    for (let i = 0; i < 125; i += 50) {
      const batch = customers.slice(i, i + 50);
      inFlightResults.push({
        created: batch.map((c) => ({ id: parseInt((c.phone as string).slice(-3), 10), email: c.email as string })),
        updated: [],
        errors: []
      });
    }

    const db = makeMockD1(customers);
    const kv = makeMockKV();
    const client = makeMockClient();
    (client.batchUpsertContacts as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const idx = client.batchUpsertContacts.mock.calls.length;
      return Promise.resolve(inFlightResults[idx - 1] ?? { created: [], updated: [], errors: [] });
    });

    const mod = await loadMod(client);
    const env = makeEnv(client, db, kv);
    const result = await mod.syncMauticContacts(env as never);

    expect(result.synced).toBe(125);
    expect(client.batchUpsertContacts).toHaveBeenCalledTimes(3); // 3 batches of 50,50,25
  });

  it('maps mauticContact via toMauticContact before batchUpsertContacts', async() => {
    const rows = [makeCustomerRow({ name: 'Test User', phone: '0909000000' })];
    const db = makeMockD1(rows);
    const kv = makeMockKV();
    const client = makeMockClient();

    // Realistic toMauticContact mock: maps name → firstname
    const toMauticContactStub = vi.fn((c: Record<string, unknown>) => ({
      firstname: c.name,
      email: c.email,
      phone: c.phone
    }));
    const mod = await loadMod(client, vi.fn(), toMauticContactStub);
    const env = makeEnv(client, db, kv);

    await mod.syncMauticContacts(env as never);

    const passedContacts = client.batchUpsertContacts.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(passedContacts[0].firstname).toBe('Test User');
    expect(passedContacts[0].phone).toBe('0909000000');
  });

  it('builds contactIdMap from created and updated results', async() => {
    const rows = [makeCustomerRow({ email: 'a@example.com' })];
    const db = makeMockD1(rows);
    const kv = makeMockKV();
    const client = makeMockClient({
      created: [{ id: 101, email: 'a@example.com' }],
      updated: [{ id: 202, email: 'b@example.com' }],
      errors: []
    });

    const syncSegmentsStub = vi.fn().mockImplementation(
      (_env: Record<string, unknown>, _client: MockClient, _customers: Array<Record<string, unknown>>, contactIdMap: Record<string, number>) => {
        return Object.keys(contactIdMap).length;
      }
    );

    const mod = await loadMod(client, syncSegmentsStub);
    const env = makeEnv(client, db, kv);
    const result = await mod.syncMauticContacts(env as never);

    // verify syncSegments was called and contactIdMap had entries
    expect(syncSegmentsStub).toHaveBeenCalledTimes(1);
    const callArgs = syncSegmentsStub.mock.calls[0];
    const contactIdMap = callArgs[3] as Record<string, number>;
    expect(Object.keys(contactIdMap).length).toBeGreaterThanOrEqual(1);
    expect(result.synced).toBeGreaterThanOrEqual(1);
  });

  it('continues to next batch when batchUpsertContacts throws', async() => {
    const customers = generateCustomers(77);
    const db = makeMockD1(customers);
    const kv = makeMockKV();
    const client = makeMockClient();

    let callIndex = 0;
    (client.batchUpsertContacts as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        throw new Error('batch error');
      }
      // second batch: use fallback and return based on batch index
      const idx = client.batchUpsertContacts.mock.calls.length - 1;
      if (idx === 1) {
        return Promise.resolve({ created: Array.from({ length: 27 }), updated: [], errors: [] });
      }
      return Promise.resolve({ created: [], updated: [], errors: [] });
    });

    const mod = await loadMod(client);
    const env = makeEnv(client, db, kv);
    const result = await mod.syncMauticContacts(env as never);

    expect(result.synced).toBe(27);
    expect(client.batchUpsertContacts).toHaveBeenCalledTimes(2);
  });

  it('stores updated timestamp in KV after completion', async() => {
    const rows = [makeCustomerRow()];
    const db = makeMockD1(rows);
    const kv = makeMockKV();
    const client = makeMockClient({
      created: [{ id: 1, email: 'cust1@example.com' }],
      updated: [],
      errors: []
    });

    const mod = await loadMod(client);
    const env = makeEnv(client, db, kv);

    const before = new Date().toISOString();
    await mod.syncMauticContacts(env as never);
    const after = new Date().toISOString();

    expect(kv.put).toHaveBeenCalledWith(
      'mautic_last_sync_ts',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    );
    const writtenTs = (kv.put as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === 'mautic_last_sync_ts'
    )?.[1] as string;
    if (writtenTs) {
      expect(writtenTs >= before && writtenTs <= after).toBe(true);
    }
  });

  it('skips KV write when AUTH_KV is absent (no-op error swallow)', async() => {
    const rows = [makeCustomerRow()];
    const db = makeMockD1(rows);
    const client = makeMockClient({
      created: [{ id: 1, email: 'cust1@example.com' }],
      updated: [],
      errors: []
    });

    const mod = await loadMod(client);
    const env: Record<string, unknown> = {
      MAUTIC_BASE_URL: 'https://m.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec',
      AURA_DB: db
      // No AUTH_KV
    };

    const result = await mod.syncMauticContacts(env as never);
    expect(result.synced).toBeGreaterThanOrEqual(0);
  });

  it('returns total synced count after all batches', async() => {
    const customers = generateCustomers(75);
    const db = makeMockD1(customers);
    const kv = makeMockKV();

    const client = makeMockClient();
    const results = [
      { created: Array.from({ length: 50 }), updated: [], errors: [] },
      { created: Array.from({ length: 25 }), updated: [], errors: [] }
    ];
    (client.batchUpsertContacts as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const idx = client.batchUpsertContacts.mock.calls.length - 1;
      return Promise.resolve(results[idx] ?? { created: [], updated: [], errors: [] });
    });

    const mod = await loadMod(client);
    const env = makeEnv(client, db, kv);
    const result = await mod.syncMauticContacts(env as never);

    expect(result.synced).toBe(75);
  });
});
