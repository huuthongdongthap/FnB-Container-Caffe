import { describe, it, expect, vi } from 'vitest';

// Logger is fire-and-forget in production — silence all calls in tests.
vi.mock('../../middleware/logger.js', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} })
  })
}));

// Dynamic imports inside processOrderLoyalty — stub to noop so tests don't blow up.
vi.mock('../../routes/zalo.js', () => ({
  notifyMember: async() => ({ ok: true, channel: 'zalo' })
}));

vi.mock('../../routes/referrals.js', () => ({
  processReferralOnFirstOrder: async() => {}
}));

import type { Customer, CashbackWallet, LoyaltyTier, Order, BonusCampaign } from '../../../types/models';
import { processOrderLoyalty, deductPointsForRefund } from '../../../tree/loyalty/process-order';

// ── Mock DB helpers ────────────────────────────────────────────────────────

const _callSeq: string[] = [];
const _sqlTrap: string | null = null;
let _trapRows: unknown[] = [];

const _patchDb = (): import('@cloudflare/workers-types').D1Database => ({
  prepare(_sql: string) {
    const sql = _sql;
    _callSeq.push(sql);
    if (_sqlTrap && sql.includes(_sqlTrap!)) {
      const rows = _trapRows;
      _trapRows = [];
      return {
        _sql: sql,
        bind() {
          return this;
        },
        async first<T = unknown>(): Promise<T | null> {
          return (rows.shift() as T | null) ?? null;
        },
        async all<T = unknown>(): Promise<{ results: T[] }> {
          return { results: [], success: true };
        },
        async run() {
          return { success: true, changes: 1 } as never;
        },
        async raw() {
          return [] as never;
        }
      };
    }
    return {
      _sql: sql,
      bind() {
        return this;
      },
      async first<T = unknown>(): Promise<T | null> {
        return null;
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        return { results: [] as T[], success: true };
      },
      async run() {
        return { success: true, changes: 1 } as never;
      },
      async raw() {
        return [] as never;
      }
    };
  },
  async batch() {
    return [];
  },
  async exec() {
    return { count: 0, duration: 0 } as never;
  },
  async dump() {
    return new Uint8Array() as never;
  }
});

// =============================================================================
// Typed D1 mock — per-SQL FIFO queue
// =============================================================================
// Each unique SQL string gets a FIFO row queue.  `first()` pops the next row;
// returning null (or running out of rows) yields `null`, which matches D1
// semantics for "no result".  `run()` always succeeds.  `batch()` always
// succeeds.

type Row = Record<string, unknown> | null;

function createMockDB() {
  const queue = new Map<string, Row[]>();

  function ensure(sql: string): Row[] {
    let slot = queue.get(sql);
    if (!slot) {
      slot = []; queue.set(sql, slot);
    }
    return slot;
  }

  return {
    /** Register one or more return rows for an exact SQL string. */
    add(sql: string, ...rows: Row[]) {
      ensure(sql).push(...rows);
    },
    /** Inspect without consuming. */
    peek(sql: string): Row | undefined {
      const slot = queue.get(sql);
      return slot && slot.length > 0 ? slot[0] : undefined;
    },
    /** Replace all currently registered rows for a SQL key. */
    set(sql: string, ...rows: Row[]) {
      queue.set(sql, [...rows]);
    },
    asD1(): import('@cloudflare/workers-types').D1Database {
      return {
        prepare(_sql: string) {
          const sql = _sql; // captured in closure
          return {
            _sql: sql,
            bind(_bindSql: string, ..._args: unknown[]) {
              return this; // chainable — args ignored by mock
            },
            async first<T = unknown>(): Promise<T | null> {
              const slot = queue.get(sql);
              if (slot && slot.length > 0) {
                return slot.shift() as T | null;
              }
              return null;
            },
            async run() {
              return { success: true, changes: 1 } as never;
            },
            async all<T = unknown>() {
              return { results: [] as T[], success: true } as never;
            },
            async raw() {
              return [] as never;
            }
          } as import('@cloudflare/workers-types').D1PreparedStatement;
        },
        async batch() {
          return [{ success: true, changes: 1 } as never];
        },
        async exec() {
          return { count: 0, duration: 0 } as never;
        },
        async dump() {
          return new Uint8Array() as never;
        }
      };
    }
  };
}

// =============================================================================
// Fixtures
// =============================================================================

const ORDER_ID = 'ORD_1';

