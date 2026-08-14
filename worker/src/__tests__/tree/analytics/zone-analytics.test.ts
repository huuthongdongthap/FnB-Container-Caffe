/**
 * Unit tests for src/tree/analytics/zone-analytics.ts
 */

import { describe, it, expect } from 'vitest';
import { getZoneStats } from '../../../tree/analytics/zone-analytics.js';
import { createMockDB } from '../../test-utils.js';

function makeZoneDB(rows: Array<{ zone: string | null; total: number; count: number }>) {
 const db = createMockDB();
 let calls: Array<{ sql: string; binds: unknown[] }> = [];
 db.prepare = ((sql: string) => {
 const stmt: Record<string, unknown> = {
 _sql: sql,
 _binds: [] as unknown[],
 bind(...args: unknown[]) { stmt._binds = args; return stmt; },
 async all() {
 calls.push({ sql, binds: [...stmt._binds] });
 const mapped = rows.map(r => ({
 label: r.zone || 'Mang đi',
 value: r.total,
 count: r.count
 }));
 return { results: mapped as never, success: true } as never;
 },
 async first() { return null as never; },
 async run() { return { success: true, changes: 1 } as never; },
 async raw() { return [] as never; }
 };
 return stmt as never;
 }) as typeof db.prepare;
 return { db, calls };
}

describe('getZoneStats', () => {
 it('returns zone rows sorted by revenue desc', async() => {
 const { db } = makeZoneDB([
 { zone: 'VIP', total: 500000, count: 10 },
 { zone: 'Indoor', total: 300000, count: 20 },
 { zone: 'Outdoor', total: 100000, count: 5 }
 ]);
 const result = await getZoneStats(db, 30);
 expect(result).toHaveLength(3);
 expect(result[0].label).toBe('VIP');
 expect(result[0].value).toBe(500000);
 expect(result[0].count).toBe(10);
 expect(result[1].label).toBe('Indoor');
 expect(result[2].label).toBe('Outdoor');
 });

 it('maps null table_id to "Mang đi"', async() => {
 const { db } = makeZoneDB([{ zone: null, total: 50000, count: 3 }]);
 const result = await getZoneStats(db, 30);
 expect(result).toHaveLength(1);
 expect(result[0].label).toBe('Mang đi');
 expect(result[0].value).toBe(50000);
 });

 it('binds days parameter', async() => {
 const { db, calls } = makeZoneDB([]);
 await getZoneStats(db, 14);
 const call = calls.find(c => c.sql.includes('days'));
 expect(call).toBeDefined();
 expect((call!.binds[0] as number)).toBe(14);
 });

 it('excludes cancelled orders', async() => {
 const { db, calls } = makeZoneDB([]);
 await getZoneStats(db, 30);
 const call = calls[0];
 expect((call!.sql as string)).toContain("status != 'cancelled'");
 });

 it('returns empty array when no orders', async() => {
 const { db, calls } = makeZoneDB([]);
 const result = await getZoneStats(db, 30);
 expect(result).toEqual([]);
 });

 it('includes days window in WHERE clause', async() => {
 const { db, calls } = makeZoneDB([]);
 await getZoneStats(db, 7);
 const call = calls[0];
 expect((call!.sql as string)).toContain("datetime('now', '-' || ? || ' days')");
 expect((call!.binds[0] as number)).toBe(7);
 });
});
