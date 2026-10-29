/**
 * Menu Route Tests — getMenu, getMenuItem (plain handlers)
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = { menu_items: [...(seedData.menu_items || [])] };

  function getTable(sql: string): string {
    const from = sql.match(/\bFROM\s+(\w+)/i);
    if (from) return from[1]!;
    return '';
  }

  function applyPredicates(rows: any[], sql: string, bindValues: any[]) {
    let idx = 0;
    let filtered = [...rows];

    if (/\bWHERE\s+id\s*=\s*\?/i.test(sql)) {
      const idVal = bindValues[idx++];
      filtered = filtered.filter((row) => row.id === idVal);
      return filtered;
    }

    if (/\bAND\s+(?:category|category_id)\s*=\s*\?/i.test(sql)) {
      const catVal = bindValues[idx++];
      filtered = filtered.filter((row) => (row.category ?? row.category_id) === catVal);
    }

    if (/\bAND\s+(?:available|is_available)\s*=\s*\?/i.test(sql)) {
      const availVal = Number(bindValues[idx++]);
      filtered = filtered.filter((row) => Number(row.available ?? row.is_available) === availVal);
    }

    if (/\bAND\s+\(name\s+LIKE\s+\?\s+OR\s+description\s+LIKE\s+\?\)/i.test(sql)) {
      const namePattern = String(bindValues[idx++] ?? '').replace(/^%|%$/g, '').toLowerCase();
      const descPattern = String(bindValues[idx++] ?? '').replace(/^%|%$/g, '').toLowerCase();
      filtered = filtered.filter((row) => {
        const name = String(row.name ?? '').toLowerCase();
        const desc = String(row.description ?? '').toLowerCase();
        return name.includes(namePattern) || desc.includes(descPattern);
      });
    }

    if (/\bLIMIT\s+\?\s+OFFSET\s+\?/i.test(sql)) {
      const limitVal = Number(bindValues[idx++]);
      const offsetVal = Number(bindValues[idx++]);
      filtered = filtered.slice(offsetVal, offsetVal + limitVal);
    }

    return filtered;
  }

  return {
    prepare: vi.fn((sql: string) => {
      const bindValues: any[] = [];
      const stmt: any = {
        _sql: sql,
        bind: vi.fn((...vals: any[]) => {
          bindValues.push(...vals);
          return stmt;
        }),
        first: vi.fn(async () => {
          const t = getTable(sql);
          const filtered = applyPredicates(tables[t] || [], sql, bindValues);
          return filtered[0] || null;
        }),
        all: vi.fn(async () => {
          const t = getTable(sql);
          const filtered = applyPredicates(tables[t] || [], sql, bindValues);
          if (/\bCOUNT\(\*\)\s+as\s+total\b/i.test(sql)) {
            return { results: [{ total: filtered.length }] };
          }
          return { results: filtered };
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
  const mod = await import('@aura/domain-catalog');
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
    expect(body.items.map((item: any) => item.id)).toEqual(['m2']);
    expect(body.pagination.total).toBe(1);
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
    expect(body.items.map((item: any) => item.id)).toEqual(['m2']);
    expect(body.pagination.total).toBe(1);
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
    expect(body.items.map((item: any) => item.id)).toEqual(['m1']);
    expect(body.pagination.total).toBe(1);
  });

  test('applies limit and offset pagination while preserving total count', async () => {
    const env = { AURA_DB: createMockD1({
      menu_items: [
        { id: 'm1', name: 'Americano', price: 30000, category: 'Coffee', available: 1, tags: '[]' },
        { id: 'm2', name: 'Espresso', price: 35000, category: 'Coffee', available: 1, tags: '[]' },
        { id: 'm3', name: 'Latte', price: 45000, category: 'Coffee', available: 1, tags: '[]' },
      ],
    })};
    const req = new Request('http://localhost/api/menu?limit=1&offset=1');

    const res = await getMenu(req, env);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.items.map((item: any) => item.id)).toEqual(['m2']);
    expect(body.pagination).toEqual({
      total: 3,
      limit: 1,
      offset: 1,
    });
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
