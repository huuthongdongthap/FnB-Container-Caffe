import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { reportsRouter } from '../../routes/reports-handlers/routes';
import { handleOverview } from '../../routes/reports-handlers/grouped-sales-handlers';
import type { Env } from '../../types/env';

describe('Admin Revenue Analytics & Grouped Sales Handlers', () => {
  function createTestDb(overrides?: {
    allResults?: unknown[];
    firstResult?: unknown;
  }) {
    const allFn = vi.fn().mockResolvedValue({ results: overrides?.allResults ?? [] });
    const firstFn = vi.fn().mockResolvedValue(overrides?.firstResult ?? null);

    return {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: firstFn,
          all: allFn,
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        }),
      }),
      _all: allFn,
      _first: firstFn,
    };
  }

  it('GET /sales-by-hour returns zero-filled 24 hour buckets', async () => {
    const mockDb = createTestDb({
      allResults: [
        { hour: 9, value: 120000, count: 2 },
        { hour: 14, value: 350000, count: 5 },
      ],
    });

    const env = { AURA_DB: mockDb } as unknown as Env;
    const res = await reportsRouter.request('/sales-by-hour?from=2026-10-01&to=2026-10-01', {}, env);

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { groups: Array<{ label: string; value: number; count: number }> } };
    expect(json.success).toBe(true);
    expect(json.data.groups).toHaveLength(24);
    expect(json.data.groups[0].label).toBe('00:00');
    expect(json.data.groups[9].label).toBe('09:00');
    expect(json.data.groups[9].value).toBe(120000);
    expect(json.data.groups[9].count).toBe(2);
    expect(json.data.groups[14].label).toBe('14:00');
    expect(json.data.groups[14].value).toBe(350000);
  });

  it('GET /sales-by-day returns grouped date sales', async () => {
    const mockDb = createTestDb({
      allResults: [
        { label: '2026-10-01', value: 1500000, count: 20 },
        { label: '2026-10-02', value: 2200000, count: 28 },
      ],
    });

    const env = { AURA_DB: mockDb } as unknown as Env;
    const res = await reportsRouter.request('/sales-by-day?from=2026-10-01&to=2026-10-02', {}, env);

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { groups: Array<{ label: string; value: number; count: number }> } };
    expect(json.success).toBe(true);
    expect(json.data.groups).toHaveLength(2);
    expect(json.data.groups[0].label).toBe('2026-10-01');
    expect(json.data.groups[0].value).toBe(1500000);
  });

  it('GET /sales-by-category returns category revenue breakdown', async () => {
    const mockDb = createTestDb({
      allResults: [
        { label: 'Cà phê', value: 3000000, count: 65 },
        { label: 'Trà trái cây', value: 1800000, count: 40 },
      ],
    });

    const env = { AURA_DB: mockDb } as unknown as Env;
    const res = await reportsRouter.request('/sales-by-category?from=2026-10-01&to=2026-10-05', {}, env);

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { groups: Array<{ label: string; value: number; count: number }> } };
    expect(json.success).toBe(true);
    expect(json.data.groups[0].label).toBe('Cà phê');
    expect(json.data.groups[0].value).toBe(3000000);
  });

  it('GET /sales-by-payment returns breakdown by payment method', async () => {
    const mockDb = createTestDb({
      allResults: [
        { label: 'payos', value: 2500000, count: 35 },
        { label: 'cash', value: 1200000, count: 20 },
      ],
    });

    const env = { AURA_DB: mockDb } as unknown as Env;
    const res = await reportsRouter.request('/sales-by-payment?from=2026-10-01&to=2026-10-05', {}, env);

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { groups: Array<{ label: string; value: number; count: number }> } };
    expect(json.success).toBe(true);
    expect(json.data.groups[0].label).toBe('payos');
    expect(json.data.groups[1].label).toBe('cash');
  });

  it('handleOverview calculates today/yesterday differential and avg order value', async () => {
    let callCount = 0;
    const firstFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ revenue: 2000000, orders_count: 20 });
      }
      return Promise.resolve({ revenue: 1600000, orders_count: 16 });
    });

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: firstFn,
        }),
      }),
    };

    const app = new Hono<{ Bindings: Env }>();
    app.get('/api/dashboard/overview', handleOverview);

    const env = { AURA_DB: mockDb } as unknown as Env;
    const res = await app.request('/api/dashboard/overview?from=2026-10-05&to=2026-10-05', {}, env);

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { todayRevenue: number; yesterdayRevenue: number; changePercent: number; todayOrders: number; yesterdayOrders: number; avgOrderValue: number } };
    expect(json.success).toBe(true);
    expect(json.data.todayRevenue).toBe(2000000);
    expect(json.data.yesterdayRevenue).toBe(1600000);
    expect(json.data.todayOrders).toBe(20);
    expect(json.data.yesterdayOrders).toBe(16);
    expect(json.data.avgOrderValue).toBe(100000);
    expect(json.data.changePercent).toBe(25);
  });
});
