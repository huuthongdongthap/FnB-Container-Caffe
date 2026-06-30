/**
 * Campaign Enrollment Triggers — TDD Tests
 *
 * Tests for detectWinbackCandidates, detectBirthdayCandidates,
 * triggerPromoCampaign, isAlreadyEnrolled, and trackEnrollment.
 *
 * Strategy: mock D1, KV, and MauticClient; verify candidate detection,
 * dedup logic, enrollment tracking, and error handling.
 *
 * @see ../worker/src/routes/mautic-bridge.js
 */

const { test, expect, describe, beforeEach } = require('@jest/globals');

// ═══════════════════════════════════════════════════════════════════
// Mock dependencies BEFORE importing bridge
// ═══════════════════════════════════════════════════════════════════

jest.mock('../worker/src/lib/mautic-client.js', () => ({
  createMauticClient: jest.fn(),
}));

jest.mock('../worker/src/utils/logger.js', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const { createMauticClient } = require('../worker/src/lib/mautic-client.js');

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a mock D1 database with controlled results.
 * Supports separate results for all(), first(), and run().
 */
function createMockDb({ customerResults = [], firstResult = null } = {}) {
  const mockStatement = {
    bind: jest.fn().mockReturnThis(),
    all: jest.fn().mockResolvedValue({ results: customerResults }),
    first: jest.fn().mockResolvedValue(firstResult),
    run: jest.fn().mockResolvedValue({ success: true }),
  };
  return {
    prepare: jest.fn().mockReturnValue(mockStatement),
    mockStatement,
  };
}

function createMockKv() {
  return {
    get: jest.fn(),
    put: jest.fn(),
  };
}

function createMockClient() {
  return {
    createOrUpdateContact: jest.fn().mockResolvedValue(42),
    addContactToCampaign: jest.fn().mockResolvedValue(true),
    addContactToSegment: jest.fn(),
    batchUpsertContacts: jest.fn(),
  };
}

/**
 * Build a full env object with all Mautic env vars and mock bindings.
 */
function createDefaultEnv(overrides = {}) {
  return {
    AURA_DB: createMockDb(),
    AUTH_KV: createMockKv(),
    MAUTIC_BASE_URL: 'https://mautic.example.com',
    MAUTIC_CLIENT_ID: 'test_client',
    MAUTIC_CLIENT_SECRET: 'test_secret',
    MAUTIC_CAMPAIGN_WINBACK: '10',
    MAUTIC_CAMPAIGN_BIRTHDAY: '20',
    MAUTIC_CAMPAIGN_PROMO: '30',
    ...overrides,
  };
}

/**
 * Build a customer row that would be eligible for win-back (last order 31 days ago).
 */
function makeWinbackCustomer(overrides = {}) {
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86400000).toISOString();
  return {
    id: 'cust_winback_01',
    name: 'Nguyen Van Winback',
    phone: '0909111111',
    email: 'winback@test.com',
    loyalty_tier: 'GOLD',
    ...overrides,
  };
}

/**
 * Build a customer row with a birthday in the current month.
 */
