import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() at top only (Vitest auto-hoists).
// ---------------------------------------------------------------------------
vi.mock('../../middleware/logger.js', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} })
  })
}));

vi.mock('../../lib/metrics-collector.js', () => ({
  createMetricsCollector: () => ({
    recordMetric: async() => {},
    recordAlert: async() => null,
    markAlertDispatched: async() => {},
    pruneOldMetrics: async() => 0
  })
}));

// ---------------------------------------------------------------------------
// Real imports (after mock declarations)
// ---------------------------------------------------------------------------
import { applyReferralForNewCustomer } from '../../../tree/referrals/apply-referral.js';
import { createMockDB } from '../../test-utils.js';

// ===========================================================================
// Shared mutable state — tests mutate these BEFORE calling the function.
//
// apply-referral.ts executes these SQLs:
//   S1: SELECT * FROM referral_codes WHERE code = ?
//   S2: SELECT id, bonus_type FROM referrals WHERE referred_customer_id = ? AND status = ?
//   S3: SELECT id FROM customers WHERE id = ?
//   S4: INSERT INTO referrals (...bonus_type='pending'...)   (run)
//   S5: UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?  (run)
// ===========================================================================
const firstReturn = new Map<string, unknown>();

const rcRow: Record<string, unknown> = {
  id: 'rc-1',
  customer_id: 'referrer-1',
  code: 'TEST2024',
  times_used: 0,
  total_points_earned: 0,
  created_at: '2026-01-01T00:00:00Z'
};

// ===========================================================================
// DB stub
// ===========================================================================
function makeRefDB(): ReturnType<typeof createMockDB> {
  const db = createMockDB();
  firstReturn.clear();

  const pool = new Map<string, Record<string, unknown>>();

  function getStmt(sql: string): Record<string, unknown> {
    let s = pool.get(sql);
    if (!s) {
      const binds: unknown[] = [];
      s = {
        _sql: sql,
        _binds: binds,
        bind(...args: unknown[]) {
          binds.push(...args);
          return s;
        },
        async first<T = unknown>() {
          const v = firstReturn.get(sql);
          return (v === undefined ? null : v) as T;
        },
        async run() {
          return { success: true, changes: 1, lastRowId: 1 } as never;
        },
        all: async() => ({ results: [] as never, success: true } as never),
        raw: async() => [] as never
      };
      pool.set(sql, s);
    }
    return s;
  }

  getStmt('SELECT * FROM referral_codes WHERE code = ?');
  getStmt(
    'SELECT id, bonus_type FROM referrals WHERE referred_customer_id = ? AND status = ?'
  );
  getStmt('SELECT id FROM customers WHERE id = ?');

  db.prepare = ((sql: string) => getStmt(sql)) as unknown as typeof db.prepare;

  return db;
}

// ===========================================================================
// SQL key constants (exact strings from the source)
// ===========================================================================
const SQL_RC = 'SELECT * FROM referral_codes WHERE code = ?';
const SQL_PENDING =
  'SELECT id, bonus_type FROM referrals WHERE referred_customer_id = ? AND status = ?';
const SQL_CUSTOMER = 'SELECT id FROM customers WHERE id = ?';

