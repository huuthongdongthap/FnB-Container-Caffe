/**
 * Unit tests for menu routes (getMenu, getMenuItem)
 */

import { describe, it, expect, vi } from 'vitest';
import { getMenu, getMenuItem } from '@aura/domain-catalog';
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

  it('scrubs raw database error messages on 500 in getMenu and getMenuItem', async() => {
    const brokenDb = {
      prepare: () => {
        throw new Error('D1_MENU_SQL_SECRET_ERROR');
      }
    };
    const env = { ...createMockEnv(), AURA_DB: brokenDb };

    const menuRes = await getMenu(new Request('https://test.aura/api/menu'), env);
    expect(menuRes.status).toBe(500);
    const menuBody = await menuRes.json() as { error: string };
    expect(menuBody.error).toBe('Failed to fetch menu');
    expect(menuBody.error).not.toContain('D1_MENU_SQL_SECRET_ERROR');

    const itemRes = await getMenuItem(new Request('https://test.aura/api/menu/1'), env, '1');
    expect(itemRes.status).toBe(500);
    const itemBody = await itemRes.json() as { error: string };
    expect(itemBody.error).toBe('Failed to fetch menu item');
    expect(itemBody.error).not.toContain('D1_MENU_SQL_SECRET_ERROR');
  });
});
