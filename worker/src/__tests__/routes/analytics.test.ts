/**
 * Tests for Analytics Endpoints (Phases A1 + A2)
 *
 * Tests top-products, peak-hours, customer-metrics, and CSV export.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTopProducts } from '../../tree/analytics/top-products';
import { getPeakHours } from '../../tree/analytics/peak-hours';
import { getCustomerMetrics } from '../../tree/analytics/customer-metrics';
import { getOrdersInRange, formatCsvRows } from '../../tree/analytics/csv-export';
import { getSummary, getSummaryCompare, getGrouped } from '../../tree/analytics/summary';
import { analyticsRouter } from '../../routes/analytics-hono';
import { createMockEnv } from '../test-utils';


function mockToken(role: string = 'owner'): string {
  try {
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      id: 'u_1', sub: 'u_1', role,
      email: role === 'owner' ? 'owner@test.aura' : 'user@test.aura',
      name: role === 'owner' ? 'Owner Test' : 'User Test',
      iat: Math.floor(Date.now()/1000),
      exp: Math.floor(Date.now()/1000) + 3600,
      // The staff-session gate needs the token to name the credential entry it
      // came from and the session version it was issued at.
      ...(role === 'customer' ? {} : { authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' })
    })).toString('base64url');
    const sig = crypto.createHmac('sha256', 'test-jwt-secret-at-least-16-chars').update(header+'.'+payload).digest('base64url');
    return 'Bearer ' + header + '.' + payload + '.' + sig;
  } catch {
    return 'Bearer stub_token';
  }
}

// ───── getTopProducts ─────

describe('getTopProducts (tree/analytics)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  function createMockDb() {
    const allFn = vi.fn().mockResolvedValue({ results: [] });
    const firstFn = vi.fn().mockResolvedValue(null);
    return {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: firstFn,
          all: allFn,
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } })
        })
      }),
      _all: allFn,
      _bind: vi.fn()
    } as unknown as import('@cloudflare/workers-types').D1Database;
  }

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('returns empty array when no orders exist', async() => {
    const result = await getTopProducts(mockDb, 10);
    expect(result).toEqual([]);
  });

  it('returns top products sorted by quantity descending', async() => {
    const rows = [
      { product_name: 'Americano', total_qty: 10, revenue: 50000 },
      { product_name: 'Latte', total_qty: 8, revenue: 56000 },
      { product_name: 'Espresso', total_qty: 5, revenue: 25000 }
    ];
    const allFn = vi.fn().mockResolvedValue({ results: rows, success: true });
    const bindFn = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null), all: allFn, run: vi.fn() });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn });

    const result = await getTopProducts(mockDb, 10);
    expect(result).toHaveLength(3);
    expect(result[0].product_name).toBe('Americano');
    expect(result[0].total_qty).toBe(10);
    expect(result[1].product_name).toBe('Latte');
    expect(result[2].product_name).toBe('Espresso');
  });

  it('passes limit to bind in SQL query', async() => {
    const allFn = vi.fn().mockResolvedValue({ results: [], success: true });
    const bindFn = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null), all: allFn, run: vi.fn() });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn });

    await getTopProducts(mockDb, 3);
    // The SQL should contain LIMIT and bind should be called with 3
    const sql = (mockDb.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql.toUpperCase()).toContain('LIMIT');
    expect(bindFn).toHaveBeenCalledWith(3);
  });

  it('filters out cancelled orders', async() => {
    const allFn = vi.fn().mockResolvedValue({ results: [], success: true });
    const bindFn = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null), all: allFn, run: vi.fn() });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn });

    await getTopProducts(mockDb, 10);
    const sql = (mockDb.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql.toLowerCase()).toContain('cancelled');
  });

  it('returns valid revenue numbers', async() => {
    const rows = [
      { product_name: 'Americano', total_qty: 10, revenue: 50000 }
    ];
    const allFn = vi.fn().mockResolvedValue({ results: rows, success: true });
    const bindFn = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null), all: allFn, run: vi.fn() });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn });

    const result = await getTopProducts(mockDb, 10);
    expect(result[0].revenue).toBe(50000);
  });
});

// ───── getPeakHours ─────

describe('getPeakHours (tree/analytics)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  function createMockDb() {
    const allFn = vi.fn().mockResolvedValue({ results: [] });
    return {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ all: allFn })
      }),
      _all: allFn
    } as unknown as import('@cloudflare/workers-types').D1Database;
  }

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('returns 24-hour zero-filled array when no orders', async() => {
    const allFn = vi.fn().mockResolvedValue({ results: [], success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn })
    });

    const result = await getPeakHours(mockDb, 30);
    expect(result).toHaveLength(24);
    for (let h = 0; h < 24; h++) {
      expect(result[h].hour).toBe(h);
      expect(result[h].order_count).toBe(0);
      expect(result[h].revenue).toBe(0);
    }
  });

  it('returns correct distribution with data', async() => {
    const rows = [
      { hour: 8, order_count: 5, revenue: 25000 },
      { hour: 12, order_count: 15, revenue: 120000 },
      { hour: 18, order_count: 20, revenue: 180000 }
    ];
    const allFn = vi.fn().mockResolvedValue({ results: rows, success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn })
    });

    const result = await getPeakHours(mockDb, 30);
    expect(result).toHaveLength(24);
    expect(result[8].order_count).toBe(5);
    expect(result[12].order_count).toBe(15);
    expect(result[18].order_count).toBe(20);
    expect(result[18].revenue).toBe(180000);
    expect(result[3].order_count).toBe(0);
    expect(result[3].revenue).toBe(0);
  });

  it('revenue is number type', async() => {
    const rows = [{ hour: 10, order_count: 3, revenue: 45000 }];
    const allFn = vi.fn().mockResolvedValue({ results: rows, success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn })
    });

    const result = await getPeakHours(mockDb, 7);
    expect(typeof result[10].revenue).toBe('number');
    expect(result[10].revenue).toBe(45000);
  });

  it('passes days to bind in SQL query', async() => {
    const allFn = vi.fn().mockResolvedValue({ results: [], success: true });
    const bindFn = vi.fn().mockReturnValue({ all: allFn });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn });

    await getPeakHours(mockDb, 14);
    expect(bindFn).toHaveBeenCalledWith(14);
  });
});

// ───── getSummary (tree/analytics/summary) ─────

describe('getSummary (tree/analytics/summary)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  function createMockDb() {
    const firstFn = vi.fn().mockResolvedValue(null);
    return {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ first: firstFn })
      }),
      _first: firstFn
    } as unknown as import('@cloudflare/workers-types').D1Database;
  }

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('returns zeroed metrics when no orders', async() => {
    const result = await getSummary(mockDb, 30);
    expect(result).toEqual({
      total_orders: 0,
      total_revenue: 0,
      avg_order_value: 0,
      total_customers: 0
    });
  });

  it('returns aggregate metrics from D1 row', async() => {
    const row = { total_orders: 42, total_revenue: 2100000, avg_order_value: 50000, total_customers: 18 };
    const firstFn = vi.fn().mockResolvedValue(row);
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: vi.fn().mockReturnValue({ first: firstFn }) });

    const result = await getSummary(mockDb, 7);
    expect(result).toEqual(row);
  });

  it('passes days parameter to bind', async() => {
    const bindFn = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn });

    await getSummary(mockDb, 14);
    expect(bindFn).toHaveBeenCalledWith(14);
  });
});

// ───── getSummaryCompare (tree/analytics/summary) ─────

describe('getSummaryCompare (tree/analytics/summary)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  function createMockDb() {
    const firstFn = vi.fn().mockResolvedValue(null);
    return {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ first: firstFn })
      }),
      _first: firstFn
    } as unknown as import('@cloudflare/workers-types').D1Database;
  }

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('returns current and previous periods', async() => {
    const current = { total_orders: 50, total_revenue: 2500000, avg_order_value: 50000, total_customers: 20 };
    const previous = { total_orders: 40, total_revenue: 2000000, avg_order_value: 50000, total_customers: 15 };
    const firstFn = vi.fn()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(previous);

    const bindFn = vi.fn()
      .mockReturnValueOnce({ first: firstFn })
      .mockReturnValueOnce({ first: vi.fn().mockResolvedValueOnce(previous) });

    // Override prepare to return chain for each call
    const prepareFn = vi.fn()
      .mockReturnValueOnce({ bind: vi.fn().mockReturnValue({ first: firstFn }) })
      .mockReturnValueOnce({ bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValueOnce(previous) }) });

    (mockDb.prepare as ReturnType<typeof vi.fn>).mockImplementation(prepareFn);

    const result = await getSummaryCompare(mockDb, 30);
    expect(result.current).toEqual(current);
    expect(result.previous).toEqual(previous);
  });

  it('handles zero-data periods gracefully', async() => {
    const firstFn = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    (mockDb.prepare as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ bind: vi.fn().mockReturnValue({ first: firstFn }) })
      .mockReturnValueOnce({ bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValueOnce(null) }) });

    const result = await getSummaryCompare(mockDb, 30);
    expect(result.current.total_orders).toBe(0);
    expect(result.previous.total_revenue).toBe(0);
  });

  it('returns data with correct shape', async() => {
    const row = { total_orders: 10, total_revenue: 500000, avg_order_value: 50000, total_customers: 5 };
    const firstFn = vi.fn()
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(row);
    (mockDb.prepare as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ bind: vi.fn().mockReturnValue({ first: firstFn }) })
      .mockReturnValueOnce({ bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValueOnce(row) }) });

    const result = await getSummaryCompare(mockDb, 7);
    expect(result).toHaveProperty('current');
    expect(result).toHaveProperty('previous');
    expect(result.current).toHaveProperty('total_orders');
    expect(result.current).toHaveProperty('total_revenue');
    expect(result.current).toHaveProperty('avg_order_value');
    expect(result.current).toHaveProperty('total_customers');
  });
});

// ───── getGrouped (tree/analytics/summary) ─────

describe('getGrouped (tree/analytics/summary)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  function createMockDb() {
    const allFn = vi.fn().mockResolvedValue({ results: [] });
    return {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ all: allFn })
      }),
      _all: allFn
    } as unknown as import('@cloudflare/workers-types').D1Database;
  }

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('returns zero-filled 24-hour array for group=hour', async() => {
    const allFn = vi.fn().mockResolvedValue({ results: [], success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn })
    });

    const result = await getGrouped(mockDb, 'hour', 30);
    expect(result).toHaveLength(24);
    for (let h = 0; h < 24; h++) {
      expect(result[h].label).toBe(String(h));
      expect(result[h].value).toBe(0);
      expect(result[h].count).toBe(0);
    }
  });

  it('returns populated hour groups', async() => {
    const rows = [
      { label: '8', value: 250000, count: 5 },
      { label: '12', value: 600000, count: 12 },
      { label: '18', value: 900000, count: 18 }
    ];
    const allFn = vi.fn().mockResolvedValue({ results: rows, success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn })
    });

    const result = await getGrouped(mockDb, 'hour', 30);
    expect(result).toHaveLength(24);
    expect(result[8].value).toBe(250000);
    expect(result[12].count).toBe(12);
    expect(result[18].value).toBe(900000);
    expect(result[3].value).toBe(0);
  });

  it('returns day groups sorted by date', async() => {
    const rows = [
      { label: '2026-07-01', value: 500000, count: 10 },
      { label: '2026-07-02', value: 600000, count: 12 }
    ];
    const allFn = vi.fn().mockResolvedValue({ results: rows, success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn })
    });

    const result = await getGrouped(mockDb, 'day', 7);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('2026-07-01');
    expect(result[1].value).toBe(600000);
  });

  it('returns category groups sorted by value descending', async() => {
    const rows = [
      { label: 'Coffee', value: 2000000, count: 40 },
      { label: 'Tea', value: 800000, count: 20 }
    ];
    const allFn = vi.fn().mockResolvedValue({ results: rows, success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn })
    });

    const result = await getGrouped(mockDb, 'category', 30);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Coffee');
    expect(result[0].value).toBe(2000000);
  });

  it('returns payment method groups', async() => {
    const rows = [
      { label: 'cash', value: 1500000, count: 30 },
      { label: 'momo', value: 900000, count: 15 }
    ];
    const allFn = vi.fn().mockResolvedValue({ results: rows, success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn })
    });

    const result = await getGrouped(mockDb, 'payment', 30);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('cash');
    expect(result[1].count).toBe(15);
  });

  it('passes days to bind', async() => {
    const bindFn = vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: [], success: true }) });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn });

    await getGrouped(mockDb, 'day', 14);
    expect(bindFn).toHaveBeenCalledWith(14);
  });
});

describe('analyticsRouter (Hono routes)', () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    const payoutRow = { cod_payout: 125000, payos_payout: 340000, refunded: 15000, total_orders: 5 };
    const accountRow = { id: 'u_1', name: 'Owner Test', phone: null, role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 };
    env = createMockEnv({
      AURA_DB: {
        // The session gate reads the staff account row behind a token and binds
        // that lookup before reading it, so the account row is answered on the
        // bound statement. Every other query answers the payout aggregate.
        prepare: (sql: string) => {
          const isAccountLookup = /FROM users WHERE id = \?/i.test(sql);
          const bound = {
            first: async () => (isAccountLookup ? accountRow : payoutRow),
            all: async () => ({ results: [], success: true }),
            run: async () => ({ meta: { changes: 0 } }),
            raw: async () => [],
          };
          return {
            first: bound.first,
            bind: () => bound,
            all: bound.all,
            run: bound.run,
            raw: bound.raw,
          };
        },
        batch: async () => [],
        exec: async () => ({ count: 0, duration: 0 }),
        dump: async () => new Uint8Array()
      } as unknown as import('@cloudflare/workers-types').D1Database,
      AUTH_KV: createMockEnv().AUTH_KV
    });
  });

  it('returns 401 without token', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/payout'),
      env
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for customer role', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/payout', {
        headers: { Authorization: mockToken('customer') }
      }),
      env
    );
    expect(res.status).toBe(403);
  });

  it('returns 200 with payout fields for owner', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/payout', {
        headers: { Authorization: mockToken('owner') }
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    const data = body.data as Record<string, number>;
    expect(typeof data.cod).toBe('number');
    expect(typeof data.payos).toBe('number');
    expect(typeof data.refunded).toBe('number');
    expect(typeof data.net).toBe('number');
  });
});

