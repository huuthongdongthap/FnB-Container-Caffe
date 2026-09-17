import { describe, it, expect, beforeEach } from 'vitest';

import { loadPolicy, tierByName } from '../commands/loyalty-policy';
import { computeTier } from '../commands/compute-tier';
import { applyAccrual, MIN_ORDER_TO_EARN } from '../commands/accrual';
import { reverseAccrual } from '../commands/refund-reversal';
import type { LoyaltyPolicy, LoyaltyTierPolicy } from '../commands/loyalty-policy';

type Row = Record<string, unknown>;

interface Stmt {
  bind(...args: unknown[]): Stmt;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<{ success: boolean }>;
}

interface BatchCall {
  sql: string;
  params: unknown[];
}

function createMockDB(seed: Record<string, Row[]>, batchCapture?: BatchCall[]) {
  const store = new Map<string, Row[]>(Object.entries(seed));

  function matchSeed(sql: string): Row[] {
    for (const [key, rows] of store.entries()) {
      if (key.startsWith('__MATCH__')) {
        const literal = key.slice(9);
        if (sql.includes(literal)) return rows;
      }
    }
    return [];
  }

  const builder = {
    prepare(sql: string) {
      const stmt: Stmt = {
        bind(..._args: unknown[]) {
          return stmt;
        },
        async first<T = unknown>(): Promise<T | null> {
          const rows = matchSeed(sql);
          return rows.length > 0 ? (rows.shift() as T) : null;
        },
        async all<T = unknown>() {
          const rows = matchSeed(sql);
          return { results: rows as T[], success: true };
        },
        async run() {
          return { success: true };
        },
      };
      return stmt;
    },
    async batch(calls: { sql: string; bind: (...a: unknown[]) => unknown }[]) {
      if (batchCapture) {
        for (const c of calls) {
          batchCapture.push({ sql: c.sql, params: [] });
        }
      }
      return [];
    },
  };
  return builder as unknown as import('@cloudflare/workers-types').D1Database & {
    batch: (calls: unknown[]) => Promise<unknown[]>;
  };
}

function sqlMatch(literal: string): string {
  return `__MATCH__${literal}`;
}

function tierPolicy(name: string, minPoints: number, rate: number, mult: number, expiry = 365): LoyaltyTierPolicy {
  return { tierName: name, minPoints, cashbackRate: rate, pointMultiplier: mult, expiryDays: expiry };
}

const BASE_POLICY: LoyaltyPolicy = {
  tiers: [
    tierPolicy('bronze', 0, 0.03, 1.0),
    tierPolicy('silver', 50, 0.05, 1.1),
    tierPolicy('gold', 200, 0.07, 1.3),
    tierPolicy('platinum', 500, 0.1, 1.5),
  ],
  defaultTier: tierPolicy('bronze', 0, 0.03, 1.0),
  campaignMultiplier: 1.0,
  maxCapPerTx: 50_000,
  campaignCode: null,
  expiresAt: null,
};

describe('computeTier', () => {
  it('resolves bronze for 0 points', () => {
    const c = computeTier(0, 'bronze', BASE_POLICY);
    expect(c.tierName).toBe('bronze');
    expect(c.changed).toBe(false);
  });

  it('resolves silver at exact boundary 50', () => {
    const c = computeTier(50, 'bronze', BASE_POLICY);
    expect(c.tierName).toBe('silver');
    expect(c.changed).toBe(true);
  });

  it('resolves gold at 200', () => {
    const c = computeTier(200, 'silver', BASE_POLICY);
    expect(c.tierName).toBe('gold');
  });

  it('resolves platinum at 500', () => {
    const c = computeTier(500, 'gold', BASE_POLICY);
    expect(c.tierName).toBe('platinum');
  });

  it('returns next tier with points needed', () => {
    const c = computeTier(100, 'silver', BASE_POLICY);
    expect(c.tierName).toBe('silver');
    expect(c.nextTier).toEqual({ name: 'gold', minPoints: 200, pointsNeeded: 100 });
  });

  it('returns null next tier at platinum', () => {
    const c = computeTier(500, 'platinum', BASE_POLICY);
    expect(c.nextTier).toBeNull();
  });

  it('stays silver between 50 and 199', () => {
    const c = computeTier(199, 'bronze', BASE_POLICY);
    expect(c.tierName).toBe('silver');
  });
});

