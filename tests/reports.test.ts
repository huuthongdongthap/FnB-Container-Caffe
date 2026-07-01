/**
 * Reports Routes Tests — GET /api/reports/daily, /summary, /orders
 *
 * Tests for reportsRouter which returns D+1 analytics.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock D1 Database ──────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {};
  ['customers', 'orders', 'checkins', 'promotion_redemptions']
    .forEach(t => { tables[t] = [...(seedData[t] || [])]; });

  function getPrimaryTable(sql: string) {
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : null;
  }

  function resolveAggregate(sql: string, tableRows: any[]): Record<string, number> | null {
    // COUNT(*) as alias
    const countMatch = sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i);
    if (countMatch) {
      const result: Record<string, number> = {};
      result[countMatch[1]] = tableRows.length;
      return result;
    }
    // COALESCE(SUM(field), 0) as alias
    const sumMatch = sql.match(/COALESCE\(SUM\((\w+)\),\s*(\d+)\)\s+as\s+(\w+)/i);
    if (sumMatch) {
      const field = sumMatch[1];
      const alias = sumMatch[3];
      const total = tableRows.reduce((sum: number, r: any) => sum + (Number(r[field]) || 0), 0);
      const result: Record<string, number> = {};
      result[alias] = total;
      return result;
    }
    return null;
  }

  const db = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q, _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
        first: vi.fn(async function () {
          const table = getPrimaryTable(q);
          const rows = (table && tables[table]) ? tables[table] : [];
          const agg = resolveAggregate(q, rows);
          if (agg) return agg;
          return rows[0] || null;
        }),
        all: vi.fn(async function () {
          const table = getPrimaryTable(q);
          const rows = (table && tables[table]) ? tables[table] : [];
          if (!table) return { results: [] };
          // Handle GROUP BY queries by returning grouped results
          const groupMatch = q.match(/GROUP\s+BY\s+(\w+)/i);
          if (groupMatch) {
            const groupField = groupMatch[1];
            const dateField = q.match(/DATE\((\w+)\)/i)?.[1] || groupField;
            const aggField = q.match(/COUNT\(\*\)\s+as\s+(\w+)/i)?.[1];
            const sumField = q.match(/SUM\((\w+)\)/i)?.[1];
            const sumAlias = q.match(/SUM\(\w+\)\s+as\s+(\w+)/i)?.[1];
            const grouped = rows.reduce((acc: Record<string, any>, r: any) => {
              const key = r[dateField] ? r[dateField].slice(0, 10) : String(r[groupField]);
              if (!acc[key]) acc[key] = { date: key, count: 0, revenue: 0 };
              acc[key].count += 1;
              if (sumField) acc[key].revenue += Number(r[sumField] || 0);
              if (sumAlias) acc[key][sumAlias] = (acc[key][sumAlias] || 0) + Number(r[sumField || 'total'] || 0);
              return acc;
            }, {});
            const results = Object.values(grouped);
            // Apply COALESCE for aggregate fields
            const coalesceMatch = q.match(/COALESCE\(SUM\((\w+)\),\s*(\d+)\)/i);
            if (coalesceMatch) {
              const alias = q.match(/COALESCE\(SUM\(\w+\),\s*\d+\)\s+as\s+(\w+)/i);
              if (alias) {
                results.forEach((r: any) => { if (r[alias[1]] == null) r[alias[1]] = 0; });
              }
            }
            return { results };
          }
          return { results: [...rows] };
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      return stmt;
    }),
  };
  return db;
}

let reportsRouter: any;
let env: any;

beforeEach(() => {
  vi.clearAllMocks();
});

async function mountRouter() {
  const mod = await import('../worker/src/routes/reports');
  reportsRouter = mod.reportsRouter;
}

describe('GET /daily', () => {
  test('returns daily report data for date range', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/daily?from=2026-06-01&to=2026-06-03', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    expect(body.data[0]).toHaveProperty('date');
    expect(body.data[0]).toHaveProperty('signups');
    expect(body.data[0]).toHaveProperty('orders');
    expect(body.data[0]).toHaveProperty('revenue');
    expect(body.data[0]).toHaveProperty('avg_order_value');
  });

  test('uses default 30-day range when no params', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/daily', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('includes signups data from customers table', async () => {
    env = {
      AURA_DB: createMockD1({
        customers: [
          { id: 'c1', name: 'Test', created_at: '2026-06-15T10:00:00Z' },
          { id: 'c2', name: 'Test2', created_at: '2026-06-15T11:00:00Z' },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/daily?from=2026-06-15&to=2026-06-15', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    const dayData = body.data.find((d: any) => d.date === '2026-06-15');
    expect(dayData).toBeDefined();
  });
});

describe('GET /summary', () => {
  test('returns KPI summary with zero values for empty DB', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/summary', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('total_customers');
    expect(body.data).toHaveProperty('total_revenue');
    expect(body.data).toHaveProperty('total_orders');
    expect(body.data).toHaveProperty('total_cashback_issued');
    expect(body.data).toHaveProperty('active_customers_30d');
    expect(body.data).toHaveProperty('churn_rate_30d');
    // Empty DB should have 0 values
    expect(body.data.total_customers).toBe(0);
    expect(body.data.total_revenue).toBe(0);
    expect(body.data.total_orders).toBe(0);
  });

  test('handles non-empty database gracefully', async () => {
    env = {
      AURA_DB: createMockD1({
        customers: [{ id: 'c1', name: 'Test', updated_at: new Date().toISOString() }],
        orders: [{ id: 'o1', total: 50000, status: 'completed' }],
        checkins: [{ id: 'ch1', reward_amount: 5000, status: 'approved' }],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/summary', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.total_customers).toBe(1);
  });
});

describe('GET /orders', () => {
  test('returns order metrics by status', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/orders', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('filters by date range', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/orders?from=2026-06-01&to=2026-06-30', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
