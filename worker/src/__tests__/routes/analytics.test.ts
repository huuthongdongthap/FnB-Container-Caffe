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
import { analyticsRouter } from '../../routes/analytics-hono';
import { createMockEnv } from '../test-utils';

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
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        }),
      }),
      _all: allFn,
      _bind: vi.fn(),
    } as unknown as import('@cloudflare/workers-types').D1Database;
  }

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('returns empty array when no orders exist', async () => {
    const result = await getTopProducts(mockDb, 10);
    expect(result).toEqual([]);
  });

  it('returns top products sorted by quantity descending', async () => {
    const rows = [
      { product_name: 'Americano', total_qty: 10, revenue: 50000 },
      { product_name: 'Latte', total_qty: 8, revenue: 56000 },
      { product_name: 'Espresso', total_qty: 5, revenue: 25000 },
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

  it('passes limit to bind in SQL query', async () => {
    const allFn = vi.fn().mockResolvedValue({ results: [], success: true });
    const bindFn = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null), all: allFn, run: vi.fn() });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn });

    await getTopProducts(mockDb, 3);
    // The SQL should contain LIMIT and bind should be called with 3
    const sql = (mockDb.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql.toUpperCase()).toContain('LIMIT');
    expect(bindFn).toHaveBeenCalledWith(3);
  });

  it('filters out cancelled orders', async () => {
    const allFn = vi.fn().mockResolvedValue({ results: [], success: true });
    const bindFn = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null), all: allFn, run: vi.fn() });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn });

    await getTopProducts(mockDb, 10);
    const sql = (mockDb.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql.toLowerCase()).toContain('cancelled');
  });

  it('returns valid revenue numbers', async () => {
    const rows = [
      { product_name: 'Americano', total_qty: 10, revenue: 50000 },
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
        bind: vi.fn().mockReturnValue({ all: allFn }),
      }),
      _all: allFn,
    } as unknown as import('@cloudflare/workers-types').D1Database;
  }

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('returns 24-hour zero-filled array when no orders', async () => {
    const allFn = vi.fn().mockResolvedValue({ results: [], success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn }),
    });

    const result = await getPeakHours(mockDb, 30);
    expect(result).toHaveLength(24);
    for (let h = 0; h < 24; h++) {
      expect(result[h].hour).toBe(h);
      expect(result[h].order_count).toBe(0);
      expect(result[h].revenue).toBe(0);
    }
  });

  it('returns correct distribution with data', async () => {
    const rows = [
      { hour: 8, order_count: 5, revenue: 25000 },
      { hour: 12, order_count: 15, revenue: 120000 },
      { hour: 18, order_count: 20, revenue: 180000 },
    ];
    const allFn = vi.fn().mockResolvedValue({ results: rows, success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn }),
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

  it('revenue is number type', async () => {
    const rows = [{ hour: 10, order_count: 3, revenue: 45000 }];
    const allFn = vi.fn().mockResolvedValue({ results: rows, success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn }),
    });

    const result = await getPeakHours(mockDb, 7);
    expect(typeof result[10].revenue).toBe('number');
    expect(result[10].revenue).toBe(45000);
  });

  it('passes days to bind in SQL query', async () => {
    const allFn = vi.fn().mockResolvedValue({ results: [], success: true });
    const bindFn = vi.fn().mockReturnValue({ all: allFn });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn });

    await getPeakHours(mockDb, 14);
    expect(bindFn).toHaveBeenCalledWith(14);
  });
});

// ───── analyticsRouter (Hono route) ─────

