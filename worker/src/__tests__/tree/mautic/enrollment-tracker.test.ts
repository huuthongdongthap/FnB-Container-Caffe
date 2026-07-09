/**
 * Unit tests for src/tree/mautic/enrollment-tracker.ts
 * Tests: trackEnrollment inserts row, isAlreadyEnrolled returns boolean.
 * Mock D1 DB prepared statement .bind().run() / .bind().first().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackEnrollment, isAlreadyEnrolled } from '../../../tree/mautic/enrollment-tracker.js';

// ---------------------------------------------------------------------------
// D1 stubs
// ---------------------------------------------------------------------------

type PreparedInsertStub = {
  bind: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
};

type PreparedSelectStub = {
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
};

function makeInsertStub() {
  const stub = { bind: vi.fn().mockReturnThis(), run: vi.fn().mockResolvedValue({ success: true }) } as unknown as PreparedInsertStub;
  return stub;
}

function makeSelectStub(hasRow: boolean) {
  const stub = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(hasRow ? { '1': 1 } : null)
  } as unknown as PreparedSelectStub;
  return stub;
}

function makeD1Stub(insertStub: PreparedInsertStub, selectStub: PreparedSelectStub) {
  return {
    prepare: vi.fn((_sql: string) => {
      if (_sql.includes('INSERT INTO campaign_enrollments')) {
        return insertStub as never;
      }
      return selectStub as never;
    })
  } as unknown as Parameters<typeof trackEnrollment>[0];
}

// ---------------------------------------------------------------------------
// Tests: trackEnrollment
// ---------------------------------------------------------------------------

describe('trackEnrollment', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('inserts a campaign_enrollments row and returns an id', async() => {
    const insertStub = makeInsertStub();
    const selectStub = makeSelectStub(false);
    const db = makeD1Stub(insertStub, selectStub);

    const result = await trackEnrollment(
      db,
      'cust-1',
      'winback',
      '10',
      12345,
      'enrolled'
    );

    expect(typeof result).toBe('string');
    expect(result.startsWith('ce_')).toBe(true);
    expect(insertStub.run).toHaveBeenCalledTimes(1);
    expect(insertStub.bind).toHaveBeenCalledTimes(1); // single bind with 7 args
  });

  it('binds correct values: customerId, campaignType, campaignId, mauticContactId, status', async() => {
    const insertStub = makeInsertStub();
    const selectStub = makeSelectStub(false);
    const db = makeD1Stub(insertStub, selectStub);

    await trackEnrollment(db, 'cust-42', 'birthday', '20', 999, 'enrolled');

    const boundArgs = (insertStub.bind as ReturnType<typeof vi.fn>).mock.calls[0];
    // boundArgs[0] = id, [1] = customer_id, [2] = campaign_type, [3] = campaign_id, [6] = status
    expect(boundArgs[1]).toBe('cust-42');
    expect(boundArgs[2]).toBe('birthday');
    expect(boundArgs[3]).toBe('20');
    expect(boundArgs[6]).toBe('enrolled');
  });

  it('mauticContactId is stringified in the bound args', async() => {
    const insertStub = makeInsertStub();
    const selectStub = makeSelectStub(false);
    const db = makeD1Stub(insertStub, selectStub);

    await trackEnrollment(db, 'c1', 'promo', '30', 77, 'enrolled');

    const boundArgs = (insertStub.bind as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(boundArgs[5]).toBe('77');
  });

  it('created_at is an ISO timestamp string', async() => {
    const insertStub = makeInsertStub();
    const selectStub = makeSelectStub(false);
    const db = makeD1Stub(insertStub, selectStub);

    await trackEnrollment(db, 'c1', 'winback', '10', 1, 'enrolled');

    const boundArgs = (insertStub.bind as ReturnType<typeof vi.fn>).mock.calls[0];
    const createdAt = boundArgs[4] as string;
    expect(createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ---------------------------------------------------------------------------
// Tests: isAlreadyEnrolled
// ---------------------------------------------------------------------------

describe('isAlreadyEnrolled', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('returns true when a row exists within the lookback window', async() => {
    const insertStub = makeInsertStub();
    const selectStub = makeSelectStub(true);
    const db = makeD1Stub(insertStub, selectStub);

    const result = await isAlreadyEnrolled(db, 'cust-1', 'winback', 30);
    expect(result).toBe(true);
    expect(selectStub.first).toHaveBeenCalledTimes(1);
  });

  it('returns false when no row exists within the lookback window', async() => {
    const insertStub = makeInsertStub();
    const selectStub = makeSelectStub(false);
    const db = makeD1Stub(insertStub, selectStub);

    const result = await isAlreadyEnrolled(db, 'cust-1', 'winback', 30);
    expect(result).toBe(false);
  });

  it('binds the correct cutoff timestamp', async() => {
    const insertStub = makeInsertStub();
    const selectStub = makeSelectStub(false);
    const db = makeD1Stub(insertStub, selectStub);

    const before = Date.now();
    await isAlreadyEnrolled(db, 'cust-1', 'birthday', 7);
    const after = Date.now();

    const boundArgs = (selectStub.bind as ReturnType<typeof vi.fn>).mock.calls[0];
    const cutoff = boundArgs[2] as string;
    const cutoffTs = new Date(cutoff).getTime();
    const expectedLower = before - 8 * 86400000;
    const expectedUpper = after - 6 * 86400000;
    expect(cutoffTs).toBeGreaterThanOrEqual(expectedLower);
    expect(cutoffTs).toBeLessThanOrEqual(expectedUpper);
  });

  it('binds customer_id and campaign_type as the first two params', async() => {
    const insertStub = makeInsertStub();
    const selectStub = makeSelectStub(false);
    const db = makeD1Stub(insertStub, selectStub);

    await isAlreadyEnrolled(db, 'cust-99', 'promo', 14);
    const boundArgs = (selectStub.bind as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(boundArgs[0]).toBe('cust-99');
    expect(boundArgs[1]).toBe('promo');
  });
});