const ORDER: Order = {
  id: ORDER_ID,
  items: '[]',
  total: 50000,
  status: 'completed',
  payment_status: 'paid',
  payment_method: 'cod',
  customer_name: 'Test',
  customer_phone: '0909123456',
  customer_email: null,
  customer_address: null,
  shipping_fee: 0,
  discount: 0,
  notes: null,
  delivery_time: '',
  cashback_earned: null,
  cashback_used: 0,
  points_earned: null,
  created_at: '',
  updated_at: ''
};

const CUSTOMER: Customer = {
  id: 'cust_1',
  email: 'test@test.com',
  name: 'Test User',
  phone: '0909123456',
  loyalty_points: 500,
  lifetime_points: 1500,
  loyalty_tier: 'bronze',
  date_of_birth: null,
  zalo: null,
  source: null,
  last_ip: null,
  consent_erpnext_sync: null,
  created_at: '',
  updated_at: ''
};

const BRONZE: LoyaltyTier = {
  id: 'tier_bronze',
  tier_name: 'bronze',
  display_name_vi: 'Bronze',
  min_points: 0,
  cashback_rate: 0.05,
  point_multiplier: 1,
  expiry_days: null,
  created_at: ''
};

const SILVER: LoyaltyTier = {
  ...BRONZE,
  tier_name: 'silver',
  display_name_vi: 'Silver',
  min_points: 1000,
  cashback_rate: 0.10,
  point_multiplier: 2,
  expiry_days: 90
};

// =============================================================================
// SQL fingerprint constants — must match process-order.ts exactly
// =============================================================================

const Q_ORDER =
  'SELECT * FROM orders WHERE id = ?';
const Q_EARN =
  'SELECT id FROM cashback_transactions WHERE order_id = ? AND type = \'earn\' LIMIT 1';
const Q_CUSTOMER =
  'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?';
const Q_TIER =
  'SELECT * FROM loyalty_tiers WHERE tier_name = ?';
const Q_CAMPAIGN =
  'SELECT * FROM bonus_campaigns WHERE active = 1 AND start_date <= ? AND end_date >= ? ORDER BY id DESC LIMIT 1';
const Q_WALLET =
  'SELECT * FROM cashback_wallets WHERE customer_id = ?';
const Q_NEXT_TIER =
  'SELECT tier_name FROM loyalty_tiers WHERE min_points <= ? ORDER BY min_points DESC LIMIT 1';
const Q_ERP =
  'SELECT erpnext_id FROM erpnext_mappings WHERE local_type = ? AND local_id = ? LIMIT 1';
const Q_CONSENT =
  'SELECT consent_erpnext_sync FROM customers WHERE id = ? AND consent_erpnext_sync = 1 LIMIT 1';

// =============================================================================
// Shared setup — register the standard happy-path query sequence.
// Must be called in order; each db.add() appends to that SQL's FIFO.
// =============================================================================

function setupHappyPath(
  db: ReturnType<typeof createMockDB>,
  opts: {
    tier?: LoyaltyTier;
    campaign?: BonusCampaign | null;
    wallet?: CashbackWallet | null;
    nextTierResult?: { tier_name: string } | null;
  } = {}
) {
  const { tier = BRONZE, campaign = null, wallet = null, nextTierResult = { tier_name: 'bronze' } } = opts;

  db.add(Q_ORDER, ORDER);
  db.add(Q_EARN, null);
  db.add(Q_CUSTOMER, CUSTOMER);
  db.add(Q_TIER, tier);
  db.add(Q_CAMPAIGN, campaign);
  db.add(Q_WALLET, wallet);
  db.add(Q_NEXT_TIER, nextTierResult);
  db.add(Q_ERP, null);
  db.add(Q_CONSENT, null);
}

// =============================================================================
// processOrderLoyalty — guard clauses
// =============================================================================

