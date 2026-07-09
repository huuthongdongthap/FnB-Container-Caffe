import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../middleware/logger.js', () => ({
  createLogger: () => ({
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
    child: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} })
  })
}));
vi.mock('../../lib/metrics-collector.js', () => ({
  createMetricsCollector: () => ({
    recordMetric: async() => {}, recordAlert: async() => null,
    markAlertDispatched: async() => {}, pruneOldMetrics: async() => 0
  })
}));
import { processReferralOnFirstOrder } from '../../../tree/referrals/process-referral.js';
import { createMockDB } from '../../test-utils.js';

// ===========================================================================
// Shared mutable state - tests set entries before calling the function.
//
// process-referral.ts executes these SQLs:
// S1: SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?
// S2: SELECT id, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = ?
// S3: UPDATE customers SET loyalty_points = ?, lifetime_points = ?, updated_at = ? WHERE id = ?
// S4: INSERT INTO loyalty_point_logs (...)  (run)
// S5: UPDATE referrals SET status = ?, bonus_type = ? WHERE id = ? (run)
// S6: UPDATE referral_codes SET total_points_earned = total_points_earned + ? WHERE code = ? (run)
// ===========================================================================

const firstReturn = new Map<string, unknown>();
const SQL_PENDING = 'SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?';
const SQL_REFERRER = 'SELECT id, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = ?';

