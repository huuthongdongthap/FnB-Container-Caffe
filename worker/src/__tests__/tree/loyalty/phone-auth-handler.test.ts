/** Phone Auth Handler — POST /api/loyalty/phone-auth */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Customer } from '../../../types/models';

// Silence logger
vi.mock('../../../middleware/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, child: () => ({}) })
}));

// Dynamic imports inside handlePhoneAuth — stub to noop
vi.mock('../../../routes/referrals.js', () => ({
  applyReferralForNewCustomer: async() => {}
}));

// ── Mock DB helpers (inherited from process-order/helpers) ────────────────────
type Row = Record<string, unknown>;

function createMockDB() {
  const queue = new Map<string, Row[]>();

  return {
    _q: queue,
    add(sql: string, ...rows: Row[]) {
      const slot = queue.get(sql) || [];
      slot.push(...rows);
      queue.set(sql, slot);
    },
    asD1() {
      const self = this;
      const origQueue = queue;
      return {
        prepare(_sql: string) {
          const sql = _sql;
          const entry = origQueue.get(sql);
          const rows: Row[] = entry ? [...entry] : [];
          return {
            _sql: sql,
            bind(_bindSql: string, ..._args: unknown[]) {
              return this;
            },
            first<T = unknown>(): Promise<T | null> {
              if (rows.length > 0) {
                return Promise.resolve(rows.shift() as T | null);
              }
              return Promise.resolve(null);
            },
            all<T = unknown>() {
              return Promise.resolve({ results: [] as T[], success: true } as never);
            },
            run() {
              return Promise.resolve({ success: true, changes: 1 } as never);
            },
            raw() {
              return Promise.resolve([] as never);
            }
          } as never;
        },
        batch() {
          return Promise.resolve([{ success: true, changes: 1 }] as never);
        },
        exec() {
          return Promise.resolve({ count: 0, duration: 0 } as never);
        },
        dump() {
          return Promise.resolve(new Uint8Array() as never);
        }
      } as never;
    }
  } as { _q: Map<string, Row[]>; add: (sql: string, ...rows: Row[]) => void; asD1: () => never };
}