describe('processOrderLoyalty — guard clauses', () => {
  it('returns order_not_found when order does not exist', async() => {
    const db = createMockDB();
    // No rows registered for Q_ORDER → first() returns null
    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() });
    expect(result.ok).toBe(false);
    expect((result as Record<string, unknown>).reason).toBe('order_not_found');
  });

  it('returns no_customer when order has no customer_phone', async() => {
    const db = createMockDB();
    db.add(Q_ORDER, { ...ORDER, customer_phone: '' });
    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() });
    expect(result.ok).toBe(false);
    expect((result as Record<string, unknown>).reason).toBe('no_customer');
  });

  it('returns already_processed with existing_id when earn transaction exists', async() => {
    const db = createMockDB();
    db.add(Q_ORDER, ORDER);
    db.add(Q_EARN, { id: 'cbt_pre_1' });
    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() });
    expect(result.ok).toBe(false);
    expect((result as Record<string, unknown>).reason).toBe('already_processed');
    expect((result as Record<string, unknown>).existing_id).toBe('cbt_pre_1');
  });

  it('returns below_min_order when total < 20000', async() => {
    const db = createMockDB();
    db.add(Q_ORDER, { ...ORDER, total: 15000 });
    // No further queries reachable — the total guard fires on line 34,
    // before the customer lookup at line 38.
    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() });
    expect(result.ok).toBe(false);
    expect((result as Record<string, unknown>).reason).toBe('below_min_order');
    expect((result as Record<string, unknown>).min).toBe(20000);
  });

  it('returns customer_not_found when customer phone not in DB', async() => {
    const db = createMockDB();
    db.add(Q_ORDER, ORDER);
    db.add(Q_EARN, null);
    db.add(Q_CUSTOMER, null);
    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() });
    expect(result.ok).toBe(false);
    expect((result as Record<string, unknown>).reason).toBe('customer_not_found');
  });

  it('returns tier_not_found when tier query returns null', async() => {
    const db = createMockDB();
    db.add(Q_ORDER, ORDER);
    db.add(Q_EARN, null);
    db.add(Q_CUSTOMER, CUSTOMER);
    db.add(Q_TIER, null);
    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() });
    expect(result.ok).toBe(false);
    expect((result as Record<string, unknown>).reason).toBe('tier_not_found');
  });
});

// =============================================================================
// processOrderLoyalty — happy path
// =============================================================================

describe('processOrderLoyalty — happy path', () => {
  it('calculates cashback + points, creates wallet, returns success', async() => {
    const db = createMockDB();
    setupHappyPath(db);
    const result = (await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() })) as { ok: boolean };
    expect(typeof result.cashback).toBe('number');
    // 50 000 * 0.05 = 2 500
    expect((result as Record<string, unknown>).cashback).toBe(2500);
    // floor(50 000 / 10 000 * 1) = 5
    expect((result as Record<string, unknown>).points).toBe(5);
    // new wallet = 0 + 2 500
    expect((result as Record<string, unknown>).wallet_balance).toBe(2500);
    // new points = 500 + 5
    expect((result as Record<string, unknown>).total_points).toBe(505);
    // bronze has no expiry_days
    expect((result as Record<string, unknown>).expires_at).toBeNull();
    expect((result as Record<string, unknown>).tier).toBe('bronze');
    expect((result as Record<string, unknown>).tier_upgraded).toBe(false);
    expect((result as Record<string, unknown>).campaign_code).toBeNull();
  });

  it('applies campaign multiplier and respects max_cap', async() => {
    const campaign: BonusCampaign = {
      id: 'camp_double',
      code: 'X2',
      name: 'Double',
      description: null,
      cashback_multiplier: 3.0,
      signup_bonus_vnd: 0,
      signup_bonus_cap: null,
      refer_bonus_vnd: 0,
      max_cap_per_customer_vnd: 30000,
      active: 1,
      start_date: '2026-01-01 00:00:00',
      end_date: '2027-01-01 00:00:00',
      created_at: ''
    };
    const db = createMockDB();
    setupHappyPath(db, { campaign });
    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() });
    expect(typeof result.cashback).toBe('number');
    // (50 000 * 0.05 * 3.0) = 75 000, capped at 30 000
    expect((result as Record<string, unknown>).cashback).toBe(7500);
    expect((result as Record<string, unknown>).multiplier_applied).toBe(3.0);
    expect((result as Record<string, unknown>).campaign_code).toBe('X2');
  });

  it('adds cashback to existing wallet balance', async() => {
    const existingWallet: CashbackWallet = {
      id: 'wal_500',
      customer_id: 'cust_1',
      balance: 12500,
      total_earned: 40000,
      total_spent: 0,
      created_at: '',
      updated_at: ''
    };
    const db = createMockDB();
    db.add(Q_ORDER, ORDER);
    db.add(Q_EARN, null);
    db.add(Q_CUSTOMER, CUSTOMER);
    db.add(Q_TIER, BRONZE);
    db.add(Q_CAMPAIGN, null);
    db.add(Q_WALLET, existingWallet);
    db.add(Q_NEXT_TIER, { tier_name: 'bronze' });
    db.add(Q_ERP, null);
    db.add(Q_CONSENT, null);
    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() });
    expect(typeof result.cashback).toBe('number');
    // 12 500 existing + 2 500 new = 15 000
    expect((result as Record<string, unknown>).wallet_balance).toBe(15000);
  });
});