describe('analyticsRouter (Hono routes)', () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    env = createMockEnv({
      AURA_DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => null,
            all: async () => ({ results: [], success: true }),
            run: async () => ({ meta: { changes: 0 } }),
            raw: async () => [],
          }),
          batch: async () => [],
          exec: async () => ({ count: 0, duration: 0 }),
          dump: async () => new Uint8Array(),
        }),
      } as unknown as import('@cloudflare/workers-types').D1Database,
      AUTH_KV: createMockEnv().AUTH_KV,
    });
  });

  // Routes are relative to the router mount point (/api/analytics)
  // So /top-products matches, not /api/analytics/top-products

  it('GET /top-products returns 200 with data array', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/top-products?limit=5'),
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /top-products accepts limit parameter', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/top-products?limit=50'),
      env,
    );
    expect(res.status).toBe(200);
  });

  it('GET /top-products rejects non-numeric limit', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/top-products?limit=abc'),
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('success', false);
  });

  it('GET /top-products rejects limit > 100', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/top-products?limit=200'),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('GET /peak-hours returns 200 with 24-hour array', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/peak-hours?days=30'),
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as unknown[]).length).toBe(24);
  });

  it('GET /peak-hours accepts days parameter', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/peak-hours?days=7'),
      env,
    );
    expect(res.status).toBe(200);
  });

  it('GET /peak-hours rejects non-numeric days', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/peak-hours?days=abc'),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('GET /peak-hours rejects days > 365', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/peak-hours?days=500'),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('GET /peak-hours rejects negative days', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/peak-hours?days=-1'),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('uses KV cache on repeat calls', async () => {
    // First call — no cache, queries DB
    const res1 = await analyticsRouter.fetch(
      new Request('https://test.aura/top-products?limit=5'),
      env,
    );
    expect(res1.status).toBe(200);
    const body1 = await res1.json() as { cached: boolean };
    expect(body1.cached).toBe(false);

    // Second call within TTL — returns cached
    const res2 = await analyticsRouter.fetch(
      new Request('https://test.aura/top-products?limit=5'),
      env,
    );
    expect(res2.status).toBe(200);
    const body2 = await res2.json() as { cached: boolean };
    expect(body2.cached).toBe(true);
  });

  it('returns 404 for unknown analytics route', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/unknown'),
      env,
    );
    expect(res.status).toBe(404);
  });
});

// ───── getCustomerMetrics ─────

describe('getCustomerMetrics (tree/analytics)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  function createMockDb() {
    const firstFn = vi.fn().mockResolvedValue(null);
    return {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        bind: vi.fn().mockReturnValue({
          first: firstFn,
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
      }),
      _first: firstFn,
    } as unknown as import('@cloudflare/workers-types').D1Database;
  }

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('returns all metrics with correct shape', async () => {
    const firstFn = vi.fn()
      .mockResolvedValueOnce({ total_customers: 100 })
      .mockResolvedValueOnce({ new_30d: 15 })
      .mockResolvedValueOnce({ repeat_rate: 0.35 })
      .mockResolvedValueOnce({ avg_order_value: 85000 });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      first: firstFn,
      bind: vi.fn().mockReturnValue({ first: firstFn, all: vi.fn().mockResolvedValue({ results: [] }), run: vi.fn() }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn(),
    });

    const result = await getCustomerMetrics(mockDb);
    expect(result).toHaveProperty('total_customers', 100);
    expect(result).toHaveProperty('new_30d', 15);
    expect(result).toHaveProperty('repeat_rate', 0.35);
    expect(result).toHaveProperty('avg_order_value', 85000);
  });

  it('handles zero customers gracefully', async () => {
    const firstFn = vi.fn()
      .mockResolvedValueOnce({ total_customers: 0 })
      .mockResolvedValueOnce({ new_30d: 0 })
      .mockResolvedValueOnce({ repeat_rate: 0 })
      .mockResolvedValueOnce({ avg_order_value: null });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      first: firstFn,
      bind: vi.fn().mockReturnValue({ first: firstFn, all: vi.fn().mockResolvedValue({ results: [] }), run: vi.fn() }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn(),
    });

    const result = await getCustomerMetrics(mockDb);
    expect(result.total_customers).toBe(0);
    expect(result.new_30d).toBe(0);
    expect(result.repeat_rate).toBe(0);
    expect(result.avg_order_value).toBe(0);
  });

  it('types are numeric', async () => {
    const firstFn = vi.fn()
      .mockResolvedValueOnce({ total_customers: 50 })
      .mockResolvedValueOnce({ new_30d: 10 })
      .mockResolvedValueOnce({ repeat_rate: 0.25 })
      .mockResolvedValueOnce({ avg_order_value: 75000 });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      first: firstFn,
      bind: vi.fn().mockReturnValue({ first: firstFn, all: vi.fn().mockResolvedValue({ results: [] }), run: vi.fn() }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn(),
    });

    const result = await getCustomerMetrics(mockDb);
    expect(typeof result.total_customers).toBe('number');
    expect(typeof result.new_30d).toBe('number');
    expect(typeof result.repeat_rate).toBe('number');
    expect(typeof result.avg_order_value).toBe('number');
  });
});