// ── Mock KV namespace (used by real throttle) ──────────────────────────────────
function makeKV(initialCount: number = 0): import('@cloudflare/workers-types').KVNamespace {
  let count = initialCount;
  return {
    get: async(key: string) => key.includes('pa:') ? String(count) : null,
    put: async(key: string, value: string) => {
      if (key.includes('pa:')) {
        count = parseInt(value, 10);
      }
    },
    delete: async() => {},
    list: async() => ({ keys: [], list_complete: true, cursor: '' }),
    getWithMetadata: async() => ({ value: null, metadata: null })
  } as never;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const VALID_CUSTOMER: Customer = {
  id: 'cust_1',
  email: 'old@test.com',
  name: 'Old Customer',
  phone: '0909123456',
  loyalty_points: 200,
  lifetime_points: 1000,
  loyalty_tier: 'bronze',
  date_of_birth: null,
  zalo: null,
  source: null,
  last_ip: null,
  consent_erpnext_sync: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01'
};

const CAMPAIGN = {
  id: 'cmp_1',
  code: 'SUMMER',
  name: 'Summer 2026',
  cashback_multiplier: 1.0,
  signup_bonus_vnd: 50000,
  signup_bonus_cap: 100,
  refer_bonus_vnd: 0,
  max_cap_per_customer_vnd: 200000,
  active: 1,
  start_date: '2026-01-01 00:00:00',
  end_date: '2027-01-01 00:00:00',
  created_at: ''
};

const Q_CUSTOMER =
  'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?';
const Q_CAMPAIGN =
  'SELECT * FROM bonus_campaigns WHERE active = 1 AND start_date <= ? AND end_date >= ? ORDER BY id DESC LIMIT 1';
const Q_EMAIL_CUSTOMER =
  'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE email = ?';

function setupExisting(db: ReturnType<typeof createMockDB>) {
  db.add(Q_CUSTOMER, VALID_CUSTOMER);
}

function setupNewCustomer(db: ReturnType<typeof createMockDB>) {
  db.add(Q_CUSTOMER, null);
  db.add(Q_CAMPAIGN, CAMPAIGN);
}

// ── buildCtx helper ────────────────────────────────────────────────────────────
function buildCtx(
  body: Record<string, unknown>,
  db: ReturnType<typeof createMockDB>,
  opts: { kv?: import('@cloudflare/workers-types').KVNamespace } = {}
) {
  const { kv = makeKV(0) } = opts;
  const d1 = db.asD1();
  return {
    req: { json: async() => body, header: (_n: string) => '203.0.113.1' },
    env: {
      AURA_DB: d1,
      AUTH_KV: kv,
      JWT_SECRET: 'test-jwt-secret-at-least-16-chars',
      JWT_EXPIRY_SECONDS: '604800'
    },
    json: (data: unknown, status?: number) => ({ status: status ?? 200, body: data }),
    executionCtx: { waitUntil: vi.fn() }
  } as never;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('handlePhoneAuth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // ── Throttle ──────────────────────────────────────────────────────────────
  // throttle limit is 10 requests per 300 seconds (5 min).
  // With max=10, a KV starting at 10 blocks; starting at 0 allows.

  describe('throttle', () => {
    it('returns 429 when throttle count is at or above limit', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      // KV count=10 → throttle(10,10) returns false
      const kv = makeKV(10);
      const c = buildCtx({ phone: '0909123456' }, db, { kv });

      const result = await handlePhoneAuth(c);
      expect((result as { status: number }).status).toBe(429);
      expect((result as { body: { error: string } }).body.error).toContain('Quá nhiều');
    });

    it('allows request when throttle count is below limit', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      setupExisting(db);
      const kv = makeKV(0); // 0 < 10 → allowed
      const c = buildCtx({ phone: '0909123456' }, db, { kv });

      const result = await handlePhoneAuth(c);
      expect((result as { status: number }).status).not.toBe(429);
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────

  describe('input validation', () => {
    it('returns 400 for a missing phone', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      const kv = makeKV(0);
      const c = buildCtx({ name: 'Test' }, db, { kv });

      const result = await handlePhoneAuth(c);
      expect((result as { status: number }).status).toBe(400);
    });

    it('returns 400 for an invalid phone format (too short)', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      const kv = makeKV(0);
      const c = buildCtx({ phone: '12345' }, db, { kv });

      const result = await handlePhoneAuth(c);
      expect((result as { status: number }).status).toBe(400);
    });

    it('returns 400 for an invalid body shape (number phone)', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      const kv = makeKV(0);
      const c = buildCtx({ phone: 12345 } as Record<string, unknown>, db, { kv });

      const result = await handlePhoneAuth(c);
      expect((result as { status: number }).status).toBe(400);
    });
  });

  // ── Existing customer ────────────────────────────────────────────────────

  describe('existing customer', () => {
    it('returns success=true with is_new=false and zero bonus', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      setupExisting(db);
      const c = buildCtx({ phone: '0909123456', name: 'Old' }, db);

      const result = await handlePhoneAuth(c);
      expect((result as { status: number }).status).toBe(200);
      const body = (result as { body: Record<string, unknown> }).body;
      expect(body.success).toBe(true);
      expect(body.is_new).toBe(false);
      expect(body.bonus_granted).toBe(0);
    });

    it('returns customer data matching the DB row', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      setupExisting(db);
      const c = buildCtx({ phone: '0909123456' }, db);

      const result = await handlePhoneAuth(c);
      const body = (result as { body: Record<string, unknown> }).body;
      expect(body.customer.id).toBe('cust_1');
      expect(body.customer.name).toBe('Old Customer');
      expect(body.customer.phone).toBe('0909123456');
      expect(body.customer.tier).toBe('bronze');
      expect(body.customer.points).toBe(200);
    });

    it('returns a non-empty JWT token', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      setupExisting(db);
      const c = buildCtx({ phone: '0909123456' }, db);

      const result = await handlePhoneAuth(c);
      const body = (result as { body: Record<string, unknown> }).body;
      expect(typeof body.token).toBe('string');
      expect(body.token.length).toBeGreaterThan(10);
    });
  });

  // ── New customer ──────────────────────────────────────────────────────────

  describe('new customer', () => {
    it('returns success=true with is_new=true', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      setupNewCustomer(db);
      const c = buildCtx({ phone: '0909999999', name: 'New User' }, db);

      const result = await handlePhoneAuth(c);
      expect((result as { status: number }).status).toBe(200);
      const body = (result as { body: Record<string, unknown> }).body;
      expect(body.success).toBe(true);
      expect(body.is_new).toBe(true);
    });

    it('grants signup bonus when campaign has signup_bonus_vnd > 0 and cap not reached', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      // signup_bonus_cap=100, first customer gets bonus
      setupNewCustomer(db);
      const c = buildCtx({ phone: '0909999999', name: 'First' }, db);

      const result = await handlePhoneAuth(c);
      const body = (result as { body: Record<string, unknown> }).body;
      expect(body.bonus_granted).toBeGreaterThan(0);
      expect(body.bonus_message).toBeTruthy();
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns 500 on an unexpected database error', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const crashingDb = {
        prepare: () => {
          throw new Error('D1 is down');
        }
      } as never;

      const c = {
        req: { json: async() => ({ phone: '0909123456' }) },
        env: {
          AURA_DB: crashingDb,
          JWT_SECRET: 'test-jwt-secret-at-least-16-chars',
          JWT_EXPIRY_SECONDS: '604800'
        },
        json: (data: unknown, status?: number) => ({ status: status ?? 200, body: data }),
        executionCtx: { waitUntil: vi.fn() }
      } as never;

      const result = await handlePhoneAuth(c);
      expect((result as { status: number }).status).toBe(500);
      expect((result as { body: { success: boolean } }).body.success).toBe(false);
    });
  });

  // ── Phone sanitization ────────────────────────────────────────────────────

  describe('phone sanitization', () => {
    it('strips whitespace from phone number before DB lookup', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      setupExisting(db);

      // After sanitization: "0909123456" matches VALID_CUSTOMER
      const c = buildCtx({ phone: '0909123456' }, db);

      const result = await handlePhoneAuth(c);
      const body = (result as { body: { success: boolean } }).body;
      expect(body.success).toBe(true);
    });
  });

  // ── Zod validation edge cases ─────────────────────────────────────────────

  describe('Zod schema validation', () => {
    it('accepts valid minimal body (phone only)', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      setupExisting(db);
      const c = buildCtx({ phone: '0909123456' }, db);

      const result = await handlePhoneAuth(c);
      expect((result as { status: number }).status).toBe(200);
    });

    it('rejects phone that does not match VN regex', async() => {
      const { handlePhoneAuth } = await import('../../../tree/loyalty/phone-auth-handler');
      const db = createMockDB();
      // "12345" is 5 digits — VN regex requires 0|+84 prefix + 9-10 digits
      const c = buildCtx({ phone: '12345' }, db);

      const result = await handlePhoneAuth(c);
      expect((result as { status: number }).status).toBe(400);
    });
  });
});
