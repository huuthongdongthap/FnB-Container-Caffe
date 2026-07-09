/**
 * Unit tests for src/tree/orders/stats.ts
 * Tests: getStats (today's orders, revenue, status breakdown, top products, 7-day revenue)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── mock logger ── */

vi.mock('../../../middleware/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

/* ── DB helpers ── */
function makeChain(
  firstResult: unknown = null,
  allResults: unknown[] = [],
  runResult: { success: boolean; changes: number } = { success: true, changes: 0 }
) {
  const chain: Record<string, unknown> = {};
  chain.bind = vi.fn(() => {
    return chain;
  });
  chain.first = vi.fn(async() => firstResult);
  chain.all = vi.fn(async() => ({ results: allResults }));
  chain.run = vi.fn(async() => runResult);
  return chain as never;
}

function makeDB(chains: Record<string, unknown>[] = [makeChain()]) {
  const queue = [...chains];
  return {
    prepare: vi.fn((_sql: string) => queue.shift() ?? makeChain())
  } as unknown as import('@cloudflare/workers-types').D1Database;
}

function makeEnv(db: import('@cloudflare/workers-types').D1Database) {
  return { AURA_DB: db };
}

/* ── imports under test ── */
import { getStats } from '../../../tree/orders/stats';

describe('stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStats', () => {
    it('returns complete stats on happy path', async() => {
      const db = makeDB([
        makeChain([], [{ total: 15, revenue: 2500000 }]), // orders today
        makeChain([], [ // status breakdown
          { status: 'pending', count: 3 },
          { status: 'preparing', count: 2 },
          { status: 'completed', count: 10 }
        ]),
        makeChain([], [ // top products
          { items: JSON.stringify([{ name: 'Pho Bo', quantity: 10 }]), order_count: 8 },
          { items: JSON.stringify([{ name: 'Banh Mi', quantity: 5 }]), order_count: 5 }
        ]),
        makeChain([], [ // 7-day revenue
          { date: '2026-07-08', revenue: 500000 },
          { date: '2026-07-07', revenue: 800000 }
        ])
      ]);
      const env = makeEnv(db);

      const req = new Request('https://test.aura/api/orders/stats');
      const result = await getStats(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { success: boolean }).success).toBe(true);
      expect((body as Record<string, unknown> & { stats: Record<string, unknown> }).stats.orders_today).toBe(15);
      expect((body as Record<string, unknown> & { stats: Record<string, unknown> }).stats.revenue_today).toBe(2500000);
      const statuses = (body as Record<string, unknown> & { stats: { orders_by_status: Record<string, unknown> } }).stats.orders_by_status;
      expect((statuses as Record<string, unknown>).pending).toBe(3);
      expect((statuses as Record<string, unknown>).completed).toBe(10);
      expect(((body as Record<string, unknown> & { stats: { top_products: unknown[] } }).stats.top_products as unknown[]).length).toBeGreaterThan(0);
      expect(((body as Record<string, unknown> & { stats: { revenue_7days: unknown[] } }).stats.revenue_7days as unknown[]).length).toBe(2);
    });

    it('returns zeroes when no orders exist', async() => {
      const db = makeDB([
        makeChain([], [{ total: 0, revenue: 0 }]),
        makeChain([], []),
        makeChain([], []),
        makeChain([], [])
      ]);
      const env = makeEnv(db);

      const req = new Request('https://test.aura/api/orders/stats');
      const result = await getStats(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { stats: Record<string, unknown> }).stats.orders_today).toBe(0);
      expect((body as Record<string, unknown> & { stats: Record<string, unknown> }).stats.revenue_today).toBe(0);
      expect((body as Record<string, unknown> & { stats: Record<string, unknown> }).stats.orders_by_status).toEqual({});
      expect((body as Record<string, unknown> & { stats: Record<string, unknown> }).stats.top_products).toEqual([]);
      expect((body as Record<string, unknown> & { stats: Record<string, unknown> }).stats.revenue_7days).toEqual([]);
    });

    it('aggregates top products with duplicate item names', async() => {
      const db = makeDB([
        makeChain([], [{ total: 0, revenue: 0 }]),
        makeChain([], []),
        makeChain([], [
          { items: JSON.stringify([{ name: 'Pho Bo', quantity: 5 }]), order_count: 1 },
          { items: JSON.stringify([{ name: 'Pho Bo', quantity: 3 }]), order_count: 1 },
          { items: JSON.stringify([{ name: 'Tra Da', quantity: 2 }]), order_count: 1 }
        ]),
        makeChain([], [])
      ]);
      const env = makeEnv(db);

      const req = new Request('https://test.aura/api/orders/stats');
      const result = await getStats(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      const topProducts = (body as Record<string, unknown> & { stats: { top_products: { name: string; quantity: number }[] } }).stats.top_products;
      const phoBo = topProducts.find((p: { name: string }) => p.name === 'Pho Bo');
      expect(phoBo).toBeDefined();
      expect(phoBo.quantity).toBe(8); // 5 + 3
      expect(topProducts.length).toBe(2);
    });

    it('skips invalid JSON in top products silently', async() => {
      const db = makeDB([
        makeChain([], [{ total: 0, revenue: 0 }]),
        makeChain([], []),
        makeChain([], [
          { items: 'NOT_JSON_HERE', order_count: 1 },
          { items: JSON.stringify([{ name: 'Ca Phe', quantity: 4 }]), order_count: 1 }
        ]),
        makeChain([], [])
      ]);
      const env = makeEnv(db);

      const req = new Request('https://test.aura/api/orders/stats');
      const result = await getStats(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      const topProducts = (body as Record<string, unknown> & { stats: { top_products: { name: string }[] } }).stats.top_products;
      expect(topProducts.length).toBe(1);
      expect(topProducts[0].name).toBe('Ca Phe');
    });

    it('limits top products to 6 items', async() => {
      const manyProducts = Array.from({ length: 10 }, (_, i) => ({
        items: JSON.stringify([{ name: `Product ${i}`, quantity: i + 1 }]),
        order_count: i + 1
      }));

      const db = makeDB([
        makeChain([], [{ total: 0, revenue: 0 }]),
        makeChain([], []),
        makeChain([], manyProducts),
        makeChain([], [])
      ]);
      const env = makeEnv(db);

      const req = new Request('https://test.aura/api/orders/stats');
      const result = await getStats(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { stats: { top_products: unknown[] } }).stats.top_products.length).toBe(6);
    });

    it('handles items without quantity field (defaults to 1)', async() => {
      const db = makeDB([
        makeChain([], [{ total: 0, revenue: 0 }]),
        makeChain([], []),
        makeChain([], [
          { items: JSON.stringify([{ name: 'Kem' }]), order_count: 1 }
        ]),
        makeChain([], [])
      ]);
      const env = makeEnv(db);

      const req = new Request('https://test.aura/api/orders/stats');
      const result = await getStats(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { stats: { top_products: { quantity: number }[] } }).stats.top_products[0].quantity).toBe(1);
    });

    it('returns 500 on database error', async() => {
      const db = makeDB([]);
      (db as unknown as { prepare: unknown }).prepare = vi.fn(() => {
        throw new Error('D1 unavailable');
      }) as never;
      const env = makeEnv(db);

      const req = new Request('https://test.aura/api/orders/stats');
      const result = await getStats(req, env);

      expect(result.status).toBe(500);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      expect((body as Record<string, unknown> & { success: boolean }).success).toBe(false);
      expect((body as Record<string, unknown> & { error: string }).error).toContain('Failed to fetch stats');
    });

    it('returns 7-day revenue sorted desc', async() => {
      const db = makeDB([
        makeChain([], [{ total: 0, revenue: 0 }]),
        makeChain([], []),
        makeChain([], []),
        makeChain([], [
          { date: '2026-07-08', revenue: 500000 },
          { date: '2026-07-07', revenue: 800000 },
          { date: '2026-07-06', revenue: 1000000 }
        ])
      ]);
      const env = makeEnv(db);

      const req = new Request('https://test.aura/api/orders/stats');
      const result = await getStats(req, env);

      expect(result.status).toBe(200);
      const bodyRaw = await result.json();
      const body = (bodyRaw as Record<string, unknown>);
      const rev7 = (body as Record<string, unknown> & { stats: { revenue_7days: { date: string }[] } }).stats.revenue_7days;
      // SQL uses ORDER BY date DESC
      expect(rev7[0].date).toBe('2026-07-08');
      expect(rev7[2].date).toBe('2026-07-06');
    });
  });
});
