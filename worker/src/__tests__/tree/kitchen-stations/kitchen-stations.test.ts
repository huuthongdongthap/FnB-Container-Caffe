/**
 * Kitchen Stations Routes — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { kitchenStationsRouter } from '../../../routes/kitchen-stations';
import { requireStaff } from '../../../middleware/staff-auth';
import { generateJWT } from '../../../lib/jwt';
import type { D1Database } from '@cloudflare/workers-types';

interface ScriptedRow { [key: string]: unknown }

function makeScriptedDB(rowsBySql: Array<{ match: (sql: string) => boolean; rows: ScriptedRow[]; firstRow?: ScriptedRow | null }>): D1Database {
  const callLog: string[] = [];
  const boundLog: { sql: string; args: unknown[] }[] = [];
  let idx = 0;
  const db = {
    _log: callLog,
    _bound: boundLog,
    prepare: (sql: string) => {
      callLog.push(sql);
      let handler = rowsBySql[idx];
      if (handler && !handler.match(sql)) handler = rowsBySql.find(h => h.match(sql));
      if (handler) idx = rowsBySql.indexOf(handler) + 1;
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

const app = new Hono<{ Bindings: any }>();
app.use('/api/kitchen-stations/*', requireStaff(['owner', 'manager', 'staff']));
app.route('/api/kitchen-stations', kitchenStationsRouter);

async function fetchHandler(db: D1Database, method: string, path: string, body?: unknown) {
  const token = await generateJWT({ id: 'u1', email: 'a@b.c', name: 'A', role: 'staff' }, SECRET);
  const req = new Request(`https://test.aura${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const res = await app.fetch(req, makeEnv(db), { waitUntil: () => {} } as any);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

describe('kitchen-stations routes', () => {
  it('GET / lists stations', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('kitchen_stations'), rows: [{ id: 'KS-1', name: 'Quầy cà phê', slug: 'coffee' }] },
    ]);
    const { status, json } = await fetchHandler(db, 'GET', '/api/kitchen-stations');
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
  });

  it('POST / creates a station', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.startsWith('INSERT INTO kitchen_stations'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('SELECT * FROM kitchen_stations WHERE id ='), rows: [{ id: 'KS-NEW', name: 'Quầy đồ uống', slug: 'beverage' }], firstRow: { id: 'KS-NEW', name: 'Quầy đồ uống', slug: 'beverage' } },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/kitchen-stations', { name: 'Quầy đồ uống', slug: 'beverage' });
    expect(status).toBe(201);
    expect(json.data.slug).toBe('beverage');
  });

  it('POST / rejects missing name', async () => {
    const db = makeScriptedDB([]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/kitchen-stations', {});
    expect(status).toBe(400);
    expect(json.error).toContain('name is required');
  });

  it('PATCH /:id updates a station', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('kitchen_stations WHERE id ='), rows: [{ id: 'KS-1', name: 'Quầy cà phê', slug: 'coffee' }], firstRow: { id: 'KS-1', name: 'Quầy cà phê', slug: 'coffee' } },
      { match: (s) => s.startsWith('UPDATE kitchen_stations'), rows: [], firstRow: null },
      { match: (s) => s.includes('kitchen_stations WHERE id ='), rows: [{ id: 'KS-1', name: 'Quầy cà phê', slug: 'coffee', active: 0 }], firstRow: { id: 'KS-1', name: 'Quầy cà phê', slug: 'coffee', active: 0 } },
    ]);
    const { status, json } = await fetchHandler(db, 'PATCH', '/api/kitchen-stations/KS-1', { active: 0 });
    expect(status).toBe(200);
    expect(json.data.active).toBe(0);
  });

  it('PATCH /:id returns 404 for unknown station', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('kitchen_stations WHERE id ='), rows: [], firstRow: null },
    ]);
    const { status, json } = await fetchHandler(db, 'PATCH', '/api/kitchen-stations/NOPE', { active: 0 });
    expect(status).toBe(404);
  });

  it('POST /categories links category to station', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('kitchen_stations WHERE id ='), rows: [{ id: 'KS-1' }], firstRow: { id: 'KS-1' } },
      { match: (s) => s.startsWith('INSERT OR REPLACE INTO category_stations'), rows: [], firstRow: null },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/kitchen-stations/categories', { category_id: 'coffee', station_id: 'KS-1' });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    const link = db._bound.find(e => e.sql.includes('category_stations'))!;
    expect(link.args).toContain('coffee');
    expect(link.args).toContain('KS-1');
  });

  it('POST /categories rejects missing fields', async () => {
    const db = makeScriptedDB([]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/kitchen-stations/categories', { category_id: 'x' });
    expect(status).toBe(400);
  });

  it('GET /:id/tickets returns 404 for unknown station', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('kitchen_stations WHERE id ='), rows: [], firstRow: null },
    ]);
    const { status, json } = await fetchHandler(db, 'GET', '/api/kitchen-stations/NOPE/tickets');
    expect(status).toBe(404);
  });
});
