/**
 * Unit tests for menu routes (getMenu, getMenuItem)
 */

import { describe, it, expect, vi } from 'vitest';
import { getMenu, getMenuItem } from '../../routes/menu';
import { createMockEnv, createMockDB } from '../test-utils';

const SAMPLE_MENU = [
  { id: '1', name: 'Espresso', category: 'coffee', price: 35000, available: 1 },
  { id: '2', name: 'Latte', category: 'coffee', price: 45000, available: 1 },
  { id: '3', name: 'Green Tea', category: 'tea', price: 30000, available: 0 }
];

function menuMockDB() {
  const db = createMockDB();
  db.prepare = ((sql: string) => ({
    _sql: sql,
    _binds: [] as unknown[],
    bind(...args: unknown[]) {
      this._binds = args; return this;
    },
    first: async() => {
      if (sql.includes('WHERE id = ?')) {
        return SAMPLE_MENU[0];
      }
      return null;
    },
    all: async() => {
      const results = [...SAMPLE_MENU];
      const stmt = db.prepare as any;
      const binds = stmt._binds || [];
      return { results, success: true };
    },
    run: async() => ({ success: true, changes: 0, lastRowId: 0 }),
    raw: async() => []
  })) as any;
  return db;
}

describe('getMenu', () => {
  it('returns all menu items', async() => {
    const env = { ...createMockEnv(), AURA_DB: menuMockDB() };
    const req = new Request('https://test.aura/api/menu');
    const res = await getMenu(req, env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
  });
});

describe('getMenuItem', () => {
  it('returns a single item by ID', async() => {
    const env = { ...createMockEnv(), AURA_DB: menuMockDB() };
    const req = new Request('https://test.aura/api/menu/1');
    const res = await getMenuItem(req, env, '1');
    expect(res.status).toBe(200);
  });
});
