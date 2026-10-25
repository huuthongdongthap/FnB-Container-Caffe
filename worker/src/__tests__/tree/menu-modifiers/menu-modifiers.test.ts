/**
 * Menu Modifiers + Happy Hour Routes — unit tests.
 *
 * Reuses the scripted D1 mock pattern from table-sessions.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { menuModifiersRouter } from '@aura/domain-catalog';
import { requireAuth } from '../../../middleware/auth';
import { generateJWT } from '../../../lib/jwt';
import type { D1Database } from '@cloudflare/workers-types';

interface ScriptedRow { [key: string]: unknown }

function makeScriptedDB(rowsBySql: Array<{ match: (sql: string) => boolean; rows: ScriptedRow[]; firstRow?: ScriptedRow | null }>): D1Database {
  const callLog: string[] = [];
  const boundLog: { sql: string; args: unknown[] }[] = [];
  let idx = 0;
  const acctStmt: any = { bind: () => acctStmt, first: async () => ({ id: 'u1', name: 'Staff', phone: null, role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 }), all: async () => ({ results: [], success: true, meta: {} }), run: async () => ({ success: true, changes: 1, lastRowId: 1, meta: {} }), raw: async () => [] };
  const db = {
    _log: callLog,
    _bound: boundLog,
    prepare: (sql: string) => {
      // The request-time session gate reads the staff account row; without a
      // fixture for it the gate cannot tell a live session from a revoked one.
      if (/FROM users WHERE id = \?/i.test(sql)) return acctStmt;
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
app.use('/api/menu-modifiers/*', requireAuth(['owner', 'staff', 'manager']));
app.route('/api/menu-modifiers', menuModifiersRouter);

async function fetchHandler(db: D1Database, method: string, path: string, body?: unknown) {
  const token = await generateJWT({ id: 'u1', email: 'a@b.c', name: 'A', role: 'owner' , authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web'}, SECRET, 28800);
  const req = new Request(`https://test.aura${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const res = await app.fetch(req, makeEnv(db), { waitUntil: () => {} } as any);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

describe('menu-modifiers routes', () => {
  it('GET /groups lists modifier groups', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('modifier_groups'), rows: [{ id: 'MG-1', name: 'Đường', type: 'single', required: 0 }] },
    ]);
    const { status, json } = await fetchHandler(db, 'GET', '/api/menu-modifiers/groups');
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
  });

  it('POST /groups creates a group', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.startsWith('INSERT INTO modifier_groups'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('SELECT * FROM modifier_groups WHERE id ='), rows: [{ id: 'MG-NEW', name: 'Kích thước', type: 'single', required: 0 }], firstRow: { id: 'MG-NEW', name: 'Kích thước', type: 'single', required: 0 } },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/menu-modifiers/groups', { name: 'Kích thước', type: 'single' });
    expect(status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('Kích thước');
  });

  it('POST /groups rejects missing name', async () => {
    const db = makeScriptedDB([]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/menu-modifiers/groups', {});
    expect(status).toBe(400);
    expect(json.error).toContain('name is required');
  });

  it('POST /groups/:groupId/choices creates a choice', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('modifier_groups WHERE id ='), rows: [{ id: 'MG-1' }], firstRow: { id: 'MG-1' } },
      { match: (s) => s.startsWith('INSERT INTO modifier_choices'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('SELECT * FROM modifier_choices WHERE id ='), rows: [{ id: 'MC-1', group_id: 'MG-1', name: 'Ít đường', price_delta: 0 }], firstRow: { id: 'MC-1', group_id: 'MG-1', name: 'Ít đường', price_delta: 0 } },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/menu-modifiers/groups/MG-1/choices', { name: 'Ít đường', price_delta: 0 });
    expect(status).toBe(201);
    expect(json.data.name).toBe('Ít đường');
  });

  it('POST /groups/:groupId/choices returns 404 for unknown group', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('modifier_groups WHERE id ='), rows: [], firstRow: null },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/menu-modifiers/groups/NOPE/choices', { name: 'X' });
    expect(status).toBe(404);
  });

  it('POST /products/:pid/groups links a modifier group', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('modifier_groups WHERE id ='), rows: [{ id: 'MG-1' }], firstRow: { id: 'MG-1' } },
      { match: (s) => s.startsWith('INSERT OR IGNORE INTO product_modifier_groups'), rows: [], firstRow: null },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/menu-modifiers/products/P1/groups', { group_id: 'MG-1' });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    const linkSQL = db._bound.find(e => e.sql.includes('product_modifier_groups'))!;
    expect(linkSQL.args).toContain('P1');
    expect(linkSQL.args).toContain('MG-1');
  });

  it('POST /happy-hour creates a window', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.startsWith('INSERT INTO happy_hour_windows'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('SELECT * FROM happy_hour_windows WHERE id ='), rows: [{ id: 'HH-1', name: 'Sáng', day_of_week: 1, start_time: '07:00', end_time: '10:00', discount_rate: 0.2 }], firstRow: { id: 'HH-1', name: 'Sáng', day_of_week: 1, start_time: '07:00', end_time: '10:00', discount_rate: 0.2 } },
    ]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/menu-modifiers/happy-hour', { name: 'Sáng', day_of_week: 1, start_time: '07:00', end_time: '10:00', discount_rate: 0.2 });
    expect(status).toBe(201);
    expect(json.data.discount_rate).toBe(0.2);
  });

  it('POST /happy-hour rejects invalid day_of_week', async () => {
    const db = makeScriptedDB([]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/menu-modifiers/happy-hour', { name: 'X', day_of_week: 9, start_time: '07:00', end_time: '10:00', discount_rate: 0.1 });
    expect(status).toBe(400);
    expect(json.error).toContain('day_of_week');
  });

  it('POST /happy-hour rejects discount_rate out of range', async () => {
    const db = makeScriptedDB([]);
    const { status, json } = await fetchHandler(db, 'POST', '/api/menu-modifiers/happy-hour', { name: 'X', day_of_week: 1, start_time: '07:00', end_time: '10:00', discount_rate: 1.5 });
    expect(status).toBe(400);
    expect(json.error).toContain('discount_rate');
  });

  it('PATCH /groups/:groupId/choices/:choiceId repriced in both the canonical and projection tables', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('modifier_choices WHERE id = ? AND group_id = ?'), rows: [{ id: 'MC-1' }], firstRow: { id: 'MC-1' } },
      { match: (s) => s.startsWith('UPDATE modifier_choices'), rows: [], firstRow: null },
      { match: (s) => s.includes('menu_modifiers'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('SELECT * FROM modifier_choices WHERE id = ?'), rows: [{ id: 'MC-1', group_id: 'MG-1', name: 'Nhiều đường', price_delta: 5000 }], firstRow: { id: 'MC-1', group_id: 'MG-1', name: 'Nhiều đường', price_delta: 5000 } },
    ]);
    const { status, json } = await fetchHandler(db, 'PATCH', '/api/menu-modifiers/groups/MG-1/choices/MC-1', {
      name: 'Nhiều đường',
      price_delta: 5000,
    });

    expect(status).toBe(200);
    expect(json.data.price_delta).toBe(5000);

    // The projection is the customer-facing copy of this price; if the PATCH
    // updates modifier_choices alone the customer reads the stale number.
    const canonical = db._bound.find(e => e.sql.startsWith('UPDATE modifier_choices'))!;
    expect(canonical.args).toEqual(['Nhiều đường', 5000, 1, 'MC-1', 'MG-1']);

    const projection = db._bound.find(e => e.sql.includes('menu_modifiers'))!;
    expect(projection.args[2]).toBe('Nhiều đường');
    expect(projection.args[3]).toBe(5000);
  });

  it('PATCH rejects a non-integer price_delta', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('modifier_choices WHERE id = ? AND group_id = ?'), rows: [{ id: 'MC-1' }], firstRow: { id: 'MC-1' } },
    ]);
    const { status, json } = await fetchHandler(db, 'PATCH', '/api/menu-modifiers/groups/MG-1/choices/MC-1', {
      name: 'X',
      price_delta: 'abc',
    });

    expect(status).toBe(400);
    expect(json.error).toContain('integer');
    expect(db._bound.some(e => e.sql.startsWith('UPDATE modifier_choices'))).toBe(false);
  });

  it('PATCH rejects a choice that belongs to another group', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('modifier_choices WHERE id = ? AND group_id = ?'), rows: [], firstRow: null },
    ]);
    const { status } = await fetchHandler(db, 'PATCH', '/api/menu-modifiers/groups/MG-2/choices/MC-1', {
      name: 'X',
      price_delta: 1000,
    });

    expect(status).toBe(404);
    expect(db._bound.some(e => e.sql.startsWith('UPDATE modifier_choices'))).toBe(false);
  });

  it('PATCH requires a staff session', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('modifier_choices'), rows: [{ id: 'MC-1' }], firstRow: { id: 'MC-1' } },
    ]);
    // No Authorization header: the session gate must refuse before any write.
    const res = await app.fetch(
      new Request('https://test.aura/api/menu-modifiers/groups/MG-1/choices/MC-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'X', price_delta: 1 }),
      }),
      makeEnv(db),
      { waitUntil: () => {} } as any,
    );

    expect([401, 403]).toContain(res.status);
    expect(db._bound.some(e => e.sql.startsWith('UPDATE modifier_choices'))).toBe(false);
  });

  it('DELETE choice retires it from the customer projection too', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('modifier_choices WHERE id = ? AND group_id = ?'), rows: [{ id: 'MC-1' }], firstRow: { id: 'MC-1' } },
      { match: (s) => s.startsWith('DELETE FROM modifier_choices'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('DELETE FROM menu_modifiers'), rows: [], firstRow: null },
    ]);
    const { status } = await fetchHandler(db, 'DELETE', '/api/menu-modifiers/groups/MG-1/choices/MC-1');

    expect(status).toBe(200);
    // Deleting the canonical row alone leaves the option on the customer menu.
    expect(db._bound.some(e => e.sql.includes('DELETE FROM menu_modifiers'))).toBe(true);
  });

  it('DELETE group clears orphan product links', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('modifier_groups WHERE id = ?'), rows: [{ id: 'MG-1' }], firstRow: { id: 'MG-1' } },
      { match: (s) => s.startsWith('DELETE FROM product_modifier_groups'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('DELETE FROM menu_modifiers'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('DELETE FROM modifier_groups'), rows: [], firstRow: null },
    ]);
    const { status } = await fetchHandler(db, 'DELETE', '/api/menu-modifiers/groups/MG-1');

    expect(status).toBe(200);
    // product_modifier_groups has no FK to products, so the cascade on
    // modifier_choices leaves these rows behind and the product loses silently.
    const linkDelete = db._bound.find(e => e.sql.startsWith('DELETE FROM product_modifier_groups'));
    expect(linkDelete).toBeDefined();
    expect(linkDelete!.args).toContain('MG-1');
  });

  it('GET /groups/:groupId/choices lists choices', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('modifier_choices WHERE group_id = ?'), rows: [{ id: 'MC-1', group_id: 'MG-1', name: 'Ít đường', price_delta: 0 }] },
    ]);
    const { status, json } = await fetchHandler(db, 'GET', '/api/menu-modifiers/groups/MG-1/choices');
    expect(status).toBe(200);
    expect(json.data).toHaveLength(1);
  });
});