describe('processReferralOnFirstOrder', () => {
  beforeEach(() => {
    firstReturn.clear();
  });

  function makeDB(): ReturnType<typeof createMockDB> {
    const db = createMockDB();
    const pool = new Map<string, Record<string, unknown>>();

    function getStmt(sql: string): Record<string, unknown> {
      let s = pool.get(sql);
      if (!s) {
        const binds: unknown[] = [];
        s = {
          _sql: sql, _binds: binds,
          bind(...a: unknown[]) {
            binds.push(...a); return s;
          },
          async first<T = unknown>() {
            const v = firstReturn.get(sql); return (v === undefined ? null : v) as T;
          },
          async run() {
            return { success: true, changes: 1 } as never;
          },
          all: async() => ({ results: [] as never, success: true } as never),
          raw: async() => [] as never
        };
        pool.set(sql, s);
      }
      return s;
    }
    getStmt(SQL_PENDING); getStmt(SQL_REFERRER);
    db.prepare = ((sql: string) => getStmt(sql)) as typeof db.prepare;
    return db;
  }

  it('returns success with awarded points when preconditions are met', async() => {
    firstReturn.set(SQL_PENDING, {
      id: 'ref-1', referrer_id: 'referrer-1', referred_customer_id: 'customer-1',
      referral_code: 'TEST2024', points_awarded: 150, status: 'pending', bonus_type: 'points',
      created_at: '2026-01-01T00:00:00Z'
    });
    firstReturn.set(SQL_REFERRER, {
      id: 'referrer-1', loyalty_points: 500, lifetime_points: 1200, loyalty_tier: 'BASIC'
    });
    const db = makeDB();
    const result = await processReferralOnFirstOrder(db, 'customer-1');
    expect((result as Record<string, unknown>).success).toBe(true);
    expect((result as Record<string, unknown>).points_awarded).toBe(150);
    expect((result as Record<string, unknown>).new_balance).toBe(650);
    expect((result as Record<string, unknown>).new_lifetime_balance).toBe(1350);
  });

  it('returns no_pending_referral when no pending referral', async() => {
    firstReturn.set(SQL_PENDING, null);
    const db = makeDB();
    const result = await processReferralOnFirstOrder(db, 'customer-1');
    expect(result).toEqual({ success: false, reason: 'no_pending_referral' });
  });

  it('returns referrer_not_found when referrer customer is missing', async() => {
    firstReturn.set(SQL_PENDING, {
      id: 'ref-1', referrer_id: 'ghost', referred_customer_id: 'customer-1',
      referral_code: 'TEST2024', points_awarded: 100, status: 'pending', bonus_type: 'points',
      created_at: '2026-01-01T00:00:00Z'
    });
    firstReturn.set(SQL_REFERRER, null);
    const db = makeDB();
    const result = await processReferralOnFirstOrder(db, 'customer-1');
    expect(result).toEqual({ success: false, reason: 'referrer_not_found' });
  });

  it('falls back to 100 points when pending.points_awarded is 0', async() => {
    firstReturn.set(SQL_PENDING, {
      id: 'ref-1', referrer_id: 'referrer-1', referred_customer_id: 'customer-1',
      referral_code: 'TEST2024', points_awarded: 0, status: 'pending', bonus_type: 'points',
      created_at: '2026-01-01T00:00:00Z'
    });
    firstReturn.set(SQL_REFERRER, {
      id: 'referrer-1', loyalty_points: 200, lifetime_points: 500, loyalty_tier: 'BASIC'
    });
    const db = makeDB();
    const result = await processReferralOnFirstOrder(db, 'customer-1');
    expect((result as Record<string, unknown>).success).toBe(true);
    expect((result as Record<string, unknown>).points_awarded).toBe(100);
    expect((result as Record<string, unknown>).new_balance).toBe(300);
    expect((result as Record<string, unknown>).new_lifetime_balance).toBe(600);
  });

  it('uses pending.points_awarded directly when positive', async() => {
    firstReturn.set(SQL_PENDING, {
      id: 'ref-1', referrer_id: 'referrer-1', referred_customer_id: 'customer-1',
      referral_code: 'TEST2024', points_awarded: 250, status: 'pending', bonus_type: 'points',
      created_at: '2026-01-01T00:00:00Z'
    });
    firstReturn.set(SQL_REFERRER, {
      id: 'referrer-1', loyalty_points: 0, lifetime_points: 0, loyalty_tier: 'BASIC'
    });
    const db = makeDB();
    const result = await processReferralOnFirstOrder(db, 'customer-1');
    expect((result as Record<string, unknown>).success).toBe(true);
    expect((result as Record<string, unknown>).points_awarded).toBe(250);
    expect((result as Record<string, unknown>).new_balance).toBe(250);
    expect((result as Record<string, unknown>).new_lifetime_balance).toBe(250);
  });

  it('treats null loyalty_points as 0', async() => {
    firstReturn.set(SQL_PENDING, {
      id: 'ref-1', referrer_id: 'referrer-1', referred_customer_id: 'customer-1',
      referral_code: 'TEST2024', points_awarded: 100, status: 'pending', bonus_type: 'points',
      created_at: '2026-01-01T00:00:00Z'
    });
    firstReturn.set(SQL_REFERRER, {
      id: 'referrer-1', loyalty_points: null, lifetime_points: null, loyalty_tier: 'BASIC'
    });
    const db = makeDB();
    const result = await processReferralOnFirstOrder(db, 'customer-1');
    expect((result as Record<string, unknown>).success).toBe(true);
    expect((result as Record<string, unknown>).new_balance).toBe(100);
    expect((result as Record<string, unknown>).new_lifetime_balance).toBe(100);
  });

  it('processes referral regardless of bonus_type', async() => {
    firstReturn.set(SQL_PENDING, {
      id: 'ref-1', referrer_id: 'referrer-1', referred_customer_id: 'customer-1',
      referral_code: 'TEST2024', points_awarded: 50, status: 'pending', bonus_type: 'cashback',
      created_at: '2026-01-01T00:00:00Z'
    });
    firstReturn.set(SQL_REFERRER, {
      id: 'referrer-1', loyalty_points: 300, lifetime_points: 800, loyalty_tier: 'BASIC'
    });
    const db = makeDB();
    const result = await processReferralOnFirstOrder(db, 'customer-1');
    expect((result as Record<string, unknown>).success).toBe(true);
    expect((result as Record<string, unknown>).points_awarded).toBe(50);
    expect((result as Record<string, unknown>).new_balance).toBe(350);
  });
});
