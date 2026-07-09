/**
 * Unit tests for src/tree/mautic/segment-sync.ts
 * Tests: syncSegments — tier mapping, recency segmentation, birthday segment,
 * contact lookups. Mock MauticClient + D1-free.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncSegments } from '../../../tree/mautic/segment-sync.js';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type MockClient = {
  addContactToSegment: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockClient(): MockClient {
  return {
    addContactToSegment: vi.fn().mockResolvedValue(true)
  };
}

function makeCustomer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    email: 'cust@example.com',
    phone: '0912345678',
    loyalty_tier: 'silver',
    last_order_date: new Date(Date.now() - 20 * 86400000).toISOString(),
    birthday: '1990-06-15',
    ...overrides
  };
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    MAUTIC_SEGMENT_LOYALTY_BRONZE: '1',
    MAUTIC_SEGMENT_LOYALTY_SILVER: '2',
    MAUTIC_SEGMENT_LOYALTY_GOLD: '3',
    MAUTIC_SEGMENT_LOYALTY_PLATINUM: '4',
    MAUTIC_SEGMENT_ACTIVE: '10',
    MAUTIC_SEGMENT_AT_RISK: '11',
    MAUTIC_SEGMENT_INACTIVE: '12',
    MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '13',
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncSegments', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('returns 0 when no customers provided', async() => {
    const client = makeMockClient();
    const result = await syncSegments(makeEnv(), client as never, [], {});
    expect(result).toBe(0);
  });

  it('returns 0 when contactIdMap is empty', async() => {
    const client = makeMockClient();
    const result = await syncSegments(makeEnv(), client as never, [makeCustomer()], {});
    expect(result).toBe(0);
  });

  it('assigns tier segment for a known contactId', async() => {
    const client = makeMockClient();
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '0',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '2',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '0',
      MAUTIC_SEGMENT_AT_RISK: '0',
      MAUTIC_SEGMENT_INACTIVE: '0',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '0'
    };
    const customers = [makeCustomer({ loyalty_tier: 'silver' })];
    const contactIdMap: Record<string, number> = { 'cust@example.com': 42 };
    const result = await syncSegments(env, client as never, customers, contactIdMap);
    expect(result).toBe(1);
    expect(client.addContactToSegment).toHaveBeenCalledWith(42, '2');
  });

  it('uses phone fallback for contact email key when email is empty', async() => {
    const client = makeMockClient();
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '1',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '0',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '0',
      MAUTIC_SEGMENT_AT_RISK: '0',
      MAUTIC_SEGMENT_INACTIVE: '0',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '0'
    };
    const customers = [makeCustomer({ email: '', loyalty_tier: 'bronze' })];
    const contactIdMap: Record<string, number> = { '0912345678@aura-cafe.internal': 77 };
    const result = await syncSegments(env, client as never, customers, contactIdMap);
    expect(result).toBe(1);
    expect(client.addContactToSegment).toHaveBeenCalledWith(77, '1');
  });

  it('assigns active segment for orders within 30 days', async() => {
    const client = makeMockClient();
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '0',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '0',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '10',
      MAUTIC_SEGMENT_AT_RISK: '0',
      MAUTIC_SEGMENT_INACTIVE: '0',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '0'
    };
    const customers = [makeCustomer({ last_order_date: new Date(Date.now() - 5 * 86400000).toISOString() })];
    const contactIdMap: Record<string, number> = { 'cust@example.com': 42 };
    const result = await syncSegments(env, client as never, customers, contactIdMap);
    expect(result).toBe(1);
    expect(client.addContactToSegment).toHaveBeenCalledWith(42, '10');
  });

  it('assigns at-risk segment for orders 31-60 days ago', async() => {
    const client = makeMockClient();
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '0',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '0',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '0',
      MAUTIC_SEGMENT_AT_RISK: '11',
      MAUTIC_SEGMENT_INACTIVE: '0',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '0'
    };
    const customers = [makeCustomer({ last_order_date: new Date(Date.now() - 45 * 86400000).toISOString() })];
    const contactIdMap: Record<string, number> = { 'cust@example.com': 42 };
    const result = await syncSegments(env, client as never, customers, contactIdMap);
    expect(result).toBe(1);
    expect(client.addContactToSegment).toHaveBeenCalledWith(42, '11');
  });

  it('assigns inactive segment for orders 61+ days ago', async() => {
    const client = makeMockClient();
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '0',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '0',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '0',
      MAUTIC_SEGMENT_AT_RISK: '0',
      MAUTIC_SEGMENT_INACTIVE: '12',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '0'
    };
    const customers = [makeCustomer({ last_order_date: new Date(Date.now() - 90 * 86400000).toISOString() })];
    const contactIdMap: Record<string, number> = { 'cust@example.com': 42 };
    const result = await syncSegments(env, client as never, customers, contactIdMap);
    expect(result).toBe(1);
    expect(client.addContactToSegment).toHaveBeenCalledWith(42, '12');
  });

  it('assigns inactive segment when last_order_date is null', async() => {
    const client = makeMockClient();
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '0',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '0',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '0',
      MAUTIC_SEGMENT_AT_RISK: '0',
      MAUTIC_SEGMENT_INACTIVE: '12',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '0'
    };
    const customers = [makeCustomer({ last_order_date: null })];
    const contactIdMap: Record<string, number> = { 'cust@example.com': 42 };
    const result = await syncSegments(env, client as never, customers, contactIdMap);
    expect(result).toBe(1);
    expect(client.addContactToSegment).toHaveBeenCalledWith(42, '12');
  });

  it('skips birthday segment when birthday is null', async() => {
    const client = makeMockClient();
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '0',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '2',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '0',
      MAUTIC_SEGMENT_AT_RISK: '0',
      MAUTIC_SEGMENT_INACTIVE: '12',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '0'
    };
    const customers = [makeCustomer({ last_order_date: null, birthday: null })];
    const contactIdMap: Record<string, number> = { 'cust@example.com': 42 };
    const result = await syncSegments(env, client as never, customers, contactIdMap);
    // tier(silver=2) + inactive(12) = 2
    expect(result).toBe(2);
    const segmentIds = (client.addContactToSegment.mock.calls as Array<[number, number]>).map((c) => c[1]);
    expect(segmentIds).not.toContain('13');
  });

  it('assigns birthday segment when birthday month matches current month', async() => {
    const client = makeMockClient();
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '0',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '0',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '0',
      MAUTIC_SEGMENT_AT_RISK: '0',
      MAUTIC_SEGMENT_INACTIVE: '0',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '13'
    };
    const customers = [makeCustomer({ birthday: `1990-${currentMonth}-15`, last_order_date: null })];
    const contactIdMap: Record<string, number> = { 'cust@example.com': 42 };
    const result = await syncSegments(env, client as never, customers, contactIdMap);
    // tier(silver=0 disabled) + no recency + birthday(13) = 1
    expect(result).toBe(1);
    expect(client.addContactToSegment).toHaveBeenCalledWith(42, '13');
  });

  it('skips birthday segment when birthday month does not match', async() => {
    const client = makeMockClient();
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '0',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '0',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '0',
      MAUTIC_SEGMENT_AT_RISK: '0',
      MAUTIC_SEGMENT_INACTIVE: '0',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '13'
    };
    const customers = [makeCustomer({ birthday: '1990-12-25', last_order_date: null })];
    const contactIdMap: Record<string, number> = { 'cust@example.com': 42 };
    await syncSegments(env, client as never, customers, contactIdMap);
    const calls = (client.addContactToSegment.mock.calls as Array<[number, number]>).map((c) => c[1]);
    expect(calls).not.toContain('13');
  });

  it('skips tier segment assignment when segment id is 0 (disabled)', async() => {
    const client = makeMockClient();
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '0',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '0',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '0',
      MAUTIC_SEGMENT_AT_RISK: '0',
      MAUTIC_SEGMENT_INACTIVE: '12',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '0'
    };
    const customers = [makeCustomer({ loyalty_tier: 'silver', last_order_date: null })];
    const contactIdMap: Record<string, number> = { 'cust@example.com': 42 };
    const result = await syncSegments(env, client as never, customers, contactIdMap);
    expect(result).toBe(1);
    expect(client.addContactToSegment).toHaveBeenCalledWith(42, '12');
  });

  it('lowercases tier before segment lookup', async() => {
    const client = makeMockClient();
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '0',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '2',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '0',
      MAUTIC_SEGMENT_AT_RISK: '0',
      MAUTIC_SEGMENT_INACTIVE: '0',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '0'
    };
    const customers = [makeCustomer({ loyalty_tier: 'SILVER' })];
    const contactIdMap: Record<string, number> = { 'cust@example.com': 42 };
    const result = await syncSegments(env, client as never, customers, contactIdMap);
    expect(result).toBe(1);
    expect(client.addContactToSegment).toHaveBeenCalledWith(42, '2');
  });

  it('accumulates assignments across multiple customers', async() => {
    const client = makeMockClient();
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const env: Record<string, unknown> = {
      MAUTIC_SEGMENT_LOYALTY_BRONZE: '1',
      MAUTIC_SEGMENT_LOYALTY_SILVER: '0',
      MAUTIC_SEGMENT_LOYALTY_GOLD: '0',
      MAUTIC_SEGMENT_LOYALTY_PLATINUM: '0',
      MAUTIC_SEGMENT_ACTIVE: '10',
      MAUTIC_SEGMENT_AT_RISK: '0',
      MAUTIC_SEGMENT_INACTIVE: '0',
      MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH: '0'
    };
    const customers = [
      makeCustomer({ email: 'a@example.com', loyalty_tier: 'bronze', last_order_date: new Date(Date.now() - 5 * 86400000).toISOString() }),
      makeCustomer({ email: 'b@example.com', loyalty_tier: 'bronze', last_order_date: new Date(Date.now() - 45 * 86400000).toISOString() }),
      makeCustomer({ email: 'c@example.com', loyalty_tier: 'bronze', birthday: `1995-${currentMonth}-01`, last_order_date: null })
    ];

    const contactIdMap: Record<string, number> = { 'a@example.com': 1, 'b@example.com': 2, 'c@example.com': 3 };
    const result = await syncSegments(env, client as never, customers, contactIdMap);
    // a: tier(1)+active(10)=2; b: tier(1)+inactive(0 not enabled)=1; c: tier(1)+inactive(0 not enabled)=1
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(6);
  });
});
