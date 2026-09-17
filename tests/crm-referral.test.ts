/**
 * CRM Referral Tests — Phase 04
 *
 * Unit tests for referral-policy (pure) + referral operations (mock D1).
 */
import { describe, test, expect, vi } from 'vitest';

vi.mock('worker/src/middleware/logger', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => ({}),
  }),
}));

// ─── mock D1 ────────────────────────────────────────────────────────────

function createMockD1(seed: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    customers: [...(seed.customers || [])],
    referral_codes: [...(seed.referral_codes || [])],
    referrals: [...(seed.referrals || [])],
    cashback_wallets: [...(seed.cashback_wallets || [])],
    cashback_transactions: [...(seed.cashback_transactions || [])],
    loyalty_point_logs: [...(seed.loyalty_point_logs || [])],
    loyalty_audit_log: [...(seed.loyalty_audit_log || [])],
  };

  return {
    batch: async () => [],
    prepare: (sql: string) => ({
      bind: (..._args: any[]) => ({
        first: async <T>() => {
          // SELECT * FROM referral_codes WHERE code = ?
          if (sql.includes('FROM referral_codes') && sql.includes('WHERE code =')) {
            return (tables.referral_codes.find((r) => r.code === _args[0]) ?? null) as T;
          }
          // SELECT * FROM referral_codes WHERE customer_id = ?
          if (sql.includes('FROM referral_codes') && sql.includes('WHERE customer_id =')) {
            return (tables.referral_codes.find((r) => r.customer_id === _args[0]) ?? null) as T;
          }
          // SELECT * FROM referrals WHERE referred_customer_id = ? AND status = 'pending'
          if (sql.includes('FROM referrals') && sql.includes('WHERE referred_customer_id') && !sql.includes('COUNT')) {
            return (tables.referrals.find((r) => r.referred_customer_id === _args[0] && r.status === 'pending') ?? null) as T;
          }
          // SELECT * FROM referrals WHERE id = ? AND status = 'completed'
          if (sql.includes('FROM referrals') && sql.includes('WHERE id =')) {
            return (tables.referrals.find((r) => r.id === _args[0] && r.status === 'completed') ?? null) as T;
          }
          // SELECT * FROM customers WHERE id = ?
          if (sql.includes('FROM customers') && sql.includes('WHERE id =')) {
            return (tables.customers.find((c) => c.id === _args[0]) ?? null) as T;
          }
          // SELECT * FROM cashback_wallets WHERE customer_id = ?
          if (sql.includes('FROM cashback_wallets') && sql.includes('WHERE customer_id =')) {
            return (tables.cashback_wallets.find((w) => w.customer_id === _args[0]) ?? null) as T;
          }
          // SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status IN (?, ?)
          if (sql.includes('COUNT(*)') && sql.includes('FROM referrals') && sql.includes('status IN')) {
            const cnt = tables.referrals.filter((r) => r.referrer_id === _args[0] && (r.status === 'completed' || r.status === 'pending')).length;
            return { cnt } as T;
          }
          // SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status = 'pending'
          if (sql.includes('COUNT(*)') && sql.includes("status = 'pending'")) {
            const cnt = tables.referrals.filter((r) => r.referrer_id === _args[0] && r.status === 'pending').length;
            return { cnt } as T;
          }
          // SELECT COALESCE(SUM(cashback_awarded_vnd), 0) as total FROM referrals
          if (sql.includes('SUM(cashback_awarded_vnd)')) {
            const total = tables.referrals.filter((r) => r.referrer_id === _args[0] && r.status === 'completed').reduce((s, r) => s + (r.cashback_awarded_vnd || 0), 0);
            return { total } as T;
          }
          return null as T;
        },
        all: async <T>() => ({ results: [] as T[] }),
        run: async () => ({}),
      }),
    }),
  } as unknown as D1Database;
}

// ─── referral-policy pure tests ─────────────────────────────────────────

describe('resolveReferralPolicy (pure)', async () => {
  const { resolveReferralPolicy, DEFAULT_REFERRAL_POLICY } = await import('../packages/domain/crm/commands/referral-policy');

  test('returns defaults when KV is undefined', async () => {
    const result = await resolveReferralPolicy(undefined);
    expect(result).toEqual(DEFAULT_REFERRAL_POLICY);
  });

  test('returns defaults when KV has no key', async () => {
    const kv = { get: async () => null } as any;
    const result = await resolveReferralPolicy(kv);
    expect(result).toEqual(DEFAULT_REFERRAL_POLICY);
  });

  test('KV override merges over defaults', async () => {
    const kv = { get: async () => JSON.stringify({ bonusType: 'points', pointsReferrer: 200 }) } as any;
    const result = await resolveReferralPolicy(kv);
    expect(result.bonusType).toBe('points');
    expect(result.pointsReferrer).toBe(200);
    expect(result.cashbackReferrerVnd).toBe(DEFAULT_REFERRAL_POLICY.cashbackReferrerVnd);
  });

  test('falls back to defaults on invalid JSON', async () => {
    const kv = { get: async () => 'not json' } as any;
    const result = await resolveReferralPolicy(kv);
    expect(result).toEqual(DEFAULT_REFERRAL_POLICY);
  });
});

