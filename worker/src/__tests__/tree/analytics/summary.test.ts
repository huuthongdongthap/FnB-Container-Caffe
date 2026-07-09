import { describe, it, expect, vi } from 'vitest';
import { getSummary, getSummaryCompare, getGrouped } from '../../../tree/analytics/summary.js';
// D1 mock: closure-based chain
function makeD1(rows: unknown[] = []) {
  return {
    prepare: (_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => rows[0],
        all: async () => ({ results: rows }),
      }),
    }),
  } as unknown as D1Database;
}
describe('Analytics: summary', () => {
  it('getSummary returns zeros when no orders', async () => {
    const db = makeD1([{ total_orders: 0, total_revenue: 0, avg_order_value: 0, total_customers: 0 }]);
    const r = await getSummary(db, 30);
    expect(r).toEqual({ total_orders: 0, total_revenue: 0, avg_order_value: 0, total_customers: 0 });
  });
  it('getSummary returns values when orders exist', async () => {
    const db = makeD1([{ total_orders: 10, total_revenue: 500000, avg_order_value: 50000, total_customers: 8 }]);
    const r = await getSummary(db, 7);
    expect(r.total_orders).toBe(10);
    expect(r.total_revenue).toBe(500000);
    expect(r.avg_order_value).toBe(50000);
    expect(r.total_customers).toBe(8);
  });
  it('getSummaryCompare returns current + previous periods', async () => {
    let callCount = 0;
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async () => {
            callCount++;
            return callCount === 1
              ? { total_orders: 5, total_revenue: 250000, avg_order_value: 50000, total_customers: 4 }
              : { total_orders: 3, total_revenue: 150000, avg_order_value: 50000, total_customers: 2 };
          },
        }),
      }),
    } as unknown as D1Database;
    const r = await getSummaryCompare(db, 7);
    expect(r.current.total_orders).toBe(5);
    expect(r.previous.total_orders).toBe(3);
  });
  it('getSummaryCompare handles null/undefined rows gracefully', async () => {
    const db = makeD1([null, undefined]);
    const r = await getSummaryCompare(db, 30);
    expect(r.current.total_orders).toBe(0);
    expect(r.previous.total_orders).toBe(0);
  });
});
