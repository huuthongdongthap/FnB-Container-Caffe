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

import { processReferralCashbackOnFirstOrder } from '../../../tree/referrals/referral-cashback.js';
import { createMockDB } from '../../test-utils.js';

const firstReturn = new Map<string, unknown>();
const SQL_PENDING = 'SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?';
const SQL_CUSTOMER = 'SELECT id FROM customers WHERE id = ?';
const SQL_WALLET = 'SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ?';

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
          const v = firstReturn.get(sql);
          return (v === undefined ? null : v) as T;
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

  getStmt(SQL_PENDING);
  getStmt(SQL_CUSTOMER);
  getStmt(SQL_WALLET);

  db.prepare = ((sql: string) => getStmt(sql)) as typeof db.prepare;
  return db;
}

describe('processReferralCashbackOnFirstOrder', () => {
  beforeEach(() => {
    firstReturn.clear();
  });

  it('returns order_below_min when under threshold', async() => {
    const db = makeDB();
    const result = await processReferralCashbackOnFirstOrder(db, 'cust-1', 'ord-1', 15000);
    expect(result).toEqual({ success: false, reason: 'order_below_min', min_required: 20000 });
  });

  it('rejects at 19999 but accepts at 20000', async() => {
    firstReturn.set(SQL_PENDING, { id: 'ref-1', referrer_id: 'ref-1', referred_customer_id: 'cust-1', status: 'pending', bonus_type: 'cashback', created_at: '2026-01-01T00:00:00Z' });
    firstReturn.set(SQL_CUSTOMER, { id: 'ref-1' });
    firstReturn.set(SQL_WALLET, { id: 'w1', customer_id: 'ref-1', balance: 0, total_earned: 0, total_spent: 0 });
    const db1 = makeDB();
    const r1 = await processReferralCashbackOnFirstOrder(db1, 'cust-1', 'ord-1', 19999);
    expect((r1 as Record<string, unknown>).success).toBe(false);
    const db2 = makeDB();
    const r2 = await processReferralCashbackOnFirstOrder(db2, 'cust-1', 'ord-1', 20000);
    expect((r2 as Record<string, unknown>).success).toBe(true);
  });

  it('awards 10000 VND to existing wallet', async() => {
    firstReturn.set(SQL_PENDING, { id: 'ref-1', referrer_id: 'ref-1', referred_customer_id: 'cust-1', referral_code: 'XYZ', points_awarded: 0, cashback_awarded_vnd: 0, status: 'pending', bonus_type: 'cashback', created_at: '2026-01-01T00:00:00Z' });
    firstReturn.set(SQL_CUSTOMER, { id: 'ref-1' });
    firstReturn.set(SQL_WALLET, { id: 'w1', customer_id: 'ref-1', balance: 50000, total_earned: 50000, total_spent: 0 });
    const db = makeDB();
    const result = await processReferralCashbackOnFirstOrder(db, 'cust-1', 'ord-1', 25000);
    const r = result as Record<string, unknown>;
    expect(r.success).toBe(true);
    expect(r.referrer_id).toBe('ref-1');
    expect(r.cashback_awarded_vnd).toBe(10000);
    expect(r.new_balance).toBe(60000);
  });

  it('returns no_pending_referral when none exists', async() => {
    firstReturn.set(SQL_PENDING, null);
    firstReturn.set(SQL_CUSTOMER, { id: 'ref-1' });
    firstReturn.set(SQL_WALLET, { id: 'w1', customer_id: 'ref-1', balance: 50000, total_earned: 50000 });
    const db = makeDB();
    const result = await processReferralCashbackOnFirstOrder(db, 'cust-1', 'ord-1', 25000);
    expect(result).toEqual({ success: false, reason: 'no_pending_referral' });
  });

  it('creates wallet with 10000 balance when none exists', async() => {
    firstReturn.set(SQL_PENDING, { id: 'ref-1', referrer_id: 'ref-1', referred_customer_id: 'cust-1', referral_code: 'XYZ', points_awarded: 0, cashback_awarded_vnd: 0, status: 'pending', bonus_type: 'cashback', created_at: '2026-01-01T00:00:00Z' });
    firstReturn.set(SQL_CUSTOMER, { id: 'ref-1' });
    firstReturn.set(SQL_WALLET, null);
    const db = makeDB();
    const result = await processReferralCashbackOnFirstOrder(db, 'cust-1', 'ord-1', 25000);
    const r = result as Record<string, unknown>;
    expect(r.success).toBe(true);
    expect(r.new_balance).toBe(10000);
  });

  it('adds correctly when wallet balance is 0', async() => {
    firstReturn.set(SQL_PENDING, { id: 'ref-1', referrer_id: 'ref-1', referred_customer_id: 'cust-1', referral_code: 'XYZ', points_awarded: 0, cashback_awarded_vnd: 0, status: 'pending', bonus_type: 'cashback', created_at: '2026-01-01T00:00:00Z' });
    firstReturn.set(SQL_CUSTOMER, { id: 'ref-1' });
    firstReturn.set(SQL_WALLET, { id: 'w1', customer_id: 'ref-1', balance: 0, total_earned: 0, total_spent: 0 });
    const db = makeDB();
    const result = await processReferralCashbackOnFirstOrder(db, 'cust-1', 'ord-1', 25000);
    const r = result as Record<string, unknown>;
    expect(r.success).toBe(true);
    expect(r.new_balance).toBe(10000);
  });

  it('returns referrer_not_found when referrer is missing', async() => {
    firstReturn.set(SQL_PENDING, { id: 'ref-1', referrer_id: 'ghost', referred_customer_id: 'cust-1', referral_code: 'XYZ', points_awarded: 0, cashback_awarded_vnd: 0, status: 'pending', bonus_type: 'cashback', created_at: '2026-01-01T00:00:00Z' });
    firstReturn.set(SQL_CUSTOMER, null);
    const db = makeDB();
    const result = await processReferralCashbackOnFirstOrder(db, 'cust-1', 'ord-1', 25000);
    expect(result).toEqual({ success: false, reason: 'referrer_not_found' });
  });
});
