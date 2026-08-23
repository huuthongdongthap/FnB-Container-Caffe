import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { floorPlanRouter } from '../../../routes/floor-plan';
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
app.use('/api/floor-plan/*', requireAuth(['owner', 'staff', 'manager']));
app.route('/api/floor-plan', floorPlanRouter);
async function fh(db: D1Database, m: string, p: string, b?: unknown) {
  const t = await generateJWT({ id: 'u1', email: 'a@b.c', name: 'A', role: 'owner' }, SECRET);
  const r = await app.fetch(new Request(`https://test.aura${p}`, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, ...(b ? { body: JSON.stringify(b) } : {}) }), env(db), { waitUntil: () => {} } as any);
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
describe('floor-plan routes', () => {
  it('GET / returns tables with active session linkage', async () => {
    const db = makeDB([{ match: (s) => s.includes('cafe_tables'), rows: [{ id: 'T1', table_number: 5, zone: 'A', capacity: 4, status: 'Occupied', session_id: 'SES-1', session_status: 'active', session_order_count: 2, session_total_amount: 50000, session_customer_name: 'Julian' }] }]);
    const { status, json } = await fh(db, 'GET', '/api/floor-plan');
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data[0].active_session.id).toBe('SES-1');
    expect(json.summary.occupied).toBe(1);
  });
  it('GET /summary returns per-status counts', async () => {
    const db = makeDB([{ match: (s) => s.includes('GROUP BY status'), rows: [{ status: 'Available', c: 5 }, { status: 'Occupied', c: 2 }] }]);
    const { status, json } = await fh(db, 'GET', '/api/floor-plan/summary');
    expect(status).toBe(200);
    expect(json.data.total).toBe(7);
  });
  it('POST /:id/no-show frees the table and closes the session', async () => {
    const db = makeDB([
      { match: (s) => s.includes('cafe_tables WHERE id ='), rows: [{ id: 'T1', status: 'Occupied' }], firstRow: { id: 'T1', status: 'Occupied' } },
      { match: (s) => s.startsWith('UPDATE cafe_tables SET status'), rows: [], firstRow: null },
      { match: (s) => s.includes('table_sessions WHERE table_id'), rows: [{ id: 'SES-1' }], firstRow: { id: 'SES-1' } },
      { match: (s) => s.startsWith('UPDATE table_sessions SET status'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('UPDATE cafe_tables SET status = '), rows: [], firstRow: null },
    ]);
    const { status, json } = await fh(db, 'POST', '/api/floor-plan/T1/no-show', { timeout_minutes: 30 });
    expect(status).toBe(200);
    expect(json.released_at).toBeTruthy();
    const freeSQL = db._bound.find(e => e.sql.includes("status = 'Available'"))!;
    expect(freeSQL.args).toContain('T1');
  });
  it('POST /:id/no-show returns 404 for unknown table', async () => {
    const db = makeDB([{ match: (s) => s.includes('cafe_tables WHERE id ='), rows: [], firstRow: null }]);
    const { status, json } = await fh(db, 'POST', '/api/floor-plan/NOPE/no-show', {});
    expect(status).toBe(404);
  });
  it('POST /:id/release force-frees a table', async () => {
    const db = makeDB([
      { match: (s) => s.includes('cafe_tables WHERE id ='), rows: [{ id: 'T1', status: 'Overdue' }], firstRow: { id: 'T1', status: 'Overdue' } },
      { match: (s) => s.startsWith('UPDATE cafe_tables SET status'), rows: [], firstRow: null },
      { match: (s) => s.includes('table_sessions WHERE table_id'), rows: [], firstRow: null },
    ]);
    const { status, json } = await fh(db, 'POST', '/api/floor-plan/T1/release');
    expect(status).toBe(200);
    expect(json.message).toContain('released');
  });
});
