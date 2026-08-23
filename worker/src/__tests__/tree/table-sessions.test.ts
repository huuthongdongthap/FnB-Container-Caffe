/**
 * Table Sessions Routes — unit tests.
 *
 * Uses a scripted D1 mock so each prepared statement can return a
 * deterministic row set, letting us exercise the route logic without
 * a live Cloudflare D1. Auth is exercised by generating a real HS-256
 * JWT so requireAuth's validateJWTSecret path is hit.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { tableSessionsRouter } from '../../routes/table-sessions';
import { requireAuth } from '../../middleware/auth';
import { generateJWT } from '../../lib/jwt';
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
      // Consume handlers in FIFO order so repeated identical SQL gets fresh data.
      // When the queue is exhausted, reuse the last handler whose SQL pattern
      // matched — routes issue a variable number of statements per call.
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

const TEST_JWT_SECRET = 'test-jwt-secret-at-least-16-chars';
const TEST_KV = new Map<string, string>();

function makeEnv(db: D1Database) {
  TEST_KV.clear();
  return {
    AURA_DB: db,
    AUTH_KV: {
      get: async (k: string) => (TEST_KV.has(k) ? TEST_KV.get(k) : null),
      put: async (k: string, v: string) => { TEST_KV.set(k, v); },
      delete: async (k: string) => { TEST_KV.delete(k); },
    } as any,
    JWT_SECRET: TEST_JWT_SECRET,
  } as any;
}

const testApp = new Hono<{ Bindings: any }>();
testApp.use('/api/table-sessions/*', requireAuth(['owner', 'staff', 'manager']));
testApp.route('/api/table-sessions', tableSessionsRouter);

async function fetchHandler(db: D1Database, method: string, path: string, body?: unknown) {
  const token = await generateJWT({ id: 'u1', email: 'a@b.c', name: 'A', role: 'owner' }, TEST_JWT_SECRET);
  const req = new Request(`https://test.aura${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const res = await testApp.fetch(req, makeEnv(db), { waitUntil: () => {} } as any);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

describe('table-sessions routes', () => {
  let db: D1Database;

  beforeEach(() => {
    db = makeScriptedDB([]);
  });

  it('POST /api/table-sessions rejects missing table_id', async () => {
    const { status, json } = await fetchHandler(db, 'POST', '/api/table-sessions', {});
    expect(status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('POST /api/table-sessions returns 409 when an active session exists', async () => {
    db = makeScriptedDB([
      { match: (s) => s.includes('table_sessions') && s.includes("status = 'active'"), rows: [{ id: 'SES-EXIST', table_id: 'T1' }] },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/table-sessions', { table_id: 'T1' });
    expect(status).toBe(409);
    expect(json.error).toContain('already has an active session');
  });

  it('POST /api/table-sessions returns 404 when the table does not exist', async () => {
    db = makeScriptedDB([
      { match: (s) => s.includes('table_sessions') && s.includes("status = 'active'"), rows: [], firstRow: null },
      { match: (s) => s.includes('cafe_tables') && s.includes('WHERE id ='), rows: [], firstRow: null },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/table-sessions', { table_id: 'NOPE' });
    expect(status).toBe(404);
    expect(json.error).toContain('Table not found');
  });

  it('POST /api/table-sessions opens a session and marks the table Occupied', async () => {
    db = makeScriptedDB([
      { match: (s) => s.includes('table_sessions') && s.includes("status = 'active'"), rows: [], firstRow: null },
      { match: (s) => s.includes('cafe_tables') && s.includes('WHERE id ='), rows: [{ id: 'T1', table_number: 5, zone: 'A', status: 'Available' }], firstRow: { id: 'T1', table_number: 5, zone: 'A', status: 'Available' } },
      { match: (s) => s.startsWith('INSERT INTO table_sessions'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('UPDATE cafe_tables SET status'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('SELECT * FROM table_sessions WHERE id ='), rows: [{ id: 'SES-NEW', table_id: 'T1', status: 'active', order_count: 0, total_amount: 0 }], firstRow: { id: 'SES-NEW', table_id: 'T1', status: 'active', order_count: 0, total_amount: 0 } },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/table-sessions', { table_id: 'T1', customer_name: 'Julian' });
    expect(status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('active');
    const occupy = db._bound.find(e => e.sql.includes('UPDATE cafe_tables SET status'))!;
    expect(occupy.args).toContain('Occupied');
    expect(json.data.status).toBe('active');
    expect(json.data.table_id).toBe('T1');
  });

  it('PATCH /api/table-sessions/:id closes the session and frees the table', async () => {
    db = makeScriptedDB([
      { match: (s) => s.startsWith('SELECT * FROM table_sessions WHERE id ='), rows: [{ id: 'SES-1', table_id: 'T1', status: 'active' }], firstRow: { id: 'SES-1', table_id: 'T1', status: 'active' } },
      { match: (s) => s.startsWith('UPDATE table_sessions'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('SELECT * FROM table_sessions WHERE id ='), rows: [{ id: 'SES-1', table_id: 'T1', status: 'closed' }], firstRow: { id: 'SES-1', table_id: 'T1', status: 'closed' } },
    ]);
    const { status, json } = await fetchHandler(db, 'PATCH', '/api/table-sessions/SES-1', { status: 'closed' });
    expect(status).toBe(200);
    const free = db._bound.find(e => e.sql.includes('UPDATE cafe_tables SET status'))!;
    expect(free.args).toContain('Available');
    expect(json.data.status).toBe('closed');
  });

  it('PATCH /api/table-sessions/:id rejects invalid status', async () => {
    db = makeScriptedDB([
      { match: (s) => s.startsWith('SELECT * FROM table_sessions WHERE id ='), rows: [{ id: 'SES-1', table_id: 'T1', status: 'active' }], firstRow: { id: 'SES-1', table_id: 'T1', status: 'active' } },
    ]);
    const { status, json } = await fetchHandler(db, 'PATCH', '/api/table-sessions/SES-1', { status: 'bogus' });
    expect(status).toBe(400);
    expect(json.error).toContain('Invalid status');
  });

  it('PATCH /api/table-sessions/:id returns 404 for unknown session', async () => {
    db = makeScriptedDB([
      { match: (s) => s.startsWith('SELECT * FROM table_sessions WHERE id ='), rows: [], firstRow: null },
    ]);
    const { status, json } = await fetchHandler(db, 'PATCH', '/api/table-sessions/NOPE', { status: 'closed' });
    expect(status).toBe(404);
  });

  it('POST /api/table-sessions/:id/orders returns 404 when session is closed', async () => {
    db = makeScriptedDB([
      { match: (s) => s.includes('table_sessions') && s.includes("status != 'closed'"), rows: [], firstRow: null },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/table-sessions/SES-1/orders', { order_id: 'ORD-1' });
    expect(status).toBe(404);
    expect(json.error).toContain('already closed');
  });

  it('POST /api/table-sessions/:id/orders rejects missing order_id', async () => {
    db = makeScriptedDB([
      { match: (s) => s.includes('table_sessions') && s.includes("status != 'closed'"), rows: [{ id: 'SES-1', table_id: 'T1' }], firstRow: { id: 'SES-1', table_id: 'T1' } },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/table-sessions/SES-1/orders', {});
    expect(status).toBe(400);
    expect(json.error).toContain('order_id is required');
  });

  it('GET /api/table-sessions/:id/orders returns 404 for unknown session', async () => {
    db = makeScriptedDB([
      { match: (s) => s.startsWith('SELECT id FROM table_sessions WHERE id ='), rows: [], firstRow: null },
    ]);
    const { status, json } = await fetchHandler(db, 'GET', '/api/table-sessions/NOPE/orders');
    expect(status).toBe(404);
  });

  it('GET /api/table-sessions/:id/orders lists orders for the session', async () => {
    db = makeScriptedDB([
      { match: (s) => s.startsWith('SELECT id FROM table_sessions WHERE id ='), rows: [{ id: 'SES-1' }], firstRow: { id: 'SES-1' } },
      { match: (s) => s.includes('SELECT * FROM orders WHERE table_id'), rows: [{ id: 'ORD-1', total: 120000 }, { id: 'ORD-2', total: 80000 }], firstRow: undefined },
    ]);
    const { status, json } = await fetchHandler(db, 'GET', '/api/table-sessions/SES-1/orders');
    expect(status).toBe(200);
    expect(json.data).toHaveLength(2);
  });

  it('GET /api/table-sessions/:id returns 404 for unknown session', async () => {
    db = makeScriptedDB([
      { match: (s) => s.startsWith('SELECT * FROM table_sessions WHERE id ='), rows: [], firstRow: null },
    ]);
    const { status, json } = await fetchHandler(db, 'GET', '/api/table-sessions/NOPE');
    expect(status).toBe(404);
  });
});