// ─── redeemReferral tests ───────────────────────────────────────────────

describe('redeemReferral', async () => {
  const { redeemReferral } = await import('../packages/domain/crm/commands/referral');

  test('rejects invalid code', async () => {
    const db = createMockD1();
    const result = await redeemReferral(db, 'INVALID', 'cust_1');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_code');
  });

  test('rejects self-referral', async () => {
    const db = createMockD1({
      referral_codes: [{ id: 'rc_1', customer_id: 'cust_1', code: 'ABC123', times_used: 0, total_points_earned: 0, total_cashback_earned_vnd: 0 }],
    });
    const result = await redeemReferral(db, 'ABC123', 'cust_1');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('self_referral');
  });

  test('creates pending referral on valid code', async () => {
    const db = createMockD1({
      referral_codes: [{ id: 'rc_1', customer_id: 'cust_1', code: 'ABC123', times_used: 0, total_points_earned: 0, total_cashback_earned_vnd: 0 }],
      customers: [{ id: 'cust_1', name: 'Referrer', phone: '0901' }],
    });
    const result = await redeemReferral(db, 'ABC123', 'cust_2');
    expect(result.success).toBe(true);
    expect(result.referrer_id).toBe('cust_1');
    expect(result.referee_id).toBe('cust_2');
  });

  test('rejects when referee already has pending referral', async () => {
    const db = createMockD1({
      referral_codes: [{ id: 'rc_1', customer_id: 'cust_1', code: 'ABC123', times_used: 0, total_points_earned: 0, total_cashback_earned_vnd: 0 }],
      customers: [{ id: 'cust_1', name: 'Referrer', phone: '0901' }],
      referrals: [{ id: 'ref_1', referrer_id: 'cust_1', referred_customer_id: 'cust_2', referral_code: 'ABC123', points_awarded: 100, cashback_awarded_vnd: 10000, first_order_id: null, first_order_amount: null, status: 'pending', bonus_type: 'cashback', reward_paid_at: null, created_at: '2026-09-01T00:00:00Z' }],
    });
    const result = await redeemReferral(db, 'ABC123', 'cust_2');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_has_pending_referral');
  });
});

// ─── rewardReferralOnFirstOrder tests ───────────────────────────────────

describe('rewardReferralOnFirstOrder', async () => {
  const { rewardReferralOnFirstOrder } = await import('../packages/domain/crm/commands/referral');

  test('returns no_pending_referral when none exists', async () => {
    const db = createMockD1();
    const result = await rewardReferralOnFirstOrder(db, 'cust_2', 'ord_1', 50000);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_pending_referral');
  });

  test('awards cashback on qualifying order', async () => {
    const db = createMockD1({
      customers: [{ id: 'cust_1', name: 'Referrer', phone: '0901', loyalty_points: 0, lifetime_points: 0, loyalty_tier: 'bronze' }],
      referrals: [{ id: 'ref_1', referrer_id: 'cust_1', referred_customer_id: 'cust_2', referral_code: 'ABC123', points_awarded: 100, cashback_awarded_vnd: 10000, first_order_id: null, first_order_amount: null, status: 'pending', bonus_type: 'cashback', reward_paid_at: null, created_at: '2026-09-01T00:00:00Z' }],
      cashback_wallets: [{ id: 'cbw_1', customer_id: 'cust_1', balance: 0, total_earned: 0, total_spent: 0, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }],
    });
    const result = await rewardReferralOnFirstOrder(db, 'cust_2', 'ord_1', 50000);
    expect(result.success).toBe(true);
    expect(result.reward_vnd).toBe(10000);
  });

  test('rejects order below minimum', async () => {
    const db = createMockD1({
      customers: [{ id: 'cust_1', name: 'Referrer', phone: '0901', loyalty_points: 0, lifetime_points: 0, loyalty_tier: 'bronze' }],
      referrals: [{ id: 'ref_1', referrer_id: 'cust_1', referred_customer_id: 'cust_2', referral_code: 'ABC123', points_awarded: 100, cashback_awarded_vnd: 10000, first_order_id: null, first_order_amount: null, status: 'pending', bonus_type: 'cashback', reward_paid_at: null, created_at: '2026-09-01T00:00:00Z' }],
    });
    const result = await rewardReferralOnFirstOrder(db, 'cust_2', 'ord_1', 10000);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('order_below_min');
  });

  test('awards points when policy is points mode', async () => {
    const db = createMockD1({
      customers: [{ id: 'cust_1', name: 'Referrer', phone: '0901', loyalty_points: 50, lifetime_points: 50, loyalty_tier: 'bronze' }],
      referrals: [{ id: 'ref_1', referrer_id: 'cust_1', referred_customer_id: 'cust_2', referral_code: 'ABC123', points_awarded: 100, cashback_awarded_vnd: 10000, first_order_id: null, first_order_amount: null, status: 'pending', bonus_type: 'points', reward_paid_at: null, created_at: '2026-09-01T00:00:00Z' }],
    });
    const policy = { bonusType: 'points' as const, pointsReferrer: 100, pointsReferee: 50, cashbackReferrerVnd: 10000, cashbackRefereeVnd: 5000, minOrderVnd: 20000 };
    const result = await rewardReferralOnFirstOrder(db, 'cust_2', 'ord_1', 50000, policy);
    expect(result.success).toBe(true);
    expect(result.reward_points).toBe(100);
    expect(result.new_balance).toBe(150);
  });
});

