import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { staffTipsRouter } from '../../../routes/staff-tips';
import { requireAuth } from '../../../middleware/auth';
import { generateJWT } from '../../../lib/jwt';
import type { D1Database } from '@cloudflare/workers-types';

interface R { [k: string]: unknown }
function makeDB(rowsBySql: Array<{ match: (s: string) => boolean; rows: R[]; firstRow?: R | null }>): D1Database {
  const log: string[] = []; const bound: { sql: string; args: unknown[] }[] = []; let idx = 0;
  return {
    _log: log, _bound: bound,
    prepare: (sql: string) => {
      log.push(sql);
      let h = rowsBySql[idx]; if (h && !h.match(sql)) h = rowsBySql.find(x => x.match(sql));
      if (h) idx = rowsBySql.indexOf(h) + 1;
      const rows = h?.rows ?? []; const fr = h?.firstRow !== undefined ? h.firstRow : (rows[0] ?? null);
      const st = { bind: (...a: unknown[]) => { bound.push({ sql, args: a }); return st; }, run: async () => ({ success: true, changes: 1 }), first: async () => fr, all: async () => ({ results: rows }), raw: async () => [] };
      return st;
    },
    batch: async () => [], exec: async () => ({ count: 0, duration: 0 }), dump: async () => new Uint8Array(),
  } as unknown as D1Database;
}
const SECRET = 'test-jwt-secret-at-least-16-chars';
const KV = new Map<string, string>();
function env(db: D1Database) { KV.clear(); return { AURA_DB: db, AUTH_KV: { get: async (k: string) => KV.has(k) ? KV.get(k) : null, put: async (k: string, v: string) => { KV.set(k, v); }, delete: async (k: string) => { KV.delete(k); } } as any, JWT_SECRET: SECRET } as any; }
const app = new Hono<{ Bindings: any }>();
app.use('/api/staff-tips/*', requireAuth(['owner', 'staff', 'manager']));
app.route('/api/staff-tips', staffTipsRouter);
async function fh(db: D1Database, m: string, p: string, b?: unknown) {
  const t = await generateJWT({ id: 'u1', email: 'a@b.c', name: 'A', role: 'owner' }, SECRET);
  const r = await app.fetch(new Request(`https://test.aura${p}`, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, ...(b ? { body: JSON.stringify(b) } : {}) }), env(db), { waitUntil: () => {} } as any);
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
describe('staff-tips routes', () => {
  it('GET / returns daily tip rollup', async () => {
    const db = makeDB([{ match: (s) => s.includes('LEFT JOIN users'), rows: [{ staff_id: 'u1', staff_name: 'A', tip_total: 20000, order_count: 3, session_count: 2 }] }]);
    const { status, json } = await fh(db, 'GET', '/api/staff-tips');
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data[0].staff_id).toBe('u1');
    expect(json.summary.tip_total).toBe(20000);
  });
  it('GET /:staffId returns per-day history', async () => {
    const db = makeDB([{ match: (s) => s.includes('GROUP BY date'), rows: [{ date: '2026-08-20', tip_total: 5000, order_count: 2 }] }]);
    const { status, json } = await fh(db, 'GET', '/api/staff-tips/u1');
    expect(status).toBe(200);
    expect(json.total_tip).toBe(5000);
  });
  it('POST /assign attributes a tip to staff', async () => {
    const db = makeDB([
      { match: (s) => s.includes('orders WHERE id ='), rows: [{ id: 'ORD-1', tip_amount: 0 }], firstRow: { id: 'ORD-1', tip_amount: 0 } },
      { match: (s) => s.startsWith('UPDATE orders SET tip_amount'), rows: [], firstRow: null },
    ]);
    const { status, json } = await fh(db, 'POST', '/api/staff-tips/assign', { order_id: 'ORD-1', staff_id: 'u1', tip_amount: 15000 });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    const upd = db._bound.find(e => e.sql.startsWith('UPDATE orders SET tip_amount'))!;
    expect(upd.args).toContain(15000);
    expect(upd.args).toContain('u1');
  });
  it('POST /assign rejects missing order_id', async () => {
    const db = makeDB([]);
    const { status, json } = await fh(db, 'POST', '/api/staff-tips/assign', { staff_id: 'u1' });
    expect(status).toBe(400);
    expect(json.error).toContain('order_id is required');
  });
  it('POST /assign returns 404 for unknown order', async () => {
    const db = makeDB([{ match: (s) => s.includes('orders WHERE id ='), rows: [], firstRow: null }]);
    const { status, json } = await fh(db, 'POST', '/api/staff-tips/assign', { order_id: 'NOPE', staff_id: 'u1', tip_amount: 1000 });
    expect(status).toBe(404);
  });
});