// ───── getOrdersInRange & formatCsvRows ─────

describe('getOrdersInRange (tree/analytics/csv-export)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  function createMockDb() {
    const allFn = vi.fn().mockResolvedValue({ results: [] });
    return {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ all: allFn }),
      }),
      _all: allFn,
    } as unknown as import('@cloudflare/workers-types').D1Database;
  }

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('returns empty array when no orders in range', async () => {
    const result = await getOrdersInRange(mockDb, '2024-01-01', '2024-01-31');
    expect(result).toEqual([]);
  });

  it('returns orders within date range', async () => {
    const rows = [
      { id: '1', customer_name: 'Alice', customer_phone: '0901000001', total: 50000, status: 'completed', payment_method: 'cash', items: '[{"name":"Coffee","qty":1,"price":50000}]', created_at: '2024-01-15' },
    ];
    const allFn = vi.fn().mockResolvedValue({ results: rows, success: true });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({ all: allFn }),
    });

    const result = await getOrdersInRange(mockDb, '2024-01-01', '2024-01-31');
    expect(result).toHaveLength(1);
    expect(result[0].customer_name).toBe('Alice');
    expect(result[0].total).toBe(50000);
  });

  it('passes start and end dates to bind', async () => {
    const bindFn = vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: [], success: true }) });
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn });

    await getOrdersInRange(mockDb, '2024-06-01', '2024-06-30');
    expect(bindFn).toHaveBeenCalledWith('2024-06-01', '2024-06-30');
  });
});

describe('formatCsvRows (tree/analytics/csv-export)', () => {
  it('returns CSV string with headers and rows', () => {
    const rows = [
      { id: '1', customer_name: 'Alice', customer_phone: '0901000001', total: 50000, status: 'completed', payment_method: 'cash', items: '[{"name":"Coffee","qty":1,"price":50000}]', created_at: '2024-01-15' },
    ];
    const csv = formatCsvRows(rows);
    expect(csv).toContain('Order ID,Customer Name,Phone');
    expect(csv).toContain('1,Alice,0901000001');
    expect(csv).toContain('Coffee'); // items are included
  });

  it('returns headers-only when no rows', () => {
    const csv = formatCsvRows([]);
    expect(csv).toContain('Order ID,Customer Name,Phone');
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(1);
  });
});

// ───── Customer Metrics + Export Routes ─────

describe('analyticsRouter (customer-metrics + export)', () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    env = createMockEnv({
      AURA_DB: {
        prepare: () => ({
          first: async () => ({ total_customers: 50, new_30d: 10, repeat_rate: 0.25, avg_order_value: 75000 }),
          bind: () => ({
            first: async () => ({ total_customers: 50, new_30d: 10, repeat_rate: 0.25, avg_order_value: 75000 }),
            all: async () => ({ results: [], success: true }),
            run: async () => ({ meta: { changes: 0 } }),
            raw: async () => [],
          }),
          all: async () => ({ results: [], success: true }),
          run: async () => ({ meta: { changes: 0 } }),
          raw: async () => [],
        }),
        batch: async () => [],
        exec: async () => ({ count: 0, duration: 0 }),
        dump: async () => new Uint8Array(),
      } as unknown as import('@cloudflare/workers-types').D1Database,
      AUTH_KV: createMockEnv().AUTH_KV,
    });
  });

  it('GET /customer-metrics returns 200 with metrics', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/customer-metrics'),
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('total_customers', 50);
    expect(body.data).toHaveProperty('new_30d', 10);
    expect(body.data).toHaveProperty('repeat_rate', 0.25);
    expect(body.data).toHaveProperty('avg_order_value', 75000);
  });

  it('GET /export returns 200 with CSV Content-Type', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/export?start=2024-01-01&end=2024-01-31'),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment; filename="orders/);
  });

  it('GET /export returns CSV body', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/export?start=2024-01-01&end=2024-01-31'),
      env,
    );
    const text = await res.text();
    expect(text).toContain('Order ID');
    expect(text).toContain('Customer Name');
  });

  it('GET /export rejects missing start date', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/export'),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('GET /export rejects invalid date format', async () => {
    const res = await analyticsRouter.fetch(
      new Request('https://test.aura/export?start=abc&end=def'),
      env,
    );
    expect(res.status).toBe(400);
  });
});
