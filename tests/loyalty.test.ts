/**
 * Loyalty Route Tests — /api/loyalty
 * Complex system with ~15 endpoints. Tests focus on public endpoints
 * (phone-auth, tiers, active-campaign, lookup) and key auth endpoints.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock JWT functions for phone-auth flow (generateJWT) and auth middleware (verifyJWT)
// Use mutable ref so tests can override the resolved email per-case.
let jwtPayload = { email: 'test@example.com', id: 'cust1', name: 'Test User', role: 'customer' };
const mockVerifyJWT = vi.fn(() => Promise.resolve(jwtPayload));
const mockGenerateJWT = vi.fn(() => 'fake-jwt-token');

vi.mock('../worker/src/lib/jwt.ts', () => ({
  verifyJWT: mockVerifyJWT,
  generateJWT: mockGenerateJWT,
  getAuthToken: vi.fn(() => null),
}));

// ── Default customer that satisfies the auth middleware ──
function defaultCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cust1', email: 'test@example.com', name: 'Test User', phone: '0912345678',
    loyalty_points: 0, lifetime_points: 0, loyalty_tier: 'bronze', created_at: '2026-01-01',
    date_of_birth: null, zalo: null, source: null, last_ip: null,
    consent_erpnext_sync: null, updated_at: null, ...overrides,
  };
}

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    customers: [...(seedData.customers || [defaultCustomer()])],
    cashback_wallets: [...(seedData.cashback_wallets || [])],
    cashback_transactions: [...(seedData.cashback_transactions || [])],
    bonus_campaigns: [...(seedData.bonus_campaigns || [])],
    loyalty_tiers: [...(seedData.loyalty_tiers || [])],
    loyalty_point_logs: [...(seedData.loyalty_point_logs || [])],
    loyalty_audit_log: [...(seedData.loyalty_audit_log || [])],
    rewards: [...(seedData.rewards || [])],
    user_rewards: [...(seedData.user_rewards || [])],
    signup_bonus_log: [...(seedData.signup_bonus_log || [])],
  };

  function getTable(sql: string): string {
    const from = sql.match(/\bFROM\s+(\w+)/i);
    if (from) return from[1];
    const insert = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
    if (insert) return insert[1];
    const update = sql.match(/UPDATE\s+(\w+)/i);
    if (update) return update[1];
    return '';
  }

  // Track column→operator for WHERE conditions to avoid range matches as equality
  function extractWhereCols(sql: string): Array<{ col: string; op: string }> {
    const wherePart = sql.match(/WHERE\s+(.+?)(?:ORDER\s+BY|GROUP\s+BY|LIMIT|$)/i);
    if (!wherePart) return [];
    const conds = wherePart[1].split(/\s+AND\s+/i);
    return conds.map(c => {
      const m = c.match(/(\w+)\s*(=|>=|<=|!=|>|<)\s*\?/);
      return m ? { col: m[1], op: m[2] } : null;
    }).filter((x): x is { col: string; op: string } => x !== null);
  }

  // Only use exact WHERE matching for equality ops (skip range conditions)
  function matchWhere(sql: string, row: Record<string, unknown>, bindValues: any[]): boolean {
    const conds = extractWhereCols(sql);
    if (conds.length === 0 || bindValues.length === 0) return true;
    for (let i = 0; i < Math.min(conds.length, bindValues.length); i++) {
      if (conds[i].op !== '=') continue; // Skip range conditions
      if (String(row[conds[i].col]) !== String(bindValues[i])) return false;
    }
    return true;
  }

  return {
    prepare: vi.fn((sql: string) => {
      const bindValues: any[] = [];
      const stmt: any = {
        _sql: sql,
        bind: vi.fn((...vals: any[]) => { bindValues.push(...vals); return stmt; }),
        first: vi.fn(async () => {
          const t = getTable(sql);
          const rows = tables[t] || [];
          const conds = extractWhereCols(sql);
          if (conds.some(c => c.op === '=') && bindValues.length > 0) {
            for (const row of rows) {
              if (matchWhere(sql, row as Record<string, unknown>, bindValues)) return row;
            }
            return null;
          }
          return rows[0] || null;
        }),
        all: vi.fn(async () => {
          const t = getTable(sql);
          const rows = tables[t] || [];
          const conds = extractWhereCols(sql);
          if (conds.some(c => c.op === '=') && bindValues.length > 0) {
            const filtered = rows.filter(r => matchWhere(sql, r as Record<string, unknown>, bindValues));
            return { results: filtered };
          }
          return { results: [...rows] };
        }),
        run: vi.fn(async () => {
          const insert = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
          if (insert) {
            const t = insert[1];
            if (!tables[t]) tables[t] = [];
            const row: any = {};
            const cols = sql.match(/\(([^)]+)\)/);
            if (cols) {
              cols[1].split(',').map(c => c.trim()).forEach((n, i) => {
                row[n] = bindValues[i];
              });
            }
            tables[t].push(row);
          }
          const update = sql.match(/UPDATE\s+(\w+)/i);
          if (update) {
            const hasBalanceCheck = sql.match(/balance\s*>=\s*\?/i);
            if (hasBalanceCheck && bindValues.length >= 2) {
              const amount = Number(bindValues[0]);
              const custId = bindValues[bindValues.length - 1];
              const walletRows = tables['cashback_wallets'] || [];
              const wallet = walletRows.find((w: any) => w.customer_id === custId);
              if (wallet && wallet.balance < amount) {
                return { success: true, meta: { changes: 0 } };
              }
            }
          }
          return { success: true, meta: { changes: 1 } };
        }),
      };
      return stmt;
    }),
    batch: vi.fn(async () => [{ success: true }]),
  };
}

let router: any;
let env: { AURA_DB: ReturnType<typeof createMockD1>; JWT_SECRET: string; JWT_EXPIRY_SECONDS: number; AUTH_KV: null };

beforeEach(async () => {
  vi.clearAllMocks();
  jwtPayload = { email: 'test@example.com', id: 'cust1', name: 'Test User', role: 'customer' };
  env = {
    AURA_DB: createMockD1(),
    JWT_SECRET: 'test-secret',
    JWT_EXPIRY_SECONDS: 3600,
    AUTH_KV: null,
  };
  const mod = await import('../worker/src/routes/loyalty.ts');
  router = mod.loyaltyRouter;
});

describe('GET /active-campaign', () => {
  test('returns 200 with campaign data', async () => {
    env.AURA_DB = createMockD1({
      bonus_campaigns: [{
        id: 'camp1', code: 'SUMMER2026', name: 'Summer 2026', description: 'Summer campaign',
        cashback_multiplier: 2, signup_bonus_vnd: 50000, signup_bonus_cap: 100,
        refer_bonus_vnd: 10000, start_date: '2026-01-01', end_date: '2099-12-31', active: 1,
      }],
    });

    const res = await router.request('/active-campaign', { method: 'GET', headers: { Authorization: 'Bearer fake-jwt-token' } }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.campaign).toBeDefined();
    expect(body.campaign.code).toBe('SUMMER2026');
  });

  test('returns null when no active campaign', async () => {
    const res = await router.request('/active-campaign', { method: 'GET', headers: { Authorization: 'Bearer fake-jwt-token' } }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.campaign).toBeNull();
  });
});

describe('POST /phone-auth', () => {
  test('authenticates existing customer by phone', async () => {
    env.AURA_DB = createMockD1({
      customers: [defaultCustomer({ id: 'cust1', email: 'test@customer.com', name: 'Test', phone: '0912345678', loyalty_points: 100, lifetime_points: 500 })],
    });
    jwtPayload = { email: 'test@customer.com', id: 'cust1', name: 'Test', role: 'customer' };

    const res = await router.request('/phone-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-jwt-token' },
      body: JSON.stringify({ phone: '0912345678' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.customer.phone).toBe('0912345678');
    expect(body.is_new).toBe(false);
    expect(body.token).toBeTruthy();
  });

  test('creates new customer and returns 200', async () => {
    env.AURA_DB = createMockD1({ customers: [defaultCustomer()], cashback_wallets: [] });

    const res = await router.request('/phone-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-jwt-token' },
      body: JSON.stringify({ phone: '0999999999', name: 'New Member' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.is_new).toBe(true);
  });

  test('returns 400 on invalid phone number', async () => {
    const res = await router.request('/phone-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-jwt-token' },
      body: JSON.stringify({ phone: 'not-a-phone' }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('GET /tiers', () => {
  test('returns 200 with tier list', async () => {
    env.AURA_DB = createMockD1({
      loyalty_tiers: [
        { tier_name: 'bronze', min_points: 0, cashback_rate: 0.01, point_multiplier: 1, expiry_days: 365 },
        { tier_name: 'silver', min_points: 1000, cashback_rate: 0.02, point_multiplier: 1.2, expiry_days: 365 },
      ],
    });

    const res = await router.request('/tiers', { method: 'GET', headers: { Authorization: 'Bearer fake-jwt-token' } }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });
});

describe('GET /lookup', () => {
  test('returns 200 with customer info', async () => {
    env.AURA_DB = createMockD1({
      customers: [
        defaultCustomer({ phone: '0900000000' }),
        defaultCustomer({ id: 'cust2', email: 'test@lookup.com', name: 'Test', phone: '0912345678', loyalty_points: 100, lifetime_points: 500 }),
      ],
      cashback_wallets: [{ id: 'wal1', customer_id: 'cust2', balance: 50000, total_earned: 100000, total_spent: 50000 }],
      cashback_transactions: [{ id: 'cbt1', customer_id: 'cust2', type: 'earn', amount: 50000 }],
      loyalty_tiers: [
        { tier_name: 'bronze', min_points: 0, cashback_rate: 0.01, point_multiplier: 1, expiry_days: 365 },
        { tier_name: 'silver', min_points: 1000, cashback_rate: 0.02, point_multiplier: 1.2, expiry_days: 365 },
      ],
    });

    const res = await router.request('/lookup?phone=0912345678', { method: 'GET', headers: { Authorization: 'Bearer fake-jwt-token' } }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.member.name).toBe('Test');
    expect(body.member.cashback_balance).toBe(50000);
  });

  test('returns ok: false when phone not found', async () => {
    const res = await router.request('/lookup?phone=0999999999', { method: 'GET', headers: { Authorization: 'Bearer fake-jwt-token' } }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/không tìm thấy/i);
  });

  test('returns 400 when phone missing', async () => {
    const res = await router.request('/lookup', { method: 'GET', headers: { Authorization: 'Bearer fake-jwt-token' } }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
