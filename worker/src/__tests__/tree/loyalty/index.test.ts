
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveCampaign, calcExpiresAt } from '../../../tree/loyalty/campaign.js';
import { processOrderLoyalty, deductPointsForRefund } from '../../../tree/loyalty/process-order.js';
import { genId, nowSqlTimestamp, throttle } from '../../../tree/loyalty/helpers.js';
import { handleLookup } from '../../../tree/loyalty/lookup-handler.js';
import { handleSummary } from '../../../tree/loyalty/summary-handler.js';
import { handleSpendCashback } from '../../../tree/loyalty/spend-cashback-handler.js';
import { handlePhoneAuth } from '../../../tree/loyalty/phone-auth-handler.js';
import { authCustomer } from '../../../tree/loyalty/auth-middleware.js';
import type { D1Database } from '@cloudflare/workers-types';

// ── crypto.subtle polyfill for Vitest node environment ──────────────────────
const cryptoModule = await import('node:crypto');
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: cryptoModule.webcrypto?.subtle ?? cryptoModule.default?.webcrypto?.subtle,
    getRandomValues: (arr: Uint8Array) => cryptoModule.randomFillSync(arr),
    randomUUID: () => cryptoModule.randomUUID(),
  } as Crypto,
  writable: true,
  configurable: true,
});

 const { generateJWT } = await import('../../../lib/jwt.js');

// ── D1 mock helper ──────────────────────────────────────────────────────────
function makeD1(rows: unknown[] = []) {
  return {
    prepare: (_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => rows[0],
        all: async () => ({ results: rows }),
        run: async () => ({ changes: 1 }),
      }),
      first: async () => rows[0],
      all: async () => ({ results: rows }),
    }),
    batch: async () => {},
  } as unknown as D1Database;
}

// ── Hono Context mock helper ─────────────────────────────────────────────────
function makeCtx(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    req: {
      query: (_p: string) => (overrides.query as string | undefined),
      json: async () => (overrides.body as Record<string, unknown>),
      header: overrides.header as ((h: string) => string | undefined) | string | undefined,
      path: overrides.reqPath,
    },
    env: overrides.env as Record<string, unknown> | undefined,
    get: (_k: string | symbol) => overrides.customer,
    set: (_k: string | symbol, _v: unknown) => {},
    json: (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status }),
    executionCtx: undefined,
    ...overrides,
  } as unknown as Record<string, unknown>;
}

function makeThrottleCtx(ip: string, kvStore: unknown): Record<string, unknown> {
  return {
    req: {
      header: (h: string) => (h === 'CF-Connecting-IP' ? ip : undefined),
   json: async () => ({ phone: '' }),
    },
    env: { AUTH_KV: kvStore },
    json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status }),
    executionCtx: { waitUntil: (_p: Promise<unknown>) => {} },
  };
}

// ── Fake logger to silence createLogger calls ────────────────────────────────
vi.mock('../../../middleware/logger', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));


// ── Validators ──────────────────────────────────────────────────────────────
const { z } = await import('zod');

vi.mock('../../../lib/validators', () => {
  const { z: z2 } = require('zod');
  return {
    spendCashbackSchema: z2.object({
      order_id: z2.string().min(1),
      amount: z2.number().int().positive(),
    }),
    phoneAuthSchema: z2.object({
      phone: z2.string().regex(/^(\+84|0)\d{9,10}$/),
      name: z2.string().optional(),
      dob: z2.string().optional(),
      zalo: z2.string().optional(),
      source: z2.string().optional(),
      referral_code: z2.string().optional(),
    }),
  };
});

