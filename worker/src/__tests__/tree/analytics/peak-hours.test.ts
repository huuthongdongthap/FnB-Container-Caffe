import { describe, it, expect } from 'vitest';
import { getPeakHours } from '../../../tree/analytics/peak-hours.js';
function makeD1(rows: Array<{ hour: number; order_count: number; revenue: number }>) {
  return {
    prepare: (_sql: string) => ({
      bind: (_days: number) => ({
        all: async () => ({ results: rows }),
      }),
    }),
  } as unknown as D1Database;
}
describe('Analytics: peak hours', () => {
  it('returns zero-filled 24-hour array when no data', async () => {
    const db = makeD1([]);
    const r = await getPeakHours(db, 30);
    expect(r).toHaveLength(24);
    expect(r.every(h => h.order_count === 0 && h.revenue === 0)).toBe(true);
  });
  it('fills gaps for partial hour data', async () => {
    const db = makeD1([{ hour: 9, order_count: 5, revenue: 250000 }, { hour: 14, order_count: 3, revenue: 150000 }]);
    const r = await getPeakHours(db, 7);
    expect(r).toHaveLength(24);
    expect(r[9].order_count).toBe(5);
    expect(r[14].order_count).toBe(3);
    expect(r[0].order_count).toBe(0); // not in source
    expect(r[23].order_count).toBe(0); // not in source
  });
  it('returns all data when hours are present', async () => {
    const rows = Array.from({ length: 24 }, (_, h) => ({ hour: h, order_count: h, revenue: h * 1000 }));
    const db = makeD1(rows);
    const r = await getPeakHours(db, 1);
    expect(r.every((val, idx) => val.order_count === idx)).toBe(true);
  });
});