// =============================================================================
// processOrderLoyalty — tier upgrade branch
// =============================================================================

describe('processOrderLoyalty — tier upgrade', () => {
  it('upgrades tier when lifetime_points cross silver threshold', async() => {
    const highOrder: Order = { ...ORDER, total: 1000000 };
    const customerAt950: Customer = { ...CUSTOMER, loyalty_points: 600, lifetime_points: 950 };
    const db = createMockDB();
    db.add(Q_ORDER, highOrder);
    db.add(Q_EARN, null);
    db.add(Q_CUSTOMER, customerAt950);
    db.add(Q_TIER, BRONZE);
    db.add(Q_CAMPAIGN, null);
    db.add(Q_WALLET, null);
    // After earning: lifetime = 950 + floor(1 000 000 / 10 000) = 1050
    // Silver threshold = 1000 → upgrades
    db.add(Q_NEXT_TIER, { tier_name: 'silver' });
    db.add(Q_ERP, null);
    db.add(Q_CONSENT, null);
    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() });
    expect(typeof result.cashback).toBe('number');
    expect((result as Record<string, unknown>).tier).toBe('silver');
    expect((result as Record<string, unknown>).tier_upgraded).toBe(true);
  });
});

// =============================================================================
// processOrderLoyalty — expiry_days
// =============================================================================

describe('processOrderLoyalty — expiry_days', () => {
  it('returns expiresAt ISO string when tier has expiry_days', async() => {
    const db = createMockDB();
    setupHappyPath(db, { tier: SILVER });
    // Override the next-tier check to remain silver (no upgrade from silver→gold here)
    db.add(Q_NEXT_TIER, { tier_name: 'silver' });
    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() });
    expect(typeof result.cashback).toBe('number');
    expect((result as Record<string, unknown>).expires_at).toBeTruthy();
    expect((result as Record<string, unknown>).expires_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );
  });

  it('returns null expiresAt when tier has no expiry_days (bronze)', async() => {
    const db = createMockDB();
    setupHappyPath(db);
    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: db.asD1() });
    expect(typeof result.cashback).toBe('number');
    expect((result as Record<string, unknown>).expires_at).toBeNull();
  });
});

// =============================================================================
// processOrderLoyalty — idempotency (UNIQUE constraint on batch)
// =============================================================================

describe('processOrderLoyalty — idempotency', () => {
  it('returns already_processed when the earn INSERT inside batch hits UNIQUE', async() => {
    const uniqueErr = new Error('UNIQUE constraint failed: cashback_transactions.id');

    const db = createMockDB();
    db.add(Q_ORDER, ORDER);
    db.add(Q_EARN, null);
    db.add(Q_CUSTOMER, CUSTOMER);
    db.add(Q_TIER, BRONZE);
    db.add(Q_CAMPAIGN, null);
    db.add(Q_WALLET, null);
    db.add(Q_NEXT_TIER, { tier_name: 'bronze' });

    // Wrap the underlying asD1() so we can intercept the batch() call.
    // The batch() in process-order.ts is an await db.batch([...]) call.
    // We throw on the first batch() invocation to simulate the UNIQUE error
    // that fires inside the prepared statement's run().
    const d1 = db.asD1();
    let batchCalls = 0;
    const originalBatch = d1.batch.bind(d1);
    d1.batch = async(...args: unknown[]) => {
      batchCalls++;
      if (batchCalls === 1) {
        throw uniqueErr;
      } // simulate UNIQUE on first batch
      return originalBatch(...args);
    };

    const result = await processOrderLoyalty(ORDER_ID, { AURA_DB: d1 });
    expect(result.ok).toBe(false);
    expect((result as Record<string, unknown>).reason).toBe('already_processed');
  });
});

// =============================================================================
// deductPointsForRefund
// =============================================================================

