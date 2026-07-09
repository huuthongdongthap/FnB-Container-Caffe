import { describe, it, expect } from 'vitest';
import { applyReferralForNewCustomer } from '../../../tree/referrals/apply-referral.js';
import { processReferralOnFirstOrder } from '../../../tree/referrals/process-referral.js';
import { processReferralCashbackOnFirstOrder } from '../../../tree/referrals/referral-cashback.js';
import { reverseReferralCashback } from '../../../tree/referrals/reverse-cashback.js';

// --- D1 mock helpers ---

// Minimal mock: every prepare/bind chain returns the same static rows
function makeD1(rows: unknown[] = []) {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => rows[0],
        all: async () => ({ results: rows }),
        run: async () => ({ changes: 1 }),
      }),
    }),
  } as unknown as D1Database;
}

type D1Row = Record<string, unknown>;

interface CallTracking {
  runCount: number;
  batchCount: number;
  lastRunSql: string;
  batchLengths: number[];
}

// Sequential mock: each .prepare().bind().first() consumes the next entry from an ordered queue.
// This prevents cross-test state and handles repeated .prepare() calls correctly.
function makeSeqD1(queue: Array<{ first?: D1Row | null; allResult?: { results: D1Row[] } }>, tracking: CallTracking) {
  let idx = 0;
  const db = {
    prepare: (_sql: string) => {
      const entry = queue[idx++] ?? {};
      const builder = {
        bind: () => ({
          first: async () => entry.first ?? null,
          all: async () => entry.allResult ?? { results: [] },
          run: async () => {
            tracking.runCount++;
            tracking.lastRunSql = _sql;
            return { changes: 1 };
          },
        }),
      };
      return builder as unknown as ReturnType<D1Database['prepare']>;
    },
    batch: async (stmts: ReturnType<D1Database['prepare']>[]) => {
      tracking.batchCount++;
      tracking.batchLengths.push(stmts.length);
      return stmts;
    },
  };
  return db as unknown as D1Database;
}

function freshTracking(): CallTracking {
  return { runCount: 0, batchCount: 0, lastRunSql: '', batchLengths: [] };
}

// ============================================================
// applyReferralForNewCustomer
// ============================================================
describe('applyReferralForNewCustomer', () => {
  const NEW_CUSTOMER_ID = 'cust_new_001';

  it('returns no_code when referral code is empty', async () => {
    const result = await applyReferralForNewCustomer(makeD1(), NEW_CUSTOMER_ID, '');
    expect(result).toEqual({ success: false, reason: 'no_code' });
  });

  it('returns invalid_code when referral code does not exist', async () => {
    const result = await applyReferralForNewCustomer(makeD1(), NEW_CUSTOMER_ID, 'GHOST');
    expect(result).toEqual({ success: false, reason: 'invalid_code' });
  });

  it('returns self_referral when code belongs to the same customer', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'rc_01', customer_id: NEW_CUSTOMER_ID } },
        { first: { id: 'ref_01', bonus_type: 'cashback' } },
        { first: { id: NEW_CUSTOMER_ID } },
      ],
      t,
    );
    const result = await applyReferralForNewCustomer(db, NEW_CUSTOMER_ID, 'SELF01');
    expect(result).toEqual({ success: false, reason: 'self_referral' });
  });

  it('returns no_pending_referral when customer has no pending referral', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'rc_01', customer_id: 'cust_ref_01' } },
        { first: null }, // no pending referral
        { first: { id: 'cust_ref_01' } }, // referrer lookup still runs? no, early return
      ],
      t,
    );
    const result = await applyReferralForNewCustomer(db, NEW_CUSTOMER_ID, 'OTHER01');
    expect(result).toEqual({ success: false, reason: 'no_pending_referral' });
  });

  it('returns already_processed_points when pending bonus_type is points', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'rc_01', customer_id: 'cust_ref_01' } },
        { first: { id: 'ref_01', bonus_type: 'points' } },
      ],
      t,
    );
    const result = await applyReferralForNewCustomer(db, NEW_CUSTOMER_ID, 'REF01');
    expect(result).toEqual({ success: false, reason: 'already_processed_points' });
  });

  it('trims and uppercases referral code before lookup', async () => {
    const t = freshTracking();
    // No matching code after normalization
    const db = makeSeqD1(
      [
        { first: null }, // no code found
      ],
      t,
    );
    const result = await applyReferralForNewCustomer(db, NEW_CUSTOMER_ID, '  lower-case  ');
    expect(result.reason).toBe('invalid_code');
  });

  it('success path creates referral and increments code usage', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'rc_01', customer_id: 'cust_ref_01' } },
        { first: { id: 'ref_01', bonus_type: 'cashback' } },
        { first: { id: 'cust_ref_01' } },
      ],
      t,
    );
    const result = await applyReferralForNewCustomer(db, NEW_CUSTOMER_ID, 'REF01');
    expect(result).toEqual({ success: true, referrer_cashback_pending: 10000 });
    expect(t.runCount).toBe(2); // INSERT referrals + UPDATE referral_codes
  });

  it('returns referrer_not_found when code owner customer is missing', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'rc_01', customer_id: 'cust_missing' } },
        { first: { id: 'ref_01', bonus_type: 'cashback' } },
        { first: null }, // referrer not found
      ],
      t,
    );
    const result = await applyReferralForNewCustomer(db, NEW_CUSTOMER_ID, 'REF01');
    expect(result).toEqual({ success: false, reason: 'referrer_not_found' });
  });
});