// ===========================================================================
// Tests
// ===========================================================================
describe('applyReferralForNewCustomer', () => {
  beforeEach(() => {
    firstReturn.clear();
    rcRow.customer_id = 'referrer-1';
    rcRow.times_used = 0;
  });

  // --- Test 1: happy path → success ---
  // Preconditions: rc found, pending referral exists (bonus_type='pending'),
  //                no OTHER pending (only the one from process-referral),
  //                referrer customer exists. The function inserts a 2nd referral.
  it('returns success with referrer_cashback_pending when preconditions are met', async() => {
    const db = makeRefDB();
    firstReturn.set(SQL_RC, { ...rcRow, customer_id: 'referrer-1' });
    // The process-referral created a pending record (bonus_type='pending' → eligible for cashback)
    firstReturn.set(SQL_PENDING, { id: 'ref-first', bonus_type: 'pending' });
    firstReturn.set(SQL_CUSTOMER, { id: 'referrer-1' });

    const result = await applyReferralForNewCustomer(db, 'new-customer-1', 'TEST2024');

    expect((result as Record<string, unknown>).success).toBe(true);
    expect((result as Record<string, unknown>).referrer_cashback_pending).toBe(10000);
  });

  // --- Test 2: empty code → no_code (early return, no DB access) ---
  it('returns no_code when referral code is empty string', async() => {
    const db = createMockDB();
    const result = await applyReferralForNewCustomer(db, 'new-customer-1', '');
    expect(result).toEqual({ success: false, reason: 'no_code' });
  });

  // --- Test 3: code not found → invalid_code ---
  it('returns invalid_code when the referral code does not exist in DB', async() => {
    const db = makeRefDB();
    firstReturn.set(SQL_RC, null);

    const result = await applyReferralForNewCustomer(db, 'new-customer-1', 'BADCODE');

    expect(result).toEqual({ success: false, reason: 'invalid_code' });
  });

  // --- Test 4: self-referral ---
  it('returns self_referral when the new customer owns the referral code', async() => {
    const db = makeRefDB();
    firstReturn.set(SQL_RC, { ...rcRow, customer_id: 'new-customer-1' });

    const result = await applyReferralForNewCustomer(db, 'new-customer-1', 'TEST2024');

    expect(result).toEqual({ success: false, reason: 'self_referral' });
  });

  // --- Test 5: no pending referral exists → no_pending_referral ---
  it('returns no_pending_referral when the customer has no pending referral record', async() => {
    const db = makeRefDB();
    // code found, but NO pending referral (null) → function returns no_pending_referral
    firstReturn.set(SQL_RC, { ...rcRow, customer_id: 'referrer-1' });
    firstReturn.set(SQL_PENDING, null);

    const result = await applyReferralForNewCustomer(db, 'new-customer-1', 'TEST2024');

    expect(result).toEqual({ success: false, reason: 'no_pending_referral' });
  });

  // --- Test 6: code normalized to uppercase ---
  it('normalizes referral code to uppercase before the SELECT', async() => {
    const db = makeRefDB();
    let captured: string | undefined;
    const rcStmt = db.prepare(SQL_RC);
    const origBind = rcStmt.bind.bind(rcStmt);
    rcStmt.bind = (...args: unknown[]) => {
      captured = args[0] as string | undefined;
      return origBind(...args);
    };

    await applyReferralForNewCustomer(db, 'new-customer-1', 'lowercase');

    expect(captured).toBe('LOWERCASE');
  });

  // --- Test 7: referrer not found ---
  // Need: pending=valid row (to pass the !pending check), customer=null (to hit referrer_not_found)
  it('returns referrer_not_found when the code owner customer does not exist', async() => {
    const db = makeRefDB();
    firstReturn.set(SQL_RC, { ...rcRow, customer_id: 'ghost-user' });
    // pending must be a valid row so the function doesn't return early at line 17
    firstReturn.set(SQL_PENDING, { id: 'ref-existing', bonus_type: 'cashback' });
    // customer lookup for ghost-user → null triggers referrer_not_found at line 21
    firstReturn.set(SQL_CUSTOMER, null);

    const result = await applyReferralForNewCustomer(db, 'new-customer-1', 'TEST2024');

    expect(result).toEqual({ success: false, reason: 'referrer_not_found' });
  });

  // --- Test 8: already processed points → already_processed_points ---
  it('returns already_processed_points when the pending referral has bonus_type points', async() => {
    const db = makeRefDB();
    firstReturn.set(SQL_RC, { ...rcRow, customer_id: 'referrer-1' });
    // pending referral with bonus_type='points' → the process-referral already handled it
    firstReturn.set(SQL_PENDING, { id: 'ref-pts', bonus_type: 'points' });

    const result = await applyReferralForNewCustomer(db, 'new-customer-1', 'TEST2024');

    expect(result).toEqual({ success: false, reason: 'already_processed_points' });
  });

  // --- Test 9: inserts a second referral and updates times_used ---
  it('inserts a cashback referral record and increments times_used on the code', async() => {
    const db = makeRefDB();
    firstReturn.set(SQL_RC, { ...rcRow, customer_id: 'referrer-1' });
    firstReturn.set(SQL_PENDING, { id: 'ref-first', bonus_type: 'pending' });
    firstReturn.set(SQL_CUSTOMER, { id: 'referrer-1' });

    // Intercept the UPDATE to verify it runs with the rc ID
    let updateRan = false;
    let updateBinds: unknown[] = [];
    const updateStmt = db.prepare('UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?');
    const origBind = updateStmt.bind.bind(updateStmt);
    updateStmt.bind = (...args: unknown[]) => {
      updateBinds = args;
      return origBind(...args);
    };
    const origRun = updateStmt.run.bind(updateStmt);
    updateStmt.run = async(...args: unknown[]) => {
      updateRan = true;
      return (await origRun(...args)) as never;
    };

    const result = await applyReferralForNewCustomer(db, 'new-customer-1', 'TEST2024');

    expect((result as Record<string, unknown>).success).toBe(true);
    expect(updateRan).toBe(true);
    expect(updateBinds[0]).toBe('rc-1');
  });
});
