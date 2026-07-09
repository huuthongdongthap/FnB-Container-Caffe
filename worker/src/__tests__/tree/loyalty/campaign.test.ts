import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveCampaign, calcExpiresAt } from '../../../tree/loyalty/campaign';

describe('loyalty campaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getActiveCampaign ────────────────────────────────────────────────────

  it('returns null when no active campaign exists', async() => {
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async() => null,
          all: async() => ({ results: [] })
        })
      })
    } as never;

    const result = await getActiveCampaign(db);
    expect(result).toBeNull();
  });

  it('queries with both start and end date filters', async() => {
    let capturedSql = '';
    const db = {
      prepare: (sql: string) => {
        capturedSql = sql;
        return {
          bind: () => ({
            first: async() => null,
            all: async() => ({ results: [] })
          })
        };
      }
    } as never;

    await getActiveCampaign(db);
    expect(capturedSql).toContain('active = 1');
    expect(capturedSql).toContain('start_date');
    expect(capturedSql).toContain('end_date');
    expect(capturedSql).toContain('ORDER BY id DESC LIMIT 1');
  });

  it('returns the campaign row when one is active', async() => {
    const campaign = { id: 'cmp_1', code: 'SUMMER', cashback_multiplier: 1.5, max_cap_per_customer_vnd: 100000 };
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async() => campaign,
          all: async() => ({ results: [] })
        })
      })
    } as never;

    const result = await getActiveCampaign(db);
    expect(result).toEqual(campaign);
  });

  // ── calcExpiresAt ────────────────────────────────────────────────────────

  it('returns ISO date string when tier has expiry_days', () => {
    const tier = { expiry_days: 30 };
    const result = calcExpiresAt(tier);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
    // Should be roughly 30 days from now
    const daysDiff = (new Date(result).getTime() - Date.now()) / 86400000;
    expect(daysDiff).toBeGreaterThan(29);
    expect(daysDiff).toBeLessThan(31);
  });

  it('returns null when tier is null', () => {
    expect(calcExpiresAt(null)).toBeNull();
  });

  it('returns null when expiry_days is 0', () => {
    expect(calcExpiresAt({ expiry_days: 0 })).toBeNull();
  });

  it('returns null when expiry_days is undefined', () => {
    expect(calcExpiresAt({})).toBeNull();
  });
});