// ============================================================
// processReferralOnFirstOrder
// ============================================================
describe('processReferralOnFirstOrder', () => {
  const CUSTOMER_ID = 'cust_order_001';

  it('returns no_pending_referral when no pending referral exists', async () => {
    const db = makeD1([undefined]);
    const result = await processReferralOnFirstOrder(db, CUSTOMER_ID);
    expect(result).toEqual({ success: false, reason: 'no_pending_referral' });
  });

  it('returns referrer_not_found when referrer customer is missing', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'ref_01', referrer_id: 'missing_cust', referral_code: 'CODE01', points_awarded: 100, bonus_type: 'points', status: 'pending' } },
        { first: null },
      ],
      t,
    );
    const result = await processReferralOnFirstOrder(db, CUSTOMER_ID);
    expect(result).toEqual({ success: false, reason: 'referrer_not_found' });
  });

  it('success path awards points, updates loyalty, marks referral completed', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'ref_01', referrer_id: 'cust_ref_A', referral_code: 'CODE01', points_awarded: 100, bonus_type: 'points', status: 'pending' } },
        { first: { id: 'cust_ref_A', loyalty_points: 50, lifetime_points: 120, loyalty_tier: 'BASIC' } },
      ],
      t,
    );
    const result = await processReferralOnFirstOrder(db, CUSTOMER_ID);
    expect(result).toEqual({
      success: true,
      points_awarded: 100,
      new_balance: 150,
      new_lifetime_balance: 220,
    });
    expect(t.runCount).toBe(4); // UPDATE customers, INSERT log, UPDATE referrals, UPDATE referral_codes
  });

  it('uses default 100 points when points_awarded is null', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'ref_02', referrer_id: 'cust_ref_B', referral_code: 'CODE02', points_awarded: null, bonus_type: 'points', status: 'pending' } },
        { first: { id: 'cust_ref_B', loyalty_points: 0, lifetime_points: 0, loyalty_tier: 'BASIC' } },
      ],
      t,
    );
    const result = await processReferralOnFirstOrder(db, CUSTOMER_ID);
    expect(result).toEqual({
      success: true,
      points_awarded: 100,
      new_balance: 100,
      new_lifetime_balance: 100,
    });
    expect(t.runCount).toBe(4);
  });
});