describe('applyAccrual', () => {
  beforeEach(() => {
    // nothing global — each test builds its own mock
  });

  it('rejects order below min threshold', async () => {
    const db = createMockDB({
      [sqlMatch('FROM orders WHERE id')]: [{ id: 'ord_1', total: 15_000, cashback_used: 0 }],
      [sqlMatch('cashback_transactions WHERE order_id')]: [],
    });
    const res = await applyAccrual(db, BASE_POLICY, {
      orderId: 'ord_1',
      customerId: 'cus_1',
      orderTotalVnd: 15_000,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('below_min_order');
  });

  it('accrues points with multiplier (1pt/10k × mult)', async () => {
    const batchCalls: BatchCall[] = [];
    const db = createMockDB(
      {
        [sqlMatch('FROM orders WHERE id')]: [{ id: 'ord_1', total: 100_000, cashback_used: 0 }],
        [sqlMatch('cashback_transactions WHERE order_id')]: [],
        [sqlMatch('FROM customers WHERE id')]: [{
          id: 'cus_1', loyalty_points: 10, lifetime_points: 10, loyalty_tier: 'bronze',
        }],
        [sqlMatch('FROM cashback_wallets WHERE customer_id')]: [{ id: 'wal_1', balance: 0 }],
      },
      batchCalls,
    );
    const res = await applyAccrual(db, BASE_POLICY, {
      orderId: 'ord_1',
      customerId: 'cus_1',
      orderTotalVnd: 100_000,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      // 100000 / 10000 * 1.0 (bronze mult) = 10 points
      expect(res.points).toBe(10);
      // cashback: round(100000 * 0.03 * 1.0) = 3000
      expect(res.cashback).toBe(3000);
      expect(res.walletBalance).toBe(3000);
    }
  });

  it('applies silver multiplier correctly', async () => {
    const db = createMockDB({
      [sqlMatch('FROM orders WHERE id')]: [{ id: 'ord_1', total: 100_000, cashback_used: 0 }],
      [sqlMatch('cashback_transactions WHERE order_id')]: [],
      [sqlMatch('FROM customers WHERE id')]: [{
        id: 'cus_1', loyalty_points: 0, lifetime_points: 60, loyalty_tier: 'silver',
      }],
      [sqlMatch('FROM cashback_wallets WHERE customer_id')]: [{ id: 'wal_1', balance: 0 }],
    });
    const res = await applyAccrual(db, BASE_POLICY, {
      orderId: 'ord_1',
      customerId: 'cus_1',
      orderTotalVnd: 100_000,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      // 100000 / 10000 * 1.1 = 11 points
      expect(res.points).toBe(11);
      // cashback: round(100000 * 0.05 * 1.0) = 5000
      expect(res.cashback).toBe(5000);
    }
  });

  it('caps cashback at maxCap', async () => {
    const db = createMockDB({
      [sqlMatch('FROM orders WHERE id')]: [{ id: 'ord_1', total: 10_000_000, cashback_used: 0 }],
      [sqlMatch('cashback_transactions WHERE order_id')]: [],
      [sqlMatch('FROM customers WHERE id')]: [{
        id: 'cus_1', loyalty_points: 0, lifetime_points: 600, loyalty_tier: 'platinum',
      }],
      [sqlMatch('FROM cashback_wallets WHERE customer_id')]: [{ id: 'wal_1', balance: 0 }],
    });
    const res = await applyAccrual(db, BASE_POLICY, {
      orderId: 'ord_1',
      customerId: 'cus_1',
      orderTotalVnd: 10_000_000,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      // 10M * 0.1 = 1M raw, capped at 50k
      expect(res.cashback).toBe(50_000);
    }
  });

  it('idempotent — skips if earn transaction exists', async () => {
    const db = createMockDB({
      [sqlMatch('FROM orders WHERE id')]: [{ id: 'ord_1', total: 100_000, cashback_used: 0 }],
      [sqlMatch('cashback_transactions WHERE order_id')]: [{ id: 'cbt_old' }],
    });
    const res = await applyAccrual(db, BASE_POLICY, {
      orderId: 'ord_1',
      customerId: 'cus_1',
      orderTotalVnd: 100_000,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('already_processed');
  });

  it('upgrades tier when lifetime_points crosses threshold', async () => {
    const db = createMockDB({
      [sqlMatch('FROM orders WHERE id')]: [{ id: 'ord_1', total: 5_000_000, cashback_used: 0 }],
      [sqlMatch('cashback_transactions WHERE order_id')]: [],
      [sqlMatch('FROM customers WHERE id')]: [{
        id: 'cus_1', loyalty_points: 0, lifetime_points: 0, loyalty_tier: 'bronze',
      }],
      [sqlMatch('FROM cashback_wallets WHERE customer_id')]: [{ id: 'wal_1', balance: 0 }],
    });
    const res = await applyAccrual(db, BASE_POLICY, {
      orderId: 'ord_1',
      customerId: 'cus_1',
      orderTotalVnd: 5_000_000,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      // 5M/10k * 1.0 = 500 lifetime → platinum
      expect(res.lifetimePoints).toBe(500);
      expect(res.tier).toBe('platinum');
      expect(res.tierUpgraded).toBe(true);
    }
  });
});

describe('reverseAccrual', () => {
  it('skips if reversal already exists', async () => {
    const db = createMockDB({
      [sqlMatch('reason')]: [{ id: 'ptl_old' }],
    });
    const res = await reverseAccrual(db, BASE_POLICY, {
      orderId: 'ord_1',
      customerId: 'cus_1',
      refundAmountVnd: 100_000,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('already_reversed');
  });

  it('deducts points proportionally for partial refund', async () => {
    const db = createMockDB({
      [sqlMatch('reason')]: [],
      [sqlMatch('SELECT total, points_earned FROM orders')]: [{ total: 200_000, points_earned: 20 }],
      [sqlMatch('FROM customers WHERE id')]: [{
        id: 'cus_1', loyalty_points: 100, lifetime_points: 100, loyalty_tier: 'silver',
      }],
    });
    const res = await reverseAccrual(db, BASE_POLICY, {
      orderId: 'ord_1',
      customerId: 'cus_1',
      refundAmountVnd: 100_000,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      // ratio = 100k/200k = 0.5; pointsToDeduct = max(1, round(20 * 0.5)) = 10
      expect(res.pointsDeducted).toBe(10);
      expect(res.newLifetimePoints).toBe(90);
    }
  });

  it('full refund deducts all points', async () => {
    const db = createMockDB({
      [sqlMatch('reason')]: [],
      [sqlMatch('SELECT total, points_earned FROM orders')]: [{ total: 100_000, points_earned: 10 }],
      [sqlMatch('FROM customers WHERE id')]: [{
        id: 'cus_1', loyalty_points: 50, lifetime_points: 50, loyalty_tier: 'silver',
      }],
    });
    const res = await reverseAccrual(db, BASE_POLICY, {
      orderId: 'ord_1',
      customerId: 'cus_1',
      refundAmountVnd: 100_000,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.pointsDeducted).toBe(10);
      expect(res.newLifetimePoints).toBe(40);
    }
  });

  it('downgrades tier when lifetime_points drop below threshold', async () => {
    const db = createMockDB({
      [sqlMatch('reason')]: [],
      [sqlMatch('SELECT total, points_earned FROM orders')]: [{ total: 5_000_000, points_earned: 500 }],
      [sqlMatch('FROM customers WHERE id')]: [{
        id: 'cus_1', loyalty_points: 600, lifetime_points: 500, loyalty_tier: 'platinum',
      }],
    });
    const res = await reverseAccrual(db, BASE_POLICY, {
      orderId: 'ord_1',
      customerId: 'cus_1',
      refundAmountVnd: 5_000_000,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.newLifetimePoints).toBe(0);
      expect(res.tierDowngraded).toBe(true);
      expect(res.newTier).toBe('bronze');
    }
  });
});

describe('loadPolicy', () => {
  it('falls back to safe defaults when tiers table empty', async () => {
    const db = createMockDB({});
    const policy = await loadPolicy(db);
    expect(policy.tiers).toEqual([]);
    expect(policy.defaultTier.tierName).toBe('bronze');
    expect(policy.campaignMultiplier).toBe(1.0);
  });

  it('loads tiers sorted by min_points', async () => {
    const db = createMockDB({
      [sqlMatch('FROM loyalty_tiers ORDER BY min_points')]: [
        { tier_name: 'bronze', min_points: 0, cashback_rate: 0.03, point_multiplier: 1.0, expiry_days: 365 },
        { tier_name: 'silver', min_points: 50, cashback_rate: 0.05, point_multiplier: 1.1, expiry_days: 365 },
      ],
    });
    const policy = await loadPolicy(db);
    expect(policy.tiers).toHaveLength(2);
    expect(policy.tiers[0].tierName).toBe('bronze');
    expect(policy.tiers[1].tierName).toBe('silver');
  });
});

describe('tierByName', () => {
  it('returns matching tier', () => {
    const t = tierByName(BASE_POLICY, 'gold');
    expect(t.tierName).toBe('gold');
    expect(t.cashbackRate).toBe(0.07);
  });

  it('falls back to default for unknown name', () => {
    const t = tierByName(BASE_POLICY, 'nonexistent');
    expect(t.tierName).toBe('bronze');
  });
});
