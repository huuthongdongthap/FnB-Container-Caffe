/**
 * Mautic Contact Sync Bridge — TDD Tests
 *
 * Tests for syncMauticContacts, toMauticContact, and syncSegments.
 * Strategy: mock D1, KV, and MauticClient; verify transform, incremental
 * query, batching, and segment mapping.
 *
 * @see ../worker/src/routes/mautic-bridge.ts
 */

import { describe, test, expect, vi, beforeEach, beforeAll } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// Mock dependencies BEFORE importing bridge
// ═══════════════════════════════════════════════════════════════════

vi.mock('../worker/src/lib/mautic-client.ts', () => ({
  createMauticClient: vi.fn(),
}));

vi.mock('../worker/src/utils/logger.ts', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { createMauticClient } from '../worker/src/lib/mautic-client.ts';
import * as bridge from '../worker/src/routes/mautic-bridge.ts';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

const SAMPLE_CUSTOMER_WITH_EMAIL = {
  phone: '0909123456',
  name: 'Nguyen Van A',
  email: 'a@example.com',
  loyalty_tier: 'gold',
  birthday: '1990-06-15',
  last_order_date: '2026-06-28T10:00:00.000Z',
  total_orders: 15,
};

const SAMPLE_CUSTOMER_PHONE_ONLY = {
  phone: '0909123457',
  name: 'Nguyen Van B',
  email: null,
  loyalty_tier: 'bronze',
  birthday: null,
  last_order_date: null,
  total_orders: 0,
};

function createMockDb(results: any[] = []) {
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results }),
  };
  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
  };
}

function createMockKv() {
  return {
    get: vi.fn(),
    put: vi.fn(),
  };
}

function createMockClient() {
  return {
    batchUpsertContacts: vi.fn(),
    addContactToSegment: vi.fn(),
  };
}

