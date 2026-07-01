/**
 * Promotions Route Tests — /api/promotions
 * Discount code validation and redemption.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    promotions: [...(seedData.promotions || [])],
    promotion_redemptions: [...(seedData.promotion_redemptions || [])],
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

  return {
    prepare: vi.fn((sql: string) => {
      const bindValues: any[] = [];
      const stmt: any = {
        _sql: sql,
        bind: vi.fn((...vals: any[]) => { bindValues.push(...vals); return stmt; }),
        first: vi.fn(async () => {
          const t = getTable(sql);
          return (tables[t] || [])[0] || null;
        }),
        all: vi.fn(async () => {
          const t = getTable(sql);
          return { results: [...(tables[t] || [])] };
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
          return { success: true, meta: { changes: 1 } };
        }),
      };
      return stmt;
    }),
  };
}

function createEnv(overrides: Record<string, unknown> = {}) {
  return { AURA_DB: createMockD1(), ...overrides };
}

let router: any;
let env: ReturnType<typeof createEnv>;

beforeEach(async () => {
  vi.clearAllMocks();
  env = createEnv();
  const mod = await import('../worker/src/routes/promotions.ts');
  router = mod.promotionsRouter;
});

const validPromo = {
  id: 'promo1', code: 'SAVE10', percent: 10, max_discount: 50000,
  min_order: 50000, expires_at: '2099-12-31', usage_limit: 100, usage_count: 0, is_active: 1,
};

describe('POST /validate', () => {
  test('returns valid for valid code', async () => {
    env.AURA_DB = createMockD1({ promotions: [{ ...validPromo }] });

    const res = await router.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SAVE10', order_total: 100000 }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(true);
    expect(body.data.percent).toBe(10);
  });

  test('returns invalid for nonexistent code', async () => {
    const res = await router.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'INVALID' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.valid).toBe(false);
  });

  test('returns 400 on missing code', async () => {
    const res = await router.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns invalid for expired code', async () => {
    env.AURA_DB = createMockD1({
      promotions: [{ ...validPromo, expires_at: '2020-01-01' }],
    });

    const res = await router.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SAVE10' }),
    }, env);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(false);
    expect(body.data.reason).toMatch(/expired/i);
  });
});

describe('POST /redeem', () => {
  test('redeems valid code and returns discount', async () => {
    env.AURA_DB = createMockD1({ promotions: [{ ...validPromo }] });

    const res = await router.request('/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SAVE10', order_id: 'ord1', order_total: 100000 }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.discount_amount).toBe(10000); // 10% of 100000 = 10000
  });

  test('returns 400 for invalid code', async () => {
    const res = await router.request('/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'INVALID', order_id: 'ord1', order_total: 100000 }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid code/i);
  });

  test('returns 400 on missing code', async () => {
    const res = await router.request('/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ord1', order_total: 100000 }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
