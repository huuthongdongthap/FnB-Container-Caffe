/**
 * Customer Menu Modifier Read Path — unit tests.
 *
 * Contract: `getCustomerMenu` returns the modifier choices linked to each
 * returned product, read from the `menu_modifiers` projection in one batched
 * query rather than one query per item.
 */
import { describe, test, expect } from 'vitest';
import { getCustomerMenu } from '../commands/get-customer-menu';
import type { D1Database } from '@cloudflare/workers-types';

interface ScriptedTable {
  match: (sql: string) => boolean;
  rows?: unknown[];
  /** Throw to simulate a missing table (pre-migration environment). */
  fails?: boolean;
}

/**
 * Minimal scripted D1. Records the bound arguments per statement so tests can
 * assert the batched read was issued once with the full product id list.
 */
function makeScriptedDB(tables: ScriptedTable[]): D1Database {
  const bound: { sql: string; args: unknown[] }[] = [];
  const db = {
    _bound: bound,
    prepare: (sql: string) => {
      const table = tables.find((t) => t.match(sql));
      const stmt = {
        bind: (...args: unknown[]) => {
          bound.push({ sql, args });
          return stmt;
        },
        first: async () => (table?.rows?.[0] ?? null),
        all: async () => {
          if (table?.fails) throw new Error('no such table: menu_modifiers');
          return { results: table?.rows ?? [] };
        },
        run: async () => ({ success: true, changes: 1, lastRowId: 1, meta: {} }),
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

const MENU_ROW = {
  id: 'P1',
  name: 'Cà phê sữa',
  description: 'Cà phê phin sữa đá',
  price: 29000,
  category: 'coffee',
  image_url: null,
  tags: null,
  available: 1,
};

describe('customer menu modifier read path', () => {
  test('returns the linked choices for a product', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('FROM menu_items'), rows: [MENU_ROW] },
      {
        match: (s) => s.includes('product_modifier_groups'),
        rows: [
          { product_id: 'P1', id: 'MC-1', group_id: 'MG-1', option_name: 'Ít đường', price_delta: 0 },
          { product_id: 'P1', id: 'MC-2', group_id: 'MG-1', option_name: 'Nhiều đường', price_delta: 5000 },
        ],
      },
    ]);

    const menu = await getCustomerMenu(db);
    const item = menu.categories[0].items[0];

    expect(item.modifierChoices).toHaveLength(2);
    expect(item.modifierChoices.map((m) => m.option_name)).toEqual(['Ít đường', 'Nhiều đường']);
    expect(item.modifierChoices[1].price_delta).toBe(5000);
  });

  test('reads modifiers for the whole page in one query', async () => {
    const db = makeScriptedDB([
      {
        match: (s) => s.includes('FROM menu_items'),
        rows: [MENU_ROW, { ...MENU_ROW, id: 'P2', name: 'Trà đào' }],
      },
      {
        match: (s) => s.includes('product_modifier_groups'),
        rows: [{ product_id: 'P1', id: 'MC-1', group_id: 'MG-1', option_name: 'Ít đường', price_delta: 0 }],
      },
    ]);

    await getCustomerMenu(db);

    // A per-item query would turn a 49-item menu into 49 round trips, so the
    // batched read must be issued exactly once with both product ids bound.
    const modifierReads = db._bound.filter((e) => e.sql.includes('product_modifier_groups'));
    expect(modifierReads).toHaveLength(1);
    expect(modifierReads[0].args).toEqual(['P1', 'P2']);
  });

  test('buckets choices by product, not across all items', async () => {
    const db = makeScriptedDB([
      {
        match: (s) => s.includes('FROM menu_items'),
        rows: [MENU_ROW, { ...MENU_ROW, id: 'P2', name: 'Trà đào' }],
      },
      {
        match: (s) => s.includes('product_modifier_groups'),
        rows: [
          { product_id: 'P1', id: 'MC-1', group_id: 'MG-1', option_name: 'Ít đường', price_delta: 0 },
          { product_id: 'P2', id: 'MC-3', group_id: 'MG-2', option_name: 'Trân châu', price_delta: 10000 },
        ],
      },
    ]);

    const items = getCustomerMenuItems(await getCustomerMenu(db));
    const p1 = items.find((i) => i.id === 'P1')!;
    const p2 = items.find((i) => i.id === 'P2')!;

    expect(p1.modifierChoices.map((m) => m.option_name)).toEqual(['Ít đường']);
    expect(p2.modifierChoices.map((m) => m.option_name)).toEqual(['Trân châu']);
  });

  test('products with no linked groups return an empty choice list', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('FROM menu_items'), rows: [MENU_ROW] },
      { match: (s) => s.includes('product_modifier_groups'), rows: [] },
    ]);

    const menu = await getCustomerMenu(db);
    expect(menu.categories[0].items[0].modifierChoices).toEqual([]);
  });

  test('excludes unavailable options so a retired choice disappears', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('FROM menu_items'), rows: [MENU_ROW] },
      {
        // The DB is free to return rows; the filter is the query's job. What we
        // assert here is that the read itself asks for available options only.
        match: (s) => s.includes('product_modifier_groups'),
        rows: [],
      },
    ]);

    const menu = await getCustomerMenu(db);
    const read = db._bound.find((e) => e.sql.includes('product_modifier_groups'))!;

    expect(menu.categories[0].items[0].modifierChoices).toEqual([]);
    expect(read.sql).toContain('mm.available = 1');
  });

  test('degrades to empty choices when the projection table is absent', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('FROM menu_items'), rows: [MENU_ROW] },
      { match: (s) => s.includes('product_modifier_groups'), rows: [], fails: true },
    ]);

    // Pre-migration environment: the menu still renders, just without options.
    const menu = await getCustomerMenu(db);
    expect(menu.totalItems).toBe(1);
    expect(menu.categories[0].items[0].modifierChoices).toEqual([]);
  });
});

/** Menu items arrive grouped by category; flatten for per-product assertions. */
function getCustomerMenuItems(menu: { categories: Array<{ items: unknown[] }> }) {
  return menu.categories.flatMap((c) => c.items) as Array<{
    id: string;
    modifierChoices: Array<{ option_name: string; price_delta: number }>;
  }>;
}