function createDefaultEnv(overrides: Record<string, unknown> = {}) {
  return {
    AURA_DB: createMockDb(),
    AUTH_KV: createMockKv(),
    MAUTIC_BASE_URL: 'https://mautic.example.com',
    MAUTIC_CLIENT_ID: 'test_client',
    MAUTIC_CLIENT_SECRET: 'test_secret',
    MAUTIC_SEGMENT_LOYALTY_BRONZE: 1,
    MAUTIC_SEGMENT_LOYALTY_SILVER: 2,
    MAUTIC_SEGMENT_LOYALTY_GOLD: 3,
    MAUTIC_SEGMENT_LOYALTY_PLATINUM: 4,
    MAUTIC_SEGMENT_ACTIVE: 10,
    MAUTIC_SEGMENT_AT_RISK: 11,
    MAUTIC_SEGMENT_INACTIVE: 12,
    MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: 20,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Suite
// ═══════════════════════════════════════════════════════════════════

describe('Mautic Contact Sync Bridge', () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    (createMauticClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);
  });

  // ── Test 1: toMauticContact transforms customer with email ──
  test('toMauticContact transforms customer with email to Mautic format', () => {
    const contact = bridge.toMauticContact(SAMPLE_CUSTOMER_WITH_EMAIL);

    expect(contact.email).toBe('a@example.com');
    expect(contact.firstname).toBe('Nguyen Van A');
    expect(contact.phone).toBe('0909123456');
    expect(contact.loyalty_tier).toBe('gold');
    expect(contact.birthday).toBe('1990-06-15');
    expect(contact.last_order_date).toBe('2026-06-28T10:00:00.000Z');
    expect(contact.total_orders).toBe(15);
  });

  // ── Test 2: toMauticContact phone-only fallback ──
  test('toMauticContact generates phone-only fallback email when email missing', () => {
    const contact = bridge.toMauticContact(SAMPLE_CUSTOMER_PHONE_ONLY);

    expect(contact.email).toBe('0909123457@aura-cafe.internal');
    expect(contact.firstname).toBe('Nguyen Van B');
    expect(contact.phone).toBe('0909123457');
    expect(contact.loyalty_tier).toBe('bronze');
    expect(contact.total_orders).toBe(0);
  });

  // ── Test 3: toMauticContact defaults name to 'Khách' when name missing ──
  test('toMauticContact defaults name when customer has no name', () => {
    const contact = bridge.toMauticContact({
      phone: '0909999999',
      email: null,
      name: null,
      loyalty_tier: 'gold',
    });

    expect(contact.firstname).toBe('Khách');
    expect(contact.email).toBe('0909999999@aura-cafe.internal');
  });

  // ── Test 4: syncMauticContacts skips when Mautic not configured ──
  test('syncMauticContacts returns skipped when Mautic env vars missing', async () => {
    (createMauticClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const env = createDefaultEnv();
    const result = await bridge.syncMauticContacts(env);

    expect(result).toEqual({ synced: 0, skipped: true });
    expect(env.AUTH_KV.get).not.toHaveBeenCalled(); // No KV access when skipped
  });

  // ── Test 5: syncMauticContacts queries customers after last KV timestamp ──
  test('syncMauticContacts queries customers updated after last sync timestamp', async () => {
    const env = createDefaultEnv();
    env.AUTH_KV.get.mockResolvedValue('2026-06-29T00:00:00.000Z');

    const result = await bridge.syncMauticContacts(env);

    // KV was read
    expect(env.AUTH_KV.get).toHaveBeenCalledWith('mautic_last_sync_ts');

    // D1 was queried with the KV timestamp
    const sqlCall = env.AURA_DB.prepare.mock.calls[0][0];
    expect(sqlCall).toContain('WHERE c.updated_at > ?');
    expect(sqlCall).toContain('FROM customers c');

    // No customers returned → synced = 0
    expect(result.synced).toBe(0);
  });

  // ── Test 6: syncMauticContacts batches contacts in groups of 50 ──
  test('syncMauticContacts batches contacts in groups of 50', async () => {
    // Generate 55 sample customers
    const customers = Array.from({ length: 55 }, (_, i) => ({
      phone: `0909000${String(i).padStart(3, '0')}`,
      name: `Customer ${i}`,
      email: `c${i}@example.com`,
      loyalty_tier: 'bronze',
      updated_at: '2026-06-30T00:00:00.000Z',
    }));

    const env = createDefaultEnv({
      AURA_DB: createMockDb(customers),
    });
    env.AUTH_KV.get.mockResolvedValue('2026-06-29T00:00:00.000Z');

    // Each batch upsert succeeds
    mockClient.batchUpsertContacts.mockResolvedValue({
      created: [],
      updated: [],
      errors: [],
    });

    await bridge.syncMauticContacts(env);

    // Should batch 55 contacts into 2 calls (50 + 5)
    expect(mockClient.batchUpsertContacts).toHaveBeenCalledTimes(2);
    expect(mockClient.batchUpsertContacts.mock.calls[0][0]).toHaveLength(50);
    expect(mockClient.batchUpsertContacts.mock.calls[1][0]).toHaveLength(5);

    // KV timestamp updated
    expect(env.AUTH_KV.put).toHaveBeenCalledWith('mautic_last_sync_ts', expect.any(String));
  });

  // ── Test 7: syncMauticContacts continues on batch error ──
  test('syncMauticContacts continues to next batch when one batch fails', async () => {
    const customers = Array.from({ length: 55 }, (_, i) => ({
      phone: `0909050${String(i).padStart(3, '0')}`,
      name: `Cust ${i}`,
      email: `cust${i}@example.com`,
      loyalty_tier: 'bronze',
      updated_at: '2026-06-30T00:00:00.000Z',
    }));

    const env = createDefaultEnv({
      AURA_DB: createMockDb(customers),
    });
    env.AUTH_KV.get.mockResolvedValue('2026-06-29T00:00:00.000Z');

    // First batch fails, second succeeds
    mockClient.batchUpsertContacts
      .mockRejectedValueOnce(new Error('API timeout'))
      .mockResolvedValueOnce({
        created: [{ id: 99, email: 'cust50@example.com' }],
        updated: [],
        errors: [],
      });

    const result = await bridge.syncMauticContacts(env);

    // Only the successful batch counts (1 created contact in batch 2)
    expect(result.synced).toBe(1);
    expect(mockClient.batchUpsertContacts).toHaveBeenCalledTimes(2);
    // KV timestamp still updated even after partial failure
    expect(env.AUTH_KV.put).toHaveBeenCalledWith('mautic_last_sync_ts', expect.any(String));
  });

  // ── Test 8: toMauticContact fills defaults for empty fields ──
  test('toMauticContact fills default values for empty/missing fields', () => {
    const customer = {
      phone: '0909000001',
      name: null,
      email: null,
      // loyalty_tier, birthday, last_order_date, total_orders all missing
    };

    const contact = bridge.toMauticContact(customer);

    expect(contact.email).toBe('0909000001@aura-cafe.internal');
    expect(contact.firstname).toBe('Khách');
    expect(contact.loyalty_tier).toBe('bronze');
    expect(contact.last_order_date).toBe(null);
    expect(contact.birthday).toBe(null);
    expect(contact.total_orders).toBe(0);
  });

  // ── Test 9: Segment mapping assigns tier-based segments ──
  test('syncSegments assigns tier-based segments from env config', async () => {
    mockClient.addContactToSegment.mockResolvedValue(true);

    const customers = [
      {
        phone: '0909000001', name: 'Gold', email: 'gold@test.com',
        loyalty_tier: 'gold', last_order_date: '2026-07-17T08:48:34.276Z',
        birthday: null, total_orders: 10,
      },
      {
        phone: '0909000002', name: 'Bronze', email: 'bronze@test.com',
        loyalty_tier: 'bronze', last_order_date: '2026-07-28T00:00:00.000Z',
        birthday: null, total_orders: 2,
      },
    ];

    const contactIdMap = {
      'gold@test.com': 100,
      'bronze@test.com': 101,
    };

    const env = createDefaultEnv();

    const assigned = await bridge.syncSegments(env, mockClient, customers, contactIdMap);

    // gold → segment 3, bronze → segment 1, both active (<=30d) → segment 10
    // Total: 4 segment assignments
    expect(assigned).toBe(4);
    expect(mockClient.addContactToSegment).toHaveBeenCalledWith(100, 3); // gold
    expect(mockClient.addContactToSegment).toHaveBeenCalledWith(101, 1); // bronze
    expect(mockClient.addContactToSegment).toHaveBeenCalledWith(100, 10); // active
    expect(mockClient.addContactToSegment).toHaveBeenCalledWith(101, 10); // active
  });

  // ── Test 10: Segment mapping assigns recency-based segments ──
  test('syncSegments assigns recency segments active/at-risk/inactive', async () => {
    mockClient.addContactToSegment.mockResolvedValue(true);

    const now = new Date();
    const activeDate = new Date(now.getTime() - 15 * 86400000).toISOString();   // 15d ago
    const atRiskDate = new Date(now.getTime() - 45 * 86400000).toISOString();   // 45d ago
    const inactiveDate = new Date(now.getTime() - 90 * 86400000).toISOString(); // 90d ago

    const customers = [
      {
        phone: '0909000001', name: 'Active', email: 'active@test.com',
        loyalty_tier: 'bronze', last_order_date: activeDate,
      },
      {
        phone: '0909000002', name: 'AtRisk', email: 'atrisk@test.com',
        loyalty_tier: 'bronze', last_order_date: atRiskDate,
      },
      {
        phone: '0909000003', name: 'Inactive', email: 'inactive@test.com',
        loyalty_tier: 'bronze', last_order_date: inactiveDate,
      },
    ];

    const contactIdMap = {
      'active@test.com': 201,
      'atrisk@test.com': 202,
      'inactive@test.com': 203,
    };

    const env = createDefaultEnv();

    await bridge.syncSegments(env, mockClient, customers, contactIdMap);

    // Active → segment 10
    expect(mockClient.addContactToSegment).toHaveBeenCalledWith(201, 10);
    // At-risk → segment 11
    expect(mockClient.addContactToSegment).toHaveBeenCalledWith(202, 11);
    // Inactive → segment 12
    expect(mockClient.addContactToSegment).toHaveBeenCalledWith(203, 12);
  });

  // ── Test 11: Segment mapping assigns birthday segments ──
  test('syncSegments assigns birthday segment when birthday month matches current month', async () => {
    mockClient.addContactToSegment.mockResolvedValue(true);

    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    const customers = [
      {
        phone: '0909000001', name: 'Bday', email: 'bday@test.com',
        loyalty_tier: 'bronze', last_order_date: '2026-07-28T00:00:00.000Z',
        birthday: `1990-${currentMonth}-15`,
      },
      {
        phone: '0909000002', name: 'NoBday', email: 'nobday@test.com',
        loyalty_tier: 'bronze', last_order_date: '2026-07-28T00:00:00.000Z',
        birthday: `1990-01-10`, // Different month
      },
    ];

    const contactIdMap = {
      'bday@test.com': 301,
      'nobday@test.com': 302,
    };

    const env = createDefaultEnv();

    await bridge.syncSegments(env, mockClient, customers, contactIdMap);

    // Birthday contact gets birthday segment
    expect(mockClient.addContactToSegment).toHaveBeenCalledWith(301, 20);
    // Non-birthday-month contact does NOT get birthday segment
    expect(mockClient.addContactToSegment).not.toHaveBeenCalledWith(302, 20);

    // Each also gets tier + recency segments (301: tier+recency=2, 302: tier+recency=2)
    // plus birthday = 3 for bday, 2 for nobday = 5 total
    expect(mockClient.addContactToSegment).toHaveBeenCalledTimes(5);
  });

  // ── Test 12: syncSegments skips contacts not in contactIdMap ──
  test('syncSegments skips contacts without a mapped contact ID', async () => {
    mockClient.addContactToSegment.mockResolvedValue(true);

    const customers = [
      {
        phone: '0909099999', name: 'Unknown', email: 'unknown@test.com',
        loyalty_tier: 'gold', last_order_date: '2026-07-28T00:00:00.000Z',
      },
    ];

    const env = createDefaultEnv();

    // Contact not in map → should skip segment assignment entirely
    const assigned = await bridge.syncSegments(env, mockClient, customers, {});

    expect(assigned).toBe(0);
    expect(mockClient.addContactToSegment).not.toHaveBeenCalled();
  });

  // ── Test 13: syncMauticContacts handles null last_order_date as inactive ──
  test('syncMauticContacts assigns inactive recency when customer has no orders', async () => {
    mockClient.addContactToSegment.mockResolvedValue(true);

    const customers = [{
      phone: '0909000001',
      name: 'New',
      email: 'new@test.com',
      loyalty_tier: 'bronze',
      last_order_date: null,
      birthday: null,
      updated_at: '2026-06-30T00:00:00.000Z',
    }];

    const env = createDefaultEnv({
      AURA_DB: createMockDb(customers),
    });
    env.AUTH_KV.get.mockResolvedValue('2026-06-29T00:00:00.000Z');

    mockClient.batchUpsertContacts.mockResolvedValue({
      created: [{ id: 400, email: 'new@test.com' }],
      updated: [],
      errors: [],
    });

    await bridge.syncMauticContacts(env);

    // Verify segment: bronze → loyalty_bronze (1) + inactive (12) = 2 calls
    expect(mockClient.addContactToSegment).toHaveBeenCalledWith(400, 1);  // bronze
    expect(mockClient.addContactToSegment).toHaveBeenCalledWith(400, 12); // inactive
    expect(mockClient.addContactToSegment).toHaveBeenCalledTimes(2);
  });
});