// ============================================================
// processReferralCashbackOnFirstOrder
// ============================================================
describe('processReferralCashbackOnFirstOrder', () => {
  const CUSTOMER_ID = 'cust_cb_001';
  const ORDER_ID = 'ord_001';
  const ORDER_AMOUNT = 25000;

  it('returns order_below_min when order amount is under threshold', async () => {
    const db = makeD1();
    const result = await processReferralCashbackOnFirstOrder(db, CUSTOMER_ID, ORDER_ID, 15000);
    expect(result).toEqual({ success: false, reason: 'order_below_min', min_required: 20000 });
  });

  it('returns no_pending_referral when no pending referral', async () => {
    const db = makeD1([undefined]);
    const result = await processReferralCashbackOnFirstOrder(db, CUSTOMER_ID, ORDER_ID, ORDER_AMOUNT);
    expect(result).toEqual({ success: false, reason: 'no_pending_referral' });
  });

  it('returns already_processed_points when bonus_type is points', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'ref_01', referrer_id: 'cust_ref_01', bonus_type: 'points', status: 'pending', referral_code: 'REF01' } },
      ],
      t,
    );
    const result = await processReferralCashbackOnFirstOrder(db, CUSTOMER_ID, ORDER_ID, ORDER_AMOUNT);
    expect(result).toEqual({ success: false, reason: 'already_processed_points' });
  });

  it('returns referrer_not_found when referrer customer is missing', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'ref_01', referrer_id: 'cust_gone', bonus_type: 'cashback', status: 'pending' } },
        { first: null },
      ],
      t,
    );
    const result = await processReferralCashbackOnFirstOrder(db, CUSTOMER_ID, ORDER_ID, ORDER_AMOUNT);
    expect(result).toEqual({ success: false, reason: 'referrer_not_found' });
  });

  it('success: creates wallet if needed, awards 10000 VND, marks referral completed', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'ref_01', referrer_id: 'cust_ref_01', bonus_type: 'cashback', status: 'pending' } },
        { first: { id: 'cust_ref_01' } },
        { first: null }, // no wallet → insert
      ],
      t,
    );
    const result = await processReferralCashbackOnFirstOrder(db, CUSTOMER_ID, ORDER_ID, ORDER_AMOUNT);
    expect(result.success).toBe(true);
    expect(result.referrer_id).toBe('cust_ref_01');
    expect(result.cashback_awarded_vnd).toBe(10000);
    expect(result.new_balance).toBe(10000);
    expect(t.batchCount).toBe(1);
    // wallet insert + wallet update + tx insert + referral update + audit insert = 5
    expect(t.batchLengths[0]).toBe(5);
  });

  it('success: uses existing wallet without inserting new one', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: 'ref_01', referrer_id: 'cust_ref_01', bonus_type: 'cashback', status: 'pending' } },
        { first: { id: 'cust_ref_01' } },
        { first: { id: 'cbw_existing', balance: 5000, total_earned: 5000 } },
      ],
      t,
    );
    const result = await processReferralCashbackOnFirstOrder(db, CUSTOMER_ID, ORDER_ID, ORDER_AMOUNT);
    expect(result.success).toBe(true);
    expect(result.new_balance).toBe(15000); // 5000 + 10000
    expect(t.batchCount).toBe(1);
    // no wallet insert: wallet update + tx insert + referral update + audit insert = 4
    expect(t.batchLengths[0]).toBe(4);
  });
});

// ============================================================
// reverseReferralCashback
// ============================================================
describe('reverseReferralCashback', () => {
  const REFERRAL_ID = 'ref_rev_01';

  it('returns not_applicable when referral is not found', async () => {
    const db = makeD1([null]);
    const result = await reverseReferralCashback(db, REFERRAL_ID);
    expect(result).toEqual({ success: false, reason: 'not_applicable' });
  });

  it('returns not_applicable when referral has no cashback_awarded_vnd', async () => {
    const referral = { id: REFERRAL_ID, cashback_awarded_vnd: null, referrer_id: 'cust_ref_01' };
    const db = makeD1([referral]);
    const result = await reverseReferralCashback(db, REFERRAL_ID);
    expect(result).toEqual({ success: false, reason: 'not_applicable' });
  });

  it('success: creates wallet if needed, debits, creates transaction, marks reversed', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: REFERRAL_ID, cashback_awarded_vnd: 10000, referrer_id: 'cust_ref_01' } },
        { first: null }, // no wallet → insert in batch
      ],
      t,
    );
    const result = await reverseReferralCashback(db, REFERRAL_ID);
    expect(result.success).toBe(true);
    expect(result.debited_vnd).toBe(10000);
    expect(result.new_balance).toBe(0); // max(0, 0 - 10000)
    expect(t.batchCount).toBe(1);
    // wallet insert + wallet update + tx insert + referral update + audit insert = 5
    expect(t.batchLengths[0]).toBe(5);
  });

  it('success: uses existing wallet and computes correct new balance', async () => {
    const t = freshTracking();
    const db = makeSeqD1(
      [
        { first: { id: REFERRAL_ID, cashback_awarded_vnd: 10000, referrer_id: 'cust_ref_01' } },
        { first: { id: 'cbw_existing', balance: 20000 } },
      ],
      t,
    );
    const result = await reverseReferralCashback(db, REFERRAL_ID);
    expect(result.success).toBe(true);
    expect(result.new_balance).toBe(10000); // 20000 - 10000
    expect(t.batchCount).toBe(1);
    // No wallet insert: wallet update + tx insert + referral update + audit insert = 4
    expect(t.batchLengths[0]).toBe(4);
  });
});
