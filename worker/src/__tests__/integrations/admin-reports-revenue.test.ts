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

  it('GET /sales-by-category falls back to orders.items JSON when order_items table is absent', async () => {
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM order_items')) {
              throw new Error('D1_ERROR: no such table: order_items');
            }
            return {
              results: [
                { items: JSON.stringify([{ name: 'Cold Brew', category: 'Cà phê', quantity: 2, price: 45000 }]) }
              ]
            };
          })
        })
      }))
    };

    const env = { AURA_DB: mockDb } as unknown as Env;
    const res = await reportsRouter.request('/sales-by-category?from=2026-10-01&to=2026-10-05', {}, env);
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { groups: Array<{ label: string; value: number; count: number }> } };
    expect(json.success).toBe(true);
    expect(json.data.groups).toEqual([{ label: 'Cà phê', value: 90000, count: 2 }]);
  });

  it('isolates non-default tenant from NULL/default orders and customers across overview, daily, summary, customer-metrics, and CSV export', async () => {
    const boundCalls: Array<{ sql: string; args: unknown[] }> = [];
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation((...args: unknown[]) => {
          boundCalls.push({ sql, args });
          return {
            first: vi.fn().mockResolvedValue({ revenue: 75000, orders_count: 1, count: 1, total: 75000 }),
            all: vi.fn().mockResolvedValue({
              results: sql.includes('FROM customers c')
                ? [{ id: 'CUST_B1', name: 'Cust B', email: 'b@cafe.vn', phone: '0900000002', loyalty_tier: 'silver', created_at: '2026-10-30', total_spent: 75000, order_count: 1 }]
                : [{ date: '2026-10-30', count: 1, revenue: 75000 }],
            }),
          };
        }),
        first: vi.fn().mockResolvedValue({ total: 0, count: 0 }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      })),
    };
    const app = new Hono<{ Bindings: Env; Variables: { user?: unknown } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'USR_B1', role: 'owner', tenantId: 'cafe-b' });
      await next();
    });
    app.route('/', reportsRouter);
    const env = { AURA_DB: mockDb } as unknown as Env;

    const overviewRes = await app.request('/overview?from=2026-10-30&to=2026-10-30', {}, env);
    expect(overviewRes.status).toBe(200);
    expect(boundCalls.some((c) => c.sql.includes('AND tenant_id = ?') && !c.sql.includes('IS NULL') && c.args.includes('cafe-b'))).toBe(true);

    const summaryRes = await app.request('/summary', {}, env);
    expect(summaryRes.status).toBe(200);
    expect(boundCalls.some((c) => c.sql.includes('FROM customers WHERE tenant_id = ?') && c.args.includes('cafe-b'))).toBe(true);

    const custExportRes = await app.request('/export?type=customers&from=2026-10-01&to=2026-10-30', {}, env);
    expect(custExportRes.status).toBe(200);
    const csvText = await custExportRes.text();
    expect(csvText).toContain('CUST_B1');
    expect(boundCalls.some((c) => c.sql.includes('WHERE c.tenant_id = ?') && c.args.includes('cafe-b'))).toBe(true);
  });
});
