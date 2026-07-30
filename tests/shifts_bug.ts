import { Hono } from 'hono';
import { describe, test, expect, vi } from 'vitest';

vi.mock('../worker/src/middleware/auth.js', () => ({
  requireAuth: () => async (c: any, next: any) => { c.set('user', { id: 'test' }); await next(); },
}));

function createMockD1() {
  const tableData: Record<string, any[]> = { shifts: [] };

  const db: any = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q,
        bind: vi.fn(function (...vals: any[]) { this._bindValues = vals; return this; }),
        first: vi.fn(async function () { 
          const fromMatch = q.match(/\bFROM\s+(\w+)/i);
          const table = fromMatch ? fromMatch[1] : null;
          const rows = table && tableData[table] ? tableData[table] : [];
          return rows[0] || null; 
        }),
        all: vi.fn(async function () { 
          const fromMatch = q.match(/\bFROM\s+(\w+)/i);
          const table = fromMatch ? fromMatch[1] : null;
          const rows = table && tableData[table] ? tableData[table] : [];
          return { results: [...rows] }; 
        }),
        run: vi.fn(async function () {
          const insertMatch = q.match(/INSERT/i);
          console.log('RUN called, INSERT?', !!insertMatch, 'this._bindValues?', this._bindValues);
          return { success: true };
        }),
      };
      return stmt;
    }),
    batch: vi.fn(async () => [{ success: true }]),
  };
  return db;
}

describe('shifts minimal', () => {
  test('debug', async () => {
    const db = createMockD1();
    console.log('db object:', typeof db);
    console.log('prepare fn?', typeof db.prepare);
    const stmt = db.prepare('INSERT INTO shifts (id) VALUES (?)');
    console.log('stmt:', typeof stmt);
    await stmt.bind('x').run();
  });
});
