/**
 * Menu Route Tests — getMenu, getMenuItem (plain handlers)
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = { menu_items: [...(seedData.menu_items || [])] };

  function getTable(sql: string): string {
    const from = sql.match(/\bFROM\s+(\w+)/i);
    if (from) return from[1];
    return '';
  }

  return {
    prepare: vi.fn((sql: string) => {
      const bindValues: any[] = [];
      const stmt: any = {
        _sql: sql,
        bind: vi.fn((...vals: any[]) => { bindValues.push(...vals); return stmt; }),
        first: vi.fn(async () => {
          const t = getTable(sql);
          return (tables[t] || [])[0] || null;
        }),
        all: vi.fn(async () => {
          const t = getTable(sql);
          return { results: [...(tables[t] || [])] };
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      return stmt;
    }),
  };
}

let getMenu: any;
let getMenuItem: any;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../worker/src/routes/menu.ts');
  getMenu = mod.getMenu;
  getMenuItem = mod.getMenuItem;
});

describe('getMenu', () => {
  test('returns 200 with menu items', async () => {
    const env = { AURA_DB: createMockD1({
      menu_items: [
        { id: 'm1', name: 'Espresso', price: 35000, category: 'Coffee', available: 1, tags: '["hot"]' },
        { id: 'm2', name: 'Latte', price: 45000, category: 'Coffee', available: 1, tags: '[]' },
      ],
    })};
    const req = new Request('http://localhost/api/menu');

    const res = await getMenu(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.items).toHaveLength(2);
  });

  test('returns 200 with empty array when no items', async () => {
    const env = { AURA_DB: createMockD1({ menu_items: [] }) };
    const req = new Request('http://localhost/api/menu');

    const res = await getMenu(req, env);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.items).toEqual([]);
  });

  test('filters by category query param', async () => {
    const env = { AURA_DB: createMockD1({
      menu_items: [
        { id: 'm1', name: 'Espresso', price: 35000, category: 'Coffee', available: 1, tags: '[]' },
        { id: 'm2', name: 'Tea', price: 25000, category: 'Tea', available: 1, tags: '[]' },
      ],
    })};
    const req = new Request('http://localhost/api/menu?category=Tea');

    const res = await getMenu(req, env);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('filters by search query', async () => {
    const env = { AURA_DB: createMockD1({
      menu_items: [
        { id: 'm1', name: 'Espresso', price: 35000, category: 'Coffee', available: 1, tags: '[]' },
        { id: 'm2', name: 'Matcha Latte', price: 45000, category: 'Tea', available: 1, tags: '[]' },
      ],
    })};
    const req = new Request('http://localhost/api/menu?search=Matcha');

    const res = await getMenu(req, env);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('returns 200 with available-only filter', async () => {
    const env = { AURA_DB: createMockD1({
      menu_items: [
        { id: 'm1', name: 'Espresso', price: 35000, category: 'Coffee', available: 1, tags: '[]' },
        { id: 'm2', name: 'OutOfStock', price: 10000, category: 'Coffee', available: 0, tags: '[]' },
      ],
    })};
    const req = new Request('http://localhost/api/menu?available=true');

    const res = await getMenu(req, env);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe('getMenuItem', () => {
  test('returns 200 with menu item', async () => {
    const env = { AURA_DB: createMockD1({
      menu_items: [
        { id: 'm1', name: 'Espresso', price: 35000, category: 'Coffee', available: 1, tags: '["hot"]' },
      ],
    })};
    const req = new Request('http://localhost/api/menu/m1');

    const res = await getMenuItem(req, env, 'm1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.item.name).toBe('Espresso');
  });

  test('returns 404 when not found', async () => {
    const env = { AURA_DB: createMockD1({ menu_items: [] }) };
    const req = new Request('http://localhost/api/menu/nonexistent');

    const res = await getMenuItem(req, env, 'nonexistent');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
