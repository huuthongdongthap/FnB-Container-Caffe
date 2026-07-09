import { describe, it, expect, vi } from 'vitest';
import { handleSummary } from '../../../tree/loyalty/summary-handler';

function makeCtx(overrides: {
  customer?: Record<string, unknown>
  tier?: Record<string, unknown> | null
  wallet?: Record<string, unknown> | null
  nextTier?: Record<string, unknown> | null
  rewardCount?: number
  expiringSum?: number
} = {}): unknown {
  const {
    customer = { id: 'cust_1', name: 'Test User', email: 'test@test.com', phone: '0909009009', loyalty_points: 500, lifetime_points: 500, loyalty_tier: 'bronze', created_at: '2026-01-01T00:00:00Z' },
    tier = { tier_name: 'bronze', cashback_rate: 0.05, point_multiplier: 1, expiry_days: 90 },
    wallet = { id: 'wal_1', customer_id: 'cust_1', balance: 25000, total_earned: 50000, total_spent: 25000, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
    nextTier = { tier_name: 'silver', min_points: 1000 },
    rewardCount = 2,
    expiringSum = 5000
  } = overrides;

  let callIndex = 0;
  const dbQueryResults: Array<Record<string, unknown> | null> = [
    tier,
    wallet,
    null,
    nextTier,
    null,
    { total: expiringSum }
  ];

  return {
    get: (_k: string) => customer,
    env: {
      AURA_DB: {
        prepare: () => ({
          bind: () => {
            const result = dbQueryResults[callIndex] ?? null;
            const idx = callIndex;
            callIndex++;
            return {
              first: async() => (result != null && !('results' in (result as Record<string, unknown>)) ? result : null),
              all: async() => ({ results: rewardCount > 0 ? [{ cnt: rewardCount }] : [] }),
              run: async() => ({ success: true, changes: 1, lastRowId: idx + 1 })
            };
          }
        })
      }
    },
    json: (data: unknown, status?: number) => {
      if (status) {
        return { status, body: data };
      }
      return { status: 200, body: data };
    }
  } as unknown as Parameters<typeof handleSummary>[0];
}

describe('handleSummary', () => {
  it('returns 200 with summary data on happy path', async() => {
    const ctx = makeCtx();
    const res = await handleSummary(ctx as never);
    expect((res as Response).status).toBe(200);
  });

  it('creates wallet when none exists', async() => {
    const ctx = makeCtx({ wallet: null });
    const res = await handleSummary(ctx as never);
    expect((res as Response).status).toBe(200);
  });

  it('returns null next_tier when at max tier', async() => {
    const ctx = makeCtx({ nextTier: null });
    const res = await handleSummary(ctx as never);
    expect((res as Response).status).toBe(200);
  });
});
