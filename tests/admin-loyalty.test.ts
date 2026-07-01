/**
 * Admin Loyalty Routes — Tests for dashboard widgets, tier distribution,
 * top customers, and CSV export.
 *
 * Strategy: mock requireAuth, use configurable D1 mock to simulate all
 * widget queries (8 parallel first() calls) and list queries.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock auth middleware BEFORE importing the router
vi.mock('../worker/src/middleware/auth.ts', () => ({
  requireAuth: () => async (_c: any, next: any) => {
    await next();
  },
}));

import { adminLoyaltyRouter } from '../worker/src/routes/admin-loyalty.ts';

// ── Mock D1 Factory ─────────────────────────────────────────────
function createMockD1(config: {
  totalCustomers?: number;
  activeCount?: number;
  cashbackTotal?: number;
  spentTotal?: number;
  avgVisits?: number;
  topTier?: Record<string, unknown> | null;
  churnCount?: number;
  redemptionTotal?: number;
  redemptionRedeemed?: number;
  tiers?: Record<string, unknown>[];
  topCustomers?: Record<string, unknown>[];
  allCustomers?: Record<string, unknown>[];
} = {}) {
  return {
    prepare: vi.fn((sql: string) => {
      const stmt: any = {
        _bindValues: [] as unknown[],
        bind: vi.fn(function (...vals: unknown[]) {
          stmt._bindValues = vals;
          return stmt;
        }),
        first: vi.fn(async function () {
          // Redemption rate query (checkins table)
          if (sql.includes('FROM checkins')) {
            return {
              total: config.redemptionTotal ?? 0,
              redeemed: config.redemptionRedeemed ?? 0,
            };
          }
          // Top tier query (GROUP BY + LIMIT 1)
          if (sql.includes('GROUP BY tier') && sql.includes('LIMIT 1')) {
            return config.topTier ?? null;
          }
          // Active this month
          if (sql.includes('updated_at >= ?')) {
            return { count: config.activeCount ?? 0 };
          }
          // Churn risk (90d)
          if (sql.includes('updated_at < ?')) {
            return { count: config.churnCount ?? 0 };
          }
          // Cashback sum
          if (sql.includes('SUM(cashback_balance')) {
            return { total: config.cashbackTotal ?? 0 };
          }
          // Total spent sum
          if (sql.includes('SUM(total_spent')) {
            return { total: config.spentTotal ?? 0 };
          }
          // Avg visits
          if (sql.includes('AVG(visit_count')) {
            return { avg: config.avgVisits ?? 0 };
          }
          // Default: total customers count
          return { count: config.totalCustomers ?? 0 };
        }),
        all: vi.fn(async function () {
          // Tier distribution
          if (sql.includes('GROUP BY tier') && !sql.includes('LIMIT')) {
            return { results: config.tiers ?? [] };
          }
          // Top customers (by spent)
          if (sql.includes('ORDER BY total_spent')) {
            return { results: config.topCustomers ?? [] };
          }
          // Export — all customers
          if (sql.includes('ORDER BY created_at')) {
            return { results: config.allCustomers ?? [] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      return stmt;
    }),
  };
}

function createEnv(overrides: Record<string, unknown> = {}) {
  return {
    AURA_DB: createMockD1(),
    AUTH_KV: { get: vi.fn(), put: vi.fn(), list: vi.fn() },
    JWT_SECRET: 'test-secret-16chars',
    ...overrides,
  };
}

// ── Suite ───────────────────────────────────────────────────────
describe('Admin Loyalty Routes', () => {
  let env: ReturnType<typeof createEnv>;

  beforeEach(() => {
    env = createEnv();
  });

  describe('GET /widgets', () => {
    test('returns 8 KPI widgets with computed data', async () => {
      env.AURA_DB = createMockD1({
        totalCustomers: 45,
        activeCount: 12,
        cashbackTotal: 1500000,
        spentTotal: 85000000,
        avgVisits: 8,
        topTier: { tier: 'platinum', count: 5 },
        churnCount: 3,
        redemptionTotal: 100,
        redemptionRedeemed: 72,
      });

      const res = await adminLoyaltyRouter.request('/widgets', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: any[] };
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(8);

      expect(body.data[0]).toMatchObject({ title: 'Total Members', value: 45 });
      expect(body.data[1]).toMatchObject({ title: 'Active (30d)', value: 12 });
      expect(body.data[2]).toMatchObject({ title: 'Cashback Pool', value: 1500000 });
      expect(body.data[3]).toMatchObject({ title: 'Total Spend', value: 85000000 });
      expect(body.data[4]).toMatchObject({ title: 'Avg Visits', value: 8 });
      expect(body.data[5]).toMatchObject({ title: 'Top Tier', value: 'platinum' });
      expect(body.data[6]).toMatchObject({ title: 'Churn Risk (90d)', value: 3 });
      expect(body.data[7]).toMatchObject({ title: 'Redemption Rate', value: '72%' });
    });

    test('returns zero/fallback values when DB is empty', async () => {
      env.AURA_DB = createMockD1();

      const res = await adminLoyaltyRouter.request('/widgets', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: any[] };
      expect(body.data).toHaveLength(8);
      expect(body.data[0]).toMatchObject({ title: 'Total Members', value: 0 });
      expect(body.data[5]).toMatchObject({ title: 'Top Tier', value: 'N/A' });
      expect(body.data[7]).toMatchObject({ title: 'Redemption Rate', value: '0%' });
    });
  });

  describe('GET /tiers', () => {
    test('returns tier distribution with percentages', async () => {
      env.AURA_DB = createMockD1({
        tiers: [
          { tier: 'gold', count: 5, percentage: 50 },
          { tier: 'silver', count: 3, percentage: 30 },
          { tier: 'bronze', count: 2, percentage: 20 },
        ],
      });

      const res = await adminLoyaltyRouter.request('/tiers', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: { distribution: any[]; total: number } };
      expect(body.success).toBe(true);
      expect(body.data.distribution).toHaveLength(3);
      expect(body.data.total).toBe(10);
      expect(body.data.distribution[0]).toMatchObject({ tier: 'gold', count: 5, percentage: 50 });
    });

    test('handles empty distribution', async () => {
      env.AURA_DB = createMockD1({ tiers: [] });

      const res = await adminLoyaltyRouter.request('/tiers', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: { distribution: any[]; total: number } };
      expect(body.data.distribution).toHaveLength(0);
      expect(body.data.total).toBe(0);
    });
  });

  describe('GET /top-customers', () => {
    const topCusts = [
      { id: '1', name: 'Alice', phone: '0909123001', tier: 'gold', total_spent: 5000000, visit_count: 20 },
      { id: '2', name: 'Bob', phone: '0909123002', tier: 'silver', total_spent: 2000000, visit_count: 10 },
      { id: '3', name: 'Charlie', phone: '0909123003', tier: 'bronze', total_spent: 500000, visit_count: 3 },
    ];

    test('returns top customers sorted by total_spent', async () => {
      env.AURA_DB = createMockD1({ topCustomers: topCusts });

      const res = await adminLoyaltyRouter.request('/top-customers', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: any[] };
      expect(body.data).toHaveLength(3);
      expect(body.data[0].name).toBe('Alice');
      expect(body.data[0].total_spent).toBe(5000000);
    });

    test('respects limit query param', async () => {
      env.AURA_DB = createMockD1({ topCustomers: [topCusts[0]] });

      const res = await adminLoyaltyRouter.request('/top-customers?limit=1', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: any[] };
      expect(body.data).toHaveLength(1);
    });
  });

  describe('GET /export', () => {
    const csvCusts = [
      {
        id: '4', name: 'Alice "A" Smith', phone: '0909123004', email: 'alice@test.com',
        birthday: '', tier: 'gold', cashback_balance: 100000, total_spent: 3000000,
        visit_count: 15, created_at: '2026-04-01T00:00:00Z',
      },
    ];

    const plainCusts = [
      {
        id: '5', name: 'Bob', phone: '0909123005', email: 'bob@test.com',
        birthday: '', tier: 'silver', cashback_balance: 50000, total_spent: 1000000,
        visit_count: 5, created_at: '2026-05-01T00:00:00Z',
      },
    ];

    test('returns CSV with correct Content-Type header', async () => {
      env.AURA_DB = createMockD1({ allCustomers: plainCusts });

      const res = await adminLoyaltyRouter.request('/export', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
      expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="customers-');
    });

    test('escapes double quotes in names — replaces " with "" in CSV', async () => {
      env.AURA_DB = createMockD1({ allCustomers: csvCusts });

      const res = await adminLoyaltyRouter.request('/export', { method: 'GET' }, env);
      const csv = await res.text();
      // CSV escaping: "Alice "A" Smith" becomes "Alice ""A"" Smith"
      expect(csv).toContain('"Alice ""A"" Smith"');
    });

    test('handles empty results with only header row', async () => {
      env.AURA_DB = createMockD1({ allCustomers: [] });

      const res = await adminLoyaltyRouter.request('/export', { method: 'GET' }, env);
      const csv = await res.text();
      const lines = csv.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('ID,Name,Phone,Email,Birthday,Tier,Cashback,Total Spent,Visits,Created');
    });
  });
});