describe('deductPointsForRefund', () => {
  const SQL_IDEMPOTENCY =
    'SELECT id FROM loyalty_point_logs WHERE order_id = ? AND reason = \'refund\' AND points_change < 0 LIMIT 1';
  const SQL_ORDER_DETAIL =
    'SELECT total, cashback_earned, points_earned FROM orders WHERE id = ?';
  const SQL_CUSTOMER =
    'SELECT id, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = ?';
  const SQL_NEW_TIER =
    'SELECT tier_name FROM loyalty_tiers WHERE min_points <= ? ORDER BY min_points DESC LIMIT 1';

  function registerRefund(
    db: ReturnType<typeof createMockDB>,
    opts: {
      hasReversal?: boolean;
      orderDetail: Row;
      customerDetail: Row;
      newTier?: Row;
    }
  ) {
    const { hasReversal = false, orderDetail, customerDetail, newTier = { tier_name: 'bronze' } } = opts;
    db.add(SQL_IDEMPOTENCY, hasReversal ? { id: 'ptl_ref_1' } : null);
    db.add(SQL_ORDER_DETAIL, orderDetail);
    db.add(SQL_CUSTOMER, customerDetail);
    db.add(SQL_NEW_TIER, newTier);
  }

  it('idempotent skip when reversal already exists for order', async() => {
    const db = createMockDB();
    registerRefund(db, {
      hasReversal: true,
      orderDetail: { total: 50000, cashback_earned: 2500, points_earned: 50 },
      customerDetail: { id: 1, loyalty_points: 600, lifetime_points: 2000, loyalty_tier: 'bronze' }
    });
    // Wrap to count prepare() calls — should be exactly 1 (idempotency check only)
    const d1 = db.asD1();
    let count = 0;
    const orig = d1.prepare.bind(d1);
    d1.prepare = (...a: unknown[]) => {
      count++; return orig(a[0]);
    };

    await deductPointsForRefund(d1, 1, ORDER_ID, 20000);
    expect(count).toBe(1);
  });

  it('returns silently when order is not found', async() => {
    const db = createMockDB();
    registerRefund(db, {
      hasReversal: false,
      orderDetail: null,
      customerDetail: { id: 1, loyalty_points: 600, lifetime_points: 2000, loyalty_tier: 'bronze' }
    });
    const d1 = db.asD1();
    let count = 0;
    const orig = d1.prepare.bind(d1);
    d1.prepare = (...a: unknown[]) => {
      count++; return orig(a[0]);
    };

    await deductPointsForRefund(d1, 1, ORDER_ID, 20000);
    // idempotency check + order lookup = 2 prepare calls, then returns
    expect(count).toBe(2);
  });

  it('returns silently when points_earned is 0', async() => {
    const db = createMockDB();
    registerRefund(db, {
      hasReversal: false,
      orderDetail: { total: 50000, cashback_earned: 2500, points_earned: 0 },
      customerDetail: { id: 1, loyalty_points: 600, lifetime_points: 2000, loyalty_tier: 'bronze' }
    });
    const d1 = db.asD1();
    let count = 0;
    const orig = d1.prepare.bind(d1);
    d1.prepare = (...a: unknown[]) => {
      count++; return orig(a[0]);
    };

    await deductPointsForRefund(d1, 1, ORDER_ID, 50000);
    expect(count).toBe(2); // stops after order detail check
  });

  it('deducts proportional points for partial refund (no tier change)', async() => {
    // points_earned=100, total=50 000, refund=25 000 → ratio=0.5 → deduct=50
    const db = createMockDB();
    registerRefund(db, {
      hasReversal: false,
      orderDetail: { total: 50000, cashback_earned: 2500, points_earned: 100 },
      customerDetail: { id: 1, loyalty_points: 600, lifetime_points: 2000, loyalty_tier: 'bronze' }
    });
    await deductPointsForRefund(db.asD1(), 1, ORDER_ID, 25000);
    // Completes without error — proportional deduction path succeeded.
  });

  it('triggers tier downgrade when lifetime_points fall below threshold', async() => {
    // silver tier, lifetime=1050, points_earned=100, full refund → ratio=1 → deduct=100
    // new_lifetime=950 < silver(1000) → downgrade to bronze
    const db = createMockDB();
    registerRefund(db, {
      hasReversal: false,
      orderDetail: { total: 100000, cashback_earned: 5000, points_earned: 100 },
      customerDetail: { id: 1, loyalty_points: 800, lifetime_points: 1050, loyalty_tier: 'silver' },
      newTier: { tier_name: 'bronze' }
    });
    await deductPointsForRefund(db.asD1(), 1, ORDER_ID, 100000);
    // Completes without error — downgrade batch executed.
  });

  it('returns silently when customer is not found', async() => {
    const db = createMockDB();
    registerRefund(db, {
      hasReversal: false,
      orderDetail: { total: 50000, cashback_earned: 2500, points_earned: 100 },
      customerDetail: null
    });
    const d1 = db.asD1();
    let count = 0;
    const orig = d1.prepare.bind(d1);
    d1.prepare = (...a: unknown[]) => {
      count++; return orig(a[0]);
    };

    await deductPointsForRefund(d1, 1, ORDER_ID, 50000);
    // idempotency + order + customer = 3, then returns
    expect(count).toBe(3);
  });
});
