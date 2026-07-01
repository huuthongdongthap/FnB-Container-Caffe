/**
 * Admin Metrics Routes — Tests for /api/admin/metrics endpoint.
 *
 * Tests range validation, metric aggregation queries, latency p50/p95
 * calculation, top-paths reporting, and error handling.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

import adminMetrics from '../worker/src/routes/admin-metrics.ts';

// ── Mock D1 with programmable _metrics table ────────────────────
function createMockD1(config: {
  requestCount?: number;
  errorCount?: number;
  orderCount?: number;
  revenueTotal?: number;
  durations?: number[];
  topPaths?: { path: string; cnt: number }[];
  throwOnPrepare?: boolean;
} = {}) {
  return {
    prepare: vi.fn((sql: string) => {
      if (config.throwOnPrepare) {
        throw new Error('DB connection failed');
      }
      const stmt: any = {
        _bindValues: [] as unknown[],
        bind: vi.fn(function (...vals: unknown[]) {
          stmt._bindValues = vals;
          return stmt;
        }),
        first: vi.fn(async function () {
          // Request count (non-error)
          if (sql.includes("name = 'request'") && !sql.includes('json_extract') && !sql.includes('duration')) {
            return { total: config.requestCount ?? 0 };
          }
          // Error count (status >= 400)
          if (sql.includes('status') && sql.includes('>= 400')) {
            return { total: config.errorCount ?? 0 };
          }
          // Order count
          if (sql.includes("name = 'order_created'")) {
            return { total: config.orderCount ?? 0 };
          }
          // Revenue sum
          if (sql.includes("name = 'revenue'")) {
            return { total: config.revenueTotal ?? 0 };
          }
          return { total: 0 };
        }),
        all: vi.fn(async function () {
          // Latency durations
          if (sql.includes('duration') && !sql.includes('GROUP BY')) {
            const durations = config.durations ?? [];
            return { results: durations.map((d) => ({ duration: d })) };
          }
          // Top paths (GROUP BY path)
          if (sql.includes('GROUP BY') && sql.includes('path')) {
            return { results: config.topPaths ?? [] };
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
    ...overrides,
  };
}

describe('Admin Metrics Routes', () => {
  let env: ReturnType<typeof createEnv>;

  beforeEach(() => {
    env = createEnv();
  });

  describe('GET /', () => {
    test('returns metrics for 24h range by default', async () => {
      env.AURA_DB = createMockD1({
        requestCount: 150,
        errorCount: 3,
        orderCount: 25,
        revenueTotal: 12500000,
        durations: [50, 100, 150, 200, 300, 500, 800, 1000, 1500, 2000],
        topPaths: [
          { path: '/api/orders', cnt: 80 },
          { path: '/api/menu', cnt: 50 },
        ],
      });

      const res = await adminMetrics.request('/', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body).toMatchObject({
        range: '24h',
        requests: { total: 150 },
        errors: { total: 3 },
        orders: { total: 25 },
        revenue: { total: 12500000 },
      });
    });

    test('returns metrics for 7d range', async () => {
      env.AURA_DB = createMockD1({
        requestCount: 950,
        errorCount: 15,
        orderCount: 180,
        revenueTotal: 85000000,
      });

      const res = await adminMetrics.request('/?range=7d', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body).toMatchObject({ range: '7d', requests: { total: 950 } });
    });

    test('returns metrics for 30d range', async () => {
      env.AURA_DB = createMockD1({
        requestCount: 4200,
        errorCount: 68,
      });

      const res = await adminMetrics.request('/?range=30d', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body).toMatchObject({ range: '30d', errors: { total: 68 } });
    });

    test('returns 400 for invalid range', async () => {
      const res = await adminMetrics.request('/?range=invalid', { method: 'GET' }, env);
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Invalid range/);
    });

    test('returns 500 when _metrics table query fails', async () => {
      env.AURA_DB = createMockD1({ throwOnPrepare: true });

      const res = await adminMetrics.request('/', { method: 'GET' }, env);
      expect(res.status).toBe(500);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Failed to query metrics/);
    });

    test('calculates p50 and p95 latency correctly', async () => {
      const vals = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      env.AURA_DB = createMockD1({ durations: vals });

      const res = await adminMetrics.request('/', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { latency: { p50: number; p95: number } };
      // 10 items: Math.floor(10*0.5)=5 => index 5 = 60, Math.floor(10*0.95)=9 => index 9 = 100
      expect(body.latency.p50).toBe(60);
      expect(body.latency.p95).toBe(100);
    });

    test('returns top 10 paths', async () => {
      const paths = [
        { path: '/api/orders', cnt: 200 },
        { path: '/api/menu', cnt: 150 },
        { path: '/api/products', cnt: 100 },
      ];
      env.AURA_DB = createMockD1({ topPaths: paths });

      const res = await adminMetrics.request('/', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { topPaths: { path: string; count: number }[] };
      expect(body.topPaths).toHaveLength(3);
      expect(body.topPaths[0]).toMatchObject({ path: '/api/orders', count: 200 });
    });

    test('returns zero latency when no duration data', async () => {
      env.AURA_DB = createMockD1({ durations: [] });

      const res = await adminMetrics.request('/', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { latency: { p50: number; p95: number } };
      expect(body.latency.p50).toBe(0);
      expect(body.latency.p95).toBe(0);
    });
  });
});
