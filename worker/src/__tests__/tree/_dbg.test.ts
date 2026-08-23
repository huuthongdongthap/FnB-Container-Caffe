import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { tableSessionsRouter } from '../../routes/table-sessions';
import { requireAuth } from '../../middleware/auth';
import { generateJWT } from '../../lib/jwt';
import type { D1Database } from '@cloudflare/workers-types';

interface ScriptedRow { [key: string]: unknown }
function makeScriptedDB(rowsBySql: Array<{ match: (sql: string) => boolean; rows: ScriptedRow[]; firstRow?: ScriptedRow | null }>): D1Database {
  const callLog: string[] = [];
  const queue = [...rowsBySql];
  const db = {
    _log: callLog,
    prepare: (sql: string) => {
      callLog.push(sql);
      let handler = queue.shift();
      if (!handler) handler = rowsBySql.find(h => h.match(sql));
      const rows = handler?.rows ?? [];
      const firstRow = handler?.firstRow !== undefined ? handler.firstRow : (rows[0] ?? null);
      return {
        bind: (..._args: unknown[]) => db.prepare(sql),
        run: async () => ({ success: true, changes: 1, lastRowId: 1, meta: {} }),
        first: async () => firstRow,
        all: async () => ({ results: rows, success: true, meta: {} }),
        raw: async () => [],
      };
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  } as unknown as D1Database;
  return db;
}

describe('dbg', () => {
  it('debug POST', async () => {
    const TEST_KV = new Map<string, string>();
    const db = makeScriptedDB([
      { match: (s) => s.includes('table_sessions') && s.includes("status = 'active'"), rows: [], firstRow: null },
      { match: (s) => s.includes('cafe_tables') && s.includes('WHERE id ='), rows: [{ id: 'T1', table_number: 5, zone: 'A', status: 'Available' }], firstRow: { id: 'T1', table_number: 5, zone: 'A', status: 'Available' } },
      { match: (s) => s.startsWith('INSERT INTO table_sessions'), rows: [], firstRow: null },
      { match: (s) => s.startsWith('SELECT * FROM table_sessions WHERE id ='), rows: [{ id: 'SES-NEW', table_id: 'T1', status: 'active', order_count: 0, total_amount: 0 }], firstRow: { id: 'SES-NEW', table_id: 'T1', status: 'active', order_count: 0, total_amount: 0 } },
    ]);
    const token = await generateJWT({ id: 'u1', email: 'a@b.c', name: 'A', role: 'owner' }, 'test-jwt-secret-at-least-16-chars');
    const app = new Hono();
    app.use('/api/table-sessions/*', requireAuth(['owner', 'staff', 'manager']));
    app.route('/api/table-sessions', tableSessionsRouter);
    const req = new Request('https://test.aura/api/table-sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ table_id: 'T1', customer_name: 'Julian' }) });
    const res = await app.fetch(req, { AURA_DB: db, AUTH_KV: { get: async () => null, put: async () => {}, delete: async () => {} } as any, JWT_SECRET: 'test-jwt-secret-at-least-16-chars' } as any, { waitUntil: () => {} } as any);
    require('fs').appendFileSync('/tmp/dbg.txt', 'STATUS ' + res.status + '\n');
    require('fs').appendFileSync('/tmp/dbg.txt', 'BODY ' + await res.clone().text() + '\n');
    require('fs').appendFileSync('/tmp/dbg.txt', 'LOGS ' + JSON.stringify(db._log) + '\n');
  });
});
