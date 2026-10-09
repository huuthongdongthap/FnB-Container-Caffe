/**
 * Order Persistence Test Helper
 * Shared mock environment with prepared statement logging.
 */

import { createMockEnv, createMockDB } from '../test-utils';

export interface InsertLog {
  sql: string;
  binds: unknown[];
}

export function makePersistenceTestEnv() {
  const insertLogs: InsertLog[] = [];
  const db = createMockDB();

  db.prepare = (_sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind: (...args: unknown[]) => {
        bound = args;
        return stmt;
      },
      run: async () => {
        insertLogs.push({ sql: _sql, binds: bound });
        return { success: true, changes: 1, lastRowId: 1 };
      },
      first: async () => {
        if (_sql.includes('FROM cafe_tables WHERE table_number = ?')) {
          const num = bound[0];
          if (num === '1') return { id: 'tbl-uuid-1', table_number: '1' };
          return null;
        }
        if (_sql.includes('FROM products WHERE id = ?') || _sql.includes('FROM menu_items WHERE id = ?')) {
          const id = bound[0];
          if (id === 'P1') return { id: 'P1', name: 'Espresso', price: 25000, is_available: 1, available: 1 };
          if (id === 'P2') return { id: 'P2', name: 'Croissant', price: 35000, is_available: 1, available: 1 };
          return null;
        }
        if (_sql.includes('FROM modifier_choices WHERE id = ?')) {
          if (bound[0] === 'M1') return { id: 'M1', group_id: 'G1', name: 'Oat Milk', price_delta: 10000 };
          return null;
        }
        if (_sql.includes('FROM modifier_groups WHERE id = ?')) {
          if (bound[0] === 'G1') return { id: 'G1', name: 'Milk Choice', type: 'single', required: 0, is_active: 1 };
          return null;
        }
        if (_sql.includes('FROM product_modifier_groups WHERE product_id = ? AND group_id = ?')) {
          return { product_id: bound[0], group_id: bound[1] };
        }
        if (_sql.includes('FROM orders WHERE id = ?')) {
          return { id: bound[0], status: 'pending', total: 50000, items: '[]' };
        }
        return null;
      },
      all: async () => ({ results: [], success: true }),
    };
    return stmt as any;
  };
  db.batch = async (stmts: any[]) => {
    for (const s of stmts) {
      if (s._sql) insertLogs.push({ sql: s._sql, binds: s._binds || [] });
    }
    return [{ success: true, changes: 1, meta: { changes: 1 } }] as any;
  };

  const store = new Map<string, string>();
  return {
    env: {
      ...createMockEnv(),
      AURA_DB: db,
      AUTH_KV: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => { store.set(k, v); },
        delete: async (k: string) => { store.delete(k); },
      } as any,
    } as any,
    insertLogs,
  };
}