// ─── reverseReferralCashback tests ──────────────────────────────────────

describe('reverseReferralCashback', async () => {
  const { reverseReferralCashback } = await import('../packages/domain/crm/commands/referral');

  test('returns not_applicable for non-completed referral', async () => {
    const db = createMockD1();
    const result = await reverseReferralCashback(db, 'ref_1');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_applicable');
  });

  test('reverses completed cashback referral', async () => {
    const db = createMockD1({
      referrals: [{ id: 'ref_1', referrer_id: 'cust_1', referred_customer_id: 'cust_2', referral_code: 'ABC123', points_awarded: 0, cashback_awarded_vnd: 10000, first_order_id: 'ord_1', first_order_amount: 50000, status: 'completed', bonus_type: 'cashback', reward_paid_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z' }],
      cashback_wallets: [{ id: 'cbw_1', customer_id: 'cust_1', balance: 10000, total_earned: 10000, total_spent: 0, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }],
    });
    const result = await reverseReferralCashback(db, 'ref_1');
    expect(result.success).toBe(true);
    expect(result.referrer_id).toBe('cust_1');
  });
});

// ─── getReferralStatus tests ────────────────────────────────────────────

describe('getReferralStatus', async () => {
  const { getReferralStatus } = await import('../packages/domain/crm/commands/referral');

  test('returns zero status for customer with no referrals', async () => {
    const db = createMockD1();
    const result = await getReferralStatus(db, 'cust_1');
    expect(result.code).toBeNull();
    expect(result.total_referrals).toBe(0);
    expect(result.pending_count).toBe(0);
  });

  test('returns status with code and counts', async () => {
    const db = createMockD1({
      referral_codes: [{ id: 'rc_1', customer_id: 'cust_1', code: 'ABC123', times_used: 3, total_points_earned: 0, total_cashback_earned_vnd: 20000 }],
      referrals: [
        { id: 'ref_1', referrer_id: 'cust_1', referred_customer_id: 'cust_2', referral_code: 'ABC123', points_awarded: 0, cashback_awarded_vnd: 10000, first_order_id: 'ord_1', first_order_amount: 50000, status: 'completed', bonus_type: 'cashback', reward_paid_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z' },
        { id: 'ref_2', referrer_id: 'cust_1', referred_customer_id: 'cust_3', referral_code: 'ABC123', points_awarded: 0, cashback_awarded_vnd: 10000, first_order_id: null, first_order_amount: null, status: 'pending', bonus_type: 'cashback', reward_paid_at: null, created_at: '2026-09-02T00:00:00Z' },
      ],
    });
    const result = await getReferralStatus(db, 'cust_1');
    expect(result.code).toBe('ABC123');
    expect(result.total_referrals).toBe(2);
    expect(result.pending_count).toBe(1);
    expect(result.total_cashback_earned_vnd).toBe(10000);
    expect(result.code_usage).toBe(3);
  });
});

// ─── getOrCreateReferralCode tests ──────────────────────────────────────

describe('getOrCreateReferralCode', async () => {
  const { getOrCreateReferralCode } = await import('../packages/domain/crm/commands/referral');

  test('returns existing code if already has one', async () => {
    const db = createMockD1({
      referral_codes: [{ id: 'rc_1', customer_id: 'cust_1', code: 'EXIST1', times_used: 0, total_points_earned: 0, total_cashback_earned_vnd: 0 }],
    });
    const result = await getOrCreateReferralCode(db, 'cust_1');
    expect(result.code).toBe('EXIST1');
    expect(result.isNew).toBe(false);
  });

  test('creates new code if none exists', async () => {
    const db = createMockD1({ customers: [{ id: 'cust_1', name: 'New', phone: '0901' }] });
    const result = await getOrCreateReferralCode(db, 'cust_1');
    expect(result.code).toHaveLength(6);
    expect(result.isNew).toBe(true);
  });
});