// ══════════════════════════════════════════════════════════════════════════════
// campaign.ts
// ══════════════════════════════════════════════════════════════════════════════
describe('campaign', () => {
  describe('getActiveCampaign', () => {
    it('returns campaign when one is active', async () => {
      const campaign = { id: 1, code: 'SUMMER25', active: 1, start_date: '2025-01-01', end_date: '2030-01-01', cashback_multiplier: 2, max_cap_per_customer_vnd: 100000 };
      const db = makeD1([campaign]);
      const result = await getActiveCampaign(db);
      expect(result).toEqual(campaign);
    });

    it('returns null when no active campaign exists', async () => {
      const db = makeD1([null]);
      const result = await getActiveCampaign(db);
      expect(result).toBeNull();
    });
  });

  describe('calcExpiresAt', () => {
    it('returns ISO expiry string when tier has expiry_days', () => {
      const tier = { expiry_days: 30 };
      const result = calcExpiresAt(tier);
      expect(result).not.toBeNull();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      const diff = new Date(result!).getTime() - Date.now();
      expect(diff).toBeGreaterThan(28 * 86400000);
      expect(diff).toBeLessThan(32 * 86400000);
    });

    it('returns null when tier is null', () => {
      expect(calcExpiresAt(null)).toBeNull();
    });

    it('returns null when tier has no expiry_days', () => {
      expect(calcExpiresAt({})).toBeNull();
      expect(calcExpiresAt({ expiry_days: 0 })).toBeNull();
      expect(calcExpiresAt({ expiry_days: null as unknown as number | null })).toBeNull();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// helpers.ts
// ══════════════════════════════════════════════════════════════════════════════
describe('helpers', () => {
  describe('genId', () => {
    it('returns string with correct prefix', () => {
      const id = genId('cbt_');
      expect(id).toMatch(/^cbt_/);
    });

    it('returns unique values on successive calls', () => {
      const a = genId('cbt_');
      const b = genId('cbt_');
      expect(a).not.toBe(b);
    });

    it('contains timestamp characters beyond prefix', () => {
      const id = genId('test_');
      expect(id.length).toBeGreaterThan('test_'.length);
    });
  });

  describe('nowSqlTimestamp', () => {
    it('returns ISO-like string with space instead of T', () => {
      const ts = nowSqlTimestamp();
      expect(ts).not.toContain('T');
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('returns a recent timestamp matching current date components', () => {
      const ts = nowSqlTimestamp();
      const now = new Date();
      const tsDate = new Date(ts.replace(' ', 'T'));
      expect(tsDate.getFullYear()).toBe(now.getFullYear());
      expect(tsDate.getMonth()).toBe(now.getMonth());
      // Allow ±1 day tolerance due to timezone / test boundaries
expect(tsDate.getDate()).toBeGreaterThanOrEqual(now.getDate() - 1);
expect(tsDate.getDate()).toBeLessThanOrEqual(now.getDate() + 1);
    });
  });

  describe('throttle', () => {
    let kv: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      kv = { get: vi.fn(), put: vi.fn() };
    });

    it('returns true when KV env is missing', async () => {
      const ctx = makeThrottleCtx('1.2.3.4', undefined as unknown as typeof kv);
      const result = await throttle(ctx as Parameters<typeof throttle>[0], 'key', 5, 60);
      expect(result).toBe(true);
    });

    it('returns true when IP is localhost (bypass)', async () => {
      const ctx = makeThrottleCtx('127.0.0.1', kv);
      const result = await throttle(ctx as Parameters<typeof throttle>[0], 'key', 5, 60);
      expect(result).toBe(true);
    });

    it('returns true and writes KV on first call', async () => {
      kv.get.mockResolvedValue('0');
      const ctx = makeThrottleCtx('1.2.3.4', kv);
      const result = await throttle(ctx as Parameters<typeof throttle>[0], 'key', 5, 60);
      expect(result).toBe(true);
      expect(kv.put).toHaveBeenCalledWith(
        expect.stringContaining('rl:key:1.2.3.4'),
        '1',
        expect.objectContaining({ expirationTtl: 60 }),
      );
    });

    it('returns false when count already at max, does not write', async () => {
      kv.get.mockResolvedValue('5');
      const ctx = makeThrottleCtx('1.2.3.4', kv);
      const result = await throttle(ctx as Parameters<typeof throttle>[0], 'key', 5, 60);
      expect(result).toBe(false);
      expect(kv.put).not.toHaveBeenCalled();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// process-order.ts
// ══════════════════════════════════════════════════════════════════════════════
describe('processOrderLoyalty', () => {
  // D1 mock: returns a different row per prepare() call via step index.
  interface StepRow { first: (..._args: unknown[]) => Promise<unknown> }

  function makeStepD1(steps: StepRow[]): D1Database {
    let idx = -1;
    return {
      prepare: (_sql?: string) => {
        idx++;
        const step = steps[idx] ?? steps[steps.length - 1] ?? { first: async () => null };
        return {
          bind: (..._a: unknown[]) => ({
            first: step.first,
            all: async () => ({ results: [] }),
            run: async () => ({ changes: 1 }),
          }),
          first: step.first,
          all: async () => ({ results: [] }),
        };
      },
      batch: async () => {},
    } as unknown as D1Database;
  }

  it('returns order_not_found when order is missing', async () => {
    const db = makeStepD1([{ first: async () => null }]);
    const result = await processOrderLoyalty('ord-missing', { AURA_DB: db } as unknown as Record<string, unknown>);
    expect(result).toEqual({ ok: false, reason: 'order_not_found' });
  });

  it('returns already_processed when earn tx exists', async () => {
    const db = makeStepD1([
      { first: async () => ({ id: 'ord1', customer_phone: '0909123456' }) },  // order row
      { first: async () => ({ id: 'cbt_existing' }) },                         // earn tx found
    ]);
    const result = await processOrderLoyalty('ord1', { AURA_DB: db } as unknown as Record<string, unknown>);
    expect(result).toEqual({ ok: false, reason: 'already_processed', existing_id: 'cbt_existing' });
  });

  it('returns below_min_order when order total < 20000', async () => {
    const db = makeStepD1([
      { first: async () => ({ id: 'ord1', customer_phone: '0909123456' }) },
      { first: async () => null },  // no earn tx
    ]);
    const result = await processOrderLoyalty('ord1', { AURA_DB: db } as unknown as Record<string, unknown>);
    expect(result).toEqual({ ok: false, reason: 'below_min_order', min: 20000 });
  });

  it('returns customer_not_found when customer is missing', async () => {
    const db = makeStepD1([
      { first: async () => ({ id: 'ord1', customer_phone: '0909123456', total: 25000 }) },
      { first: async () => null },  // no earn tx
      { first: async () => null },  // no customer
    ]);
    const result = await processOrderLoyalty('ord1', { AURA_DB: db } as unknown as Record<string, unknown>);
    expect(result).toEqual({ ok: false, reason: 'customer_not_found' });
  });

  it('returns tier_not_found when tier config missing', async () => {
    const db = makeStepD1([
      { first: async () => ({ id: 'ord1', customer_phone: '0909123456', total: 25000 }) },
      { first: async () => null },                                            // no earn tx
      { first: async () => ({ id: 'cus1', loyalty_tier: 'bronze' }) },        // customer found
      { first: async () => null },                                            // no tier
    ]);
    const result = await processOrderLoyalty('ord1', { AURA_DB: db } as unknown as Record<string, unknown>);
    expect(result).toEqual({ ok: false, reason: 'tier_not_found' });
  });

  it('success path: returns cashback, points, wallet_balance, tier', async () => {
    const batchCalls: unknown[] = [];
    let stepIdx = 0;
    const stepD1: D1Database = {
      prepare: (_sql: string) => {
        stepIdx++;
        const row = (() => {
          switch (stepIdx) {
            case 1: return async () => ({ id: 'ord1', customer_phone: '0909123456', total: 50000, total_amount: 50000 });
            case 2: return async () => null;                                      // no earn tx
            case 3: return async () => ({ id: 'cus1', loyalty_tier: 'bronze', loyalty_points: 100, lifetime_points: 100 });
            case 4: return async () => ({ tier_name: 'bronze', cashback_rate: 0.05, point_multiplier: 1, expiry_days: null });
            case 5: return async () => null;                                      // no campaign
            case 6: return async () => null;                                      // no wallet
            default: return async () => null;
          }
        })();
        return {
          bind: (..._a: unknown[]) => ({
            first: row,
            all: async () => ({ results: [] }),
            run: async () => ({ changes: 1 }),
          }),
          first: row,
          all: async () => ({ results: [] }),
        };
      },
      batch: async (stmts: unknown[]) => { batchCalls.push(...stmts); },
    } as unknown as D1Database;

    const result = (await processOrderLoyalty('ord1', { AURA_DB: stepD1 } as unknown as Record<string, unknown>)) as Record<string, unknown>;
    expect(result.cashback).toBeGreaterThan(0);
    expect(result.points).toBeGreaterThan(0);
    expect(result.wallet_balance).toBe(result.cashback);
    expect(result.tier).toBe('bronze');
    expect((result as Record<string, unknown>).tier_upgraded).toBe(false);
    expect(batchCalls.length).toBeGreaterThan(0);
  });

  it('handles UNIQUE constraint as idempotent', async () => {
    let stepIdx = 0;
    const stepD1: D1Database = {
      prepare: (_sql: string) => {
        stepIdx++;
        const row = (() => {
          switch (stepIdx) {
            case 1: return async () => ({ id: 'ord1', customer_phone: '0909123456', total: 50000, total_amount: 50000 });
            case 2: return async () => null;
            case 3: return async () => ({ id: 'cus1', loyalty_tier: 'bronze', loyalty_points: 0, lifetime_points: 0 });
            case 4: return async () => ({ tier_name: 'bronze', cashback_rate: 0.05, point_multiplier: 1, expiry_days: null });
            case 5: return async () => null;
            case 6: return async () => null;
            default: return async () => null;
          }
        })();
        return {
          bind: (..._a: unknown[]) => ({
            first: row,
            all: async () => ({ results: [] }),
            run: async () => ({ changes: 1 }),
          }),
          first: row,
          all: async () => ({ results: [] }),
        };
      },
      batch: async () => { throw new Error('UNIQUE constraint failed: cashback_transactions.order_id'); },
    } as unknown as D1Database;

    const result = (await processOrderLoyalty('ord1', { AURA_DB: stepD1 } as unknown as Record<string, unknown>)) as Record<string, unknown>;
    expect(result).toEqual({ ok: false, reason: 'already_processed' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// deductPointsForRefund
// ══════════════════════════════════════════════════════════════════════════════
describe('deductPointsForRefund', () => {
  interface RefundStepRow {
    first: (..._args: unknown[]) => Promise<unknown>;
    run?: (..._args: unknown[]) => Promise<unknown>;
  }

  function makeStepD1Refund(steps: RefundStepRow[]): D1Database {
    let idx = -1;
    return {
      prepare: (_sql: string) => {
        idx++;
        const step = steps[idx] ?? steps[steps.length - 1] ?? {
          first: async () => null,
          run: async () => ({ changes: 1 }),
        };
        return {
          bind: (..._a: unknown[]) => ({
            first: step.first,
            run: step.run ?? (async () => ({ changes: 1 })),
            batch: async () => {},
          }),
          first: step.first,
          run: step.run ?? (async () => ({ changes: 1 })),
          batch: async () => {},
        };
      },
      batch: async () => {},
    } as unknown as D1Database;
  }

  it('returns early when refund log already exists', async () => {
    const db = makeStepD1Refund([{ first: async () => ({ id: 'existing_log' }) }]);
    await deductPointsForRefund(db, 1, 'ord1', 20000);
    // No further action expected; verify no throw
  });

  it('returns early when order not found', async () => {
    const db = makeStepD1Refund([
      { first: async () => null },  // no existing log
      { first: async () => null },  // order not found
    ]);
    await deductPointsForRefund(db, 1, 'ord1', 20000);
  });

  it('returns early when points_earned is zero', async () => {
    const db = makeStepD1Refund([
      { first: async () => null },  // no existing log
      { first: async () => ({ total: 50000, cashback_earned: 5000, points_earned: 0 }) },
    ]);
    await deductPointsForRefund(db, 1, 'ord1', 20000);
  });

  it('returns early when customer not found', async () => {
    const db = makeStepD1Refund([
      { first: async () => null },  // no existing log
      { first: async () => ({ total: 50000, cashback_earned: 5000, points_earned: 50 }) },
      { first: async () => null },  // customer not found
    ]);
    await deductPointsForRefund(db, 999, 'ord1', 1000);
  });

  it('deducts points proportionally and runs batch on full refund', async () => {
    const batchArgLen = { n: 0 };
    const db = makeStepD1Refund([
      { first: async () => null },  // no existing log
      { first: async () => ({ total: 50000, cashback_earned: 5000, points_earned: 50 }) },
      { first: async () => ({ id: 1, loyalty_points: 100, lifetime_points: 150, loyalty_tier: 'silver' }) },
    ]);
    (db as unknown as { batch: (stmts: unknown[]) => Promise<void> }).batch = async (stmts) => {
      batchArgLen.n += stmts.length;
    };
    await deductPointsForRefund(db, 1, 'ord1', 50000);
    expect(batchArgLen.n).toBeGreaterThanOrEqual(2);
  });

  it('proportional deduction on partial refund (50%)', async () => {
    const batchArgLen = { n: 0 };
    const db = makeStepD1Refund([
      { first: async () => null },
      { first: async () => ({ total: 50000, cashback_earned: 5000, points_earned: 50 }) },
      { first: async () => ({ id: 1, loyalty_points: 100, lifetime_points: 150, loyalty_tier: 'silver' }) },
    ]);
    (db as unknown as { batch: (stmts: unknown[]) => Promise<void> }).batch = async (stmts) => {
      batchArgLen.n += stmts.length;
    };
    await deductPointsForRefund(db, 1, 'ord1', 25000);
    expect(batchArgLen.n).toBeGreaterThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// lookup-handler.ts
// ══════════════════════════════════════════════════════════════════════════════
describe('lookup-handler', () => {
  interface LookupStepRow {
    first: (..._args: unknown[]) => Promise<unknown>;
    all?: (..._args: unknown[]) => Promise<unknown>;
  }

  function makeLookupD1(steps: LookupStepRow[]): D1Database {
    let idx = -1;
    return {
      prepare: (_sql: string) => {
        idx++;
        const step = steps[idx] ?? steps[steps.length - 1] ?? {
          first: async () => null,
          all: async () => ({ results: [] }),
        };
        return {
          bind: (..._a: unknown[]) => ({
            first: step.first,
            all: step.all ?? (async () => ({ results: [] })),
          }),
          first: step.first,
          all: step.all ?? (async () => ({ results: [] })),
        };
      },
    } as unknown as D1Database;
  }

  it('returns 400 when phone query param is missing', async () => {
    const ctx = makeCtx({}) as Parameters<typeof handleLookup>[0];
    const res = await handleLookup(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
  });

  it('returns 200 with not-found error when customer missing', async () => {
    const db = makeLookupD1([
      { first: async () => null },  // customer not found
    ]);
    const ctx = makeCtx({ query: '0909123456', env: { AURA_DB: db } }) as Parameters<typeof handleLookup>[0];
    const res = await handleLookup(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect((body as Record<string, unknown>).error).toBeTruthy();
  });

  it('returns 200 with member data when customer found', async () => {
    const customer = {
      id: 1, email: 'test@test.com', name: 'Nguyen Van A', phone: '0909123456',
      loyalty_points: 500, lifetime_points: 500, loyalty_tier: 'silver', created_at: '2025-01-01',
    };
    const db = makeLookupD1([
      { first: async () => customer },   // customer
      { first: async () => null },       // wallet
      { first: async () => ({ total: 100000 }) },  // lifetime cashback
      { first: async () => ({ total: 5000, cnt: 1 }) },  // expiring
      { first: async () => ({ tier_name: 'gold', min_points: 1000 }) },  // next tier
      { first: async () => ({ min_points: 0 }) },  // prev tier
    ]);
    const ctx = makeCtx({ query: '0909123456', env: { AURA_DB: db } }) as Parameters<typeof handleLookup>[0];
    const res = await handleLookup(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect((body.member as Record<string, unknown>).name).toBe('Nguyen Van A');
    expect((body.member as Record<string, unknown>).tier).toBe('silver');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// summary-handler.ts
// ══════════════════════════════════════════════════════════════════════════════
describe('summary-handler', () => {
  interface SummaryStepRow {
    first: (..._args: unknown[]) => Promise<unknown>;
    all?: (..._args: unknown[]) => Promise<unknown>;
  }

  function makeSummaryD1(steps: SummaryStepRow[]): D1Database {
    let idx = -1;
    return {
      prepare: (_sql: string) => {
        idx++;
        const step = steps[idx] ?? steps[steps.length - 1] ?? {
          first: async () => null,
          all: async () => ({ results: [] }),
        };
        return {
          bind: (..._a: unknown[]) => ({
            first: step.first,
            all: step.all ?? (async () => ({ results: [] })),
          }),
          first: step.first,
          all: step.all ?? (async () => ({ results: [] })),
        };
      },
    } as unknown as D1Database;
  }

  it('returns JSON with customer, wallet, tier and next tier info', async () => {
    const customer = {
      id: 1, name: 'Test User', email: 'test@test.com', phone: '0909123456',
      loyalty_points: 200, lifetime_points: 500, loyalty_tier: 'bronze', created_at: '2025-06-01',
    };
    const tier = { tier_name: 'bronze', cashback_rate: 0.05, point_multiplier: 1 };
    const wallet = { id: 'wal_1', customer_id: 1, balance: 25000, total_earned: 50000, total_spent: 25000, created_at: '2025-06-01', updated_at: '2025-06-15' };

    const db = makeSummaryD1([
      { first: async () => tier },
      { first: async () => wallet },
      { first: async () => ({ tier_name: 'silver', min_points: 1000 }) },
      { all: async () => ({ results: [{ cnt: 2 }] }) },
      { first: async () => ({ total: 5000 }) },
    ]);

    const ctx = makeCtx({ env: { AURA_DB: db }, customer }) as Parameters<typeof handleSummary>[0];
    const res = await handleSummary(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Test User');
    expect(body.data.wallet.balance).toBe(25000);
    expect(body.data.next_tier.tier_name).toBe('silver');
    expect(body.data.active_rewards).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// spend-cashback-handler.ts
// ══════════════════════════════════════════════════════════════════════════════
describe('spend-cashback-handler', () => {
  const customer = {
    id: 1, name: 'Test', email: 'test@test.com', phone: '0909123456',
    loyalty_points: 100, lifetime_points: 500, loyalty_tier: 'bronze', created_at: '2025-01-01',
  };

  interface SpendStepRow {
    first: (..._args: unknown[]) => Promise<unknown>;
    run?: (..._args: unknown[]) => Promise<unknown>;
  }

  function makeSpendD1(steps: SpendStepRow[]): D1Database {
    let idx = -1;
    return {
      prepare: (_sql: string) => {
        idx++;
        const step = steps[idx] ?? steps[steps.length - 1] ?? {
          first: async () => null,
          run: async () => ({ changes: 1 }),
        };
        return {
          bind: (..._a: unknown[]) => ({
            first: step.first,
            run: step.run ?? (async () => ({ changes: 1 })),
          }),
          first: step.first,
          run: step.run ?? (async () => ({ changes: 1 })),
        };
      },
    } as unknown as D1Database;
  }

  it('returns 409 when spend already exists for this order', async () => {
    const db = makeSpendD1([{ first: async () => ({ id: 'existing_spend' }) }]);
    const ctx = makeCtx({ body: { order_id: 'ord1', amount: 10000 }, env: { AURA_DB: db }, customer }) as Parameters<typeof handleSpendCashback>[0];
    const res = await handleSpendCashback(ctx);
    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Ví đã được dùng cho đơn này');
  });

  it('returns 400 when order total below minimum (20000)', async () => {
    const db = makeSpendD1([
      { first: async () => null },          // no prior spend
      { first: async () => ({ total_amount: 15000 }) },
    ]);
    const ctx = makeCtx({ body: { order_id: 'ord1', amount: 1000 }, env: { AURA_DB: db }, customer }) as Parameters<typeof handleSpendCashback>[0];
    const res = await handleSpendCashback(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain('toi thieu');
  });

  it('returns 400 when amount exceeds 50% of order total', async () => {
    const db = makeSpendD1([
      { first: async () => null },
      { first: async () => ({ total_amount: 50000 }) },
    ]);
    // 30000 > 25000 (50% of 50000)
    const ctx = makeCtx({ body: { order_id: 'ord1', amount: 30000 }, env: { AURA_DB: db }, customer }) as Parameters<typeof handleSpendCashback>[0];
    const res = await handleSpendCashback(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Toi da 50% gia tr? don hang');
  });

  it('returns 400 when wallet balance insufficient', async () => {
    const db = makeSpendD1([
      { first: async () => null },
      { first: async () => ({ total_amount: 50000 }) },
      { first: async () => ({ id: 'wal1', customer_id: 1, balance: 5000 }) },
    ]);
    const ctx = makeCtx({ body: { order_id: 'ord1', amount: 10000 }, env: { AURA_DB: db }, customer }) as Parameters<typeof handleSpendCashback>[0];
    const res = await handleSpendCashback(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('So du khong du');
  });

  it('deducts cashback atomically and returns new balance', async () => {
    const db = makeSpendD1([
      { first: async () => null },          // no prior spend
      { first: async () => ({ total_amount: 100000 }) },
      { first: async () => ({ id: 'wal1', customer_id: 1, balance: 50000 }) },
      { run: async () => ({ changes: 1 }) },  // update wallet
      { run: async () => ({ changes: 1 }) },  // update order
      { run: async () => ({ changes: 1 }) },  // audit log
      { first: async () => ({ balance: 30000 }) },  // read updated balance
    ]);
    const ctx = makeCtx({ body: { order_id: 'ord1', amount: 20000 }, env: { AURA_DB: db }, customer }) as Parameters<typeof handleSpendCashback>[0];
    const res = await handleSpendCashback(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.data.amount_spent).toBe(20000);
    expect(body.data.new_balance).toBe(30000);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// phone-auth-handler.ts
// ══════════════════════════════════════════════════════════════════════════════
describe('phone-auth-handler', () => {
  const baseEnv = { AURA_DB: makeD1([]) as unknown as D1Database, JWT_SECRET: 'this-is-a-valid-secret-key-16+', JWT_EXPIRY_SECONDS: 3600 };

  it('returns 429 when throttled', async () => {
    const kv = { get: async () => '10', put: async () => {} };
    const ctx = makeThrottleCtx('1.2.3.4', kv);
    (ctx.req as Record<string, unknown>).json = async () => ({ phone: '0909123456' });
    ctx.env = { ...baseEnv, AUTH_KV: kv };
    const res = await handlePhoneAuth(ctx as Parameters<typeof handlePhoneAuth>[0]);
    expect(res.status).toBe(429);
  });

  it('creates new customer and returns 200 with token', async () => {
    let stepIdx = 0;
    const db: D1Database = {
      prepare: (_sql: string) => {
        stepIdx++;
        const first = async () => {
          if (stepIdx === 1) return null;    // no existing customer
          if (stepIdx === 2) return null;    // no campaign
          return null;
        };
        return {
          bind: (..._a: unknown[]) => ({
            first,
            run: async () => ({ changes: 1 }),
            all: async () => ({ results: [] }),
            batch: async () => {},
          }),
          first,
          run: async () => ({ changes: 1 }),
          all: async () => ({ results: [] }),
          batch: async () => {},
        };
      },
      batch: async () => {},
    } as unknown as D1Database;
    const kv = { get: async () => '0', put: async () => {} };
    const ctx = makeThrottleCtx('5.6.7.8', kv);
    (ctx.req as Record<string, unknown>).json = async () => ({ phone: '0909123456', name: 'New User', dob: '1990-01-01' });
    ctx.env = { ...baseEnv, AURA_DB: db };
    const res = await handlePhoneAuth(ctx as Parameters<typeof handlePhoneAuth>[0]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.is_new).toBe(true);
    expect(body.token).toBeTruthy();
  });

  it('returns existing customer when found', async () => {
    const existingCustomer = {
      id: 'CUS_abc', email: '0909123456@loyalty.aura', name: 'Existing',
      phone: '0909123456', loyalty_points: 100, lifetime_points: 200, loyalty_tier: 'silver', created_at: '2025-01-01',
    };
    const db = makeD1([existingCustomer]);
    const kv = { get: async () => '0', put: async () => {} };
    const ctx = makeThrottleCtx('5.6.7.8', kv);
    (ctx.req as Record<string, unknown>).json = async () => ({ phone: '0909123456' });
    ctx.env = { ...baseEnv, AURA_DB: db };
    const res = await handlePhoneAuth(ctx as Parameters<typeof handlePhoneAuth>[0]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.is_new).toBe(false);
  });
});


