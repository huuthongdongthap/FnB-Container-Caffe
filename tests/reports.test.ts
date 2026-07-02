/**
 * Reports Routes Tests — GET /api/reports/daily, /summary, /orders
 * and new endpoints: /top-products, /peak-hours, /customers, /export
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

  function extractSelectColumns(sql: string): string[] | null {
    const match = sql.match(/^\s*SELECT\s+(.+?)\s+FROM/i);
    if (!match) return null;
    return match[1].split(',').map(c => c.trim().split(/\s+as\s+/i)[0].trim());
  }

  function isCountDistinct(sql: string): boolean {
    return /COUNT\s*\(\s*DISTINCT/i.test(sql);
  }

  function isRepeatCustomerSubquery(sql: string): boolean {
    return /HAVING\s+COUNT\s*\(\s*\*\s*\)\s*>\s*1/i.test(sql);
  }

  function isStrftimeQuery(sql: string): boolean {
    return /strftime/i.test(sql);
  }

  function resolveAggregate(sql: string, tableRows: any[]): Record<string, any> | null {
    // Handle subquery for repeat customers: SELECT COUNT(*) as count FROM (SELECT ... HAVING COUNT(*) > 1)
    if (isRepeatCustomerSubquery(sql)) {
      const innerTable = sql.match(/FROM\s+\(\s*SELECT\s+(\w+)\s+FROM\s+(\w+)/i);
      if (innerTable) {
        const groupField = innerTable[1];
        const tableName = innerTable[2];
        if (tables[tableName]) {
          const groups = new Map<string, number>();
          for (const row of tables[tableName]) {
            const val = String(row[groupField] ?? '');
            groups.set(val, (groups.get(val) || 0) + 1);
          }
          const repeatCount = [...groups.values()].filter(c => c > 1).length;
          const aliasMatch = sql.match(/COUNT\s*\(\s*\*\s*\)\s+as\s+(\w+)/i);
          const result: Record<string, any> = {};
          result[aliasMatch?.[1] || 'count'] = repeatCount;
          return result;
        }
      }
    }

    // Handle COUNT(DISTINCT column) as alias
    const distinctCountMatch = sql.match(/COUNT\s*\(\s*DISTINCT\s+(\w+)\s*\)\s+as\s+(\w+)/i);
    if (distinctCountMatch) {
      const field = distinctCountMatch[1];
      const alias = distinctCountMatch[2];
      const distinct = new Set(tableRows.map((r: any) => r[field]));
      const result: Record<string, any> = {};
      result[alias] = distinct.size;
      return result;
    }

    // COUNT(*) as alias
    const countMatch = sql.match(/COUNT\s*\(\s*\*\s*\)\s+as\s+(\w+)/i);
    if (countMatch) {
      const result: Record<string, any> = {};
      result[countMatch[1]] = tableRows.length;
      return result;
    }

    // COALESCE(SUM(field), 0) as alias
    const sumMatch = sql.match(/COALESCE\s*\(\s*SUM\s*\(\s*(\w+)\s*\)\s*,\s*(\d+)\s*\)\s+as\s+(\w+)/i);
    if (sumMatch) {
      const field = sumMatch[1];
      const alias = sumMatch[3];
      const total = tableRows.reduce((sum: number, r: any) => sum + (Number(r[field]) || 0), 0);
      const result: Record<string, any> = {};
      result[alias] = total;
      return result;
    }

    // Handle AVG queries: COALESCE(SUM(field1), 0) * 1.0 / NULLIF(COUNT(DISTINCT field2), 0)
    const avgSumMatch = sql.match(/COALESCE\s*\(\s*SUM\s*\(\s*(\w+)\s*\)\s*,\s*0\s*\)/i);
    const avgDistinctMatch = sql.match(/COUNT\s*\(\s*DISTINCT\s+(\w+)\s*\)/i);
    if (avgSumMatch && avgDistinctMatch) {
      const sumField = avgSumMatch[1];
      const distinctField = avgDistinctMatch[1];
      if (distinctField === sumField) return null; // Skip, let caller handle
      const total = tableRows.reduce((sum: number, r: any) => sum + (Number(r[sumField]) || 0), 0);
      const distinct = new Set(tableRows.map((r: any) => r[distinctField]));
      return null; // Let caller handle complex AVG
    }

    return null;
  }

  function getDateValue(row: any, field: string): string | null {
    const val = row[field];
    if (!val) return null;
    return String(val).slice(0, 10); // YYYY-MM-DD
  }

  function filterRows(sql: string, bindValues: any[], rows: any[]): any[] {
    let filtered = [...rows];

    // DATE(column) BETWEEN ? AND ?
    const dateRangeMatch = sql.match(/DATE\s*\(\s*(\w+)\s*\)\s+BETWEEN\s+\?\s+AND\s+\?/i);
    if (dateRangeMatch) {
      const field = dateRangeMatch[1];
      const from = String(bindValues[0] || '').slice(0, 10);
      const to = String(bindValues[1] || '').slice(0, 10);
      if (from && to) {
        filtered = filtered.filter(r => {
          const d = getDateValue(r, field);
          return d !== null && d >= from && d <= to;
        });
      }
    }

    // column != 'value'
    const notEqMatch = sql.match(/(\w+)\s+!=\s+'([^']+)'/i);
    if (notEqMatch) {
      const field = notEqMatch[1];
      const value = notEqMatch[2];
      filtered = filtered.filter(r => String(r[field] ?? '') !== value);
    }

    // column >= ? (for date comparisons like created_at >= ?)
    const gteMatch = sql.match(/(\w+)\s+>=\s+\?/i);
    if (gteMatch) {
      const field = gteMatch[1];
      const threshold = String(bindValues[0] || '');
      if (threshold) {
        filtered = filtered.filter(r => {
          const val = String(r[field] ?? '');
          return val >= threshold;
        });
      }
    }

    return filtered;
  }

  const db = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q, _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
        first: vi.fn(async function () {
          const table = getPrimaryTable(q);
          let rows = (table && tables[table]) ? [...tables[table]] : [];
          rows = filterRows(q, this._bindValues, rows);
          const agg = resolveAggregate(q, rows);
          if (agg) return agg;
          return rows[0] || null;
        }),
        all: vi.fn(async function () {
          const table = getPrimaryTable(q);
          let rows = (table && tables[table]) ? [...tables[table]] : [];
          rows = filterRows(q, this._bindValues, rows);

          if (!table) return { results: [] };

          // Handle GROUP BY
          const groupMatch = q.match(/GROUP\s+BY\s+(\w+)/i);
          if (groupMatch) {
            const groupField = groupMatch[1];

            // Handle strftime('%H', field) GROUP BY hour
            if (isStrftimeQuery(q) && groupField === 'hour') {
              const hourGroups = rows.reduce((acc: Record<number, any>, r: any) => {
                const dateStr = r['created_at'];
                // Parse hour from ISO string (e.g., '2026-06-01T08:30:00Z' -> 8)
                const hour = dateStr ? parseInt(dateStr.slice(11, 13), 10) : 0;
                if (!acc[hour]) {
                  acc[hour] = { hour, order_count: 0, revenue: 0 };
                }
                acc[hour].order_count += 1;
                acc[hour].revenue += Number(r['total'] || 0);
                return acc;
              }, {});
              return { results: Object.values(hourGroups).sort((a: any, b: any) => a.hour - b.hour) };
            }

            // Standard GROUP BY logic
            const dateField = q.match(/DATE\s*\(\s*(\w+)\s*\)/i)?.[1] || groupField;
            const countAlias = q.match(/COUNT\s*\(\s*\*\s*\)\s+as\s+(\w+)/i)?.[1];
            const sumField = q.match(/SUM\s*\(\s*(\w+)\s*\)/i)?.[1];
            const sumAlias = q.match(/SUM\s*\(\s*\w+\s*\)\s+as\s+(\w+)/i)?.[1] ||
              q.match(/COALESCE\s*\(\s*SUM\s*\(\s*\w+\s*\)\s*,\s*\d+\s*\)\s+as\s+(\w+)/i)?.[1];

            const grouped = rows.reduce((acc: Record<string, any>, r: any) => {
              const key = r[dateField] ? String(r[dateField]).slice(0, 10) : String(r[groupField]);
              if (!acc[key]) {
                const base: any = {};
                if (dateField) base['date'] = key;
                if (groupField) base[groupField] = key;
                base['count'] = 0;
                base['revenue'] = 0;
                acc[key] = base;
              }
              acc[key].count += 1;
              if (sumField) acc[key].revenue += Number(r[sumField] || 0);
              if (sumAlias) acc[key][sumAlias] = (acc[key][sumAlias] || 0) + Number(r[sumField || 'total'] || 0);
              return acc;
            }, {});
            const results = Object.values(grouped);

            // Apply COALESCE for aggregate fields
            const coalesceMatch = q.match(/COALESCE\s*\(\s*SUM\s*\(\s*(\w+)\s*\)\s*,\s*(\d+)\s*\)/i);
            if (coalesceMatch) {
              const alias = q.match(/COALESCE\s*\(\s*SUM\s*\(\s*\w+\s*\)\s*,\s*\d+\s*\)\s+as\s+(\w+)/i);
              if (alias) {
                results.forEach((r: any) => { if (r[alias[1]] == null) r[alias[1]] = 0; });
              }
            }
            return { results };
          }

          // For non-GROUP BY queries, filter columns if it's a simple SELECT
          const selectCols = extractSelectColumns(q);
          if (selectCols && selectCols.length > 0 && selectCols[0] !== '*') {
            const projected = rows.map(r => {
              const obj: Record<string, any> = {};
              for (const col of selectCols) {
                const cleanCol = col.replace(/['"]/g, '');
                if (cleanCol in r) obj[cleanCol] = r[cleanCol];
              }
              return Object.keys(obj).length > 0 ? obj : r;
            });
            return { results: projected };
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

// ── NEW: GET /top-products ────────────────────────────────────────

describe('GET /top-products', () => {
  test('returns sorted top products with name, qty, revenue', async () => {
    env = {
      AURA_DB: createMockD1({
        orders: [
          {
            id: 'o1', items: '[{"name":"Coffee","qty":2,"price":30000},{"name":"Tea","qty":1,"price":20000}]',
            total: 80000, status: 'completed', created_at: '2026-06-01T10:00:00Z',
          },
          {
            id: 'o2', items: '[{"name":"Coffee","qty":1,"price":30000},{"name":"Juice","qty":2,"price":25000}]',
            total: 80000, status: 'completed', created_at: '2026-06-02T10:00:00Z',
          },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/top-products?from=2026-06-01&to=2026-06-30', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    // Coffee: qty=3 (2+1), revenue=90000 (60000+30000)
    // Juice: qty=2, revenue=50000
    // Tea: qty=1, revenue=20000
    expect(body.data[0].name).toBe('Coffee');
    expect(body.data[0].qty).toBe(3);
    expect(body.data[0].revenue).toBe(90000);
    expect(body.data[1].name).toBe('Juice');
    expect(body.data[1].qty).toBe(2);
    expect(body.data[2].name).toBe('Tea');
    expect(body.data[2].qty).toBe(1);
  });

  test('excludes cancelled orders', async () => {
    env = {
      AURA_DB: createMockD1({
        orders: [
          {
            id: 'o1', items: '[{"name":"Coffee","qty":2,"price":30000}]',
            total: 60000, status: 'completed', created_at: '2026-06-01T10:00:00Z',
          },
          {
            id: 'o2', items: '[{"name":"Coffee","qty":10,"price":30000}]',
            total: 300000, status: 'cancelled', created_at: '2026-06-02T10:00:00Z',
          },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/top-products?from=2026-06-01&to=2026-06-30', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].qty).toBe(2);
    expect(body.data[0].revenue).toBe(60000);
  });

  test('returns empty array for no orders in range', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/top-products?from=2026-01-01&to=2026-01-31', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  test('handles malformed JSON in items column gracefully', async () => {
    env = {
      AURA_DB: createMockD1({
        orders: [
          {
            id: 'o1', items: '[{"name":"Coffee","qty":1,"price":30000}]',
            total: 30000, status: 'completed', created_at: '2026-06-01T10:00:00Z',
          },
          {
            id: 'o2', items: 'NOT VALID JSON',
            total: 50000, status: 'completed', created_at: '2026-06-01T11:00:00Z',
          },
          {
            id: 'o3', items: '{}',
            total: 40000, status: 'completed', created_at: '2026-06-01T12:00:00Z',
          },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/top-products?from=2026-06-01&to=2026-06-30', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Only the valid Coffee item should be counted
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('Coffee');
  });

  test('respects limit parameter', async () => {
    env = {
      AURA_DB: createMockD1({
        orders: [
          {
            id: 'o1', items: '[{"name":"A","qty":10,"price":1000},{"name":"B","qty":9,"price":1000},{"name":"C","qty":8,"price":1000},{"name":"D","qty":7,"price":1000}]',
            total: 34000, status: 'completed', created_at: '2026-06-01T10:00:00Z',
          },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/top-products?from=2026-06-01&to=2026-06-30&limit=2', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
    expect(body.data[0].name).toBe('A');
    expect(body.data[1].name).toBe('B');
  });

  test('defaults to limit 10 when not specified', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/top-products?from=2026-01-01&to=2026-01-31', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ── NEW: GET /peak-hours ──────────────────────────────────────────

describe('GET /peak-hours', () => {
  test('returns 24 hour buckets with zero-fill', async () => {
    env = {
      AURA_DB: createMockD1({
        orders: [
          {
            id: 'o1', total: 50000, status: 'completed',
            created_at: '2026-06-01T08:30:00Z',
          },
          {
            id: 'o2', total: 30000, status: 'completed',
            created_at: '2026-06-01T08:45:00Z',
          },
          {
            id: 'o3', total: 70000, status: 'completed',
            created_at: '2026-06-01T12:00:00Z',
          },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/peak-hours?from=2026-06-01&to=2026-06-01', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(24);

    // Hour 8 should have 2 orders, revenue 80000
    const hour8 = body.data.find((h: any) => h.hour === 8);
    expect(hour8).toBeDefined();
    expect(hour8.order_count).toBe(2);
    expect(hour8.revenue).toBe(80000);

    // Hour 12 should have 1 order, revenue 70000
    const hour12 = body.data.find((h: any) => h.hour === 12);
    expect(hour12).toBeDefined();
    expect(hour12.order_count).toBe(1);
    expect(hour12.revenue).toBe(70000);

    // Hour 0 should have 0 orders
    const hour0 = body.data.find((h: any) => h.hour === 0);
    expect(hour0).toBeDefined();
    expect(hour0.order_count).toBe(0);
    expect(hour0.revenue).toBe(0);
  });

  test('returns all zeros for empty date range', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/peak-hours?from=2026-01-01&to=2026-01-31', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(24);
    for (const h of body.data) {
      expect(h.order_count).toBe(0);
      expect(h.revenue).toBe(0);
    }
  });

  test('excludes cancelled orders from peak hours', async () => {
    env = {
      AURA_DB: createMockD1({
        orders: [
          {
            id: 'o1', total: 50000, status: 'completed',
            created_at: '2026-06-01T08:00:00Z',
          },
          {
            id: 'o2', total: 90000, status: 'cancelled',
            created_at: '2026-06-01T08:00:00Z',
          },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/peak-hours?from=2026-06-01&to=2026-06-01', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    const hour8 = body.data.find((h: any) => h.hour === 8);
    expect(hour8.order_count).toBe(1);
    expect(hour8.revenue).toBe(50000);
  });

  test('each hour bucket has correct shape', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/peak-hours?from=2026-06-01&to=2026-06-01', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const h of body.data) {
      expect(h).toHaveProperty('hour');
      expect(h).toHaveProperty('order_count');
      expect(h).toHaveProperty('revenue');
      expect(typeof h.hour).toBe('number');
      expect(typeof h.order_count).toBe('number');
      expect(typeof h.revenue).toBe('number');
    }
  });
});

// ── NEW: GET /customers ───────────────────────────────────────────

describe('GET /customer-metrics', () => {
  test('returns full customer metrics with 6 fields', async () => {
    env = {
      AURA_DB: createMockD1({
        customers: [
          { id: 'c1', name: 'Alice', created_at: '2026-06-01T10:00:00Z' },
          { id: 'c2', name: 'Bob', created_at: '2026-05-01T10:00:00Z' },
          { id: 'c3', name: 'Charlie', created_at: new Date().toISOString() },
        ],
        orders: [
          { id: 'o1', customer_id: 'c1', total: 50000, status: 'completed', created_at: '2026-06-01T10:00:00Z' },
          { id: 'o2', customer_id: 'c1', total: 30000, status: 'completed', created_at: '2026-06-02T10:00:00Z' },
          { id: 'o3', customer_id: 'c2', total: 70000, status: 'completed', created_at: '2026-05-01T10:00:00Z' },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/customer-metrics', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Check all 6 fields exist
    expect(body.data).toHaveProperty('total_customers');
    expect(body.data).toHaveProperty('new_customers_30d');
    expect(body.data).toHaveProperty('repeat_customers');
    expect(body.data).toHaveProperty('repeat_rate');
    expect(body.data).toHaveProperty('avg_spend_per_customer');
    expect(body.data).toHaveProperty('avg_orders_per_customer');

    // 3 customers total
    expect(body.data.total_customers).toBe(3);
    // 1 repeat customer (c1 has 2 orders)
    expect(body.data.repeat_customers).toBe(1);
    // repeat_rate = 1/3 ≈ 0.33
    expect(body.data.repeat_rate).toBeCloseTo(0.33, 1);
  });

  test('returns zeros for empty database', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/customer-metrics', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.total_customers).toBe(0);
    expect(body.data.new_customers_30d).toBe(0);
    expect(body.data.repeat_customers).toBe(0);
    expect(body.data.repeat_rate).toBe(0);
    expect(body.data.avg_spend_per_customer).toBe(0);
    expect(body.data.avg_orders_per_customer).toBe(0);
  });

  test('handles all-new customers (no repeats)', async () => {
    env = {
      AURA_DB: createMockD1({
        customers: [
          { id: 'c1', name: 'Alice', created_at: new Date().toISOString() },
          { id: 'c2', name: 'Bob', created_at: new Date().toISOString() },
        ],
        orders: [
          { id: 'o1', customer_id: 'c1', total: 50000, status: 'completed', created_at: new Date().toISOString() },
          { id: 'o2', customer_id: 'c2', total: 30000, status: 'completed', created_at: new Date().toISOString() },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/customer-metrics', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.repeat_customers).toBe(0);
    expect(body.data.repeat_rate).toBe(0);
  });

  test('handles single customer edge case', async () => {
    env = {
      AURA_DB: createMockD1({
        customers: [
          { id: 'c1', name: 'Only', created_at: new Date().toISOString() },
        ],
        orders: [
          { id: 'o1', customer_id: 'c1', total: 100000, status: 'completed', created_at: new Date().toISOString() },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/customer-metrics', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.total_customers).toBe(1);
    expect(body.data.repeat_customers).toBe(0);
    expect(body.data.avg_spend_per_customer).toBe(100000);
    expect(body.data.avg_orders_per_customer).toBe(1);
  });
});

// ── NEW: GET /export ──────────────────────────────────────────────

describe('GET /export', () => {
  test('orders type returns CSV with BOM and correct headers', async () => {
    env = {
      AURA_DB: createMockD1({
        orders: [
          {
            id: 'o1', customer_name: 'Alice', customer_phone: '0901234567',
            total: 50000, status: 'completed', payment_method: 'cash',
            created_at: '2026-06-01T10:00:00Z',
          },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/export?from=2026-06-01&to=2026-06-30&type=orders', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toContain('orders-report');
    expect(res.headers.get('Content-Disposition')).toContain('.csv');

    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Check UTF-8 BOM bytes (Response.text() strips BOM per Encoding spec)
    expect(bytes[0]).toBe(0xEF);
    expect(bytes[1]).toBe(0xBB);
    expect(bytes[2]).toBe(0xBF);
    const csv = new TextDecoder().decode(buf.slice(3));
    // Headers
    expect(csv).toContain('id,customer_name,customer_phone,total,status,payment_method,created_at');
    // Data row
    expect(csv).toContain('o1,Alice,0901234567,50000,completed,cash,2026-06-01');
  });

  test('revenue type returns CSV with BOM and correct columns', async () => {
    env = {
      AURA_DB: createMockD1({
        orders: [
          { id: 'o1', total: 50000, status: 'completed', created_at: '2026-06-01T10:00:00Z' },
          { id: 'o2', total: 30000, status: 'completed', created_at: '2026-06-01T11:00:00Z' },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/export?from=2026-06-01&to=2026-06-30&type=revenue', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toContain('revenue-report');

    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    expect(bytes[0]).toBe(0xEF);
    expect(bytes[1]).toBe(0xBB);
    expect(bytes[2]).toBe(0xBF);
    const csv = new TextDecoder().decode(buf.slice(3));
    expect(csv).toContain('date,orders,revenue,avg_order_value,cashback_earned');
  });

  test('customers type returns CSV with correct columns', async () => {
    env = {
      AURA_DB: createMockD1({
        customers: [
          { id: 'c1', name: 'Alice', email: 'alice@test.com', phone: '0901234567', loyalty_tier: 'Gold', created_at: '2026-06-01T10:00:00Z' },
        ],
      }),
    };
    await mountRouter();

    const res = await reportsRouter.request('/export?from=2026-06-01&to=2026-06-30&type=customers', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toContain('customers-report');

    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    expect(bytes[0]).toBe(0xEF);
    expect(bytes[1]).toBe(0xBB);
    expect(bytes[2]).toBe(0xBF);
    const csv = new TextDecoder().decode(buf.slice(3));
    expect(csv).toContain('id,name,email,phone,total_spent,order_count,loyalty_tier,created_at');
  });

  test('invalid type returns 400 error', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/export?from=2026-06-01&to=2026-06-30&type=invalid', { method: 'GET' }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test('empty data returns CSV with headers only', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/export?from=2026-01-01&to=2026-01-31&type=orders', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    expect(bytes[0]).toBe(0xEF);
    expect(bytes[1]).toBe(0xBB);
    expect(bytes[2]).toBe(0xBF);
    const csv = new TextDecoder().decode(buf.slice(3));
    // Headers present
    expect(csv).toContain('id,customer_name,customer_phone,total,status,payment_method,created_at');
    // No data rows (just header + trailing newline)
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(1);
  });

  test('revenue report handles empty data', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await reportsRouter.request('/export?from=2026-01-01&to=2026-01-31&type=revenue', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    expect(bytes[0]).toBe(0xEF);
    expect(bytes[1]).toBe(0xBB);
    expect(bytes[2]).toBe(0xBF);
    const csv = new TextDecoder().decode(buf.slice(3));
    expect(csv).toContain('date,orders,revenue,avg_order_value,cashback_earned');
  });
});
