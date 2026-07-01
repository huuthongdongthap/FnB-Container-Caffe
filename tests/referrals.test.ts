/**
 * Referral Route Tests — /api/referrals
 * Auth-gated via requireCustomer middleware.
 */
import { describe, test, expect, vi, beforeEach, beforeAll } from 'vitest';

// Mock JWT verification before importing the route
vi.mock('../worker/src/lib/jwt.ts', () => ({
  verifyJWT: vi.fn(() => Promise.resolve({ email: 'test@example.com', id: 'cust1', name: 'Test User', role: 'customer' })),
  generateJWT: vi.fn(() => 'fake-jwt-token'),
  getAuthToken: vi.fn(() => null),
}));

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    customers: [...(seedData.customers || [])],
    referral_codes: [...(seedData.referral_codes || [])],
    referrals: [...(seedData.referrals || [])],
    cashback_wallets: [...(seedData.cashback_wallets || [])],
    cashback_transactions: [...(seedData.cashback_transactions || [])],
    loyalty_audit_log: [...(seedData.loyalty_audit_log || [])],
    loyalty_point_logs: [...(seedData.loyalty_point_logs || [])],
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

  function extractWhereCols(sql: string): string[] {
    const wherePart = sql.match(/WHERE\s+(.+?)(?:ORDER\s+BY|GROUP\s+BY|LIMIT|$)/i);
    if (!wherePart) return [];
    const conds = wherePart[1].split(/\s+AND\s+/i);
    return conds.map(c => {
      const m = c.match(/(\w+)\s*(?:=|>=|<=|!=|>|<)\s*\?/);
      return m ? m[1] : '';
    }).filter(Boolean);
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
          const whereCols = extractWhereCols(sql);
          if (whereCols.length > 0 && bindValues.length > 0) {
            for (const row of rows) {
              let match = true;
              for (let i = 0; i < Math.min(whereCols.length, bindValues.length); i++) {
                if (String((row as Record<string, unknown>)[whereCols[i]]) !== String(bindValues[i])) { match = false; break; }
              }
              if (match) return row;
            }
            return null;
          }
          return rows[0] || null;
        }),
        all: vi.fn(async () => {
          const t = getTable(sql);
          const rows = tables[t] || [];
          const whereCols = extractWhereCols(sql);
          if (whereCols.length > 0 && bindValues.length > 0) {
            const filtered = rows.filter(r => {
              for (let i = 0; i < Math.min(whereCols.length, bindValues.length); i++) {
                if (String((r as Record<string, unknown>)[whereCols[i]]) !== String(bindValues[i])) return false;
              }
              return true;
            });
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
          return { success: true };
        }),
      };
      return stmt;
    }),
    batch: vi.fn(async () => [{ success: true }]),
  };
}

function createEnv(overrides: Record<string, unknown> = {}) {
  return { AURA_DB: createMockD1(), JWT_SECRET: 'test-secret', ...overrides };
}

let router: any;
let env: ReturnType<typeof createEnv>;

beforeEach(async () => {
  vi.clearAllMocks();
  env = createEnv();
  const mod = await import('../worker/src/routes/referrals.ts');
  router = mod.referralRouter;
});

describe('GET /code', () => {
  test('returns referral code for existing customer', async () => {
    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', email: 'test@example.com', name: 'Test User', phone: '0912345678' }],
      referral_codes: [{ id: 'refc_1', customer_id: 'cust1', code: 'FNB-ABC123', times_used: 2, total_points_earned: 100, created_at: '2026-01-01' }],
    });

    const res = await router.request('/code', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake-token' },
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.code).toBe('FNB-ABC123');
  });
});

describe('POST /apply', () => {
  test('applies referral code successfully', async () => {
    env.AURA_DB = createMockD1({
      customers: [
        { id: 'cust1', email: 'test@example.com', name: 'Test User', phone: '0912345678', last_ip: null },
        { id: 'cust2', email: 'referrer@example.com', name: 'Referrer', phone: '0987654321', last_ip: '10.0.0.1' },
      ],
      referral_codes: [{ id: 'refc_1', customer_id: 'cust2', code: 'FNB-ABC123', times_used: 0, total_points_earned: 0, created_at: '2026-01-01' }],
      referrals: [],
    });

    const res = await router.request('/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({ code: 'FNB-ABC123' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.referrer_cashback_pending).toBe(10000);
  });

  test('returns 400 on missing code', async () => {
    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', email: 'test@example.com', name: 'Test User', phone: '0912345678' }],
    });

    const res = await router.request('/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 404 for nonexistent referral code', async () => {
    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', email: 'test@example.com', name: 'Test User', phone: '0912345678' }],
    });

    const res = await router.request('/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({ code: 'INVALID' }),
    }, env);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/khong t.n t.i|không tồn tại/i);
  });
});

describe('GET /stats', () => {
  test('returns referral stats', async () => {
    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', email: 'test@example.com', name: 'Test User', phone: '0912345678' }],
      referral_codes: [{ id: 'refc_1', customer_id: 'cust1', code: 'FNB-ABC123', times_used: 3, total_points_earned: 100, created_at: '2026-01-01' }],
      referrals: [],
    });

    const res = await router.request('/stats', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake-token' },
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.total_referrals).toBe(0);
  });
});
