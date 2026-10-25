/**
 * Menu Projection Sync — unit tests for modifier projection.
 *
 * Contract: `syncModifierChoiceToMenuProjection` writes the customer-facing
 * price copy into `menu_modifiers`. If the table is missing (pre-migration),
 * the error is logged, not swallowed.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncModifierChoiceToMenuProjection, mapModifierChoiceToProjection } from '../policies/menu-projection';
import type { D1Database } from '@cloudflare/workers-types';

interface ScriptedTable {
  match: (sql: string) => boolean;
  rows?: unknown[];
  /** Throw to simulate a missing table (pre-migration environment). */
  fails?: boolean;
}

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
        run: async () => {
          // The projection write is an INSERT, so the missing-table failure
          // surfaces here rather than on a read.
          if (table?.fails) throw new Error('no such table: menu_modifiers');
          return { success: true, changes: 1, lastRowId: 1, meta: {} };
        },
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

describe('menu projection sync', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('maps choice to projection row with rounded integer price_delta', () => {
    const proj = mapModifierChoiceToProjection({
      id: 'MC-1',
      group_id: 'MG-1',
      name: 'Test',
      price_delta: 5000.9,
      is_available: 1,
    });

    expect(proj.id).toBe('MC-1');
    expect(proj.group_id).toBe('MG-1');
    expect(proj.option_name).toBe('Test');
    expect(proj.price_delta).toBe(5001); // rounded
    expect(proj.available).toBe(1);
  });

  test('maps is_available: false to available: 0', () => {
    const proj = mapModifierChoiceToProjection({
      id: 'MC-1',
      group_id: 'MG-1',
      name: 'Test',
      price_delta: 0,
      is_available: 0,
    });
    expect(proj.available).toBe(0);
  });

  test('maps undefined is_available to available: 1 (default)', () => {
    const proj = mapModifierChoiceToProjection({
      id: 'MC-1',
      group_id: 'MG-1',
      name: 'Test',
      price_delta: 0,
    });
    expect(proj.available).toBe(1);
  });

  test('upserts into menu_modifiers when table exists', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('menu_modifiers'), rows: [] },
    ]);

    await syncModifierChoiceToMenuProjection(db, {
      id: 'MC-1',
      group_id: 'MG-1',
      name: 'Ít đường',
      price_delta: 0,
      is_available: 1,
    });

    const write = db._bound.find((e) => e.sql.includes('INSERT INTO menu_modifiers'))!;
    expect(write.args[0]).toBe('MC-1');
    expect(write.args[1]).toBe('MG-1');
    expect(write.args[2]).toBe('Ít đường');
    expect(write.args[3]).toBe(0);
    expect(write.args[4]).toBe(1);
  });

  test('logs an error instead of swallowing when table is absent', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('menu_modifiers'), rows: [], fails: true },
    ]);

    await syncModifierChoiceToMenuProjection(db, {
      id: 'MC-1',
      group_id: 'MG-1',
      name: 'Ít đường',
      price_delta: 0,
    });

    // The catch logs the failure so a stale projection is diagnosable.
    expect(consoleErrorSpy).toHaveBeenCalled();
    const log = consoleErrorSpy.mock.calls[0];
    expect(log[0]).toBe('[menu-projection] modifier sync failed');
    expect(log[1]).toBe('MC-1');
    expect(log[2]).toBeInstanceOf(Error);
  });

  test('no console.error when write succeeds', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('menu_modifiers'), rows: [] },
    ]);

    await syncModifierChoiceToMenuProjection(db, {
      id: 'MC-1',
      group_id: 'MG-1',
      name: 'Ít đường',
      price_delta: 0,
    });

    // Silent success — no error log.
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});