function makeBirthdayCustomer(overrides = {}) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return {
    id: 'cust_bday_01',
    name: 'Tran Thi Birthday',
    phone: '0909222222',
    email: 'bday@test.com',
    loyalty_tier: 'SILVER',
    date_of_birth: `${yyyy - 30}-${mm}-15`,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Suite
// ═══════════════════════════════════════════════════════════════════

describe('Campaign Enrollment Triggers', () => {
  let bridge;
  let mockClient;

  beforeAll(() => {
    bridge = require('../worker/src/routes/mautic-bridge.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockClient();
    createMauticClient.mockReturnValue(mockClient);
  });

  // ── Test 1: Win-back detects eligible customer, skips recent ──
  test('detectWinbackCandidates enrolls customer with last order 31 days ago', async () => {
    const winbackCustomer = makeWinbackCustomer();
    const db = createMockDb({ customerResults: [winbackCustomer] });
    const env = createDefaultEnv({ AURA_DB: db });

    // first() returns null (no existing Mautic mapping) → falls through to createOrUpdateContact
    db.mockStatement.first.mockResolvedValue(null);

    const result = await bridge.detectWinbackCandidates(env);

    expect(result.detected).toBe(1);
    expect(result.enrolled).toBe(1);

    // Verify Mautic upsert was called
    expect(mockClient.createOrUpdateContact).toHaveBeenCalledTimes(1);
    expect(mockClient.createOrUpdateContact).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'winback@test.com', phone: '0909111111' })
    );

    // Verify campaign enrollment was called with the resolved contact ID
    expect(mockClient.addContactToCampaign).toHaveBeenCalledWith(42, 10);

    // Verify enrollment was tracked in D1
    expect(db.mockStatement.run).toHaveBeenCalledTimes(1);
  });

  test('detectWinbackCandidates returns 0 when no customers match (e.g. recent orders)', async () => {
    // Empty results = no eligible candidates (SQL dedup excluded them)
    const db = createMockDb({ customerResults: [] });
    const env = createDefaultEnv({ AURA_DB: db });

    const result = await bridge.detectWinbackCandidates(env);

    expect(result.detected).toBe(0);
    expect(result.enrolled).toBe(0);
    expect(mockClient.createOrUpdateContact).not.toHaveBeenCalled();
    expect(db.mockStatement.run).not.toHaveBeenCalled();
  });

  // ── Test 2: Win-back skips already-enrolled customers ──
  test('detectWinbackCandidates skips customers already enrolled in winback (dedup via SQL)', async () => {
    // Empty results simulates SQL WHERE NOT IN (...) exclusion
    const db = createMockDb({ customerResults: [] });
    const env = createDefaultEnv({ AURA_DB: db });

    const result = await bridge.detectWinbackCandidates(env);

    // No candidates detected because SQL dedup excluded already-enrolled
    expect(result.detected).toBe(0);
    expect(result.enrolled).toBe(0);
    expect(mockClient.addContactToCampaign).not.toHaveBeenCalled();
  });

  // ── Test 3: Birthday detects customer with birthday this month ──
  test('detectBirthdayCandidates enrolls customer with birthday this month', async () => {
    const birthdayCustomer = makeBirthdayCustomer();
    const db = createMockDb({ customerResults: [birthdayCustomer] });
    const env = createDefaultEnv({ AURA_DB: db });

    db.mockStatement.first.mockResolvedValue(null);

    const result = await bridge.detectBirthdayCandidates(env);

    expect(result.detected).toBe(1);
    expect(result.enrolled).toBe(1);

    // Verify Mautic upsert and campaign enrollment
    expect(mockClient.createOrUpdateContact).toHaveBeenCalledTimes(1);
    expect(mockClient.addContactToCampaign).toHaveBeenCalledWith(42, 20);

    // Verify enrollment was tracked
    expect(db.mockStatement.run).toHaveBeenCalledTimes(1);

    // Verify the query includes birthday month bind parameter
    const sqlCall = db.prepare.mock.calls[0][0];
    expect(sqlCall).toContain('substr(c.date_of_birth, 6, 2)');
  });

  // ── Test 4: Birthday skips non-birthday customers ──
  test('detectBirthdayCandidates returns 0 when no customers have birthday this month', async () => {
    const db = createMockDb({ customerResults: [] });
    const env = createDefaultEnv({ AURA_DB: db });

    const result = await bridge.detectBirthdayCandidates(env);

    expect(result.detected).toBe(0);
    expect(result.enrolled).toBe(0);
    expect(mockClient.createOrUpdateContact).not.toHaveBeenCalled();
  });

  // ── Test 5: Birthday skips customer who already used birthday discount ──
  test('detectBirthdayCandidates skips customer who used birthday discount this month', async () => {
    // Empty results simulates SQL exclusion via loyalty_audit_log NOT IN
    const db = createMockDb({ customerResults: [] });
    const env = createDefaultEnv({ AURA_DB: db });

    const result = await bridge.detectBirthdayCandidates(env);

    expect(result.detected).toBe(0);
    expect(result.enrolled).toBe(0);
    expect(mockClient.createOrUpdateContact).not.toHaveBeenCalled();
  });

  // ── Test 6: Enrollment tracking writes to campaign_enrollments ──
  test('trackEnrollment inserts a row into campaign_enrollments', async () => {
    const db = createMockDb();
    db.mockStatement.run.mockResolvedValue({ success: true });

    const id = await bridge.trackEnrollment(db, 'cust_test', 'winback', '10', 42, 'enrolled');

    expect(id).toBeTruthy();
    expect(id).toMatch(/^ce_/);

    // Verify INSERT SQL
    const sqlCall = db.prepare.mock.calls[0][0];
    expect(sqlCall).toContain('INSERT INTO campaign_enrollments');

    // Verify bind params
    const bindCall = db.mockStatement.bind.mock.calls[0];
    expect(bindCall[0]).toBe(id);            // id
    expect(bindCall[1]).toBe('cust_test');   // customer_id
    expect(bindCall[2]).toBe('winback');     // campaign_type
    expect(bindCall[3]).toBe('10');          // campaign_id
    expect(bindCall[5]).toBe('42');          // mautic_contact_id
    expect(bindCall[6]).toBe('enrolled');    // status

    expect(db.mockStatement.run).toHaveBeenCalledTimes(1);
  });

  // ── Test 7: isAlreadyEnrolled checks campaign_enrollments for recent entries ──
  test('isAlreadyEnrolled returns true when recent enrollment exists', async () => {
    const db = createMockDb();
    db.mockStatement.first.mockResolvedValue({ 1: 1 }); // EXISTS = true

    const enrolled = await bridge.isAlreadyEnrolled(db, 'cust_test', 'winback', 30);

    expect(enrolled).toBe(true);

    const sqlCall = db.prepare.mock.calls[0][0];
    expect(sqlCall).toContain('SELECT 1 FROM campaign_enrollments');
  });

  test('isAlreadyEnrolled returns false when no recent enrollment', async () => {
    const db = createMockDb();
    db.mockStatement.first.mockResolvedValue(null); // No row found

    const enrolled = await bridge.isAlreadyEnrolled(db, 'cust_test', 'birthday', 30);

    expect(enrolled).toBe(false);
  });

  // ── Test 8: Skip when Mautic not configured ──
  test('detectWinbackCandidates skips when Mautic not configured', async () => {
    createMauticClient.mockReturnValueOnce(null);

    const env = createDefaultEnv();
    const result = await bridge.detectWinbackCandidates(env);

    expect(result).toEqual({ detected: 0, enrolled: 0 });
    expect(env.AURA_DB.prepare).not.toHaveBeenCalled();
  });

  // ── Test 9: Skip when campaign env var not set ──
  test('detectWinbackCandidates skips when MAUTIC_CAMPAIGN_WINBACK not configured', async () => {
    const env = createDefaultEnv({ MAUTIC_CAMPAIGN_WINBACK: undefined });

    const result = await bridge.detectWinbackCandidates(env);

    expect(result).toEqual({ detected: 0, enrolled: 0 });
    expect(env.AURA_DB.prepare).not.toHaveBeenCalled();
  });

  // ── Test 10: Promo campaign trigger works with segment filter ──
  test('triggerPromoCampaign enrolls customers filtered by tier', async () => {
    const goldCustomer = {
      id: 'cust_promo_01',
      name: 'Promo Gold',
      phone: '0909333333',
      email: 'promo@test.com',
      loyalty_tier: 'GOLD',
    };
    const db = createMockDb({ customerResults: [goldCustomer] });
    const env = createDefaultEnv({ AURA_DB: db });

    db.mockStatement.first.mockResolvedValue(null);

    const result = await bridge.triggerPromoCampaign(env, {
      segment: { tier: 'GOLD' },
      templateName: 'summer_sale',
      promoTitle: 'Summer Sale',
      promoDesc: '20% off all drinks',
    });

    expect(result.enrolled).toBe(1);
    expect(mockClient.createOrUpdateContact).toHaveBeenCalledTimes(1);
    expect(mockClient.addContactToCampaign).toHaveBeenCalledWith(42, 30);
  });
});
