/**
 * Reports Reconciliation Endpoint Tests — /api/reports/reconciliation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';

interface ScriptedRow { [key: string]: unknown }

function makeScriptedDB(rowsBySql: Array<{ match: (sql: string) => boolean; rows: ScriptedRow[]; firstRow?: ScriptedRow | null }>): D1Database {
  const callLog: string[] = [];
  const boundLog: { sql: string; args: unknown[] }[] = [];
  const db = {
    _log: callLog,
    _bound: boundLog,
    prepare: (sql: string) => {
      callLog.push(sql);
      const handler = rowsBySql.find(h => h.match(sql));
      const rows = handler?.rows ?? [];
      const firstRow = handler?.firstRow !== undefined ? handler.firstRow : (rows[0] ?? null);
      const stmt = {
        bind: (...args: unknown[]) => { boundLog.push({ sql, args }); return stmt; },
        run: async () => ({ success: true, changes: 1, lastRowId: 1, meta: {} }),
        first: async () => firstRow,
        all: async () => ({ results: rows, success: true, meta: {} }),
        raw: async () => [],
      };
      return stmt;
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  } as unknown as D1Database;
  return db;
}

const SECRET = 'test-jwt-secret-at-least-16-chars';
const KV = new Map<string, string>();
function makeEnv(db: D1Database) {
  KV.clear();
  return {
    AURA_DB: db,
    AUTH_KV: { get: async (k: string) => (KV.has(k) ? KV.get(k) : null), put: async (k: string, v: string) => { KV.set(k, v); }, delete: async (k: string) => { KV.delete(k); } } as any,
    JWT_SECRET: SECRET,
  } as any;
}

describe('reports reconciliation endpoint', () => {
  let app: Hono<{ Bindings: any }>;
  let db: D1Database;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../routes/reports');
    app = new Hono();
    app.route('/api/reports', mod.reportsRouter);

    db = makeScriptedDB([
      // Shifts query — must match before expenses (both can match FROM xxx)
      { match: (s) => s.includes('FROM shifts'), rows: [
        { id: 'shift1', shift_date: '2026-07-15', opening_float: 500000, actual_cash: 750000, denominations: '{"1000":50}' },
        { id: 'shift2', shift_date: '2026-07-16', opening_float: 500000, actual_cash: 850000, denominations: '{"1000":60}' },
      ]},
      // Cash payments — must be specific to avoid matching other "orders" queries
      { match: (s) => s.includes("payment_method = 'cash'") && s.includes('FROM orders'), rows: [
        { date: '2026-07-15', total: 430000 },
        { date: '2026-07-16', total: 150000 },
      ]},
      // Cash payouts
      { match: (s) => s.includes('FROM expenses'), rows: [
        { date: '2026-07-15', total: 50000 },
      ]},
      // Payment method summary
      { match: (s) => s.includes('GROUP BY payment_method'), rows: [
        { method: 'cash', count: 3, total: 580000 },
        { method: 'momo', count: 1, total: 320000 },
      ]},
      // Orders with items (for category revenue) — specific match
      { match: (s) => s.includes('SELECT items FROM orders'), rows: [
        { items: '[{"name":"Latte","qty":1,"price":120000,"category":"Coffee"},{"name":"Cronut","qty":1,"price":130000,"category":"Food"}]' },
        { items: '[{"name":"Cappuccino","qty":1,"price":180000,"category":"Coffee"}]' },
        { items: '[{"name":"Sandwich","qty":1,"price":320000,"category":"Food"}]' },
        { items: '[{"name":"Latte","qty":1,"price":150000,"category":"Coffee"}]' },
      ]},
    ]);
  });

  it('GET /reconciliation returns 200 with shifts and totals', async () => {
    const res = await app.fetch(
      new Request('https://test.aura/api/reports/reconciliation?from=2026-07-15&to=2026-07-16'),
      makeEnv(db),
      { waitUntil: () => {} } as any,
    );
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('shifts');
    expect(json.data).toHaveProperty('totals');
    expect(json.data).toHaveProperty('payment_methods');
  });

  it('payment_methods includes digital payments (momo)', async () => {
    const res = await app.fetch(
      new Request('https://test.aura/api/reports/reconciliation?from=2026-07-15&to=2026-07-16'),
      makeEnv(db),
      { waitUntil: () => {} } as any,
    );
    const json = await res.json() as any;
    const momo = json.data.payment_methods?.find((p: any) => p.method === 'momo');
    expect(momo).toBeDefined();
    expect(momo.total).toBe(320000);
  });

  it('shifts contain opening_float and expected_cash', async () => {
    const res = await app.fetch(
      new Request('https://test.aura/api/reports/reconciliation?from=2026-07-15&to=2026-07-16'),
      makeEnv(db),
      { waitUntil: () => {} } as any,
    );
    const json = await res.json() as any;
    expect(json.data.shifts.length).toBeGreaterThan(0);
    for (const shift of json.data.shifts) {
      expect(shift).toHaveProperty('opening_float');
      expect(shift).toHaveProperty('expected_cash');
      expect(shift).toHaveProperty('actual_cash');
    }
  });

  it('totals include revenue and cash_variance', async () => {
    const res = await app.fetch(
      new Request('https://test.aura/api/reports/reconciliation?from=2026-07-15&to=2026-07-16'),
      makeEnv(db),
      { waitUntil: () => {} } as any,
    );
    const json = await res.json() as any;
    expect(json.data.totals).toHaveProperty('revenue');
    expect(json.data.totals).toHaveProperty('cash_expected');
    expect(json.data.totals).toHaveProperty('cash_actual');
    expect(json.data.totals).toHaveProperty('cash_variance');
    expect(json.data.totals).toHaveProperty('digital_payments');
    expect(json.data.totals).toHaveProperty('order_count');
  });
});
