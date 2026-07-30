import { describe, test, expect, vi, beforeEach } from 'vitest';

function createMockD1() {
  const tableData: Record<string, any[]> = { shifts: [] };

  const db: any = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q,
        _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
        first: vi.fn(async function () { return null; }),
        all: vi.fn(async function () { return { results: [] }; }),
        run: vi.fn(async function () {
          const insertMatch = q.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
          if (insertMatch) {
            const tbl = insertMatch[1];
            if (!tableData[tbl]) tableData[tbl] = [];
            const row: Record<string, unknown> = {};
            const cols = q.match(/\(([^)]+)\)/);
            if (cols) {
              const names = cols[1].split(',').map((c: string) => c.trim());
              names.forEach((n: string, i: number) => { row[n] = this._bindValues[i]; });
            }
            tableData[tbl].push(row);
            console.log('INSERTED row:', row);
          }
          return { success: true, meta: { last_row_id: 1 } };
        }),
      };
      return stmt;
    }),
    batch: vi.fn(async () => [{ success: true }]),
  };
  return db;
}

describe('mock INSERT test', () => {
  test('INSERT works with this._bindValues', async () => {
    const db = createMockD1();
    const stmt = db.prepare(
      'INSERT INTO shifts (id, staff_id, staff_name, clock_in, date, notes) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = await stmt.bind('id1', 's1', 'Staff', '2026-01-01T00:00:00Z', '2026-01-01', '').run();
    console.log('result:', result);
    console.log('tableData:', JSON.stringify((db.prepare as any).mock.results));
  });
});
